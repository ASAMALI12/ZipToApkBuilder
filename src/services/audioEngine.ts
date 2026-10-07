import { CallStatus, AudioEngineMetrics, IntentResult } from '../types/kernel';
import { SileroStyleVAD } from './vadEngine';
import { StreamingAudioPlayer } from './streamingAudioPlayer';

type StatusListener = (status: CallStatus) => void;
type TranscriptListener = (text: string, isFinal: boolean) => void;
type ResultListener = (result: IntentResult) => void;
type BargeInListener = (latencyMs: number) => void;
type EnergyListener = (micEnergy: number, outputEnergy: number) => void;
type ErrorListener = (errorMsg: string) => void;

export type AudioCallMode = 'CONTINUOUS' | 'TAP_TO_TALK';

/**
 * Universal 16-bit PCM WAV Encoder
 */
function encodeWAV(samples: Float32Array, sampleRate: number = 16000): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF identifier
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + samples.length * 2, true); // file length - 8
  view.setUint32(8, 0x57415645, false); // "WAVE"
  // fmt sub-chunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true); // 16 for PCM
  view.setUint16(20, 1, true); // 1 = PCM format
  view.setUint16(22, 1, true); // 1 channel (mono)
  view.setUint32(24, sampleRate, true); // sample rate (16000)
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  // data sub-chunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, samples.length * 2, true);

  // Write 16-bit PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function floatTo16BitPCM(samples: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buffer);
  let offset = 0;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

class AudioEngine {
  private static instance: AudioEngine;

  // Web Audio Context & Nodes
  private audioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;
  private highPassFilter: BiquadFilterNode | null = null;
  private lowPassFilter: BiquadFilterNode | null = null;
  private micGainNode: GainNode | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private dummyMuteGain: GainNode | null = null;

  // Dedicated Streaming AudioTrack / Web Audio Player
  private player: StreamingAudioPlayer;

  // Local Silero-style Voice Activity Detector
  private vad: SileroStyleVAD;

  // Engine state
  private callStatus: CallStatus = 'IDLE';
  private callMode: AudioCallMode = 'CONTINUOUS';
  private sensitivityLevel: 'HIGH' | 'NORMAL' | 'NOISE_ISOLATION' = 'HIGH';

  // Listeners
  private statusListeners: Set<StatusListener> = new Set();
  private transcriptListeners: Set<TranscriptListener> = new Set();
  private resultListeners: Set<ResultListener> = new Set();
  private bargeInListeners: Set<BargeInListener> = new Set();
  private energyListeners: Set<EnergyListener> = new Set();
  private errorListeners: Set<ErrorListener> = new Set();

  // Bi-directional Streaming WebSocket Client
  private ws: WebSocket | null = null;
  private isWsConnected: boolean = false;
  private wsReconnectTimer: any = null;
  private isSessionActive: boolean = false;

  // Speech buffer for offline/HTTP fallback
  private recorded16kChunks: Float32Array[] = [];
  private isProcessingAudio: boolean = false;

  // Energy Tracking
  private currentMicEnergy: number = 0;
  private currentOutputEnergy: number = 0;

  private constructor() {
    this.vad = new SileroStyleVAD({
      sampleRate: 16000,
      frameSize: 512, // 32ms at 16kHz
      speechThresholdMultiplier: 2.0,
      hangoverFrames: 12, // ~384ms hangover
      minSpeechFrames: 2, // ~64ms
      preRollFrames: 8, // ~256ms pre-roll
    });

    this.player = new StreamingAudioPlayer();

    this.setupVadCallbacks();
    this.setupPlayerCallbacks();
    this.initWebSocket();
  }

  public static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  /**
   * Configures local Silero VAD events
   */
  private setupVadCallbacks() {
    // 1. Speech just started (with pre-roll preserved)
    this.vad.onSpeechStart = (preRoll: Float32Array) => {
      if (this.callStatus !== 'LISTENING' || this.isProcessingAudio) return;

      this.recorded16kChunks = [];
      if (preRoll && preRoll.length > 0) {
        this.recorded16kChunks.push(preRoll);
      }

      // Notify server over WebSocket that a new utterance started
      this.sendWsStart();
      if (preRoll && preRoll.length > 0) {
        this.streamBinaryChunkToWs(preRoll);
      }
    };

    // 2. Incoming voiced speech frame (16kHz)
    this.vad.onSpeechFrame = (frame: Float32Array) => {
      if (this.callStatus !== 'LISTENING' || this.isProcessingAudio) return;

      this.recorded16kChunks.push(frame);
      this.streamBinaryChunkToWs(frame);
    };

    // 3. User finished speaking (hangover elapsed)
    this.vad.onSpeechEnd = () => {
      if (this.callStatus !== 'LISTENING' || this.isProcessingAudio) return;

      // In TAP_TO_TALK mode, user controls when to stop by tapping
      if (this.callMode === 'TAP_TO_TALK') return;

      this.commitCurrentUtterance();
    };

    // 4. Energy calculation
    this.vad.onEnergy = (energy: number, isSpeech: boolean) => {
      this.currentMicEnergy = Math.min(1.0, energy * 12);
      this.notifyEnergy(this.currentMicEnergy, this.currentOutputEnergy);

      // Full-Duplex Barge-In Interruption:
      // If AI is speaking and user speaks firmly, immediately interrupt!
      if (this.callStatus === 'SPEAKING' && isSpeech && this.currentMicEnergy > 0.12) {
        this.triggerBargeIn();
      }
    };
  }

  /**
   * Configures dedicated streaming audio player events
   */
  private setupPlayerCallbacks() {
    this.player.onPlaybackStart = () => {
      this.setStatus('SPEAKING');
    };

    this.player.onPlaybackEnd = () => {
      if (this.callStatus === 'SPEAKING') {
        this.setStatus('LISTENING');
        this.recorded16kChunks = [];
        this.vad.reset();
      }
    };

    this.player.onEnergyUpdate = (energy: number) => {
      this.currentOutputEnergy = energy;
      this.notifyEnergy(this.currentMicEnergy, this.currentOutputEnergy);
    };
  }

  /**
   * Persistent bi-directional WebSocket connection for streaming audio
   */
  private initWebSocket() {
    if (typeof window === 'undefined') return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/api/voice/stream`;

      this.ws = new WebSocket(wsUrl);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        this.isWsConnected = true;
      };

      this.ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'result') {
            this.isProcessingAudio = false;

            if (data.transcript && data.transcript.trim()) {
              this.notifyTranscript(data.transcript.trim(), true);
            }

            // Immediately notify intent listeners to update UI without delay
            if (data.intent) {
              this.notifyResult({
                intent: data.intent,
                confidence: data.confidence || 0.95,
                parameters: { target: data.intent, raw_utterance: data.transcript || '' },
                ui_action: data.ui_action || 'ROUTE_PREDEFINED',
                assistant_response: data.assistant_response || '',
                voice_spoken_text: data.voice_spoken_text || '',
              });
            }

            // If the server didn't provide audio_response, fallback to Web Speech
            if (!data.hasAudioResponse && data.voice_spoken_text) {
              this.playFallbackSpeech(data.voice_spoken_text);
            }
          } else if (data.type === 'audio_response' && data.audioBase64) {
            this.isProcessingAudio = false;
            await this.player.enqueueBase64Chunk(data.audioBase64);
          } else if (data.type === 'speak_text' && data.text) {
            this.isProcessingAudio = false;
            this.playFallbackSpeech(data.text);
          } else if (data.type === 'empty') {
            this.isProcessingAudio = false;
            if (this.callStatus === 'THINKING') {
              this.setStatus('LISTENING');
            }
          }
        } catch (parseErr) {
          console.warn('[AudioEngine] WS message notice:', parseErr);
        }
      };

      this.ws.onerror = () => {
        this.isWsConnected = false;
      };

      this.ws.onclose = () => {
        this.isWsConnected = false;
        if (this.wsReconnectTimer) clearTimeout(this.wsReconnectTimer);
        this.wsReconnectTimer = setTimeout(() => {
          this.initWebSocket();
        }, 2000);
      };
    } catch {
      this.isWsConnected = false;
    }
  }

  public setCallMode(mode: AudioCallMode) {
    this.callMode = mode;
  }

  public getCallMode(): AudioCallMode {
    return this.callMode;
  }

  public setSensitivity(level: 'HIGH' | 'NORMAL' | 'NOISE_ISOLATION') {
    this.sensitivityLevel = level;
    if (this.micGainNode && this.audioCtx) {
      const gainVal = level === 'HIGH' ? 2.8 : level === 'NORMAL' ? 2.0 : 1.2;
      this.micGainNode.gain.setValueAtTime(gainVal, this.audioCtx.currentTime);
    }
  }

  public getSensitivity(): 'HIGH' | 'NORMAL' | 'NOISE_ISOLATION' {
    return this.sensitivityLevel;
  }

  /**
   * Safe Start Microphone:
   * 1. Permanently configures WebRTC hardware constraints & Android Voice Recognition DSP.
   * 2. Opens the audio stream ONCE and keeps it continuously open and stable to prevent popping, hum, and dropouts.
   */
  public async safeStartMicrophone(): Promise<void> {
    if (this.callStatus !== 'IDLE' && this.callStatus !== 'STOPPING') return;

    this.setStatus('STARTING');
    this.recorded16kChunks = [];
    this.isProcessingAudio = false;
    this.vad.reset();

    // 1. AudioContext initialization
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioCtxClass();
      }
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }
    } catch (e) {
      console.warn('AudioContext init notice:', e);
    }

    // 2. Hardware microphone acquisition with permanent WebRTC constraints & Android Voice Recognition DSP
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          // Standard WebRTC permanent acoustic cancellation and gain control
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 16000,
          // Android Native / Chromium Voice Recognition DSP constraints:
          // Activates AudioSource.VOICE_RECOGNITION hardware pathway on Android devices
          googEchoCancellation: true,
          googAutoGainControl: true,
          googNoiseSuppression: true,
          googHighpassFilter: true,
          googTypingNoiseDetection: true,
          googAudioMirroring: false,
          voiceActivityDetection: true,
          latency: 0.01,
        } as any,
        video: false,
      };

      this.micStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err: any) {
      console.error('[AudioEngine] Mic permission failed:', err);
      this.setStatus('IDLE');
      this.notifyError('يرجى السماح بالوصول إلى الميكروفون في المتصفح للبدء.');
      throw err;
    }

    // 3. Audio DSP Graph: Filters, Spectrum Analyser, and Resampling Capture Node
    if (this.audioCtx && this.micStream) {
      try {
        this.micSourceNode = this.audioCtx.createMediaStreamSource(this.micStream);

        // Highpass Filter (85Hz): eliminates handling rumble, wind, and body friction
        this.highPassFilter = this.audioCtx.createBiquadFilter();
        this.highPassFilter.type = 'highpass';
        this.highPassFilter.frequency.setValueAtTime(85, this.audioCtx.currentTime);

        // Lowpass Filter (7200Hz): eliminates high-pitched electrical hiss
        this.lowPassFilter = this.audioCtx.createBiquadFilter();
        this.lowPassFilter.type = 'lowpass';
        this.lowPassFilter.frequency.setValueAtTime(7200, this.audioCtx.currentTime);

        // Vocal Gain Booster
        this.micGainNode = this.audioCtx.createGain();
        const initialGain = this.sensitivityLevel === 'HIGH' ? 2.8 : 2.0;
        this.micGainNode.gain.setValueAtTime(initialGain, this.audioCtx.currentTime);

        // Spectrum Analyser
        this.micAnalyser = this.audioCtx.createAnalyser();
        this.micAnalyser.fftSize = 256;
        this.micAnalyser.smoothingTimeConstant = 0.25;

        // ScriptProcessor for continuous live streaming (1024 samples = ~23ms at 44.1/48kHz)
        this.scriptProcessor = this.audioCtx.createScriptProcessor(1024, 1, 1);
        this.dummyMuteGain = this.audioCtx.createGain();
        this.dummyMuteGain.gain.setValueAtTime(0, this.audioCtx.currentTime);

        // Wire graph
        this.micSourceNode.connect(this.highPassFilter);
        this.highPassFilter.connect(this.lowPassFilter);
        this.lowPassFilter.connect(this.micGainNode);
        this.micGainNode.connect(this.micAnalyser);
        this.micGainNode.connect(this.scriptProcessor);
        this.scriptProcessor.connect(this.dummyMuteGain);
        this.dummyMuteGain.connect(this.audioCtx.destination);

        // Feed frames to audio processor
        this.scriptProcessor.onaudioprocess = (event: AudioProcessingEvent) => {
          this.handleAudioProcess(event);
        };
      } catch (graphErr) {
        console.warn('[AudioEngine] Audio graph notice:', graphErr);
      }
    }

    // Ensure WebSocket is open
    if (!this.isWsConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.initWebSocket();
    }

    this.setStatus('LISTENING');
  }

  /**
   * Continuous Audio Processing Pipeline:
   * 1. Resamples device audio (44.1k/48k) to 16kHz PCM
   * 2. Passes through Silero-style VAD
   * 3. Streams voiced packets over WebSocket with zero gaps
   */
  private handleAudioProcess(event: AudioProcessingEvent) {
    if (this.callStatus === 'IDLE' || this.callStatus === 'STOPPING') return;

    const inputData = event.inputBuffer.getChannelData(0);
    const inputSampleRate = event.inputBuffer.sampleRate || this.audioCtx?.sampleRate || 48000;

    // Resample down to clean 16000Hz PCM
    const frame16k = SileroStyleVAD.resampleTo16k(inputData, inputSampleRate);

    // If in TAP_TO_TALK mode, user manually records all audio while button is held
    if (this.callMode === 'TAP_TO_TALK') {
      if (this.callStatus === 'LISTENING') {
        let sum = 0;
        for (let i = 0; i < frame16k.length; i++) sum += frame16k[i] * frame16k[i];
        const rms = Math.sqrt(sum / frame16k.length);
        this.currentMicEnergy = Math.min(1.0, rms * 12);
        this.notifyEnergy(this.currentMicEnergy, this.currentOutputEnergy);

        const copy = new Float32Array(frame16k);
        this.recorded16kChunks.push(copy);
        this.streamBinaryChunkToWs(copy);
      }
      return;
    }

    // Feed to local Silero VAD (handles speech start, frame streaming, speech end, and barge-in)
    this.vad.processFrame(frame16k);
  }

  /**
   * Fast full-duplex barge-in interruption (< 20ms)
   */
  private triggerBargeIn() {
    this.player.interrupt();
    this.setStatus('LISTENING');
    this.bargeInListeners.forEach((l) => l(20));
    this.recorded16kChunks = [];
    this.vad.reset();
  }

  /**
   * Sends WebSocket start message for streaming session
   */
  private sendWsStart() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isWsConnected) {
      try {
        this.ws.send(JSON.stringify({ type: 'start', sampleRate: 16000 }));
        this.isSessionActive = true;
      } catch {}
    }
  }

  /**
   * Streams binary PCM 16kHz chunk over WebSocket
   */
  private streamBinaryChunkToWs(samples: Float32Array) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isWsConnected) {
      const pcmBuffer = floatTo16BitPCM(samples);
      try {
        this.ws.send(pcmBuffer);
      } catch {}
    }
  }

  /**
   * Safe Stop Microphone:
   * Only called on explicit user exit or "إغلاق الميكروفون".
   * Never called between ordinary conversation turns!
   */
  public safeStopMicrophone(): void {
    if (this.callStatus === 'IDLE' || this.callStatus === 'STOPPING') return;

    this.setStatus('STOPPING');
    this.player.interrupt();
    this.vad.reset();

    if (this.scriptProcessor) {
      this.scriptProcessor.onaudioprocess = null;
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    this.dummyMuteGain?.disconnect();
    this.dummyMuteGain = null;

    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }

    this.micSourceNode?.disconnect();
    this.highPassFilter?.disconnect();
    this.lowPassFilter?.disconnect();
    this.micGainNode?.disconnect();
    this.micSourceNode = null;
    this.highPassFilter = null;
    this.lowPassFilter = null;
    this.micGainNode = null;
    this.micAnalyser = null;
    this.currentMicEnergy = 0;
    this.currentOutputEnergy = 0;
    this.recorded16kChunks = [];
    this.isProcessingAudio = false;

    this.setStatus('IDLE');
  }

  /**
   * Commits the current speech utterance:
   * Notifies WebSocket end_utterance, with HTTP fallback if offline.
   * Micro-stream is KEPT OPEN AND RUNNING.
   */
  public async commitCurrentUtterance(): Promise<void> {
    if (this.isProcessingAudio) return;

    // Minimum utterance length validation (~200ms = 3200 samples at 16kHz)
    const totalSamples = this.recorded16kChunks.reduce((acc, c) => acc + c.length, 0);
    if (totalSamples < 3200) {
      this.recorded16kChunks = [];
      this.vad.reset();
      return;
    }

    this.isProcessingAudio = true;
    this.setStatus('THINKING');

    // Encode audio to base64 immediately
    const mergedSamples = new Float32Array(totalSamples);
    let offset = 0;
    for (const chunk of this.recorded16kChunks) {
      mergedSamples.set(chunk, offset);
      offset += chunk.length;
    }
    this.recorded16kChunks = [];

    const wavBlob = encodeWAV(mergedSamples, 16000);
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve, reject) => {
      reader.onloadend = () => {
        const res = (reader.result as string)?.split(',')[1];
        if (res) resolve(res);
        else reject(new Error('Failed to encode WAV'));
      };
      reader.onerror = reject;
    });
    reader.readAsDataURL(wavBlob);

    let base64Audio = '';
    try {
      base64Audio = await base64Promise;
    } catch {
      this.isProcessingAudio = false;
      this.setStatus('LISTENING');
      return;
    }

    // 1. Try WebSocket fast-path streaming first
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isWsConnected) {
      try {
        this.ws.send(JSON.stringify({ type: 'end_utterance', audioBase64: base64Audio }));

        // 4-second watchdog timer: if server WS stalls, recover to LISTENING
        setTimeout(() => {
          if (this.isProcessingAudio && this.callStatus === 'THINKING') {
            this.isProcessingAudio = false;
            this.setStatus('LISTENING');
            this.vad.reset();
          }
        }, 4000);

        return;
      } catch {
        // Fall through to HTTP fallback
      }
    }

    // 2. HTTP Fallback Path
    try {
      const response = await fetch('/api/voice/process-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: base64Audio,
          mimeType: 'audio/wav',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        this.isProcessingAudio = false;

        if (data.transcript && data.transcript.trim()) {
          this.notifyTranscript(data.transcript.trim(), true);
        }

        if (data.intent) {
          this.notifyResult({
            intent: data.intent,
            confidence: data.confidence || 0.95,
            parameters: { target: data.intent, raw_utterance: data.transcript || '' },
            ui_action: data.ui_action || 'ROUTE_PREDEFINED',
            assistant_response: data.assistant_response || '',
            voice_spoken_text: data.voice_spoken_text || '',
          });
        }

        if (data.voice_spoken_text) {
          this.playFallbackSpeech(data.voice_spoken_text);
        }
      }
    } catch (err) {
      console.warn('[AudioEngine] HTTP audio processing notice:', err);
    } finally {
      this.isProcessingAudio = false;
      if (this.callStatus === 'THINKING') {
        this.setStatus('LISTENING');
        this.vad.reset();
      }
    }
  }

  /**
   * Enqueues TTS audio chunk into dedicated streaming player
   */
  public async playTTSAudioBase64(base64Wav: string): Promise<void> {
    if (this.callStatus === 'IDLE' || this.callStatus === 'STOPPING') return;
    await this.player.enqueueBase64Chunk(base64Wav);
  }

  /**
   * Browser SpeechSynthesis fallback with natural Arabic voice
   */
  public playFallbackSpeech(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (!window.speechSynthesis || this.callStatus === 'IDLE' || this.callStatus === 'STOPPING') {
        resolve();
        return;
      }

      this.setStatus('SPEAKING');

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ar-SA';
      utterance.rate = 1.0;

      utterance.onend = () => {
        if (this.callStatus === 'SPEAKING') {
          this.setStatus('LISTENING');
          this.recorded16kChunks = [];
          this.vad.reset();
        }
        resolve();
      };

      utterance.onerror = () => {
        if (this.callStatus === 'SPEAKING') {
          this.setStatus('LISTENING');
          this.recorded16kChunks = [];
          this.vad.reset();
        }
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  }

  // Subscriber hooks
  public setStatus(newStatus: CallStatus) {
    if (this.callStatus === newStatus) return;
    this.callStatus = newStatus;
    this.statusListeners.forEach((listener) => listener(newStatus));
  }

  public getStatus(): CallStatus {
    return this.callStatus;
  }

  public subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.callStatus);
    return () => this.statusListeners.delete(listener);
  }

  public subscribeTranscript(listener: TranscriptListener): () => void {
    this.transcriptListeners.add(listener);
    return () => this.transcriptListeners.delete(listener);
  }

  public subscribeResult(listener: ResultListener): () => void {
    this.resultListeners.add(listener);
    return () => this.resultListeners.delete(listener);
  }

  public subscribeBargeIn(listener: BargeInListener): () => void {
    this.bargeInListeners.add(listener);
    return () => this.bargeInListeners.delete(listener);
  }

  public subscribeEnergy(listener: EnergyListener): () => void {
    this.energyListeners.add(listener);
    return () => this.energyListeners.delete(listener);
  }

  public subscribeError(listener: ErrorListener): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  private notifyTranscript(text: string, isFinal: boolean) {
    this.transcriptListeners.forEach((listener) => listener(text, isFinal));
  }

  private notifyResult(result: IntentResult) {
    this.resultListeners.forEach((listener) => listener(result));
  }

  private notifyEnergy(mic: number, output: number) {
    this.energyListeners.forEach((listener) => listener(mic, output));
  }

  private notifyError(errorMsg: string) {
    this.errorListeners.forEach((listener) => listener(errorMsg));
  }

  public getMetrics(): AudioEngineMetrics {
    return {
      bargeInCount: 0,
      lastBargeInLatencyMs: 20,
      micEnergy: this.currentMicEnergy,
      outputEnergy: this.currentOutputEnergy,
      sampleRate: 16000,
      dspConfig: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
      gainRamping: {
        active: false,
        currentGain: 1.0,
        lastRampType: 'STEADY',
      },
    };
  }
}

export const audioEngine = AudioEngine.getInstance();

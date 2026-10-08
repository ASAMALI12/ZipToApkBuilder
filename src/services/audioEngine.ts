import { CallStatus, AudioEngineMetrics, IntentResult } from '../types/kernel';
import { SileroStyleVAD } from './vadEngine';
import { StreamingAudioPlayer } from './streamingAudioPlayer';
import { StorageEngine } from './storageEngine';
import { parseUtterance, checkQuickIntent } from './intentParser';

type StatusListener = (status: CallStatus) => void;
type TranscriptListener = (text: string, isFinal: boolean) => void;
type ResultListener = (result: IntentResult) => void;
type BargeInListener = (latencyMs: number) => void;
type EnergyListener = (micEnergy: number, outputEnergy: number) => void;
type ErrorListener = (errorMsg: string) => void;

export type AudioCallMode = 'CONTINUOUS' | 'TAP_TO_TALK';

/**
 * Universal 16-bit PCM WAV Encoder (Blob)
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

/**
 * Ultra-Fast Direct Base64 WAV Encoder (Zero-Latency, No FileReader)
 */
function encodeWAVBase64(samples: Float32Array, sampleRate: number = 16000): string {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + samples.length * 2, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i += 8192) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + 8192, len)) as any);
  }
  return btoa(binary);
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

  // Echo guard & Speech Synthesis Deduplication
  private aiSpeakingStartTime: number = 0;
  private lastSpokenText: string = '';
  private lastSpokenTimestamp: number = 0;

  // Native Browser Speech Recognition Engine (0ms Arabic stream)
  private speechRecognizer: any = null;
  private currentLiveTranscript: string = '';
  private lastProcessedUtterance: string = '';
  private lastProcessedTimestamp: number = 0;

  private constructor() {
    this.vad = new SileroStyleVAD({
      sampleRate: 16000,
      frameSize: 512, // 32ms at 16kHz
      speechThresholdMultiplier: 1.15,
      speechThreshold: 0.0016, // Sensitive capture on first attempt even with quiet voice/mic
      positiveSpeechThreshold: 0.14, // Highly responsive speech confidence
      silenceDurationMs: 350, // Snappy Endpoint Detection without premature cutoff
      hangoverFrames: 9, // ~288ms
      minSpeechFrames: 1, // Catches the very first syllable on the first attempt
      preRollFrames: 10, // 300ms pre-roll buffer to preserve first letter/syllable
      postRollFrames: 8, // ~256ms post-roll buffer
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
   * Configures local Silero VAD events with Instant Endpoint Detection
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

    // 3. User finished speaking (Instant Endpoint Detection: sentence boundary reached!)
    this.vad.onSpeechEnd = () => {
      if (this.callStatus !== 'LISTENING' || this.isProcessingAudio) return;

      // In TAP_TO_TALK mode, user controls when to stop by tapping
      if (this.callMode === 'TAP_TO_TALK') return;

      // Endpoint Detection Trigger:
      // If we have recognized text from live speech stream, commit immediately without delay!
      if (this.currentLiveTranscript && this.currentLiveTranscript.trim().length > 0) {
        const textToCommit = this.currentLiveTranscript.trim();
        this.currentLiveTranscript = '';
        this.recorded16kChunks = [];
        this.vad.reset();
        this.handleDirectTextUtterance(textToCommit);
        return;
      }

      this.commitCurrentUtterance();
    };

    // 4. Energy calculation
    this.vad.onEnergy = (energy: number, isSpeech: boolean) => {
      this.currentMicEnergy = Math.min(1.0, energy * 12);
      this.notifyEnergy(this.currentMicEnergy, this.currentOutputEnergy);

      // Full-Duplex Barge-In Interruption with Echo Guard:
      // Prevent speaker audio feedback from instantly killing the AI's own voice!
      if (this.callStatus === 'SPEAKING' && isSpeech) {
        const timeSinceSpeechStart = Date.now() - this.aiSpeakingStartTime;
        // Grace period of 2500ms + requires loud intentional voice (> 0.75) to barge in
        if (timeSinceSpeechStart > 2500 && this.currentMicEnergy > 0.75) {
          this.triggerBargeIn();
        }
      }
    };
  }

  /**
   * Configures dedicated streaming audio player events
   */
  private setupPlayerCallbacks() {
    this.player.onPlaybackStart = () => {
      this.aiSpeakingStartTime = Date.now();
      this.setStatus('SPEAKING');
    };

    this.player.onPlaybackEnd = () => {
      // 1. Automatically resume audioContext if suspended
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }

      // 2. Reactivate microphone listener immediately without needing refresh or toggle
      this.isProcessingAudio = false;
      this.recorded16kChunks = [];
      this.vad.reset();

      if (this.callStatus !== 'IDLE' && this.callStatus !== 'STOPPING') {
        this.setStatus('LISTENING');
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
        const kernelCtx = StorageEngine.getInMemoryKernelContext();
        if (kernelCtx?.summaryContext) {
          try {
            this.ws?.send(JSON.stringify({
              type: 'init_kernel_context',
              summaryContext: kernelCtx.summaryContext,
              rules: kernelCtx.rules,
              instructions: kernelCtx.instructions,
            }));
          } catch {}
        }
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
        try {
          this.audioCtx = new AudioCtxClass({ sampleRate: 24000 });
        } catch {
          try {
            this.audioCtx = new AudioCtxClass({ sampleRate: 48000 });
          } catch {
            this.audioCtx = new AudioCtxClass();
          }
        }
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
          // Android Native / Chromium Voice Recognition DSP constraints:
          googEchoCancellation: true,
          googAutoGainControl: true,
          googNoiseSuppression: true,
          googHighpassFilter: true,
          googTypingNoiseDetection: true,
          googAudioMirroring: false,
          voiceActivityDetection: true,
        } as any,
        video: false,
      };

      this.micStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err: any) {
      console.warn('[AudioEngine] Mic permission status:', err?.name || err?.message || 'Access denied');
      this.setStatus('IDLE');
      this.notifyError('يرجى السماح بالوصول إلى الميكروفون في المتصفح للبدء، أو الاستمرار بالنقر على الأوامر السريعة أدناه.');
      return;
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
        const initialGain = this.sensitivityLevel === 'HIGH' ? 3.6 : 3.0;
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

    // 4. Native Browser Speech Recognition Engine (0ms Arabic stream)
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      try {
        const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        this.speechRecognizer = new SpeechRec();
        this.speechRecognizer.continuous = true;
        this.speechRecognizer.interimResults = true;
        this.speechRecognizer.lang = 'ar-SA';

        this.speechRecognizer.onresult = (event: any) => {
          let interim = '';
          let finalUtterance = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0]?.transcript || '';
            if (event.results[i].isFinal) {
              finalUtterance += transcript;
            } else {
              interim += transcript;
            }
          }

          const displayText = finalUtterance.trim() || interim.trim();
          if (displayText) {
            this.currentLiveTranscript = displayText;
            this.notifyTranscript(displayText, Boolean(finalUtterance.trim()));

            // Only trigger immediate mute/close mic during interim speech (e.g. user shouts 'اسكت')
            const quickMatch = checkQuickIntent(displayText);
            if (quickMatch && quickMatch.intent === 'INTENT_CLOSE_MIC') {
              this.currentLiveTranscript = '';
              this.handleDirectTextUtterance(displayText);
              return;
            }
          }

          if (finalUtterance.trim()) {
            const finalClean = finalUtterance.trim();
            this.currentLiveTranscript = '';
            this.handleDirectTextUtterance(finalClean);
          }
        };

        this.speechRecognizer.onerror = (e: any) => {
          console.warn('[AudioEngine] Speech rec event:', e?.error);
        };

        this.speechRecognizer.onend = () => {
          if (this.callStatus === 'LISTENING') {
            try { this.speechRecognizer?.start(); } catch {}
          }
        };

        try {
          this.speechRecognizer.start();
        } catch {}
      } catch (e) {
        console.warn('[AudioEngine] Speech rec init notice:', e);
      }
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

    if (this.speechRecognizer) {
      try {
        this.speechRecognizer.onresult = null;
        this.speechRecognizer.onend = null;
        this.speechRecognizer.onerror = null;
        this.speechRecognizer.stop();
      } catch {}
      this.speechRecognizer = null;
    }
    this.currentLiveTranscript = '';

    this.setStatus('IDLE');
  }

  /**
   * High-speed direct text utterance handling:
   * 1. Evaluates Tier 1 local fast-path regex (0ms instantaneous execution)
   * 2. If general query, sends fast text-only NLU request to server (~200ms)
   * Completely bypasses heavy audio transcoding and wait times!
   */
  public async handleDirectTextUtterance(text: string): Promise<void> {
    const cleanText = text.trim();
    if (!cleanText || this.isProcessingAudio) return;

    // Fast deduplication guard: prevent double-executing the same phrase within 1.5s
    const now = Date.now();
    if (cleanText === this.lastProcessedUtterance && now - this.lastProcessedTimestamp < 1500) {
      return;
    }
    this.lastProcessedUtterance = cleanText;
    this.lastProcessedTimestamp = now;

    this.isProcessingAudio = true;
    this.setStatus('THINKING');

    try {
      // 1. Tier 1 Fast Local Pattern Match: 0ms instantaneous response!
      const localResult = await parseUtterance(cleanText);
      if (localResult.intent !== 'INTENT_GENERAL_QUERY') {
        this.isProcessingAudio = false;
        this.notifyTranscript(cleanText, true);
        this.notifyResult(localResult);
        if (localResult.voice_spoken_text) {
          this.playFallbackSpeech(localResult.voice_spoken_text);
        }
        return;
      }

      // 2. High-speed text NLU endpoint (0 audio latency, ~200ms)
      const response = await fetch('/api/nlu/parse-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ utterance: cleanText }),
      });

      if (response.ok) {
        const data = await response.json();
        this.isProcessingAudio = false;
        this.notifyTranscript(cleanText, true);
        this.notifyResult({
          intent: data.intent || 'INTENT_GENERAL_QUERY',
          confidence: data.confidence || 0.95,
          parameters: data.parameters || { raw_utterance: cleanText },
          ui_action: data.ui_action || 'ROUTE_PREDEFINED',
          assistant_response: data.assistant_response || '',
          voice_spoken_text: data.voice_spoken_text || '',
        });
        if (data.voice_spoken_text) {
          this.playFallbackSpeech(data.voice_spoken_text);
        }
        return;
      }
    } catch (err) {
      console.warn('[AudioEngine] Fast direct text error, recovering:', err);
    } finally {
      if (this.callStatus === 'THINKING') {
        this.resetToListening();
      }
    }
  }

  /**
   * Commits the current speech utterance:
   * Notifies WebSocket end_utterance, with HTTP fallback if offline.
   * Micro-stream is KEPT OPEN AND RUNNING.
   */
  public async commitCurrentUtterance(): Promise<void> {
    if (this.isProcessingAudio) return;

    // If native speech engine already captured the words, run immediately in 0ms!
    if (this.currentLiveTranscript && this.currentLiveTranscript.trim().length > 1) {
      const textToRun = this.currentLiveTranscript.trim();
      this.currentLiveTranscript = '';
      this.recorded16kChunks = [];
      this.vad.reset();
      await this.handleDirectTextUtterance(textToRun);
      return;
    }

    // Minimum utterance length validation (~100ms = 1600 samples at 16kHz)
    const totalSamples = this.recorded16kChunks.reduce((acc, c) => acc + c.length, 0);
    if (totalSamples < 1600) {
      this.recorded16kChunks = [];
      this.vad.reset();
      return;
    }

    this.isProcessingAudio = true;
    this.setStatus('THINKING');

    // Encode audio to base64 synchronously (0ms latency, bypass FileReader)
    const mergedSamples = new Float32Array(totalSamples);
    let offset = 0;
    for (const chunk of this.recorded16kChunks) {
      mergedSamples.set(chunk, offset);
      offset += chunk.length;
    }
    this.recorded16kChunks = [];

    const base64Audio = encodeWAVBase64(mergedSamples, 16000);
    if (!base64Audio || base64Audio.length < 300) {
      this.isProcessingAudio = false;
      this.setStatus('LISTENING');
      return;
    }

    // 5-second Safety Abort Controller Timeout for "THINKING" state
    let isHandled = false;
    const safetyTimer = setTimeout(() => {
      if (!isHandled && this.callStatus === 'THINKING') {
        console.warn('[AudioEngine] 5s Safety Timeout in THINKING state. Resetting to LISTENING.');
        this.resetToListening();
      }
    }, 5000);

    try {
      // 1. Try WebSocket fast-path streaming first
      if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isWsConnected) {
        try {
          this.ws.send(JSON.stringify({ type: 'end_utterance', audioBase64: base64Audio }));
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
          isHandled = true;
          clearTimeout(safetyTimer);
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
      }
    } finally {
      // Always ensure state is safely returned and not stuck in THINKING
      setTimeout(() => {
        if (this.callStatus === 'THINKING' && !this.isProcessingAudio) {
          this.resetToListening();
        }
      }, 500);
    }
  }

  /**
   * Resets audio engine state machine to LISTENING,
   * automatically resumes audioContext, and reactivates the microphone listener.
   */
  public resetToListening(): void {
    if (this.callStatus === 'IDLE' || this.callStatus === 'STOPPING') return;

    this.isProcessingAudio = false;
    this.recorded16kChunks = [];
    this.vad.reset();

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    this.setStatus('LISTENING');
  }

  /**
   * Enqueues TTS audio chunk into dedicated streaming player
   */
  public async playTTSAudioBase64(base64Wav: string): Promise<void> {
    if (this.callStatus === 'IDLE' || this.callStatus === 'STOPPING') return;
    await this.player.enqueueBase64Chunk(base64Wav);
  }

  /**
   * Generates a high-tech synthesized acoustic chime via Web Audio API
   * Guarantees audible feedback even if speech synthesis is disabled or muted.
   */
  public playConfirmationChime(): void {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioCtxClass();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      const ctx = this.audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
  }

  /**
   * Browser SpeechSynthesis fallback with natural Arabic voice,
   * acoustic confirmation chime, and robust Chrome/Safari resume handling.
   */
  public playFallbackSpeech(text: string): Promise<void> {
    if (!text || !text.trim()) return Promise.resolve();

    // Deduplication guard: ignore identical utterances triggered within 2.5s
    const now = Date.now();
    if (text === this.lastSpokenText && now - this.lastSpokenTimestamp < 2500) {
      return Promise.resolve();
    }
    this.lastSpokenText = text;
    this.lastSpokenTimestamp = now;

    // 1. Play immediate audible confirmation chime
    this.playConfirmationChime();

    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        resolve();
        return;
      }

      const prevStatus = this.callStatus;
      this.setStatus('SPEAKING');
      this.aiSpeakingStartTime = Date.now();

      // Workaround for Chrome bug: resume synthesis if paused
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      } catch {}

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      // Select available Arabic voice
      try {
        const voices = window.speechSynthesis.getVoices();
        const arVoice = voices.find(
          (v) =>
            v.lang.startsWith('ar') ||
            v.lang.toLowerCase().includes('arabic') ||
            v.name.toLowerCase().includes('arabic')
        );
        if (arVoice) {
          utterance.voice = arVoice;
          utterance.lang = arVoice.lang;
        } else {
          utterance.lang = 'ar-SA';
        }
      } catch {
        utterance.lang = 'ar-SA';
      }

      let isFinished = false;
      const finishSpeech = () => {
        if (isFinished) return;
        isFinished = true;

        if (this.audioCtx && this.audioCtx.state === 'suspended') {
          this.audioCtx.resume().catch(() => {});
        }
        this.isProcessingAudio = false;
        this.recorded16kChunks = [];
        this.vad.reset();

        if (prevStatus !== 'IDLE' && prevStatus !== 'STOPPING') {
          this.setStatus('LISTENING');
        } else {
          this.setStatus('IDLE');
        }
        resolve();
      };

      utterance.onend = finishSpeech;
      utterance.onerror = (e) => {
        console.warn('[AudioEngine] Speech synthesis notification:', e);
        finishSpeech();
      };

      // Mobile Safari / Chrome safeguard timeout
      const maxDuration = Math.max(2500, text.length * 110);
      setTimeout(() => {
        if (!isFinished && this.callStatus === 'SPEAKING') {
          finishSpeech();
        }
      }, maxDuration);

      try {
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('[AudioEngine] Speak failed:', err);
        finishSpeech();
      }
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

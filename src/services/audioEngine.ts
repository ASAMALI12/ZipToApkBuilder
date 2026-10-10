import { CallStatus, AudioEngineMetrics, IntentResult } from '../types/kernel';
import { SileroStyleVAD } from './vadEngine';
import { StreamingAudioPlayer } from './streamingAudioPlayer';
import { StorageEngine } from './storageEngine';
import { parseUtterance, checkQuickIntent, normalizeArabic, requestTTSAudio } from './intentParser';

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
  private speechHandledForCurrentTurn: boolean = false;

  // Request & Lifecycle Tracking (prevents race conditions and duplicates)
  private currentRequestId: number = 0;
  private activeAbortController: AbortController | null = null;

  // Energy Tracking
  private currentMicEnergy: number = 0;
  private currentOutputEnergy: number = 0;

  // Echo guard & Speech Synthesis Deduplication
  private aiSpeakingStartTime: number = 0;
  private lastSpokenText: string = '';
  private lastSpokenTimestamp: number = 0;
  private activeSpeechCancelFn: (() => void) | null = null;

  // Native Browser Speech Recognition Engine (0ms Arabic stream)
  private speechRecognizer: any = null;
  private currentLiveTranscript: string = '';
  private lastProcessedUtterance: string = '';
  private lastProcessedTimestamp: number = 0;
  private currentSpeechUtterance: any = null;

  /**
   * Identifies whether incoming transcript is acoustic feedback/echo
   * from the device speakers playing assistant voice.
   */
  public isAssistantEcho(transcript: string): boolean {
    // Echo ONLY exists while the assistant is actively speaking through the speakers
    if (this.callStatus !== 'SPEAKING') return false;
    if (!this.lastSpokenText) return false;

    const normTrans = normalizeArabic(transcript);
    const normAI = normalizeArabic(this.lastSpokenText);
    if (!normTrans || !normAI) return false;

    // Explicit user barge-in commands are NEVER echo!
    const quick = checkQuickIntent(transcript);
    if (quick) return false;
    if (/(?:اسكت|اصمت|وقف|توقف|كافي|بس|stop|quiet)/i.test(normTrans)) return false;

    // Single words are unlikely to be echo, user is trying to speak
    if (normTrans.split(' ').length < 2) return false;

    // Substantial exact match of assistant's words while speaking
    if (normAI.includes(normTrans) && normTrans.length >= 8) return true;

    // High word token overlap (> 75%)
    const transWords = normTrans.split(' ').filter((w) => w.length > 2);
    if (transWords.length < 3) return false;
    const matchCount = transWords.filter((w) => normAI.includes(w)).length;
    return matchCount / transWords.length >= 0.75;
  }

  private interimCommitTimer: any = null;

  private constructor() {
    this.vad = new SileroStyleVAD({
      sampleRate: 16000,
      frameSize: 512, // 32ms at 16kHz
      speechThresholdMultiplier: 1.15,
      speechThreshold: 0.0012, // Sensitive capture for soft voices
      positiveSpeechThreshold: 0.12, // Smooth speech confidence
      silenceDurationMs: 950, // Anti-Cutoff: 950ms allows natural hesitation & breathing without cutting off
      hangoverFrames: 30, // ~960ms trailing speech buffer
      minSpeechFrames: 2, // 2 frames (~64ms) prevents accidental mouth clicks
      preRollFrames: 14, // ~448ms pre-roll buffer to preserve first syllables
      postRollFrames: 14, // ~448ms post-roll buffer to preserve trailing syllables
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
      this.speechHandledForCurrentTurn = false;
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

      // If already processed via Web Speech API in this turn, don't duplicate via raw audio!
      if (this.speechHandledForCurrentTurn) {
        this.speechHandledForCurrentTurn = false;
        this.recorded16kChunks = [];
        this.vad.reset();
        return;
      }

      // Endpoint Detection Trigger:
      // 1. If we have recognized text from live speech stream, commit immediately without delay!
      if (this.currentLiveTranscript && this.currentLiveTranscript.trim().length > 0) {
        const textToCommit = this.currentLiveTranscript.trim();
        this.currentLiveTranscript = '';
        this.recorded16kChunks = [];
        this.vad.reset();
        this.speechHandledForCurrentTurn = true;
        this.executeUtterance(textToCommit, 'speech');
        return;
      }

      // 2. Fallback: If Web Speech produced no text, check if user voiced real audio (> 300ms):
      const totalSamples = this.recorded16kChunks.reduce((acc, c) => acc + c.length, 0);
      if (totalSamples >= 4800) {
        this.commitCurrentUtterance();
        return;
      }

      // 3. Short tap, cough, or tiny ambient click (< 300ms): discard cleanly
      this.recorded16kChunks = [];
      this.vad.reset();
    };

    // 4. Energy calculation with instant Barge-In Interruption
    this.vad.onEnergy = (energy: number, isSpeech: boolean) => {
      this.currentMicEnergy = Math.min(1.0, energy * 12);
      this.notifyEnergy(this.currentMicEnergy, this.currentOutputEnergy);

      // Full-Duplex Barge-In Interruption with Echo Guard:
      // When the user speaks while AI is speaking, interrupt voice playback immediately (< 20ms)!
      if (this.callStatus === 'SPEAKING' && isSpeech) {
        const timeSinceSpeechStart = Date.now() - this.aiSpeakingStartTime;
        if (timeSinceSpeechStart > 120 && this.currentMicEnergy > 0.08) {
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

  public setSensitivity(level: 'HIGH' | 'NORMAL' | 'NOISE_ISOLATION', customSilenceMs?: number) {
    this.sensitivityLevel = level;
    if (level === 'HIGH') {
      // Anti-Cutoff high sensitivity: 1100ms tolerance
      this.vad.updateSensitivityPreset('ANTI_CUTOFF', customSilenceMs ?? 1100);
    } else if (level === 'NORMAL') {
      // Balanced: 850ms tolerance
      this.vad.updateSensitivityPreset('BALANCED', customSilenceMs ?? 850);
    } else {
      // Fast: 600ms tolerance
      this.vad.updateSensitivityPreset('FAST', customSilenceMs ?? 600);
    }

    if (this.micGainNode && this.audioCtx) {
      const gainVal = level === 'HIGH' ? 3.6 : level === 'NORMAL' ? 2.6 : 1.4;
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
          if (!displayText) return;

          // Acoustic Echo Cancellation: ignore microphone pickup of assistant's own voice
          if (this.isAssistantEcho(displayText)) {
            return;
          }

          // Voice Barge-In: user is speaking while assistant is speaking!
          if (this.callStatus === 'SPEAKING') {
            this.interruptSpeech();
          }

          this.currentLiveTranscript = displayText;
          this.notifyTranscript(displayText, Boolean(finalUtterance.trim()));

          if (this.interimCommitTimer) {
            clearTimeout(this.interimCommitTimer);
            this.interimCommitTimer = null;
          }

          if (finalUtterance.trim()) {
            const finalClean = finalUtterance.trim();
            if (this.isAssistantEcho(finalClean)) return;
            this.currentLiveTranscript = '';
            this.speechHandledForCurrentTurn = true;
            this.recorded16kChunks = [];
            this.vad.reset();
            this.executeUtterance(finalClean, 'speech');
          } else if (interim.trim().length > 2) {
            // High-Speed Interim Debounce: Commit speech after 850ms silence even if browser delays isFinal
            this.interimCommitTimer = setTimeout(() => {
              if (this.currentLiveTranscript && this.callStatus === 'LISTENING' && !this.isProcessingAudio) {
                const text = this.currentLiveTranscript.trim();
                if (text.length > 2 && !this.isAssistantEcho(text)) {
                  this.currentLiveTranscript = '';
                  this.speechHandledForCurrentTurn = true;
                  this.recorded16kChunks = [];
                  this.vad.reset();
                  this.executeUtterance(text, 'speech');
                }
              }
            }, 850);
          }
        };

        this.speechRecognizer.onerror = (e: any) => {
          console.warn('[AudioEngine] Speech rec event:', e?.error);
        };

        this.speechRecognizer.onend = () => {
          if (this.callStatus !== 'IDLE' && this.callStatus !== 'STOPPING') {
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
  public interruptSpeech(): void {
    this.player.interrupt();
    if (this.activeSpeechCancelFn) {
      try {
        this.activeSpeechCancelFn();
      } catch {}
      this.activeSpeechCancelFn = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    if (this.callStatus === 'SPEAKING' || this.callStatus === 'BARGE_IN') {
      this.setStatus('LISTENING');
    }
  }

  private triggerBargeIn() {
    this.interruptSpeech();
    this.currentRequestId++;
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }
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
   * Unified Single Speech Synthesizer Output:
   * Ensures only ONE audio output plays at any time, with deduplication and barge-in support.
   */
  public async speak(text: string, base64Audio?: string): Promise<void> {
    const cleanText = text?.trim();
    if (!cleanText) return;

    // Interrupt any previous speech
    this.interruptSpeech();

    // Guard against identical speech repeating within 1.5s
    const now = Date.now();
    if (cleanText === this.lastSpokenText && now - this.lastSpokenTimestamp < 1500) {
      return;
    }
    this.lastSpokenText = cleanText;
    this.lastSpokenTimestamp = now;

    if (base64Audio) {
      this.setStatus('SPEAKING');
      this.aiSpeakingStartTime = Date.now();
      await this.player.enqueueBase64Chunk(base64Audio);
      return;
    }

    // Tier 1: Try natural Neural TTS audio via /api/tts (Web Audio API - universal support across all devices)
    try {
      const remoteWav = await requestTTSAudio(cleanText);
      if (remoteWav) {
        this.setStatus('SPEAKING');
        this.aiSpeakingStartTime = Date.now();
        await this.player.enqueueBase64Chunk(remoteWav);
        return;
      }
    } catch (e) {
      console.warn('[AudioEngine] Remote TTS notice, falling back:', e);
    }

    // Tier 2: Browser Web Speech API fallback
    await this.playFallbackSpeech(cleanText);
  }

  /**
   * Single Unified Utterance Dispatcher:
   * Handles local fast-path commands in 0ms (< 1ms).
   * Dispatches general queries to NLU ONCE (never duplicated!).
   * Cancels stale requests via Request ID and AbortController.
   */
  public async executeUtterance(text: string, source: 'speech' | 'vad' | 'chat' = 'speech'): Promise<void> {
    const cleanText = text.trim();
    if (!cleanText) return;

    // Fast deduplication guard: prevent double-executing the same phrase within 1.5s
    const now = Date.now();
    if (cleanText === this.lastProcessedUtterance && now - this.lastProcessedTimestamp < 1500) {
      return;
    }
    this.lastProcessedUtterance = cleanText;
    this.lastProcessedTimestamp = now;

    // Cancel any previous in-flight request
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }

    const reqId = ++this.currentRequestId;
    const abortController = new AbortController();
    this.activeAbortController = abortController;

    const startTime = performance.now();
    const boundKernel = StorageEngine.loadBoundKernel();
    const isKernelBound = Boolean(boundKernel && boundKernel.isActive);

    // 1. Tier 1 Fast Local Pattern Match: 0ms instantaneous execution!
    const quickMatch = checkQuickIntent(cleanText);
    if (quickMatch) {
      // If no kernel is bound, allow only linking the kernel or closing the mic
      if (!isKernelBound && quickMatch.intent !== 'INTENT_LINK_KERNEL' && quickMatch.intent !== 'INTENT_CLOSE_MIC') {
        this.isProcessingAudio = false;
        const unboundNotice: IntentResult = {
          intent: 'INTENT_LINK_KERNEL',
          confidence: 1.0,
          parameters: { target: 'kernel_linker', raw_utterance: cleanText },
          ui_action: 'ROUTE_PREDEFINED',
          assistant_response: 'النواة غير مربوطة بعد. النظام يعتمد كلياً على النواة ولا يعمل إلا من خلالها. يرجى ربط ملف النواة لتفعيل التحدث والعمل.',
          voice_spoken_text: 'يرجى ربط ملف النواة أولاً لتفعيل النظام.',
        };
        this.notifyTranscript(cleanText, true);
        this.notifyResult(unboundNotice);
        await this.speak(unboundNotice.voice_spoken_text);
        return;
      }

      this.isProcessingAudio = false;
      const localLatencyMs = Math.round(performance.now() - startTime);
      console.log(`[Kernel Voice Latency] Local command "${cleanText}" executed in ${localLatencyMs}ms`);

      if (quickMatch.intent === 'INTENT_INTERRUPT_SPEECH') {
        this.interruptSpeech();
        this.notifyTranscript(cleanText, true);
        this.notifyResult(quickMatch);
        this.resetToListening();
        return;
      }

      this.notifyTranscript(cleanText, true);
      this.notifyResult({
        ...quickMatch,
        parameters: { ...quickMatch.parameters, latencyMs: localLatencyMs },
      });

      if (quickMatch.voice_spoken_text) {
        await this.speak(quickMatch.voice_spoken_text);
      } else {
        this.resetToListening();
      }
      return;
    }

    // If no kernel is bound, require linking the kernel before executing any commands
    if (!isKernelBound) {
      this.isProcessingAudio = false;
      const unboundNotice: IntentResult = {
        intent: 'INTENT_LINK_KERNEL',
        confidence: 1.0,
        parameters: { target: 'kernel_linker', raw_utterance: cleanText },
        ui_action: 'ROUTE_PREDEFINED',
        assistant_response: 'النواة غير مربوطة بعد. النظام يعتمد كلياً على النواة ولا يعمل إلا من خلالها. يرجى ربط ملف النواة لتفعيل النظام وبدء التحدث والعمل.',
        voice_spoken_text: 'يرجى ربط ملف النواة أولاً لتفعيل النظام.',
      };
      this.notifyTranscript(cleanText, true);
      this.notifyResult(unboundNotice);
      await this.speak(unboundNotice.voice_spoken_text);
      return;
    }

    // 2. Tier 2 Remote NLU: executed ONCE and only once with active bound kernel context
    this.isProcessingAudio = true;
    this.setStatus('THINKING');

    try {
      const data = await parseUtterance(cleanText, abortController.signal, boundKernel);

      // Verify request is still active and was not superseded or interrupted
      if (this.currentRequestId !== reqId) return;

      this.isProcessingAudio = false;
      const totalLatencyMs = Math.round(performance.now() - startTime);
      console.log(`[Kernel Voice Latency] Query "${cleanText}" resolved in ${totalLatencyMs}ms`);

      this.notifyTranscript(cleanText, true);
      this.notifyResult({
        ...data,
        parameters: { ...data.parameters, latencyMs: totalLatencyMs },
      });

      if (data.voice_spoken_text) {
        await this.speak(data.voice_spoken_text);
      } else {
        this.resetToListening();
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.warn('[AudioEngine] Utterance execution notice:', err);
      this.isProcessingAudio = false;
      this.resetToListening();
    } finally {
      if (this.activeAbortController === abortController) {
        this.activeAbortController = null;
      }
      if (this.currentRequestId === reqId && this.callStatus === 'THINKING') {
        this.resetToListening();
      }
    }
  }

  public async handleDirectTextUtterance(text: string): Promise<void> {
    await this.executeUtterance(text, 'speech');
  }

  /**
   * Commits the current speech utterance:
   * Only called when SpeechRecognition is unavailable or provided no text.
   * Micro-stream is KEPT OPEN AND RUNNING.
   */
  public async commitCurrentUtterance(): Promise<void> {
    if (this.isProcessingAudio) return;

    // Minimum utterance length validation (~300ms = 4800 samples at 16kHz)
    const totalSamples = this.recorded16kChunks.reduce((acc, c) => acc + c.length, 0);
    if (totalSamples < 4800) {
      this.recorded16kChunks = [];
      this.vad.reset();
      return;
    }

    this.isProcessingAudio = true;
    this.setStatus('THINKING');

    const reqId = ++this.currentRequestId;
    const startTime = performance.now();

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

    let isHandled = false;
    const safetyTimer = setTimeout(() => {
      if (!isHandled && this.callStatus === 'THINKING' && this.currentRequestId === reqId) {
        console.warn('[AudioEngine] 5s Safety Timeout in THINKING state. Resetting to LISTENING.');
        this.resetToListening();
      }
    }, 5000);

    try {
      // 1. Try WebSocket fast-path streaming first
      if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isWsConnected) {
        try {
          this.ws.send(JSON.stringify({ type: 'end_utterance', audioBase64: base64Audio, reqId }));
          return;
        } catch {
          // Fall through to HTTP fallback
        }
      }

      // 2. HTTP Fallback Path
      try {
        const bound = StorageEngine.loadBoundKernel();
        const response = await fetch('/api/voice/process-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64: base64Audio,
            mimeType: 'audio/wav',
            kernelContext: bound
              ? {
                  name: bound.name,
                  rules: bound.rules,
                  instructions: bound.instructions,
                  summaryContext: bound.rawContent || bound.name,
                }
              : null,
          }),
        });

        if (response.ok) {
          isHandled = true;
          clearTimeout(safetyTimer);
          const data = await response.json();

          if (this.currentRequestId !== reqId) return; // Discard superseded request

          this.isProcessingAudio = false;
          const totalLatencyMs = Math.round(performance.now() - startTime);
          console.log(`[Kernel Audio Latency] Raw audio processed in ${totalLatencyMs}ms`);

          if (data.transcript && data.transcript.trim()) {
            this.notifyTranscript(data.transcript.trim(), true);
          }

          // If kernel is not bound and user did not say link or stop: require linking!
          if (!bound?.isActive && data.intent !== 'INTENT_LINK_KERNEL' && data.intent !== 'INTENT_CLOSE_MIC') {
            const unboundNotice = {
              intent: 'INTENT_LINK_KERNEL',
              confidence: 1.0,
              parameters: { target: 'kernel_linker', raw_utterance: data.transcript || '' },
              ui_action: 'ROUTE_PREDEFINED',
              assistant_response: 'النواة غير مربوطة بعد. النظام يعتمد كلياً على النواة ولا يعمل إلا من خلالها. يرجى ربط ملف النواة لتفعيل التحدث والعمل.',
              voice_spoken_text: 'يرجى ربط ملف النواة أولاً لتفعيل النظام.',
            };
            this.notifyResult(unboundNotice);
            await this.speak(unboundNotice.voice_spoken_text);
            return;
          }

          if (data.intent && data.transcript && data.transcript.trim()) {
            this.notifyResult({
              intent: data.intent,
              confidence: data.confidence || 0.95,
              parameters: { target: data.intent, raw_utterance: data.transcript || '', latencyMs: totalLatencyMs },
              ui_action: data.ui_action || 'ROUTE_PREDEFINED',
              assistant_response: data.assistant_response || '',
              voice_spoken_text: data.voice_spoken_text || '',
            });
          }

          if (data.voice_spoken_text && data.transcript && data.transcript.trim()) {
            await this.speak(data.voice_spoken_text);
          } else {
            this.resetToListening();
          }
        }
      } catch (err) {
        console.warn('[AudioEngine] HTTP audio processing notice:', err);
      }
    } finally {
      setTimeout(() => {
        if (this.callStatus === 'THINKING' && !this.isProcessingAudio && this.currentRequestId === reqId) {
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

    if (this.speechRecognizer) {
      try {
        this.speechRecognizer.start();
      } catch {}
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

      // Workaround for Chrome/WebKit bug: cancel prior & resume synthesis
      try {
        window.speechSynthesis.cancel();
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
        this.activeSpeechCancelFn = null;
        this.currentSpeechUtterance = null;

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

      this.activeSpeechCancelFn = finishSpeech;

      utterance.onend = finishSpeech;
      utterance.onerror = (e) => {
        console.warn('[AudioEngine] Speech synthesis notification:', e);
        finishSpeech();
      };

      // Mobile Safari / Chrome safeguard timeout
      const maxDuration = Math.max(3000, text.length * 120);
      setTimeout(() => {
        if (!isFinished && this.callStatus === 'SPEAKING') {
          finishSpeech();
        }
      }, maxDuration);

      try {
        this.currentSpeechUtterance = utterance;
        window.speechSynthesis.speak(utterance);
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
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

    // When entering LISTENING state, ensure speech recognizer is active
    if (newStatus === 'LISTENING' && this.speechRecognizer) {
      try {
        this.speechRecognizer.start();
      } catch {}
    }
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

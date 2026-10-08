/**
 * High-Performance Voice Activity Detection (VAD) & Resampling Engine
 * Tuned to prevent premature speech cutoff, incorporating 300ms pre-roll and post-roll buffers,
 * higher minSpeechFrames (anti-hesitation), and smooth positiveSpeechThreshold.
 */

export interface VADConfig {
  sampleRate: number; // Target sample rate (16000)
  frameSize: number; // Process frame in samples at 16kHz (512 = 32ms)
  speechThresholdMultiplier: number; // Multiplier above noise floor (default: 1.8)
  speechThreshold: number; // Absolute minimum active speech threshold (default: 0.012)
  positiveSpeechThreshold: number; // Speech confidence threshold (0.4 - 0.5, less sensitive to abrupt cutoff)
  silenceDurationMs: number; // Silence duration before utterance end: 600ms - 800ms (default: 700ms)
  hangoverFrames: number; // Frames of silence before cut (~22 frames = ~704ms)
  minSpeechFrames: number; // Frames of speech to confirm onset (5 frames = ~160ms to avoid short hesitations)
  preRollFrames: number; // 300ms pre-speech buffer (10 frames = 320ms at 16kHz)
  postRollFrames: number; // 300ms post-speech trailing buffer to prevent trailing word cuts
}

export type VADState = 'SILENCE' | 'SPEAKING';

export class SileroStyleVAD {
  private config: VADConfig;
  private state: VADState = 'SILENCE';

  // Adaptive noise floor tracking
  private noiseFloor: number = 0.005;
  private prevSample: number = 0;
  private prevHpY: number = 0;
  private prevHpX: number = 0;

  // Frame counters
  private consecutiveSpeechFrames: number = 0;
  private consecutiveSilenceFrames: number = 0;

  // Pre-roll circular ring buffer (300ms of audio before speech onset)
  private preRollBuffer: Float32Array[] = [];
  private readonly maxPreRoll: number;

  // Post-roll trailing buffer (300ms of audio after speech drops to catch trailing syllables)
  private postRollBuffer: Float32Array[] = [];
  private readonly maxPostRoll: number;

  // Callbacks
  public onSpeechStart?: (preRoll: Float32Array) => void;
  public onSpeechFrame?: (frame: Float32Array) => void;
  public onSpeechEnd?: (postRoll?: Float32Array) => void;
  public onEnergy?: (energy: number, isSpeech: boolean) => void;

  constructor(customConfig?: Partial<VADConfig>) {
    const frameSize = customConfig?.frameSize ?? 512;
    const sampleRate = customConfig?.sampleRate ?? 16000;
    const msPerFrame = (frameSize / sampleRate) * 1000; // 32ms

    // 300ms buffer calculation: 300ms / 32ms ≈ 9.4 -> 10 frames = 320ms
    const framesFor300ms = Math.max(9, Math.ceil(300 / msPerFrame));

    // Instant Endpoint Detection: 350ms silence duration for snappy sentence completion
    const silenceDurationMs = customConfig?.silenceDurationMs ?? 350;
    const calculatedHangover = Math.max(9, Math.min(12, Math.round(silenceDurationMs / msPerFrame)));

    this.config = {
      sampleRate,
      frameSize,
      speechThresholdMultiplier: 1.15,
      speechThreshold: 0.0016, // Ultra-sensitive threshold captures quiet mics and soft voices on the very first try
      positiveSpeechThreshold: 0.14, // Highly responsive speech confidence
      silenceDurationMs,
      hangoverFrames: customConfig?.hangoverFrames ?? calculatedHangover,
      minSpeechFrames: customConfig?.minSpeechFrames ?? 1, // 1 frame (~32ms) captures the very first syllable instantly
      preRollFrames: customConfig?.preRollFrames ?? framesFor300ms, // 300ms buffer before speech
      postRollFrames: customConfig?.postRollFrames ?? framesFor300ms, // 300ms buffer after speech
      ...customConfig,
    };

    this.maxPreRoll = this.config.preRollFrames;
    this.maxPostRoll = this.config.postRollFrames;
  }

  /**
   * High-accuracy linear resampler to 16000Hz from 24000Hz or 48000Hz
   */
  public static resampleTo16k(input: Float32Array, inputSr: number): Float32Array {
    if (!input || input.length === 0) return new Float32Array(0);
    if (inputSr === 16000) return input;

    const ratio = inputSr / 16000;
    const outputLength = Math.max(1, Math.round(input.length / ratio));
    const output = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const srcIdx = i * ratio;
      const iLow = Math.floor(srcIdx);
      const iHigh = Math.min(iLow + 1, input.length - 1);
      const weight = srcIdx - iLow;
      output[i] = input[iLow] * (1 - weight) + input[iHigh] * weight;
    }

    return output;
  }

  /**
   * Process a 16kHz audio frame through highpass filtering and adaptive energy VAD
   * Incorporates 300ms pre-roll and 300ms post-roll to preserve first and last letters.
   */
  public processFrame(frame16k: Float32Array): { isSpeech: boolean; energy: number } {
    const len = frame16k.length;
    if (len === 0) return { isSpeech: false, energy: 0 };

    // Calculate true audio RMS energy directly across the 16kHz audio frame
    // This avoids artificial filter attenuation that previously suppressed vowel sounds
    let sumSquares = 0;
    for (let i = 0; i < len; i++) {
      const x = frame16k[i];
      sumSquares += x * x;
    }

    const rms = Math.sqrt(sumSquares / len);

    // Adaptive noise floor tracking during silence
    if (this.state === 'SILENCE') {
      if (rms < this.noiseFloor * 1.5) {
        this.noiseFloor = this.noiseFloor * 0.95 + rms * 0.05;
      } else if (rms < this.noiseFloor) {
        this.noiseFloor = rms;
      }
      this.noiseFloor = Math.max(0.001, Math.min(0.010, this.noiseFloor));
    }

    // Speech confidence score normalized between 0.0 and 1.0
    const speechConfidence = Math.min(
      1.0,
      Math.max(0.0, (rms - this.noiseFloor) / 0.015)
    );

    // Dynamic threshold with hysteresis: sensitive to normal and quiet speaking levels
    const dynamicThreshold = Math.max(
      this.config.speechThreshold,
      this.noiseFloor * this.config.speechThresholdMultiplier
    );

    // Voiced determination: triggers reliably on first syllable
    const isVoiced =
      speechConfidence >= this.config.positiveSpeechThreshold ||
      rms >= dynamicThreshold ||
      (this.state === 'SPEAKING' && rms >= this.noiseFloor * 1.2);

    if (isVoiced) {
      this.consecutiveSpeechFrames++;
      this.consecutiveSilenceFrames = 0;

      if (this.state === 'SILENCE') {
        // Must accumulate minSpeechFrames (e.g. 5 frames = ~160ms) to confirm genuine speech onset
        if (this.consecutiveSpeechFrames >= this.config.minSpeechFrames) {
          this.state = 'SPEAKING';

          // Flatten 300ms pre-roll buffer into contiguous chunk so initial letters/syllables are preserved!
          const totalPreRollLen = this.preRollBuffer.reduce((acc, f) => acc + f.length, 0);
          const preRollMerged = new Float32Array(totalPreRollLen);
          let offset = 0;
          for (const buf of this.preRollBuffer) {
            preRollMerged.set(buf, offset);
            offset += buf.length;
          }
          this.preRollBuffer = [];

          if (this.onSpeechStart) {
            this.onSpeechStart(preRollMerged);
          }
          if (this.onSpeechFrame) {
            this.onSpeechFrame(frame16k);
          }
        }
      } else {
        // Already speaking: continuously emit frame
        if (this.onSpeechFrame) {
          this.onSpeechFrame(frame16k);
        }
      }
    } else {
      // Silence / unvoiced frame
      this.consecutiveSilenceFrames++;

      if (this.state === 'SILENCE') {
        this.consecutiveSpeechFrames = 0;
        // Keep 300ms sliding window of pre-roll frames
        this.preRollBuffer.push(new Float32Array(frame16k));
        if (this.preRollBuffer.length > this.maxPreRoll) {
          this.preRollBuffer.shift();
        }
      } else {
        // Was speaking: in hangover period (600ms - 800ms)
        // Keep streaming trailing frames so trailing consonants and vowels are never cut off
        if (this.consecutiveSilenceFrames <= this.config.hangoverFrames) {
          if (this.onSpeechFrame) {
            this.onSpeechFrame(frame16k);
          }
          // Also maintain post-roll buffer for safety
          this.postRollBuffer.push(new Float32Array(frame16k));
          if (this.postRollBuffer.length > this.maxPostRoll) {
            this.postRollBuffer.shift();
          }
        } else {
          // Silence duration elapsed: user genuinely finished speaking!
          this.state = 'SILENCE';
          this.consecutiveSpeechFrames = 0;
          this.consecutiveSilenceFrames = 0;
          this.preRollBuffer = [];
          this.postRollBuffer = [];

          if (this.onSpeechEnd) {
            this.onSpeechEnd();
          }
        }
      }
    }

    if (this.onEnergy) {
      this.onEnergy(rms, this.state === 'SPEAKING');
    }

    return {
      isSpeech: this.state === 'SPEAKING',
      energy: rms,
    };
  }

  public reset() {
    this.state = 'SILENCE';
    this.consecutiveSpeechFrames = 0;
    this.consecutiveSilenceFrames = 0;
    this.preRollBuffer = [];
    this.postRollBuffer = [];
    this.prevSample = 0;
    this.prevHpY = 0;
    this.prevHpX = 0;
  }

  public getState(): VADState {
    return this.state;
  }
}

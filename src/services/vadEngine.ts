/**
 * High-Performance Voice Activity Detection (VAD) & Resampling Engine
 * Uses adaptive energy tracking, pre-emphasis filtering, and zero-latency pre-roll buffering.
 */

export interface VADConfig {
  sampleRate: number; // Target sample rate (16000)
  frameSize: number; // Process frame in samples at 16kHz (512 = 32ms)
  speechThresholdMultiplier: number; // Multiplier above noise floor (default: 2.2)
  hangoverFrames: number; // Frames of silence before speech end (~12 frames = 384ms)
  minSpeechFrames: number; // Frames of speech to confirm onset (~2 frames = 64ms)
  preRollFrames: number; // Number of pre-speech buffer frames to retain (8 frames = 256ms)
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

  // Pre-roll circular ring buffer
  private preRollBuffer: Float32Array[] = [];
  private readonly maxPreRoll: number;

  // Callbacks
  public onSpeechStart?: (preRoll: Float32Array) => void;
  public onSpeechFrame?: (frame: Float32Array) => void;
  public onSpeechEnd?: () => void;
  public onEnergy?: (energy: number, isSpeech: boolean) => void;

  constructor(customConfig?: Partial<VADConfig>) {
    this.config = {
      sampleRate: 16000,
      frameSize: 512, // 32ms at 16kHz
      speechThresholdMultiplier: 2.0,
      hangoverFrames: 12, // ~384ms
      minSpeechFrames: 2, // ~64ms
      preRollFrames: 8, // ~256ms
      ...customConfig,
    };

    this.maxPreRoll = this.config.preRollFrames;
  }

  /**
   * High-accuracy linear downsampler to 16000Hz
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
   */
  public processFrame(frame16k: Float32Array): { isSpeech: boolean; energy: number } {
    const len = frame16k.length;
    if (len === 0) return { isSpeech: false, energy: 0 };

    let sumSquares = 0;

    // Apply 80Hz single-pole highpass + pre-emphasis filter to isolate speech formants
    for (let i = 0; i < len; i++) {
      const x = frame16k[i];

      // Single pole highpass filter at ~80Hz: y[n] = x[n] - x[n-1] + 0.97 * y[n-1]
      const hp = x - this.prevHpX + 0.97 * this.prevHpY;
      this.prevHpX = x;
      this.prevHpY = hp;

      // Pre-emphasis for consonants: pe = hp - 0.92 * prev
      const pe = hp - 0.92 * this.prevSample;
      this.prevSample = hp;

      sumSquares += pe * pe;
    }

    const rms = Math.sqrt(sumSquares / len);

    // Adaptive noise floor tracking during silence
    if (this.state === 'SILENCE') {
      if (rms < this.noiseFloor * 1.8) {
        this.noiseFloor = this.noiseFloor * 0.97 + rms * 0.03;
      } else if (rms < this.noiseFloor) {
        this.noiseFloor = rms;
      }
      this.noiseFloor = Math.max(0.002, Math.min(0.035, this.noiseFloor));
    }

    // Dynamic threshold: scales with background environment
    const threshold = Math.max(0.012, this.noiseFloor * this.config.speechThresholdMultiplier);
    const isVoiced = rms >= threshold;

    if (isVoiced) {
      this.consecutiveSpeechFrames++;
      this.consecutiveSilenceFrames = 0;

      if (this.state === 'SILENCE') {
        if (this.consecutiveSpeechFrames >= this.config.minSpeechFrames) {
          this.state = 'SPEAKING';

          // Flatten pre-roll buffer into contiguous chunk so initial syllables are preserved
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
      // Silence / unvoiced
      this.consecutiveSilenceFrames++;

      if (this.state === 'SILENCE') {
        this.consecutiveSpeechFrames = 0;
        // Keep sliding window of pre-roll frames
        this.preRollBuffer.push(new Float32Array(frame16k));
        if (this.preRollBuffer.length > this.maxPreRoll) {
          this.preRollBuffer.shift();
        }
      } else {
        // In hangover period: keep capturing trailing audio
        if (this.consecutiveSilenceFrames <= this.config.hangoverFrames) {
          if (this.onSpeechFrame) {
            this.onSpeechFrame(frame16k);
          }
        } else {
          // Hangover finished: user stopped speaking!
          this.state = 'SILENCE';
          this.consecutiveSpeechFrames = 0;
          this.consecutiveSilenceFrames = 0;
          this.preRollBuffer = [];

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
    this.prevSample = 0;
    this.prevHpY = 0;
    this.prevHpX = 0;
  }

  public getState(): VADState {
    return this.state;
  }
}

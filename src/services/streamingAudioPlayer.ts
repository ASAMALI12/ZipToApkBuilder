/**
 * Streaming AudioTrack & Web Audio API Player
 * Implements chunk-by-chunk queue scheduling with anti-pop micro-fading
 * and sub-20ms barge-in interruption.
 */

export class StreamingAudioPlayer {
  private audioCtx: AudioContext | null = null;
  private outputGainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;

  private scheduledEndTime: number = 0;
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private isPlaying: boolean = false;

  public onPlaybackStart?: () => void;
  public onPlaybackEnd?: () => void;
  public onEnergyUpdate?: (energy: number) => void;

  private energyCheckInterval: any = null;

  constructor() {
    // AudioContext is initialized on first user gesture
  }

  private async ensureAudioContext(): Promise<AudioContext> {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
    }
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    if (!this.outputGainNode && this.audioCtx) {
      this.outputGainNode = this.audioCtx.createGain();
      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.smoothingTimeConstant = 0.2;

      this.outputGainNode.connect(this.analyserNode);
      this.analyserNode.connect(this.audioCtx.destination);

      this.startEnergyPolling();
    }

    return this.audioCtx;
  }

  private startEnergyPolling() {
    if (this.energyCheckInterval) return;
    const dataArray = new Uint8Array(128);

    this.energyCheckInterval = setInterval(() => {
      if (!this.isPlaying || !this.analyserNode) {
        if (this.onEnergyUpdate) this.onEnergyUpdate(0);
        return;
      }

      this.analyserNode.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / (dataArray.length * 255);
      if (this.onEnergyUpdate) {
        this.onEnergyUpdate(Math.min(1.0, avg * 2.2));
      }
    }, 40);
  }

  /**
   * Applies 5ms micro-fade windowing to prevent DC-offset speaker popping
   */
  private applyMicroFades(buffer: AudioBuffer) {
    const fadeSamples = Math.min(160, Math.floor(buffer.length * 0.05)); // ~5ms at 24/16kHz
    if (fadeSamples < 4) return;

    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const data = buffer.getChannelData(ch);
      const len = data.length;

      // Fade-in
      for (let i = 0; i < fadeSamples; i++) {
        const factor = 0.5 * (1 - Math.cos((Math.PI * i) / fadeSamples));
        data[i] *= factor;
      }

      // Fade-out
      for (let i = 0; i < fadeSamples; i++) {
        const idx = len - 1 - i;
        const factor = 0.5 * (1 - Math.cos((Math.PI * i) / fadeSamples));
        data[idx] *= factor;
      }
    }
  }

  /**
   * Enqueues an AudioBuffer into the continuous playback timeline
   */
  public async enqueueBuffer(buffer: AudioBuffer): Promise<void> {
    const ctx = await this.ensureAudioContext();

    this.applyMicroFades(buffer);

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    if (this.outputGainNode) {
      source.connect(this.outputGainNode);
    } else {
      source.connect(ctx.destination);
    }

    const now = ctx.currentTime;
    const startTime = Math.max(now + 0.005, this.scheduledEndTime);
    source.start(startTime);

    this.scheduledEndTime = startTime + buffer.duration;
    this.activeSources.add(source);

    if (!this.isPlaying) {
      this.isPlaying = true;
      if (this.onPlaybackStart) this.onPlaybackStart();
    }

    source.onended = () => {
      this.activeSources.delete(source);
      if (this.activeSources.size === 0 && ctx.currentTime >= this.scheduledEndTime - 0.05) {
        this.isPlaying = false;
        this.scheduledEndTime = 0;
        if (this.onPlaybackEnd) this.onPlaybackEnd();
      }
    };
  }

  /**
   * Enqueues base64-encoded audio chunk (WAV, MP3, or PCM)
   */
  public async enqueueBase64Chunk(base64Data: string): Promise<void> {
    const ctx = await this.ensureAudioContext();
    const binary = window.atob(base64Data);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    try {
      const audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
      await this.enqueueBuffer(audioBuffer);
    } catch (e) {
      console.warn('[StreamingAudioPlayer] decodeAudioData notice, attempting raw PCM format:', e);
      // Fallback: If raw 24kHz/16kHz 16-bit PCM little-endian
      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768.0;
      }
      const rawBuffer = ctx.createBuffer(1, float32.length, 24000);
      rawBuffer.copyToChannel(float32, 0);
      await this.enqueueBuffer(rawBuffer);
    }
  }

  /**
   * Immediate Barge-In Interruption (< 15ms)
   * Exponentially fades output gain to 0 and purges queued chunks
   */
  public interrupt(): void {
    if (!this.audioCtx) return;

    if (this.outputGainNode) {
      try {
        const t = this.audioCtx.currentTime;
        this.outputGainNode.gain.setValueAtTime(this.outputGainNode.gain.value, t);
        this.outputGainNode.gain.exponentialRampToValueAtTime(0.0001, t + 0.015);
      } catch {}
    }

    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {}
    }
    this.activeSources.clear();

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    this.scheduledEndTime = 0;
    this.isPlaying = false;

    // Reset gain back up for next playback
    setTimeout(() => {
      if (this.outputGainNode && this.audioCtx) {
        try {
          this.outputGainNode.gain.setValueAtTime(1.0, this.audioCtx.currentTime);
        } catch {}
      }
    }, 25);

    if (this.onPlaybackEnd) {
      this.onPlaybackEnd();
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public destroy(): void {
    this.interrupt();
    if (this.energyCheckInterval) {
      clearInterval(this.energyCheckInterval);
      this.energyCheckInterval = null;
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close().catch(() => {});
    }
    this.audioCtx = null;
    this.outputGainNode = null;
    this.analyserNode = null;
  }
}

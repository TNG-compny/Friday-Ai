/**
 * AudioStreamer manages Web Audio API:
 * 1. Capturing microphone input, downsampling to 16kHz PCM16, and encoding as base64.
 * 2. Scheduling and playing back 24kHz PCM16 model audio gaplessly.
 * 3. Handling model interruptions by immediately cutting audio playback.
 * 4. Providing real-time frequency analysis for visualization.
 */

export class AudioStreamer {
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private inputAnalyser: AnalyserNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;

  private nextStartTime: number = 0;
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private isMuted: boolean = false;

  private onAudioDataCallback: ((base64: string) => void) | null = null;
  private onPlaybackStateChange: ((isPlaying: boolean) => void) | null = null;

  constructor(callbacks?: {
    onAudioData?: (base64: string) => void;
    onPlaybackStateChange?: (isPlaying: boolean) => void;
  }) {
    if (callbacks?.onAudioData) this.onAudioDataCallback = callbacks.onAudioData;
    if (callbacks?.onPlaybackStateChange) this.onPlaybackStateChange = callbacks.onPlaybackStateChange;
  }

  /**
   * Initializes both input (16kHz capture) and output (24kHz playback) AudioContexts.
   * Must be called in response to a user gesture (e.g. click/tap).
   */
  async start(): Promise<void> {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    // 1. Setup Output AudioContext (24kHz for Gemini Live output)
    if (!this.outputAudioCtx || this.outputAudioCtx.state === 'closed') {
      try {
        this.outputAudioCtx = new AudioContextClass({ sampleRate: 24000 });
      } catch (e) {
        // Fallback if browser enforces hardware sample rate
        this.outputAudioCtx = new AudioContextClass();
      }
    }

    if (this.outputAudioCtx.state === 'suspended') {
      await this.outputAudioCtx.resume();
    }

    this.outputAnalyser = this.outputAudioCtx.createAnalyser();
    this.outputAnalyser.fftSize = 128;
    this.outputAnalyser.smoothingTimeConstant = 0.8;
    this.outputAnalyser.connect(this.outputAudioCtx.destination);

    // 2. Setup Input Mic AudioContext & Stream (16kHz for Gemini Live input)
    if (!this.inputAudioCtx || this.inputAudioCtx.state === 'closed') {
      this.inputAudioCtx = new AudioContextClass();
    }

    if (this.inputAudioCtx.state === 'suspended') {
      await this.inputAudioCtx.resume();
    }

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });

    const source = this.inputAudioCtx.createMediaStreamSource(this.mediaStream);

    this.inputAnalyser = this.inputAudioCtx.createAnalyser();
    this.inputAnalyser.fftSize = 128;
    this.inputAnalyser.smoothingTimeConstant = 0.8;
    source.connect(this.inputAnalyser);

    // Process microphone input buffer with low latency (2048 frames = ~42ms at 48kHz)
    const bufferSize = 2048;
    this.scriptProcessor = this.inputAudioCtx.createScriptProcessor(bufferSize, 1, 1);

    this.scriptProcessor.onaudioprocess = (e) => {
      if (this.isMuted) return;

      const inputBuffer = e.inputBuffer.getChannelData(0);
      const nativeSampleRate = this.inputAudioCtx?.sampleRate || 48000;

      // Resample to 16kHz PCM16 little-endian
      const pcm16Data = this.resampleTo16kPCM(inputBuffer, nativeSampleRate);
      if (pcm16Data && pcm16Data.length > 0) {
        const base64 = this.arrayBufferToBase64(pcm16Data.buffer);
        if (this.onAudioDataCallback) {
          this.onAudioDataCallback(base64);
        }
      }
    };

    source.connect(this.scriptProcessor);
    // Connect to destination to keep audio processing active (muted)
    const silentGain = this.inputAudioCtx.createGain();
    silentGain.gain.value = 0;
    this.scriptProcessor.connect(silentGain);
    silentGain.connect(this.inputAudioCtx.destination);
  }

  /**
   * Resamples raw Float32 audio to 16000Hz Int16 PCM.
   */
  private resampleTo16kPCM(inputData: Float32Array, inputSampleRate: number): Int16Array {
    const targetSampleRate = 16000;
    if (inputSampleRate === targetSampleRate) {
      const output = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      return output;
    }

    const ratio = inputSampleRate / targetSampleRate;
    const newLength = Math.round(inputData.length / ratio);
    const output = new Int16Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const originalIndex = i * ratio;
      const leftIndex = Math.floor(originalIndex);
      const rightIndex = Math.min(leftIndex + 1, inputData.length - 1);
      const fraction = originalIndex - leftIndex;

      // Linear interpolation between sample points
      const interpolated =
        inputData[leftIndex] * (1 - fraction) + inputData[rightIndex] * fraction;

      const s = Math.max(-1, Math.min(1, interpolated));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    return output;
  }

  /**
   * Plays a 24kHz raw PCM16 little-endian audio chunk received from Gemini Live.
   */
  playAudioChunk(base64Audio: string): void {
    if (!this.outputAudioCtx || !this.outputAnalyser) return;

    if (this.outputAudioCtx.state === 'suspended') {
      this.outputAudioCtx.resume();
    }

    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const pcm16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / 32768.0;
    }

    // Live API audio is 24000Hz
    const sampleRate = 24000;
    const audioBuffer = this.outputAudioCtx.createBuffer(1, float32.length, sampleRate);
    audioBuffer.getChannelData(0).set(float32);

    const source = this.outputAudioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.outputAnalyser);

    const currentTime = this.outputAudioCtx.currentTime;
    if (this.nextStartTime < currentTime) {
      // 30ms lead buffer to prevent choppy audio gaps
      this.nextStartTime = currentTime + 0.03;
    }

    source.start(this.nextStartTime);
    this.nextStartTime += audioBuffer.duration;

    this.activeSources.add(source);
    if (this.onPlaybackStateChange) this.onPlaybackStateChange(true);

    source.onended = () => {
      this.activeSources.delete(source);
      if (this.activeSources.size === 0 && this.onPlaybackStateChange) {
        this.onPlaybackStateChange(false);
      }
    };
  }

  /**
   * Immediately stops all currently playing and queued audio.
   * Crucial for clean model interruption when user speaks.
   */
  interrupt(): void {
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {}
    }
    this.activeSources.clear();
    this.nextStartTime = 0;
    if (this.onPlaybackStateChange) {
      this.onPlaybackStateChange(false);
    }
  }

  /**
   * Toggles microphone mute state.
   */
  setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  getIsMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Gets current user mic input volume level (0.0 to 1.0).
   */
  getInputLevel(): number {
    if (!this.inputAnalyser || this.isMuted) return 0;
    const data = new Uint8Array(this.inputAnalyser.frequencyBinCount);
    this.inputAnalyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    const avg = sum / data.length;
    return Math.min(1, avg / 128);
  }

  /**
   * Gets current Friday AI output volume level (0.0 to 1.0).
   */
  getOutputLevel(): number {
    if (!this.outputAnalyser || this.activeSources.size === 0) return 0;
    const data = new Uint8Array(this.outputAnalyser.frequencyBinCount);
    this.outputAnalyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    const avg = sum / data.length;
    return Math.min(1, avg / 128);
  }

  /**
   * Returns frequency data for visualizer canvas.
   */
  getVisualizerData(): {
    inputFrequencies: Uint8Array;
    outputFrequencies: Uint8Array;
    isSpeaking: boolean;
  } {
    const inputFrequencies = new Uint8Array(64);
    const outputFrequencies = new Uint8Array(64);

    if (this.inputAnalyser && !this.isMuted) {
      this.inputAnalyser.getByteFrequencyData(inputFrequencies);
    }
    if (this.outputAnalyser && this.activeSources.size > 0) {
      this.outputAnalyser.getByteFrequencyData(outputFrequencies);
    }

    return {
      inputFrequencies,
      outputFrequencies,
      isSpeaking: this.activeSources.size > 0,
    };
  }

  /**
   * Stops all audio tracks and closes AudioContexts.
   */
  stop(): void {
    this.interrupt();

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }

    if (this.inputAudioCtx && this.inputAudioCtx.state !== 'closed') {
      this.inputAudioCtx.close();
      this.inputAudioCtx = null;
    }

    if (this.outputAudioCtx && this.outputAudioCtx.state !== 'closed') {
      this.outputAudioCtx.close();
      this.outputAudioCtx = null;
    }
  }

  private arrayBufferToBase64(buffer: ArrayBufferLike): string {
    const bytes = new Uint8Array(buffer as ArrayBuffer);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(
        null,
        bytes.subarray(i, Math.min(i + chunk, bytes.length)) as unknown as number[]
      );
    }
    return btoa(binary);
  }
}

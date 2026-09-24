// Futuristic Sci-Fi Audio Synthesizer via Web Audio API (Zero Latency, No External Assets)

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Plays an epic futuristic sci-fi warp return sound effect:
 * Sub-bass swoop + dual ascending harmonic chime + crystal shimmer
 */
export function playWarpReturnSound(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // 1. Sub-bass power drop (deep cinematic punch)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(140, now);
    subOsc.frequency.exponentialRampToValueAtTime(45, now + 0.35);
    subGain.gain.setValueAtTime(0.5, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.5);

    // 2. Dual Ascending Sci-Fi Harmonic Beams
    const freqs = [
      { start: 280, mid: 560, end: 880, delay: 0.05, type: 'triangle' as OscillatorType },
      { start: 440, mid: 880, end: 1320, delay: 0.1, type: 'sine' as OscillatorType },
      { start: 660, mid: 1100, end: 1760, delay: 0.18, type: 'sine' as OscillatorType },
    ];

    freqs.forEach(({ start, mid, end, delay, type }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + delay;

      osc.type = type;
      osc.frequency.setValueAtTime(start, startTime);
      osc.frequency.exponentialRampToValueAtTime(mid, startTime + 0.15);
      osc.frequency.exponentialRampToValueAtTime(end, startTime + 0.35);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.28, startTime + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.55);
    });

    // 3. High Shimmer Sparkle Chime (Confirming Return to AI HUD)
    const chimeOsc = ctx.createOscillator();
    const chimeGain = ctx.createGain();
    const chimeTime = now + 0.3;
    chimeOsc.type = 'sine';
    chimeOsc.frequency.setValueAtTime(1046.5, chimeTime); // C6 note
    chimeOsc.frequency.setValueAtTime(1318.5, chimeTime + 0.12); // E6 note
    chimeOsc.frequency.setValueAtTime(1567.98, chimeTime + 0.24); // G6 note
    chimeGain.gain.setValueAtTime(0.001, chimeTime);
    chimeGain.gain.linearRampToValueAtTime(0.25, chimeTime + 0.05);
    chimeGain.gain.exponentialRampToValueAtTime(0.001, chimeTime + 0.6);

    chimeOsc.connect(chimeGain);
    chimeGain.connect(ctx.destination);
    chimeOsc.start(chimeTime);
    chimeOsc.stop(chimeTime + 0.65);
  } catch (err) {
    console.warn('[SoundEffects] Web Audio not available or autoplay blocked:', err);
  }
}

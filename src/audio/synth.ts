/**
 * Juice Studio Beat Synthesis Engine
 * Pure Web Audio API drum synthesis — no samples needed.
 * Every sound is generated programmatically.
 */

const isBrowser = typeof window !== "undefined";

// ─── Utility ─────────────────────────────────────────────────

function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

function createNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.max(2, Math.floor(sr * durationSec));
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buf;
}

// ─── Drum Sound Factories ────────────────────────────────────

/**
 * 808 Kick — deep sub with pitch drop and click transient.
 * Starts around 55Hz, drops to ~25Hz. Short exponential decay.
 */
export function createKick(ctx: AudioContext, destination: AudioNode): (time: number, vel: number) => void {
  // Click transient: short noise burst
  const clickBuf = createNoiseBuffer(ctx, 0.005); // 5ms noise

  return (time: number, vel: number) => {
    const v = vel / 127;
    const now = time;

    // ── Sub oscillator (sine, pitch drop) ──
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(55 * (0.85 + v * 0.3), now);
    osc.frequency.exponentialRampToValueAtTime(22, now + 0.15);
    oscGain.gain.setValueAtTime(dbToGain(-1) * v, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(oscGain);
    oscGain.connect(destination);
    osc.start(now);
    osc.stop(now + 0.6);

    // ── Click transient ──
    const click = ctx.createBufferSource();
    click.buffer = clickBuf;
    const clickGain = ctx.createGain();
    const clickFilter = ctx.createBiquadFilter();
    clickFilter.type = "highpass";
    clickFilter.frequency.value = 2000;
    clickGain.gain.setValueAtTime(dbToGain(-4) * v, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.005);
    click.connect(clickFilter);
    clickFilter.connect(clickGain);
    clickGain.connect(destination);
    click.start(now);
    click.stop(now + 0.006);
  };
}

/**
 * Snare — mix of tonal body (200Hz sine) + white noise through bandpass.
 */
export function createSnare(ctx: AudioContext, destination: AudioNode): (time: number, vel: number) => void {
  const noiseBuf = createNoiseBuffer(ctx, 0.25);

  return (time: number, vel: number) => {
    const v = vel / 127;
    const now = time;

    // ── Tonal body ──
    const tone = ctx.createOscillator();
    const toneGain = ctx.createGain();
    tone.type = "triangle";
    tone.frequency.setValueAtTime(180 + v * 40, now);
    tone.frequency.exponentialRampToValueAtTime(100, now + 0.08);
    toneGain.gain.setValueAtTime(dbToGain(-6) * v, now);
    toneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    tone.connect(toneGain);
    toneGain.connect(destination);
    tone.start(now);
    tone.stop(now + 0.2);

    // ── Noise body through bandpass ──
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 1200;
    noiseFilter.Q.value = 0.8;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(dbToGain(-10) * v, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(destination);
    noise.start(now);
    noise.stop(now + 0.2);
  };
}

/**
 * Closed Hi-Hat — high-pass filtered noise, very short decay.
 */
export function createHihatClosed(ctx: AudioContext, destination: AudioNode): (time: number, vel: number) => void {
  const noiseBuf = createNoiseBuffer(ctx, 0.1);

  return (time: number, vel: number) => {
    const v = vel / 127;
    const now = time;

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;

    // High-pass at ~8kHz for metallic feel
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 6000 + v * 2000;

    // Multiple bandpass for metallic character
    const bp1 = ctx.createBiquadFilter();
    bp1.type = "bandpass";
    bp1.frequency.value = 9000;
    bp1.Q.value = 2;

    const bp2 = ctx.createBiquadFilter();
    bp2.type = "bandpass";
    bp2.frequency.value = 12000;
    bp2.Q.value = 3;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(dbToGain(-14) * v, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    noise.connect(hp);
    hp.connect(bp1);
    bp1.connect(bp2);
    bp2.connect(gain);
    gain.connect(destination);
    noise.start(now);
    noise.stop(now + 0.09);
  };
}

/**
 * Open Hi-Hat — same as closed but longer decay.
 */
export function createHihatOpen(ctx: AudioContext, destination: AudioNode): (time: number, vel: number) => void {
  const noiseBuf = createNoiseBuffer(ctx, 0.5);

  return (time: number, vel: number) => {
    const v = vel / 127;
    const now = time;

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;

    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 5500 + v * 2000;

    const bp1 = ctx.createBiquadFilter();
    bp1.type = "bandpass";
    bp1.frequency.value = 8500;
    bp1.Q.value = 1.5;

    const bp2 = ctx.createBiquadFilter();
    bp2.type = "bandpass";
    bp2.frequency.value = 11500;
    bp2.Q.value = 2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(dbToGain(-14) * v, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    noise.connect(hp);
    hp.connect(bp1);
    bp1.connect(bp2);
    bp2.connect(gain);
    gain.connect(destination);
    noise.start(now);
    noise.stop(now + 0.4);
  };
}

/**
 * Clap — multiple layered short noise bursts with slight timing offsets.
 */
export function createClap(ctx: AudioContext, destination: AudioNode): (time: number, vel: number) => void {
  const noiseBuf = createNoiseBuffer(ctx, 0.1);

  return (time: number, vel: number) => {
    const v = vel / 127;
    const now = time;

    // 4-5 staggered noise bursts simulating multiple clappers
    const offsets = [0, 0.006, 0.013, 0.019, 0.027];
    const gains = [0.7, 0.55, 0.45, 0.35, 0.25];

    for (let i = 0; i < offsets.length; i++) {
      const t = now + offsets[i] * (1 + (1 - v) * 0.5);
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuf;

      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 800 + i * 400;
      bp.Q.value = 1.2;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(dbToGain(-8) * v * gains[i], t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

      noise.connect(bp);
      bp.connect(gain);
      gain.connect(destination);
      noise.start(t);
      noise.stop(t + 0.07);
    }

    // Slight tonal thump
    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = "sine";
    thump.frequency.setValueAtTime(400, now);
    thump.frequency.exponentialRampToValueAtTime(150, now + 0.02);
    thumpGain.gain.setValueAtTime(dbToGain(-8) * v * 0.4, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    thump.connect(thumpGain);
    thumpGain.connect(destination);
    thump.start(now);
    thump.stop(now + 0.04);
  };
}

/**
 * Rim Shot — short sine burst at ~1kHz with fast decay + noise.
 */
export function createRimShot(ctx: AudioContext, destination: AudioNode): (time: number, vel: number) => void {
  const noiseBuf = createNoiseBuffer(ctx, 0.04);

  return (time: number, vel: number) => {
    const v = vel / 127;
    const now = time;

    // Tonal burst
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1000 + v * 300, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.02);
    oscGain.gain.setValueAtTime(dbToGain(-6) * v, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(oscGain);
    oscGain.connect(destination);
    osc.start(now);
    osc.stop(now + 0.05);

    // Noise layer
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 4000;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(dbToGain(-14) * v, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    noise.connect(hp);
    hp.connect(noiseGain);
    noiseGain.connect(destination);
    noise.start(now);
    noise.stop(now + 0.04);
  };
}

/**
 * Conga — bandpassed noise around 400Hz with tone.
 */
export function createConga(ctx: AudioContext, destination: AudioNode): (time: number, vel: number) => void {
  const noiseBuf = createNoiseBuffer(ctx, 0.2);

  return (time: number, vel: number) => {
    const v = vel / 127;
    const now = time;

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(380 + v * 60, now);
    bp.frequency.exponentialRampToValueAtTime(250, now + 0.15);
    bp.Q.value = 1.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(dbToGain(-6) * v, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    noise.connect(bp);
    bp.connect(gain);
    gain.connect(destination);
    noise.start(now);
    noise.stop(now + 0.2);

    // Tonal resonance
    const tone = ctx.createOscillator();
    const toneGain = ctx.createGain();
    tone.type = "sine";
    tone.frequency.setValueAtTime(200 + v * 40, now);
    toneGain.gain.setValueAtTime(dbToGain(-10) * v, now);
    toneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    tone.connect(toneGain);
    toneGain.connect(destination);
    tone.start(now);
    tone.stop(now + 0.15);
  };
}

/**
 * Shaker — filtered noise, rhythmic.
 */
export function createShaker(ctx: AudioContext, destination: AudioNode): (time: number, vel: number) => void {
  const noiseBuf = createNoiseBuffer(ctx, 0.07);

  return (time: number, vel: number) => {
    const v = vel / 127;
    const now = time;

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;

    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 5000;

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 10000;
    bp.Q.value = 1;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(dbToGain(-18) * v, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    noise.connect(hp);
    hp.connect(bp);
    bp.connect(gain);
    gain.connect(destination);
    noise.start(now);
    noise.stop(now + 0.07);
  };
}

// ─── Drum Kit Factory ────────────────────────────────────────

export interface DrumKit {
  kick: (time: number, vel: number) => void;
  snare: (time: number, vel: number) => void;
  hihatClosed: (time: number, vel: number) => void;
  hihatOpen: (time: number, vel: number) => void;
  clap: (time: number, vel: number) => void;
  rimShot: (time: number, vel: number) => void;
  conga: (time: number, vel: number) => void;
  shaker: (time: number, vel: number) => void;
  /** Master output gain node — connect to destination or further processing */
  masterGain: GainNode;
  /** Individual channel gains for mute/solo */
  channels: {
    kick: GainNode;
    snare: GainNode;
    hihatClosed: GainNode;
    hihatOpen: GainNode;
    clap: GainNode;
    percussion: GainNode;
  };
  /** Master output AudioNode for connecting to recording/monitoring */
  output: AudioNode;
  dispose(): void;
}

/**
 * Create a complete drum kit. All sounds route through individual channel gains,
 * then through a master gain, then to the provided destination.
 *
 * @param ctx - The AudioContext to create nodes with
 * @param destination - The output destination (e.g. ctx.destination, or a mixer gain node)
 */
export function createDrumKit(ctx: AudioContext, destination: AudioNode): DrumKit {
  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.8;

  // Channel gains for mute/solo
  const chKick = ctx.createGain();
  const chSnare = ctx.createGain();
  const chHHClosed = ctx.createGain();
  const chHHOpen = ctx.createGain();
  const chClap = ctx.createGain();
  const chPercussion = ctx.createGain();

  // Route channels → masterGain → destination
  chKick.connect(masterGain);
  chSnare.connect(masterGain);
  chHHClosed.connect(masterGain);
  chHHOpen.connect(masterGain);
  chClap.connect(masterGain);
  chPercussion.connect(masterGain);
  masterGain.connect(destination);

  const channels = {
    kick: chKick,
    snare: chSnare,
    hihatClosed: chHHClosed,
    hihatOpen: chHHOpen,
    clap: chClap,
    percussion: chPercussion,
  };

  // Create sound functions — each routes its output through the appropriate channel gain
  const kickFn = createKick(ctx, chKick);
  const snareFn = createSnare(ctx, chSnare);
  const hhClosedFn = createHihatClosed(ctx, chHHClosed);
  const hhOpenFn = createHihatOpen(ctx, chHHOpen);
  const clapFn = createClap(ctx, chClap);
  const rimFn = createRimShot(ctx, chPercussion);
  const congaFn = createConga(ctx, chPercussion);
  const shakerFn = createShaker(ctx, chPercussion);

  return {
    kick: kickFn,
    snare: snareFn,
    hihatClosed: hhClosedFn,
    hihatOpen: hhOpenFn,
    clap: clapFn,
    rimShot: rimFn,
    conga: congaFn,
    shaker: shakerFn,
    masterGain,
    channels,
    output: masterGain,
    dispose() {
      masterGain.disconnect();
      for (const ch of Object.values(channels)) {
        ch.disconnect();
      }
    },
  };
}

/**
 * Create a routed drum kit that connects to ctx.destination.
 * Uses createDrumKit internally — the kit's masterGain is connected directly
 * to ctx.destination so it can be disconnected and rerouted by the session manager.
 * All sounds flow through: drumSound → channelGain → masterGain → ctx.destination
 */
export function createRoutedDrumKit(ctx: AudioContext): DrumKit {
  return createDrumKit(ctx, ctx.destination);
}

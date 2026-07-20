/**
 * Juice Studio Mastering Engine
 * Dedicated audio graph for the Mixing & Mastering page.
 *
 * Chain: input → EQ (3-band) → Compressor → Limiter → Analyser → Destination
 *
 * When an active StudioSession exists, the engine taps the session's master
 * output and routes it through the mastering chain. Otherwise a looping test
 * tone is generated so the user can preview EQ/compressor/limiter changes.
 */

import { getContext, createTestToneBuffer } from "./engine";
import { getSession, getFullMixOutput, getSessionAnalyser } from "./session";

// ─── Types ──────────────────────────────────────────────────

export interface MasteringEngine {
  /** The analyser node — read spectrum / waveform data from this */
  analyser: AnalyserNode;

  /** Set mastering EQ gains. Values in dB, range roughly -12..12 */
  setEQ(lowGain: number, midGain: number, highGain: number): void;

  /** Update compressor parameters */
  setCompressor(threshold: number, ratio: number, attackMs: number, releaseMs: number): void;

  /** Update limiter parameters */
  setLimiter(ceiling: number, threshold: number, releaseMs: number): void;

  /** Get real-time frequency data (0-255 per bin) */
  getFrequencyData(): Uint8Array;

  /** Get real-time waveform/time-domain data (0-255 per sample) */
  getWaveformData(): Uint8Array;

  /** Get current RMS level in dB */
  getRMSLevel(): number;

  /** Approximate LUFS from RMS */
  getApproximateLUFS(): number;

  /** Get compressor gain reduction in dB */
  getCompressorReduction(): number;

  /** Whether a session mix is being processed */
  isSessionActive: boolean;

  /** Human-readable name of the active source */
  sourceLabel: string;

  /** Total teardown */
  dispose(): void;
}

// ─── Internal state ─────────────────────────────────────────

let _engine: MasteringEngine | null = null;

// Audio nodes that persist across the engine lifecycle
let _inputGain: GainNode | null = null;
let _lowShelf: BiquadFilterNode | null = null;
let _midPeak: BiquadFilterNode | null = null;
let _highShelf: BiquadFilterNode | null = null;
let _compressor: DynamicsCompressorNode | null = null;
let _limiterComp: DynamicsCompressorNode | null = null;
let _ceilingGain: GainNode | null = null;
let _analyser: AnalyserNode | null = null;
let _testToneSource: AudioBufferSourceNode | null = null;
let _sessionTapGain: GainNode | null = null;

// Original session destination connection (restored on dispose)
let _sessionOriginalDest: AudioNode | null = null;

const TEST_TONE_FREQ = 440;
const TEST_TONE_DURATION = 120; // 2 minutes loop

// ─── Public API ─────────────────────────────────────────────

export function createMasteringEngine(): MasteringEngine {
  if (_engine) return _engine;

  const isBrowser = typeof window !== "undefined";
  if (!isBrowser) {
    // SSR stub — returns a no-op engine
    return createSSRStub();
  }

  const ctx = getContext();

  // ── Build the audio graph ──────────────────────────────────

  _inputGain = ctx.createGain();
  _inputGain.gain.value = 1;

  // EQ: 3-band
  _lowShelf = ctx.createBiquadFilter();
  _lowShelf.type = "lowshelf";
  _lowShelf.frequency.value = 100;
  _lowShelf.gain.value = 0;

  _midPeak = ctx.createBiquadFilter();
  _midPeak.type = "peaking";
  _midPeak.frequency.value = 2000;
  _midPeak.Q.value = 1;
  _midPeak.gain.value = 0;

  _highShelf = ctx.createBiquadFilter();
  _highShelf.type = "highshelf";
  _highShelf.frequency.value = 8000;
  _highShelf.gain.value = 0;

  // Compressor
  _compressor = ctx.createDynamicsCompressor();
  _compressor.threshold.value = -24;
  _compressor.ratio.value = 4;
  _compressor.attack.value = 0.03;
  _compressor.release.value = 0.1;

  // Limiter (second compressor in brickwall config)
  _limiterComp = ctx.createDynamicsCompressor();
  _limiterComp.threshold.value = -3;
  _limiterComp.ratio.value = 20;
  _limiterComp.attack.value = 0.001;
  _limiterComp.release.value = 0.05;

  _ceilingGain = ctx.createGain();
  _ceilingGain.gain.value = Math.pow(10, -0.3 / 20); // -0.3 dB

  // Analyser for metering
  _analyser = ctx.createAnalyser();
  _analyser.fftSize = 2048;
  _analyser.smoothingTimeConstant = 0.8;

  // ── Wire the chain ─────────────────────────────────────────
  // inputGain → lowShelf → midPeak → highShelf → compressor → limiterComp → ceilingGain → analyser → destination

  _inputGain.connect(_lowShelf);
  _lowShelf.connect(_midPeak);
  _midPeak.connect(_highShelf);
  _highShelf.connect(_compressor);
  _compressor.connect(_limiterComp);
  _limiterComp.connect(_ceilingGain);
  _ceilingGain.connect(_analyser);
  _analyser.connect(ctx.destination);

  // ── Attempt to bridge the session ──────────────────────────
  let isSessionActive = false;
  let sourceLabel = "Test Tone";

  const session = getSession();
  if (session) {
    // Ensure the session graph is ready
    getFullMixOutput();

    const sessionAnalyser = getSessionAnalyser();
    if (sessionAnalyser) {
      // Disconnect session analyser from destination
      try {
        sessionAnalyser.disconnect(ctx.destination);
      } catch {
        // May not have been connected yet
      }

      // Save the destination for restoration on dispose
      _sessionOriginalDest = ctx.destination;

      // Create a tap gain and connect: sessionAnalyser → tapGain → mastering chain input
      _sessionTapGain = ctx.createGain();
      _sessionTapGain.gain.value = 1;
      try {
        sessionAnalyser.connect(_sessionTapGain);
      } catch {
        // Already connected
      }
      _sessionTapGain.connect(_inputGain!);

      isSessionActive = true;
      sourceLabel = session.projectName;
    }
  }

  // If no session active, start a test tone so the user can hear effects
  if (!isSessionActive) {
    startTestToneInternal(ctx);
  }

  const engine: MasteringEngine = {
    analyser: _analyser,

    setEQ(lowGain: number, midGain: number, highGain: number) {
      if (!_lowShelf || !_midPeak || !_highShelf) return;
      const now = ctx.currentTime;
      _lowShelf.gain.setTargetAtTime(lowGain, now, 0.03);
      _midPeak.gain.setTargetAtTime(midGain, now, 0.03);
      _highShelf.gain.setTargetAtTime(highGain, now, 0.03);
    },

    setCompressor(threshold: number, ratio: number, attackMs: number, releaseMs: number) {
      if (!_compressor) return;
      const now = ctx.currentTime;
      _compressor.threshold.setTargetAtTime(threshold, now, 0.03);
      _compressor.ratio.setTargetAtTime(ratio, now, 0.03);
      _compressor.attack.setTargetAtTime(attackMs / 1000, now, 0.03);
      _compressor.release.setTargetAtTime(releaseMs / 1000, now, 0.03);
    },

    setLimiter(ceiling: number, threshold: number, releaseMs: number) {
      if (!_limiterComp || !_ceilingGain) return;
      const now = ctx.currentTime;
      _limiterComp.threshold.setTargetAtTime(threshold, now, 0.03);
      _limiterComp.release.setTargetAtTime(releaseMs / 1000, now, 0.03);
      _ceilingGain.gain.setTargetAtTime(Math.pow(10, ceiling / 20), now, 0.03);
    },

    getFrequencyData(): Uint8Array {
      if (!_analyser) return new Uint8Array(0);
      const data = new Uint8Array(_analyser.frequencyBinCount);
      _analyser.getByteFrequencyData(data);
      return data;
    },

    getWaveformData(): Uint8Array {
      if (!_analyser) return new Uint8Array(0);
      const data = new Uint8Array(_analyser.fftSize);
      _analyser.getByteTimeDomainData(data);
      return data;
    },

    getRMSLevel(): number {
      if (!_analyser) return -60;
      const data = new Float32Array(_analyser.fftSize);
      _analyser.getFloatTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        sum += data[i] * data[i];
      }
      const rms = Math.sqrt(sum / data.length);
      if (rms < 0.00001) return -60;
      return 20 * Math.log10(rms);
    },

    getApproximateLUFS(): number {
      return this.getRMSLevel() - 0.5;
    },

    getCompressorReduction(): number {
      return _compressor?.reduction ?? 0;
    },

    isSessionActive,
    sourceLabel,

    dispose() {
      // Stop test tone
      if (_testToneSource) {
        try {
          _testToneSource.stop();
        } catch {
          /* already stopped */
        }
        try {
          _testToneSource.disconnect();
        } catch {
          /* ok */
        }
        _testToneSource = null;
      }

      // Disconnect session tap
      if (_sessionTapGain) {
        try {
          _sessionTapGain.disconnect();
        } catch {
          /* ok */
        }
        _sessionTapGain = null;
      }

      // Restore session analyser → destination
      const sessionAnalyser = getSessionAnalyser();
      if (sessionAnalyser && _sessionOriginalDest) {
        try {
          sessionAnalyser.connect(_sessionOriginalDest as AudioNode);
        } catch {
          /* may already be connected */
        }
      }
      _sessionOriginalDest = null;

      // Disconnect all chain nodes
      const nodes = [
        _inputGain,
        _lowShelf,
        _midPeak,
        _highShelf,
        _compressor,
        _limiterComp,
        _ceilingGain,
        _analyser,
      ];
      for (const node of nodes) {
        if (node) {
          try {
            node.disconnect();
          } catch {
            /* ok */
          }
        }
      }

      _inputGain = null;
      _lowShelf = null;
      _midPeak = null;
      _highShelf = null;
      _compressor = null;
      _limiterComp = null;
      _ceilingGain = null;
      _analyser = null;

      _engine = null;
    },
  };

  _engine = engine;
  return engine;
}

export function getMasteringEngine(): MasteringEngine | null {
  return _engine;
}

export function disposeMasteringEngine(): void {
  if (_engine) {
    _engine.dispose();
    _engine = null;
  }
}

// ─── Internals ───────────────────────────────────────────────

function startTestToneInternal(ctx: AudioContext): void {
  stopTestToneInternal();

  const buffer = createTestToneBuffer(TEST_TONE_FREQ, TEST_TONE_DURATION);
  _testToneSource = ctx.createBufferSource();
  _testToneSource.buffer = buffer;
  _testToneSource.loop = true;
  _testToneSource.connect(_inputGain!);
  _testToneSource.start();
}

function stopTestToneInternal(): void {
  if (_testToneSource) {
    try {
      _testToneSource.stop();
    } catch {
      /* ok */
    }
    try {
      _testToneSource.disconnect();
    } catch {
      /* ok */
    }
    _testToneSource = null;
  }
}

function createSSRStub(): MasteringEngine {
  const emptyData = new Uint8Array(0);
  return {
    analyser: null as unknown as AnalyserNode,
    setEQ() {},
    setCompressor() {},
    setLimiter() {},
    getFrequencyData() {
      return emptyData;
    },
    getWaveformData() {
      return emptyData;
    },
    getRMSLevel() {
      return -60;
    },
    getApproximateLUFS() {
      return -60;
    },
    getCompressorReduction() {
      return 0;
    },
    isSessionActive: false,
    sourceLabel: "SSR",
    dispose() {},
  };
}

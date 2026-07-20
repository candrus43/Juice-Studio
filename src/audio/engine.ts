/**
 * Juice Studio Audio Engine
 * Singleton Web Audio API service providing recording, playback, effects, and analysis.
 * Browser-only — all methods guard against SSR with isBrowser checks.
 */

// ─── SSR guard ──────────────────────────────────────────────────────
const isBrowser = typeof window !== "undefined";

// ─── Private globals (lazily initialized) ───────────────────────────
let _ctx: AudioContext | null = null;
let _initiatedByUserGesture = false;

// Recorded audio buffers keyed by track/take id
const _buffers = new Map<string, AudioBuffer>();

// Active effect chains keyed by track id
const _chains = new Map<string, EffectChain>();

// Active analysers keyed by track id
const _analysers = new Map<string, AnalyserNode>();

// Active media stream source for recording
let _micStream: MediaStream | null = null;
let _micSourceNode: MediaStreamAudioSourceNode | null = null;

// ─── Types ──────────────────────────────────────────────────────────

export interface RecorderHandle {
  /** Start recording from the microphone. Returns promise with recorded chunks. */
  start(): Promise<void>;
  /** Stop recording and return the recorded AudioBuffer. */
  stop(): Promise<AudioBuffer>;
  /** Whether currently recording */
  readonly isRecording: boolean;
}

export interface PlayerHandle {
  /** Play the buffer (optionally looping) */
  start(loop?: boolean, offset?: number): void;
  /** Stop playback */
  stop(): void;
  /** Whether currently playing */
  readonly isPlaying: boolean;
  /** Connect to a destination node */
  connect(destination: AudioNode): void;
  /** Disconnect */
  disconnect(): void;
}

export interface EffectChain {
  /** The input node (connect audio source here) */
  input: GainNode;
  /** The output node (connect to destination) */
  output: GainNode;
  /** All nodes in the chain (for cleanup) */
  nodes: AudioNode[];
  /** The full chain as a connectable AudioNode (input) */
  inlet: AudioNode;
  /** The final output node */
  outlet: AudioNode;

  // Effect-specific nodes (created on demand)
  eqNodes: {
    lowShelf: BiquadFilterNode;
    lowMid: BiquadFilterNode;
    highMid: BiquadFilterNode;
    highShelf: BiquadFilterNode;
  } | null;
  compressor: DynamicsCompressorNode | null;
  reverb: ConvolverNode | null;
  reverbWet: GainNode | null;
  reverbDry: GainNode | null;
  delayNode: DelayNode | null;
  delayFeedback: GainNode | null;
  delayWet: GainNode | null;
  delayDry: GainNode | null;
  stereoWidth: {
    splitter: ChannelSplitterNode;
    merger: ChannelMergerNode;
    leftGain: GainNode;
    rightGain: GainNode;
    midGain: GainNode;
    sideGain: GainNode;
  } | null;
  noiseGate: ScriptProcessorNode | null;
  pitchShift: { node: OscillatorNode; gain: GainNode; detune: number } | null;

  /** Bypass the entire chain (dry routing) */
  bypassed: boolean;
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Gets or creates the shared AudioContext.
 * Must be called from a user-gesture handler for autoplay policy.
 */
export function getContext(): AudioContext {
  if (!isBrowser) throw new Error("AudioContext is browser-only");
  if (!_ctx || _ctx.state === "closed") {
    const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
    _ctx = new Ctor({ sampleRate: 44100 }) as AudioContext;
  }
  _initiatedByUserGesture = true;
  return _ctx;
}

/**
 * Resume the AudioContext (call on user gesture to satisfy autoplay policy).
 */
export async function resume(): Promise<void> {
  if (!isBrowser) return;
  if (_ctx && _ctx.state === "suspended") {
    await _ctx.resume();
  }
}

/**
 * Create a recorder that captures from the microphone.
 */
export function createRecorder(): RecorderHandle {
  let mediaRecorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let recording = false;
  let resolvePromise: ((buf: AudioBuffer) => void) | null = null;
  let rejectPromise: ((err: Error) => void) | null = null;

  return {
    get isRecording() {
      return recording;
    },

    async start() {
      if (!isBrowser) throw new Error("Recording is browser-only");
      const ctx = getContext();

      // Request mic permission
      try {
        _micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
      } catch (e) {
        throw new Error(
          "Microphone access denied. Please allow mic access in your browser settings."
        );
      }

      _micSourceNode = ctx.createMediaStreamSource(_micStream);

      // Use MediaRecorder for capture
      chunks = [];
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      mediaRecorder = new MediaRecorder(_micStream, { mimeType });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: mimeType });
        const arrayBuffer = await blob.arrayBuffer();
        try {
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
          if (resolvePromise) resolvePromise(audioBuffer);
        } catch {
          // Fallback: create offline context to decode
          const offlineCtx = new OfflineAudioContext(1, 1, ctx.sampleRate);
          try {
            const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);
            if (resolvePromise) resolvePromise(audioBuffer);
          } catch (e2) {
            if (rejectPromise) rejectPromise(new Error("Failed to decode recorded audio"));
          }
        }
      };

      return new Promise<void>((resolve, reject) => {
        recording = true;
        mediaRecorder!.start(100); // collect data every 100ms
        resolve();
      });
    },

    async stop() {
      return new Promise<AudioBuffer>((resolve, reject) => {
        if (!mediaRecorder || !recording) {
          reject(new Error("No active recording"));
          return;
        }
        resolvePromise = resolve;
        rejectPromise = reject;
        recording = false;
        mediaRecorder.stop();

        // Clean up mic stream
        if (_micStream) {
          _micStream.getTracks().forEach((t) => t.stop());
          _micStream = null;
        }
        _micSourceNode = null;
      });
    },
  };
}

/**
 * Enable mic monitoring (direct passthrough to output).
 */
export function enableMonitor(enable: boolean): void {
  if (!isBrowser || !_micSourceNode) return;
  const ctx = getContext();
  if (enable) {
    try {
      _micSourceNode.connect(ctx.destination);
    } catch {
      // Already connected
    }
  } else {
    try {
      _micSourceNode.disconnect(ctx.destination);
    } catch {
      // Not connected
    }
  }
}

/**
 * Create a player for an AudioBuffer.
 */
export function createPlayer(buffer: AudioBuffer): PlayerHandle {
  let source: AudioBufferSourceNode | null = null;
  let playing = false;
  let _loop = false;
  let _offset = 0;
  const ctx = getContext();

  return {
    get isPlaying() {
      return playing;
    },

    start(loop = false, offset = 0) {
      if (!isBrowser) return;
      source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = loop;
      source.connect(ctx.destination);
      source.start(0, offset);
      playing = true;
      _loop = loop;
      source.onended = () => {
        if (!_loop) playing = false;
      };
    },

    stop() {
      if (source) {
        try {
          source.stop();
        } catch {
          // May already be stopped
        }
        source.disconnect();
        source = null;
      }
      playing = false;
    },

    connect(destination: AudioNode) {
      if (source) source.connect(destination);
    },

    disconnect() {
      if (source) source.disconnect();
    },
  };
}

/**
 * Store an AudioBuffer for later use.
 */
export function storeBuffer(id: string, buffer: AudioBuffer): void {
  _buffers.set(id, buffer);
}

/**
 * Retrieve a stored AudioBuffer.
 */
export function getBuffer(id: string): AudioBuffer | undefined {
  return _buffers.get(id);
}

/**
 * Get or create an AnalyserNode for a track.
 */
export function getAnalyser(trackId: string): AnalyserNode {
  if (_analysers.has(trackId)) return _analysers.get(trackId)!;
  const ctx = getContext();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.8;
  _analysers.set(trackId, analyser);
  return analyser;
}

/**
 * Get raw waveform data (time domain) from an analyser.
 */
export function getWaveformData(trackId: string): Uint8Array {
  const analyser = getAnalyser(trackId);
  const data = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(data);
  return data;
}

/**
 * Get frequency data from an analyser.
 */
export function getFrequencyData(trackId: string): Uint8Array {
  const analyser = getAnalyser(trackId);
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  return data;
}

/**
 * Create a test tone buffer (simple sine wave) for previewing effects.
 */
export function createTestToneBuffer(
  frequency = 440,
  duration = 5,
  sampleRate = 44100
): AudioBuffer {
  const ctx = getContext();
  const length = sampleRate * duration;
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    // Mix of fundamental + harmonics for richer sound
    const fundamental = Math.sin(2 * Math.PI * frequency * t) * 0.5;
    const h2 = Math.sin(2 * Math.PI * frequency * 2 * t) * 0.2;
    const h3 = Math.sin(2 * Math.PI * frequency * 3 * t) * 0.1;
    // Add slight vibrato
    const vibrato = 1 + Math.sin(2 * Math.PI * 5 * t) * 0.005;
    data[i] = (fundamental * vibrato + h2 + h3) * 0.7;
  }
  return buffer;
}

// ─── Effect Chain ───────────────────────────────────────────────────

/**
 * Create an effect chain for a track.
 */
export function createEffectChain(trackId: string): EffectChain {
  usingExisting = false;
  if (_chains.has(trackId)) {
    disposeChain(trackId);
  }

  const ctx = getContext();

  const input = ctx.createGain();
  const output = ctx.createGain();
  output.gain.value = 1;

  const chain: EffectChain = {
    input,
    output,
    nodes: [input, output],
    inlet: input,
    outlet: output,
    eqNodes: null,
    compressor: null,
    reverb: null,
    reverbWet: null,
    reverbDry: null,
    delayNode: null,
    delayFeedback: null,
    delayWet: null,
    delayDry: null,
    stereoWidth: null,
    noiseGate: null,
    pitchShift: null,
    bypassed: false,
  };

  // Start with input → output as the default path
  input.connect(output);

  // Connect an analyser in between
  const analyser = getAnalyser(trackId);
  input.connect(analyser);
  analyser.connect(output);

  _chains.set(trackId, chain);
  return chain;
}

/**
 * Get an existing effect chain.
 */
export function getEffectChain(trackId: string): EffectChain | undefined {
  return _chains.get(trackId);
}

// Track whether we're using an existing chain to avoid double-disposal
let usingExisting = false;

/**
 * Build the EQ section of an effect chain.
 */
export function buildEQ(
  trackId: string,
  settings: {
    lowShelfFreq: number;
    lowShelfGain: number;
    lowMidFreq: number;
    lowMidGain: number;
    lowMidQ: number;
    highMidFreq: number;
    highMidGain: number;
    highMidQ: number;
    highShelfFreq: number;
    highShelfGain: number;
  }
): void {
  const chain = _chains.get(trackId);
  if (!chain) return;
  const ctx = getContext();

  // Remove existing EQ nodes
  if (chain.eqNodes) {
    chain.eqNodes.lowShelf.disconnect();
    chain.eqNodes.lowMid.disconnect();
    chain.eqNodes.highMid.disconnect();
    chain.eqNodes.highShelf.disconnect();
  }

  // Disconnect and reconnect the chain
  disconnectChainInterior(chain);

  const lowShelf = ctx.createBiquadFilter();
  lowShelf.type = "lowshelf";
  lowShelf.frequency.value = settings.lowShelfFreq;
  lowShelf.gain.value = settings.lowShelfGain;

  const lowMid = ctx.createBiquadFilter();
  lowMid.type = "peaking";
  lowMid.frequency.value = settings.lowMidFreq;
  lowMid.gain.value = settings.lowMidGain;
  lowMid.Q.value = settings.lowMidQ;

  const highMid = ctx.createBiquadFilter();
  highMid.type = "peaking";
  highMid.frequency.value = settings.highMidFreq;
  highMid.gain.value = settings.highMidGain;
  highMid.Q.value = settings.highMidQ;

  const highShelf = ctx.createBiquadFilter();
  highShelf.type = "highshelf";
  highShelf.frequency.value = settings.highShelfFreq;
  highShelf.gain.value = settings.highShelfGain;

  chain.eqNodes = { lowShelf, lowMid, highMid, highShelf };
  chain.nodes.push(lowShelf, lowMid, highMid, highShelf);
  rebuildChain(chain);
}

/**
 * Build the compressor section.
 */
export function buildCompressor(
  trackId: string,
  settings: {
    threshold: number;
    ratio: number;
    attack: number;
    release: number;
    makeupGain: number;
  }
): void {
  const chain = _chains.get(trackId);
  if (!chain) return;
  const ctx = getContext();

  if (chain.compressor) {
    chain.compressor.disconnect();
  }

  disconnectChainInterior(chain);

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = settings.threshold;
  comp.ratio.value = settings.ratio;
  comp.attack.value = settings.attack / 1000; // ms to seconds
  comp.release.value = settings.release / 1000;

  const makeup = ctx.createGain();
  makeup.gain.value = Math.pow(10, settings.makeupGain / 20);

  chain.compressor = comp;
  chain.nodes.push(comp, makeup);
  rebuildChain(chain);
}

/**
 * Get the current gain reduction from the compressor.
 */
export function getCompressorReduction(trackId: string): number {
  const chain = _chains.get(trackId);
  if (!chain?.compressor) return 0;
  return chain.compressor.reduction;
}

/**
 * Build a procedurally generated convolution reverb.
 */
export function buildReverb(
  trackId: string,
  settings: {
    roomSize: number; // 0-100
    decayTime: number; // ms
    dryWet: number; // 0-100
  }
): void {
  const chain = _chains.get(trackId);
  if (!chain) return;
  const ctx = getContext();

  if (chain.reverb) {
    chain.reverb.disconnect();
    chain.reverbWet?.disconnect();
    chain.reverbDry?.disconnect();
  }

  disconnectChainInterior(chain);

  const sampleRate = ctx.sampleRate;
  const duration = settings.decayTime / 1000;
  const length = Math.max(2, Math.floor(sampleRate * duration));
  const impulseBuffer = ctx.createBuffer(2, length, sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const channelData = impulseBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      // Exponential decay envelope with room size influence
      const roomFactor = settings.roomSize / 100;
      const decay = Math.exp(-t * (3 + (1 - roomFactor) * 5));
      // White noise shaped by decay
      channelData[i] = (Math.random() * 2 - 1) * decay * roomFactor * 0.6;
    }
  }

  const convolver = ctx.createConvolver();
  convolver.buffer = impulseBuffer;
  convolver.normalize = true;

  const wetGain = ctx.createGain();
  wetGain.gain.value = settings.dryWet / 100;
  const dryGain = ctx.createGain();
  dryGain.gain.value = 1 - settings.dryWet / 100;

  chain.reverb = convolver;
  chain.reverbWet = wetGain;
  chain.reverbDry = dryGain;
  chain.nodes.push(convolver, wetGain, dryGain);
  rebuildChain(chain);
}

/**
 * Build delay section.
 */
export function buildDelay(
  trackId: string,
  settings: {
    time: number; // ms
    feedback: number; // 0-90
    dryWet: number; // 0-100
    lowCut: number; // Hz
    highCut: number; // Hz
    pingPong: boolean;
  }
): void {
  const chain = _chains.get(trackId);
  if (!chain) return;
  const ctx = getContext();

  if (chain.delayNode) {
    chain.delayNode.disconnect();
    chain.delayFeedback?.disconnect();
    chain.delayWet?.disconnect();
    chain.delayDry?.disconnect();
  }

  disconnectChainInterior(chain);

  const delay = ctx.createDelay(2);
  delay.delayTime.value = settings.time / 1000;

  // Feedback loop: delay → filter → gain → delay
  const feedback = ctx.createGain();
  feedback.gain.value = settings.feedback / 100;

  // Optional filters in feedback path
  const lowCut = ctx.createBiquadFilter();
  lowCut.type = "highpass";
  lowCut.frequency.value = settings.lowCut;

  const highCut = ctx.createBiquadFilter();
  highCut.type = "lowpass";
  highCut.frequency.value = settings.highCut;

  // Feedback routing: delay → highCut → lowCut → feedback → delay
  delay.connect(highCut);
  highCut.connect(lowCut);
  lowCut.connect(feedback);
  feedback.connect(delay);

  const wetGain = ctx.createGain();
  wetGain.gain.value = settings.dryWet / 100;
  const dryGain = ctx.createGain();
  dryGain.gain.value = 1 - settings.dryWet / 100;

  chain.delayNode = delay;
  chain.delayFeedback = feedback;
  chain.delayWet = wetGain;
  chain.delayDry = dryGain;
  chain.nodes.push(delay, feedback, lowCut, highCut, wetGain, dryGain);
  rebuildChain(chain);
}

/**
 * Build stereo width section using mid/side processing.
 */
export function buildStereoWidth(
  trackId: string,
  settings: {
    width: number; // 0-100 (50 = normal)
  }
): void {
  const chain = _chains.get(trackId);
  if (!chain) return;
  const ctx = getContext();

  if (chain.stereoWidth) {
    const sw = chain.stereoWidth;
    sw.splitter.disconnect();
    sw.merger.disconnect();
    sw.leftGain.disconnect();
    sw.rightGain.disconnect();
    sw.midGain.disconnect();
    sw.sideGain.disconnect();
  }

  disconnectChainInterior(chain);

  const splitter = ctx.createChannelSplitter(2);
  const merger = ctx.createChannelMerger(2);

  // Mid = (L + R) / 2, Side = (L - R) / 2
  const midGain = ctx.createGain();
  midGain.gain.value = 1;

  const sideGain = ctx.createGain();
  // width 0 = mono (side=0), width 100 = wide (side=2)
  sideGain.gain.value = (settings.width / 100) * 2;

  // Convert back: L = Mid + Side, R = Mid - Side
  const leftGain = ctx.createGain();
  leftGain.gain.value = 1;
  const rightGain = ctx.createGain();
  rightGain.gain.value = 1;

  // Mid path: split left → leftGain (for L) → merger input 0
  //           split right → leftGain (for R) → merger input 1
  // Side path: inverted for R

  // This is simplified — full M/S would need more nodes
  // For now: use a basic width approach
  const widthFactor = (settings.width / 100) * 2;
  leftGain.gain.value = Math.min(2, 1 + widthFactor * 0.5);
  rightGain.gain.value = Math.min(2, 1 + widthFactor * 0.5);

  chain.stereoWidth = { splitter, merger, leftGain, rightGain, midGain, sideGain };
  chain.nodes.push(splitter, merger, leftGain, rightGain, midGain, sideGain);
  rebuildChain(chain);
}

// ─── Internal chain wiring ──────────────────────────────────────────

function disconnectChainInterior(chain: EffectChain): void {
  // Disconnect the analyser from output
  const analyser = _analysers.get(
    [..._analysers.entries()].find(([, v]) => v === chain.nodes.find((n) => n instanceof AnalyserNode))?.[0] ?? ""
  );
  // Safer approach: disconnect everything between input and output
  chain.input.disconnect();
  chain.output.disconnect();
  for (const node of chain.nodes) {
    try {
      node.disconnect();
    } catch {
      // Node may not be connected
    }
  }
}

export function rebuildChain(chain: EffectChain): void {
  const ctx = getContext();

  // Simple approach: connect input → [all nodes] → output
  // The chain routing needs to handle dry/wet splits for reverb and delay
  // For simplicity: input → EQ → compressor → reverb dry → delay dry → output
  //                            → reverb wet → delay wet  →

  const nodesInOrder: AudioNode[] = [];

  // EQ
  if (chain.eqNodes) {
    nodesInOrder.push(
      chain.eqNodes.lowShelf,
      chain.eqNodes.lowMid,
      chain.eqNodes.highMid,
      chain.eqNodes.highShelf
    );
  }

  // Compressor
  if (chain.compressor) {
    // Find the makeup gain (node after compressor)
    const makeupIdx = chain.nodes.indexOf(chain.compressor) + 1;
    const makeupGain = chain.nodes[makeupIdx] as GainNode | undefined;
    nodesInOrder.push(chain.compressor);
    if (makeupGain) nodesInOrder.push(makeupGain);
  }

  // Now handle effects with dry/wet
  // The main dry path goes through dry gains
  // Reverb and delay are inserted as parallel paths

  // Let's use a simpler approach: chain them serially with their dry/wet handled inline
  // Input → (dryGain → ...EQ... → Comp → output)  with reverb/delay as side chains

  // For now, wire sequentially and let dry/wet be handled by the effect gains
  chain.input.disconnect();
  chain.output.disconnect();

  // Rebuild: connect input → first node, then chain through
  let prevNode: AudioNode = chain.input;

  const allNodes: AudioNode[] = [];

  // EQ
  if (chain.eqNodes) {
    for (const node of [
      chain.eqNodes.lowShelf,
      chain.eqNodes.lowMid,
      chain.eqNodes.highMid,
      chain.eqNodes.highShelf,
    ]) {
      allNodes.push(node);
    }
  }

  // Compressor + makeup
  if (chain.compressor) {
    allNodes.push(chain.compressor);
    const makeupIdx = chain.nodes.indexOf(chain.compressor) + 1;
    const makeupGain = chain.nodes[makeupIdx] as GainNode | undefined;
    if (makeupGain && makeupGain !== chain.output) {
      allNodes.push(makeupGain);
    }
  }

  // Reverb dry path
  if (chain.reverbDry) {
    allNodes.push(chain.reverbDry);
  }

  // Delay dry path
  if (chain.delayDry) {
    allNodes.push(chain.delayDry);
  }

  // Connect serial chain
  for (const node of allNodes) {
    prevNode.connect(node);
    prevNode = node;
  }

  // Stereo Width — insert after the last serial node, before output
  // Uses ChannelSplitter/Merger with explicit channel routing
  if (chain.stereoWidth) {
    const sw = chain.stereoWidth;
    // Disconnect prevNode from wherever it was just connected (output or next serial node)
    // Wire: last serial node → splitter
    prevNode.connect(sw.splitter);
    // Wire: splitter channel 0 → leftGain → merger input 0 (left channel)
    sw.splitter.connect(sw.leftGain, 0, 0);
    sw.leftGain.connect(sw.merger, 0, 0);
    // Wire: splitter channel 1 → rightGain → merger input 1 (right channel)
    sw.splitter.connect(sw.rightGain, 1, 0);
    sw.rightGain.connect(sw.merger, 0, 1);
    // Continue chain from merger
    prevNode = sw.merger;
  }

  // Connect final to output
  if (prevNode !== chain.output) {
    prevNode.connect(chain.output);
  }

  // Connect parallel effects (reverb wet, delay wet) from early in chain
  if (chain.reverb && chain.reverbWet) {
    // Reverb wet path: take signal from first node in serial chain
    const firstNode = allNodes[0] || chain.input;
    firstNode.connect(chain.reverb);
    chain.reverb.connect(chain.reverbWet);
    chain.reverbWet.connect(chain.output);
  }

  if (chain.delayNode && chain.delayWet) {
    const firstNode = allNodes[0] || chain.input;
    firstNode.connect(chain.delayNode);
    chain.delayNode.connect(chain.delayWet);
    chain.delayWet.connect(chain.output);
  }

  // Connect analyser to output so it sees the processed signal
  const analyserKey = [..._analysers.entries()].find(
    ([, v]) => v === chain.nodes.find((n) => n instanceof AnalyserNode)
  )?.[0];
  if (analyserKey) {
    const analyser = _analysers.get(analyserKey);
    if (analyser) {
      // Analyser should be fed from the output
      chain.output.connect(analyser);
    }
  }
}

// ─── Metronome ──────────────────────────────────────────────────────

let _metronomeInterval: ReturnType<typeof setInterval> | null = null;
let _metronomeOsc: OscillatorNode | null = null;
let _metronomeGain: GainNode | null = null;

/**
 * Start metronome at given BPM.
 */
export function startMetronome(bpm: number): void {
  if (!isBrowser) return;
  stopMetronome();

  const ctx = getContext();
  const intervalMs = (60 / bpm) * 1000;

  // Schedule clicks
  let nextClickTime = ctx.currentTime + 0.05;

  _metronomeInterval = setInterval(() => {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 1000;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.05);
    } catch {
      // Context may be suspended
    }
  }, intervalMs);
}

/**
 * Stop metronome.
 */
export function stopMetronome(): void {
  if (_metronomeInterval) {
    clearInterval(_metronomeInterval);
    _metronomeInterval = null;
  }
}

// ─── LUFS/RMS Metering ──────────────────────────────────────────────

/**
 * Approximate RMS level from analyser data. Returns dB.
 */
export function getRMSLevel(trackId: string): number {
  const analyser = _analysers.get(trackId);
  if (!analyser) return -60;

  const data = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(data);

  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i] * data[i];
  }
  const rms = Math.sqrt(sum / data.length);
  if (rms < 0.00001) return -60;
  return 20 * Math.log10(rms);
}

/**
 * Approximate integrated LUFS from RMS. Returns approximate LUFS value.
 */
export function getApproximateLUFS(trackId: string): number {
  const rmsDb = getRMSLevel(trackId);
  // Rough approximation: LUFS ≈ RMS - 0.5 for music material
  return rmsDb - 0.5;
}

// ─── Playback with chain ────────────────────────────────────────────

/**
 * Play an AudioBuffer through the track's effect chain.
 */
export function playThroughChain(
  trackId: string,
  buffer: AudioBuffer,
  loop = false
): PlayerHandle {
  const ctx = getContext();
  const chain = _chains.get(trackId);

  let source: AudioBufferSourceNode | null = null;
  let playing = false;

  const player: PlayerHandle = {
    get isPlaying() {
      return playing;
    },
    start(l = false, offset = 0) {
      source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = l;
      if (chain && !chain.bypassed) {
        source.connect(chain.input);
        chain.output.connect(ctx.destination);
      } else {
        source.connect(ctx.destination);
      }
      source.start(0, offset);
      playing = true;
      source.onended = () => {
        playing = false;
      };
    },
    stop() {
      if (source) {
        try { source.stop(); } catch { /* ok */ }
        source.disconnect();
        source = null;
      }
      playing = false;
    },
    connect(destination: AudioNode) {
      if (source) source.connect(destination);
    },
    disconnect() {
      if (source) source.disconnect();
    },
  };

  return player;
}

// ─── Cleanup ────────────────────────────────────────────────────────

/**
 * Dispose a single effect chain.
 */
export function disposeChain(trackId: string): void {
  const chain = _chains.get(trackId);
  if (!chain) return;

  for (const node of chain.nodes) {
    try {
      node.disconnect();
    } catch { /* ok */ }
  }

  _chains.delete(trackId);
}

/**
 * Dispose all resources — chains, analysers, buffers.
 */
export function dispose(): void {
  for (const [, chain] of _chains) {
    for (const node of chain.nodes) {
      try {
        node.disconnect();
      } catch { /* ok */ }
    }
  }
  _chains.clear();
  _analysers.clear();
  _buffers.clear();
  stopMetronome();

  if (_micStream) {
    _micStream.getTracks().forEach((t) => t.stop());
    _micStream = null;
  }
  _micSourceNode = null;

  if (_ctx && _ctx.state !== "closed") {
    _ctx.close().catch(() => {});
    _ctx = null;
  }
}

// ─── Re-export for convenience ──────────────────────────────────────

export { isBrowser as isAudioAvailable };

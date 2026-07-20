/**
 * Juice Studio Global Session Manager
 * Singleton that ties beat playback, vocal recording, and mixing into one session.
 * Enables: beat as backing track during recording, combined playback,
 * full-mix export via OfflineAudioContext, and IndexedDB persistence.
 */

import { getContext } from "./engine";
import type { DrumKit } from "./synth";
import type { BeatEngineHandle, Arrangement } from "./arranger";
import { createBeatEngine, buildArrangement } from "./arranger";
import { createRoutedDrumKit } from "./synth";
import { generatePattern } from "./patterns";
import type { PatternParams } from "./patterns";

// ─── Types ──────────────────────────────────────────────────

export interface VocalTrack {
  id: string;
  name: string;
  buffer: AudioBuffer; // The full recorded audio buffer
  waveformData: number[]; // Downsampled waveform for visualization
  volume: number; // 0-100
  pan: number; // -100 to 100
  muted: boolean;
  soloed: boolean;
  effectsChainId: string | null;
  createdAt: string;
}

export interface MixState {
  beatVolume: number; // 0-100
  masterVolume: number; // 0-100
  vocalLevels: Record<string, number>; // trackId -> volume
  vocalPans: Record<string, number>;
}

export interface MasterState {
  eqEnabled: boolean;
  compressorEnabled: boolean;
  limiterEnabled: boolean;
  eqSettings: { lowGain: number; midGain: number; highGain: number };
  compressorSettings: { threshold: number; ratio: number; attack: number; release: number; makeupGain: number };
  limiterSettings: { ceiling: number; threshold: number; release: number };
  targetLUFS: number;
}

export interface StudioSession {
  sessionId: string;
  projectName: string;
  bpm: number;
  key: string;
  genre: string;
  beatEngine: BeatEngineHandle | null;
  kit: DrumKit | null;
  arrangement: Arrangement | null;
  vocalTracks: VocalTrack[];
  mixSettings: MixState;
  masterSettings: MasterState;
  isRecording: boolean;
  isPlaying: boolean;
  durationSec: number;
  createdAt: string;
  updatedAt: string;
}

export interface SessionSnapshot {
  sessionId: string;
  projectName: string;
  bpm: number;
  key: string;
  genre: string;
  // Beat data for reconstruction
  beatParams: {
    genre: string;
    bpm: number;
    energy: number;
    structure: string[];
  } | null;
  // Vocal audio buffers serialized as ArrayBuffers
  vocalSnapshots: VocalSnapshot[];
  mixSettings: MixState;
  masterSettings: MasterState;
  durationSec: number;
  createdAt: string;
  updatedAt: string;
}

export interface VocalSnapshot {
  id: string;
  name: string;
  audioData: ArrayBuffer;
  sampleRate: number;
  numberOfChannels: number;
  length: number;
  waveformData: number[];
  volume: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
  createdAt: string;
}

// ─── Global Session Instance ────────────────────────────────

let _session: StudioSession | null = null;

// Audio graph nodes for combined playback
let _beatMonitorGain: GainNode | null = null;
let _vocalMonitorGain: GainNode | null = null;
let _masterMonitorGain: GainNode | null = null;
let _analyserNode: AnalyserNode | null = null;
let _outputInitialized = false;

// Active source nodes for playback
let _activeBeatSources: AudioBufferSourceNode[] = [];
let _activeVocalSources: AudioBufferSourceNode[] = [];

// ─── AudioBuffer serialization helpers ──────────────────────

export function audioBufferToSnapshot(buffer: AudioBuffer): {
  audioData: ArrayBuffer;
  sampleRate: number;
  numberOfChannels: number;
  length: number;
} {
  const numChannels = buffer.numberOfChannels;
  const len = buffer.length;
  const totalSamples = len * numChannels;
  const floatArray = new Float32Array(totalSamples);
  for (let ch = 0; ch < numChannels; ch++) {
    floatArray.set(buffer.getChannelData(ch), ch * len);
  }
  return {
    audioData: floatArray.buffer.slice(0),
    sampleRate: buffer.sampleRate,
    numberOfChannels: numChannels,
    length: len,
  };
}

export function snapshotToAudioBuffer(snapshot: {
  audioData: ArrayBuffer;
  sampleRate: number;
  numberOfChannels: number;
  length: number;
}): AudioBuffer {
  const ctx = getContext();
  const { numberOfChannels, length, sampleRate, audioData } = snapshot;
  const buffer = ctx.createBuffer(numberOfChannels, length, sampleRate);
  const floatData = new Float32Array(audioData);
  for (let ch = 0; ch < numberOfChannels; ch++) {
    buffer.getChannelData(ch).set(floatData.subarray(ch * length, (ch + 1) * length));
  }
  return buffer;
}

// ─── Session API ────────────────────────────────────────────

export function getSession(): StudioSession | null {
  return _session;
}

export function startSession(
  projectName: string,
  opts?: { bpm?: number; key?: string; genre?: string }
): StudioSession {
  _session = {
    sessionId: `sess-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    projectName,
    bpm: opts?.bpm ?? 140,
    key: opts?.key ?? "Dm",
    genre: opts?.genre ?? "Trap",
    beatEngine: null,
    kit: null,
    arrangement: null,
    vocalTracks: [],
    mixSettings: {
      beatVolume: 80,
      masterVolume: 85,
      vocalLevels: {},
      vocalPans: {},
    },
    masterSettings: {
      eqEnabled: false,
      compressorEnabled: false,
      limiterEnabled: true,
      eqSettings: { lowGain: 0, midGain: 0, highGain: 0 },
      compressorSettings: { threshold: -24, ratio: 4, attack: 10, release: 100, makeupGain: 0 },
      limiterSettings: { ceiling: -0.3, threshold: -3, release: 50 },
      targetLUFS: -14,
    },
    isRecording: false,
    isPlaying: false,
    durationSec: 180,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return _session;
}

export function loadBeat(
  kit: DrumKit,
  engine: BeatEngineHandle,
  arrangement: Arrangement
): void {
  if (!_session) {
    throw new Error("No active session. Call startSession() first.");
  }
  _session.kit = kit;
  _session.beatEngine = engine;
  _session.arrangement = arrangement;
  _session.bpm = arrangement.bpm;
  _session.durationSec = arrangement.totalDurationSec;
  _session.updatedAt = new Date().toISOString();
}

export function addVocalTrack(buffer: AudioBuffer, name?: string): VocalTrack {
  if (!_session) {
    throw new Error("No active session. Call startSession() first.");
  }
  const id = `voc-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  // Generate waveform data
  const channelData = buffer.getChannelData(0);
  const waveformSamples = 256;
  const step = Math.max(1, Math.floor(channelData.length / waveformSamples));
  const waveformData: number[] = [];
  for (let i = 0; i < waveformSamples; i++) {
    const start = i * step;
    let max = 0;
    for (let j = 0; j < step && start + j < channelData.length; j++) {
      const abs = Math.abs(channelData[start + j]);
      if (abs > max) max = abs;
    }
    waveformData.push(max);
  }
  const maxVal = Math.max(...waveformData, 0.01);
  const normalized = waveformData.map((v) => v / maxVal);

  const track: VocalTrack = {
    id,
    name: name ?? `Vocal ${_session.vocalTracks.length + 1}`,
    buffer,
    waveformData: normalized,
    volume: 85,
    pan: 0,
    muted: false,
    soloed: false,
    effectsChainId: null,
    createdAt: new Date().toISOString(),
  };

  _session.vocalTracks.push(track);
  _session.mixSettings.vocalLevels[id] = 85;
  _session.mixSettings.vocalPans[id] = 0;
  _session.durationSec = Math.max(_session.durationSec, buffer.duration);
  _session.updatedAt = new Date().toISOString();

  return track;
}

export function updateVocalTrack(
  id: string,
  updates: Partial<Pick<VocalTrack, "volume" | "pan" | "muted" | "soloed" | "name">>
): void {
  if (!_session) return;
  const track = _session.vocalTracks.find((t) => t.id === id);
  if (!track) return;
  Object.assign(track, updates);
  if (updates.volume !== undefined) {
    _session.mixSettings.vocalLevels[id] = updates.volume;
  }
  if (updates.pan !== undefined) {
    _session.mixSettings.vocalPans[id] = updates.pan;
  }
  _session.updatedAt = new Date().toISOString();
}

export function removeVocalTrack(id: string): void {
  if (!_session) return;
  _session.vocalTracks = _session.vocalTracks.filter((t) => t.id !== id);
  delete _session.mixSettings.vocalLevels[id];
  delete _session.mixSettings.vocalPans[id];
  _session.updatedAt = new Date().toISOString();
}

export function setBeatVolume(volume: number): void {
  if (!_session) return;
  _session.mixSettings.beatVolume = Math.max(0, Math.min(100, volume));
  if (_beatMonitorGain) {
    _beatMonitorGain.gain.value = volume / 100;
  }
}

export function setMasterVolume(volume: number): void {
  if (!_session) return;
  _session.mixSettings.masterVolume = Math.max(0, Math.min(100, volume));
  if (_masterMonitorGain) {
    _masterMonitorGain.gain.value = volume / 100;
  }
}

// ─── Audio Graph Setup ──────────────────────────────────────

function ensureOutputGraph(): void {
  if (_outputInitialized) return;
  const ctx = getContext();

  // Create monitor nodes
  _beatMonitorGain = ctx.createGain();
  _beatMonitorGain.gain.value = _session?.mixSettings.beatVolume ?? 80 / 100;

  _vocalMonitorGain = ctx.createGain();
  _vocalMonitorGain.gain.value = 0.85;

  _masterMonitorGain = ctx.createGain();
  _masterMonitorGain.gain.value = _session?.mixSettings.masterVolume ?? 85 / 100;

  _analyserNode = ctx.createAnalyser();
  _analyserNode.fftSize = 2048;
  _analyserNode.smoothingTimeConstant = 0.8;

  // Route: beatGain + vocalGain → masterGain → analyser → destination
  _beatMonitorGain.connect(_masterMonitorGain);
  _vocalMonitorGain.connect(_masterMonitorGain);
  _masterMonitorGain.connect(_analyserNode);
  _analyserNode.connect(ctx.destination);

  _outputInitialized = true;
}

/**
 * Route the beat engine's master output through the session's monitor chain.
 * Call this after loadBeat() to make the beat play through the session mixer.
 */
export function routeBeatToSession(): void {
  if (!_session?.kit) return;
  ensureOutputGraph();

  const ctx = getContext();
  const kit = _session.kit;

  // Disconnect kit output from destination and reconnect through our mixer
  try { kit.masterGain.disconnect(ctx.destination); } catch {}
  try { kit.masterGain.disconnect(_beatMonitorGain!); } catch {}
  kit.masterGain.connect(_beatMonitorGain!);
}

/**
 * Get the combined mix: creates a GainNode that merges beat + all vocal tracks.
 * For live monitoring — routes through session's monitor gains.
 */
export function getFullMixOutput(): AudioNode {
  ensureOutputGraph();
  return _masterMonitorGain!;
}

/**
 * Get the master analyser for level metering.
 */
export function getSessionAnalyser(): AnalyserNode | null {
  return _analyserNode;
}

/**
 * Get current RMS level from the session analyser.
 */
export function getSessionLevel(): number {
  if (!_analyserNode) return -60;
  const data = new Float32Array(_analyserNode.fftSize);
  _analyserNode.getFloatTimeDomainData(data);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i] * data[i];
  }
  const rms = Math.sqrt(sum / data.length);
  if (rms < 0.00001) return -60;
  return 20 * Math.log10(rms);
}

// ─── Playback ───────────────────────────────────────────────

/**
 * Start combined playback: beat engine + all vocal tracks together.
 * The beat plays through the session monitor graph.
 */
export function startFullPlayback(): void {
  if (!_session) return;
  ensureOutputGraph();

  stopFullPlayback();

  const ctx = getContext();
  const beatVol = _session.mixSettings.beatVolume / 100;

  // Set monitor gains
  _beatMonitorGain!.gain.value = beatVol;
  _masterMonitorGain!.gain.value = _session.mixSettings.masterVolume / 100;

  // Route beat to session
  routeBeatToSession();

  // Start beat engine
  if (_session.beatEngine) {
    _session.beatEngine.play();
  }

  // Play vocal tracks
  for (const track of _session.vocalTracks) {
    if (track.muted) continue;

    const source = ctx.createBufferSource();
    source.buffer = track.buffer;
    source.loop = false;

    // Individual vocal gain + pan
    const vocalGain = ctx.createGain();
    vocalGain.gain.value = (track.volume / 100) * (_session.mixSettings.vocalLevels[track.id] ?? 85) / 100;

    let lastNode: AudioNode = vocalGain;
    if (track.pan !== 0) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = track.pan / 100;
      vocalGain.connect(panner);
      lastNode = panner;
    }

    source.connect(vocalGain);
    lastNode.connect(_vocalMonitorGain!);

    source.start(0);
    _activeVocalSources.push(source);

    source.onended = () => {
      _activeVocalSources = _activeVocalSources.filter((s) => s !== source);
    };
  }

  _session.isPlaying = true;
}

export function stopFullPlayback(): void {
  // Stop vocal sources
  for (const source of _activeVocalSources) {
    try { source.stop(); } catch {}
    try { source.disconnect(); } catch {}
  }
  _activeVocalSources = [];

  for (const source of _activeBeatSources) {
    try { source.stop(); } catch {}
    try { source.disconnect(); } catch {}
  }
  _activeBeatSources = [];

  // Stop beat engine
  if (_session?.beatEngine) {
    _session.beatEngine.pause();
  }

  if (_session) {
    _session.isPlaying = false;
  }
}

// ─── Export Mix ─────────────────────────────────────────────

/**
 * Render the full mix (beat + all vocal tracks) to a stereo AudioBuffer
 * using OfflineAudioContext. This is a "bounce" — processes the entire song
 * through the session's mix settings.
 */
export async function exportMix(): Promise<AudioBuffer> {
  if (!_session) {
    throw new Error("No active session to export.");
  }

  const duration = _session.durationSec;
  const sampleRate = 44100;
  const offlineCtx = new OfflineAudioContext(2, Math.ceil(sampleRate * duration), sampleRate);

  const beatGain = offlineCtx.createGain();
  beatGain.gain.value = _session.mixSettings.beatVolume / 100;

  const vocalBus = offlineCtx.createGain();
  vocalBus.gain.value = 1;

  const masterGain = offlineCtx.createGain();
  masterGain.gain.value = _session.mixSettings.masterVolume / 100;

  beatGain.connect(masterGain);
  vocalBus.connect(masterGain);
  masterGain.connect(offlineCtx.destination);

  // For beat export, we need to generate the beat waveform offline.
  // Since the beat engine schedules dynamically, we'll create a procedural
  // beat buffer by scheduling all hits in the offline context.
  if (_session.arrangement && _session.kit) {
    await renderBeatOffline(offlineCtx, _session.arrangement, _session.kit, beatGain);
  }

  // Render vocal tracks
  for (const track of _session.vocalTracks) {
    if (track.muted) continue;
    const source = offlineCtx.createBufferSource();
    source.buffer = track.buffer;

    const vocalGain = offlineCtx.createGain();
    vocalGain.gain.value = (track.volume / 100) *
      ((_session.mixSettings.vocalLevels[track.id] ?? 85) / 100);

    let lastNode: AudioNode = vocalGain;
    if (track.pan !== 0) {
      const panner = offlineCtx.createStereoPanner();
      panner.pan.value = track.pan / 100;
      vocalGain.connect(panner);
      lastNode = panner;
    }

    source.connect(vocalGain);
    lastNode.connect(vocalBus);
    source.start(0);
  }

  const renderedBuffer = await offlineCtx.startRendering();
  return renderedBuffer;
}

/**
 * Render beat arrangement into the offline context by scheduling all drum hits.
 * This mirrors the arranger's scheduler but offline.
 */
async function renderBeatOffline(
  ctx: OfflineAudioContext,
  arrangement: Arrangement,
  kit: DrumKit,
  output: AudioNode
): Promise<void> {
  const { sections, bpm } = arrangement;
  const secPerStep = (60 / bpm) / 4;

  let currentTime = 0;

  for (const section of sections) {
    const pattern = section.pattern;
    const stepsPerSection = section.bars * 16;

    for (let step = 0; step < stepsPerSection; step++) {
      const t = currentTime + step * secPerStep;
      const s = step % 16;
      const tr = pattern.tracks;

      if (s >= tr.kick.length) continue;

      // Play each drum hit — but we need to redirect the audio to `output`
      // Since synth functions connect to ctx.destination, we use a workaround
      // by temporarily creating a sub-graph. However, the routed versions
      // accept a destination node, so we'd need to use those.
      //
      // For offline rendering, we generate a short burst buffer for each hit
      // and play it at the right time through the output.
      scheduleDrumHit(ctx, t, "kick", tr.kick[s], output, bpm);
      scheduleDrumHit(ctx, t, "snare", tr.snare[s], output, bpm);
      scheduleDrumHit(ctx, t, "hihatClosed", tr.hihatClosed[s], output, bpm);
      scheduleDrumHit(ctx, t, "hihatOpen", tr.hihatOpen[s], output, bpm);
      scheduleDrumHit(ctx, t, "clap", tr.clap[s], output, bpm);
      scheduleDrumHit(ctx, t, "rimShot", tr.rimShot[s], output, bpm);
      scheduleDrumHit(ctx, t, "conga", tr.conga[s], output, bpm);
      scheduleDrumHit(ctx, t, "shaker", tr.shaker[s], output, bpm);
    }

    currentTime += stepsPerSection * secPerStep;
  }
}

/**
 * Schedule a single drum hit as a short oscillator burst at the given time.
 * Simplified offline rendering using noise + sine generators.
 */
function scheduleDrumHit(
  ctx: OfflineAudioContext,
  time: number,
  drum: string,
  velocity: number,
  output: AudioNode,
  _bpm: number
): void {
  if (velocity <= 0) return;
  const v = velocity / 127;

  switch (drum) {
    case "kick": {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(55, time);
      osc.frequency.exponentialRampToValueAtTime(22, time + 0.15);
      gain.gain.setValueAtTime(v * 0.9, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);
      osc.connect(gain);
      gain.connect(output);
      osc.start(time);
      osc.stop(time + 0.6);
      break;
    }
    case "snare": {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(180, time);
      osc.frequency.exponentialRampToValueAtTime(100, time + 0.08);
      gain.gain.setValueAtTime(v * 0.5, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
      osc.connect(gain);
      gain.connect(output);
      osc.start(time);
      osc.stop(time + 0.2);
      break;
    }
    case "hihatClosed":
    case "hihatOpen": {
      // Use a short noise burst via a buffer
      const duration = drum === "hihatOpen" ? 0.35 : 0.07;
      const noiseLen = Math.ceil(ctx.sampleRate * duration);
      const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
      const noiseData = noiseBuf.getChannelData(0);
      for (let i = 0; i < noiseLen; i++) {
        noiseData[i] = (Math.random() * 2 - 1) * Math.exp(-i / noiseLen * 3);
      }
      const source = ctx.createBufferSource();
      source.buffer = noiseBuf;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 6000;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(v * 0.2, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
      source.connect(hp);
      hp.connect(gain);
      gain.connect(output);
      source.start(time);
      source.stop(time + duration + 0.01);
      break;
    }
    case "clap": {
      const noiseLen = Math.ceil(ctx.sampleRate * 0.06);
      const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
      const nd = noiseBuf.getChannelData(0);
      for (let i = 0; i < noiseLen; i++) nd[i] = (Math.random() * 2 - 1);
      const source = ctx.createBufferSource();
      source.buffer = noiseBuf;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 1000;
      bp.Q.value = 1.2;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(v * 0.3, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.06);
      source.connect(bp);
      bp.connect(gain);
      gain.connect(output);
      source.start(time);
      source.stop(time + 0.07);
      break;
    }
    // rimShot, conga, shaker — skip for now for simpler offline rendering
    default:
      break;
  }
}

// ─── Session Snapshot (for IndexedDB persistence) ───────────

export function createSnapshot(): SessionSnapshot | null {
  if (!_session) return null;

  const vocalSnapshots: VocalSnapshot[] = _session.vocalTracks.map((t) => {
    const snapshot = audioBufferToSnapshot(t.buffer);
    return {
      id: t.id,
      name: t.name,
      audioData: snapshot.audioData,
      sampleRate: snapshot.sampleRate,
      numberOfChannels: snapshot.numberOfChannels,
      length: snapshot.length,
      waveformData: t.waveformData,
      volume: t.volume,
      pan: t.pan,
      muted: t.muted,
      soloed: t.soloed,
      createdAt: t.createdAt,
    };
  });

  return {
    sessionId: _session.sessionId,
    projectName: _session.projectName,
    bpm: _session.bpm,
    key: _session.key,
    genre: _session.genre,
    beatParams: _session.arrangement
      ? {
          genre: _session.genre,
          bpm: _session.bpm,
          energy: 7,
          structure: _session.arrangement.sections.map((s) => s.name),
        }
      : null,
    vocalSnapshots,
    mixSettings: { ..._session.mixSettings },
    masterSettings: { ..._session.masterSettings },
    durationSec: _session.durationSec,
    createdAt: _session.createdAt,
    updatedAt: _session.updatedAt,
  };
}

export async function restoreFromSnapshot(snapshot: SessionSnapshot): Promise<StudioSession> {
  const ctx = getContext();
  const kit = createRoutedDrumKit(ctx);
  const engine = createBeatEngine(ctx, kit);

  let arrangement: Arrangement | null = null;
  if (snapshot.beatParams) {
    arrangement = buildArrangement(kit, {
      genre: snapshot.beatParams.genre,
      bpm: snapshot.beatParams.bpm,
      energy: snapshot.beatParams.energy,
      structure: snapshot.beatParams.structure,
    });
    engine.setArrangement(arrangement);
  }

  const session = startSession(snapshot.projectName, {
    bpm: snapshot.bpm,
    key: snapshot.key,
    genre: snapshot.genre,
  });

  session.sessionId = snapshot.sessionId;
  session.createdAt = snapshot.createdAt;
  session.updatedAt = snapshot.updatedAt;
  session.mixSettings = { ...snapshot.mixSettings };
  session.masterSettings = { ...snapshot.masterSettings };
  session.durationSec = snapshot.durationSec;
  session.kit = kit;
  session.beatEngine = engine;
  session.arrangement = arrangement;

  // Restore vocal tracks
  for (const vs of snapshot.vocalSnapshots) {
    const buffer = snapshotToAudioBuffer({
      audioData: vs.audioData,
      sampleRate: vs.sampleRate,
      numberOfChannels: vs.numberOfChannels,
      length: vs.length,
    });

    const track: VocalTrack = {
      id: vs.id,
      name: vs.name,
      buffer,
      waveformData: vs.waveformData,
      volume: vs.volume,
      pan: vs.pan,
      muted: vs.muted,
      soloed: vs.soloed,
      effectsChainId: null,
      createdAt: vs.createdAt,
    };

    session.vocalTracks.push(track);
    session.mixSettings.vocalLevels[vs.id] = vs.volume;
    session.mixSettings.vocalPans[vs.id] = vs.pan;
  }

  return session;
}

// ─── Cleanup ────────────────────────────────────────────────

export function disposeSession(): void {
  stopFullPlayback();
  _session?.beatEngine?.dispose();
  _session = null;

  if (_beatMonitorGain) { try { _beatMonitorGain.disconnect(); } catch {} }
  if (_vocalMonitorGain) { try { _vocalMonitorGain.disconnect(); } catch {} }
  if (_masterMonitorGain) { try { _masterMonitorGain.disconnect(); } catch {} }
  if (_analyserNode) { try { _analyserNode.disconnect(); } catch {} }

  _beatMonitorGain = null;
  _vocalMonitorGain = null;
  _masterMonitorGain = null;
  _analyserNode = null;
  _outputInitialized = false;
  _activeBeatSources = [];
  _activeVocalSources = [];
}

export function isSessionActive(): boolean {
  return _session !== null;
}

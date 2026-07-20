import { createFileRoute } from "@tanstack/react-router";
import { useReducer, useRef, useEffect, useCallback, useState, forwardRef, type Dispatch } from "react";
import {
  generateDefaultTracks,
  createEmptyTrack,
  type Track,
  type RecordingTake,
} from "../data/mock";
import {
  getContext,
  resume,
  createRecorder,
  enableMonitor,
  getAnalyser,
  getWaveformData,
  storeBuffer,
  getBuffer,
  startMetronome,
  stopMetronome,
  disposeChain,
  createEffectChain,
  type PlayerHandle,
} from "../audio/engine";
import {
  getSession,
  startSession,
  addVocalTrack,
  setBeatVolume,
  setMasterVolume,
  getFullMixOutput,
  startFullPlayback,
  stopFullPlayback,
  exportMix as exportSessionMix,
  getSessionLevel,
  disposeSession,
  loadBeat,
  isSessionActive,
  createSnapshot,
  restoreFromSnapshot,
  routeBeatToSession,
  type StudioSession,
} from "../audio/session";
import { createRoutedDrumKit, type DrumKit } from "../audio/synth";
import { createBeatEngine, buildArrangement, type BeatEngineHandle, type Arrangement } from "../audio/arranger";
import {
  saveSession as persistSession,
  getSession as loadPersistedSession,
  getAllSessions,
  saveSongMix as persistSongMix,
  type PersistedSession,
  type PersistedSongMix,
} from "../persistence";
import AudioImporter, { type ImportResult } from "../components/AudioImporter";

// ─── Types ──────────────────────────────────────────────────

type CountIn = "none" | "1bar" | "2bars" | "4bars";
type ToolMode = "select" | "trim" | "split";
type InputDevice = "Default Mic" | "Audio Interface" | "USB Mic";

interface PunchMarker {
  inSec: number | null;
  outSec: number | null;
}

interface UndoEntry {
  tracks: Track[];
}

interface State {
  tracks: Track[];
  projectName: string;
  bpm: number;
  key: string;
  isPlaying: boolean;
  isRecording: boolean;
  playheadSec: number;
  metronomeOn: boolean;
  countIn: CountIn;
  inputDevice: InputDevice;
  monitorOn: boolean;
  loopOn: boolean;
  selectedTrackId: string | null;
  activeTool: ToolMode;
  punchIn: PunchMarker;
  undoStack: UndoEntry[];
  redoStack: UndoEntry[];
  totalDuration: number;
  micPermission: "prompt" | "granted" | "denied";
  // Session integration
  sessionActive: boolean;
  beatSessionName: string | null;
  beatVolume: number;
  vocalMonitorVolume: number;
  masterOutputLevel: number;
  songSavedToast: string | null;
  isExporting: boolean;
}

type Action =
  | { type: "TOGGLE_PLAY" }
  | { type: "STOP" }
  | { type: "RECORD" }
  | { type: "STOP_RECORDING" }
  | { type: "SET_PLAYHEAD"; sec: number }
  | { type: "ADVANCE_PLAYHEAD"; deltaSec: number }
  | { type: "TOGGLE_METRONOME" }
  | { type: "SET_BPM"; bpm: number }
  | { type: "SET_COUNT_IN"; value: CountIn }
  | { type: "SET_INPUT_DEVICE"; device: InputDevice }
  | { type: "TOGGLE_MONITOR" }
  | { type: "TOGGLE_LOOP" }
  | { type: "TOGGLE_MUTE"; trackId: string }
  | { type: "TOGGLE_SOLO"; trackId: string }
  | { type: "TOGGLE_ARM"; trackId: string }
  | { type: "SET_TRACK_VOLUME"; trackId: string; volume: number }
  | { type: "SET_TRACK_PAN"; trackId: string; pan: number }
  | { type: "RENAME_TRACK"; trackId: string; name: string }
  | { type: "SELECT_TRACK"; trackId: string | null }
  | { type: "ADD_TRACK" }
  | { type: "DELETE_TRACK"; trackId: string }
  | { type: "SET_ACTIVE_TOOL"; tool: ToolMode }
  | { type: "SET_PUNCH_IN"; sec: number }
  | { type: "SET_PUNCH_OUT"; sec: number }
  | { type: "CYCLE_TAKE"; trackId: string }
  | { type: "SELECT_TAKE"; trackId: string; takeIdx: number }
  | { type: "FAVORITE_TAKE"; trackId: string; takeId: string }
  | { type: "DELETE_TAKE"; trackId: string; takeId: string }
  | { type: "APPEND_WAVEFORM"; trackId: string; samples: number[] }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "GO_TO_START" }
  | { type: "GO_TO_END" }
  | { type: "LOAD_TRACKS"; tracks: Track[] }
  | { type: "SET_MIC_PERMISSION"; status: "prompt" | "granted" | "denied" }
  // Session actions
  | { type: "SET_SESSION_ACTIVE"; active: boolean; beatName?: string }
  | { type: "SET_BEAT_VOLUME"; volume: number }
  | { type: "SET_VOCAL_MONITOR_VOLUME"; volume: number }
  | { type: "SET_MASTER_OUTPUT_LEVEL"; level: number }
  | { type: "SHOW_SONG_SAVED_TOAST"; message: string }
  | { type: "CLEAR_SONG_SAVED_TOAST" }
  | { type: "SET_EXPORTING"; exporting: boolean };

// ─── Helpers ────────────────────────────────────────────────

function buildInitialState(): State {
  const tracks = generateDefaultTracks();
  const maxDur = Math.max(...tracks.flatMap(t => t.takes.map(tk => tk.duration)), 0);
  return {
    tracks,
    projectName: "Late Nights",
    bpm: 140,
    key: "Dm",
    isPlaying: false,
    isRecording: false,
    playheadSec: 0,
    metronomeOn: false,
    countIn: "none",
    inputDevice: "Default Mic",
    monitorOn: true,
    loopOn: false,
    selectedTrackId: tracks[0]?.id ?? null,
    activeTool: "select",
    punchIn: { inSec: null, outSec: null },
    undoStack: [],
    redoStack: [],
    totalDuration: maxDur || 180,
    micPermission: "prompt",
    sessionActive: false,
    beatSessionName: null,
    beatVolume: 80,
    vocalMonitorVolume: 85,
    masterOutputLevel: -60,
    songSavedToast: null,
    isExporting: false,
  };
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 100);
  return `${m}:${String(s).padStart(2, "0")}.${String(ms).padStart(2, "0")}`;
}

function computeTotalDuration(tracks: Track[]): number {
  let max = 0;
  for (const t of tracks) {
    for (const take of t.takes) {
      if (take.duration > max) max = take.duration;
    }
  }
  return max || 180;
}

function cloneTracks(tracks: Track[]): Track[] {
  return tracks.map(t => ({ ...t, takes: t.takes.map(tk => ({ ...tk, waveformData: [...tk.waveformData] })) }));
}

// ─── Reducer ────────────────────────────────────────────────

function pushUndo(state: State): State {
  const entry: UndoEntry = { tracks: cloneTracks(state.tracks) };
  return { ...state, undoStack: [...state.undoStack.slice(-49), entry], redoStack: [] };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "TOGGLE_PLAY": {
      if (state.isRecording) return state;
      const next = pushUndo(state);
      return { ...next, isPlaying: !next.isPlaying };
    }
    case "STOP":
      return { ...state, isPlaying: false, isRecording: false, playheadSec: 0 };
    case "RECORD": {
      const armedTrack = state.tracks.find(t => t.armed);
      if (!armedTrack) return state;
      const withUndo = pushUndo(state);
      return { ...withUndo, isRecording: true, isPlaying: true };
    }
    case "STOP_RECORDING": {
      if (!state.isRecording) return state;
      const duration = state.playheadSec;
      const withUndo = pushUndo(state);
      return {
        ...withUndo,
        isRecording: false,
        isPlaying: false,
        totalDuration: computeTotalDuration(state.tracks),
      };
    }
    case "SET_PLAYHEAD":
      return { ...state, playheadSec: Math.max(0, Math.min(state.totalDuration, action.sec)) };
    case "ADVANCE_PLAYHEAD":
      return { ...state, playheadSec: Math.min(state.totalDuration, state.playheadSec + action.deltaSec) };
    case "TOGGLE_METRONOME":
      return { ...state, metronomeOn: !state.metronomeOn };
    case "SET_BPM":
      return { ...state, bpm: Math.max(40, Math.min(300, action.bpm)) };
    case "SET_COUNT_IN":
      return { ...state, countIn: action.value };
    case "SET_INPUT_DEVICE":
      return { ...state, inputDevice: action.device };
    case "TOGGLE_MONITOR":
      return { ...state, monitorOn: !state.monitorOn };
    case "TOGGLE_LOOP":
      return { ...state, loopOn: !state.loopOn };
    case "TOGGLE_MUTE": {
      const withUndo = pushUndo(state);
      return { ...withUndo, tracks: withUndo.tracks.map(t => t.id === action.trackId ? { ...t, muted: !t.muted } : t) };
    }
    case "TOGGLE_SOLO": {
      const withUndo = pushUndo(state);
      return { ...withUndo, tracks: withUndo.tracks.map(t => t.id === action.trackId ? { ...t, soloed: !t.soloed } : t) };
    }
    case "TOGGLE_ARM": {
      const withUndo = pushUndo(state);
      return {
        ...withUndo,
        tracks: withUndo.tracks.map(t =>
          t.id === action.trackId ? { ...t, armed: !t.armed } : { ...t, armed: false }
        ),
      };
    }
    case "SET_TRACK_VOLUME":
      return { ...state, tracks: state.tracks.map(t => t.id === action.trackId ? { ...t, volume: action.volume } : t) };
    case "SET_TRACK_PAN":
      return { ...state, tracks: state.tracks.map(t => t.id === action.trackId ? { ...t, pan: action.pan } : t) };
    case "RENAME_TRACK":
      return { ...state, tracks: state.tracks.map(t => t.id === action.trackId ? { ...t, name: action.name } : t) };
    case "SELECT_TRACK":
      return { ...state, selectedTrackId: action.trackId };
    case "ADD_TRACK": {
      const withUndo = pushUndo(state);
      return { ...withUndo, tracks: [...withUndo.tracks, createEmptyTrack()] };
    }
    case "DELETE_TRACK": {
      const withUndo = pushUndo(state);
      const newTracks = withUndo.tracks.filter(t => t.id !== action.trackId);
      return {
        ...withUndo,
        tracks: newTracks,
        selectedTrackId: withUndo.selectedTrackId === action.trackId ? (newTracks[0]?.id ?? null) : withUndo.selectedTrackId,
      };
    }
    case "SET_ACTIVE_TOOL":
      return { ...state, activeTool: action.tool };
    case "SET_PUNCH_IN":
      return { ...state, punchIn: { ...state.punchIn, inSec: action.sec } };
    case "SET_PUNCH_OUT":
      return { ...state, punchIn: { ...state.punchIn, outSec: action.sec } };
    case "CYCLE_TAKE": {
      const withUndo = pushUndo(state);
      return {
        ...withUndo,
        tracks: withUndo.tracks.map(t => {
          if (t.id !== action.trackId || t.takes.length <= 1) return t;
          const next = (t.activeTakeIdx + 1) % t.takes.length;
          return { ...t, activeTakeIdx: next };
        }),
      };
    }
    case "SELECT_TAKE":
      return {
        ...state,
        tracks: state.tracks.map(t => t.id === action.trackId ? { ...t, activeTakeIdx: action.takeIdx } : t),
      };
    case "FAVORITE_TAKE":
      return {
        ...state,
        tracks: state.tracks.map(t => ({
          ...t,
          takes: t.takes.map(tk => tk.id === action.takeId ? { ...tk, favorited: !tk.favorited } : tk),
        })),
      };
    case "DELETE_TAKE": {
      const withUndo = pushUndo(state);
      return {
        ...withUndo,
        tracks: withUndo.tracks.map(t => {
          if (t.id !== action.trackId) return t;
          const newTakes = t.takes.filter(tk => tk.id !== action.takeId);
          const newIdx = Math.min(t.activeTakeIdx, newTakes.length - 1);
          return { ...t, takes: newTakes, activeTakeIdx: newIdx >= 0 ? newIdx : 0 };
        }),
      };
    }
    case "APPEND_WAVEFORM": {
      return {
        ...state,
        tracks: state.tracks.map(t => {
          if (t.id !== action.trackId || !t.armed) return t;
          const take = t.takes[t.activeTakeIdx];
          if (!take) return t;
          const newWaveform = [...take.waveformData, ...action.samples];
          const newDuration = newWaveform.length / 86;
          return {
            ...t,
            takes: t.takes.map((tk, i) =>
              i === t.activeTakeIdx ? { ...tk, waveformData: newWaveform, duration: newDuration } : tk
            ),
          };
        }),
        totalDuration: Math.max(state.totalDuration, state.playheadSec + action.samples.length / 86),
      };
    }
    case "UNDO": {
      if (state.undoStack.length === 0) return state;
      const undo = state.undoStack[state.undoStack.length - 1];
      const redoEntry: UndoEntry = { tracks: cloneTracks(state.tracks) };
      return {
        ...state,
        tracks: undo.tracks,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, redoEntry],
        totalDuration: computeTotalDuration(undo.tracks),
        isPlaying: false,
      };
    }
    case "REDO": {
      if (state.redoStack.length === 0) return state;
      const redo = state.redoStack[state.redoStack.length - 1];
      const undoEntry: UndoEntry = { tracks: cloneTracks(state.tracks) };
      return {
        ...state,
        tracks: redo.tracks,
        redoStack: state.redoStack.slice(0, -1),
        undoStack: [...state.undoStack, undoEntry],
        totalDuration: computeTotalDuration(redo.tracks),
        isPlaying: false,
      };
    }
    case "GO_TO_START":
      return { ...state, playheadSec: 0 };
    case "GO_TO_END":
      return { ...state, playheadSec: state.totalDuration };
    case "LOAD_TRACKS":
      return { ...state, tracks: action.tracks, totalDuration: computeTotalDuration(action.tracks) };
    case "SET_MIC_PERMISSION":
      return { ...state, micPermission: action.status };
    case "SET_SESSION_ACTIVE":
      return { ...state, sessionActive: action.active, beatSessionName: action.beatName ?? state.beatSessionName };
    case "SET_BEAT_VOLUME":
      setBeatVolume(action.volume);
      return { ...state, beatVolume: action.volume };
    case "SET_VOCAL_MONITOR_VOLUME":
      return { ...state, vocalMonitorVolume: action.volume };
    case "SET_MASTER_OUTPUT_LEVEL":
      return { ...state, masterOutputLevel: action.level };
    case "SHOW_SONG_SAVED_TOAST":
      return { ...state, songSavedToast: action.message };
    case "CLEAR_SONG_SAVED_TOAST":
      return { ...state, songSavedToast: null };
    case "SET_EXPORTING":
      return { ...state, isExporting: action.exporting };
    default:
      return state;
  }
}

// ─── Route ──────────────────────────────────────────────────

export const Route = createFileRoute("/recording-studio")({
  component: RecordingStudio,
});

// ─── Keyboard Shortcuts ─────────────────────────────────────
// Shortcuts are handled via the keydown event listener in RecordingStudio

// ─── Main Component ─────────────────────────────────────────

function RecordingStudio() {
  const [state, dispatch] = useReducer(reducer, null, buildInitialState);
  const selectedTrack = state.tracks.find(t => t.id === state.selectedTrackId) ?? null;
  const selectedTake = selectedTrack?.takes[selectedTrack.activeTakeIdx] ?? null;

  // Audio engine refs
  const recorderRef = useRef<ReturnType<typeof createRecorder> | null>(null);
  const playerRef = useRef<PlayerHandle | null>(null);
  const ctxInitRef = useRef(false);
  const sessionRestoredRef = useRef(false);
  const isBrowser = typeof window !== "undefined";

  // Initialize audio context on first user interaction
  const initAudioContext = useCallback(() => {
    if (ctxInitRef.current) return;
    try {
      getContext();
      ctxInitRef.current = true;
    } catch {
      // Not in browser
    }
  }, []);

  // ─── Session: Listen for "beat-sent-to-session" events ───
  useEffect(() => {
    if (!isBrowser) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.beatName) {
        const session = getSession();
        if (session) {
          dispatch({ type: "SET_SESSION_ACTIVE", active: true, beatName: detail.beatName });
          // Sync BPM and key from the event to keep transport in sync
          if (detail.bpm) {
            dispatch({ type: "SET_BPM", bpm: detail.bpm });
          }
          // Wire up the session audio graph so the beat routes through the session mixer
          try {
            routeBeatToSession();
          } catch {
            // Audio context may not be ready yet; will be routed on playback
          }
        }
      }
    };
    window.addEventListener("juice:beat-sent-to-session", handler);
    return () => window.removeEventListener("juice:beat-sent-to-session", handler);
  }, [isBrowser]);

  // ─── Session: Auto-restore from IndexedDB ─────────────────
  useEffect(() => {
    if (!isBrowser || sessionRestoredRef.current) return;
    sessionRestoredRef.current = true;

    // Check if there's an active session in memory (e.g., from a previous visit or beat-studio)
    if (isSessionActive()) {
      const session = getSession();
      if (session) {
        dispatch({ type: "SET_SESSION_ACTIVE", active: true, beatName: session.projectName });
        dispatch({ type: "SET_BPM", bpm: session.bpm });
        dispatch({ type: "SET_BEAT_VOLUME", volume: session.mixSettings.beatVolume });
        // Wire up the audio graph if a beat is already loaded in the session
        if (session.kit) {
          try {
            routeBeatToSession();
          } catch {
            // Audio context may not be ready yet; routed on first playback
          }
        }
      }
    }
  }, [isBrowser]);

  // ─── Session: Master output level metering ────────────────
  useEffect(() => {
    if (!isBrowser || !state.sessionActive) return;
    if (!state.isPlaying) {
      dispatch({ type: "SET_MASTER_OUTPUT_LEVEL", level: -60 });
      return;
    }
    const interval = setInterval(() => {
      const level = getSessionLevel();
      dispatch({ type: "SET_MASTER_OUTPUT_LEVEL", level });
    }, 100);
    return () => clearInterval(interval);
  }, [isBrowser, state.sessionActive, state.isPlaying]);

  // Metronome effect
  useEffect(() => {
    if (!isBrowser) return;
    if (state.metronomeOn && state.isPlaying) {
      startMetronome(state.bpm);
    } else {
      stopMetronome();
    }
    return () => { stopMetronome(); };
  }, [state.metronomeOn, state.isPlaying, state.bpm]);

  // Monitor effect
  useEffect(() => {
    if (!isBrowser) return;
    enableMonitor(state.monitorOn);
  }, [state.monitorOn]);

  // Recording effect — uses real MediaRecorder
  useEffect(() => {
    if (!isBrowser) return;
    if (!state.isRecording) return;

    const armedTrack = state.tracks.find(t => t.armed);
    if (!armedTrack) {
      dispatch({ type: "STOP_RECORDING" });
      return;
    }

    let cancelled = false;
    const recorder = createRecorder();
    recorderRef.current = recorder;

    recorder.start().then(() => {
      if (cancelled) {
        recorder.stop();
        return;
      }
      dispatch({ type: "SET_MIC_PERMISSION", status: "granted" });
    }).catch((err: Error) => {
      if (!cancelled) {
        dispatch({ type: "SET_MIC_PERMISSION", status: "denied" });
        dispatch({ type: "STOP" });
      }
    });

    return () => {
      cancelled = true;
      if (recorder.isRecording) {
        recorder.stop().catch(() => {});
      }
    };
  }, [state.isRecording]);

  // Handle recording stop — decode and store AudioBuffer, generate waveform
  const finalizeRecording = useCallback(async (trackId: string) => {
    const recorder = recorderRef.current;
    if (!recorder || !isBrowser) return;

    try {
      const audioBuffer = await recorder.stop();
      const duration = audioBuffer.duration;

      // Generate waveform data from AudioBuffer for visualization
      const channelData = audioBuffer.getChannelData(0);
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
      const normalised = waveformData.map(v => v / maxVal);

      // Add as new take (compute ID first so we can use it as the buffer key)
      const takeId = `take-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

      // Store buffer in engine under the deterministic take-based key
      const bufferId = `rec-${trackId}-${takeId}`;
      storeBuffer(bufferId, audioBuffer);

      // If session is active, add to session vocal tracks
      if (isSessionActive()) {
        const track = state.tracks.find(t => t.id === trackId);
        addVocalTrack(audioBuffer, track?.name ?? `Vocal ${Date.now()}`);
      }

      // Add as new take
      const take: RecordingTake = {
        id: takeId,
        name: `Take ${(state.tracks.find(t => t.id === trackId)?.takes.length ?? 0) + 1}`,
        waveformData: normalised,
        duration,
        createdAt: new Date().toISOString(),
        favorited: false,
      };

      // Update tracks
      const updatedTracks = state.tracks.map(t => {
        if (t.id !== trackId) return t;
        return {
          ...t,
          takes: [...t.takes, take],
          activeTakeIdx: t.takes.length,
        };
      });

      dispatch({ type: "LOAD_TRACKS", tracks: updatedTracks });
    } catch {
      // Recording may have been cancelled
    }
  }, [state.tracks, isBrowser]);

  // ─── Playback effect (session-aware) ─────────────────────
  useEffect(() => {
    if (!isBrowser) return;

    // Stop any existing player
    if (playerRef.current) {
      playerRef.current.stop();
      playerRef.current = null;
    }

    if (!state.isPlaying || state.isRecording) return;

    // If session is active with a beat, use full session playback
    if (state.sessionActive && isSessionActive()) {
      try {
        startFullPlayback();
        playerRef.current = {
          get isPlaying() { return true; },
          start() {},
          stop() { stopFullPlayback(); },
          connect() {},
          disconnect() {},
        };
      } catch {
        // Session might not be fully ready
      }
      return;
    }

    // Standard single-track playback
    const track = state.tracks.find(t => t.id === state.selectedTrackId);
    if (!track) return;
    const take = track.takes[track.activeTakeIdx];
    if (!take) return;

    const buffer = getBuffer(`rec-${track.id}-${take.id}`);
    if (!buffer) return;

    try {
      const ctx = getContext();
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = state.loopOn;

      const volNode = ctx.createGain();
      volNode.gain.value = track.volume / 100;
      source.connect(volNode);

      if (track.pan !== 0) {
        const panner = ctx.createStereoPanner();
        panner.pan.value = track.pan / 100;
        volNode.connect(panner);
        panner.connect(ctx.destination);
      } else {
        volNode.connect(ctx.destination);
      }

      source.start(0);
      playerRef.current = {
        get isPlaying() { return true; },
        start() {},
        stop() {
          try { source.stop(); } catch {}
          source.disconnect();
          volNode.disconnect();
        },
        connect() {},
        disconnect() {},
      };

      source.onended = () => {
        if (!state.loopOn) {
          dispatch({ type: "STOP" });
        }
      };
    } catch {
      // Audio context may not be ready
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.stop();
        playerRef.current = null;
      }
    };
  }, [state.isPlaying, state.isRecording, state.selectedTrackId, state.loopOn, state.sessionActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMetronome();
      stopFullPlayback();
      if (playerRef.current) playerRef.current.stop();
      enableMonitor(false);
    };
  }, []);

  // ─── Save Song Handler ───────────────────────────────────
  const handleSaveSong = useCallback(async () => {
    if (!isBrowser || !isSessionActive()) {
      dispatch({ type: "SHOW_SONG_SAVED_TOAST", message: "No active session to save. Send a beat to the session first." });
      return;
    }

    dispatch({ type: "SET_EXPORTING", exporting: true });

    try {
      // Auto-save session snapshot to IndexedDB
      const snapshot = createSnapshot();
      if (snapshot) {
        const persisted: PersistedSession = {
          ...snapshot,
          vocalSnapshots: snapshot.vocalSnapshots.map(vs => ({ ...vs })),
        };
        await persistSession(persisted);
      }

      // Export full mix
      const mixBuffer = await exportSessionMix();
      const session = getSession();

      // Save mixed audio to IndexedDB as a song
      const mixId = `song-${Date.now()}`;
      const durationSec = mixBuffer.duration;
      const totalSamples = mixBuffer.length * mixBuffer.numberOfChannels;
      const floatArray = new Float32Array(totalSamples);
      for (let ch = 0; ch < mixBuffer.numberOfChannels; ch++) {
        floatArray.set(mixBuffer.getChannelData(ch), ch * mixBuffer.length);
      }

      const songMix: PersistedSongMix = {
        id: mixId,
        projectName: session?.projectName ?? state.projectName,
        bpm: session?.bpm ?? state.bpm,
        key: session?.key ?? state.key,
        genre: session?.genre ?? "Trap",
        durationSec,
        duration: `${Math.floor(durationSec / 60)}:${String(Math.floor(durationSec % 60)).padStart(2, "0")}`,
        trackCount: (session?.vocalTracks.length ?? 0) + 1,
        audioData: floatArray.buffer.slice(0),
        sampleRate: mixBuffer.sampleRate,
        numberOfChannels: mixBuffer.numberOfChannels,
        length: mixBuffer.length,
        coverColor: "#7c3aed",
        createdAt: new Date().toISOString(),
        sessionId: session?.sessionId ?? "",
      };

      await persistSongMix(songMix);
      dispatch({ type: "SHOW_SONG_SAVED_TOAST", message: `Song saved: ${songMix.projectName}` });
    } catch (err: any) {
      dispatch({ type: "SHOW_SONG_SAVED_TOAST", message: `Save failed: ${err.message || "Unknown error"}` });
    } finally {
      dispatch({ type: "SET_EXPORTING", exporting: false });
    }
  }, [isBrowser, state.projectName, state.bpm, state.key]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.code === "Space") { e.preventDefault(); initAudioContext(); dispatch({ type: "TOGGLE_PLAY" }); return; }
      if (e.code === "Enter" && !e.metaKey) { e.preventDefault(); initAudioContext(); dispatch({ type: "RECORD" }); return; }
      if (e.code === "Escape") { dispatch({ type: "STOP" }); return; }
      if (e.key === "m" && !e.metaKey && !e.ctrlKey) { dispatch({ type: "TOGGLE_METRONOME" }); return; }
      if (e.key === "l" && !e.metaKey && !e.ctrlKey) { dispatch({ type: "TOGGLE_LOOP" }); return; }
      if (e.code === "Home") { e.preventDefault(); dispatch({ type: "GO_TO_START" }); return; }
      if (e.code === "End") { e.preventDefault(); dispatch({ type: "GO_TO_END" }); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); dispatch({ type: "UNDO" }); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) { e.preventDefault(); dispatch({ type: "REDO" }); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === "y") { e.preventDefault(); dispatch({ type: "REDO" }); return; }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [initAudioContext]);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden" onMouseDown={initAudioContext}>
      {/* Mic permission warning */}
      {state.micPermission === "denied" && (
        <div className="bg-red-500/10 border-b border-red-500/30 px-4 py-2 text-center">
          <p className="text-xs text-red-400">
            Microphone access denied. Please allow mic access in your browser settings to record audio.
          </p>
        </div>
      )}

      {/* ─── Top Toolbar ─── */}
      <TopToolbar state={state} dispatch={dispatch} initAudio={initAudioContext} />

      {/* ─── No Session Banner ─── */}
      {!state.sessionActive && (
        <div className="flex-shrink-0 mx-4 mt-3 px-4 py-3 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-juice-800)]/80 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #7c3aed40, #6d28d940)" }}>
            <svg className="w-4 h-4 text-[var(--color-accent-light)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white">
              No beat loaded
            </p>
            <p className="text-xs text-[var(--color-juice-300)]">
              Send a beat from <span className="text-[var(--color-accent-light)] font-medium">Beat Studio</span> to use it as a backing track while recording.
            </p>
          </div>
          <a
            href="/beat-studio"
            className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors no-underline"
          >
            Open Beat Studio
          </a>
        </div>
      )}

      {/* ─── Main Content ─── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Center: Timeline */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <TimelineWorkspace state={state} dispatch={dispatch} />
        </div>

        {/* Right Panel */}
        <RightPanel
          state={state}
          dispatch={dispatch}
          selectedTrack={selectedTrack}
          selectedTake={selectedTake}
          onSaveSong={handleSaveSong}
        />
      </div>

      {/* ─── Bottom Transport Bar ─── */}
      <TransportBar state={state} dispatch={dispatch} initAudio={initAudioContext} />

      {/* ─── Song Saved Toast ─── */}
      {state.songSavedToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-medium bg-[var(--color-juice-800)] border border-[var(--color-accent)]/40 text-white shadow-2xl animate-[fadeSlideIn_0.3s_ease-out] flex items-center gap-2">
          <svg className="w-4 h-4 text-green-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 13l4 4L19 7" />
          </svg>
          {state.songSavedToast}
          <button
            onClick={() => dispatch({ type: "CLEAR_SONG_SAVED_TOAST" })}
            className="ml-2 text-[var(--color-juice-400)] hover:text-white"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Top Toolbar ────────────────────────────────────────────

function TopToolbar({ state, dispatch, initAudio }: { state: State; dispatch: Dispatch<Action>; initAudio: () => void }) {
  const [bpmEditing, setBpmEditing] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const bpmInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (bpmEditing && bpmInputRef.current) bpmInputRef.current.focus();
  }, [bpmEditing]);

  return (
    <>
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--color-glass-border)] bg-[var(--color-juice-900)]/90 backdrop-blur-xl flex-shrink-0 overflow-x-auto">
      {/* Project name */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}>
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </div>
        <div>
          <div className="text-sm font-semibold text-white leading-tight">
            Recording: {state.sessionActive && state.beatSessionName ? state.beatSessionName : state.projectName}
          </div>
          <div className="text-[11px] text-[var(--color-juice-300)]">
            {state.bpm} BPM · {state.key}
            {state.sessionActive && state.beatSessionName && (
              <span className="ml-2 text-[var(--color-accent-light)]">· Beat Synced</span>
            )}
          </div>
        </div>
      </div>

      {/* Session/Beat indicator */}
      {state.sessionActive && state.beatSessionName && (
        <>
          <div className="w-px h-8 bg-[var(--color-glass-border)] flex-shrink-0" />
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 text-[var(--color-accent-light)]">
            <span className="w-2 h-2 rounded-full bg-[var(--color-accent-light)] animate-pulse" />
            Backing Track: {state.beatSessionName}
          </div>
        </>
      )}

      <div className="w-px h-8 bg-[var(--color-glass-border)] flex-shrink-0" />

      {/* Metronome */}
      <button
        onClick={() => dispatch({ type: "TOGGLE_METRONOME" })}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0 ${
          state.metronomeOn
            ? "bg-[var(--color-accent)]/20 border border-[var(--color-accent)]/40 text-[var(--color-accent-light)]"
            : "btn-glass text-[var(--color-juice-200)]"
        }`}
      >
        <span className={`w-2 h-2 rounded-full ${state.metronomeOn ? "bg-[var(--color-accent-light)] animate-pulse" : "bg-[var(--color-juice-400)]"}`} />
        <span>Metronome</span>
        <span className={`text-[11px] ${state.metronomeOn ? "text-[var(--color-accent-light)]" : "text-[var(--color-juice-300)]"}`}>
          {state.bpm}
        </span>
      </button>

      {/* BPM editable */}
      <button
        onClick={() => setBpmEditing(!bpmEditing)}
        className="text-xs text-[var(--color-juice-200)] btn-glass px-2.5 py-1.5 rounded-lg flex-shrink-0 font-mono"
      >
        {bpmEditing ? (
          <input
            ref={bpmInputRef}
            type="number"
            value={state.bpm}
            onChange={e => dispatch({ type: "SET_BPM", bpm: parseInt(e.target.value) || 140 })}
            onBlur={() => setBpmEditing(false)}
            onKeyDown={e => { if (e.key === "Enter") setBpmEditing(false); }}
            className="w-12 bg-transparent text-center text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            min={40}
            max={300}
          />
        ) : (
          <span className="text-white">{state.bpm}</span>
        )}
        <span className="text-[var(--color-juice-300)] ml-0.5">BPM</span>
      </button>

      <div className="w-px h-8 bg-[var(--color-glass-border)] flex-shrink-0" />

      {/* Count-in */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="text-[11px] text-[var(--color-juice-300)]">Count-in:</span>
        {(["none", "1bar", "2bars", "4bars"] as CountIn[]).map(ci => (
          <button
            key={ci}
            onClick={() => dispatch({ type: "SET_COUNT_IN", value: ci })}
            className={`text-[11px] px-2 py-1 rounded-md transition-all ${
              state.countIn === ci
                ? "bg-[var(--color-accent)]/20 text-[var(--color-accent-light)] border border-[var(--color-accent)]/40"
                : "bg-transparent text-[var(--color-juice-300)] hover:text-white border border-transparent"
            }`}
          >
            {ci === "none" ? "Off" : ci === "1bar" ? "1 Bar" : ci === "2bars" ? "2 Bars" : "4 Bars"}
          </button>
        ))}
      </div>

      <div className="w-px h-8 bg-[var(--color-glass-border)] flex-shrink-0" />

      {/* Input device */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <svg className="w-3.5 h-3.5 text-[var(--color-juice-300)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
        <select
          value={state.inputDevice}
          onChange={e => dispatch({ type: "SET_INPUT_DEVICE", device: e.target.value as InputDevice })}
          className="bg-[var(--color-juice-800)] border border-[var(--color-glass-border)] rounded-lg px-2 py-1.5 text-xs text-white outline-none appearance-none cursor-pointer"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 8px center",
            paddingRight: "1.75rem",
          }}
        >
          <option>Default Mic</option>
          <option>Audio Interface</option>
          <option>USB Mic</option>
        </select>
      </div>

      {/* Monitor toggle */}
      <button
        onClick={() => dispatch({ type: "TOGGLE_MONITOR" })}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0 ${
          state.monitorOn
            ? "bg-green-500/15 border border-green-500/30 text-green-400"
            : "btn-glass text-[var(--color-juice-300)]"
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${state.monitorOn ? "bg-green-400" : "bg-[var(--color-juice-400)]"}`} />
        Monitor
      </button>

      <div className="flex-1" />

      {/* Import Audio */}
      <button
        onClick={() => setShowImport(!showImport)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0 ${
          showImport
            ? "bg-green-500/15 border border-green-500/30 text-green-400"
            : "btn-glass text-[var(--color-juice-200)]"
        }`}
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        Import Audio
      </button>

      {/* Time display */}
      <div className="flex-shrink-0 text-sm font-mono text-[var(--color-juice-100)] tabular-nums">
        {formatTime(state.playheadSec)}
      </div>

      {/* Undo/Redo */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => dispatch({ type: "UNDO" })}
          disabled={state.undoStack.length === 0}
          className="p-1.5 rounded-lg text-[var(--color-juice-300)] hover:text-white hover:bg-[var(--color-glass-bg-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          title="Undo (⌘Z)"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
        </button>
        <button
          onClick={() => dispatch({ type: "REDO" })}
          disabled={state.redoStack.length === 0}
          className="p-1.5 rounded-lg text-[var(--color-juice-300)] hover:text-white hover:bg-[var(--color-glass-bg-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          title="Redo (⌘⇧Z)"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
      </div>
    </div>
    {showImport && (
      <div className="px-4 py-3 border-b border-[var(--color-glass-border)] bg-[var(--color-juice-900)]/90">
        <AudioImporter
          category="song"
          onImported={() => setShowImport(false)}
          compact
        />
      </div>
    )}
  </>
  );
}

// ─── Timeline Workspace ─────────────────────────────────────

function TimelineWorkspace({ state, dispatch }: { state: State; dispatch: Dispatch<Action> }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rulerCanvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const playheadRef = useRef(state.playheadSec);
  const isPlayingRef = useRef(state.isPlaying);
  const isRecordingRef = useRef(state.isRecording);
  const durationRef = useRef(state.totalDuration);
  const bpmRef = useRef(state.bpm);

  playheadRef.current = state.playheadSec;
  isPlayingRef.current = state.isPlaying;
  isRecordingRef.current = state.isRecording;
  durationRef.current = state.totalDuration;
  bpmRef.current = state.bpm;

  // Recording is handled by the main RecordingStudio component via MediaRecorder.
  // The playhead advances via requestAnimationFrame for visual feedback.

  // Playhead animation
  useEffect(() => {
    if (!state.isPlaying) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }

    let lastTime = performance.now();
    const tick = (now: number) => {
      const delta = (now - lastTime) / 1000;
      lastTime = now;
      const next = playheadRef.current + delta;

      if (next >= durationRef.current) {
        if (state.loopOn) {
          dispatch({ type: "SET_PLAYHEAD", sec: 0 });
        } else {
          dispatch({ type: "STOP" });
          if (state.isRecording) dispatch({ type: "STOP_RECORDING" });
        }
        return;
      }
      dispatch({ type: "SET_PLAYHEAD", sec: next });
      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [state.isPlaying, state.loopOn, state.isRecording]);

  // Determine which tracks are audible (solo logic)
  const hasSolo = state.tracks.some(t => t.soloed);
  const audibleTracks = state.tracks.map(t => ({
    ...t,
    audible: hasSolo ? t.soloed : !t.muted,
  }));

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Tool bar */}
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-[var(--color-glass-border)] flex-shrink-0">
        <div className="flex items-center gap-1 bg-[var(--color-juice-800)] rounded-lg p-0.5">
          {([
            { id: "select" as ToolMode, label: "Select", icon: "M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" },
            { id: "trim" as ToolMode, label: "Trim", icon: "M6 2v20M18 2v20M6 12h12" },
            { id: "split" as ToolMode, label: "Split", icon: "M12 4v16M4 12h16" },
          ]).map(tool => (
            <button
              key={tool.id}
              onClick={() => dispatch({ type: "SET_ACTIVE_TOOL", tool: tool.id })}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                state.activeTool === tool.id
                  ? "bg-[var(--color-accent)] text-white"
                  : "text-[var(--color-juice-300)] hover:text-white"
              }`}
              title={`${tool.label} Tool`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={tool.icon} />
              </svg>
              {tool.label}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-[var(--color-glass-border)]" />

        {/* Punch in/out indicator */}
        {(state.punchIn.inSec !== null || state.punchIn.outSec !== null) && (
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-[var(--color-juice-300)]">Punch:</span>
            <span className="text-[var(--color-accent-light)] font-mono">
              {state.punchIn.inSec !== null ? formatTime(state.punchIn.inSec) : "Start"}
            </span>
            <span className="text-[var(--color-juice-400)]">–</span>
            <span className="text-[var(--color-accent-light)] font-mono">
              {state.punchIn.outSec !== null ? formatTime(state.punchIn.outSec) : "End"}
            </span>
            <button
              onClick={() => { dispatch({ type: "SET_PUNCH_IN", sec: 0 } as any); dispatch({ type: "SET_PUNCH_OUT", sec: 0 } as any); }}
              className="text-[var(--color-juice-400)] hover:text-white ml-1"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        )}

        <div className="flex-1" />

        {/* Add track */}
        <button
          onClick={() => dispatch({ type: "ADD_TRACK" })}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium btn-glass"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Track
        </button>
      </div>

      {/* Scrollable timeline area */}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        <div className="flex" style={{ minWidth: "100%" }}>
          {/* Track labels column */}
          <div className="flex-shrink-0 w-[200px] border-r border-[var(--color-glass-border)] bg-[var(--color-juice-900)]/80">
            {/* Ruler spacer */}
            <div className="h-8 border-b border-[var(--color-glass-border)]" />
            {/* Track headers */}
            {audibleTracks.map(track => (
              <TrackLabel
                key={track.id}
                track={track}
                isSelected={state.selectedTrackId === track.id}
                state={state}
                dispatch={dispatch}
              />
            ))}
          </div>

          {/* Waveform area */}
          <div className="flex-1 min-w-0">
            {/* Ruler */}
            <RulerCanvas
              ref={rulerCanvasRef}
              totalDuration={state.totalDuration}
              playheadSec={state.playheadSec}
              bpm={state.bpm}
              punchIn={state.punchIn}
            />
            {/* Track waveforms */}
            {audibleTracks.map(track => (
              <TrackWaveform
                key={track.id}
                track={track}
                totalDuration={state.totalDuration}
                playheadSec={state.playheadSec}
                isPlaying={state.isPlaying}
                isRecording={state.isRecording && track.armed}
                dispatch={dispatch}
                audible={track.audible}
                punchIn={state.punchIn}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Track Label ────────────────────────────────────────────

function TrackLabel({
  track,
  isSelected,
  state,
  dispatch,
}: {
  track: Track & { audible: boolean };
  isSelected: boolean;
  state: State;
  dispatch: Dispatch<Action>;
}) {
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(track.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const handleDoubleClick = () => {
    setNameDraft(track.name);
    setEditing(true);
  };

  const commitName = () => {
    setEditing(false);
    if (nameDraft.trim() && nameDraft !== track.name) {
      dispatch({ type: "RENAME_TRACK", trackId: track.id, name: nameDraft.trim() });
    }
  };

  return (
    <div
      onClick={() => dispatch({ type: "SELECT_TRACK", trackId: track.id })}
      className={`h-[72px] flex items-center gap-2 px-3 border-b border-[var(--color-glass-border)] transition-colors cursor-pointer ${
        isSelected
          ? "bg-[var(--color-glass-bg-active)]"
          : "hover:bg-[var(--color-glass-bg-hover)]"
      }`}
      style={{ borderLeft: `3px solid ${track.color}` }}
    >
      {/* Color indicator */}
      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: track.color }} />

      {/* Track info */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            value={nameDraft}
            onChange={e => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={e => { if (e.key === "Enter") commitName(); if (e.key === "Escape") setEditing(false); }}
            className="w-full bg-[var(--color-juice-700)] border border-[var(--color-accent)] rounded px-1.5 py-0.5 text-xs text-white outline-none"
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <div
            onDoubleClick={handleDoubleClick}
            className="text-xs font-medium text-white truncate leading-tight"
          >
            {track.name}
          </div>
        )}
        <div className="text-[10px] text-[var(--color-juice-300)]">
          {track.volume}% · Pan {track.pan > 0 ? `R${track.pan}` : track.pan < 0 ? `L${Math.abs(track.pan)}` : "C"}
        </div>
      </div>

      {/* Mute/Solo/Rec */}
      <div className="flex flex-col gap-0.5 flex-shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={e => { e.stopPropagation(); dispatch({ type: "TOGGLE_MUTE", trackId: track.id }); }}
            className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center transition-all ${
              track.muted ? "bg-red-500/30 text-red-400 border border-red-500/40" : "bg-[var(--color-juice-700)] text-[var(--color-juice-300)] border border-[var(--color-glass-border)] hover:text-white"
            }`}
            title="Mute (M)"
          >
            M
          </button>
          <button
            onClick={e => { e.stopPropagation(); dispatch({ type: "TOGGLE_SOLO", trackId: track.id }); }}
            className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center transition-all ${
              track.soloed ? "bg-amber-500/30 text-amber-400 border border-amber-500/40" : "bg-[var(--color-juice-700)] text-[var(--color-juice-300)] border border-[var(--color-glass-border)] hover:text-white"
            }`}
            title="Solo (S)"
          >
            S
          </button>
        </div>
        <button
          onClick={e => { e.stopPropagation(); dispatch({ type: "TOGGLE_ARM", trackId: track.id }); }}
          className={`w-[42px] h-4 rounded-full flex items-center justify-center transition-all ${
            track.armed
              ? "bg-red-500 animate-pulse"
              : "bg-[var(--color-juice-600)] hover:bg-[var(--color-juice-500)]"
          }`}
          title="Arm for recording"
        >
          <div className={`w-1.5 h-1.5 rounded-full ${track.armed ? "bg-white" : "bg-[var(--color-juice-300)]"}`} />
        </button>
      </div>
    </div>
  );
}

// ─── Ruler Canvas ───────────────────────────────────────────

const RulerCanvas = forwardRef<HTMLCanvasElement, {
  totalDuration: number;
  playheadSec: number;
  bpm: number;
  punchIn: PunchMarker;
}>(({ totalDuration, playheadSec, bpm, punchIn }, ref) => {
  const draw = useCallback((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w <= 0 || h <= 0) return;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = "#0d0d0d";
    ctx.fillRect(0, 0, w, h);

    const pixelsPerSec = w / totalDuration;
    const beatDuration = 60 / bpm;
    const pixelsPerBeat = beatDuration * pixelsPerSec;

    // Bar/beat markers
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    let t = 0;
    let barNum = 1;
    while (t <= totalDuration) {
      const x = t * pixelsPerSec;
      if (x > w) break;

      const isBar = Math.abs(t % (beatDuration * 4)) < 0.001 || t === 0;
      ctx.strokeStyle = isBar ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)";
      ctx.lineWidth = isBar ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(x, isBar ? 0 : h * 0.4);
      ctx.lineTo(x, h);
      ctx.stroke();

      if (isBar && pixelsPerBeat * 4 > 30) {
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = "10px Inter, sans-serif";
        ctx.fillText(String(barNum), x + 4, 12);
        barNum++;
      }

      t += beatDuration;
    }

    // Punch in/out markers
    if (punchIn.inSec !== null || punchIn.outSec !== null) {
      ctx.fillStyle = "#7c3aed30";
      const inX = punchIn.inSec !== null ? punchIn.inSec * pixelsPerSec : 0;
      const outX = punchIn.outSec !== null ? punchIn.outSec * pixelsPerSec : w;
      ctx.fillRect(inX, 0, outX - inX, h);

      if (punchIn.inSec !== null) {
        ctx.strokeStyle = "#7c3aed";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(inX, 0);
        ctx.lineTo(inX, h);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#7c3aed";
        ctx.font = "9px Inter, sans-serif";
        ctx.fillText("IN", inX + 3, h - 4);
      }
      if (punchIn.outSec !== null) {
        ctx.strokeStyle = "#7c3aed";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(outX, 0);
        ctx.lineTo(outX, h);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#7c3aed";
        ctx.font = "9px Inter, sans-serif";
        ctx.fillText("OUT", outX - 22, h - 4);
      }
    }

    // Playhead
    const px = playheadSec * pixelsPerSec;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, h);
    ctx.stroke();

    // Playhead triangle
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(px - 5, 0);
    ctx.lineTo(px + 5, 0);
    ctx.lineTo(px, 7);
    ctx.closePath();
    ctx.fill();
  }, [totalDuration, bpm, punchIn]);

  useEffect(() => {
    const canvas = (ref as React.RefObject<HTMLCanvasElement>).current;
    if (canvas) draw(canvas);
  }, [draw, playheadSec]);

  useEffect(() => {
    const canvas = (ref as React.RefObject<HTMLCanvasElement>).current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => draw(canvas));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw]);

  return (
    <canvas
      ref={ref}
      className="w-full h-8 block cursor-pointer"
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const sec = (x / rect.width) * totalDuration;
        // No dispatch here - we handle through parent
      }}
    />
  );
});
RulerCanvas.displayName = "RulerCanvas";

// ─── Track Waveform Canvas ──────────────────────────────────

function TrackWaveform({
  track,
  totalDuration,
  playheadSec,
  isPlaying,
  isRecording,
  dispatch,
  audible,
  punchIn,
}: {
  track: Track;
  totalDuration: number;
  playheadSec: number;
  isPlaying: boolean;
  isRecording: boolean;
  dispatch: Dispatch<Action>;
  audible: boolean;
  punchIn: PunchMarker;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const take = track.takes[track.activeTakeIdx];
  const waveformData = take?.waveformData ?? [];

  const draw = useCallback((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w <= 0 || h <= 0) return;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = audible ? "#111111" : "#0a0a0a";
    ctx.fillRect(0, 0, w, h);

    // Grid line at center
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    if (waveformData.length === 0) {
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = "11px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No audio — arm and record", w / 2, h / 2);
      ctx.textAlign = "start";
      return;
    }

    const midY = h / 2;
    const pixelsPerSample = w / waveformData.length;

    // Upper half fill
    ctx.beginPath();
    ctx.moveTo(0, midY);
    for (let i = 0; i < waveformData.length; i++) {
      const x = i * pixelsPerSample;
      const y = midY - (waveformData[i] * h * 0.42);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, midY);
    ctx.closePath();
    ctx.fillStyle = `${track.color}${audible ? "40" : "20"}`;
    ctx.fill();

    // Lower half fill
    ctx.beginPath();
    ctx.moveTo(0, midY);
    for (let i = 0; i < waveformData.length; i++) {
      const x = i * pixelsPerSample;
      const y = midY + ((1 - waveformData[i]) * h * 0.42);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, midY);
    ctx.closePath();
    ctx.fillStyle = `${track.color}${audible ? "25" : "10"}`;
    ctx.fill();

    // Center waveform line
    ctx.strokeStyle = track.color;
    ctx.globalAlpha = audible ? 0.8 : 0.3;
    ctx.lineWidth = 1;
    ctx.beginPath();
    let firstPoint = true;
    for (let i = 0; i < waveformData.length; i++) {
      const x = i * pixelsPerSample;
      const y = midY - (waveformData[i] - 0.5) * h * 0.8;
      if (firstPoint) { ctx.moveTo(x, y); firstPoint = false; }
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Recording indicator
    if (isRecording && track.armed) {
      const lastX = waveformData.length * pixelsPerSample;
      ctx.fillStyle = "rgba(239,68,68,0.15)";
      ctx.fillRect(lastX, 0, w - lastX, h);
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(lastX, 0);
      ctx.lineTo(lastX, h);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Playhead
    if (playheadSec > 0 || isPlaying) {
      const px = (playheadSec / totalDuration) * w;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
      ctx.stroke();
    }

    // Take indicator
    if (track.takes.length > 1) {
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "10px Inter, sans-serif";
      ctx.fillText(`${track.activeTakeIdx + 1}/${track.takes.length}`, w - 30, h - 6);
    }
  }, [waveformData, track.color, track.armed, track.takes.length, track.activeTakeIdx, totalDuration, playheadSec, isRecording, audible]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) draw(canvas);
  }, [draw, playheadSec]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => draw(canvas));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw]);

  // Click to seek / set punch markers
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const sec = Math.max(0, Math.min(totalDuration, (x / rect.width) * totalDuration));

    if (e.shiftKey && track.armed) {
      if (punchIn.inSec === null || (punchIn.inSec !== null && punchIn.outSec !== null)) {
        dispatch({ type: "SET_PUNCH_IN", sec });
        dispatch({ type: "SET_PUNCH_OUT", sec: 0 } as any);
      } else {
        dispatch({ type: "SET_PUNCH_OUT", sec });
      }
    } else {
      dispatch({ type: "SET_PLAYHEAD", sec });
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-[72px] block cursor-pointer"
      onClick={handleClick}
      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
    />
  );
}

// ─── Right Panel ────────────────────────────────────────────

function RightPanel({
  state,
  dispatch,
  selectedTrack,
  selectedTake,
  onSaveSong,
}: {
  state: State;
  dispatch: Dispatch<Action>;
  selectedTrack: Track | null;
  selectedTake: RecordingTake | null;
  onSaveSong?: () => void;
}) {
  if (!selectedTrack) {
    return (
      <div className="w-72 flex-shrink-0 border-l border-[var(--color-glass-border)] bg-[var(--color-juice-900)]/90 p-4 flex flex-col items-center justify-center text-center">
        <svg className="w-10 h-10 text-[var(--color-juice-400)] mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
        <p className="text-sm text-[var(--color-juice-300)]">Select a track to view takes and info</p>
      </div>
    );
  }

  return (
    <div className="w-72 flex-shrink-0 border-l border-[var(--color-glass-border)] bg-[var(--color-juice-900)]/90 flex flex-col overflow-hidden">
      {/* Track info header */}
      <div className="p-4 border-b border-[var(--color-glass-border)]">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: selectedTrack.color }} />
          <h3 className="text-sm font-semibold text-white truncate">{selectedTrack.name}</h3>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="bg-[var(--color-juice-800)] rounded-lg p-2">
            <div className="text-[var(--color-juice-300)] mb-0.5">Takes</div>
            <div className="text-white font-semibold">{selectedTrack.takes.length}</div>
          </div>
          <div className="bg-[var(--color-juice-800)] rounded-lg p-2">
            <div className="text-[var(--color-juice-300)] mb-0.5">Duration</div>
            <div className="text-white font-semibold font-mono">
              {selectedTake ? formatTime(selectedTake.duration) : "—"}
            </div>
          </div>
          <div className="bg-[var(--color-juice-800)] rounded-lg p-2">
            <div className="text-[var(--color-juice-300)] mb-0.5">Volume</div>
            <div className="text-white font-semibold">{selectedTrack.volume}%</div>
          </div>
          <div className="bg-[var(--color-juice-800)] rounded-lg p-2">
            <div className="text-[var(--color-juice-300)] mb-0.5">Pan</div>
            <div className="text-white font-semibold">
              {selectedTrack.pan > 0 ? `R${selectedTrack.pan}` : selectedTrack.pan < 0 ? `L${Math.abs(selectedTrack.pan)}` : "Center"}
            </div>
          </div>
        </div>

        {/* Volume & Pan controls */}
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--color-juice-300)] w-6">Vol</span>
            <input
              type="range"
              min={0}
              max={100}
              value={selectedTrack.volume}
              onChange={e => dispatch({ type: "SET_TRACK_VOLUME", trackId: selectedTrack.id, volume: parseInt(e.target.value) })}
              className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
              style={{
                accentColor: selectedTrack.color,
                background: `linear-gradient(90deg, ${selectedTrack.color} ${selectedTrack.volume}%, var(--color-juice-600) ${selectedTrack.volume}%)`,
              }}
            />
            <span className="text-[10px] text-white w-8 text-right font-mono">{selectedTrack.volume}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--color-juice-300)] w-6">Pan</span>
            <input
              type="range"
              min={-100}
              max={100}
              value={selectedTrack.pan}
              onChange={e => dispatch({ type: "SET_TRACK_PAN", trackId: selectedTrack.id, pan: parseInt(e.target.value) })}
              className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
              style={{
                accentColor: selectedTrack.color,
                background: `linear-gradient(90deg, ${selectedTrack.color}40, ${selectedTrack.color} ${50 + selectedTrack.pan / 2}%, ${selectedTrack.color}40)`,
              }}
            />
            <span className="text-[10px] text-white w-8 text-right font-mono">
              {selectedTrack.pan > 0 ? `R${selectedTrack.pan}` : selectedTrack.pan < 0 ? `L${Math.abs(selectedTrack.pan)}` : "C"}
            </span>
          </div>
        </div>
      </div>

      {/* Takes list */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-[var(--color-juice-200)] uppercase tracking-wider">Takes</h4>
            <span className="text-[10px] text-[var(--color-juice-300)]">{selectedTrack.takes.length}</span>
          </div>

          {selectedTrack.takes.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-xs text-[var(--color-juice-400)]">No takes yet</p>
              <p className="text-[10px] text-[var(--color-juice-500)] mt-1">Arm track and record</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {selectedTrack.takes.map((take, idx) => {
                const isActive = idx === selectedTrack.activeTakeIdx;
                return (
                  <div
                    key={take.id}
                    onClick={() => dispatch({ type: "SELECT_TAKE", trackId: selectedTrack.id, takeIdx: idx })}
                    className={`rounded-xl p-2.5 cursor-pointer transition-all ${
                      isActive
                        ? "bg-[var(--color-glass-bg-active)] border border-[var(--color-accent)]/30"
                        : "bg-[var(--color-juice-800)] border border-transparent hover:border-[var(--color-glass-border)]"
                    }`}
                  >
                    {/* Mini waveform thumbnail */}
                    <div className="h-8 rounded-lg mb-2 flex items-center overflow-hidden"
                      style={{ background: `${selectedTrack.color}10` }}>
                      {take.waveformData.filter((_, i) => i % 8 === 0).slice(0, 60).map((val, i) => (
                        <div
                          key={i}
                          className="flex-1 min-w-[1px]"
                          style={{
                            height: `${Math.max(2, Math.abs(val - 0.5) * 2 * 28)}px`,
                            background: isActive ? selectedTrack.color : `${selectedTrack.color}60`,
                            opacity: isActive ? 0.9 : 0.5,
                          }}
                        />
                      ))}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-white truncate">{take.name}</div>
                        <div className="text-[10px] text-[var(--color-juice-300)]">
                          {formatTime(take.duration)} · {new Date(take.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 flex-shrink-0 ml-2">
                        <button
                          onClick={e => { e.stopPropagation(); dispatch({ type: "FAVORITE_TAKE", trackId: selectedTrack.id, takeId: take.id }); }}
                          className="p-1 rounded hover:bg-[var(--color-glass-bg-hover)] transition-colors"
                          title={take.favorited ? "Unfavorite" : "Favorite"}
                        >
                          <svg className="w-3 h-3" viewBox="0 0 24 24"
                            fill={take.favorited ? "#f59e0b" : "none"}
                            stroke={take.favorited ? "#f59e0b" : "currentColor"}
                            strokeWidth="2"
                          >
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            if (selectedTrack.takes.length <= 1) return;
                            dispatch({ type: "DELETE_TAKE", trackId: selectedTrack.id, takeId: take.id });
                          }}
                          className="p-1 rounded hover:bg-red-500/10 transition-colors text-[var(--color-juice-400)] hover:text-red-400"
                          title="Delete take"
                        >
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── Session Mixer Section ─── */}
        {state.sessionActive && (
          <div className="p-4 border-t border-[var(--color-glass-border)] space-y-4">
            <h4 className="text-xs font-semibold text-[var(--color-accent-light)] uppercase tracking-wider flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Monitor Mixer
            </h4>

            {/* Beat volume fader */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[var(--color-juice-200)]">Beat</span>
                <span className="text-[10px] text-[var(--color-juice-300)] font-mono">{state.beatVolume}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={state.beatVolume}
                onChange={(e) => dispatch({ type: "SET_BEAT_VOLUME", volume: parseInt(e.target.value) })}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{
                  accentColor: "#7c3aed",
                  background: `linear-gradient(90deg, #7c3aed ${state.beatVolume}%, var(--color-juice-600) ${state.beatVolume}%)`,
                }}
              />
            </div>

            {/* Vocal monitor volume */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[var(--color-juice-200)]">Vocal Monitor</span>
                <span className="text-[10px] text-[var(--color-juice-300)] font-mono">{state.vocalMonitorVolume}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={state.vocalMonitorVolume}
                onChange={(e) => dispatch({ type: "SET_VOCAL_MONITOR_VOLUME", volume: parseInt(e.target.value) })}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{
                  accentColor: "#10b981",
                  background: `linear-gradient(90deg, #10b981 ${state.vocalMonitorVolume}%, var(--color-juice-600) ${state.vocalMonitorVolume}%)`,
                }}
              />
            </div>

            {/* Master output meter */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[var(--color-juice-200)]">Master Output</span>
                <span className={`text-[10px] font-mono ${state.masterOutputLevel > -3 ? "text-red-400" : state.masterOutputLevel > -12 ? "text-yellow-400" : "text-green-400"}`}>
                  {state.masterOutputLevel > -60 ? `${state.masterOutputLevel.toFixed(1)} dB` : "-∞ dB"}
                </span>
              </div>
              <div className="h-2 rounded-full bg-[var(--color-juice-700)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-75"
                  style={{
                    width: `${Math.max(0, Math.min(100, ((state.masterOutputLevel + 60) / 60) * 100))}%`,
                    background: state.masterOutputLevel > -3
                      ? "#ef4444"
                      : state.masterOutputLevel > -12
                        ? "#f59e0b"
                        : "linear-gradient(90deg, #22c55e, #7c3aed)",
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ─── Save Song Button ─── */}
        <div className="p-4 border-t border-[var(--color-glass-border)]">
          <button
            onClick={() => onSaveSong?.()}
            disabled={!state.sessionActive || state.isExporting}
            className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
              state.sessionActive
                ? state.isExporting
                  ? "bg-[var(--color-accent)]/50 text-white cursor-wait"
                  : "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] shadow-lg shadow-[var(--color-accent)]/20"
                : "bg-[var(--color-juice-700)] text-[var(--color-juice-400)] cursor-not-allowed"
            }`}
          >
            {state.isExporting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                Exporting Mix...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                Save Song
              </span>
            )}
          </button>
          {!state.sessionActive && (
            <p className="text-[10px] text-[var(--color-juice-400)] text-center mt-1.5">
              Send a beat from Beat Studio to enable saving
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Transport Bar ──────────────────────────────────────────

function TransportBar({ state, dispatch, initAudio }: { state: State; dispatch: Dispatch<Action>; initAudio: () => void }) {
  const metronomePulseRef = useRef<HTMLDivElement>(null);

  // Metronome pulse animation
  useEffect(() => {
    if (!state.metronomeOn || !state.isPlaying) return;
    const beatMs = (60 / state.bpm) * 1000;
    const interval = setInterval(() => {
      if (metronomePulseRef.current) {
        metronomePulseRef.current.classList.remove("animate-ping");
        void metronomePulseRef.current.offsetWidth;
        metronomePulseRef.current.classList.add("animate-ping");
      }
    }, beatMs);
    return () => clearInterval(interval);
  }, [state.metronomeOn, state.isPlaying, state.bpm]);

  const armedTrack = state.tracks.find(t => t.armed);

  return (
    <div className="flex items-center gap-4 px-5 py-3 border-t border-[var(--color-glass-border)] bg-[var(--color-juice-900)]/95 backdrop-blur-xl flex-shrink-0">
      {/* Left: time display */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="text-2xl font-mono font-bold text-white tabular-nums tracking-tight">
          {formatTime(state.playheadSec)}
        </div>
        {state.isRecording && (
          <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 rounded-lg px-2.5 py-1">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-semibold text-red-400">REC</span>
          </div>
        )}
      </div>

      {/* Center: Transport controls */}
      <div className="flex-1 flex items-center justify-center gap-3">
        {/* Go to Start */}
        <button
          onClick={() => dispatch({ type: "GO_TO_START" })}
          className="p-2 rounded-full btn-glass"
          title="Go to Start (Home)"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
          </svg>
        </button>

        {/* Stop */}
        <button
          onClick={() => { dispatch({ type: "STOP" }); if (state.isRecording) dispatch({ type: "STOP_RECORDING" }); }}
          className="p-2.5 rounded-full btn-glass"
          title="Stop (Esc)"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="1.5" />
          </svg>
        </button>

        {/* Play/Pause */}
        <button
          onClick={() => dispatch({ type: "TOGGLE_PLAY" })}
          className="p-3.5 rounded-full btn-primary"
          title="Play/Pause (Space)"
        >
          {state.isPlaying ? (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg className="w-5 h-5 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6 4 20 12 6 20 6 4" />
            </svg>
          )}
        </button>

        {/* Record */}
        <button
          onClick={() => {
            if (state.isRecording) {
              dispatch({ type: "STOP_RECORDING" });
            } else {
              dispatch({ type: "RECORD" });
            }
          }}
          disabled={!armedTrack && !state.isRecording}
          className={`p-3 rounded-full transition-all duration-200 ${
            state.isRecording
              ? "bg-red-500 shadow-lg shadow-red-500/40 animate-pulse"
              : armedTrack
                ? "bg-red-500/80 hover:bg-red-500 shadow-md shadow-red-500/20"
                : "bg-[var(--color-juice-600)] opacity-40 cursor-not-allowed"
          }`}
          title="Record (Enter)"
        >
          <div className={`w-4 h-4 rounded-full ${state.isRecording ? "bg-white scale-75" : "bg-white"}`} />
        </button>

        {/* Loop */}
        <button
          onClick={() => dispatch({ type: "TOGGLE_LOOP" })}
          className={`p-2 rounded-full transition-all ${
            state.loopOn
              ? "bg-[var(--color-accent)]/20 border border-[var(--color-accent)]/40 text-[var(--color-accent-light)]"
              : "btn-glass text-[var(--color-juice-300)]"
          }`}
          title="Loop (L)"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <polyline points="23 20 23 14 17 14" />
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
          </svg>
        </button>

        {/* Go to End */}
        <button
          onClick={() => dispatch({ type: "GO_TO_END" })}
          className="p-2 rounded-full btn-glass"
          title="Go to End (End)"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 18V6l8.5 6V6l8.5 6-8.5 6v-6z" />
          </svg>
        </button>
      </div>

      {/* Right: BPM + Metronome */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Metronome visual */}
        <div className="flex items-center gap-2">
          <div
            ref={metronomePulseRef}
            className={`w-3 h-3 rounded-full transition-all ${
              state.metronomeOn ? "bg-[var(--color-accent-light)]" : "bg-[var(--color-juice-500)]"
            } ${state.metronomeOn && state.isPlaying ? "animate-pulse" : ""}`}
          />
          <span className="text-sm font-mono text-[var(--color-juice-100)]">{state.bpm}</span>
          <span className="text-[11px] text-[var(--color-juice-300)]">BPM</span>
        </div>

        <div className="w-px h-6 bg-[var(--color-glass-border)]" />

        {/* Armed track indicator */}
        <div className="text-[11px]">
          {armedTrack ? (
            <span className="text-red-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              {armedTrack.name}
            </span>
          ) : (
            <span className="text-[var(--color-juice-400)]">No track armed</span>
          )}
        </div>
      </div>
    </div>
  );
}

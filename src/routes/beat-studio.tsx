import { createFileRoute } from "@tanstack/react-router";
import { useReducer, useRef, useEffect, useCallback, useState, type Dispatch } from "react";
import { favoriteBeats, generateMockSectionWaveform, generateBeat, type GeneratedBeat, type BeatSection, type BeatGenerationParams } from "../data/mock";
import { getContext, resume as resumeContext } from "../audio/engine";
import { createRoutedDrumKit, type DrumKit } from "../audio/synth";
import { generatePattern, scalePatternEnergy, stripPattern, patternDurationSec, type BeatPattern, type Genre } from "../audio/patterns";
import { createBeatEngine, buildArrangement, type BeatEngineHandle, type Arrangement, type SectionName } from "../audio/arranger";
import { startSession, loadBeat, getSession } from "../audio/session";
import AudioImporter, { type ImportResult } from "../components/AudioImporter";
import { getAllImportedAudio, deleteImportedAudio, getImportedByCategory } from "../persistence/stores/importedAudio";
import type { ImportedAudio } from "../persistence/stores/importedAudio";

// ─── Types ──────────────────────────────────────────────────

interface BeatVersion {
  id: string;
  name: string;
  beat: GeneratedBeat;
}

interface State {
  // Generator params
  prompt: string;
  genre: string;
  mood: string[];
  energy: number;
  bpm: number;
  key: string;
  length: string;
  instruments: string[];
  structure: string[];
  // UI state
  isGenerating: boolean;
  voiceListening: boolean;
  settingsOpen: boolean;
  showImport: boolean;
  // Beat collection
  beatHistory: GeneratedBeat[];
  selectedBeatId: string | null;
  versions: BeatVersion[];
  activeVersionIdx: number;
  // Imported beats
  importedBeats: ImportResult[];
  selectedImportedId: string | null;
  importedFavorites: Set<string>;
  importedBuffers: Map<string, AudioBuffer>;
  // Playback
  isPlaying: boolean;
  playheadSec: number;
  // Favorites
  favorites: Set<string>;
  // Audio mute/solo
  mutes: Record<string, boolean>;
  solos: Record<string, boolean>;
  masterVolume: number;
  audioInitialized: boolean;
}

type Action =
  | { type: "SET_PROMPT"; value: string }
  | { type: "SET_GENRE"; value: string }
  | { type: "TOGGLE_MOOD"; value: string }
  | { type: "SET_ENERGY"; value: number }
  | { type: "SET_BPM"; value: number }
  | { type: "SET_KEY"; value: string }
  | { type: "SET_LENGTH"; value: string }
  | { type: "TOGGLE_INSTRUMENT"; value: string }
  | { type: "TOGGLE_STRUCTURE"; value: string }
  | { type: "START_GENERATING" }
  | { type: "BEAT_GENERATED"; beat: GeneratedBeat }
  | { type: "SELECT_BEAT"; id: string }
  | { type: "SELECT_VERSION"; idx: number }
  | { type: "TOGGLE_FAVORITE"; id: string }
  | { type: "DELETE_BEAT"; id: string }
  | { type: "TOGGLE_PLAYING" }
  | { type: "STOP" }
  | { type: "SET_PLAYHEAD"; sec: number }
  | { type: "VOICE_LISTENING_START" }
  | { type: "VOICE_LISTENING_END"; transcription: string }
  | { type: "SET_SETTINGS_OPEN"; value: boolean }
  | { type: "REGENERATE_SECTION"; beatId: string; sectionId: string }
  | { type: "TOGGLE_MUTE"; instrument: string }
  | { type: "TOGGLE_SOLO"; instrument: string }
  | { type: "SET_MASTER_VOLUME"; value: number }
  | { type: "SET_AUDIO_INITIALIZED" }
  | { type: "TOGGLE_IMPORT" }
  | { type: "ADD_IMPORTED_BEAT"; result: ImportResult }
  | { type: "SELECT_IMPORTED"; id: string }
  | { type: "TOGGLE_IMPORTED_FAVORITE"; id: string }
  | { type: "DELETE_IMPORTED"; id: string }
  | { type: "RENAME_IMPORTED"; id: string; name: string }
  | { type: "SET_IMPORTED_BUFFER"; id: string; buffer: AudioBuffer };

const GENRES = ["Trap", "Drill", "R&B", "Pop", "Afrobeats", "Hip-Hop", "Alternative", "Lo-Fi", "Gospel", "Electronic"];
const MOODS = ["Dark", "Energetic", "Chill", "Aggressive", "Melodic", "Soulful", "Emotional", "Hype"];
const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const KEY_VARIANTS = [...KEYS, ...KEYS.map((k) => `${k}m`)];
const LENGTHS = ["2", "3", "4", "custom"];
const INSTRUMENTS = ["808", "Drums", "Hi-hats", "Piano", "Synth", "Guitar", "Bass", "Strings", "Percussion", "Brass", "Pad", "FX"];
const STRUCTURES = ["Intro", "Verse", "Hook", "Bridge", "Outro", "Drops", "Build-ups", "Fills", "Transitions"];
const PROMPT_EXAMPLES = [
  "Dark trap with heavy 808s",
  "Melodic R&B with guitar",
  "Drill beat with slides",
  "Chill lo-fi with piano",
  "Aggressive hype anthem",
  "Soulful gospel groove",
];

function createInitialBeatVersion(beat: GeneratedBeat, suffix: string): BeatVersion {
  return { id: `${beat.id}-${suffix}`, name: `${beat.name} ${suffix}`, beat };
}

function makeDefaultParams(): BeatGenerationParams {
  return {
    prompt: "",
    genre: "Trap",
    mood: ["Dark"],
    energy: 7,
    bpm: 140,
    key: "Dm",
    length: "3",
    instruments: ["808", "Drums", "Hi-hats"],
    structure: ["Intro", "Verse", "Hook", "Verse", "Hook", "Outro"],
  };
}

function buildInitialState(): State {
  const initialFavorites = new Set(favoriteBeats.map((b) => b.id));
  const history = favoriteBeats.map((b) => ({
    id: b.id,
    name: b.name,
    bpm: b.bpm,
    key: b.key,
    genre: b.genre,
    mood: [] as string[],
    duration: b.duration,
    durationSec: 210,
    color: b.color,
    favorite: b.favorite,
    createdAt: new Date().toISOString(),
    sections: [] as BeatSection[],
    waveformData: [] as number[],
    params: makeDefaultParams(),
  }));
  return {
    ...makeDefaultParams(),
    isGenerating: false,
    voiceListening: false,
    settingsOpen: false,
    showImport: false,
    beatHistory: history,
    selectedBeatId: history.length > 0 ? history[0].id : null,
    versions: [],
    activeVersionIdx: 0,
    importedBeats: [],
    selectedImportedId: null,
    importedFavorites: new Set<string>(),
    importedBuffers: new Map<string, AudioBuffer>(),
    isPlaying: false,
    playheadSec: 0,
    favorites: initialFavorites,
    mutes: {},
    solos: {},
    masterVolume: 0.8,
    audioInitialized: false,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_PROMPT":
      return { ...state, prompt: action.value };
    case "SET_GENRE":
      return { ...state, genre: action.value };
    case "TOGGLE_MOOD": {
      const mood = action.value;
      const exists = state.mood.includes(mood);
      return { ...state, mood: exists ? state.mood.filter((m) => m !== mood) : [...state.mood, mood] };
    }
    case "SET_ENERGY":
      return { ...state, energy: action.value };
    case "SET_BPM":
      return { ...state, bpm: Math.min(200, Math.max(60, action.value)) };
    case "SET_KEY":
      return { ...state, key: action.value };
    case "SET_LENGTH":
      return { ...state, length: action.value };
    case "TOGGLE_INSTRUMENT": {
      const inst = action.value;
      const exists = state.instruments.includes(inst);
      return { ...state, instruments: exists ? state.instruments.filter((i) => i !== inst) : [...state.instruments, inst] };
    }
    case "TOGGLE_STRUCTURE": {
      const s = action.value;
      const exists = state.structure.includes(s);
      return { ...state, structure: exists ? state.structure.filter((st) => st !== s) : [...state.structure, s] };
    }
    case "START_GENERATING":
      return { ...state, isGenerating: true };
    case "BEAT_GENERATED": {
      const history = [action.beat, ...state.beatHistory];
      const versions = [
        createInitialBeatVersion(action.beat, "V1"),
        createInitialBeatVersion(generateBeat({ ...action.beat.params, mood: [...action.beat.params.mood, "Dark"].slice(0, 3) } satisfies BeatGenerationParams), "V2"),
        createInitialBeatVersion(generateBeat({ ...action.beat.params, energy: Math.min(10, (action.beat.params.energy || 7) + 2) } satisfies BeatGenerationParams), "V3"),
      ];
      return {
        ...state,
        isGenerating: false,
        prompt: "",
        beatHistory: history,
        selectedBeatId: action.beat.id,
        versions,
        activeVersionIdx: 0,
        isPlaying: false,
        playheadSec: 0,
      };
    }
    case "SELECT_BEAT": {
      const beat = state.beatHistory.find((b) => b.id === action.id);
      if (!beat) return state;
      return {
        ...state,
        selectedBeatId: action.id,
        versions: [
          createInitialBeatVersion(beat, "V1"),
          createInitialBeatVersion(generateBeat({ ...beat.params, mood: [...beat.params.mood, "Hype"].slice(0, 3) } satisfies BeatGenerationParams), "V2"),
          createInitialBeatVersion(generateBeat({ ...beat.params, energy: Math.min(10, (beat.params.energy || 7) + 3) } satisfies BeatGenerationParams), "V3"),
        ],
        activeVersionIdx: 0,
        isPlaying: false,
        playheadSec: 0,
      };
    }
    case "SELECT_VERSION":
      return { ...state, activeVersionIdx: action.idx, isPlaying: false, playheadSec: 0 };
    case "TOGGLE_FAVORITE": {
      const next = new Set(state.favorites);
      if (next.has(action.id)) next.delete(action.id);
      else next.add(action.id);
      return {
        ...state,
        favorites: next,
        beatHistory: state.beatHistory.map((b) =>
          b.id === action.id ? { ...b, favorite: next.has(action.id) } : b
        ),
      };
    }
    case "DELETE_BEAT": {
      const history = state.beatHistory.filter((b) => b.id !== action.id);
      const nextFavs = new Set(state.favorites);
      nextFavs.delete(action.id);
      return {
        ...state,
        beatHistory: history,
        favorites: nextFavs,
        selectedBeatId: state.selectedBeatId === action.id ? (history.length > 0 ? history[0].id : null) : state.selectedBeatId,
      };
    }
    case "TOGGLE_PLAYING":
      return { ...state, isPlaying: !state.isPlaying };
    case "STOP":
      return { ...state, isPlaying: false, playheadSec: 0 };
    case "SET_PLAYHEAD":
      return { ...state, playheadSec: action.sec };
    case "VOICE_LISTENING_START":
      return { ...state, voiceListening: true };
    case "VOICE_LISTENING_END":
      return { ...state, voiceListening: false, prompt: state.prompt ? state.prompt + " " + action.transcription : action.transcription };
    case "SET_SETTINGS_OPEN":
      return { ...state, settingsOpen: action.value };
    case "REGENERATE_SECTION": {
      const { beatId, sectionId } = action;
      const updatedVersions = state.versions.map((v) => {
        if (v.beat.id !== beatId) return v;
        return {
          ...v,
          beat: {
            ...v.beat,
            sections: v.beat.sections.map((s) =>
              s.id === sectionId
                ? { ...s, waveformData: generateMockSectionWaveform(s.endSec - s.startSec) }
                : s
            ),
            waveformData: generateMockSectionWaveform(v.beat.durationSec),
          },
        };
      });
      return { ...state, versions: updatedVersions };
    }
    case "TOGGLE_MUTE": {
      const mutes = { ...state.mutes };
      mutes[action.instrument] = !mutes[action.instrument];
      return { ...state, mutes };
    }
    case "TOGGLE_SOLO": {
      const solos = { ...state.solos };
      solos[action.instrument] = !solos[action.instrument];
      return { ...state, solos };
    }
    case "SET_MASTER_VOLUME":
      return { ...state, masterVolume: action.value };
    case "SET_AUDIO_INITIALIZED":
      return { ...state, audioInitialized: true };
    case "TOGGLE_IMPORT":
      return { ...state, showImport: !state.showImport };
    case "ADD_IMPORTED_BEAT":
      return {
        ...state,
        importedBeats: [action.result, ...state.importedBeats],
        selectedImportedId: action.result.id,
        showImport: false,
      };
    case "SELECT_IMPORTED":
      return { ...state, selectedImportedId: action.id, selectedBeatId: null, isPlaying: false, playheadSec: 0 };
    case "TOGGLE_IMPORTED_FAVORITE": {
      const nextFavs = new Set(state.importedFavorites);
      if (nextFavs.has(action.id)) nextFavs.delete(action.id);
      else nextFavs.add(action.id);
      return { ...state, importedFavorites: nextFavs };
    }
    case "DELETE_IMPORTED": {
      const nextFavs = new Set(state.importedFavorites);
      nextFavs.delete(action.id);
      const nextBuffers = new Map(state.importedBuffers);
      nextBuffers.delete(action.id);
      return {
        ...state,
        importedBeats: state.importedBeats.filter((b) => b.id !== action.id),
        importedFavorites: nextFavs,
        importedBuffers: nextBuffers,
        selectedImportedId: state.selectedImportedId === action.id ? null : state.selectedImportedId,
      };
    }
    case "RENAME_IMPORTED":
      return {
        ...state,
        importedBeats: state.importedBeats.map((b) =>
          b.id === action.id ? { ...b, name: action.name } : b
        ),
      };
    case "SET_IMPORTED_BUFFER": {
      const next = new Map(state.importedBuffers);
      next.set(action.id, action.buffer);
      return { ...state, importedBuffers: next };
    }
    default:
      return state;
  }
}

// ─── Route ──────────────────────────────────────────────────

export const Route = createFileRoute("/beat-studio")({
  component: BeatStudio,
});

// ─── Main Component ─────────────────────────────────────────

function BeatStudio() {
  const [state, dispatch] = useReducer(reducer, null, buildInitialState);
  const currentBeat =
    state.selectedBeatId
      ? state.beatHistory.find((b) => b.id === state.selectedBeatId) ?? null
      : null;
  const activeVersion = state.versions[state.activeVersionIdx];
  const displayBeat = activeVersion?.beat ?? currentBeat;
  const selectedImported = state.importedBeats.find((b) => b.id === state.selectedImportedId) ?? null;
  const importedBuffer = selectedImported ? state.importedBuffers.get(selectedImported.id) ?? null : null;

  // Audio engine refs
  const engineRef = useRef<BeatEngineHandle | null>(null);
  const kitRef = useRef<DrumKit | null>(null);
  const arrangementRef = useRef<Arrangement | null>(null);
  const playheadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const importedSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const importedStartTimeRef = useRef<number>(0);
  const importedOffsetRef = useRef<number>(0);

  // Load imported beats from IndexedDB on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const items = await getImportedByCategory("beat");
        if (cancelled) return;
        const results: ImportResult[] = items.map((item) => ({
          id: item.id,
          name: item.name,
          fileName: item.fileName,
          format: item.format,
          duration: item.duration,
          sampleRate: item.sampleRate,
          channels: item.channels,
          bpm: item.bpm,
          key: item.key,
          genre: item.genre,
          audioData: item.audioData,
          waveformData: item.waveformData,
          fileSize: item.fileSize,
          importedAt: item.importedAt,
          category: item.category,
        }));
        for (const r of results) {
          dispatch({ type: "ADD_IMPORTED_BEAT", result: r });
          // Decode buffer
          try {
            const ctx = getContext();
            const buf = await ctx.decodeAudioData(r.audioData.slice(0));
            dispatch({ type: "SET_IMPORTED_BUFFER", id: r.id, buffer: buf });
          } catch { /* skip */ }
        }
      } catch { /* DB not ready */ }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Initialize audio on first user gesture
  const initAudio = useCallback(async () => {
    if (state.audioInitialized) return;
    try {
      const ctx = getContext();
      // Must await resume to satisfy browser autoplay policy
      await resumeContext();
      const kit = createRoutedDrumKit(ctx);
      kitRef.current = kit;
      const engine = createBeatEngine(ctx, kit);
      engineRef.current = engine;
      dispatch({ type: "SET_AUDIO_INITIALIZED" });
    } catch (e) {
      console.warn("Audio init failed:", e);
    }
  }, [state.audioInitialized]);

  // Sync transport state for playhead
  useEffect(() => {
    if (state.isPlaying && engineRef.current) {
      playheadIntervalRef.current = setInterval(() => {
        const t = engineRef.current!.getTransport();
        dispatch({ type: "SET_PLAYHEAD", sec: t.elapsedSec });
      }, 50);
    } else {
      if (playheadIntervalRef.current) {
        clearInterval(playheadIntervalRef.current);
        playheadIntervalRef.current = null;
      }
    }
    return () => {
      if (playheadIntervalRef.current) {
        clearInterval(playheadIntervalRef.current);
      }
    };
  }, [state.isPlaying]);

  // Sync mute/solo state to engine
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    for (const [ch, muted] of Object.entries(state.mutes)) {
      engine.setMute(ch, muted);
    }
    // Check for solos
    const soloEntries = Object.entries(state.solos).filter(([, v]) => v);
    if (soloEntries.length > 0) {
      engine.setSolo(soloEntries[0][0]);
    } else {
      engine.setSolo(null);
    }
  }, [state.mutes, state.solos]);

  // Sync master volume
  useEffect(() => {
    engineRef.current?.setVolume(state.masterVolume);
  }, [state.masterVolume]);

  const handleGenerate = useCallback(async () => {
    // Initialize audio on first generate
    if (!state.audioInitialized) {
      await initAudio();
    }

    dispatch({ type: "START_GENERATING" });

    const params: BeatGenerationParams = {
      prompt: state.prompt,
      genre: state.genre,
      mood: state.mood,
      energy: state.energy,
      bpm: state.bpm,
      key: state.key,
      length: state.length,
      instruments: state.instruments,
      structure: state.structure,
    };

    // Build the arrangement
    const structure = params.structure.length > 0 ? params.structure : ["Intro", "Verse", "Hook", "Verse", "Hook", "Outro"];
    const totalBars = structure.reduce((sum, name) => {
      const counts: Record<string, number> = { Intro: 4, Verse: 16, Hook: 8, Bridge: 8, Outro: 4 };
      return sum + (counts[name] || 8);
    }, 0);
    const durationSec = totalBars * 4 * (60 / params.bpm);

    // Generate mock beat data for UI (name, color, sections)
    const id = `bt-gen-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const beatNames = [
      "Dark Trap Pharaoh", "Melodic Rain", "808 Nightmare", "Purple Haze Drift",
      "Crown Heavy", "Midnight Flex 2", "Sauce Walk Reloaded", "Holy Trap Cathedral",
      "Drip Season Eternal", "Real Spill 2.0", "Flex Mode Activated", "No Ceilings",
    ];
    const beatColors = ["#7c3aed", "#8b5cf6", "#a78bfa", "#6d28d9", "#c084fc", "#5b21b6"];
    const name = beatNames[Math.floor(Math.random() * beatNames.length)];
    const color = beatColors[Math.floor(Math.random() * beatColors.length)];

    // Build real audio arrangement
    let arrangement: Arrangement | null = null;
    if (kitRef.current && engineRef.current) {
      arrangement = buildArrangement(kitRef.current, {
        genre: params.genre,
        bpm: params.bpm,
        energy: params.energy,
        structure,
      });
      arrangementRef.current = arrangement;
      engineRef.current.setArrangement(arrangement);
    }

    // Build sections for UI
    const sectionColors: Record<string, string> = {
      Intro: "#3b82f6", Verse: "#10b981", Hook: "#7c3aed",
      Bridge: "#f59e0b", Outro: "#ef4444",
    };
    const barCounts: Record<string, number> = { Intro: 4, Verse: 16, Hook: 8, Bridge: 8, Outro: 4 };
    let currentStart = 0;
    const sections: BeatSection[] = structure.map((name, i) => {
      const bars = barCounts[name] || 8;
      const secDuration = bars * 4 * (60 / params.bpm);
      const startSec = currentStart;
      const endSec = currentStart + secDuration;
      currentStart = endSec;
      return {
        id: `sec-${Date.now()}-${i}`,
        name,
        startSec,
        endSec,
        color: sectionColors[name] || "#7c3aed",
        waveformData: generateMockSectionWaveform(secDuration),
      };
    });

    const waveformData = Array.from({ length: Math.floor(durationSec * 43) }, () => Math.random() * 0.7 + 0.15);

    const beat: GeneratedBeat = {
      id,
      name,
      bpm: params.bpm || 140,
      key: params.key || "Dm",
      genre: params.genre || "Trap",
      mood: params.mood.length > 0 ? params.mood : ["Dark", "Energetic"],
      duration: `${Math.floor(durationSec / 60)}:${String(Math.floor(durationSec % 60)).padStart(2, "0")}`,
      durationSec,
      color,
      favorite: false,
      createdAt: new Date().toISOString(),
      sections,
      waveformData,
      params,
    };

    // Simulate generation delay for UX
    await new Promise((r) => setTimeout(r, 1200));
    dispatch({ type: "BEAT_GENERATED", beat });

    // Auto-play after generation
    if (engineRef.current) {
      engineRef.current.stop();
      await engineRef.current.play();
      dispatch({ type: "TOGGLE_PLAYING" });
    }
  }, [state.prompt, state.genre, state.mood, state.energy, state.bpm, state.key, state.length, state.instruments, state.structure, state.audioInitialized, initAudio]);

  const handleVoiceClick = useCallback(() => {
    dispatch({ type: "VOICE_LISTENING_START" });
    const transcriptions = [
      "Dark trap beat with heavy 808s and spooky melody",
      "Melodic R&B with smooth guitar and soft drums",
      "Hard drill beat with sliding 808s and dark piano",
      "Uplifting gospel groove with organ and choir pads",
    ];
    setTimeout(() => {
      const t = transcriptions[Math.floor(Math.random() * transcriptions.length)];
      dispatch({ type: "VOICE_LISTENING_END", transcription: t });
    }, 2500);
  }, []);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Beat Studio</h1>
          <p className="text-sm text-[var(--color-juice-200)] mt-0.5">
            Generate, customize, and perfect your beats
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-juice-300)]">
            {state.beatHistory.length} beats in library
          </span>
        </div>
      </div>

      {/* Main grid: Left | Center | Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* ─── LEFT PANEL — Beat Generator ─── */}
        <div className="lg:col-span-3 space-y-4">
          {/* Prompt input */}
          <div className="card p-4 space-y-3">
            <label className="text-xs font-semibold text-[var(--color-juice-200)] uppercase tracking-wider">
              Describe Your Beat
            </label>
            <textarea
              value={state.prompt}
              onChange={(e) => dispatch({ type: "SET_PROMPT", value: e.target.value })}
              placeholder="Describe the beat you want..."
              rows={3}
              className="w-full bg-[var(--color-juice-800)] border border-[var(--color-glass-border)] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[var(--color-juice-300)] resize-none focus:outline-none focus:border-[var(--color-accent)] transition-colors"
            />

            {/* Voice input */}
            <button
              onClick={handleVoiceClick}
              disabled={state.voiceListening}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                state.voiceListening
                  ? "bg-red-500/20 border border-red-500/40 text-red-400 animate-pulse"
                  : "btn-glass"
              }`}
            >
              {state.voiceListening ? (
                <>
                  <span className="w-5 h-5 relative">
                    <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-75" />
                    <svg className="w-5 h-5 relative" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  </span>
                  Listening...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                  Voice Input
                </>
              )}
            </button>

            {/* Prompt examples */}
            <div className="flex flex-wrap gap-1.5">
              {PROMPT_EXAMPLES.map((example) => (
                <button
                  key={example}
                  onClick={() => dispatch({ type: "SET_PROMPT", value: example })}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-[var(--color-glass-border)] text-[var(--color-juice-200)] hover:border-[var(--color-accent)] hover:text-white transition-all"
                >
                  {example}
                </button>
              ))}
            </div>

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={state.isGenerating}
              className="btn-primary w-full py-3 text-base font-semibold gap-2"
            >
              {state.isGenerating ? (
                <>
                  <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Generate Beat
                </>
              )}
            </button>
          </div>

          {/* Import Beat Section */}
          <div className="card p-4 space-y-3">
            <button
              onClick={() => dispatch({ type: "TOGGLE_IMPORT" })}
              className="flex items-center justify-between w-full text-left"
            >
              <span className="text-xs font-semibold text-[var(--color-juice-200)] uppercase tracking-wider">
                Import Beat
              </span>
              <svg
                className={`w-4 h-4 text-[var(--color-juice-300)] transition-transform duration-200 ${state.showImport ? "rotate-180" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {state.showImport && (
              <AudioImporter
                category="beat"
                defaultBpm={state.bpm}
                defaultKey={state.key}
                defaultGenre={state.genre}
                compact
                onImported={(result) => {
                  dispatch({ type: "ADD_IMPORTED_BEAT", result });
                  // Decode and cache audio buffer for playback
                  try {
                    const ctx = getContext();
                    ctx.decodeAudioData(result.audioData.slice(0)).then((buf) => {
                      dispatch({ type: "SET_IMPORTED_BUFFER", id: result.id, buffer: buf });
                    });
                  } catch { /* will play when context is ready */ }
                }}
              />
            )}
          </div>

          {/* Settings panel */}
          <div className="card p-4 space-y-3">
            <button
              onClick={() => dispatch({ type: "SET_SETTINGS_OPEN", value: !state.settingsOpen })}
              className="flex items-center justify-between w-full text-left"
            >
              <span className="text-xs font-semibold text-[var(--color-juice-200)] uppercase tracking-wider">
                Settings
              </span>
              <svg
                className={`w-4 h-4 text-[var(--color-juice-300)] transition-transform duration-200 ${state.settingsOpen ? "rotate-180" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {state.settingsOpen && (
              <SettingsPanel state={state} dispatch={dispatch} />
            )}
          </div>
        </div>

        {/* ─── CENTER — Waveform Display ─── */}
        <div className="lg:col-span-6 space-y-4">
          {selectedImported ? (
            <>
              {/* Imported Beat Info */}
              <div className="card p-5">
                <div className="flex items-center gap-4 mb-4">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #22c55e, #22c55e44)" }}
                  >
                    <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-semibold text-white truncate">{selectedImported.name}</h2>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium flex-shrink-0">Imported</span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--color-juice-300)] mt-0.5">
                      <span>{selectedImported.bpm} BPM</span>
                      <span>·</span>
                      <span>{selectedImported.key}</span>
                      <span>·</span>
                      <span>{selectedImported.genre}</span>
                      <span>·</span>
                      <span>{selectedImported.duration.toFixed(1)}s</span>
                      <span>·</span>
                      <span>{selectedImported.format.toUpperCase()}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => dispatch({ type: "TOGGLE_IMPORTED_FAVORITE", id: selectedImported.id })}
                    className="p-2 rounded-xl hover:bg-[var(--color-glass-bg-hover)] transition-colors"
                  >
                    <svg
                      className="w-5 h-5"
                      viewBox="0 0 24 24"
                      fill={state.importedFavorites.has(selectedImported.id) ? "#f59e0b" : "none"}
                      stroke={state.importedFavorites.has(selectedImported.id) ? "#f59e0b" : "currentColor"}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </button>
                </div>

                {/* Waveform of actual imported audio */}
                <div className="bg-[#111111] rounded-xl p-3">
                  <ImportedWaveformDisplay
                    waveformData={selectedImported.waveformData}
                    duration={selectedImported.duration}
                    isPlaying={state.isPlaying}
                    playheadSec={state.playheadSec}
                    color="#22c55e"
                  />
                </div>
                <p className="text-[10px] text-[var(--color-juice-400)] text-center mt-1 italic">
                  Real audio file · {selectedImported.sampleRate / 1000}kHz · {selectedImported.channels}ch · {(selectedImported.fileSize / (1024 * 1024)).toFixed(1)}MB
                </p>

                {/* Transport Controls for imported beat */}
                <ImportedTransportControls
                  isPlaying={state.isPlaying}
                  dispatch={dispatch}
                  beatDuration={selectedImported.duration}
                  importedSourceRef={importedSourceRef}
                  importedStartTimeRef={importedStartTimeRef}
                  importedOffsetRef={importedOffsetRef}
                  importedBuffer={importedBuffer}
                  initAudio={initAudio}
                />

                {/* Send to Session */}
                <div className="mt-4 pt-4 border-t border-[var(--color-glass-border)]">
                  <button
                    onClick={() => {
                      if (importedBuffer) {
                        let session = getSession();
                        if (!session) {
                          session = startSession(selectedImported.name, {
                            bpm: selectedImported.bpm,
                            key: selectedImported.key,
                            genre: selectedImported.genre,
                          });
                        }
                        // Store the imported buffer for session use
                        (window as any).__juiceImportedBeatBuffer = importedBuffer;
                        window.dispatchEvent(new CustomEvent("juice:beat-sent-to-session", {
                          detail: { beatName: selectedImported.name, bpm: selectedImported.bpm, key: selectedImported.key, imported: true },
                        }));

                        const btn = document.activeElement as HTMLButtonElement;
                        if (btn) {
                          const orig = btn.textContent;
                          btn.textContent = "✓ Sent to Session!";
                          btn.classList.add("bg-green-500/20", "border-green-500/40", "text-green-400");
                          setTimeout(() => {
                            btn.textContent = orig;
                            btn.classList.remove("bg-green-500/20", "border-green-500/40", "text-green-400");
                          }, 2000);
                        }
                      }
                    }}
                    className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 btn-glass hover:border-green-500/40 hover:text-green-400"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                    Send to Session
                  </button>
                </div>
              </div>
            </>
          ) : displayBeat ? (
            <>
              {/* Beat info */}
              <div className="card p-5">
                <div className="flex items-center gap-4 mb-4">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${displayBeat.color}, ${displayBeat.color}44)`,
                    }}
                  >
                    <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18V5l12-2v13" />
                      <circle cx="6" cy="18" r="3" />
                      <circle cx="18" cy="16" r="3" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-semibold text-white truncate">{displayBeat.name}</h2>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--color-juice-300)] mt-0.5">
                      <span>{displayBeat.bpm} BPM</span>
                      <span>·</span>
                      <span>{displayBeat.key}</span>
                      <span>·</span>
                      <span>{displayBeat.genre}</span>
                      <span>·</span>
                      <span>{displayBeat.duration}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => dispatch({ type: "TOGGLE_FAVORITE", id: displayBeat.id })}
                    className="p-2 rounded-xl hover:bg-[var(--color-glass-bg-hover)] transition-colors"
                  >
                    <svg
                      className="w-5 h-5"
                      viewBox="0 0 24 24"
                      fill={state.favorites.has(displayBeat.id) ? "#f59e0b" : "none"}
                      stroke={state.favorites.has(displayBeat.id) ? "#f59e0b" : "currentColor"}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </button>
                </div>

                {/* Mood chips */}
                {displayBeat.mood.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {displayBeat.mood.map((m) => (
                      <span
                        key={m}
                        className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                        style={{
                          background: `${displayBeat.color}20`,
                          color: displayBeat.color,
                        }}
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                )}

                {/* Waveform */}
                <WaveformDisplay
                  beat={displayBeat}
                  isPlaying={state.isPlaying}
                  playheadSec={state.playheadSec}
                  dispatch={dispatch}
                />
                <p className="text-[10px] text-[var(--color-juice-400)] text-center mt-1 italic">
                  Real-time synthesized beat — Web Audio API drum machine
                </p>

                {/* Transport controls */}
                <TransportControls
                  isPlaying={state.isPlaying}
                  dispatch={dispatch}
                  beatDuration={displayBeat.durationSec}
                  engineRef={engineRef}
                  initAudio={initAudio}
                  audioReady={state.audioInitialized}
                />

                {/* Master Volume & Mute/Solo */}
                <InstrumentMixer
                  mutes={state.mutes}
                  solos={state.solos}
                  masterVolume={state.masterVolume}
                  dispatch={dispatch}
                />

                {/* Send to Session */}
                {state.audioInitialized && displayBeat && (
                  <div className="mt-4 pt-4 border-t border-[var(--color-glass-border)]">
                    <button
                      onClick={() => {
                        const kit = kitRef.current;
                        const engine = engineRef.current;
                        const arrangement = arrangementRef.current;
                        if (!kit || !engine || !arrangement) return;

                        // Start or reuse a session
                        let session = getSession();
                        if (!session) {
                          session = startSession(displayBeat.name, {
                            bpm: displayBeat.bpm,
                            key: displayBeat.key,
                            genre: displayBeat.genre,
                          });
                        }
                        loadBeat(kit, engine, arrangement);

                        // Notify the recording studio
                        window.dispatchEvent(new CustomEvent("juice:beat-sent-to-session", {
                          detail: { beatName: displayBeat.name, bpm: displayBeat.bpm, key: displayBeat.key },
                        }));

                        // Visual feedback
                        const btn = document.activeElement as HTMLButtonElement;
                        if (btn) {
                          const orig = btn.textContent;
                          btn.textContent = "✓ Sent to Session!";
                          btn.classList.add("bg-green-500/20", "border-green-500/40", "text-green-400");
                          setTimeout(() => {
                            btn.textContent = orig;
                            btn.classList.remove("bg-green-500/20", "border-green-500/40", "text-green-400");
                          }, 2000);
                        }
                      }}
                      className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 btn-glass hover:border-[var(--color-accent)]/40 hover:text-[var(--color-accent-light)]"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                      Send to Session
                    </button>
                    <p className="text-[10px] text-[var(--color-juice-400)] text-center mt-1.5">
                      Use this beat as backing track in Recording Studio
                    </p>
                  </div>
                )}
              </div>

              {/* Section markers legend */}
              {displayBeat.sections.length > 0 && (
                <div className="card p-4">
                  <h3 className="text-xs font-semibold text-[var(--color-juice-200)] uppercase tracking-wider mb-3">
                    Sections
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {displayBeat.sections.map((section) => (
                      <span
                        key={section.id}
                        className="text-xs px-3 py-1.5 rounded-full font-medium"
                        style={{
                          background: `${section.color}20`,
                          color: section.color,
                          border: `1px solid ${section.color}40`,
                        }}
                      >
                        {section.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="card p-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: "linear-gradient(135deg, #7c3aed30, #7c3aed10)" }}>
                <svg className="w-8 h-8 text-[var(--color-accent-light)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">No Beat Selected</h3>
              <p className="text-sm text-[var(--color-juice-300)] max-w-xs">
                Describe a beat on the left and hit Generate to create your first beat, or select one from your library.
              </p>
            </div>
          )}
        </div>

        {/* ─── RIGHT PANEL — Beat Library ─── */}
        <div className="lg:col-span-3 space-y-4">
          {/* Version tabs */}
          {state.versions.length > 0 && (
            <div className="card p-4 space-y-3">
              <h3 className="text-xs font-semibold text-[var(--color-juice-200)] uppercase tracking-wider">
                Versions
              </h3>
              <div className="flex gap-1.5">
                {state.versions.map((v, i) => (
                  <button
                    key={v.id}
                    onClick={() => dispatch({ type: "SELECT_VERSION", idx: i })}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                      state.activeVersionIdx === i
                        ? "bg-[var(--color-accent)] text-white"
                        : "bg-[var(--color-juice-700)] text-[var(--color-juice-200)] hover:bg-[var(--color-juice-600)]"
                    }`}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Beat history */}
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-[var(--color-juice-200)] uppercase tracking-wider">
                Beat Library
              </h3>
              <span className="text-[11px] text-[var(--color-juice-300)]">
                {state.beatHistory.length} beats
              </span>
            </div>
            <div className="space-y-1.5 max-h-[440px] overflow-y-auto pr-1">
              {state.beatHistory.map((beat) => (
                <BeatLibraryItem
                  key={beat.id}
                  beat={beat}
                  isSelected={state.selectedBeatId === beat.id}
                  isFavorite={state.favorites.has(beat.id)}
                  dispatch={dispatch}
                />
              ))}
            </div>
          </div>

          {/* Imported Beats */}
          {state.importedBeats.length > 0 && (
            <div className="card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[var(--color-juice-200)] uppercase tracking-wider">
                  Imported Beats
                </h3>
                <span className="text-[11px] text-[var(--color-juice-300)]">
                  {state.importedBeats.length} beats
                </span>
              </div>
              <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                {state.importedBeats.map((beat) => (
                  <ImportedBeatItem
                    key={beat.id}
                    beat={beat}
                    isSelected={state.selectedImportedId === beat.id}
                    isFavorite={state.importedFavorites.has(beat.id)}
                    hasBuffer={state.importedBuffers.has(beat.id)}
                    dispatch={dispatch}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── BOTTOM — Section Regenerator ─── */}
      {displayBeat && displayBeat.sections.length > 0 && (
        <div className="card p-5">
          <h3 className="text-xs font-semibold text-[var(--color-juice-200)] uppercase tracking-wider mb-4">
            Section Regenerator
          </h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {displayBeat.sections.map((section) => (
              <SectionCard
                key={section.id}
                section={section}
                beatId={displayBeat.id}
                dispatch={dispatch}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Settings Panel ─────────────────────────────────────────

function SettingsPanel({ state, dispatch }: { state: State; dispatch: Dispatch<Action> }) {
  return (
    <div className="space-y-4 animate-[fadeSlideIn_0.2s_ease-out]">
      {/* Genre */}
      <div>
        <label className="text-[11px] font-medium text-[var(--color-juice-300)] block mb-1.5">Genre</label>
        <select
          value={state.genre}
          onChange={(e) => dispatch({ type: "SET_GENRE", value: e.target.value })}
          className="w-full bg-[var(--color-juice-800)] border border-[var(--color-glass-border)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--color-accent)] transition-colors appearance-none cursor-pointer"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 12px center",
            paddingRight: "2rem",
          }}
        >
          {GENRES.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>

      {/* Mood */}
      <div>
        <label className="text-[11px] font-medium text-[var(--color-juice-300)] block mb-1.5">Mood</label>
        <div className="flex flex-wrap gap-1.5">
          {MOODS.map((mood) => {
            const active = state.mood.includes(mood);
            return (
              <button
                key={mood}
                onClick={() => dispatch({ type: "TOGGLE_MOOD", value: mood })}
                className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-all ${
                  active
                    ? "bg-[var(--color-accent)] text-white border border-transparent"
                    : "bg-[var(--color-juice-700)] text-[var(--color-juice-200)] border border-[var(--color-glass-border)] hover:border-[var(--color-glass-border-hover)]"
                }`}
              >
                {mood}
              </button>
            );
          })}
        </div>
      </div>

      {/* Energy */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[11px] font-medium text-[var(--color-juice-300)]">Energy</label>
          <span className="text-[11px] font-semibold text-[var(--color-accent-light)]">{state.energy}/10</span>
        </div>
        <input
          type="range"
          min={1}
          max={10}
          value={state.energy}
          onChange={(e) => dispatch({ type: "SET_ENERGY", value: parseInt(e.target.value) })}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
          style={{
            accentColor: "var(--color-accent)",
            background: `linear-gradient(90deg, var(--color-accent) ${(state.energy / 10) * 100}%, var(--color-juice-600) ${(state.energy / 10) * 100}%)`,
          }}
        />
      </div>

      {/* BPM */}
      <div>
        <label className="text-[11px] font-medium text-[var(--color-juice-300)] block mb-1.5">Tempo (BPM)</label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => dispatch({ type: "SET_BPM", value: state.bpm - 1 })}
            className="w-8 h-8 rounded-lg bg-[var(--color-juice-700)] border border-[var(--color-glass-border)] flex items-center justify-center text-white hover:bg-[var(--color-juice-600)] transition-colors text-sm"
          >
            −
          </button>
          <input
            type="number"
            min={60}
            max={200}
            value={state.bpm}
            onChange={(e) => dispatch({ type: "SET_BPM", value: parseInt(e.target.value) || 140 })}
            className="flex-1 bg-[var(--color-juice-800)] border border-[var(--color-glass-border)] rounded-lg px-3 py-2 text-sm text-white text-center focus:outline-none focus:border-[var(--color-accent)] transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <button
            onClick={() => dispatch({ type: "SET_BPM", value: state.bpm + 1 })}
            className="w-8 h-8 rounded-lg bg-[var(--color-juice-700)] border border-[var(--color-glass-border)] flex items-center justify-center text-white hover:bg-[var(--color-juice-600)] transition-colors text-sm"
          >
            +
          </button>
        </div>
      </div>

      {/* Key */}
      <div>
        <label className="text-[11px] font-medium text-[var(--color-juice-300)] block mb-1.5">Musical Key</label>
        <select
          value={state.key}
          onChange={(e) => dispatch({ type: "SET_KEY", value: e.target.value })}
          className="w-full bg-[var(--color-juice-800)] border border-[var(--color-glass-border)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--color-accent)] transition-colors appearance-none cursor-pointer"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 12px center",
            paddingRight: "2rem",
          }}
        >
          {KEY_VARIANTS.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
      </div>

      {/* Song Length */}
      <div>
        <label className="text-[11px] font-medium text-[var(--color-juice-300)] block mb-1.5">Song Length</label>
        <div className="flex gap-1.5">
          {LENGTHS.map((l) => {
            const active = state.length === l;
            return (
              <button
                key={l}
                onClick={() => dispatch({ type: "SET_LENGTH", value: l })}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                  active
                    ? "bg-[var(--color-accent)] text-white"
                    : "bg-[var(--color-juice-700)] text-[var(--color-juice-200)] hover:bg-[var(--color-juice-600)]"
                }`}
              >
                {l === "custom" ? "Custom" : `${l} min`}
              </button>
            );
          })}
        </div>
      </div>

      {/* Instruments */}
      <div>
        <label className="text-[11px] font-medium text-[var(--color-juice-300)] block mb-1.5">Instruments</label>
        <div className="flex flex-wrap gap-1.5">
          {INSTRUMENTS.map((inst) => {
            const active = state.instruments.includes(inst);
            return (
              <button
                key={inst}
                onClick={() => dispatch({ type: "TOGGLE_INSTRUMENT", value: inst })}
                className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-all ${
                  active
                    ? "bg-[var(--color-accent)] text-white border border-transparent"
                    : "bg-[var(--color-juice-700)] text-[var(--color-juice-200)] border border-[var(--color-glass-border)] hover:border-[var(--color-glass-border-hover)]"
                }`}
              >
                {inst}
              </button>
            );
          })}
        </div>
      </div>

      {/* Song Structure */}
      <div>
        <label className="text-[11px] font-medium text-[var(--color-juice-300)] block mb-1.5">Song Structure</label>
        <div className="flex flex-wrap gap-1.5">
          {STRUCTURES.map((s) => {
            const active = state.structure.includes(s);
            return (
              <button
                key={s}
                onClick={() => dispatch({ type: "TOGGLE_STRUCTURE", value: s })}
                className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-all ${
                  active
                    ? "bg-[var(--color-accent)] text-white border border-transparent"
                    : "bg-[var(--color-juice-700)] text-[var(--color-juice-200)] border border-[var(--color-glass-border)] hover:border-[var(--color-glass-border-hover)]"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Waveform Display (Canvas) ──────────────────────────────

function WaveformDisplay({
  beat,
  isPlaying,
  playheadSec,
  dispatch,
}: {
  beat: GeneratedBeat;
  isPlaying: boolean;
  playheadSec: number;
  dispatch: Dispatch<Action>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const playheadRef = useRef(playheadSec);
  playheadRef.current = playheadSec;

  const data = beat.waveformData.length > 0 ? beat.waveformData : Array.from({ length: 200 }, () => Math.random() * 0.7 + 0.15);
  const duration = beat.durationSec;

  // Draw waveform
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = "#111111";
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 12);
    ctx.fill();

    const midY = h / 2;
    const barWidth = Math.max(1.5, w / data.length);

    // Section backgrounds
    for (const section of beat.sections) {
      if (section.startSec === undefined || section.endSec === undefined) continue;
      const x1 = (section.startSec / duration) * w;
      const x2 = (section.endSec / duration) * w;
      ctx.fillStyle = `${section.color}15`;
      ctx.fillRect(x1, 0, x2 - x1, h);

      // Section label
      if (x2 - x1 > 40) {
        ctx.fillStyle = `${section.color}40`;
        ctx.font = "10px Inter, sans-serif";
        ctx.fillText(section.name, x1 + 6, 14);
      }
    }

    // Section divider lines
    for (const section of beat.sections) {
      if (section.startSec === undefined || section.startSec === 0) continue;
      const x = (section.startSec / duration) * w;
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Waveform bars
    const progressRatio = isPlaying ? playheadRef.current / duration : 0;

    data.forEach((val, i) => {
      const x = i * barWidth;
      const barH = val * h * 0.8;
      const y = midY - barH / 2;

      const isPlayed = i / data.length < progressRatio;

      if (isPlayed) {
        const gradient = ctx.createLinearGradient(x, y, x, y + barH);
        gradient.addColorStop(0, "#a78bfa");
        gradient.addColorStop(1, "#7c3aed");
        ctx.fillStyle = gradient;
      } else {
        ctx.fillStyle = i < data.length * 0.3 ? "#3a3a3a" : "#2a2a2a";
      }

      const radius = Math.min(barWidth / 2, 1.5);
      ctx.beginPath();
      ctx.roundRect(x + 0.5, y, barWidth - 1, Math.max(1, barH), radius);
      ctx.fill();
    });

    // Playhead
    if (isPlaying || playheadRef.current > 0) {
      const px = (playheadRef.current / duration) * w;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
      ctx.stroke();

      // Playhead dot
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(px, midY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#7c3aed";
      ctx.beginPath();
      ctx.arc(px, midY, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [data, duration, beat.sections, isPlaying]);

  // Animation loop for playhead
  useEffect(() => {
    if (!isPlaying) {
      draw();
      return;
    }

    let lastTime = performance.now();
    const tick = (now: number) => {
      const delta = (now - lastTime) / 1000;
      lastTime = now;
      const next = playheadRef.current + delta;
      if (next >= duration) {
        dispatch({ type: "STOP" });
        draw();
        return;
      }
      dispatch({ type: "SET_PLAYHEAD", sec: next });
      draw();
      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [isPlaying, duration, dispatch, draw]);

  // Redraw on resize
  useEffect(() => {
    draw();
    const handler = () => draw();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [draw]);

  // Click to seek
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = x / rect.width;
      const sec = Math.max(0, Math.min(duration, ratio * duration));
      dispatch({ type: "SET_PLAYHEAD", sec });
      draw();
    },
    [duration, dispatch, draw]
  );

  return (
    <canvas
      ref={canvasRef}
      onClick={handleCanvasClick}
      className="w-full h-32 rounded-xl cursor-pointer"
      style={{ display: "block" }}
    />
  );
}

// ─── Transport Controls ─────────────────────────────────────

function TransportControls({
  isPlaying,
  dispatch,
  beatDuration,
  engineRef,
  initAudio,
  audioReady,
}: {
  isPlaying: boolean;
  dispatch: Dispatch<Action>;
  beatDuration: number;
  engineRef: React.MutableRefObject<BeatEngineHandle | null>;
  initAudio: () => void;
  audioReady: boolean;
}) {
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const handlePlayPause = useCallback(async () => {
    if (!audioReady) {
      await initAudio();
      // Give a small tick for refs to settle after state update
      await new Promise((r) => setTimeout(r, 30));
    }
    if (engineRef.current) {
      if (isPlaying) {
        engineRef.current.pause();
      } else {
        await engineRef.current.play();
      }
      dispatch({ type: "TOGGLE_PLAYING" });
    } else {
      await initAudio();
    }
  }, [isPlaying, audioReady, initAudio, engineRef, dispatch]);

  const handleStop = useCallback(() => {
    engineRef.current?.stop();
    dispatch({ type: "STOP" });
  }, [engineRef, dispatch]);

  return (
    <div className="flex items-center justify-between mt-4">
      <span className="text-xs text-[var(--color-juice-300)] w-10 text-right">
        0:00
      </span>
      <div className="flex items-center gap-3">
        <button
          onClick={handleStop}
          className="p-2.5 rounded-full btn-glass"
          title="Stop"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        </button>
        <button
          onClick={handlePlayPause}
          className="p-3.5 rounded-full btn-primary"
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg className="w-5 h-5 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6 3 20 12 6 21 6 3" />
            </svg>
          )}
        </button>
        <button
          onClick={handleStop}
          className="p-2.5 rounded-full btn-glass"
          title="Restart"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
        </button>
      </div>
      <span className="text-xs text-[var(--color-juice-300)] w-10">
        {formatTime(beatDuration)}
      </span>
    </div>
  );
}

// ─── Instrument Mixer ────────────────────────────────────────

const MIXER_CHANNELS = [
  { id: "kick", label: "808", icon: "●", color: "#ef4444" },
  { id: "snare", label: "Snare", icon: "○", color: "#f59e0b" },
  { id: "hihatClosed", label: "HH", icon: "△", color: "#3b82f6" },
  { id: "hihatOpen", label: "Open HH", icon: "▲", color: "#06b6d4" },
  { id: "clap", label: "Clap", icon: "◆", color: "#ec4899" },
  { id: "percussion", label: "Perc", icon: "⬡", color: "#22c55e" },
];

function InstrumentMixer({
  mutes,
  solos,
  masterVolume,
  dispatch,
}: {
  mutes: Record<string, boolean>;
  solos: Record<string, boolean>;
  masterVolume: number;
  dispatch: Dispatch<Action>;
}) {
  return (
    <div className="mt-4 pt-4 border-t border-[var(--color-glass-border)] space-y-3">
      {/* Master Volume */}
      <div className="flex items-center gap-3">
        <svg className="w-4 h-4 text-[var(--color-juice-300)] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(masterVolume * 100)}
          onChange={(e) =>
            dispatch({ type: "SET_MASTER_VOLUME", value: parseInt(e.target.value) / 100 })
          }
          className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
          style={{
            accentColor: "var(--color-accent)",
            background: `linear-gradient(90deg, var(--color-accent) ${masterVolume * 100}%, var(--color-juice-600) ${masterVolume * 100}%)`,
          }}
        />
        <span className="text-xs text-[var(--color-juice-300)] w-8 text-right">
          {Math.round(masterVolume * 100)}%
        </span>
      </div>

      {/* Channel mute/solo buttons */}
      <div className="flex flex-wrap gap-1.5">
        {MIXER_CHANNELS.map((ch) => {
          const isMuted = mutes[ch.id] ?? false;
          const isSoloed = solos[ch.id] ?? false;
          return (
            <div key={ch.id} className="flex items-center gap-0.5">
              <button
                onClick={() => dispatch({ type: "TOGGLE_MUTE", instrument: ch.id })}
                className={`text-[11px] px-2 py-1 rounded-full font-medium transition-all flex items-center gap-1 ${
                  isMuted
                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                    : "bg-[var(--color-juice-700)] text-[var(--color-juice-200)] border border-[var(--color-glass-border)] hover:border-[var(--color-glass-border-hover)]"
                }`}
                title={`Mute ${ch.label}`}
              >
                <span style={{ color: isMuted ? undefined : ch.color, fontSize: "10px" }}>{ch.icon}</span>
                {ch.label}
              </button>
              <button
                onClick={() => dispatch({ type: "TOGGLE_SOLO", instrument: ch.id })}
                className={`text-[11px] px-1.5 py-1 rounded-full font-medium transition-all ${
                  isSoloed
                    ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                    : "bg-[var(--color-juice-800)] text-[var(--color-juice-400)] border border-transparent hover:border-[var(--color-glass-border)]"
                }`}
                title={`Solo ${ch.label}`}
              >
                S
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Beat Library Item ──────────────────────────────────────

function BeatLibraryItem({
  beat,
  isSelected,
  isFavorite,
  dispatch,
}: {
  beat: GeneratedBeat;
  isSelected: boolean;
  isFavorite: boolean;
  dispatch: Dispatch<Action>;
}) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className={`relative rounded-xl transition-all ${
        isSelected
          ? "bg-[var(--color-glass-bg-active)] border border-[var(--color-accent)]/30"
          : "bg-[var(--color-juice-800)] border border-transparent hover:border-[var(--color-glass-border)]"
      }`}
    >
      <button
        onClick={() => dispatch({ type: "SELECT_BEAT", id: beat.id })}
        className="w-full text-left p-3 flex items-center gap-3"
      >
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: `linear-gradient(135deg, ${beat.color}50, ${beat.color}15)`,
          }}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke={beat.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-medium text-white truncate">{beat.name}</h3>
            {isFavorite && (
              <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            )}
          </div>
          <p className="text-[11px] text-[var(--color-juice-300)] truncate">
            {beat.bpm} BPM · {beat.key} · {beat.duration}
          </p>
        </div>
      </button>

      {/* Actions dropdown */}
      <button
        onClick={() => setShowActions(!showActions)}
        className="absolute top-2 right-2 p-1.5 rounded-lg hover:bg-[var(--color-juice-600)] transition-colors"
      >
        <svg className="w-3.5 h-3.5 text-[var(--color-juice-300)]" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>

      {showActions && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowActions(false)} />
          <div className="absolute right-2 top-10 z-20 glass-panel p-1.5 min-w-[160px] shadow-2xl">
            <button
              onClick={() => {
                dispatch({ type: "TOGGLE_FAVORITE", id: beat.id });
                setShowActions(false);
              }}
              className="w-full text-left px-3 py-2 rounded-lg text-xs text-[var(--color-juice-100)] hover:bg-[var(--color-glass-bg-hover)] transition-colors flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              {isFavorite ? "Unfavorite" : "Favorite"}
            </button>
            <button
              onClick={() => {
                dispatch({ type: "SELECT_BEAT", id: beat.id });
                dispatch({ type: "TOGGLE_PLAYING" });
                setShowActions(false);
              }}
              className="w-full text-left px-3 py-2 rounded-lg text-xs text-[var(--color-juice-100)] hover:bg-[var(--color-glass-bg-hover)] transition-colors flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download
            </button>
            <button
              onClick={() => {
                dispatch({ type: "SELECT_BEAT", id: beat.id });
                setShowActions(false);
              }}
              className="w-full text-left px-3 py-2 rounded-lg text-xs text-[var(--color-juice-100)] hover:bg-[var(--color-glass-bg-hover)] transition-colors flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              Use in Project
            </button>
            <hr className="my-1 border-[var(--color-glass-border)]" />
            <button
              onClick={() => {
                dispatch({ type: "DELETE_BEAT", id: beat.id });
                setShowActions(false);
              }}
              className="w-full text-left px-3 py-2 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Section Card ───────────────────────────────────────────

function SectionCard({
  section,
  beatId,
  dispatch,
}: {
  section: BeatSection;
  beatId: string;
  dispatch: Dispatch<Action>;
}) {
  const [regenerating, setRegenerating] = useState(false);

  const handleRegenerate = async () => {
    setRegenerating(true);
    await new Promise((r) => setTimeout(r, 1500));
    dispatch({ type: "REGENERATE_SECTION", beatId, sectionId: section.id });
    setRegenerating(false);
  };

  return (
    <div
      className="flex-shrink-0 w-[180px] rounded-xl p-3 border transition-all"
      style={{
        background: `${section.color}10`,
        borderColor: `${section.color}30`,
      }}
    >
      {/* Mini waveform */}
      <div className="h-12 rounded-lg mb-2 flex items-end justify-center gap-[1px] px-1 overflow-hidden"
        style={{ background: `${section.color}15` }}>
        {section.waveformData.filter((_, i) => i % 4 === 0).slice(0, 40).map((val, i) => (
          <div
            key={i}
            className="w-[3px] rounded-t-sm"
            style={{
              height: `${Math.max(8, val * 48)}px`,
              background: section.color,
              opacity: 0.6 + val * 0.4,
            }}
          />
        ))}
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-white">{section.name}</span>
        <span className="text-[10px] text-[var(--color-juice-300)]">
          {Math.floor(section.endSec - section.startSec)}s
        </span>
      </div>

      <button
        onClick={handleRegenerate}
        disabled={regenerating}
        className="w-full py-1.5 rounded-lg text-[11px] font-medium transition-all flex items-center justify-center gap-1.5"
        style={{
          background: regenerating ? `${section.color}30` : `${section.color}20`,
          color: section.color,
          border: `1px solid ${section.color}30`,
        }}
      >
        {regenerating ? (
          <>
            <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            ...
          </>
        ) : (
          <>
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            Regenerate
          </>
        )}
      </button>
    </div>
  );
}

// ─── Imported Beat Item ─────────────────────────────────────

function ImportedBeatItem({
  beat,
  isSelected,
  isFavorite,
  hasBuffer,
  dispatch,
}: {
  beat: ImportResult;
  isSelected: boolean;
  isFavorite: boolean;
  hasBuffer: boolean;
  dispatch: Dispatch<Action>;
}) {
  const [showActions, setShowActions] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(beat.name);

  return (
    <div
      className={`relative rounded-xl transition-all ${
        isSelected
          ? "bg-[var(--color-glass-bg-active)] border border-green-500/30"
          : "bg-[var(--color-juice-800)] border border-green-500/15 hover:border-green-500/30"
      }`}
    >
      <button
        onClick={() => dispatch({ type: "SELECT_IMPORTED", id: beat.id })}
        className="w-full text-left p-3 flex items-center gap-3"
      >
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #22c55e50, #22c55e15)" }}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {renaming ? (
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={() => {
                  setRenaming(false);
                  dispatch({ type: "RENAME_IMPORTED", id: beat.id, name: newName || beat.name });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setRenaming(false);
                    dispatch({ type: "RENAME_IMPORTED", id: beat.id, name: newName || beat.name });
                  }
                }}
                className="text-sm font-medium text-white bg-[var(--color-juice-700)] rounded px-2 py-0.5 w-full border border-[var(--color-glass-border)]"
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            ) : (
              <>
                <h3 className="text-sm font-medium text-white truncate">{beat.name}</h3>
                {isFavorite && (
                  <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                )}
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 flex-shrink-0">Import</span>
              </>
            )}
          </div>
          <p className="text-[11px] text-[var(--color-juice-300)] truncate">
            {beat.bpm} BPM · {beat.key} · {beat.format.toUpperCase()} · {(beat.fileSize / (1024 * 1024)).toFixed(1)}MB
          </p>
        </div>
      </button>

      <button
        onClick={() => setShowActions(!showActions)}
        className="absolute top-2 right-2 p-1.5 rounded-lg hover:bg-[var(--color-juice-600)] transition-colors"
      >
        <svg className="w-3.5 h-3.5 text-[var(--color-juice-300)]" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>

      {showActions && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowActions(false)} />
          <div className="absolute right-2 top-10 z-20 glass-panel p-1.5 min-w-[160px] shadow-2xl">
            <button
              onClick={() => {
                dispatch({ type: "TOGGLE_IMPORTED_FAVORITE", id: beat.id });
                setShowActions(false);
              }}
              className="w-full text-left px-3 py-2 rounded-lg text-xs text-[var(--color-juice-100)] hover:bg-[var(--color-glass-bg-hover)] transition-colors flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              {isFavorite ? "Unfavorite" : "Favorite"}
            </button>
            <button
              onClick={() => {
                setRenaming(true);
                setNewName(beat.name);
                setShowActions(false);
              }}
              className="w-full text-left px-3 py-2 rounded-lg text-xs text-[var(--color-juice-100)] hover:bg-[var(--color-glass-bg-hover)] transition-colors flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Rename
            </button>
            <hr className="my-1 border-[var(--color-glass-border)]" />
            <button
              onClick={() => {
                // Also delete from IndexedDB
                deleteImportedAudio(beat.id).catch(() => {});
                dispatch({ type: "DELETE_IMPORTED", id: beat.id });
                setShowActions(false);
              }}
              className="w-full text-left px-3 py-2 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Imported Waveform Display ────────────────────────────────

function ImportedWaveformDisplay({
  waveformData,
  duration,
  isPlaying,
  playheadSec,
  color,
}: {
  waveformData: number[];
  duration: number;
  isPlaying: boolean;
  playheadSec: number;
  color: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, w, h);

    const midY = h / 2;
    const data = waveformData.length > 0 ? waveformData : Array.from({ length: 100 }, () => 0.1);

    // Draw waveform bars
    const barWidth = Math.max(2, w / data.length);
    const progressRatio = isPlaying ? playheadSec / duration : 0;

    data.forEach((val, i) => {
      const x = i * barWidth;
      const barH = Math.max(1, val * h * 0.8);
      const y = midY - barH / 2;
      const isPlayed = i / data.length < progressRatio;

      ctx.fillStyle = isPlayed ? color : `${color}40`;
      ctx.fillRect(x + 1, y, barWidth - 2, barH);
    });

    // Playhead
    if (playheadSec > 0) {
      const px = (playheadSec / duration) * w;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
      ctx.stroke();
    }
  }, [waveformData, duration, isPlaying, playheadSec, color]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const handler = () => draw();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-32 rounded-lg"
      style={{ display: "block" }}
    />
  );
}

// ─── Imported Transport Controls ──────────────────────────────

function ImportedTransportControls({
  isPlaying,
  dispatch,
  beatDuration,
  importedSourceRef,
  importedStartTimeRef,
  importedOffsetRef,
  importedBuffer,
  initAudio,
}: {
  isPlaying: boolean;
  dispatch: Dispatch<Action>;
  beatDuration: number;
  importedSourceRef: React.MutableRefObject<AudioBufferSourceNode | null>;
  importedStartTimeRef: React.MutableRefObject<number>;
  importedOffsetRef: React.MutableRefObject<number>;
  importedBuffer: AudioBuffer | null;
  initAudio: () => void;
}) {
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const stopImported = useCallback(() => {
    if (importedSourceRef.current) {
      try { importedSourceRef.current.stop(); } catch { /* ok */ }
      importedSourceRef.current = null;
    }
  }, [importedSourceRef]);

  const handlePlayPause = useCallback(async () => {
    if (!importedBuffer) {
      await initAudio();
      return;
    }

    if (isPlaying) {
      stopImported();
      dispatch({ type: "STOP" });
      importedOffsetRef.current = 0;
    } else {
      try {
        const ctx = getContext();
        // Must await resume to satisfy browser autoplay policy
        if (ctx.state === "suspended") {
          await ctx.resume();
        }
        const source = ctx.createBufferSource();
        source.buffer = importedBuffer;
        source.connect(ctx.destination);
        source.start(0, importedOffsetRef.current);
        importedSourceRef.current = source;
        importedStartTimeRef.current = ctx.currentTime - importedOffsetRef.current;

        source.onended = () => {
          if (importedSourceRef.current === source) {
            dispatch({ type: "STOP" });
            importedOffsetRef.current = 0;
          }
        };

        dispatch({ type: "TOGGLE_PLAYING" });
      } catch { /* audio not ready */ }
    }
  }, [isPlaying, importedBuffer, importedSourceRef, importedStartTimeRef, importedOffsetRef, dispatch, initAudio, stopImported]);

  const handleStop = useCallback(() => {
    stopImported();
    dispatch({ type: "STOP" });
    importedOffsetRef.current = 0;
  }, [stopImported, importedOffsetRef, dispatch]);

  return (
    <div className="flex items-center justify-between mt-4">
      <span className="text-xs text-[var(--color-juice-300)] w-10 text-right">
        {formatTime(0)}
      </span>
      <div className="flex items-center gap-3">
        <button onClick={handleStop} className="p-2.5 rounded-full btn-glass" title="Stop">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        </button>
        <button onClick={handlePlayPause} className="p-3.5 rounded-full btn-primary" title={isPlaying ? "Pause" : "Play"}>
          {isPlaying ? (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg className="w-5 h-5 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6 3 20 12 6 21 6 3" />
            </svg>
          )}
        </button>
        <button onClick={handleStop} className="p-2.5 rounded-full btn-glass" title="Restart">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
        </button>
      </div>
      <span className="text-xs text-[var(--color-juice-300)] w-10">
        {formatTime(beatDuration)}
      </span>
    </div>
  );
}

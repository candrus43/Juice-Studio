import { createFileRoute } from "@tanstack/react-router";
import { useReducer, useRef, useEffect, useCallback, useState, type Dispatch } from "react";
import {
  defaultStemChannels,
  mixPresets,
  defaultMasteringChain,
  masteringPresets,
  generateMixHistory,
  generateMasterHistory,
  generateWaveformData,
  generateMasteredWaveform,
  type StemChannel,
  type MasteringChainSettings,
  type MasteringPreset,
  type MixHistoryItem,
  type MasterHistoryItem,
} from "../data/mock";
import {
  getContext,
} from "../audio/engine";
import {
  createMasteringEngine,
  getMasteringEngine,
  disposeMasteringEngine,
  type MasteringEngine,
} from "../audio/mastering";
import {
  getSession,
} from "../audio/session";

// ─── Types ──────────────────────────────────────────────────

interface MixSnapshot {
  id: string;
  label: string;
  timestamp: string;
  stems: StemChannel[];
  masterFader: number;
  presetName: string | null;
}

interface LufsReadings {
  integrated: number;
  shortTerm: number;
  momentary: number;
  truePeak: number;
  dynamicRange: number;
}

interface State {
  mode: "mix" | "master";

  // Mix
  stems: StemChannel[];
  masterFader: number;
  activeMixPreset: string | null;
  mixHistory: MixHistoryItem[];
  mixUndoStack: MixSnapshot[];

  // Master
  chain: MasteringChainSettings;
  activeMasteringPreset: string | null;
  beforeAfter: "before" | "after";
  masterHistory: MasterHistoryItem[];
  lufsReadings: LufsReadings | null;

  // Shared
  isAiProcessing: boolean;
  aiLabel: string;
  isPlaying: boolean;
  playheadSec: number;
  toast: string | null;
  toastTimer: ReturnType<typeof setTimeout> | null;
}

type Action =
  | { type: "SET_MODE"; value: "mix" | "master" }
  // Mix actions
  | { type: "SET_STEM_LEVEL"; id: string; level: number }
  | { type: "SET_STEM_PAN"; id: string; pan: number }
  | { type: "TOGGLE_STEM_MUTE"; id: string }
  | { type: "TOGGLE_STEM_SOLO"; id: string }
  | { type: "SET_MASTER_FADER"; value: number }
  | { type: "APPLY_MIX_PRESET"; presetId: string }
  | { type: "UNDO_MIX" }
  | { type: "SAVE_MIX_SNAPSHOT"; label: string }
  | { type: "RESTORE_MIX_SNAPSHOT"; snapshot: MixSnapshot }
  // Master actions
  | { type: "SET_CHAIN_EQ"; key: string; value: number }
  | { type: "TOGGLE_CHAIN_MODULE"; module: keyof MasteringChainSettings }
  | { type: "SET_CHAIN_COMPRESSOR"; key: string; value: number }
  | { type: "SET_CHAIN_STEREO"; key: string; value: number }
  | { type: "SET_CHAIN_LIMITER"; key: string; value: number }
  | { type: "SET_CHAIN_EXCITER"; key: string; value: number | string }
  | { type: "APPLY_MASTERING_PRESET"; preset: MasteringPreset }
  | { type: "SET_LUFS"; readings: LufsReadings }
  // Shared
  | { type: "AI_START"; label: string }
  | { type: "AI_COMPLETE" }
  | { type: "TOGGLE_PLAYING" }
  | { type: "STOP" }
  | { type: "SET_PLAYHEAD"; sec: number }
  | { type: "SET_BEFORE_AFTER"; value: "before" | "after" }
  | { type: "SHOW_TOAST"; message: string }
  | { type: "CLEAR_TOAST" }
  | { type: "RESET" };

// ─── Initial State ──────────────────────────────────────────

function buildInitialState(): State {
  const stems = defaultStemChannels.map((s) => ({ ...s }));
  return {
    mode: "mix",
    stems,
    masterFader: 0,
    activeMixPreset: null,
    mixHistory: generateMixHistory(),
    mixUndoStack: [],
    chain: { ...defaultMasteringChain },
    activeMasteringPreset: null,
    beforeAfter: "after",
    masterHistory: generateMasterHistory(),
    lufsReadings: null,
    isAiProcessing: false,
    aiLabel: "",
    isPlaying: false,
    playheadSec: 0,
    toast: null,
    toastTimer: null,
  };
}

// ─── Reducer ────────────────────────────────────────────────

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_MODE":
      return { ...state, mode: action.value };

    case "SET_STEM_LEVEL":
      return {
        ...state,
        stems: state.stems.map((s) =>
          s.id === action.id ? { ...s, level: Math.max(0, Math.min(100, action.level)) } : s
        ),
      };

    case "SET_STEM_PAN":
      return {
        ...state,
        stems: state.stems.map((s) =>
          s.id === action.id ? { ...s, pan: Math.max(-50, Math.min(50, action.pan)) } : s
        ),
      };

    case "TOGGLE_STEM_MUTE":
      return {
        ...state,
        stems: state.stems.map((s) =>
          s.id === action.id ? { ...s, mute: !s.mute } : s
        ),
      };

    case "TOGGLE_STEM_SOLO":
      return {
        ...state,
        stems: state.stems.map((s) =>
          s.id === action.id ? { ...s, solo: !s.solo } : s
        ),
      };

    case "SET_MASTER_FADER":
      return { ...state, masterFader: Math.max(-12, Math.min(6, action.value)) };

    case "APPLY_MIX_PRESET": {
      const preset = mixPresets.find((p) => p.id === action.presetId);
      if (!preset) return state;
      const newStems = state.stems.map((stem) => {
        const override = preset.stems.find((ps) => ps.id === stem.id);
        return override ? { ...stem, level: override.level ?? stem.level, pan: override.pan ?? stem.pan } : stem;
      });
      return {
        ...state,
        stems: newStems,
        masterFader: preset.masterFader,
        activeMixPreset: action.presetId,
      };
    }

    case "UNDO_MIX": {
      if (state.mixUndoStack.length === 0) return state;
      const prev = state.mixUndoStack[state.mixUndoStack.length - 1];
      return {
        ...state,
        stems: prev.stems.map((s) => ({ ...s })),
        masterFader: prev.masterFader,
        activeMixPreset: prev.presetName,
        mixUndoStack: state.mixUndoStack.slice(0, -1),
      };
    }

    case "SAVE_MIX_SNAPSHOT": {
      const snapshot: MixSnapshot = {
        id: `snap-${Date.now()}`,
        label: action.label,
        timestamp: new Date().toISOString(),
        stems: state.stems.map((s) => ({ ...s })),
        masterFader: state.masterFader,
        presetName: state.activeMixPreset,
      };
      return {
        ...state,
        mixUndoStack: [...state.mixUndoStack, snapshot].slice(-20),
        mixHistory: [
          { id: snapshot.id, label: snapshot.label, timestamp: snapshot.timestamp, presetName: snapshot.presetName },
          ...state.mixHistory,
        ].slice(0, 20),
      };
    }

    case "RESTORE_MIX_SNAPSHOT":
      return {
        ...state,
        stems: action.snapshot.stems.map((s) => ({ ...s })),
        masterFader: action.snapshot.masterFader,
        activeMixPreset: action.snapshot.presetName,
      };

    case "SET_CHAIN_EQ": {
      return {
        ...state,
        chain: {
          ...state.chain,
          eq: { ...state.chain.eq, [action.key]: action.value },
        },
      };
    }

    case "TOGGLE_CHAIN_MODULE": {
      const module = state.chain[action.module];
      return {
        ...state,
        chain: {
          ...state.chain,
          [action.module]: { ...module, enabled: !module.enabled },
        },
      };
    }

    case "SET_CHAIN_COMPRESSOR":
      return {
        ...state,
        chain: {
          ...state.chain,
          compressor: { ...state.chain.compressor, [action.key]: action.value },
        },
      };

    case "SET_CHAIN_STEREO":
      return {
        ...state,
        chain: {
          ...state.chain,
          stereoImager: { ...state.chain.stereoImager, [action.key]: action.value },
        },
      };

    case "SET_CHAIN_LIMITER":
      return {
        ...state,
        chain: {
          ...state.chain,
          limiter: { ...state.chain.limiter, [action.key]: action.value },
        },
      };

    case "SET_CHAIN_EXCITER":
      return {
        ...state,
        chain: {
          ...state.chain,
          exciter: { ...state.chain.exciter, [action.key]: action.value },
        },
      };

    case "APPLY_MASTERING_PRESET":
      return {
        ...state,
        chain: { ...action.preset.chain },
        activeMasteringPreset: action.preset.id,
      };

    case "SET_LUFS":
      return { ...state, lufsReadings: action.readings };

    case "AI_START":
      return { ...state, isAiProcessing: true, aiLabel: action.label };

    case "AI_COMPLETE":
      return { ...state, isAiProcessing: false, aiLabel: "" };

    case "TOGGLE_PLAYING":
      return { ...state, isPlaying: !state.isPlaying, playheadSec: state.isPlaying ? state.playheadSec : 0 };

    case "STOP":
      return { ...state, isPlaying: false, playheadSec: 0 };

    case "SET_PLAYHEAD":
      return { ...state, playheadSec: action.sec };

    case "SET_BEFORE_AFTER":
      return { ...state, beforeAfter: action.value };

    case "SHOW_TOAST": {
      if (state.toastTimer) clearTimeout(state.toastTimer);
      const timer = setTimeout(() => {
        // toast auto-clears via effect
      }, 3000);
      return { ...state, toast: action.message, toastTimer: timer };
    }

    case "CLEAR_TOAST":
      return { ...state, toast: null, toastTimer: null };

    case "RESET":
      return buildInitialState();

    default:
      return state;
  }
}

// ─── Helper: dB display ─────────────────────────────────────

function levelToDb(level: number): string {
  if (level <= 0) return "-∞";
  const db = Math.round((level - 80) * 0.3);
  return db > 0 ? `+${db}` : `${db}`;
}

function panToDisplay(pan: number): string {
  if (pan === 0) return "C";
  if (pan < 0) return `L${Math.abs(pan)}`;
  return `R${pan}`;
}

// ─── Sub-components ─────────────────────────────────────────

function Knob({
  value,
  min,
  max,
  step = 1,
  size = 40,
  onChange,
  label,
  unit = "",
  color = "#7c3aed",
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  size?: number;
  onChange: (v: number) => void;
  label?: string;
  unit?: string;
  color?: string;
}) {
  const knobRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startValue = useRef(0);

  const angle = ((value - min) / (max - min)) * 270 - 135; // -135 to 135 degrees

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      startY.current = e.clientY;
      startValue.current = value;
      const onMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        const delta = startY.current - ev.clientY;
        const range = max - min;
        const newVal = startValue.current + (delta / 100) * range;
        onChange(Math.round(newVal / step) * step);
      };
      const onUp = () => {
        dragging.current = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [value, min, max, step, onChange]
  );

  const displayValue = step < 1 ? value.toFixed(1) : Math.round(value);

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      {label && <span className="text-[10px] text-[var(--color-juice-300)] uppercase tracking-wider">{label}</span>}
      <div
        ref={knobRef}
        onMouseDown={onMouseDown}
        className="relative rounded-full cursor-pointer"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="16" fill="none" stroke="var(--color-juice-600)" strokeWidth="3" />
          <circle
            cx="20"
            cy="20"
            r="16"
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${((value - min) / (max - min)) * 75.4} 75.4`}
            transform="rotate(-135 20 20)"
            style={{ transition: "stroke-dasharray 0.15s ease-out" }}
          />
          <line
            x1="20"
            y1="20"
            x2="20"
            y2="8"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            transform={`rotate(${angle} 20 20)`}
            style={{ transition: "transform 0.15s ease-out" }}
          />
        </svg>
      </div>
      <span className="text-[10px] text-white font-mono">
        {displayValue}{unit}
      </span>
    </div>
  );
}

function Vectorscope({ isPlaying, processed, engineRef }: { isPlaying: boolean; processed: boolean; engineRef: React.RefObject<MasteringEngine | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    let animating = true;

    // Accumulated points for smooth trail
    let trailPoints: { x: number; y: number }[] = [];

    const draw = () => {
      if (!animating) return;
      const w = rect.width;
      const h = rect.height;
      const cx = w / 2;
      const cy = h / 2;

      ctx.clearRect(0, 0, w, h);

      // Background grid
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 0.5;
      for (let i = 1; i < 4; i++) {
        const r = (Math.min(cx, cy) * i) / 4;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Diagonal cross
      ctx.beginPath();
      ctx.moveTo(cx - Math.min(cx, cy), cy);
      ctx.lineTo(cx + Math.min(cx, cy), cy);
      ctx.moveTo(cx, cy - Math.min(cx, cy));
      ctx.lineTo(cx, cy + Math.min(cx, cy));
      ctx.stroke();

      if (!isPlaying) {
        // Draw static center dot
        ctx.fillStyle = "rgba(124,58,237,0.6)";
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fill();
        frameRef.current = requestAnimationFrame(draw);
        return;
      }

      // Get real L/R waveform data from mastering engine analyser
      let data: { x: number; y: number }[] = [];
      const engine = engineRef.current;
      if (engine) {
        try {
          const wfData = engine.getWaveformData();
          const halfLen = Math.floor(wfData.length / 2);
          for (let i = 0; i < Math.min(halfLen, 100); i++) {
            // Map byte data (0-255) to -1..1
            const x = (wfData[i * 2] - 128) / 128;
            const y = (wfData[i * 2 + 1] - 128) / 128;
            data.push({ x, y });
          }
        } catch {
          data = [{ x: 0, y: 0 }];
        }
      }
      if (data.length === 0) {
        data = [{ x: 0, y: 0 }];
      }

      // Add new point
      const lastData = data[data.length - 1] || { x: 0, y: 0 };
      trailPoints.push(lastData);
      if (trailPoints.length > 150) trailPoints.shift();

      const scale = Math.min(cx, cy) * 0.85;
      const alpha = processed ? 1 : 0.4;

      // Draw trail
      ctx.lineWidth = 1.5;
      for (let i = 1; i < trailPoints.length; i++) {
        const p0 = trailPoints[i - 1];
        const p1 = trailPoints[i];
        const t = i / trailPoints.length;
        const r = Math.floor(124 + t * 20);
        const gVal = Math.floor(58 - t * 20);
        const b = Math.floor(237 - t * 30);
        ctx.strokeStyle = `rgba(${r},${gVal},${b},${alpha * (0.3 + t * 0.5)})`;
        ctx.beginPath();
        ctx.moveTo(cx + p0.x * scale, cy + p0.y * scale);
        ctx.lineTo(cx + p1.x * scale, cy + p1.y * scale);
        ctx.stroke();
      }

      frameRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      animating = false;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [isPlaying, processed, engineRef]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full rounded-lg"
      style={{ background: "var(--color-juice-800)" }}
    />
  );
}

function SpectrumAnalyzer({ isPlaying, processed, engineRef }: { isPlaying: boolean; processed: boolean; engineRef: React.RefObject<MasteringEngine | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    let animating = true;

    const draw = () => {
      if (!animating) return;
      const w = rect.width;
      const h = rect.height;

      ctx.clearRect(0, 0, w, h);

      // Get real frequency data from the mastering engine
      let freqData: Uint8Array;
      const engine = engineRef.current;
      if (engine && isPlaying) {
        try {
          freqData = engine.getFrequencyData();
        } catch {
          freqData = new Uint8Array(64).fill(5);
        }
      } else {
        freqData = new Uint8Array(64).fill(5);
      }

      // Downsample to ~64 bars for display
      const bars = 64;
      const step = Math.max(1, Math.floor(freqData.length / bars));
      const displayData: number[] = [];
      for (let i = 0; i < bars; i++) {
        let sum = 0;
        let count = 0;
        for (let j = 0; j < step && (i * step + j) < freqData.length; j++) {
          sum += freqData[i * step + j];
          count++;
        }
        displayData.push((sum / count) / 255); // normalize to 0-1
      }

      const barWidth = w / displayData.length;
      const alpha = isPlaying ? 1 : 0.3;

      for (let i = 0; i < displayData.length; i++) {
        const barH = Math.max(0.02, displayData[i]) * h * 0.9;
        const x = i * barWidth;
        const t = i / displayData.length;

        // Gradient: red (lows) -> yellow (mids) -> purple (highs)
        let r: number, g: number, b: number;
        if (t < 0.2) {
          r = 239; g = Math.floor(68 + t * 5 * 180); b = Math.floor(68);
        } else if (t < 0.5) {
          r = Math.floor(239 - (t - 0.2) * 3.3 * 200);
          g = Math.floor(200 - (t - 0.2) * 3.3 * 50);
          b = Math.floor(68 + (t - 0.2) * 3.3 * 100);
        } else {
          r = Math.floor(100 + (t - 0.5) * 2 * 24);
          g = Math.floor(58 + (t - 0.5) * 2 * -58);
          b = Math.floor(200 + (t - 0.5) * 2 * 37);
        }

        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.fillRect(x, h - barH, barWidth - 1, barH);
      }

      // Frequency labels
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = "9px Inter, sans-serif";
      const labels = ["20Hz", "100Hz", "500Hz", "2kHz", "8kHz", "20kHz"];
      labels.forEach((label, i) => {
        const lx = (i / (labels.length - 1)) * (w - 30) + 5;
        ctx.fillText(label, lx, h - 3);
      });

      frameRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      animating = false;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [isPlaying, processed, engineRef]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full rounded-lg"
      style={{ background: "var(--color-juice-800)" }}
    />
  );
}

function WaveformComparison({
  original,
  mastered,
  playheadSec,
  durationSec,
}: {
  original: number[];
  mastered: number[];
  playheadSec: number;
  durationSec: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const halfH = h / 2;

    ctx.clearRect(0, 0, w, h);

    // Draw original (top half)
    const drawWave = (data: number[], yOffset: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const scaleY = halfH * 0.7;
      data.forEach((v, i) => {
        const x = (i / data.length) * w;
        const y = yOffset + (0.5 - v) * scaleY;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Fill
      ctx.fillStyle = color.replace("1)", "0.1)").replace("rgb", "rgba");
      ctx.lineTo(w, yOffset);
      ctx.lineTo(0, yOffset);
      ctx.fill();
    };

    drawWave(original, halfH * 0.5, "rgb(150,150,150)");
    drawWave(mastered, halfH * 1.5, "rgb(124,58,237)");

    // Playhead
    const px = (playheadSec / durationSec) * w;
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, h);
    ctx.stroke();

    // Labels
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "10px Inter, sans-serif";
    ctx.fillText("Original", 6, 12);
    ctx.fillText("Mastered", 6, halfH + 12);

    // Divider
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, halfH);
    ctx.lineTo(w, halfH);
    ctx.stroke();
  }, [original, mastered, playheadSec, durationSec]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full rounded-lg"
      style={{ background: "var(--color-juice-800)" }}
    />
  );
}

function LevelMeter({ level, color = "#7c3aed", height = 120 }: { level: number; color?: string; height?: number }) {
  const peakRef = useRef(level);
  const peakTimer = useRef<ReturnType<typeof setTimeout>>();

  if (level > peakRef.current) {
    peakRef.current = level;
    if (peakTimer.current) clearTimeout(peakTimer.current);
    peakTimer.current = setTimeout(() => {
      peakRef.current = 0;
    }, 1500);
  }

  return (
    <div className="relative" style={{ width: 6, height }}>
      <div className="absolute inset-0 rounded-full bg-[var(--color-juice-600)] overflow-hidden">
        <div
          className="absolute bottom-0 left-0 right-0 rounded-full transition-all duration-75"
          style={{
            height: `${level}%`,
            background: level > 90
              ? "#ef4444"
              : level > 75
                ? "#f59e0b"
                : color,
          }}
        />
      </div>
      {peakRef.current > 0 && (
        <div
          className="absolute left-0 right-0 h-0.5 bg-red-400"
          style={{ bottom: `${Math.min(100, peakRef.current)}%` }}
        />
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────

export const Route = createFileRoute("/mixing-mastering")({
  component: MixingMastering,
});

function MixingMastering() {
  const [state, dispatch] = useReducer(reducer, null, buildInitialState);
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimeout = useRef<ReturnType<typeof setTimeout>>();
  const engineRef = useRef<MasteringEngine | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionName, setSessionName] = useState<string | null>(null);

  const isBrowser = typeof window !== "undefined";

  // Initialize mastering engine on mount
  useEffect(() => {
    if (!isBrowser) return;
    try {
      // Ensure AudioContext is created
      getContext();
      // Create the mastering engine (handles session bridging + test tone fallback)
      const engine = createMasteringEngine();
      engineRef.current = engine;
      setSessionActive(engine.isSessionActive);
      setSessionName(engine.sourceLabel);

      // Apply default chain settings
      engine.setEQ(
        defaultMasteringChain.eq.lowGain,
        defaultMasteringChain.eq.midGain,
        defaultMasteringChain.eq.highGain
      );
      engine.setCompressor(
        defaultMasteringChain.compressor.threshold,
        defaultMasteringChain.compressor.ratio,
        defaultMasteringChain.compressor.attack,
        defaultMasteringChain.compressor.release
      );
      engine.setLimiter(
        defaultMasteringChain.limiter.ceiling,
        defaultMasteringChain.limiter.threshold,
        defaultMasteringChain.limiter.release
      );
    } catch {
      // Audio not available
    }

    return () => {
      disposeMasteringEngine();
      engineRef.current = null;
    };
  }, [isBrowser]);

  const showToast = useCallback(
    (message: string) => {
      dispatch({ type: "SHOW_TOAST", message });
      setToastVisible(true);
      if (toastTimeout.current) clearTimeout(toastTimeout.current);
      toastTimeout.current = setTimeout(() => {
        setToastVisible(false);
        dispatch({ type: "CLEAR_TOAST" });
      }, 3000);
    },
    []
  );

  // Audio preview playback — ref-based to avoid stale closures
  const playheadRef = useRef(0);
  const durationSec = 180;

  // Single playhead animation loop using rAF
  useEffect(() => {
    if (!state.isPlaying) {
      playheadRef.current = 0;
      return;
    }
    let lastTime = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const delta = (now - lastTime) / 1000;
      lastTime = now;
      playheadRef.current += delta;
      if (playheadRef.current >= durationSec) playheadRef.current = 0;
      dispatch({ type: "SET_PLAYHEAD", sec: playheadRef.current });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state.isPlaying]);

  // Poll real LUFS/RMS readings from the mastering engine when in master mode
  useEffect(() => {
    if (state.mode !== "master") return;
    let animating = true;
    const poll = () => {
      if (!animating) return;
      const engine = engineRef.current;
      if (engine) {
        const rms = engine.getRMSLevel();
        const lufs = engine.getApproximateLUFS();
        const truePeak = Math.min(0, rms + 3); // rough true peak estimate
        const dynamicRange = Math.max(2, 14 - (Math.abs(rms) / 4));
        dispatch({
          type: "SET_LUFS",
          readings: {
            integrated: lufs,
            shortTerm: lufs + (Math.random() - 0.5) * 1,
            momentary: lufs + (Math.random() - 0.5) * 2,
            truePeak,
            dynamicRange,
          },
        });
      }
      setTimeout(poll, 500);
    };
    poll();
    return () => { animating = false; };
  }, [state.mode]);

  // Generate waveform data (memoized)
  const originalWaveform = useRef(generateWaveformData(durationSec));
  const masteredWaveform = useRef(generateMasteredWaveform(originalWaveform.current));

  // Sync mastering chain state changes to the audio engine
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || state.mode !== "master") return;
    engine.setEQ(state.chain.eq.lowGain, state.chain.eq.midGain, state.chain.eq.highGain);
    engine.setCompressor(
      state.chain.compressor.threshold,
      state.chain.compressor.ratio,
      state.chain.compressor.attack,
      state.chain.compressor.release
    );
    engine.setLimiter(
      state.chain.limiter.ceiling,
      state.chain.limiter.threshold,
      state.chain.limiter.release
    );
  }, [state.chain, state.mode]);

  // Handle AI Auto-Mix
  const handleAutoMix = useCallback(async () => {
    dispatch({ type: "SAVE_MIX_SNAPSHOT", label: "Pre-AI Mix" });
    dispatch({ type: "AI_START", label: "AI analyzing your stems..." });
    await new Promise((r) => setTimeout(r, 3000));
    // Apply AI mix: slightly randomize levels within musical ranges
    const aiStems = state.stems.map((s) => ({
      ...s,
      level: Math.max(40, Math.min(95, s.level + (Math.random() - 0.5) * 12)),
      pan: Math.max(-50, Math.min(50, s.pan + (Math.random() - 0.5) * 10)),
    }));
    const aiMaster = Math.max(-3, Math.min(2, state.masterFader + (Math.random() - 0.5) * 2));
    // Replace stems
    aiStems.forEach((s) => {
      const existing = state.stems.find((es) => es.id === s.id);
      if (existing) {
        dispatch({ type: "SET_STEM_LEVEL", id: s.id, level: Math.round(s.level) });
        dispatch({ type: "SET_STEM_PAN", id: s.id, pan: Math.round(s.pan) });
      }
    });
    dispatch({ type: "SET_MASTER_FADER", value: Math.round(aiMaster) });
    dispatch({ type: "AI_COMPLETE" });
    dispatch({ type: "SAVE_MIX_SNAPSHOT", label: "AI Mix" });
    showToast("AI Mix applied ✓");
  }, [state.stems, state.masterFader, showToast]);

  // Handle AI Auto-Master
  const handleAutoMaster = useCallback(async () => {
    dispatch({ type: "AI_START", label: "AI Mastering your track..." });
    await new Promise((r) => setTimeout(r, 3500));
    const preset = masteringPresets[Math.floor(Math.random() * masteringPresets.length)];
    dispatch({ type: "APPLY_MASTERING_PRESET", preset });
    // Update engine
    const engine = engineRef.current;
    if (engine) {
      engine.setEQ(preset.chain.eq.lowGain, preset.chain.eq.midGain, preset.chain.eq.highGain);
      engine.setCompressor(preset.chain.compressor.threshold, preset.chain.compressor.ratio, preset.chain.compressor.attack, preset.chain.compressor.release);
      engine.setLimiter(preset.chain.limiter.ceiling, preset.chain.limiter.threshold, preset.chain.limiter.release);
    }
    dispatch({ type: "AI_COMPLETE" });
    dispatch({ type: "SET_BEFORE_AFTER", value: "after" });
    showToast(`AI Master applied — ${preset.name} ✓`);
  }, [showToast]);

  // Handle preset apply for mastering
  const handleApplyPreset = useCallback(
    async (preset: MasteringPreset) => {
      dispatch({ type: "AI_START", label: `Loading ${preset.name} preset...` });
      await new Promise((r) => setTimeout(r, 800));
      dispatch({ type: "APPLY_MASTERING_PRESET", preset });
      // Update engine
      const engine = engineRef.current;
      if (engine) {
        engine.setEQ(preset.chain.eq.lowGain, preset.chain.eq.midGain, preset.chain.eq.highGain);
        engine.setCompressor(preset.chain.compressor.threshold, preset.chain.compressor.ratio, preset.chain.compressor.attack, preset.chain.compressor.release);
        engine.setLimiter(preset.chain.limiter.ceiling, preset.chain.limiter.threshold, preset.chain.limiter.release);
      }
      dispatch({ type: "AI_COMPLETE" });
      dispatch({ type: "SET_BEFORE_AFTER", value: "after" });
      showToast(`${preset.name} preset applied ✓`);
    },
    [showToast]
  );

  // ─── Mix Mode Render ───────────────────────────────────────

  const renderMixMode = () => (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Stem Mixer — Left Panel */}
      <div className="lg:col-span-4 card p-4">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <svg className="w-4 h-4 text-[var(--color-accent-light)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Stem Mixer
        </h3>

        <div className="flex gap-3 items-end justify-center overflow-x-auto pb-2 min-h-[280px]">
          {state.stems.map((stem) => (
            <div key={stem.id} className="flex flex-col items-center gap-2 flex-shrink-0 w-[72px]">
              {/* Mute/Solo */}
              <div className="flex gap-0.5">
                <button
                  onClick={() => dispatch({ type: "TOGGLE_STEM_MUTE", id: stem.id })}
                  className={`w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center transition-all ${
                    stem.mute ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-[var(--color-juice-600)] text-[var(--color-juice-300)] border border-transparent hover:border-[var(--color-juice-400)]"
                  }`}
                >
                  M
                </button>
                <button
                  onClick={() => dispatch({ type: "TOGGLE_STEM_SOLO", id: stem.id })}
                  className={`w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center transition-all ${
                    stem.solo ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" : "bg-[var(--color-juice-600)] text-[var(--color-juice-300)] border border-transparent hover:border-[var(--color-juice-400)]"
                  }`}
                >
                  S
                </button>
              </div>

              {/* Level meter */}
              <LevelMeter level={stem.mute ? 0 : stem.level} color={stem.color} height={100} />

              {/* Fader */}
              <div className="relative w-full h-[100px] bg-[var(--color-juice-700)] rounded-full cursor-pointer group"
                onMouseDown={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const onMove = (ev: MouseEvent) => {
                    const y = ev.clientY - rect.top;
                    const level = Math.round(100 - (y / rect.height) * 100);
                    dispatch({ type: "SET_STEM_LEVEL", id: stem.id, level: Math.max(0, Math.min(100, level)) });
                  };
                  const onUp = () => {
                    window.removeEventListener("mousemove", onMove);
                    window.removeEventListener("mouseup", onUp);
                  };
                  const y = e.clientY - rect.top;
                  const level = Math.round(100 - (y / rect.height) * 100);
                  dispatch({ type: "SET_STEM_LEVEL", id: stem.id, level: Math.max(0, Math.min(100, level)) });
                  window.addEventListener("mousemove", onMove);
                  window.addEventListener("mouseup", onUp);
                }}
              >
                <div className="absolute bottom-0 left-0 right-0 rounded-full transition-all duration-75"
                  style={{
                    height: `${stem.mute ? 0 : stem.level}%`,
                    background: `linear-gradient(to top, ${stem.color}, ${stem.color}88)`,
                  }}
                />
                <div
                  className="absolute left-1/2 -translate-x-1/2 w-8 h-3 rounded-full bg-white shadow-lg transition-all duration-75 opacity-0 group-hover:opacity-100"
                  style={{ bottom: `calc(${stem.mute ? 0 : stem.level}% - 6px)` }}
                />
              </div>

              {/* dB readout */}
              <span className="text-[10px] text-[var(--color-juice-200)] font-mono">{levelToDb(stem.level)} dB</span>

              {/* Pan knob */}
              <Knob
                value={stem.pan}
                min={-50}
                max={50}
                size={28}
                onChange={(v) => dispatch({ type: "SET_STEM_PAN", id: stem.id, pan: v })}
                color={stem.color}
              />
              <span className="text-[10px] text-[var(--color-juice-300)]">{panToDisplay(stem.pan)}</span>

              {/* Channel name */}
              <span className="text-[11px] text-white font-medium truncate w-full text-center" style={{ color: stem.color }}>
                {stem.name}
              </span>
            </div>
          ))}

          {/* Master Fader */}
          <div className="flex flex-col items-center gap-2 flex-shrink-0 w-[80px] border-l border-[var(--color-glass-border)] pl-3 ml-1">
            <span className="text-[10px] text-[var(--color-juice-300)] uppercase tracking-wider">Master</span>
            <LevelMeter level={Math.max(0, Math.min(100, 80 + state.masterFader * 3))} color="#ffffff" height={100} />
            <div className="relative w-full h-[100px] bg-[var(--color-juice-700)] rounded-full cursor-pointer group border border-[var(--color-glass-border)]">
              <div
                className="absolute bottom-0 left-0 right-0 rounded-full transition-all duration-75"
                style={{
                  height: `${Math.max(0, Math.min(100, 80 + state.masterFader * 3))}%`,
                  background: "linear-gradient(to top, #ffffff, #cccccc)",
                }}
              />
              <div
                className="absolute left-1/2 -translate-x-1/2 w-8 h-3 rounded-full bg-white shadow-lg transition-all duration-75 opacity-0 group-hover:opacity-100"
                style={{ bottom: `calc(${Math.max(0, Math.min(100, 80 + state.masterFader * 3))}% - 6px)` }}
              />
            </div>
            <span className="text-[10px] text-white font-mono">
              {state.masterFader > 0 ? `+${state.masterFader}` : state.masterFader} dB
            </span>
          </div>
        </div>
      </div>

      {/* Mix Controls — Center */}
      <div className="lg:col-span-5 space-y-4">
        {/* AI Auto-Mix */}
        <div className="card p-5">
          <button
            onClick={handleAutoMix}
            disabled={state.isAiProcessing}
            className="w-full py-4 rounded-xl font-semibold text-white text-base relative overflow-hidden transition-all duration-300 disabled:opacity-70"
            style={{
              background: state.isAiProcessing
                ? "linear-gradient(135deg, #6d28d9, #5b21b6)"
                : "linear-gradient(135deg, #7c3aed, #a78bfa)",
            }}
          >
            {state.isAiProcessing ? (
              <span className="flex items-center justify-center gap-3">
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" opacity="0.3" />
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="15.7 47.1" strokeLinecap="round" />
                </svg>
                {state.aiLabel}
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                AI Auto-Mix
              </span>
            )}
          </button>

          {/* Mix Presets */}
          <div className="mt-4">
            <label className="text-xs font-medium text-[var(--color-juice-300)] uppercase tracking-wider mb-2 block">
              Mix Presets
            </label>
            <div className="flex flex-wrap gap-2">
              {mixPresets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    dispatch({ type: "SAVE_MIX_SNAPSHOT", label: `Before ${preset.name}` });
                    dispatch({ type: "APPLY_MIX_PRESET", presetId: preset.id });
                    showToast(`${preset.name} mix applied ✓`);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    state.activeMixPreset === preset.id
                      ? "bg-[var(--color-accent)]/20 text-[var(--color-accent-light)] border border-[var(--color-accent)]/30"
                      : "bg-[var(--color-juice-700)] text-[var(--color-juice-200)] border border-transparent hover:border-[var(--color-juice-400)]"
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Undo Mix */}
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => {
                dispatch({ type: "UNDO_MIX" });
                showToast("Undo mix ✓");
              }}
              disabled={state.mixUndoStack.length === 0}
              className="btn-glass text-xs py-1.5 px-3 disabled:opacity-40"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4" />
              </svg>
              Undo Mix
            </button>
            <button
              onClick={() => {
                dispatch({ type: "RESET" });
                showToast("Mix reset to default ✓");
              }}
              className="btn-glass text-xs py-1.5 px-3"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Mix History */}
        <div className="card p-4">
          <h4 className="text-xs font-semibold text-white mb-2 uppercase tracking-wider">Mix History</h4>
          <div className="space-y-1 max-h-[140px] overflow-y-auto">
            {state.mixHistory.map((item) => (
              <button
                key={item.id}
                className="w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between hover:bg-[var(--color-glass-bg-hover)] transition-colors group"
              >
                <span className="text-white truncate">{item.label}</span>
                <span className="text-[var(--color-juice-300)] flex-shrink-0 ml-2 group-hover:text-[var(--color-juice-200)]">
                  {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Visualizers — Right */}
      <div className="lg:col-span-3 space-y-4">
        {/* Audio Preview */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Preview</h4>
            <button
              onClick={() => dispatch({ type: state.isPlaying ? "STOP" : "TOGGLE_PLAYING" })}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                state.isPlaying
                  ? "bg-[var(--color-accent)] text-white"
                  : "bg-[var(--color-juice-700)] text-[var(--color-juice-200)] hover:bg-[var(--color-juice-600)]"
              }`}
            >
              {state.isPlaying ? (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              )}
            </button>
          </div>

          {/* Mini waveform with playhead */}
          <div className="h-12 rounded-lg bg-[var(--color-juice-800)] relative overflow-hidden">
            <svg className="w-full h-full" preserveAspectRatio="none" viewBox={`0 0 ${originalWaveform.current.length} 100`}>
              <path
                d={`M 0 50 ${originalWaveform.current.map((v, i) => `L ${i} ${50 - v * 40}`).join(" ")}`}
                fill="none"
                stroke="var(--color-juice-400)"
                strokeWidth="0.5"
              />
            </svg>
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white transition-all duration-75"
              style={{ left: `${(state.playheadSec / durationSec) * 100}%` }}
            />
          </div>
          <div className="text-[10px] text-[var(--color-juice-300)] mt-1 text-right font-mono">
            {Math.floor(state.playheadSec / 60)}:{String(Math.floor(state.playheadSec % 60)).padStart(2, "0")}
          </div>
        </div>

        {/* Vectorscope */}
        <div className="card p-4">
          <h4 className="text-xs font-semibold text-white mb-2 uppercase tracking-wider">Stereo Field</h4>
          <div className="aspect-square rounded-lg overflow-hidden">
            <Vectorscope isPlaying={state.isPlaying} processed={true} engineRef={engineRef} />
          </div>
        </div>

        {/* Spectrum */}
        <div className="card p-4">
          <h4 className="text-xs font-semibold text-white mb-2 uppercase tracking-wider">Frequency Spectrum</h4>
          <div className="h-24 rounded-lg overflow-hidden">
            <SpectrumAnalyzer isPlaying={state.isPlaying} processed={true} engineRef={engineRef} />
          </div>
        </div>
      </div>
    </div>
  );

  // ─── Master Mode Render ────────────────────────────────────

  const renderMasterMode = () => {
    const readings = state.lufsReadings;
    const activePreset = masteringPresets.find((p) => p.id === state.activeMasteringPreset);
    const lufsTarget = activePreset?.targetLUFS ?? -14;
    const peakTarget = activePreset?.peakTarget ?? -1;

    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Session status banner */}
        <div className="lg:col-span-12">
          {!sessionActive ? (
            <div className="card p-5 text-center border border-[var(--color-glass-border)]">
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[var(--color-juice-700)] flex items-center justify-center">
                  <svg className="w-6 h-6 text-[var(--color-juice-300)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm">No Mix Loaded</h3>
                  <p className="text-[var(--color-juice-300)] text-xs mt-1 max-w-md">
                    Start a session in the <strong>Recording Studio</strong> to process your mix through the mastering chain. A test tone is playing so you can preview EQ, compression, and limiter changes.
                  </p>
                </div>
                <div className="flex gap-2 mt-1">
                  <span className="text-[10px] bg-[var(--color-juice-700)] text-[var(--color-juice-200)] px-2 py-1 rounded-full">
                    Source: Test Tone (440 Hz)
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="card p-3 flex items-center gap-3 border border-green-500/20 bg-green-500/5">
              <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <span className="text-green-400 text-xs font-semibold">Session Active</span>
                <span className="text-[var(--color-juice-200)] text-xs ml-2">Processing: <strong>{sessionName}</strong></span>
              </div>
            </div>
          )}
        </div>

        {/* Mastering Chain — Left */}
        <div className="lg:col-span-5 space-y-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--color-accent-light)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            Mastering Chain
          </h3>

          {/* EQ */}
          <ChainModule
            name="EQ"
            enabled={state.chain.eq.enabled}
            onToggle={() => dispatch({ type: "TOGGLE_CHAIN_MODULE", module: "eq" })}
            defaultOpen={true}
          >
            <div className="flex items-center justify-center gap-6 py-2">
              <Knob value={state.chain.eq.lowGain} min={-12} max={12} size={44} onChange={(v) => dispatch({ type: "SET_CHAIN_EQ", key: "lowGain", value: v })} label="Low" unit="dB" color="#ef4444" />
              <Knob value={state.chain.eq.midGain} min={-12} max={12} size={44} onChange={(v) => dispatch({ type: "SET_CHAIN_EQ", key: "midGain", value: v })} label="Mid" unit="dB" color="#f59e0b" />
              <Knob value={state.chain.eq.highGain} min={-12} max={12} size={44} onChange={(v) => dispatch({ type: "SET_CHAIN_EQ", key: "highGain", value: v })} label="High" unit="dB" color="#7c3aed" />
            </div>
            {/* EQ curve mini display */}
            <div className="h-12 rounded-lg bg-[var(--color-juice-800)] mt-2 relative overflow-hidden">
              <svg className="w-full h-full" viewBox="0 0 200 40" preserveAspectRatio="none">
                <line x1="0" y1="20" x2="200" y2="20" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
                <path
                  d={`M 0 ${20 - state.chain.eq.lowGain * 1.2} 
                      Q 50 ${20 - state.chain.eq.lowGain * 0.8}, 100 ${20 - state.chain.eq.midGain} 
                      Q 150 ${20 - state.chain.eq.midGain * 0.5}, 200 ${20 - state.chain.eq.highGain}`}
                  fill="none"
                  stroke="#7c3aed"
                  strokeWidth="2"
                />
              </svg>
            </div>
          </ChainModule>

          {/* Compressor */}
          <ChainModule
            name="Compressor"
            enabled={state.chain.compressor.enabled}
            onToggle={() => dispatch({ type: "TOGGLE_CHAIN_MODULE", module: "compressor" })}
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-[var(--color-juice-300)] block mb-1">Threshold</label>
                <input type="range" min={-60} max={0} value={state.chain.compressor.threshold} onChange={(e) => dispatch({ type: "SET_CHAIN_COMPRESSOR", key: "threshold", value: Number(e.target.value) })} className="w-full accent-[var(--color-accent)]" />
                <span className="text-[10px] text-white font-mono">{state.chain.compressor.threshold} dB</span>
              </div>
              <div>
                <label className="text-[10px] text-[var(--color-juice-300)] block mb-1">Ratio</label>
                <input type="range" min={1} max={20} step={0.5} value={state.chain.compressor.ratio} onChange={(e) => dispatch({ type: "SET_CHAIN_COMPRESSOR", key: "ratio", value: Number(e.target.value) })} className="w-full accent-[var(--color-accent)]" />
                <span className="text-[10px] text-white font-mono">{state.chain.compressor.ratio}:1</span>
              </div>
              <div>
                <label className="text-[10px] text-[var(--color-juice-300)] block mb-1">Attack</label>
                <input type="range" min={0.1} max={100} step={0.1} value={state.chain.compressor.attack} onChange={(e) => dispatch({ type: "SET_CHAIN_COMPRESSOR", key: "attack", value: Number(e.target.value) })} className="w-full accent-[var(--color-accent)]" />
                <span className="text-[10px] text-white font-mono">{state.chain.compressor.attack} ms</span>
              </div>
              <div>
                <label className="text-[10px] text-[var(--color-juice-300)] block mb-1">Release</label>
                <input type="range" min={5} max={500} value={state.chain.compressor.release} onChange={(e) => dispatch({ type: "SET_CHAIN_COMPRESSOR", key: "release", value: Number(e.target.value) })} className="w-full accent-[var(--color-accent)]" />
                <span className="text-[10px] text-white font-mono">{state.chain.compressor.release} ms</span>
              </div>
            </div>
            {/* Gain reduction meter */}
            <div className="mt-3">
              <div className="flex justify-between text-[10px] text-[var(--color-juice-300)] mb-1">
                <span>Gain Reduction</span>
                <span className="text-red-400 font-mono">{state.chain.compressor.gainReduction} dB</span>
              </div>
              <div className="h-2 rounded-full bg-[var(--color-juice-700)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-red-500 transition-all"
                  style={{ width: `${Math.abs(state.chain.compressor.gainReduction) / 12 * 100}%` }}
                />
              </div>
            </div>
          </ChainModule>

          {/* Stereo Imager */}
          <ChainModule
            name="Stereo Imager"
            enabled={state.chain.stereoImager.enabled}
            onToggle={() => dispatch({ type: "TOGGLE_CHAIN_MODULE", module: "stereoImager" })}
          >
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[10px] text-[var(--color-juice-300)] mb-1">
                  <span>Width</span>
                  <span className="text-white font-mono">{state.chain.stereoImager.width}%</span>
                </div>
                <input type="range" min={0} max={200} value={state.chain.stereoImager.width} onChange={(e) => dispatch({ type: "SET_CHAIN_STEREO", key: "width", value: Number(e.target.value) })} className="w-full accent-[var(--color-accent)]" />
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-[var(--color-juice-300)] mb-1">
                  <span>Phase Correlation</span>
                  <span className={`font-mono ${state.chain.stereoImager.phaseCorrelation < 0 ? "text-red-400" : "text-green-400"}`}>
                    {state.chain.stereoImager.phaseCorrelation > 0 ? "+" : ""}{state.chain.stereoImager.phaseCorrelation.toFixed(2)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[var(--color-juice-700)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${((state.chain.stereoImager.phaseCorrelation + 1) / 2) * 100}%`,
                      background: state.chain.stereoImager.phaseCorrelation > 0 ? "linear-gradient(90deg, #ef4444, #f59e0b, #22c55e)" : "#ef4444",
                    }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-[var(--color-juice-400)] mt-0.5">
                  <span>-1</span><span>0</span><span>+1</span>
                </div>
              </div>
            </div>
          </ChainModule>

          {/* Limiter */}
          <ChainModule
            name="Limiter"
            enabled={state.chain.limiter.enabled}
            onToggle={() => dispatch({ type: "TOGGLE_CHAIN_MODULE", module: "limiter" })}
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-[var(--color-juice-300)] block mb-1">Ceiling</label>
                <input type="range" min={-6} max={0} step={0.1} value={state.chain.limiter.ceiling} onChange={(e) => dispatch({ type: "SET_CHAIN_LIMITER", key: "ceiling", value: Number(e.target.value) })} className="w-full accent-[var(--color-accent)]" />
                <span className="text-[10px] text-white font-mono">{state.chain.limiter.ceiling} dB</span>
              </div>
              <div>
                <label className="text-[10px] text-[var(--color-juice-300)] block mb-1">Threshold</label>
                <input type="range" min={-24} max={0} step={0.5} value={state.chain.limiter.threshold} onChange={(e) => dispatch({ type: "SET_CHAIN_LIMITER", key: "threshold", value: Number(e.target.value) })} className="w-full accent-[var(--color-accent)]" />
                <span className="text-[10px] text-white font-mono">{state.chain.limiter.threshold} dB</span>
              </div>
              <div className="col-span-2">
                <label className="text-[10px] text-[var(--color-juice-300)] block mb-1">Release</label>
                <input type="range" min={10} max={500} value={state.chain.limiter.release} onChange={(e) => dispatch({ type: "SET_CHAIN_LIMITER", key: "release", value: Number(e.target.value) })} className="w-full accent-[var(--color-accent)]" />
                <span className="text-[10px] text-white font-mono">{state.chain.limiter.release} ms</span>
              </div>
            </div>
          </ChainModule>

          {/* Exciter/Saturation */}
          <ChainModule
            name="Exciter / Saturation"
            enabled={state.chain.exciter.enabled}
            onToggle={() => dispatch({ type: "TOGGLE_CHAIN_MODULE", module: "exciter" })}
          >
            <div className="space-y-3">
              <div className="flex gap-2">
                {["Tape", "Tube", "Warm", "Bright"].map((t) => (
                  <button
                    key={t}
                    onClick={() => dispatch({ type: "SET_CHAIN_EXCITER", key: "type", value: t })}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${
                      state.chain.exciter.type === t
                        ? "bg-[var(--color-accent)]/20 text-[var(--color-accent-light)] border border-[var(--color-accent)]/30"
                        : "bg-[var(--color-juice-700)] text-[var(--color-juice-300)] border border-transparent hover:border-[var(--color-juice-400)]"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-[var(--color-juice-300)] block mb-1">Drive</label>
                  <input type="range" min={0} max={100} value={state.chain.exciter.drive} onChange={(e) => dispatch({ type: "SET_CHAIN_EXCITER", key: "drive", value: Number(e.target.value) })} className="w-full accent-[var(--color-accent)]" />
                  <span className="text-[10px] text-white font-mono">{state.chain.exciter.drive}%</span>
                </div>
                <div>
                  <label className="text-[10px] text-[var(--color-juice-300)] block mb-1">Mix</label>
                  <input type="range" min={0} max={100} value={state.chain.exciter.mix} onChange={(e) => dispatch({ type: "SET_CHAIN_EXCITER", key: "mix", value: Number(e.target.value) })} className="w-full accent-[var(--color-accent)]" />
                  <span className="text-[10px] text-white font-mono">{state.chain.exciter.mix}%</span>
                </div>
              </div>
            </div>
          </ChainModule>
        </div>

        {/* Center — Master Controls + Visualizers */}
        <div className="lg:col-span-4 space-y-4">
          {/* AI Auto-Master */}
          <div className="card p-5">
            <button
              onClick={handleAutoMaster}
              disabled={state.isAiProcessing}
              className="w-full py-5 rounded-xl font-semibold text-white text-lg relative overflow-hidden transition-all duration-300 disabled:opacity-70"
              style={{
                background: state.isAiProcessing
                  ? "linear-gradient(135deg, #6d28d9, #4c1d95)"
                  : "linear-gradient(135deg, #7c3aed, #ec4899)",
                boxShadow: state.isAiProcessing ? "0 0 40px rgba(124,58,237,0.4)" : "0 4px 24px rgba(124,58,237,0.3)",
              }}
            >
              {state.isAiProcessing ? (
                <span className="flex items-center justify-center gap-3">
                  <span className="relative flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-40" />
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-white" />
                  </span>
                  {state.aiLabel}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  AI Auto-Master
                </span>
              )}
            </button>

            {/* Before/After Toggle */}
            <div className="mt-4 flex bg-[var(--color-juice-700)] rounded-xl p-1">
              <button
                onClick={() => dispatch({ type: "SET_BEFORE_AFTER", value: "before" })}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  state.beforeAfter === "before"
                    ? "bg-[var(--color-juice-500)] text-white"
                    : "text-[var(--color-juice-200)]"
                }`}
              >
                Before
              </button>
              <button
                onClick={() => dispatch({ type: "SET_BEFORE_AFTER", value: "after" })}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  state.beforeAfter === "after"
                    ? "bg-[var(--color-accent)] text-white"
                    : "text-[var(--color-juice-200)]"
                }`}
              >
                After
              </button>
            </div>

            {/* Reset */}
            <button
              onClick={() => {
                dispatch({ type: "RESET" });
                showToast("Master reset to default ✓");
              }}
              className="btn-glass text-xs py-1.5 w-full mt-3"
            >
              Reset Chain
            </button>
          </div>

          {/* Loudness Meter */}
          <div className="card p-4">
            <h4 className="text-xs font-semibold text-white mb-3 uppercase tracking-wider">Loudness Meter</h4>
            {readings ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-2xl font-bold text-white font-mono">{readings.integrated.toFixed(1)}</div>
                    <div className="text-[10px] text-[var(--color-juice-300)]">Integrated LUFS</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white font-mono">{readings.shortTerm.toFixed(1)}</div>
                    <div className="text-[10px] text-[var(--color-juice-300)]">Short-term LUFS</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white font-mono">{readings.momentary.toFixed(1)}</div>
                    <div className="text-[10px] text-[var(--color-juice-300)]">Momentary LUFS</div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-[var(--color-juice-300)] mb-1">
                    <span>True Peak</span>
                    <span className="text-white font-mono">{readings.truePeak.toFixed(1)} dBTP</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--color-juice-700)] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${readings.truePeak > 0 ? "bg-red-500" : readings.truePeak > -1 ? "bg-yellow-500" : "bg-green-500"}`}
                      style={{ width: `${Math.min(100, Math.abs(readings.truePeak) / 3 * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-[var(--color-juice-300)] text-sm">
                Apply a mastering preset to see readings
              </div>
            )}
          </div>

          {/* Waveform Comparison */}
          <div className="card p-4">
            <h4 className="text-xs font-semibold text-white mb-2 uppercase tracking-wider">Waveform Comparison</h4>
            <div className="h-32 rounded-lg overflow-hidden">
              <WaveformComparison
                original={originalWaveform.current}
                mastered={masteredWaveform.current}
                playheadSec={state.playheadSec}
                durationSec={durationSec}
              />
            </div>
          </div>
        </div>

        {/* Right — Presets + Export Indicators */}
        <div className="lg:col-span-3 space-y-4">
          {/* Mastering Presets */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-[var(--color-accent-light)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Mastering Presets
            </h3>
            <div className="space-y-2">
              {masteringPresets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleApplyPreset(preset)}
                  disabled={state.isAiProcessing}
                  className={`w-full card-hover p-4 text-left group disabled:opacity-50 ${
                    state.activeMasteringPreset === preset.id ? "border-[var(--color-accent)]/30 bg-[var(--color-glass-bg-active)]" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                      state.activeMasteringPreset === preset.id
                        ? "bg-[var(--color-accent)]/20"
                        : "bg-[var(--color-glass-bg)] group-hover:bg-[var(--color-accent)]/10"
                    }`}>
                      <svg className="w-5 h-5 text-[var(--color-accent-light)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d={preset.icon} />
                      </svg>
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <h4 className="font-medium text-white text-sm">{preset.name}</h4>
                      <p className="text-[10px] text-[var(--color-juice-300)] mt-0.5">{preset.platform}</p>
                      <div className="flex gap-3 mt-2">
                        <span className="text-[10px] text-[var(--color-juice-200)] bg-[var(--color-juice-700)] px-1.5 py-0.5 rounded">
                          {preset.targetLUFS} LUFS
                        </span>
                        <span className="text-[10px] text-[var(--color-juice-200)] bg-[var(--color-juice-700)] px-1.5 py-0.5 rounded">
                          {preset.peakTarget} dB Peak
                        </span>
                      </div>
                      <p className="text-[10px] text-[var(--color-juice-300)] mt-1.5 leading-relaxed">{preset.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Export-Ready Indicators */}
          <div className="card p-4">
            <h4 className="text-xs font-semibold text-white mb-3 uppercase tracking-wider">Export Ready</h4>
            {readings && activePreset ? (
              <div className="space-y-2">
                <IndicatorRow
                  label="LUFS Target"
                  expected={`${lufsTarget} LUFS`}
                  actual={`${readings.integrated.toFixed(1)} LUFS`}
                  pass={Math.abs(readings.integrated - lufsTarget) <= 1}
                />
                <IndicatorRow
                  label="True Peak"
                  expected={`≤ ${peakTarget} dBTP`}
                  actual={`${readings.truePeak.toFixed(1)} dBTP`}
                  pass={readings.truePeak <= peakTarget}
                />
                <IndicatorRow
                  label="Dynamic Range"
                  expected="> 4 dB"
                  actual={`${readings.dynamicRange.toFixed(1)} dB`}
                  pass={readings.dynamicRange > 4}
                />
                <div className="pt-2 mt-2 border-t border-[var(--color-glass-border)]">
                  <div className="text-[10px] text-[var(--color-juice-300)] mb-1">Format ready for:</div>
                  <div className="flex flex-wrap gap-1">
                    {masteringPresets.map((p) => {
                      const compatible = Math.abs(readings.integrated - p.targetLUFS) <= 2;
                      return (
                        <span
                          key={p.id}
                          className={`text-[10px] px-2 py-0.5 rounded-full ${
                            compatible
                              ? "bg-green-500/10 text-green-400 border border-green-500/20"
                              : "bg-[var(--color-juice-700)] text-[var(--color-juice-300)]"
                          }`}
                        >
                          {p.name}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-[var(--color-juice-300)] text-xs">
                Apply a mastering preset first
              </div>
            )}
          </div>

          {/* Master History */}
          <div className="card p-4">
            <h4 className="text-xs font-semibold text-white mb-2 uppercase tracking-wider">Master History</h4>
            <div className="space-y-1 max-h-[120px] overflow-y-auto">
              {state.masterHistory.map((item) => (
                <div
                  key={item.id}
                  className="px-3 py-2 rounded-lg text-xs flex items-center justify-between hover:bg-[var(--color-glass-bg-hover)] transition-colors"
                >
                  <div>
                    <div className="text-white">{item.label}</div>
                    <div className="text-[10px] text-[var(--color-juice-300)]">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <span className="text-[var(--color-juice-200)] font-mono">{item.lufs} LUFS</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── Chain Module Collapsible ───────────────────────────────

  function ChainModule({
    name,
    enabled,
    onToggle,
    children,
    defaultOpen = false,
  }: {
    name: string;
    enabled: boolean;
    onToggle: () => void;
    children: React.ReactNode;
    defaultOpen?: boolean;
  }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
      <div className={`card p-4 transition-all ${!enabled ? "opacity-50" : ""}`}>
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => setOpen(!open)} className="flex items-center gap-2 text-sm font-medium text-white hover:text-[var(--color-accent-light)] transition-colors">
            <svg
              className={`w-3 h-3 transition-transform ${open ? "rotate-90" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
            {name}
          </button>
          <button
            onClick={onToggle}
            className={`w-9 h-6 rounded-full relative transition-all ${
              enabled ? "bg-[var(--color-accent)]" : "bg-[var(--color-juice-500)]"
            }`}
          >
            <div
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                enabled ? "right-0.5" : "left-0.5"
              }`}
            />
          </button>
        </div>
        {open && <div>{children}</div>}
      </div>
    );
  }

  // ─── Indicator Row ──────────────────────────────────────────

  function IndicatorRow({
    label,
    expected,
    actual,
    pass,
  }: {
    label: string;
    expected: string;
    actual: string;
    pass: boolean;
  }) {
    return (
      <div className="flex items-center justify-between text-xs">
        <div>
          <span className="text-white">{label}</span>
          <span className="text-[var(--color-juice-300)] ml-1">({expected})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[var(--color-juice-200)] font-mono">{actual}</span>
          {pass ? (
            <svg className="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          )}
        </div>
      </div>
    );
  }

  // ─── Main Render ────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 page-transition">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Mixing & Mastering</h1>
          <p className="text-sm text-[var(--color-juice-200)] mt-1">
            {state.mode === "mix" ? "Mix stems and balance your track" : "Polish to release-ready quality"}
          </p>
        </div>
        <div className="flex bg-[var(--color-juice-700)] rounded-xl p-1">
          <button
            onClick={() => dispatch({ type: "SET_MODE", value: "mix" })}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              state.mode === "mix" ? "bg-[var(--color-accent)] text-white shadow-lg shadow-[var(--color-accent-glow)]" : "text-[var(--color-juice-200)] hover:text-white"
            }`}
          >
            Mix
          </button>
          <button
            onClick={() => dispatch({ type: "SET_MODE", value: "master" })}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              state.mode === "master" ? "bg-[var(--color-accent)] text-white shadow-lg shadow-[var(--color-accent-glow)]" : "text-[var(--color-juice-200)] hover:text-white"
            }`}
          >
            Master
          </button>
        </div>
      </div>

      {/* Mode Content */}
      {state.mode === "mix" ? renderMixMode() : renderMasterMode()}

      {/* Toast */}
      {state.toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-medium bg-[var(--color-juice-800)] border border-[var(--color-glass-border)] text-white shadow-2xl transition-all duration-300 ${
            toastVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 13l4 4L19 7" />
            </svg>
            {state.toast}
          </div>
        </div>
      )}
    </div>
  );
}

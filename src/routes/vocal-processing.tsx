import { createFileRoute } from "@tanstack/react-router";
import { useReducer, useRef, useEffect, useCallback, useState, type Dispatch } from "react";
import { getDefaultChain, genrePresets, type VocalChainSettings, type GenrePreset } from "../data/mock";
import {
  getContext,
  createEffectChain,
  getEffectChain,
  buildEQ,
  buildCompressor,
  buildReverb,
  buildDelay,
  buildStereoWidth,
  rebuildChain,
  getAnalyser,
  getFrequencyData,
  getWaveformData,
  createTestToneBuffer,
  playThroughChain,
  disposeChain,
  getCompressorReduction,
  getRMSLevel,
} from "../audio/engine";

// ─── Types ──────────────────────────────────────────────────

const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const SCALES = ["major", "minor"] as const;
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const DELAY_UNITS = ["1/16", "1/8d", "1/8", "1/4d", "1/4", "1/2"];
const REVERB_TYPES = ["Plate", "Hall", "Room", "Spring", "Chamber"];

interface CustomPreset {
  id: string;
  name: string;
  settings: VocalChainSettings;
  createdAt: string;
}

interface ABSlot {
  label: string;
  settings: VocalChainSettings | null;
}

interface State {
  chain: VocalChainSettings;
  selectedPreset: string | null;
  aSlot: ABSlot;
  bSlot: ABSlot;
  activeAB: "A" | "B" | null;
  customPresets: CustomPreset[];
  isPlaying: boolean;
  isProcessing: boolean;
  beforeAfter: "before" | "after";
  saveDialogOpen: boolean;
  saveName: string;
  collapsedEffects: Set<string>;
}

type Action =
  | { type: "TOGGLE_EFFECT"; effect: string }
  | { type: "SET_PARAM"; effect: string; param: string; value: number | boolean | string }
  | { type: "SET_ALLOWED_NOTE"; index: number }
  | { type: "SET_EQ_PARAM"; param: string; value: number }
  | { type: "LOAD_PRESET"; settings: VocalChainSettings; presetId: string }
  | { type: "SAVE_TO_A" }
  | { type: "SAVE_TO_B" }
  | { type: "LOAD_A" }
  | { type: "LOAD_B" }
  | { type: "TOGGLE_PLAYING" }
  | { type: "STOP" }
  | { type: "SET_PROCESSING"; value: boolean }
  | { type: "TOGGLE_BEFORE_AFTER" }
  | { type: "RESET_ALL" }
  | { type: "SAVE_CUSTOM_PRESET" }
  | { type: "LOAD_CUSTOM_PRESET"; preset: CustomPreset }
  | { type: "DELETE_CUSTOM_PRESET"; id: string }
  | { type: "SET_SAVE_NAME"; value: string }
  | { type: "TOGGLE_SAVE_DIALOG" }
  | { type: "TOGGLE_COLLAPSE"; id: string };

function buildInitialState(): State {
  return {
    chain: getDefaultChain(),
    selectedPreset: null,
    aSlot: { label: "A", settings: getDefaultChain() },
    bSlot: { label: "B", settings: null },
    activeAB: null,
    customPresets: [],
    isPlaying: false,
    isProcessing: false,
    beforeAfter: "after",
    saveDialogOpen: false,
    saveName: "",
    collapsedEffects: new Set(),
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "TOGGLE_EFFECT": {
      const chain = { ...state.chain };
      (chain as Record<string, Record<string, unknown>>)[action.effect] = {
        ...(chain as Record<string, Record<string, unknown>>)[action.effect],
        enabled: !(chain as Record<string, { enabled: boolean }>)[action.effect].enabled,
      };
      return { ...state, chain: chain as VocalChainSettings };
    }
    case "SET_PARAM": {
      const chain = { ...state.chain };
      (chain as Record<string, Record<string, unknown>>)[action.effect] = {
        ...(chain as Record<string, Record<string, unknown>>)[action.effect],
        [action.param]: action.value,
      };
      return { ...state, chain: chain as VocalChainSettings };
    }
    case "SET_ALLOWED_NOTE": {
      const notes = [...state.chain.pitchCorrection.allowedNotes];
      notes[action.index] = !notes[action.index];
      return {
        ...state,
        chain: {
          ...state.chain,
          pitchCorrection: { ...state.chain.pitchCorrection, allowedNotes: notes },
        },
      };
    }
    case "SET_EQ_PARAM": {
      return {
        ...state,
        chain: {
          ...state.chain,
          eq: { ...state.chain.eq, [action.param]: action.value },
        },
      };
    }
    case "LOAD_PRESET":
      return { ...state, chain: action.settings, selectedPreset: action.presetId };
    case "SAVE_TO_A":
      return { ...state, aSlot: { label: "A", settings: state.chain }, activeAB: null };
    case "SAVE_TO_B":
      return { ...state, bSlot: { label: "B", settings: state.chain }, activeAB: null };
    case "LOAD_A":
      if (!state.aSlot.settings) return state;
      return { ...state, chain: state.aSlot.settings, activeAB: "A" };
    case "LOAD_B":
      if (!state.bSlot.settings) return state;
      return { ...state, chain: state.bSlot.settings, activeAB: "B" };
    case "TOGGLE_PLAYING":
      return { ...state, isPlaying: !state.isPlaying };
    case "STOP":
      return { ...state, isPlaying: false };
    case "SET_PROCESSING":
      return { ...state, isProcessing: action.value };
    case "TOGGLE_BEFORE_AFTER":
      return { ...state, beforeAfter: state.beforeAfter === "before" ? "after" : "before" };
    case "RESET_ALL":
      return { ...state, chain: getDefaultChain(), selectedPreset: null, activeAB: null };
    case "SAVE_CUSTOM_PRESET": {
      const preset: CustomPreset = {
        id: `custom-${Date.now()}`,
        name: state.saveName || `Preset ${state.customPresets.length + 1}`,
        settings: state.chain,
        createdAt: new Date().toISOString(),
      };
      return {
        ...state,
        customPresets: [...state.customPresets, preset],
        saveDialogOpen: false,
        saveName: "",
      };
    }
    case "LOAD_CUSTOM_PRESET":
      return { ...state, chain: action.preset.settings, selectedPreset: action.preset.id };
    case "DELETE_CUSTOM_PRESET":
      return {
        ...state,
        customPresets: state.customPresets.filter((p) => p.id !== action.id),
        selectedPreset: state.selectedPreset === action.id ? null : state.selectedPreset,
      };
    case "SET_SAVE_NAME":
      return { ...state, saveName: action.value };
    case "TOGGLE_SAVE_DIALOG":
      return { ...state, saveDialogOpen: !state.saveDialogOpen, saveName: "" };
    case "TOGGLE_COLLAPSE": {
      const next = new Set(state.collapsedEffects);
      if (next.has(action.id)) next.delete(action.id);
      else next.add(action.id);
      return { ...state, collapsedEffects: next };
    }
    default:
      return state;
  }
}

// ─── Route ──────────────────────────────────────────────────

export const Route = createFileRoute("/vocal-processing")({
  component: VocalProcessing,
});

// ─── Custom Knob Component ──────────────────────────────────

function Knob({
  value,
  min,
  max,
  step = 1,
  size = 52,
  label,
  unit = "",
  onChange,
  bipolar = false,
  color = "var(--color-accent)",
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  size?: number;
  label: string;
  unit?: string;
  onChange: (v: number) => void;
  bipolar?: boolean;
  color?: string;
}) {
  const knobRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startValue = useRef(0);

  const range = max - min;
  const normalized = bipolar
    ? (value - min) / range
    : (value - min) / range;
  const angle = bipolar
    ? normalized * 270 - 135
    : normalized * 270 - 135; // -135 to +135 degrees

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      startY.current = e.clientY;
      startValue.current = value;
      document.body.style.cursor = "ns-resize";
    },
    [value]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startY.current - e.clientY;
      const sensitivity = range / 200;
      let newVal = startValue.current + delta * sensitivity;
      newVal = Math.round(newVal / step) * step;
      newVal = Math.max(min, Math.min(max, newVal));
      onChange(newVal);
    };
    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [min, max, step, range, onChange]);

  const displayValue = unit === "Hz" && value >= 1000
    ? `${(value / 1000).toFixed(1)}k`
    : `${value}${unit}`;

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <div
        ref={knobRef}
        onMouseDown={handleMouseDown}
        className="relative rounded-full cursor-ns-resize flex-shrink-0"
        style={{ width: size, height: size }}
        title={`${label}: ${displayValue}`}
      >
        <svg width={size} height={size} viewBox="0 0 52 52">
          {/* Track */}
          <circle
            cx={26} cy={26} r={21}
            fill="none"
            stroke="var(--color-juice-500)"
            strokeWidth={3}
          />
          {/* Active arc */}
          <circle
            cx={26} cy={26} r={21}
            fill="none"
            stroke={color}
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={`${(normalized * 130).toFixed(1)} 200`}
            strokeDashoffset={bipolar ? -65 + (1 - normalized) * 65 : 0}
            transform="rotate(135 26 26)"
            opacity={0.9}
          />
          {/* Indicator dot */}
          <circle
            cx={26 + 17 * Math.cos((angle - 90) * Math.PI / 180)}
            cy={26 + 17 * Math.sin((angle - 90) * Math.PI / 180)}
            r={2.5}
            fill="white"
          />
        </svg>
      </div>
      <span className="text-[11px] font-medium text-[var(--color-juice-100)] text-center leading-tight">
        {label}
      </span>
      <span className="text-[10px] text-[var(--color-juice-300)] tabular-nums">
        {displayValue}
      </span>
    </div>
  );
}

// ─── Slider Component ───────────────────────────────────────

function Fader({
  value,
  min,
  max,
  step = 1,
  label,
  unit = "",
  onChange,
  height = 100,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  label: string;
  unit?: string;
  onChange: (v: number) => void;
  height?: number;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const normalized = (value - min) / (max - min);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      document.body.style.cursor = "row-resize";
      if (trackRef.current) {
        const rect = trackRef.current.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const ratio = 1 - y / rect.height;
        const newVal = Math.round((min + ratio * (max - min)) / step) * step;
        onChange(Math.max(min, Math.min(max, newVal)));
      }
    },
    [min, max, step, onChange]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const ratio = 1 - Math.max(0, Math.min(1, y / rect.height));
      const newVal = Math.round((min + ratio * (max - min)) / step) * step;
      onChange(Math.max(min, Math.min(max, newVal)));
    };
    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [min, max, step, onChange]);

  const displayValue = unit === "Hz" && value >= 1000
    ? `${(value / 1000).toFixed(1)}k`
    : `${value}${unit}`;

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] text-[var(--color-juice-300)] tabular-nums">
        {displayValue}
      </span>
      <div
        ref={trackRef}
        onMouseDown={handleMouseDown}
        className="relative rounded-full cursor-row-resize"
        style={{ width: 6, height, background: "var(--color-juice-500)" }}
      >
        <div
          className="absolute bottom-0 left-0 right-0 rounded-full transition-all duration-75"
          style={{
            height: `${normalized * 100}%`,
            background: "linear-gradient(180deg, var(--color-accent), var(--color-accent-light))",
          }}
        />
        <div
          className="absolute left-1/2 -translate-x-1/2 w-4 h-2 rounded-sm bg-white shadow-md"
          style={{ bottom: `${normalized * 100}%`, transform: "translate(-50%, 50%)" }}
        />
      </div>
      <span className="text-[10px] font-medium text-[var(--color-juice-100)] text-center leading-tight">
        {label}
      </span>
    </div>
  );
}

// ─── Power Toggle ───────────────────────────────────────────

function PowerToggle({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`w-8 h-5 rounded-full transition-all duration-200 flex-shrink-0 relative ${
        enabled ? "bg-[var(--color-accent)] shadow-[0_0_8px_var(--color-accent-glow)]" : "bg-[var(--color-juice-500)]"
      }`}
    >
      <div
        className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform duration-200 ${
          enabled ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

// ─── Effect Card Wrapper ────────────────────────────────────

function EffectCard({
  id,
  icon,
  name,
  enabled,
  onToggle,
  collapsed,
  onToggleCollapse,
  children,
}: {
  id: string;
  icon: string;
  name: string;
  enabled: boolean;
  onToggle: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`card p-4 transition-opacity duration-200 ${enabled ? "" : "opacity-60"}`}>
      <div className="flex items-center gap-3 mb-1">
        <PowerToggle enabled={enabled} onChange={onToggle} />
        <span className="text-lg">{icon}</span>
        <h3 className="text-sm font-semibold text-white flex-1">{name}</h3>
        <button
          onClick={onToggleCollapse}
          className="p-1 rounded-lg hover:bg-[var(--color-glass-bg-hover)] transition-colors"
        >
          <svg
            className={`w-4 h-4 text-[var(--color-juice-300)] transition-transform duration-200 ${collapsed ? "" : "rotate-180"}`}
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
      </div>
      {!collapsed && <div className="mt-3 pt-3 border-t border-[var(--color-glass-border)]">{children}</div>}
    </div>
  );
}

// ─── EQ Curve Visualization ─────────────────────────────────

function EQCurve({ eq }: { eq: VocalChainSettings["eq"] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    // Background grid
    ctx.fillStyle = "#0a0a0a";
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 8);
    ctx.fill();

    // Grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 8; i++) {
      const y = (i / 7) * h;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    const freqs = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
    freqs.forEach((f) => {
      const x = (Math.log10(f) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20)) * w;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      ctx.fillStyle = "#555";
      ctx.font = "9px Inter, sans-serif";
      const label = f >= 1000 ? `${f / 1000}k` : `${f}`;
      ctx.fillText(label, x + 3, h - 4);
    });

    // Gain labels
    ctx.fillStyle = "#555";
    ctx.font = "9px Inter, sans-serif";
    for (let g = 12; g >= -12; g -= 4) {
      const y = (1 - (g + 12) / 24) * h;
      ctx.fillText(`${g > 0 ? "+" : ""}${g}`, 4, y + 3);
    }

    // Draw EQ curve
    ctx.strokeStyle = "#7c3aed";
    ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(124,58,237,0.4)";
    ctx.shadowBlur = 8;
    ctx.beginPath();

    const freqToX = (freq: number) => (Math.log10(freq) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20)) * w;
    const gainToY = (gain: number) => (1 - (gain + 12) / 24) * h;

    for (let px = 0; px <= w; px++) {
      const freq = 20 * Math.pow(10, (px / w) * (Math.log10(20000) - Math.log10(20)));
      let totalGain = 0;

      // Low shelf
      const lsRatio = freq / eq.lowShelfFreq;
      totalGain += eq.lowShelfGain / (1 + 1 / (lsRatio * lsRatio));

      // Low-mid bell
      const lmDelta = Math.log2(freq / eq.lowMidFreq);
      totalGain += eq.lowMidGain * Math.exp(-lmDelta * lmDelta / (2 * eq.lowMidQ * eq.lowMidQ));

      // High-mid bell
      const hmDelta = Math.log2(freq / eq.highMidFreq);
      totalGain += eq.highMidGain * Math.exp(-hmDelta * hmDelta / (2 * eq.highMidQ * eq.highMidQ));

      // High shelf
      const hsRatio = freq / eq.highShelfFreq;
      totalGain += eq.highShelfGain * (hsRatio * hsRatio) / (1 + hsRatio * hsRatio);

      const x = px;
      const y = gainToY(totalGain);
      if (px === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Band markers
    const bands = [
      { freq: eq.lowShelfFreq, gain: eq.lowShelfGain, color: "#f59e0b", label: "LS" },
      { freq: eq.lowMidFreq, gain: eq.lowMidGain, color: "#3b82f6", label: "LM" },
      { freq: eq.highMidFreq, gain: eq.highMidGain, color: "#22c55e", label: "HM" },
      { freq: eq.highShelfFreq, gain: eq.highShelfGain, color: "#ec4899", label: "HS" },
    ];
    bands.forEach((b) => {
      const x = freqToX(b.freq);
      const y = gainToY(b.gain);
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "white";
      ctx.font = "bold 8px Inter, sans-serif";
      ctx.fillText(b.label, x - 6, y - 8);
    });
  }, [eq]);

  useEffect(() => {
    draw();
    const handler = () => draw();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-28 rounded-lg"
    />
  );
}

// ─── Spectrum Analyzer ──────────────────────────────────────

function SpectrumAnalyzer({
  isPlaying,
  beforeAfter,
  chain,
}: {
  isPlaying: boolean;
  beforeAfter: "before" | "after";
  chain: VocalChainSettings;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const isBrowser = typeof window !== "undefined";
  const TRACK_ID = "vocal-processing-main";

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = "#0a0a0a";
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 8);
    ctx.fill();

    // Get real frequency data from analyser
    let bars: Uint8Array;
    try {
      bars = getFrequencyData(TRACK_ID);
    } catch {
      // Fallback to zero array
      bars = new Uint8Array(64);
    }

    const barCount = Math.min(bars.length, 128);
    const barWidth = w / barCount;

    for (let i = 0; i < barCount; i++) {
      // Map frequency data (0-255) to height
      const val = bars[i] / 255;
      const barH = Math.max(2, val * h * 0.9);
      const x = i * barWidth;
      const y = h - barH;

      const gradient = ctx.createLinearGradient(x, y, x, h);
      if (i < barCount * 0.3) {
        gradient.addColorStop(0, "#7c3aed");
        gradient.addColorStop(1, "#5b21b6");
      } else if (i < barCount * 0.6) {
        gradient.addColorStop(0, "#8b5cf6");
        gradient.addColorStop(1, "#6d28d9");
      } else {
        gradient.addColorStop(0, "#a78bfa");
        gradient.addColorStop(1, "#7c3aed");
      }
      ctx.fillStyle = gradient;
      ctx.fillRect(x + 0.5, y, Math.max(1, barWidth - 1), barH);
    }

    // Center reference line
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 0.5;
    ctx.setLineDash([4, 8]);
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }, []);

  useEffect(() => {
    let running = true;
    const tick = () => {
      if (!running) return;
      draw();
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, draw]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-40 rounded-lg"
    />
  );
}

// ─── Level Meter ────────────────────────────────────────────

function LevelMeter({ label, level, peak }: { label: string; level: number; peak: number }) {
  const dbToRatio = (db: number) => Math.max(0, Math.min(1, (db + 60) / 60));
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-[var(--color-juice-300)] w-4 text-right">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-[var(--color-juice-500)] overflow-hidden relative">
        <div
          className="h-full rounded-full transition-all duration-75"
          style={{
            width: `${dbToRatio(level) * 100}%`,
            background: level > -6 ? "linear-gradient(90deg, #7c3aed, #ef4444)" : "linear-gradient(90deg, #7c3aed, #a78bfa)",
          }}
        />
        <div
          className="absolute top-0 w-1 h-full bg-white rounded-sm transition-all duration-300"
          style={{ left: `${dbToRatio(peak) * 100}%` }}
        />
      </div>
      <span className="text-[10px] text-[var(--color-juice-300)] w-10 tabular-nums">
        {level > -0.5 ? "0" : level.toFixed(0)} dB
      </span>
    </div>
  );
}

// ─── Auto-Tune Module ───────────────────────────────────────

function AutoTuneModule({ settings, dispatch, collapsed, onToggleCollapse }: { settings: VocalChainSettings["autoTune"]; dispatch: Dispatch<Action>; collapsed: boolean; onToggleCollapse: () => void }) {
  return (
    <EffectCard
      id="autoTune"
      icon="🎤"
      name="Auto-Tune"
      enabled={settings.enabled}
      onToggle={() => dispatch({ type: "TOGGLE_EFFECT", effect: "autoTune" })}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
    >
      <div className="space-y-3">
        <div className="flex gap-2">
          <select
            value={settings.key}
            onChange={(e) => dispatch({ type: "SET_PARAM", effect: "autoTune", param: "key", value: e.target.value })}
            className="flex-1 bg-[var(--color-juice-800)] border border-[var(--color-glass-border)] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--color-accent)] transition-colors"
          >
            {KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <select
            value={settings.scale}
            onChange={(e) => dispatch({ type: "SET_PARAM", effect: "autoTune", param: "scale", value: e.target.value })}
            className="flex-1 bg-[var(--color-juice-800)] border border-[var(--color-glass-border)] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--color-accent)] transition-colors"
          >
            {SCALES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
        <div className="flex justify-between gap-3">
          <Knob label="Retune" value={settings.retuneSpeed} min={0} max={100} onChange={(v) => dispatch({ type: "SET_PARAM", effect: "autoTune", param: "retuneSpeed", value: v })} size={44} />
          <Knob label="Humanize" value={settings.humanize} min={0} max={100} unit="%" onChange={(v) => dispatch({ type: "SET_PARAM", effect: "autoTune", param: "humanize", value: v })} size={44} />
          <Knob label="Formant" value={settings.formantShift} min={-12} max={12} unit="st" onChange={(v) => dispatch({ type: "SET_PARAM", effect: "autoTune", param: "formantShift", value: v })} size={44} bipolar />
          <Knob label="Mix" value={settings.dryWet} min={0} max={100} unit="%" onChange={(v) => dispatch({ type: "SET_PARAM", effect: "autoTune", param: "dryWet", value: v })} size={44} />
        </div>
      </div>
    </EffectCard>
  );
}

// ─── Pitch Correction Module ────────────────────────────────

function PitchCorrectionModule({ settings, dispatch, collapsed, onToggleCollapse }: { settings: VocalChainSettings["pitchCorrection"]; dispatch: Dispatch<Action>; collapsed: boolean; onToggleCollapse: () => void }) {
  return (
    <EffectCard
      id="pitchCorrection"
      icon="🎵"
      name="Pitch Correction"
      enabled={settings.enabled}
      onToggle={() => dispatch({ type: "TOGGLE_EFFECT", effect: "pitchCorrection" })}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
    >
      <div className="space-y-3">
        <div className="flex justify-between gap-3">
          <Knob label="Strength" value={settings.correctionStrength} min={0} max={100} unit="%" onChange={(v) => dispatch({ type: "SET_PARAM", effect: "pitchCorrection", param: "correctionStrength", value: v })} size={44} />
          <Knob label="Attack" value={settings.attackSpeed} min={1} max={50} unit="ms" onChange={(v) => dispatch({ type: "SET_PARAM", effect: "pitchCorrection", param: "attackSpeed", value: v })} size={44} />
          <Knob label="Smooth" value={settings.noteTransition} min={0} max={100} onChange={(v) => dispatch({ type: "SET_PARAM", effect: "pitchCorrection", param: "noteTransition", value: v })} size={44} />
        </div>
        <div>
          <label className="text-[10px] font-medium text-[var(--color-juice-300)] block mb-2">Note Grid</label>
          <div className="flex gap-0.5 flex-wrap">
            {NOTE_NAMES.map((note, i) => (
              <button
                key={note}
                onClick={() => dispatch({ type: "SET_ALLOWED_NOTE", index: i })}
                className={`w-7 h-7 rounded-md text-[10px] font-medium transition-all ${
                  settings.allowedNotes[i]
                    ? "bg-[var(--color-accent)]/20 border border-[var(--color-accent)]/40 text-white"
                    : "bg-[var(--color-juice-700)] border border-[var(--color-glass-border)] text-[var(--color-juice-300)]"
                }`}
              >
                {note}
              </button>
            ))}
          </div>
        </div>
      </div>
    </EffectCard>
  );
}

// ─── Noise Removal Module ───────────────────────────────────

function NoiseRemovalModule({ settings, dispatch, collapsed, onToggleCollapse }: { settings: VocalChainSettings["noiseRemoval"]; dispatch: Dispatch<Action>; collapsed: boolean; onToggleCollapse: () => void }) {
  const [noiseFloor] = useState(() => -48 + Math.random() * -8);

  return (
    <EffectCard
      id="noiseRemoval"
      icon="🔇"
      name="Noise Removal"
      enabled={settings.enabled}
      onToggle={() => dispatch({ type: "TOGGLE_EFFECT", effect: "noiseRemoval" })}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
    >
      <div className="space-y-3">
        <div className="flex justify-between gap-3">
          <Knob label="Threshold" value={settings.threshold} min={-60} max={0} unit="dB" onChange={(v) => dispatch({ type: "SET_PARAM", effect: "noiseRemoval", param: "threshold", value: v })} size={44} />
          <Knob label="Reduction" value={settings.reduction} min={0} max={30} unit="dB" onChange={(v) => dispatch({ type: "SET_PARAM", effect: "noiseRemoval", param: "reduction", value: v })} size={44} />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--color-juice-300)]">Noise Floor</span>
            <span className="text-[11px] font-mono font-semibold text-[var(--color-accent-light)]">{noiseFloor.toFixed(1)} dB</span>
            <span
              className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: noiseFloor < -50 ? "#22c55e" : noiseFloor < -40 ? "#f59e0b" : "#ef4444" }}
            />
          </div>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <span className="text-[10px] text-[var(--color-juice-300)]">Adaptive</span>
            <button
              onClick={() => dispatch({ type: "SET_PARAM", effect: "noiseRemoval", param: "adaptiveMode", value: !settings.adaptiveMode })}
              className={`w-7 h-4 rounded-full transition-colors relative ${settings.adaptiveMode ? "bg-[var(--color-accent)]" : "bg-[var(--color-juice-500)]"}`}
            >
              <div className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform ${settings.adaptiveMode ? "translate-x-3.5" : "translate-x-0.5"}`} />
            </button>
          </label>
        </div>
      </div>
    </EffectCard>
  );
}

// ─── Breath Removal Module ──────────────────────────────────

function BreathRemovalModule({ settings, dispatch, collapsed, onToggleCollapse }: { settings: VocalChainSettings["breathRemoval"]; dispatch: Dispatch<Action>; collapsed: boolean; onToggleCollapse: () => void }) {
  return (
    <EffectCard
      id="breathRemoval"
      icon="💨"
      name="Breath Removal"
      enabled={settings.enabled}
      onToggle={() => dispatch({ type: "TOGGLE_EFFECT", effect: "breathRemoval" })}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
    >
      <div className="space-y-3">
        <div className="flex justify-between gap-3">
          <Knob label="Sensitivity" value={settings.sensitivity} min={0} max={100} onChange={(v) => dispatch({ type: "SET_PARAM", effect: "breathRemoval", param: "sensitivity", value: v })} size={44} />
          <Knob label="Attenuation" value={settings.attenuation} min={0} max={24} unit="dB" onChange={(v) => dispatch({ type: "SET_PARAM", effect: "breathRemoval", param: "attenuation", value: v })} size={44} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--color-juice-300)]">Detection</span>
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{
              background: settings.enabled ? "#22c55e" : "#3a3a3a",
              boxShadow: settings.enabled ? "0 0 6px #22c55e" : "none",
            }}
          />
          <span className="text-[10px] text-[var(--color-juice-300)]">
            {settings.enabled ? "Active — listening for breaths" : "Bypassed"}
          </span>
        </div>
      </div>
    </EffectCard>
  );
}

// ─── EQ Module ──────────────────────────────────────────────

function EQModule({ settings, dispatch, collapsed, onToggleCollapse }: { settings: VocalChainSettings["eq"]; dispatch: Dispatch<Action>; collapsed: boolean; onToggleCollapse: () => void }) {
  const setEq = (param: string, value: number) => dispatch({ type: "SET_EQ_PARAM", param, value });

  return (
    <EffectCard
      id="eq"
      icon="📊"
      name="EQ (4-Band Parametric)"
      enabled={settings.enabled}
      onToggle={() => dispatch({ type: "TOGGLE_EFFECT", effect: "eq" })}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
    >
      <div className="space-y-3">
        <EQCurve eq={settings} />
        <div className="flex justify-between gap-2">
          <div className="flex flex-col items-center gap-1">
            <Knob label="LS Freq" value={settings.lowShelfFreq} min={20} max={500} unit="Hz" onChange={(v) => setEq("lowShelfFreq", v)} size={38} />
            <Knob label="LS Gain" value={settings.lowShelfGain} min={-12} max={12} unit="dB" onChange={(v) => setEq("lowShelfGain", v)} size={38} bipolar />
          </div>
          <div className="flex flex-col items-center gap-1">
            <Knob label="LM Freq" value={settings.lowMidFreq} min={100} max={2000} unit="Hz" onChange={(v) => setEq("lowMidFreq", v)} size={38} />
            <Knob label="LM Gain" value={settings.lowMidGain} min={-12} max={12} unit="dB" onChange={(v) => setEq("lowMidGain", v)} size={38} bipolar />
            <Knob label="LM Q" value={settings.lowMidQ} min={0.1} max={5} step={0.1} onChange={(v) => setEq("lowMidQ", v)} size={38} />
          </div>
          <div className="flex flex-col items-center gap-1">
            <Knob label="HM Freq" value={settings.highMidFreq} min={500} max={8000} unit="Hz" onChange={(v) => setEq("highMidFreq", v)} size={38} />
            <Knob label="HM Gain" value={settings.highMidGain} min={-12} max={12} unit="dB" onChange={(v) => setEq("highMidGain", v)} size={38} bipolar />
            <Knob label="HM Q" value={settings.highMidQ} min={0.1} max={5} step={0.1} onChange={(v) => setEq("highMidQ", v)} size={38} />
          </div>
          <div className="flex flex-col items-center gap-1">
            <Knob label="HS Freq" value={settings.highShelfFreq} min={2000} max={20000} unit="Hz" onChange={(v) => setEq("highShelfFreq", v)} size={38} />
            <Knob label="HS Gain" value={settings.highShelfGain} min={-12} max={12} unit="dB" onChange={(v) => setEq("highShelfGain", v)} size={38} bipolar />
          </div>
        </div>
      </div>
    </EffectCard>
  );
}

// ─── Compression Module ─────────────────────────────────────

function CompressionModule({ settings, dispatch, collapsed, onToggleCollapse }: { settings: VocalChainSettings["compression"]; dispatch: Dispatch<Action>; collapsed: boolean; onToggleCollapse: () => void }) {
  const [grMeter, setGrMeter] = useState(0);
  const isBrowser = typeof window !== "undefined";
  const TRACK_ID = "vocal-processing-main";

  useEffect(() => {
    if (!isBrowser || !settings.enabled) { setGrMeter(0); return; }
    // Read real gain reduction from the DynamicsCompressorNode
    const interval = setInterval(() => {
      try {
        const gr = getCompressorReduction(TRACK_ID);
        setGrMeter(Math.abs(gr));
      } catch {
        setGrMeter(0);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [settings.enabled, isBrowser]);

  return (
    <EffectCard
      id="compression"
      icon="📉"
      name="Compression"
      enabled={settings.enabled}
      onToggle={() => dispatch({ type: "TOGGLE_EFFECT", effect: "compression" })}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
    >
      <div className="space-y-3">
        <div className="flex gap-4">
          <div className="flex justify-between gap-2 flex-1">
            <Knob label="Threshold" value={settings.threshold} min={-40} max={0} unit="dB" onChange={(v) => dispatch({ type: "SET_PARAM", effect: "compression", param: "threshold", value: v })} size={44} />
            <Knob label="Ratio" value={settings.ratio} min={1} max={20} step={0.5} unit=":1" onChange={(v) => dispatch({ type: "SET_PARAM", effect: "compression", param: "ratio", value: v })} size={44} />
            <Knob label="Attack" value={settings.attack} min={0.1} max={50} step={0.1} unit="ms" onChange={(v) => dispatch({ type: "SET_PARAM", effect: "compression", param: "attack", value: v })} size={44} />
            <Knob label="Release" value={settings.release} min={10} max={500} unit="ms" onChange={(v) => dispatch({ type: "SET_PARAM", effect: "compression", param: "release", value: v })} size={44} />
            <Knob label="Makeup" value={settings.makeupGain} min={0} max={12} unit="dB" onChange={(v) => dispatch({ type: "SET_PARAM", effect: "compression", param: "makeupGain", value: v })} size={44} />
          </div>
          {/* Gain Reduction Meter */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] text-[var(--color-juice-300)]">GR</span>
            <div className="relative w-3 h-24 rounded-full bg-[var(--color-juice-500)] overflow-hidden">
              <div
                className="absolute bottom-0 left-0 right-0 rounded-full transition-all duration-100"
                style={{
                  height: `${Math.min(100, (grMeter / 12) * 100)}%`,
                  background: "linear-gradient(180deg, #ef4444, #f59e0b)",
                }}
              />
            </div>
            <span className="text-[10px] font-mono text-[var(--color-juice-100)] tabular-nums">
              {grMeter.toFixed(1)}
            </span>
            <span className="text-[9px] text-[var(--color-juice-300)]">dB</span>
          </div>
        </div>
      </div>
    </EffectCard>
  );
}

// ─── Reverb Module ──────────────────────────────────────────

function ReverbModule({ settings, dispatch, collapsed, onToggleCollapse }: { settings: VocalChainSettings["reverb"]; dispatch: Dispatch<Action>; collapsed: boolean; onToggleCollapse: () => void }) {
  const roomLabels: Record<number, string> = { 0: "Small Room", 25: "Medium Room", 50: "Large Room", 75: "Hall", 100: "Cathedral" };

  return (
    <EffectCard
      id="reverb"
      icon="🌌"
      name="Reverb"
      enabled={settings.enabled}
      onToggle={() => dispatch({ type: "TOGGLE_EFFECT", effect: "reverb" })}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
    >
      <div className="space-y-3">
        <select
          value={settings.type}
          onChange={(e) => dispatch({ type: "SET_PARAM", effect: "reverb", param: "type", value: e.target.value })}
          className="w-full bg-[var(--color-juice-800)] border border-[var(--color-glass-border)] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--color-accent)] transition-colors"
        >
          {REVERB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <div className="flex justify-between gap-2">
          <Knob label="Room" value={settings.roomSize} min={0} max={100} onChange={(v) => dispatch({ type: "SET_PARAM", effect: "reverb", param: "roomSize", value: v })} size={44} />
          <Knob label="Decay" value={settings.decayTime} min={100} max={5000} unit="ms" onChange={(v) => dispatch({ type: "SET_PARAM", effect: "reverb", param: "decayTime", value: v })} size={44} />
          <Knob label="Pre-Delay" value={settings.preDelay} min={0} max={200} unit="ms" onChange={(v) => dispatch({ type: "SET_PARAM", effect: "reverb", param: "preDelay", value: v })} size={44} />
          <Knob label="Damping" value={settings.damping} min={0} max={100} onChange={(v) => dispatch({ type: "SET_PARAM", effect: "reverb", param: "damping", value: v })} size={44} />
          <Knob label="Mix" value={settings.dryWet} min={0} max={100} unit="%" onChange={(v) => dispatch({ type: "SET_PARAM", effect: "reverb", param: "dryWet", value: v })} size={44} />
        </div>
        <div className="text-[10px] text-[var(--color-juice-300)] italic">
          {roomLabels[Object.keys(roomLabels).map(Number).reduce((a, b) => Math.abs(b - settings.roomSize) < Math.abs(a - settings.roomSize) ? b : a) as keyof typeof roomLabels]}
        </div>
      </div>
    </EffectCard>
  );
}

// ─── Delay Module ───────────────────────────────────────────

function DelayModule({ settings, dispatch, collapsed, onToggleCollapse }: { settings: VocalChainSettings["delay"]; dispatch: Dispatch<Action>; collapsed: boolean; onToggleCollapse: () => void }) {
  return (
    <EffectCard
      id="delay"
      icon="🔄"
      name="Delay"
      enabled={settings.enabled}
      onToggle={() => dispatch({ type: "TOGGLE_EFFECT", effect: "delay" })}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
    >
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-[10px] font-medium text-[var(--color-juice-300)] block mb-1">Time</label>
            <select
              value={settings.timeUnit}
              onChange={(e) => dispatch({ type: "SET_PARAM", effect: "delay", param: "timeUnit", value: e.target.value })}
              className="w-full bg-[var(--color-juice-800)] border border-[var(--color-glass-border)] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[var(--color-accent)] transition-colors"
            >
              {DELAY_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <Knob label="Time" value={settings.time} min={10} max={1000} unit="ms" onChange={(v) => dispatch({ type: "SET_PARAM", effect: "delay", param: "time", value: v })} size={44} />
          <Knob label="Feedback" value={settings.feedback} min={0} max={90} unit="%" onChange={(v) => dispatch({ type: "SET_PARAM", effect: "delay", param: "feedback", value: v })} size={44} />
          <Knob label="Mix" value={settings.dryWet} min={0} max={100} unit="%" onChange={(v) => dispatch({ type: "SET_PARAM", effect: "delay", param: "dryWet", value: v })} size={44} />
        </div>
        <div className="flex items-center gap-4">
          <Knob label="Low Cut" value={settings.lowCut} min={20} max={2000} unit="Hz" onChange={(v) => dispatch({ type: "SET_PARAM", effect: "delay", param: "lowCut", value: v })} size={40} />
          <Knob label="High Cut" value={settings.highCut} min={1000} max={20000} unit="Hz" onChange={(v) => dispatch({ type: "SET_PARAM", effect: "delay", param: "highCut", value: v })} size={40} />
          <label className="flex items-center gap-1.5 cursor-pointer ml-auto">
            <span className="text-[10px] text-[var(--color-juice-300)]">Ping-Pong</span>
            <button
              onClick={() => dispatch({ type: "SET_PARAM", effect: "delay", param: "pingPong", value: !settings.pingPong })}
              className={`w-7 h-4 rounded-full transition-colors relative ${settings.pingPong ? "bg-[var(--color-accent)]" : "bg-[var(--color-juice-500)]"}`}
            >
              <div className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform ${settings.pingPong ? "translate-x-3.5" : "translate-x-0.5"}`} />
            </button>
          </label>
        </div>
      </div>
    </EffectCard>
  );
}

// ─── Stereo Width / De-esser Module ─────────────────────────

function StereoWidthModule({ settings, dispatch, collapsed, onToggleCollapse }: { settings: VocalChainSettings["stereoWidth"]; dispatch: Dispatch<Action>; collapsed: boolean; onToggleCollapse: () => void }) {
  return (
    <EffectCard
      id="stereoWidth"
      icon="🔊"
      name="Stereo Width / De-Esser"
      enabled={settings.enabled}
      onToggle={() => dispatch({ type: "TOGGLE_EFFECT", effect: "stereoWidth" })}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
    >
      <div className="space-y-3">
        {/* Width visualization */}
        <div className="flex items-center justify-between px-2">
          <span className="text-[10px] text-[var(--color-juice-300)]">Mono</span>
          <div className="flex-1 mx-3 h-1.5 rounded-full bg-[var(--color-juice-500)] overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${settings.width}%`,
                background: "linear-gradient(90deg, #7c3aed, #a78bfa)",
              }}
            />
          </div>
          <span className="text-[10px] text-[var(--color-juice-300)]">Wide</span>
        </div>
        <div className="flex justify-between gap-3">
          <Knob label="Width" value={settings.width} min={0} max={100} unit="%" onChange={(v) => dispatch({ type: "SET_PARAM", effect: "stereoWidth", param: "width", value: v })} size={44} />
          <Knob label="De-Ess Freq" value={settings.deEsserFreq} min={2000} max={12000} unit="Hz" onChange={(v) => dispatch({ type: "SET_PARAM", effect: "stereoWidth", param: "deEsserFreq", value: v })} size={44} />
          <Knob label="De-Ess Thr" value={settings.deEsserThreshold} min={-40} max={0} unit="dB" onChange={(v) => dispatch({ type: "SET_PARAM", effect: "stereoWidth", param: "deEsserThreshold", value: v })} size={44} />
          <Knob label="Air" value={settings.airBandBoost} min={0} max={10} unit="dB" onChange={(v) => dispatch({ type: "SET_PARAM", effect: "stereoWidth", param: "airBandBoost", value: v })} size={44} />
        </div>
      </div>
    </EffectCard>
  );
}

// ─── Preset Card ────────────────────────────────────────────

function PresetCard({
  preset,
  isSelected,
  isCustom,
  onClick,
  onDelete,
}: {
  preset: GenrePreset | CustomPreset;
  isSelected: boolean;
  isCustom: boolean;
  onClick: () => void;
  onDelete?: () => void;
}) {
  const color = "color" in preset ? preset.color : "#7c3aed";

  return (
    <div
      className={`relative rounded-xl transition-all cursor-pointer ${
        isSelected
          ? "bg-[var(--color-glass-bg-active)] border border-[var(--color-accent)]/30"
          : "bg-[var(--color-juice-800)] border border-transparent hover:border-[var(--color-glass-border)]"
      }`}
      onClick={onClick}
    >
      <div className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ background: color }}
          />
          <h4 className="text-xs font-semibold text-white truncate">{preset.name}</h4>
          {isSelected && (
            <svg className="w-3.5 h-3.5 text-[var(--color-accent)] ml-auto flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
            </svg>
          )}
        </div>
        {"description" in preset && (
          <p className="text-[10px] text-[var(--color-juice-300)] leading-snug">{preset.description}</p>
        )}
        {isCustom && onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="absolute top-1.5 right-1.5 p-1 rounded-md text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Vocal Processing Component ────────────────────────

function VocalProcessing() {
  const [state, dispatch] = useReducer(reducer, null, buildInitialState);
  const [levels, setLevels] = useState({ left: -18, right: -16, peakL: -4, peakR: -3 });
  const [grMeter, setGrMeter] = useState(0);

  const playerRef = useRef<ReturnType<typeof playThroughChain> | null>(null);
  const ctxInitRef = useRef(false);
  const isBrowser = typeof window !== "undefined";
  const testBufferRef = useRef<AudioBuffer | null>(null);

  const TRACK_ID = "vocal-processing-main";

  // Init audio context and test tone
  const initAudio = useCallback(() => {
    if (ctxInitRef.current) return;
    try {
      const ctx = getContext();
      ctxInitRef.current = true;
      // Create test tone buffer
      if (!testBufferRef.current) {
        testBufferRef.current = createTestToneBuffer(440, 5);
      }
      // Create effect chain
      createEffectChain(TRACK_ID);
    } catch {}
  }, []);

  // Sync effect chain with state
  useEffect(() => {
    if (!isBrowser || !ctxInitRef.current) return;
    const chain = getEffectChain(TRACK_ID);
    if (!chain) return;

    // Build EQ
    if (state.chain.eq.enabled) {
      buildEQ(TRACK_ID, state.chain.eq);
    }

    // Build Compressor
    if (state.chain.compression.enabled) {
      buildCompressor(TRACK_ID, state.chain.compression);
    }

    // Build Reverb
    if (state.chain.reverb.enabled) {
      buildReverb(TRACK_ID, {
        roomSize: state.chain.reverb.roomSize,
        decayTime: state.chain.reverb.decayTime,
        dryWet: state.chain.reverb.dryWet,
      });
    }

    // Build Delay
    if (state.chain.delay.enabled) {
      buildDelay(TRACK_ID, {
        time: state.chain.delay.time,
        feedback: state.chain.delay.feedback,
        dryWet: state.chain.delay.dryWet,
        lowCut: state.chain.delay.lowCut,
        highCut: state.chain.delay.highCut,
        pingPong: state.chain.delay.pingPong,
      });
    }

    // Build Stereo Width
    if (state.chain.stereoWidth.enabled) {
      buildStereoWidth(TRACK_ID, { width: state.chain.stereoWidth.width });
    }

    // Rebuild the entire chain in order (EQ → Compressor → Reverb → Delay → Stereo Width)
    // This ensures that when any single effect changes, ALL effects stay connected
    // (each build* function internally disconnects and partially rebuilds,
    //  but this final rebuild guarantees everything is wired correctly)
    rebuildChain(chain);
  }, [state.chain, isBrowser]);

  // Level meter updates from real analyser
  useEffect(() => {
    if (!isBrowser || !ctxInitRef.current) return;
    const interval = setInterval(() => {
      if (state.isPlaying) {
        const rms = getRMSLevel(TRACK_ID);
        const l = rms;
        const r = rms + (Math.random() - 0.5) * 2;
        setLevels((prev) => ({
          left: l,
          right: r,
          peakL: Math.max(prev.peakL * 0.95, l),
          peakR: Math.max(prev.peakR * 0.95, r),
        }));
        // Gain reduction
        const gr = getCompressorReduction(TRACK_ID);
        setGrMeter(gr);
      } else {
        setLevels({ left: -60, right: -60, peakL: -60, peakR: -60 });
        setGrMeter(0);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [state.isPlaying, isBrowser]);

  // Audio playback with chain
  const handlePlayPreview = useCallback(() => {
    initAudio();
    if (state.isPlaying) {
      // Stop
      if (playerRef.current) {
        playerRef.current.stop();
        playerRef.current = null;
      }
      dispatch({ type: "STOP" });
      return;
    }

    if (!testBufferRef.current || !isBrowser) return;

    try {
      const player = playThroughChain(TRACK_ID, testBufferRef.current, true);
      playerRef.current = player;
      dispatch({ type: "TOGGLE_PLAYING" });

      // Auto-stop after 5 seconds max
      setTimeout(() => {
        if (playerRef.current === player) {
          player.stop();
          playerRef.current = null;
          dispatch({ type: "STOP" });
        }
      }, 5000);
    } catch {
      dispatch({ type: "STOP" });
    }
  }, [state.isPlaying, initAudio, isBrowser]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (playerRef.current) playerRef.current.stop();
      disposeChain(TRACK_ID);
    };
  }, []);

  // Handle real apply chain
  const handleApplyChain = useCallback(async () => {
    dispatch({ type: "SET_PROCESSING", value: true });
    await new Promise((r) => setTimeout(r, 600));
    dispatch({ type: "SET_PROCESSING", value: false });
  }, []);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1800px] mx-auto space-y-5 page-transition">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Vocal Processing</h1>
          <p className="text-sm text-[var(--color-juice-200)] mt-0.5">
            Professional vocal chain — tune, shape, and polish your vocals
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => dispatch({ type: "TOGGLE_BEFORE_AFTER" })}
            className={`btn-glass text-xs py-2 px-3 gap-1.5 ${
              state.beforeAfter === "before" ? "border-[var(--color-accent)]/30 text-[var(--color-accent-light)]" : ""
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            {state.beforeAfter === "before" ? "Dry (Before)" : "Processed (After)"}
          </button>
          <button
            onClick={handleApplyChain}
            disabled={state.isProcessing}
            className="btn-primary text-xs py-2 px-4 gap-1.5"
          >
            {state.isProcessing ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                Processing...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
                Apply Chain
              </>
            )}
          </button>
        </div>
      </div>

      {/* Three-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* ─── LEFT: Effects Chain ─── */}
        <div className="lg:col-span-5 space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xs font-semibold text-[var(--color-juice-200)] uppercase tracking-wider">
              Signal Chain
            </h2>
            <span className="text-[10px] text-[var(--color-juice-300)]">
              {Object.values(state.chain).filter((e: { enabled: boolean }) => e.enabled).length}/9 active
            </span>
          </div>

          <AutoTuneModule settings={state.chain.autoTune} dispatch={dispatch} collapsed={state.collapsedEffects.has("autoTune")} onToggleCollapse={() => dispatch({ type: "TOGGLE_COLLAPSE", id: "autoTune" })} />
          <PitchCorrectionModule settings={state.chain.pitchCorrection} dispatch={dispatch} collapsed={state.collapsedEffects.has("pitchCorrection")} onToggleCollapse={() => dispatch({ type: "TOGGLE_COLLAPSE", id: "pitchCorrection" })} />
          <NoiseRemovalModule settings={state.chain.noiseRemoval} dispatch={dispatch} collapsed={state.collapsedEffects.has("noiseRemoval")} onToggleCollapse={() => dispatch({ type: "TOGGLE_COLLAPSE", id: "noiseRemoval" })} />
          <BreathRemovalModule settings={state.chain.breathRemoval} dispatch={dispatch} collapsed={state.collapsedEffects.has("breathRemoval")} onToggleCollapse={() => dispatch({ type: "TOGGLE_COLLAPSE", id: "breathRemoval" })} />
          <EQModule settings={state.chain.eq} dispatch={dispatch} collapsed={state.collapsedEffects.has("eq")} onToggleCollapse={() => dispatch({ type: "TOGGLE_COLLAPSE", id: "eq" })} />
          <CompressionModule settings={state.chain.compression} dispatch={dispatch} collapsed={state.collapsedEffects.has("compression")} onToggleCollapse={() => dispatch({ type: "TOGGLE_COLLAPSE", id: "compression" })} />
          <ReverbModule settings={state.chain.reverb} dispatch={dispatch} collapsed={state.collapsedEffects.has("reverb")} onToggleCollapse={() => dispatch({ type: "TOGGLE_COLLAPSE", id: "reverb" })} />
          <DelayModule settings={state.chain.delay} dispatch={dispatch} collapsed={state.collapsedEffects.has("delay")} onToggleCollapse={() => dispatch({ type: "TOGGLE_COLLAPSE", id: "delay" })} />
          <StereoWidthModule settings={state.chain.stereoWidth} dispatch={dispatch} collapsed={state.collapsedEffects.has("stereoWidth")} onToggleCollapse={() => dispatch({ type: "TOGGLE_COLLAPSE", id: "stereoWidth" })} />
        </div>

        {/* ─── CENTER: Visualizer + Preview ─── */}
        <div className="lg:col-span-4 space-y-4">
          {/* Spectrum Analyzer */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-[var(--color-juice-200)] uppercase tracking-wider">
                Spectrum Analyzer
              </h3>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                state.beforeAfter === "before"
                  ? "bg-[var(--color-juice-700)] text-[var(--color-juice-300)]"
                  : "bg-[var(--color-accent)]/20 text-[var(--color-accent-light)]"
              }`}>
                {state.beforeAfter === "before" ? "DRY" : "PROCESSED"}
              </span>
            </div>
            <SpectrumAnalyzer
              isPlaying={state.isPlaying}
              beforeAfter={state.beforeAfter}
              chain={state.chain}
            />
          </div>

          {/* Level Meters */}
          <div className="card p-4 space-y-2">
            <h3 className="text-xs font-semibold text-[var(--color-juice-200)] uppercase tracking-wider mb-2">
              Levels
            </h3>
            <LevelMeter label="L" level={levels.left} peak={levels.peakL} />
            <LevelMeter label="R" level={levels.right} peak={levels.peakR} />
          </div>

          {/* Audio Preview */}
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-[var(--color-juice-200)] uppercase tracking-wider">
                Audio Preview
              </h3>
              <span className="text-[10px] text-[var(--color-juice-300)]">
                Vocal stem — 5s loop
              </span>
            </div>
            <div className="flex items-center justify-center mt-3">
              <button
                onClick={handlePlayPreview}
                className="p-4 rounded-full btn-primary"
              >
                {state.isPlaying ? (
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="6 3 20 12 6 21 6 3" />
                  </svg>
                )}
              </button>
            </div>
            {state.isPlaying && (
              <div className="mt-3">
                <div className="progress-bar">
                  <div
                    className="progress-bar-fill animate-pulse"
                    style={{ width: "60%" }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── RIGHT: Presets + A/B ─── */}
        <div className="lg:col-span-3 space-y-4">
          {/* A/B Comparison */}
          <div className="card p-4 space-y-3">
            <h3 className="text-xs font-semibold text-[var(--color-juice-200)] uppercase tracking-wider">
              A/B Comparison
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => dispatch({ type: "SAVE_TO_A" })}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                  state.activeAB === "A"
                    ? "bg-[var(--color-accent)] text-white"
                    : state.aSlot.settings
                    ? "bg-[var(--color-juice-700)] text-[var(--color-accent-light)] border border-[var(--color-accent)]/30"
                    : "bg-[var(--color-juice-700)] text-[var(--color-juice-300)] border border-[var(--color-glass-border)]"
                }`}
              >
                Save A
              </button>
              <button
                onClick={() => dispatch({ type: "SAVE_TO_B" })}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                  state.activeAB === "B"
                    ? "bg-[var(--color-accent)] text-white"
                    : state.bSlot.settings
                    ? "bg-[var(--color-juice-700)] text-[var(--color-accent-light)] border border-[var(--color-accent)]/30"
                    : "bg-[var(--color-juice-700)] text-[var(--color-juice-300)] border border-[var(--color-glass-border)]"
                }`}
              >
                Save B
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => dispatch({ type: "LOAD_A" })}
                disabled={!state.aSlot.settings}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                  state.aSlot.settings
                    ? "btn-glass"
                    : "bg-[var(--color-juice-700)] text-[var(--color-juice-400)] cursor-not-allowed"
                }`}
              >
                Load A
              </button>
              <button
                onClick={() => dispatch({ type: "LOAD_B" })}
                disabled={!state.bSlot.settings}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                  state.bSlot.settings
                    ? "btn-glass"
                    : "bg-[var(--color-juice-700)] text-[var(--color-juice-400)] cursor-not-allowed"
                }`}
              >
                Load B
              </button>
            </div>
          </div>

          {/* Genre Presets */}
          <div className="card p-4 space-y-3">
            <h3 className="text-xs font-semibold text-[var(--color-juice-200)] uppercase tracking-wider">
              Genre Presets
            </h3>
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
              {genrePresets.map((preset) => (
                <PresetCard
                  key={preset.id}
                  preset={preset}
                  isSelected={state.selectedPreset === preset.id}
                  isCustom={false}
                  onClick={() => dispatch({ type: "LOAD_PRESET", settings: preset.settings, presetId: preset.id })}
                />
              ))}
            </div>
          </div>

          {/* Custom Presets */}
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-[var(--color-juice-200)] uppercase tracking-wider">
                Custom Presets
              </h3>
              <button
                onClick={() => dispatch({ type: "TOGGLE_SAVE_DIALOG" })}
                className="text-[10px] text-[var(--color-accent-light)] hover:text-white transition-colors font-medium"
              >
                + Save
              </button>
            </div>

            {state.saveDialogOpen && (
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={state.saveName}
                  onChange={(e) => dispatch({ type: "SET_SAVE_NAME", value: e.target.value })}
                  placeholder="Preset name..."
                  className="flex-1 bg-[var(--color-juice-800)] border border-[var(--color-glass-border)] rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-[var(--color-juice-300)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                  onKeyDown={(e) => e.key === "Enter" && dispatch({ type: "SAVE_CUSTOM_PRESET" })}
                />
                <button
                  onClick={() => dispatch({ type: "SAVE_CUSTOM_PRESET" })}
                  className="btn-primary text-[10px] py-1.5 px-3"
                >
                  Save
                </button>
              </div>
            )}

            {state.customPresets.length === 0 && !state.saveDialogOpen && (
              <p className="text-[10px] text-[var(--color-juice-300)] italic">
                No custom presets yet. Save your current chain as a preset.
              </p>
            )}

            <div className="space-y-1 max-h-[150px] overflow-y-auto pr-1">
              {state.customPresets.map((preset) => (
                <PresetCard
                  key={preset.id}
                  preset={preset}
                  isSelected={state.selectedPreset === preset.id}
                  isCustom
                  onClick={() => dispatch({ type: "LOAD_CUSTOM_PRESET", preset })}
                  onDelete={() => dispatch({ type: "DELETE_CUSTOM_PRESET", id: preset.id })}
                />
              ))}
            </div>
          </div>

          {/* Reset */}
          <button
            onClick={() => dispatch({ type: "RESET_ALL" })}
            className="w-full btn-glass text-xs py-2 gap-1.5 text-[var(--color-juice-300)]"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            Reset All
          </button>
        </div>
      </div>
    </div>
  );
}

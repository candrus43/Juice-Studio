import { createFileRoute } from "@tanstack/react-router";
import { useReducer, useRef, useEffect, useCallback, useState } from "react";
import type {
  ArtworkType, ArtworkStyle, TextPosition, FontStyle, TextColor, Resolution,
  ArtworkItem, ArtworkColorPalette, ArtworkStyleDef,
} from "../data/mock";

// ─── Types ──────────────────────────────────────────────────

interface State {
  // Generator inputs
  artworkType: ArtworkType;
  style: ArtworkStyle;
  prompt: string;
  colorPaletteId: string;
  variationCount: number;
  // Text overlay
  artistName: string;
  title: string;
  textPosition: TextPosition;
  fontStyle: FontStyle;
  textColor: TextColor;
  // Resolution
  resolution: Resolution;
  // UI state
  isGenerating: boolean;
  fullscreen: boolean;
  // Results
  variations: ArtworkItem[];
  selectedVariationIdx: number;
  history: ArtworkItem[];
  // Canvas drawing seed
  seed: number;
}

type Action =
  | { type: "SET_ARTWORK_TYPE"; value: ArtworkType }
  | { type: "SET_STYLE"; value: ArtworkStyle }
  | { type: "SET_PROMPT"; value: string }
  | { type: "SET_COLOR_PALETTE"; value: string }
  | { type: "SET_VARIATION_COUNT"; value: number }
  | { type: "SET_ARTIST_NAME"; value: string }
  | { type: "SET_TITLE"; value: string }
  | { type: "SET_TEXT_POSITION"; value: TextPosition }
  | { type: "SET_FONT_STYLE"; value: FontStyle }
  | { type: "SET_TEXT_COLOR"; value: TextColor }
  | { type: "SET_RESOLUTION"; value: Resolution }
  | { type: "START_GENERATING" }
  | { type: "GENERATION_COMPLETE"; variations: ArtworkItem[]; seed: number }
  | { type: "SELECT_VARIATION"; idx: number }
  | { type: "SET_FULLSCREEN"; value: boolean }
  | { type: "SET_HISTORY"; history: ArtworkItem[] }
  | { type: "REGENERATE_SEED"; seed: number };

const initialState: State = {
  artworkType: "Album",
  style: "dark",
  prompt: "",
  colorPaletteId: "purple-haze",
  variationCount: 4,
  artistName: "King Juice",
  title: "LATE NIGHTS",
  textPosition: "center",
  fontStyle: "bold",
  textColor: "white",
  resolution: "3000x3000",
  isGenerating: false,
  fullscreen: false,
  variations: [],
  selectedVariationIdx: 0,
  history: [],
  seed: 42,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_ARTWORK_TYPE": return { ...state, artworkType: action.value };
    case "SET_STYLE": return { ...state, style: action.value };
    case "SET_PROMPT": return { ...state, prompt: action.value };
    case "SET_COLOR_PALETTE": return { ...state, colorPaletteId: action.value };
    case "SET_VARIATION_COUNT": return { ...state, variationCount: action.value };
    case "SET_ARTIST_NAME": return { ...state, artistName: action.value };
    case "SET_TITLE": return { ...state, title: action.value };
    case "SET_TEXT_POSITION": return { ...state, textPosition: action.value };
    case "SET_FONT_STYLE": return { ...state, fontStyle: action.value };
    case "SET_TEXT_COLOR": return { ...state, textColor: action.value };
    case "SET_RESOLUTION": return { ...state, resolution: action.value };
    case "START_GENERATING": return { ...state, isGenerating: true };
    case "GENERATION_COMPLETE": return { ...state, isGenerating: false, variations: action.variations, selectedVariationIdx: 0, seed: action.seed };
    case "SELECT_VARIATION": return { ...state, selectedVariationIdx: action.idx };
    case "SET_FULLSCREEN": return { ...state, fullscreen: action.value };
    case "SET_HISTORY": return { ...state, history: action.history };
    case "REGENERATE_SEED": return { ...state, seed: action.seed };
    default: return state;
  }
}

// ─── Constants ──────────────────────────────────────────────

const ARTWORK_TYPES: { id: ArtworkType; label: string; icon: string }[] = [
  { id: "Single", label: "Single", icon: "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" },
  { id: "Album", label: "Album", icon: "M12 2a10 10 0 1010 10A10 10 0 0012 2zm0 18a8 8 0 118-8 8 8 0 01-8 8zm0-14a6 6 0 106 6 6 6 0 00-6-6z" },
  { id: "EP", label: "EP", icon: "M12 2a10 10 0 00-9.95 9h19.9A10 10 0 0012 2zM2 12a10 10 0 0017.07 7.07l-3.54-3.54M12 20a8 8 0 01-5.66-13.66L9.88 9.88" },
  { id: "Thumbnail", label: "Thumbnail", icon: "M4 4h16v16H4V4zm2 2v12h12V6H6z M8 10l3 3 2-2 3 4H8z" },
];

const VARIATION_COUNTS = [2, 4, 6];
const RESOLUTIONS: { id: Resolution; label: string; desc: string }[] = [
  { id: "1500x1500", label: "1500×1500", desc: "Standard" },
  { id: "3000x3000", label: "3000×3000", desc: "Hi-Res Square" },
  { id: "3000x2550", label: "3000×2550", desc: "Landscape" },
];
const TEXT_POSITIONS: { id: TextPosition; label: string }[] = [
  { id: "top", label: "Top" },
  { id: "center", label: "Center" },
  { id: "bottom", label: "Bottom" },
];
const FONT_STYLES: { id: FontStyle; label: string }[] = [
  { id: "bold", label: "Bold" },
  { id: "minimal", label: "Minimal" },
  { id: "handwritten", label: "Handwritten" },
  { id: "gothic", label: "Gothic" },
];
const TEXT_COLORS: { id: TextColor; label: string; hex: string }[] = [
  { id: "white", label: "White", hex: "#ffffff" },
  { id: "gold", label: "Gold", hex: "#d4a574" },
  { id: "black", label: "Black", hex: "#000000" },
  { id: "accent", label: "Accent", hex: "#7c3aed" },
];

// These are available globally from the mock data imports
// but we'll define local copies for direct render reference
const STYLES: ArtworkStyleDef[] = [
  { id: "dark", name: "Dark & Moody", icon: "", color: "#7c3aed" },
  { id: "minimal", name: "Minimalist", icon: "", color: "#888888" },
  { id: "abstract", name: "Abstract", icon: "", color: "#f59e0b" },
  { id: "photorealistic", name: "Photorealistic", icon: "", color: "#10b981" },
  { id: "anime", name: "Anime", icon: "", color: "#ec4899" },
  { id: "3d-render", name: "3D Render", icon: "", color: "#06b6d4" },
  { id: "grunge", name: "Grunge", icon: "", color: "#ef4444" },
  { id: "vintage", name: "Vintage", icon: "", color: "#d4a574" },
  { id: "neon", name: "Neon", icon: "", color: "#22d3ee" },
  { id: "paint", name: "Paint", icon: "", color: "#f97316" },
];

const PALETTES: ArtworkColorPalette[] = [
  { id: "dark-gold", name: "Dark + Gold", colors: ["#0a0a0a", "#1a1a2e", "#d4a574", "#b8860b", "#ffd700"] },
  { id: "purple-haze", name: "Purple Haze", colors: ["#0a0a0a", "#1a1025", "#7c3aed", "#a78bfa", "#c084fc"] },
  { id: "neon-nights", name: "Neon Nights", colors: ["#0a0a20", "#1a0a2e", "#22d3ee", "#ec4899", "#7c3aed"] },
  { id: "minimal-white", name: "Minimal White", colors: ["#ffffff", "#f5f5f5", "#e5e5e5", "#d4d4d4", "#a3a3a3"] },
  { id: "earth-tones", name: "Earth Tones", colors: ["#1c1917", "#292524", "#78716c", "#a8a29e", "#d6d3d1"] },
  { id: "vaporwave", name: "Vaporwave", colors: ["#0a0a2e", "#1a0030", "#ff6ec7", "#00d4ff", "#7c3aed"] },
  { id: "fire-ice", name: "Fire & Ice", colors: ["#0a0a0a", "#1a0000", "#ef4444", "#f97316", "#3b82f6"] },
  { id: "monochrome", name: "Monochrome", colors: ["#000000", "#1a1a1a", "#333333", "#666666", "#999999"] },
];

const PROMPT_EXAMPLES = [
  "Dark throne with crown",
  "Neon city at night",
  "Abstract purple waves",
  "Crown made of fire",
  "Dripping gold on black",
  "Smoke and shadows",
  "Diamond in the rough",
  "Midnight skyline",
];

// ─── Canvas Drawing Helpers ─────────────────────────────────

function createRng(seed: number): () => number {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

function rgbaFromHex(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  if (h.length < 6) return `rgba(124,58,237,${alpha})`;
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function lighterHex(hex: string, amount: number): string {
  const h = hex.replace("#", "");
  if (h.length < 6) return hex;
  const r = Math.min(255, parseInt(h.substring(0, 2), 16) + amount);
  const g = Math.min(255, parseInt(h.substring(2, 4), 16) + amount);
  const b = Math.min(255, parseInt(h.substring(4, 6), 16) + amount);
  return `rgb(${r},${g},${b})`;
}

function addNoiseTexture(ctx: CanvasRenderingContext2D, w: number, h: number, rng: () => number, alpha: number) {
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const step = Math.max(1, Math.floor(w / 100));
  for (let i = 0; i < data.length; i += 4 * step) {
    const noise = (rng() - 0.5) * alpha * 255;
    data[i] = Math.min(255, Math.max(0, data[i] + noise));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
  }
  ctx.putImageData(imageData, 0, 0);
}

function drawArtOnCanvas(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  style: string, colors: string[], seed: number,
) {
  const rng = createRng(seed);
  ctx.clearRect(0, 0, w, h);

  // Background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, w * 0.7, h);
  bgGrad.addColorStop(0, colors[0] || "#0a0a0a");
  bgGrad.addColorStop(0.5, colors[1] || colors[0] || "#111111");
  bgGrad.addColorStop(1, colors[2] || "#0a0a0a");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  switch (style) {
    case "dark": {
      const cx = w * (0.3 + rng() * 0.4), cy = h * (0.3 + rng() * 0.4);
      const glow = ctx.createRadialGradient(cx, cy, w * 0.05, cx, cy, w * 0.7);
      glow.addColorStop(0, colors[3] ? colors[3] + "40" : "#7c3aed40");
      glow.addColorStop(0.5, (colors[2] || "#7c3aed") + "15");
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
      // Crown
      ctx.fillStyle = rgbaFromHex(colors[4] || "#7c3aed", 0.15);
      ctx.beginPath();
      const crx = w * 0.5, cry = h * 0.3, cr = w * 0.2;
      ctx.moveTo(crx - cr, cry + cr); ctx.lineTo(crx - cr, cry);
      ctx.lineTo(crx - cr * 0.6, cry - cr * 0.4); ctx.lineTo(crx - cr * 0.3, cry);
      ctx.lineTo(crx, cry - cr * 0.5); ctx.lineTo(crx + cr * 0.3, cry);
      ctx.lineTo(crx + cr * 0.6, cry - cr * 0.4); ctx.lineTo(crx + cr, cry);
      ctx.lineTo(crx + cr, cry + cr); ctx.closePath(); ctx.fill();
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = rgbaFromHex(colors[2] || "#555555", 0.06 + rng() * 0.06);
        ctx.beginPath();
        ctx.ellipse(w * (0.1 + rng() * 0.8), h * (0.5 + rng() * 0.4), w * (0.05 + rng() * 0.15), h * (0.02 + rng() * 0.05), rng() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "minimal": {
      const accent = colors[2] || "#7c3aed";
      ctx.fillStyle = rgbaFromHex(accent, 0.08 + rng() * 0.1);
      ctx.beginPath(); ctx.arc(w * 0.5, h * 0.45, w * 0.25, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = rgbaFromHex(colors[4] || accent, 0.15 + i * 0.05); ctx.lineWidth = 1 + i * 0.5;
        ctx.beginPath(); ctx.moveTo(w * 0.25, h * (0.55 + i * 0.12)); ctx.lineTo(w * 0.75, h * (0.55 + i * 0.12)); ctx.stroke();
      }
      ctx.fillStyle = rgbaFromHex(accent, 0.4);
      ctx.beginPath(); ctx.arc(w * 0.35, h * 0.35, w * 0.02, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case "abstract": {
      for (let i = 0; i < 14; i++) {
        ctx.fillStyle = rgbaFromHex(colors[Math.floor(rng() * colors.length)], 0.05 + rng() * 0.12);
        ctx.beginPath();
        ctx.ellipse(w * rng(), h * rng(), w * (0.05 + rng() * 0.3), h * (0.05 + rng() * 0.3), rng() * Math.PI * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 0; i < 4; i++) {
        const x = w * (0.2 + rng() * 0.6), dripLen = h * (0.1 + rng() * 0.4);
        const color = colors[3] || colors[2] || "#7c3aed";
        const grad = ctx.createLinearGradient(x, 0, x, dripLen);
        grad.addColorStop(0, rgbaFromHex(color, 0.3)); grad.addColorStop(1, "transparent");
        ctx.strokeStyle = grad; ctx.lineWidth = 2 + rng() * 4;
        ctx.beginPath(); ctx.moveTo(x, h * 0.1); ctx.lineTo(x, h * 0.1 + dripLen); ctx.stroke();
        ctx.fillStyle = rgbaFromHex(color, 0.2);
        ctx.beginPath(); ctx.arc(x, h * 0.1 + dripLen, 3 + rng() * 6, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case "photorealistic": {
      for (let i = 0; i < 30; i++) {
        ctx.fillStyle = rgbaFromHex(colors[Math.floor(rng() * colors.length)] || "#ffffff", 0.02 + rng() * 0.1);
        ctx.beginPath(); ctx.arc(w * rng(), h * rng(), w * (0.01 + rng() * 0.06), 0, Math.PI * 2); ctx.fill();
      }
      const flare = ctx.createRadialGradient(w * 0.2, h * 0.3, w * 0.02, w * 0.2, h * 0.3, w * 0.4);
      flare.addColorStop(0, "rgba(255,255,255,0.08)"); flare.addColorStop(1, "transparent");
      ctx.fillStyle = flare; ctx.fillRect(0, 0, w, h);
      break;
    }
    case "anime": {
      for (let i = 0; i < 10; i++) {
        const color = colors[Math.floor(rng() * colors.length)];
        const bx = w * rng(), by = h * rng();
        ctx.fillStyle = rgbaFromHex(color, 0.1 + rng() * 0.15);
        ctx.fillRect(bx, by, w * (0.08 + rng() * 0.2), h * (0.08 + rng() * 0.15));
        ctx.strokeStyle = rgbaFromHex(color, 0.3); ctx.lineWidth = 1;
        ctx.strokeRect(bx, by, w * (0.08 + rng() * 0.2), h * (0.08 + rng() * 0.15));
      }
      for (let i = 0; i < 8; i++) {
        const sx = w * rng(), sy = h * rng(), sz = 4 + rng() * 10;
        ctx.save(); ctx.translate(sx, sy);
        ctx.fillStyle = rgbaFromHex(colors[3] || "#ffffff", 0.3 + rng() * 0.3);
        ctx.beginPath();
        for (let j = 0; j < 4; j++) {
          const a = (j * Math.PI) / 2;
          ctx.lineTo(Math.cos(a) * sz, Math.sin(a) * sz);
          ctx.lineTo(Math.cos(a + 0.4) * sz * 0.4, Math.sin(a + 0.4) * sz * 0.4);
        }
        ctx.closePath(); ctx.fill(); ctx.restore();
      }
      break;
    }
    case "3d-render": {
      for (let i = 0; i < 6; i++) {
        const sx = w * (0.15 + rng() * 0.7), sy = h * (0.15 + rng() * 0.7), sr = w * (0.06 + rng() * 0.18);
        const color = colors[Math.floor(rng() * colors.length)];
        const lg = ctx.createRadialGradient(sx - sr * 0.25, sy - sr * 0.25, sr * 0.05, sx, sy, sr);
        lg.addColorStop(0, lighterHex(color, 80)); lg.addColorStop(0.5, rgbaFromHex(color, 0.3)); lg.addColorStop(1, rgbaFromHex(color, 0.02));
        ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case "grunge": {
      const acc = colors[3] || colors[2] || "#ef4444";
      for (let i = 0; i < 7; i++) {
        ctx.fillStyle = rgbaFromHex(acc, 0.04 + rng() * 0.08);
        ctx.fillRect(0, h * (0.05 + i * 0.14), w, h * (0.02 + rng() * 0.06));
      }
      ctx.strokeStyle = rgbaFromHex(acc, 0.2); ctx.lineWidth = 3 + rng() * 2;
      ctx.beginPath();
      const rrx = w * 0.35, rry = h * 0.5, rrr = w * 0.2;
      for (let a = 0; a < Math.PI * 2; a += 0.1) {
        const jx = rrx + Math.cos(a) * (rrr + rng() * 15), jy = rry + Math.sin(a) * (rrr * 0.8 + rng() * 15);
        if (a === 0) ctx.moveTo(jx, jy); else ctx.lineTo(jx, jy);
      }
      ctx.closePath(); ctx.stroke();
      for (let i = 0; i < 50; i++) {
        ctx.fillStyle = rgbaFromHex(colors[0] || "#000000", 0.05 + rng() * 0.15);
        ctx.fillRect(w * rng(), h * rng(), 1 + rng() * 4, 1 + rng() * 4);
      }
      break;
    }
    case "vintage": {
      ctx.fillStyle = "rgba(212, 165, 116, 0.08)"; ctx.fillRect(0, 0, w, h);
      const gold = colors[4] || "#d4a574";
      for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = rgbaFromHex(gold, 0.08 + i * 0.03); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(w * 0.5, h * 0.4, w * (0.15 + i * 0.08), 0, Math.PI * 2); ctx.stroke();
      }
      const dotR2 = w * 0.25;
      for (let i = 0; i < 24; i++) {
        const angle = (i / 24) * Math.PI * 2;
        ctx.fillStyle = rgbaFromHex(gold, 0.2);
        ctx.beginPath(); ctx.arc(w * 0.5 + Math.cos(angle) * dotR2, h * 0.4 + Math.sin(angle) * dotR2, 2 + rng() * 3, 0, Math.PI * 2); ctx.fill();
      }
      addNoiseTexture(ctx, w, h, rng, 0.06);
      break;
    }
    case "neon": {
      const nc = [colors[2] || "#22d3ee", colors[3] || "#ec4899", colors[4] || "#7c3aed"];
      ctx.strokeStyle = rgbaFromHex(nc[0], 0.05); ctx.lineWidth = 0.5;
      const gs = w / 16;
      for (let x = gs; x < w; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = gs; y < h; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      for (let i = 0; i < 5; i++) {
        const ncc = nc[Math.floor(rng() * nc.length)];
        ctx.shadowColor = ncc; ctx.shadowBlur = 15 + rng() * 25;
        ctx.strokeStyle = ncc; ctx.lineWidth = 1.5 + rng() * 2;
        ctx.beginPath();
        const nx = w * (0.1 + rng() * 0.8), ny = h * (0.1 + rng() * 0.8);
        ctx.moveTo(nx, ny); ctx.lineTo(nx + w * (0.1 + rng() * 0.3), ny + h * (0.05 + rng() * 0.2)); ctx.stroke();
        ctx.shadowBlur = 0;
      }
      for (let i = 0; i < 4; i++) {
        const ncc = nc[Math.floor(rng() * nc.length)];
        ctx.shadowColor = ncc; ctx.shadowBlur = 10 + rng() * 15;
        ctx.strokeStyle = ncc; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(w * rng(), h * rng(), w * (0.03 + rng() * 0.1), 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;
      }
      break;
    }
    case "paint": {
      const accent = colors[2] || "#f97316";
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = rgbaFromHex(colors[Math.floor(rng() * colors.length)], 0.08 + rng() * 0.15);
        ctx.beginPath();
        ctx.ellipse(w * (0.05 + rng() * 0.9), h * (0.05 + rng() * 0.9), w * (0.05 + rng() * 0.2), w * (0.02 + rng() * 0.08), rng() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 0; i < 70; i++) {
        ctx.fillStyle = rgbaFromHex(accent, 0.03 + rng() * 0.2);
        ctx.beginPath(); ctx.arc(w * rng(), h * rng(), 1 + rng() * 8, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
  }

  // Vignette
  const vg = ctx.createRadialGradient(w / 2, h / 2, w * 0.35, w / 2, h / 2, w * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
}

function drawTextOnCanvas(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  artistName: string, title: string,
  position: TextPosition, fontStyle: FontStyle, textColor: TextColor,
) {
  let textY: number;
  if (position === "top") textY = w * 0.12;
  else if (position === "bottom") textY = w * 0.85;
  else textY = w * (title.length > 12 ? 0.44 : 0.48);

  let colorStr: string;
  if (textColor === "gold") colorStr = "#d4a574";
  else if (textColor === "accent") colorStr = "#7c3aed";
  else if (textColor === "black") colorStr = "#000000";
  else colorStr = "#ffffff";

  let fontFamily: string;
  if (fontStyle === "gothic") fontFamily = "'Times New Roman', 'Georgia', serif";
  else if (fontStyle === "handwritten") fontFamily = "'Brush Script MT', 'Segoe Script', cursive";
  else fontFamily = "'Inter', 'Helvetica Neue', sans-serif";

  const maxTitleLen = 16;
  const scale = Math.min(1, maxTitleLen / Math.max(1, title.length));
  const titleSize = Math.max(14, w * 0.08 * scale);
  const artistSize = Math.max(8, w * 0.035);

  // Title shadow
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = titleSize * 0.15;
  ctx.fillStyle = colorStr;
  ctx.font = `${fontStyle === "bold" ? "900" : "600"} ${titleSize}px ${fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(title.toUpperCase(), w / 2, textY);
  ctx.shadowBlur = 0;

  // Artist
  const artistY = position === "top" ? textY + titleSize * 0.9 : position === "bottom" ? textY - titleSize * 0.9 : textY + titleSize * 0.75;
  ctx.font = `${fontStyle === "bold" ? "700" : "400"} ${artistSize}px ${fontFamily}`;
  ctx.fillStyle = rgbaFromHex(colorStr, 0.7);
  ctx.fillText(artistName, w / 2, artistY);
}

// ─── Component ──────────────────────────────────────────────

export const Route = createFileRoute("/cover-art-studio")({
  component: CoverArtStudio,
});

function CoverArtStudio() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const thumbRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const [canvasSize, setCanvasSize] = useState(500);

  const palette = PALETTES.find((p) => p.id === state.colorPaletteId) || PALETTES[0];

  // Draw main canvas
  useEffect(() => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const size = Math.min(canvas.parentElement?.clientWidth || 500, 500);
    setCanvasSize(size);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const artSeed = state.variations[state.selectedVariationIdx]
      ? state.seed + state.selectedVariationIdx * 113
      : state.seed;

    drawArtOnCanvas(ctx, size, size, state.style, palette.colors, artSeed);
    drawTextOnCanvas(ctx, size, size, state.artistName, state.title, state.textPosition, state.fontStyle, state.textColor);
  }, [state.style, state.colorPaletteId, state.seed, state.selectedVariationIdx, state.variations, state.artistName, state.title, state.textPosition, state.fontStyle, state.textColor, palette.colors]);

  // Draw thumbnail canvases
  useEffect(() => {
    thumbRefs.current.forEach((thumbCanvas, idx) => {
      if (!thumbCanvas) return;
      const dpr = window.devicePixelRatio || 1;
      const size = 120;
      thumbCanvas.width = size * dpr;
      thumbCanvas.height = size * dpr;
      thumbCanvas.style.width = `${size}px`;
      thumbCanvas.style.height = `${size}px`;
      const ctx = thumbCanvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);

      const variationSeed = state.seed + idx * 113;
      // Slightly vary the style per variation
      const styleIdx = STYLES.findIndex((s) => s.id === state.style);
      const variationStyle = STYLES[Math.max(0, (styleIdx + idx) % STYLES.length)].id;

      drawArtOnCanvas(ctx, size, size, variationStyle, palette.colors, variationSeed);
    });
  }, [state.seed, state.style, state.colorPaletteId, palette.colors, state.variations]);

  const handleGenerate = useCallback(async () => {
    dispatch({ type: "START_GENERATING" });
    // Simulate generation delay
    await new Promise((r) => setTimeout(r, 2000));
    const seed = Date.now();
    const count = state.variationCount;
    const titleNames = ["Late Nights", "Crown Heavy", "No Limits", "Sauce Walk", "Drip Season", "New Heat"];
    const now = new Date().toISOString();
    const variations: ArtworkItem[] = [];
    for (let i = 0; i < count; i++) {
      variations.push({
        id: `art-gen-${seed}-${i}`,
        name: `${titleNames[i % titleNames.length]} v${i + 1}`,
        artworkType: state.artworkType,
        style: state.style,
        prompt: state.prompt || "Generated artwork",
        colorPaletteId: state.colorPaletteId,
        textOverlay: { artistName: state.artistName, title: state.title, position: state.textPosition, fontStyle: state.fontStyle, textColor: state.textColor },
        resolution: state.resolution,
        generatedAt: now,
      });
    }
    dispatch({ type: "GENERATION_COMPLETE", variations, seed });
    // Add to history
    dispatch({ type: "SET_HISTORY", history: [...state.history, variations[0]] });
  }, [state]);

  // Load history on mount
  useEffect(() => {
    const history: ArtworkItem[] = [
      { id: "art-001", name: "Late Nights Cover", artworkType: "Album", style: "dark", prompt: "dark atmospheric trap album cover", colorPaletteId: "purple-haze", textOverlay: { artistName: "King Juice", title: "LATE NIGHTS", position: "center", fontStyle: "bold", textColor: "white" }, resolution: "3000x3000", generatedAt: "2026-07-16T14:30:00Z" },
      { id: "art-002", name: "Crown Heavy Art", artworkType: "Single", style: "minimal", prompt: "minimal crown on black", colorPaletteId: "dark-gold", textOverlay: { artistName: "King Juice", title: "CROWN HEAVY", position: "center", fontStyle: "gothic", textColor: "gold" }, resolution: "3000x3000", generatedAt: "2026-07-14T10:15:00Z" },
      { id: "art-003", name: "Sauce Walk Art", artworkType: "Single", style: "abstract", prompt: "abstract drip effect", colorPaletteId: "neon-nights", textOverlay: { artistName: "King Juice", title: "SAUCE WALK", position: "bottom", fontStyle: "handwritten", textColor: "white" }, resolution: "1500x1500", generatedAt: "2026-07-12T18:00:00Z" },
      { id: "art-004", name: "No Limits Art", artworkType: "EP", style: "neon", prompt: "breaking chains neon", colorPaletteId: "neon-nights", textOverlay: { artistName: "King Juice", title: "NO LIMITS", position: "center", fontStyle: "bold", textColor: "accent" }, resolution: "3000x2550", generatedAt: "2026-07-08T22:45:00Z" },
    ];
    dispatch({ type: "SET_HISTORY", history });
  }, []);

  const handleDownload = useCallback(() => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${state.title.toLowerCase().replace(/\s+/g, "_")}_cover.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, [state.title]);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6 page-transition">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Cover Art Studio</h1>
          <p className="text-sm text-[var(--color-juice-200)] mt-1">Generate professional AI artwork for your releases</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => dispatch({ type: "REGENERATE_SEED", seed: Date.now() })} className="btn-glass text-xs" title="Regenerate">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ─── LEFT PANEL: Generator ─── */}
        <div className="lg:col-span-3 space-y-4">
          {/* Artwork Type */}
          <div>
            <h3 className="text-xs font-semibold text-[var(--color-juice-200)] uppercase tracking-wider mb-2">Artwork Type</h3>
            <div className="grid grid-cols-4 gap-1">
              {ARTWORK_TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => dispatch({ type: "SET_ARTWORK_TYPE", value: t.id })}
                  className={`p-2 rounded-lg text-center transition-all text-xs ${
                    state.artworkType === t.id
                      ? "bg-[var(--color-accent)]/20 border border-[var(--color-accent)]/40 text-white"
                      : "card-hover text-[var(--color-juice-200)]"
                  }`}
                >
                  <svg className="w-4 h-4 mx-auto mb-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d={t.icon} />
                  </svg>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Style */}
          <div>
            <h3 className="text-xs font-semibold text-[var(--color-juice-200)] uppercase tracking-wider mb-2">Style</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => dispatch({ type: "SET_STYLE", value: s.id })}
                  className={`flex items-center gap-2 p-2 rounded-lg text-xs transition-all ${
                    state.style === s.id
                      ? "bg-[var(--color-accent)]/20 border border-[var(--color-accent)]/40 text-white"
                      : "card-hover text-[var(--color-juice-200)]"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt */}
          <div>
            <h3 className="text-xs font-semibold text-[var(--color-juice-200)] uppercase tracking-wider mb-2">Prompt</h3>
            <textarea
              value={state.prompt}
              onChange={(e) => dispatch({ type: "SET_PROMPT", value: e.target.value })}
              placeholder="Describe the artwork you want..."
              className="w-full bg-[var(--color-juice-700)] border border-[var(--color-glass-border)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[var(--color-juice-300)] outline-none focus:border-[var(--color-accent)] resize-none h-20"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {PROMPT_EXAMPLES.slice(0, 6).map((ex, i) => (
                <button
                  key={i}
                  onClick={() => dispatch({ type: "SET_PROMPT", value: ex })}
                  className="text-[10px] px-2 py-1 rounded-full bg-[var(--color-glass-bg)] border border-[var(--color-glass-border)] text-[var(--color-juice-200)] hover:text-white hover:border-[var(--color-accent)]/30 transition-all"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {/* Color Palette */}
          <div>
            <h3 className="text-xs font-semibold text-[var(--color-juice-200)] uppercase tracking-wider mb-2">Color Palette</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {PALETTES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => dispatch({ type: "SET_COLOR_PALETTE", value: p.id })}
                  className={`flex items-center gap-2 p-2 rounded-lg text-xs transition-all ${
                    state.colorPaletteId === p.id
                      ? "bg-[var(--color-accent)]/20 border border-[var(--color-accent)]/40"
                      : "card-hover"
                  }`}
                >
                  <div className="flex -space-x-1">
                    {p.colors.slice(0, 4).map((c, i) => (
                      <span key={i} className="w-3 h-3 rounded-full border border-[var(--color-juice-800)]" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                  <span className="text-[var(--color-juice-100)] truncate">{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Variation count */}
          <div>
            <h3 className="text-xs font-semibold text-[var(--color-juice-200)] uppercase tracking-wider mb-2">Variations</h3>
            <div className="flex gap-1.5">
              {VARIATION_COUNTS.map((n) => (
                <button
                  key={n}
                  onClick={() => dispatch({ type: "SET_VARIATION_COUNT", value: n })}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    state.variationCount === n
                      ? "bg-[var(--color-accent)] text-white"
                      : "card-hover text-[var(--color-juice-200)]"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Generate */}
          <button
            onClick={handleGenerate}
            disabled={state.isGenerating}
            className="btn-primary w-full py-3 text-sm"
          >
            {state.isGenerating ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
                </svg>
                AI Generating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2a4 4 0 014 4c0 2-2 3-2 5s2 3 2 5a4 4 0 01-8 0c0-2 2-3 2-5s-2-3-2-5a4 4 0 014-4z" />
                </svg>
                Generate Artwork
              </>
            )}
          </button>
        </div>

        {/* ─── CENTER: Artwork Display ─── */}
        <div className="lg:col-span-6 space-y-4">
          {/* Main canvas */}
          <div className={`card overflow-hidden ${state.fullscreen ? "fixed inset-4 z-50" : ""}`}>
            <div className="relative bg-[var(--color-juice-900)] flex items-center justify-center" style={{ minHeight: canvasSize }}>
              <canvas
                ref={mainCanvasRef}
                className="max-w-full"
              />
              {/* Fullscreen toggle */}
              <button
                onClick={() => dispatch({ type: "SET_FULLSCREEN", value: !state.fullscreen })}
                className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/40 text-white/60 hover:text-white transition-all"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {state.fullscreen
                    ? <path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" />
                    : <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
                  }
                </svg>
              </button>
              {/* Parental advisory badge */}
              <div className="absolute bottom-4 right-4 px-2 py-1 border border-white/15 rounded text-[8px] text-white/40 font-bold tracking-wider">PARENTAL ADVISORY</div>
              {/* Generate watermark */}
              {state.isGenerating && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="text-center">
                    <svg className="w-8 h-8 animate-spin mx-auto mb-2 text-[var(--color-accent)]" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                      <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
                    </svg>
                    <p className="text-sm text-white/70">AI generating artwork...</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Variation grid */}
          {state.variations.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-[var(--color-juice-200)] uppercase tracking-wider mb-3">Variations</h3>
              <div className="grid grid-cols-4 gap-3">
                {Array.from({ length: state.variationCount }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => dispatch({ type: "SELECT_VARIATION", idx: i })}
                    className={`relative rounded-xl overflow-hidden border-2 transition-all ${
                      state.selectedVariationIdx === i
                        ? "border-[var(--color-accent)] shadow-lg shadow-[var(--color-accent-glow)]"
                        : "border-transparent hover:border-[var(--color-glass-border-hover)]"
                    }`}
                  >
                    <canvas
                      ref={(el) => { thumbRefs.current[i] = el; }}
                      className="w-full aspect-square"
                    />
                    <div className="absolute bottom-0 inset-x-0 p-1 bg-gradient-to-t from-black/60 to-transparent">
                      <span className="text-[10px] text-white/80 font-medium">v{i + 1}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ─── RIGHT PANEL: Details ─── */}
        <div className="lg:col-span-3 space-y-4">
          {/* Text overlay */}
          <div>
            <h3 className="text-xs font-semibold text-[var(--color-juice-200)] uppercase tracking-wider mb-3">Text Overlay</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-[var(--color-juice-300)] block mb-1">Artist Name</label>
                <input
                  value={state.artistName}
                  onChange={(e) => dispatch({ type: "SET_ARTIST_NAME", value: e.target.value })}
                  className="w-full bg-[var(--color-juice-700)] border border-[var(--color-glass-border)] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[var(--color-accent)]"
                />
              </div>
              <div>
                <label className="text-[10px] text-[var(--color-juice-300)] block mb-1">Title</label>
                <input
                  value={state.title}
                  onChange={(e) => dispatch({ type: "SET_TITLE", value: e.target.value })}
                  className="w-full bg-[var(--color-juice-700)] border border-[var(--color-glass-border)] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[var(--color-accent)]"
                />
              </div>

              {/* Text position */}
              <div>
                <label className="text-[10px] text-[var(--color-juice-300)] block mb-1">Position</label>
                <div className="grid grid-cols-3 gap-1">
                  {TEXT_POSITIONS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => dispatch({ type: "SET_TEXT_POSITION", value: p.id })}
                      className={`py-1.5 rounded-lg text-xs transition-all ${
                        state.textPosition === p.id
                          ? "bg-[var(--color-accent)]/20 border border-[var(--color-accent)]/40 text-white"
                          : "card-hover text-[var(--color-juice-200)]"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font style */}
              <div>
                <label className="text-[10px] text-[var(--color-juice-300)] block mb-1">Font Style</label>
                <div className="grid grid-cols-2 gap-1">
                  {FONT_STYLES.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => dispatch({ type: "SET_FONT_STYLE", value: f.id })}
                      className={`py-1.5 rounded-lg text-xs transition-all ${
                        state.fontStyle === f.id
                          ? "bg-[var(--color-accent)]/20 border border-[var(--color-accent)]/40 text-white"
                          : "card-hover text-[var(--color-juice-200)]"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Text color */}
              <div>
                <label className="text-[10px] text-[var(--color-juice-300)] block mb-1">Text Color</label>
                <div className="grid grid-cols-4 gap-1">
                  {TEXT_COLORS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => dispatch({ type: "SET_TEXT_COLOR", value: c.id })}
                      className={`py-1.5 rounded-lg text-xs transition-all flex items-center gap-1.5 ${
                        state.textColor === c.id
                          ? "bg-[var(--color-accent)]/20 border border-[var(--color-accent)]/40 text-white"
                          : "card-hover text-[var(--color-juice-200)]"
                      }`}
                    >
                      <span className="w-3 h-3 rounded-full border border-[var(--color-glass-border)]" style={{ backgroundColor: c.hex }} />
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Resolution */}
          <div>
            <h3 className="text-xs font-semibold text-[var(--color-juice-200)] uppercase tracking-wider mb-2">Resolution</h3>
            <div className="space-y-1">
              {RESOLUTIONS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => dispatch({ type: "SET_RESOLUTION", value: r.id })}
                  className={`w-full p-2 rounded-lg flex items-center justify-between text-xs transition-all ${
                    state.resolution === r.id
                      ? "bg-[var(--color-accent)]/20 border border-[var(--color-accent)]/40 text-white"
                      : "card-hover text-[var(--color-juice-200)]"
                  }`}
                >
                  <span>{r.label}</span>
                  <span className="text-[10px] text-[var(--color-juice-300)]">{r.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <button onClick={handleDownload} className="btn-primary w-full text-sm">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              Download Artwork
            </button>
            <button className="btn-glass w-full text-sm">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              Save to Project
            </button>
          </div>

          {/* Artwork History */}
          <div>
            <h3 className="text-xs font-semibold text-[var(--color-juice-200)] uppercase tracking-wider mb-2">Recent Artworks</h3>
            <div className="grid grid-cols-2 gap-2">
              {state.history.slice(0, 4).map((art) => (
                <button
                  key={art.id}
                  onClick={() => {
                    dispatch({ type: "SET_ARTIST_NAME", value: art.textOverlay.artistName });
                    dispatch({ type: "SET_TITLE", value: art.textOverlay.title });
                    dispatch({ type: "SET_TEXT_POSITION", value: art.textOverlay.position });
                    dispatch({ type: "SET_FONT_STYLE", value: art.textOverlay.fontStyle });
                    dispatch({ type: "SET_TEXT_COLOR", value: art.textOverlay.textColor });
                    dispatch({ type: "SET_STYLE", value: art.style });
                    dispatch({ type: "SET_COLOR_PALETTE", value: art.colorPaletteId });
                    dispatch({ type: "SET_ARTWORK_TYPE", value: art.artworkType });
                    dispatch({ type: "SET_RESOLUTION", value: art.resolution });
                  }}
                  className="card-hover p-2 group"
                >
                  <div
                    className="aspect-square rounded-lg mb-1.5 flex items-center justify-center relative overflow-hidden"
                    style={{ background: `linear-gradient(135deg, var(--color-accent)10, var(--color-accent)05)` }}
                  >
                    <span className="text-[10px] font-bold opacity-20 text-[var(--color-accent)]">
                      {art.textOverlay.title.charAt(0)}
                    </span>
                  </div>
                  <p className="text-[10px] font-medium text-white truncate">{art.name}</p>
                  <p className="text-[9px] text-[var(--color-juice-300)]">{art.artworkType} · {art.style}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

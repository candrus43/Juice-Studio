import { createFileRoute } from "@tanstack/react-router";
import { useReducer, useRef, useEffect, useCallback, useState } from "react";
import type {
  VideoType, VideoStyle, VideoAspectRatio, VideoDuration,
  TextAnimStyle, VideoBackgroundType, ArtworkColorPalette,
} from "../data/mock";

// ─── Types ──────────────────────────────────────────────────

interface Particle {
  x: number; y: number; vx: number; vy: number;
  size: number; color: string; alpha: number; life: number;
}

interface State {
  // Generator
  videoType: VideoType;
  style: VideoStyle;
  colorPaletteId: string;
  aspectRatio: VideoAspectRatio;
  duration: VideoDuration;
  templateId: string;
  // Text overlay
  lyricText: string;
  textAnimStyle: TextAnimStyle;
  bgType: VideoBackgroundType;
  // Playback
  isPlaying: boolean;
  isGenerating: boolean;
  currentTime: number;
  totalDuration: number;
  loop: boolean;
  fullscreen: boolean;
  // History
  history: Array<{
    id: string; name: string; videoType: string; style: string;
    aspectRatio: string; duration: string; generatedAt: string;
  }>;
}

type Action =
  | { type: "SET_VIDEO_TYPE"; value: VideoType }
  | { type: "SET_STYLE"; value: VideoStyle }
  | { type: "SET_COLOR_PALETTE"; value: string }
  | { type: "SET_ASPECT_RATIO"; value: VideoAspectRatio }
  | { type: "SET_DURATION"; value: VideoDuration }
  | { type: "SET_TEMPLATE"; value: string }
  | { type: "SET_LYRIC_TEXT"; value: string }
  | { type: "SET_TEXT_ANIM"; value: TextAnimStyle }
  | { type: "SET_BG_TYPE"; value: VideoBackgroundType }
  | { type: "SET_PLAYING"; value: boolean }
  | { type: "START_GENERATING" }
  | { type: "GENERATION_COMPLETE" }
  | { type: "SET_CURRENT_TIME"; value: number }
  | { type: "SET_TOTAL_DURATION"; value: number }
  | { type: "TOGGLE_LOOP" }
  | { type: "SET_FULLSCREEN"; value: boolean }
  | { type: "SET_HISTORY"; history: State["history"] };

const VIDEO_TYPES: { id: VideoType; label: string; icon: string }[] = [
  { id: "lyric-video", label: "Lyric Video", icon: "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" },
  { id: "music-visualizer", label: "Music Visualizer", icon: "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" },
  { id: "spotify-canvas", label: "Spotify Canvas", icon: "M20 12a8 8 0 11-16 0 8 8 0 0116 0z M12 6v6l4 2" },
  { id: "animated-bg", label: "Animated BG", icon: "M4 4h16v16H4V4zm2 2v12h12V6H6z M8 10l3 3 2-2 3 4H8z" },
];

const STYLES: { id: VideoStyle; label: string; color: string }[] = [
  { id: "particles", label: "Particles", color: "#7c3aed" },
  { id: "waveforms", label: "Waveforms", color: "#a78bfa" },
  { id: "glitch", label: "Glitch", color: "#ef4444" },
  { id: "smooth", label: "Smooth", color: "#10b981" },
  { id: "neon", label: "Neon", color: "#22d3ee" },
  { id: "minimal", label: "Minimal", color: "#888888" },
];

const ASPECT_RATIOS: { id: VideoAspectRatio; label: string; icon: string }[] = [
  { id: "16:9", label: "Landscape\n16:9", icon: "M2 4h20v16H2V4zm2 2v12h16V6H4z" },
  { id: "9:16", label: "Vertical\n9:16", icon: "M4 2h16v20H4V2zm2 2v16h12V4H6z" },
  { id: "1:1", label: "Square\n1:1", icon: "M2 2h20v20H2V2zm2 2v16h16V4H4z" },
  { id: "4:5", label: "Instagram\n4:5", icon: "M2 3h20v18H2V3zm2 2v14h16V5H4z" },
];

const DURATIONS: { id: VideoDuration; label: string }[] = [
  { id: "15s", label: "15s" },
  { id: "30s", label: "30s" },
  { id: "60s", label: "60s" },
  { id: "full-song", label: "Full Song" },
];

const TEMPLATES = [
  { id: "lyric-classic", name: "Lyric Video Classic", desc: "Clean lyric overlays", bgType: "gradient" as VideoBackgroundType, style: "smooth" as VideoStyle },
  { id: "waveform-viz", name: "Waveform Visualizer", desc: "Audio-reactive bars", bgType: "waveform" as VideoBackgroundType, style: "waveforms" as VideoStyle },
  { id: "particle-storm", name: "Particle Storm", desc: "Swirling particles", bgType: "animated-particles" as VideoBackgroundType, style: "particles" as VideoStyle },
  { id: "neon-glow", name: "Neon Glow", desc: "Neon text effects", bgType: "solid" as VideoBackgroundType, style: "neon" as VideoStyle },
  { id: "minimal-clean", name: "Minimal Clean", desc: "Subtle animations", bgType: "gradient" as VideoBackgroundType, style: "minimal" as VideoStyle },
];

const TEXT_ANIM_STYLES: { id: TextAnimStyle; label: string }[] = [
  { id: "typewriter", label: "Typewriter" },
  { id: "fade-in", label: "Fade In" },
  { id: "slide-up", label: "Slide Up" },
  { id: "pop", label: "Pop" },
];

const PALETTES: ArtworkColorPalette[] = [
  { id: "purple-haze", name: "Purple Haze", colors: ["#0a0a0a", "#1a1025", "#7c3aed", "#a78bfa", "#c084fc"] },
  { id: "neon-nights", name: "Neon Nights", colors: ["#0a0a20", "#1a0a2e", "#22d3ee", "#ec4899", "#7c3aed"] },
  { id: "dark-gold", name: "Dark + Gold", colors: ["#0a0a0a", "#1a1a2e", "#d4a574", "#b8860b", "#ffd700"] },
  { id: "fire-ice", name: "Fire & Ice", colors: ["#0a0a0a", "#1a0000", "#ef4444", "#f97316", "#3b82f6"] },
  { id: "vaporwave", name: "Vaporwave", colors: ["#0a0a2e", "#1a0030", "#ff6ec7", "#00d4ff", "#7c3aed"] },
  { id: "monochrome", name: "Monochrome", colors: ["#000000", "#1a1a1a", "#333333", "#666666", "#999999"] },
];

function getDurationSec(d: VideoDuration): number {
  switch (d) { case "15s": return 15; case "30s": return 30; case "60s": return 60; case "full-song": return 222; }
}

const initialState: State = {
  videoType: "music-visualizer",
  style: "waveforms",
  colorPaletteId: "purple-haze",
  aspectRatio: "16:9",
  duration: "full-song",
  templateId: "waveform-viz",
  lyricText: "Late nights, I've been working on my craft\nCrown heavy, never taking it off",
  textAnimStyle: "slide-up",
  bgType: "waveform",
  isPlaying: false,
  isGenerating: false,
  currentTime: 0,
  totalDuration: 222,
  loop: true,
  fullscreen: false,
  history: [],
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_VIDEO_TYPE": return { ...state, videoType: action.value };
    case "SET_STYLE": return { ...state, style: action.value };
    case "SET_COLOR_PALETTE": return { ...state, colorPaletteId: action.value };
    case "SET_ASPECT_RATIO": return { ...state, aspectRatio: action.value };
    case "SET_DURATION": return { ...state, duration: action.value, totalDuration: getDurationSec(action.value) };
    case "SET_TEMPLATE": {
      const tpl = TEMPLATES.find((t) => t.id === action.value);
      return { ...state, templateId: action.value, bgType: tpl?.bgType || state.bgType, style: tpl?.style || state.style };
    }
    case "SET_LYRIC_TEXT": return { ...state, lyricText: action.value };
    case "SET_TEXT_ANIM": return { ...state, textAnimStyle: action.value };
    case "SET_BG_TYPE": return { ...state, bgType: action.value };
    case "SET_PLAYING": return { ...state, isPlaying: action.value };
    case "START_GENERATING": return { ...state, isGenerating: true };
    case "GENERATION_COMPLETE": return { ...state, isGenerating: false };
    case "SET_CURRENT_TIME": return { ...state, currentTime: action.value };
    case "SET_TOTAL_DURATION": return { ...state, totalDuration: action.value };
    case "TOGGLE_LOOP": return { ...state, loop: !state.loop };
    case "SET_FULLSCREEN": return { ...state, fullscreen: action.value };
    case "SET_HISTORY": return { ...state, history: action.history };
    default: return state;
  }
}

// ─── Canvas Animation Engine ────────────────────────────────

function rgba(h: string, a: number): string {
  const clean = h.replace("#", "");
  if (clean.length < 6) return `rgba(124,58,237,${a})`;
  return `rgba(${parseInt(clean.substring(0, 2), 16)},${parseInt(clean.substring(2, 4), 16)},${parseInt(clean.substring(4, 6), 16)},${a})`;
}

class AnimationEngine {
  particles: Particle[] = [];
  private particleTimer = 0;

  constructor() {
    this.initParticles(60);
  }

  initParticles(count: number) {
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push(this.createParticle());
    }
  }

  createParticle(): Particle {
    return {
      x: Math.random(), y: Math.random() * 0.8 + 0.1,
      vx: (Math.random() - 0.5) * 0.003,
      vy: (Math.random() - 0.5) * 0.002,
      size: Math.random() * 3 + 1,
      color: ["#7c3aed", "#a78bfa", "#c084fc", "#ffffff"][Math.floor(Math.random() * 4)],
      alpha: Math.random() * 0.4 + 0.1,
      life: Math.random(),
    };
  }

  updateParticles(dt: number) {
    this.particleTimer += dt;
    for (const p of this.particles) {
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.life += dt * 0.3;
      if (p.x < -0.1) p.x = 1.1;
      if (p.x > 1.1) p.x = -0.1;
      if (p.y < -0.1) p.y = 1.1;
      if (p.y > 1.1) p.y = -0.1;
      if (p.life > 1) {
        Object.assign(p, this.createParticle());
      }
    }
    if (this.particles.length < 60) {
      this.particles.push(this.createParticle());
    }
  }

  drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, colors: string[], bgType: string) {
    // Base gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, colors[0] || "#0a0a0a");
    grad.addColorStop(0.5, colors[1] || colors[0] || "#1a1025");
    grad.addColorStop(1, colors[0] || "#0a0a0a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    if (bgType === "gradient" || bgType === "waveform") {
      // Dynamic gradient shift
      const shift = Math.sin(time * 0.3) * 0.3;
      const dg = ctx.createRadialGradient(w * (0.5 + shift * 0.2), h * 0.4, w * 0.05, w * 0.5, h * 0.5, w * 0.8);
      dg.addColorStop(0, rgba(colors[2] || "#7c3aed", 0.12));
      dg.addColorStop(1, "transparent");
      ctx.fillStyle = dg;
      ctx.fillRect(0, 0, w, h);
    }

    if (bgType === "animated-particles") {
      // Particle field in background
      for (const p of this.particles) {
        const px = p.x * w;
        const py = p.y * h;
        ctx.fillStyle = rgba(p.color, p.alpha * 0.5);
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      // Connect nearby particles
      ctx.strokeStyle = rgba(colors[2] || "#7c3aed", 0.03);
      ctx.lineWidth = 0.5;
      for (let i = 0; i < this.particles.length; i += 2) {
        for (let j = i + 1; j < this.particles.length; j += 3) {
          const dx = (this.particles[i].x - this.particles[j].x) * w;
          const dy = (this.particles[i].y - this.particles[j].y) * h;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < w * 0.2) {
            ctx.beginPath();
            ctx.moveTo(this.particles[i].x * w, this.particles[i].y * h);
            ctx.lineTo(this.particles[j].x * w, this.particles[j].y * h);
            ctx.stroke();
          }
        }
      }
    }

    if (bgType === "solid") {
      ctx.fillStyle = colors[0] || "#0a0a0a";
      ctx.fillRect(0, 0, w, h);
    }
  }

  drawWaveform(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, colors: string[], style: string) {
    const barCount = 64;
    const barWidth = (w * 0.9) / barCount;
    const gap = barWidth * 0.15;
    const maxHeight = h * 0.5;

    for (let i = 0; i < barCount; i++) {
      // Simulated "audio data" using sine waves with different frequencies
      const beatPhase = time * 2.5;
      const freq1 = Math.sin(i * 0.2 + beatPhase) * 0.5 + 0.5;
      const freq2 = Math.sin(i * 0.35 + beatPhase * 1.3) * 0.4;
      const freq3 = Math.sin(i * 0.08 + beatPhase * 0.7) * 0.6;
      const kick = (i < 8 && Math.sin(beatPhase * Math.PI) > 0.8) ? 0.5 : 0;
      const snare = (i >= 20 && i < 28 && Math.sin(beatPhase * Math.PI * 2) > 0.85) ? 0.4 : 0;

      let amplitude = Math.abs(freq1 + freq2 + freq3) * 0.6 + kick + snare;
      amplitude = Math.min(1, amplitude);

      const barH = amplitude * maxHeight * (0.3 + Math.sin(i * 0.5) * 0.3 + 0.4);
      const x = w * 0.05 + i * barWidth;
      const y = h * 0.5 - barH / 2;

      if (style === "glitch") {
        // Glitch: randomized bar positions
        const glitchOffset = (Math.sin(time * 30 + i) > 0.95) ? Math.random() * 20 - 10 : 0;
        const colorIdx = Math.floor(Math.abs(Math.sin(i * 0.3 + time)) * colors.length);
        ctx.fillStyle = rgba(colors[colorIdx] || colors[2] || "#ef4444", 0.7);
        ctx.fillRect(x + glitchOffset, y + Math.random() * 2, barWidth - gap, barH);
      } else if (style === "neon") {
        ctx.shadowColor = colors[3] || colors[2] || "#22d3ee";
        ctx.shadowBlur = 8;
        const grad = ctx.createLinearGradient(x, y, x, y + barH);
        grad.addColorStop(0, colors[3] || "#22d3ee");
        grad.addColorStop(1, colors[2] || "#7c3aed");
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, barWidth - gap, barH);
        ctx.shadowBlur = 0;
      } else {
        const grad = ctx.createLinearGradient(x, y, x, y + barH);
        grad.addColorStop(0, colors[3] || colors[2] || "#a78bfa");
        grad.addColorStop(1, colors[2] || "#7c3aed");
        ctx.fillStyle = grad;
        // Rounded bars
        const bw = barWidth - gap;
        const radius = Math.min(bw / 2, 3);
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + bw - radius, y);
        ctx.quadraticCurveTo(x + bw, y, x + bw, y + radius);
        ctx.lineTo(x + bw, y + barH - radius);
        ctx.quadraticCurveTo(x + bw, y + barH, x + bw - radius, y + barH);
        ctx.lineTo(x + radius, y + barH);
        ctx.quadraticCurveTo(x, y + barH, x, y + barH - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  drawParticlesOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, colors: string[]) {
    const beatIntensity = Math.abs(Math.sin(time * 2.5)) * 0.5 + 0.3;
    for (const p of this.particles) {
      const px = p.x * w;
      const py = p.y * h;
      const alpha = p.alpha * beatIntensity;
      ctx.fillStyle = rgba(p.color, alpha);
      ctx.beginPath();
      ctx.arc(px, py, p.size * (0.8 + beatIntensity * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawText(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, text: string, animStyle: TextAnimStyle, colors: string[]) {
    if (!text.trim()) return;
    const lines = text.split("\n").filter(Boolean);
    const color = colors[4] || colors[3] || "#ffffff";
    const fontSize = Math.max(14, w * 0.05);
    const lineHeight = fontSize * 1.4;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const animCycle = 4; // seconds per line
    const totalLines = lines.length;
    const currentLineIdx = Math.floor((time % (totalLines * animCycle)) / animCycle);
    const progressInLine = ((time % (totalLines * animCycle)) % animCycle) / animCycle;

    for (let i = 0; i < lines.length; i++) {
      const lineTime = time - i * animCycle;
      let alpha = 0;
      let offsetY = 0;
      let scale = 1;

      if (animStyle === "typewriter") {
        if (i === currentLineIdx) {
          alpha = 0.9;
        } else if (i === currentLineIdx - 1) {
          alpha = 0.3;
        }
      } else if (animStyle === "fade-in") {
        if (i === currentLineIdx) {
          alpha = Math.min(1, progressInLine * 2);
        } else if (i === currentLineIdx - 1) {
          alpha = Math.max(0, 1 - progressInLine * 2);
        }
      } else if (animStyle === "slide-up") {
        if (i === currentLineIdx) {
          offsetY = (1 - progressInLine) * 40;
          alpha = Math.min(1, progressInLine * 3);
        } else if (i === currentLineIdx - 1) {
          offsetY = -progressInLine * 40;
          alpha = Math.max(0, 1 - progressInLine * 2);
        }
      } else if (animStyle === "pop") {
        if (i === currentLineIdx) {
          const popProgress = Math.min(1, progressInLine * 4);
          scale = 1 + (1 - popProgress) * 0.3;
          alpha = popProgress;
        }
      }

      if (alpha > 0.01) {
        ctx.save();
        const tx = w / 2;
        const ty = h * 0.65 + i * lineHeight - currentLineIdx * lineHeight + offsetY;
        ctx.globalAlpha = alpha;
        ctx.translate(tx, ty);
        ctx.scale(scale, scale);
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = fontSize * 0.2;

        ctx.font = `700 ${fontSize}px 'Inter', -apple-system, sans-serif`;
        ctx.fillStyle = color;
        ctx.fillText(lines[i], 0, 0);
        ctx.shadowBlur = 0;
        ctx.restore();
      }
    }
  }

  renderFrame(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, state: State, colors: string[]) {
    ctx.clearRect(0, 0, w, h);

    // Layer 1: Background
    this.drawBackground(ctx, w, h, time, colors, state.bgType);

    // Layer 2: Waveform (if applicable)
    if (state.bgType === "waveform" || state.videoType === "music-visualizer") {
      this.drawWaveform(ctx, w, h, time, colors, state.style);
    }

    // Layer 3: Particles
    if (state.bgType === "animated-particles" || state.style === "particles") {
      this.drawParticlesOverlay(ctx, w, h, time, colors);
    }

    // Layer 4: Text (lyric video)
    if (state.videoType === "lyric-video" || state.videoType === "spotify-canvas") {
      this.drawText(ctx, w, h, time, state.lyricText, state.textAnimStyle, colors);
    }

    // Track info overlay at bottom
    const infoAlpha = 0.6;
    ctx.fillStyle = rgba("#000000", 0.3);
    ctx.fillRect(0, h - 40, w, 40);
    ctx.fillStyle = rgba("#ffffff", infoAlpha);
    ctx.font = "12px 'Inter', -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("🎵 Late Nights · King Juice", 12, h - 14);
    ctx.textAlign = "right";
    const timeStr = formatTime(time);
    const durStr = formatTime(state.totalDuration);
    ctx.fillText(`${timeStr} / ${durStr}`, w - 12, h - 14);
  }
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── Component ──────────────────────────────────────────────

export const Route = createFileRoute("/video-studio")({
  component: VideoStudio,
});

function VideoStudio() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<AnimationEngine>(new AnimationEngine());
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const currentTimeRef = useRef<number>(0);
  const isPlayingRef = useRef(false);
  const stateRef = useRef(state);

  stateRef.current = state;
  isPlayingRef.current = state.isPlaying;

  const palette = PALETTES.find((p) => p.id === state.colorPaletteId) || PALETTES[0];

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;

    // Compute aspect ratio
    let arW = 16, arH = 9;
    const selectedAr = ASPECT_RATIOS.find((a) => a.id === state.aspectRatio);
    if (selectedAr) { arW = selectedAr.w; arH = selectedAr.h; }

    const containerWidth = canvas.parentElement?.clientWidth || 800;
    const containerHeight = Math.min(500, (containerWidth * arH) / arW);

    canvas.width = containerWidth * dpr;
    canvas.height = containerHeight * dpr;
    canvas.style.width = `${containerWidth}px`;
    canvas.style.height = `${containerHeight}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const engine = engineRef.current;

    function animate(timestamp: number) {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      let dt = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      if (dt > 0.1) dt = 0.1; // Cap dt

      const s = stateRef.current;

      if (s.isPlaying) {
        currentTimeRef.current += dt;
        if (currentTimeRef.current >= s.totalDuration) {
          if (s.loop) {
            currentTimeRef.current = 0;
          } else {
            currentTimeRef.current = s.totalDuration;
            dispatch({ type: "SET_PLAYING", value: false });
          }
        }
        dispatch({ type: "SET_CURRENT_TIME", value: currentTimeRef.current });
      }

      engine.updateParticles(dt);
      engine.renderFrame(ctx, containerWidth, containerHeight, currentTimeRef.current, s, palette.colors);

      animFrameRef.current = requestAnimationFrame(animate);
    }

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [state.aspectRatio, state.colorPaletteId, palette.colors]);

  // Load history on mount
  useEffect(() => {
    dispatch({
      type: "SET_HISTORY",
      history: [
        { id: "vid-001", name: "Late Nights (Visualizer)", videoType: "music-visualizer", style: "waveforms", aspectRatio: "16:9", duration: "full-song", generatedAt: "2026-07-17" },
        { id: "vid-002", name: "Sauce Walk (Lyric Video)", videoType: "lyric-video", style: "smooth", aspectRatio: "9:16", duration: "full-song", generatedAt: "2026-07-12" },
        { id: "vid-003", name: "No Limits (Visualizer)", videoType: "music-visualizer", style: "particles", aspectRatio: "16:9", duration: "full-song", generatedAt: "2026-07-08" },
        { id: "vid-004", name: "Crown Heavy Visual", videoType: "spotify-canvas", style: "neon", aspectRatio: "9:16", duration: "15s", generatedAt: "2026-07-05" },
      ],
    });
  }, []);

  const handlePlayPause = useCallback(() => {
    dispatch({ type: "SET_PLAYING", value: !state.isPlaying });
    lastTimeRef.current = 0;
  }, [state.isPlaying]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const newTime = pct * state.totalDuration;
    currentTimeRef.current = newTime;
    dispatch({ type: "SET_CURRENT_TIME", value: newTime });
  }, [state.totalDuration]);

  const handleGenerate = useCallback(async () => {
    dispatch({ type: "START_GENERATING" });
    await new Promise((r) => setTimeout(r, 2000));
    dispatch({ type: "GENERATION_COMPLETE" });
    currentTimeRef.current = 0;
    dispatch({ type: "SET_CURRENT_TIME", value: 0 });
    dispatch({ type: "SET_PLAYING", value: true });
  }, []);

  const handleDownload = useCallback(() => {
    const el = document.createElement("a");
    el.download = "video_export.mp4";
    el.href = "#";
    el.click();
  }, []);

  const seekPct = state.totalDuration > 0 ? (state.currentTime / state.totalDuration) * 100 : 0;

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6 page-transition">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Video Studio</h1>
          <p className="text-sm text-[var(--color-juice-200)] mt-1">Create AI-powered music videos, visualizers & lyric videos</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded-full text-[10px] font-medium ${state.isPlaying ? "bg-green-500/20 text-green-400" : "bg-[var(--color-glass-bg)] text-[var(--color-juice-300)]"}`}>
            {state.isPlaying ? "▶ Playing" : "⏸ Paused"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ─── LEFT PANEL ─── */}
        <div className="lg:col-span-3 space-y-4">
          {/* Video Type */}
          <div>
            <h3 className="text-xs font-semibold text-[var(--color-juice-200)] uppercase tracking-wider mb-2">Video Type</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {VIDEO_TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => dispatch({ type: "SET_VIDEO_TYPE", value: t.id })}
                  className={`p-2 rounded-lg text-left text-xs transition-all ${
                    state.videoType === t.id
                      ? "bg-[var(--color-accent)]/20 border border-[var(--color-accent)]/40 text-white"
                      : "card-hover text-[var(--color-juice-200)]"
                  }`}
                >
                  <svg className="w-4 h-4 mb-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d={t.icon} />
                  </svg>
                  <span className="block">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Style */}
          <div>
            <h3 className="text-xs font-semibold text-[var(--color-juice-200)] uppercase tracking-wider mb-2">Style</h3>
            <div className="flex flex-wrap gap-1.5">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => dispatch({ type: "SET_STYLE", value: s.id })}
                  className={`px-2.5 py-1.5 rounded-full text-xs transition-all flex items-center gap-1.5 ${
                    state.style === s.id
                      ? "bg-[var(--color-accent)]/20 border border-[var(--color-accent)]/40 text-white"
                      : "card-hover text-[var(--color-juice-200)]"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Aspect Ratio */}
          <div>
            <h3 className="text-xs font-semibold text-[var(--color-juice-200)] uppercase tracking-wider mb-2">Aspect Ratio</h3>
            <div className="grid grid-cols-4 gap-1">
              {ASPECT_RATIOS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => dispatch({ type: "SET_ASPECT_RATIO", value: a.id })}
                  className={`p-2 rounded-lg text-center text-[10px] transition-all ${
                    state.aspectRatio === a.id
                      ? "bg-[var(--color-accent)]/20 border border-[var(--color-accent)]/40 text-white"
                      : "card-hover text-[var(--color-juice-200)]"
                  }`}
                >
                  <svg className="w-3.5 h-3.5 mx-auto mb-0.5 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d={a.icon} />
                  </svg>
                  {a.label.split("\n")[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <h3 className="text-xs font-semibold text-[var(--color-juice-200)] uppercase tracking-wider mb-2">Duration</h3>
            <div className="grid grid-cols-4 gap-1">
              {DURATIONS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => dispatch({ type: "SET_DURATION", value: d.id })}
                  className={`py-1.5 rounded-lg text-xs font-medium transition-all ${
                    state.duration === d.id
                      ? "bg-[var(--color-accent)]/20 border border-[var(--color-accent)]/40 text-white"
                      : "card-hover text-[var(--color-juice-200)]"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Color Theme */}
          <div>
            <h3 className="text-xs font-semibold text-[var(--color-juice-200)] uppercase tracking-wider mb-2">Color Theme</h3>
            <div className="space-y-1">
              {PALETTES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => dispatch({ type: "SET_COLOR_PALETTE", value: p.id })}
                  className={`w-full flex items-center gap-2 p-1.5 rounded-lg text-xs transition-all ${
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
                  <span className="text-[var(--color-juice-100)] truncate text-[10px]">{p.name}</span>
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
                Generating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Generate Video
              </>
            )}
          </button>
        </div>

        {/* ─── CENTER: Preview Player ─── */}
        <div className="lg:col-span-6 space-y-3">
          {/* Canvas player */}
          <div className={`card overflow-hidden ${state.fullscreen ? "fixed inset-4 z-50" : ""}`}>
            <div className="relative bg-black">
              <canvas ref={canvasRef} className="w-full" />

              {/* Fullscreen button */}
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

              {/* Generating overlay */}
              {state.isGenerating && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <div className="text-center">
                    <svg className="w-10 h-10 animate-spin mx-auto mb-3 text-[var(--color-accent)]" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                      <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
                    </svg>
                    <p className="text-sm text-white/80">AI generating video...</p>
                    <p className="text-xs text-white/40 mt-1">Rendering frames · This may take a moment</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Transport controls */}
          <div className="card p-3">
            <div className="flex items-center gap-3">
              {/* Play/Pause */}
              <button onClick={handlePlayPause} className="btn-primary p-2.5 rounded-full">
                {state.isPlaying ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                )}
              </button>

              {/* Seek bar */}
              <div
                className="flex-1 h-5 flex items-center cursor-pointer group"
                onClick={handleSeek}
              >
                <div className="w-full h-1.5 rounded-full bg-[var(--color-juice-600)] overflow-hidden group-hover:h-2 transition-all">
                  <div
                    className="h-full rounded-full bg-[var(--color-accent)] transition-all relative"
                    style={{ width: `${seekPct}%` }}
                  >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-all shadow-lg" />
                  </div>
                </div>
              </div>

              {/* Time display */}
              <span className="text-xs text-[var(--color-juice-200)] font-mono min-w-[90px] text-right">
                {formatTime(state.currentTime)} / {formatTime(state.totalDuration)}
              </span>

              {/* Loop */}
              <button
                onClick={() => dispatch({ type: "TOGGLE_LOOP" })}
                className={`p-1.5 rounded-lg transition-all ${state.loop ? "text-[var(--color-accent)] bg-[var(--color-accent)]/10" : "text-[var(--color-juice-300)] hover:text-white"}`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 2l4 4-4 4" /><path d="M3 11V9a4 4 0 014-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a4 4 0 01-4 4H3" />
                </svg>
              </button>

              {/* Reset */}
              <button
                onClick={() => { currentTimeRef.current = 0; dispatch({ type: "SET_CURRENT_TIME", value: 0 }); }}
                className="p-1.5 rounded-lg text-[var(--color-juice-300)] hover:text-white transition-all"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12a9 9 0 019-9 9 9 0 016.36 2.64L21 9M3 12a9 9 0 009 9 9 9 0 006.36-2.64L21 15M12 3v5l3-3" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* ─── RIGHT PANEL ─── */}
        <div className="lg:col-span-3 space-y-4">
          {/* Text overlay for lyric videos */}
          {(state.videoType === "lyric-video" || state.videoType === "spotify-canvas") && (
            <div>
              <h3 className="text-xs font-semibold text-[var(--color-juice-200)] uppercase tracking-wider mb-2">Lyrics</h3>
              <textarea
                value={state.lyricText}
                onChange={(e) => dispatch({ type: "SET_LYRIC_TEXT", value: e.target.value })}
                className="w-full bg-[var(--color-juice-700)] border border-[var(--color-glass-border)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[var(--color-juice-300)] outline-none focus:border-[var(--color-accent)] resize-none h-24"
                placeholder="Enter lyrics..."
              />
            </div>
          )}

          {/* Text animation style */}
          {(state.videoType === "lyric-video" || state.videoType === "spotify-canvas") && (
            <div>
              <h3 className="text-xs font-semibold text-[var(--color-juice-200)] uppercase tracking-wider mb-2">Text Animation</h3>
              <div className="grid grid-cols-2 gap-1">
                {TEXT_ANIM_STYLES.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => dispatch({ type: "SET_TEXT_ANIM", value: a.id })}
                    className={`py-1.5 rounded-lg text-xs transition-all ${
                      state.textAnimStyle === a.id
                        ? "bg-[var(--color-accent)]/20 border border-[var(--color-accent)]/40 text-white"
                        : "card-hover text-[var(--color-juice-200)]"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Background type */}
          <div>
            <h3 className="text-xs font-semibold text-[var(--color-juice-200)] uppercase tracking-wider mb-2">Background</h3>
            <div className="grid grid-cols-2 gap-1">
              {(["solid", "gradient", "animated-particles", "waveform"] as VideoBackgroundType[]).map((bg) => (
                <button
                  key={bg}
                  onClick={() => dispatch({ type: "SET_BG_TYPE", value: bg })}
                  className={`py-1.5 rounded-lg text-xs capitalize transition-all ${
                    state.bgType === bg
                      ? "bg-[var(--color-accent)]/20 border border-[var(--color-accent)]/40 text-white"
                      : "card-hover text-[var(--color-juice-200)]"
                  }`}
                >
                  {bg === "animated-particles" ? "Particles" : bg}
                </button>
              ))}
            </div>
          </div>

          {/* Templates */}
          <div>
            <h3 className="text-xs font-semibold text-[var(--color-juice-200)] uppercase tracking-wider mb-2">Templates</h3>
            <div className="space-y-1.5">
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => dispatch({ type: "SET_TEMPLATE", value: tpl.id })}
                  className={`w-full p-2.5 rounded-lg text-left transition-all ${
                    state.templateId === tpl.id
                      ? "bg-[var(--color-accent)]/20 border border-[var(--color-accent)]/40"
                      : "card-hover"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[var(--color-glass-bg)] flex items-center justify-center flex-shrink-0">
                      <svg className="w-3.5 h-3.5 text-[var(--color-accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white truncate">{tpl.name}</p>
                      <p className="text-[10px] text-[var(--color-juice-300)]">{tpl.desc}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Download button */}
          <button onClick={handleDownload} className="btn-primary w-full text-sm">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
            Download Video
          </button>

          {/* Recent videos */}
          <div>
            <h3 className="text-xs font-semibold text-[var(--color-juice-200)] uppercase tracking-wider mb-2">Recent Videos</h3>
            <div className="space-y-1">
              {state.history.map((vid) => (
                <button
                  key={vid.id}
                  className="card-hover p-2.5 flex items-center gap-2.5 w-full text-left"
                  onClick={() => {
                    dispatch({ type: "SET_VIDEO_TYPE", value: vid.videoType as VideoType });
                    dispatch({ type: "SET_STYLE", value: vid.style as VideoStyle });
                    dispatch({ type: "SET_ASPECT_RATIO", value: vid.aspectRatio as VideoAspectRatio });
                    dispatch({ type: "SET_DURATION", value: vid.duration as VideoDuration });
                  }}
                >
                  <div className="w-10 h-7 rounded bg-[var(--color-juice-700)] flex items-center justify-center flex-shrink-0">
                    <svg className="w-3.5 h-3.5 text-[var(--color-juice-300)]" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-white truncate">{vid.name}</p>
                    <p className="text-[10px] text-[var(--color-juice-300)]">{vid.videoType} · {vid.aspectRatio} · {vid.generatedAt}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

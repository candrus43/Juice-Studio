import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  type NoteEvent,
  type InstrumentId,
  type MelodyPreset,
  instrumentDefs,
  melodyPresets,
  generateInstrumentNotes,
} from "~/data/mock";

export const Route = createFileRoute("/music-creation")({
  component: MusicCreation,
});

const SCALES: Record<string, number[]> = {
  "C / Am": [0],
  "G / Em": [7],
  "D / Bm": [2],
  "A / F#m": [9],
  "E / C#m": [4],
  "B / G#m": [11],
  "F# / D#m": [6],
  "Db / Bbm": [1],
  "Ab / Fm": [8],
  "Eb / Cm": [3],
  "Bb / Gm": [10],
  "F / Dm": [5],
};

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const KEY_WHITE = ["C", "D", "E", "F", "G", "A", "B"];
const KEY_BLACK = ["C#", "D#", "F#", "G#", "A#"];

function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const note = NOTE_NAMES[midi % 12];
  return `${note}${octave}`;
}

function getOctaveRange(octaveOffset: number): { label: string; midiLow: number; midiHigh: number } {
  // We show 2 octaves starting from C3 (MIDI 48) adjusted
  const base = 48 + octaveOffset * 12;
  return { label: `C${3 + octaveOffset}-B${4 + octaveOffset}`, midiLow: base, midiHigh: base + 24 };
}

function MusicCreation() {
  // State
  const [instrument, setInstrument] = useState<InstrumentId>("piano");
  const [keyName, setKeyName] = useState("D / Bm");
  const [keyOffset, setKeyOffset] = useState(2);
  const [octaveOffset, setOctaveOffset] = useState(0);
  const [notes, setNotes] = useState<NoteEvent[]>(() => melodyPresets[0].notes);
  const [bars, setBars] = useState(4);
  const [complexity, setComplexity] = useState(0.5);
  const [playing, setPlaying] = useState(false);
  const [playheadPos, setPlayheadPos] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("");
  const [hoveredNote, setHoveredNote] = useState<NoteEvent | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playheadRef = useRef<number>(0);
  const animFrameRef = useRef<number>(0);
  const mouseDownRef = useRef(false);
  const dragNoteRef = useRef<{ noteId: string; type: "move" | "resize-left" | "resize-right"; startPos: number } | null>(null);

  const totalSlots = bars * 16;
  const currentInstrument = instrumentDefs.find((d) => d.id === instrument)!;
  const octave = getOctaveRange(octaveOffset);

  // Generate
  const handleGenerate = useCallback(async (type: string) => {
    setLoading(true);
    setLoadingLabel(`Generating ${type}...`);
    await new Promise((r) => setTimeout(r, 500 + Math.random() * 700));
    const genNotes = generateInstrumentNotes(instrument, keyOffset, bars, complexity);
    setNotes(genNotes.map((n, i) => ({ ...n, id: `n-${Date.now()}-${i}` })));
    setLoading(false);
    setLoadingLabel("");
  }, [instrument, keyOffset, bars, complexity]);

  // Load preset
  const handlePreset = (preset: MelodyPreset) => {
    setNotes(preset.notes.map((n, i) => ({ ...n, id: `np-${Date.now()}-${i}` })));
    setBars(preset.bars);
    setInstrument(preset.instrument);
  };

  // Playback
  const handlePlay = useCallback(() => {
    if (playing) {
      setPlaying(false);
      cancelAnimationFrame(animFrameRef.current);
      return;
    }
    setPlaying(true);
    playheadRef.current = 0;
    const startTime = performance.now();
    const slotDuration = (60 / 140) / 4 * 1000; // ms per 16th note at 140bpm

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const pos = Math.min(elapsed / slotDuration, totalSlots);
      playheadRef.current = pos;
      setPlayheadPos(pos);
      if (pos < totalSlots) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        setPlaying(false);
        setPlayheadPos(0);
      }
    };
    animFrameRef.current = requestAnimationFrame(animate);
  }, [playing, totalSlots]);

  useEffect(() => {
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  // Canvas render
  const CELL_W = 20;
  const CELL_H = 14;
  const PIANO_W = 56;
  const LABEL_H = 18;
  const HEADER_H = 28;

  const rowsInView = 24; // 2 octaves
  const colsInView = totalSlots;

  const canvasW = PIANO_W + colsInView * CELL_W;
  const canvasH = HEADER_H + rowsInView * CELL_H;

  // Compute grid colors
  const scaleIntervals: number[] = useMemo(() => {
    const majorScale = [0, 2, 4, 5, 7, 9, 11];
    return majorScale.map((s) => (s + keyOffset) % 12);
  }, [keyOffset]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasW * dpr;
    canvas.height = canvasH * dpr;
    canvas.style.width = `${canvasW}px`;
    canvas.style.height = `${canvasH}px`;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = "#111111";
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Piano keys
    for (let row = 0; row < rowsInView; row++) {
      const midi = octave.midiHigh - row;
      const noteName = NOTE_NAMES[midi % 12];
      const isBlack = KEY_BLACK.includes(noteName);
      const isInScale = scaleIntervals.includes(midi % 12);
      const y = HEADER_H + row * CELL_H;

      ctx.fillStyle = isBlack ? "#1a1a1a" : isInScale ? "#1e1e24" : "#161616";
      ctx.fillRect(0, y, PIANO_W, CELL_H);
      ctx.strokeStyle = "rgba(255,255,255,0.03)";
      ctx.strokeRect(0, y, PIANO_W, CELL_H);

      // Note label
      ctx.fillStyle = isInScale ? "#8b8b8b" : "#555555";
      ctx.font = "9px Inter, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(midiToNoteName(midi), PIANO_W - 6, y + CELL_H / 2 + 3);

      // Row lines
      const rowY = y;
      const isBeatStart = row >= 0;
    }

    // Column grid
    for (let col = 0; col <= colsInView; col++) {
      const x = PIANO_W + col * CELL_W;
      const isBar = col % 16 === 0;
      const isBeat = col % 4 === 0;

      ctx.strokeStyle = isBar ? "rgba(255,255,255,0.08)" : isBeat ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.015)";
      ctx.beginPath();
      ctx.moveTo(x, HEADER_H);
      ctx.lineTo(x, canvasH);
      ctx.stroke();

      // Bar numbers
      if (isBar && col < colsInView) {
        ctx.fillStyle = "#555555";
        ctx.font = "9px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${col / 16 + 1}`, x + CELL_W * 8, HEADER_H - 6);
      }
    }

    // Header background
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(PIANO_W, 0, colsInView * CELL_W, HEADER_H);

    // Notes
    for (const note of notes) {
      const row = octave.midiHigh - note.pitch;
      if (row < 0 || row >= rowsInView) continue;

      const x = PIANO_W + note.start * CELL_W;
      const y = HEADER_H + row * CELL_H;
      const w = note.duration * CELL_W;
      const h = CELL_H - 2;
      const rx = 3;

      // Note rect
      const alpha = hoveredNote?.id === note.id ? 1 : 0.8;
      ctx.fillStyle = currentInstrument.color + Math.floor(alpha * 255).toString(16).padStart(2, "0");
      ctx.beginPath();
      ctx.moveTo(x + rx, y + 1);
      ctx.lineTo(x + w - rx, y + 1);
      ctx.quadraticCurveTo(x + w, y + 1, x + w, y + 1 + rx);
      ctx.lineTo(x + w, y + h - rx);
      ctx.quadraticCurveTo(x + w, y + h, x + w - rx, y + h);
      ctx.lineTo(x + rx, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - rx);
      ctx.lineTo(x, y + 1 + rx);
      ctx.quadraticCurveTo(x, y + 1, x + rx, y + 1);
      ctx.fill();

      // Velocity indicator (top bar)
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(x + 2, y + 1, w - 4, 2);
    }

    // Playhead
    if (playheadPos > 0 || playing) {
      const px = PIANO_W + (playing ? playheadPos : playheadRef.current) * CELL_W;
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, canvasH);
      ctx.stroke();
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(px, HEADER_H - 1, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [notes, octave, playheadPos, playing, canvasW, canvasH, currentInstrument, scaleIntervals, hoveredNote, colsInView, keyOffset]);

  // Canvas mouse handling
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvasW / rect.width;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleX; // square pixels
    return { x, y };
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    if (!coords) return;
    const { x, y } = coords;

    // Check hover on notes
    let found: NoteEvent | null = null;
    for (const note of notes) {
      const row = octave.midiHigh - note.pitch;
      const nx = PIANO_W + note.start * CELL_W;
      const ny = HEADER_H + row * CELL_H;
      const nw = note.duration * CELL_W;
      if (x >= nx && x <= nx + nw && y >= ny && y <= ny + CELL_H) {
        found = note;
        break;
      }
    }
    setHoveredNote(found);

    // Handle drag
    if (mouseDownRef.current && dragNoteRef.current && found) {
      // Simple move — for production this would update note position
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    if (!coords) return;
    const { x, y } = coords;
    mouseDownRef.current = true;

    // If clicking on grid (not piano area), add a note
    if (x >= PIANO_W && y >= HEADER_H) {
      const col = Math.floor((x - PIANO_W) / CELL_W);
      const row = Math.floor((y - HEADER_H) / CELL_H);
      const midi = octave.midiHigh - row;
      if (midi >= octave.midiLow && midi <= octave.midiHigh && col < totalSlots) {
        const newNote: NoteEvent = {
          id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          pitch: midi,
          start: col,
          duration: 2,
          velocity: 100,
          row: midi % 24,
        };
        setNotes((prev) => [...prev, newNote].sort((a, b) => a.start - b.start || b.pitch - a.pitch));
      }
    }
  };

  const handleCanvasMouseUp = () => {
    mouseDownRef.current = false;
    dragNoteRef.current = null;
  };

  const handleDeleteSelected = () => {
    if (hoveredNote) {
      setNotes((prev) => prev.filter((n) => n.id !== hoveredNote.id));
      setHoveredNote(null);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === " " && e.target === document.body) {
        e.preventDefault();
        handlePlay();
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        if (document.activeElement === document.body) {
          handleDeleteSelected();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handlePlay, hoveredNote]);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Music Creation</h1>
          <p className="text-sm text-[var(--color-juice-200)] mt-1">Compose melodies, basslines, and chord progressions</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setNotes([])} className="btn-glass text-xs" title="Clear All">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            Clear
          </button>
          <button onClick={handleDeleteSelected} disabled={!hoveredNote} className="btn-glass text-xs disabled:opacity-30">
            Delete Note
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Panel — Generators */}
        <div className="lg:col-span-2 space-y-3">
          {/* Instrument select */}
          <div className="card p-3">
            <h3 className="text-xs font-semibold text-[var(--color-juice-200)] mb-2 uppercase tracking-wider">Instruments</h3>
            <div className="space-y-1 max-h-[280px] overflow-y-auto">
              {instrumentDefs.map((inst) => (
                <button
                  key={inst.id}
                  onClick={() => { setInstrument(inst.id); }}
                  className={`w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                    instrument === inst.id
                      ? "bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/30 text-white"
                      : "bg-[var(--color-glass-bg)] border border-transparent text-[var(--color-juice-200)] hover:text-white hover:border-[var(--color-glass-border)]"
                  }`}
                >
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: inst.color }} />
                  <span>{inst.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Generate */}
          <div className="card p-3 space-y-2">
            <h3 className="text-xs font-semibold text-[var(--color-juice-200)] mb-2 uppercase tracking-wider">Generate</h3>
            <button onClick={() => handleGenerate("Melody")} disabled={loading} className="btn-primary w-full text-xs justify-center py-2">
              {loading && loadingLabel === "Generating Melody..." ? "..." : "Generate Melody"}
            </button>
            <button onClick={() => handleGenerate("Bassline")} disabled={loading} className="btn-glass w-full text-xs justify-center py-1.5">
              Generate Bassline
            </button>
            <button onClick={() => handleGenerate("Counter Melody")} disabled={loading} className="btn-glass w-full text-xs justify-center py-1.5">
              Generate Counter Melody
            </button>
            <button onClick={() => handleGenerate("Chords")} disabled={loading} className="btn-glass w-full text-xs justify-center py-1.5">
              Generate Chords
            </button>
          </div>

          {/* Settings */}
          <div className="card p-3 space-y-3">
            <h3 className="text-xs font-semibold text-[var(--color-juice-200)] mb-2 uppercase tracking-wider">Settings</h3>
            <div>
              <label className="text-[10px] text-[var(--color-juice-300)]">Pattern Length</label>
              <div className="flex gap-1 mt-1">
                {[2, 4, 8, 16].map((b) => (
                  <button key={b} onClick={() => setBars(b)} className={`flex-1 text-xs py-1 rounded-lg transition-all ${
                    bars === b ? "bg-[var(--color-accent)]/20 border border-[var(--color-accent)]/40 text-white" : "bg-[var(--color-glass-bg)] border border-[var(--color-glass-border)] text-[var(--color-juice-200)]"
                  }`}>{b}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] text-[var(--color-juice-300)]">Complexity</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={complexity}
                onChange={(e) => setComplexity(parseFloat(e.target.value))}
                className="w-full mt-1 accent-[var(--color-accent)]"
              />
              <div className="flex justify-between text-[10px] text-[var(--color-juice-400)]">
                <span>Simple</span>
                <span>Complex</span>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-[var(--color-juice-300)]">Scale / Key</label>
              <select
                value={keyName}
                onChange={(e) => {
                  setKeyName(e.target.value);
                  setKeyOffset(SCALES[e.target.value] || 0);
                }}
                className="w-full mt-1 bg-[var(--color-juice-700)] border border-[var(--color-glass-border)] rounded-lg px-2 py-1.5 text-xs text-white outline-none"
              >
                {Object.keys(SCALES).map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[var(--color-juice-300)]">Octave View</label>
              <div className="flex gap-1 mt-1">
                {[-1, 0, 1, 2].map((o) => (
                  <button key={o} onClick={() => setOctaveOffset(o)} className={`flex-1 text-xs py-1 rounded-lg transition-all ${
                    octaveOffset === o ? "bg-[var(--color-accent)]/20 border border-[var(--color-accent)]/40 text-white" : "bg-[var(--color-glass-bg)] border border-[var(--color-glass-border)] text-[var(--color-juice-200)]"
                  }`}>C{3+o}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Center — Piano Roll */}
        <div className="lg:col-span-7 space-y-3">
          {/* Transport bar */}
          <div className="card p-3 flex items-center gap-3">
            <button onClick={handlePlay} className={`p-2 rounded-full transition-all ${playing ? "bg-[var(--color-accent)] text-white" : "btn-glass"}`}>
              {playing ? (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              )}
            </button>
            <div className="flex-1 h-1 bg-[var(--color-juice-600)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--color-accent)] rounded-full transition-all duration-75" style={{ width: `${playing ? (playheadPos / totalSlots * 100) : 0}%` }} />
            </div>
            <span className="text-xs text-[var(--color-juice-300)] font-mono">
              {Math.floor((playing ? playheadPos : 0) / 16) + 1}.{(Math.floor(playing ? playheadPos : 0) % 16) + 1} / {bars}
            </span>
            <div className="text-xs text-[var(--color-juice-300)] flex items-center gap-3">
              <span>BPM: 140</span>
              <span>{notes.length} notes</span>
            </div>
          </div>

          {/* Canvas */}
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <canvas
                ref={canvasRef}
                onMouseMove={handleCanvasMouseMove}
                onMouseDown={handleCanvasMouseDown}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
                className="cursor-crosshair"
                style={{ minWidth: `${canvasW}px` }}
              />
            </div>
            {/* Note info */}
            {hoveredNote && (
              <div className="px-4 py-2 border-t border-[var(--color-glass-border)] bg-[var(--color-juice-800)]/50 flex items-center gap-4 text-xs">
                <span className="text-white font-medium">{midiToNoteName(hoveredNote.pitch)}</span>
                <span className="text-[var(--color-juice-300)]">Start: {Math.floor(hoveredNote.start / 4) + 1}.{(hoveredNote.start % 4) + 1}</span>
                <span className="text-[var(--color-juice-300)]">Dur: {hoveredNote.duration} steps</span>
                <span className="text-[var(--color-juice-300)]">Vel: {hoveredNote.velocity}</span>
                <span className="text-[var(--color-juice-300)] text-[10px] ml-auto">Click grid to place notes · Space to play · Backspace to delete</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel — Presets */}
        <div className="lg:col-span-3 space-y-3">
          <div className="card p-3">
            <h3 className="text-xs font-semibold text-[var(--color-juice-200)] mb-2 uppercase tracking-wider">Melody Presets</h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {melodyPresets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handlePreset(preset)}
                  className="w-full text-left p-2.5 rounded-lg bg-[var(--color-glass-bg)] border border-[var(--color-glass-border)] hover:border-[var(--color-glass-border-hover)] transition-all group"
                >
                  <span className="text-xs font-medium text-white group-hover:text-[var(--color-accent-light)] transition-colors">{preset.name}</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-[var(--color-juice-300)]">{preset.key} {preset.scale}</span>
                    <span className="text-[10px] text-[var(--color-juice-300)]">{preset.bpm} BPM</span>
                    <span className="text-[10px] text-[var(--color-juice-300)]">{preset.bars} bars</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: instrumentDefs.find(d => d.id === preset.instrument)?.color }} />
                    <span className="text-[10px] text-[var(--color-juice-400)]">{instrumentDefs.find(d => d.id === preset.instrument)?.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="card p-3">
            <h3 className="text-xs font-semibold text-[var(--color-juice-200)] mb-2 uppercase tracking-wider">Saved Patterns</h3>
            <p className="text-xs text-[var(--color-juice-300)]">Save your patterns to reuse across projects. Patterns are stored locally.</p>
            <button className="btn-glass w-full text-xs justify-center mt-2 py-1.5">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
              Save Current Pattern
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

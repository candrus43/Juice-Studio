import { useState, useRef, useCallback } from "react";
import { getContext } from "../audio/engine";
import {
  saveImportedAudio,
  type ImportedAudio,
} from "../persistence/stores/importedAudio";

// ─── Constants ──────────────────────────────────────────────
const ACCEPTED_FORMATS = [
  "audio/mpeg",          // MP3
  "audio/wav",           // WAV
  "audio/wave",          // WAV alt
  "audio/x-wav",         // WAV alt
  "audio/flac",          // FLAC
  "audio/x-flac",        // FLAC alt
  "audio/aiff",          // AIFF
  "audio/x-aiff",        // AIFF alt
  "audio/ogg",           // OGG
  "application/ogg",     // OGG alt
  "audio/x-m4a",         // M4A
  "audio/mp4",           // M4A alt
  "audio/aac",           // AAC
];

const ACCEPTED_EXTENSIONS = ".mp3,.wav,.flac,.aiff,.aif,.ogg,.m4a,.aac";

const FORMAT_LABELS: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/wave": "wav",
  "audio/x-wav": "wav",
  "audio/flac": "flac",
  "audio/x-flac": "flac",
  "audio/aiff": "aiff",
  "audio/x-aiff": "aiff",
  "audio/ogg": "ogg",
  "application/ogg": "ogg",
  "audio/x-m4a": "m4a",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
};

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const WARN_FILE_SIZE = 50 * 1024 * 1024;  // 50MB
const WAVEFORM_POINTS_MAX = 400;
const LARGE_FILE_WAVEFORM_SECS = 30;

const GENRES = ["Trap", "Drill", "R&B", "Pop", "Afrobeats", "Hip-Hop", "Alternative", "Lo-Fi", "Gospel", "Electronic"];
const KEYS = ["Cm", "C#m", "Dm", "D#m", "Em", "Fm", "F#m", "Gm", "G#m", "Am", "A#m", "Bm",
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// ─── Types ──────────────────────────────────────────────────
export interface ImportResult {
  id: string;
  name: string;
  fileName: string;
  format: string;
  duration: number;
  sampleRate: number;
  channels: number;
  bpm: number;
  key: string;
  genre: string;
  audioData: ArrayBuffer;
  waveformData: number[];
  fileSize: number;
  importedAt: string;
  category: "beat" | "song" | "sample";
}

type ProcessingState = "idle" | "reading" | "decoding" | "storing" | "done" | "error";

interface AudioImporterProps {
  category?: "beat" | "song" | "sample";
  defaultBpm?: number;
  defaultKey?: string;
  defaultGenre?: string;
  onImported?: (result: ImportResult) => void;
  className?: string;
  compact?: boolean;
}

// ─── Helpers ────────────────────────────────────────────────
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extractWaveform(buffer: AudioBuffer, maxPoints: number): number[] {
  const channels = buffer.getChannelData(0); // left/mono channel
  const totalLen = channels.length;
  if (totalLen === 0) return [];

  const step = Math.max(1, Math.floor(totalLen / maxPoints));
  const points: number[] = [];

  for (let i = 0; i < totalLen; i += step) {
    let max = 0;
    const end = Math.min(i + step, totalLen);
    for (let j = i; j < end; j++) {
      const abs = Math.abs(channels[j]);
      if (abs > max) max = abs;
    }
    points.push(max);
  }

  return points;
}

function getFormatFromType(mimeType: string): string {
  return FORMAT_LABELS[mimeType] || "wav";
}

// ─── Component ──────────────────────────────────────────────
export default function AudioImporter({
  category = "beat",
  defaultBpm = 140,
  defaultKey = "Cm",
  defaultGenre = "Trap",
  onImported,
  className = "",
  compact = false,
}: AudioImporterProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [state, setState] = useState<ProcessingState>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [successName, setSuccessName] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  // Post-import metadata editor
  const [showEditor, setShowEditor] = useState(false);
  const [pendingResult, setPendingResult] = useState<ImportResult | null>(null);
  const [editName, setEditName] = useState("");
  const [editBpm, setEditBpm] = useState(defaultBpm);
  const [editKey, setEditKey] = useState(defaultKey);
  const [editGenre, setEditGenre] = useState(defaultGenre);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const reset = useCallback(() => {
    setState("idle");
    setProgress(0);
    setError(null);
    setWarning(null);
    setShowEditor(false);
    setPendingResult(null);
    setSuccessName(null);
  }, []);

  const processFile = useCallback(
    async (file: File) => {
      // Validate type
      if (!ACCEPTED_FORMATS.includes(file.type)) {
        // Check by extension
        const ext = file.name.split(".").pop()?.toLowerCase();
        const validExts = ["mp3", "wav", "flac", "aiff", "aif", "ogg", "m4a", "aac"];
        if (!ext || !validExts.includes(ext)) {
          setError(`Unsupported format. Accepted: MP3, WAV, FLAC, AIFF, OGG, M4A.`);
          setState("error");
          return;
        }
      }

      // Size validation
      if (file.size > MAX_FILE_SIZE) {
        setError(`File too large (${formatSize(file.size)}). Maximum is 100MB.`);
        setState("error");
        return;
      }
      if (file.size > WARN_FILE_SIZE) {
        setWarning(`Large file (${formatSize(file.size)}) — may affect performance.`);
      }

      setError(null);
      setState("reading");
      setProgress(10);

      try {
        // Read file as ArrayBuffer
        const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = () => reject(new Error("Failed to read file"));
          reader.readAsArrayBuffer(file);
        });

        setProgress(30);
        setState("decoding");

        // Decode audio
        const ctx = getContext();
        let audioBuffer: AudioBuffer;
        try {
          audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
        } catch {
          throw new Error("Could not decode audio file. The file may be corrupt or in an unsupported codec.");
        }

        setProgress(70);
        setState("storing");

        const format = getFormatFromType(file.type) || file.name.split(".").pop()?.toLowerCase() || "wav";
        const duration = audioBuffer.duration;

        // Generate waveform (limit for large files)
        const waveformPoints = duration > LARGE_FILE_WAVEFORM_SECS
          ? WAVEFORM_POINTS_MAX / 2
          : WAVEFORM_POINTS_MAX;
        const waveformData = extractWaveform(audioBuffer, waveformPoints);

        const result: ImportResult = {
          id: `import-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          name: file.name.replace(/\.[^.]+$/, ""),
          fileName: file.name,
          format,
          duration,
          sampleRate: audioBuffer.sampleRate,
          channels: audioBuffer.numberOfChannels,
          bpm: defaultBpm,
          key: defaultKey,
          genre: defaultGenre,
          audioData: arrayBuffer,
          waveformData,
          fileSize: file.size,
          importedAt: new Date().toISOString(),
          category,
        };

        setProgress(100);
        setPendingResult(result);
        setEditName(result.name);
        setEditBpm(defaultBpm);
        setEditKey(defaultKey);
        setEditGenre(defaultGenre);
        setShowEditor(true);
        setState("done");
        setSuccessName(file.name);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to process audio file");
        setState("error");
      }
    },
    [category, defaultBpm, defaultKey, defaultGenre]
  );

  const handleSave = useCallback(async () => {
    if (!pendingResult) return;

    const item: ImportedAudio = {
      ...pendingResult,
      name: editName || pendingResult.name,
      bpm: editBpm,
      key: editKey,
      genre: editGenre,
    };

    try {
      await saveImportedAudio(item);
      setShowEditor(false);
      onImported?.(item);
      // Reset after 3 seconds
      setTimeout(() => {
        reset();
      }, 3000);
    } catch (err) {
      if (err instanceof DOMException && err.name === "QuotaExceededError") {
        setError("Not enough storage space. Try clearing old projects in Settings.");
      } else {
        setError("Failed to save. Try again.");
      }
      setState("error");
      setShowEditor(false);
    }
  }, [pendingResult, editName, editBpm, editKey, editGenre, onImported, reset]);

  const handleCancelEdit = useCallback(() => {
    reset();
  }, [reset]);

  // Drag-and-drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (dragCounter.current === 1) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounter.current = 0;
      setError(null);
      setWarning(null);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        processFile(files[0]);
      }
    },
    [processFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        processFile(files[0]);
      }
      // Reset input so same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [processFile]
  );

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // ─── Render: Editor dialog ────────────────────────────────
  if (showEditor && pendingResult) {
    return (
      <div className={`card p-5 space-y-4 animate-[fadeSlideIn_0.2s_ease-out] ${className}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              Imported: {pendingResult.fileName}
            </p>
            <p className="text-xs text-[var(--color-juice-300)]">
              {formatSize(pendingResult.fileSize)} · {pendingResult.duration.toFixed(1)}s · {pendingResult.format.toUpperCase()} · {pendingResult.channels}ch · {pendingResult.sampleRate / 1000}kHz
            </p>
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="text-[11px] font-medium text-[var(--color-juice-300)] block mb-1">Name</label>
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full bg-[var(--color-juice-800)] border border-[var(--color-glass-border)] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[var(--color-juice-300)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
          />
        </div>

        {/* BPM */}
        <div>
          <label className="text-[11px] font-medium text-[var(--color-juice-300)] block mb-1">BPM</label>
          <input
            type="number"
            min={40}
            max={300}
            value={editBpm}
            onChange={(e) => setEditBpm(parseInt(e.target.value) || defaultBpm)}
            className="w-full bg-[var(--color-juice-800)] border border-[var(--color-glass-border)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--color-accent)] transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </div>

        {/* Key & Genre row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-medium text-[var(--color-juice-300)] block mb-1">Key</label>
            <select
              value={editKey}
              onChange={(e) => setEditKey(e.target.value)}
              className="w-full bg-[var(--color-juice-800)] border border-[var(--color-glass-border)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--color-accent)] transition-colors appearance-none cursor-pointer"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 10px center",
                paddingRight: "1.5rem",
              }}
            >
              {KEYS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-medium text-[var(--color-juice-300)] block mb-1">Genre</label>
            <select
              value={editGenre}
              onChange={(e) => setEditGenre(e.target.value)}
              className="w-full bg-[var(--color-juice-800)] border border-[var(--color-glass-border)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--color-accent)] transition-colors appearance-none cursor-pointer"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 10px center",
                paddingRight: "1.5rem",
              }}
            >
              {GENRES.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Waveform preview */}
        {pendingResult.waveformData.length > 0 && (
          <div className="bg-[var(--color-juice-800)] rounded-lg p-3">
            <WaveformPreview data={pendingResult.waveformData} color="#7c3aed" />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button onClick={handleCancelEdit} className="btn-glass flex-1 py-2 text-sm">
            Cancel
          </button>
          <button onClick={handleSave} className="btn-primary flex-1 py-2 text-sm font-semibold">
            Save to Library
          </button>
        </div>
      </div>
    );
  }

  // ─── Render: Import state ──────────────────────────────────
  const isProcessing = state === "reading" || state === "decoding" || state === "storing";

  return (
    <div className={className}>
      {/* Drop zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={state === "idle" || state === "error" ? handleBrowseClick : undefined}
        className={`card p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${
          compact ? "p-4" : "p-6"
        } ${
          isDragging
            ? "border-[var(--color-accent)] bg-[var(--color-glass-bg-active)] shadow-[0_0_30px_var(--color-accent-glow)]"
            : state === "error"
            ? "border-red-500/40 bg-red-500/5"
            : state === "done" && successName
            ? "border-green-500/40 bg-green-500/5"
            : "border-[var(--color-glass-border)] hover:border-[var(--color-glass-border-hover)]"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          onChange={handleFileSelect}
          className="hidden"
          aria-label="Select audio file"
        />

        {isProcessing ? (
          <>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 bg-[var(--color-accent)]/20">
              {state === "reading" || state === "decoding" ? (
                <svg className="w-6 h-6 animate-spin text-[var(--color-accent-light)]" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-[var(--color-accent-light)] animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              )}
            </div>
            <p className="text-sm font-medium text-white mb-1">
              {state === "reading" ? "Reading file..." : state === "decoding" ? "Decoding audio..." : "Storing..."}
            </p>
            <div className="progress-bar w-48 mt-1">
              <div
                className="progress-bar-fill"
                style={{
                  width: `${progress}%`,
                  transition: "width 0.4s ease-out",
                }}
              />
            </div>
          </>
        ) : state === "error" && error ? (
          <>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 bg-red-500/20">
              <svg className="w-6 h-6 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <p className="text-sm font-medium text-red-400 mb-1">Import Failed</p>
            <p className="text-xs text-red-300/70 max-w-xs">{error}</p>
            <button
              onClick={(e) => { e.stopPropagation(); reset(); }}
              className="mt-3 text-xs text-[var(--color-juice-200)] hover:text-white transition-colors"
            >
              Try again
            </button>
          </>
        ) : state === "done" && successName ? (
          <>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 bg-green-500/20">
              <svg className="w-6 h-6 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="text-sm font-medium text-white mb-1">Beat imported successfully!</p>
            <p className="text-xs text-green-400/80 truncate max-w-full">{successName}</p>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "linear-gradient(135deg, #7c3aed20, #7c3aed08)" }}>
              <svg className="w-7 h-7 text-[var(--color-accent-light)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <p className="text-sm font-medium text-white mb-1">
              {category === "song" ? "Drop your song here" : "Drop your beat here"}
            </p>
            <p className="text-xs text-[var(--color-juice-300)] mt-1">
              MP3, WAV, FLAC, AIFF, OGG, M4A
            </p>
            {warning && (
              <p className="text-xs text-yellow-400/80 mt-1">⚠ {warning}</p>
            )}
            {!compact && (
              <button
                onClick={(e) => { e.stopPropagation(); handleBrowseClick(); }}
                className="btn-glass mt-4 px-4 py-2 text-sm font-medium"
              >
                Browse files
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Waveform Preview Sub-component ─────────────────────────
function WaveformPreview({ data, color }: { data: number[]; color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Draw waveform on mount/data change
  if (typeof document !== "undefined") {
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);

      const w = rect.width;
      const h = rect.height;
      const mid = h / 2;

      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = color || "#7c3aed";
      ctx.lineWidth = 1.5;
      ctx.lineCap = "round";
      ctx.beginPath();

      const step = data.length > 0 ? w / data.length : 0;
      for (let i = 0; i < data.length; i++) {
        const x = i * step;
        const y = mid - data[i] * mid * 0.85;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Fill below
      ctx.lineTo(w, mid);
      ctx.lineTo(0, mid);
      ctx.closePath();
      ctx.fillStyle = `${color}20`;
      ctx.fill();
    }, 0);
  }

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-16 rounded"
      style={{ width: "100%", height: "64px" }}
    />
  );
}

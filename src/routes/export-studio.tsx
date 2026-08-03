import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useEffect, useRef } from "react";
import {
  generateProjects,
  exportHistory,
  generateSmallWaveform,
  estimateFileSize,
  formatTimeAgo,
  type ExportItem,
} from "../data/mock";
import { SocialPublishCard } from "../components/SocialPublish";
import { getPublishHistory, type PublishRecord } from "../persistence";
import { getSession, exportMix, startSession, loadBeat } from "../audio/session";
import { createRoutedDrumKit } from "../audio/synth";
import { createBeatEngine, buildArrangement } from "../audio/arranger";
import { getContext } from "../audio/engine";
import {
  audioBufferToWav,
  audioBufferToMp3,
  resampleBuffer,
  normalizePeaks,
  triggerDownload,
  formatBytes,
  sanitizeFileName,
} from "../audio/export";

const isBrowser = typeof window !== "undefined";

export const Route = createFileRoute("/export-studio")({
  component: ExportStudio,
});

interface ExportSettings {
  format: "wav" | "mp3";
  quality: string;
  sampleRate: number;
  exportType: "full" | "instrumental";
  normalize: boolean;
  targetLUFS: number;
  includeMetadata: boolean;
  metadata: {
    title: string;
    artist: string;
    album: string;
    year: string;
    genre: string;
  };
}

const defaultSettings: ExportSettings = {
  format: "wav",
  quality: "24-bit",
  sampleRate: 48000,
  exportType: "full",
  normalize: true,
  targetLUFS: -14,
  includeMetadata: true,
  metadata: {
    title: "Late Nights",
    artist: "King Juice",
    album: "Late Nights",
    year: "2026",
    genre: "Trap / R&B",
  },
};

const formatOptions = [
  {
    id: "wav" as const,
    label: "WAV",
    desc: "Uncompressed audio, maximum quality",
    useCase: "Best for mastering, archiving, and further processing",
    icon: "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3",
  },
  {
    id: "mp3" as const,
    label: "MP3",
    desc: "Compressed, small file size",
    useCase: "Best for sharing, streaming previews, and quick demos",
    icon: "M12 18l-4-3.5M12 18l4-3.5M12 18V6m-6 6h.01M18 12h.01M6 6h.01M18 6h.01M6 18h.01M18 18h.01",
  },
];

const qualityOptions: Record<string, { id: string; label: string }[]> = {
  wav: [
    { id: "16-bit", label: "16-bit" },
    { id: "24-bit", label: "24-bit" },
    { id: "32-bit float", label: "32-bit float" },
  ],
  mp3: [
    { id: "128 kbps", label: "128 kbps" },
    { id: "192 kbps", label: "192 kbps" },
    { id: "256 kbps", label: "256 kbps" },
    { id: "320 kbps", label: "320 kbps" },
  ],
};

const sampleRates = [44100, 48000, 96000];

const exportTypeOptions = [
  { id: "full", label: "Full Song", desc: "Complete mixed track", icon: "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" },
  { id: "instrumental", label: "Instrumental", desc: "Beat only, no vocals", icon: "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" },
];

const waveformLabels = [
  { label: "Intro", start: 0, end: 18 },
  { label: "Verse 1", start: 18, end: 45 },
  { label: "Hook", start: 45, end: 68 },
  { label: "Verse 2", start: 68, end: 100 },
  { label: "Hook", start: 100, end: 123 },
  { label: "Bridge", start: 123, end: 148 },
  { label: "Hook", start: 148, end: 170 },
  { label: "Outro", start: 170, end: 210 },
];

function ExportStudio() {
  const [settings, setSettings] = useState<ExportSettings>(defaultSettings);
  const [exportState, setExportState] = useState<"idle" | "exporting" | "complete">("idle");
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStageLabel, setExportStageLabel] = useState("Ready");
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [downloadState, setDownloadState] = useState<Record<string, "idle" | "downloading" | "done">>({});
  const [showToast, setShowToast] = useState(false);
  const [lastExport, setLastExport] = useState<ExportItem | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [playheadPos, setPlayheadPos] = useState(0);
  const [publishHistory, setPublishHistory] = useState<PublishRecord[]>([]);
  const [publishToast, setPublishToast] = useState<{ message: string; type: "success" | "info" | "error" } | null>(null);
  const audioTimer = useRef<ReturnType<typeof setInterval>>();
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  // Real encoded files produced this session, keyed by export id — enables real re-downloads.
  const downloadBlobs = useRef<Map<string, { blob: Blob; fileName: string }>>(new Map());

  // Load publish history
  useEffect(() => {
    getPublishHistory().then(setPublishHistory);
  }, []);

  const projects = generateProjects();
  const project = projects[0]; // "Late Nights"
  const durationSec = 210; // 3:30
  const waveform = generateSmallWaveform(durationSec);

  // Update file size estimate
  const fileSizeEstimate = estimateFileSize(
    settings.format,
    settings.quality,
    settings.sampleRate,
    settings.exportType === "full" || settings.exportType === "instrumental" ? durationSec : durationSec * 1.5,
  );

  // Handle format change — reset quality
  const handleFormatChange = useCallback((format: ExportSettings["format"]) => {
    setSettings((s) => ({
      ...s,
      format,
      quality: qualityOptions[format]?.[0]?.id || s.quality,
    }));
  }, []);

  // Handle export — renders the real session mix via exportMix(), encodes it,
  // and triggers an actual file download.
  const handleExport = useCallback(async () => {
    if (!isBrowser) return;
    setExportState("exporting");
    setExportProgress(0);
    setExportError(null);
    setExportNote(null);
    setExportStageLabel("Preparing session...");

    try {
      // 1. Ensure a session exists. If the user hasn't built anything yet,
      //    create a short demo beat session so the export is real and audible
      //    without a long first render.
      let session = getSession();
      if (!session) {
        const ctx = getContext();
        const kit = createRoutedDrumKit(ctx);
        const engine = createBeatEngine(ctx, kit);
        const arrangement = buildArrangement(kit, {
          genre: "Trap",
          bpm: 140,
          energy: 7,
          structure: ["Intro", "Hook", "Outro"],
        });
        engine.setArrangement(arrangement);
        session = startSession(project.name, { bpm: 140, key: "Dm", genre: "Trap" });
        loadBeat(kit, engine, arrangement);
      }
      const projectName = session.projectName || project.name;

      // 2. "Instrumental" export = temporarily mute vocals, then restore.
      const mutes: { track: typeof session.vocalTracks[number]; muted: boolean }[] = [];
      if (settings.exportType === "instrumental") {
        for (const track of session.vocalTracks) {
          mutes.push({ track, muted: track.muted });
          track.muted = true;
        }
      }

      // 3. Real offline render (OfflineAudioContext startRendering).
      setExportStageLabel("Rendering mix...");
      setExportProgress(15);
      const rendered = await exportMix();

      setExportProgress(55);

      // 4. Honor the selected sample rate (exportMix renders at 44.1kHz).
      let buffer = rendered;
      if (settings.sampleRate !== rendered.sampleRate) {
        setExportStageLabel("Resampling to " + settings.sampleRate / 1000 + " kHz...");
        buffer = resampleBuffer(rendered, settings.sampleRate);
      }

      // 5. Optional peak normalization before encoding (target in dBFS).
      if (settings.normalize) {
        normalizePeaks(buffer, Math.pow(10, settings.targetLUFS / 20));
      }

      // 6. Encode.
      const metadata = settings.includeMetadata
        ? {
            title: settings.metadata.title,
            artist: settings.metadata.artist,
            album: settings.metadata.album,
            year: settings.metadata.year,
            genre: settings.metadata.genre,
          }
        : undefined;

      let blob: Blob;
      let ext: string;
      let formatLabel: string;
      let note: string | null = null;

      if (settings.format === "wav") {
        setExportStageLabel("Encoding WAV...");
        setExportProgress(65);
        const bitDepth = settings.quality === "24-bit" ? 24 : settings.quality === "32-bit float" ? 32 : 16;
        blob = audioBufferToWav(buffer, { bitDepth, metadata });
        ext = "wav";
        formatLabel = `WAV · ${bitDepth}-bit`;
      } else {
        const bitrate = Number.parseInt(settings.quality, 10);
        setExportStageLabel(`Encoding MP3 (${bitrate} kbps)...`);
        setExportProgress(65);
        blob = await audioBufferToMp3(buffer, bitrate);
        ext = "mp3";
        formatLabel = `MP3 · ${bitrate} kbps`;
        note = "Encoded with lamejs MPEG-1 Layer III encoder.";
      }
      setExportProgress(90);

      // 7. Filename from metadata (title/artist/album).
      const typeLabel =
        settings.exportType === "instrumental" ? "Instrumental"
        : "Mix";
      const fileName = `${sanitizeFileName(settings.metadata.title || projectName)}_${sanitizeFileName(
        settings.metadata.artist || "King_Juice"
      )}_${sanitizeFileName(settings.metadata.album || projectName)}_${typeLabel}.${ext}`;

      const id = `ex-${Date.now()}`;
      const newExport: ExportItem = {
        id,
        projectName,
        fileName,
        format: formatLabel,
        quality: `${settings.quality} / ${(buffer.sampleRate / 1000).toFixed(1)} kHz`,
        sampleRate: buffer.sampleRate,
        size: formatBytes(blob.size),
        exportedAt: new Date().toISOString(),
        status: "completed",
        type: settings.exportType,
      };
      if (downloadBlobs.current.size >= 3) downloadBlobs.current.delete(downloadBlobs.current.keys().next().value!);
      downloadBlobs.current.set(id, { blob, fileName });
      setLastExport(newExport);
      setExportNote(note);

      // 8. Auto-download the real file.
      setExportStageLabel("Download ready");
      setExportProgress(100);
      setExportState("complete");
      triggerDownload(blob, fileName);

      // Toast
      setShowToast(true);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setShowToast(false), 4000);
    } catch (err) {
      setExportState("idle");
      setExportProgress(0);
      setExportStageLabel("Export failed");
      setExportError(err instanceof Error ? err.message : "Export failed — please try again.");
    } finally {
      for (const { track, muted } of mutes) track.muted = muted;
    }
  }, [settings, project.name]);

  const handleDownload = useCallback((exportId: string) => {
    const entry = downloadBlobs.current.get(exportId);
    if (entry) {
      // Real file — actually download it.
      triggerDownload(entry.blob, entry.fileName);
      setDownloadState((s) => ({ ...s, [exportId]: "done" }));
      setTimeout(() => {
        setDownloadState((s) => ({ ...s, [exportId]: "idle" }));
      }, 3000);
    } else {
      // Historical (pre-session) entries have no stored file.
      setPublishToast({
        message: "No file stored for this historical export — run Export Now to create a real file.",
        type: "info",
      });
      setTimeout(() => setPublishToast(null), 4000);
    }
  }, []);

  const handlePublished = useCallback((record: { platform: string; url?: string }) => {
    // Refresh publish history
    getPublishHistory().then(setPublishHistory);
  }, []);

  const handlePublishToast = useCallback((message: string, type: "success" | "info" | "error" = "info") => {
    setPublishToast({ message, type });
    setTimeout(() => setPublishToast(null), 4000);
  }, []);

  // Audio preview toggle
  const toggleAudioPreview = useCallback(() => {
    if (audioPlaying) {
      setAudioPlaying(false);
      if (audioTimer.current) clearInterval(audioTimer.current);
    } else {
      setAudioPlaying(true);
      setPlayheadPos(0);
      let pos = 0;
      audioTimer.current = setInterval(() => {
        pos += 0.5;
        if (pos >= 100) {
          pos = 0;
          setAudioPlaying(false);
          if (audioTimer.current) clearInterval(audioTimer.current);
        }
        setPlayheadPos(pos);
      }, 50);
    }
  }, [audioPlaying]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "e") {
        e.preventDefault();
        if (exportState === "idle") handleExport();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [exportState, handleExport]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (audioTimer.current) clearInterval(audioTimer.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const allExports = lastExport
    ? [lastExport, ...exportHistory.filter((e) => e.id !== lastExport.id)]
    : exportHistory;

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Export Studio</h1>
          <p className="text-sm text-[var(--color-juice-200)] mt-1">
            Export "{project.name}" in any format, any quality
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Keyboard shortcut hint */}
          <span className="hidden sm:flex items-center gap-1.5 text-xs text-[var(--color-juice-400)]">
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-juice-600)] text-[var(--color-juice-300)] text-[10px] font-mono">⌘E</kbd>
            <span>to export</span>
          </span>
          <button
            onClick={handleExport}
            disabled={exportState === "exporting"}
            className={`btn-primary text-sm relative overflow-hidden ${
              exportState === "exporting" ? "opacity-70 cursor-wait" : ""
            }`}
          >
            {exportState === "idle" ? (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                Export Now
              </>
            ) : exportState === "exporting" ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 11-6.219-8.56" />
                </svg>
                Exporting... {exportProgress}%
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Export Complete!
              </>
            )}
          </button>
        </div>
      </div>

      {/* Export progress bar — reflects real render/encode stages, not a timer */}
      {exportState === "exporting" && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white font-medium">Exporting "{project.name}"</span>
            <span className="text-sm text-[var(--color-accent-light)] font-mono">{exportProgress}%</span>
          </div>
          <div className="progress-bar h-2">
            <div
              className="progress-bar-fill h-2"
              style={{ width: `${exportProgress}%`, transition: "width 0.2s ease-out" }}
            />
          </div>
          <p className="text-xs text-[var(--color-juice-300)] mt-2">{exportStageLabel}</p>
        </div>
      )}

      {/* Export error banner */}
      {exportState === "idle" && exportError && (
        <div className="card p-4" style={{ borderColor: "rgba(239,68,68,0.35)" }}>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-red-500/20">
              <svg className="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">Export failed</p>
              <p className="text-xs text-[var(--color-juice-200)] mt-0.5">{exportError}</p>
            </div>
            <button
              onClick={() => setExportError(null)}
              className="text-[var(--color-juice-400)] hover:text-white flex-shrink-0"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* Completed banner */}
      {exportState === "complete" && lastExport && (
        <div className="card p-4" style={{ borderColor: "rgba(16,185,129,0.3)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-emerald-500/20">
              <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">Export Complete</p>
              <p className="text-xs text-[var(--color-juice-200)] truncate">
                {lastExport.fileName} · {lastExport.size}
              </p>
              {exportNote && (
                <p className="text-[10px] text-amber-400 mt-0.5">{exportNote}</p>
              )}
            </div>
            <button
              onClick={() => {
                handleDownload(lastExport.id);
                setExportState("idle");
              }}
              className="btn-primary text-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              Download
            </button>
            <button
              onClick={() => setExportState("idle")}
              className="btn-glass text-sm"
            >
              New Export
            </button>
          </div>
        </div>
      )}

      {/* Publish section — shown after export */}
      {exportState === "complete" && lastExport && (
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-medium text-[var(--color-juice-300)] uppercase tracking-wider mb-3">
              Publish "{lastExport.projectName}"
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {(["soundcloud", "youtube", "tiktok", "instagram"] as const).map((platform) => (
                <SocialPublishCard
                  key={platform}
                  platform={platform}
                  songName={settings.metadata.title || lastExport.projectName}
                  projectName={lastExport.projectName}
                  onPublished={handlePublished}
                  onToast={handlePublishToast}
                />
              ))}
            </div>
          </div>

          {/* Publish History */}
          {publishHistory.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-[var(--color-juice-300)] uppercase tracking-wider mb-2">
                Publishing History
              </h3>
              <div className="space-y-1.5">
                {publishHistory.slice().reverse().map((rec) => (
                  <div key={rec.id} className="card p-2.5 flex items-center gap-2.5">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      rec.status === "published" ? "bg-emerald-400" :
                      rec.status === "downloaded" ? "bg-blue-400" : "bg-red-400"
                    }`} />
                    <span className="text-[10px] text-[var(--color-juice-200)] capitalize font-medium">
                      {rec.platform}
                    </span>
                    <span className="text-[10px] text-[var(--color-juice-300)]">
                      {rec.songName}
                    </span>
                    {rec.url && (
                      <a
                        href={rec.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-purple-400 hover:text-purple-300 underline ml-auto truncate max-w-[200px]"
                      >
                        {rec.url}
                      </a>
                    )}
                    {!rec.url && (
                      <span className="text-[10px] text-[var(--color-juice-400)] ml-auto">
                        {rec.status === "downloaded" ? "Downloaded" : "Failed"}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Export Settings */}
        <div className="space-y-6">
          {/* Project selector */}
          <div>
            <h2 className="text-sm font-medium text-[var(--color-juice-300)] uppercase tracking-wider mb-2">Project</h2>
            <div className="card p-3 flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${project.coverColor}, ${project.coverColor}88)` }}
              >
                <span className="text-sm font-bold text-white">{project.name.charAt(0)}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{project.name}</p>
                <p className="text-xs text-[var(--color-juice-300)]">{project.bpm} BPM · {project.key} · {project.duration}</p>
              </div>
            </div>
          </div>

          {/* Format */}
          <div>
            <h2 className="text-sm font-medium text-[var(--color-juice-300)] uppercase tracking-wider mb-2">Format</h2>
            <div className="grid grid-cols-2 gap-2">
              {formatOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleFormatChange(opt.id)}
                  className={`p-3 rounded-xl text-left transition-all ${
                    settings.format === opt.id
                      ? "bg-[var(--color-accent)]/20 border border-[var(--color-accent)]"
                      : "card-hover"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <svg className={`w-4 h-4 ${settings.format === opt.id ? "text-[var(--color-accent-light)]" : "text-[var(--color-juice-300)]"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d={opt.icon} />
                    </svg>
                    <span className={`font-semibold text-sm ${settings.format === opt.id ? "text-[var(--color-accent-light)]" : "text-white"}`}>
                      {opt.label}
                    </span>
                  </div>
                  <p className="text-[10px] text-[var(--color-juice-400)] leading-relaxed">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Quality */}
          <div>
            <h2 className="text-sm font-medium text-[var(--color-juice-300)] uppercase tracking-wider mb-2">Quality</h2>
            <div className="grid grid-cols-2 gap-2">
              {(qualityOptions[settings.format] || []).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setSettings((s) => ({ ...s, quality: opt.id }))}
                  className={`p-3 rounded-xl text-center transition-all ${
                    settings.quality === opt.id
                      ? "bg-[var(--color-accent)]/20 border border-[var(--color-accent)]"
                      : "card-hover"
                  }`}
                >
                  <span className={`text-sm font-medium ${settings.quality === opt.id ? "text-[var(--color-accent-light)]" : "text-white"}`}>
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Sample rate */}
          <div>
            <h2 className="text-sm font-medium text-[var(--color-juice-300)] uppercase tracking-wider mb-2">Sample Rate</h2>
            <div className="flex gap-2">
              {sampleRates.map((rate) => (
                <button
                  key={rate}
                  onClick={() => setSettings((s) => ({ ...s, sampleRate: rate }))}
                  className={`flex-1 p-3 rounded-xl text-center transition-all ${
                    settings.sampleRate === rate
                      ? "bg-[var(--color-accent)]/20 border border-[var(--color-accent)]"
                      : "card-hover"
                  }`}
                >
                  <span className={`text-sm font-medium ${settings.sampleRate === rate ? "text-[var(--color-accent-light)]" : "text-white"}`}>
                    {rate / 1000} kHz
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Export Type */}
          <div>
            <h2 className="text-sm font-medium text-[var(--color-juice-300)] uppercase tracking-wider mb-2">Export Type</h2>
            <div className="space-y-2">
              {exportTypeOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setSettings((s) => ({ ...s, exportType: opt.id as ExportSettings["exportType"] }))}
                  className={`w-full p-3 rounded-xl text-left transition-all flex items-center gap-3 ${
                    settings.exportType === opt.id
                      ? "bg-[var(--color-accent)]/20 border border-[var(--color-accent)]"
                      : "card-hover"
                  }`}
                >
                  <svg className={`w-4 h-4 flex-shrink-0 ${settings.exportType === opt.id ? "text-[var(--color-accent-light)]" : "text-[var(--color-juice-300)]"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d={opt.icon} />
                  </svg>
                  <div>
                    <span className={`font-medium text-sm ${settings.exportType === opt.id ? "text-[var(--color-accent-light)]" : "text-white"}`}>
                      {opt.label}
                    </span>
                    <p className="text-[10px] text-[var(--color-juice-400)]">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Normalize */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-medium text-white">Normalize</h3>
                <p className="text-[10px] text-[var(--color-juice-400)]">Scale peaks to the target level before encoding</p>
              </div>
              <button
                onClick={() => setSettings((s) => ({ ...s, normalize: !s.normalize }))}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  settings.normalize ? "bg-[var(--color-accent)]" : "bg-[var(--color-juice-500)]"
                }`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                    settings.normalize ? "right-0.5" : "left-0.5"
                  }`}
                />
              </button>
            </div>
            {settings.normalize && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--color-juice-300)]">Target level:</span>
                <input
                  type="number"
                  value={settings.targetLUFS}
                  onChange={(e) => setSettings((s) => ({ ...s, targetLUFS: parseFloat(e.target.value) || -14 }))}
                  step={0.5}
                  min={-24}
                  max={-8}
                  className="w-16 bg-[var(--color-juice-700)] border border-[var(--color-glass-border)] rounded-lg px-2 py-1 text-xs text-white text-center outline-none focus:border-[var(--color-accent)]"
                />
                <span className="text-[10px] text-[var(--color-juice-400)]">dBFS peak (Streaming: -14, Club: -9)</span>
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-white">Include Metadata</h3>
              <button
                onClick={() => setSettings((s) => ({ ...s, includeMetadata: !s.includeMetadata }))}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  settings.includeMetadata ? "bg-[var(--color-accent)]" : "bg-[var(--color-juice-500)]"
                }`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                    settings.includeMetadata ? "right-0.5" : "left-0.5"
                  }`}
                />
              </button>
            </div>
            {settings.includeMetadata && (
              <div className="space-y-2">
                {[
                  { key: "title", label: "Title" },
                  { key: "artist", label: "Artist" },
                  { key: "album", label: "Album" },
                  { key: "year", label: "Year" },
                  { key: "genre", label: "Genre" },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-xs text-[var(--color-juice-300)] w-12 flex-shrink-0">{label}</span>
                    <input
                      value={settings.metadata[key as keyof typeof settings.metadata]}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          metadata: { ...s.metadata, [key]: e.target.value },
                        }))
                      }
                      className="flex-1 bg-[var(--color-juice-700)] border border-[var(--color-glass-border)] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-[var(--color-accent)]"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center: Preview */}
        <div className="space-y-6">
          {/* Waveform visualizer */}
          <div>
            <h2 className="text-sm font-medium text-[var(--color-juice-300)] uppercase tracking-wider mb-2">Preview</h2>
            <div className="card p-4">
              {/* Waveform with labels */}
              <div className="relative mb-4">
                <div className="flex items-end h-24 gap-[2px]">
                  {waveform.map((val, i) => {
                    const height = Math.abs(val) * 100;
                    const isInSection = waveformLabels.some(
                      (s) => (i / waveform.length) * 100 >= s.start && (i / waveform.length) * 100 < s.end,
                    );
                    return (
                      <div
                        key={i}
                        className="flex-1 rounded-full transition-all"
                        style={{
                          height: `${Math.max(4, height)}%`,
                          backgroundColor: isInSection
                            ? playheadPos > (i / waveform.length) * 100
                              ? "var(--color-accent-light)"
                              : "rgba(124,58,237,0.3)"
                            : "var(--color-juice-500)",
                          opacity: isInSection ? 1 : 0.4,
                        }}
                      />
                    );
                  })}
                </div>

                {/* Playhead */}
                {audioPlaying && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg transition-all"
                    style={{ left: `${playheadPos}%` }}
                  />
                )}

                {/* Section labels */}
                <div className="mt-1.5 flex h-4 relative">
                  {waveformLabels.map((s) => {
                    const leftPct = s.start;
                    const widthPct = s.end - s.start;
                    return (
                      <div
                        key={s.label}
                        className="absolute text-[8px] text-[var(--color-juice-400)] truncate text-center"
                        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                      >
                        {s.label}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Playback controls */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleAudioPreview}
                    className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--color-accent)]/20 hover:bg-[var(--color-accent)]/30 transition-colors"
                  >
                    {audioPlaying ? (
                      <svg className="w-5 h-5 text-[var(--color-accent-light)]" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                        <rect x="6" y="4" width="4" height="16" rx="1" />
                        <rect x="14" y="4" width="4" height="16" rx="1" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-[var(--color-accent-light)]" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    )}
                  </button>
                  <div>
                    <p className="text-xs text-[var(--color-juice-200)]">Audio Preview</p>
                    <p className="text-[10px] text-[var(--color-juice-400)]">{project.duration} · {project.bpm} BPM · {project.key}</p>
                  </div>
                </div>

                {/* Time display */}
                <div className="text-right">
                  <p className="text-lg font-mono font-bold text-white">{project.duration}</p>
                  <p className="text-[10px] text-[var(--color-juice-400)]">Duration</p>
                </div>
              </div>
            </div>
          </div>

          {/* File size estimate */}
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-white">Estimated File Size</h3>
                <p className="text-[10px] text-[var(--color-juice-400)]">
                  {settings.format.toUpperCase()} · {settings.quality} · {settings.sampleRate / 1000} kHz
                </p>
              </div>
              <span className="text-xl font-bold text-white font-mono">{fileSizeEstimate}</span>
            </div>
          </div>
        </div>

        {/* Right: Export Queue & History */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-[var(--color-juice-300)] uppercase tracking-wider">Recent Exports</h2>

          <div className="space-y-2">
            {allExports.map((exp) => (
              <div key={exp.id} className="card p-3.5 flex items-center gap-3 group">
                {/* Type icon */}
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-[var(--color-glass-bg)]">
                  {exp.type === "stems" ? (
                    <svg className="w-4 h-4 text-[var(--color-accent-light)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  ) : exp.type === "lyrics" ? (
                    <svg className="w-4 h-4 text-[var(--color-accent-light)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-[var(--color-accent-light)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M9 18V5l12-2v13" />
                      <circle cx="6" cy="18" r="3" />
                      <circle cx="18" cy="16" r="3" />
                    </svg>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">{exp.fileName}</p>
                  <p className="text-[10px] text-[var(--color-juice-300)]">
                    {exp.format} · {exp.quality} · {exp.size}
                  </p>
                  <p className="text-[10px] text-[var(--color-juice-400)]">
                    {formatTimeAgo(exp.exportedAt)}
                    {exp.status === "completed" ? (
                      <span className="text-emerald-400 ml-1">✓ Completed</span>
                    ) : (
                      <span className="text-[var(--color-accent-light)] ml-1">⟳ Processing</span>
                    )}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleDownload(exp.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--color-glass-bg-hover)] text-[var(--color-juice-300)] hover:text-white transition-colors"
                    title="Download"
                  >
                    {downloadState[exp.id] === "downloading" ? (
                      <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12a9 9 0 11-6.219-8.56" />
                      </svg>
                    ) : downloadState[exp.id] === "done" ? (
                      <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(`https://juicestudio.io/exports/${exp.id}`);
                    }}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--color-glass-bg-hover)] text-[var(--color-juice-300)] hover:text-white transition-colors"
                    title="Copy link"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Keyboard shortcuts */}
          <div className="card p-3 mt-4">
            <div className="flex items-center justify-between text-[10px] text-[var(--color-juice-400)]">
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-juice-600)] text-[var(--color-juice-300)] text-[10px] font-mono">⌘E</kbd>
                <span>Export</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-juice-600)] text-[var(--color-juice-300)] text-[10px] font-mono">⌘S</kbd>
                <span>Save Settings</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast notification */}
      {showToast && lastExport && (
        <div className="fixed bottom-6 right-6 card p-4 z-50 shadow-2xl animate-[fadeSlideIn_0.3s_ease-out] max-w-sm"
          style={{ borderColor: "rgba(16,185,129,0.3)" }}
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-emerald-500/20">
              <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Export Complete!</p>
              <p className="text-xs text-[var(--color-juice-200)] truncate">{lastExport.fileName}</p>
              <p className="text-[10px] text-[var(--color-juice-300)] mt-0.5">{lastExport.format} · {lastExport.size}</p>
            </div>
            <button onClick={() => setShowToast(false)} className="text-[var(--color-juice-400)] hover:text-white">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* Publish toast */}
      {publishToast && (
        <div className="fixed bottom-20 right-6 card p-3 z-50 shadow-2xl animate-[fadeSlideIn_0.3s_ease-out] max-w-xs"
          style={{
            borderColor: publishToast.type === "success"
              ? "rgba(16,185,129,0.3)"
              : publishToast.type === "error"
                ? "rgba(239,68,68,0.3)"
                : "rgba(139,92,246,0.3)",
          }}
        >
          <div className="flex items-center gap-2">
            {publishToast.type === "success" ? (
              <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : publishToast.type === "error" ? (
              <svg className="w-4 h-4 text-red-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-purple-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <p className="text-xs text-white">{publishToast.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}

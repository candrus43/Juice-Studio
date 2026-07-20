// ─── Social Publish Cards ──────────────────────────────────
// Platform-specific publish cards for the Export Studio.

import { useState, useCallback } from "react";
import {
  isPlatformConnected,
  getConnection,
  removeConnection,
  getSoundCloudAuthUrl,
  getYouTubeAuthUrl,
  savePublishRecord,
  getSocialConfig,
  setSocialConfig,
} from "../persistence";

// ─── Types ───────────────────────────────────────────────────

interface SocialPublishCardProps {
  platform: "soundcloud" | "youtube" | "tiktok" | "instagram";
  songName: string;
  projectName: string;
  onPublished: (record: { platform: string; url?: string }) => void;
  onToast: (message: string, type?: "success" | "info" | "error") => void;
}

// ─── Platform Config ─────────────────────────────────────────

interface PlatformConfig {
  id: string;
  label: string;
  color: string;
  icon: string; // SVG path
  description: string;
  requiresApiKeys: boolean;
  keyNames: string[];
}

const platformConfigs: Record<string, PlatformConfig> = {
  soundcloud: {
    id: "soundcloud",
    label: "SoundCloud",
    color: "#FF7700",
    icon: "M11.56 2.88c-.84.24-1.52.84-1.76 1.68-.08.28-.12 3.6-.12 9.72 0 9.04 0 9.32.2 9.72.44.88 1.4 1.4 2.32 1.28.88-.12 1.64-.76 1.96-1.64.16-.44.2-1.92.24-9.56.04-8.92.04-9.12-.16-9.52-.44-.88-1.48-1.4-2.4-1.28-.12 0-.24 0-.28.04V2.88zm-4.44 1.96c-.44.24-.84.68-1 1.12-.16.44-.2 1.84-.2 7.92 0 5.88.04 7.52.16 7.88.2.6.72 1.08 1.36 1.24.16.04.56.08.88.08.64 0 1.32-.24 1.76-.64.36-.36.56-.76.6-1.28.04-.36.04-4.36 0-8.92-.04-7.92-.08-8.4-.28-8.76-.4-.76-1.36-1.2-2.28-1.04-.28.04-.72.2-1 .4v0zm10.56-.04c-.16.04-.44.16-.64.28-.48.28-.88.8-.92 1.24-.04.36-.04 1.72 0 3.04.08 3.28.08 4.88 0 6.28-.04.76-.04 1.48 0 1.6.08.24.44.64.76.84.36.24.6.28 1.24.24.84-.04 1.44-.36 1.84-.96.32-.48.36-.72.36-2.04v-1.52l.36.56c.48.8 1.28 1.2 2.32 1.2.92 0 1.52-.24 2.04-.84.48-.52.68-1.12.68-2.16 0-1.04-.2-1.64-.68-2.16-.52-.6-1.12-.84-2.04-.84-.76 0-1.4.2-1.84.64-.24.24-.44.56-.48.72-.04.12-.08.2-.08.2v-1.2c0-.96-.04-1.2-.2-1.48-.36-.64-1.08-1-1.88-.92-.04.04-.16.04-.28.04v0z",
    description: "Upload and share your track on SoundCloud",
    requiresApiKeys: true,
    keyNames: ["SoundCloud Client ID", "SoundCloud Client Secret"],
  },
  youtube: {
    id: "youtube",
    label: "YouTube",
    color: "#FF0000",
    icon: "M23.5 6.19a3.02 3.02 0 00-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.55A3.02 3.02 0 00.5 6.19 31.6 31.6 0 000 12a31.6 31.6 0 00.5 5.81 3.02 3.02 0 002.12 2.14c1.88.55 9.38.55 9.38.55s7.5 0 9.38-.55a3.02 3.02 0 002.12-2.14A31.6 31.6 0 0024 12a31.6 31.6 0 00-.5-5.81zM9.55 15.57V8.43L16 12l-6.45 3.57z",
    description: "Upload video to YouTube with waveform visualizer",
    requiresApiKeys: true,
    keyNames: ["YouTube Client ID"],
  },
  tiktok: {
    id: "tiktok",
    label: "TikTok",
    color: "#000000",
    icon: "M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.88 2.89 2.89 0 01-2.88-2.88c0-1.6 1.3-2.9 2.9-2.9.3 0 .58.05.84.14v-3.5a6.37 6.37 0 00-.84-.06A6.34 6.34 0 003.2 15.7a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.58a8.24 8.24 0 004.77 1.5v-3.4a4.85 4.85 0 01-1.06.01z",
    description: "Download a vertical video for TikTok posting",
    requiresApiKeys: false,
    keyNames: [],
  },
  instagram: {
    id: "instagram",
    label: "Instagram",
    color: "#E4405F",
    icon: "M12 2.16c3.2 0 3.58.01 4.85.07 3.26.15 4.82 1.71 4.97 4.97.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.26-1.71 4.82-4.97 4.97-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07C3.9 21.72 2.34 20.16 2.19 16.9 2.13 15.63 2.12 15.25 2.12 12s.01-3.58.07-4.85C2.34 3.9 3.9 2.34 7.15 2.19 8.42 2.13 8.8 2.12 12 2.12V2.16zm0-2.16C8.74 0 8.33.01 7.05.07 2.7.27.27 2.7.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.35 2.63 6.78 6.98 6.98 1.28.06 1.69.07 4.95.07s3.67-.01 4.95-.07c4.35-.2 6.78-2.63 6.98-6.98.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95C21.73 2.7 19.3.27 14.95.07 13.67.01 13.26 0 12 0zm0 5.84a6.16 6.16 0 100 12.32 6.16 6.16 0 000-12.32V5.84zm0 10.16a4 4 0 110-8 4 4 0 010 8zm6.41-10.4a1.44 1.44 0 100 2.88 1.44 1.44 0 000-2.88z",
    description: "Download a square video for Instagram posting",
    requiresApiKeys: false,
    keyNames: [],
  },
};

// ─── Platform Icon Component ─────────────────────────────────

function PlatformIcon({ platform }: { platform: string }) {
  const config = platformConfigs[platform];
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d={config?.icon || ""} />
    </svg>
  );
}

// ─── Upload/Download Simulator ───────────────────────────────

function usePublishSimulator() {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [resultUrl, setResultUrl] = useState("");

  const simulateUpload = useCallback(async (platform: string, songName: string) => {
    setStatus("uploading");
    setProgress(0);

    // Simulate progress
    const duration = 3000 + Math.random() * 2000;
    const interval = 100;
    const steps = duration / interval;
    let step = 0;

    return new Promise<void>((resolve) => {
      const timer = setInterval(() => {
        step++;
        const pct = Math.min(95, Math.round((step / steps) * 100));
        setProgress(pct);

        if (step >= steps) {
          clearInterval(timer);
          setProgress(100);
          const platformUrl =
            platform === "soundcloud"
              ? `https://soundcloud.com/king-juice/${songName.toLowerCase().replace(/\s+/g, "-")}`
              : platform === "youtube"
                ? `https://youtube.com/watch?v=juice-${Date.now().toString(36)}`
                : "";
          setResultUrl(platformUrl);
          setStatus("done");
          resolve();
        }
      }, interval);
    });
  }, []);

  const reset = useCallback(() => {
    setProgress(0);
    setStatus("idle");
    setResultUrl("");
  }, []);

  return { progress, status, resultUrl, simulateUpload, reset };
}

// ─── Social Publish Card ─────────────────────────────────────

export function SocialPublishCard({
  platform,
  songName,
  projectName,
  onPublished,
  onToast,
}: SocialPublishCardProps) {
  const config = platformConfigs[platform];
  const connected = isPlatformConnected(platform);
  const connection = getConnection(platform);
  const socialConfig = getSocialConfig();
  const { progress, status, resultUrl, simulateUpload, reset } = usePublishSimulator();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState(songName);
  const [description, setDescription] = useState("");
  const [privacy, setPrivacy] = useState<"public" | "private">("public");
  const [tags, setTags] = useState("");
  const [genre, setGenre] = useState("Trap");

  // For download-only platforms
  const isDownloadOnly = platform === "tiktok" || platform === "instagram";

  const handleConnect = useCallback(() => {
    if (platform === "soundcloud") {
      const url = getSoundCloudAuthUrl();
      if (!url) {
        onToast(
          "SoundCloud publishing requires API credentials. Add them in Settings.",
          "error",
        );
        return;
      }
      window.open(url, "_blank", "width=600,height=700");
      onToast("OAuth popup opened. Complete the authorization flow.", "info");
    } else if (platform === "youtube") {
      const url = getYouTubeAuthUrl();
      if (!url) {
        onToast(
          "YouTube publishing requires API credentials. Add them in Settings.",
          "error",
        );
        return;
      }
      window.open(url, "_blank", "width=600,height=700");
      onToast("OAuth popup opened. Complete the authorization flow.", "info");
    }
  }, [platform, onToast]);

  const handlePublish = useCallback(async () => {
    if (platform === "soundcloud" || platform === "youtube") {
      await simulateUpload(platform, songName);

      // Save publish record
      await savePublishRecord({
        id: `pub-${Date.now()}-${platform}`,
        songName,
        projectName,
        platform,
        url: resultUrl,
        publishedAt: new Date().toISOString(),
        status: "published",
      });

      onPublished({ platform, url: resultUrl });
      // Don't auto-toast here — let the card show the success state
    }
  }, [platform, songName, projectName, simulateUpload, resultUrl, onPublished]);

  const handleDownload = useCallback(() => {
    // Simulate download for TikTok/Instagram/Reels
    const formatLabels: Record<string, string> = {
      tiktok: "vertical video (9:16)",
      instagram: "square video (1:1)",
    };

    // Create a fake blob download for the UI
    setTimeout(async () => {
      // Generate a simulated video download
      const canvas = document.createElement("canvas");
      const aspect = platform === "instagram" ? 1 : 9 / 16;
      const w = platform === "instagram" ? 1080 : 720;
      const h = Math.round(w / aspect);
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Draw a gradient background
        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, "#7c3aed");
        grad.addColorStop(1, "#1e1b4b");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // Title text
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${Math.round(h * 0.05)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(songName, w / 2, h * 0.4);

        // Waveform visualization
        ctx.strokeStyle = "#a78bfa";
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i < w * 0.6; i += 4) {
          const x = w * 0.2 + i;
          const amp = Math.sin(i * 0.05) * (h * 0.1) + Math.sin(i * 0.02) * (h * 0.05);
          ctx.lineTo(x, h * 0.55 + amp);
        }
        ctx.stroke();

        // "King Juice" watermark
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = `${Math.round(h * 0.025)}px system-ui, sans-serif`;
        ctx.fillText("King Juice", w / 2, h * 0.75);
      }

      // Convert to blob
      canvas.toBlob(async (blob) => {
        if (!blob) {
          onToast("Failed to generate video", "error");
          return;
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${songName.replace(/\s+/g, "_")}_${platform}.mp4`;
        a.click();
        URL.revokeObjectURL(url);

        // Save publish record
        await savePublishRecord({
          id: `pub-${Date.now()}-${platform}`,
          songName,
          projectName,
          platform,
          publishedAt: new Date().toISOString(),
          status: "downloaded",
          downloadFormat: platform === "instagram" ? "square" : "vertical",
        });

        onPublished({ platform });
        onToast(`Saved! Open ${platform === "tiktok" ? "TikTok" : "Instagram"} and post from your camera roll.`, "success");
      }, "image/png");
    }, 500);

    onToast(`Preparing ${formatLabels[platform] || "video"} for download...`, "info");
  }, [platform, songName, projectName, onPublished, onToast]);

  const handleCopyLink = useCallback(() => {
    if (resultUrl) {
      navigator.clipboard.writeText(resultUrl).then(() => {
        onToast("Link copied to clipboard!", "success");
      });
    }
  }, [resultUrl, onToast]);

  // Check if API keys are configured for SoundCloud/YouTube
  const apiKeysMissing =
    platform === "soundcloud" && (!socialConfig.soundcloudClientId || !socialConfig.soundcloudClientSecret);
  const youtubeKeysMissing =
    platform === "youtube" && !socialConfig.youtubeClientId;

  return (
    <div className="card overflow-hidden">
      {/* Card header with platform branding */}
      <div className="flex items-center gap-3 p-4 border-b border-[var(--color-glass-border)]">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            backgroundColor: `${config.color}20`,
            color: config.color,
          }}
        >
          <PlatformIcon platform={platform} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">{config.label}</h3>
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                connected ? "bg-emerald-400" : "bg-[var(--color-juice-500)]"
              }`}
              title={connected ? "Connected" : "Not connected"}
            />
          </div>
          <p className="text-[10px] text-[var(--color-juice-300)]">
            {connected
              ? `Connected as ${connection?.profile?.displayName || connection?.username || "User"}`
              : isDownloadOnly
                ? "Download for posting"
                : "Connect to publish"}
          </p>
        </div>
      </div>

      {/* Status: Done */}
      {status === "done" && (
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-emerald-400">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium">
              {isDownloadOnly
                ? `Downloaded for ${config.label}!`
                : `Live on ${config.label}!`}
            </span>
          </div>
          {resultUrl && (
            <div className="flex items-center gap-2">
              <a
                href={resultUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-purple-400 hover:text-purple-300 underline truncate"
              >
                {resultUrl}
              </a>
              <button
                onClick={handleCopyLink}
                className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--color-glass-bg-hover)] text-[var(--color-juice-300)] hover:text-white transition-colors"
                title="Copy link"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
              </button>
            </div>
          )}
          <button
            onClick={reset}
            className="btn-glass text-xs py-1.5"
          >
            Publish Another
          </button>
        </div>
      )}

      {/* Status: Uploading */}
      {status === "uploading" && (
        <div className="p-4 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-white font-medium">
              {isDownloadOnly ? "Preparing download..." : `Uploading to ${config.label}...`}
            </span>
            <span className="text-xs text-[var(--color-accent-light)] font-mono">{progress}%</span>
          </div>
          <div className="progress-bar h-2">
            <div
              className="progress-bar-fill h-2"
              style={{ width: `${progress}%`, transition: "width 0.15s linear" }}
            />
          </div>
          <p className="text-[10px] text-[var(--color-juice-300)]">
            {progress < 30
              ? "Preparing audio..."
              : progress < 60
                ? "Uploading..."
                : progress < 90
                  ? "Processing..."
                  : "Finalizing..."}
          </p>
        </div>
      )}

      {/* Status: Idle — Show form or connect/download */}
      {status === "idle" && (
        <div className="p-4 space-y-3">
          {/* Form fields for SoundCloud/YouTube */}
          {(platform === "soundcloud" || platform === "youtube") && connected && (
            <div className="space-y-2.5">
              <div>
                <label className="text-[10px] text-[var(--color-juice-300)] block mb-0.5">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[var(--color-juice-700)] border border-[var(--color-glass-border)] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-[var(--color-accent)]"
                  placeholder="Song title"
                />
              </div>
              <div>
                <label className="text-[10px] text-[var(--color-juice-300)] block mb-0.5">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-[var(--color-juice-700)] border border-[var(--color-glass-border)] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-[var(--color-accent)] resize-none"
                  placeholder="Track description..."
                />
              </div>
              {platform === "soundcloud" && (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-[var(--color-juice-300)] block mb-0.5">Genre</label>
                    <input
                      type="text"
                      value={genre}
                      onChange={(e) => setGenre(e.target.value)}
                      className="w-full bg-[var(--color-juice-700)] border border-[var(--color-glass-border)] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-[var(--color-accent)]"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-[var(--color-juice-300)] block mb-0.5">Privacy</label>
                    <select
                      value={privacy}
                      onChange={(e) => setPrivacy(e.target.value as "public" | "private")}
                      className="w-full bg-[var(--color-juice-700)] border border-[var(--color-glass-border)] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-[var(--color-accent)]"
                    >
                      <option value="public">Public</option>
                      <option value="private">Private</option>
                    </select>
                  </div>
                </div>
              )}
              {(platform === "soundcloud" || platform === "youtube") && (
                <div>
                  <label className="text-[10px] text-[var(--color-juice-300)] block mb-0.5">Tags (comma separated)</label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    className="w-full bg-[var(--color-juice-700)] border border-[var(--color-glass-border)] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-[var(--color-accent)]"
                    placeholder="trap, r&b, king juice"
                  />
                </div>
              )}
              <button
                onClick={handlePublish}
                className="w-full btn-primary text-xs py-2"
                style={{ backgroundColor: config.color + "30", borderColor: config.color + "50", color: config.color }}
              >
                <PlatformIcon platform={platform} />
                Upload to {config.label}
              </button>
            </div>
          )}

          {/* Connect button (SoundCloud/YouTube when not connected) */}
          {(platform === "soundcloud" || platform === "youtube") && !connected && (
            <div className="space-y-2">
              {apiKeysMissing || youtubeKeysMissing ? (
                <div className="glass-panel p-3 bg-[var(--color-juice-700)] rounded-lg">
                  <p className="text-[10px] text-[var(--color-juice-200)] leading-relaxed">
                    {config.label} publishing requires API credentials.
                    Add them in{" "}
                    <button
                      onClick={() => {
                        // Dispatch a custom event to open settings to social tab
                        window.dispatchEvent(
                          new CustomEvent("juice:openSettings", { detail: { tab: "social" } }),
                        );
                      }}
                      className="text-purple-400 underline hover:text-purple-300"
                    >
                      Settings → Social Accounts
                    </button>
                  </p>
                </div>
              ) : (
                <button
                  onClick={handleConnect}
                  className="w-full btn-glass text-xs py-2"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  Connect {config.label}
                </button>
              )}
            </div>
          )}

          {/* Download buttons (TikTok/Instagram) */}
          {isDownloadOnly && (
            <div className="space-y-2">
              <p className="text-[10px] text-[var(--color-juice-300)] leading-relaxed">
                {config.description}. {config.label} doesn't support direct audio uploads — we'll prepare a formatted video for you to post manually.
              </p>
              <button
                onClick={handleDownload}
                className="w-full btn-glass text-xs py-2"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                Download for {config.label}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Social Accounts Settings Tab ────────────────────────────

interface SocialAccountSettingsProps {
  onToast: (msg: string, type?: "success" | "info" | "error") => void;
}

export function SocialAccountSettings({ onToast }: SocialAccountSettingsProps) {
  const config = getSocialConfig();
  const [scClientId, setScClientId] = useState(config.soundcloudClientId);
  const [scClientSecret, setScClientSecret] = useState(config.soundcloudClientSecret);
  const [ytClientId, setYtClientId] = useState(config.youtubeClientId);
  const [ytClientSecret, setYtClientSecret] = useState(config.youtubeClientSecret);
  const [saved, setSaved] = useState(false);

  const connections = {
    soundcloud: getConnection("soundcloud"),
    youtube: getConnection("youtube"),
    tiktok: getConnection("tiktok"),
    instagram: getConnection("instagram"),
  };

  const handleSaveConfig = useCallback(() => {
    setSocialConfig({
      soundcloudClientId: scClientId,
      soundcloudClientSecret: scClientSecret,
      youtubeClientId: ytClientId,
      youtubeClientSecret: ytClientSecret,
      redirectUri: typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback`
        : "",
    });
    setSaved(true);
    onToast("API credentials saved!", "success");
    setTimeout(() => setSaved(false), 2000);
  }, [scClientId, scClientSecret, ytClientId, ytClientSecret, onToast]);

  const handleDisconnect = useCallback(
    (platform: string) => {
      removeConnection(platform);
      onToast(`${platform === "soundcloud" ? "SoundCloud" : platform === "youtube" ? "YouTube" : platform === "tiktok" ? "TikTok" : "Instagram"} disconnected`, "info");
    },
    [onToast],
  );

  const handleConnect = useCallback(
    (platform: string) => {
      if (platform === "soundcloud") {
        const url = getSoundCloudAuthUrl();
        if (!url) {
          onToast("Enter your SoundCloud Client ID first", "error");
          return;
        }
        window.open(url, "_blank", "width=600,height=700");
      } else if (platform === "youtube") {
        const url = getYouTubeAuthUrl();
        if (!url) {
          onToast("Enter your YouTube Client ID first", "error");
          return;
        }
        window.open(url, "_blank", "width=600,height=700");
      }
    },
    [onToast],
  );

  const platformInfo = [
    {
      id: "soundcloud" as const,
      label: "SoundCloud",
      color: "#FF7700",
      connected: !!connections.soundcloud?.connected,
      username: connections.soundcloud?.profile?.displayName || connections.soundcloud?.username,
      apiKeysRequired: true,
    },
    {
      id: "youtube" as const,
      label: "YouTube",
      color: "#FF0000",
      connected: !!connections.youtube?.connected,
      username: connections.youtube?.profile?.displayName || connections.youtube?.username,
      apiKeysRequired: true,
    },
    {
      id: "tiktok" as const,
      label: "TikTok",
      color: "#000000",
      connected: false,
      username: undefined,
      apiKeysRequired: false,
    },
    {
      id: "instagram" as const,
      label: "Instagram",
      color: "#E4405F",
      connected: false,
      username: undefined,
      apiKeysRequired: false,
    },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-white">Social Accounts</h3>
      <p className="text-sm text-[var(--color-juice-200)]">
        Connect your social accounts to publish tracks directly from the Export Studio.
      </p>

      {/* Platform connections */}
      <div className="space-y-3">
        {platformInfo.map((p) => (
          <div
            key={p.id}
            className="card p-3.5 flex items-center gap-3"
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${p.color}15`, color: p.color }}
            >
              <PlatformIcon platform={p.id} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">{p.label}</span>
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    p.connected ? "bg-emerald-400" : "bg-[var(--color-juice-500)]"
                  }`}
                />
              </div>
              <p className="text-[10px] text-[var(--color-juice-300)]">
                {p.connected
                  ? `Connected as ${p.username || "User"}`
                  : p.id === "tiktok"
                    ? "TikTok doesn't support direct uploads. We'll prepare your video for manual posting."
                    : p.id === "instagram"
                      ? "Instagram doesn't support direct audio uploads. Download a formatted video for posting."
                      : "Not connected"}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {p.apiKeysRequired && (
                <button
                  onClick={() => handleConnect(p.id)}
                  className="btn-glass text-[10px] py-1 px-2.5"
                >
                  {p.connected ? "Reconnect" : "Connect"}
                </button>
              )}
              {p.connected && (
                <button
                  onClick={() => handleDisconnect(p.id)}
                  className="text-[10px] py-1 px-2.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors"
                >
                  Disconnect
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* API Config */}
      <div className="border-t border-[var(--color-glass-border)] pt-4">
        <h4 className="text-sm font-semibold text-white mb-2">API Credentials</h4>
        <p className="text-[10px] text-[var(--color-juice-300)] mb-3 leading-relaxed">
          SoundCloud and YouTube require registered app credentials. Set them up here.
        </p>

        <div className="space-y-2.5">
          <div>
            <label className="text-[10px] text-[var(--color-juice-300)] block mb-0.5">
              SoundCloud Client ID
            </label>
            <input
              type="password"
              value={scClientId}
              onChange={(e) => setScClientId(e.target.value)}
              className="w-full bg-[var(--color-juice-700)] border border-[var(--color-glass-border)] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
              placeholder={scClientId ? `••••${scClientId.slice(-4)}` : "Enter SoundCloud client ID..."}
            />
          </div>
          <div>
            <label className="text-[10px] text-[var(--color-juice-300)] block mb-0.5">
              SoundCloud Client Secret
            </label>
            <input
              type="password"
              value={scClientSecret}
              onChange={(e) => setScClientSecret(e.target.value)}
              className="w-full bg-[var(--color-juice-700)] border border-[var(--color-glass-border)] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
              placeholder={scClientSecret ? `••••${scClientSecret.slice(-4)}` : "Enter SoundCloud client secret..."}
            />
          </div>
          <div>
            <label className="text-[10px] text-[var(--color-juice-300)] block mb-0.5">
              YouTube Client ID
            </label>
            <input
              type="password"
              value={ytClientId}
              onChange={(e) => setYtClientId(e.target.value)}
              className="w-full bg-[var(--color-juice-700)] border border-[var(--color-glass-border)] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
              placeholder={ytClientId ? `••••${ytClientId.slice(-4)}` : "Enter YouTube client ID..."}
            />
          </div>
          <div>
            <label className="text-[10px] text-[var(--color-juice-300)] block mb-0.5">
              YouTube Client Secret
            </label>
            <input
              type="password"
              value={ytClientSecret}
              onChange={(e) => setYtClientSecret(e.target.value)}
              className="w-full bg-[var(--color-juice-700)] border border-[var(--color-glass-border)] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
              placeholder={ytClientSecret ? `••••${ytClientSecret.slice(-4)}` : "Enter YouTube client secret..."}
            />
          </div>
          <div>
            <label className="text-[10px] text-[var(--color-juice-300)] block mb-0.5">Redirect URI</label>
            <input
              type="text"
              value={config.redirectUri || `${window.location.origin}/auth/callback`}
              readOnly
              className="w-full bg-[var(--color-juice-700)] border border-[var(--color-glass-border)] rounded-lg px-3 py-2 text-xs text-[var(--color-juice-300)] outline-none cursor-default font-mono"
            />
            <p className="text-[9px] text-[var(--color-juice-400)] mt-0.5">
              Add this URL to your app's OAuth redirect settings.
            </p>
          </div>
        </div>

        <button onClick={handleSaveConfig} className="btn-primary text-xs py-2 mt-3">
          {saved ? "Saved ✓" : "Save Credentials"}
        </button>
      </div>
    </div>
  );
}

// ─── Helper to replace the async import
// removeConnection is imported from "../persistence" at the top of this file.
// Use it directly as removeConnection(platform).

// ─── Settings Panel ────────────────────────────────────────
// Slide-in panel for profile, API keys, preferences, data export.
import { useState, useCallback, useEffect, useRef } from "react";
import {
  getSettings, saveSettings, getApiKeys, setApiKeys,
  exportAllData, importAllData, clearAllData, clearAuth,
} from "../persistence";
import { SocialAccountSettings } from "./SocialPublish";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
}

type SettingsTab = "profile" | "apikeys" | "social" | "preferences" | "data" | "about";

export function SettingsPanel({ isOpen, onClose, onLogout }: SettingsPanelProps) {
  const [tab, setTab] = useState<SettingsTab>("profile");
  const [userName, setUserName] = useState("King Juice");
  const [studioName, setStudioName] = useState("Juice Studio");
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [autoSaveInterval, setAutoSaveInterval] = useState(500);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    // Load current settings
    getSettings().then((s) => {
      setUserName(s.userName);
      setAutoSaveInterval((s.preferences?.autoSaveInterval as number) || 500);
    });
    setKeys(getApiKeys());
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  const handleSaveProfile = useCallback(async () => {
    await saveSettings({ userName: userName.trim() || "King Juice" });
    setSaveMsg("Profile saved ✓");
    setTimeout(() => setSaveMsg(""), 2000);
  }, [userName]);

  const handleSaveApiKeys = useCallback(() => {
    setApiKeys(keys);
    setSaveMsg("API keys saved ✓");
    setTimeout(() => setSaveMsg(""), 2000);
  }, [keys]);

  const handleSavePreferences = useCallback(async () => {
    await saveSettings({ preferences: { autoSaveInterval } });
    setSaveMsg("Preferences saved ✓");
    setTimeout(() => setSaveMsg(""), 2000);
  }, [autoSaveInterval]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const data = await exportAllData();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `juice-studio-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setSaveMsg("Data exported ✓");
    } catch {
      setSaveMsg("Export failed");
    }
    setExporting(false);
    setTimeout(() => setSaveMsg(""), 2000);
  }, []);

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await importAllData(data);
      setSaveMsg("Data imported ✓ — page will reload.");
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      setSaveMsg("Import failed — invalid file.");
    }
    setImporting(false);
    setTimeout(() => setSaveMsg(""), 3000);
  }, []);

  const handleClear = useCallback(async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 5000);
      return;
    }
    setClearing(true);
    try {
      await clearAllData();
      clearAuth();
      localStorage.clear();
      setSaveMsg("All data cleared. Reloading...");
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      setSaveMsg("Clear failed");
    }
    setClearing(false);
  }, [confirmClear]);

  if (!isOpen) return null;

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: "profile", label: "Profile" },
    { id: "apikeys", label: "API Keys" },
    { id: "social", label: "Social" },
    { id: "preferences", label: "Preferences" },
    { id: "data", label: "Data" },
    { id: "about", label: "About" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative h-full w-full max-w-lg bg-[var(--color-juice-800)] border-l border-[var(--color-glass-border)] shadow-2xl animate-[fadeSlideIn_0.2s_ease-out] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-[var(--color-glass-border)] bg-[var(--color-juice-800)]">
          <h2 className="text-lg font-semibold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--color-glass-bg-hover)] transition-colors text-[var(--color-juice-200)]"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 py-3 border-b border-[var(--color-glass-border)] overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 text-sm rounded-lg whitespace-nowrap transition-colors ${
                tab === t.id
                  ? "bg-purple-600/20 text-purple-400 font-medium"
                  : "text-[var(--color-juice-200)] hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Profile */}
          {tab === "profile" && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-white">Profile</h3>
              <div>
                <label className="text-sm font-medium text-[var(--color-juice-100)] mb-1.5 block">Name</label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full bg-[var(--color-juice-700)] border border-[var(--color-glass-border)] rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-[var(--color-juice-300)] focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--color-juice-100)] mb-1.5 block">Studio Name</label>
                <input
                  type="text"
                  value={studioName}
                  onChange={(e) => setStudioName(e.target.value)}
                  className="w-full bg-[var(--color-juice-700)] border border-[var(--color-glass-border)] rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-[var(--color-juice-300)] focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
              <div className="flex items-center gap-3">
                <button onClick={handleSaveProfile} className="btn-primary text-sm py-2">
                  Save Profile
                </button>
                {saveMsg && <span className="text-xs text-green-400">{saveMsg}</span>}
              </div>
              <div className="pt-4 border-t border-[var(--color-glass-border)]">
                <button onClick={onLogout} className="btn-glass text-sm border-red-500/30 text-red-400 hover:text-red-300">
                  Sign Out
                </button>
              </div>
            </div>
          )}

          {/* API Keys */}
          {tab === "apikeys" && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-white">API Keys</h3>
              <p className="text-sm text-[var(--color-juice-200)]">
                Keys are stored locally in your browser. They never leave your machine.
              </p>
              {(["openai", "anthropic", "suno", "udio"] as const).map((provider) => (
                <div key={provider}>
                  <label className="text-sm font-medium text-[var(--color-juice-100)] mb-1.5 block capitalize">
                    {provider === "openai" ? "OpenAI" : provider === "anthropic" ? "Anthropic" : provider === "suno" ? "Suno" : "Udio"} API Key
                  </label>
                  <input
                    type="password"
                    value={keys[provider] || ""}
                    onChange={(e) => setKeys((k) => ({ ...k, [provider]: e.target.value }))}
                    className="w-full bg-[var(--color-juice-700)] border border-[var(--color-glass-border)] rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-[var(--color-juice-300)] focus:outline-none focus:border-purple-500 transition-colors"
                    placeholder={keys[provider] ? `••••${keys[provider].slice(-4)}` : "Enter key..."}
                  />
                </div>
              ))}
              <div className="flex items-center gap-3">
                <button onClick={handleSaveApiKeys} className="btn-primary text-sm py-2">
                  Save Keys
                </button>
                {saveMsg && <span className="text-xs text-green-400">{saveMsg}</span>}
              </div>
            </div>
          )}

          {/* Social Accounts */}
          {tab === "social" && (
            <SocialAccountSettings
              onToast={(msg, type) => {
                setToastMsg(msg);
                setTimeout(() => setToastMsg(""), 3000);
              }}
            />
          )}

          {/* Preferences */}
          {tab === "preferences" && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-white">Preferences</h3>
              <div>
                <label className="text-sm font-medium text-[var(--color-juice-100)] mb-1.5 block">
                  Auto-save interval: {autoSaveInterval}ms
                </label>
                <input
                  type="range"
                  min="200"
                  max="2000"
                  step="100"
                  value={autoSaveInterval}
                  onChange={(e) => setAutoSaveInterval(parseInt(e.target.value))}
                  className="w-full accent-purple-600"
                />
                <div className="flex justify-between text-xs text-[var(--color-juice-300)] mt-1">
                  <span>200ms (Faster)</span>
                  <span>2000ms (Slower)</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={handleSavePreferences} className="btn-primary text-sm py-2">
                  Save Preferences
                </button>
                {saveMsg && <span className="text-xs text-green-400">{saveMsg}</span>}
              </div>
            </div>
          )}

          {/* Data */}
          {tab === "data" && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-white">Data Management</h3>

              <div className="glass-panel bg-[var(--color-juice-700)] p-4 space-y-3">
                <div>
                  <h4 className="text-sm font-medium text-white mb-1">Export All Data</h4>
                  <p className="text-xs text-[var(--color-juice-200)] mb-2">
                    Download all your projects, beats, lyrics, and settings as JSON.
                  </p>
                  <button onClick={handleExport} disabled={exporting} className="btn-glass text-sm py-2">
                    {exporting ? "Exporting..." : "Export All Data"}
                  </button>
                </div>

                <div className="border-t border-[var(--color-glass-border)] pt-3">
                  <h4 className="text-sm font-medium text-white mb-1">Import Data</h4>
                  <p className="text-xs text-[var(--color-juice-200)] mb-2">
                    Restore a backup file. This will replace all current data.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleImport}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importing}
                    className="btn-glass text-sm py-2"
                  >
                    {importing ? "Importing..." : "Import from File"}
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-red-500/20">
                <h4 className="text-sm font-medium text-red-400 mb-1">Danger Zone</h4>
                <p className="text-xs text-[var(--color-juice-200)] mb-2">
                  Permanently delete all data. This cannot be undone.
                </p>
                <button
                  onClick={handleClear}
                  disabled={clearing}
                  className={`text-sm py-2 px-4 rounded-lg font-medium transition-colors ${
                    confirmClear
                      ? "bg-red-600 text-white"
                      : "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20"
                  }`}
                >
                  {clearing ? "Clearing..." : confirmClear ? "Click again to confirm — all data will be lost" : "Clear All Data"}
                </button>
              </div>

              {saveMsg && <span className="text-xs text-green-400">{saveMsg}</span>}
            </div>
          )}

          {/* About */}
          {tab === "about" && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-white">About Juice Studio</h3>
              <div className="glass-panel bg-[var(--color-juice-700)] p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--color-juice-300)]">Version</span>
                  <span className="text-white">1.0.0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-juice-300)]">Build</span>
                  <span className="text-white">2026.07.19</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-juice-300)]">Modules</span>
                  <span className="text-white">11</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-juice-300)]">Platform</span>
                  <span className="text-white">Browser (IndexedDB)</span>
                </div>
              </div>
              <p className="text-xs text-[var(--color-juice-300)] leading-relaxed">
                Juice Studio is a world-class, AI-native recording studio — dark, minimal, and fast. Built for King Juice to go from an idea to a release-ready track in one seamless flow.
              </p>
              <p className="text-xs text-[var(--color-juice-400)]">
                © 2026 Juice Studio. All rights reserved.
              </p>
            </div>
          )}

          {/* Toast notification */}
          {toastMsg && (
            <div className="fixed bottom-6 right-6 card p-3 z-50 shadow-2xl animate-[fadeSlideIn_0.3s_ease-out] max-w-xs"
              style={{ borderColor: "rgba(139,92,246,0.3)" }}
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-purple-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-white">{toastMsg}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

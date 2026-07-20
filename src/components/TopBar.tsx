// ─── TopBar ────────────────────────────────────────────────
// Includes auto-save indicator, breadcrumb, and settings panel trigger
import { useState, useEffect } from "react";
import { useLocation } from "@tanstack/react-router";
import { currentProject } from "../data/mock";
import { AutoSaveIndicator } from "./AutoSave";
import type { AutoSaveState } from "./AutoSave";

interface TopBarProps {
  autoSaveState?: AutoSaveState;
  onOpenSettings?: () => void;
  userName?: string;
}

// Module breadcrumb mapping
const moduleLabels: Record<string, string> = {
  "/": "Dashboard",
  "/beat-studio": "Beat Studio",
  "/recording-studio": "Recording Studio",
  "/vocal-processing": "Vocal Processing",
  "/mixing-mastering": "Mixing & Mastering",
  "/songwriter": "Songwriter",
  "/music-creation": "Music Creation",
  "/arrangement": "Arrangement",
  "/project-manager": "Project Manager",
  "/export-studio": "Export Studio",
  "/cover-art-studio": "Cover Art Studio",
  "/video-studio": "Video Studio",
};

export function TopBar({ autoSaveState, onOpenSettings, userName = "King Juice" }: TopBarProps) {
  const [time, setTime] = useState(new Date());
  const location = useLocation();
  const project = currentProject;

  const breadcrumb = moduleLabels[location.pathname] || "Dashboard";

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const formattedTime = time.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

  // Get initials from userName
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "KJ";

  return (
    <header className="sticky top-0 z-30 h-14 flex items-center justify-between px-4 md:px-6 border-b border-[var(--color-glass-border)] bg-[rgba(10,10,10,0.8)] backdrop-blur-xl">
      {/* Left: Breadcrumb + current project + save indicator */}
      <div className="flex items-center gap-4">
        {/* Breadcrumb */}
        <div className="hidden sm:flex items-center gap-2">
          <span className="text-sm font-medium text-white tracking-tight">{breadcrumb}</span>
          {location.pathname !== "/" && (
            <>
              <span className="text-[var(--color-juice-400)]">/</span>
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0 animate-glowPulse"
                style={{ backgroundColor: project.coverColor }}
              />
              <span className="text-sm font-medium text-[var(--color-juice-100)] truncate max-w-[120px]">
                {project.name}
              </span>
              <span className="text-xs text-[var(--color-juice-300)] hidden lg:inline">
                {project.bpm} BPM · {project.key}
              </span>
            </>
          )}
        </div>

        {/* Auto-save indicator */}
        {autoSaveState && (
          <div className="hidden sm:block border-l border-[var(--color-glass-border)] pl-4">
            <AutoSaveIndicator state={autoSaveState} />
          </div>
        )}
      </div>

      {/* Right: User + Settings + Time */}
      <div className="flex items-center gap-2">
        <div className="text-xs text-[var(--color-juice-300)] hidden sm:block mr-2">
          {formattedTime}
        </div>
        <button
          className="btn-glass px-3 py-1.5 text-xs gap-1.5"
          title="Settings"
          onClick={onOpenSettings}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
          <span className="hidden sm:inline">Settings</span>
        </button>

        {/* User avatar */}
        <div className="flex items-center gap-2 pl-2 border-l border-[var(--color-glass-border)]">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0 transition-transform duration-150 hover:scale-105 cursor-pointer"
            style={{ background: "linear-gradient(135deg, #7c3aed, #5b21b6)" }}
          >
            {initials}
          </div>
          <span className="text-sm font-medium text-white hidden md:inline">{userName}</span>
        </div>
      </div>
    </header>
  );
}

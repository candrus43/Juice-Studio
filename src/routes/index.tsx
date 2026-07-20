import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { readFile } from "node:fs/promises";
import {
  currentProject,
  recentProjects,
  favoriteBeats,
  exportedTracks,
  getCreativeBrief,
  quickActions,
} from "../data/mock";

const getBusinessName = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const cfg = JSON.parse(await readFile("site.json", "utf8")) as { businessName?: string };
    return cfg.businessName?.trim() ?? "Juice Studio";
  } catch {
    return "Juice Studio";
  }
});

export const Route = createFileRoute("/")({
  loader: () => getBusinessName(),
  component: Dashboard,
});

function Dashboard() {
  const businessName = Route.useLoaderData();
  const router = useRouter();
  const project = currentProject;
  const brief = getCreativeBrief();
  const tracks = exportedTracks.slice(0, 3);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6">
      {/* Hero greeting */}
      <div className="mb-2 animate-slideUp" style={{ animationDelay: "0ms" }}>
        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
          {brief.greeting}, <span style={{ background: "linear-gradient(135deg, #c084fc, #7c3aed)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>King Juice</span>.
        </h1>
        <p className="text-[var(--color-juice-200)] mt-1 text-sm md:text-base">
          {brief.completedYesterday}
        </p>
      </div>

      {/* Current Project + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Current Project Card */}
        <div className="lg:col-span-2 card p-5 animate-slideUp" style={{ animationDelay: "50ms" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${project.coverColor}, ${project.coverColor}88)` }}
              >
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-white text-lg leading-tight">{project.name}</h3>
                <p className="text-xs text-[var(--color-juice-300)]">
                  {project.bpm} BPM · {project.key} · {project.genre}
                </p>
              </div>
            </div>
            <span className="text-xs font-medium text-[var(--color-accent-light)] bg-[var(--color-glass-bg-active)] px-3 py-1 rounded-full">
              {project.progress}% Complete
            </span>
          </div>

          {/* Progress bar */}
          <div className="progress-bar mb-3">
            <div className="progress-bar-fill" style={{ width: `${project.progress}%` }} />
          </div>

          <div className="flex items-center justify-between text-xs text-[var(--color-juice-300)]">
            <span>Last action: {project.lastAction}</span>
            <span>{new Date(project.lastModified).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
          </div>

          {/* Open project button */}
          <button
            onClick={() => router.navigate({ to: "/project-manager" })}
            className="btn-primary mt-4 w-full sm:w-auto"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Open Project
          </button>
        </div>

        {/* AI Daily Creative Brief */}
        <div className="card p-5 flex flex-col animate-slideUp" style={{ borderColor: "rgba(124,58,237,0.15)", animationDelay: "150ms" }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #7c3aed, #a78bfa)" }}>
              <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a4 4 0 014 4c0 2-2 3-2 5s2 3 2 5a4 4 0 01-8 0c0-2 2-3 2-5s-2-3-2-5a4 4 0 014-4z" />
              </svg>
            </div>
            <h3 className="font-semibold text-white text-sm">Daily Creative Brief</h3>
          </div>

          <div className="space-y-3 flex-1">
            <div>
              <p className="text-xs text-[var(--color-juice-300)] mb-2">Today's recommendations:</p>
              <ul className="space-y-2">
                {brief.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-juice-100)]">
                    <span className="text-[var(--color-accent-light)] mt-0.5 flex-shrink-0">•</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-[var(--color-glass-border)]">
            <p className="text-xs text-[var(--color-juice-300)] italic leading-relaxed">
              💡 {brief.tip}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="animate-slideUp" style={{ animationDelay: "100ms" }}>
        <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => router.navigate({ to: action.path })}
              className="card-hover p-4 flex flex-col items-center gap-2 text-center group"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
                style={{ backgroundColor: `${action.color}20`, color: action.color }}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d={action.icon} />
                </svg>
              </div>
              <span className="text-xs font-medium text-[var(--color-juice-100)] group-hover:text-white transition-colors">
                {action.label}
              </span>
            </button>
          ))}
          {/* Import Beat quick action */}
          <button
            onClick={() => router.navigate({ to: "/beat-studio" })}
            className="card-hover p-4 flex flex-col items-center gap-2 text-center group"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
              style={{ backgroundColor: "#22c55e20", color: "#22c55e" }}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
            </div>
            <span className="text-xs font-medium text-[var(--color-juice-100)] group-hover:text-white transition-colors">
              Import Beat
            </span>
          </button>
        </div>
      </div>

      {/* Recent Projects + Favorite Beats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Projects */}
        <div className="animate-slideUp" style={{ animationDelay: "200ms" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Recent Projects</h2>
            <button
              onClick={() => router.navigate({ to: "/project-manager" })}
              className="text-xs text-[var(--color-accent-light)] hover:text-[var(--color-accent)] transition-colors"
            >
              View all
            </button>
          </div>
          <div className="space-y-2">
            {recentProjects.length > 0 ? (
              recentProjects.slice(0, 5).map((p) => (
                <button
                  key={p.id}
                  onClick={() => router.navigate({ to: "/project-manager" })}
                  className="card-hover p-3.5 w-full text-left flex items-center gap-3 group"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-white font-bold text-xs"
                    style={{ background: `linear-gradient(135deg, ${p.coverColor}, ${p.coverColor}88)` }}
                  >
                    {p.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-white text-sm truncate">{p.name}</h3>
                      <span className="text-xs text-[var(--color-juice-300)] ml-2 flex-shrink-0">{p.progress}%</span>
                    </div>
                    <p className="text-xs text-[var(--color-juice-300)] truncate">{p.bpm} BPM · {p.key} · {p.lastAction}</p>
                  </div>
                </button>
              ))
            ) : (
              <div className="card p-6 text-center">
                <svg className="w-10 h-10 mx-auto mb-3 text-[var(--color-juice-300)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <p className="text-[var(--color-juice-200)] text-sm mb-3">No projects yet</p>
                <button
                  onClick={() => router.navigate({ to: "/project-manager" })}
                  className="btn-primary text-xs py-2 px-4"
                >
                  + Create your first project
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Favorite Beats */}
        <div className="animate-slideUp" style={{ animationDelay: "300ms" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Favorite Beats</h2>
            <button
              onClick={() => router.navigate({ to: "/beat-studio" })}
              className="text-xs text-[var(--color-accent-light)] hover:text-[var(--color-accent)] transition-colors"
            >
              Beat Studio
            </button>
          </div>
          <div className="scroller">
            {favoriteBeats.length > 0 ? (
              favoriteBeats.map((beat) => (
                <button
                  key={beat.id}
                  onClick={() => router.navigate({ to: "/beat-studio" })}
                  className="card-hover p-4 w-[180px] text-left group flex-shrink-0"
                >
                  <div
                    className="w-full h-24 rounded-lg mb-3 flex items-center justify-center"
                    style={{ background: `linear-gradient(135deg, ${beat.color}40, ${beat.color}10)` }}
                  >
                    <svg className="w-8 h-8 opacity-60 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke={beat.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18V5l12-2v13" />
                      <circle cx="6" cy="18" r="3" />
                      <circle cx="18" cy="16" r="3" />
                    </svg>
                  </div>
                  <h3 className="font-medium text-white text-sm truncate">{beat.name}</h3>
                  <p className="text-xs text-[var(--color-juice-300)]">{beat.bpm} BPM · {beat.key} · {beat.duration}</p>
                </button>
              ))
            ) : (
              <div className="card p-6 text-center flex-shrink-0 w-full min-w-[200px]">
                <svg className="w-10 h-10 mx-auto mb-3 text-[var(--color-juice-300)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                <p className="text-[var(--color-juice-200)] text-sm mb-3">No beats favorited</p>
                <button
                  onClick={() => router.navigate({ to: "/beat-studio" })}
                  className="btn-primary text-xs py-2 px-4"
                >
                  Browse Beat Studio
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recently Exported */}
      <div className="animate-slideUp" style={{ animationDelay: "400ms" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Recently Exported</h2>
          <button
            onClick={() => router.navigate({ to: "/export-studio" })}
            className="text-xs text-[var(--color-accent-light)] hover:text-[var(--color-accent)] transition-colors"
          >
            Export Studio
          </button>
        </div>
        <div className="card overflow-hidden">
          {tracks.length > 0 ? (
            <div className="divide-y divide-[var(--color-glass-border)]">
              {tracks.map((track) => (
                <div key={track.id} className="flex items-center justify-between p-3.5 hover:bg-[var(--color-glass-bg-hover)] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-[var(--color-glass-bg)]">
                      <svg className="w-4 h-4 text-[var(--color-accent-light)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18V5l12-2v13" />
                        <circle cx="6" cy="18" r="3" />
                        <circle cx="18" cy="16" r="3" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{track.name}</p>
                      <p className="text-xs text-[var(--color-juice-300)]">{track.format} · {track.size}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[var(--color-juice-300)] hidden sm:inline">
                      {new Date(track.exportedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                    <button className="btn-glass px-3 py-1.5 text-xs" onClick={() => router.navigate({ to: "/export-studio" })}>
                      Re-export
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center">
              <svg className="w-10 h-10 mx-auto mb-3 text-[var(--color-juice-300)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-[var(--color-juice-200)] text-sm mb-3">No exports yet</p>
              <button
                onClick={() => router.navigate({ to: "/export-studio" })}
                className="btn-primary text-xs py-2 px-4"
              >
                Export your first track
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

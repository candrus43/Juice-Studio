import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useReducer, useState, useCallback, useEffect, useRef } from "react";
import {
  generateProjects,
  projectFolders,
  formatTimeAgo,
  type Project,
  type ProjectFolder,
  type ProjectStatus,
} from "../data/mock";
import { getAllSongMixes, deleteSongMix, type PersistedSongMix } from "../persistence/stores/sessions";
import { getContext } from "../audio/engine";

export const Route = createFileRoute("/project-manager")({
  component: ProjectManager,
});

type SortKey = "recent" | "name" | "modified" | "newest";
type FilterKey = "all" | "in-progress" | "drafts" | "finished" | "favorites";
type ViewMode = "grid" | "list";

interface DecodedSong {
  id: string;
  projectName: string;
  bpm: number;
  key: string;
  duration: string;
  durationSec: number;
  trackCount: number;
  audioBuffer: AudioBuffer | null;
  coverColor: string;
  createdAt: string;
  sessionId: string;
  genre: string;
}

interface PlayingState {
  songId: string;
  source: AudioBufferSourceNode | null;
  startTime: number;
  pausedAt: number;
  isPaused: boolean;
  duration: number;
}

interface State {
  projects: Project[];
  folders: ProjectFolder[];
  search: string;
  sort: SortKey;
  filter: FilterKey;
  view: ViewMode;
  selectedProjectId: string | null;
  activeFolderId: string | null;
  savedSongs: DecodedSong[];
  songsLoading: boolean;
  playing: PlayingState | null;
}

type Action =
  | { type: "SET_SEARCH"; value: string }
  | { type: "SET_SORT"; value: SortKey }
  | { type: "SET_FILTER"; value: FilterKey }
  | { type: "SET_VIEW"; value: ViewMode }
  | { type: "SELECT_PROJECT"; id: string | null }
  | { type: "ADD_PROJECT"; project: Project }
  | { type: "DELETE_PROJECT"; id: string }
  | { type: "TOGGLE_FAVORITE"; id: string }
  | { type: "UPDATE_PROJECT"; id: string; updates: Partial<Project> }
  | { type: "SET_ACTIVE_FOLDER"; folderId: string | null }
  | { type: "ADD_FOLDER"; folder: ProjectFolder }
  | { type: "DELETE_FOLDER"; folderId: string }
  | { type: "MOVE_TO_FOLDER"; projectId: string; folderId: string | null }
  | { type: "LOAD" }
  | { type: "SET_SAVED_SONGS"; songs: DecodedSong[] }
  | { type: "SET_SONGS_LOADING"; loading: boolean }
  | { type: "SET_PLAYING"; playing: PlayingState | null }
  | { type: "DELETE_SAVED_SONG"; id: string }
  | { type: "UPDATE_PLAYING_PROGRESS"; pausedAt: number };

function initState(): State {
  return {
    projects: generateProjects(),
    folders: projectFolders,
    search: "",
    sort: "recent",
    filter: "all",
    view: "grid",
    selectedProjectId: null,
    activeFolderId: null,
    savedSongs: [],
    songsLoading: true,
    playing: null,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_SEARCH":
      return { ...state, search: action.value };
    case "SET_SORT":
      return { ...state, sort: action.value };
    case "SET_FILTER":
      return { ...state, filter: action.value };
    case "SET_VIEW":
      return { ...state, view: action.value };
    case "SELECT_PROJECT":
      return { ...state, selectedProjectId: action.id };
    case "ADD_PROJECT":
      return { ...state, projects: [action.project, ...state.projects] };
    case "DELETE_PROJECT":
      return {
        ...state,
        projects: state.projects.filter((p) => p.id !== action.id),
        selectedProjectId: state.selectedProjectId === action.id ? null : state.selectedProjectId,
      };
    case "TOGGLE_FAVORITE":
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.id ? { ...p, favorite: !p.favorite } : p,
        ),
      };
    case "UPDATE_PROJECT":
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.id ? { ...p, ...action.updates, lastModified: new Date().toISOString() } : p,
        ),
      };
    case "SET_ACTIVE_FOLDER":
      return { ...state, activeFolderId: action.folderId };
    case "ADD_FOLDER":
      return { ...state, folders: [...state.folders, action.folder] };
    case "DELETE_FOLDER":
      return {
        ...state,
        folders: state.folders.filter((f) => f.id !== action.folderId),
        activeFolderId: state.activeFolderId === action.folderId ? null : state.activeFolderId,
        projects: state.projects.map((p) =>
          p.folderId === action.folderId ? { ...p, folderId: null } : p,
        ),
      };
    case "MOVE_TO_FOLDER":
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.projectId ? { ...p, folderId: action.folderId } : p,
        ),
        folders: state.folders.map((f) => {
          if (f.id === action.folderId && !f.projectIds.includes(action.projectId)) {
            return { ...f, projectIds: [...f.projectIds, action.projectId] };
          }
          if (f.id !== action.folderId) {
            return { ...f, projectIds: f.projectIds.filter((pid) => pid !== action.projectId) };
          }
          return f;
        }),
      };
    case "LOAD":
      return state;
    case "SET_SAVED_SONGS":
      return { ...state, savedSongs: action.songs, songsLoading: false };
    case "SET_SONGS_LOADING":
      return { ...state, songsLoading: action.loading };
    case "SET_PLAYING":
      return { ...state, playing: action.playing };
    case "DELETE_SAVED_SONG":
      return { ...state, savedSongs: state.savedSongs.filter((s) => s.id !== action.id) };
    case "UPDATE_PLAYING_PROGRESS":
      return state.playing
        ? { ...state, playing: { ...state.playing, pausedAt: action.pausedAt } }
        : state;
    default:
      return state;
  }
}

const statusColors: Record<ProjectStatus, string> = {
  "Draft": "#555555",
  "In Progress": "#f59e0b",
  "Mixed": "#3b82f6",
  "Mastered": "#8b5cf6",
  "Released": "#10b981",
};

const statusBgColors: Record<ProjectStatus, string> = {
  "Draft": "rgba(85,85,85,0.15)",
  "In Progress": "rgba(245,158,11,0.15)",
  "Mixed": "rgba(59,130,246,0.15)",
  "Mastered": "rgba(139,92,246,0.15)",
  "Released": "rgba(16,185,129,0.15)",
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ProjectManager() {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, undefined, initState);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const [seekValue, setSeekValue] = useState(0);

  // Load saved songs on mount
  useEffect(() => {
    let cancelled = false;
    async function loadSongs() {
      try {
        const mixes = await getAllSongMixes();
        if (cancelled) return;
        const ctx = getContext();
        const decoded: DecodedSong[] = [];
        for (const mix of mixes) {
          let audioBuffer: AudioBuffer | null = null;
          try {
            audioBuffer = await ctx.decodeAudioData(mix.audioData.slice(0));
          } catch {
            // Could not decode this mix's audio
          }
          decoded.push({
            id: mix.id,
            projectName: mix.projectName,
            bpm: mix.bpm,
            key: mix.key,
            duration: mix.duration || formatDuration(mix.durationSec),
            durationSec: mix.durationSec,
            trackCount: mix.trackCount,
            audioBuffer,
            coverColor: mix.coverColor || "#7c3aed",
            createdAt: mix.createdAt,
            sessionId: mix.sessionId,
            genre: mix.genre || "Unknown",
          });
        }
        if (!cancelled) {
          dispatch({ type: "SET_SAVED_SONGS", songs: decoded });
        }
      } catch {
        if (!cancelled) {
          dispatch({ type: "SET_SONGS_LOADING", loading: false });
        }
      }
    }
    loadSongs();
    return () => { cancelled = true; };
  }, []);

  // Clean up playback on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (state.playing?.source) {
        try { state.playing.source.stop(); } catch { /* ok */ }
      }
    };
  }, []);

  // Update seek bar during playback
  useEffect(() => {
    if (state.playing && !state.playing.isPaused) {
      progressIntervalRef.current = setInterval(() => {
        if (state.playing) {
          const elapsed = (performance.now() - state.playing.startTime) / 1000;
          setSeekValue(Math.min(elapsed / state.playing.duration, 1));
        }
      }, 100);
    } else {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    }
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [state.playing?.isPaused, state.playing?.songId]);

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        dispatch({ type: "SELECT_PROJECT", id: null });
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("project-search")?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        handleNewProject();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const handleNewProject = useCallback(() => {
    const names = ["New Heat", "Untitled Banger", "Fresh Session", "Late Night Idea", "Studio Freestyle"];
    const keys = ["Cm", "Dm", "Em", "Fm", "Gm", "Am", "Bbm"];
    const bpms = [128, 132, 138, 140, 142, 145, 150, 155];
    const colors = ["#7c3aed", "#8b5cf6", "#a78bfa", "#6d28d9", "#5b21b6", "#c084fc", "#4c1d95"];
    const name = names[Math.floor(Math.random() * names.length)];
    const newProject: Project = {
      id: `proj-${Date.now()}`,
      name,
      bpm: bpms[Math.floor(Math.random() * bpms.length)],
      key: keys[Math.floor(Math.random() * keys.length)],
      genre: "Trap",
      progress: 0,
      status: "Draft",
      lastAction: "Created project",
      lastModified: new Date().toISOString(),
      coverColor: colors[Math.floor(Math.random() * colors.length)],
      favorite: false,
      trackCount: 1,
      duration: "0:00",
      tracks: [],
      notes: "",
      tags: [],
      folderId: null,
      modules: { beats: "pending", recording: "pending", mixing: "pending", mastering: "pending" },
    };
    dispatch({ type: "ADD_PROJECT", project: newProject });
  }, []);

  const handleCreateFolder = useCallback(() => {
    if (!newFolderName.trim()) return;
    const newFolder: ProjectFolder = {
      id: `custom-${Date.now()}`,
      name: newFolderName.trim(),
      icon: "M5 3a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V9l-5-6H5z",
      isSystem: false,
      projectIds: [],
    };
    dispatch({ type: "ADD_FOLDER", folder: newFolder });
    setNewFolderName("");
    setShowNewFolderInput(false);
  }, [newFolderName]);

  const handleDuplicate = useCallback((project: Project) => {
    const dup: Project = {
      ...project,
      id: `proj-${Date.now()}`,
      name: `${project.name} (Copy)`,
      progress: 0,
      status: "Draft",
      lastAction: "Duplicated",
      lastModified: new Date().toISOString(),
      favorite: false,
      notes: "",
      tags: [...project.tags],
      modules: { beats: "pending", recording: "pending", mixing: "pending", mastering: "pending" },
    };
    dispatch({ type: "ADD_PROJECT", project: dup });
    setOpenMenuId(null);
  }, []);

  // ─── Song Playback ─────────────────────────────────────────

  function stopPlayback() {
    if (state.playing?.source) {
      try { state.playing.source.stop(); } catch { /* ok */ }
      state.playing.source.disconnect();
    }
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    dispatch({ type: "SET_PLAYING", playing: null });
    setSeekValue(0);
  }

  function playSong(song: DecodedSong) {
    if (!song.audioBuffer) return;

    // If clicking the same song, toggle pause
    if (state.playing?.songId === song.id) {
      if (state.playing.isPaused) {
        // Resume
        const ctx = getContext();
        ctx.resume();
        const source = ctx.createBufferSource();
        source.buffer = song.audioBuffer!;
        source.connect(ctx.destination);
        const resumeAt = state.playing.pausedAt;
        source.start(0, resumeAt);
        dispatch({
          type: "SET_PLAYING",
          playing: {
            songId: song.id,
            source,
            startTime: performance.now() - resumeAt * 1000,
            pausedAt: resumeAt,
            isPaused: false,
            duration: song.audioBuffer!.duration,
          },
        });
      } else {
        // Pause
        if (state.playing.source) {
          try { state.playing.source.stop(); } catch { /* ok */ }
        }
        const ctx = getContext();
        ctx.suspend();
        const elapsed = (performance.now() - state.playing.startTime) / 1000;
        dispatch({
          type: "SET_PLAYING",
          playing: {
            ...state.playing,
            source: null,
            isPaused: true,
            pausedAt: elapsed,
          },
        });
      }
      return;
    }

    // Stop current playback
    if (state.playing?.source) {
      try { state.playing.source.stop(); } catch { /* ok */ }
    }
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    // Start new playback
    const ctx = getContext();
    ctx.resume();
    const source = ctx.createBufferSource();
    source.buffer = song.audioBuffer;
    source.connect(ctx.destination);
    source.start(0);
    setSeekValue(0);
    dispatch({
      type: "SET_PLAYING",
      playing: {
        songId: song.id,
        source,
        startTime: performance.now(),
        pausedAt: 0,
        isPaused: false,
        duration: song.audioBuffer.duration,
      },
    });
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseFloat(e.target.value);
    setSeekValue(val);
    if (!state.playing || !state.playing.source) return;

    const song = state.savedSongs.find((s) => s.id === state.playing?.songId);
    if (!song?.audioBuffer) return;

    const newTime = val * state.playing.duration;

    // Restart from new position
    if (state.playing.source) {
      try { state.playing.source.stop(); } catch { /* ok */ }
    }
    const ctx = getContext();
    const source = ctx.createBufferSource();
    source.buffer = song.audioBuffer;
    source.connect(ctx.destination);
    source.start(0, newTime);
    dispatch({
      type: "SET_PLAYING",
      playing: {
        songId: state.playing.songId,
        source,
        startTime: performance.now() - newTime * 1000,
        pausedAt: newTime,
        isPaused: false,
        duration: state.playing.duration,
      },
    });
  }

  function getCurrentTime(): number {
    if (!state.playing) return 0;
    if (state.playing.isPaused) return state.playing.pausedAt;
    return (performance.now() - state.playing.startTime) / 1000;
  }

  async function handleDeleteSong(songId: string) {
    try {
      if (state.playing?.songId === songId) stopPlayback();
      await deleteSongMix(songId);
      dispatch({ type: "DELETE_SAVED_SONG", id: songId });
      setConfirmDeleteId(null);
    } catch {
      console.error("Failed to delete song mix");
    }
  }

  function handleOpenInRecording(song: DecodedSong) {
    // Navigate to recording studio with session data
    router.navigate({ to: "/recording-studio" });
  }

  // Filter and sort projects
  const filteredProjects = (() => {
    let result = [...state.projects];

    // Folder filter
    if (state.activeFolderId) {
      const folder = state.folders.find((f) => f.id === state.activeFolderId);
      if (folder) {
        if (folder.id === "favorites") {
          result = result.filter((p) => p.favorite);
        } else if (folder.id === "drafts-folder") {
          result = result.filter((p) => p.status === "Draft");
        } else if (folder.id === "finished-folder") {
          result = result.filter((p) => p.status === "Mastered" || p.status === "Released");
        } else if (folder.id === "recent") {
          result = result.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()).slice(0, 5);
        } else if (!folder.isSystem) {
          result = result.filter((p) => p.folderId === folder.id);
        }
      }
    }

    // Filter chips
    if (state.filter === "in-progress") {
      result = result.filter((p) => p.status === "In Progress" || p.status === "Mixed");
    } else if (state.filter === "drafts") {
      result = result.filter((p) => p.status === "Draft");
    } else if (state.filter === "finished") {
      result = result.filter((p) => p.status === "Mastered" || p.status === "Released");
    } else if (state.filter === "favorites") {
      result = result.filter((p) => p.favorite);
    }

    // Search
    if (state.search.trim()) {
      const q = state.search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.genre.toLowerCase().includes(q) ||
          p.key.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }

    // Sort
    if (state.sort === "name") {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (state.sort === "modified") {
      result.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
    } else if (state.sort === "newest") {
      result.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
    } else {
      // recent — default
      result.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
    }

    return result;
  })();

  // Filter saved songs by search
  const filteredSongs = (() => {
    if (!state.search.trim()) return state.savedSongs;
    const q = state.search.toLowerCase();
    return state.savedSongs.filter(
      (s) =>
        s.projectName.toLowerCase().includes(q) ||
        s.key.toLowerCase().includes(q) ||
        s.genre.toLowerCase().includes(q),
    );
  })();

  const selectedProject = state.selectedProjectId
    ? state.projects.find((p) => p.id === state.selectedProjectId)
    : null;

  const systemFolders = state.folders.filter((f) => f.isSystem);
  const customFolders = state.folders.filter((f) => !f.isSystem);

  const hasSavedSongs = state.savedSongs.length > 0;

  return (
    <div className="flex h-[calc(100vh-65px)] overflow-hidden">
      {/* Folder Sidebar */}
      <aside className="w-[220px] flex-shrink-0 border-r border-[var(--color-glass-border)] p-3 overflow-y-auto hidden lg:block">
        <div className="space-y-0.5">
          {systemFolders.map((folder) => (
            <button
              key={folder.id}
              onClick={() =>
                dispatch({
                  type: "SET_ACTIVE_FOLDER",
                  folderId: state.activeFolderId === folder.id ? null : folder.id,
                })
              }
              className={`nav-item w-full text-left ${state.activeFolderId === folder.id ? "active" : ""}`}
            >
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={folder.icon} />
              </svg>
              <span className="text-sm">{folder.name}</span>
            </button>
          ))}
        </div>

        {/* Custom folders */}
        <div className="mt-4">
          <div className="flex items-center justify-between px-2 mb-1">
            <span className="text-xs font-medium text-[var(--color-juice-300)] uppercase tracking-wider">Folders</span>
            <button
              onClick={() => setShowNewFolderInput(true)}
              className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-[var(--color-glass-bg-hover)] text-[var(--color-juice-300)] hover:text-white transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
            </button>
          </div>

          {showNewFolderInput && (
            <div className="px-2 mb-2">
              <input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateFolder();
                  if (e.key === "Escape") setShowNewFolderInput(false);
                }}
                placeholder="Folder name..."
                className="w-full bg-[var(--color-juice-700)] border border-[var(--color-glass-border)] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-[var(--color-juice-300)] outline-none focus:border-[var(--color-accent)]"
                autoFocus
              />
            </div>
          )}

          <div className="space-y-0.5">
            {customFolders.map((folder) => (
              <button
                key={folder.id}
                onClick={() =>
                  dispatch({
                    type: "SET_ACTIVE_FOLDER",
                    folderId: state.activeFolderId === folder.id ? null : folder.id,
                  })
                }
                className={`nav-item w-full text-left group ${state.activeFolderId === folder.id ? "active" : ""}`}
              >
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d={folder.icon} />
                </svg>
                <span className="text-sm truncate flex-1">{folder.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch({ type: "DELETE_FOLDER", folderId: folder.id });
                  }}
                  className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center rounded hover:bg-red-500/20 text-[var(--color-juice-300)] hover:text-red-400 transition-all"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </button>
            ))}
          </div>
        </div>

        {/* Keyboard shortcuts */}
        <div className="mt-6 px-2">
          <div className="text-[10px] text-[var(--color-juice-400)] space-y-1">
            <div className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-juice-600)] text-[var(--color-juice-300)] text-[10px] font-mono">⌘K</kbd>
              <span>Search</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-juice-600)] text-[var(--color-juice-300)] text-[10px] font-mono">⌘N</kbd>
              <span>New Project</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-juice-600)] text-[var(--color-juice-300)] text-[10px] font-mono">Esc</kbd>
              <span>Close detail</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <div className="p-4 md:p-5 border-b border-[var(--color-glass-border)] space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">Project Manager</h1>
              <p className="text-xs text-[var(--color-juice-200)] mt-0.5">
                {filteredProjects.length} project{filteredProjects.length !== 1 ? "s" : ""}
                {hasSavedSongs && ` · ${state.savedSongs.length} saved song${state.savedSongs.length !== 1 ? "s" : ""}`}
              </p>
            </div>
            <button onClick={handleNewProject} className="btn-primary text-sm">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
              New Project
            </button>
          </div>

          {/* Search + controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex-1 min-w-[200px] relative">
              <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-juice-300)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input
                id="project-search"
                placeholder="Search projects... (⌘K)"
                value={state.search}
                onChange={(e) => dispatch({ type: "SET_SEARCH", value: e.target.value })}
                className="w-full bg-[var(--color-juice-700)] border border-[var(--color-glass-border)] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-[var(--color-juice-300)] outline-none focus:border-[var(--color-accent)] transition-colors"
              />
            </div>

            {/* View toggle */}
            <div className="flex bg-[var(--color-juice-700)] rounded-xl border border-[var(--color-glass-border)] overflow-hidden">
              <button
                onClick={() => dispatch({ type: "SET_VIEW", value: "grid" })}
                className={`p-2.5 transition-colors ${state.view === "grid" ? "bg-[var(--color-glass-bg-active)] text-[var(--color-accent-light)]" : "text-[var(--color-juice-300)] hover:text-white"}`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              </button>
              <button
                onClick={() => dispatch({ type: "SET_VIEW", value: "list" })}
                className={`p-2.5 transition-colors ${state.view === "list" ? "bg-[var(--color-glass-bg-active)] text-[var(--color-accent-light)]" : "text-[var(--color-juice-300)] hover:text-white"}`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
              </button>
            </div>

            <select
              value={state.sort}
              onChange={(e) => dispatch({ type: "SET_SORT", value: e.target.value as SortKey })}
              className="bg-[var(--color-juice-700)] border border-[var(--color-glass-border)] rounded-xl px-3 py-2.5 text-sm text-white outline-none appearance-none cursor-pointer"
            >
              <option value="recent">Recently Opened</option>
              <option value="name">A-Z</option>
              <option value="modified">Last Modified</option>
              <option value="newest">Newest First</option>
            </select>
          </div>

          {/* Filter chips */}
          <div className="flex items-center gap-2 flex-wrap">
            {(["all", "in-progress", "drafts", "finished", "favorites"] as FilterKey[]).map((key) => {
              const label = key === "all" ? "All" : key === "in-progress" ? "In Progress" : key === "drafts" ? "Drafts" : key === "finished" ? "Finished" : "Favorites";
              return (
                <button
                  key={key}
                  onClick={() => dispatch({ type: "SET_FILTER", value: key })}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    state.filter === key
                      ? "bg-[var(--color-accent)] text-white"
                      : "bg-[var(--color-juice-700)] text-[var(--color-juice-200)] hover:text-white border border-[var(--color-glass-border)]"
                  }`}
                >
                  {key === "favorites" && (
                    <svg className="w-3 h-3 inline mr-1" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>
                  )}
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main + Detail Split */}
        <div className="flex-1 flex overflow-hidden" style={{ marginBottom: state.playing ? "72px" : "0" }}>
          {/* Project List */}
          <div className={`flex-1 overflow-y-auto p-4 md:p-5 ${selectedProject ? "hidden xl:block" : ""}`}>
            {filteredProjects.length === 0 && !hasSavedSongs ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-20">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 bg-[var(--color-glass-bg)]">
                  <svg className="w-8 h-8 text-[var(--color-juice-400)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">No projects found</h3>
                <p className="text-sm text-[var(--color-juice-300)] mb-4">
                  {state.search ? "Try a different search term" : "Start your first project"}
                </p>
                <button onClick={handleNewProject} className="btn-primary">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                  New Project
                </button>
              </div>
            ) : state.view === "grid" ? (
              <div className="space-y-6">
                {/* Projects section */}
                {filteredProjects.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-[var(--color-juice-200)] uppercase tracking-wider mb-3">Projects</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                      {filteredProjects.map((project) => (
                        <ProjectCard
                          key={project.id}
                          project={project}
                          isSelected={state.selectedProjectId === project.id}
                          onSelect={() => dispatch({ type: "SELECT_PROJECT", id: project.id })}
                          onToggleFavorite={() => dispatch({ type: "TOGGLE_FAVORITE", id: project.id })}
                          onDelete={() => dispatch({ type: "DELETE_PROJECT", id: project.id })}
                          onDuplicate={() => handleDuplicate(project)}
                          onOpen={() => router.navigate({ to: "/beat-studio" })}
                          onExport={() => router.navigate({ to: "/export-studio" })}
                          openMenuId={openMenuId}
                          setOpenMenuId={setOpenMenuId}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Saved Songs section */}
                {filteredSongs.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-[var(--color-juice-200)] uppercase tracking-wider mb-3">Saved Songs</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                      {filteredSongs.map((song) => (
                        <SavedSongCard
                          key={song.id}
                          song={song}
                          isPlaying={state.playing?.songId === song.id && !state.playing?.isPaused}
                          isPaused={state.playing?.songId === song.id && state.playing?.isPaused}
                          onPlay={() => playSong(song)}
                          onOpenInRecording={() => handleOpenInRecording(song)}
                          onDelete={() => setConfirmDeleteId(song.id)}
                          showConfirmDelete={confirmDeleteId === song.id}
                          onConfirmDelete={() => handleDeleteSong(song.id)}
                          onCancelDelete={() => setConfirmDeleteId(null)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty state for search */}
                {filteredProjects.length === 0 && filteredSongs.length === 0 && state.search && (
                  <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 bg-[var(--color-glass-bg)]">
                      <svg className="w-8 h-8 text-[var(--color-juice-400)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-1">No results found</h3>
                    <p className="text-sm text-[var(--color-juice-300)]">Try a different search term</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {filteredProjects.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-[var(--color-juice-200)] uppercase tracking-wider mb-2">Projects</h2>
                    <ListView
                      projects={filteredProjects}
                      selectedProjectId={state.selectedProjectId}
                      onSelect={(id) => dispatch({ type: "SELECT_PROJECT", id })}
                      onToggleFavorite={(id) => dispatch({ type: "TOGGLE_FAVORITE", id })}
                      onDelete={(id) => dispatch({ type: "DELETE_PROJECT", id })}
                      onDuplicate={(p) => handleDuplicate(p)}
                      onOpen={() => router.navigate({ to: "/beat-studio" })}
                      onExport={() => router.navigate({ to: "/export-studio" })}
                      openMenuId={openMenuId}
                      setOpenMenuId={setOpenMenuId}
                    />
                  </div>
                )}
                {filteredSongs.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-[var(--color-juice-200)] uppercase tracking-wider mb-2">Saved Songs</h2>
                    <SavedSongListView
                      songs={filteredSongs}
                      isPlaying={state.playing?.songId}
                      onPlay={(song) => playSong(song)}
                      onOpenInRecording={(song) => handleOpenInRecording(song)}
                      onDelete={(id) => setConfirmDeleteId(id)}
                      showConfirmDelete={confirmDeleteId}
                      onConfirmDelete={() => confirmDeleteId && handleDeleteSong(confirmDeleteId)}
                      onCancelDelete={() => setConfirmDeleteId(null)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Detail Panel */}
          {selectedProject && (
            <ProjectDetail
              project={selectedProject}
              onClose={() => dispatch({ type: "SELECT_PROJECT", id: null })}
              onUpdate={(updates) =>
                dispatch({ type: "UPDATE_PROJECT", id: selectedProject.id, updates })
              }
              onToggleFavorite={() =>
                dispatch({ type: "TOGGLE_FAVORITE", id: selectedProject.id })
              }
              onDelete={() => dispatch({ type: "DELETE_PROJECT", id: selectedProject.id })}
              customFolders={customFolders}
              onMoveToFolder={(folderId) =>
                dispatch({ type: "MOVE_TO_FOLDER", projectId: selectedProject.id, folderId })
              }
            />
          )}
        </div>
      </div>

      {/* Mini Player */}
      {state.playing && (
        <MiniPlayer
          song={state.savedSongs.find((s) => s.id === state.playing?.songId) || null}
          isPaused={state.playing.isPaused}
          currentTime={getCurrentTime()}
          duration={state.playing.duration}
          seekValue={seekValue}
          onPlayPause={() => {
            const song = state.savedSongs.find((s) => s.id === state.playing?.songId);
            if (song) playSong(song);
          }}
          onSeek={handleSeek}
          onStop={stopPlayback}
        />
      )}
    </div>
  );
}

// ─── Saved Song Card ───────────────────────────────────────

function SavedSongCard({
  song,
  isPlaying,
  isPaused,
  onPlay,
  onOpenInRecording,
  onDelete,
  showConfirmDelete,
  onConfirmDelete,
  onCancelDelete,
}: {
  song: DecodedSong;
  isPlaying: boolean;
  isPaused: boolean;
  onPlay: () => void;
  onOpenInRecording: () => void;
  onDelete: () => void;
  showConfirmDelete: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}) {
  return (
    <div className={`card-hover p-4 group relative ${isPlaying ? "border-[var(--color-accent)] bg-[var(--color-glass-bg-active)]" : ""}`}>
      {/* Three-dot menu */}
      <div className="absolute top-3 right-3 z-10" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              const menu = e.currentTarget.nextElementSibling;
              if (menu) {
                menu.classList.toggle("hidden");
              }
            }}
            className="w-7 h-7 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 hover:bg-[var(--color-glass-bg-hover)] text-[var(--color-juice-300)] transition-all"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
          </button>
          <div className="hidden absolute right-0 top-8 w-44 card p-1.5 z-20 shadow-xl">
            <button onClick={() => { onPlay(); }} className="w-full text-left px-3 py-2 text-sm text-white hover:bg-[var(--color-glass-bg-hover)] rounded-lg transition-colors flex items-center gap-2">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              {isPlaying ? "Pause" : "Play"}
            </button>
            <button onClick={onOpenInRecording} className="w-full text-left px-3 py-2 text-sm text-white hover:bg-[var(--color-glass-bg-hover)] rounded-lg transition-colors flex items-center gap-2">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
              Open in Recording
            </button>
            <hr className="border-[var(--color-glass-border)] my-1" />
            {showConfirmDelete ? (
              <div className="px-3 py-2">
                <p className="text-xs text-red-400 mb-2">Delete this song?</p>
                <div className="flex gap-2">
                  <button onClick={onConfirmDelete} className="flex-1 px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30">Delete</button>
                  <button onClick={onCancelDelete} className="flex-1 px-2 py-1 text-xs bg-[var(--color-glass-bg-hover)] text-white rounded-lg hover:bg-[var(--color-glass-bg-active)]">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={onDelete} className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex items-center gap-2">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Album art */}
      <div
        className="w-full aspect-square rounded-xl mb-3 flex items-center justify-center relative"
        style={{ background: `linear-gradient(135deg, ${song.coverColor}, ${song.coverColor}22)` }}
      >
        {isPlaying ? (
          <div className="flex items-center justify-center gap-1">
            <div className="w-1.5 h-8 bg-white/80 rounded-full animate-pulse" style={{ animationDelay: "0ms", animationDuration: "0.8s" }} />
            <div className="w-1.5 h-5 bg-white/60 rounded-full animate-pulse" style={{ animationDelay: "200ms", animationDuration: "0.8s" }} />
            <div className="w-1.5 h-6 bg-white/70 rounded-full animate-pulse" style={{ animationDelay: "400ms", animationDuration: "0.8s" }} />
            <div className="w-1.5 h-4 bg-white/50 rounded-full animate-pulse" style={{ animationDelay: "100ms", animationDuration: "0.8s" }} />
          </div>
        ) : (
          <span className="text-5xl font-extrabold opacity-20 select-none" style={{ color: song.coverColor }}>
            {song.projectName.charAt(0)}
          </span>
        )}

        {/* Play button overlay */}
        <button
          onClick={(e) => { e.stopPropagation(); onPlay(); }}
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 rounded-xl"
        >
          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <svg className="w-6 h-6 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              {isPlaying && !isPaused ? (
                <><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></>
              ) : (
                <polygon points="5 3 19 12 5 21 5 3" />
              )}
            </svg>
          </div>
        </button>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold text-white text-sm truncate">{song.projectName}</h3>

        {/* Status badge */}
        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium text-emerald-500 bg-emerald-500/15">
          Recorded
        </span>

        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--color-juice-300)]">{song.bpm} BPM · {song.key}</span>
        </div>

        <div className="flex items-center justify-between text-xs text-[var(--color-juice-400)]">
          <span>{song.trackCount} track{song.trackCount !== 1 ? "s" : ""} · {song.duration}</span>
          <span>{formatDate(song.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Saved Song List View ──────────────────────────────────

function SavedSongListView({
  songs,
  isPlaying,
  onPlay,
  onOpenInRecording,
  onDelete,
  showConfirmDelete,
  onConfirmDelete,
  onCancelDelete,
}: {
  songs: DecodedSong[];
  isPlaying: string | null;
  onPlay: (song: DecodedSong) => void;
  onOpenInRecording: (song: DecodedSong) => void;
  onDelete: (id: string) => void;
  showConfirmDelete: string | null;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}) {
  return (
    <div className="card overflow-hidden">
      {/* Table header */}
      <div className="grid grid-cols-[1fr_100px_70px_60px_70px_80px_120px_50px] gap-3 px-4 py-3 border-b border-[var(--color-glass-border)] text-xs font-medium text-[var(--color-juice-300)] uppercase tracking-wider">
        <span>Name</span>
        <span>Status</span>
        <span>BPM</span>
        <span>Key</span>
        <span>Tracks</span>
        <span>Duration</span>
        <span>Saved</span>
        <span></span>
      </div>

      {/* Table body */}
      <div className="divide-y divide-[var(--color-glass-border)]">
        {songs.map((song) => {
          const isThisPlaying = isPlaying === song.id;
          return (
            <div
              key={song.id}
              className={`grid grid-cols-[1fr_100px_70px_60px_70px_80px_120px_50px] gap-3 px-4 py-3 items-center hover:bg-[var(--color-glass-bg-hover)] transition-colors cursor-pointer ${
                isThisPlaying ? "bg-[var(--color-glass-bg-active)]" : ""
              }`}
              onClick={() => onPlay(song)}
            >
              {/* Name */}
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${song.coverColor}, ${song.coverColor}88)` }}
                >
                  <span className="text-xs font-bold text-white">{song.projectName.charAt(0)}</span>
                </div>
                <div className="min-w-0">
                  <span className="text-sm font-medium text-white truncate block">{song.projectName}</span>
                  <span className="text-xs text-[var(--color-juice-400)]">{song.genre}</span>
                </div>
              </div>

              {/* Status */}
              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium text-center w-fit text-emerald-500 bg-emerald-500/15">
                Recorded
              </span>

              {/* BPM */}
              <span className="text-sm text-[var(--color-juice-200)]">{song.bpm}</span>

              {/* Key */}
              <span className="text-sm text-[var(--color-juice-200)]">{song.key}</span>

              {/* Tracks */}
              <span className="text-sm text-[var(--color-juice-200)]">{song.trackCount}</span>

              {/* Duration */}
              <span className="text-sm text-[var(--color-juice-200)]">{song.duration}</span>

              {/* Saved date */}
              <span className="text-sm text-[var(--color-juice-300)]">{formatDate(song.createdAt)}</span>

              {/* Actions */}
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => onPlay(song)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--color-glass-bg-hover)] transition-colors"
                >
                  <svg className="w-3.5 h-3.5 text-[var(--color-juice-300)]" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                    {isThisPlaying ? (
                      <><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></>
                    ) : (
                      <polygon points="5 3 19 12 5 21 5 3" />
                    )}
                  </svg>
                </button>
                <div className="relative">
                  <button
                    onClick={() => {
                      const menu = document.getElementById(`song-menu-${song.id}`);
                      if (menu) menu.classList.toggle("hidden");
                    }}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--color-glass-bg-hover)] text-[var(--color-juice-400)] transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                  </button>
                  <div id={`song-menu-${song.id}`} className="hidden absolute right-0 top-8 w-44 card p-1.5 z-20 shadow-xl">
                    <button onClick={() => { onPlay(song); }} className="w-full text-left px-3 py-2 text-sm text-white hover:bg-[var(--color-glass-bg-hover)] rounded-lg transition-colors flex items-center gap-2">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      {isThisPlaying ? "Pause" : "Play"}
                    </button>
                    <button onClick={() => onOpenInRecording(song)} className="w-full text-left px-3 py-2 text-sm text-white hover:bg-[var(--color-glass-bg-hover)] rounded-lg transition-colors flex items-center gap-2">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
                      Open in Recording
                    </button>
                    <hr className="border-[var(--color-glass-border)] my-1" />
                    {showConfirmDelete === song.id ? (
                      <div className="px-3 py-2">
                        <p className="text-xs text-red-400 mb-2">Delete this song?</p>
                        <div className="flex gap-2">
                          <button onClick={onConfirmDelete} className="flex-1 px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30">Delete</button>
                          <button onClick={onCancelDelete} className="flex-1 px-2 py-1 text-xs bg-[var(--color-glass-bg-hover)] text-white rounded-lg hover:bg-[var(--color-glass-bg-active)]">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => onDelete(song.id)} className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex items-center gap-2">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Mini Player ───────────────────────────────────────────

function MiniPlayer({
  song,
  isPaused,
  currentTime,
  duration,
  seekValue,
  onPlayPause,
  onSeek,
  onStop,
}: {
  song: DecodedSong | null;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  seekValue: number;
  onPlayPause: () => void;
  onSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onStop: () => void;
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--color-glass-border)] bg-[var(--color-juice-800)]/95 backdrop-blur-xl">
      <div className="flex items-center gap-4 px-4 py-3 max-w-full">
        {/* Song info */}
        <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${song?.coverColor || "#7c3aed"}, ${(song?.coverColor || "#7c3aed")}88)` }}
          >
            <span className="text-sm font-bold text-white">{song?.projectName.charAt(0) || "?"}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate max-w-[160px]">{song?.projectName || "Unknown"}</p>
            <p className="text-xs text-[var(--color-juice-300)]">{song?.bpm || "--"} BPM · {song?.key || "--"}</p>
          </div>
        </div>

        {/* Play/Pause */}
        <button
          onClick={onPlayPause}
          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center flex-shrink-0 transition-colors"
        >
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor" stroke="none">
            {isPaused ? (
              <polygon points="5 3 19 12 5 21 5 3" />
            ) : (
              <><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></>
            )}
          </svg>
        </button>

        {/* Seek bar */}
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <span className="text-xs text-[var(--color-juice-300)] w-10 text-right tabular-nums flex-shrink-0">
            {formatDuration(Math.min(currentTime, duration))}
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.001"
            value={seekValue}
            onChange={onSeek}
            className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer bg-[var(--color-glass-border)] accent-[var(--color-accent)]"
            style={{
              background: `linear-gradient(to right, var(--color-accent) ${seekValue * 100}%, var(--color-glass-border) ${seekValue * 100}%)`,
            }}
          />
          <span className="text-xs text-[var(--color-juice-300)] w-10 tabular-nums flex-shrink-0">
            {formatDuration(duration)}
          </span>
        </div>

        {/* Stop */}
        <button
          onClick={onStop}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/20 text-[var(--color-juice-300)] hover:text-red-400 flex-shrink-0 transition-colors"
          title="Stop"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
        </button>
      </div>
    </div>
  );
}

// ─── Project Card ──────────────────────────────────────────

function ProjectCard({
  project,
  isSelected,
  onSelect,
  onToggleFavorite,
  onDelete,
  onDuplicate,
  onOpen,
  onExport,
  openMenuId,
  setOpenMenuId,
}: {
  project: Project;
  isSelected: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onOpen: () => void;
  onExport: () => void;
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
}) {
  return (
    <div
      className={`card-hover p-4 group relative ${isSelected ? "border-[var(--color-accent)] bg-[var(--color-glass-bg-active)]" : ""}`}
      onClick={onSelect}
    >
      {/* Menu button */}
      <div className="absolute top-3 right-3 z-10" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setOpenMenuId(openMenuId === project.id ? null : project.id)}
          className="w-7 h-7 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 hover:bg-[var(--color-glass-bg-hover)] text-[var(--color-juice-300)] transition-all"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
        </button>
        {openMenuId === project.id && (
          <div className="absolute right-0 top-8 w-40 card p-1.5 z-20 shadow-xl">
            <button onClick={onOpen} className="w-full text-left px-3 py-2 text-sm text-white hover:bg-[var(--color-glass-bg-hover)] rounded-lg transition-colors flex items-center gap-2">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Open
            </button>
            <button onClick={onDuplicate} className="w-full text-left px-3 py-2 text-sm text-white hover:bg-[var(--color-glass-bg-hover)] rounded-lg transition-colors flex items-center gap-2">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              Duplicate
            </button>
            <button onClick={onExport} className="w-full text-left px-3 py-2 text-sm text-white hover:bg-[var(--color-glass-bg-hover)] rounded-lg transition-colors flex items-center gap-2">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              Export
            </button>
            <hr className="border-[var(--color-glass-border)] my-1" />
            <button onClick={onDelete} className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex items-center gap-2">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Album art */}
      <div
        className="w-full aspect-square rounded-xl mb-3 flex items-center justify-center relative"
        style={{ background: `linear-gradient(135deg, ${project.coverColor}, ${project.coverColor}22)` }}
      >
        <span className="text-5xl font-extrabold opacity-20 select-none" style={{ color: project.coverColor }}>
          {project.name.charAt(0)}
        </span>
        {/* Favorite star */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          className="absolute top-2 left-2 w-7 h-7 flex items-center justify-center rounded-lg bg-black/30 hover:bg-black/50 transition-colors"
        >
          <svg className={`w-3.5 h-3.5 ${project.favorite ? "text-yellow-400 fill-yellow-400" : "text-white/60"}`} viewBox="0 0 24 24" fill={project.favorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
            <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
          </svg>
        </button>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold text-white text-sm truncate">{project.name}</h3>

        {/* Status badge */}
        <span
          className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium"
          style={{ color: statusColors[project.status], backgroundColor: statusBgColors[project.status] }}
        >
          {project.status}
        </span>

        {/* Progress bar */}
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${project.progress}%` }} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--color-juice-300)]">{project.bpm} BPM · {project.key}</span>
          <span className="text-xs font-medium text-[var(--color-juice-200)]">{project.progress}%</span>
        </div>

        <div className="flex items-center justify-between text-xs text-[var(--color-juice-400)]">
          <span>{project.trackCount} tracks · {project.duration}</span>
          <span>{formatTimeAgo(project.lastModified)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── List View ─────────────────────────────────────────────

function ListView({
  projects,
  selectedProjectId,
  onSelect,
  onToggleFavorite,
  onDelete,
  onDuplicate,
  onOpen,
  onExport,
  openMenuId,
  setOpenMenuId,
}: {
  projects: Project[];
  selectedProjectId: string | null;
  onSelect: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (p: Project) => void;
  onOpen: () => void;
  onExport: () => void;
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
}) {
  return (
    <div className="card overflow-hidden">
      {/* Table header */}
      <div className="grid grid-cols-[1fr_100px_70px_60px_70px_80px_120px_50px] gap-3 px-4 py-3 border-b border-[var(--color-glass-border)] text-xs font-medium text-[var(--color-juice-300)] uppercase tracking-wider">
        <span>Name</span>
        <span>Status</span>
        <span>BPM</span>
        <span>Key</span>
        <span>Tracks</span>
        <span>Duration</span>
        <span>Modified</span>
        <span></span>
      </div>

      {/* Table body */}
      <div className="divide-y divide-[var(--color-glass-border)]">
        {projects.map((project) => (
          <div
            key={project.id}
            onClick={() => onSelect(project.id)}
            className={`grid grid-cols-[1fr_100px_70px_60px_70px_80px_120px_50px] gap-3 px-4 py-3 items-center hover:bg-[var(--color-glass-bg-hover)] transition-colors cursor-pointer ${
              selectedProjectId === project.id ? "bg-[var(--color-glass-bg-active)]" : ""
            }`}
          >
            {/* Name */}
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${project.coverColor}, ${project.coverColor}88)` }}
              >
                <span className="text-xs font-bold text-white">{project.name.charAt(0)}</span>
              </div>
              <div className="min-w-0">
                <span className="text-sm font-medium text-white truncate block">{project.name}</span>
                <span className="text-xs text-[var(--color-juice-400)]">{project.genre}</span>
              </div>
            </div>

            {/* Status */}
            <span
              className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium text-center w-fit"
              style={{ color: statusColors[project.status], backgroundColor: statusBgColors[project.status] }}
            >
              {project.status}
            </span>

            {/* BPM */}
            <span className="text-sm text-[var(--color-juice-200)]">{project.bpm}</span>

            {/* Key */}
            <span className="text-sm text-[var(--color-juice-200)]">{project.key}</span>

            {/* Tracks */}
            <span className="text-sm text-[var(--color-juice-200)]">{project.trackCount}</span>

            {/* Duration */}
            <span className="text-sm text-[var(--color-juice-200)]">{project.duration}</span>

            {/* Modified */}
            <span className="text-sm text-[var(--color-juice-300)]">{formatTimeAgo(project.lastModified)}</span>

            {/* Actions */}
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => onToggleFavorite(project.id)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--color-glass-bg-hover)] transition-colors"
              >
                <svg className={`w-3.5 h-3.5 ${project.favorite ? "text-yellow-400 fill-yellow-400" : "text-[var(--color-juice-400)]"}`} viewBox="0 0 24 24" fill={project.favorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                  <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
                </svg>
              </button>
              <div className="relative">
                <button
                  onClick={() => setOpenMenuId(openMenuId === project.id ? null : project.id)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--color-glass-bg-hover)] text-[var(--color-juice-400)] transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                </button>
                {openMenuId === project.id && (
                  <div className="absolute right-0 top-8 w-40 card p-1.5 z-20 shadow-xl">
                    <button onClick={onOpen} className="w-full text-left px-3 py-2 text-sm text-white hover:bg-[var(--color-glass-bg-hover)] rounded-lg transition-colors flex items-center gap-2">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      Open
                    </button>
                    <button onClick={() => onDuplicate(project)} className="w-full text-left px-3 py-2 text-sm text-white hover:bg-[var(--color-glass-bg-hover)] rounded-lg transition-colors flex items-center gap-2">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                      Duplicate
                    </button>
                    <button onClick={onExport} className="w-full text-left px-3 py-2 text-sm text-white hover:bg-[var(--color-glass-bg-hover)] rounded-lg transition-colors flex items-center gap-2">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                      Export
                    </button>
                    <hr className="border-[var(--color-glass-border)] my-1" />
                    <button onClick={() => onDelete(project.id)} className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex items-center gap-2">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Project Detail Panel ──────────────────────────────────

function ProjectDetail({
  project,
  onClose,
  onUpdate,
  onToggleFavorite,
  onDelete,
  customFolders,
  onMoveToFolder,
}: {
  project: Project;
  onClose: () => void;
  onUpdate: (updates: Partial<Project>) => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
  customFolders: ProjectFolder[];
  onMoveToFolder: (folderId: string | null) => void;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(project.notes);
  const [tagInput, setTagInput] = useState("");
  const notesTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Autosave notes
  const handleNotesChange = useCallback(
    (value: string) => {
      setNotes(value);
      if (notesTimeout.current) clearTimeout(notesTimeout.current);
      notesTimeout.current = setTimeout(() => {
        onUpdate({ notes: value });
      }, 600);
    },
    [onUpdate],
  );

  const handleAddTag = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && tagInput.trim()) {
        const newTag = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
        if (!project.tags.includes(newTag)) {
          onUpdate({ tags: [...project.tags, newTag] });
        }
        setTagInput("");
      }
      if (e.key === "Backspace" && !tagInput && project.tags.length > 0) {
        onUpdate({ tags: project.tags.slice(0, -1) });
      }
    },
    [tagInput, project.tags, onUpdate],
  );

  const moduleLabels: { key: keyof Project["modules"]; label: string; path: string }[] = [
    { key: "beats", label: "Beats", path: "/beat-studio" },
    { key: "recording", label: "Recording", path: "/recording-studio" },
    { key: "mixing", label: "Mixing", path: "/mixing-mastering" },
    { key: "mastering", label: "Mastering", path: "/mixing-mastering" },
  ];

  return (
    <div className="w-[380px] flex-shrink-0 border-l border-[var(--color-glass-border)] overflow-y-auto bg-[var(--color-juice-900)] xl:relative absolute inset-0 z-20 xl:z-0">
      {/* Close button (mobile) */}
      <button
        onClick={onClose}
        className="xl:hidden absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--color-juice-700)] text-white z-10"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12"/></svg>
      </button>

      {/* Large album art */}
      <div
        className="w-full h-48 flex items-center justify-center relative"
        style={{ background: `linear-gradient(135deg, ${project.coverColor}, ${project.coverColor}44)` }}
      >
        <span className="text-7xl font-extrabold opacity-20 select-none" style={{ color: project.coverColor }}>
          {project.name.charAt(0)}
        </span>
        <button
          onClick={onToggleFavorite}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg bg-black/30 hover:bg-black/50 transition-colors"
        >
          <svg className={`w-4 h-4 ${project.favorite ? "text-yellow-400 fill-yellow-400" : "text-white/60"}`} viewBox="0 0 24 24" fill={project.favorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
            <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
          </svg>
        </button>
      </div>

      <div className="p-5 space-y-5">
        {/* Title + meta */}
        <div>
          <h2 className="text-xl font-bold text-white">{project.name}</h2>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-medium"
              style={{ color: statusColors[project.status], backgroundColor: statusBgColors[project.status] }}
            >
              {project.status}
            </span>
            <span className="text-xs text-[var(--color-juice-300)]">{project.bpm} BPM</span>
            <span className="text-xs text-[var(--color-juice-300)]">·</span>
            <span className="text-xs text-[var(--color-juice-300)]">{project.key}</span>
            <span className="text-xs text-[var(--color-juice-300)]">·</span>
            <span className="text-xs text-[var(--color-juice-300)]">{project.genre}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-[var(--color-juice-300)]">Overall Progress</span>
            <span className="text-xs font-medium text-[var(--color-juice-200)]">{project.progress}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${project.progress}%` }} />
          </div>
        </div>

        {/* Module progress */}
        <div>
          <h3 className="text-xs font-medium text-[var(--color-juice-300)] uppercase tracking-wider mb-2">Module Progress</h3>
          <div className="space-y-2">
            {moduleLabels.map(({ key, label, path }) => {
              const status = project.modules[key];
              const icon = status === "done" ? "✓" : status === "in-progress" ? "◉" : "—";
              const color = status === "done" ? "#10b981" : status === "in-progress" ? "#f59e0b" : "#555555";
              return (
                <div key={key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs w-4 text-center" style={{ color }}>{icon}</span>
                    <span className="text-sm text-[var(--color-juice-100)]">{label}</span>
                  </div>
                  <button
                    onClick={() => router.navigate({ to: path })}
                    className="text-xs text-[var(--color-accent-light)] hover:text-[var(--color-accent)] transition-colors"
                  >
                    Open
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Track list */}
        <div>
          <h3 className="text-xs font-medium text-[var(--color-juice-300)] uppercase tracking-wider mb-2">
            Tracks ({project.tracks.length})
          </h3>
          <div className="space-y-1">
            {project.tracks.map((track) => (
              <div key={track.id} className="flex items-center gap-2 py-1">
                <div
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    track.status === "done" ? "bg-emerald-500" : track.status === "in-progress" ? "bg-amber-500" : "bg-[var(--color-juice-500)]"
                  }`}
                />
                <span className="text-sm text-[var(--color-juice-100)] flex-1">{track.name}</span>
                <span className="text-xs text-[var(--color-juice-400)]">{track.duration}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <h3 className="text-xs font-medium text-[var(--color-juice-300)] uppercase tracking-wider mb-2">Notes</h3>
          <textarea
            value={notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="Add session notes..."
            rows={4}
            className="w-full bg-[var(--color-juice-700)] border border-[var(--color-glass-border)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[var(--color-juice-300)] outline-none focus:border-[var(--color-accent)] transition-colors resize-none"
          />
        </div>

        {/* Tags */}
        <div>
          <h3 className="text-xs font-medium text-[var(--color-juice-300)] uppercase tracking-wider mb-2">Tags</h3>
          <div className="flex flex-wrap gap-1.5">
            {project.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-[var(--color-glass-bg-active)] text-[var(--color-accent-light)]"
              >
                {tag}
                <button
                  onClick={() => onUpdate({ tags: project.tags.filter((t) => t !== tag) })}
                  className="w-3 h-3 flex items-center justify-center rounded-full hover:bg-red-500/20 text-[var(--color-juice-300)] hover:text-red-400"
                >
                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </span>
            ))}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder="Add tag..."
              className="bg-transparent border border-dashed border-[var(--color-glass-border)] rounded-full px-3 py-1 text-xs text-white placeholder-[var(--color-juice-400)] outline-none focus:border-[var(--color-accent)] w-20"
            />
          </div>
        </div>

        {/* Move to folder */}
        {customFolders.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-[var(--color-juice-300)] uppercase tracking-wider mb-2">Folder</h3>
            <select
              value={project.folderId || ""}
              onChange={(e) => onMoveToFolder(e.target.value || null)}
              className="w-full bg-[var(--color-juice-700)] border border-[var(--color-glass-border)] rounded-xl px-3 py-2.5 text-sm text-white outline-none"
            >
              <option value="">No folder</option>
              {customFolders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Quick actions */}
        <div className="space-y-2 pt-2 border-t border-[var(--color-glass-border)]">
          <button onClick={() => router.navigate({ to: "/beat-studio" })} className="btn-glass w-full text-sm">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/></svg>
            Open in Beat Studio
          </button>
          <button onClick={() => router.navigate({ to: "/recording-studio" })} className="btn-glass w-full text-sm">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
            Open in Recording
          </button>
          <button onClick={() => router.navigate({ to: "/mixing-mastering" })} className="btn-glass w-full text-sm">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>
            Mix & Master
          </button>
          <button onClick={() => router.navigate({ to: "/export-studio" })} className="btn-glass w-full text-sm">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            Export
          </button>
          <hr className="border-[var(--color-glass-border)]" />
          <button onClick={onDelete} className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 rounded-xl transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            Delete Project
          </button>
        </div>
      </div>
    </div>
  );
}
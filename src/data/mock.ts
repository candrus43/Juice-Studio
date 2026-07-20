export type ProjectStatus = "Draft" | "In Progress" | "Mixed" | "Mastered" | "Released";
export type ModuleProgress = "done" | "in-progress" | "pending";

export interface ProjectTrack {
  id: string;
  name: string;
  status: ModuleProgress;
  duration: string;
}

export interface Project {
  id: string;
  name: string;
  bpm: number;
  key: string;
  genre: string;
  progress: number; // 0-100
  status: ProjectStatus;
  lastAction: string;
  lastModified: string;
  coverColor: string;
  favorite: boolean;
  trackCount: number;
  duration: string;
  tracks: ProjectTrack[];
  notes: string;
  tags: string[];
  folderId: string | null;
  modules: {
    beats: ModuleProgress;
    recording: ModuleProgress;
    mixing: ModuleProgress;
    mastering: ModuleProgress;
  };
}

export interface ProjectFolder {
  id: string;
  name: string;
  icon: string;
  isSystem: boolean;
  projectIds: string[];
}

export interface ExportItem {
  id: string;
  projectName: string;
  fileName: string;
  format: string;
  quality: string;
  sampleRate: number;
  size: string;
  exportedAt: string;
  status: "completed" | "in-progress";
  type: "full" | "instrumental" | "stems" | "lyrics" | "backup";
}

export interface Beat {
  id: string;
  name: string;
  bpm: number;
  key: string;
  genre: string;
  duration: string;
  color: string;
  favorite: boolean;
}

export interface ExportedTrack {
  id: string;
  name: string;
  format: string;
  quality: string;
  exportedAt: string;
  size: string;
}

export interface CreativeBrief {
  greeting: string;
  completedYesterday: string;
  recommendations: string[];
  tip: string;
}

function defaultTracks(names: string[]): ProjectTrack[] {
  return names.map((n, i) => ({
    id: `trk-${i + 1}`,
    name: n,
    status: i === 0 ? "done" : i === 1 ? "in-progress" : "pending",
    duration: `${Math.floor(Math.random() * 4) + 2}:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}`,
  }));
}

export const currentProject: Project = {
  id: "proj-001",
  name: "Late Nights",
  bpm: 140,
  key: "Dm",
  genre: "Trap / R&B",
  progress: 72,
  status: "In Progress",
  lastAction: "Recorded Verse 2 (Take 4)",
  lastModified: "2026-07-19T02:15:00Z",
  coverColor: "#7c3aed",
  favorite: true,
  trackCount: 16,
  duration: "3:42",
  tracks: defaultTracks(["Lead Vocal", "Ad-libs", "Hook Double", "Verse 1", "Verse 2", "808 Bass", "Main Melody", "Hi-Hats"]),
  notes: "Take 4 on Verse 2 is the one. Keep that energy for the ad-libs. 1176 hitting a bit hard — back off 2 dB on final mix.",
  tags: ["single", "trap", "rnb", "summer-drop"],
  folderId: null,
  modules: { beats: "done", recording: "in-progress", mixing: "pending", mastering: "pending" },
};

export const recentProjects: Project[] = [
  {
    id: "proj-002",
    name: "Crown Heavy",
    bpm: 155,
    key: "Gm",
    genre: "Hip-Hop",
    progress: 45,
    status: "In Progress",
    lastAction: "Mixed hook",
    lastModified: "2026-07-18T18:30:00Z",
    coverColor: "#8b5cf6",
    favorite: true,
    trackCount: 12,
    duration: "4:10",
    tracks: defaultTracks(["Lead Vocal", "Hook", "808", "Snare", "Hi-Hats", "Synth Lead"]),
    notes: "Hook is solid. Need to work on the snare tuning — it's clashing with the melody in the chorus.",
    tags: ["hip-hop", "banger"],
    folderId: null,
    modules: { beats: "done", recording: "in-progress", mixing: "pending", mastering: "pending" },
  },
  {
    id: "proj-003",
    name: "Sauce Walk",
    bpm: 132,
    key: "F#m",
    genre: "Trap",
    progress: 88,
    status: "Mixed",
    lastAction: "Added ad-libs",
    lastModified: "2026-07-17T23:45:00Z",
    coverColor: "#a78bfa",
    favorite: true,
    trackCount: 14,
    duration: "3:28",
    tracks: defaultTracks(["Lead Vocal", "Ad-libs", "Hook", "808", "Clap", "Pad", "FX"]),
    notes: "Almost there. Ad-libs are fire. One more vocal processing pass and send to mastering.",
    tags: ["trap", "single", "almost-done"],
    folderId: null,
    modules: { beats: "done", recording: "done", mixing: "done", mastering: "pending" },
  },
  {
    id: "proj-004",
    name: "Trap Theology",
    bpm: 145,
    key: "Em",
    genre: "Trap / Gospel",
    progress: 30,
    status: "Draft",
    lastAction: "Wrote Verse 1",
    lastModified: "2026-07-17T14:20:00Z",
    coverColor: "#6d28d9",
    favorite: false,
    trackCount: 8,
    duration: "4:05",
    tracks: defaultTracks(["Lead Vocal", "Choir Pad", "808", "Organ"]),
    notes: "Concept is strong. Verse 1 is written but need to workshop the flow. Gospel choir sample in the bridge is essential.",
    tags: ["gospel", "experimental"],
    folderId: null,
    modules: { beats: "done", recording: "pending", mixing: "pending", mastering: "pending" },
  },
  {
    id: "proj-005",
    name: "Midnight Flex",
    bpm: 128,
    key: "Am",
    genre: "R&B",
    progress: 60,
    status: "In Progress",
    lastAction: "Arranged beat",
    lastModified: "2026-07-16T09:10:00Z",
    coverColor: "#5b21b6",
    favorite: false,
    trackCount: 10,
    duration: "3:55",
    tracks: defaultTracks(["Lead Vocal", "Keys", "Bass", "Drum Kit", "Background Vox"]),
    notes: "Smooth R&B vibe. The bridge needs work — feels empty. Maybe add a guitar layer or strings.",
    tags: ["rnb", "vibes"],
    folderId: null,
    modules: { beats: "done", recording: "in-progress", mixing: "pending", mastering: "pending" },
  },
  {
    id: "proj-006",
    name: "Drip Season",
    bpm: 150,
    key: "C#m",
    genre: "Trap",
    progress: 15,
    status: "Draft",
    lastAction: "Selected beat",
    lastModified: "2026-07-15T21:00:00Z",
    coverColor: "#4c1d95",
    favorite: false,
    trackCount: 6,
    duration: "3:15",
    tracks: defaultTracks(["Beat", "Reference Vocal"]),
    notes: "Just getting started. Beat is fire — 808 pattern is nasty. Need to write hook concept first.",
    tags: ["trap", "starter"],
    folderId: null,
    modules: { beats: "done", recording: "pending", mixing: "pending", mastering: "pending" },
  },
  {
    id: "proj-007",
    name: "No Limits",
    bpm: 138,
    key: "Bbm",
    genre: "Hip-Hop / R&B",
    progress: 95,
    status: "Mastered",
    lastAction: "Final master export",
    lastModified: "2026-07-14T16:30:00Z",
    coverColor: "#7c3aed",
    favorite: true,
    trackCount: 18,
    duration: "3:33",
    tracks: defaultTracks(["Lead Vocal", "Hook", "Ad-libs", "808", "Snare", "Hi-Hats", "Keys", "Strings", "FX"]),
    notes: "Ready for release. Streaming master sounds great on all systems.",
    tags: ["single", "release-ready", "mastered"],
    folderId: null,
    modules: { beats: "done", recording: "done", mixing: "done", mastering: "done" },
  },
  {
    id: "proj-008",
    name: "Real Talk",
    bpm: 142,
    key: "G#m",
    genre: "Lyrical",
    progress: 50,
    status: "In Progress",
    lastAction: "Laying down reference track",
    lastModified: "2026-07-13T11:00:00Z",
    coverColor: "#8b5cf6",
    favorite: false,
    trackCount: 10,
    duration: "4:18",
    tracks: defaultTracks(["Lead Vocal", "Reference Track", "808", "Piano", "Strings"]),
    notes: "Deep lyrical content. Reference track helped with the flow. Need to record final takes.",
    tags: ["lyrical", "deep"],
    folderId: null,
    modules: { beats: "done", recording: "in-progress", mixing: "pending", mastering: "pending" },
  },
  {
    id: "proj-009",
    name: "King's Anthem",
    bpm: 148,
    key: "Fm",
    genre: "Hip-Hop",
    progress: 10,
    status: "Draft",
    lastAction: "Created project",
    lastModified: "2026-07-12T08:00:00Z",
    coverColor: "#c084fc",
    favorite: false,
    trackCount: 2,
    duration: "3:50",
    tracks: defaultTracks(["Beat"]),
    notes: "Anthemic concept. Big, stadium-feel beat. Need to write the hook — it has to be massive.",
    tags: ["anthem", "stadium"],
    folderId: null,
    modules: { beats: "in-progress", recording: "pending", mixing: "pending", mastering: "pending" },
  },
];

export const favoriteBeats: Beat[] = [
  { id: "bt-001", name: "Night Rider", bpm: 140, key: "Dm", genre: "Trap", duration: "3:42", color: "#7c3aed", favorite: true },
  { id: "bt-002", name: "Crown Jewels", bpm: 155, key: "Gm", genre: "Hip-Hop", duration: "4:10", color: "#8b5cf6", favorite: true },
  { id: "bt-003", name: "Sauce Drip 808", bpm: 132, key: "F#m", genre: "Trap", duration: "3:28", color: "#a78bfa", favorite: true },
  { id: "bt-004", name: "Holy Trap", bpm: 145, key: "Em", genre: "Trap/Gospel", duration: "4:05", color: "#6d28d9", favorite: true },
  { id: "bt-005", name: "Midnight Keys", bpm: 128, key: "Am", genre: "R&B", duration: "3:55", color: "#5b21b6", favorite: true },
  { id: "bt-006", name: "Limits Off", bpm: 138, key: "Bbm", genre: "Hip-Hop", duration: "3:33", color: "#7c3aed", favorite: true },
  { id: "bt-007", name: "Real Spill", bpm: 142, key: "G#m", genre: "Lyrical", duration: "4:18", color: "#8b5cf6", favorite: true },
  { id: "bt-008", name: "Flex Mode", bpm: 150, key: "C#m", genre: "Trap", duration: "3:15", color: "#c084fc", favorite: true },
];

export const exportedTracks: ExportedTrack[] = [
  { id: "ex-001", name: "No Limits (Master)", format: "WAV 24-bit", quality: "Studio Master", exportedAt: "2026-07-14T16:30:00Z", size: "84 MB" },
  { id: "ex-002", name: "Sauce Walk (Mix v3)", format: "MP3 320kbps", quality: "High Quality", exportedAt: "2026-07-12T22:15:00Z", size: "12 MB" },
  { id: "ex-003", name: "Late Nights (Rough Mix)", format: "WAV 24-bit", quality: "Studio Master", exportedAt: "2026-07-10T03:45:00Z", size: "78 MB" },
  { id: "ex-004", name: "Drip Season (Stems)", format: "ZIP (Stems)", quality: "Raw Stems", exportedAt: "2026-07-08T19:00:00Z", size: "245 MB" },
  { id: "ex-005", name: "Crown Heavy (Demo)", format: "MP3 320kbps", quality: "High Quality", exportedAt: "2026-07-05T14:20:00Z", size: "10 MB" },
];

export function getCreativeBrief(): CreativeBrief {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const briefs: CreativeBrief[] = [
    {
      greeting,
      completedYesterday: "You finished recording Verse 2 for 'Late Nights' (Take 4 — the one).",
      recommendations: [
        "Finish ad-libs for Verse 2",
        "Mix the vocal chain — the 1176 is hitting hard, back off 2 dB",
        "Generate cover art for 'Late Nights'",
        "Master 'No Limits' — it's 95% done",
      ],
      tip: "Your vocal delivery on Take 4 has that raw energy. Keep that mic distance for the ad-libs — don't get closer.",
    },
    {
      greeting,
      completedYesterday: "You arranged the full beat structure for 'Crown Heavy' and laid down the hook reference.",
      recommendations: [
        "Record Verse 1 for 'Crown Heavy'",
        "Layer the 808 pattern with a sub bass",
        "Check the snare tuning — it's clashing with the melody in the chorus",
        "Generate a beat variation for the bridge section",
      ],
      tip: "Try doubling the hook with a whispered take panned hard left/right. It'll give 'Crown Heavy' that eerie depth.",
    },
    {
      greeting,
      completedYesterday: "You mixed 'Sauce Walk' v3 and added ad-libs. It's almost there.",
      recommendations: [
        "Final vocal processing pass on 'Sauce Walk'",
        "Export stems for the engineer",
        "Start writing for 'Real Talk' — the beat is ready",
        "Review 'Midnight Flex' arrangement — the bridge needs work",
      ],
      tip: "Your ad-lib pocket is tight right now. Don't overthink the placement — your instinct is on point.",
    },
  ];

  return briefs[Math.floor(Math.random() * briefs.length)];
}

export type ModuleName =
  | "dashboard"
  | "beat-studio"
  | "recording-studio"
  | "vocal-processing"
  | "mixing-mastering"
  | "songwriter"
  | "music-creation"
  | "arrangement"
  | "project-manager"
  | "export-studio"
  | "cover-art-studio"
  | "video-studio";

export interface NavItem {
  id: ModuleName;
  label: string;
  path: string;
  icon: string; // SVG path data
}

export const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard", path: "/", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" },
  { id: "beat-studio", label: "Beat Studio", path: "/beat-studio", icon: "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" },
  { id: "recording-studio", label: "Recording Studio", path: "/recording-studio", icon: "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" },
  { id: "vocal-processing", label: "Vocal Processing", path: "/vocal-processing", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { id: "mixing-mastering", label: "Mixing & Mastering", path: "/mixing-mastering", icon: "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" },
  { id: "songwriter", label: "Songwriter", path: "/songwriter", icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" },
  { id: "music-creation", label: "Music Creation", path: "/music-creation", icon: "M12 18l-4-3.5M12 18l4-3.5M12 18V6m-6 6h.01M18 12h.01M6 6h.01M18 6h.01M6 18h.01M18 18h.01" },
  { id: "arrangement", label: "Arrangement", path: "/arrangement", icon: "M4 6h16M4 10h16M4 14h16M4 18h16M9 6v12M15 6v12" },
  { id: "project-manager", label: "Project Manager", path: "/project-manager", icon: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" },
  { id: "export-studio", label: "Export Studio", path: "/export-studio", icon: "M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { id: "cover-art-studio", label: "Cover Art Studio", path: "/cover-art-studio", icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { id: "video-studio", label: "Video Studio", path: "/video-studio", icon: "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" },
];

// ─── Beat Studio ──────────────────────────────────────────

export interface BeatGenerationParams {
  prompt: string;
  genre: string;
  mood: string[];
  energy: number;
  bpm: number;
  key: string;
  length: string; // "2:00" | "3:00" | "4:00" | "custom"
  instruments: string[];
  structure: string[];
}

export interface BeatSection {
  id: string;
  name: string;
  startSec: number;
  endSec: number;
  color: string;
  waveformData: number[];
}

export interface GeneratedBeat {
  id: string;
  name: string;
  bpm: number;
  key: string;
  genre: string;
  mood: string[];
  duration: string;
  durationSec: number;
  color: string;
  favorite: boolean;
  createdAt: string;
  sections: BeatSection[];
  waveformData: number[];
  params: BeatGenerationParams;
}

export const sectionColors: Record<string, string> = {
  Intro: "#7c3aed",
  Verse: "#8b5cf6",
  Hook: "#a78bfa",
  Bridge: "#6d28d9",
  Outro: "#5b21b6",
  Drops: "#c084fc",
  "Build-ups": "#9b59b6",
  Fills: "#8e44ad",
  Transitions: "#7d3c98",
};

const beatNames = [
  "Dark Trap Pharaoh",
  "Melodic Rain",
  "808 Nightmare",
  "Purple Haze Drift",
  "Crown Heavy",
  "Midnight Flex 2",
  "Sauce Walk Reloaded",
  "Holy Trap Cathedral",
  "Drip Season Eternal",
  "Real Spill 2.0",
  "Flex Mode Activated",
  "No Ceilings",
  "Ghost in the Machine",
  "Silk Road",
  "Night Rider Returns",
  "Trap Theology 2",
  "Echo Chamber",
  "Lunar Drift",
  "Shadow Work",
  "Diamond Pressure",
  "Concrete Roses",
  "Velvet Smoke",
  "Neon Psalms",
];

function generateMockWaveform(durationSec: number, bars: number): number[] {
  const points: number[] = [];
  const totalPoints = Math.floor(durationSec * 43); // ~43 samples per sec for visual density
  for (let i = 0; i < totalPoints; i++) {
    const seed = Math.sin(i * 0.07) * 0.4 + Math.sin(i * 0.13) * 0.25 + Math.sin(i * 0.03) * 0.35;
    const envelope = i < totalPoints * 0.05 ? i / (totalPoints * 0.05) : i > totalPoints * 0.85 ? (totalPoints - i) / (totalPoints * 0.15) : 1;
    points.push(Math.abs(seed * envelope));
  }
  return points;
}

export function generateMockSectionWaveform(durationSec: number): number[] {
  const points: number[] = [];
  const totalPoints = Math.floor(durationSec * 43);
  for (let i = 0; i < totalPoints; i++) {
    const seed = Math.sin(i * 0.11) * 0.35 + Math.sin(i * 0.17) * 0.3 + Math.sin(i * 0.05) * 0.35;
    points.push(Math.abs(seed));
  }
  return points;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateBeatName(): string {
  return pick(beatNames);
}

function composeSections(structure: string[], durationSec: number): BeatSection[] {
  const sections: BeatSection[] = [];
  const defaultStructure = structure.length > 0 ? structure : ["Intro", "Verse", "Hook", "Verse", "Hook", "Outro"];
  const sectionCount = defaultStructure.length;
  const avgSec = durationSec / sectionCount;
  let currentStart = 0;

  defaultStructure.forEach((name, i) => {
    const isLast = i === sectionCount - 1;
    const sectionDur = isLast ? durationSec - currentStart : avgSec + (Math.random() - 0.5) * avgSec * 0.3;
    const startSec = currentStart;
    const endSec = currentStart + sectionDur;
    sections.push({
      id: `sec-${Date.now()}-${i}`,
      name,
      startSec,
      endSec,
      color: sectionColors[name] || "#7c3aed",
      waveformData: generateMockSectionWaveform(sectionDur),
    });
    currentStart = endSec;
  });

  return sections;
}

export function generateBeat(params: BeatGenerationParams): GeneratedBeat {
  const durationSec = params.length === "custom" ? 210 : parseInt(params.length) * 60;
  const id = `bt-gen-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const name = generateBeatName();

  return {
    id,
    name,
    bpm: params.bpm || 140,
    key: params.key || "Dm",
    genre: params.genre || "Trap",
    mood: params.mood.length > 0 ? params.mood : ["Dark", "Energetic"],
    duration: `${Math.floor(durationSec / 60)}:${String(Math.floor(durationSec % 60)).padStart(2, "0")}`,
    durationSec,
    color: pick(["#7c3aed", "#8b5cf6", "#a78bfa", "#6d28d9", "#c084fc", "#5b21b6"]),
    favorite: false,
    createdAt: new Date().toISOString(),
    sections: composeSections(params.structure, durationSec),
    waveformData: generateMockWaveform(durationSec, Math.floor(durationSec / 2)),
    params,
  };
}

// ─── Recording Studio ─────────────────────────────────────

export interface RecordingTake {
  id: string;
  name: string;
  waveformData: number[];
  duration: number;
  createdAt: string;
  favorited: boolean;
}

export interface Track {
  id: string;
  name: string;
  color: string;
  armed: boolean;
  muted: boolean;
  soloed: boolean;
  volume: number;
  pan: number;
  takes: RecordingTake[];
  activeTakeIdx: number;
}

function generateVocalWaveform(durationSec: number, intensity: number = 1): number[] {
  const points: number[] = [];
  const sampleRate = 86; // ~86 samples per sec for high visual density
  const totalPoints = Math.floor(durationSec * sampleRate);
  const phraseLength = Math.floor(sampleRate * (1.5 + Math.random() * 2)); // 1.5-3.5 second phrases
  
  for (let i = 0; i < totalPoints; i++) {
    const phrasePos = (i % phraseLength) / phraseLength;
    // Envelope: attack, sustain, release per phrase
    const attack = Math.min(1, phrasePos * 12);
    const release = phrasePos > 0.75 ? (1 - phrasePos) * 4 : 1;
    const envelope = Math.min(attack, release);
    
    // Realistic vocal waveform: multiple harmonics
    const t = i / sampleRate;
    const fundamental = Math.sin(t * 440 * (0.8 + Math.sin(t * 0.3) * 0.2)) * 0.45;
    const harmonic1 = Math.sin(t * 880 * (0.8 + Math.sin(t * 0.31) * 0.15)) * 0.25;
    const harmonic2 = Math.sin(t * 1320 * (0.78 + Math.sin(t * 0.28) * 0.2)) * 0.15;
    const sibilance = (Math.random() - 0.5) * 0.15 * (phrasePos < 0.05 ? 2 : 1);
    
    // Mix harmonics with envelope and intensity
    const raw = (fundamental + harmonic1 + harmonic2 + sibilance) * envelope * intensity;
    points.push(raw);
  }
  
  // Normalize to 0..1 range
  const maxAbs = Math.max(...points.map(Math.abs), 0.01);
  return points.map(p => (p / maxAbs + 1) / 2); // Map to 0..1
}

function makeTake(trackName: string, takeNum: number, durationSec: number, intensity: number = 1): RecordingTake {
  const now = new Date();
  const minutesAgo = Math.floor(Math.random() * 180);
  now.setMinutes(now.getMinutes() - minutesAgo);
  
  return {
    id: `take-${Date.now()}-${takeNum}-${Math.floor(Math.random() * 10000)}`,
    name: `Take ${takeNum}`,
    waveformData: generateVocalWaveform(durationSec, intensity),
    duration: durationSec,
    createdAt: now.toISOString(),
    favorited: takeNum === 1 || (takeNum > 2 && Math.random() > 0.6),
  };
}

export function generateDefaultTracks(): Track[] {
  const now = Date.now();
  return [
    {
      id: "track-lead-vocal",
      name: "Lead Vocal",
      color: "#7c3aed",
      armed: false,
      muted: false,
      soloed: false,
      volume: 85,
      pan: 0,
      takes: [
        makeTake("Lead Vocal", 1, 164, 1),
        makeTake("Lead Vocal", 2, 162, 0.9),
        makeTake("Lead Vocal", 3, 167, 1.1),
      ],
      activeTakeIdx: 0,
    },
    {
      id: "track-adlibs",
      name: "Ad-libs",
      color: "#f59e0b",
      armed: false,
      muted: false,
      soloed: false,
      volume: 72,
      pan: 15,
      takes: [
        makeTake("Ad-libs", 1, 158, 0.7),
        makeTake("Ad-libs", 2, 161, 0.75),
      ],
      activeTakeIdx: 1,
    },
    {
      id: "track-bg-vocals",
      name: "Background Vocals",
      color: "#3b82f6",
      armed: false,
      muted: false,
      soloed: false,
      volume: 65,
      pan: -30,
      takes: [
        makeTake("Background Vocals", 1, 170, 0.5),
        makeTake("Background Vocals", 2, 168, 0.55),
        makeTake("Background Vocals", 3, 169, 0.48),
        makeTake("Background Vocals", 4, 172, 0.6),
      ],
      activeTakeIdx: 0,
    },
    {
      id: "track-harmony",
      name: "Harmony",
      color: "#ec4899",
      armed: false,
      muted: false,
      soloed: false,
      volume: 60,
      pan: 20,
      takes: [
        makeTake("Harmony", 1, 165, 0.6),
        makeTake("Harmony", 2, 166, 0.65),
      ],
      activeTakeIdx: 0,
    },
  ];
}

export function createEmptyTrack(name?: string): Track {
  const colors = ["#22c55e", "#06b6d4", "#f97316", "#8b5cf6", "#e11d48", "#84cc16"];
  return {
    id: `track-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    name: name || `Track ${Math.floor(Math.random() * 100)}`,
    color: colors[Math.floor(Math.random() * colors.length)],
    armed: false,
    muted: false,
    soloed: false,
    volume: 80,
    pan: 0,
    takes: [],
    activeTakeIdx: 0,
  };
}

export function generateRecordingSamples(existingWaveform: number[], durationMs: number): number[] {
  const samplesPerMs = 86 / 1000; // ~86 samples per sec
  const newSamples = Math.floor(durationMs * samplesPerMs);
  const points: number[] = [];
  const startIdx = existingWaveform.length;
  
  for (let i = 0; i < newSamples; i++) {
    const globalIdx = startIdx + i;
    const t = globalIdx / samplesPerMs / 1000;
    const fundamental = Math.sin(t * 440 * (0.8 + Math.sin(t * 0.3) * 0.2)) * 0.45;
    const harmonic1 = Math.sin(t * 880 * (0.8 + Math.sin(t * 0.31) * 0.15)) * 0.25;
    const harmonic2 = Math.sin(t * 1320 * (0.78 + Math.sin(t * 0.28) * 0.2)) * 0.15;
    const sibilance = (Math.random() - 0.5) * 0.12;
    const raw = fundamental + harmonic1 + harmonic2 + sibilance;
    points.push((raw + 1) / 2);
  }
  
  return points;
}

// ─── Vocal Processing Presets ─────────────────────────────

export interface VocalChainSettings {
  autoTune: {
    enabled: boolean;
    key: string;
    scale: "major" | "minor";
    retuneSpeed: number;
    humanize: number;
    formantShift: number;
    dryWet: number;
  };
  pitchCorrection: {
    enabled: boolean;
    correctionStrength: number;
    attackSpeed: number;
    noteTransition: number;
    allowedNotes: boolean[]; // 12 semitones
  };
  noiseRemoval: {
    enabled: boolean;
    threshold: number;
    reduction: number;
    adaptiveMode: boolean;
  };
  breathRemoval: {
    enabled: boolean;
    sensitivity: number;
    attenuation: number;
  };
  eq: {
    enabled: boolean;
    lowShelfFreq: number;
    lowShelfGain: number;
    lowMidFreq: number;
    lowMidGain: number;
    lowMidQ: number;
    highMidFreq: number;
    highMidGain: number;
    highMidQ: number;
    highShelfFreq: number;
    highShelfGain: number;
  };
  compression: {
    enabled: boolean;
    threshold: number;
    ratio: number;
    attack: number;
    release: number;
    makeupGain: number;
  };
  reverb: {
    enabled: boolean;
    roomSize: number;
    decayTime: number;
    preDelay: number;
    damping: number;
    dryWet: number;
    type: string;
  };
  delay: {
    enabled: boolean;
    time: number;
    timeUnit: string;
    feedback: number;
    pingPong: boolean;
    lowCut: number;
    highCut: number;
    dryWet: number;
  };
  stereoWidth: {
    enabled: boolean;
    width: number;
    deEsserFreq: number;
    deEsserThreshold: number;
    airBandBoost: number;
  };
}

export function getDefaultChain(): VocalChainSettings {
  return {
    autoTune: { enabled: true, key: "C", scale: "minor", retuneSpeed: 35, humanize: 30, formantShift: 0, dryWet: 80 },
    pitchCorrection: { enabled: true, correctionStrength: 60, attackSpeed: 8, noteTransition: 25, allowedNotes: Array(12).fill(true) },
    noiseRemoval: { enabled: true, threshold: -40, reduction: 12, adaptiveMode: true },
    breathRemoval: { enabled: false, sensitivity: 50, attenuation: 8 },
    eq: { enabled: true, lowShelfFreq: 120, lowShelfGain: 2, lowMidFreq: 400, lowMidGain: -1, lowMidQ: 0.7, highMidFreq: 2500, highMidGain: 3, highMidQ: 1.2, highShelfFreq: 8000, highShelfGain: 1.5 },
    compression: { enabled: true, threshold: -18, ratio: 3, attack: 5, release: 60, makeupGain: 3 },
    reverb: { enabled: true, roomSize: 30, decayTime: 1200, preDelay: 20, damping: 40, dryWet: 25, type: "Plate" },
    delay: { enabled: false, time: 250, timeUnit: "1/4", feedback: 25, pingPong: false, lowCut: 200, highCut: 8000, dryWet: 15 },
    stereoWidth: { enabled: true, width: 65, deEsserFreq: 6500, deEsserThreshold: -20, airBandBoost: 2 },
  };
}

export interface GenrePreset {
  id: string;
  name: string;
  description: string;
  color: string;
  settings: VocalChainSettings;
}

export const genrePresets: GenrePreset[] = [
  {
    id: "modern-rap",
    name: "Modern Rap",
    description: "Aggressive compression, light reverb, moderate auto-tune",
    color: "#7c3aed",
    settings: {
      ...getDefaultChain(),
      autoTune: { enabled: true, key: "D", scale: "minor", retuneSpeed: 50, humanize: 20, formantShift: 0, dryWet: 85 },
      compression: { enabled: true, threshold: -22, ratio: 4, attack: 3, release: 40, makeupGain: 5 },
      reverb: { enabled: true, roomSize: 20, decayTime: 800, preDelay: 10, damping: 50, dryWet: 15, type: "Room" },
    },
  },
  {
    id: "melodic-rap",
    name: "Melodic Rap",
    description: "Heavier auto-tune, wider stereo, longer reverb",
    color: "#a78bfa",
    settings: {
      ...getDefaultChain(),
      autoTune: { enabled: true, key: "D", scale: "minor", retuneSpeed: 20, humanize: 10, formantShift: 2, dryWet: 90 },
      reverb: { enabled: true, roomSize: 50, decayTime: 2000, preDelay: 40, damping: 30, dryWet: 35, type: "Hall" },
      stereoWidth: { enabled: true, width: 80, deEsserFreq: 6500, deEsserThreshold: -20, airBandBoost: 3 },
      eq: { ...getDefaultChain().eq, highMidGain: 4, highShelfGain: 3 },
    },
  },
  {
    id: "rnb",
    name: "R&B",
    description: "Smooth compression, rich reverb, subtle pitch correction",
    color: "#ec4899",
    settings: {
      ...getDefaultChain(),
      autoTune: { enabled: true, key: "C", scale: "major", retuneSpeed: 60, humanize: 45, formantShift: 0, dryWet: 70 },
      compression: { enabled: true, threshold: -15, ratio: 2.5, attack: 10, release: 80, makeupGain: 2 },
      reverb: { enabled: true, roomSize: 45, decayTime: 1800, preDelay: 30, damping: 25, dryWet: 30, type: "Plate" },
      eq: { ...getDefaultChain().eq, lowShelfGain: 3, highMidGain: 2, highShelfGain: 2 },
    },
  },
  {
    id: "pop",
    name: "Pop",
    description: "Bright EQ, tight compression, crisp delay",
    color: "#3b82f6",
    settings: {
      ...getDefaultChain(),
      compression: { enabled: true, threshold: -20, ratio: 3.5, attack: 4, release: 50, makeupGain: 4 },
      eq: { ...getDefaultChain().eq, highMidFreq: 3000, highMidGain: 5, highShelfFreq: 10000, highShelfGain: 3, lowShelfGain: -1 },
      delay: { enabled: true, time: 200, timeUnit: "1/8", feedback: 20, pingPong: true, lowCut: 300, highCut: 6000, dryWet: 12 },
      stereoWidth: { ...getDefaultChain().stereoWidth, width: 70, airBandBoost: 4 },
    },
  },
  {
    id: "trap",
    name: "Trap",
    description: "Heavy 808-compatible EQ, aggressive auto-tune, short reverb",
    color: "#ef4444",
    settings: {
      ...getDefaultChain(),
      autoTune: { enabled: true, key: "C", scale: "minor", retuneSpeed: 15, humanize: 5, formantShift: 0, dryWet: 90 },
      compression: { enabled: true, threshold: -25, ratio: 5, attack: 2, release: 35, makeupGain: 6 },
      eq: { ...getDefaultChain().eq, lowShelfFreq: 80, lowShelfGain: -3, highMidFreq: 3000, highMidGain: 4, highShelfGain: 2 },
      reverb: { enabled: true, roomSize: 15, decayTime: 600, preDelay: 5, damping: 60, dryWet: 10, type: "Room" },
      delay: { enabled: true, time: 150, timeUnit: "1/8", feedback: 15, pingPong: false, lowCut: 500, highCut: 4000, dryWet: 8 },
    },
  },
  {
    id: "drill",
    name: "Drill",
    description: "Dark EQ, heavy compression, minimal reverb",
    color: "#1e1b4b",
    settings: {
      ...getDefaultChain(),
      autoTune: { enabled: true, key: "C", scale: "minor", retuneSpeed: 25, humanize: 15, formantShift: -2, dryWet: 85 },
      compression: { enabled: true, threshold: -28, ratio: 6, attack: 1.5, release: 30, makeupGain: 7 },
      eq: { ...getDefaultChain().eq, lowShelfFreq: 100, lowShelfGain: -4, highMidFreq: 2000, highMidGain: -2, highShelfGain: -1, highShelfFreq: 6000 },
      reverb: { enabled: false, roomSize: 10, decayTime: 400, preDelay: 0, damping: 70, dryWet: 5, type: "Room" },
      stereoWidth: { ...getDefaultChain().stereoWidth, width: 40, deEsserFreq: 7000, deEsserThreshold: -18, airBandBoost: 0 },
    },
  },
  {
    id: "afrobeats",
    name: "Afrobeats",
    description: "Warm EQ, rhythmic delay, moderate width",
    color: "#f59e0b",
    settings: {
      ...getDefaultChain(),
      autoTune: { enabled: true, key: "C", scale: "major", retuneSpeed: 40, humanize: 40, formantShift: 1, dryWet: 75 },
      eq: { ...getDefaultChain().eq, lowShelfFreq: 150, lowShelfGain: 3, lowMidFreq: 300, lowMidGain: 2, highMidFreq: 2000, highMidGain: 1, highShelfGain: 1 },
      compression: { enabled: true, threshold: -14, ratio: 2, attack: 8, release: 70, makeupGain: 2 },
      delay: { enabled: true, time: 300, timeUnit: "1/8d", feedback: 30, pingPong: true, lowCut: 150, highCut: 7000, dryWet: 20 },
      reverb: { enabled: true, roomSize: 35, decayTime: 1500, preDelay: 25, damping: 35, dryWet: 22, type: "Hall" },
      stereoWidth: { ...getDefaultChain().stereoWidth, width: 60, airBandBoost: 1.5 },
    },
  },
  {
    id: "alternative",
    name: "Alternative",
    description: "Natural compression, room reverb, minimal tuning",
    color: "#22c55e",
    settings: {
      ...getDefaultChain(),
      autoTune: { enabled: false, key: "C", scale: "major", retuneSpeed: 80, humanize: 70, formantShift: 0, dryWet: 50 },
      pitchCorrection: { ...getDefaultChain().pitchCorrection, enabled: true, correctionStrength: 25, attackSpeed: 15, noteTransition: 40 },
      compression: { enabled: true, threshold: -12, ratio: 2, attack: 12, release: 100, makeupGain: 1 },
      eq: { ...getDefaultChain().eq, lowShelfGain: 1, highMidGain: 1, highShelfGain: 0.5 },
      reverb: { enabled: true, roomSize: 25, decayTime: 1000, preDelay: 15, damping: 20, dryWet: 20, type: "Room" },
      stereoWidth: { ...getDefaultChain().stereoWidth, width: 50, airBandBoost: 1 },
    },
  },
];

export const quickActions = [
  { label: "Generate Beat", icon: "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3", path: "/beat-studio", color: "#7c3aed" },
  { label: "Record Vocals", icon: "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z", path: "/recording-studio", color: "#ef4444" },
  { label: "Write Lyrics", icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z", path: "/songwriter", color: "#f59e0b" },
  { label: "Mix Song", icon: "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4", path: "/mixing-mastering", color: "#10b981" },
  { label: "Master Song", icon: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z", path: "/mixing-mastering", color: "#f59e0b" },
  { label: "Generate Cover Art", icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z", path: "/cover-art-studio", color: "#ec4899" },
  { label: "Create Music Video", icon: "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z", path: "/video-studio", color: "#06b6d4" },
];

// ─── Mixing & Mastering ─────────────────────────────────────

export interface StemChannel {
  id: string;
  name: string;
  color: string;
  level: number; // 0-100
  mute: boolean;
  solo: boolean;
  pan: number; // -50 to 50
}

export interface MixSnapshot {
  id: string;
  label: string;
  timestamp: string;
  stems: StemChannel[];
  masterFader: number;
  presetName: string | null;
}

export interface MixPreset {
  id: string;
  name: string;
  description: string;
  stems: Partial<StemChannel>[];
  masterFader: number;
}

export interface MasteringChainSettings {
  eq: {
    enabled: boolean;
    lowGain: number;    // -12 to 12
    midGain: number;    // -12 to 12
    highGain: number;   // -12 to 12
    lowFreq: number;    // Hz
    midFreq: number;    // Hz
    highFreq: number;   // Hz
  };
  compressor: {
    enabled: boolean;
    threshold: number;  // -60 to 0
    ratio: number;      // 1 to 20
    attack: number;     // ms
    release: number;    // ms
    gainReduction: number; // dB, computed
  };
  stereoImager: {
    enabled: boolean;
    width: number;      // 0-200 (100 = normal)
    phaseCorrelation: number; // -1 to 1
  };
  limiter: {
    enabled: boolean;
    ceiling: number;    // dB
    threshold: number;  // dB
    release: number;    // ms
  };
  exciter: {
    enabled: boolean;
    drive: number;      // 0-100
    mix: number;        // 0-100
    type: string;       // Tape, Tube, Warm, Bright
  };
}

export interface MasteringPreset {
  id: string;
  name: string;
  platform: string;
  icon: string;
  targetLUFS: number;
  peakTarget: number;
  description: string;
  chain: MasteringChainSettings;
}

export interface MasteringSnapshot {
  id: string;
  label: string;
  timestamp: string;
  chain: MasteringChainSettings;
  presetName: string | null;
  lufsIntegrated: number;
  lufsShortTerm: number;
  lufsMomentary: number;
  truePeak: number;
  dynamicRange: number;
}

export interface MixHistoryItem {
  id: string;
  label: string;
  timestamp: string;
  presetName: string | null;
}

export interface MasterHistoryItem {
  id: string;
  label: string;
  timestamp: string;
  presetName: string | null;
  lufs: number;
}

export const defaultStemChannels: StemChannel[] = [
  { id: "vocals", name: "Vocals", color: "#7c3aed", level: 80, mute: false, solo: false, pan: 0 },
  { id: "drums", name: "Drums", color: "#ef4444", level: 75, mute: false, solo: false, pan: 0 },
  { id: "bass", name: "Bass", color: "#f59e0b", level: 78, mute: false, solo: false, pan: 0 },
  { id: "melody", name: "Melody", color: "#3b82f6", level: 72, mute: false, solo: false, pan: 0 },
  { id: "fx", name: "FX", color: "#22c55e", level: 55, mute: false, solo: false, pan: 0 },
  { id: "adlibs", name: "Ad-libs", color: "#ec4899", level: 60, mute: false, solo: false, pan: 8 },
];

export const mixPresets: MixPreset[] = [
  { id: "balanced", name: "Balanced", description: "Even mix across all elements", stems: [
    { id: "vocals", level: 80, pan: 0 }, { id: "drums", level: 78, pan: 0 },
    { id: "bass", level: 76, pan: 0 }, { id: "melody", level: 74, pan: 0 },
    { id: "fx", level: 55, pan: 0 }, { id: "adlibs", level: 60, pan: 8 },
  ], masterFader: 0 },
  { id: "vocal-forward", name: "Vocal Forward", description: "Vocals pushed to the front", stems: [
    { id: "vocals", level: 90, pan: 0 }, { id: "drums", level: 70, pan: 0 },
    { id: "bass", level: 72, pan: 0 }, { id: "melody", level: 65, pan: 0 },
    { id: "fx", level: 45, pan: 0 }, { id: "adlibs", level: 72, pan: 10 },
  ], masterFader: -2 },
  { id: "bass-heavy", name: "Bass Heavy", description: "808s and bass dominate", stems: [
    { id: "vocals", level: 75, pan: 0 }, { id: "drums", level: 82, pan: 0 },
    { id: "bass", level: 92, pan: 0 }, { id: "melody", level: 60, pan: 0 },
    { id: "fx", level: 50, pan: 0 }, { id: "adlibs", level: 55, pan: 5 },
  ], masterFader: -3 },
  { id: "bright", name: "Bright", description: "Crisp highs, airy top end", stems: [
    { id: "vocals", level: 82, pan: 0 }, { id: "drums", level: 80, pan: 0 },
    { id: "bass", level: 70, pan: 0 }, { id: "melody", level: 78, pan: 0 },
    { id: "fx", level: 65, pan: 0 }, { id: "adlibs", level: 62, pan: 12 },
  ], masterFader: -1 },
  { id: "warm", name: "Warm", description: "Smooth, analog warmth", stems: [
    { id: "vocals", level: 78, pan: 0 }, { id: "drums", level: 72, pan: 0 },
    { id: "bass", level: 80, pan: 0 }, { id: "melody", level: 76, pan: 0 },
    { id: "fx", level: 52, pan: 0 }, { id: "adlibs", level: 58, pan: 5 },
  ], masterFader: 0 },
  { id: "punchy", name: "Punchy", description: "Aggressive transients, tight dynamics", stems: [
    { id: "vocals", level: 82, pan: 0 }, { id: "drums", level: 88, pan: 0 },
    { id: "bass", level: 85, pan: 0 }, { id: "melody", level: 68, pan: 0 },
    { id: "fx", level: 50, pan: 0 }, { id: "adlibs", level: 65, pan: 8 },
  ], masterFader: -2 },
  { id: "spacious", name: "Spacious", description: "Wide stereo field, ambient", stems: [
    { id: "vocals", level: 78, pan: 0 }, { id: "drums", level: 70, pan: 0 },
    { id: "bass", level: 72, pan: 0 }, { id: "melody", level: 76, pan: 10 },
    { id: "fx", level: 70, pan: -15 }, { id: "adlibs", level: 68, pan: 20 },
  ], masterFader: 0 },
  { id: "clean", name: "Clean", description: "Transparent, minimal processing", stems: [
    { id: "vocals", level: 76, pan: 0 }, { id: "drums", level: 74, pan: 0 },
    { id: "bass", level: 74, pan: 0 }, { id: "melody", level: 72, pan: 0 },
    { id: "fx", level: 58, pan: 0 }, { id: "adlibs", level: 56, pan: 5 },
  ], masterFader: 0 },
];

export const defaultMasteringChain: MasteringChainSettings = {
  eq: { enabled: true, lowGain: 2, midGain: 0, highGain: 1.5, lowFreq: 100, midFreq: 2000, highFreq: 8000 },
  compressor: { enabled: true, threshold: -24, ratio: 2.5, attack: 30, release: 100, gainReduction: -3.2 },
  stereoImager: { enabled: true, width: 110, phaseCorrelation: 0.8 },
  limiter: { enabled: true, ceiling: -0.3, threshold: -8, release: 50 },
  exciter: { enabled: false, drive: 30, mix: 40, type: "Tape" },
};

export const masteringPresets: MasteringPreset[] = [
  {
    id: "streaming",
    name: "Streaming",
    platform: "Spotify, Apple Music",
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
    targetLUFS: -14,
    peakTarget: -1,
    description: "Loudness-normalized for streaming platforms. Clean dynamics preserved for transcoding.",
    chain: {
      eq: { enabled: true, lowGain: 1.5, midGain: 0.5, highGain: 2, lowFreq: 100, midFreq: 2000, highFreq: 8000 },
      compressor: { enabled: true, threshold: -20, ratio: 2, attack: 30, release: 120, gainReduction: -2.1 },
      stereoImager: { enabled: true, width: 105, phaseCorrelation: 0.85 },
      limiter: { enabled: true, ceiling: -1, threshold: -14, release: 60 },
      exciter: { enabled: false, drive: 20, mix: 30, type: "Tape" },
    },
  },
  {
    id: "radio",
    name: "Radio",
    platform: "FM/AM Broadcast",
    icon: "M6 18L18 6M6 6l12 12",
    targetLUFS: -9,
    peakTarget: -0.3,
    description: "Broadcast-ready loudness with controlled dynamics for radio transmission.",
    chain: {
      eq: { enabled: true, lowGain: 3, midGain: 1, highGain: 2.5, lowFreq: 80, midFreq: 2000, highFreq: 10000 },
      compressor: { enabled: true, threshold: -26, ratio: 3, attack: 15, release: 60, gainReduction: -4.5 },
      stereoImager: { enabled: true, width: 100, phaseCorrelation: 0.9 },
      limiter: { enabled: true, ceiling: -0.3, threshold: -9, release: 40 },
      exciter: { enabled: true, drive: 40, mix: 35, type: "Tube" },
    },
  },
  {
    id: "club",
    name: "Club",
    platform: "Club / Festival",
    icon: "M12 5v14M5 12h14",
    targetLUFS: -6,
    peakTarget: -0.1,
    description: "Maximum loudness, heavy bass emphasis. Built for big systems.",
    chain: {
      eq: { enabled: true, lowGain: 5, midGain: -1, highGain: 1, lowFreq: 60, midFreq: 2000, highFreq: 8000 },
      compressor: { enabled: true, threshold: -30, ratio: 4, attack: 8, release: 40, gainReduction: -6.8 },
      stereoImager: { enabled: true, width: 95, phaseCorrelation: 0.75 },
      limiter: { enabled: true, ceiling: -0.1, threshold: -6, release: 25 },
      exciter: { enabled: true, drive: 60, mix: 50, type: "Warm" },
    },
  },
  {
    id: "headphones",
    name: "Headphones",
    platform: "Personal Listening",
    icon: "M3 18v-6a9 9 0 0118 0v6",
    targetLUFS: -16,
    peakTarget: -1,
    description: "Intimate, detailed sound with enhanced stereo width for headphone listening.",
    chain: {
      eq: { enabled: true, lowGain: 1, midGain: 1, highGain: 3, lowFreq: 120, midFreq: 2500, highFreq: 12000 },
      compressor: { enabled: true, threshold: -18, ratio: 1.8, attack: 40, release: 150, gainReduction: -1.5 },
      stereoImager: { enabled: true, width: 130, phaseCorrelation: 0.7 },
      limiter: { enabled: true, ceiling: -1, threshold: -16, release: 80 },
      exciter: { enabled: true, drive: 25, mix: 30, type: "Bright" },
    },
  },
];

export function generateMixHistory(): MixHistoryItem[] {
  return [
    { id: "mix-hist-1", label: "AI Mix — Balanced", timestamp: new Date(Date.now() - 3600000).toISOString(), presetName: "Balanced" },
    { id: "mix-hist-2", label: "Manual — Vocal Forward", timestamp: new Date(Date.now() - 7200000).toISOString(), presetName: "Vocal Forward" },
    { id: "mix-hist-3", label: "Initial Mix", timestamp: new Date(Date.now() - 10800000).toISOString(), presetName: null },
  ];
}

export function generateMasterHistory(): MasterHistoryItem[] {
  return [
    { id: "master-hist-1", label: "AI Master — Streaming", timestamp: new Date(Date.now() - 1800000).toISOString(), presetName: "Streaming", lufs: -14.1 },
    { id: "master-hist-2", label: "AI Master — Club", timestamp: new Date(Date.now() - 5400000).toISOString(), presetName: "Club", lufs: -6.2 },
    { id: "master-hist-3", label: "Manual Master", timestamp: new Date(Date.now() - 9000000).toISOString(), presetName: null, lufs: -10.5 },
  ];
}

// Generate visualization data
export function generateSpectrumData(mode: "dry" | "processed" = "processed"): number[] {
  const bands = 64;
  const data: number[] = [];
  for (let i = 0; i < bands; i++) {
    const freq = i / bands;
    // Simulate realistic spectrum: bass heavy, mid scoop, air band
    let base = Math.exp(-freq * 2.5) * 0.8 + Math.exp(-(freq - 0.7) * (freq - 0.7) * 30) * 0.3;
    if (mode === "processed") {
      base *= 0.85; // Slightly compressed
      base += Math.exp(-(freq - 0.05) * (freq - 0.05) * 400) * 0.15; // Enhanced subs
      base += Math.exp(-(freq - 0.8) * (freq - 0.8) * 100) * 0.1; // Air boost
    }
    const variation = 1 + (Math.sin(i * 0.7 + Date.now() * 0.001) * 0.15);
    data.push(Math.max(0, Math.min(1, base * variation)));
  }
  return data;
}

export function generateStereoData(frameCount: number = 200): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  const timeOffset = Date.now() * 0.001;
  for (let i = 0; i < frameCount; i++) {
    const t = i / frameCount * Math.PI * 4 + timeOffset;
    // Lissajous pattern: stereo field representation
    const left = Math.sin(t) * 0.6 + Math.sin(t * 2.3) * 0.25 + Math.sin(t * 0.7) * 0.15;
    const right = Math.sin(t + 0.3) * 0.55 + Math.sin(t * 2.1 + 0.2) * 0.3 + Math.sin(t * 0.8 + 0.5) * 0.15;
    // Convert to x/y: x = L+R (mid), y = L-R (side)
    const x = (left + right) * 0.7;
    const y = (left - right) * 0.7;
    points.push({ x, y });
  }
  return points;
}

export function generateWaveformData(durationSec: number = 180, intensity: number = 1): number[] {
  const points: number[] = [];
  const totalPoints = Math.floor(durationSec * 43);
  for (let i = 0; i < totalPoints; i++) {
    const t = i / totalPoints;
    const seed = Math.sin(i * 0.07) * 0.4 + Math.sin(i * 0.13) * 0.25 + Math.sin(i * 0.03) * 0.35;
    const envelope = t < 0.05 ? t / 0.05 : t > 0.85 ? (1 - t) / 0.15 : 1;
    points.push(Math.abs(seed * envelope * intensity));
  }
  return points;
}

export function generateMasteredWaveform(original: number[]): number[] {
  // Simulate mastering: more consistent peaks, slightly louder
  return original.map((v, i) => {
    const t = i / original.length;
    // Compression effect: reduce dynamics
    const compressed = v > 0.6 ? 0.6 + (v - 0.6) * 0.4 : v;
    // Louder overall
    const boosted = compressed * 1.15;
    // Limiter ceiling
    return Math.min(0.98, boosted);
  });
}

export function getMockLufsReadings(preset: MasteringPreset): {
  integrated: number;
  shortTerm: number;
  momentary: number;
  truePeak: number;
  dynamicRange: number;
} {
  const target = preset.targetLUFS;
  return {
    integrated: target + (Math.random() - 0.5) * 0.4,
    shortTerm: target + (Math.random() - 0.5) * 1.5,
    momentary: target + (Math.random() - 0.5) * 2.5,
    truePeak: preset.peakTarget - Math.random() * 0.2,
    dynamicRange: 6 + Math.random() * 5,
  };
}

// ─── Songwriter ──────────────────────────────────────────────

export interface LyricSection {
  id: string;
  label: string;
  lines: string;
}

export interface LyricGenerationParams {
  topic: string;
  genre: string;
  mood: string[];
  sectionType: "hook" | "verse" | "bridge" | "full";
}

export interface RhymeEntry {
  word: string;
  perfect: string[];
  near: string[];
}

export interface WordplaySuggestion {
  type: "simile" | "metaphor" | "double-entendre" | "punchline";
  text: string;
  context: string;
}

export interface FlowPattern {
  name: string;
  pattern: string; // stress marks like "– ◡ – ◡ – ◡ –"
  description: string;
  bpm: number;
}

const hookBank = [
  "Late nights, early mornings, I been on the grind\nCrown heavy but I carry it, one of a kind\nLate nights, they can't phase me, I been in my prime\nKing Juice on the track, leave 'em all behind",
  "They don't see the work, they just see the shine\nEvery L was a lesson, every win was a sign\nI been stacking up the wins, I been toeing the line\nNow they watching every move like I'm dropping a dime",
  "Sauce dripping off the crown, I can't hold it back\nEvery step I take they tracing, following the map\nTold 'em I would make it, they ain't know it was a fact\nNow I'm sitting at the top and they wonder how I snapped",
  "Heavy is the head that wears the crown they said\nBut I been through the fire, I ain't never fled\nEvery night I pray, every morning I get bread\nLiving out the dream while they sleeping in their bed",
];

const verseBank = [
  "Woke up in the late night, city lights glow\nCrown heavy on my head, they already know\nThey been waiting on the real one to show\nI been cooking in the stu, let the truth flow\n\nShadows in the hallway, memories in the rear\nEvery loss I took, I converted into gear\nNow I'm shifting lanes, vision crystal clear\nTold my younger self the future's nothing to fear",
  "Sauce walk through the valley, I don't trip\nDrip season permanent, I don't slip\nThey talk loud but they ain't on the script\nReal talk only, that's the fellowship\n\nCame from the bottom where the hope runs thin\nTurned my pain to power, let the healing begin\nEvery scar tells a story of the place I been\nNow I'm writing chapters that'll never end",
  "Counted me out, now I'm counting up the blessings\nEvery question turned to answers, every doubt into a lesson\nThey was sleeping on the kid, now they asking all the questions\nHow'd you turn your life around and make a lasting impression?\n\nI tell 'em faith and focus, never folding under pressure\nEvery setback was a setup for a comeback that's fresher\nKing Juice in the building, every verse is a treasure\nI don't measure up to them, I just measure my own measure",
  "Middle of the night, studio sessions\nTurning my confessions into life lessons\nThey want the shine but they skip the blessings\nI want the truth even when it's stressing\n\nPen to the pad like a therapy session\nEvery bar is a scar turned into expression\nThis ain't just music, this is my confession\nKing Juice on the beat, that's the only profession",
];

const bridgeBank = [
  "And when the midnight flex begins\nI feel the weight but I still win\nNo limits on what I can do\nTrap theology, see it through\n\nThe crown sits heavy but I stand tall\nThrough every rise and every fall\nThis is my calling, this is my all\nKing Juice forever, hear the call",
  "Sometimes I wonder if they see the real me\nBehind the crown and the legacy\nI'm still that kid with a dream and a melody\nJust trying to write my own destiny\n\nThe studio's my sanctuary, the mic my confession\nEvery session is a fresh expression\nOf everything I been, everything I'm becoming\nKing Juice forever, the drum keep drumming",
  "They see the crown, they don't see the climb\nThey hear the rhymes, they don't feel the grind\nBut I know every step was perfectly timed\nDivine alignment, I was designed\n\nFor moments like this, when the stars align\nWhen the beat drops perfect and I find my rhyme\nThis is what I'm built for, this is my time\nKing Juice rising, watch me shine",
  "Pressure makes diamonds, that's the truth I live\nEvery ounce of love that I got, I give\nTo the music, to the movement, to the way I live\nThis ain't just a moment, this is what I'm here to give\n\nSo let the piano play and let the choir sing\nI was born for this, I was made to be king\nEvery note a testimony, every word a offering\nJuice Studio forever, let the anthem ring",
];

export function generateLyrics(params: LyricGenerationParams): LyricSection[] {
  const sections: LyricSection[] = [];
  const pickRandom = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  if (params.sectionType === "hook" || params.sectionType === "full") {
    sections.push({
      id: "hook",
      label: "Hook",
      lines: pickRandom(hookBank),
    });
  }

  if (params.sectionType === "verse" || params.sectionType === "full") {
    sections.push({
      id: "verse1",
      label: "Verse 1",
      lines: pickRandom(verseBank),
    });
    if (params.sectionType === "full") {
      sections.push({
        id: "verse2",
        label: "Verse 2",
        lines: pickRandom(verseBank.filter((v) => v !== sections[sections.length - 1]?.lines)),
      });
    }
  }

  if (params.sectionType === "bridge" || params.sectionType === "full") {
    sections.push({
      id: "bridge",
      label: "Bridge",
      lines: pickRandom(bridgeBank),
    });
  }

  if (params.sectionType === "full") {
    sections.push({
      id: "outro",
      label: "Outro",
      lines: "King Juice...\nLate nights, crown heavy\nBut I carry it well\nYeah...\nJuice Studio",
    });
  }

  return sections;
}

export const rhymeDict: RhymeEntry[] = [
  { word: "grind", perfect: ["find", "mind", "blind", "kind", "signed", "behind", "designed", "aligned", "refined", "combined"], near: ["rhyme", "time", "climb", "dime", "prime", "shine"] },
  { word: "crown", perfect: ["down", "town", "brown", "frown", "clown", "drown", "renown"], near: ["sound", "ground", "found", "round", "bound", "profound"] },
  { word: "night", perfect: ["light", "right", "fight", "tight", "bright", "flight", "height", "sight", "might", "write"], near: ["life", "like", "ride", "rise"] },
  { word: "flow", perfect: ["know", "show", "glow", "blow", "grow", "throw", "snow", "low", "though", "go"], near: ["soul", "cold", "gold", "whole"] },
  { word: "real", perfect: ["feel", "deal", "steal", "heal", "wheel", "reveal", "conceal"], near: ["still", "will", "build", "filled"] },
  { word: "juice", perfect: ["loose", "truth", "produce", "reduce", "introduce", "abuse"], near: ["lose", "choose", "news", "views"] },
  { word: "drip", perfect: ["trip", "slip", "grip", "flip", "chip", "ship", "rip", "tip", "clip", "zip"], near: ["dip", "hit", "fit", "split"] },
  { word: "heavy", perfect: ["ready", "steady", "petty", "pretty", "gritty"], near: ["heavy", "any", "many", "plenty", "empty"] },
  { word: "pain", perfect: ["gain", "rain", "chain", "brain", "train", "strain", "vein", "plane", "explain", "remain"], near: ["same", "name", "flame", "game"] },
  { word: "shine", perfect: ["mine", "line", "time", "rhyme", "climb", "dime", "prime", "design", "divine", "define"], near: ["find", "sign", "kind", "mind"] },
];

export const wordplayBank: WordplaySuggestion[] = [
  { type: "simile", text: "Like a king without a throne — I built my own", context: "Self-made success metaphor" },
  { type: "simile", text: "Sharp like the edge of a crown, smooth like the velvet inside", context: "Duality of toughness and elegance" },
  { type: "simile", text: "Heavy like the weight of expectations, light like the feeling when you prove 'em wrong", context: "Contrast imagery" },
  { type: "metaphor", text: "The studio is my throne room, every beat is a decree", context: "Royal power metaphor" },
  { type: "metaphor", text: "My voice is the architect, these bars are the blueprint", context: "Construction/creation metaphor" },
  { type: "metaphor", text: "Pressure is the forge where kings are made", context: "Blacksmith/transformation metaphor" },
  { type: "double-entendre", text: "I carry the crown — both the kingdom and the weight", context: "Crown as royalty + burden" },
  { type: "double-entendre", text: "Running through the checks — both the money and the verification", context: "Checks = payments + validation" },
  { type: "double-entendre", text: "I'm in the stu cooking — both creating and heating up", context: "Studio cooking = making music + literal heat" },
  { type: "punchline", text: "They said I wouldn't make it... now they can't make it without me", context: "Reversal punchline" },
  { type: "punchline", text: "I don't chase dreams — dreams chase me with a contract", context: "Role reversal" },
  { type: "punchline", text: "My only competition is my reflection, and even he's falling behind", context: "Self-improvement punchline" },
];

export const flowPatterns: FlowPattern[] = [
  { name: "Trap Staccato", pattern: "◡ – ◡ ◡ – ◡ – ◡ – ◡", description: "Short bursts, heavy on the 1 and 3 — classic trap cadence. Tight syllables with space between phrases.", bpm: 140 },
  { name: "Melodic Run", pattern: "◡ ◡ ◡ ◡ – ◡ ◡ – ◡ – ◡", description: "Flowing melodic delivery with longer vowel stretches. Works well with auto-tune and R&B vibes.", bpm: 130 },
  { name: "Drill Aggressive", pattern: "– ◡ – – ◡ – ◡ – – ◡", description: "Hard-hitting, staccato with emphasis on every downbeat. Dark, aggressive pocket.", bpm: 142 },
  { name: "R&B Smooth", pattern: "◡ – ◡ – ◡ – – ◡ – ◡", description: "Laid-back, behind-the-beat delivery. Let the notes breathe, let the melody carry.", bpm: 85 },
  { name: "Double-Time", pattern: "◡ ◡ ◡ – ◡ ◡ ◡ – ◡ ◡", description: "Rapid fire delivery, dense syllables. Technical showcase flow for lyrical moments.", bpm: 140 },
  { name: "Half-Time Swagger", pattern: "– ◡ – – – ◡ – ◡ – –", description: "Slow, deliberate, heavy presence. Every word lands with weight. Bounce pocket.", bpm: 75 },
  { name: "Syncopated Bounce", pattern: "◡ – ◡ – ◡ – ◡ ◡ – ◡ –", description: "Off-beat syncopation with rhythmic displacement. Creates tension and release.", bpm: 135 },
  { name: "Gospel Cadence", pattern: "– ◡ – ◡ – ◡ – – ◡ – ◡ –", description: "Soaring, emotional delivery with held notes on key words. Builds to powerful climaxes.", bpm: 90 },
];

export interface SongwriterHistoryItem {
  id: string;
  type: string;
  genre: string;
  mood: string[];
  preview: string;
  timestamp: string;
  sections: LyricSection[];
}

export function generateSongwriterHistory(): SongwriterHistoryItem[] {
  return [
    {
      id: "swh-1",
      type: "Full Song",
      genre: "Trap",
      mood: ["Dark", "Confident"],
      preview: "Late nights, early mornings, I been on the grind...",
      timestamp: new Date(Date.now() - 1800000).toISOString(),
      sections: [
        { id: "hook", label: "Hook", lines: hookBank[0] },
        { id: "verse1", label: "Verse 1", lines: verseBank[0] },
      ],
    },
    {
      id: "swh-2",
      type: "Verse",
      genre: "R&B",
      mood: ["Romantic", "Reflective"],
      preview: "Counted me out, now I'm counting up the blessings...",
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      sections: [
        { id: "verse1", label: "Verse 1", lines: verseBank[2] },
      ],
    },
    {
      id: "swh-3",
      type: "Bridge",
      genre: "Gospel",
      mood: ["Sad", "Reflective"],
      preview: "Sometimes I wonder if they see the real me...",
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      sections: [
        { id: "bridge", label: "Bridge", lines: bridgeBank[1] },
      ],
    },
  ];
}

export function countSyllables(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  let count = 0;
  for (const word of words) {
    const cleaned = word.replace(/[^a-zA-Z']/g, "").toLowerCase();
    if (cleaned.length <= 2) { count += 1; continue; }
    const vowelGroups = cleaned.match(/[aeiouy]+/gi);
    count += vowelGroups ? vowelGroups.length : 1;
    if (cleaned.endsWith("e") && !cleaned.endsWith("le") && vowelGroups && vowelGroups.length > 1) {
      count -= 1;
    }
  }
  return Math.max(1, count);
}

// ─── Music Creation ──────────────────────────────────────────

export interface NoteEvent {
  id: string;
  pitch: number;    // MIDI pitch 0-127
  start: number;    // beat position (0-based, 16th note grid)
  duration: number; // in 16th notes
  velocity: number; // 0-127
  row: number;      // display row (0 = bottom)
}

export type InstrumentId = "piano" | "bass" | "guitar" | "synth" | "strings" | "kick" | "snare" | "hihat" | "percussion" | "brass" | "pad" | "fx";

export const instrumentDefs: { id: InstrumentId; name: string; color: string; category: string }[] = [
  { id: "piano", name: "Piano", color: "#7c3aed", category: "Keys" },
  { id: "bass", name: "Bass", color: "#f59e0b", category: "Bass" },
  { id: "guitar", name: "Guitar", color: "#10b981", category: "Strings" },
  { id: "synth", name: "Synth", color: "#06b6d4", category: "Synth" },
  { id: "strings", name: "Strings", color: "#ef4444", category: "Orchestral" },
  { id: "kick", name: "808", color: "#ec4899", category: "Drums" },
  { id: "snare", name: "Drums", color: "#f97316", category: "Drums" },
  { id: "hihat", name: "Percussion", color: "#84cc16", category: "Drums" },
  { id: "percussion", name: "Percussion", color: "#14b8a6", category: "Drums" },
  { id: "brass", name: "Brass", color: "#eab308", category: "Horns" },
  { id: "pad", name: "Pad", color: "#6366f1", category: "Synth" },
  { id: "fx", name: "FX", color: "#a855f7", category: "SFX" },
];

export interface MelodyPreset {
  id: string;
  name: string;
  instrument: InstrumentId;
  key: string;
  scale: string;
  bpm: number;
  bars: number;
  notes: NoteEvent[];
}

function makeNote(id: string, pitch: number, start: number, duration: number, velocity: number = 100): NoteEvent {
  return { id, pitch, start, duration, velocity, row: pitch % 24 };
}

function generateMelodicPattern(keyOffset: number, bars: number, density: number): NoteEvent[] {
  const notes: NoteEvent[] = [];
  const totalSlots = bars * 16; // 16th note grid
  const baseNote = 60 + keyOffset; // C4 = 60
  const scale = [0, 2, 4, 5, 7, 9, 11]; // Major scale intervals

  let slot = 0;
  let idx = 0;
  while (slot < totalSlots) {
    if (Math.random() < density) {
      const scaleIdx = Math.floor(Math.random() * scale.length);
      const octave = Math.floor(Math.random() * 2);
      const pitch = baseNote + scale[scaleIdx] + octave * 12;
      const duration = [1, 2, 3, 4][Math.floor(Math.random() * 4)];
      notes.push(makeNote(`note-${idx++}`, pitch, slot, Math.min(duration, totalSlots - slot)));
      slot += duration;
    } else {
      slot += 1 + Math.floor(Math.random() * 3);
    }
  }
  return notes;
}

function generateBassPattern(keyOffset: number, bars: number): NoteEvent[] {
  const notes: NoteEvent[] = [];
  const baseNote = 36 + keyOffset;
  const scale = [0, 3, 5, 7, 10]; // Minor pentatonic for bass
  let idx = 0;

  for (let bar = 0; bar < bars; bar++) {
    const root = baseNote + scale[0];
    const fifth = baseNote + scale[2];
    notes.push(makeNote(`bass-${idx++}`, root, bar * 16, 8));
    notes.push(makeNote(`bass-${idx++}`, root, bar * 16 + 8, 4));
    notes.push(makeNote(`bass-${idx++}`, fifth, bar * 16 + 12, 4));

    if (Math.random() > 0.5) {
      const third = baseNote + scale[1];
      notes.push(makeNote(`bass-${idx++}`, third, bar * 16 + 14, 2));
    }
  }
  return notes;
}

function generateChordPattern(keyOffset: number, bars: number): NoteEvent[] {
  const notes: NoteEvent[] = [];
  const baseNote = 48 + keyOffset;
  const chords = [
    [0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7],
    [9, 13, 16], [7, 11, 14], [5, 9, 12], [7, 11, 14],
  ];
  let idx = 0;

  for (let bar = 0; bar < bars; bar++) {
    const chord = chords[bar % chords.length];
    chord.forEach((interval) => {
      notes.push(makeNote(`chord-${idx++}`, baseNote + interval, bar * 16, 16, 80));
    });
  }
  return notes;
}

function generateDrumPattern(bars: number, type: "kick" | "snare" | "hihat"): NoteEvent[] {
  const notes: NoteEvent[] = [];
  const baseNote = type === "kick" ? 36 : type === "snare" ? 38 : 42;
  let idx = 0;

  for (let bar = 0; bar < bars; bar++) {
    if (type === "kick") {
      notes.push(makeNote(`kick-${idx++}`, baseNote, bar * 16, 2, 120));
      notes.push(makeNote(`kick-${idx++}`, baseNote, bar * 16 + 8, 2, 100));
      if (Math.random() > 0.4) {
        notes.push(makeNote(`kick-${idx++}`, baseNote, bar * 16 + 12, 1, 90));
      }
    } else if (type === "snare") {
      notes.push(makeNote(`snare-${idx++}`, baseNote, bar * 16 + 4, 2, 110));
      notes.push(makeNote(`snare-${idx++}`, baseNote, bar * 16 + 12, 2, 115));
    } else {
      for (let i = 0; i < 16; i++) {
        notes.push(makeNote(`hat-${idx++}`, baseNote, bar * 16 + i, 1, 70));
      }
    }
  }
  return notes;
}

function generateCounterMelody(baseNotes: NoteEvent[], keyOffset: number): NoteEvent[] {
  const notes: NoteEvent[] = [];
  let idx = 0;
  const scale = [0, 2, 4, 5, 7, 9, 11];

  for (const base of baseNotes) {
    const scaleIdx = Math.floor(Math.random() * scale.length);
    const pitchOffset = scale[scaleIdx];
    const start = base.start + (Math.random() > 0.5 ? 2 : 0);
    notes.push(makeNote(`cm-${idx++}`, 60 + keyOffset + pitchOffset + 12, start, base.duration + 1, 70));
    idx++;
  }
  return notes.slice(0, Math.floor(baseNotes.length * 0.6));
}

export const melodyPresets: MelodyPreset[] = [
  {
    id: "dark-trap",
    name: "Dark Trap Melody",
    instrument: "synth",
    key: "Dm",
    scale: "Minor",
    bpm: 140,
    bars: 4,
    notes: [
      makeNote("a", 65, 0, 3, 90), makeNote("b", 68, 4, 2, 85), makeNote("c", 65, 8, 3, 90),
      makeNote("d", 70, 12, 2, 80), makeNote("e", 68, 16, 3, 85), makeNote("f", 65, 20, 2, 90),
      makeNote("g", 63, 24, 3, 85), makeNote("h", 68, 28, 2, 80), makeNote("i", 65, 32, 3, 90),
      makeNote("j", 70, 36, 2, 85), makeNote("k", 72, 40, 3, 90), makeNote("l", 68, 44, 4, 85),
      makeNote("m", 65, 48, 3, 90), makeNote("n", 63, 52, 2, 80), makeNote("o", 65, 56, 4, 85),
      makeNote("p", 68, 60, 3, 90),
    ],
  },
  {
    id: "rnb-keys",
    name: "R&B Keys",
    instrument: "piano",
    key: "Am",
    scale: "Minor",
    bpm: 85,
    bars: 4,
    notes: [
      makeNote("a", 69, 0, 4, 75), makeNote("b", 72, 4, 6, 70), makeNote("c", 76, 10, 4, 65),
      makeNote("d", 74, 14, 2, 70), makeNote("e", 72, 16, 4, 75), makeNote("f", 69, 20, 6, 70),
      makeNote("g", 67, 26, 4, 65), makeNote("h", 69, 30, 2, 70), makeNote("i", 72, 32, 4, 75),
      makeNote("j", 74, 36, 6, 70), makeNote("k", 76, 42, 4, 65), makeNote("l", 74, 46, 2, 70),
      makeNote("m", 72, 48, 4, 75), makeNote("n", 69, 52, 6, 70), makeNote("o", 67, 58, 4, 65),
      makeNote("p", 69, 62, 2, 70),
    ],
  },
  {
    id: "pop-hook",
    name: "Pop Hook",
    instrument: "synth",
    key: "C",
    scale: "Major",
    bpm: 120,
    bars: 4,
    notes: [
      makeNote("a", 72, 0, 2, 95), makeNote("b", 74, 2, 2, 90), makeNote("c", 76, 4, 4, 95),
      makeNote("d", 72, 8, 2, 90), makeNote("e", 74, 10, 2, 85), makeNote("f", 76, 12, 4, 95),
      makeNote("g", 79, 16, 2, 90), makeNote("h", 76, 18, 2, 85), makeNote("i", 74, 20, 2, 90),
      makeNote("j", 72, 22, 2, 85), makeNote("k", 76, 24, 4, 95), makeNote("l", 74, 28, 4, 90),
      makeNote("m", 72, 32, 2, 95), makeNote("n", 74, 34, 2, 90), makeNote("o", 76, 36, 4, 95),
      makeNote("p", 79, 40, 2, 90), makeNote("q", 81, 42, 2, 85), makeNote("r", 79, 44, 4, 90),
      makeNote("s", 76, 48, 4, 95), makeNote("t", 74, 52, 6, 90), makeNote("u", 72, 58, 6, 85),
    ],
  },
  {
    id: "drill-synth",
    name: "Drill Synth",
    instrument: "synth",
    key: "Em",
    scale: "Minor",
    bpm: 142,
    bars: 4,
    notes: [
      makeNote("a", 64, 0, 2, 95), makeNote("b", 64, 3, 1, 90), makeNote("c", 67, 4, 2, 95),
      makeNote("d", 64, 8, 2, 90), makeNote("e", 67, 10, 1, 85), makeNote("f", 64, 12, 2, 95),
      makeNote("g", 62, 14, 1, 90), makeNote("h", 64, 16, 2, 95), makeNote("i", 64, 19, 1, 90),
      makeNote("j", 67, 20, 2, 95), makeNote("k", 64, 24, 2, 90), makeNote("l", 67, 26, 1, 85),
      makeNote("m", 64, 28, 2, 95), makeNote("n", 69, 30, 1, 90), makeNote("o", 67, 32, 2, 95),
      makeNote("p", 64, 35, 1, 90), makeNote("q", 67, 36, 2, 95), makeNote("r", 64, 40, 2, 90),
      makeNote("s", 62, 42, 1, 85), makeNote("t", 64, 44, 2, 95),
    ],
  },
  {
    id: "afro-guitar",
    name: "Afrobeats Guitar",
    instrument: "guitar",
    key: "Fm",
    scale: "Minor",
    bpm: 108,
    bars: 4,
    notes: [
      makeNote("a", 68, 0, 2, 85), makeNote("b", 71, 2, 1, 80), makeNote("c", 68, 3, 1, 85),
      makeNote("d", 73, 4, 2, 80), makeNote("e", 71, 6, 1, 75), makeNote("f", 68, 7, 1, 80),
      makeNote("g", 68, 8, 2, 85), makeNote("h", 71, 10, 1, 80), makeNote("i", 68, 11, 1, 85),
      makeNote("j", 73, 12, 2, 80), makeNote("k", 71, 14, 1, 75), makeNote("l", 68, 15, 1, 80),
    ],
  },
];

export function generateInstrumentNotes(instrument: InstrumentId, keyOffset: number, bars: number, complexity: number): NoteEvent[] {
  const adjustedKey = keyOffset || 0;
  const adjustedBars = bars || 4;
  const density = 0.1 + complexity * 0.5;

  if (instrument === "bass" || instrument === "kick") {
    return generateBassPattern(adjustedKey, adjustedBars);
  }
  if (instrument === "snare") {
    return generateDrumPattern(adjustedBars, "snare");
  }
  if (instrument === "hihat") {
    return generateDrumPattern(adjustedBars, "hihat");
  }
  if (instrument === "pad") {
    return generateChordPattern(adjustedKey, adjustedBars);
  }
  return generateMelodicPattern(adjustedKey, adjustedBars, density);
}

// ─── Arrangement ─────────────────────────────────────────────

export interface ArrangementSection {
  id: string;
  label: string;
  type: SectionType;
  startBar: number;
  bars: number;
  color: string;
  notes?: string;
  tempo?: number | null;
  keyChange?: string | null;
  energy: number; // 1-10
}

export type SectionType = "intro" | "verse" | "hook" | "bridge" | "outro" | "drop" | "build" | "fill" | "transition";

export const sectionTypeDefs: { type: SectionType; label: string; color: string }[] = [
  { type: "intro", label: "Intro", color: "#3b82f6" },
  { type: "verse", label: "Verse", color: "#10b981" },
  { type: "hook", label: "Hook", color: "#7c3aed" },
  { type: "bridge", label: "Bridge", color: "#f59e0b" },
  { type: "outro", label: "Outro", color: "#ef4444" },
  { type: "drop", label: "Drop", color: "#ec4899" },
  { type: "build", label: "Build-up", color: "#f97316" },
  { type: "fill", label: "Fill", color: "#06b6d4" },
  { type: "transition", label: "Transition", color: "#84cc16" },
];

export interface ArrangementTemplate {
  id: string;
  name: string;
  description: string;
  structure: { type: SectionType; label: string; bars: number }[];
}

export const arrangementTemplates: ArrangementTemplate[] = [
  {
    id: "standard",
    name: "Standard (I-V-H-V-B-H-O)",
    description: "Classic song structure used across hip-hop and R&B",
    structure: [
      { type: "intro", label: "Intro", bars: 4 },
      { type: "verse", label: "Verse 1", bars: 16 },
      { type: "hook", label: "Hook", bars: 8 },
      { type: "verse", label: "Verse 2", bars: 16 },
      { type: "bridge", label: "Bridge", bars: 8 },
      { type: "hook", label: "Hook", bars: 8 },
      { type: "outro", label: "Outro", bars: 4 },
    ],
  },
  {
    id: "trap",
    name: "Trap (I-H-V-H-B-H-O)",
    description: "Hook-forward trap structure — hooks hit early",
    structure: [
      { type: "intro", label: "Intro", bars: 4 },
      { type: "hook", label: "Hook", bars: 8 },
      { type: "verse", label: "Verse 1", bars: 16 },
      { type: "hook", label: "Hook", bars: 8 },
      { type: "bridge", label: "Bridge", bars: 8 },
      { type: "hook", label: "Hook", bars: 8 },
      { type: "outro", label: "Outro", bars: 4 },
    ],
  },
  {
    id: "rnb",
    name: "R&B (I-V-PC-H-V-H-B-H-O)",
    description: "Extended R&B form with pre-chorus and bridge",
    structure: [
      { type: "intro", label: "Intro", bars: 8 },
      { type: "verse", label: "Verse 1", bars: 16 },
      { type: "build", label: "Pre-Chorus", bars: 4 },
      { type: "hook", label: "Hook", bars: 8 },
      { type: "verse", label: "Verse 2", bars: 16 },
      { type: "hook", label: "Hook", bars: 8 },
      { type: "bridge", label: "Bridge", bars: 8 },
      { type: "hook", label: "Hook", bars: 8 },
      { type: "outro", label: "Outro", bars: 4 },
    ],
  },
  {
    id: "pop",
    name: "Pop (I-V-PC-H-V-H-B-H-O)",
    description: "Pop radio structure with maximum hook repetition",
    structure: [
      { type: "intro", label: "Intro", bars: 4 },
      { type: "verse", label: "Verse 1", bars: 8 },
      { type: "build", label: "Pre-Chorus", bars: 4 },
      { type: "hook", label: "Hook", bars: 8 },
      { type: "verse", label: "Verse 2", bars: 8 },
      { type: "build", label: "Pre-Chorus", bars: 4 },
      { type: "hook", label: "Hook", bars: 8 },
      { type: "bridge", label: "Bridge", bars: 8 },
      { type: "hook", label: "Hook", bars: 8 },
      { type: "outro", label: "Outro", bars: 4 },
    ],
  },
  {
    id: "drill",
    name: "Drill (I-V-H-V-H-O)",
    description: "Tight drill structure — heavy verses, quick hooks",
    structure: [
      { type: "intro", label: "Intro", bars: 8 },
      { type: "verse", label: "Verse 1", bars: 32 },
      { type: "hook", label: "Hook", bars: 8 },
      { type: "verse", label: "Verse 2", bars: 32 },
      { type: "hook", label: "Hook", bars: 8 },
      { type: "outro", label: "Outro", bars: 4 },
    ],
  },
  {
    id: "custom",
    name: "Custom",
    description: "Start from scratch — build your own arrangement",
    structure: [],
  },
];

export function generateArrangement(templateId: string): ArrangementSection[] {
  const template = arrangementTemplates.find((t) => t.id === templateId);
  if (!template || template.structure.length === 0) {
    return [
      { id: "arr-intro", label: "Intro", type: "intro", startBar: 1, bars: 4, color: "#3b82f6", energy: 5 },
    ];
  }

  let startBar = 1;
  return template.structure.map((s, i) => {
    const def = sectionTypeDefs.find((d) => d.type === s.type);
    const section: ArrangementSection = {
      id: `arr-${templateId}-${i}-${Date.now()}`,
      label: s.label,
      type: s.type,
      startBar,
      bars: s.bars,
      color: def?.color || "#7c3aed",
      energy: Math.min(10, 3 + Math.floor(Math.random() * 7)),
      notes: "",
    };
    startBar += s.bars;
    return section;
  });
}

export function autoArrange(): ArrangementSection[] {
  const structures = [
    [ { type: "intro" as SectionType, label: "Intro", bars: 4 }, { type: "verse" as SectionType, label: "Verse", bars: 12 }, { type: "hook" as SectionType, label: "Hook", bars: 8 }, { type: "drop" as SectionType, label: "Drop", bars: 4 }, { type: "verse" as SectionType, label: "Verse", bars: 12 }, { type: "hook" as SectionType, label: "Hook", bars: 8 }, { type: "outro" as SectionType, label: "Outro", bars: 4 } ],
    [ { type: "intro" as SectionType, label: "Intro", bars: 8 }, { type: "build" as SectionType, label: "Build", bars: 4 }, { type: "drop" as SectionType, label: "Drop", bars: 8 }, { type: "verse" as SectionType, label: "Verse", bars: 16 }, { type: "hook" as SectionType, label: "Hook", bars: 8 }, { type: "bridge" as SectionType, label: "Bridge", bars: 8 }, { type: "drop" as SectionType, label: "Drop", bars: 8 }, { type: "outro" as SectionType, label: "Outro", bars: 4 } ],
    [ { type: "intro" as SectionType, label: "Intro", bars: 4 }, { type: "hook" as SectionType, label: "Hook", bars: 8 }, { type: "verse" as SectionType, label: "Verse", bars: 16 }, { type: "hook" as SectionType, label: "Hook", bars: 8 }, { type: "verse" as SectionType, label: "Verse", bars: 16 }, { type: "fill" as SectionType, label: "Fill", bars: 2 }, { type: "hook" as SectionType, label: "Hook", bars: 8 }, { type: "outro" as SectionType, label: "Outro", bars: 8 } ],
  ];

  const structure = structures[Math.floor(Math.random() * structures.length)];
  let startBar = 1;
  return structure.map((s, i) => {
    const def = sectionTypeDefs.find((d) => d.type === s.type);
    return {
      id: `arr-auto-${i}-${Date.now()}`,
      label: s.label,
      type: s.type,
      startBar,
      bars: s.bars,
      color: def?.color || "#7c3aed",
      energy: Math.min(10, 3 + Math.floor(Math.random() * 7)),
      notes: "",
    };
  });
}

export function getSectionTypeColor(type: SectionType): string {
  return sectionTypeDefs.find((d) => d.type === type)?.color || "#7c3aed";
}

// ─── Project Manager ────────────────────────────────────────

export const projectFolders: ProjectFolder[] = [
  { id: "all", name: "All Projects", icon: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z", isSystem: true, projectIds: [] },
  { id: "favorites", name: "Favorites", icon: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z", isSystem: true, projectIds: [] },
  { id: "recent", name: "Recent", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", isSystem: true, projectIds: [] },
  { id: "drafts-folder", name: "Drafts", icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z", isSystem: true, projectIds: [] },
  { id: "finished-folder", name: "Finished", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", isSystem: true, projectIds: [] },
  { id: "custom-summer", name: "Summer '26", icon: "M5 3a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V9l-5-6H5z", isSystem: false, projectIds: ["proj-001", "proj-003"] },
  { id: "custom-collabs", name: "Collabs", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z", isSystem: false, projectIds: [] },
];

export function generateProjects(): Project[] {
  return [currentProject, ...recentProjects];
}

export function getAllProjects(): Project[] {
  return generateProjects();
}

// ─── Export Studio ──────────────────────────────────────────

export const exportHistory: ExportItem[] = [
  {
    id: "ex-001",
    projectName: "No Limits",
    fileName: "No_Limits_Master_v1.wav",
    format: "WAV",
    quality: "24-bit / 48kHz",
    sampleRate: 48000,
    size: "84.2 MB",
    exportedAt: "2026-07-14T16:30:00Z",
    status: "completed",
    type: "full",
  },
  {
    id: "ex-002",
    projectName: "Sauce Walk",
    fileName: "Sauce_Walk_Mix_v3.mp3",
    format: "MP3",
    quality: "320 kbps / 44.1kHz",
    sampleRate: 44100,
    size: "12.4 MB",
    exportedAt: "2026-07-12T22:15:00Z",
    status: "completed",
    type: "full",
  },
  {
    id: "ex-003",
    projectName: "Late Nights",
    fileName: "Late_Nights_Rough_Mix.wav",
    format: "WAV",
    quality: "24-bit / 48kHz",
    sampleRate: 48000,
    size: "78.1 MB",
    exportedAt: "2026-07-10T03:45:00Z",
    status: "completed",
    type: "full",
  },
  {
    id: "ex-004",
    projectName: "Drip Season",
    fileName: "Drip_Season_Stems.zip",
    format: "ZIP",
    quality: "24-bit / 48kHz",
    sampleRate: 48000,
    size: "245.0 MB",
    exportedAt: "2026-07-08T19:00:00Z",
    status: "completed",
    type: "stems",
  },
  {
    id: "ex-005",
    projectName: "Crown Heavy",
    fileName: "Crown_Heavy_Demo.mp3",
    format: "MP3",
    quality: "320 kbps / 44.1kHz",
    sampleRate: 44100,
    size: "10.2 MB",
    exportedAt: "2026-07-05T14:20:00Z",
    status: "completed",
    type: "full",
  },
  {
    id: "ex-006",
    projectName: "Late Nights",
    fileName: "Late_Nights_Instrumental.wav",
    format: "WAV",
    quality: "24-bit / 48kHz",
    sampleRate: 48000,
    size: "72.3 MB",
    exportedAt: "2026-07-03T11:10:00Z",
    status: "completed",
    type: "instrumental",
  },
  {
    id: "ex-007",
    projectName: "No Limits",
    fileName: "No_Limits_Lyrics.pdf",
    format: "PDF",
    quality: "N/A",
    sampleRate: 0,
    size: "0.5 MB",
    exportedAt: "2026-07-01T09:30:00Z",
    status: "completed",
    type: "lyrics",
  },
];

export function generateExports(): ExportItem[] {
  return exportHistory;
}

// ─── Helpers ────────────────────────────────────────────────

export function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function estimateFileSize(
  format: string,
  quality: string,
  sampleRate: number,
  durationSec: number,
): string {
  const bitDepth = quality.includes("32") ? 32 : quality.includes("24") ? 24 : 16;
  const channels = 2;
  let bytesPerSecond: number;

  if (format === "MP3") {
    const kbps = parseInt(quality.match(/\d+/)?.[0] || "320");
    bytesPerSecond = (kbps * 1000) / 8;
  } else if (format === "FLAC") {
    bytesPerSecond = (sampleRate * bitDepth * channels) / 8 * 0.55;
  } else if (format === "AIFF") {
    bytesPerSecond = (sampleRate * bitDepth * channels) / 8;
  } else {
    // WAV
    bytesPerSecond = (sampleRate * bitDepth * channels) / 8;
  }

  const totalBytes = bytesPerSecond * durationSec;
  if (totalBytes > 1_000_000_000) return `${(totalBytes / 1_000_000_000).toFixed(1)} GB`;
  if (totalBytes > 1_000_000) return `${(totalBytes / 1_000_000).toFixed(1)} MB`;
  return `${(totalBytes / 1000).toFixed(1)} KB`;
}

export function generateSmallWaveform(durationSec: number): number[] {
  const samples = 120;
  const result: number[] = [];
  for (let i = 0; i < samples; i++) {
    const t = i / samples;
    const envelope = Math.sin(t * Math.PI);
    const val = Math.sin(t * durationSec * 3 + Math.sin(t * 7) * 2) * envelope * 0.8;
    result.push(val + (Math.random() - 0.5) * 0.15);
  }
  return result;
}

// ─── Cover Art Studio ────────────────────────────────────────

export type ArtworkType = "Single" | "Album" | "EP" | "Thumbnail";
export type ArtworkStyle = "dark" | "minimal" | "abstract" | "photorealistic" | "anime" | "3d-render" | "grunge" | "vintage" | "neon" | "paint";
export type TextPosition = "top" | "center" | "bottom";
export type FontStyle = "bold" | "minimal" | "handwritten" | "gothic";
export type TextColor = "white" | "gold" | "black" | "accent";
export type Resolution = "1500x1500" | "3000x3000" | "3000x2550";

export interface ArtworkItem {
  id: string;
  name: string;
  artworkType: ArtworkType;
  style: ArtworkStyle;
  prompt: string;
  colorPaletteId: string;
  textOverlay: { artistName: string; title: string; position: TextPosition; fontStyle: FontStyle; textColor: TextColor };
  resolution: Resolution;
  generatedAt: string;
}

export interface ArtworkGenerationParams {
  type: ArtworkType;
  style: ArtworkStyle;
  prompt: string;
  colorPaletteId: string;
  variationCount: number;
  textOverlay?: { artistName: string; title: string; position: TextPosition; fontStyle: FontStyle; textColor: TextColor };
}

export interface ArtworkColorPalette {
  id: string;
  name: string;
  colors: string[];
}

export interface ArtworkStyleDef {
  id: ArtworkStyle;
  name: string;
  icon: string;
  color: string;
}

export const artworkStyleDefs: ArtworkStyleDef[] = [
  { id: "dark", name: "Dark & Moody", icon: "M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z", color: "#7c3aed" },
  { id: "minimal", name: "Minimalist", icon: "M4 4h16v16H4V4zm2 2v12h12V6H6z", color: "#888888" },
  { id: "abstract", name: "Abstract", icon: "M12 2a3 3 0 00-3 3v2a3 3 0 003 3 3 3 0 013 3v2a3 3 0 01-3 3 3 3 0 01-3-3v-2a3 3 0 00-3-3 3 3 0 003-3V5a3 3 0 00-3-3", color: "#f59e0b" },
  { id: "photorealistic", name: "Photorealistic", icon: "M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z", color: "#10b981" },
  { id: "anime", name: "Anime", icon: "M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z", color: "#ec4899" },
  { id: "3d-render", name: "3D Render", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4", color: "#06b6d4" },
  { id: "grunge", name: "Grunge", icon: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z", color: "#ef4444" },
  { id: "vintage", name: "Vintage", icon: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z", color: "#d4a574" },
  { id: "neon", name: "Neon", icon: "M13 10V3L4 14h7v7l9-11h-7z", color: "#22d3ee" },
  { id: "paint", name: "Paint", icon: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z", color: "#f97316" },
];

export const artworkPalettes: ArtworkColorPalette[] = [
  { id: "dark-gold", name: "Dark + Gold", colors: ["#0a0a0a", "#1a1a2e", "#d4a574", "#b8860b", "#ffd700"] },
  { id: "purple-haze", name: "Purple Haze", colors: ["#0a0a0a", "#1a1025", "#7c3aed", "#a78bfa", "#c084fc"] },
  { id: "neon-nights", name: "Neon Nights", colors: ["#0a0a20", "#1a0a2e", "#22d3ee", "#ec4899", "#7c3aed"] },
  { id: "minimal-white", name: "Minimal White", colors: ["#ffffff", "#f5f5f5", "#e5e5e5", "#d4d4d4", "#a3a3a3"] },
  { id: "earth-tones", name: "Earth Tones", colors: ["#1c1917", "#292524", "#78716c", "#a8a29e", "#d6d3d1"] },
  { id: "vaporwave", name: "Vaporwave", colors: ["#0a0a2e", "#1a0030", "#ff6ec7", "#00d4ff", "#7c3aed"] },
  { id: "fire-ice", name: "Fire & Ice", colors: ["#0a0a0a", "#1a0000", "#ef4444", "#f97316", "#3b82f6"] },
  { id: "monochrome", name: "Monochrome", colors: ["#000000", "#1a1a1a", "#333333", "#666666", "#999999"] },
];

export const artworkPromptExamples = [
  "Dark throne with crown",
  "Neon city at night",
  "Abstract purple waves",
  "Crown made of fire",
  "Dripping gold on black",
  "Smoke and shadows",
  "Diamond in the rough",
  "Midnight skyline",
];

export const artworkHistory: ArtworkItem[] = [
  { id: "art-001", name: "Late Nights Cover", artworkType: "Album", style: "dark", prompt: "dark atmospheric trap album cover", colorPaletteId: "purple-haze", textOverlay: { artistName: "King Juice", title: "LATE NIGHTS", position: "center", fontStyle: "bold", textColor: "white" }, resolution: "3000x3000", generatedAt: "2026-07-16T14:30:00Z" },
  { id: "art-002", name: "Crown Heavy Art", artworkType: "Single", style: "minimal", prompt: "minimal crown on black background", colorPaletteId: "dark-gold", textOverlay: { artistName: "King Juice", title: "CROWN HEAVY", position: "center", fontStyle: "gothic", textColor: "gold" }, resolution: "3000x3000", generatedAt: "2026-07-14T10:15:00Z" },
  { id: "art-003", name: "Sauce Walk Art", artworkType: "Single", style: "abstract", prompt: "abstract drip effect", colorPaletteId: "neon-nights", textOverlay: { artistName: "King Juice", title: "SAUCE WALK", position: "bottom", fontStyle: "handwritten", textColor: "white" }, resolution: "1500x1500", generatedAt: "2026-07-12T18:00:00Z" },
  { id: "art-004", name: "No Limits Art", artworkType: "EP", style: "neon", prompt: "breaking chains neon glow", colorPaletteId: "neon-nights", textOverlay: { artistName: "King Juice", title: "NO LIMITS", position: "center", fontStyle: "bold", textColor: "accent" }, resolution: "3000x2550", generatedAt: "2026-07-08T22:45:00Z" },
  { id: "art-005", name: "Drip Season Ep", artworkType: "EP", style: "vintage", prompt: "vintage hip hop cover", colorPaletteId: "dark-gold", textOverlay: { artistName: "King Juice", title: "DRIP SEASON", position: "top", fontStyle: "handwritten", textColor: "gold" }, resolution: "3000x3000", generatedAt: "2026-07-05T09:00:00Z" },
  { id: "art-006", name: "Thumbnail Test", artworkType: "Thumbnail", style: "3d-render", prompt: "3d render crown gold", colorPaletteId: "dark-gold", textOverlay: { artistName: "King Juice", title: "NEW HEAT", position: "center", fontStyle: "bold", textColor: "white" }, resolution: "1500x1500", generatedAt: "2026-07-02T15:30:00Z" },
];

export function createRng(seed: number) {
  let s = seed;
  return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
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
  let r = Math.min(255, parseInt(h.substring(0, 2), 16) + amount);
  let g = Math.min(255, parseInt(h.substring(2, 4), 16) + amount);
  let b = Math.min(255, parseInt(h.substring(4, 6), 16) + amount);
  return `rgb(${r},${g},${b})`;
}

export function addProceduralTexture(ctx: CanvasRenderingContext2D, w: number, h: number, rng: () => number, alpha: number) {
  const step = Math.max(1, Math.floor(w / 100));
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4 * step) {
    const noise = (rng() - 0.5) * alpha * 255;
    data[i] = Math.min(255, Math.max(0, data[i] + noise));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
  }
  ctx.putImageData(imageData, 0, 0);
}

export function drawArtworkStyle(ctx: CanvasRenderingContext2D, w: number, h: number, style: string, colors: string[], rng: () => number) {
  // Base gradient background
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
      // Crown shape
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
        ctx.strokeStyle = rgbaFromHex(colors[4] || accent, 0.15 + i * 0.05);
        ctx.lineWidth = 1 + i * 0.5;
        ctx.beginPath(); ctx.moveTo(w * 0.25, h * (0.55 + i * 0.12)); ctx.lineTo(w * 0.75, h * (0.55 + i * 0.12)); ctx.stroke();
      }
      ctx.fillStyle = rgbaFromHex(accent, 0.4);
      ctx.beginPath(); ctx.arc(w * 0.35, h * 0.35, w * 0.02, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case "abstract": {
      for (let i = 0; i < 14; i++) {
        const ci = Math.floor(rng() * colors.length);
        ctx.fillStyle = rgbaFromHex(colors[ci], 0.05 + rng() * 0.12);
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
        ctx.fillStyle = rgbaFromHex(color, 0.1 + rng() * 0.15);
        ctx.fillRect(w * rng(), h * rng(), w * (0.08 + rng() * 0.2), h * (0.08 + rng() * 0.15));
        ctx.strokeStyle = rgbaFromHex(color, 0.3); ctx.lineWidth = 1;
        ctx.strokeRect(w * rng(), h * rng(), w * 0.05, h * 0.05);
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
      const accent = colors[3] || colors[2] || "#ef4444";
      for (let i = 0; i < 7; i++) {
        ctx.fillStyle = rgbaFromHex(accent, 0.04 + rng() * 0.08);
        ctx.fillRect(0, h * (0.05 + i * 0.14), w, h * (0.02 + rng() * 0.06));
      }
      ctx.strokeStyle = rgbaFromHex(accent, 0.2); ctx.lineWidth = 3 + rng() * 2;
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
      addProceduralTexture(ctx, w, h, rng, 0.06);
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
      }
      ctx.shadowBlur = 0;
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
        const color = colors[Math.floor(rng() * colors.length)];
        ctx.fillStyle = rgbaFromHex(color, 0.08 + rng() * 0.15);
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

export function drawArtworkText(ctx: CanvasRenderingContext2D, w: number, h: number, textOverlay: { artistName: string; title: string; position: string; fontStyle: string; textColor: string }) {
  const { artistName, title, position, fontStyle, textColor } = textOverlay;
  let textY: number;
  if (position === "top") textY = h * 0.1;
  else if (position === "bottom") textY = h * 0.85;
  else textY = h * 0.48;

  let colorStr: string;
  if (textColor === "gold") colorStr = "#d4a574";
  else if (textColor === "accent") colorStr = "#7c3aed";
  else if (textColor === "black") colorStr = "#000000";
  else colorStr = "#ffffff";

  let fontFamily: string;
  if (fontStyle === "gothic") fontFamily = "'Times New Roman', serif";
  else if (fontStyle === "handwritten") fontFamily = "'Brush Script MT', cursive";
  else if (fontStyle === "minimal") fontFamily = "'Inter', sans-serif";
  else fontFamily = "'Inter', sans-serif";

  const titleSize = Math.max(16, w * 0.08);
  const artistSize = Math.max(10, w * 0.035);

  // Title
  ctx.fillStyle = colorStr;
  ctx.font = `${fontStyle === "bold" ? "900" : "600"} ${titleSize}px ${fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(title.toUpperCase(), w / 2, textY);

  // Artist name
  ctx.font = `${fontStyle === "bold" ? "700" : "400"} ${artistSize}px ${fontFamily}`;
  ctx.fillStyle = rgbaFromHex(colorStr, 0.7);
  const artistY = position === "top" ? textY + titleSize * 0.8 : position === "bottom" ? textY - titleSize * 0.8 : textY + titleSize * 0.7;
  ctx.fillText(artistName, w / 2, artistY);
}

export function generateArtworkVariations(params: ArtworkGenerationParams): ArtworkItem[] {
  const variations: ArtworkItem[] = [];
  const count = params.variationCount || 4;
  const now = new Date().toISOString();
  const titleNames = ["Late Nights", "Crown Heavy", "No Limits", "Sauce Walk", "Drip Season", "New Heat"];
  for (let i = 0; i < count; i++) {
    variations.push({
      id: `art-gen-${Date.now()}-${i}`,
      name: `${titleNames[i % titleNames.length]} v${i + 1}`,
      artworkType: params.type,
      style: params.style,
      prompt: params.prompt,
      colorPaletteId: params.colorPaletteId,
      textOverlay: params.textOverlay || { artistName: "King Juice", title: titleNames[i % titleNames.length].toUpperCase(), position: "center", fontStyle: "bold", textColor: "white" },
      resolution: "3000x3000",
      generatedAt: now,
    });
  }
  return variations;
}

// ─── Video Studio ────────────────────────────────────────────

export type VideoType = "lyric-video" | "music-visualizer" | "spotify-canvas" | "animated-bg";
export type VideoStyle = "particles" | "waveforms" | "glitch" | "smooth" | "neon" | "minimal";
export type VideoAspectRatio = "16:9" | "9:16" | "1:1" | "4:5";
export type VideoDuration = "15s" | "30s" | "60s" | "full-song";
export type TextAnimStyle = "typewriter" | "fade-in" | "slide-up" | "pop";
export type VideoBackgroundType = "solid" | "gradient" | "animated-particles" | "waveform";

export interface VideoTemplate {
  id: string;
  name: string;
  description: string;
  bgType: VideoBackgroundType;
  style: VideoStyle;
  layers: string[];
}

export interface VideoItem {
  id: string;
  name: string;
  videoType: VideoType;
  templateId: string;
  style: VideoStyle;
  aspectRatio: VideoAspectRatio;
  duration: VideoDuration;
  colorPaletteId: string;
  generatedAt: string;
}

export interface VideoGenerationParams {
  type: VideoType;
  style: VideoStyle;
  colorPaletteId: string;
  aspectRatio: VideoAspectRatio;
  duration: VideoDuration;
  templateId: string;
  textOverlay?: { text: string; animStyle: TextAnimStyle };
}

export const videoTemplates: VideoTemplate[] = [
  { id: "lyric-classic", name: "Lyric Video Classic", description: "Clean lyric overlays with smooth transitions", bgType: "gradient", style: "smooth", layers: ["background", "text"] },
  { id: "waveform-viz", name: "Waveform Visualizer", description: "Audio-reactive bars and waveform display", bgType: "waveform", style: "waveforms", layers: ["background", "waveform", "particles"] },
  { id: "particle-storm", name: "Particle Storm", description: "Swirling particles with color bursts", bgType: "animated-particles", style: "particles", layers: ["background", "particles"] },
  { id: "neon-glow", name: "Neon Glow", description: "Neon text effects with dark background", bgType: "solid", style: "neon", layers: ["background", "text"] },
  { id: "minimal-clean", name: "Minimal Clean", description: "Subtle animations, clean aesthetic", bgType: "gradient", style: "minimal", layers: ["background", "waveform"] },
];

export const videoAspectRatios: { id: VideoAspectRatio; label: string; w: number; h: number }[] = [
  { id: "16:9", label: "Landscape", w: 16, h: 9 },
  { id: "9:16", label: "Vertical / Reels", w: 9, h: 16 },
  { id: "1:1", label: "Square", w: 1, h: 1 },
  { id: "4:5", label: "Instagram", w: 4, h: 5 },
];

export const textAnimStyles: { id: TextAnimStyle; name: string }[] = [
  { id: "typewriter", name: "Typewriter" },
  { id: "fade-in", name: "Fade In" },
  { id: "slide-up", name: "Slide Up" },
  { id: "pop", name: "Pop" },
];

export const videoHistory: VideoItem[] = [
  { id: "vid-001", name: "Late Nights (Visualizer)", videoType: "music-visualizer", templateId: "waveform-viz", style: "waveforms", aspectRatio: "16:9", duration: "full-song", colorPaletteId: "purple-haze", generatedAt: "2026-07-17T14:00:00Z" },
  { id: "vid-002", name: "Sauce Walk (Lyric Video)", videoType: "lyric-video", templateId: "lyric-classic", style: "smooth", aspectRatio: "9:16", duration: "full-song", colorPaletteId: "neon-nights", generatedAt: "2026-07-12T10:30:00Z" },
  { id: "vid-003", name: "No Limits (Visualizer)", videoType: "music-visualizer", templateId: "particle-storm", style: "particles", aspectRatio: "16:9", duration: "full-song", colorPaletteId: "fire-ice", generatedAt: "2026-07-08T22:00:00Z" },
  { id: "vid-004", name: "Crown Heavy Visual", videoType: "spotify-canvas", templateId: "neon-glow", style: "neon", aspectRatio: "9:16", duration: "15s", colorPaletteId: "dark-gold", generatedAt: "2026-07-05T16:00:00Z" },
  { id: "vid-005", name: "Drip Season BG", videoType: "animated-bg", templateId: "minimal-clean", style: "minimal", aspectRatio: "16:9", duration: "60s", colorPaletteId: "monochrome", generatedAt: "2026-07-01T09:00:00Z" },
];

export function getDurationSeconds(duration: VideoDuration): number {
  switch (duration) { case "15s": return 15; case "30s": return 30; case "60s": return 60; case "full-song": return 222; }
}

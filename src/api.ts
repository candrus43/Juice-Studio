import { createServerFn } from "@tanstack/react-start";
import {
  currentProject,
  recentProjects,
  favoriteBeats,
  exportedTracks,
  getCreativeBrief,
  exportHistory,
  projectFolders,
  generateProjects,
  generateExports,
} from "./data/mock";
import type { Project, ExportItem, ProjectFolder } from "./data/mock";

// ─── Health ────────────────────────────────────────────────
export const getHealth = createServerFn({ method: "GET" }).handler(async () => {
  return {
    status: "ok",
    service: "Juice Studio API",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };
});

// ─── Auth ──────────────────────────────────────────────────
export const getAuth = createServerFn({ method: "GET" }).handler(async () => {
  return {
    user: {
      name: "King Juice",
      realName: "Jamarion",
      avatar: "KJ",
      plan: "Studio",
      memberSince: "2026-07-01",
    },
    authenticated: true,
  };
});

// ─── Projects ──────────────────────────────────────────────
export const getProjects = createServerFn({ method: "GET" }).handler(async () => {
  return {
    current: currentProject,
    recent: recentProjects,
    total: recentProjects.length + 1,
  };
});

export const projects = {
  list: createServerFn({ method: "GET" }).handler(async () => {
    const all = generateProjects();
    return {
      projects: all,
      total: all.length,
      folders: projectFolders,
    };
  }),

  get: createServerFn({ method: "POST" })
    .handler(async (data: { id: string }) => {
      const all = generateProjects();
      const project = all.find((p) => p.id === data.id);
      return project || null;
    }),

  create: createServerFn({ method: "POST" })
    .handler(async (data: { name?: string }) => {
      const names = ["New Heat", "Untitled Banger", "Fresh Session", "Late Night Idea", "Studio Freestyle"];
      const name = data.name || names[Math.floor(Math.random() * names.length)];
      const keys = ["Cm", "Dm", "Em", "Fm", "Gm", "Am", "Bbm"];
      const bpms = [128, 132, 138, 140, 142, 145, 150, 155];
      const colors = ["#7c3aed", "#8b5cf6", "#a78bfa", "#6d28d9", "#5b21b6", "#c084fc", "#4c1d95"];
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
      return newProject;
    }),

  update: createServerFn({ method: "POST" })
    .handler(async (data: { id: string; updates: Partial<Project> }) => {
      const all = generateProjects();
      const idx = all.findIndex((p) => p.id === data.id);
      if (idx >= 0) {
        Object.assign(all[idx], data.updates);
        all[idx].lastModified = new Date().toISOString();
      }
      return all[idx] || null;
    }),

  delete: createServerFn({ method: "POST" })
    .handler(async (data: { id: string }) => {
      return { id: data.id, deleted: true, timestamp: new Date().toISOString() };
    }),

  search: createServerFn({ method: "POST" })
    .handler(async (data: { query: string }) => {
      const all = generateProjects();
      const q = data.query.toLowerCase();
      const results = all.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.genre.toLowerCase().includes(q) ||
          p.key.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q)),
      );
      return { results, total: results.length, query: data.query };
    }),

  toggleFavorite: createServerFn({ method: "POST" })
    .handler(async (data: { id: string }) => {
      const all = generateProjects();
      const project = all.find((p) => p.id === data.id);
      if (project) {
        project.favorite = !project.favorite;
      }
      return { id: data.id, favorite: project?.favorite || false };
    }),
};

// ─── Beats ─────────────────────────────────────────────────
export const getBeats = createServerFn({ method: "GET" }).handler(async () => {
  return {
    beats: favoriteBeats,
    total: favoriteBeats.length,
    genres: [...new Set(favoriteBeats.map((b) => b.genre))],
  };
});

export const beats = {
  generate: createServerFn({ method: "POST" })
    .handler(async (params: {
      prompt: string;
      genre: string;
      mood: string[];
      energy: number;
      bpm: number;
      key: string;
      length: string;
      instruments: string[];
      structure: string[];
    }) => {
      // Simulate AI generation delay
      await new Promise((r) => setTimeout(r, 2000));
      const { generateBeat } = await import("./data/mock");
      return generateBeat(params);
    }),

  list: createServerFn({ method: "GET" }).handler(async () => {
    return {
      beats: favoriteBeats,
      total: favoriteBeats.length,
    };
  }),

  favorite: createServerFn({ method: "POST" })
    .handler(async (data: { id: string; favorite: boolean }) => {
      const beat = favoriteBeats.find((b) => b.id === data.id);
      if (beat) beat.favorite = data.favorite;
      return { id: data.id, favorite: data.favorite };
    }),

  regenerateSection: createServerFn({ method: "POST" })
    .handler(async (data: { beatId: string; sectionName: string }) => {
      await new Promise((r) => setTimeout(r, 1500));
      const { generateMockSectionWaveform } = await import("./data/mock");
      const durationSec = 30 + Math.random() * 60;
      return {
        beatId: data.beatId,
        sectionName: data.sectionName,
        waveformData: generateMockSectionWaveform(durationSec),
        startSec: 0,
        endSec: durationSec,
      };
    }),
};

// ─── Recordings ────────────────────────────────────────────
export const recordings = {
  list: createServerFn({ method: "GET" }).handler(async () => {
    const { generateDefaultTracks } = await import("./data/mock");
    return {
      tracks: generateDefaultTracks(),
      projectName: "Late Nights",
      bpm: 140,
      key: "Dm",
      totalDuration: "2:44",
    };
  }),

  save: createServerFn({ method: "POST" })
    .handler(async (data: { trackId: string; takeName: string; waveformData: number[]; duration: number }) => {
      await new Promise((r) => setTimeout(r, 300));
      return {
        id: `rec-${Date.now()}`,
        ...data,
        saved: true,
        timestamp: new Date().toISOString(),
      };
    }),

  deleteTake: createServerFn({ method: "POST" })
    .handler(async (data: { trackId: string; takeId: string }) => {
      return {
        trackId: data.trackId,
        takeId: data.takeId,
        deleted: true,
        timestamp: new Date().toISOString(),
      };
    }),
};

// ─── Vocals ─────────────────────────────────────────────────
export const vocals = {
  applyChain: createServerFn({ method: "POST" })
    .handler(async (params: { chain: Record<string, unknown> }) => {
      await new Promise((r) => setTimeout(r, 400));
      return {
        applied: true,
        timestamp: new Date().toISOString(),
        processingTime: "42ms",
        chainSnapshot: params.chain,
      };
    }),

  getPresets: createServerFn({ method: "GET" }).handler(async () => {
    const { genrePresets } = await import("./data/mock");
    return { presets: genrePresets, total: genrePresets.length };
  }),

  savePreset: createServerFn({ method: "POST" })
    .handler(async (data: { name: string; settings: Record<string, unknown> }) => {
      await new Promise((r) => setTimeout(r, 200));
      return {
        id: `preset-${Date.now()}`,
        name: data.name,
        settings: data.settings,
        saved: true,
        timestamp: new Date().toISOString(),
      };
    }),
};

export const getVocalChains = createServerFn({ method: "GET" }).handler(async () => {
  const vocalChains = [
    { id: "chain-001", name: "King Juice Lead", plugins: ["Auto-Tune Pro", "1176 Comp", "PuigTec EQ", "De-Esser", "ValhallaVerb"], category: "Lead Vocal" },
    { id: "chain-002", name: "Smooth R&B", plugins: ["RVox", "LA-2A", "SSL EQ", "H-Delay", "Little Plate"], category: "R&B" },
    { id: "chain-003", name: "Trap Aggressive", plugins: ["Auto-Tune Pro", "Distressor", "API 550", "Decapitator", "H-Reverb"], category: "Trap" },
    { id: "chain-004", name: "Gospel Blend", plugins: ["Waves Tune", "CLA-76", "PuigTec EQ", "Doubler", "Abbey Road Plates"], category: "Gospel" },
  ];
  return { chains: vocalChains, total: vocalChains.length, default: "chain-001" };
});

// ─── Mixing & Mastering ────────────────────────────────────
export const mixing = {
  autoMix: createServerFn({ method: "POST" })
    .handler(async (params: { stems: Array<{ id: string; level: number; mute: boolean; solo: boolean; pan: number }>; masterFader: number }) => {
      await new Promise((r) => setTimeout(r, 3000));
      return {
        applied: true,
        timestamp: new Date().toISOString(),
        processingTime: "1.2s",
        stems: params.stems,
        masterFader: params.masterFader,
        label: "AI Mix",
      };
    }),

  autoMaster: createServerFn({ method: "POST" })
    .handler(async (params: { chain: Record<string, unknown>; presetId?: string }) => {
      await new Promise((r) => setTimeout(r, 3500));
      const { getMockLufsReadings, masteringPresets } = await import("./data/mock");
      const preset = masteringPresets.find((p) => p.id === params.presetId) || masteringPresets[0];
      const readings = getMockLufsReadings(preset);
      return {
        applied: true,
        timestamp: new Date().toISOString(),
        processingTime: "2.1s",
        chain: params.chain,
        ...readings,
      };
    }),

  getPresets: createServerFn({ method: "GET" }).handler(async () => {
    const { masteringPresets: presets } = await import("./data/mock");
    return { presets, total: presets.length };
  }),

  getHistory: createServerFn({ method: "GET" }).handler(async () => {
    const { generateMixHistory, generateMasterHistory } = await import("./data/mock");
    return {
      mix: generateMixHistory(),
      master: generateMasterHistory(),
    };
  }),
};

// ─── Songwriter ────────────────────────────────────────────
export const songwriter = {
  generateLyrics: createServerFn({ method: "POST" })
    .handler(async (params: {
      topic: string;
      genre: string;
      mood: string[];
      sectionType: "hook" | "verse" | "bridge" | "full";
    }) => {
      await new Promise((r) => setTimeout(r, 1500));
      const { generateLyrics } = await import("./data/mock");
      const sections = generateLyrics(params);
      return {
        sections,
        params,
        generatedAt: new Date().toISOString(),
      };
    }),

  suggestRhymes: createServerFn({ method: "POST" })
    .handler(async (data: { word: string }) => {
      await new Promise((r) => setTimeout(r, 300));
      const { rhymeDict } = await import("./data/mock");
      const entry = rhymeDict.find((r) => r.word === data.word.toLowerCase())
        || rhymeDict[Math.floor(Math.random() * rhymeDict.length)];
      return { word: data.word, rhymes: entry, timestamp: new Date().toISOString() };
    }),

  suggestWordplay: createServerFn({ method: "POST" })
    .handler(async (data: { type?: string }) => {
      await new Promise((r) => setTimeout(r, 400));
      const { wordplayBank } = await import("./data/mock");
      let filtered = wordplayBank;
      if (data.type) {
        filtered = wordplayBank.filter((w) => w.type === data.type);
      }
      const count = Math.min(3, filtered.length);
      const shuffled = [...filtered].sort(() => Math.random() - 0.5);
      return { suggestions: shuffled.slice(0, count) };
    }),

  improveFlow: createServerFn({ method: "POST" })
    .handler(async (data: { text: string }) => {
      await new Promise((r) => setTimeout(r, 600));
      const { flowPatterns } = await import("./data/mock");
      return {
        patterns: flowPatterns.sort(() => Math.random() - 0.5).slice(0, 3),
        suggestion: "Try varying your syllable density — the current section has a consistent pattern. Breaking it with a shorter phrase on bar 3 would add tension.",
      };
    }),

  getHistory: createServerFn({ method: "GET" }).handler(async () => {
    const { generateSongwriterHistory } = await import("./data/mock");
    return { history: generateSongwriterHistory() };
  }),
};

// ─── Music Creation ────────────────────────────────────────
export const music = {
  generateMelody: createServerFn({ method: "POST" })
    .handler(async (params: {
      instrument: string;
      key: string;
      bars: number;
      complexity: number;
    }) => {
      await new Promise((r) => setTimeout(r, 800));
      const { generateInstrumentNotes, instrumentDefs } = await import("./data/mock");
      const inst = instrumentDefs.find((d) => d.id === params.instrument);
      const keyOffset = ["C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F"].indexOf(params.key?.replace("m", "") || "C");
      const notes = generateInstrumentNotes(
        (params.instrument as any) || "piano",
        keyOffset >= 0 ? keyOffset : 0,
        params.bars || 4,
        params.complexity || 0.5,
      );
      return {
        notes,
        instrument: inst?.name || params.instrument,
        bars: params.bars,
        generatedAt: new Date().toISOString(),
      };
    }),

  generateBassline: createServerFn({ method: "POST" })
    .handler(async (params: { key: string; bars: number; complexity: number }) => {
      await new Promise((r) => setTimeout(r, 600));
      const { generateInstrumentNotes } = await import("./data/mock");
      const keyOffset = ["C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F"].indexOf(params.key?.replace("m", "") || "C");
      const notes = generateInstrumentNotes("bass", keyOffset >= 0 ? keyOffset : 0, params.bars || 4, params.complexity || 0.5);
      return { notes, instrument: "Bass", bars: params.bars, generatedAt: new Date().toISOString() };
    }),

  generateCounterMelody: createServerFn({ method: "POST" })
    .handler(async (params: { key: string; bars: number; baseNotes: NoteEvent[] }) => {
      await new Promise((r) => setTimeout(r, 700));
      const { generateInstrumentNotes } = await import("./data/mock");
      const keyOffset = ["C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F"].indexOf(params.key?.replace("m", "") || "C");
      const notes = generateInstrumentNotes("guitar", keyOffset >= 0 ? keyOffset : 0, params.bars || 4, 0.4);
      return { notes, instrument: "Counter Melody", bars: params.bars, generatedAt: new Date().toISOString() };
    }),

  generateChords: createServerFn({ method: "POST" })
    .handler(async (params: { key: string; bars: number }) => {
      await new Promise((r) => setTimeout(r, 500));
      const { generateInstrumentNotes } = await import("./data/mock");
      const keyOffset = ["C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F"].indexOf(params.key?.replace("m", "") || "C");
      const notes = generateInstrumentNotes("pad", keyOffset >= 0 ? keyOffset : 0, params.bars || 4, 0.5);
      return { notes, instrument: "Chords", bars: params.bars, generatedAt: new Date().toISOString() };
    }),

  getPresets: createServerFn({ method: "GET" }).handler(async () => {
    const { melodyPresets, instrumentDefs } = await import("./data/mock");
    return { presets: melodyPresets, instruments: instrumentDefs };
  }),
};

// ─── Arrangement ───────────────────────────────────────────
export const arrangement = {
  getTemplates: createServerFn({ method: "GET" }).handler(async () => {
    const { arrangementTemplates, sectionTypeDefs } = await import("./data/mock");
    return { templates: arrangementTemplates, sectionTypes: sectionTypeDefs };
  }),

  autoArrange: createServerFn({ method: "POST" })
    .handler(async () => {
      await new Promise((r) => setTimeout(r, 800));
      const { autoArrange } = await import("./data/mock");
      const sections = autoArrange();
      const totalBars = sections.reduce((sum, s) => sum + s.bars, 0);
      return { sections, totalBars, generatedAt: new Date().toISOString() };
    }),

  saveArrangement: createServerFn({ method: "POST" })
    .handler(async (data: { sections: ArrangementSection[]; projectName: string }) => {
      await new Promise((r) => setTimeout(r, 400));
      const totalBars = data.sections.reduce((sum, s) => sum + s.bars, 0);
      return {
        id: `arr-save-${Date.now()}`,
        sections: data.sections,
        projectName: data.projectName,
        totalBars,
        saved: true,
        timestamp: new Date().toISOString(),
      };
    }),
};

// Need to import types for server fn signatures
import type { NoteEvent, ArrangementSection } from "./data/mock";

// ─── Export ────────────────────────────────────────────────
export const getExportOptions = createServerFn({ method: "GET" }).handler(async () => {
  return {
    formats: [
      { id: "wav", label: "WAV", bitDepth: "24-bit", compression: "None" },
      { id: "mp3", label: "MP3", bitrate: "320 kbps", compression: "Lossy" },
      { id: "flac", label: "FLAC", bitDepth: "24-bit", compression: "Lossless" },
      { id: "stems", label: "Stems ZIP", bitDepth: "24-bit", compression: "None" },
    ],
    exportedTracks,
    currentProject: "Late Nights",
    estimatedSizes: { wav: "85 MB", mp3: "12 MB", flac: "45 MB", stems: "250 MB" },
  };
});

export const exportApi = {
  export: createServerFn({ method: "POST" })
    .handler(async (params: {
      projectId: string;
      format: string;
      quality: string;
      sampleRate: number;
      exportType: string;
      normalize: boolean;
      targetLUFS: number;
      includeMetadata: boolean;
      metadata: { title: string; artist: string; album: string; year: string; genre: string };
    }) => {
      await new Promise((r) => setTimeout(r, 4000));
      const all = generateProjects();
      const project = all.find((p) => p.id === params.projectId) || all[0];
      const formatLabel = params.format.toUpperCase();
      const { estimateFileSize } = await import("./data/mock");
      const durationSec = parseInt(project.duration?.split(":")[0] || "3") * 60 + parseInt(project.duration?.split(":")[1] || "30");
      const size = estimateFileSize(params.format, params.quality, params.sampleRate, durationSec);
      const ext = params.format === "mp3" ? "mp3" : params.format === "flac" ? "flac" : params.format === "aiff" ? "aiff" : "wav";
      const newExport: ExportItem = {
        id: `ex-${Date.now()}`,
        projectName: project.name,
        fileName: `${project.name.replace(/\s+/g, "_")}_${params.exportType === "instrumental" ? "Instrumental" : params.exportType === "stems" ? "Stems" : "Master"}.${ext}`,
        format: formatLabel,
        quality: `${params.quality} / ${(params.sampleRate / 1000).toFixed(1)}kHz`,
        sampleRate: params.sampleRate,
        size,
        exportedAt: new Date().toISOString(),
        status: "completed",
        type: params.exportType as "full" | "instrumental" | "stems" | "lyrics" | "backup",
      };
      return { export: newExport, success: true };
    }),

  getHistory: createServerFn({ method: "GET" }).handler(async () => {
    return { exports: generateExports(), total: generateExports().length };
  }),

  download: createServerFn({ method: "POST" })
    .handler(async (data: { exportId: string }) => {
      await new Promise((r) => setTimeout(r, 2000));
      return {
        exportId: data.exportId,
        downloaded: true,
        timestamp: new Date().toISOString(),
        url: `https://downloads.juicestudio.io/${data.exportId}`,
      };
    }),
};

// ─── Artwork ───────────────────────────────────────────────
export const artwork = {
  generate: createServerFn({ method: "POST" })
    .handler(async (params: {
      type: string; style: string; prompt: string; colorPaletteId: string;
      variationCount: number;
      textOverlay?: { artistName: string; title: string; position: string; fontStyle: string; textColor: string };
    }) => {
      await new Promise((r) => setTimeout(r, 2000));
      const { generateArtworkVariations, artworkPalettes, artworkStyleDefs } = await import("./data/mock");
      const variations = generateArtworkVariations({
        type: params.type as any, style: params.style as any, prompt: params.prompt,
        colorPaletteId: params.colorPaletteId, variationCount: params.variationCount,
        textOverlay: params.textOverlay as any,
      });
      const palette = artworkPalettes.find((p) => p.id === params.colorPaletteId) || artworkPalettes[0];
      const styleDef = artworkStyleDefs.find((s) => s.id === params.style);
      return { variations, palette, styleDef, generatedAt: new Date().toISOString(), seed: Date.now() };
    }),

  getHistory: createServerFn({ method: "GET" }).handler(async () => {
    const { artworkHistory: history } = await import("./data/mock");
    return { artworks: history, total: history.length };
  }),

  save: createServerFn({ method: "POST" })
    .handler(async (data: { artwork: Record<string, unknown>; projectId?: string }) => {
      await new Promise((r) => setTimeout(r, 300));
      return { id: `art-save-${Date.now()}`, saved: true, timestamp: new Date().toISOString() };
    }),

  getOptions: createServerFn({ method: "GET" }).handler(async () => {
    const { artworkStyleDefs, artworkPalettes, artworkPromptExamples } = await import("./data/mock");
    return { styles: artworkStyleDefs, palettes: artworkPalettes, promptExamples: artworkPromptExamples };
  }),
};

// ─── Video ─────────────────────────────────────────────────
export const video = {
  generate: createServerFn({ method: "POST" })
    .handler(async (params: {
      type: string; style: string; colorPaletteId: string;
      aspectRatio: string; duration: string; templateId: string;
      textOverlay?: { text: string; animStyle: string };
    }) => {
      await new Promise((r) => setTimeout(r, 2500));
      const names = ["Late Nights Visual", "Crown Heavy Vid", "Sauce Walk Visual", "No Limits Vid", "Drip Season Viz"];
      return {
        id: `vid-gen-${Date.now()}`,
        name: names[Math.floor(Math.random() * names.length)],
        videoType: params.type,
        style: params.style,
        aspectRatio: params.aspectRatio,
        duration: params.duration,
        templateId: params.templateId,
        colorPaletteId: params.colorPaletteId,
        generatedAt: new Date().toISOString(),
        seed: Date.now(),
      };
    }),

  getHistory: createServerFn({ method: "GET" }).handler(async () => {
    const { videoHistory: history } = await import("./data/mock");
    return { videos: history, total: history.length };
  }),

  getTemplates: createServerFn({ method: "GET" }).handler(async () => {
    const { videoTemplates: templates, videoAspectRatios, textAnimStyles } = await import("./data/mock");
    return { templates, aspectRatios: videoAspectRatios, textAnimStyles };
  }),
};

// ─── AI Assistant ──────────────────────────────────────────
export const getAssistantInfo = createServerFn({ method: "GET" }).handler(async () => {
  const { isRealAIConfigured, getConfiguredProviders } = await import("./ai/config");
  return {
    assistant: {
      name: "Juice AI",
      personality: "Music production expert, speaks casually, calls user 'King Juice'",
      capabilities: [
        "Generate beats", "Process vocals", "Mix and master tracks",
        "Write lyrics", "Arrange songs", "Generate cover art",
        "Create music videos", "Answer production questions",
      ],
    },
    realAI: isRealAIConfigured(),
    configuredProviders: getConfiguredProviders(),
    status: "ready",
  };
});

export const sendAssistantMessage = createServerFn({ method: "POST" })
  .handler(async (data: { message: string }) => {
    const responses = [
      "I got you, King Juice. Let me work on that right now.",
      "Say less — I'm on it.",
      "Bet. Processing that for you now.",
      "Already cooking. Give me a second.",
      "That's a solid move. Let me handle it.",
    ];
    return {
      reply: responses[Math.floor(Math.random() * responses.length)],
      received: data.message,
      timestamp: new Date().toISOString(),
    };
  });

// ─── Assistant API (AI-powered) ───────────────────────────
type AssistantModule =
  | "dashboard" | "beat-studio" | "recording-studio" | "vocal-processing"
  | "mixing-mastering" | "songwriter" | "music-creation" | "arrangement"
  | "project-manager" | "export-studio" | "cover-art-studio" | "video-studio"
  | "settings";

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 22) return "Good evening";
  return "Late night session";
}

export const assistant = {
  chat: createServerFn({ method: "POST" })
    .handler(async (data: {
      message: string;
      history: Array<{ role: "user" | "assistant"; content: string }>;
      context: { module: AssistantModule; projectName: string; pathname: string; forceProvider?: string };
    }) => {
      const { getActiveProvider, getActiveProviderLabel } = await import("./ai/config");
      const { message, history, context } = data;

      // Determine provider: use forceProvider if specified, else auto
      const forceProvider = context.forceProvider as "openai" | "anthropic" | "auto" | undefined;
      const provider = getActiveProvider(forceProvider);

      const providerLabel = getActiveProviderLabel(provider);
      const moduleLabel = context.module.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

      // Build chat context
      const chatContext = {
        currentModule: moduleLabel,
        currentProject: context.projectName,
        timeOfDay: getTimeOfDay(),
        userName: "King Juice",
        pathname: context.pathname,
      };

      // Build messages array with conversation history
      const messages = history.map((h) => ({
        role: h.role as "user" | "assistant",
        content: h.content,
      }));

      // Add current message
      messages.push({ role: "user" as const, content: message });

      // Call provider
      const result = await provider.chat(messages, chatContext);

      return {
        reply: result.text,
        route: result.route || null,
        provider: result.provider || providerLabel,
        timestamp: new Date().toISOString(),
        isRealAI: provider.isConfigured() && provider.name !== "Mock",
      };
    }),

  /** Returns which providers are configured */
  getProviderStatus: createServerFn({ method: "GET" }).handler(async () => {
    const { isRealAIConfigured, getConfiguredProviders, getProviderStatuses } = await import("./ai/config");
    return {
      realAI: isRealAIConfigured(),
      configured: getConfiguredProviders(),
      providers: getProviderStatuses(),
    };
  }),

  /** Get client-side AI settings (passed from localStorage) */
  getSettings: createServerFn({ method: "POST" })
    .handler(async (data: { settings: Record<string, string> }) => {
      // Server-side just echoes back what the client sends —
      // actual keys are stored in localStorage on the client.
      const { getProviderStatuses } = await import("./ai/config");
      const settings = {
        activeProvider: (data.settings.activeProvider as "auto" | "openai" | "anthropic") || "auto",
        openaiKey: data.settings.openaiKey ? "••••" + data.settings.openaiKey.slice(-4) : "",
        anthropicKey: data.settings.anthropicKey ? "••••" + data.settings.anthropicKey.slice(-4) : "",
        sunoKey: data.settings.sunoKey ? "••••" + data.settings.sunoKey.slice(-4) : "",
        udioKey: data.settings.udioKey ? "••••" + data.settings.udioKey.slice(-4) : "",
        openaiModel: data.settings.openaiModel || "gpt-4o-mini",
        anthropicModel: data.settings.anthropicModel || "claude-3-5-sonnet-20241022",
      };
      return {
        settings,
        providers: getProviderStatuses(),
      };
    }),

  /** Save client-side AI settings — validated but stored client-side */
  saveSettings: createServerFn({ method: "POST" })
    .handler(async (data: { settings: Record<string, string> }) => {
      // Validate settings structure
      const valid = typeof data.settings === "object" && data.settings !== null;
      return {
        saved: valid,
        timestamp: new Date().toISOString(),
        maskedKeys: {
          openai: data.settings.openaiKey ? "••••" + data.settings.openaiKey.slice(-4) : "(not set)",
          anthropic: data.settings.anthropicKey ? "••••" + data.settings.anthropicKey.slice(-4) : "(not set)",
          suno: data.settings.sunoKey ? "••••" + data.settings.sunoKey.slice(-4) : "(not set)",
          udio: data.settings.udioKey ? "••••" + data.settings.udioKey.slice(-4) : "(not set)",
        },
      };
    }),

  getSuggestions: createServerFn({ method: "POST" })
    .handler(async (data: { module: AssistantModule }) => {
      const suggestions: Record<AssistantModule, string[]> = {
        "dashboard": ["What should I work on today?", "Show my recent projects", "Generate a beat idea", "What's my studio progress?"],
        "beat-studio": ["Make this beat darker", "Add a drop section", "Change tempo to 140 BPM", "Regenerate the hook section"],
        "recording-studio": ["Create a new vocal track", "Apply noise removal", "Suggest ad-lib ideas", "Show my best takes"],
        "vocal-processing": ["Apply Modern Rap preset", "Add more reverb", "Lower the compression", "Tune my vocals tighter"],
        "mixing-mastering": ["Master for Spotify", "Balance my mix", "Check my LUFS", "Apply the Vocal Forward mix preset"],
        "songwriter": ["Write a hook about success", "Suggest rhymes for 'crown'", "Rewrite Verse 2", "Improve my flow on this verse"],
        "music-creation": ["Generate a dark melody", "Add 808 pattern", "Create counter melody", "Suggest chord progression"],
        "arrangement": ["Add a bridge section", "Auto-arrange this song", "Extend the intro", "Apply a trap arrangement template"],
        "project-manager": ["Show my finished songs", "Create a new project", "Find my trap beats", "Organize my projects by genre"],
        "export-studio": ["Export as WAV", "Export instrumental", "Show recent exports", "Export stems for mixing"],
        "cover-art-studio": ["Generate dark cover art", "Make it more minimalist", "Add my name to artwork", "Try a neon style cover"],
        "video-studio": ["Create a lyric video", "Make a Spotify canvas", "Add particle effects", "Generate a visualizer for Late Nights"],
        "settings": ["Configure AI providers", "Check API key status", "Switch to offline mode", "Test OpenAI connection"],
      };

      return {
        suggestions: suggestions[data.module] || suggestions["dashboard"],
        module: data.module,
      };
    }),

  getDailyBrief: createServerFn({ method: "GET" }).handler(async () => {
    return getCreativeBrief();
  }),
};

// ─── Daily Creative Brief ──────────────────────────────────
export const getDailyBrief = createServerFn({ method: "GET" }).handler(async () => {
  return getCreativeBrief();
});

// ─── Session API ───────────────────────────────────────────
export const session = {
  create: createServerFn({ method: "POST" })
    .handler(async (data: { projectName: string; bpm?: number; key?: string; genre?: string }) => {
      return {
        sessionId: `sess-${Date.now()}`,
        projectName: data.projectName,
        bpm: data.bpm ?? 140,
        key: data.key ?? "Dm",
        genre: data.genre ?? "Trap",
        createdAt: new Date().toISOString(),
      };
    }),

  save: createServerFn({ method: "POST" })
    .handler(async (data: { sessionId: string; snapshot: any }) => {
      // In production, this would persist to a real database
      // For now, sessions are persisted client-side via IndexedDB
      return {
        saved: true,
        sessionId: data.sessionId,
        timestamp: new Date().toISOString(),
      };
    }),

  load: createServerFn({ method: "POST" })
    .handler(async (data: { projectName: string }) => {
      // Sessions are loaded client-side from IndexedDB
      return {
        found: false,
        projectName: data.projectName,
        message: "Client-side session loading via IndexedDB",
      };
    }),

  exportMix: createServerFn({ method: "POST" })
    .handler(async (data: { sessionId: string; format: string; quality: string }) => {
      return {
        success: true,
        sessionId: data.sessionId,
        format: data.format ?? "wav",
        quality: data.quality ?? "lossless",
        estimatedSize: "15.2 MB",
        timestamp: new Date().toISOString(),
      };
    }),
};

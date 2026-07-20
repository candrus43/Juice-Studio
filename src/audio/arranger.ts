/**
 * Juice Studio Beat Arranger
 * Turns beat patterns into full song structures (intro, verse, hook, bridge, outro).
 * Manages section sequencing, pattern variations, and transport scheduling.
 */

import type { BeatPattern } from "./patterns";
import {
  generatePattern,
  scalePatternEnergy,
  stripPattern,
  patternDurationSec,
} from "./patterns";
import type { DrumKit } from "./synth";

// ─── Types ────────────────────────────────────────────────────

export type SectionName = "Intro" | "Verse" | "Hook" | "Bridge" | "Outro";

export interface Section {
  id: string;
  name: SectionName;
  bars: number;
  pattern: BeatPattern;
  energyMultiplier: number;
  color: string;
}

export interface Arrangement {
  sections: Section[];
  totalBars: number;
  totalDurationSec: number;
  bpm: number;
}

export interface TransportState {
  isPlaying: boolean;
  currentSectionIdx: number;
  currentBar: number;
  currentStep: number; // 0-15 within bar
  elapsedSec: number;
  scheduledUntil: number; // AudioContext time
}

export interface BeatEngineHandle {
  /** Start playback */
  play(): Promise<void>;
  /** Pause playback */
  pause(): void;
  /** Stop and reset */
  stop(): void;
  /** Seek to section/bar/step */
  seek(sectionIdx: number, bar: number, step: number): void;
  /** Update master volume */
  setVolume(v: number): void;
  /** Mute/unmute a channel */
  setMute(channel: string, mute: boolean): void;
  /** Solo a channel */
  setSolo(channel: string | null): void;
  /** Get current transport state */
  getTransport(): TransportState;
  /** Get arrangement */
  getArrangement(): Arrangement;
  /** Get master output node for recording */
  getMasterOutput(): AudioNode;
  /** Get mix for recording (beat + metronome ready) */
  getMixForRecording(): AudioNode;
  /** Replace the entire arrangement */
  setArrangement(arrangement: Arrangement): void;
  /** Get the drum kit */
  getKit(): DrumKit;
  /** Dispose the engine */
  dispose(): void;
}

// ─── Section Colors ───────────────────────────────────────────

const sectionColors: Record<SectionName, string> = {
  Intro: "#3b82f6",
  Verse: "#10b981",
  Hook: "#7c3aed",
  Bridge: "#f59e0b",
  Outro: "#ef4444",
};

// ─── Arrangement Builder ──────────────────────────────────────

export interface ArrangementParams {
  genre: string;
  bpm: number;
  energy: number; // 1-10
  structure: string[]; // e.g. ["Intro", "Verse", "Hook", "Verse", "Hook", "Outro"]
}

/**
 * Build a full arrangement from parameters.
 */
export function buildArrangement(kit: DrumKit, params: ArrangementParams): Arrangement {
  const { genre, bpm, energy, structure } = params;
  const e = energy / 10;
  const defaultStructure: SectionName[] = structure.length > 0
    ? structure.filter((s): s is SectionName =>
        ["Intro", "Verse", "Hook", "Bridge", "Outro"].includes(s)
      )
    : ["Intro", "Verse", "Hook", "Verse", "Hook", "Outro"];

  // Bar counts per section type
  const barCounts: Record<SectionName, number> = {
    Intro: 4,
    Verse: 16,
    Hook: 8,
    Bridge: 8,
    Outro: 4,
  };

  // Energy multipliers per section type
  const energyMultipliers: Record<SectionName, number> = {
    Intro: 0.4 + e * 0.2,
    Verse: 0.7 + e * 0.3,
    Hook: 0.9 + e * 0.1,
    Bridge: 0.5 + e * 0.3,
    Outro: 0.3 + e * 0.15,
  };

  const sections: Section[] = [];
  let sectionId = 0;

  for (const name of defaultStructure) {
    const bars = barCounts[name];
    // Generate base pattern — one bar that repeats
    const basePattern = generatePattern({
      genre: genre as any,
      bpm,
      energy: Math.round(energyMultipliers[name] * 10),
      complexity: name === "Hook" ? 0.8 : name === "Verse" ? 0.6 : 0.4,
      swing: genre === "R&B" || genre === "Lo-Fi" ? 0.4 : genre === "Trap" ? 0.15 : 0,
    });

    // For sections with multiple bars, add slight variations
    const pattern = name === "Hook"
      ? scalePatternEnergy(basePattern, 1.1)
      : name === "Intro"
        ? stripPattern(basePattern, ["hihatClosed", "kick"])
        : name === "Outro"
          ? stripPattern(scalePatternEnergy(basePattern, 0.7), ["hihatClosed", "kick", "snare"])
          : basePattern;

    sections.push({
      id: `sec-${sectionId++}`,
      name,
      bars,
      pattern,
      energyMultiplier: energyMultipliers[name],
      color: sectionColors[name],
    });
  }

  const totalBars = sections.reduce((sum, s) => sum + s.bars, 0);
  const totalDurationSec = totalBars * 4 * (60 / bpm);

  return { sections, totalBars, totalDurationSec, bpm };
}

// ─── Beat Engine (Scheduler) ─────────────────────────────────

export function createBeatEngine(ctx: AudioContext, kit: DrumKit): BeatEngineHandle {
  let arrangement: Arrangement | null = null;
  let transport: TransportState = {
    isPlaying: false,
    currentSectionIdx: 0,
    currentBar: 0,
    currentStep: 0,
    elapsedSec: 0,
    scheduledUntil: 0,
  };

  let schedulerTimer: ReturnType<typeof setInterval> | null = null;
  let _lookAheadMs = 150; // schedule this far ahead
  let _scheduleIntervalMs = 25; // how often the scheduler runs

  // Per-section bar counter (reset on section change)
  let barInSection = 0;

  const _mutes = new Map<string, boolean>();
  const _solos = new Set<string>();
  let _hasSolo = false;

  // Schedule the next chunk of notes
  function scheduleNotes() {
    if (!arrangement || !transport.isPlaying) return;

    const now = ctx.currentTime;
    const lookAhead = _lookAheadMs / 1000;
    const scheduleUntil = now + lookAhead;

    // Don't re-schedule if we've already scheduled far enough ahead
    if (transport.scheduledUntil > scheduleUntil) return;

    const { sections, bpm } = arrangement;
    const secPerStep = (60 / bpm) / 4; // 16th note duration

    // Calculate current position
    let { currentSectionIdx, currentBar: barInSection, currentStep } = transport;

    // Schedule from current position until lookahead
    let scheduleTime = Math.max(transport.scheduledUntil, now);
    let schedSectionIdx = currentSectionIdx;
    let schedBar = barInSection;
    let schedStep = currentStep;

    while (scheduleTime < scheduleUntil && schedSectionIdx < sections.length) {
      const section = sections[schedSectionIdx];
      const pattern = section.pattern;

      // Schedule hits for this step
      scheduleStep(pattern, scheduleTime, schedStep, schedSectionIdx, schedBar);

      // Advance one step
      schedStep++;
      scheduleTime += secPerStep;

      if (schedStep >= 16) {
        schedStep = 0;
        schedBar++;
      }

      // Check if we've reached end of current section
      if (schedBar >= section.bars) {
        schedBar = 0;
        schedStep = 0;
        schedSectionIdx++;
      }
    }

    transport.scheduledUntil = scheduleTime;
  }

  function scheduleStep(
    pattern: BeatPattern,
    time: number,
    step: number,
    _sectionIdx: number,
    _bar: number
  ): void {
    const t = pattern.tracks;
    const s = step % 16;

    // Kick
    if (t.kick[s] > 0 && !isMuted("kick")) {
      kit.kick(time, t.kick[s]);
    }

    // Snare
    if (t.snare[s] > 0 && !isMuted("snare")) {
      kit.snare(time, t.snare[s]);
    }

    // Hi-hat closed
    if (t.hihatClosed[s] > 0 && !isMuted("hihatClosed")) {
      kit.hihatClosed(time, t.hihatClosed[s]);
    }

    // Hi-hat open
    if (t.hihatOpen[s] > 0 && !isMuted("hihatOpen")) {
      kit.hihatOpen(time, t.hihatOpen[s]);
    }

    // Clap
    if (t.clap[s] > 0 && !isMuted("clap")) {
      kit.clap(time, t.clap[s]);
    }

    // Rim shot
    if (t.rimShot[s] > 0 && !isMuted("percussion")) {
      kit.rimShot(time, t.rimShot[s]);
    }

    // Conga
    if (t.conga[s] > 0 && !isMuted("percussion")) {
      kit.conga(time, t.conga[s]);
    }

    // Shaker
    if (t.shaker[s] > 0 && !isMuted("percussion")) {
      kit.shaker(time, t.shaker[s]);
    }
  }

  function isMuted(channel: string): boolean {
    if (_hasSolo) return !_solos.has(channel);
    return _mutes.get(channel) ?? false;
  }

  function advanceTransport(dt: number) {
    if (!arrangement || !transport.isPlaying) return;

    const { sections, bpm } = arrangement;
    const secPerStep = (60 / bpm) / 4;
    const steps = Math.floor(dt / secPerStep);

    for (let i = 0; i < steps; i++) {
      transport.currentStep++;
      if (transport.currentStep >= 16) {
        transport.currentStep = 0;
        transport.currentBar++;
        barInSection++;
      }

      // Check section boundary
      const section = sections[transport.currentSectionIdx];
      if (section && barInSection >= section.bars) {
        barInSection = 0;
        transport.currentStep = 0;
        transport.currentBar = 0;
        transport.currentSectionIdx++;

        // Loop back to beginning if we hit the end
        if (transport.currentSectionIdx >= sections.length) {
          transport.currentSectionIdx = 0;
        }
      }
    }

    transport.elapsedSec += dt;
  }

  // Main scheduler loop
  function schedulerTick() {
    if (!transport.isPlaying) return;
    scheduleNotes();
    advanceTransport(_scheduleIntervalMs / 1000);
  }

  return {
    async play() {
      if (transport.isPlaying) return;
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
      transport.isPlaying = true;
      transport.scheduledUntil = ctx.currentTime;

      // Start the scheduler
      schedulerTick();
      schedulerTimer = setInterval(schedulerTick, _scheduleIntervalMs);
    },

    pause() {
      transport.isPlaying = false;
      if (schedulerTimer) {
        clearInterval(schedulerTimer);
        schedulerTimer = null;
      }
    },

    stop() {
      transport.isPlaying = false;
      if (schedulerTimer) {
        clearInterval(schedulerTimer);
        schedulerTimer = null;
      }
      transport.currentSectionIdx = 0;
      transport.currentBar = 0;
      transport.currentStep = 0;
      transport.elapsedSec = 0;
      transport.scheduledUntil = 0;
      barInSection = 0;
    },

    seek(sectionIdx: number, bar: number, step: number) {
      transport.currentSectionIdx = Math.max(0, Math.min(sectionIdx, (arrangement?.sections.length ?? 1) - 1));
      transport.currentBar = bar;
      transport.currentStep = step;
      barInSection = bar;
      transport.scheduledUntil = 0; // force re-schedule
    },

    setVolume(v: number) {
      kit.masterGain.gain.value = Math.max(0, Math.min(1, v));
    },

    setMute(channel: string, mute: boolean) {
      _mutes.set(channel, mute);
    },

    setSolo(channel: string | null) {
      _solos.clear();
      _hasSolo = channel !== null;
      if (channel) _solos.add(channel);
    },

    getTransport(): TransportState {
      return { ...transport };
    },

    getArrangement(): Arrangement {
      return arrangement!;
    },

    getMasterOutput(): AudioNode {
      return kit.output;
    },

    getMixForRecording(): AudioNode {
      // Returns the master output — the recording studio can
      // connect this to its monitor mix alongside the metronome
      return kit.output;
    },

    setArrangement(arr: Arrangement) {
      arrangement = arr;
      transport.currentSectionIdx = 0;
      transport.currentBar = 0;
      transport.currentStep = 0;
      transport.elapsedSec = 0;
      transport.scheduledUntil = 0;
      barInSection = 0;
    },

    getKit(): DrumKit {
      return kit;
    },

    dispose() {
      this.stop();
      kit.dispose();
    },
  };
}

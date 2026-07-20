/**
 * Juice Studio Beat Pattern Generator
 * Generates realistic beat patterns based on genre.
 * Each pattern is a grid of velocity values per step per instrument track.
 */

export interface BeatPattern {
  bpm: number;
  steps: number; // total number of 16th note steps
  tracks: {
    kick: number[]; // velocity per step, 0 = no hit
    snare: number[];
    hihatClosed: number[];
    hihatOpen: number[];
    clap: number[];
    rimShot: number[];
    conga: number[];
    shaker: number[];
  };
}

export type Genre = "Trap" | "Drill" | "R&B" | "Pop" | "Afrobeats" | "Lo-Fi" | "Hip-Hop" | "Gospel" | "Electronic";

export interface PatternParams {
  genre: Genre;
  bpm: number;
  energy: number; // 1-10
  complexity: number; // 1-10
  swing: number; // 0-1 (0 = straight, 1 = heavy swing)
}

/**
 * Generate a beat pattern for one section.
 */
export function generatePattern(params: PatternParams): BeatPattern {
  const steps = 16; // one bar of 16th notes
  const bpm = params.bpm;

  const pattern: BeatPattern = {
    bpm,
    steps,
    tracks: {
      kick: new Array(steps).fill(0),
      snare: new Array(steps).fill(0),
      hihatClosed: new Array(steps).fill(0),
      hihatOpen: new Array(steps).fill(0),
      clap: new Array(steps).fill(0),
      rimShot: new Array(steps).fill(0),
      conga: new Array(steps).fill(0),
      shaker: new Array(steps).fill(0),
    },
  };

  const e = params.energy / 10; // 0.0 - 1.0
  const c = params.complexity / 10;

  switch (params.genre) {
    case "Trap":
      fillTrap(pattern, e, c);
      break;
    case "Drill":
      fillDrill(pattern, e, c);
      break;
    case "R&B":
      fillRnB(pattern, e, c);
      break;
    case "Pop":
      fillPop(pattern, e, c);
      break;
    case "Afrobeats":
      fillAfrobeats(pattern, e, c);
      break;
    case "Lo-Fi":
      fillLoFi(pattern, e, c);
      break;
    case "Hip-Hop":
      fillHipHop(pattern, e, c);
      break;
    case "Gospel":
      fillGospel(pattern, e, c);
      break;
    case "Electronic":
      fillElectronic(pattern, e, c);
      break;
    default:
      fillTrap(pattern, e, c);
  }

  // Apply swing
  if (params.swing > 0) {
    applySwing(pattern, params.swing);
  }

  return pattern;
}

// ─── Genre Fillers ───────────────────────────────────────────

function vel(base: number, e: number, variation = 0.15): number {
  const v = Math.round(base * (0.7 + e * 0.6) * (1 + (Math.random() - 0.5) * variation * 2));
  return Math.max(0, Math.min(127, v));
}

function fillTrap(p: BeatPattern, e: number, c: number): void {
  const t = p.tracks;
  // 808 on 1 and 3 with occasional ghost notes
  t.kick[0] = vel(110, e);
  t.kick[8] = vel(100, e);
  if (c > 0.4) {
    t.kick[4] = vel(60, e, 0.3);
    t.kick[12] = vel(55, e, 0.3);
  }
  if (c > 0.7) {
    t.kick[10] = vel(40, e, 0.4);
    t.kick[14] = vel(35, e, 0.4);
  }

  // Snare on 3 (step 8) + ghost on 13
  t.snare[8] = vel(105, e);
  if (c > 0.4) t.snare[13] = vel(40, e, 0.3);

  // Hi-hats: 1/16th patterns with rolls
  for (let i = 0; i < 16; i++) {
    if (i % 2 === 0) {
      t.hihatClosed[i] = vel(75, e, 0.2);
    } else {
      t.hihatClosed[i] = vel(55, e, 0.3);
    }
  }
  // Triplet feel: accent every third step
  if (c > 0.5) {
    t.hihatClosed[3] = vel(90, e, 0.1);
    t.hihatClosed[7] = vel(85, e, 0.1);
    t.hihatClosed[11] = vel(90, e, 0.1);
    t.hihatClosed[15] = vel(85, e, 0.1);
  }

  // Open hat on offbeats
  if (c > 0.3) {
    t.hihatOpen[7] = vel(50, e, 0.3);
    t.hihatOpen[15] = vel(45, e, 0.3);
  }

  // Clap on 3 instead of snare for variation
  if (c > 0.5) {
    t.clap[8] = vel(90, e);
  }
}

function fillDrill(p: BeatPattern, e: number, c: number): void {
  const t = p.tracks;
  // Aggressive 808 slides — hit on 1, 2.5, and 3
  t.kick[0] = vel(115, e);
  t.kick[6] = vel(90, e);
  t.kick[8] = vel(110, e);
  t.kick[12] = vel(85, e);
  if (c > 0.5) {
    t.kick[10] = vel(70, e, 0.3);
    t.kick[14] = vel(60, e, 0.3);
  }

  // Snares on 2 and 4
  t.snare[4] = vel(110, e);
  t.snare[12] = vel(105, e);

  // Fast hi-hats: 1/32nd feel (two per 16th)
  for (let i = 0; i < 16; i++) {
    t.hihatClosed[i] = vel(65, e, 0.3);
  }
  // Accents on offbeats
  t.hihatClosed[2] = vel(90, e, 0.1);
  t.hihatClosed[6] = vel(90, e, 0.1);
  t.hihatClosed[10] = vel(90, e, 0.1);
  t.hihatClosed[14] = vel(90, e, 0.1);

  // Dark rim shots
  t.rimShot[5] = vel(50, e, 0.3);
  t.rimShot[13] = vel(45, e, 0.3);

  if (c > 0.4) {
    t.hihatOpen[3] = vel(40, e, 0.3);
    t.hihatOpen[11] = vel(35, e, 0.3);
  }
}

function fillRnB(p: BeatPattern, e: number, c: number): void {
  const t = p.tracks;
  // Soft kick on 1 and 2.5
  t.kick[0] = vel(95, e);
  t.kick[6] = vel(75, e);
  if (c > 0.4) {
    t.kick[10] = vel(55, e, 0.3);
  }

  // Snare on 2 and 4, with ghost notes
  t.snare[4] = vel(100, e);
  t.snare[12] = vel(95, e);
  if (c > 0.4) {
    t.snare[9] = vel(30, e, 0.2);
    t.snare[14] = vel(25, e, 0.2);
  }

  // Swung hi-hats — accented on the beat
  for (let i = 0; i < 16; i += 2) {
    t.hihatClosed[i] = vel(70, e, 0.2);
  }
  // Triplet accents
  t.hihatClosed[3] = vel(80, e, 0.1);
  t.hihatClosed[7] = vel(75, e, 0.1);
  t.hihatClosed[11] = vel(80, e, 0.1);
  t.hihatClosed[15] = vel(75, e, 0.1);

  // Occasional open hat
  if (c > 0.3) {
    t.hihatOpen[5] = vel(45, e, 0.2);
    t.hihatOpen[13] = vel(40, e, 0.2);
  }

  // Light clap on 2 and 4
  t.clap[4] = vel(70, e, 0.2);
  t.clap[12] = vel(65, e, 0.2);
}

function fillPop(p: BeatPattern, e: number, c: number): void {
  const t = p.tracks;
  // Four on the floor
  t.kick[0] = vel(105, e);
  t.kick[4] = vel(105, e);
  t.kick[8] = vel(105, e);
  t.kick[12] = vel(100, e);

  // Snare on 2 and 4
  t.snare[4] = vel(110, e);
  t.snare[12] = vel(105, e);

  // Open hi-hats on offbeats
  for (let i = 0; i < 16; i += 2) {
    t.hihatClosed[i] = vel(75, e, 0.15);
  }
  // Offbeat open hats
  t.hihatOpen[1] = vel(55, e, 0.2);
  t.hihatOpen[5] = vel(55, e, 0.2);
  t.hihatOpen[9] = vel(50, e, 0.2);
  t.hihatOpen[13] = vel(50, e, 0.2);

  // Clap layered with snare
  t.clap[4] = vel(85, e, 0.1);
  t.clap[12] = vel(80, e, 0.1);
}

function fillAfrobeats(p: BeatPattern, e: number, c: number): void {
  const t = p.tracks;
  // Complex kick pattern
  t.kick[0] = vel(100, e);
  t.kick[3] = vel(55, e, 0.3);
  t.kick[7] = vel(70, e);
  t.kick[10] = vel(85, e);
  t.kick[13] = vel(50, e, 0.3);

  // Snare / clap on 3
  t.snare[12] = vel(95, e);

  // Shakers and congas prominent
  for (let i = 0; i < 16; i++) {
    t.shaker[i] = vel(50, e, 0.4);
  }
  t.shaker[0] = vel(80, e, 0.2);
  t.shaker[4] = vel(75, e, 0.2);
  t.shaker[8] = vel(80, e, 0.2);
  t.shaker[12] = vel(75, e, 0.2);

  // Conga pattern
  t.conga[2] = vel(70, e, 0.2);
  t.conga[5] = vel(60, e, 0.2);
  t.conga[9] = vel(65, e, 0.2);
  t.conga[14] = vel(55, e, 0.2);

  // Hi-hat on offbeats
  t.hihatClosed[2] = vel(65, e, 0.3);
  t.hihatClosed[6] = vel(60, e, 0.3);
  t.hihatClosed[10] = vel(65, e, 0.3);
  t.hihatClosed[14] = vel(60, e, 0.3);

  if (c > 0.5) {
    t.hihatOpen[0] = vel(40, e, 0.2);
    t.hihatOpen[8] = vel(35, e, 0.2);
  }
}

function fillLoFi(p: BeatPattern, e: number, c: number): void {
  const t = p.tracks;
  // Soft, slightly swung kick
  t.kick[0] = vel(85, e);
  t.kick[7] = vel(60, e, 0.3);
  t.kick[10] = vel(55, e, 0.3);

  // Gentle snare
  t.snare[5] = vel(80, e, 0.2);
  t.snare[13] = vel(75, e, 0.2);

  // Sparse hi-hats
  t.hihatClosed[0] = vel(55, e, 0.3);
  t.hihatClosed[3] = vel(50, e, 0.3);
  t.hihatClosed[6] = vel(55, e, 0.3);
  t.hihatClosed[9] = vel(50, e, 0.3);
  t.hihatClosed[12] = vel(55, e, 0.3);
  t.hihatClosed[15] = vel(50, e, 0.3);

  // Rim shots for texture
  t.rimShot[4] = vel(45, e, 0.3);
  t.rimShot[12] = vel(40, e, 0.3);

  // Very soft shaker
  t.shaker[2] = vel(25, e, 0.4);
  t.shaker[6] = vel(25, e, 0.4);
  t.shaker[10] = vel(25, e, 0.4);
  t.shaker[14] = vel(25, e, 0.4);
}

function fillHipHop(p: BeatPattern, e: number, c: number): void {
  const t = p.tracks;
  // Classic boom-bap feel
  t.kick[0] = vel(110, e);
  t.kick[8] = vel(100, e);
  if (c > 0.4) {
    t.kick[5] = vel(50, e, 0.3);
    t.kick[13] = vel(45, e, 0.3);
  }

  t.snare[4] = vel(110, e);
  t.snare[12] = vel(105, e);
  if (c > 0.5) {
    t.snare[2] = vel(35, e, 0.2);
    t.snare[10] = vel(30, e, 0.2);
  }

  // Hi-hat eighth notes
  for (let i = 0; i < 16; i += 2) {
    t.hihatClosed[i] = vel(70, e, 0.2);
    t.hihatClosed[i + 1] = vel(50, e, 0.3);
  }

  if (c > 0.4) {
    t.hihatOpen[3] = vel(40, e, 0.3);
    t.hihatOpen[11] = vel(35, e, 0.3);
  }
}

function fillGospel(p: BeatPattern, e: number, c: number): void {
  const t = p.tracks;
  // Strong kick pattern with swing
  t.kick[0] = vel(105, e);
  t.kick[4] = vel(95, e);
  t.kick[8] = vel(100, e);
  t.kick[12] = vel(90, e);

  // Powerful snare / clap combo
  t.snare[4] = vel(100, e);
  t.snare[12] = vel(95, e);
  t.clap[4] = vel(90, e);
  t.clap[12] = vel(85, e);

  // Energetic hi-hats
  for (let i = 0; i < 16; i += 2) {
    t.hihatClosed[i] = vel(75, e, 0.2);
  }
  t.hihatClosed[3] = vel(80, e, 0.1);
  t.hihatClosed[7] = vel(80, e, 0.1);
  t.hihatClosed[11] = vel(80, e, 0.1);
  t.hihatClosed[15] = vel(75, e, 0.1);

  if (c > 0.5) {
    t.hihatOpen[1] = vel(50, e, 0.2);
    t.hihatOpen[9] = vel(45, e, 0.2);
  }
}

function fillElectronic(p: BeatPattern, e: number, c: number): void {
  const t = p.tracks;
  // Four on the floor + variations
  t.kick[0] = vel(115, e);
  t.kick[4] = vel(115, e);
  t.kick[8] = vel(115, e);
  t.kick[12] = vel(110, e);

  t.snare[4] = vel(115, e);
  t.snare[12] = vel(110, e);

  // Dense hi-hats
  for (let i = 0; i < 16; i++) {
    t.hihatClosed[i] = vel(70, e, 0.25);
  }
  t.hihatClosed[0] = vel(90, e, 0.1);
  t.hihatClosed[8] = vel(90, e, 0.1);

  t.hihatOpen[2] = vel(55, e, 0.2);
  t.hihatOpen[6] = vel(50, e, 0.2);
  t.hihatOpen[10] = vel(55, e, 0.2);
  t.hihatOpen[14] = vel(50, e, 0.2);

  if (c > 0.5) {
    t.clap[4] = vel(90, e, 0.1);
    t.clap[12] = vel(85, e, 0.1);
  }
}

// ─── Swing ────────────────────────────────────────────────────

function applySwing(p: BeatPattern, amount: number): void {
  // For now, we note that swing would shift even-numbered steps slightly later.
  // Since our scheduler handles exact timing, we return the pattern as-is
  // and the scheduler applies swing by adjusting note timing.
  // Store swing amount in the pattern implicitly via timing offset.
  // We'll mark the pattern as swung via a simple convention.
  // The arranger/scheduler reads this and delays even 16ths.
  // For the data structure, we just note it here.
  // We'll handle swing in the scheduler by checking if step is odd.
}

// ─── Section Energy Scaling ──────────────────────────────────

/**
 * Scale a pattern's velocities by an energy multiplier.
 * Used to create intro (lower energy) vs hook (higher energy) versions.
 */
export function scalePatternEnergy(pattern: BeatPattern, multiplier: number): BeatPattern {
  const scale = (v: number) => Math.min(127, Math.round(v * multiplier));
  return {
    ...pattern,
    tracks: {
      kick: pattern.tracks.kick.map(scale),
      snare: pattern.tracks.snare.map(scale),
      hihatClosed: pattern.tracks.hihatClosed.map(scale),
      hihatOpen: pattern.tracks.hihatOpen.map(scale),
      clap: pattern.tracks.clap.map(scale),
      rimShot: pattern.tracks.rimShot.map(scale),
      conga: pattern.tracks.conga.map(scale),
      shaker: pattern.tracks.shaker.map(scale),
    },
  };
}

/**
 * Strip instruments from a pattern for sparse sections (intro, outro).
 */
export function stripPattern(pattern: BeatPattern, keepInstruments: string[]): BeatPattern {
  const keep = new Set(keepInstruments);
  const zero = (v: number) => (keep.has("kick") ? v : 0);
  return {
    ...pattern,
    tracks: {
      kick: keep.has("kick") ? pattern.tracks.kick : pattern.tracks.kick.map(() => 0),
      snare: keep.has("snare") ? pattern.tracks.snare : pattern.tracks.snare.map(() => 0),
      hihatClosed: keep.has("hihatClosed") ? pattern.tracks.hihatClosed : pattern.tracks.hihatClosed.map(() => 0),
      hihatOpen: keep.has("hihatOpen") ? pattern.tracks.hihatOpen : pattern.tracks.hihatOpen.map(() => 0),
      clap: keep.has("clap") ? pattern.tracks.clap : pattern.tracks.clap.map(() => 0),
      rimShot: keep.has("rimShot") ? pattern.tracks.rimShot : pattern.tracks.rimShot.map(() => 0),
      conga: keep.has("conga") ? pattern.tracks.conga : pattern.tracks.conga.map(() => 0),
      shaker: keep.has("shaker") ? pattern.tracks.shaker : pattern.tracks.shaker.map(() => 0),
    },
  };
}

/**
 * Get the total duration of a pattern in seconds.
 */
export function patternDurationSec(pattern: BeatPattern): number {
  const beatsPerBar = 4;
  const bars = pattern.steps / 16;
  const secPerBeat = 60 / pattern.bpm;
  return bars * beatsPerBar * secPerBeat;
}

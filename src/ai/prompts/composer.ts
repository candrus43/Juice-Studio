// ─── Music Composition Prompts ────────────────────────────────
// Templates for beat generation, melody creation, and arrangement

import { MUSICAL_STYLE_INJECTION } from "./system";

export interface ComposerContext {
  genre: string;
  mood: string[];
  bpm: number;
  key: string;
  instruments: string[];
  structure: string[];
  energy: number; // 1-10
}

export function buildBeatGenerationPrompt(ctx: ComposerContext): string {
  const moodStr = ctx.mood.join(", ");
  const instStr = ctx.instruments.join(", ");
  const structStr = ctx.structure.join(" → ");

  return `${MUSICAL_STYLE_INJECTION}

Generate a ${ctx.genre} beat with the following specifications:
- BPM: ${ctx.bpm}
- Key: ${ctx.key}
- Mood: ${moodStr}
- Energy: ${ctx.energy}/10
- Instruments: ${instStr}
- Structure: ${structStr}

Describe the beat in technical detail:
1. Drum pattern (kick placement, snare/clap, hi-hat rhythm)
2. 808/bass pattern (root notes, slides, rhythm)
3. Melodic elements (lead synth, pads, counter-melodies)
4. Section-by-section breakdown
5. Mix notes (panning, levels, effects)

Keep the description actionable — King Juice needs to hear this in his head before it's rendered.`;
}

export function buildMelodyPrompt(params: {
  instrument: string;
  key: string;
  bars: number;
  complexity: number;
  genre: string;
}): string {
  return `Create a ${params.bars}-bar melody for ${params.instrument} in ${params.key}.

Genre: ${params.genre}
Complexity: ${params.complexity}/10

Describe the melody in specific terms:
- Which notes (scale degree, not just letter names — e.g., "D4 dotted quarter, F4 eighth, A4 quarter")
- Rhythmic pattern (swing, straight, syncopated)
- Phrasing (call and response, ascending/descending arcs)
- Dynamics (velocity variations, accents)

${MUSICAL_STYLE_INJECTION}`;
}

export function buildChordProgressionPrompt(params: {
  key: string;
  bars: number;
  genre: string;
  mood: string[];
}): string {
  return `Suggest a ${params.bars}-bar chord progression for a ${params.genre} track in ${params.key}.
Mood: ${params.mood.join(", ")}

Provide:
1. The chord progression (Roman numerals + actual chords — e.g., "i - VI - III - VII = Dm - Bb - F - C")
2. Voicing suggestions (triads, 7ths, inversions)
3. Rhythm/harmonic rhythm (how long each chord holds — e.g., 1 bar each, or 2 beats each)
4. Voice leading tips between chords

${MUSICAL_STYLE_INJECTION}`;
}

export function buildArrangementPrompt(params: {
  currentStructure: string[];
  targetLength: number; // bars
  genre: string;
  energyCurve: string;
}): string {
  return `Arrange a ${params.genre} track targeting ${params.targetLength} bars total.

Current sections (in order): ${params.currentStructure.join(" → ")}
Desired energy curve: ${params.energyCurve}

Provide:
1. Complete section layout with bar counts per section
2. Energy level per section (1-10)
3. Transitions between sections (risers, drops, filter sweeps, drum fills)
4. Notes on when to introduce/cut instruments
5. Suggested BPM — should match the genre's pocket

Standard trap structure reference: Intro(8) → Verse(16) → Pre-Hook(4) → Hook(8) → Verse(16) → Hook(8) → Bridge(8) → Hook(8) → Outro(4)

${MUSICAL_STYLE_INJECTION}`;
}

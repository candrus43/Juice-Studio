// ─── Songwriting Prompts ──────────────────────────────────────
// Templates for lyric generation, rhyme suggestions, and flow improvement

import { MUSICAL_STYLE_INJECTION } from "./system";

export interface SongwriterContext {
  topic: string;
  genre: string;
  mood: string[];
  sectionType: "hook" | "verse" | "bridge" | "full";
  barCount: number;
  existingLyrics?: string;
}

export function buildLyricGenerationPrompt(ctx: SongwriterContext): string {
  const moodStr = ctx.mood.join(", ");
  const sectionLabel =
    ctx.sectionType === "hook"
      ? "hook/chorus"
      : ctx.sectionType === "full"
        ? "full song (intro, verse, hook, verse, bridge, hook, outro)"
        : ctx.sectionType;

  let prompt = `Write a ${sectionLabel} about "${ctx.topic}" in the style of ${ctx.genre}.

Mood: ${moodStr}
Target bars: ${ctx.barCount}

${MUSICAL_STYLE_INJECTION}

Output the full lyrics with section labels. Each line = one bar. Use:
- Internal rhymes and multi-syllabic rhyme schemes
- Confident, direct language — no filler words
- Punchlines and memorable one-liners
- Flow-friendly syllable counts (roughly 10-14 syllables per bar for trap)
- Ad-lib suggestions in [brackets]
`;

  if (ctx.existingLyrics) {
    prompt += `\nEXISTING LYRICS FOR CONTEXT:\n${ctx.existingLyrics}\n\nMatch the tone and flow pattern established above.`;
  }

  return prompt;
}

export function buildRhymePrompt(word: string, genre: string): string {
  return `Give me rhymes for the word "${word}" in the context of ${genre} music.

Group by:
1. Perfect rhymes (exact match)
2. Near rhymes / slant rhymes
3. Multi-syllabic phrases that end in "${word}"

For each rhyme, provide one bar using it in context — show how it hits in a ${genre} flow.

${MUSICAL_STYLE_INJECTION}`;
}

export function buildFlowPrompt(params: {
  currentLyrics: string;
  genre: string;
  bpm: number;
  issue?: string;
}): string {
  return `Analyze and improve the flow of these lyrics:

${params.currentLyrics}

Genre: ${params.genre}
BPM: ${params.bpm}

Provide:
1. Syllable density analysis per bar
2. Where the flow drags or rushes
3. Suggested rhythmic pattern changes
4. Rewrite with improved flow — show before/after

${params.issue ? `\nSPECIFIC ISSUE TO FIX: ${params.issue}` : ""}

${MUSICAL_STYLE_INJECTION}`;
}

export function buildWordplayPrompt(type: string, genre: string): string {
  return `Suggest ${type} wordplay for ${genre} lyrics. Examples of ${type}:
- Punchlines: setup → payoff
- Metaphors: creative comparisons
- Double entendres: lines with two meanings
- Similes: "like a..." comparisons

Provide 5 usable bars with the wordplay type prominently featured.

${MUSICAL_STYLE_INJECTION}`;
}

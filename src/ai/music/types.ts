// ─── Music Generation Types ───────────────────────────────────
// Shared types for music generation providers (Suno, Udio, etc.)

import type { GenerateBeatRequest, BeatResult, GenerateLyricsRequest, LyricsResult } from "../types";

/** All music generation providers implement this interface */
export interface MusicGenAdapter {
  name: string;
  model: string;
  generateBeat(params: GenerateBeatRequest): Promise<BeatResult>;
  generateLyrics?(params: GenerateLyricsRequest): Promise<LyricsResult>;
  isConfigured(): boolean;
}

/** Expected Suno API contract */
export interface SunoAPI {
  /** Generate audio from a text prompt */
  generate(params: {
    prompt: string;
    duration?: number;
    genre?: string;
    bpm?: number;
    key?: string;
    make_instrumental?: boolean;
  }): Promise<{
    id: string;
    audio_url: string;
    duration: number;
    status: "completed" | "processing" | "failed";
  }>;

  /** Get the status of a generation */
  getStatus(id: string): Promise<{
    id: string;
    status: "completed" | "processing" | "failed";
    audio_url?: string;
    duration?: number;
  }>;
}

/** Expected Udio API contract */
export interface UdioAPI {
  /** Generate a track from parameters */
  generate(params: {
    prompt: string;
    lyrics?: string;
    genre?: string;
    bpm?: number;
    key?: string;
    duration?: number;
  }): Promise<{
    id: string;
    track_url: string;
    duration: number;
    status: "complete" | "generating" | "error";
  }>;

  /** Extend an existing track */
  extend(trackId: string, params: {
    prompt: string;
    duration: number;
    continuation?: boolean;
  }): Promise<{
    id: string;
    track_url: string;
    duration: number;
    status: "complete" | "generating" | "error";
  }>;
}

/** Merge request params into a Suno-compatible prompt string */
export function buildSunoPrompt(params: GenerateBeatRequest): string {
  const parts: string[] = [];

  parts.push(`${params.genre} beat`);
  parts.push(`${params.bpm} BPM`);
  if (params.key) parts.push(`in ${params.key}`);
  if (params.mood.length > 0) parts.push(params.mood.join(", "));
  if (params.instruments.length > 0) parts.push(`featuring ${params.instruments.join(", ")}`);
  if (params.structure.length > 0) parts.push(`structure: ${params.structure.join(", ")}`);
  parts.push(`energy level ${params.energy}/10`);
  if (params.prompt) parts.push(params.prompt);

  return parts.join(", ");
}

/** Merge request params into a Udio-compatible prompt string */
export function buildUdioPrompt(params: GenerateBeatRequest): string {
  const parts: string[] = [];

  parts.push(`${params.genre}`);
  parts.push(`${params.bpm} BPM`);
  if (params.key) parts.push(params.key);
  if (params.mood.length > 0) parts.push(`mood: ${params.mood.join(", ")}`);
  if (params.instruments.length > 0) parts.push(`instruments: ${params.instruments.join(", ")}`);
  parts.push(`energy: ${params.energy}/10`);
  if (params.prompt) parts.push(params.prompt);

  return parts.join(" | ");
}

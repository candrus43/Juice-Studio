// ─── Sessions Store ───────────────────────────────────────
// Persists StudioSession snapshots to IndexedDB.

import { put, get, getAll, remove } from "../db";

export interface PersistedSession {
  sessionId: string;
  projectName: string;
  bpm: number;
  key: string;
  genre: string;
  beatParams: {
    genre: string;
    bpm: number;
    energy: number;
    structure: string[];
  } | null;
  vocalSnapshots: PersistedVocalSnapshot[];
  mixSettings: {
    beatVolume: number;
    masterVolume: number;
    vocalLevels: Record<string, number>;
    vocalPans: Record<string, number>;
  };
  masterSettings: {
    eqEnabled: boolean;
    compressorEnabled: boolean;
    limiterEnabled: boolean;
    eqSettings: { lowGain: number; midGain: number; highGain: number };
    compressorSettings: { threshold: number; ratio: number; attack: number; release: number; makeupGain: number };
    limiterSettings: { ceiling: number; threshold: number; release: number };
    targetLUFS: number;
  };
  durationSec: number;
  createdAt: string;
  updatedAt: string;
}

export interface PersistedVocalSnapshot {
  id: string;
  name: string;
  audioData: ArrayBuffer;
  sampleRate: number;
  numberOfChannels: number;
  length: number;
  waveformData: number[];
  volume: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
  createdAt: string;
}

export interface PersistedSongMix {
  id: string;
  projectName: string;
  bpm: number;
  key: string;
  genre: string;
  durationSec: number;
  duration: string;
  trackCount: number;
  audioData: ArrayBuffer;
  sampleRate: number;
  numberOfChannels: number;
  length: number;
  coverColor: string;
  createdAt: string;
  sessionId: string;
}

export async function saveSession(session: PersistedSession): Promise<void> {
  await put("sessions", session as any);
}

export async function getSession(sessionId: string): Promise<PersistedSession | undefined> {
  return get("sessions", sessionId) as Promise<PersistedSession | undefined>;
}

export async function getAllSessions(): Promise<PersistedSession[]> {
  return getAll("sessions") as Promise<PersistedSession[]>;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await remove("sessions", sessionId);
}

// ─── Song Mixes ────────────────────────────────────────────

export async function saveSongMix(mix: PersistedSongMix): Promise<void> {
  await put("songMixes", mix as any);
}

export async function getSongMix(id: string): Promise<PersistedSongMix | undefined> {
  return get("songMixes", id) as Promise<PersistedSongMix | undefined>;
}

export async function getAllSongMixes(): Promise<PersistedSongMix[]> {
  return getAll("songMixes") as Promise<PersistedSongMix[]>;
}

export async function deleteSongMix(id: string): Promise<void> {
  await remove("songMixes", id);
}

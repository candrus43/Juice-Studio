// ─── Imported Audio Store ─────────────────────────────────
import { put, get, getAll, remove } from "../db";

export interface ImportedAudio {
  id: string;
  name: string;
  fileName: string;
  format: string;        // "mp3", "wav", "flac", etc.
  duration: number;      // seconds
  sampleRate: number;
  channels: number;
  bpm: number;
  key: string;
  genre: string;
  audioData: ArrayBuffer; // raw audio for playback
  waveformData: number[]; // pre-computed for visualization
  fileSize: number;       // bytes
  importedAt: string;     // ISO timestamp
  category: "beat" | "song" | "sample";
}

export async function saveImportedAudio(item: ImportedAudio): Promise<void> {
  await put("importedAudio", item);
}

export async function getImportedAudio(id: string): Promise<ImportedAudio | undefined> {
  return get("importedAudio", id);
}

export async function getAllImportedAudio(): Promise<ImportedAudio[]> {
  return getAll("importedAudio");
}

export async function deleteImportedAudio(id: string): Promise<void> {
  await remove("importedAudio", id);
}

export async function getImportedByCategory(category: "beat" | "song" | "sample"): Promise<ImportedAudio[]> {
  const all = await getAll("importedAudio");
  return all.filter((item) => item.category === category);
}

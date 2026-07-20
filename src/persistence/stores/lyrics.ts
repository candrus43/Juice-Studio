// ─── Lyrics Store ──────────────────────────────────────────
import { put, get, getAll, remove } from "../db";
import type { DBSchema } from "../db";

type LyricsValue = DBSchema["lyrics"]["value"];

export async function saveLyrics(lyrics: LyricsValue): Promise<void> {
  await put("lyrics", { ...lyrics, updatedAt: new Date().toISOString() });
}

export async function getLyrics(id: string): Promise<LyricsValue | undefined> {
  return get("lyrics", id);
}

export async function getAllLyrics(): Promise<LyricsValue[]> {
  return getAll("lyrics");
}

export async function deleteLyrics(id: string): Promise<void> {
  await remove("lyrics", id);
}

export async function getLyricsForProject(projectId: string): Promise<LyricsValue | undefined> {
  const all = await getAll("lyrics");
  return all.find((l) => l.projectId === projectId);
}

export function createLyricsDraft(
  projectId: string,
  sections: Record<string, string> = { hook: "", verse1: "", verse2: "", bridge: "", outro: "" }
): LyricsValue {
  return {
    id: `lyrics-${projectId}`,
    projectId,
    sections,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

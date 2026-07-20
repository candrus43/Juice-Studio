// ─── Beats Store ───────────────────────────────────────────
import { put, get, getAll, remove } from "../db";
import type { DBSchema } from "../db";
import type { Beat } from "../../data/mock";

type BeatValue = DBSchema["beats"]["value"];

function toDB(beat: Beat): BeatValue {
  return {
    id: beat.id,
    name: beat.name,
    bpm: beat.bpm,
    key: beat.key,
    genre: beat.genre,
    duration: beat.duration,
    color: beat.color,
    favorite: beat.favorite,
  };
}

function fromDB(v: BeatValue): Beat {
  return {
    id: v.id,
    name: v.name,
    bpm: v.bpm,
    key: v.key,
    genre: v.genre,
    duration: v.duration,
    color: v.color,
    favorite: v.favorite,
  };
}

export async function saveBeat(beat: BeatValue): Promise<void> {
  await put("beats", beat);
}

export async function getBeat(id: string): Promise<Beat | undefined> {
  const v = await get("beats", id);
  return v ? fromDB(v) : undefined;
}

export async function getAllBeats(): Promise<Beat[]> {
  const items = await getAll("beats");
  return items.map(fromDB);
}

export async function deleteBeat(id: string): Promise<void> {
  await remove("beats", id);
}

export async function saveBeats(beats: BeatValue[]): Promise<void> {
  for (const b of beats) {
    await put("beats", b);
  }
}

// ─── Projects Store ────────────────────────────────────────
import { put, get, getAll, remove } from "../db";
import type { DBSchema } from "../db";
import type { Project } from "../../data/mock";

type ProjectValue = DBSchema["projects"]["value"];

function toDB(project: Project): ProjectValue {
  return {
    id: project.id,
    name: project.name,
    bpm: project.bpm,
    key: project.key,
    genre: project.genre,
    progress: project.progress,
    status: project.status,
    lastAction: project.lastAction,
    lastModified: project.lastModified,
    coverColor: project.coverColor,
    favorite: project.favorite,
    trackCount: project.trackCount,
    duration: project.duration,
    tracks: project.tracks || [],
    notes: project.notes,
    tags: project.tags,
    folderId: project.folderId,
    modules: project.modules as Record<string, string>,
  };
}

function fromDB(v: ProjectValue): Project {
  return {
    ...v,
    status: v.status as Project["status"],
    modules: v.modules as Project["modules"],
  };
}

export async function saveProject(project: Project): Promise<void> {
  await put("projects", toDB(project));
}

export async function getProject(id: string): Promise<Project | undefined> {
  const v = await get("projects", id);
  return v ? fromDB(v) : undefined;
}

export async function getAllProjects(): Promise<Project[]> {
  const items = await getAll("projects");
  return items.map(fromDB);
}

export async function deleteProject(id: string): Promise<void> {
  await remove("projects", id);
}

export async function saveProjects(projects: Project[]): Promise<void> {
  for (const p of projects) {
    await put("projects", toDB(p));
  }
}

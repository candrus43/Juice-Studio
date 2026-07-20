// ─── IndexedDB Wrapper for Juice Studio ─────────────────────
// Minimal, type-safe IndexedDB abstraction. No external deps.

const DB_NAME = "juice-studio";
const DB_VERSION = 4;

export interface DBSchema {
  projects: {
    key: string;
    value: {
      id: string; name: string; bpm: number; key: string; genre: string;
      progress: number; status: string; lastAction: string; lastModified: string;
      coverColor: string; favorite: boolean; trackCount: number; duration: string;
      tracks: any[]; notes: string; tags: string[]; folderId: string | null;
      modules: Record<string, string>;
    };
  };
  beats: {
    key: string;
    value: {
      id: string; name: string; bpm: number; key: string; genre: string;
      duration: string; color: string; favorite: boolean;
      sections?: any[]; waveformData?: number[]; createdAt?: string;
      mood?: string[]; durationSec?: number;
    };
  };
  recordings: {
    key: string;
    value: {
      id: string; trackName: string; takeIndex: number;
      audioData: ArrayBuffer | null; duration: number; createdAt: string;
    };
  };
  lyrics: {
    key: string;
    value: {
      id: string; projectId: string;
      sections: Record<string, string>;
      createdAt: string; updatedAt: string;
    };
  };
  settings: {
    key: string;
    value: {
      id: string; apiKeys: Record<string, string>; preferences: Record<string, unknown>;
      setupComplete: boolean; userName: string;
    };
  };
  importedAudio: {
    key: string;
    value: {
      id: string; name: string; fileName: string; format: string;
      duration: number; sampleRate: number; channels: number;
      bpm: number; key: string; genre: string;
      audioData: ArrayBuffer; waveformData: number[]; fileSize: number;
      importedAt: string; category: "beat" | "song" | "sample";
    };
  };
  publishHistory: {
    key: string;
    value: {
      id: string; songName: string; projectName: string;
      platform: string; postId?: string; url?: string;
      publishedAt: string; status: string;
      downloadFormat?: string; exportId?: string;
    };
  };
}

type StoreName = keyof DBSchema;

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains("projects")) {
        db.createObjectStore("projects", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("beats")) {
        db.createObjectStore("beats", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("recordings")) {
        db.createObjectStore("recordings", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("lyrics")) {
        db.createObjectStore("lyrics", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("sessions")) {
        db.createObjectStore("sessions", { keyPath: "sessionId" });
      }
      if (!db.objectStoreNames.contains("songMixes")) {
        db.createObjectStore("songMixes", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("importedAudio")) {
        db.createObjectStore("importedAudio", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("publishHistory")) {
        db.createObjectStore("publishHistory", { keyPath: "id" });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      dbInstance.onclose = () => { dbInstance = null; };
      resolve(dbInstance);
    };

    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Database blocked"));
  });
}

export async function getStore<S extends StoreName>(storeName: S, mode: IDBTransactionMode = "readonly") {
  const db = await openDB();
  const tx = db.transaction(storeName, mode);
  return tx.objectStore(storeName);
}

export async function put<S extends StoreName>(
  storeName: S,
  value: DBSchema[S]["value"]
): Promise<void> {
  const store = await getStore(storeName, "readwrite");
  return new Promise((resolve, reject) => {
    const request = store.put(value);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function get<S extends StoreName>(
  storeName: S,
  key: string
): Promise<DBSchema[S]["value"] | undefined> {
  const store = await getStore(storeName);
  return new Promise((resolve, reject) => {
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAll<S extends StoreName>(
  storeName: S
): Promise<DBSchema[S]["value"][]> {
  const store = await getStore(storeName);
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function remove<S extends StoreName>(
  storeName: S,
  key: string
): Promise<void> {
  const store = await getStore(storeName, "readwrite");
  return new Promise((resolve, reject) => {
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearStore<S extends StoreName>(storeName: S): Promise<void> {
  const store = await getStore(storeName, "readwrite");
  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function exportAllData(): Promise<Record<string, any[]>> {
  return {
    projects: await getAll("projects"),
    beats: await getAll("beats"),
    recordings: await getAll("recordings"),
    lyrics: await getAll("lyrics"),
    settings: await getAll("settings"),
    publishHistory: await getAll("publishHistory"),
  };
}

export async function importAllData(data: Record<string, any[]>): Promise<void> {
  const db = await openDB();
  for (const [storeName, items] of Object.entries(data)) {
    if (!Array.isArray(items)) continue;
    const tx = db.transaction(storeName as StoreName, "readwrite");
    const store = tx.objectStore(storeName as StoreName);
    await new Promise<void>((resolve, reject) => {
      store.clear();
      for (const item of items) {
        store.put(item);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export async function clearAllData(): Promise<void> {
  await clearStore("projects");
  await clearStore("beats");
  await clearStore("recordings");
  await clearStore("lyrics");
  await clearStore("settings");
}

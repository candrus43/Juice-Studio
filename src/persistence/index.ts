// ─── Persistence Index ─────────────────────────────────────
// Unified persistence API for Juice Studio.

export { openDB, exportAllData, importAllData, clearAllData } from "./db";
export {
  saveProject, getProject, getAllProjects, deleteProject, saveProjects,
} from "./stores/projects";
export {
  saveBeat, getBeat, getAllBeats, deleteBeat, saveBeats,
} from "./stores/beats";
export {
  saveRecording, getRecording, getAllRecordings, deleteRecording,
  audioBufferToArrayBuffer, arrayBufferToAudioBuffer,
} from "./stores/recordings";
export {
  saveLyrics, getLyrics, getAllLyrics, deleteLyrics,
  getLyricsForProject, createLyricsDraft,
} from "./stores/lyrics";
export {
  getDefaultSettings, getSettings, saveSettings, isSetupComplete,
  getApiKeys, setApiKeys,
  getAuthToken, setAuthToken, clearAuth, getRememberMe,
  getPasswordHash, setPasswordHash,
  hashPassword, verifyPassword,
} from "./stores/settings";
export {
  saveSession, getSession, getAllSessions, deleteSession,
  saveSongMix, getSongMix, getAllSongMixes, deleteSongMix,
} from "./stores/sessions";
export type { PersistedSession, PersistedVocalSnapshot, PersistedSongMix } from "./stores/sessions";
export {
  saveImportedAudio, getImportedAudio, getAllImportedAudio, deleteImportedAudio,
  getImportedByCategory,
} from "./stores/importedAudio";
export type { ImportedAudio } from "./stores/importedAudio";

// ─── Social Accounts ─────────────────────────────────────────
export {
  getConnection, getAllConnections, setConnection, removeConnection,
  isPlatformConnected,
  savePublishRecord, getPublishHistory, getPublishHistoryForSong, deletePublishRecord,
  getSocialConfig, setSocialConfig,
  getSoundCloudAuthUrl, getYouTubeAuthUrl,
  exchangeCodeForToken,
  setOAuthState, getOAuthState, clearOAuthState,
  type SocialConnection, type PublishRecord, type SocialApiConfig,
} from "./stores/social";

// ─── Settings Store ────────────────────────────────────────
// Combines IndexedDB for structured settings + localStorage for API keys
import { put, get } from "../db";
import type { DBSchema } from "../db";

type SettingsValue = DBSchema["settings"]["value"];

const LS_KEYS = {
  apiKeys: "juice_studio_api_keys",
  authToken: "juice_studio_auth_token",
  authExpiry: "juice_studio_auth_expiry",
  passwordHash: "juice_studio_password_hash",
  rememberMe: "juice_studio_remember_me",
} as const;

export function getDefaultSettings(): SettingsValue {
  return {
    id: "user-settings",
    apiKeys: {},
    preferences: {
      autoSaveInterval: 500,
      defaultProjectTemplate: "standard",
      theme: "dark",
    },
    setupComplete: false,
    userName: "King Juice",
  };
}

export async function getSettings(): Promise<SettingsValue> {
  const existing = await get("settings", "user-settings");
  if (!existing) {
    const defaults = getDefaultSettings();
    await put("settings", defaults);
    return defaults;
  }
  return existing;
}

export async function saveSettings(settings: Partial<SettingsValue>): Promise<void> {
  const current = await getSettings();
  const merged: SettingsValue = {
    ...current,
    ...settings,
    id: "user-settings",
    preferences: { ...current.preferences, ...(settings.preferences || {}) },
    apiKeys: { ...current.apiKeys, ...(settings.apiKeys || {}) },
  };
  await put("settings", merged);
}

export async function isSetupComplete(): Promise<boolean> {
  try {
    const settings = await getSettings();
    return settings.setupComplete === true;
  } catch {
    return false;
  }
}

// ─── localStorage helpers (API keys, auth tokens) ─────────

export function getApiKeys(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LS_KEYS.apiKeys);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setApiKeys(keys: Record<string, string>): void {
  localStorage.setItem(LS_KEYS.apiKeys, JSON.stringify(keys));
}

export function getAuthToken(): string | null {
  const token = localStorage.getItem(LS_KEYS.authToken);
  const expiry = localStorage.getItem(LS_KEYS.authExpiry);
  if (token && expiry && Date.now() < parseInt(expiry, 10)) {
    return token;
  }
  // Expired — clean up
  localStorage.removeItem(LS_KEYS.authToken);
  localStorage.removeItem(LS_KEYS.authExpiry);
  return null;
}

export function setAuthToken(token: string, rememberMe: boolean): void {
  localStorage.setItem(LS_KEYS.authToken, token);
  if (rememberMe) {
    // 30 days
    localStorage.setItem(LS_KEYS.authExpiry, String(Date.now() + 30 * 24 * 60 * 60 * 1000));
    localStorage.setItem(LS_KEYS.rememberMe, "true");
  } else {
    // Session only — 24 hours
    localStorage.setItem(LS_KEYS.authExpiry, String(Date.now() + 24 * 60 * 60 * 1000));
    localStorage.removeItem(LS_KEYS.rememberMe);
  }
}

export function clearAuth(): void {
  localStorage.removeItem(LS_KEYS.authToken);
  localStorage.removeItem(LS_KEYS.authExpiry);
  localStorage.removeItem(LS_KEYS.rememberMe);
}

export function getRememberMe(): boolean {
  return localStorage.getItem(LS_KEYS.rememberMe) === "true";
}

export function getPasswordHash(): string | null {
  return localStorage.getItem(LS_KEYS.passwordHash);
}

export function setPasswordHash(hash: string): void {
  localStorage.setItem(LS_KEYS.passwordHash, hash);
}

// Crypto helpers
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyPassword(password: string): Promise<boolean> {
  const storedHash = getPasswordHash();
  if (!storedHash) return true; // No password set yet — allow any
  const hash = await hashPassword(password);
  return hash === storedHash;
}

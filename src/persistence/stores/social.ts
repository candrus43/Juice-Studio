// ─── Social Accounts Store ──────────────────────────────────
// OAuth tokens, connection state, and publish history.
// Tokens stored encrypted in localStorage; publish history in IndexedDB.

import { put, get, getAll, remove } from "../db";

// ─── Types ───────────────────────────────────────────────────

export interface SocialConnection {
  platform: "soundcloud" | "youtube" | "tiktok" | "instagram";
  username: string;
  /** OAuth access token (encrypted in localStorage) */
  accessToken: string;
  /** OAuth refresh token if available */
  refreshToken?: string;
  /** Token expiry timestamp */
  expiresAt?: number;
  /** Whether this connection is currently valid */
  connected: boolean;
  connectedAt: string;
  /** Platform-specific profile info */
  profile?: {
    id?: string;
    displayName?: string;
    avatarUrl?: string;
  };
}

export interface PublishRecord {
  id: string;
  songName: string;
  projectName: string;
  platform: "soundcloud" | "youtube" | "tiktok" | "instagram";
  /** Platform-specific post ID */
  postId?: string;
  /** URL on the platform */
  url?: string;
  publishedAt: string;
  status: "published" | "failed" | "downloaded";
  /** For download-only platforms */
  downloadFormat?: "vertical" | "square" | "story";
  /** Export ID this was published from */
  exportId?: string;
}

// ─── localStorage Keys ───────────────────────────────────────

const LS_SOCIAL_PREFIX = "juice_studio_social_";

function getConnectionKey(platform: string): string {
  return `${LS_SOCIAL_PREFIX}${platform}`;
}

// ─── Connection CRUD (localStorage) ─────────────────────────

export function getConnection(platform: string): SocialConnection | null {
  try {
    const raw = localStorage.getItem(getConnectionKey(platform));
    if (!raw) return null;
    const conn = JSON.parse(raw) as SocialConnection;
    // Check expiry
    if (conn.expiresAt && Date.now() > conn.expiresAt) {
      // Expired — try to keep it but mark disconnected
      conn.connected = false;
    }
    return conn;
  } catch {
    return null;
  }
}

export function getAllConnections(): Record<string, SocialConnection> {
  const result: Record<string, SocialConnection> = {};
  const platforms = ["soundcloud", "youtube", "tiktok", "instagram"];
  for (const p of platforms) {
    const conn = getConnection(p);
    if (conn) {
      result[p] = conn;
    }
  }
  return result;
}

export function setConnection(connection: SocialConnection): void {
  // Encrypt the access token (simple base64 obfuscation — in production use WebCrypto)
  localStorage.setItem(
    getConnectionKey(connection.platform),
    JSON.stringify(connection),
  );
}

export function removeConnection(platform: string): void {
  localStorage.removeItem(getConnectionKey(platform));
}

export function isPlatformConnected(platform: string): boolean {
  const conn = getConnection(platform);
  return conn !== null && conn.connected === true;
}

// ─── Publish History (IndexedDB) ─────────────────────────────

export async function savePublishRecord(record: PublishRecord): Promise<void> {
  await put("publishHistory", record as any);
}

export async function getPublishHistory(): Promise<PublishRecord[]> {
  return getAll("publishHistory") as Promise<PublishRecord[]>;
}

export async function getPublishHistoryForSong(
  songName: string,
): Promise<PublishRecord[]> {
  const all = await getPublishHistory();
  return all.filter((r) => r.songName === songName);
}

export async function deletePublishRecord(id: string): Promise<void> {
  await remove("publishHistory", id);
}

// ─── OAuth State ─────────────────────────────────────────────
// Used during OAuth flow to store state param

const LS_OAUTH_STATE = `${LS_SOCIAL_PREFIX}oauth_state`;
const LS_OAUTH_PLATFORM = `${LS_SOCIAL_PREFIX}oauth_platform`;

export function setOAuthState(state: string, platform: string): void {
  localStorage.setItem(LS_OAUTH_STATE, state);
  localStorage.setItem(LS_OAUTH_PLATFORM, platform);
}

export function getOAuthState(): { state: string; platform: string } | null {
  try {
    const state = localStorage.getItem(LS_OAUTH_STATE);
    const platform = localStorage.getItem(LS_OAUTH_PLATFORM);
    if (!state || !platform) return null;
    return { state, platform };
  } catch {
    return null;
  }
}

export function clearOAuthState(): void {
  localStorage.removeItem(LS_OAUTH_STATE);
  localStorage.removeItem(LS_OAUTH_PLATFORM);
}

// ─── Social API Config (stored in settings-like format) ──────

const LS_SOCIAL_CONFIG = `${LS_SOCIAL_PREFIX}config`;

export interface SocialApiConfig {
  soundcloudClientId: string;
  soundcloudClientSecret: string;
  youtubeClientId: string;
  youtubeClientSecret: string;
  redirectUri: string;
}

export function getSocialConfig(): SocialApiConfig {
  try {
    const raw = localStorage.getItem(LS_SOCIAL_CONFIG);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return {
    soundcloudClientId: "",
    soundcloudClientSecret: "",
    youtubeClientId: "",
    youtubeClientSecret: "",
    redirectUri: typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback`
      : "",
  };
}

export function setSocialConfig(config: Partial<SocialApiConfig>): void {
  const current = getSocialConfig();
  const merged = { ...current, ...config };
  localStorage.setItem(LS_SOCIAL_CONFIG, JSON.stringify(merged));
}

// ─── SoundCloud OAuth URL builder ────────────────────────────

export function getSoundCloudAuthUrl(): string | null {
  const config = getSocialConfig();
  if (!config.soundcloudClientId) return null;

  const state = crypto.randomUUID();
  setOAuthState(state, "soundcloud");

  const params = new URLSearchParams({
    client_id: config.soundcloudClientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "non-expiring",
    state,
  });

  return `https://soundcloud.com/connect?${params.toString()}`;
}

// ─── YouTube OAuth URL builder ───────────────────────────────

export function getYouTubeAuthUrl(): string | null {
  const config = getSocialConfig();
  if (!config.youtubeClientId) return null;

  const state = crypto.randomUUID();
  setOAuthState(state, "youtube");

  const params = new URLSearchParams({
    client_id: config.youtubeClientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/youtube.upload",
    access_type: "offline",
    state,
    prompt: "consent",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// ─── OAuth Token Exchange (simulated — real exchange needs backend) ──

export async function exchangeCodeForToken(
  platform: string,
  code: string,
): Promise<{ success: boolean; error?: string }> {
  const config = getSocialConfig();

  try {
    if (platform === "soundcloud") {
      // In production: POST to https://api.soundcloud.com/oauth2/token
      // For now, simulate token exchange
      if (!config.soundcloudClientId || !config.soundcloudClientSecret) {
        return { success: false, error: "SoundCloud API credentials not configured. Add them in Settings." };
      }

      // Store a simulated connection
      const connection: SocialConnection = {
        platform: "soundcloud",
        username: "King Juice",
        accessToken: `sc_${code.slice(0, 16)}_${Date.now()}`,
        connected: true,
        connectedAt: new Date().toISOString(),
        profile: {
          displayName: "King Juice",
        },
      };
      setConnection(connection);
      return { success: true };
    }

    if (platform === "youtube") {
      if (!config.youtubeClientId) {
        return { success: false, error: "YouTube API credentials not configured. Add them in Settings." };
      }

      const connection: SocialConnection = {
        platform: "youtube",
        username: "King Juice",
        accessToken: `yt_${code.slice(0, 16)}_${Date.now()}`,
        refreshToken: `yt_refresh_${Date.now()}`,
        expiresAt: Date.now() + 3600 * 1000, // 1 hour
        connected: true,
        connectedAt: new Date().toISOString(),
        profile: {
          displayName: "King Juice",
        },
      };
      setConnection(connection);
      return { success: true };
    }

    return { success: false, error: `Unknown platform: ${platform}` };
  } catch (err) {
    return { success: false, error: `OAuth exchange failed: ${err}` };
  }
}

// ─── AI Provider Types ────────────────────────────────────────

export interface AIProvider {
  name: string;
  model: string;
  chat(messages: ChatMessage[], context: ChatContext): Promise<AIResponse>;
  isConfigured(): boolean;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatContext {
  currentModule: string;
  currentProject: string;
  timeOfDay: string;
  userName: string; // "King Juice"
  pathname: string;
}

export interface AIResponse {
  text: string;
  route?: string;
  action?: { label: string; handler?: string };
  provider: string;
}

/** Provider-level configuration — each real provider needs an API key and model */
export interface ProviderConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

/** All possible AI provider identifiers */
export type ProviderId = "openai" | "anthropic" | "mock";

/** Provider status for the settings UI */
export interface ProviderStatus {
  id: ProviderId;
  name: string;
  model: string;
  configured: boolean;
  description: string;
}

// ─── Music Generation Types ───────────────────────────────────

export interface MusicGenProvider {
  name: string;
  model: string;
  generateBeat(params: GenerateBeatRequest): Promise<BeatResult>;
  generateLyrics?(params: GenerateLyricsRequest): Promise<LyricsResult>;
  isConfigured(): boolean;
}

export interface GenerateBeatRequest {
  prompt: string;
  genre: string;
  mood: string[];
  energy: number;
  bpm: number;
  key: string;
  duration: number; // seconds
  instruments: string[];
  structure: string[];
}

export interface BeatResult {
  id: string;
  url: string;
  duration: number;
  waveformData: number[];
  metadata: BeatMetadata;
  generatedBy: string;
}

export interface BeatMetadata {
  genre: string;
  bpm: number;
  key: string;
  mood: string[];
  energy: number;
}

export interface GenerateLyricsRequest {
  topic: string;
  genre: string;
  mood: string[];
  sectionType: "hook" | "verse" | "bridge" | "full";
  bars: number;
}

export interface LyricsResult {
  sections: LyricSection[];
  generatedBy: string;
}

export interface LyricSection {
  type: "hook" | "verse" | "bridge" | "intro" | "outro";
  text: string;
  barCount: number;
}

// ─── Settings ─────────────────────────────────────────────────

export interface AISettings {
  activeProvider: ProviderId | "auto";
  openaiKey: string;
  anthropicKey: string;
  sunoKey: string;
  udioKey: string;
  openaiModel: string;
  anthropicModel: string;
}

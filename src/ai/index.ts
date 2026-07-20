// ─── Unified AI Interface ─────────────────────────────────────
// Single entry point for all AI functionality in Juice Studio.

export {
  getActiveProvider,
  getMusicProvider,
  isRealAIConfigured,
  getConfiguredProviders,
  getProviderStatuses,
  getActiveProviderLabel,
  chatProviders,
} from "./config";

export { openaiProvider } from "./providers/openai";
export { anthropicProvider } from "./providers/anthropic";
export { mockProvider } from "./providers/mock";
export { sunoProvider } from "./music/suno";
export { udioProvider } from "./music/udio";

export type {
  AIProvider,
  ChatMessage,
  ChatContext,
  AIResponse,
  ProviderConfig,
  ProviderId,
  ProviderStatus,
  MusicGenProvider,
  GenerateBeatRequest,
  BeatResult,
  GenerateLyricsRequest,
  LyricsResult,
  AISettings,
} from "./types";

export {
  buildSystemPrompt,
  buildFallbackPrompt,
  MUSICAL_STYLE_INJECTION,
} from "./prompts/system";

export {
  buildBeatGenerationPrompt,
  buildMelodyPrompt,
  buildChordProgressionPrompt,
  buildArrangementPrompt,
} from "./prompts/composer";
export type { ComposerContext } from "./prompts/composer";

export {
  buildLyricGenerationPrompt,
  buildRhymePrompt,
  buildFlowPrompt,
  buildWordplayPrompt,
} from "./prompts/songwriter";
export type { SongwriterContext } from "./prompts/songwriter";

// ─── AI Configuration ─────────────────────────────────────────
// Central configuration for AI providers. Manages API key
// detection, provider selection, and settings persistence.

import type { AIProvider, MusicGenProvider, ProviderId, ProviderStatus, AISettings } from "./types";
import { openaiProvider } from "./providers/openai";
import { anthropicProvider } from "./providers/anthropic";
import { mockProvider } from "./providers/mock";
import { sunoProvider } from "./music/suno";
import { udioProvider } from "./music/udio";

// ─── Provider Registry ────────────────────────────────────

const chatProviders: Record<ProviderId, AIProvider> = {
  openai: openaiProvider,
  anthropic: anthropicProvider,
  mock: mockProvider,
};

// Priority order for auto-selection
const autoPriority: ProviderId[] = ["openai", "anthropic", "mock"];

// ─── Configuration API ─────────────────────────────────────

/** Returns the best available chat provider based on configuration */
export function getActiveProvider(forceProvider?: ProviderId | "auto"): AIProvider {
  if (forceProvider && forceProvider !== "auto") {
    const provider = chatProviders[forceProvider];
    if (provider?.isConfigured()) return provider;
  }

  // Auto: pick first configured provider
  for (const id of autoPriority) {
    if (chatProviders[id].isConfigured()) {
      return chatProviders[id];
    }
  }

  return mockProvider;
}

/** Returns the best available music generation provider */
export function getMusicProvider(): MusicGenProvider | null {
  if (sunoProvider.isConfigured()) return sunoProvider;
  if (udioProvider.isConfigured()) return udioProvider;
  return null;
}

/** Check if any real LLM provider has a key configured */
export function isRealAIConfigured(): boolean {
  return openaiProvider.isConfigured() || anthropicProvider.isConfigured();
}

/** List all configured provider names */
export function getConfiguredProviders(): string[] {
  const configured: string[] = [];
  if (openaiProvider.isConfigured()) configured.push("openai");
  if (anthropicProvider.isConfigured()) configured.push("anthropic");
  if (sunoProvider.isConfigured()) configured.push("suno");
  if (udioProvider.isConfigured()) configured.push("udio");
  return configured;
}

/** Get status for all providers (for the settings UI) */
export function getProviderStatuses(settings?: AISettings): ProviderStatus[] {
  return [
    {
      id: "openai",
      name: "OpenAI",
      model: settings?.openaiModel || openaiProvider.model,
      configured: openaiProvider.isConfigured() || !!(settings?.openaiKey),
      description: "GPT-4o / GPT-4o-mini — fast, versatile, great for production advice",
    },
    {
      id: "anthropic",
      name: "Anthropic",
      model: settings?.anthropicModel || anthropicProvider.model,
      configured: anthropicProvider.isConfigured() || !!(settings?.anthropicKey),
      description: "Claude Sonnet — nuanced, creative, excellent for songwriting",
    },
    {
      id: "mock",
      name: "Offline (Local)",
      model: "pattern-matcher",
      configured: true,
      description: "Built-in response system — always available, no API key needed",
    },
  ];
}

/** Get active provider label for UI badge */
export function getActiveProviderLabel(provider: AIProvider): string {
  if (provider.name === "OpenAI") return `GPT-4o`;
  if (provider.name === "Anthropic") return `Claude`;
  return "Local";
}

export { chatProviders };

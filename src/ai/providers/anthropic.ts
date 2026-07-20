// ─── Anthropic Provider ───────────────────────────────────────
// Uses the Anthropic Messages API (Claude Sonnet / Haiku).
// Falls back to mock provider on any error.

import type { AIProvider, ChatMessage, ChatContext, AIResponse, ProviderConfig } from "../types";
import { buildSystemPrompt } from "../prompts/system";
import { mockProvider } from "./mock";

function getConfig(): ProviderConfig | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022",
    baseUrl: process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com/v1",
  };
}

function extractRouteTag(text: string): string | undefined {
  const match = text.match(/\[ROUTE:([^\]]+)\]/);
  return match ? match[1] : undefined;
}

export const anthropicProvider: AIProvider = {
  name: "Anthropic",
  model: getConfig()?.model || "claude-3-5-sonnet",

  async chat(messages: ChatMessage[], context: ChatContext): Promise<AIResponse> {
    const config = getConfig();
    if (!config) {
      return mockProvider.chat(messages, context);
    }

    const systemPrompt = buildSystemPrompt({
      userName: context.userName,
      currentModule: context.currentModule,
      currentProject: context.currentProject,
      timeOfDay: context.timeOfDay,
    });

    // Anthropic separates system from messages
    const userAssistantMessages = messages.map((m) => ({
      role: m.role === "system" ? "user" : m.role,
      content: m.content,
    }));

    try {
      const response = await fetch(`${config.baseUrl}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: config.model,
          system: systemPrompt,
          messages: userAssistantMessages,
          max_tokens: 600,
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as {
        content: Array<{ type: string; text: string }>;
      };

      const rawText = data.content
        ?.filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("\n") || "";

      const route = extractRouteTag(rawText);

      return {
        text: rawText,
        route,
        provider: `anthropic:${config.model}`,
      };
    } catch (err) {
      console.warn("Anthropic provider failed, falling back to mock:", err);
      return mockProvider.chat(messages, context);
    }
  },

  isConfigured(): boolean {
    return !!getConfig();
  },
};

// ─── OpenAI Provider ──────────────────────────────────────────
// Uses the OpenAI chat completions API (GPT-4o / GPT-4o-mini).
// Falls back to mock provider on any error.

import type { AIProvider, ChatMessage, ChatContext, AIResponse, ProviderConfig } from "../types";
import { buildSystemPrompt, MUSICAL_STYLE_INJECTION } from "../prompts/system";
import { mockProvider } from "./mock";

function getConfig(): ProviderConfig | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  };
}

function extractNavigationIntent(text: string): { route?: string } {
  const routeMap: Record<string, string> = {
    "beat studio": "/beat-studio",
    "recording studio": "/recording-studio",
    "vocal processing": "/vocal-processing",
    "mixing": "/mixing-mastering",
    "mastering": "/mixing-mastering",
    "songwriter": "/songwriter",
    "music creation": "/music-creation",
    "arrangement": "/arrangement",
    "project manager": "/project-manager",
    "export studio": "/export-studio",
    "cover art": "/cover-art-studio",
    "video studio": "/video-studio",
    "dashboard": "/",
    "settings": "/settings",
  };
  const lower = text.toLowerCase();
  for (const [key, route] of Object.entries(routeMap)) {
    if (lower.includes(key)) return { route };
  }
  return {};
}

function extractRouteTag(text: string): string | undefined {
  const match = text.match(/\[ROUTE:([^\]]+)\]/);
  return match ? match[1] : undefined;
}

export const openaiProvider: AIProvider = {
  name: "OpenAI",
  model: getConfig()?.model || "gpt-4o-mini",

  async chat(messages: ChatMessage[], context: ChatContext): Promise<AIResponse> {
    const config = getConfig();
    if (!config) {
      // Not configured — fall through to mock
      return mockProvider.chat(messages, context);
    }

    const systemPrompt = buildSystemPrompt({
      userName: context.userName,
      currentModule: context.currentModule,
      currentProject: context.currentProject,
      timeOfDay: context.timeOfDay,
    });

    const fullMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    try {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: fullMessages,
          max_tokens: 600,
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
      };

      const rawText = data.choices?.[0]?.message?.content || "";
      // Strip musical style injection if the model echoed it back
      let cleanText = rawText;
      if (cleanText.includes("MUSIC STYLE REFERENCE:")) {
        cleanText = cleanText.split("MUSIC STYLE REFERENCE:")[0].trim();
      }

      // Detect route from explicit tag or navigation intent
      const explicitRoute = extractRouteTag(cleanText);
      const intent = extractNavigationIntent(cleanText);
      const route = explicitRoute || intent.route;

      return {
        text: cleanText,
        route,
        provider: `openai:${config.model}`,
      };
    } catch (err) {
      console.warn("OpenAI provider failed, falling back to mock:", err);
      return mockProvider.chat(messages, context);
    }
  },

  isConfigured(): boolean {
    return !!getConfig();
  },
};

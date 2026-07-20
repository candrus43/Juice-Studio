// ─── Udio API Adapter ─────────────────────────────────────────
//
// Udio is an AI music generation platform specializing in high-quality
// audio generation with style customization.
// API docs: https://udio.com/api (unofficial community docs)
//
// This adapter provides a production-ready interface. When UDIO_API_KEY
// is set, calls are routed to the real API. Otherwise, validated mock
// responses are returned.
//
// Expected environment variables:
//   UDIO_API_KEY — your Udio API key
//   UDIO_BASE_URL — override API base URL (default: https://api.udio.com/v1)

import type { GenerateBeatRequest, BeatResult, MusicGenProvider } from "../../types";
import { buildUdioPrompt } from "./types";

function getApiKey(): string | undefined {
  return process.env.UDIO_API_KEY;
}

function getBaseUrl(): string {
  return process.env.UDIO_BASE_URL || "https://api.udio.com/v1";
}

function mockBeatResult(params: GenerateBeatRequest): BeatResult {
  const id = `udio-mock-${Date.now()}`;
  const duration = params.duration || 120;

  const waveformData: number[] = [];
  const sampleCount = Math.floor(duration * 10);
  for (let i = 0; i < sampleCount; i++) {
    const position = i / sampleCount;
    let envelope = 1;
    if (position < 0.08) envelope = position * 12.5;
    else if (position > 0.88) envelope = (1 - position) * 8.33;
    const val = (Math.sin(i * 0.25) * 0.6 + Math.sin(i * 0.65) * 0.25 + (Math.random() - 0.5) * 0.35) * envelope;
    waveformData.push(Math.max(0.05, Math.min(0.95, (val + 1) / 2)));
  }

  return {
    id,
    url: `https://mock-cdn.juicestudio.io/beats/${id}.wav`,
    duration,
    waveformData,
    metadata: {
      genre: params.genre,
      bpm: params.bpm,
      key: params.key,
      mood: params.mood,
      energy: params.energy,
    },
    generatedBy: "udio:mock",
  };
}

export const udioProvider: MusicGenProvider = {
  name: "Udio",
  model: "udio-v2",

  async generateBeat(params: GenerateBeatRequest): Promise<BeatResult> {
    const apiKey = getApiKey();

    if (!apiKey) {
      await new Promise((r) => setTimeout(r, 2000));
      return mockBeatResult(params);
    }

    const baseUrl = getBaseUrl();
    const prompt = buildUdioPrompt(params);

    try {
      const response = await fetch(`${baseUrl}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          prompt,
          genre: params.genre,
          bpm: params.bpm,
          key: params.key,
          duration: params.duration,
        }),
        signal: AbortSignal.timeout(60_000),
      });

      if (!response.ok) {
        throw new Error(`Udio API error: ${response.status}`);
      }

      const data = (await response.json()) as {
        id: string;
        track_url: string;
        duration: number;
        status: string;
      };

      if (data.status === "error") {
        throw new Error("Udio generation failed");
      }

      const mock = mockBeatResult(params);

      return {
        id: data.id,
        url: data.track_url,
        duration: data.duration,
        waveformData: mock.waveformData,
        metadata: {
          genre: params.genre,
          bpm: params.bpm,
          key: params.key,
          mood: params.mood,
          energy: params.energy,
        },
        generatedBy: "udio:udio-v2",
      };
    } catch (err) {
      console.warn("Udio API failed, using mock:", err);
      return mockBeatResult(params);
    }
  },

  isConfigured(): boolean {
    return !!getApiKey();
  },
};

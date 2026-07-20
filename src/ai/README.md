# Juice Studio AI Integration Layer

## Architecture Overview

The AI layer is a modular provider system that sits behind a unified interface. It supports real LLM backends (OpenAI GPT-4o, Anthropic Claude) with automatic fallback to a local pattern-matching engine when no API keys are configured.

```
src/ai/
├── index.ts              # Unified exports — import everything from here
├── config.ts             # Provider selection, key detection, settings
├── types.ts              # All TypeScript interfaces
├── providers/
│   ├── openai.ts         # OpenAI GPT-4o / GPT-4o-mini adapter
│   ├── anthropic.ts      # Anthropic Claude adapter
│   └── mock.ts           # Local fallback parser (always available)
├── prompts/
│   ├── system.ts         # Master system prompt + musical style injection
│   ├── composer.ts       # Beat/melody/chord/arrangement prompt templates
│   └── songwriter.ts     # Lyric/rhyme/flow/wordplay prompt templates
└── music/
    ├── types.ts          # Music generation interfaces + prompt builders
    ├── suno.ts           # Suno API adapter (real or mock)
    └── udio.ts           # Udio API adapter (real or mock)
```

## How It Works

1. **Provider Selection**: `getActiveProvider()` checks for API keys in order: OpenAI → Anthropic → Mock. The first configured provider wins.
2. **Chat Flow**: `AIProvider.chat(messages, context)` takes conversation history + session context, injects the system prompt, and returns `AIResponse { text, route?, provider }`.
3. **Graceful Degradation**: If a real provider throws (network error, rate limit, etc.), the call falls through to the mock provider automatically. The app never breaks.
4. **Music Generation**: `getMusicProvider()` checks Suno → Udio. Both have full stub implementations that return typed mock data when keys aren't set.

## Adding a New Provider

1. Create `src/ai/providers/<name>.ts` implementing the `AIProvider` interface:
   ```typescript
   export const myProvider: AIProvider = {
     name: "MyProvider",
     model: "model-name",
     async chat(messages, context) { ... },
     isConfigured() { return !!process.env.MY_API_KEY; },
   };
   ```
2. Register it in `src/ai/config.ts`:
   - Add to `chatProviders` record
   - Add to `autoPriority` array (decides fallback order)
3. Add a status entry in `getProviderStatuses()`
4. Add `MY_API_KEY` to `.env.example`

For music providers, implement `MusicGenProvider` and register in `getMusicProvider()`.

## Environment Variables

See `.env.example` for the full list. The app requires zero keys to function — everything degrades to local mock mode.

## API Endpoints

The AI layer is consumed through server functions in `src/api.ts`:

- `assistant.chat({ message, context })` — Conversational AI
- `assistant.getProviderStatus()` — Which providers are configured
- `assistant.getSettings()` / `assistant.saveSettings()` — Client-side settings persistence
- `assistant.getSuggestions({ module })` — Contextual suggestion chips
- `assistant.getDailyBrief()` — Daily creative brief

## Design Decisions

- **No streaming (yet)**: Started with non-streaming for reliability. Streaming is straightforward to add — OpenAI and Anthropic both support it with `stream: true`.
- **Server-side keys only**: API keys are read from `process.env.*` on the server. Client-side settings (from the Settings page) are stored in localStorage and passed as parameters to server functions — never exposed to the browser.
- **Mock is not just "TODO"**: The mock provider contains 40+ pattern-matched responses covering all 12 modules. It's a fully functional offline mode, not a placeholder.
- **System prompt is configurable**: `buildSystemPrompt()` takes dynamic context (user name, module, project, time of day) so the AI always knows the session state. The prompt lives in code for version control.

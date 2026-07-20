// ─── Mock AI Provider ─────────────────────────────────────────
// Always-available fallback using the existing pattern-matched
// response system. No API key required. Used when no real LLM
// provider is configured, or as a fallback on API errors.

import type { AIProvider, ChatMessage, ChatContext, AIResponse } from "../types";

// ─── Module ID Type ───────────────────────────────────────

type ModuleId =
  | "dashboard"
  | "beat-studio"
  | "recording-studio"
  | "vocal-processing"
  | "mixing-mastering"
  | "songwriter"
  | "music-creation"
  | "arrangement"
  | "project-manager"
  | "export-studio"
  | "cover-art-studio"
  | "video-studio";

// ─── Helpers ──────────────────────────────────────────────

function getModuleLabel(module: string): string {
  const labels: Record<string, string> = {
    "dashboard": "Dashboard",
    "beat-studio": "Beat Studio",
    "recording-studio": "Recording Studio",
    "vocal-processing": "Vocal Processing",
    "mixing-mastering": "Mixing & Mastering",
    "songwriter": "Songwriter",
    "music-creation": "Music Creation",
    "arrangement": "Arrangement",
    "project-manager": "Project Manager",
    "export-studio": "Export Studio",
    "cover-art-studio": "Cover Art Studio",
    "video-studio": "Video Studio",
  };
  return labels[module] || module;
}

function slugToModuleId(pathname: string): ModuleId {
  if (pathname === "/") return "dashboard";
  const slug = pathname.replace(/^\//, "");
  const valid = [
    "beat-studio", "recording-studio", "vocal-processing", "mixing-mastering",
    "songwriter", "music-creation", "arrangement", "project-manager",
    "export-studio", "cover-art-studio", "video-studio",
  ];
  return valid.includes(slug) ? (slug as ModuleId) : "dashboard";
}

const routeKeywords: Record<string, string> = {
  "beat": "/beat-studio", "beats": "/beat-studio",
  "recording": "/recording-studio", "record": "/recording-studio",
  "vocals": "/vocal-processing", "vocal": "/vocal-processing",
  "mixing": "/mixing-mastering", "mastering": "/mixing-mastering",
  "mix": "/mixing-mastering", "master": "/mixing-mastering",
  "songwriter": "/songwriter", "lyrics": "/songwriter", "write": "/songwriter",
  "music": "/music-creation", "create": "/music-creation", "melody": "/music-creation",
  "arrangement": "/arrangement", "arrange": "/arrangement",
  "project": "/project-manager", "projects": "/project-manager",
  "export": "/export-studio",
  "cover": "/cover-art-studio", "art": "/cover-art-studio", "artwork": "/cover-art-studio",
  "video": "/video-studio",
  "dashboard": "/", "home": "/",
  "settings": "/settings",
};

// ─── Command Parser ───────────────────────────────────────

function parseCommand(input: string, module: ModuleId, projectName: string, timeOfDay: string): AIResponse {
  const moduleLabel = getModuleLabel(module);

  // ── Greetings ──
  if (/^(hey|hi|hello|yo|sup|what'?s good|good (morning|afternoon|evening)|what'?s up|howdy)/i.test(input)) {
    return {
      text: `${timeOfDay}, King Juice! I'm locked in and ready to cook. You're working on "${projectName}" in ${moduleLabel}. What can I help with?`,
      provider: "mock",
    };
  }

  // ── Farewells / Thanks ──
  if (/\b(thanks|thank you|appreciate|goodbye|bye|later|peace)\b/i.test(input)) {
    return {
      text: "Always here for you, King Juice. Keep cooking — I'll be ready when you need me. 🎶",
      provider: "mock",
    };
  }

  // ── Navigation ──
  const navMatch = input.match(/(?:go to|take me to|open|navigate to|show me the) (.+)/i);
  if (navMatch) {
    const target = navMatch[1].toLowerCase().trim().replace(/\s+/g, " ");
    for (const [keyword, route] of Object.entries(routeKeywords)) {
      if (target.includes(keyword)) {
        const routeName = route === "/" ? "Dashboard" : route === "/settings" ? "Settings" : getModuleLabel(route.slice(1));
        return {
          text: `Taking you to ${routeName}, King Juice.`,
          route,
          provider: "mock",
        };
      }
    }
    return {
      text: `I don't recognize that page, King Juice. Try "go to beat studio" or "take me to recording". What module are you looking for?`,
      provider: "mock",
    };
  }

  // ── "Make this hook catchier" ──
  if (/make this hook/i.test(input)) {
    return {
      text: `I've analyzed your hook, King Juice. Here's what I'd suggest:\n\n• Tighten the rhyme scheme on bars 2 and 4\n• Add a melodic lift on the last word\n• Try doubling the tempo on the hi-hats during the hook\n\nWant me to apply these changes?`,
      provider: "mock",
    };
  }

  // ── "Lower the 808" / "Lower the bass" ──
  if (/lower the (808|bass)/i.test(input)) {
    return {
      text: "Pulling the 808 down by 3dB in the mix. The bass should sit better with the kick now. Want me to adjust the sidechain compression too?",
      provider: "mock",
    };
  }

  // ── "Master this song" ──
  if (/\bmaster(?:ing)? (?:this|the) (?:song|track)\b|^master/i.test(input)) {
    return {
      text: `Running mastering chain for "${projectName}"...\n\n• Target: Spotify (-14 LUFS)\n• True Peak: -1.0 dB\n• EQ: Slight boost at 2kHz for vocal clarity\n• Compression: 2:1 ratio, soft knee\n\nReady for export when you are. Want me to run it?`,
      route: "/mixing-mastering",
      provider: "mock",
    };
  }

  // ── Cover Art ──
  if (/generate (?:cover )?art(?:work)?|create (?:cover )?art(?:work)?|make (?:cover )?art(?:work)?/i.test(input)) {
    return {
      text: `What style are you feeling for "${projectName}"?\n\n• Dark & Moody — fits the trap vibe\n• Neon — eye-catching on streaming\n• Minimalist — clean and modern`,
      route: "/cover-art-studio",
      provider: "mock",
    };
  }

  // ── Daily brief / what to work on ──
  if (/what should i work on|what'?s next|daily brief|studio progress/i.test(input)) {
    return {
      text: `Good question, King Juice. Based on your progress:\n\n• "${projectName}" needs ad-libs recorded (Verse 2 is done)\n• "Crown Heavy" is ready for mixing\n• You haven't generated cover art for "Sauce Walk" yet\n\nI'd start with finishing those ad-libs — the session flow is strong right now.`,
      route: "/recording-studio",
      provider: "mock",
    };
  }

  // ── Beat generation ──
  if (/generate (?:a |some )?beat|make (?:a |some )?beat|create (?:a |some )?beat/i.test(input)) {
    return {
      text: "Say less, King Juice! Let me cook something up. What vibe are you going for — dark trap, melodic R&B, drill, or something else?",
      route: "/beat-studio",
      provider: "mock",
    };
  }

  // ── Beat Studio ──
  if (module === "beat-studio") {
    if (/darker|dark/i.test(input)) {
      return { text: "Darkening the beat, King Juice. I'll boost the low end, shift to a minor mode, and add some atmospheric tension. This is going to hit different.", provider: "mock" };
    }
    if (/add a drop|drop section/i.test(input)) {
      return { text: "Adding a drop section at bar 32. I'll cut everything but the 808 and the vocal sample, then bring it all back in over 4 bars with a riser. Fire.", provider: "mock" };
    }
    if (/change tempo|bpm/i.test(input)) {
      const bpmMatch = input.match(/(\d{2,3})\s*(bpm)?/);
      const bpm = bpmMatch ? bpmMatch[1] : "140";
      return { text: `Tempo updated to ${bpm} BPM. I've adjusted all the MIDI clips and the project grid to match. Everything stays locked in.`, provider: "mock" };
    }
  }

  // ── Recording ──
  if (module === "recording-studio") {
    if (/new (vocal )?track|create (a )?track/i.test(input)) {
      return { text: "New vocal track created and armed. I've pre-loaded your King Juice Lead chain so you're ready to record. Count in is set to 4 bars.", provider: "mock" };
    }
    if (/noise removal|noise gate|clean up/i.test(input)) {
      return { text: "Noise removal applied across all vocal tracks. I'm using adaptive mode — threshold set to -40dB with 12dB reduction. Let me know if you hear any artifacts.", provider: "mock" };
    }
    if (/ad-?lib|adlib/i.test(input)) {
      return { text: `Here are ad-lib ideas for "${projectName}" based on the hook melody:\n\n• "Yeah, yeah" layered under "late nights"\n• "Crown heavy" echo on beat 3\n• Ad-lib drop on the last bar of the hook\n• Whispers under Verse 2 for texture\n\nWant me to set up the ad-lib tracks?`, provider: "mock" };
    }
  }

  // ── Vocal Processing ──
  if (module === "vocal-processing") {
    if (/modern rap|apply.*preset/i.test(input)) {
      return { text: "Modern Rap preset applied to your lead vocal chain:\n\n• Auto-Tune: Retune speed 50, D minor\n• 1176 Comp: Threshold -22, Ratio 4:1\n• Room Reverb: 20% wet\n\nYour vocals are sitting crisp and aggressive now.", provider: "mock" };
    }
    if (/more reverb|add reverb/i.test(input)) {
      return { text: "Increased the reverb mix from 15% to 28%. I'm using the Plate setting with a 1.2s decay — gives warmth without washing out the consonants.", provider: "mock" };
    }
    if (/lower (the )?compression/i.test(input)) {
      return { text: "Backed off the compression — threshold moved from -22 to -18, ratio from 4:1 to 3:1. Your dynamics will breathe more now. The 1176 is still catching peaks.", provider: "mock" };
    }
    if (/tune|auto-?tune/i.test(input)) {
      return { text: "Tightening the tuning, King Juice. Retune speed down to 20, humanize at 10. Fast and clean, like the modern trap sound.", provider: "mock" };
    }
  }

  // ── Mixing & Mastering ──
  if (module === "mixing-mastering") {
    if (/master for (spotify|streaming|apple)/i.test(input)) {
      return { text: "Streaming mastering preset loaded:\n\n• Target: -14 LUFS integrated\n• True Peak: -1.0 dB\n• Dynamic Range: ~8 LU\n• EQ: Gentle smile curve\n\nThis will sound clean on Spotify and Apple Music after their normalization.", provider: "mock" };
    }
    if (/balance|mix preset|vocal forward/i.test(input)) {
      return { text: "Vocal Forward mix preset applied. Vocals are pushed to 90%, drums at 70%, melody pulled back slightly. The vocal clarity is going to cut through on any system.", provider: "mock" };
    }
    if (/check.*lufs|lufs|how loud/i.test(input)) {
      return { text: `Current LUFS readings for "${projectName}":\n\n• Integrated: -12.8 LUFS\n• Short Term: -11.2 LUFS\n• Momentary: -9.5 LUFS\n• True Peak: -0.8 dB\n• Dynamic Range: 7.2 LU\n\nYou're slightly hot for Spotify. Want me to bring it down to -14?`, provider: "mock" };
    }
  }

  // ── Songwriter ──
  if (module === "songwriter") {
    if (/write (a |some )?hook|hook about/i.test(input)) {
      const topic = input.replace(/write (a |some )?hook about|hook about/i, "").trim() || "success";
      return {
        text: `Here's a hook idea about ${topic}, King Juice:\n\n"${topic.charAt(0).toUpperCase() + topic.slice(1)} on my mind, I can't let it go\nEvery step I take, yeah they watching the show\nCrown heavy but I'm ready, letting everybody know\nKing Juice in the building — watch the legacy grow"\n\nWant me to generate more variations?`,
        provider: "mock",
      };
    }
    if (/suggest rhymes|rhymes for/i.test(input)) {
      const wordMatch = input.match(/rhymes? for ['"]?(\w+)['"]?/i);
      const word = wordMatch ? wordMatch[1] : "crown";
      return {
        text: `Rhymes for "${word}":\n\nPerfect: down, town, brown, frown, drown, renown\nNear: sound, ground, found, round, bound, profound\n\nFor your vibe, "I wear the crown, never back down — built this whole town from the underground" hits hard.`,
        provider: "mock",
      };
    }
    if (/rewrite|improve|fix/i.test(input)) {
      return { text: "I've tightened the flow on your verse. Swapped the syllable pattern on bar 3 to a syncopated bounce and added internal rhymes on bars 1 and 4. It reads smoother and hits harder rhythmically.", provider: "mock" };
    }
    if (/flow|rhythm|pattern/i.test(input)) {
      return { text: "Your current flow pattern is Trap Staccato: ▥ – ▥ ▥ – ▥ – ▥ – ▥. It's consistent, but adding a double-time section on bars 7-8 would create tension before the hook drops. Classic technique.", provider: "mock" };
    }
  }

  // ── Music Creation ──
  if (module === "music-creation") {
    if (/generate.*melody|dark.*melody|melody/i.test(input)) {
      return { text: "Dark melody generated in D minor, King Juice. I used a synth lead with minor pentatonic, 4 bars, medium complexity. The melody has a haunting quality that'll sit beautifully under your vocals.", provider: "mock" };
    }
    if (/808|bass/i.test(input)) {
      return { text: "808 pattern added. Root notes on the 1 and 3 with a slide on the upbeat of 4. I kept the pocket tight at 140 BPM. The bass is hitting hard — it'll knock on any system.", provider: "mock" };
    }
    if (/counter melody|harmony/i.test(input)) {
      return { text: "Counter melody generated using a guitar patch at a higher octave. It answers the main melody on bars 2 and 4, creating a nice call-and-response dynamic.", provider: "mock" };
    }
  }

  // ── Arrangement ──
  if (module === "arrangement") {
    if (/add.*bridge|bridge section/i.test(input)) {
      return { text: "Bridge section added at bar 48, 8 bars. I've set the energy at 6/10 to create a moment of contrast before the final hook. The key stays in Dm but the chord progression shifts to the IV.", provider: "mock" };
    }
    if (/auto.?arrange|arrange this/i.test(input)) {
      return { text: `Auto-arranged "${projectName}" using the standard structure:\n\nIntro (4) → Verse 1 (16) → Hook (8) → Verse 2 (16) → Bridge (8) → Hook (8) → Outro (4)\n\nTotal: 64 bars. Ready to review.`, provider: "mock" };
    }
    if (/extend.*intro|longer intro/i.test(input)) {
      return { text: "Intro extended from 4 to 8 bars. I've added a filtered build — the beat fades in with a low-pass that opens up over the last 2 bars. Creates a nice sense of arrival.", provider: "mock" };
    }
  }

  // ── Project Manager ──
  if (module === "project-manager") {
    if (/finished|completed|done/i.test(input)) {
      return { text: `Your finished projects:\n\n• "Sauce Walk" — Mixed, 88% complete\n• "Drip Season" — Mastered\n• "No Limits" — Released\n\n3 tracks ready to go. "Sauce Walk" just needs mastering to be fully done.`, provider: "mock" };
    }
    if (/create.*project|new project/i.test(input)) {
      return { text: "New project created, King Juice. I've set it up at 140 BPM in D minor — your signature settings. Ready to cook.", provider: "mock" };
    }
    if (/find|search|trap beats/i.test(input)) {
      return { text: "Your trap projects:\n\n• \"Late Nights\" — In Progress, 140 BPM\n• \"Sauce Walk\" — Mixed, 132 BPM\n• \"Drip Season\" — Mastered, 128 BPM\n\nYou've been heavy in the trap pocket. All in minor keys.", provider: "mock" };
    }
  }

  // ── Export ──
  if (module === "export-studio") {
    if (/export as wav|wav/i.test(input)) {
      return { text: `Exporting "${projectName}" as WAV:\n\n• Format: 24-bit / 48kHz\n• Estimated size: ~85 MB\n• Includes: Full mix + metadata\n\nStarting render now. This'll take a few seconds.`, provider: "mock" };
    }
    if (/instrumental/i.test(input)) {
      return { text: "Exporting instrumental version. Vocals muted, all other stems at mix levels. This is the version you send to features and DJs.", provider: "mock" };
    }
    if (/recent exports|show.*export/i.test(input)) {
      return { text: "Recent exports:\n\n• \"No Limits\" — WAV, 84.2 MB (Jul 14)\n• \"Sauce Walk\" — MP3, 12.4 MB (Jul 12)\n• \"Late Nights\" Rough — WAV, 78.1 MB (Jul 10)\n• \"Drip Season\" Stems — ZIP, 245 MB (Jul 8)", provider: "mock" };
    }
  }

  // ── Cover Art ──
  if (module === "cover-art-studio") {
    if (/dark.*art|dark.*cover/i.test(input)) {
      return { text: `Dark & Moody cover art generating for "${projectName}"... I'm using the Purple Haze palette with a throne motif and heavy vignette. This is going to look cinematic.`, provider: "mock" };
    }
    if (/minimalist|simple/i.test(input)) {
      return { text: "Minimalist approach: clean crown icon centered on a dark background, with \"LATE NIGHTS\" in bold Inter below. No distractions — just pure, premium aesthetic.", provider: "mock" };
    }
    if (/add.*name|my name/i.test(input)) {
      return { text: "Added \"King Juice\" to the artwork. Using the same font treatment as the title — bold, centered, subtle opacity difference to keep the hierarchy clear.", provider: "mock" };
    }
  }

  // ── Video ──
  if (module === "video-studio") {
    if (/lyric video/i.test(input)) {
      return { text: `Lyric video setup for "${projectName}":\n\n• Template: Lyric Video Classic\n• Aspect: 9:16 (Vertical / Reels)\n• Text animation: Slide Up\n• Duration: Full song\n\nReady to generate. This'll take about 2 minutes.`, provider: "mock" };
    }
    if (/spotify canvas|canvas/i.test(input)) {
      return { text: "Spotify Canvas generating... 9:16 vertical, 15 seconds, loop-ready. I'm using the Neon Glow template so it pops on dark mode. This will grab attention on the Now Playing screen.", provider: "mock" };
    }
    if (/particle|effects/i.test(input)) {
      return { text: "Particle effects added — swirling purple particles that react to the beat. I've synced the burst timing to the snare hits so it feels locked to the music.", provider: "mock" };
    }
  }

  // ── Beat idea ──
  if (/suggest.*(?:beat|idea)|give me.*idea|what should i name/i.test(input)) {
    return {
      text: `Here's an idea, King Juice: A dark trap beat at 140 BPM in F# minor. Moody synth lead with a half-time 808 that switches to double-time in the hook. Atmospheric pads in the background with a sparse hi-hat pattern. Title idea: "Midnight Crown".\n\nSound like a vibe?`,
      route: "/beat-studio",
      provider: "mock",
    };
  }

  // ── Info queries ──
  if (/what bpm|what key|how many tracks|what'?s the (bpm|key)/i.test(input)) {
    return {
      text: `"${projectName}" is at 140 BPM in D minor. You have 16 tracks in this project — lead vocal, ad-libs, hook double, two verses, 808 bass, main melody, hi-hats, and more. Duration: 3:42. Currently at 72% completion.`,
      provider: "mock",
    };
  }

  if (/how long|duration|length/i.test(input)) {
    return {
      text: `"${projectName}" runs 3:42 right now. With the bridge and outro you've been planning, it'll hit about 4:15 — great length for streaming. Right in the sweet spot.`,
      provider: "mock",
    };
  }

  // ── Help ──
  if (/help|what can you do|capabilities/i.test(input)) {
    return {
      text: `I can help you with everything in Juice Studio, King Juice:\n\n• Generate beats and melodies\n• Record and process vocals\n• Mix and master your tracks\n• Write lyrics and improve flow\n• Arrange song structures\n• Create cover art\n• Make music videos\n• Manage your projects\n\nJust tell me what you need. I'm your engineer.`,
      provider: "mock",
    };
  }

  // ── Fallback ──
  return {
    text: `I can help with that, King Juice. Could you be more specific about what you'd like to do in ${moduleLabel}? I'm your engineer — just tell me what sound you're going for.`,
    provider: "mock",
  };
}

// ─── Mock Provider ────────────────────────────────────────

export const mockProvider: AIProvider = {
  name: "Mock",
  model: "local-parser",

  async chat(messages: ChatMessage[], context: ChatContext): Promise<AIResponse> {
    // Grab the last user message
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMsg) {
      return {
        text: "What's good, King Juice? I'm ready to help you cook. What do you need?",
        provider: "mock",
      };
    }

    const module = slugToModuleId(context.pathname || "/");
    const result = parseCommand(lastUserMsg.content, module, context.currentProject, context.timeOfDay);
    return result;
  },

  isConfigured(): boolean {
    return true; // Always available
  },
};

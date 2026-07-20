import { useState, useRef, useEffect, useReducer, useCallback } from "react";
import { useRouter, useLocation } from "@tanstack/react-router";
import { assistant } from "../api";

// ─── Types ───────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
}

interface ChatState {
  messages: Message[];
  isTyping: boolean;
}

type ChatAction =
  | { type: "ADD_USER_MESSAGE"; text: string }
  | { type: "ADD_ASSISTANT_MESSAGE"; text: string }
  | { type: "SET_TYPING"; isTyping: boolean }
  | { type: "CLEAR" };

interface ParsedCommand {
  text: string;
  action?: { label: string; handler?: string };
  suggestion?: string;
  route?: string;
}

// ─── Module Context ──────────────────────────────────────────

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

function getModuleFromPath(pathname: string): ModuleId {
  if (pathname === "/") return "dashboard";
  const slug = pathname.slice(1);
  const valid: ModuleId[] = [
    "beat-studio", "recording-studio", "vocal-processing", "mixing-mastering",
    "songwriter", "music-creation", "arrangement", "project-manager",
    "export-studio", "cover-art-studio", "video-studio",
  ];
  return valid.includes(slug as ModuleId) ? (slug as ModuleId) : "dashboard";
}

function getModuleLabel(module: ModuleId): string {
  const labels: Record<ModuleId, string> = {
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
  return labels[module];
}

// ─── Suggestion Chips per Module ─────────────────────────────

const moduleSuggestions: Record<ModuleId, string[]> = {
  "dashboard": [
    "What should I work on today?",
    "Show my recent projects",
    "Generate a beat idea",
    "What's my studio progress?",
  ],
  "beat-studio": [
    "Make this beat darker",
    "Add a drop section",
    "Change tempo to 140 BPM",
    "Regenerate the hook section",
  ],
  "recording-studio": [
    "Create a new vocal track",
    "Apply noise removal",
    "Suggest ad-lib ideas",
    "Show my best takes",
  ],
  "vocal-processing": [
    "Apply Modern Rap preset",
    "Add more reverb",
    "Lower the compression",
    "Tune my vocals tighter",
  ],
  "mixing-mastering": [
    "Master for Spotify",
    "Balance my mix",
    "Check my LUFS",
    "Apply the Vocal Forward mix preset",
  ],
  "songwriter": [
    "Write a hook about success",
    "Suggest rhymes for 'crown'",
    "Rewrite Verse 2",
    "Improve my flow on this verse",
  ],
  "music-creation": [
    "Generate a dark melody",
    "Add 808 pattern",
    "Create counter melody",
    "Suggest chord progression",
  ],
  "arrangement": [
    "Add a bridge section",
    "Auto-arrange this song",
    "Extend the intro",
    "Apply a trap arrangement template",
  ],
  "project-manager": [
    "Show my finished songs",
    "Create a new project",
    "Find my trap beats",
    "Organize my projects by genre",
  ],
  "export-studio": [
    "Export as WAV",
    "Export instrumental",
    "Show recent exports",
    "Export stems for mixing",
  ],
  "cover-art-studio": [
    "Generate dark cover art",
    "Make it more minimalist",
    "Add my name to artwork",
    "Try a neon style cover",
  ],
  "video-studio": [
    "Create a lyric video",
    "Make a Spotify canvas",
    "Add particle effects",
    "Generate a visualizer for Late Nights",
  ],
};

// ─── Time-based Greetings ────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 22) return "Good evening";
  return "Late night session";
}

// ─── Route Mapping ──────────────────────────────────────────

const routeKeywords: Record<string, string> = {
  "beat": "/beat-studio",
  "beats": "/beat-studio",
  "recording": "/recording-studio",
  "record": "/recording-studio",
  "vocals": "/vocal-processing",
  "vocal": "/vocal-processing",
  "mixing": "/mixing-mastering",
  "mastering": "/mixing-mastering",
  "mix": "/mixing-mastering",
  "master": "/mixing-mastering",
  "songwriter": "/songwriter",
  "lyrics": "/songwriter",
  "write": "/songwriter",
  "music": "/music-creation",
  "create": "/music-creation",
  "melody": "/music-creation",
  "arrangement": "/arrangement",
  "arrange": "/arrangement",
  "project": "/project-manager",
  "projects": "/project-manager",
  "export": "/export-studio",
  "cover": "/cover-art-studio",
  "art": "/cover-art-studio",
  "artwork": "/cover-art-studio",
  "video": "/video-studio",
  "dashboard": "/",
  "home": "/",
};

// ─── Command Parser ──────────────────────────────────────────

function parseCommand(message: string, module: ModuleId): ParsedCommand {
  const input = message.toLowerCase().trim();
  const moduleLabel = getModuleLabel(module);

  // ── Greetings ──
  if (/^(hey|hi|hello|yo|sup|what'?s good|good (morning|afternoon|evening)|what'?s up|howdy)/i.test(input)) {
    const greeting = getGreeting();
    return {
      text: `${greeting}, King Juice! I'm locked in and ready to cook. You're working on "Late Nights" in ${moduleLabel}. What can I help with?`,
    };
  }

  // ── Farewells / Thanks ──
  if (/\b(thanks|thank you|appreciate|goodbye|bye|later|peace)\b/i.test(input)) {
    return {
      text: "Always here for you, King Juice. Keep cooking — I'll be ready when you need me. \ud83c\udfb6",
    };
  }

  // ── Navigation ──
  const navMatch = input.match(/(?:go to|take me to|open|navigate to|show me the) (.+)/i);
  if (navMatch) {
    const target = navMatch[1].toLowerCase().trim().replace(/\s+/g, " ");
    for (const [keyword, route] of Object.entries(routeKeywords)) {
      if (target.includes(keyword)) {
        return {
          text: `Taking you to ${getModuleLabel(route.slice(1) as ModuleId) || route === "/" ? "Dashboard" : route.slice(1)}, King Juice.`,
          route,
        };
      }
    }
    return {
      text: `I don't recognize that page, King Juice. Try "go to beat studio" or "take me to recording". What module are you looking for?`,
    };
  }

  // ── "Make this hook catchier" ──
  if (/make this hook/i.test(input)) {
    return {
      text: `I've analyzed your hook, King Juice. Here's what I'd suggest:\n\n\u2022 Tighten the rhyme scheme on bars 2 and 4\n\u2022 Add a melodic lift on the last word\n\u2022 Try doubling the tempo on the hi-hats during the hook\n\nWant me to apply these changes?`,
      suggestion: "Would you like me to apply all three changes?",
    };
  }

  // ── "Lower the 808" / "Lower the bass" ──
  if (/lower the (808|bass)/i.test(input)) {
    return {
      text: "Pulling the 808 down by 3dB in the mix. The bass should sit better with the kick now. Want me to adjust the sidechain compression too?",
      suggestion: "Should I also adjust the sidechain compression?",
    };
  }

  // ── "Master this song" / "Master/ing" ──
  if (/\bmaster(?:ing)? (?:this|the) (?:song|track)\b|^master/i.test(input)) {
    return {
      text: `Running mastering chain for "Late Nights"...\n\n\u2022 Target: Spotify (-14 LUFS)\n\u2022 True Peak: -1.0 dB\n\u2022 EQ: Slight boost at 2kHz for vocal clarity\n\u2022 Compression: 2:1 ratio, soft knee\n\nReady for export when you are. Want me to run it?`,
      suggestion: "Want to open the Mixing & Mastering module?",
      route: "/mixing-mastering",
    };
  }

  // ── "Generate cover art" / artwork ──
  if (/generate (?:cover )?art(?:work)?|create (?:cover )?art(?:work)?|make (?:cover )?art(?:work)?/i.test(input)) {
    return {
      text: `What style are you feeling for "Late Nights"?\n\n\u2022 Dark & Moody \u2014 fits the trap vibe\n\u2022 Neon \u2014 eye-catching on streaming\n\u2022 Minimalist \u2014 clean and modern`,
      suggestion: "Which style? Dark, Neon, or Minimalist?",
      route: "/cover-art-studio",
    };
  }

  // ── "What should I work on today?" / daily brief ──
  if (/what should i work on|what'?s next|daily brief|studio progress/i.test(input)) {
    return {
      text: `Good question, King Juice. Based on your progress:\n\n\u2022 "Late Nights" needs ad-libs recorded (Verse 2 is done)\n\u2022 "Crown Heavy" is ready for mixing\n\u2022 You haven't generated cover art for "Sauce Walk" yet\n\nI'd start with finishing those ad-libs \u2014 the session flow is strong right now.`,
      suggestion: "Want to jump into Recording Studio?",
      route: "/recording-studio",
    };
  }

  // ── "Generate a beat" / beat-related ──
  if (/generate (?:a |some )?beat|make (?:a |some )?beat|create (?:a |some )?beat/i.test(input)) {
    return {
      text: "Say less, King Juice! Let me cook something up. What vibe are you going for \u2014 dark trap, melodic R&B, drill, or something else?",
      suggestion: "I can generate a beat right now. What genre?",
      route: "/beat-studio",
    };
  }

  // ── Beat Studio module actions ──
  if (module === "beat-studio") {
    if (/darker|dark/i.test(input)) {
      return { text: "Darkening the beat, King Juice. I'll boost the low end, shift to a minor mode, and add some atmospheric tension. This is going to hit different.", suggestion: "Want me to regenerate with the dark preset?" };
    }
    if (/add a drop|drop section/i.test(input)) {
      return { text: "Adding a drop section at bar 32. I'll cut everything but the 808 and the vocal sample, then bring it all back in over 4 bars with a riser. Fire.", suggestion: "Should the drop be 4 or 8 bars?" };
    }
    if (/change tempo|bpm/i.test(input)) {
      const bpmMatch = input.match(/(\d{2,3})\s*(bpm)?/);
      const bpm = bpmMatch ? bpmMatch[1] : "140";
      return { text: `Tempo updated to ${bpm} BPM. I've adjusted all the MIDI clips and the project grid to match. Everything stays locked in.`, suggestion: "Want me to adjust the drum pattern for the new tempo?" };
    }
  }

  // ── Recording module actions ──
  if (module === "recording-studio") {
    if (/new (vocal )?track|create (a )?track/i.test(input)) {
      return { text: "New vocal track created and armed. I've pre-loaded your King Juice Lead chain so you're ready to record. Count in is set to 4 bars.", suggestion: "Ready to record? Press R when you're set." };
    }
    if (/noise removal|noise gate|clean up/i.test(input)) {
      return { text: "Noise removal applied across all vocal tracks. I'm using adaptive mode \u2014 threshold set to -40dB with 12dB reduction. Let me know if you hear any artifacts.", suggestion: "Want me to also apply breath removal?" };
    }
    if (/ad-?lib|adlib/i.test(input)) {
      return { text: "Here are ad-lib ideas for \"Late Nights\" based on the hook melody:\n\n\u2022 \"Yeah, yeah\" layered under \"late nights\"\n\u2022 \"Crown heavy\" echo on beat 3\n\u2022 Ad-lib drop on the last bar of the hook\n\u2022 Whispers under Verse 2 for texture\n\nWant me to set up the ad-lib tracks?", suggestion: "Ready to record ad-libs?" };
    }
  }

  // ── Vocal Processing ──
  if (module === "vocal-processing") {
    if (/modern rap|apply.*preset/i.test(input)) {
      return { text: "Modern Rap preset applied to your lead vocal chain:\n\n\u2022 Auto-Tune: Retune speed 50, D minor\n\u2022 1176 Comp: Threshold -22, Ratio 4:1\n\u2022 Room Reverb: 20% wet\n\nYour vocals are sitting crisp and aggressive now.", suggestion: "Want to A/B compare with the Melodic Rap preset?" };
    }
    if (/more reverb|add reverb/i.test(input)) {
      return { text: "Increased the reverb mix from 15% to 28%. I'm using the Plate setting with a 1.2s decay \u2014 gives warmth without washing out the consonants.", suggestion: "Should I also widen the stereo field?" };
    }
    if (/lower (the )?compression/i.test(input)) {
      return { text: "Backed off the compression \u2014 threshold moved from -22 to -18, ratio from 4:1 to 3:1. Your dynamics will breathe more now. The 1176 is still catching peaks.", suggestion: "Check your LUFS? I can measure the vocal loudness." };
    }
    if (/tune|auto-?tune/i.test(input)) {
      return { text: "Tightening the tuning, King Juice. Retune speed down to 20, humanize at 10. Fast and clean, like the modern trap sound.", suggestion: "Want the full Trap preset applied?" };
    }
  }

  // ── Mixing & Mastering ──
  if (module === "mixing-mastering") {
    if (/master for (spotify|streaming|apple)/i.test(input)) {
      return { text: "Streaming mastering preset loaded:\n\n\u2022 Target: -14 LUFS integrated\n\u2022 True Peak: -1.0 dB\n\u2022 Dynamic Range: ~8 LU\n\u2022 EQ: Gentle smile curve\n\nThis will sound clean on Spotify and Apple Music after their normalization.", suggestion: "Want to run the master now? It'll take about 3 seconds." };
    }
    if (/balance|mix preset|vocal forward/i.test(input)) {
      return { text: "Vocal Forward mix preset applied. Vocals are pushed to 90%, drums at 70%, melody pulled back slightly. The vocal clarity is going to cut through on any system.", suggestion: "Compare with the Balanced preset?" };
    }
    if (/check.*lufs|lufs|how loud/i.test(input)) {
      return { text: "Current LUFS readings for \"Late Nights\":\n\n\u2022 Integrated: -12.8 LUFS\n\u2022 Short Term: -11.2 LUFS\n\u2022 Momentary: -9.5 LUFS\n\u2022 True Peak: -0.8 dB\n\u2022 Dynamic Range: 7.2 LU\n\nYou're slightly hot for Spotify. Want me to bring it down to -14?", suggestion: "The club mix of this would hit HARD right now." };
    }
  }

  // ── Songwriter ──
  if (module === "songwriter") {
    if (/write (a |some )?hook|hook about/i.test(input)) {
      const topic = input.replace(/write (a |some )?hook about|hook about/i, "").trim() || "success";
      return {
        text: `Here's a hook idea about ${topic}, King Juice:\n\n"${topic.charAt(0).toUpperCase() + topic.slice(1)} on my mind, I can't let it go\nEvery step I take, yeah they watching the show\nCrown heavy but I'm ready, letting everybody know\nKing Juice in the building \u2014 watch the legacy grow"\n\nWant me to generate more variations?`,
        suggestion: "Want me to write the verse that goes with this hook?",
      };
    }
    if (/suggest rhymes|rhymes for/i.test(input)) {
      const wordMatch = input.match(/rhymes? for ['"]?(\w+)['"]?/i);
      const word = wordMatch ? wordMatch[1] : "crown";
      return {
        text: `Rhymes for "${word}":\n\nPerfect: down, town, brown, frown, drown, renown\nNear: sound, ground, found, round, bound, profound\n\nFor your vibe, "I wear the crown, never back down \u2014 built this whole town from the underground" hits hard.`,
        suggestion: "Want me to build a full bar with these rhymes?",
      };
    }
    if (/rewrite|improve|fix/i.test(input)) {
      return { text: "I've tightened the flow on your verse. Swapped the syllable pattern on bar 3 to a syncopated bounce and added internal rhymes on bars 1 and 4. It reads smoother and hits harder rhythmically.", suggestion: "Want me to show the before and after?" };
    }
    if (/flow|rhythm|pattern/i.test(input)) {
      return { text: "Your current flow pattern is Trap Staccato: \u25E1 \u2013 \u25E1 \u25E1 \u2013 \u25E1 \u2013 \u25E1 \u2013 \u25E1. It's consistent, but adding a double-time section on bars 7-8 would create tension before the hook drops. Classic technique.", suggestion: "Want me to suggest alternative flow patterns?" };
    }
  }

  // ── Music Creation ──
  if (module === "music-creation") {
    if (/generate.*melody|dark.*melody|melody/i.test(input)) {
      return { text: "Dark melody generated in D minor, King Juice. I used a synth lead with minor pentatonic, 4 bars, medium complexity. The melody has a haunting quality that'll sit beautifully under your vocals.", suggestion: "Want the full 8-bar version or add a counter melody?" };
    }
    if (/808|bass/i.test(input)) {
      return { text: "808 pattern added. Root notes on the 1 and 3 with a slide on the upbeat of 4. I kept the pocket tight at 140 BPM. The bass is hitting hard \u2014 it'll knock on any system.", suggestion: "Want me to add 808 glides or pitch bends?" };
    }
    if (/counter melody|harmony/i.test(input)) {
      return { text: "Counter melody generated using a guitar patch at a higher octave. It answers the main melody on bars 2 and 4, creating a nice call-and-response dynamic.", suggestion: "Should I use strings instead for a more cinematic feel?" };
    }
  }

  // ── Arrangement ──
  if (module === "arrangement") {
    if (/add.*bridge|bridge section/i.test(input)) {
      return { text: "Bridge section added at bar 48, 8 bars. I've set the energy at 6/10 to create a moment of contrast before the final hook. The key stays in Dm but the chord progression shifts to the IV.", suggestion: "Want to preview how the arrangement flows now?" };
    }
    if (/auto.?arrange|arrange this/i.test(input)) {
      return { text: "Auto-arranged \"Late Nights\" using the standard structure:\n\nIntro (4) \u2192 Verse 1 (16) \u2192 Hook (8) \u2192 Verse 2 (16) \u2192 Bridge (8) \u2192 Hook (8) \u2192 Outro (4)\n\nTotal: 64 bars. Ready to review.", suggestion: "Want me to try the trap structure instead?" };
    }
    if (/extend.*intro|longer intro/i.test(input)) {
      return { text: "Intro extended from 4 to 8 bars. I've added a filtered build \u2014 the beat fades in with a low-pass that opens up over the last 2 bars. Creates a nice sense of arrival.", suggestion: "Should I also extend the outro?" };
    }
  }

  // ── Project Manager ──
  if (module === "project-manager") {
    if (/finished|completed|done/i.test(input)) {
      return { text: "Your finished projects:\n\n\u2022 \"Sauce Walk\" \u2014 Mixed, 88% complete\n\u2022 \"Drip Season\" \u2014 Mastered\n\u2022 \"No Limits\" \u2014 Released\n\n3 tracks ready to go. \"Sauce Walk\" just needs mastering to be fully done.", suggestion: "Want to open Sauce Walk and finish it?" };
    }
    if (/create.*project|new project/i.test(input)) {
      return { text: "New project created, King Juice. I've set it up at 140 BPM in D minor \u2014 your signature settings. Ready to cook.", suggestion: "Want to start with a beat or go straight to vocals?" };
    }
    if (/find|search|trap beats/i.test(input)) {
      return { text: "Your trap projects:\n\n\u2022 \"Late Nights\" \u2014 In Progress, 140 BPM\n\u2022 \"Sauce Walk\" \u2014 Mixed, 132 BPM\n\u2022 \"Drip Season\" \u2014 Mastered, 128 BPM\n\nYou've been heavy in the trap pocket. All in minor keys.", suggestion: "Want to filter by BPM or key?" };
    }
  }

  // ── Export ──
  if (module === "export-studio") {
    if (/export as wav|wav/i.test(input)) {
      return { text: "Exporting \"Late Nights\" as WAV:\n\n\u2022 Format: 24-bit / 48kHz\n\u2022 Estimated size: ~85 MB\n\u2022 Includes: Full mix + metadata\n\nStarting render now. This'll take a few seconds.", suggestion: "Want the instrumental version too?" };
    }
    if (/instrumental/i.test(input)) {
      return { text: "Exporting instrumental version. Vocals muted, all other stems at mix levels. This is the version you send to features and DJs.", suggestion: "Also export the acapella?" };
    }
    if (/recent exports|show.*export/i.test(input)) {
      return { text: "Recent exports:\n\n\u2022 \"No Limits\" \u2014 WAV, 84.2 MB (Jul 14)\n\u2022 \"Sauce Walk\" \u2014 MP3, 12.4 MB (Jul 12)\n\u2022 \"Late Nights\" Rough \u2014 WAV, 78.1 MB (Jul 10)\n\u2022 \"Drip Season\" Stems \u2014 ZIP, 245 MB (Jul 8)", suggestion: "Need to re-export any of these?" };
    }
  }

  // ── Cover Art ──
  if (module === "cover-art-studio") {
    if (/dark.*art|dark.*cover/i.test(input)) {
      return { text: "Dark & Moody cover art generating for \"Late Nights\"... I'm using the Purple Haze palette with a throne motif and heavy vignette. This is going to look cinematic.", suggestion: "Want 4 variations to choose from?" };
    }
    if (/minimalist|simple/i.test(input)) {
      return { text: "Minimalist approach: clean crown icon centered on a dark background, with \"LATE NIGHTS\" in bold Inter below. No distractions \u2014 just pure, premium aesthetic.", suggestion: "Should the text be white or gold?" };
    }
    if (/add.*name|my name/i.test(input)) {
      return { text: "Added \"King Juice\" to the artwork. Using the same font treatment as the title \u2014 bold, centered, subtle opacity difference to keep the hierarchy clear.", suggestion: "Want artist name top or bottom?" };
    }
  }

  // ── Video ──
  if (module === "video-studio") {
    if (/lyric video/i.test(input)) {
      return { text: "Lyric video setup for \"Late Nights\":\n\n\u2022 Template: Lyric Video Classic\n\u2022 Aspect: 9:16 (Vertical / Reels)\n\u2022 Text animation: Slide Up\n\u2022 Duration: Full song\n\nReady to generate. This'll take about 2 minutes.", suggestion: "Want the typewriter animation style instead?" };
    }
    if (/spotify canvas|canvas/i.test(input)) {
      return { text: "Spotify Canvas generating... 9:16 vertical, 15 seconds, loop-ready. I'm using the Neon Glow template so it pops on dark mode. This will grab attention on the Now Playing screen.", suggestion: "Want to preview before rendering?" };
    }
    if (/particle|effects/i.test(input)) {
      return { text: "Particle effects added \u2014 swirling purple particles that react to the beat. I've synced the burst timing to the snare hits so it feels locked to the music.", suggestion: "Should I add waveform visualization too?" };
    }
  }

  // ── "Suggest a beat idea" / creative ──
  if (/suggest.*(?:beat|idea)|give me.*idea|what should i name/i.test(input)) {
    return {
      text: `Here's an idea, King Juice: A dark trap beat at 140 BPM in F# minor. Moody synth lead with a half-time 808 that switches to double-time in the hook. Atmospheric pads in the background with a sparse hi-hat pattern. Title idea: "Midnight Crown".\n\nSound like a vibe?`,
      suggestion: "Want me to generate this beat?",
      route: "/beat-studio",
    };
  }

  // ── "What BPM is this?" / inquiries ──
  if (/what bpm|what key|how many tracks|what'?s the (bpm|key)/i.test(input)) {
    return {
      text: `"Late Nights" is at 140 BPM in D minor. You have 16 tracks in this project \u2014 lead vocal, ad-libs, hook double, two verses, 808 bass, main melody, hi-hats, and more. Duration: 3:42. Currently at 72% completion.`,
    };
  }

  if (/how long|duration|length/i.test(input)) {
    return {
      text: `"Late Nights" runs 3:42 right now. With the bridge and outro you've been planning, it'll hit about 4:15 \u2014 great length for streaming. Right in the sweet spot.`,
    };
  }

  // ── Generic module suggestions ──
  if (/help|what can you do|capabilities/i.test(input)) {
    return {
      text: `I can help you with everything in Juice Studio, King Juice:\n\n\u2022 Generate beats and melodies\n\u2022 Record and process vocals\n\u2022 Mix and master your tracks\n\u2022 Write lyrics and improve flow\n\u2022 Arrange song structures\n\u2022 Create cover art\n\u2022 Make music videos\n\u2022 Manage your projects\n\nJust tell me what you need. I'm your engineer.`,
    };
  }

  // ── Fallback ──
  return {
    text: `I can help with that, King Juice. Could you be more specific about what you'd like to do in ${moduleLabel}? I'm your engineer \u2014 just tell me what sound you're going for.`,
    suggestion: "Try asking about beats, vocals, mixing, or your projects.",
  };
}

// ─── Reducer ──────────────────────────────────────────────────

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "ADD_USER_MESSAGE":
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            id: `user-${Date.now()}`,
            role: "user",
            text: action.text,
            timestamp: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
          },
        ],
      };
    case "ADD_ASSISTANT_MESSAGE":
      return {
        ...state,
        isTyping: false,
        messages: [
          ...state.messages,
          {
            id: `ai-${Date.now()}`,
            role: "assistant",
            text: action.text,
            timestamp: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
          },
        ],
      };
    case "SET_TYPING":
      return { ...state, isTyping: action.isTyping };
    case "CLEAR":
      return {
        messages: [
          {
            id: `ai-${Date.now()}`,
            role: "assistant",
            text: "What's good, King Juice? I'm ready to help you cook. What do you need?",
            timestamp: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
          },
        ],
        isTyping: false,
      };
    default:
      return state;
  }
}

// ─── Component ────────────────────────────────────────────────

export function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [providerLabel, setProviderLabel] = useState<string>("Local");
  const [isRealAI, setIsRealAI] = useState(false);
  const [state, dispatch] = useReducer(chatReducer, {
    messages: [
      {
        id: "ai-init",
        role: "assistant",
        text: "What's good, King Juice? I'm ready to help you cook. What do you need?",
        timestamp: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
      },
    ],
    isTyping: false,
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const location = useLocation();

  const module = getModuleFromPath(location.pathname);
  const moduleLabel = getModuleLabel(module);
  const suggestions = moduleSuggestions[module];

  // ── Check AI provider status ──────────────────────────────
  useEffect(() => {
    let cancelled = false;
    assistant.getProviderStatus().then((status) => {
      if (cancelled) return;
      setIsRealAI(status.realAI);
      // Determine provider label from configured providers
      if (status.configured.includes("openai")) {
        setProviderLabel("GPT-4o");
      } else if (status.configured.includes("anthropic")) {
        setProviderLabel("Claude");
      } else {
        setProviderLabel("Local");
      }
    }).catch(() => {
      // If server call fails, default to local
      if (!cancelled) {
        setIsRealAI(false);
        setProviderLabel("Local");
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [state.messages, open]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Keyboard shortcut: Cmd+K to toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      // Escape to close
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const handleSend = useCallback(
    async (text?: string) => {
      const messageText = (text || input).trim();
      if (!messageText) return;
      dispatch({ type: "ADD_USER_MESSAGE", text: messageText });
      setInput("");
      dispatch({ type: "SET_TYPING", isTyping: true });

      try {
        // Route through AI provider system (auto-selects OpenAI/Anthropic/Mock)
        const history = state.messages.map((m) => ({
          role: m.role,
          content: m.text,
        }));
        const result = await assistant.chat({
          data: {
            message: messageText,
            history,
            context: {
              module,
              projectName: "Late Nights",
              pathname: location.pathname,
            },
          },
        });
        dispatch({ type: "ADD_ASSISTANT_MESSAGE", text: result.reply });
        if (result.provider) setProviderLabel(result.provider);

        // Handle navigation
        if (result.route) {
          setTimeout(() => {
            router.navigate({ to: result.route! });
          }, 300);
        }
      } catch {
        // Fallback to local parser if API call fails
        const fallback = parseCommand(messageText, module);
        dispatch({ type: "ADD_ASSISTANT_MESSAGE", text: fallback.text });
        if (fallback.route) {
          setTimeout(() => {
            router.navigate({ to: fallback.route! });
          }, 300);
        }
      }
    },
    [input, module, router, location.pathname, state.messages],
  );

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      setInput(suggestion);
      inputRef.current?.focus();
    },
    [],
  );

  const formatMessageText = (text: string) => {
    return text.split("\n").map((line, i) => (
      <span key={i}>
        {line}
        {i < text.split("\n").length - 1 && <br />}
      </span>
    ));
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className={`fixed bottom-6 right-6 z-40 w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ease-out shadow-lg group ${
          open ? "scale-0 opacity-0 pointer-events-none" : "scale-100 opacity-100"
        }`}
        style={{
          background: "linear-gradient(135deg, #7c3aed, #5b21b6)",
          boxShadow: "0 4px 24px rgba(124, 58, 237, 0.4)",
        }}
        title="Juice AI Assistant (⌘K)"
        aria-label="Open AI Assistant"
      >
        <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a4 4 0 014 4c0 2-2 3-2 5s2 3 2 5a4 4 0 01-8 0c0-2 2-3 2-5s-2-3-2-5a4 4 0 014-4z" />
          <path d="M8 2c-1.5 2-2 4-2 6s.5 4 2 6M16 2c1.5 2 2 4 2 6s-.5 4-2 6" />
        </svg>
        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-400 border-2 border-[var(--color-juice-900)] animate-glowPulse" />
      </button>

      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={() => setOpen(false)} />
      )}

      {/* Chat Panel */}
      <div
        className={`fixed bottom-6 right-6 z-50 w-[420px] max-w-[calc(100vw-3rem)] h-[560px] max-h-[calc(100vh-8rem)] glass-panel flex flex-col shadow-2xl overflow-hidden transition-all duration-300 ease-out ${
          open ? "scale-100 opacity-100 translate-y-0" : "scale-95 opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-glass-border)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #7c3aed, #a78bfa)" }}
            >
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a4 4 0 014 4c0 2-2 3-2 5s2 3 2 5a4 4 0 01-8 0c0-2 2-3 2-5s-2-3-2-5a4 4 0 014-4z" />
              </svg>
            </div>
            <div>
              <span className="text-sm font-semibold text-white">Juice AI</span>
              <span className="block text-[10px] text-[var(--color-juice-300)] leading-tight">
                Working on: Late Nights — {moduleLabel}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => dispatch({ type: "CLEAR" })}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[var(--color-glass-bg-hover)] transition-colors"
              title="Clear chat"
            >
              <svg className="w-3.5 h-3.5 text-[var(--color-juice-300)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
              </svg>
            </button>
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[var(--color-glass-bg-hover)] transition-colors"
              title="Close (Esc)"
            >
              <svg className="w-4 h-4 text-[var(--color-juice-200)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {state.messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-6 h-6 rounded-md flex-shrink-0 mr-2 mt-0.5 flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #7c3aed, #a78bfa)" }}>
                  <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M12 2a4 4 0 014 4c0 2-2 3-2 5s2 3 2 5a4 4 0 01-8 0c0-2 2-3 2-5s-2-3-2-5a4 4 0 014-4z" />
                  </svg>
                </div>
              )}
              <div className="flex flex-col max-w-[85%]">
                <div
                  className={`px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-dark)] text-white rounded-2xl rounded-br-md"
                      : "bg-[var(--color-glass-bg-hover)] text-[var(--color-juice-100)] rounded-2xl rounded-bl-md border-l-2 border-[var(--color-accent)]"
                  }`}
                >
                  {formatMessageText(msg.text)}
                </div>
                <span className="text-[10px] text-[var(--color-juice-300)] mt-1 px-1">
                  {msg.timestamp}
                </span>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {state.isTyping && (
            <div className="flex justify-start">
              <div className="w-6 h-6 rounded-md flex-shrink-0 mr-2 mt-0.5 flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #7c3aed, #a78bfa)" }}>
                <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 2a4 4 0 014 4c0 2-2 3-2 5s2 3 2 5a4 4 0 01-8 0c0-2 2-3 2-5s-2-3-2-5a4 4 0 014-4z" />
                </svg>
              </div>
              <div className="bg-[var(--color-glass-bg-hover)] rounded-2xl rounded-bl-md border-l-2 border-[var(--color-accent)] px-4 py-3 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[var(--color-accent-light)] animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-[var(--color-accent-light)] animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-[var(--color-accent-light)] animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="p-3 border-t border-[var(--color-glass-border)] shrink-0">
          {/* Suggestion chips */}
          <div className="flex gap-1.5 mb-2.5 overflow-x-auto pb-1 flex-nowrap scroller">
            {suggestions.map((chip) => (
              <button
                key={chip}
                onClick={() => handleSuggestionClick(chip)}
                className="text-[11px] px-2.5 py-1.5 rounded-lg bg-[var(--color-glass-bg)] border border-[var(--color-glass-border)] text-[var(--color-juice-200)] hover:text-white hover:border-[var(--color-glass-border-hover)] hover:bg-[var(--color-glass-bg-hover)] transition-all whitespace-nowrap flex-shrink-0"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Input row */}
          <div className="flex items-center gap-2">
            <button
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-[var(--color-juice-300)] hover:text-white hover:bg-[var(--color-glass-bg-hover)] transition-all"
              title="Voice input (coming soon)"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                <path d="M19 10v2a7 7 0 01-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </button>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask Juice AI anything..."
              className="flex-1 bg-[var(--color-juice-700)] border border-[var(--color-glass-border)] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-[var(--color-juice-300)] outline-none focus:border-[var(--color-accent)] transition-colors"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim()}
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200 disabled:opacity-30 hover:scale-105"
              style={{
                background: input.trim()
                  ? "linear-gradient(135deg, #7c3aed, #6d28d9)"
                  : "var(--color-glass-bg)",
                boxShadow: input.trim() ? "0 2px 12px rgba(124, 58, 237, 0.3)" : "none",
              }}
            >
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

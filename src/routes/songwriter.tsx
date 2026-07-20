import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  generateLyrics,
  rhymeDict,
  wordplayBank,
  flowPatterns,
  countSyllables,
  generateSongwriterHistory,
  type LyricSection,
  type RhymeEntry,
  type WordplaySuggestion,
  type FlowPattern,
  type SongwriterHistoryItem,
} from "~/data/mock";

export const Route = createFileRoute("/songwriter")({
  component: Songwriter,
});

const GENRES = ["Trap", "R&B", "Pop", "Drill", "Afrobeats", "Hip-Hop", "Alternative", "Gospel"];
const MOODS = ["Dark", "Romantic", "Hype", "Reflective", "Aggressive", "Playful", "Sad", "Confident"];
const SECTION_TABS = [
  { id: "hook", label: "Hook" },
  { id: "verse1", label: "Verse 1" },
  { id: "verse2", label: "Verse 2" },
  { id: "bridge", label: "Bridge" },
  { id: "outro", label: "Outro" },
];

function Songwriter() {
  // State
  const [topic, setTopic] = useState("");
  const [genre, setGenre] = useState("Trap");
  const [moods, setMoods] = useState<string[]>(["Dark", "Confident"]);
  const [activeTab, setActiveTab] = useState("hook");
  const [sections, setSections] = useState<Record<string, string>>({
    hook: "Late nights, early mornings, I been on the grind\nCrown heavy but I carry it, one of a kind\nLate nights, they can't phase me, I been in my prime\nKing Juice on the track, leave 'em all behind",
    verse1: "Woke up in the late night, city lights glow\nCrown heavy on my head, they already know\nThey been waiting on the real one to show\nI been cooking in the stu, let the truth flow\n\nShadows in the hallway, memories in the rear\nEvery loss I took, I converted into gear\nNow I'm shifting lanes, vision crystal clear\nTold my younger self the future's nothing to fear",
    verse2: "Sauce walk through the valley, I don't trip\nDrip season permanent, I don't slip\nThey talk loud but they ain't on the script\nReal talk only, that's the fellowship\n\nCame from the bottom where the hope runs thin\nTurned my pain to power, let the healing begin\nEvery scar tells a story of the place I been\nNow I'm writing chapters that'll never end",
    bridge: "And when the midnight flex begins\nI feel the weight but I still win\nNo limits on what I can do\nTrap theology, see it through\n\nThe crown sits heavy but I stand tall\nThrough every rise and every fall\nThis is my calling, this is my all\nKing Juice forever, hear the call",
    outro: "King Juice...\nLate nights, crown heavy\nBut I carry it well\nYeah...\nJuice Studio",
  });
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [lastSaved, setLastSaved] = useState<string>(new Date().toLocaleTimeString());
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("");
  const [rhymeWord, setRhymeWord] = useState("");
  const [rhymeResults, setRhymeResults] = useState<RhymeEntry | null>(null);
  const [wordplayResults, setWordplayResults] = useState<WordplaySuggestion[]>([]);
  const [flowResults, setFlowResults] = useState<FlowPattern[]>([]);
  const [flowAdvice, setFlowAdvice] = useState("");
  const [history, setHistory] = useState<SongwriterHistoryItem[]>(generateSongwriterHistory());
  const [syllableCount, setSyllableCount] = useState(0);
  const [selectedText, setSelectedText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-save
  useEffect(() => {
    if (saveStatus === "unsaved") return;
    const timer = setTimeout(() => {
      setSaveStatus("saving");
      setTimeout(() => {
        setSaveStatus("saved");
        setLastSaved(new Date().toLocaleTimeString());
      }, 400);
    }, 1500);
    return () => clearTimeout(timer);
  }, [sections, saveStatus]);

  const handleTextChange = useCallback((text: string) => {
    setUndoStack((s) => [...s.slice(-49), sections[activeTab]]);
    setRedoStack([]);
    setSections((prev) => ({ ...prev, [activeTab]: text }));
    setSaveStatus("unsaved");
  }, [activeTab, sections]);

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    setRedoStack((s) => [...s, sections[activeTab]]);
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setSections((s) => ({ ...s, [activeTab]: prev }));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    setUndoStack((s) => [...s, sections[activeTab]]);
    const next = redoStack[redoStack.length - 1];
    setRedoStack((s) => s.slice(0, -1));
    setSections((s) => ({ ...s, [activeTab]: next }));
  };

  const handleGenerate = async (sectionType: "hook" | "verse" | "bridge" | "full") => {
    setLoading(true);
    setLoadingLabel(sectionType === "full" ? "Writing full song..." : `Writing ${sectionType}...`);
    await new Promise((r) => setTimeout(r, 1200 + Math.random() * 1000));
    const generated = generateLyrics({ topic: topic || "late nights", genre, mood: moods, sectionType });
    const newSections = { ...sections };
    generated.forEach((s) => {
      newSections[s.id] = s.lines;
    });
    setSections(newSections);
    const defaultTab = generated[0]?.id || activeTab;
    setActiveTab(defaultTab);
    setSaveStatus("saved");
    setLastSaved(new Date().toLocaleTimeString());
    setLoading(false);
    setLoadingLabel("");

    // Add to history
    const historyItem: SongwriterHistoryItem = {
      id: `swh-${Date.now()}`,
      type: sectionType === "full" ? "Full Song" : sectionType.charAt(0).toUpperCase() + sectionType.slice(1),
      genre,
      mood: moods,
      preview: generated[0]?.lines.split("\n")[0] + "..." || "",
      timestamp: new Date().toISOString(),
      sections: generated,
    };
    setHistory((h) => [historyItem, ...h.slice(0, 9)]);
  };

  const handleFindRhymes = () => {
    const word = rhymeWord.trim().toLowerCase();
    if (!word) return;
    const entry = rhymeDict.find((r) => r.word === word) || rhymeDict[Math.floor(Math.random() * rhymeDict.length)];
    setRhymeResults(entry);
  };

  const handleWordplay = () => {
    const shuffled = [...wordplayBank].sort(() => Math.random() - 0.5).slice(0, 4);
    setWordplayResults(shuffled);
  };

  const handleFlow = () => {
    const shuffled = [...flowPatterns].sort(() => Math.random() - 0.5);
    setFlowResults(shuffled.slice(0, 3));
    setFlowAdvice("Try varying your syllable density — the current section has a consistent pattern. Breaking it with a shorter phrase on bar 3 would add tension.");
  };

  const handleTextSelect = () => {
    const el = textareaRef.current;
    if (!el) return;
    const selected = el.value.substring(el.selectionStart, el.selectionEnd).trim();
    setSelectedText(selected);
    setSyllableCount(selected ? countSyllables(selected) : countSyllables(sections[activeTab]));
  };

  const activeText = sections[activeTab] || "";
  const lineCount = activeText.split("\n").filter(Boolean).length;
  const charCount = activeText.length;

  const toggleMood = (mood: string) => {
    setMoods((prev) =>
      prev.includes(mood) ? prev.filter((m) => m !== mood) : [...prev, mood].slice(0, 3)
    );
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">AI Songwriter</h1>
        <p className="text-sm text-[var(--color-juice-200)] mt-1">Write, edit, and elevate your lyrics with AI assistance</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Panel — Generator */}
        <div className="lg:col-span-3 space-y-4">
          {/* Topic */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-[var(--color-accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              Generator
            </h3>
            <div className="space-y-3">
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Song topic or concept..."
                className="w-full bg-[var(--color-juice-700)] border border-[var(--color-glass-border)] rounded-lg px-3 py-2 text-sm text-white placeholder-[var(--color-juice-300)] outline-none focus:border-[var(--color-accent)] transition-colors"
              />
              <label className="text-xs text-[var(--color-juice-300)] font-medium">Genre</label>
              <div className="flex flex-wrap gap-1.5">
                {GENRES.map((g) => (
                  <button
                    key={g}
                    onClick={() => setGenre(g)}
                    className={`text-xs px-2.5 py-1 rounded-lg transition-all ${
                      genre === g
                        ? "bg-[var(--color-accent)]/20 border border-[var(--color-accent)]/40 text-white"
                        : "bg-[var(--color-glass-bg)] border border-[var(--color-glass-border)] text-[var(--color-juice-200)] hover:text-white"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <label className="text-xs text-[var(--color-juice-300)] font-medium">
                Mood <span className="text-[var(--color-juice-400)]">(up to 3)</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {MOODS.map((m) => (
                  <button
                    key={m}
                    onClick={() => toggleMood(m)}
                    className={`text-xs px-2.5 py-1 rounded-lg transition-all ${
                      moods.includes(m)
                        ? "bg-[var(--color-accent)]/20 border border-[var(--color-accent)]/40 text-white"
                        : "bg-[var(--color-glass-bg)] border border-[var(--color-glass-border)] text-[var(--color-juice-200)] hover:text-white"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Generate Buttons */}
          <div className="card p-4 space-y-2">
            <h3 className="text-sm font-semibold text-white mb-2">Generate Lyrics</h3>
            <button
              onClick={() => handleGenerate("hook")}
              disabled={loading}
              className="btn-primary w-full text-xs justify-center"
            >
              {loading && loadingLabel === "Writing hook..." ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round" className="opacity-25"/><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="8" strokeLinecap="round"/></svg>
                  Writing hook...
                </span>
              ) : "Write Hook"}
            </button>
            <button
              onClick={() => handleGenerate("verse")}
              disabled={loading}
              className="btn-glass w-full text-xs justify-center"
            >
              Write Verse
            </button>
            <button
              onClick={() => handleGenerate("bridge")}
              disabled={loading}
              className="btn-glass w-full text-xs justify-center"
            >
              Write Bridge
            </button>
            <button
              onClick={() => handleGenerate("full")}
              disabled={loading}
              className="w-full text-xs justify-center inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all cursor-pointer text-white border-0"
              style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899)" }}
            >
              {loading && loadingLabel === "Writing full song..." ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round" className="opacity-25"/><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="8" strokeLinecap="round"/></svg>
                  Writing full song...
                </span>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                  Write Full Song
                </>
              )}
            </button>
          </div>

          {/* AI Tools */}
          <div className="card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white mb-2">AI Tools</h3>

            {/* Rhyme Dictionary */}
            <div>
              <label className="text-xs text-[var(--color-juice-300)] mb-1.5 block">Rhyme Dictionary</label>
              <div className="flex gap-1.5">
                <input
                  value={rhymeWord}
                  onChange={(e) => setRhymeWord(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleFindRhymes()}
                  placeholder="Type a word..."
                  className="flex-1 bg-[var(--color-juice-700)] border border-[var(--color-glass-border)] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-[var(--color-juice-300)] outline-none focus:border-[var(--color-accent)]"
                />
                <button onClick={handleFindRhymes} className="btn-primary text-xs px-3 py-1.5">Find</button>
              </div>
              {rhymeResults && (
                <div className="mt-2 space-y-1.5">
                  <div>
                    <span className="text-[10px] text-[var(--color-juice-400)]">Perfect rhymes:</span>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {rhymeResults.perfect.slice(0, 8).map((r) => (
                        <button key={r} className="text-[10px] px-2 py-0.5 rounded-md bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 text-[var(--color-accent-light)] hover:bg-[var(--color-accent)]/20 transition-all">{r}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--color-juice-400)]">Near rhymes:</span>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {rhymeResults.near.slice(0, 6).map((r) => (
                        <button key={r} className="text-[10px] px-2 py-0.5 rounded-md bg-[var(--color-glass-bg)] border border-[var(--color-glass-border)] text-[var(--color-juice-200)] hover:text-white hover:border-[var(--color-glass-border-hover)] transition-all">{r}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button onClick={handleWordplay} className="btn-glass w-full text-xs justify-center">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
              Suggest Wordplay
            </button>
            {wordplayResults.length > 0 && (
              <div className="space-y-2 mt-1">
                {wordplayResults.map((wp, i) => (
                  <div key={i} className="p-2 rounded-lg bg-[var(--color-glass-bg)] border border-[var(--color-glass-border)]">
                    <span className="text-[10px] uppercase tracking-wider text-[var(--color-accent-light)] font-semibold">{wp.type}</span>
                    <p className="text-xs text-white mt-0.5 leading-relaxed">{wp.text}</p>
                    <p className="text-[10px] text-[var(--color-juice-300)] mt-0.5">{wp.context}</p>
                  </div>
                ))}
              </div>
            )}

            <button onClick={handleFlow} className="btn-glass w-full text-xs justify-center">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/></svg>
              Improve Flow
            </button>
            {flowResults.length > 0 && (
              <div className="space-y-2 mt-1">
                <p className="text-xs text-[var(--color-juice-200)] italic">{flowAdvice}</p>
                {flowResults.map((f, i) => (
                  <div key={i} className="p-2 rounded-lg bg-[var(--color-glass-bg)] border border-[var(--color-glass-border)]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">{f.name}</span>
                      <span className="text-[10px] text-[var(--color-juice-300)]">{f.bpm} BPM</span>
                    </div>
                    <p className="text-[10px] text-[var(--color-accent-light)] font-mono mt-0.5">{f.pattern}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Syllable counter */}
            <div className="pt-2 border-t border-[var(--color-glass-border)]">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--color-juice-300)]">Syllable count</span>
                <span className="text-sm font-bold text-[var(--color-accent-light)]">{syllableCount || countSyllables(activeText)}</span>
              </div>
              {selectedText && (
                <p className="text-[10px] text-[var(--color-juice-400)] mt-0.5 truncate">Selected: "{selectedText.slice(0, 30)}{selectedText.length > 30 ? "..." : ""}"</p>
              )}
            </div>
          </div>
        </div>

        {/* Center — Lyrics Editor */}
        <div className="lg:col-span-6 space-y-4">
          {/* Section tabs */}
          <div className="flex gap-1.5 flex-wrap items-center">
            {SECTION_TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => { setActiveTab(t.id); }}
                className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                  activeTab === t.id
                    ? "bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/30 text-white"
                    : "bg-[var(--color-glass-bg)] border border-[var(--color-glass-border)] text-[var(--color-juice-200)] hover:text-white hover:border-[var(--color-glass-border-hover)]"
                }`}
              >
                {t.label}
              </button>
            ))}
            <div className="flex-1" />
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                className="btn-glass p-1.5 text-xs disabled:opacity-30"
                title="Undo (Ctrl+Z)"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4"/></svg>
              </button>
              <button
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                className="btn-glass p-1.5 text-xs disabled:opacity-30"
                title="Redo (Ctrl+Y)"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10H11a5 5 0 00-5 5v2M21 10l-4-4M21 10l-4 4"/></svg>
              </button>
            </div>
          </div>

          {/* Editor */}
          <div className="card p-0 overflow-hidden">
            <div className="flex bg-[var(--color-juice-800)]">
              {/* Line numbers */}
              <div className="py-4 pl-4 pr-2 text-right select-none flex-shrink-0">
                {activeText.split("\n").map((_, i) => (
                  <div
                    key={i}
                    className="text-xs text-[var(--color-juice-400)] leading-[1.9] font-mono"
                    style={{ lineHeight: "1.9" }}
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={activeText}
                onChange={(e) => handleTextChange(e.target.value)}
                onSelect={handleTextSelect}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); handleUndo(); }
                  if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key === "z"))) { e.preventDefault(); handleRedo(); }
                }}
                className="w-full h-[400px] bg-transparent text-white text-sm leading-relaxed resize-none outline-none py-4 pr-4 placeholder-[var(--color-juice-400)]"
                style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Inter', monospace", lineHeight: "1.9", fontSize: "0.825rem" }}
                placeholder="Start writing your lyrics here..."
                spellCheck={false}
              />
            </div>
            {/* Status bar */}
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-[var(--color-glass-border)] bg-[var(--color-juice-800)]/50">
              <div className="flex items-center gap-3 text-[11px] text-[var(--color-juice-300)]">
                <span>{lineCount} lines</span>
                <span className="text-[var(--color-juice-500)]">·</span>
                <span>{charCount} characters</span>
                <span className="text-[var(--color-juice-500)]">·</span>
                <span>{syllableCount || countSyllables(activeText)} syllables</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                {saveStatus === "saving" ? (
                  <span className="text-[var(--color-juice-300)] flex items-center gap-1">
                    <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" className="opacity-25"/></svg>
                    Saving...
                  </span>
                ) : saveStatus === "saved" ? (
                  <span className="text-[#22c55e] flex items-center gap-1">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7"/></svg>
                    Saved {lastSaved}
                  </span>
                ) : (
                  <span className="text-[var(--color-juice-300)]">Unsaved changes</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel — Ideas & History */}
        <div className="lg:col-span-3 space-y-4">
          {/* History */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-[var(--color-accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              History
            </h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {history.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    const newSections = { ...sections };
                    item.sections.forEach((s) => { newSections[s.id] = s.lines; });
                    setSections(newSections);
                    setActiveTab(item.sections[0]?.id || activeTab);
                  }}
                  className="w-full text-left p-2.5 rounded-lg bg-[var(--color-glass-bg)] border border-[var(--color-glass-border)] hover:border-[var(--color-glass-border-hover)] transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-white">{item.type}</span>
                    <span className="text-[10px] text-[var(--color-juice-300)]">{new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-accent)]/10 text-[var(--color-accent-light)]">{item.genre}</span>
                    {item.mood.slice(0, 2).map((m) => (
                      <span key={m} className="text-[10px] text-[var(--color-juice-400)]">{m}</span>
                    ))}
                  </div>
                  <p className="text-[10px] text-[var(--color-juice-300)] mt-1.5 truncate group-hover:text-[var(--color-juice-200)]">{item.preview}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Tips */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-white mb-2">Quick Tips</h3>
            <ul className="space-y-2 text-xs text-[var(--color-juice-200)]">
              <li className="flex gap-2">
                <span className="text-[var(--color-accent-light)] mt-0.5">⌨</span>
                <span>Ctrl+Z to undo, Ctrl+Y to redo</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[var(--color-accent-light)] mt-0.5">📝</span>
                <span>Select text to count syllables</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[var(--color-accent-light)] mt-0.5">🎯</span>
                <span>Use "Full Song" for complete structure</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Setup Wizard ──────────────────────────────────────────
// First-time setup flow for Juice Studio
import { useState, useCallback, useEffect } from "react";

interface SetupWizardProps {
  onComplete: (data: { userName: string; apiKeys: Record<string, string> }) => void;
}

type Step = "welcome" | "name" | "apikeys" | "ready";

const stepOrder: Step[] = ["welcome", "name", "apikeys", "ready"];
const stepLabels = ["Welcome", "Name", "API Keys", "Ready"];

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState<Step>("welcome");
  const [userName, setUserName] = useState("King Juice");
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({
    openai: "",
    anthropic: "",
  });
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [entering, setEntering] = useState(false);

  const currentIdx = stepOrder.indexOf(step);
  const progressPercent = Math.round(((currentIdx) / (stepOrder.length - 1)) * 100);

  const goTo = useCallback(
    (nextStep: Step) => {
      const nextIdx = stepOrder.indexOf(nextStep);
      const curIdx = stepOrder.indexOf(step);
      setDirection(nextIdx > curIdx ? "forward" : "back");
      setStep(nextStep);
    },
    [step],
  );

  const handleComplete = useCallback(() => {
    setEntering(true);
    setTimeout(() => {
      onComplete({ userName, apiKeys });
    }, 1500);
  }, [userName, apiKeys, onComplete]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (entering) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        const nextIdx = currentIdx + 1;
        if (nextIdx < stepOrder.length) goTo(stepOrder[nextIdx]);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const prevIdx = currentIdx - 1;
        if (prevIdx >= 0) goTo(stepOrder[prevIdx]);
      } else if (e.key === "Enter" && step !== "ready") {
        e.preventDefault();
        if (step === "welcome") goTo("name");
        else if (step === "name" && userName.trim()) goTo("apikeys");
        else if (step === "apikeys") goTo("ready");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [step, currentIdx, goTo, userName, entering]);

  const slideClass = direction === "forward" ? "animate-slideUp" : "animate-slideUp";
  const slideKey = `${step}-${direction}`;

  if (entering) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-juice-900)] p-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-purple-600/10 blur-[120px] animate-glowPulse" />
        </div>
        <div className="relative text-center phase-fade">
          <div className="mx-auto mb-6 w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-600 to-purple-900 flex items-center justify-center animate-scaleIn">
            <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-3">Preparing your studio...</h2>
          <div className="w-64 mx-auto">
            <div className="progress-bar-gradient">
              <div className="progress-bar-gradient-fill animate-slideUp" style={{ width: "100%" }} />
            </div>
          </div>
          <p className="text-[var(--color-juice-300)] text-sm mt-4">Setting up {userName}'s workspace</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-juice-900)] p-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-purple-600/10 blur-[120px]" />
        <div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] rounded-full bg-purple-500/10 blur-[80px]" />
      </div>

      <div className="relative w-full max-w-lg glass-panel animate-scaleIn overflow-hidden">
        {/* Progress bar */}
        <div className="progress-bar-gradient rounded-none">
          <div
            className="progress-bar-gradient-fill rounded-none"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="p-8">
          {/* Step content with transition */}
          <div key={slideKey} className={slideClass}>
            {step === "welcome" && (
              <div className="text-center">
                <div className="mx-auto mb-6 w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-600 to-purple-900 flex items-center justify-center">
                  <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
                <h1 className="text-3xl font-bold mb-3 bg-gradient-to-r from-purple-400 to-purple-200 bg-clip-text text-transparent">
                  Welcome to Juice Studio
                </h1>
                <p className="text-[var(--color-juice-200)] mb-8 text-base leading-relaxed">
                  Your world-class, AI-native recording studio — dark, minimal, and fast.
                  <br />
                  Let's set up your studio in under a minute.
                </p>
                <button onClick={() => goTo("name")} className="btn-primary w-full text-base py-3">
                  Get Started
                </button>
                <p className="text-[var(--color-juice-300)] text-xs mt-3">Press Enter or → to continue</p>
              </div>
            )}

            {step === "name" && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-[var(--color-juice-300)] bg-[var(--color-juice-700)] px-2 py-0.5 rounded-full">Step 1 of 3</span>
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">What should we call you?</h2>
                <p className="text-[var(--color-juice-200)] text-sm mb-6">
                  This is how the AI will address you throughout the app.
                </p>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full bg-[var(--color-juice-700)] border border-[var(--color-glass-border)] rounded-xl px-4 py-3 text-white text-base placeholder:text-[var(--color-juice-300)] focus:outline-none focus:border-purple-500 transition-colors mb-6"
                  placeholder="Enter your name..."
                  autoFocus
                />
                <div className="flex gap-3">
                  <button onClick={() => goTo("welcome")} className="btn-glass flex-1">
                    Back
                  </button>
                  <button
                    onClick={() => goTo("apikeys")}
                    disabled={!userName.trim()}
                    className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {step === "apikeys" && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-[var(--color-juice-300)] bg-[var(--color-juice-700)] px-2 py-0.5 rounded-full">Step 2 of 3</span>
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">API Keys</h2>
                <p className="text-[var(--color-juice-200)] text-sm mb-6">
                  Add your AI provider keys for real-time assistance. Skip for now — the AI will work in offline mode.
                </p>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="text-sm font-medium text-[var(--color-juice-100)] mb-1.5 block">
                      OpenAI API Key
                    </label>
                    <input
                      type="password"
                      value={apiKeys.openai}
                      onChange={(e) => setApiKeys((k) => ({ ...k, openai: e.target.value }))}
                      className="w-full bg-[var(--color-juice-700)] border border-[var(--color-glass-border)] rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-[var(--color-juice-300)] focus:outline-none focus:border-purple-500 transition-colors"
                      placeholder="sk-..."
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[var(--color-juice-100)] mb-1.5 block">
                      Anthropic API Key
                    </label>
                    <input
                      type="password"
                      value={apiKeys.anthropic}
                      onChange={(e) => setApiKeys((k) => ({ ...k, anthropic: e.target.value }))}
                      className="w-full bg-[var(--color-juice-700)] border border-[var(--color-glass-border)] rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-[var(--color-juice-300)] focus:outline-none focus:border-purple-500 transition-colors"
                      placeholder="sk-ant-..."
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => goTo("name")} className="btn-glass flex-1">
                    Back
                  </button>
                  <button onClick={() => goTo("ready")} className="btn-glass flex-1 border-purple-500/30 text-purple-300">
                    Skip for now
                  </button>
                  <button onClick={() => goTo("ready")} className="btn-primary flex-1">
                    Continue
                  </button>
                </div>
              </div>
            )}

            {step === "ready" && (
              <div className="text-center">
                <div className="flex items-center gap-2 mb-4 justify-center">
                  <span className="text-xs text-[var(--color-juice-300)] bg-[var(--color-juice-700)] px-2 py-0.5 rounded-full">Step 3 of 3</span>
                </div>

                {/* Animated checkmark */}
                <div className="mx-auto mb-6 w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-white"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline
                      points="20 6 9 17 4 12"
                      strokeDasharray="30"
                      strokeDashoffset="30"
                      style={{ animation: "strokeDraw 0.6s 0.2s ease-out forwards" }}
                    />
                  </svg>
                </div>

                <h2 className="text-2xl font-bold text-white mb-3">
                  Your studio is ready, {userName}.
                </h2>

                <div className="glass-panel bg-[var(--color-juice-800)] p-4 rounded-xl mb-6 text-left text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[var(--color-juice-300)]">Name</span>
                    <span className="text-white font-medium">{userName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-juice-300)]">AI Mode</span>
                    <span className="text-white font-medium">
                      {apiKeys.openai || apiKeys.anthropic ? "Live AI" : "Offline Mode"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-juice-300)]">Theme</span>
                    <span className="text-white font-medium">Dark</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-juice-300)]">Modules</span>
                    <span className="text-white font-medium">11</span>
                  </div>
                </div>

                <button onClick={handleComplete} className="btn-primary w-full text-base py-3">
                  Enter Studio
                </button>
              </div>
            )}
          </div>

          {/* Step dots */}
          <div className="flex items-center justify-center gap-2 mt-6">
            {stepOrder.map((s, i) => {
              const isActive = step === s;
              const isCompleted = currentIdx > i;
              return (
                <div
                  key={s}
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-300 flex items-center justify-center ${
                    isActive
                      ? "bg-purple-500 animate-glowPulse"
                      : isCompleted
                      ? "bg-purple-400"
                      : "bg-[var(--color-juice-500)]"
                  }`}
                >
                  {isCompleted && (
                    <svg className="w-2 h-2 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

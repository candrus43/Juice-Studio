// ─── Root Route ────────────────────────────────────────────
// Auth gate, setup wizard, persistence provider, settings panel.
import { useState, useEffect, useCallback } from "react";
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
  useLocation,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import appCss from "~/styles/app.css?url";
import { Sidebar } from "~/components/Sidebar";
import { TopBar } from "~/components/TopBar";
import { AIAssistant } from "~/components/AIAssistant";
import { SetupWizard } from "~/components/SetupWizard";
import { LoginScreen } from "~/components/LoginScreen";
import { SettingsPanel } from "~/components/SettingsPanel";
import { useAutoSave } from "~/components/AutoSave";
import {
  getSettings,
  saveSettings,
  getAuthToken,
  clearAuth,
  getPasswordHash,
  setApiKeys,
} from "~/persistence";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Juice Studio" },
      { name: "description", content: "Juice Studio — AI-native recording studio for King Juice" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" },
    ],
  }),
  notFoundComponent: () => (
    <div className="flex items-center justify-center min-h-screen bg-[var(--color-juice-900)]">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-white mb-4">404</h1>
        <p className="text-[var(--color-juice-200)]">Page not found</p>
      </div>
    </div>
  ),
  component: RootComponent,
});

type AppPhase = "loading" | "setup" | "login" | "app";

function RootComponent() {
  const [phase, setPhase] = useState<AppPhase>("loading");
  const [userName, setUserName] = useState("King Juice");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const location = useLocation();

  // In-app state that gets auto-saved (used as a demo persistence key)
  const [appState, setAppState] = useState<Record<string, unknown>>({
    lastVisit: new Date().toISOString(),
  });

  // Auto-save hook for app-wide state
  const autoSaveState = useAutoSave(
    appState,
    async (data) => {
      await saveSettings({
        preferences: {
          ...((await getSettings()).preferences || {}),
          lastAppState: data,
        },
      });
    },
    500,
  );

  // Check auth state on mount
  useEffect(() => {
    (async () => {
      try {
        // Check if there's a valid auth token
        const token = getAuthToken();
        const pwHash = getPasswordHash();
        setHasPassword(!!pwHash);

        if (token) {
          // Already authenticated — check if setup is complete
          const settings = await getSettings();
          setUserName(settings.userName || "King Juice");
          if (!settings.setupComplete) {
            setPhase("setup");
          } else {
            setPhase("app");
          }
        } else if (!pwHash) {
          // No password set — show setup directly
          setPhase("setup");
        } else {
          // Has password but no valid token — show login
          setPhase("login");
        }
      } catch {
        // Fallback: show setup
        setPhase("setup");
      }
    })();
  }, []);

  const handleSetupComplete = useCallback(
    async (data: { userName: string; apiKeys: Record<string, string> }) => {
      setUserName(data.userName || "King Juice");
      // Save API keys
      if (data.apiKeys.openai || data.apiKeys.anthropic) {
        setApiKeys(data.apiKeys);
      }
      // Mark setup as complete
      await saveSettings({ setupComplete: true, userName: data.userName || "King Juice" });
      setPhase("login");
    },
    [],
  );

  const handleLogin = useCallback(
    (name: string) => {
      setUserName(name || "King Juice");
      setPhase("app");
    },
    [],
  );

  const handleLogout = useCallback(() => {
    clearAuth();
    setPhase("login");
  }, []);

  // Show loading state briefly — branded skeleton
  if (phase === "loading") {
    return (
      <RootDocument>
        <div className="flex items-center justify-center min-h-screen bg-[var(--color-juice-900)]">
          <div className="text-center phase-fade">
            <div className="mx-auto mb-6 w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-purple-900 flex items-center justify-center">
              <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <div className="w-48 mx-auto">
              <div className="skeleton-bar" />
            </div>
          </div>
        </div>
      </RootDocument>
    );
  }

  // Setup wizard
  if (phase === "setup") {
    return (
      <RootDocument>
        <SetupWizard onComplete={handleSetupComplete} />
      </RootDocument>
    );
  }

  // Login gate
  if (phase === "login") {
    return (
      <RootDocument>
        <LoginScreen onLogin={handleLogin} hasPassword={hasPassword} />
      </RootDocument>
    );
  }

  // Main app
  return (
    <RootDocument>
      <div className="flex min-h-screen bg-[var(--color-juice-900)]">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar
            autoSaveState={autoSaveState}
            onOpenSettings={() => setSettingsOpen(true)}
            userName={userName}
          />
          <main className="flex-1 page-transition" key={location.pathname}>
            <Outlet />
          </main>
        </div>
        <AIAssistant />
      </div>
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onLogout={handleLogout}
      />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-[var(--color-juice-900)] text-white antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

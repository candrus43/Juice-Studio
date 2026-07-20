// ─── Login Screen ──────────────────────────────────────────
// Lightweight local auth gate for single-user Juice Studio.
// NOTE: This is intentionally simple — replace with real auth
// (Clerk, Auth0, Supabase) for multi-user or production deployment.
import { useState, useCallback, FormEvent } from "react";
import { verifyPassword, setPasswordHash, hashPassword, setAuthToken, getRememberMe } from "../persistence";

interface LoginScreenProps {
  onLogin: (userName: string) => void;
  hasPassword: boolean;
}

export function LoginScreen({ onLogin, hasPassword }: LoginScreenProps) {
  const [userName, setUserName] = useState("King Juice");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(getRememberMe());
  const [isRegistering, setIsRegistering] = useState(!hasPassword);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError("");
      setLoading(true);

      try {
        if (isRegistering) {
          // Set up password for the first time
          if (password.length < 4) {
            setError("Password must be at least 4 characters.");
            setLoading(false);
            setShake(true);
            setTimeout(() => setShake(false), 500);
            return;
          }
          if (password !== confirmPassword) {
            setError("Passwords don't match.");
            setLoading(false);
            setShake(true);
            setTimeout(() => setShake(false), 500);
            return;
          }
          const hash = await hashPassword(password);
          setPasswordHash(hash);
          const token = await hashPassword(userName + ":" + hash + ":" + Date.now());
          setAuthToken(token, rememberMe);
          onLogin(userName.trim() || "King Juice");
        } else {
          // Login with existing password
          const valid = await verifyPassword(password);
          if (!valid) {
            setError("Invalid password. Try again.");
            setLoading(false);
            setShake(true);
            setTimeout(() => setShake(false), 500);
            return;
          }
          const hash = await hashPassword(password);
          const token = await hashPassword(userName + ":" + hash + ":" + Date.now());
          setAuthToken(token, rememberMe);
          onLogin(userName.trim() || "King Juice");
        }
      } catch {
        setError("Something went wrong. Please try again.");
        setShake(true);
        setTimeout(() => setShake(false), 500);
      }
      setLoading(false);
    },
    [password, confirmPassword, userName, isRegistering, rememberMe, onLogin]
  );

  const toggleMode = useCallback(() => {
    setIsRegistering(!isRegistering);
    setError("");
  }, [isRegistering]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-juice-900)] p-4">
      {/* Background glow with slow pulse */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-purple-600/8 blur-[120px]"
          style={{ animation: "bgGlowPulse 6s ease-in-out infinite" }}
        />
      </div>

      <div className={`relative w-full max-w-md glass-panel p-8 ${shake ? "animate-shakeX" : ""}`}>
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-purple-900 flex items-center justify-center animate-scaleIn">
            <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1 phase-fade" key={isRegistering ? "reg" : "login"}>
            {isRegistering ? "Create your password" : "Welcome back"}
          </h1>
          <p className="text-[var(--color-juice-200)] text-sm phase-fade" key={(isRegistering ? "reg" : "login") + "-sub"}>
            {isRegistering
              ? "Set a password to protect your studio."
              : "Enter your password to continue."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-[var(--color-juice-100)] mb-1.5 block">
              Name
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full bg-[var(--color-juice-700)] border border-[var(--color-glass-border)] rounded-xl px-4 py-2.5 text-white placeholder:text-[var(--color-juice-300)] focus:outline-none focus:border-purple-500 transition-colors"
              placeholder="Your name..."
            />
          </div>

          <div>
            <label className="text-sm font-medium text-[var(--color-juice-100)] mb-1.5 block">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[var(--color-juice-700)] border border-[var(--color-glass-border)] rounded-xl px-4 py-2.5 pr-10 text-white placeholder:text-[var(--color-juice-300)] focus:outline-none focus:border-purple-500 transition-colors"
                placeholder={isRegistering ? "Create a password..." : "Enter your password..."}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-juice-300)] hover:text-white transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {isRegistering && (
            <div>
              <label className="text-sm font-medium text-[var(--color-juice-100)] mb-1.5 block">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-[var(--color-juice-700)] border border-[var(--color-glass-border)] rounded-xl px-4 py-2.5 pr-10 text-white placeholder:text-[var(--color-juice-300)] focus:outline-none focus:border-purple-500 transition-colors"
                  placeholder="Confirm your password..."
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-juice-300)] hover:text-white transition-colors"
                  tabIndex={-1}
                >
                  {showConfirm ? (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 phase-fade">
              {error}
            </div>
          )}

          {!isRegistering && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-[var(--color-glass-border)] bg-[var(--color-juice-700)] text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm text-[var(--color-juice-200)]">Remember me for 30 days</span>
            </label>
          )}

          <button
            type="submit"
            disabled={loading || !userName.trim() || !password}
            className="btn-primary w-full py-3 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {isRegistering ? "Creating..." : "Signing in..."}
              </span>
            ) : isRegistering ? (
              "Create Password"
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        {hasPassword && (
          <p className="text-[var(--color-juice-300)] text-xs text-center mt-6">
            {isRegistering ? (
              <>
                Already have a password?{" "}
                <button onClick={toggleMode} className="text-[var(--color-accent-light)] hover:underline">
                  Sign in
                </button>
              </>
            ) : (
              <>
                First time here?{" "}
                <button onClick={toggleMode} className="text-[var(--color-accent-light)] hover:underline">
                  Create password
                </button>
              </>
            )}
          </p>
        )}

        <p className="text-[var(--color-juice-300)] text-xs text-center mt-4">
          Juice Studio — personal studio for {userName || "King Juice"}
        </p>
      </div>
    </div>
  );
}

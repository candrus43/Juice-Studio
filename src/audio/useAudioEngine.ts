/**
 * React hook for the Juice Studio Audio Engine.
 * Provides lazy AudioContext initialization and cleanup.
 */
import { useEffect, useRef, useCallback } from "react";
import { getContext, resume, dispose } from "./engine";

/**
 * Hook that initializes the AudioContext on first user interaction
 * and cleans up on unmount.
 */
export function useAudioEngine() {
  const ctxRef = useRef<AudioContext | null>(null);
  const initializedRef = useRef(false);

  // Initialize on first render (but context might be suspended)
  useEffect(() => {
    return () => {
      // Don't dispose here — engine is a singleton
    };
  }, []);

  const init = useCallback(() => {
    if (!initializedRef.current) {
      try {
        ctxRef.current = getContext();
        initializedRef.current = true;
      } catch {
        // Browser-only — will retry on next gesture
      }
    }
    if (ctxRef.current && ctxRef.current.state === "suspended") {
      resume();
    }
  }, []);

  const cleanup = useCallback(() => {
    dispose();
    initializedRef.current = false;
    ctxRef.current = null;
  }, []);

  return {
    /** Call on a user gesture to initialize/resume audio context */
    init,
    /** Fully cleanup all audio resources */
    cleanup,
    /** Whether audio context has been initialized */
    initialized: initializedRef.current,
    /** The AudioContext (null if not browser/inited) */
    ctx: ctxRef.current,
  };
}

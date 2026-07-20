// ─── AutoSave Hook & Save Indicator ───────────────────────
import { useEffect, useRef, useState, useCallback } from "react";

interface AutoSaveState {
  status: "idle" | "saving" | "saved" | "error";
  lastSavedAt: Date | null;
}

export function useAutoSave<T>(
  data: T,
  saveFn: (data: T) => Promise<void>,
  debounceMs: number = 500
): AutoSaveState {
  const [state, setState] = useState<AutoSaveState>({
    status: "idle",
    lastSavedAt: null,
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);
  const dataRef = useRef(data);
  dataRef.current = data;

  const debouncedSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      if (!isMounted.current) return;
      setState((s) => ({ ...s, status: "saving" }));
      try {
        await saveFn(dataRef.current);
        if (isMounted.current) {
          setState({ status: "saved", lastSavedAt: new Date() });
        }
      } catch {
        if (isMounted.current) {
          setState((s) => ({ ...s, status: "error" }));
        }
      }
    }, debounceMs);
  }, [saveFn, debounceMs]);

  useEffect(() => {
    debouncedSave();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, debouncedSave]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return state;
}

/** Visual auto-save indicator for the TopBar */
export function AutoSaveIndicator({ state }: { state: AutoSaveState }) {
  const { status, lastSavedAt } = state;

  const formattedTime = lastSavedAt
    ? lastSavedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : null;

  let dot = "bg-[var(--color-juice-400)]";
  let text = "Unsaved";
  let textColor = "text-[var(--color-juice-300)]";

  if (status === "saving") {
    dot = "bg-yellow-500 animate-pulse";
    text = "Saving...";
    textColor = "text-yellow-400";
  } else if (status === "saved") {
    dot = "bg-green-500";
    text = "Saved";
    textColor = "text-green-400";
  } else if (status === "error") {
    dot = "bg-red-500";
    text = "Save failed";
    textColor = "text-red-400";
  }

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${dot}`} />
      <span className={`text-xs ${textColor}`}>
        {text}
        {formattedTime && status === "saved" && (
          <span className="text-[var(--color-juice-300)] ml-1">{formattedTime}</span>
        )}
      </span>
    </div>
  );
}

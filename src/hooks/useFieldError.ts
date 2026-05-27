import { useCallback, useRef, useState } from "react";

export interface FieldErrorState {
  /** Current error message (or null for no error). */
  error: string | null;
  /** True while shake animation is playing — consume as className. */
  shaking: boolean;
  /** Sets + triggers shake for `durationMs` (default 280 to match .df-input--shake). */
  trigger: (message: string, durationMs?: number) => void;
  /** Clears error and shake immediately. */
  clear: () => void;
}

/**
 * Form field error controller — toggles .df-input--error + .df-input--shake
 * for a controlled duration. Pair with DfInput's `error` + `shake` props:
 *
 *   const err = useFieldError();
 *   err.trigger("Name required");
 *   <DfInput error={!!err.error} shake={err.shaking} />
 */
export function useFieldError(): FieldErrorState {
  const [error, setError] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const timerRef = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setError(null);
    setShaking(false);
  }, []);

  const trigger = useCallback((message: string, durationMs = 280) => {
    setError(message);
    setShaking(true);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setShaking(false);
      timerRef.current = null;
    }, durationMs);
  }, []);

  return { error, shaking, trigger, clear };
}

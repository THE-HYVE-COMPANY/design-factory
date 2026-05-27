import { useCallback, useEffect, useRef, useState } from "react";

export interface UndoableOptions<T> {
  /** Payload describing the pending action (e.g. `{ id, name }`). */
  payload: T;
  /** Seconds the user has to undo. Default 5. Maps to --df-undo-duration. */
  windowSeconds?: number;
  /** Callback fired when the timer expires — the action is committed. */
  onCommit: (payload: T) => void | Promise<void>;
  /** Optional callback when user explicitly undoes. */
  onUndo?: (payload: T) => void;
}

export interface UndoableState<T> {
  pending: T | null;
  /** Seconds remaining until commit. */
  remaining: number;
  /** Inline-style helper for the .df-undo-chip progress pseudo. */
  chipStyle: { ["--df-undo-duration"]?: string };
  /** Register + start the undo window. */
  start: () => void;
  /** Dismiss window + fire onUndo. */
  undo: () => void;
}

/**
 * 5-second rollback window for destructive actions (delete, archive, replace).
 * Pair with the `.df-undo-chip` class — either render the chip inline or in a
 * toast via useToast().push({ body: chip, duration: 5200 }).
 *
 * Usage:
 *   const rollback = useUndoableAction({
 *     payload: { id },
 *     onCommit: ({ id }) => api.deleteForReal(id),
 *   });
 *   // on user click: rollback.start(); render chip with Undo button.
 */
export function useUndoableAction<T>({
  payload,
  windowSeconds = 5,
  onCommit,
  onUndo,
}: UndoableOptions<T>): UndoableState<T> {
  const [pending, setPending] = useState<T | null>(null);
  const [remaining, setRemaining] = useState(windowSeconds);
  const tickRef = useRef<number | null>(null);
  const commitRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (commitRef.current) {
      window.clearTimeout(commitRef.current);
      commitRef.current = null;
    }
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(() => {
    cleanup();
    setPending(payload);
    setRemaining(windowSeconds);
    tickRef.current = window.setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    commitRef.current = window.setTimeout(() => {
      cleanup();
      setPending(null);
      void onCommit(payload);
    }, windowSeconds * 1000);
  }, [payload, windowSeconds, onCommit, cleanup]);

  const undo = useCallback(() => {
    if (!pending) return;
    cleanup();
    const p = pending;
    setPending(null);
    setRemaining(windowSeconds);
    onUndo?.(p);
  }, [pending, windowSeconds, onUndo, cleanup]);

  const chipStyle: { ["--df-undo-duration"]?: string } = {
    ["--df-undo-duration"]: `${windowSeconds}s`,
  };

  return { pending, remaining, chipStyle, start, undo };
}

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { DfToastData } from "@/components/DfToast";

type PushArgs = Omit<DfToastData, "id" | "out">;

interface ToastContextValue {
  toasts: DfToastData[];
  push: (t: PushArgs) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 5000;
const EXIT_ANIMATION_MS = 200;

/** Mount once near the root. All descendants can call useToast(). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<DfToastData[]>([]);
  const counter = useRef(0);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismiss = useCallback(
    (id: string) => {
      // Flag as out-of-stack so animation can play, then remove.
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, out: true } : t)));
      window.setTimeout(() => remove(id), EXIT_ANIMATION_MS);
    },
    [remove]
  );

  const push = useCallback(
    (t: PushArgs): string => {
      const id = `toast-${++counter.current}`;
      const duration = t.duration ?? DEFAULT_DURATION;
      setToasts((prev) => [...prev, { ...t, id }]);
      if (duration > 0) {
        window.setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  const clear = useCallback(() => setToasts([]), []);

  const value = useMemo(() => ({ toasts, push, dismiss, clear }), [toasts, push, dismiss, clear]);

  return createElement(ToastContext.Provider, { value }, children);
}

/**
 * Hook to enqueue/dismiss toasts. Must be called inside a ToastProvider.
 * Falls back to a noop + console.warn when unmounted (eases test harnesses).
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    if (typeof console !== "undefined") {
      console.warn("[useToast] called outside <ToastProvider /> — returning noop");
    }
    return {
      toasts: [],
      push: () => "",
      dismiss: () => {},
      clear: () => {},
    };
  }
  return ctx;
}

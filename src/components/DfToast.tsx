import type { ReactNode } from "react";
import { useToast } from "@/hooks/useToast";

/** Toast payload rendered in the global stack. */
export interface DfToastData {
  id: string;
  severity: "info" | "ok" | "warn" | "danger";
  title: ReactNode;
  body?: ReactNode;
  action?: { label: string; onClick: () => void };
  icon?: ReactNode;
  /** Duration in ms. 0 disables auto-dismiss. */
  duration?: number;
  /** Set to "out" when the item is exiting — consumed by df-toast-out animation. */
  out?: boolean;
}

/**
 * Global toast stack. Render once near the root (e.g. in App.tsx) and call
 * `useToast().push(...)` from anywhere to enqueue toasts.
 *
 * The stack fixed-positions to bottom-right. Each toast plays df-toast-in on
 * mount and df-toast-out when `out` is true. useToast handles timeout + gc.
 */
export function DfToastStack() {
  const { toasts, dismiss } = useToast();
  if (toasts.length === 0) return null;
  return (
    <div className="df-toast-stack" role="region" aria-live="polite" aria-label="Notifications">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={[
            "df-toast",
            `df-toast--${t.severity}`,
            t.out && "out",
          ]
            .filter(Boolean)
            .join(" ")}
          role={t.severity === "danger" ? "alert" : "status"}
        >
          {t.icon && <span className="icon">{t.icon}</span>}
          <div className="body">
            <div className="title">{t.title}</div>
            {t.body && <div className="sub">{t.body}</div>}
          </div>
          {t.action && (
            <button
              type="button"
              className="action"
              onClick={() => {
                t.action!.onClick();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

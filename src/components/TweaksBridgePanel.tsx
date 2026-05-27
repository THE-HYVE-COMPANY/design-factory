import { useEffect, useMemo, useRef, useState } from "react";
import {
  createThrottledTweaksSender,
  postTweaksToIframe,
  listenTweaksFromIframe,
  type TweaksIncomingMessage,
} from "@/runtime/tweaks-bridge";

// TweaksBridgePanel — deliverable 1 (UI half).
//
// Real-time CSS variable knobs that round-trip through the iframe via
// postMessage (no srcdoc reload). Latency target <50ms vs ~500ms for the
// previous "regen tweaks via Claude" flow.
//
// Design choices:
//   - Knob list is a fixed default set covering the most-tweaked vars
//     (accent, bg, fg, radius, base font size, body padding, line-
//     height). Users can extend later via `extraKnobs` prop.
//   - We intentionally don't ship a full design-token editor here —
//     that lives in TokensPanel.tsx for the framework UI itself, not
//     for the artifact preview.
//   - State is local. Persistence per-project is an EditorScreen concern.
//   - We surface a "Reset" and an "Export CSS" path, both honouring the
//     `df:tweaks:*` wire format.

export interface TweakKnob {
  id: string;
  cssVar: string;          // e.g. "--accent"
  label: string;
  kind: "color" | "number" | "text";
  defaultValue: string;
  min?: number;            // for kind=number
  max?: number;
  step?: number;
  unit?: string;           // suffix appended to the postMessage payload
}

export const DEFAULT_KNOBS: TweakKnob[] = [
  { id: "accent", cssVar: "--accent", label: "Accent", kind: "color", defaultValue: "#ef5d3b" },
  { id: "bg", cssVar: "--bg", label: "Background", kind: "color", defaultValue: "#ffffff" },
  { id: "fg", cssVar: "--fg", label: "Foreground", kind: "color", defaultValue: "#1a1a1a" },
  { id: "radius", cssVar: "--radius", label: "Radius", kind: "number", defaultValue: "8", min: 0, max: 32, step: 1, unit: "px" },
  { id: "base-fs", cssVar: "--base-fs", label: "Base font size", kind: "number", defaultValue: "16", min: 12, max: 24, step: 1, unit: "px" },
  { id: "pad", cssVar: "--pad", label: "Body padding", kind: "number", defaultValue: "24", min: 0, max: 96, step: 2, unit: "px" },
  { id: "line-height", cssVar: "--line-height", label: "Line height", kind: "number", defaultValue: "1.5", min: 1, max: 2, step: 0.05 },
];

interface TweaksBridgePanelProps {
  iframeRef: React.RefObject<HTMLIFrameElement>;
  // True once the iframe has acked at least one message — used to
  // disable the controls during initial mount before the listener is
  // ready to receive postMessage.
  ready?: boolean;
  // Optional override — defaults to DEFAULT_KNOBS.
  knobs?: TweakKnob[];
  onClose?: () => void;
  onExport?: (cssText: string) => void;
}

export function TweaksBridgePanel({
  iframeRef,
  ready = true,
  knobs = DEFAULT_KNOBS,
  onClose,
  onExport,
}: TweaksBridgePanelProps) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(knobs.map((k) => [k.id, k.defaultValue])),
  );
  const [acked, setAcked] = useState(false);
  const senderRef = useRef<((cssVars: Record<string, string>) => void) | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  // Wire up the throttled sender + the parent-side message listener.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    senderRef.current = createThrottledTweaksSender(iframe);
    const unsub = listenTweaksFromIframe(iframe, (msg: TweaksIncomingMessage) => {
      if (msg.type === "df:tweaks:ack") setAcked(true);
      if (msg.type === "df:tweaks:export-result") onExport?.(msg.cssText);
    });
    unsubRef.current = unsub;
    return () => {
      unsub();
      senderRef.current = null;
      unsubRef.current = null;
    };
  }, [iframeRef, onExport]);

  // Push the initial defaults once the iframe is reported ready.
  useEffect(() => {
    if (!ready) return;
    const send = senderRef.current;
    if (!send) return;
    const initial = Object.fromEntries(
      knobs.map((k) => [k.cssVar, k.unit ? `${k.defaultValue}${k.unit}` : k.defaultValue]),
    );
    send(initial);
  }, [ready, knobs]);

  const update = (knob: TweakKnob, raw: string) => {
    setValues((prev) => ({ ...prev, [knob.id]: raw }));
    const send = senderRef.current;
    if (!send) return;
    const value = knob.unit && knob.kind === "number" ? `${raw}${knob.unit}` : raw;
    send({ [knob.cssVar]: value });
  };

  const reset = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    setValues(Object.fromEntries(knobs.map((k) => [k.id, k.defaultValue])));
    postTweaksToIframe(iframe, { type: "df:tweaks:reset" });
  };

  const exportCss = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    postTweaksToIframe(iframe, { type: "df:tweaks:export" });
  };

  const status = useMemo(() => {
    if (!ready) return "Waiting for preview...";
    if (!acked) return "Listener idle — first edit will wake it.";
    return "Live · postMessage bridge";
  }, [ready, acked]);

  return (
    <aside
      data-df="tweaks-bridge-panel"
      style={{
        position: "absolute",
        right: 0,
        top: 0,
        bottom: 0,
        width: 300,
        background: "var(--df-surface-elevated)",
        boxShadow: "var(--df-shadow-card), inset 1px 0 0 var(--df-border-subtle)",
        display: "flex",
        flexDirection: "column",
        zIndex: 40,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          borderBottom: "1px solid var(--df-border-subtle)",
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontFamily: "var(--df-font-mono)",
            color: "var(--df-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Tweaks · live
        </span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close tweaks bridge panel"
            title="Close"
            style={{
              padding: "2px 6px",
              color: "var(--df-text-faint)",
              fontSize: 14,
              cursor: "pointer",
              background: "none",
              border: "none",
            }}
          >
            ✕
          </button>
        )}
      </header>

      <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>
        <div
          style={{
            fontSize: 10,
            fontFamily: "var(--df-font-mono)",
            color: acked ? "var(--df-accent-ok, #5faa54)" : "var(--df-text-muted)",
          }}
        >
          {status}
        </div>

        {knobs.map((knob) => (
          <div key={knob.id}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 10,
                fontFamily: "var(--df-font-mono)",
                color: "var(--df-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 6,
              }}
            >
              <span>{knob.label}</span>
              <code style={{ color: "var(--df-text-primary)" }}>
                {values[knob.id]}
                {knob.unit ?? ""}
              </code>
            </div>
            {knob.kind === "color" ? (
              <input
                type="color"
                value={values[knob.id] ?? knob.defaultValue}
                onChange={(e) => update(knob, e.target.value)}
                style={{ width: "100%", height: 30, border: "1px solid var(--df-border-subtle)", borderRadius: "var(--df-r-sm)" }}
              />
            ) : knob.kind === "number" ? (
              <input
                type="range"
                min={knob.min}
                max={knob.max}
                step={knob.step ?? 1}
                value={values[knob.id] ?? knob.defaultValue}
                onChange={(e) => update(knob, e.target.value)}
                style={{ width: "100%" }}
              />
            ) : (
              <input
                type="text"
                value={values[knob.id] ?? knob.defaultValue}
                onChange={(e) => update(knob, e.target.value)}
                style={{
                  width: "100%",
                  fontFamily: "var(--df-font-mono)",
                  fontSize: 12,
                  color: "var(--df-text-primary)",
                  background: "var(--df-bg-input, var(--df-bg-base))",
                  border: "1px solid var(--df-border-subtle)",
                  borderRadius: "var(--df-r-sm)",
                  padding: "6px 8px",
                }}
              />
            )}
          </div>
        ))}
      </div>

      <footer
        style={{
          display: "flex",
          gap: 8,
          padding: "10px 14px",
          borderTop: "1px solid var(--df-border-subtle)",
        }}
      >
        <button type="button" onClick={reset} className="df-btn df-btn--secondary" style={{ flex: 1, fontSize: 11 }}>
          Reset
        </button>
        <button type="button" onClick={exportCss} className="df-btn df-btn--primary" style={{ flex: 1, fontSize: 11 }}>
          Export CSS
        </button>
      </footer>
    </aside>
  );
}

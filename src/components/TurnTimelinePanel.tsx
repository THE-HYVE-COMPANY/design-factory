// TurnTimelinePanel.tsx — live observability overlay for the current turn.
//
// Floats in the bottom-right of EditorScreen while a turn is active so the
// user can see EXACTLY which event landed at which ms — SSE events, tool
// calls/results, iframe-reload attempts, artifact parsing, persistence
// outcomes. When the turn ends the panel can be expanded to show the full
// timeline + previous-turn comparison.
//
// Goal: stop fixing in the dark. When something breaks (iframe didn't
// hydrate / tool chip didn't appear / F5 lost data), the user sees
// which step failed and copies the timeline as a bug report.
//
// Toggle: Ctrl+Shift+T (or click the small 'turns' badge bottom-right).

import { useEffect, useState, useMemo } from "react";
import { subscribe, getCurrentTurn, getRecentTurns, type TurnRecEntry, type TurnRecScope } from "@/lib/turn-recorder";

const SCOPE_COLOR: Record<TurnRecScope, string> = {
  sse:       "var(--df-text-tertiary, #888)",
  tool:      "#7aa8ff",
  iframe:    "#5faa54",
  persist:   "#c8a050",
  hydrate:   "#9d70d4",
  artifact:  "#d44a8b",
  client:    "var(--df-text-secondary, #aaa)",
};

const LEVEL_BADGE: Record<TurnRecEntry["level"], string> = {
  info:  "·",
  warn:  "!",
  error: "✗",
  debug: "·",
};

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function describe(entry: TurnRecEntry): string {
  const d = entry.detail ?? {};
  switch (`${entry.scope}:${entry.kind}`) {
    case "tool:tool_call":
      return `tool_call ${d.name ?? "?"}${d.file_path ? ` ${String(d.file_path).split("/").pop()}` : ""}`;
    case "tool:tool_result":
      return `tool_result${d.isError ? " ✗" : ""} (${d.content_len ?? 0}b)`;
    case "iframe:tool_result_reload_attempt":
      return `iframe attempt ${d.toolName ?? ""} inProject=${d.inProject}`;
    case "iframe:hydrated_from_tool_result":
      return `iframe ✓ ${d.bytes}b (delay=${d.delay}ms)`;
    case "iframe:hydrated_from_onDone_sweep":
      return `iframe ✓ via onDone-sweep ${d.bytes}b`;
    case "iframe:hydrated_from_error_sweep":
      return `iframe ✓ via error-sweep ${d.bytes}b`;
    case "iframe:tool_result_reload_failed_after_retries":
      return `iframe ✗ failed after retries (${d.resolvedPath})`;
    case "iframe:blocked_path_not_in_project":
      return `iframe ✗ path not in project (${d.rawPath})`;
    case "artifact:hydrated_iframe":
      return `artifact ✓ ${d.bytes}b ${d.identifier}`;
    case "artifact:parse_non_artifact":
      return `artifact: ${d.status}${d.reason ? ` · ${d.reason}` : ""}`;
    case "client:handleSend":
      return `send "${String(d.visibleText_preview ?? "").slice(0, 60)}" [${d.provider}/${d.model}]`;
    case "client:onDone":
      return `onDone text=${d.text_len}b tools=${d.tools_count}${d.has_artifact ? " +artifact" : ""}`;
    case "client:onError":
      return `onError ${String(d.err ?? "").slice(0, 80)}`;
    case "client:turn_end:done":
      return "✓ turn done";
    case "client:turn_end:error":
      return "✗ turn error";
    case "client:turn_end:superseded":
      return "turn superseded";
    default:
      return `${entry.kind}${d ? ` ${JSON.stringify(d).slice(0, 80)}` : ""}`;
  }
}

export function TurnTimelinePanel({ projectId }: { projectId?: string | null }) {
  const [activeTurn, setActiveTurn] = useState(() => getCurrentTurn());
  const [open, setOpen] = useState(false);
  const [autoOpen, setAutoOpen] = useState(true); // collapse on user override

  useEffect(() => {
    const unsub = subscribe(setActiveTurn);
    return unsub;
  }, []);

  // After endTurn() the active turn becomes null. Fall back to the
  // most recent closed turn so the panel remains visible — the user
  // wants to inspect what just happened, not lose the timeline the
  // moment the stream finishes. User QA 2026-05-18 — "nao aparece"
  // (panel was disappearing right after onDone).
  const recent = useMemo(() => getRecentTurns(), [activeTurn]);
  const turn = activeTurn ?? recent[0] ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        setOpen((s) => !s);
        setAutoOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Auto-open while a turn is active so the user sees events live the
  // first time a turn fires. User can close manually (Ctrl+Shift+T or
  // click ×) and the override sticks until next session.
  useEffect(() => {
    if (autoOpen && turn && !turn.closed) setOpen(true);
  }, [turn, autoOpen]);

  const entries = turn?.entries ?? [];
  const elapsedMs = turn ? (turn.closed && turn.closedAt ? turn.closedAt - turn.startedAt : Date.now() - turn.startedAt) : 0;

  if (!projectId) return null;

  // Compact pill (closed): shows current turn status + click to expand.
  if (!open) {
    if (!turn) return null;
    return (
      <button
        type="button"
        onClick={() => { setOpen(true); setAutoOpen(false); }}
        style={{
          position: "fixed",
          right: 14,
          bottom: 14,
          padding: "6px 12px",
          background: "var(--df-bg-section, rgba(20,20,20,0.85))",
          color: "var(--df-text-primary, #ddd)",
          border: "1px solid var(--df-border-subtle, #333)",
          borderRadius: 4,
          fontSize: 11,
          fontFamily: "var(--df-font-mono, monospace)",
          letterSpacing: "0.02em",
          cursor: "pointer",
          zIndex: 9000,
          backdropFilter: "blur(6px)",
        }}
        title="Ctrl+Shift+T → toggle turn timeline"
      >
        <span style={{
          display: "inline-block",
          width: 6, height: 6, borderRadius: 3,
          background: turn.closed ? "#5faa54" : "#7aa8ff",
          marginRight: 6,
          animation: turn.closed ? "none" : "pulse 1.4s ease-in-out infinite",
        }} />
        {turn.closed ? "turn done" : "turn live"} · {entries.length} · {formatMs(elapsedMs)}
      </button>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        right: 14,
        bottom: 14,
        width: 460,
        maxHeight: "70vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--df-bg-section, rgba(15,15,15,0.95))",
        color: "var(--df-text-primary, #ddd)",
        border: "1px solid var(--df-border-subtle, #333)",
        borderRadius: 6,
        fontSize: 11,
        fontFamily: "var(--df-font-mono, monospace)",
        zIndex: 9000,
        backdropFilter: "blur(8px)",
        boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
      }}
    >
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 12px",
        borderBottom: "1px solid var(--df-border-subtle, #333)",
        color: "var(--df-text-secondary, #999)",
      }}>
        <div>
          <span style={{ color: "var(--df-text-primary, #ddd)" }}>turn</span>
          <span style={{ marginLeft: 6, opacity: 0.6 }}>{turn?.turnId.slice(0, 16) ?? "(no active turn)"}</span>
          {turn && <span style={{ marginLeft: 8 }}>{turn.provider}{turn.model && `/${turn.model}`}</span>}
          {turn && <span style={{ marginLeft: 8, opacity: 0.6 }}>{formatMs(elapsedMs)}</span>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => {
              const lines = entries.map((e) => `${String(e.ts).padStart(6)} ${e.scope.padEnd(8)} ${LEVEL_BADGE[e.level]} ${describe(e)}`);
              const text = `# turn ${turn?.turnId ?? "(none)"} · ${turn?.provider}/${turn?.model}\n${lines.join("\n")}\n`;
              navigator.clipboard?.writeText(text).catch(() => { /* noop */ });
            }}
            style={{ background: "transparent", border: "1px solid var(--df-border-subtle, #333)", color: "inherit", padding: "2px 8px", borderRadius: 3, fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}
            title="Copy timeline to clipboard"
          >
            copy
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); setAutoOpen(false); }}
            style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", fontSize: 16, lineHeight: 1 }}
            title="Close (Ctrl+Shift+T)"
          >
            ×
          </button>
        </div>
      </header>

      <div style={{ overflow: "auto", padding: "6px 0", flex: 1 }}>
        {entries.length === 0 && (
          <div style={{ padding: "12px 14px", color: "var(--df-text-faint, #666)" }}>
            waiting for events…
          </div>
        )}
        {entries.map((e, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 8,
              padding: "3px 12px",
              alignItems: "baseline",
              borderLeft: `2px solid ${SCOPE_COLOR[e.scope]}`,
              marginLeft: 6,
              opacity: e.level === "warn" || e.level === "error" ? 1 : 0.92,
              background: e.level === "error" ? "rgba(212,74,74,0.08)" : e.level === "warn" ? "rgba(212,160,74,0.06)" : "transparent",
            }}
          >
            <span style={{
              minWidth: 56,
              color: "var(--df-text-faint, #555)",
              textAlign: "right",
              flexShrink: 0,
            }}>
              {formatMs(e.ts)}
            </span>
            <span style={{
              minWidth: 64,
              color: SCOPE_COLOR[e.scope],
              flexShrink: 0,
            }}>
              {e.scope}
            </span>
            <span style={{
              color: e.level === "error" ? "#f87b7b" : e.level === "warn" ? "#e8b94c" : "var(--df-text-primary, #ddd)",
              wordBreak: "break-word",
              minWidth: 0,
            }}>
              {LEVEL_BADGE[e.level]} {describe(e)}
            </span>
          </div>
        ))}
      </div>

      {recent.length > 0 && (
        <footer style={{
          borderTop: "1px solid var(--df-border-subtle, #333)",
          padding: "6px 12px",
          color: "var(--df-text-faint, #666)",
          fontSize: 10,
          flexShrink: 0,
        }}>
          recent: {recent.map((r) => `${r.turnId.slice(-6)} (${r.entries.length})`).join(" · ")}
        </footer>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

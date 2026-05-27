import type { GenerationStatus } from "@/hooks/useClaude";

interface StatusPillProps {
  status: GenerationStatus;
  projectName?: string;
  fileName?: string;
}

export function StatusPill({ status, projectName, fileName }: StatusPillProps) {
  if (status === "idle" || !projectName) return null;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--df-sp-2)",
        padding: "4px 10px",
        background: "var(--df-surface-raised)",
        border: "1px solid var(--df-border-subtle)",
        // pill killed → r-sm (6px) — small status chip with LED + text.
        borderRadius: "var(--df-r-sm)",
        fontSize: "var(--df-text-xs)",
        fontFamily: "var(--df-font-mono)",
        color: "var(--df-text-secondary)",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background:
            status === "streaming"
              ? "#4ade80"
              : status === "error"
              ? "#f87171"
              : "var(--df-text-muted)",
          flexShrink: 0,
          animation: status === "streaming" ? "df-pulse 1.4s ease-in-out infinite" : undefined,
        }}
      />
      <span>
        {status === "streaming"
          ? `generating ${fileName ?? "file"}…`
          : status === "done"
          ? `${projectName} · ready`
          : status === "error"
          ? "generation error"
          : projectName}
      </span>
    </div>
  );
}

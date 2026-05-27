import type { CSSProperties } from "react";

export interface DfLoaderInlineProps {
  label?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * CSS-only inline 3-dot loader — no SVG, no filter, no GPU cost.
 * For dense UI chrome: buttons, chat tails, status lines, table rows.
 *
 * Color inherits from `currentColor`, scale is fixed at ~18px footprint so it
 * drops into a line of text without disrupting baseline.
 */
export function DfLoaderInline({ label = "Loading", className, style }: DfLoaderInlineProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={["df-loader-inline", className].filter(Boolean).join(" ")}
      style={style}
    >
      <span className="dot" />
      <span className="dot" />
      <span className="dot" />
    </span>
  );
}

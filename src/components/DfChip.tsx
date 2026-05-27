import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

type StatusTone = "ok" | "warn" | "danger" | "info" | "neutral";
type SourceKind = "df" | "project" | "global" | "builtin";

export interface DfChipProps extends HTMLAttributes<HTMLSpanElement> {
  /** Status chips render a leading dot automatically. */
  status?: StatusTone;
  /** Label chips are lowercase. */
  label?: boolean;
  /** Capability chips render tight, no background. */
  capability?: boolean;
  /** Capability turned off — line-through. */
  off?: boolean;
  /** Source-of-origin tint. */
  source?: SourceKind;
  children?: ReactNode;
}

export const DfChip = forwardRef<HTMLSpanElement, DfChipProps>(function DfChip(
  { status, label, capability, off, source, className, children, ...rest },
  ref
) {
  const classes = [
    "df-chip",
    status && "df-chip--status",
    status && `df-chip--status-${status}`,
    label && "df-chip--label",
    capability && "df-chip--capability",
    capability && off && "off",
    source && `df-chip--source-${source}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span ref={ref} className={classes} {...rest}>
      {status && <span className="dot" aria-hidden="true" />}
      {children}
    </span>
  );
});

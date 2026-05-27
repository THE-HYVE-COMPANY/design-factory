import type { HTMLAttributes } from "react";

export interface DfProgressProps extends HTMLAttributes<HTMLDivElement> {
  /** 0-1 value. Omit for indeterminate. */
  value?: number;
  label?: string;
}

export function DfProgress({ value, label, className, ...rest }: DfProgressProps) {
  const indeterminate = value === undefined;
  const clamped = indeterminate ? 0 : Math.max(0, Math.min(1, value!));
  const classes = [
    "df-progress",
    indeterminate && "df-progress--indeterminate",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={indeterminate ? undefined : clamped}
      aria-label={label}
      {...rest}
    >
      <div
        className="df-progress-bar"
        style={indeterminate ? undefined : { transform: `scaleX(${clamped})` }}
      />
    </div>
  );
}

export interface DfSpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  size?: "sm" | "md" | "lg";
  label?: string;
}

export function DfSpinner({ size = "md", label = "Loading", className, ...rest }: DfSpinnerProps) {
  const classes = [
    "df-spinner",
    size !== "md" && `df-spinner--${size}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <span className={classes} role="status" aria-label={label} {...rest} />;
}

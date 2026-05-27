import { forwardRef, type TextareaHTMLAttributes } from "react";

type Size = "sm" | "md" | "lg";

export interface DfTextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "size"> {
  size?: Size;
  error?: boolean;
  shake?: boolean;
}

export const DfTextarea = forwardRef<HTMLTextAreaElement, DfTextareaProps>(function DfTextarea(
  { size = "md", error = false, shake = false, className, rows, ...rest },
  ref
) {
  const classes = [
    "df-input",
    "df-textarea",
    size !== "md" && `df-input--${size}`,
    error && "df-input--error",
    shake && "df-input--shake",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <textarea
      ref={ref}
      className={classes}
      rows={rows ?? 4}
      aria-invalid={error || undefined}
      {...rest}
    />
  );
});

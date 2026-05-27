import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

type Size = "sm" | "md" | "lg";

export interface DfInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: Size;
  error?: boolean;
  shake?: boolean;
}

export const DfInput = forwardRef<HTMLInputElement, DfInputProps>(function DfInput(
  { size = "md", error = false, shake = false, className, type, ...rest },
  ref
) {
  const classes = [
    "df-input",
    size !== "md" && `df-input--${size}`,
    error && "df-input--error",
    shake && "df-input--shake",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <input
      ref={ref}
      type={type ?? "text"}
      className={classes}
      aria-invalid={error || undefined}
      {...rest}
    />
  );
});

export interface DfFieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  search?: boolean;
  leadingIcon?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Field wrapper: label + input + hint/error. Pairs with DfInput. */
export function DfField({ label, hint, error, search, leadingIcon, className, children }: DfFieldProps) {
  const classes = ["df-field", search && "df-field--search", className].filter(Boolean).join(" ");
  return (
    <div className={classes}>
      {label && <label className="df-label">{label}</label>}
      {search && leadingIcon ? leadingIcon : null}
      {children}
      {error ? (
        <span className="df-error-text" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="df-hint">{hint}</span>
      ) : null}
    </div>
  );
}

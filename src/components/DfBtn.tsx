import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface DfBtnProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: Variant;
  size?: Size;
  icon?: boolean;
  loading?: boolean;
  children?: ReactNode;
}

export const DfBtn = forwardRef<HTMLButtonElement, DfBtnProps>(function DfBtn(
  { variant = "secondary", size = "md", icon = false, loading = false, disabled, className, children, ...rest },
  ref
) {
  const classes = [
    "df-btn",
    `df-btn--${variant}`,
    size !== "md" && `df-btn--${size}`,
    icon && "df-btn--icon",
    loading && "df-btn--loading",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      ref={ref}
      type={rest.type ?? "button"}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-disabled={disabled || undefined}
      {...rest}
    >
      {children}
    </button>
  );
});

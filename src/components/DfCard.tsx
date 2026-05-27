import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

type Variant = "static" | "interactive" | "feature" | "dashed" | "empty";

export interface DfCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  asButton?: boolean;
  children?: ReactNode;
}

/** Canonical DF card shell. Compose with DfCardThumb/Body/Title/Sub. */
export const DfCard = forwardRef<HTMLDivElement, DfCardProps>(function DfCard(
  { variant = "static", asButton = false, className, children, ...rest },
  ref
) {
  const classes = [
    "df-card",
    variant === "interactive" && "df-card--interactive",
    variant === "feature" && "df-card--interactive df-card--feature",
    variant === "dashed" && "df-card--dashed",
    variant === "empty" && "df-card--empty",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const interactive = variant === "interactive" || variant === "feature" || variant === "dashed";

  return (
    <div
      ref={ref}
      className={classes}
      role={asButton && interactive ? "button" : undefined}
      tabIndex={asButton && interactive ? 0 : undefined}
      {...rest}
    >
      {children}
    </div>
  );
});

export function DfCardThumb({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={["df-card-thumb", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </div>
  );
}

export function DfCardBody({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={["df-card-body", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </div>
  );
}

export function DfCardTitle({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={["df-card-title", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </div>
  );
}

export function DfCardSub({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={["df-card-sub", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </div>
  );
}

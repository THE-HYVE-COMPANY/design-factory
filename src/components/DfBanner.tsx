import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

type Severity = "info" | "warn" | "danger" | "ok";

export interface DfBannerProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  severity?: Severity;
  icon?: ReactNode;
  title?: ReactNode;
  sub?: ReactNode;
  onDismiss?: () => void;
  action?: ReactNode;
}

export const DfBanner = forwardRef<HTMLDivElement, DfBannerProps>(function DfBanner(
  { severity = "info", icon, title, sub, children, action, onDismiss, className, ...rest },
  ref
) {
  const classes = ["df-banner", `df-banner--${severity}`, className].filter(Boolean).join(" ");

  return (
    <div
      ref={ref}
      className={classes}
      role="status"
      aria-live="polite"
      {...rest}
    >
      {icon && <span className="icon">{icon}</span>}
      <div className="text">
        {title && <div className="title">{title}</div>}
        {sub && <div className="sub">{sub}</div>}
        {children}
      </div>
      {action}
      {onDismiss && (
        <button
          className="close"
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss banner"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
});

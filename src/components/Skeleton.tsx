import type { CSSProperties, HTMLAttributes } from "react";

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  w?: number | string;
  h?: number | string;
  radius?: number | string;
  /** Stagger delay in ms when used in a group. */
  delay?: number;
}

export function Skeleton({ w, h, radius, delay, className, style, ...rest }: SkeletonProps) {
  const mergedStyle: CSSProperties = {
    width: w,
    height: h,
    borderRadius: radius,
    animationDelay: delay !== undefined ? `${delay}ms` : undefined,
    ...style,
  };
  return (
    <div
      className={["df-skeleton", className].filter(Boolean).join(" ")}
      style={mergedStyle}
      aria-hidden="true"
      {...rest}
    />
  );
}

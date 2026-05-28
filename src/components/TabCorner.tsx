import type { CSSProperties } from "react";

interface TabCornerProps {
  outerColor: string;
}

export function TabCornerLeft({ outerColor }: TabCornerProps) {
  return (
    <div
      className="tab-corner tab-corner--left"
      style={{ "--df-tab-outer": outerColor } as CSSProperties}
    />
  );
}

export function TabCornerRight({ outerColor }: TabCornerProps) {
  return (
    <div
      className="tab-corner tab-corner--right"
      style={{ "--df-tab-outer": outerColor } as CSSProperties}
    />
  );
}

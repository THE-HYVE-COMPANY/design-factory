// CardMenuButton — the "⋯" overlay button anchored top-right of any
// card thumbnail (project cards in HomeScreen, future surfaces). Was
// inline-styled inside HomeScreen with concentric-corner math, blur,
// and translucent surface. Now a primitive so other cards (DS, skill,
// template) reuse the same look.

interface Props {
  open: boolean;
  onClick: (e: React.MouseEvent) => void;
  title?: string;
}

export function CardMenuButton({ open, onClick, title = "Card options" }: Props) {
  return (
    <button
      type="button"
      className="df-card-menu"
      onClick={onClick}
      title={title}
      aria-haspopup="menu"
      aria-expanded={open}
      style={style}
    >
      ⋯
    </button>
  );
}

const style: React.CSSProperties = {
  position: "absolute",
  top: 6,
  right: 6,
  width: 20,
  height: 20,
  // Concentric with the card corner: card uses --df-r-xl (12px), button
  // sits 6px from the edge → 12 - 6 = 6px = --df-r-sm. Inner curve runs
  // parallel to the card's outer one.
  borderRadius: "var(--df-r-sm)",
  background: "color-mix(in srgb, var(--df-surface-raised) 80%, transparent)",
  backdropFilter: "blur(6px)",
  WebkitBackdropFilter: "blur(6px)",
  border: "1px solid color-mix(in srgb, var(--df-border-subtle) 60%, transparent)",
  color: "var(--df-text-muted)",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  lineHeight: 1,
  display: "grid",
  placeItems: "center",
  padding: 0,
};

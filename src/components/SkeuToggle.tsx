// SkeuToggle — premium on/off switch.
// Reusable across Commands, Built-in prompts, Canvas, Formats, and
// Rules panels. The component was originally extracted from a legacy
// formats/directions editor and is now shared across the canonical
// editors that replaced it.

interface Props {
  on: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}

export function SkeuToggle({ on, onChange, label, disabled }: Props) {
  return (
    <button
      type="button"
      className={`skeu-toggle${on ? " is-on" : ""}${disabled ? " is-disabled" : ""}`}
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (disabled) return;
        onChange(!on);
      }}
    >
      <span className="skeu-toggle-track" aria-hidden>
        <span className="skeu-toggle-thumb" />
      </span>
    </button>
  );
}

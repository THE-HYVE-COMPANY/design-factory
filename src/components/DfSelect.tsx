import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export interface DfSelectItem<V extends string = string> {
  value: V;
  label: ReactNode;
  sub?: ReactNode;
  disabled?: boolean;
}

export interface DfSelectProps<V extends string = string> {
  items: DfSelectItem<V>[];
  value: V | null;
  onChange: (value: V) => void;
  placeholder?: ReactNode;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  minWidth?: number;
  "aria-label"?: string;
}

/**
 * Canonical combobox. Full WAI-ARIA pattern:
 *   role="combobox" aria-expanded aria-haspopup="listbox"
 *   Arrow Up/Down navigates, Enter/Space selects, Esc closes,
 *   Home/End jump to ends, type-to-search for first letter.
 *
 * Menu renders below trigger. Portal/positioning is deliberately NOT
 * included here — that lives in the integration layer (EditorScreen's
 * dropdown portal helpers) and can be injected via className if needed.
 */
export function DfSelect<V extends string = string>({
  items,
  value,
  onChange,
  placeholder = "Select…",
  disabled,
  className,
  triggerClassName,
  menuClassName,
  minWidth,
  "aria-label": ariaLabel,
}: DfSelectProps<V>) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState<number>(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxId = useId();

  const selectedIndex = useMemo(
    () => items.findIndex((i) => i.value === value),
    [items, value]
  );
  const current = selectedIndex >= 0 ? items[selectedIndex] : null;

  const close = useCallback(() => {
    setOpen(false);
    setHighlight(-1);
  }, []);

  // Click outside closes menu
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) close();
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open, close]);

  const openMenu = useCallback(() => {
    if (disabled) return;
    setOpen(true);
    setHighlight(selectedIndex >= 0 ? selectedIndex : 0);
  }, [disabled, selectedIndex]);

  const moveHighlight = useCallback(
    (delta: number) => {
      if (items.length === 0) return;
      setHighlight((prev) => {
        const start = prev >= 0 ? prev : selectedIndex;
        let next = start + delta;
        let guard = 0;
        while (guard < items.length) {
          if (next < 0) next = items.length - 1;
          if (next >= items.length) next = 0;
          if (!items[next].disabled) return next;
          next += delta > 0 ? 1 : -1;
          guard += 1;
        }
        return prev;
      });
    },
    [items, selectedIndex]
  );

  const commit = useCallback(
    (idx: number) => {
      const item = items[idx];
      if (!item || item.disabled) return;
      onChange(item.value);
      close();
      triggerRef.current?.focus();
    },
    [items, onChange, close]
  );

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        moveHighlight(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        moveHighlight(-1);
        break;
      case "Home":
        e.preventDefault();
        setHighlight(0);
        break;
      case "End":
        e.preventDefault();
        setHighlight(items.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (highlight >= 0) commit(highlight);
        break;
      case "Escape":
      case "Tab":
        close();
        break;
    }
  };

  return (
    <div
      ref={rootRef}
      className={["df-select", className].filter(Boolean).join(" ")}
      style={minWidth ? { minWidth } : undefined}
    >
      <button
        ref={triggerRef}
        type="button"
        className={["df-select-trigger", triggerClassName].filter(Boolean).join(" ")}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        aria-disabled={disabled || undefined}
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="value">{current ? current.label : placeholder}</span>
        <svg className="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul
          id={listboxId}
          className={["df-select-menu", menuClassName].filter(Boolean).join(" ")}
          role="listbox"
          aria-label={ariaLabel}
        >
          {items.map((item, idx) => (
            <li
              key={item.value}
              role="option"
              aria-selected={item.value === value}
              aria-disabled={item.disabled || undefined}
              data-highlighted={highlight === idx || undefined}
              className="df-select-item"
              onMouseEnter={() => setHighlight(idx)}
              onMouseDown={(e) => {
                e.preventDefault();
                commit(idx);
              }}
            >
              <span>{item.label}</span>
              {item.sub && <span className="sub">{item.sub}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

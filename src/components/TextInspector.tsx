// TextInspector — sidebar editor for any text element selected in the iframe.
//
// User picks "Edit text" mode in the transport bar, clicks any text in the
// preview, and this panel takes over the right column. Edit the text in a
// textarea, hit Save, and we patch both the live iframe DOM (so the change
// shows immediately) and the source HTML on disk (via the existing onHtmlChange
// pipeline). Works for h1-h6, p, span, a, button, li, label — anything with
// a direct text node.

import { useEffect, useRef, useState } from "react";

export interface TextSelection {
  /** XPath into the iframe document — used to re-find the element on save. */
  xpath: string;
  /** Tag name for display (h1, p, button, etc). */
  tag: string;
  /** Original text content the user clicked on, used for the source-side
   *  search/replace patch. innerHTML preserves nested formatting; if the
   *  element is pure text, this equals innerText. */
  originalInnerHTML: string;
  /** Display version — innerText so it's editable as a single block. */
  text: string;
  /** Optional context label ("scene-01 / kicker") shown in the header. */
  context?: string;
}

interface Props {
  selection: TextSelection;
  /** Called with new innerText. Parent applies the patch and closes panel. */
  onSave: (next: string) => void;
  onClose: () => void;
}

export function TextInspector({ selection, onSave, onClose }: Props) {
  const [draft, setDraft] = useState(selection.text);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // New selection → reset draft + auto-focus + select-all so the user can
  // start typing immediately.
  useEffect(() => {
    setDraft(selection.text);
    const ta = taRef.current;
    if (ta) {
      ta.focus();
      ta.select();
    }
  }, [selection.xpath, selection.text]);

  const dirty = draft !== selection.text;

  const handleSave = () => {
    if (!dirty) return;
    onSave(draft);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd/Ctrl+Enter saves. Escape cancels.
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div style={rootStyle}>
      <header style={headerStyle}>
        <div style={titleColStyle}>
          <span style={titleStyle}>Text · {selection.tag}</span>
          {selection.context && (
            <span style={contextStyle}>{selection.context}</span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          style={closeBtnStyle}
          title="Close (Esc)"
          aria-label="Close text inspector"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </header>

      <textarea
        ref={taRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKey}
        style={textareaStyle}
        spellCheck={false}
        placeholder="(empty)"
      />

      <footer style={footerStyle}>
        <span style={hintStyle}>
          {dirty ? "Cmd+Enter to save · Esc to cancel" : "No changes"}
        </span>
        <div style={btnRowStyle}>
          <button type="button" onClick={onClose} style={secondaryBtnStyle}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty}
            style={dirty ? primaryBtnStyle : primaryBtnDisabledStyle}
          >
            Save
          </button>
        </div>
      </footer>
    </div>
  );
}

const rootStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  gap: 12,
  padding: 12,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 8,
};

const titleColStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  minWidth: 0,
};

const titleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--df-text-primary)",
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const contextStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--df-text-secondary)",
  fontFamily: "var(--df-font-mono, monospace)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const closeBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 24,
  height: 24,
  background: "transparent",
  border: "none",
  color: "var(--df-text-secondary)",
  cursor: "pointer",
  borderRadius: 4,
};

const textareaStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 80,
  padding: 10,
  background: "var(--df-bg-input, var(--df-bg-base))",
  border: "1px solid var(--df-border-subtle)",
  borderRadius: 6,
  color: "var(--df-text-primary)",
  fontFamily: "var(--df-font-body, inherit)",
  fontSize: 13,
  lineHeight: 1.5,
  resize: "vertical",
  outline: "none",
};

const footerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

const hintStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--df-text-faint)",
};

const btnRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: "5px 10px",
  background: "transparent",
  border: "1px solid var(--df-border-subtle)",
  borderRadius: 4,
  color: "var(--df-text-secondary)",
  fontSize: 12,
  cursor: "pointer",
};

const primaryBtnStyle: React.CSSProperties = {
  padding: "5px 12px",
  background: "var(--df-accent-user)",
  border: "none",
  borderRadius: 4,
  color: "var(--df-bg-base)",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const primaryBtnDisabledStyle: React.CSSProperties = {
  ...primaryBtnStyle,
  background: "var(--df-border-subtle)",
  color: "var(--df-text-faint)",
  cursor: "not-allowed",
};

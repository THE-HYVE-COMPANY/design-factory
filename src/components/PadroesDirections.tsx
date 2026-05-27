// PadroesDirections.tsx — guidance block shown above each Padrões editor.
//
// user spec:
//   "de um nome melhor, direções para todos esses, ta td mt apertado e
//    com skeu exagerado, repense com mais respiro editorial"
//
// Each sub-tab (Canvas, Formats, Rules) opens with a directions block that
// orients the user: what this default does in the New Project flow,
// when to add a custom, how it shapes the project output.
//
// Editorial typography — mono kicker + serif-feel display title + body
// paragraph. Bold (**word**) inline tokens are surfaced visually so domain
// terms read as anchor points without breaking the editorial flow.

import type { ReactNode } from "react";

export interface PadroesDirectionsProps {
  title: string;
  body: string;
}

/**
 * Render minimal markdown:
 *   **bold** → <strong>
 *   *italic* → <em>
 *   `code` → <code>
 * Anything else stays as plain text.
 */
function renderInlineMarkdown(input: string): ReactNode[] {
  if (!input) return [];
  const tokens: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input))) {
    if (m.index > last) tokens.push(input.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      tokens.push(<strong key={key++}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("`")) {
      tokens.push(
        <code key={key++} className="padroes-directions-code">
          {tok.slice(1, -1)}
        </code>,
      );
    } else {
      tokens.push(<em key={key++}>{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
  }
  if (last < input.length) tokens.push(input.slice(last));
  return tokens;
}

export function PadroesDirections({ title, body }: PadroesDirectionsProps) {
  return (
    <aside className="padroes-directions" aria-label={title}>
      <span className="padroes-directions-mark" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </span>
      <div className="padroes-directions-text">
        <h3 className="padroes-directions-title">{title}</h3>
        <p className="padroes-directions-body">{renderInlineMarkdown(body)}</p>
      </div>
    </aside>
  );
}

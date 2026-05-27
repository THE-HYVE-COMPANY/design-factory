import { marked } from "marked";
import DOMPurify from "dompurify";

marked.setOptions({ gfm: true, breaks: true });

export const SAFE_MARKDOWN_CONFIG = {
  FORBID_TAGS: ["style", "iframe", "form", "input", "button", "script"],
  FORBID_ATTR: ["style", "onerror", "onload", "onclick"],
} satisfies Parameters<typeof DOMPurify.sanitize>[1];

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderMarkdownSafe(markdown: string, fallback = ""): string {
  try {
    const raw = marked.parse(markdown, { async: false }) as string;
    return DOMPurify.sanitize(raw, SAFE_MARKDOWN_CONFIG);
  } catch {
    return fallback || `<pre>${escapeHtml(markdown)}</pre>`;
  }
}

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, SAFE_MARKDOWN_CONFIG);
}

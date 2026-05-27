// Deterministic cover generator — parses a design.md, extracts canvas /
// ink / accent / display-font tokens, and emits a fixed Wordmark+Dot
// HTML layout. Same skeleton for every DS so covers stack visually
// consistent in the home grid. No LLM. Sub-100ms.
//
// Wire: called from /ds/generate-preview synchronously, written to
// <ds-path>/cover.html before the 202 response. The preview LLM call
// continues in parallel for the bigger preview.html artifact.
//
// @file apps/daemon/src/ds-cover.mjs

import yaml from "js-yaml";

// Font family → Google Fonts identifier. Same mapping the preview
// templates use so cover + preview share typography even when the
// brand's spec'd font (Helvetica Neue, Copernicus, Futura) isn't on
// Google Fonts.
const FONT_MAP = [
  { re: /Helvetica Neue/i,    gf: "Inter",            weights: "300;400;500;600;700;800" },
  { re: /\bInter\b/i,         gf: "Inter",            weights: "300;400;500;600;700;800" },
  { re: /\bGeist\b(?! Mono)/i, gf: "Geist",           weights: "300;400;500;600;700;800" },
  { re: /Geist Mono/i,        gf: "Geist Mono",       weights: "400;500" },
  { re: /Walsheim/i,          gf: "DM Sans",          weights: "400;500;700" },
  { re: /Copernicus/i,        gf: "Playfair Display", weights: "400;500;600;700;800" },
  { re: /Futura/i,            gf: "Bebas Neue",       weights: "400" },
  { re: /Bebas/i,             gf: "Bebas Neue",       weights: "400" },
  { re: /Circular/i,          gf: "Manrope",          weights: "300;400;500;600;700;800" },
  { re: /Manrope/i,           gf: "Manrope",          weights: "300;400;500;600;700;800" },
  { re: /Playfair/i,          gf: "Playfair Display", weights: "400;500;600;700;800" },
  { re: /JetBrains/i,         gf: "JetBrains Mono",   weights: "400;500;700" },
  { re: /IBM Plex Sans/i,     gf: "IBM Plex Sans",    weights: "300;400;500;600;700" },
  { re: /IBM Plex Mono/i,     gf: "IBM Plex Mono",    weights: "300;400;500;600;700" },
  { re: /\bDon\b/i,           gf: "Playfair Display", weights: "400;500;600;700;800" },
  { re: /\bMono\b|monospace/i, gf: "JetBrains Mono",  weights: "400;500;700" },
  { re: /\bserif\b/i,         gf: "Playfair Display", weights: "400;500;600;700;800" },
];

function mapFont(family) {
  if (!family || typeof family !== "string") {
    return { name: "Inter", weights: "300;400;500;600;700" };
  }
  for (const m of FONT_MAP) {
    if (m.re.test(family)) return { name: m.gf, weights: m.weights };
  }
  return { name: "Inter", weights: "300;400;500;600;700" };
}

function luminance(hex) {
  const h = String(hex).replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function saturation(hex) {
  const h = String(hex).replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

/**
 * Pull canvas/ink/accent/display tokens out of a design.md.
 * Handles both YAML-frontmatter style (apple, claude, hyve, df) and
 * prose-only style (linear, nike, vercel, etc) via a regex fallback.
 *
 * @param {string} designMd  Raw design.md content
 * @param {string} [slug]    Optional DS folder slug; used as fallback
 *                           when the doc has no frontmatter name and
 *                           the body H1 is a generic marketing string.
 * @returns {object}
 */
export function extractCoverTokens(designMd, slug) {
  const fmMatch = designMd.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  let fm = null;
  try { fm = fmMatch ? yaml.load(fmMatch[1]) : null; } catch {}
  const body = fmMatch ? designMd.slice(fmMatch[0].length) : designMd;

  // Slug-derived fallback ("design-factory" → "Design Factory").
  const slugName = slug
    ? slug.split(/[-_\s]+/).filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
    : null;

  // Name resolution order:
  //   1. frontmatter `name:` IF it doesn't look like a marketing wrapper
  //      ("Design System Inspired by Spotify" → "Spotify" via slug)
  //   2. H1 with same wrapper-strip
  //   3. slug-derived ("nike" → "Nike")
  //   4. "Design System" hard fallback
  const stripWrapper = (s) => {
    let v = s.trim();
    // "Design System Inspired by X" → X
    const m1 = v.match(/inspired by\s+(.+)/i);
    if (m1) v = m1[1].trim();
    // "X — Skeu Refinado Canon" / "X — anything" → X (em-dash / en-dash / hyphen)
    v = v.split(/\s+[—–-]\s+/)[0].trim();
    // "X Design System" → X
    const m2 = v.match(/^(.+?)\s+design system\b/i);
    if (m2) v = m2[1].trim();
    // "X (anything)" → X — strip trailing parenthetical
    v = v.replace(/\s*\([^)]*\)\s*$/, "").trim();
    return v || s;
  };

  let name = null;
  if (fm && typeof fm === "object" && fm.name) {
    name = stripWrapper(String(fm.name));
  }
  if (!name) {
    const h1 = body.match(/^#\s+(.+?)\s*$/m);
    if (h1) name = stripWrapper(h1[1].trim());
  }
  if (!name && slugName) name = slugName;
  if (!name) {
    const h2 = body.match(/^##\s+(.+?)\s*$/m);
    if (h2 && !/^(overview|introduction|about|colors?|typography|layout|components?|spacing|radii|shapes?|tokens?)$/i.test(h2[1].trim())) {
      name = h2[1].trim();
    }
  }
  if (!name) name = "Design System";

  // Colors — frontmatter first, else prose markdown patterns.
  const colors = [];
  const pushColor = (n, hex) => {
    if (!hex || !/^#[0-9a-fA-F]{6,8}$/.test(hex)) return;
    if (colors.find((c) => c.hex.toLowerCase() === hex.toLowerCase())) return;
    colors.push({ name: (n || `c${colors.length}`).toLowerCase().trim(), hex });
  };

  if (fm?.colors && typeof fm.colors === "object") {
    for (const [n, v] of Object.entries(fm.colors)) {
      if (typeof v === "string") pushColor(n, v);
    }
  }

  if (colors.length === 0) {
    // Prose markdown bullets — `- **Name** (...#hex...)` covers Spotify, Nike,
    // and most prose-style DSs. Allows arbitrary content between name and hex.
    const bulletRe = /\*\*([^*\n]{1,40})\*\*[^#\n]*?(#[0-9a-fA-F]{6,8})/g;
    let m;
    while ((m = bulletRe.exec(body))) {
      pushColor(m[1], m[2]);
    }
    // YAML-ish lines that didn't sit in proper frontmatter.
    const lineRe = /\b([a-zA-Z][a-zA-Z0-9_-]{1,30})\s*[:=]\s*["`']?(#[0-9a-fA-F]{6,8})/g;
    while ((m = lineRe.exec(body))) {
      pushColor(m[1], m[2]);
    }
    // Pure hex hunt — last resort, names default to c0..cN.
    if (colors.length === 0) {
      const hexOnly = /#[0-9a-fA-F]{6}/g;
      let mm;
      while ((mm = hexOnly.exec(body)) && colors.length < 8) {
        pushColor(null, mm[0]);
      }
    }
  }

  // Canvas + ink: named tokens preferred, else luminance-sort fallback.
  const named = (re) => colors.find((c) => re.test(c.name.toLowerCase()));
  let canvas = named(/^canvas$|^background$|^bg$|^surface$|^paper$|^soft-cloud$|^near.?black$|^near.?white$/);
  let ink = named(/^ink$|^foreground$|^text$|^fg$|^on-canvas$|^on-paper$|^white$|^primary.?text$/);
  if (colors.length > 0) {
    const sorted = [...colors].sort((a, b) => luminance(a.hex) - luminance(b.hex));
    if (!canvas) canvas = sorted[sorted.length - 1];
    if (!ink) ink = sorted[0];
  }
  // Hard fallback so the cover always renders.
  canvas = canvas || { hex: "#fbfbfd" };
  ink = ink || { hex: "#1a1a1c" };

  // Canvas/ink collision — happens when the palette is mono-tone (xAI
  // is all near-black, Linear's prose sample only surfaced light
  // greys). Force-flip to keep wordmark legible: dark canvas →
  // white ink; light canvas → dark ink.
  if (canvas.hex.toLowerCase() === ink.hex.toLowerCase()) {
    if (luminance(canvas.hex) > 0.5) {
      ink = { name: "ink", hex: "#0a0a0a" };
    } else {
      ink = { name: "ink", hex: "#fafafa" };
    }
  }

  // Accent: named primary > most saturated chromatic color > ink fallback.
  let accent = named(/^primary$|^accent$|^brand$|^signature$|^cta$|^action$/);
  if (!accent) {
    let best = null, bestSat = 0;
    for (const c of colors) {
      const sat = saturation(c.hex);
      if (sat > bestSat && sat > 0.3) {
        best = c;
        bestSat = sat;
      }
    }
    accent = best || ink;
  }

  // Display font + weight + tracking + transform — frontmatter typography
  // table first, else prose detection.
  let fontFamily = null;
  let fontWeight = 600;
  let letterSpacing = "-0.02em";
  let transform = "none";

  if (fm?.typography && typeof fm.typography === "object") {
    const entries = Object.entries(fm.typography).filter(([_, v]) => v && typeof v === "object");
    // Prefer the "display"/"hero"/"campaign"/"wordmark" named token; else biggest font-size.
    const named = entries.find(([n]) => /display|hero|h1|campaign|wordmark/i.test(n));
    const sorted = [...entries].sort((a, b) =>
      parseFloat(b[1]["font-size"] || b[1].fontSize || "0") -
      parseFloat(a[1]["font-size"] || a[1].fontSize || "0"));
    const pick = named || sorted[0];
    if (pick) {
      const v = pick[1];
      fontFamily = v["font-family"] || v.fontFamily || null;
      fontWeight = v["font-weight"] || v.fontWeight || 600;
      letterSpacing = v["letter-spacing"] || v.letterSpacing || "-0.02em";
      transform = v["text-transform"] || "none";
    }
  }
  if (!fontFamily) {
    // Prose-style fallback — first known font name in body
    for (const m of FONT_MAP) {
      if (m.re.test(body)) {
        fontFamily = m.re.source.replace(/\\b|\(.*?\)|\|/g, "").replace(/\s+/g, " ").trim();
        break;
      }
    }
  }

  // Uppercase signal in prose (Nike Futura, Wired display)
  if (transform === "none" && /uppercase\s+(display|hero|headline|futura|wired)/i.test(body)) {
    transform = "uppercase";
  }

  const font = mapFont(fontFamily);
  const weight = typeof fontWeight === "number"
    ? fontWeight
    : parseInt(String(fontWeight).replace(/[^0-9]/g, ""), 10) || 600;

  return {
    name,
    canvas: canvas.hex,
    ink: ink.hex,
    accent: accent.hex,
    fontName: font.name,
    fontWeights: font.weights,
    fontWeight: Math.min(Math.max(weight, 100), 900),
    letterSpacing,
    transform,
  };
}

/**
 * Build the W2 (Wordmark + Mark Dot) cover HTML for a parsed design.md.
 * Fixed skeleton: flex column center, 22px gap between wordmark and dot.
 * Same positioning for every DS — only tokens change.
 *
 * @param {string} designMd  Raw design.md content
 * @param {string} [slug]    Optional DS folder slug, used for name fallback
 * @returns {string}         Self-contained HTML, ~1.2KB.
 */
export function buildCoverHtml(designMd, slug) {
  const t = extractCoverTokens(designMd, slug);
  const fontsHref = `https://fonts.googleapis.com/css2?family=${t.fontName.replace(/ /g, "+")}:wght@${t.fontWeights}&display=swap`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(t.name)} · cover</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fontsHref}">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 100%; height: 100%; background: ${t.canvas}; overflow: hidden; }
  body {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .cover {
    width: 100%;
    height: 100%;
    aspect-ratio: 16 / 10;
    background: ${t.canvas};
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 22px;
    padding: 24px;
  }
  .wordmark {
    font-family: "${t.fontName}", system-ui, sans-serif;
    font-weight: ${t.fontWeight};
    font-size: clamp(28px, 9.2cqi, 52px);
    letter-spacing: ${t.letterSpacing};
    text-transform: ${t.transform};
    color: ${t.ink};
    line-height: 1;
    text-align: center;
    container-type: inline-size;
  }
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${t.accent};
    flex-shrink: 0;
  }
</style>
</head>
<body>
<div class="cover">
  <div class="wordmark">${escapeHtml(t.name)}</div>
  <div class="dot" aria-hidden="true"></div>
</div>
</body>
</html>`;
}

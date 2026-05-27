/**
 * viewport-fit.ts — Force HTML to fill its container regardless of
 * any width/height/min/max sizing the original markup put on html/body.
 *
 * Why this exists: video projects are generated for a fixed pixel size
 * (typically 1920×1080). When the editor canvas or the Video tab letter-
 * box previews them at a different aspect, the inner HTML's body keeps
 * its original 1920×1080 box and the rest renders blank — looks "cropped"
 * and the aspect-ratio buttons appear to do nothing because the visible
 * content is identical.
 *
 * The shim is injected at the END of <head> so it overrides earlier
 * rules. It only pins html/body — it does NOT touch nested flex/grid
 * children, aspect-ratio'd elements, or absolute-positioned layers.
 *
 * Used by:
 *   - EditorScreen.tsx iframe srcDoc (when isVideoProject)
 *   - VideoTab.tsx letterbox iframe srcDoc
 *   - dev-bridge.mjs render endpoint (Puppeteer)
 */

const VIEWPORT_FIT_STYLE = `<style id="df-viewport-fit">
html, body {
  margin: 0 !important;
  padding: 0 !important;
  width: 100% !important;
  height: 100% !important;
  min-width: 0 !important;
  min-height: 0 !important;
  max-width: none !important;
  max-height: none !important;
  box-sizing: border-box;
}
body { overflow: hidden !important; }
</style>`;

// Link / form interceptor. Iframe runs with allow-same-origin so designs
// can render normally — but anchor tags and form submits then resolve
// their relative URLs against the PARENT origin (localhost:1420 in dev).
// Result: clicking any <a href="/x"> inside the generated design swaps the
// iframe to DF's own bundle. User repro 2026-05-21 — "botoes de design
// ao clicar abrem o localhost do proprio design factory, eh mt estranho".
//
// We intercept clicks in the capture phase and:
//   · let hash-only links work (in-page scroll)
//   · open external http(s)/mailto in a new tab
//   · block everything else (relative paths, javascript:, etc.)
//   · also block <form> submissions defensively.
const NAV_GUARD_SCRIPT = `<script id="df-nav-guard">
(function () {
  if (window.__dfNavGuardInstalled) return;
  window.__dfNavGuardInstalled = true;
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (!href || href.charAt(0) === '#') return;
    if (/^(https?:|mailto:|tel:)/i.test(href)) {
      e.preventDefault();
      try { window.open(href, '_blank', 'noopener,noreferrer'); } catch (_) {}
      return;
    }
    if (/^javascript:/i.test(href)) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
  }, true);
  document.addEventListener('submit', function (e) {
    if (e.target && e.target.tagName === 'FORM') e.preventDefault();
  }, true);
})();
</script>`;

/**
 * Wrap the given HTML so html/body fill the iframe/viewport. If the HTML
 * already has the shim (re-entry through this function), no-op. If it has
 * a <head>, inject before </head>. Otherwise wrap into a minimal document.
 * Also injects the navigation guard script (idempotent — checks a window
 * flag so multiple wraps don't double-install handlers).
 */
export function wrapHtmlForViewportFit(html: string): string {
  if (!html) return html;
  if (html.includes('id="df-viewport-fit"')) return html;
  const injection = `${VIEWPORT_FIT_STYLE}\n${NAV_GUARD_SCRIPT}`;
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${injection}\n</head>`);
  }
  return `<!doctype html><html><head>${injection}</head><body>${html}</body></html>`;
}

/**
 * Inject ONLY the nav guard (no viewport-fit style) — used by the main
 * preview iframe which doesn't go through the letterbox wrapper. Keeps
 * relative links / form submits from escaping the design into the parent
 * origin (localhost:1420). Idempotent via the `df-nav-guard` id.
 */
export function injectNavGuardIntoHtml(html: string): string {
  if (!html) return html;
  if (html.includes('id="df-nav-guard"')) return html;
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${NAV_GUARD_SCRIPT}\n</body>`);
  }
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${NAV_GUARD_SCRIPT}\n</head>`);
  }
  return `${html}\n${NAV_GUARD_SCRIPT}`;
}

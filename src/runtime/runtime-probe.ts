// runtime-probe.ts — Runtime Completion Gate, in-iframe half.
//
// The probe is a small JavaScript snippet that runs INSIDE the
// sandboxed iframe (`sandbox="allow-scripts"`, NO `allow-same-origin`).
// The parent
// can't read `iframe.contentDocument` cross-frame, so the probe measures
// from the inside and reports back via `postMessage`.
//
// We export it as a string template so the orchestrator (`runtime-p0.ts`)
// can stitch it into either:
//   - a blob URL containing `<artifact-content><script>PROBE</script>`
//   - a `srcdoc` value (test path / very small artifacts)
//   - a server-injected rewrite (preview-server territory)
//
// The probe is deliberately self-contained: no imports, no external state,
// no DOM mutations beyond installing event listeners. If the artifact under
// test contains a syntax error pre-paint, the probe never runs and the
// parent times out → catastrophic.

/**
 * The in-iframe probe source. Read it as a complete, self-contained IIFE
 * that:
 *   - listens for `error` events (script errors + asset 404s).
 *   - shadows `console.error` to capture local messages.
 *   - measures `body.getBoundingClientRect()` once `document.fonts.ready`
 *     resolves (or after a short idle if fonts API is missing).
 *   - posts a single `df:runtime-p0` message to `window.parent` and exits.
 *
 * Critical design notes:
 *   - We post once. Re-firing on resize/scroll would race the parent's
 *     listener and cause flapping metrics.
 *   - We don't try to walk the entire DOM — `visibleChildCount` is a coarse
 *     "anything visible at all?" signal, not a layout audit.
 *   - We never throw out of the IIFE. A throw inside the probe would
 *     manifest as `probe-no-payload` to the parent, which would be
 *     misdiagnosed as an artifact catastrophic fail.
 *
 * The string is intentionally formatted with single-line statements where
 * possible so that mismatched comments inside the artifact body can't
 * accidentally swallow the probe.
 */
export const RUNTIME_PROBE_SOURCE = `(() => {
  var SOURCE = 'df-runtime-probe';
  var t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  var errors = [];
  var asset404s = [];

  function send(payload) {
    try {
      window.parent.postMessage(Object.assign({ source: SOURCE, type: 'df:runtime-p0' }, payload), '*');
    } catch (e) { /* iframe got detached; nothing else we can do. */ }
  }

  // Window error listener — captures syntax/runtime errors from the
  // artifact's own scripts. Bubbles up before the artifact's onerror, so
  // even artifacts that swallow their own errors still leak to us.
  window.addEventListener('error', function (ev) {
    if (ev && ev.target && ev.target !== window) {
      var t = ev.target;
      var src = t && (t.src || t.href || '');
      if (src) asset404s.push(String(src));
      return;
    }
    var msg = '';
    if (ev && ev.message) msg = String(ev.message);
    else if (ev && ev.error) msg = String(ev.error);
    if (msg) errors.push(msg);
  }, true);

  // Promise rejection capture (uncaught rejections are runtime-fatal-ish).
  window.addEventListener('unhandledrejection', function (ev) {
    var reason = ev && ev.reason;
    var msg = (reason && (reason.message || reason.toString && reason.toString())) || String(reason);
    if (msg) errors.push('unhandled-rejection: ' + msg);
  });

  // console.error shadow — capture artifact-emitted errors without
  // interfering with the artifact's own logging behaviour. We forward to
  // the original implementation so devtools still show the message.
  try {
    var origError = console.error.bind(console);
    console.error = function () {
      try {
        var parts = [];
        for (var i = 0; i < arguments.length; i++) parts.push(String(arguments[i]));
        errors.push(parts.join(' '));
      } catch (_) { /* */ }
      return origError.apply(console, arguments);
    };
  } catch (_) { /* console may not be writable in some sandboxes. */ }

  function measureAndSend() {
    var rect = { width: 0, height: 0 };
    var visibleChildCount = 0;
    try {
      if (document.body) {
        var br = document.body.getBoundingClientRect();
        rect = { width: br.width, height: br.height };
        var nodes = document.body.querySelectorAll('*');
        for (var i = 0; i < nodes.length; i++) {
          var n = nodes[i];
          var r = n.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) visibleChildCount++;
          if (visibleChildCount >= 4096) break;
        }
      }
    } catch (e) { /* getBoundingClientRect can throw on detached nodes. */ }

    var firstPaintMs = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - t0;

    var fontsReady = false;
    function emit() {
      send({
        bodyRect: rect,
        visibleChildCount: visibleChildCount,
        consoleErrors: errors.slice(),
        fontsReady: fontsReady,
        asset404s: asset404s.slice(),
        firstPaintMs: firstPaintMs,
      });
    }

    if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function') {
      var settled = false;
      var fontTimeout = setTimeout(function () {
        if (settled) return;
        settled = true;
        fontsReady = false;
        emit();
      }, 1500);
      document.fonts.ready.then(function () {
        if (settled) return;
        settled = true;
        clearTimeout(fontTimeout);
        fontsReady = true;
        emit();
      }, function () {
        if (settled) return;
        settled = true;
        clearTimeout(fontTimeout);
        fontsReady = false;
        emit();
      });
    } else {
      fontsReady = true; // No fonts API → assume ok.
      emit();
    }
  }

  function runWhenReady() {
    // Tiny grace period so the artifact has a chance to paint after onload.
    setTimeout(measureAndSend, 50);
  }

  if (document.readyState === 'complete') {
    runWhenReady();
  } else {
    window.addEventListener('load', runWhenReady, { once: true });
  }
})();`;

/**
 * Source identifier the parent uses to filter `message` events. The probe
 * stamps `source: "df-runtime-probe"` on every payload — anything without
 * that tag is treated as foreign and ignored.
 */
export const RUNTIME_PROBE_SOURCE_ID = "df-runtime-probe";

/**
 * Message type the parent listens for. Tied to the spec's wire format
 * (`df:runtime-p0`) so we never misroute payloads to/from other features.
 */
export const RUNTIME_PROBE_MESSAGE_TYPE = "df:runtime-p0";

/**
 * Inject the probe into HTML content. Used by the runtime orchestrator and
 * by tests that mount the iframe via `srcdoc`. The probe is appended just
 * before `</body>` if present, otherwise appended to the end.
 *
 * We deliberately do NOT touch the file on disk — this is preview-rewrite
 * only (Amendment v0.3.3). Caller passes the original artifact content; we
 * return the probe-augmented version for mounting.
 */
export function injectProbeIntoHtml(html: string): string {
  const tag = `<script>${RUNTIME_PROBE_SOURCE}</script>`;
  const closeIdx = html.lastIndexOf("</body>");
  if (closeIdx === -1) {
    return html + tag;
  }
  return html.slice(0, closeIdx) + tag + html.slice(closeIdx);
}

/**
 * Shape the probe sends back over postMessage. The parent reconstructs
 * `RuntimeMetrics` from this. Anything unset in the iframe (e.g. fonts API
 * missing) is reported with safe defaults — never undefined fields.
 */
export interface RuntimeProbePayload {
  source: typeof RUNTIME_PROBE_SOURCE_ID;
  type: typeof RUNTIME_PROBE_MESSAGE_TYPE;
  bodyRect: { width: number; height: number };
  visibleChildCount: number;
  consoleErrors: string[];
  fontsReady: boolean;
  asset404s: string[];
  firstPaintMs: number;
}

/**
 * Type guard the parent uses to validate a `message` event before treating
 * it as runtime metrics. We check both the source field AND the message
 * type to avoid colliding with other postMessage-based features (DF tweaks,
 * element-selection overlay, etc.).
 */
export function isRuntimeProbePayload(value: unknown): value is RuntimeProbePayload {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  if (obj["source"] !== RUNTIME_PROBE_SOURCE_ID) return false;
  if (obj["type"] !== RUNTIME_PROBE_MESSAGE_TYPE) return false;
  if (!obj["bodyRect"] || typeof obj["bodyRect"] !== "object") return false;
  if (typeof obj["visibleChildCount"] !== "number") return false;
  if (!Array.isArray(obj["consoleErrors"])) return false;
  if (typeof obj["fontsReady"] !== "boolean") return false;
  if (!Array.isArray(obj["asset404s"])) return false;
  if (typeof obj["firstPaintMs"] !== "number") return false;
  return true;
}

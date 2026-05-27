// inline-edit-bridge.ts — postMessage protocol for inline element editing.
//
// User's ask 2026-05-11: the existing Edit drawer applies !important
// global overrides (Dark/Light/Cyber presets + body-level knobs). User
// wants something fundamentally different: click an element, change its
// text + font + weight + size + color + spacing right where it lives.
//
// This module mirrors the tweaks-bridge architecture:
//   - A self-contained IIFE source (`INLINE_EDIT_LISTENER_SOURCE`) gets
//     injected into the iframe HTML alongside the tweaks listener. It
//     installs mouseover/click handlers that select text-bearing
//     elements, applies inline-style edits when the parent says so,
//     and serializes the final document back when asked.
//   - Parent-side helpers (`postInlineEditToIframe`,
//     `listenInlineEditFromIframe`) wrap the postMessage contract with
//     anti-spoofing via `event.source === iframe.contentWindow`.
//
// The iframe still runs with `sandbox="allow-scripts"` — no
// allow-same-origin — so postMessage is the only channel. Elements are
// addressed via a structural path computed by the IIFE (sequence of
// `tagName + nth-of-type` segments rooted at body), serialized as a
// string in messages.

export type InlineEditStyles = Partial<{
  // Typography
  fontFamily: string;
  fontWeight: string;
  fontSize: string;
  color: string;
  textAlign: string;
  lineHeight: string;
  letterSpacing: string;
  // Size
  width: string;
  height: string;
  // Box
  opacity: string;
  padding: string;
  margin: string;
  borderWidth: string;
  borderStyle: string;
  borderColor: string;
  borderRadius: string;
}>;

export interface InlineEditSelectPayload {
  path: string;
  text: string;
  /** Computed style values for the selected element. Always strings; an
   *  empty string means the element has no inline override and inherits
   *  from cascade. */
  styles: Required<InlineEditStyles>;
  /** Bounding rect in iframe-local coordinates. Parent translates to
   *  viewport coordinates for floating-panel placement using the
   *  iframe's getBoundingClientRect. */
  rect: { x: number; y: number; width: number; height: number };
  /** Total scroll offset of the iframe document — parent adds this to
   *  rect.y if the iframe internally scrolled before the click. */
  scrollY: number;
}

export type InlineEditOutgoingMessage =
  | { type: "df:inline-edit:activate" }
  | { type: "df:inline-edit:deactivate" }
  | { type: "df:inline-edit:apply-style"; path: string; styles: InlineEditStyles }
  | { type: "df:inline-edit:apply-text"; path: string; text: string }
  | { type: "df:inline-edit:get-html" };

export type InlineEditIncomingMessage =
  | { type: "df:inline-edit:select"; payload: InlineEditSelectPayload }
  | { type: "df:inline-edit:deselect" }
  | { type: "df:inline-edit:ack"; ack: "activate" | "deactivate" | "apply-style" | "apply-text" }
  | { type: "df:inline-edit:html"; html: string }
  /** Emitted by the IIFE when the user blurs an in-place contentEditable
   *  session (2-click flow on a text-only element). Carries the final
   *  text after edit — parent forwards via `onApplyText` so the styled
   *  apply-text path stays single-source-of-truth for persisted text. */
  | { type: "df:inline-edit:text-changed"; path: string; text: string };

export const INLINE_EDIT_BRIDGE_SOURCE_ID = "df-inline-edit-bridge";

/**
 * IIFE injected into the iframe. Self-contained — no imports, no module
 * scope. Mirrors the tweaks-bridge listener pattern.
 *
 * Element addressing: each element gets a structural path of
 * `tagName[nth]` segments from <body>. nth is 1-based among same-tag
 * siblings. Lookups walk the same path. Stable as long as element
 * order doesn't change between select and apply, which holds for
 * inline-style mutations on the SAME element.
 *
 * Selectability: an element is editable when it carries direct text
 * (its own textContent excluding descendants' textContent is non-empty)
 * — captures headings, paragraphs, buttons, anchors, list items. We do
 * NOT walk into custom-element internals; shadow DOM is opaque.
 */
export const INLINE_EDIT_LISTENER_SOURCE = `(() => {
  var SOURCE = '${INLINE_EDIT_BRIDGE_SOURCE_ID}';
  var STYLE_ID = '__df-inline-edit-overlay__';
  var SELECTED_ATTR = 'data-df-inline-edit-selected';
  var HOVER_ATTR = 'data-df-inline-edit-hover';
  var active = false;
  var selectedPath = null;
  // Tracks the element currently in contentEditable mode (2-click on a
  // text-only element). null = no inline edit in flight. Path-based so
  // we can survive an element re-render that swaps the DOM node — the
  // path resolves to the new element on blur.
  var editingPath = null;

  function ensureOverlayStyle() {
    var el = document.getElementById(STYLE_ID);
    if (el && el.tagName === 'STYLE') return el;
    el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = [
      '[' + HOVER_ATTR + '] { outline: 1.5px dashed #ef5d3b !important; outline-offset: 2px !important; cursor: text !important; }',
      '[' + SELECTED_ATTR + '] { outline: 2px solid #ef5d3b !important; outline-offset: 2px !important; }',
    ].join('\\n');
    (document.head || document.documentElement).appendChild(el);
    return el;
  }

  function removeOverlayStyle() {
    var el = document.getElementById(STYLE_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function send(msg) {
    try {
      window.parent.postMessage(Object.assign({ source: SOURCE }, msg), '*');
    } catch (e) { /* parent gone; nothing to do. */ }
  }

  // Direct text means at least one non-whitespace text node directly
  // owned by this element (not via descendants). Filters out wrappers
  // that only contain other elements.
  function hasDirectText(el) {
    if (!el || !el.childNodes) return false;
    for (var i = 0; i < el.childNodes.length; i++) {
      var n = el.childNodes[i];
      if (n.nodeType === 3 && n.nodeValue && n.nodeValue.replace(/\\s+/g, '').length > 0) return true;
    }
    return false;
  }

  function isEditable(el) {
    if (!el || el.nodeType !== 1) return false;
    var tag = el.tagName;
    // Hard skip — chrome, scripts, styles, and our own runtime tags.
    if (tag === 'HTML' || tag === 'BODY' || tag === 'HEAD' || tag === 'SCRIPT' || tag === 'STYLE' || tag === 'META' || tag === 'LINK' || tag === 'TITLE') return false;
    // Skip elements inside our overlay / injected runtime markers.
    if (el.id === STYLE_ID) return false;
    // Any visible HTML element is selectable — the drawer edits
    // box/size/typography/border on containers and media as well as text.
    // hasDirectText is no longer a gate (was preventing div/img/card
    // selection). isTextOnly still gates the 2-click contentEditable
    // promotion path, so only safe leaves flip to inline text editing.
    return true;
  }

  // text-only === the element owns a single text node and nothing else.
  // Headings, paragraphs without inline <a>/<strong> markup, buttons
  // with plain labels, etc. We use this for the 2-click promotion: only
  // safe to flip a leaf-text element to contentEditable, since the
  // browser inserts <br> / <div> / formatting elements on Enter when
  // contentEditable wraps a structure-bearing element.
  function isTextOnly(el) {
    if (!el || el.nodeType !== 1) return false;
    if (!el.childNodes || el.childNodes.length !== 1) return false;
    return el.childNodes[0].nodeType === 3;
  }

  function pathOf(el) {
    if (!el || !el.parentNode) return '';
    var parts = [];
    var cur = el;
    while (cur && cur.nodeType === 1 && cur.tagName !== 'BODY') {
      var tag = cur.tagName.toLowerCase();
      var n = 1;
      var sib = cur.previousElementSibling;
      while (sib) {
        if (sib.tagName === cur.tagName) n++;
        sib = sib.previousElementSibling;
      }
      parts.unshift(tag + '[' + n + ']');
      cur = cur.parentElement;
    }
    return parts.join('>');
  }

  function elFromPath(path) {
    if (!path) return null;
    var segs = path.split('>');
    var cur = document.body;
    for (var i = 0; i < segs.length && cur; i++) {
      var m = segs[i].match(/^(.+)\\[(\\d+)\\]$/);
      if (!m) return null;
      var tag = m[1].toUpperCase();
      var n = parseInt(m[2], 10);
      var found = null;
      var count = 0;
      var kids = cur.children;
      for (var j = 0; j < kids.length; j++) {
        if (kids[j].tagName === tag) {
          count++;
          if (count === n) { found = kids[j]; break; }
        }
      }
      if (!found) return null;
      cur = found;
    }
    return cur;
  }

  function readStyles(el) {
    var cs = window.getComputedStyle(el);
    return {
      // Typography
      fontFamily: cs.fontFamily || '',
      fontWeight: cs.fontWeight || '',
      fontSize: cs.fontSize || '',
      color: cs.color || '',
      textAlign: cs.textAlign || '',
      lineHeight: cs.lineHeight || '',
      letterSpacing: cs.letterSpacing || '',
      // Size
      width: cs.width || '',
      height: cs.height || '',
      // Box
      opacity: cs.opacity || '',
      padding: cs.padding || '',
      margin: cs.margin || '',
      borderWidth: cs.borderWidth || '',
      borderStyle: cs.borderStyle || '',
      borderColor: cs.borderColor || '',
      borderRadius: cs.borderRadius || '',
    };
  }

  function directText(el) {
    if (!el || !el.childNodes) return '';
    // Direct text node concatenation. Doesn't include child elements.
    var out = '';
    for (var i = 0; i < el.childNodes.length; i++) {
      var n = el.childNodes[i];
      if (n.nodeType === 3) out += n.nodeValue;
    }
    return out;
  }

  function emitSelect(el) {
    var path = pathOf(el);
    if (!path) return;
    selectedPath = path;
    // Clear previous selection marker, set new.
    var prev = document.querySelector('[' + SELECTED_ATTR + ']');
    if (prev && prev !== el) prev.removeAttribute(SELECTED_ATTR);
    el.setAttribute(SELECTED_ATTR, '');
    var rect = el.getBoundingClientRect();
    send({
      type: 'df:inline-edit:select',
      payload: {
        path: path,
        text: directText(el),
        styles: readStyles(el),
        rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
        scrollY: window.scrollY || document.documentElement.scrollTop || 0,
      },
    });
  }

  function clearSelection() {
    var prev = document.querySelector('[' + SELECTED_ATTR + ']');
    if (prev) prev.removeAttribute(SELECTED_ATTR);
    selectedPath = null;
    send({ type: 'df:inline-edit:deselect' });
  }

  function onMouseOver(ev) {
    if (!active) return;
    var t = ev.target;
    if (!isEditable(t)) return;
    var prev = document.querySelector('[' + HOVER_ATTR + ']');
    if (prev && prev !== t) prev.removeAttribute(HOVER_ATTR);
    t.setAttribute(HOVER_ATTR, '');
  }

  function onMouseOut(ev) {
    if (!active) return;
    var t = ev.target;
    if (t && t.removeAttribute) t.removeAttribute(HOVER_ATTR);
  }

  function startInlineTextEdit(el) {
    if (!el || el.nodeType !== 1) return;
    if (editingPath) return; // already editing
    editingPath = pathOf(el);
    try {
      el.setAttribute('contenteditable', 'true');
      // Suppress browser-native spell-check noise during quick edits.
      el.setAttribute('spellcheck', 'false');
      el.focus();
      // Place caret at end so typing continues from current text rather
      // than overwriting the selection. Falls back silently when the
      // selection API is missing.
      try {
        var range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        var sel = window.getSelection();
        if (sel) { sel.removeAllRanges(); sel.addRange(range); }
      } catch (e) { /* selection API unavailable */ }
    } catch (e) { editingPath = null; }
  }

  function endInlineTextEdit(el) {
    if (!el || el.nodeType !== 1) return;
    var path = editingPath;
    editingPath = null;
    try {
      el.removeAttribute('contenteditable');
      el.removeAttribute('spellcheck');
    } catch (e) { /* */ }
    // Capture the post-edit text — prefer innerText so we get the
    // displayed string (no leading/trailing whitespace newlines from
    // contentEditable inserts). Fall back to textContent.
    var text = '';
    try { text = el.innerText || el.textContent || ''; } catch (e) { text = ''; }
    if (path) {
      send({ type: 'df:inline-edit:text-changed', path: path, text: text });
    }
  }

  function onClick(ev) {
    if (!active) return;
    var t = ev.target;
    // If we're inside an active inline edit, never re-select. Let the
    // browser handle the caret placement inside contentEditable.
    if (editingPath) return;
    if (!isEditable(t)) {
      clearSelection();
      return;
    }
    // Prevent links / buttons from navigating or submitting while we're
    // in edit mode — the click is for SELECTION, not action.
    ev.preventDefault();
    ev.stopPropagation();
    // 2-click promote: same element already selected + text-only → flip
    // to contentEditable for in-place text editing. Otherwise, plain
    // 1-click select.
    var path = pathOf(t);
    if (path && path === selectedPath && isTextOnly(t)) {
      startInlineTextEdit(t);
      return;
    }
    emitSelect(t);
  }

  function onBlurCapture(ev) {
    if (!active) return;
    if (!editingPath) return;
    var t = ev.target;
    // Only end inline edit when blur came from the element we're editing
    // — blurs from other elements (e.g. drawer inputs in the host page)
    // shouldn't end the iframe-side edit.
    if (!t || t.nodeType !== 1) return;
    if (pathOf(t) !== editingPath) return;
    endInlineTextEdit(t);
  }

  function onKeyDownCapture(ev) {
    if (!active) return;
    if (ev.key !== 'Escape' && ev.keyCode !== 27) return;
    if (editingPath) {
      // ESC while editing inline → end the edit; keep the drawer open
      // by NOT clearing selection. The host can re-issue a new select
      // by clicking again.
      var el = elFromPath(editingPath);
      ev.preventDefault();
      ev.stopPropagation();
      if (el) endInlineTextEdit(el);
      return;
    }
    if (selectedPath) {
      // ESC while just selected → clear selection, drawer closes.
      ev.preventDefault();
      ev.stopPropagation();
      clearSelection();
    }
  }

  function activate() {
    if (active) return;
    active = true;
    ensureOverlayStyle();
    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('mouseout', onMouseOut, true);
    document.addEventListener('click', onClick, true);
    // blur uses capture-phase because it doesn't bubble.
    document.addEventListener('blur', onBlurCapture, true);
    document.addEventListener('keydown', onKeyDownCapture, true);
    send({ type: 'df:inline-edit:ack', ack: 'activate' });
  }

  function deactivate() {
    if (!active) return;
    active = false;
    // Finalise any inline edit so we don't leak contenteditable=true on
    // the artifact when select mode toggles off mid-edit.
    if (editingPath) {
      var stale = elFromPath(editingPath);
      if (stale) endInlineTextEdit(stale);
      editingPath = null;
    }
    document.removeEventListener('mouseover', onMouseOver, true);
    document.removeEventListener('mouseout', onMouseOut, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('blur', onBlurCapture, true);
    document.removeEventListener('keydown', onKeyDownCapture, true);
    var hov = document.querySelector('[' + HOVER_ATTR + ']');
    if (hov) hov.removeAttribute(HOVER_ATTR);
    clearSelection();
    removeOverlayStyle();
    send({ type: 'df:inline-edit:ack', ack: 'deactivate' });
  }

  // Map camelCase keys to the CSS property name expected by
  // setProperty (kebab-case). setProperty is REQUIRED to pass the
  // 'important' priority flag — assigning to el.style[prop] never
  // sets !important, which means our inline edits lost specificity
  // battles against any class rule using !important in the design.
  // 2026-05-11 user repro: font-size + padding silently no-op.
  var kebabMap = {
    // Typography
    fontFamily: 'font-family',
    fontWeight: 'font-weight',
    fontSize: 'font-size',
    color: 'color',
    textAlign: 'text-align',
    lineHeight: 'line-height',
    letterSpacing: 'letter-spacing',
    // Size
    width: 'width',
    height: 'height',
    // Box
    opacity: 'opacity',
    padding: 'padding',
    margin: 'margin',
    borderWidth: 'border-width',
    borderStyle: 'border-style',
    borderColor: 'border-color',
    borderRadius: 'border-radius',
  };

  function applyStyle(path, styles) {
    var el = elFromPath(path);
    if (!el || !styles || typeof styles !== 'object') return;
    for (var key in styles) {
      if (!Object.prototype.hasOwnProperty.call(styles, key)) continue;
      var prop = kebabMap[key];
      if (!prop) continue;
      var val = styles[key];
      if (typeof val !== 'string') continue;
      if (val === '') {
        el.style.removeProperty(prop);
      } else {
        // 'important' priority — wins against any class rule that
        // also uses !important. Inline-style by itself only beats
        // non-important class rules; this is the canonical escape
        // hatch for in-place editing.
        el.style.setProperty(prop, val, 'important');
      }
    }
    send({ type: 'df:inline-edit:ack', ack: 'apply-style' });
  }

  function applyText(path, text) {
    var el = elFromPath(path);
    if (!el || typeof text !== 'string') return;
    // Replace only the direct text-node children, preserve nested
    // elements so inline links / spans inside a paragraph survive.
    // Strategy: remove existing direct text nodes, then prepend a
    // single new text node. Position is "before any existing
    // descendant elements" which matches the visual expectation for
    // simple headings/paragraphs.
    var toRemove = [];
    for (var i = 0; i < el.childNodes.length; i++) {
      var n = el.childNodes[i];
      if (n.nodeType === 3) toRemove.push(n);
    }
    for (var k = 0; k < toRemove.length; k++) el.removeChild(toRemove[k]);
    var textNode = document.createTextNode(text);
    el.insertBefore(textNode, el.firstChild);
    send({ type: 'df:inline-edit:ack', ack: 'apply-text' });
  }

  function emitHtml() {
    var clone = document.documentElement.cloneNode(true);
    // Strip our overlay style + selection markers before serializing.
    var style = clone.querySelector('#' + STYLE_ID);
    if (style && style.parentNode) style.parentNode.removeChild(style);
    var marked = clone.querySelectorAll('[' + SELECTED_ATTR + '], [' + HOVER_ATTR + ']');
    for (var i = 0; i < marked.length; i++) {
      marked[i].removeAttribute(SELECTED_ATTR);
      marked[i].removeAttribute(HOVER_ATTR);
    }
    var html = '<!DOCTYPE html>\\n' + clone.outerHTML;
    send({ type: 'df:inline-edit:html', html: html });
  }

  window.addEventListener('message', function (ev) {
    var data = ev && ev.data;
    if (!data || typeof data !== 'object') return;
    var t = data.type;
    if (t === 'df:inline-edit:activate') activate();
    else if (t === 'df:inline-edit:deactivate') deactivate();
    else if (t === 'df:inline-edit:apply-style') applyStyle(data.path, data.styles);
    else if (t === 'df:inline-edit:apply-text') applyText(data.path, data.text);
    else if (t === 'df:inline-edit:get-html') emitHtml();
  });
})();`;

/**
 * Inject the inline-edit listener into HTML content. Mirrors
 * `injectTweaksListenerIntoHtml` — preview-only rewrite, never touches
 * disk. The listener self-installs as inactive; it only attaches DOM
 * handlers after receiving `df:inline-edit:activate` from the parent.
 *
 * Safe to call alongside the tweaks injection — both append before
 * `</body>` and don't conflict (different SOURCE ids, different message
 * vocabularies, no shared globals).
 */
export function injectInlineEditListenerIntoHtml(html: string): string {
  const tag = `<script data-df="inline-edit-bridge">${INLINE_EDIT_LISTENER_SOURCE}</script>`;
  const closeIdx = html.lastIndexOf("</body>");
  if (closeIdx === -1) return html + tag;
  return html.slice(0, closeIdx) + tag + html.slice(closeIdx);
}

/**
 * Wraps a postMessage in our anti-spoof envelope and sends to the iframe.
 * Mirrors postTweaksToIframe — same signature, different message types.
 */
export function postInlineEditToIframe(
  iframe: HTMLIFrameElement,
  msg: InlineEditOutgoingMessage,
): void {
  const w = iframe.contentWindow;
  if (!w) return;
  try {
    w.postMessage(msg, "*");
  } catch {
    /* sandboxed window may throw on early postMessage; safe to swallow */
  }
}

/**
 * Subscribe to messages from this specific iframe. The handler only
 * fires for messages stamped with our SOURCE id (filters out tweaks-
 * bridge, runtime-probe, and any other postMessage feature) and whose
 * `event.source` matches the iframe's contentWindow (anti-spoof).
 *
 * Returns an unsubscribe function.
 */
export function listenInlineEditFromIframe(
  iframe: HTMLIFrameElement,
  handler: (msg: InlineEditIncomingMessage) => void,
): () => void {
  const onMessage = (ev: MessageEvent) => {
    if (ev.source !== iframe.contentWindow) return;
    const data = ev.data;
    if (!data || typeof data !== "object") return;
    if (data.source !== INLINE_EDIT_BRIDGE_SOURCE_ID) return;
    const t = data.type;
    if (
      t === "df:inline-edit:select" ||
      t === "df:inline-edit:deselect" ||
      t === "df:inline-edit:ack" ||
      t === "df:inline-edit:html" ||
      t === "df:inline-edit:text-changed"
    ) {
      handler(data as InlineEditIncomingMessage);
    }
  };
  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}

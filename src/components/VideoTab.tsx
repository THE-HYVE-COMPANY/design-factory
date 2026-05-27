// Video Tab — first-class workspace for HTML→MP4 export.
//
// Architecture per Frame's blueprint (df-video-journey-architecture.md)
// and Lens's flows (df-video-journey-flows.md). Layout: stage centered
// with letterbox of the chosen ratio on top, multi-track timeline below,
// inspector on the right that mutates by render phase (idle / rendering
// / done / error).
//
// Tab is opt-in: user clicks the "Video" labeled button in the editor
// toolbar to add it. Closes via the X on the tab itself, like terminal
// or files.

import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/i18n";
import { parseTimeline, type TimelineSummary } from "@/runtime/timeline-parser";
import { parseSceneManifest } from "@/runtime/scene-manifest";
import { SceneTimeline } from "@/components/SceneTimeline";
import { SceneInspector } from "@/components/SceneInspector";
import { TextInspector, type TextSelection } from "@/components/TextInspector";
import { AudioTrack } from "@/components/AudioTrack";
import { renderVideo, detectDeterminismIssues, type HyperframesPhase, type DeterminismIssue, type RatioId } from "@/runtime/hyperframes-invoker";

interface RatioMeta {
  id: RatioId;
  name: string;
  meta: string;
  aspect: string;
}

const RATIOS: RatioMeta[] = [
  { id: "16:9", name: "16:9", meta: "1920×1080", aspect: "16/9" },
  { id: "9:16", name: "9:16", meta: "1080×1920", aspect: "9/16" },
  { id: "1:1",  name: "1:1",  meta: "1080×1080", aspect: "1/1" },
  { id: "4k",   name: "4K",   meta: "3840×2160", aspect: "16/9" },
];

interface RenderState {
  phase: HyperframesPhase | "idle";
  progress: number;
  frame?: number;
  totalFrames?: number;
  result?: { mp4Path: string; durationMs: number; sizeBytes: number };
  error?: { kind: string; message: string };
}

interface Props {
  projectSlug: string;
  iframeHtml: string;
  /** Show a one-time welcome tooltip on first open. Caller passes
   *  current localStorage flag value; component sets it on dismiss. */
  showOnboarding: boolean;
  onOnboardingDismiss: () => void;
  /** Update the project's HTML in-place (re-renders iframe). Used by
   *  the scene timeline when timing fields are edited. */
  onHtmlChange?: (next: string) => void;
  /** Send a scene-scoped refine prompt up to the chat. Host decides
   *  whether to pre-fill the input or auto-send. */
  onRefineScene?: (sceneId: string, prompt: string) => void;
  /** Lifted ratio state — VideoTab + EditorScreen canvas share it so
   *  picking 9:16 in the inspector reshapes the editor preview too. */
  ratio: RatioId;
  /** Click on a ratio button doesn't apply directly — it asks the host
   *  to confirm + regenerate the HTML. Host owns the state machine and
   *  decides whether the click opens a modal, no-ops, or short-circuits
   *  for cover-only projects. */
  onRatioChangeRequest: (next: RatioId) => void;
  /** True while a regen is streaming. Disables the ratio + render
   *  buttons so the user can't fire a second pass mid-stream. */
  regenerating?: boolean;
}

// ─── Text-edit helpers ─────────────────────────────────────────────────
// Tags whose direct text content the user is allowed to edit. Excludes
// containers (div, section) so a click in a scene doesn't select the entire
// scene wrapper. Buttons + links are included so CTAs are editable.
// Including `div` is essential — reels-style compositions use divs for
// every text block (.kicker, .label, .pill, .mega, etc). The `hasDirectText`
// guard inside findTextElement keeps purely-structural divs out (a div
// with no direct text node child won't match).
const EDITABLE_TAGS = new Set([
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "span", "a", "button", "li", "label",
  "figcaption", "blockquote", "time", "em", "strong",
  "small", "mark", "cite", "q", "abbr",
  "div", "code", "kbd", "samp",
  "dt", "dd", "td", "th",
  "i", "b", "u",
]);

// Walk up from the click target until we hit an editable tag with direct
// text content. Returns null if no candidate found within 6 levels.
function findTextElement(el: Element): Element | null {
  let current: Element | null = el;
  for (let depth = 0; depth < 6 && current; depth++) {
    const tag = current.tagName.toLowerCase();
    if (EDITABLE_TAGS.has(tag)) {
      // Must have direct text content (a textNode child), not just nested
      const hasDirectText = Array.from(current.childNodes).some(
        (n) => n.nodeType === 3 && (n.textContent ?? "").trim().length > 0
      );
      if (hasDirectText) return current;
    }
    current = current.parentElement;
  }
  return null;
}

// Check if element + all ancestors are actually rendered (opacity > 0,
// not display:none, not visibility:hidden). Critical for video previews
// where scenes are absolutely-stacked and most are at opacity:0 at any
// given timeline position. Without this filter, click hit-testing
// happily targets invisible scene-01 elements while the user is
// looking at scene-03.
function isElementVisible(el: Element): boolean {
  const win = el.ownerDocument?.defaultView;
  if (!win) return true;
  let current: Element | null = el;
  while (current && current.tagName.toLowerCase() !== "html") {
    const cs = win.getComputedStyle(current);
    if (cs.display === "none") return false;
    if (cs.visibility === "hidden") return false;
    const opacity = parseFloat(cs.opacity);
    if (Number.isFinite(opacity) && opacity < 0.05) return false;
    current = current.parentElement;
  }
  return true;
}

// Pick the topmost editable + visible element at a viewport coordinate.
// elementsFromPoint() returns the stack of hit elements top-to-bottom;
// we walk it and take the first that contains an editable text element
// AND is currently visible (filters out faded-out scenes). Returns null
// if nothing visible matches — better than returning a hidden element
// from another scene which confuses the user.
function pickVisibleTextElementAtPoint(
  doc: Document,
  x: number,
  y: number,
): Element | null {
  const stack = doc.elementsFromPoint(x, y);
  for (const candidate of stack) {
    const found = findTextElement(candidate);
    if (!found) continue;
    if (isElementVisible(found)) return found;
  }
  return null;
}

// Generate an XPath from the document root to the given element. Uses
// element id when available (most stable), otherwise tag + position among
// siblings. Survives most DOM mutations except sibling reordering.
function getXPath(el: Element): string {
  if (el.id) return `//*[@id="${el.id}"]`;
  const parts: string[] = [];
  let current: Element | null = el;
  while (current && current.nodeType === 1 && current.tagName.toLowerCase() !== "html") {
    const parent: Element | null = current.parentElement;
    const tagName = current.tagName;
    let part = tagName.toLowerCase();
    if (parent) {
      const siblings: Element[] = Array.from(parent.children).filter(
        (c: Element) => c.tagName === tagName,
      );
      if (siblings.length > 1) {
        const idx = siblings.indexOf(current) + 1;
        part += `[${idx}]`;
      }
    }
    parts.unshift(part);
    current = parent;
  }
  return "/" + parts.join("/");
}

// Resolve an XPath back to an element in the given document. Returns null
// if the path no longer matches anything (DOM mutated since selection).
function resolveXPath(doc: Document, xpath: string): Element | null {
  try {
    const result = doc.evaluate(xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    return (result.singleNodeValue as Element) ?? null;
  } catch {
    return null;
  }
}

// Best-effort context label like "scene-01 / kicker · h1". Walks up looking
// for landmarks (data-scene, section with class, semantic tags).
function getContextLabel(el: Element): string {
  const parts: string[] = [];
  let current: Element | null = el.parentElement;
  while (current && current.tagName.toLowerCase() !== "body") {
    const dataScene = current.getAttribute("data-scene");
    if (dataScene) {
      parts.unshift(dataScene);
      break;
    }
    const tagLower = current.tagName.toLowerCase();
    if (tagLower === "section" || tagLower === "article" || tagLower === "header" || tagLower === "footer") {
      const klass = current.className && typeof current.className === "string" ? current.className.split(" ")[0] : "";
      parts.unshift(klass || tagLower);
      break;
    }
    current = current.parentElement;
  }
  return parts.length > 0 ? parts.join(" / ") : "";
}

// Strip transport-shim artifacts (style="animation-play-state: paused"
// inline writes, data-df-text-hover/selected attrs) so the search string
// we use for source patching matches the on-disk HTML, which doesn't have
// any of these runtime-only mutations.
function stripDfArtifacts(html: string): string {
  return html
    .replace(/\s*data-df-text-(hover|selected)="[^"]*"/g, "")
    .replace(/\s*style="[^"]*animation-play-state:\s*paused[^"]*"/g, "")
    .replace(/animation-play-state:\s*paused\s*!important;?\s*/g, "");
}

export function VideoTab({ projectSlug, iframeHtml, showOnboarding, onOnboardingDismiss, onHtmlChange, onRefineScene, ratio, onRatioChangeRequest, regenerating = false }: Props) {
  const { t } = useT();
  // Parsed timeline of the current HTML. Re-parses whenever the iframe
  // content changes — the user can edit composition in the chat and
  // see new tracks appear here without re-mounting.
  const timeline: TimelineSummary = useMemo(() => parseTimeline(iframeHtml), [iframeHtml]);
  const issues: DeterminismIssue[] = useMemo(() => detectDeterminismIssues(iframeHtml), [iframeHtml]);
  // Scene manifest — preferred when the AI emitted the contract. Falls
  // back to null and we render the legacy track-based Timeline.
  const manifest = useMemo(() => parseSceneManifest(iframeHtml), [iframeHtml]);
  // Render-flow state machine.
  const [render, setRender] = useState<RenderState>({ phase: "idle", progress: 0 });
  const cancelRef = useRef<(() => void) | null>(null);

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [resolution, setResolution] = useState<ResolutionId>("1080p");
  // Bumping this key remounts the preview iframe so animations restart
  // from frame 0. The legacy transport's "Replay" button drives it.
  const [replayKey, setReplayKey] = useState(0);

  const totalDurationSec = Math.round(timeline.totalDurationMs / 1000);

  // ── Stage sizing — JS sizing wins over CSS aspect-ratio + max-* combo ──
  // The CSS-only attempt failed because `max-height: 95%` clips the
  // height that aspectRatio computed, and the spec says the ratio is
  // not enforced once a constraint takes over. User reported (twice)
  // that 9:16 / 1:1 didn't reshape the letterbox. We size by JS:
  // measure stage W×H via ResizeObserver, fit the ratio inside a 95%
  // safe area, set width/height in pixels.
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageDims, setStageDims] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => setStageDims({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const letterLayout = useMemo(() => {
    const r = RATIOS.find((x) => x.id === ratio);
    const [aw, ah] = (r?.aspect ?? "16/9").split("/").map(Number);
    const ar = aw / ah;
    const maxW = stageDims.w * 0.95;
    const maxH = stageDims.h * 0.95;
    if (maxW <= 0 || maxH <= 0) return { width: 0, height: 0, scale: 1, vw: 0, vh: 0 };
    let w = maxW;
    let h = w / ar;
    if (h > maxH) {
      h = maxH;
      w = h * ar;
    }
    // Intrinsic viewport per ratio. Iframe is rendered at this size and
    // scaled with transform — same trick as CanvasStage. Avoids the
    // viewport-fit shim trap where forcing html/body to 100% breaks
    // absolute-positioned content authored for the source pixel grid.
    const vp = ratio === "9:16" ? { w: 1080, h: 1920 }
      : ratio === "1:1" ? { w: 1080, h: 1080 }
      : ratio === "4k" ? { w: 3840, h: 2160 }
      : { w: 1920, h: 1080 };
    const scale = Math.min(w / vp.w, h / vp.h);
    return { width: Math.floor(w), height: Math.floor(h), scale, vw: vp.w, vh: vp.h };
  }, [stageDims, ratio]);

  // ── Transport — play, loop, elapsed, playhead ────────────────────────
  // CSS @keyframes can't be paused/scrubbed without iframe-side
  // cooperation (postMessage protocol we don't have yet). What we CAN
  // do: drive a wall-clock playhead, auto-loop by remounting the iframe
  // when the elapsed time hits manifest.duration, and let the user click
  // the track to "seek" (interpreted as restart-from-zero, since CSS
  // can't seek mid-animation). Honest names: "Replay" not "Play"; the
  // play button restarts. Loop toggles the auto-restart on duration.
  const sceneTotalSec = useMemo(() => {
    if (!manifest) return totalDurationSec;
    return manifest.duration || manifest.scenes.reduce((m, s) => Math.max(m, s.start + s.duration), 0);
  }, [manifest, totalDurationSec]);
  const [isPlaying, setIsPlaying] = useState(true);
  const [loop, setLoop] = useState(true);
  const [elapsedMs, setElapsedMs] = useState(0);
  const playEpochRef = useRef<number>(performance.now());
  // Iframe ref + helper to inject a pause/seek stylesheet inside the iframe.
  // ─── Frame-accurate scrub via animation-delay trick ─────────────────
  // CSS @keyframes can't be seeked, but `animation-delay: -Ts` rewinds
  // an animation T seconds before its origin — combined with paused
  // play-state, the page renders the FRAME at offset T and freezes.
  // Drag the playhead → emit a CSS rule with the new T → iframe shows
  // that frame. No postMessage, no HTML cooperation. Works for any
  // CSS-driven motion (keyframes, transitions are blocked).
  const previewIframeRef = useRef<HTMLIFrameElement>(null);
  const syncPlayStateToIframe = (
    playing: boolean,
    elapsedMsArg: number,
  ) => {
    const iframe = previewIframeRef.current;
    const doc = iframe?.contentDocument;
    if (!doc) {
      console.warn("[df:transport] no iframe doc — ref null or contentDocument inaccessible");
      return;
    }
    const offsetMs = Math.max(0, elapsedMsArg);
    const root = doc.documentElement;
    if (!root) return;

    // Inline style with !important on EVERY element. This is the most
    // aggressive way to override animation-play-state — inline + important
    // beats any external stylesheet rule regardless of specificity.
    // Belt-and-suspenders: also inject a global <style> tag.
    const STYLE_ID = "df-transport-shim";
    let styleTag = doc.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!styleTag) {
      styleTag = doc.createElement("style");
      styleTag.id = STYLE_ID;
      doc.head?.appendChild(styleTag);
    }

    if (playing) {
      // Resume: drop overrides so animations advance under their own CSS.
      styleTag.textContent = "";
      const els = doc.querySelectorAll<HTMLElement>("*");
      for (const el of els) {
        if (el.style.animationPlayState) {
          el.style.removeProperty("animation-play-state");
        }
      }
      // Then seek + play via WAAPI so post-scrub continues from right spot
      let anims: Animation[] = [];
      try { anims = doc.getAnimations(); } catch {}
      for (const a of anims) {
        try { a.currentTime = offsetMs; a.play(); } catch {}
      }
      return;
    }

    // Pause: belt-and-suspenders. Inline style on every element + global
    // !important rule. Even if one fails, the other should hold.
    styleTag.textContent = `*, *::before, *::after { animation-play-state: paused !important; }`;
    const els = doc.querySelectorAll<HTMLElement>("*");
    let inlineCount = 0;
    for (const el of els) {
      try {
        el.style.setProperty("animation-play-state", "paused", "important");
        inlineCount++;
      } catch {}
    }
    let anims: Animation[] = [];
    try { anims = doc.getAnimations(); } catch {}
    for (const a of anims) {
      try {
        a.pause();
        a.currentTime = offsetMs;
      } catch {}
    }
  };
  // Keep the iframe in sync whenever isPlaying or elapsed flips. Reading
  // from refs inside a useEffect that depends on the values keeps the
  // closure fresh without re-running the whole effect on every elapsed
  // tick — that's the responsibility of handleScrubMove which calls
  // syncPlayStateToIframe directly.
  useEffect(() => {
    syncPlayStateToIframe(isPlaying, elapsedMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);
  // When the project HTML changes (regen / chat refine), restart from 0
  // so the playhead and the iframe agree. Don't reset on replayKey alone
  // — handlers below already manage the epoch + elapsed when they bump
  // the key, and a useEffect on replayKey would race with their writes.
  useEffect(() => {
    playEpochRef.current = performance.now();
    setElapsedMs(0);
    setIsPlaying(true);
  }, [iframeHtml]);
  // Scrubbing flag — when the user is dragging the playhead we suppress
  // the RAF tick so it doesn't fight the manual position the parent is
  // pushing in via onScrubMove.
  const isScrubbingRef = useRef(false);
  useEffect(() => {
    if (!isPlaying || sceneTotalSec <= 0) return;
    let raf = 0;
    const tick = () => {
      if (!isScrubbingRef.current) {
        const e = performance.now() - playEpochRef.current;
        setElapsedMs(e);
        const durMs = sceneTotalSec * 1000;
        if (e >= durMs) {
          if (loop) {
            playEpochRef.current = performance.now();
            setReplayKey((k) => k + 1);
            setElapsedMs(0);
          } else {
            setIsPlaying(false);
            setElapsedMs(durMs);
            return;
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, loop, sceneTotalSec]);
  const handlePlayToggle = () => {
    if (isPlaying) {
      setIsPlaying(false);
      // Imperative call — don't wait for the [isPlaying] effect, which
      // can race with other effects that touch isPlaying (or be skipped
      // entirely if React batches the state update with another setter
      // that lands in the same render).
      syncPlayStateToIframe(false, elapsedMs);
      return;
    }
    playEpochRef.current = performance.now() - elapsedMs;
    setIsPlaying(true);
    syncPlayStateToIframe(true, elapsedMs);
  };
  const handleReplay = () => {
    setReplayKey((k) => k + 1);
    setElapsedMs(0);
    playEpochRef.current = performance.now();
    setIsPlaying(true);
  };
  const handleSeek = (timeMs: number) => {
    // One-shot seek (click track): land playhead + freeze iframe at
    // that frame. Use the animation-delay trick so the visible frame
    // matches the playhead position.
    const clamped = Math.max(0, Math.min(timeMs, sceneTotalSec * 1000));
    setIsPlaying(false);
    setElapsedMs(clamped);
    playEpochRef.current = performance.now() - clamped;
    // Force-sync immediately, the [isPlaying] effect won't refire if
    // we were already paused.
    syncPlayStateToIframe(false, clamped);
  };
  const handleScrubMove = (timeMs: number) => {
    // Live scrub: move the playhead AND seek the iframe to that frame
    // via animation-delay. Frame-accurate as long as the HTML uses
    // CSS @keyframes (which our format contracts demand). Pauses
    // transport — Play resumes from where the user dropped the head.
    isScrubbingRef.current = true;
    setIsPlaying(false);
    const clamped = Math.max(0, Math.min(timeMs, sceneTotalSec * 1000));
    setElapsedMs(clamped);
    // Force-sync the iframe each scrub move — the [isPlaying] effect
    // only fires on isPlaying flips, so during a continuous drag we
    // need to push the new offset directly.
    syncPlayStateToIframe(false, clamped);
  };
  const handleScrubEnd = (timeMs: number) => {
    isScrubbingRef.current = false;
    const clamped = Math.max(0, Math.min(timeMs, sceneTotalSec * 1000));
    setElapsedMs(clamped);
    playEpochRef.current = performance.now() - clamped;
    syncPlayStateToIframe(false, clamped);
  };

  // ── Copy current frame to clipboard ──────────────────────────────────
  // Captures the iframe's *visible* DOM by serializing it through an
  // <foreignObject> SVG → <img> → <canvas>. Works with any HTML the AI
  // generated; no html2canvas dependency.
  const [, setCopyFrameLabel] = useState<string | null>(null);
  const handleCopyFrame = async () => {
    const iframe = previewIframeRef.current;
    const doc = iframe?.contentDocument;
    if (!doc || !letterLayout.vw || !letterLayout.vh) return;
    try {
      const html = `<!DOCTYPE html><html>${doc.documentElement.innerHTML}</html>`;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${letterLayout.vw}" height="${letterLayout.vh}"><foreignObject width="100%" height="100%">${html}</foreignObject></svg>`;
      const blob = new Blob([svg], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("frame img load failed"));
        img.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = letterLayout.vw;
      canvas.height = letterLayout.vh;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no 2d context");
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const png = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => b ? resolve(b) : reject(new Error("png encode failed")), "image/png");
      });
      if (navigator.clipboard && "write" in navigator.clipboard) {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
        setCopyFrameLabel("Copied");
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(png);
        a.download = `frame-${Math.round(elapsedMs).toString().padStart(5, "0")}.png`;
        a.click();
        setCopyFrameLabel("Downloaded");
      }
      window.setTimeout(() => setCopyFrameLabel(null), 1500);
    } catch (err) {
      console.warn("[copy-frame] failed", err);
      setCopyFrameLabel("Failed");
      window.setTimeout(() => setCopyFrameLabel(null), 1500);
    }
  };

  // Listen for global transport events from EditorScreen (Space, arrows).
  // Refs avoid re-binding the listener on every elapsed/playing change.
  const elapsedRef = useRef(elapsedMs);
  const playingRef = useRef(isPlaying);
  useEffect(() => { elapsedRef.current = elapsedMs; }, [elapsedMs]);
  useEffect(() => { playingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => {
    const handler = (e: Event) => {
      const action = (e as CustomEvent).detail?.action as string | undefined;
      if (action === "playToggle") {
        if (playingRef.current) {
          setIsPlaying(false);
        } else {
          playEpochRef.current = performance.now() - elapsedRef.current;
          setIsPlaying(true);
        }
      } else if (action === "step") {
        const delta = Number((e as CustomEvent).detail?.deltaMs ?? 0);
        const next = Math.max(0, Math.min(elapsedRef.current + delta, sceneTotalSec * 1000));
        setIsPlaying(false);
        setElapsedMs(next);
        playEpochRef.current = performance.now() - next;
        syncPlayStateToIframe(false, next);
      }
    };
    window.addEventListener("df:transport", handler);
    return () => window.removeEventListener("df:transport", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneTotalSec]);
  const elapsedSec = elapsedMs / 1000;

  // ── Selected scene (lifted from SceneTimeline) ──────────────────────
  // VideoTab decides which sidebar to show (idle render setup vs scene
  // inspector). When a scene is selected, its panel takes over the
  // right column. Selection is cleared when the manifest changes or
  // the user closes the panel.
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  useEffect(() => {
    if (!manifest) {
      setSelectedSceneId(null);
      return;
    }
    if (selectedSceneId && !manifest.scenes.some((s) => s.id === selectedSceneId)) {
      setSelectedSceneId(null);
    }
  }, [manifest, selectedSceneId]);
  const selectedScene = useMemo(
    () => (manifest && selectedSceneId
      ? manifest.scenes.find((s) => s.id === selectedSceneId) ?? null
      : null),
    [manifest, selectedSceneId],
  );

  // ── Text edit mode ──────────────────────────────────────────────────
  // Toggle button in the transport bar. When ON, clicks in the iframe
  // select text-bearing elements instead of triggering native behavior
  // (link clicks, button presses). Selected element opens TextInspector
  // in the right column. Escape exits the mode.
  const [textEditMode, setTextEditMode] = useState(false);
  const [selectedText, setSelectedText] = useState<TextSelection | null>(null);

  // Esc cancels mode/selection.
  useEffect(() => {
    if (!textEditMode && !selectedText) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedText(null);
        setTextEditMode(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [textEditMode, selectedText]);

  // Inject click-capture into the iframe whenever textEditMode is on.
  // Re-attaches on iframe reload (via a tiny load counter) so it survives
  // srcDoc changes from chat refines.
  const [iframeLoadCounter, setIframeLoadCounter] = useState(0);
  useEffect(() => {
    if (!textEditMode) return;
    const iframe = previewIframeRef.current;
    const doc = iframe?.contentDocument;
    if (!doc) return;

    // Visual: crosshair cursor + hover outline on text elements.
    const STYLE_ID = "df-text-edit-shim";
    let style = doc.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
      style = doc.createElement("style");
      style.id = STYLE_ID;
      doc.head?.appendChild(style);
    }
    style.textContent = `
      html, body { cursor: crosshair !important; }
      [data-df-text-hover] { outline: 2px solid var(--df-accent-user, #ff7b00) !important; outline-offset: 2px !important; }
      [data-df-text-selected] { outline: 2px solid #ff7b00 !important; outline-offset: 2px !important; box-shadow: 0 0 0 4px rgba(255,123,0,0.15) !important; }
    `;

    let lastHover: Element | null = null;
    const onMove = (e: MouseEvent) => {
      // Use elementsFromPoint instead of e.target so hover respects which
      // scene is currently visible at the timeline position. Click target
      // can resolve to an invisible (opacity:0) sibling otherwise.
      const el = pickVisibleTextElementAtPoint(doc, e.clientX, e.clientY);
      if (lastHover && lastHover !== el) {
        lastHover.removeAttribute("data-df-text-hover");
      }
      if (el && el !== lastHover) {
        el.setAttribute("data-df-text-hover", "1");
      }
      lastHover = el;
    };
    const onClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const el = pickVisibleTextElementAtPoint(doc, e.clientX, e.clientY);
      if (!el) return;
      // Clear previous selection marker
      doc.querySelectorAll("[data-df-text-selected]").forEach((p) => {
        p.removeAttribute("data-df-text-selected");
      });
      el.setAttribute("data-df-text-selected", "1");
      setSelectedText({
        xpath: getXPath(el),
        tag: el.tagName.toLowerCase(),
        originalInnerHTML: el.innerHTML,
        text: (el as HTMLElement).innerText,
        context: getContextLabel(el),
      });
    };

    doc.addEventListener("mousemove", onMove);
    doc.addEventListener("click", onClick, true);
    return () => {
      doc.removeEventListener("mousemove", onMove);
      doc.removeEventListener("click", onClick, true);
      if (lastHover) lastHover.removeAttribute("data-df-text-hover");
      style?.parentNode?.removeChild(style);
    };
  }, [textEditMode, iframeLoadCounter]);

  // Apply a text edit: mutate iframe DOM (instant feedback) AND patch the
  // source HTML string (persisted to disk by the parent via onHtmlChange).
  // Source patch uses outerHTML search/replace — element's outer markup is
  // the most disambiguating handle; if it appears twice (rare), we bail.
  const handleTextSave = (newText: string) => {
    if (!selectedText) return;
    const iframe = previewIframeRef.current;
    const doc = iframe?.contentDocument;
    if (!doc) return;
    // Find element by xpath in the live iframe DOM
    const el = resolveXPath(doc, selectedText.xpath);
    if (!el) {
      console.warn("[df:text-edit] selected element no longer in DOM", selectedText.xpath);
      setSelectedText(null);
      return;
    }
    const beforeOuter = el.outerHTML;
    // Mutate innerText. Using innerText (not innerHTML) preserves child
    // structure for elements with mixed content (e.g. <p>Hi <b>bold</b></p>
    // → setting innerText flattens the markup; for those we'd want a
    // smarter strategy. v1 supports plain text elements; flagged in HUD if
    // the element has children.
    if (el.children.length > 0) {
      console.warn("[df:text-edit] element has children — flattening to text");
    }
    (el as HTMLElement).innerText = newText;
    const afterOuter = el.outerHTML;

    // Source patch — search the LIVE outerHTML (post-pause-shim cleanup)
    // in the source string. The iframe DOM has our pause-shim attributes
    // and inline styles that aren't in the source; strip those before
    // searching.
    const cleanBeforeOuter = stripDfArtifacts(beforeOuter);
    const cleanAfterOuter = stripDfArtifacts(afterOuter);

    if (onHtmlChange) {
      const idx = iframeHtml.indexOf(cleanBeforeOuter);
      if (idx < 0) {
        console.warn("[df:text-edit] couldn't locate element in source — DOM updated, disk skipped");
      } else {
        const second = iframeHtml.indexOf(cleanBeforeOuter, idx + 1);
        if (second >= 0) {
          console.warn("[df:text-edit] ambiguous match in source — DOM updated, disk skipped");
        } else {
          const nextHtml = iframeHtml.slice(0, idx) + cleanAfterOuter + iframeHtml.slice(idx + cleanBeforeOuter.length);
          onHtmlChange(nextHtml);
        }
      }
    }

    // Update selection so subsequent edits apply to the same element
    setSelectedText({
      ...selectedText,
      originalInnerHTML: el.innerHTML,
      text: (el as HTMLElement).innerText,
    });
  };

  const startRender = () => {
    if (render.phase !== "idle") return;
    setRender({ phase: "linting", progress: 0 });
    const ctrl = renderVideo(
      {
        slug: projectSlug,
        html: iframeHtml,
        config: { ratio, audioPath: audioFile?.name ?? null, durationSec: totalDurationSec },
      },
      {
        onPhase: (p) => setRender((r) => ({ ...r, phase: p })),
        onProgress: (frac, detail) => setRender((r) => ({
          ...r,
          progress: frac,
          frame: detail?.frame,
          totalFrames: detail?.totalFrames,
        })),
        onDone: (result) => setRender({ phase: "done", progress: 1, result }),
        onError: (err) => setRender({ phase: "error", progress: 0, error: err }),
      },
    );
    cancelRef.current = () => ctrl.abort();
  };

  const cancelRender = () => {
    cancelRef.current?.();
    cancelRef.current = null;
    setRender({ phase: "idle", progress: 0 });
  };

  // Reset to idle when iterating from done state.
  const goAgain = () => setRender({ phase: "idle", progress: 0 });

  const isRendering = render.phase === "linting" || render.phase === "rendering" || render.phase === "encoding";
  const isDone = render.phase === "done";
  const isError = render.phase === "error";

  // Status pill text + state for the tab header.
  const status = isError ? "error" : isDone ? "done" : isRendering ? "rendering" : "idle";
  const statusLabel = isError ? "Falhou"
    : isDone ? "Renderizado"
    : isRendering ? `Renderizando · ${Math.round(render.progress * 100)}%`
    : "Pronto";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--df-bg-base)" }}>
      {showOnboarding && (
        <div style={onboardBannerStyle}>
          <div style={onboardIconStyle}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m22 8-6 4 6 4V8Z" />
              <rect x="2" y="6" width="14" height="12" rx="2" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={onboardTitleStyle}>{t("video.onboard.title")}</div>
            <div style={onboardBodyStyle}>
              {t("video.onboard.body")} <code>setTimeout</code>, <code>Math.random</code> {t("video.onboard.body.cont")}
            </div>
          </div>
          <button type="button" onClick={onOnboardingDismiss} style={onboardCtaStyle}>
            {t("video.onboard.dismiss")}
          </button>
        </div>
      )}

      {/* Header — status pill */}
      <header style={headerStyle}>
        <span style={tabIconStyle}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="m22 8-6 4 6 4V8Z" />
            <rect x="2" y="6" width="14" height="12" rx="2" />
          </svg>
        </span>
        <span style={tabNameStyle}>video</span>
        <span style={statusPillStyle(status)}>
          <span style={dotStyle(status)} />
          <span>{statusLabel}</span>
        </span>
      </header>

      {/* Body — stage + timeline (left) | inspector (right) */}
      <div style={bodyStyle}>
        {/* LEFT — stage + timeline */}
        <div style={leftColStyle}>
          <div ref={stageRef} style={{ ...stageStyle, opacity: isRendering ? 0.55 : 1 }}>
            <div
              style={{
                position: "relative",
                width: letterLayout.width || "auto",
                height: letterLayout.height || "auto",
                background: "var(--df-bg-base)",
                borderRadius: "var(--df-r-md)",
                boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
                border: "1px solid var(--df-border-subtle)",
                overflow: "hidden",
                visibility: letterLayout.width > 0 ? "visible" : "hidden",
              }}
            >
              <iframe
                key={`video-preview-${ratio}-${replayKey}`}
                ref={previewIframeRef}
                title="composition preview"
                srcDoc={iframeHtml}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: letterLayout.vw,
                  height: letterLayout.vh,
                  border: "none",
                  transform: `scale(${letterLayout.scale})`,
                  transformOrigin: "top left",
                }}
                onLoad={() => {
                  syncPlayStateToIframe(isPlaying, elapsedMs);
                  setIframeLoadCounter((n) => n + 1);
                }}
              />
            </div>
          </div>

          <TransportBar
            isPlaying={isPlaying}
            loop={loop}
            elapsedSec={elapsedSec}
            totalSec={sceneTotalSec}
            onPlayToggle={handlePlayToggle}
            onReplay={handleReplay}
            onLoopToggle={() => setLoop((l) => !l)}
            onCopyFrame={handleCopyFrame}
            textEditMode={textEditMode}
            onTextEditToggle={() => {
              setTextEditMode((m) => !m);
              if (textEditMode) setSelectedText(null);
            }}
          />

          {manifest && manifest.scenes.length > 0 ? (
            <SceneTimeline
              manifest={manifest}
              html={iframeHtml}
              onHtmlChange={onHtmlChange}
              selectedSceneId={selectedSceneId}
              onSelectScene={setSelectedSceneId}
              currentTimeMs={elapsedMs}
              onSeek={handleSeek}
              onScrubMove={handleScrubMove}
              onScrubEnd={handleScrubEnd}
            />
          ) : (
            <LegacyTransport
              trackCount={timeline.tracks.length}
              durationSec={Math.max(1, Math.round(timeline.totalDurationMs / 1000))}
              ratio={ratio}
              onReplay={handleReplay}
              replayKey={replayKey}
            />
          )}

          {audioFile && (
            <AudioTrack
              file={audioFile}
              durationSec={sceneTotalSec}
              currentTimeMs={elapsedMs}
              onRemove={() => setAudioFile(null)}
            />
          )}
        </div>

        {/* RIGHT — contextual inspector. Priority order:
            1. Active render flow (rendering / done / error)
            2. Selected scene → SceneInspector
            3. Idle → render setup + audio + diagnostics. */}
        <aside style={inspectorStyle}>
          {isRendering && (
            <RenderingInspector
              phase={render.phase as HyperframesPhase}
              progress={render.progress}
              frame={render.frame}
              totalFrames={render.totalFrames}
              onCancel={cancelRender}
            />
          )}

          {isDone && render.result && (
            <DoneInspector
              result={render.result}
              ratio={ratio}
              onAgain={goAgain}
            />
          )}

          {isError && render.error && (
            <ErrorInspector
              error={render.error}
              onRetry={goAgain}
            />
          )}

          {render.phase === "idle" && selectedText && (
            <TextInspector
              selection={selectedText}
              onSave={handleTextSave}
              onClose={() => {
                const doc = previewIframeRef.current?.contentDocument;
                doc?.querySelectorAll("[data-df-text-selected]").forEach((p) => {
                  p.removeAttribute("data-df-text-selected");
                });
                setSelectedText(null);
              }}
            />
          )}

          {render.phase === "idle" && !selectedText && selectedScene && manifest && (
            <SceneInspector
              scene={selectedScene}
              manifest={manifest}
              html={iframeHtml}
              onHtmlChange={onHtmlChange}
              onRefineScene={onRefineScene}
              onClose={() => setSelectedSceneId(null)}
            />
          )}

          {render.phase === "idle" && !selectedText && !selectedScene && (
            <IdleInspector
              ratio={ratio}
              onRatioChangeRequest={onRatioChangeRequest}
              regenerating={regenerating}
              resolution={resolution}
              setResolution={setResolution}
              audioFile={audioFile}
              setAudioFile={setAudioFile}
              durationSec={totalDurationSec}
              tracksCount={timeline.tracks.filter((t) => t.source !== "transition").length}
              issues={issues}
              onRender={startRender}
            />
          )}
        </aside>
      </div>
    </div>
  );
}

// Legacy `Timeline` (single duration bar) was removed 2026-04-29 — it
// rendered a useless "N animações detectadas · Xs" bar that the user
// flagged as not actionable. We now go straight to LegacyEmptyTimeline
// when there's no scene manifest, prompting a regen with the contract.


// ─── Inspector states ────────────────────────────────────────────────────

// Render-resolution choices per ratio. Independent from the source ratio
// (which is locked at modal time → embedded into the HTML body dimensions).
// Picking 4K on a 9:16 source yields a 2160×3840 render; 1080p on 16:9 →
// 1920×1080. The Hyperframes pipeline upscales the iframe screenshot pass
// to the requested resolution via Puppeteer's deviceScaleFactor.
type ResolutionId = "720p" | "1080p" | "4k";
const RESOLUTIONS: Array<{ id: ResolutionId; name: string; meta: string }> = [
  { id: "720p",  name: "720p",  meta: "HD" },
  { id: "1080p", name: "1080p", meta: "Full HD" },
  { id: "4k",    name: "4K",    meta: "Ultra HD" },
];

function IdleInspector({
  ratio, onRatioChangeRequest, regenerating = false, resolution, setResolution, audioFile, setAudioFile, durationSec, tracksCount, issues, onRender,
}: {
  ratio: RatioId;
  onRatioChangeRequest: (next: RatioId) => void;
  regenerating?: boolean;
  resolution: ResolutionId;
  setResolution: (r: ResolutionId) => void;
  audioFile: File | null;
  setAudioFile: (f: File | null) => void;
  durationSec: number;
  tracksCount: number;
  issues: DeterminismIssue[];
  onRender: () => void;
}) {
  const { t } = useT();
  const pickAudio = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "audio/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) setAudioFile(file);
    };
    input.click();
  };

  return (
    <div className="si-root">
      <div className="si-stats">
        <span className="si-stat-num">{tracksCount}</span>
        <span className="si-stat-unit">{tracksCount === 1 ? "track" : "tracks"}</span>
        <span className="si-stat-sep">·</span>
        <span className="si-stat-num">{durationSec}s</span>
        <span className="si-stat-sep">·</span>
        <span className="si-stat-unit">{ratio}</span>
      </div>

      <section className="si-section">
        <div className="si-section-label">{t("video.aspect.ratio")}</div>
        <div className="si-ratio-row">
          {RATIOS.map((r) => {
            const active = ratio === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onRatioChangeRequest(r.id)}
                disabled={regenerating}
                className={`si-ratio${active ? " is-on" : ""}`}
                title={r.meta}
                aria-pressed={active}
              >
                {r.name}
              </button>
            );
          })}
        </div>
      </section>

      <section className="si-section">
        <div className="si-section-label">{t("video.resolution")}</div>
        <div className="si-ratio-row">
          {RESOLUTIONS.map((r) => {
            const active = resolution === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setResolution(r.id)}
                className={`si-ratio${active ? " is-on" : ""}`}
                title={r.meta}
              >
                {r.name}
              </button>
            );
          })}
        </div>
      </section>

      <section className="si-section">
        <div className="si-section-label">{t("video.audio")}</div>
        {audioFile ? (
          <div className="si-audio-filled">
            <span className="si-audio-name">{audioFile.name}</span>
            <button type="button" onClick={() => setAudioFile(null)} className="si-btn">{t("video.audio.remove")}</button>
          </div>
        ) : (
          <button type="button" onClick={pickAudio} className="si-audio-empty">
            {t("video.audio.add")}
          </button>
        )}
      </section>

      {issues.length > 0 && (
        <section className="si-section">
          <div className="si-section-label si-section-label-warn">{issues.length} {issues.length === 1 ? "issue" : "issues"}</div>
          <ul className="si-issue-list">
            {issues.slice(0, 6).map((i, idx) => (
              <li key={idx} className="si-issue">{humanizeIssue(i)}</li>
            ))}
            {issues.length > 6 && <li className="si-issue si-issue-more">+{issues.length - 6} more</li>}
          </ul>
        </section>
      )}

      <button
        type="button"
        onClick={onRender}
        disabled={regenerating}
        className="si-btn si-btn-primary si-btn-render"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        {t("video.render")}
      </button>
    </div>
  );
}

function humanizeIssue(i: DeterminismIssue): string {
  switch (i.kind) {
    case "setTimeout":
      return `setTimeout (linha ${i.line}) — vai desincronizar a animação no vídeo.`;
    case "setInterval":
      return `setInterval (linha ${i.line}) — vai desincronizar a animação no vídeo.`;
    case "Math.random":
      return `Math.random (linha ${i.line}) — vai gerar valores diferentes a cada render.`;
    case "scroll-listener":
      return `scroll listener (linha ${i.line}) — não dispara em render headless.`;
    case "intersection-observer":
      return `IntersectionObserver (linha ${i.line}) — não dispara em render headless.`;
    default:
      return `${i.kind} (linha ${i.line})`;
  }
}

function RenderingInspector({
  phase, progress, frame, totalFrames, onCancel,
}: {
  phase: HyperframesPhase;
  progress: number;
  frame?: number;
  totalFrames?: number;
  onCancel: () => void;
}) {
  const { t } = useT();
  const phases: Array<{ id: HyperframesPhase; label: string }> = [
    { id: "linting", label: t("video.phase.linting") },
    { id: "rendering", label: t("video.phase.rendering") },
    { id: "encoding", label: t("video.phase.encoding") },
    { id: "done", label: t("video.phase.done") },
  ];
  const currentIdx = phases.findIndex((p) => p.id === phase);
  return (
    <div style={progressCardStyle}>
      <ul style={phaseListStyle}>
        {phases.map((p, idx) => {
          const state = idx < currentIdx ? "done" : idx === currentIdx ? "active" : "pending";
          return (
            <li key={p.id} style={phaseRowStyle(state)}>
              <span style={phaseBulletStyle(state)}>
                {state === "done" && (
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </span>
              <span style={phaseLabelStyle(state)}>{p.label}</span>
              <span style={phaseSubStyle}>
                {idx === 1 && frame != null && totalFrames != null ? `${frame} / ${totalFrames}` : ""}
              </span>
            </li>
          );
        })}
      </ul>
      <div style={progressBarStyle}>
        <div style={{ ...progressBarFillStyle, width: `${progress * 100}%` }} />
      </div>
      <button type="button" onClick={onCancel} style={cancelBtnStyle}>
        {t("video.cancel")}
      </button>
    </div>
  );
}

function DoneInspector({
  result, ratio, onAgain,
}: {
  result: { mp4Path: string; durationMs: number; sizeBytes: number };
  ratio: RatioId;
  onAgain: () => void;
}) {
  const { t } = useT();
  const ratioMeta = RATIOS.find((r) => r.id === ratio);
  const sizeMB = (result.sizeBytes / 1024 / 1024).toFixed(1);
  // Bridge serves the rendered file as a stream so the <video> element
  // can play it directly. Same hostname/port as the rest of the bridge.
  const videoUrl = `http://localhost:1421/fs/file?path=${encodeURIComponent(result.mp4Path)}`;

  const handleDownload = () => {
    // Native anchor download — fetches via bridge, saves to disk.
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = result.mp4Path.split("/").pop() || "video.mp4";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(result.mp4Path);
      showToast(t("video.path.copied"));
    } catch {
      showToast(t("video.path.copy.failed"));
    }
  };

  return (
    <>
      <div style={playerBlockStyle}>
        <video
          controls
          autoPlay
          loop
          src={videoUrl}
          style={{
            display: "block",
            width: "100%",
            aspectRatio: ratioMeta?.aspect ?? "16/9",
            background: "var(--df-bg-sunken)",
          }}
        />
        <div style={playerMetaStyle}>
          <span>{ratio} · {ratioMeta?.meta}</span>
          <span>{sizeMB} MB</span>
        </div>
      </div>

      <button type="button" onClick={handleDownload} className="si-btn si-btn-primary si-btn-render">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        {t("video.save.local")}
      </button>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <button type="button" onClick={onAgain} style={secondaryBtnStyle}>
          {t("video.render.again")}
        </button>
        <button type="button" onClick={handleCopyPath} style={secondaryBtnStyle}>
          {t("video.copy.path")}
        </button>
      </div>

      <div style={pathDisplayStyle}>{result.mp4Path}</div>
    </>
  );
}

function ErrorInspector({
  error, onRetry,
}: {
  error: { kind: string; message: string };
  onRetry: () => void;
}) {
  const { t } = useT();
  return (
    <div style={errorCardStyle}>
      <div style={errorHeadStyle}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
        </svg>
        {errorTitle(error.kind)}
      </div>
      <div style={errorMessageStyle}>{error.message}</div>
      <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
        <button type="button" onClick={onRetry} style={secondaryBtnStyle}>
          {t("video.try.again")}
        </button>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("df-open-diagnostics"))}
          style={secondaryBtnStyle}
        >
          {t("video.see.logs")}
        </button>
      </div>
    </div>
  );
}

function errorTitle(kind: string): string {
  if (kind === "lint") return "Composição não passou na validação";
  if (kind === "render") return "Render falhou";
  if (kind === "constraint") return "Código não-determinístico detectado";
  if (kind === "spawn") return "Não foi possível iniciar o renderizador";
  return "Render falhou";
}

// ─── Toast helper (best effort — Editor's showToast is preferred but
// importing it would couple this component) ─────────────────────────────
function showToast(msg: string) {
  // Reuse the global event the Editor's toast system listens to.
  window.dispatchEvent(new CustomEvent("df-toast", { detail: { message: msg } }));
}

// ─── Styles ─────────────────────────────────────────────────────────────

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  height: 40,
  padding: "0 16px",
  borderBottom: "1px solid var(--df-border-subtle)",
  background: "var(--df-bg-section)",
  flexShrink: 0,
};
const tabIconStyle: React.CSSProperties = {
  color: "var(--df-text-secondary)",
};
const tabNameStyle: React.CSSProperties = {
  fontFamily: "var(--df-font-display)",
  fontSize: 13,
  fontWeight: 500,
  color: "var(--df-text-primary)",
};

function statusPillStyle(state: string): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "3px 9px",
    borderRadius: 999,
    border: "1px solid var(--df-border-subtle)",
    fontFamily: "var(--df-font-mono)",
    fontSize: 10,
    color: "var(--df-text-secondary)",
    marginLeft: "auto",
  };
  if (state === "rendering") return { ...base, color: "var(--df-accent-warn)", borderColor: "rgba(194,124,44,0.4)", background: "var(--df-tint-warn)" };
  if (state === "done") return { ...base, color: "var(--df-accent-ok)", borderColor: "rgba(138,176,107,0.4)" };
  if (state === "error") return { ...base, color: "var(--df-accent-danger)", borderColor: "rgba(255,107,107,0.4)" };
  return base;
}
function dotStyle(state: string): React.CSSProperties {
  const base: React.CSSProperties = { width: 6, height: 6, borderRadius: "50%", background: "var(--df-text-faint)" };
  if (state === "rendering") return { ...base, background: "var(--df-accent-warn)", animation: "df-pulse 1.2s ease-in-out infinite" };
  if (state === "done") return { ...base, background: "var(--df-accent-ok)" };
  if (state === "error") return { ...base, background: "var(--df-accent-danger)" };
  return base;
}

const bodyStyle: React.CSSProperties = {
  flex: 1,
  display: "grid",
  gridTemplateColumns: "1fr 380px",
  minHeight: 0,
};

const leftColStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateRows: "1fr auto auto",
  minHeight: 0,
  borderRight: "1px solid var(--df-border-subtle)",
};

const stageStyle: React.CSSProperties = {
  background: "var(--df-bg-sunken)",
  display: "grid",
  placeItems: "center",
  overflow: "hidden",
};

// Transport bar for projects without the scene manifest contract. We
// can't drive a per-frame scrubber (the iframe runs its own RAF/CSS
// timeline that we don't control), but we CAN expose the basics: replay
// (remount the iframe), elapsed time since the last replay, and a clear
// CTA explaining how to upgrade to a real editable timeline.
function LegacyTransport({
  trackCount,
  durationSec,
  ratio,
  onReplay,
  replayKey,
}: {
  trackCount: number;
  durationSec: number;
  ratio: RatioId;
  onReplay: () => void;
  replayKey: number;
}) {
  // Wall-clock elapsed since the most recent replay. Resets every replay
  // by depending on `replayKey`. We don't try to reflect virtual time —
  // the iframe's CSS animations run on real time too, so this is honest.
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    setElapsed(0);
    const start = performance.now();
    const interval = window.setInterval(() => {
      setElapsed((performance.now() - start) / 1000);
    }, 100);
    return () => window.clearInterval(interval);
  }, [replayKey]);
  const ratioMeta = RATIOS.find((r) => r.id === ratio);

  return (
    <div style={{
      ...timelineStyle,
      gridTemplateRows: "auto auto 1fr",
      padding: "16px 20px",
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }}>
      {/* Transport row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="button"
          onClick={onReplay}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            background: "var(--df-surface-raised)",
            border: "1px solid var(--df-border-subtle)",
            borderRadius: "var(--df-r-sm)",
            color: "var(--df-text-primary)",
            fontFamily: "var(--df-font-mono)",
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Replay
        </button>
        <span style={{
          fontFamily: "var(--df-font-mono)",
          fontSize: 11,
          color: "var(--df-text-primary)",
          fontVariantNumeric: "tabular-nums",
          minWidth: 64,
        }}>
          {elapsed.toFixed(1)}s
        </span>
        <span style={{ flex: 1, height: 1, background: "var(--df-border-subtle)" }} />
        <span style={{ fontFamily: "var(--df-font-mono)", fontSize: 10, color: "var(--df-text-faint)" }}>
          {ratio} · {ratioMeta?.meta ?? ""}
        </span>
      </div>

      {/* Detected info + CTA */}
      <div style={{ fontSize: 12, color: "var(--df-text-secondary)", lineHeight: 1.5 }}>
        {trackCount > 0
          ? `Detectamos ${trackCount} animaç${trackCount === 1 ? "ão" : "ões"} no HTML — sem o contrato de cenas não há scrubber por cena. Replay reinicia tudo.`
          : "Sem animações nem contrato detectado. Você ainda pode renderizar (still de até " + Math.max(1, durationSec) + "s)."}
      </div>
      <div style={{ fontSize: 11, color: "var(--df-text-faint)", lineHeight: 1.5 }}>
        Para uma trilha editável: peça no chat <em>"regere usando o contrato (data-scene + script df-manifest)"</em>.
      </div>
    </div>
  );
}

// ── Transport bar ──────────────────────────────────────────────────────
// Honest controls. Play toggle restarts (CSS @keyframes can't be
// resumed without iframe cooperation — explained in the title). Loop
// auto-restarts at duration end. Replay always restarts. Elapsed
// counter is wall-clock from last restart.
function TransportBar({
  isPlaying,
  loop,
  elapsedSec,
  totalSec,
  onPlayToggle,
  onReplay,
  onLoopToggle,
  onCopyFrame,
  textEditMode,
  onTextEditToggle,
}: {
  isPlaying: boolean;
  loop: boolean;
  elapsedSec: number;
  totalSec: number;
  onPlayToggle: () => void;
  onReplay: () => void;
  onLoopToggle: () => void;
  onCopyFrame?: () => void;
  textEditMode?: boolean;
  onTextEditToggle?: () => void;
}) {
  const { t } = useT();
  return (
    <div style={transportBarStyle}>
      <button
        type="button"
        onClick={onPlayToggle}
        title={isPlaying ? "Pausa o playhead (anim CSS continua até o próximo loop)" : "Reinicia do frame 0 e dá play"}
        style={transportBtnPrimaryStyle(isPlaying)}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        )}
      </button>
      <button
        type="button"
        onClick={onReplay}
        title={t("video.replay.title")}
        style={transportBtnStyle}
        aria-label={t("video.replay.aria")}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1 4 1 10 7 10" />
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onLoopToggle}
        title={loop ? "Loop on — desliga pra parar no fim" : "Loop off — liga pra reiniciar automaticamente"}
        style={transportBtnToggleStyle(loop)}
        aria-pressed={loop}
        aria-label={t("video.loop.aria")}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="17 1 21 5 17 9" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <polyline points="7 23 3 19 7 15" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
      </button>
      {onCopyFrame && (
        <button
          type="button"
          onClick={onCopyFrame}
          title={t("video.copy.frame.title")}
          style={transportBtnStyle}
          aria-label={t("video.copy.frame.aria")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
      )}
      {onTextEditToggle && (
        <button
          type="button"
          onClick={onTextEditToggle}
          title={textEditMode ? "Exit text edit mode (Esc)" : "Edit text — click any text in the preview"}
          style={transportBtnToggleStyle(!!textEditMode)}
          aria-pressed={!!textEditMode}
          aria-label={t("video.edit.text.aria")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </button>
      )}
      <div style={transportTimeStyle}>
        <span style={transportElapsedStyle}>{elapsedSec.toFixed(2)}s</span>
        <span style={transportSepStyle}>/</span>
        <span style={transportTotalStyle}>{totalSec.toFixed(1)}s</span>
      </div>
    </div>
  );
}

const transportBarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "0 10px",
  background: "var(--df-bg-section)",
  borderTop: "1px solid var(--df-border-subtle)",
  borderBottom: "1px solid var(--df-border-subtle)",
  height: 30,
};
const transportBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 24,
  height: 24,
  background: "transparent",
  border: "none",
  borderRadius: "var(--df-r-sm)",
  color: "var(--df-text-secondary)",
  cursor: "pointer",
  padding: 0,
};
const transportBtnPrimaryStyle = (active: boolean): React.CSSProperties => ({
  ...transportBtnStyle,
  color: active ? "var(--df-accent-user)" : "var(--df-text-primary)",
});
const transportBtnToggleStyle = (active: boolean): React.CSSProperties => ({
  ...transportBtnStyle,
  color: active ? "var(--df-accent-user)" : "var(--df-text-faint)",
});
const transportTimeStyle: React.CSSProperties = {
  marginLeft: "auto",
  fontFamily: "var(--df-font-mono)",
  fontSize: 11,
  letterSpacing: "0.03em",
  display: "flex",
  alignItems: "center",
  gap: 4,
};
const transportElapsedStyle: React.CSSProperties = { color: "var(--df-text-primary)" };
const transportSepStyle: React.CSSProperties = { color: "var(--df-border-strong)" };
const transportTotalStyle: React.CSSProperties = { color: "var(--df-text-faint)" };

const timelineStyle: React.CSSProperties = {
  background: "var(--df-bg-section)",
  borderTop: "1px solid var(--df-border-subtle)",
  display: "grid",
  gridTemplateRows: "28px 1fr",
  minHeight: 0,
};
// Inspector — wider (380px) so fields and labels have breathing room
// without feeling dense.
const inspectorStyle: React.CSSProperties = {
  background: "var(--df-bg-base)",
  overflowY: "auto",
  padding: "20px 22px",
  display: "flex",
  flexDirection: "column",
  gap: 24,
};
const secondaryBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--df-border-subtle)",
  color: "var(--df-text-secondary)",
  padding: "8px 10px",
  borderRadius: "var(--df-r-sm)",
  fontFamily: "var(--df-font-display)",
  fontSize: 12,
  cursor: "pointer",
  textAlign: "center",
};

const progressCardStyle: React.CSSProperties = {
  background: "var(--df-bg-section)",
  border: "1px solid var(--df-border-subtle)",
  borderRadius: "var(--df-r-md)",
  padding: 16,
};
const phaseListStyle: React.CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};
function phaseRowStyle(state: string): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 12,
    color: state === "pending" ? "var(--df-text-faint)" : "var(--df-text-secondary)",
  };
}
function phaseBulletStyle(state: string): React.CSSProperties {
  return {
    width: 14,
    height: 14,
    borderRadius: "50%",
    border: "1px solid var(--df-border-subtle)",
    background: state === "done" ? "var(--df-accent-ok)" : state === "active" ? "var(--df-accent-warn)" : "transparent",
    borderColor: state === "done" ? "var(--df-accent-ok)" : state === "active" ? "var(--df-accent-warn)" : "var(--df-border-subtle)",
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    animation: state === "active" ? "df-pulse 1.2s ease-in-out infinite" : "none",
  };
}
function phaseLabelStyle(state: string): React.CSSProperties {
  return {
    color: state === "active" ? "var(--df-text-primary)" : undefined,
    fontWeight: state === "active" ? 500 : 400,
  };
}
const phaseSubStyle: React.CSSProperties = {
  marginLeft: "auto",
  fontFamily: "var(--df-font-mono)",
  fontSize: 10,
  color: "var(--df-text-faint)",
  fontVariantNumeric: "tabular-nums",
};
const progressBarStyle: React.CSSProperties = {
  marginTop: 14,
  height: 4,
  background: "rgba(194, 124, 44, 0.12)",
  borderRadius: 2,
  overflow: "hidden",
};
const progressBarFillStyle: React.CSSProperties = {
  height: "100%",
  background: "var(--df-accent-warn)",
  transition: "width 240ms linear",
};
const cancelBtnStyle: React.CSSProperties = {
  marginTop: 12,
  background: "transparent",
  border: "1px solid var(--df-border-subtle)",
  color: "var(--df-text-secondary)",
  padding: "7px 12px",
  borderRadius: "var(--df-r-sm)",
  fontFamily: "var(--df-font-mono)",
  fontSize: 10,
  cursor: "pointer",
  width: "100%",
};

const playerBlockStyle: React.CSSProperties = {
  background: "var(--df-bg-sunken)",
  border: "1px solid var(--df-border-subtle)",
  borderRadius: "var(--df-r-md)",
  overflow: "hidden",
};
const playerMetaStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderTop: "1px solid var(--df-border-subtle)",
  fontFamily: "var(--df-font-mono)",
  fontSize: 10,
  color: "var(--df-text-secondary)",
  display: "flex",
  justifyContent: "space-between",
};
const pathDisplayStyle: React.CSSProperties = {
  fontFamily: "var(--df-font-mono)",
  fontSize: 10,
  color: "var(--df-text-faint)",
  padding: "4px 0",
  wordBreak: "break-all",
};

const errorCardStyle: React.CSSProperties = {
  background: "rgba(255, 107, 107, 0.08)",
  border: "1px solid rgba(255, 107, 107, 0.32)",
  borderRadius: "var(--df-r-md)",
  padding: 14,
};
const errorHeadStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontFamily: "var(--df-font-mono)",
  fontSize: 10,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--df-accent-danger)",
  marginBottom: 8,
};
const errorMessageStyle: React.CSSProperties = {
  color: "var(--df-text-primary)",
  fontSize: 13,
  lineHeight: 1.5,
};

// Onboarding banner
const onboardBannerStyle: React.CSSProperties = {
  background: "var(--df-bg-section)",
  borderBottom: "1px solid var(--df-border-subtle)",
  borderLeft: "2px solid var(--df-text-faint)",
  padding: "14px 18px",
  display: "flex",
  alignItems: "flex-start",
  gap: 14,
};
const onboardIconStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: "50%",
  background: "var(--df-surface-raised)",
  color: "var(--df-text-secondary)",
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
};
const onboardTitleStyle: React.CSSProperties = {
  fontFamily: "var(--df-font-display)",
  color: "var(--df-text-primary)",
  fontWeight: 500,
  marginBottom: 4,
};
const onboardBodyStyle: React.CSSProperties = {
  color: "var(--df-text-secondary)",
  fontSize: 12,
  lineHeight: 1.5,
  maxWidth: "60ch",
};
const onboardCtaStyle: React.CSSProperties = {
  background: "var(--df-bg-button-tactile)",
  color: "var(--df-text-on-tactile)",
  border: "none",
  padding: "7px 14px",
  borderRadius: "var(--df-r-sm)",
  fontFamily: "var(--df-font-display)",
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
  flexShrink: 0,
};

// SceneTimeline.tsx — Pure timeline view: ruler + scene blocks + playhead.
//
// Refactored 2026-04-29: panel pulled out (now SceneInspector); selection
// is controlled by VideoTab. Drag-to-scrub on the playhead is live —
// during drag we update via onScrubMove (no iframe restart) and only
// commit a real seek (with restart) on mouse-up. Click empty track =
// instant seek; click scene block = select scene + seek to its start;
// drag block right edge = ripple-resize.

import { useEffect, useRef, useState } from "react";
import type { Scene, SceneManifest } from "@/runtime/scene-manifest";
import { resizeSceneAndRipple } from "@/runtime/scene-manifest";

interface Props {
  manifest: SceneManifest;
  html: string;
  onHtmlChange?: (next: string) => void;
  /** Controlled selection — VideoTab picks the contextual sidebar. */
  selectedSceneId: string | null;
  onSelectScene: (id: string | null) => void;
  /** Wall-clock playhead from the parent transport. */
  currentTimeMs: number;
  /** Scrub handlers. onScrubMove updates the playhead WITHOUT restarting
   *  the iframe (so dragging is smooth); onScrubEnd commits the seek
   *  (which restarts the animation from the new offset). */
  onScrubMove?: (timeMs: number) => void;
  onScrubEnd?: (timeMs: number) => void;
  /** One-shot seek on click — restart immediately. */
  onSeek?: (timeMs: number) => void;
}

const PALETTE = [
  "color-mix(in srgb, var(--df-accent-user) 60%, transparent)",
  "color-mix(in srgb, var(--df-accent-user) 45%, transparent)",
  "color-mix(in srgb, var(--df-accent-user) 30%, transparent)",
];

function formatTime(s: number): string {
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`;
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}m ${r.toFixed(0).padStart(2, "0")}s`;
}

export function SceneTimeline({
  manifest,
  html,
  onHtmlChange,
  selectedSceneId,
  onSelectScene,
  currentTimeMs,
  onScrubMove,
  onScrubEnd,
  onSeek,
}: Props) {
  const total = manifest.duration || manifest.scenes.reduce((m, s) => Math.max(m, s.start + s.duration), 0);

  // Reset selection if the current id vanishes from a fresh manifest.
  useEffect(() => {
    if (selectedSceneId && !manifest.scenes.some((s) => s.id === selectedSceneId)) {
      onSelectScene(null);
    }
  }, [manifest, selectedSceneId, onSelectScene]);

  // ── Drag-to-resize a scene block (right edge → ripple) ──────────────
  const trackRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<{
    sceneId: string;
    startX: number;
    startDuration: number;
    pxPerSec: number;
  } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ id: string; duration: number } | null>(null);
  const dragPreviewRef = useRef(dragPreview);
  useEffect(() => { dragPreviewRef.current = dragPreview; }, [dragPreview]);

  const onResizeStart = (e: React.MouseEvent, scene: Scene) => {
    e.preventDefault();
    e.stopPropagation();
    const track = trackRef.current;
    if (!track) return;
    const trackWidth = track.clientWidth;
    if (trackWidth <= 0 || total <= 0) return;
    resizeRef.current = {
      sceneId: scene.id,
      startX: e.clientX,
      startDuration: scene.duration,
      pxPerSec: trackWidth / total,
    };
    setDragPreview({ id: scene.id, duration: scene.duration });
    window.addEventListener("mousemove", onResizeMove);
    window.addEventListener("mouseup", onResizeEnd, { once: true });
  };

  const onResizeMove = (e: MouseEvent) => {
    const d = resizeRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const deltaSec = dx / d.pxPerSec;
    const next = Math.max(0.5, d.startDuration + deltaSec);
    setDragPreview({ id: d.sceneId, duration: next });
  };

  const onResizeEnd = () => {
    window.removeEventListener("mousemove", onResizeMove);
    const d = resizeRef.current;
    const preview = dragPreviewRef.current;
    resizeRef.current = null;
    setDragPreview(null);
    if (!d || !preview || !onHtmlChange) return;
    if (Math.abs(preview.duration - d.startDuration) < 0.1) return;
    const next = resizeSceneAndRipple(html, manifest, d.sceneId, preview.duration);
    onHtmlChange(next);
  };

  // ── Drag-to-scrub the playhead ──────────────────────────────────────
  const scrubRef = useRef<{ trackEl: HTMLDivElement } | null>(null);
  const isScrubbingRef = useRef(false);

  const beginScrub = (e: React.MouseEvent, opts?: { startFromClick?: boolean }) => {
    e.preventDefault();
    e.stopPropagation();
    const track = trackRef.current;
    if (!track || total <= 0) return;
    scrubRef.current = { trackEl: track };
    isScrubbingRef.current = true;
    if (opts?.startFromClick) emitScrubMove(e.clientX);
    window.addEventListener("mousemove", onScrubMouseMove);
    window.addEventListener("mouseup", onScrubMouseUp, { once: true });
  };

  const emitScrubMove = (clientX: number) => {
    const ref = scrubRef.current;
    if (!ref || total <= 0) return;
    const rect = ref.trackEl.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    const clamped = Math.max(0, Math.min(1, ratio));
    onScrubMove?.(clamped * total * 1000);
  };

  const onScrubMouseMove = (e: MouseEvent) => emitScrubMove(e.clientX);

  const onScrubMouseUp = (e: MouseEvent) => {
    window.removeEventListener("mousemove", onScrubMouseMove);
    const ref = scrubRef.current;
    if (!ref || !isScrubbingRef.current) {
      isScrubbingRef.current = false;
      scrubRef.current = null;
      return;
    }
    const rect = ref.trackEl.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const clamped = Math.max(0, Math.min(1, ratio));
    isScrubbingRef.current = false;
    scrubRef.current = null;
    onScrubEnd?.(clamped * total * 1000);
  };

  // Empty-track click = one-shot seek (when no drag started).
  const onTrackClick = (e: React.MouseEvent) => {
    if (!onSeek || total <= 0) return;
    const target = e.target as HTMLElement;
    if (target.closest(".st-block") || target.closest(".st-playhead")) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeek(Math.max(0, Math.min(1, ratio)) * total * 1000);
  };

  return (
    <div className="st-root">
      <div className="st-timeline" role="region" aria-label="Scene timeline">
        <div className="st-ruler">
          <span className="st-ruler-mark">0s</span>
          <span className="st-ruler-mark">{formatTime(total / 4)}</span>
          <span className="st-ruler-mark">{formatTime(total / 2)}</span>
          <span className="st-ruler-mark">{formatTime((total * 3) / 4)}</span>
          <span className="st-ruler-mark">{formatTime(total)}</span>
        </div>
        <div
          className="st-track"
          ref={trackRef}
          onClick={onTrackClick}
          style={{ cursor: onSeek ? "ew-resize" : "default" }}
        >
          {manifest.scenes.map((s, i) => {
            const isPreview = dragPreview?.id === s.id;
            const effDuration = isPreview ? dragPreview!.duration : s.duration;
            const left = total > 0 ? (s.start / total) * 100 : 0;
            const width = total > 0 ? (effDuration / total) * 100 : 0;
            const on = s.id === selectedSceneId;
            const color = PALETTE[i % PALETTE.length];
            return (
              <div
                key={s.id}
                className={`st-block${on ? " is-on" : ""}${isPreview ? " is-resizing" : ""}`}
                style={{
                  left: `${left}%`,
                  width: `${Math.max(2.5, width)}%`,
                  background: color,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectScene(on ? null : s.id);
                  if (onSeek && !on) onSeek(s.start * 1000);
                }}
                title={`${s.name} · ${formatTime(effDuration)}${onSeek ? " · click to select + seek" : ""}`}
                role="button"
                tabIndex={0}
              >
                <span className="st-block-id">{s.id}</span>
                <span className="st-block-name">{s.name}</span>
                <div
                  className="st-block-handle"
                  onMouseDown={(e) => onResizeStart(e, s)}
                  onClick={(e) => e.stopPropagation()}
                  title="Drag to retime · ripple-shifts later scenes"
                  aria-label={`Resize scene ${s.id}`}
                />
              </div>
            );
          })}
          {total > 0 && (
            <div
              className="st-playhead"
              style={{
                left: `${Math.max(0, Math.min(100, (currentTimeMs / 1000 / total) * 100))}%`,
              }}
              onMouseDown={(e) => beginScrub(e)}
              role="slider"
              aria-label="Playhead — drag to scrub"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={currentTimeMs / 1000}
            />
          )}
        </div>
        <div className="st-meta">
          <span>{manifest.scenes.length} {manifest.scenes.length === 1 ? "scene" : "scenes"}</span>
          <span className="st-meta-sep">·</span>
          <span>{formatTime(total)} total</span>
          <span className="st-meta-sep">·</span>
          <span>{manifest.fps} fps</span>
          <span className="st-meta-sep">·</span>
          <span>{manifest.fromManifestTag ? "manifest" : "scraped"}</span>
        </div>
      </div>
    </div>
  );
}

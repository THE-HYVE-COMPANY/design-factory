// AudioTrack — waveform-rendering audio lane below the SceneTimeline.
//
// Decodes a local audio file via Web Audio API, samples peaks, draws to
// a canvas. Stays in sync with the parent transport via currentTimeMs +
// the same playhead overlay style as SceneTimeline.

import { useEffect, useRef, useState } from "react";

interface Props {
  file: File | null;
  durationSec: number;
  currentTimeMs: number;
  onRemove?: () => void;
}

export function AudioTrack({ file, durationSec, currentTimeMs, onRemove }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  const [audioDurationSec, setAudioDurationSec] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [decoding, setDecoding] = useState(false);

  // Decode + extract peaks. Done once per file.
  useEffect(() => {
    if (!file) {
      setPeaks(null);
      setAudioDurationSec(0);
      return;
    }
    let cancelled = false;
    setDecoding(true);
    setError(null);
    (async () => {
      try {
        const buf = await file.arrayBuffer();
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        const decoded = await ctx.decodeAudioData(buf.slice(0));
        if (cancelled) { ctx.close().catch(() => {}); return; }
        const ch = decoded.getChannelData(0);
        // Down-sample to ~800 peaks max — enough resolution for the
        // 380px-wide track at 2x density on retina.
        const targetPeaks = 800;
        const blockSize = Math.max(1, Math.floor(ch.length / targetPeaks));
        const out = new Float32Array(Math.floor(ch.length / blockSize));
        for (let i = 0; i < out.length; i++) {
          let max = 0;
          const start = i * blockSize;
          const end = Math.min(start + blockSize, ch.length);
          for (let j = start; j < end; j++) {
            const v = Math.abs(ch[j]);
            if (v > max) max = v;
          }
          out[i] = max;
        }
        setPeaks(out);
        setAudioDurationSec(decoded.duration);
        ctx.close().catch(() => {});
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "decode failed");
      } finally {
        if (!cancelled) setDecoding(false);
      }
    })();
    return () => { cancelled = true; };
  }, [file]);

  // Manage hidden <audio> element for playback. Created when file loads,
  // mirrors transport state via currentTimeMs / play / pause.
  useEffect(() => {
    if (!file) {
      const el = audioElementRef.current;
      if (el) { el.pause(); el.src = ""; audioElementRef.current = null; }
      return;
    }
    const url = URL.createObjectURL(file);
    const el = new Audio(url);
    el.preload = "auto";
    audioElementRef.current = el;
    return () => {
      el.pause();
      URL.revokeObjectURL(url);
      audioElementRef.current = null;
    };
  }, [file]);

  // Draw waveform on canvas whenever peaks resolve or width changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    const track = trackRef.current;
    if (!canvas || !track || !peaks) return;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = track.clientWidth;
      const h = track.clientHeight;
      if (w <= 0 || h <= 0) return;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);
      const colour = getComputedStyle(track).getPropertyValue("--df-accent-user").trim() || "#9aa886";
      ctx.fillStyle = colour;
      ctx.globalAlpha = 0.55;
      const mid = h / 2;
      const barWidth = Math.max(1, w / peaks.length);
      for (let i = 0; i < peaks.length; i++) {
        const v = peaks[i];
        const barH = Math.max(1, v * h * 0.9);
        const x = (i / peaks.length) * w;
        ctx.fillRect(x, mid - barH / 2, barWidth, barH);
      }
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(track);
    return () => ro.disconnect();
  }, [peaks]);

  // Pretty file size for the empty-state nameplate.
  const sizeLabel = file ? formatBytes(file.size) : "";
  const dur = audioDurationSec || durationSec;
  const playheadPct = dur > 0 ? Math.max(0, Math.min(100, (currentTimeMs / 1000 / dur) * 100)) : 0;

  return (
    <div className="audio-track">
      <div className="audio-track-head">
        <span className="audio-track-eyebrow">audio</span>
        {file && (
          <>
            <span className="audio-track-name" title={file.name}>{file.name}</span>
            <span className="audio-track-meta">
              {audioDurationSec.toFixed(1)}s · {sizeLabel}
            </span>
            {onRemove && (
              <button type="button" className="audio-track-remove" onClick={onRemove} aria-label="Remove audio">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              </button>
            )}
          </>
        )}
        {decoding && <span className="audio-track-meta">decoding…</span>}
        {error && <span className="audio-track-meta audio-track-meta-err">{error}</span>}
      </div>
      <div className="audio-track-body" ref={trackRef}>
        <canvas ref={canvasRef} className="audio-track-canvas" />
        {dur > 0 && (
          <div
            className="audio-track-playhead"
            style={{ left: `${playheadPct}%` }}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

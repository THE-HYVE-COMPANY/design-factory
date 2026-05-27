// SkeuShowcaseScreen — 10 interactive SVG animations in skeu chrome.
//
// Each instrument is its own self-contained component below the main
// screen export. Every chassis uses DF tokens (--df-bg-section,
// --df-skeu-top-light, --df-shadow-button-tactile-pressed, etc) so
// switching dark/light themes flips the rendering automatically.
//
// User direction 2026-05-15: "crie 10 animações svg interativas
// skeu para me impressionar".

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";

interface SkeuShowcaseProps {
  onBack?: () => void;
}

export function SkeuShowcaseScreen({ onBack }: SkeuShowcaseProps) {
  return (
    <div className="screen" data-active="true" style={screenStyle}>
      <header style={headerStyle}>
        {onBack ? (
          <button type="button" className="df-btn df-btn--ghost df-btn--sm" onClick={onBack}>
            ← back
          </button>
        ) : null}
        <div style={headerTitleStyle}>
          <span style={kickerStyle}>DESIGN FACTORY · SKEU INSTRUMENTS</span>
          <span style={titleStyle}>10 interactive SVG animations</span>
        </div>
      </header>

      <main style={gridStyle}>
        <Tile title="01 · Rotary knob" hint="drag to rotate">
          <RotaryKnob />
        </Tile>
        <Tile title="02 · Metal toggle" hint="click to flip">
          <MetalToggle />
        </Tile>
        <Tile title="03 · VU meter" hint="auto sweep">
          <VuMeter />
        </Tile>
        <Tile title="04 · Tactile slider" hint="drag horizontal">
          <TactileSlider />
        </Tile>
        <Tile title="05 · LED button" hint="hold to ignite">
          <LedButton />
        </Tile>
        <Tile title="06 · Rotary encoder" hint="click ±15°">
          <RotaryEncoder />
        </Tile>
        <Tile title="07 · Bezel breathe" hint="passive">
          <BezelBreathe />
        </Tile>
        <Tile title="08 · LED bank" hint="hover the row">
          <LedBank />
        </Tile>
        <Tile title="09 · Capacitive ripple" hint="click anywhere">
          <CapacitiveRipple />
        </Tile>
        <Tile title="10 · Goo loader" hint="passive">
          <GooLoader />
        </Tile>
      </main>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Tile wrapper — common skeu card chrome
// ────────────────────────────────────────────────────────────────

function Tile({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section style={tileStyle}>
      <div style={tileChromeStyle}>
        <div style={tileCanvasStyle}>{children}</div>
      </div>
      <div style={tileLabelRowStyle}>
        <span style={tileTitleStyle}>{title}</span>
        <span style={tileHintStyle}>{hint}</span>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────
// 01 · Rotary knob — drag to rotate, indicator notch + LED tip
// ────────────────────────────────────────────────────────────────

function RotaryKnob() {
  const [angle, setAngle] = useState(-150); // -150..+150 = 0..100
  const ref = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const start = useRef({ angle: 0, pointerAngle: 0 });

  const pointerAngleFrom = (e: PointerEvent<SVGSVGElement>): number => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return 0;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
  };

  const onDown = (e: PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    start.current = { angle, pointerAngle: pointerAngleFrom(e) };
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!dragging.current) return;
    const cur = pointerAngleFrom(e);
    const delta = cur - start.current.pointerAngle;
    const next = Math.max(-150, Math.min(150, start.current.angle + delta));
    setAngle(next);
  };
  const onUp = () => { dragging.current = false; };
  const value = Math.round(((angle + 150) / 300) * 100);

  return (
    <svg
      ref={ref}
      width="140"
      height="140"
      viewBox="0 0 100 100"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      style={{ cursor: "grab", touchAction: "none" }}
    >
      <defs>
        <radialGradient id="knob-face" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
          <stop offset="60%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <radialGradient id="knob-rim" cx="50%" cy="50%" r="50%">
          <stop offset="60%" stopColor="var(--df-bg-button-tactile)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.35)" />
        </radialGradient>
      </defs>
      {/* Tick scale */}
      {Array.from({ length: 13 }).map((_, i) => {
        const a = -150 + i * 25;
        const x1 = 50 + Math.cos((a - 90) * Math.PI / 180) * 42;
        const y1 = 50 + Math.sin((a - 90) * Math.PI / 180) * 42;
        const x2 = 50 + Math.cos((a - 90) * Math.PI / 180) * 46;
        const y2 = 50 + Math.sin((a - 90) * Math.PI / 180) * 46;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--df-text-faint)" strokeWidth="1" />;
      })}
      <circle cx="50" cy="50" r="38" fill="url(#knob-rim)" />
      <circle cx="50" cy="50" r="34" fill="var(--df-bg-base)" />
      <circle cx="50" cy="50" r="34" fill="url(#knob-face)" />
      <g transform={`rotate(${angle} 50 50)`}>
        <line x1="50" y1="20" x2="50" y2="32" stroke="var(--df-accent-user, #ff5524)" strokeWidth="3" strokeLinecap="round" />
        <circle cx="50" cy="20" r="2.5" fill="var(--df-accent-user, #ff5524)">
          <animate attributeName="opacity" values="0.85;1;0.85" dur="1.6s" repeatCount="indefinite" />
        </circle>
      </g>
      <text x="50" y="55" textAnchor="middle" fontSize="10" fontFamily="var(--df-font-mono)" fill="var(--df-text-secondary)">{value}</text>
    </svg>
  );
}

// ────────────────────────────────────────────────────────────────
// 02 · Metal toggle — slide between off/on
// ────────────────────────────────────────────────────────────────

function MetalToggle() {
  const [on, setOn] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setOn((v) => !v)}
      style={{
        appearance: "none",
        border: 0,
        padding: 0,
        background: "transparent",
        cursor: "pointer",
      }}
    >
      <svg width="120" height="62" viewBox="0 0 120 62">
        <defs>
          <linearGradient id="tg-track" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(0,0,0,0.40)" />
            <stop offset="50%" stopColor="rgba(0,0,0,0.20)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.04)" />
          </linearGradient>
          <radialGradient id="tg-handle" cx="40%" cy="35%" r="60%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.45)" />
            <stop offset="60%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>
        <rect x="2" y="14" width="116" height="34" rx="17" fill="url(#tg-track)" stroke="rgba(0,0,0,0.45)" strokeWidth="1" />
        <rect
          x="2"
          y="14"
          width="116"
          height="34"
          rx="17"
          fill={on ? "color-mix(in srgb, var(--df-accent-user, #ff5524) 18%, transparent)" : "transparent"}
          style={{ transition: "fill 220ms ease" }}
        />
        <g
          transform={`translate(${on ? 60 : 4} 4)`}
          style={{ transition: "transform 220ms cubic-bezier(0.4, 1.4, 0.5, 1)" }}
        >
          <rect width="56" height="54" rx="14" fill="var(--df-bg-button-tactile)" stroke="rgba(0,0,0,0.45)" strokeWidth="1" />
          <rect width="56" height="54" rx="14" fill="url(#tg-handle)" />
          <line x1="22" y1="22" x2="22" y2="32" stroke="rgba(0,0,0,0.4)" strokeWidth="1" />
          <line x1="28" y1="22" x2="28" y2="32" stroke="rgba(0,0,0,0.4)" strokeWidth="1" />
          <line x1="34" y1="22" x2="34" y2="32" stroke="rgba(0,0,0,0.4)" strokeWidth="1" />
        </g>
      </svg>
    </button>
  );
}

// ────────────────────────────────────────────────────────────────
// 03 · VU meter — passive sine sweep
// ────────────────────────────────────────────────────────────────

function VuMeter() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setT((v) => v + 0.04), 30);
    return () => window.clearInterval(id);
  }, []);
  const sweep = 35 * Math.sin(t) + 20 * Math.sin(t * 1.7);
  const angle = sweep;
  return (
    <svg width="160" height="100" viewBox="0 0 160 100">
      <defs>
        <linearGradient id="vu-bg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(0,0,0,0.18)" />
          <stop offset="100%" stopColor="var(--df-bg-base)" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="156" height="96" rx="6" fill="url(#vu-bg)" stroke="rgba(0,0,0,0.4)" />
      {/* Arc */}
      <path d="M20 86 A 60 60 0 0 1 140 86" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="32" />
      {Array.from({ length: 11 }).map((_, i) => {
        const a = -60 + i * 12;
        const x1 = 80 + Math.cos((a - 90) * Math.PI / 180) * 56;
        const y1 = 86 + Math.sin((a - 90) * Math.PI / 180) * 56;
        const x2 = 80 + Math.cos((a - 90) * Math.PI / 180) * 64;
        const y2 = 86 + Math.sin((a - 90) * Math.PI / 180) * 64;
        const danger = i >= 8;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={danger ? "var(--df-accent-user, #ff5524)" : "var(--df-text-secondary)"} strokeWidth="1.5" />;
      })}
      <line
        x1="80"
        y1="86"
        x2={80 + Math.cos((angle - 90) * Math.PI / 180) * 60}
        y2={86 + Math.sin((angle - 90) * Math.PI / 180) * 60}
        stroke="var(--df-accent-user, #ff5524)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="80" cy="86" r="6" fill="var(--df-bg-button-tactile)" stroke="rgba(0,0,0,0.4)" />
      <circle cx="80" cy="86" r="2" fill="rgba(255,255,255,0.3)" />
      <text x="80" y="22" textAnchor="middle" fontSize="9" fontFamily="var(--df-font-mono)" letterSpacing="0.1em" fill="var(--df-text-faint)">VU</text>
    </svg>
  );
}

// ────────────────────────────────────────────────────────────────
// 04 · Tactile slider — drag horizontal, premium handle
// ────────────────────────────────────────────────────────────────

function TactileSlider() {
  const [v, setV] = useState(60);
  const ref = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const set = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, ((x - 12) / (rect.width - 24)) * 100));
    setV(pct);
  };
  const onDown = (e: PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true; set(e.clientX);
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => { if (dragging.current) set(e.clientX); };
  const onUp = () => { dragging.current = false; };
  const handleX = 12 + (v / 100) * 156;

  return (
    <svg
      ref={ref}
      width="180" height="60" viewBox="0 0 180 60"
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      style={{ cursor: "ew-resize", touchAction: "none" }}
    >
      <defs>
        <linearGradient id="ts-fill" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="color-mix(in srgb, var(--df-accent-user, #ff5524) 60%, transparent)" />
          <stop offset="100%" stopColor="color-mix(in srgb, var(--df-accent-user, #ff5524) 10%, transparent)" />
        </linearGradient>
      </defs>
      <rect x="6" y="24" width="168" height="12" rx="6" fill="rgba(0,0,0,0.32)" stroke="rgba(0,0,0,0.45)" />
      <rect x="6" y="24" width={handleX - 6} height="12" rx="6" fill="url(#ts-fill)" />
      <g transform={`translate(${handleX - 14} 12)`} style={{ transition: dragging.current ? "none" : "transform 200ms ease" }}>
        <rect width="28" height="36" rx="6" fill="var(--df-bg-button-tactile)" stroke="rgba(0,0,0,0.5)" />
        <rect width="28" height="36" rx="6" fill="url(#knob-face)" />
        <line x1="14" y1="10" x2="14" y2="26" stroke="rgba(0,0,0,0.45)" strokeWidth="1" />
      </g>
      <text x="90" y="56" textAnchor="middle" fontSize="9" fontFamily="var(--df-font-mono)" fill="var(--df-text-faint)">{Math.round(v)}</text>
    </svg>
  );
}

// ────────────────────────────────────────────────────────────────
// 05 · LED button — hold to ignite
// ────────────────────────────────────────────────────────────────

function LedButton() {
  const [active, setActive] = useState(false);
  return (
    <button
      type="button"
      onPointerDown={() => setActive(true)}
      onPointerUp={() => setActive(false)}
      onPointerLeave={() => setActive(false)}
      style={{ appearance: "none", border: 0, padding: 0, background: "transparent", cursor: "pointer" }}
    >
      <svg width="120" height="120" viewBox="0 0 120 120">
        <defs>
          <radialGradient id="led-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,85,36,0.85)" />
            <stop offset="60%" stopColor="rgba(255,85,36,0)" />
          </radialGradient>
          <radialGradient id="led-cap" cx="40%" cy="35%" r="60%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
            <stop offset="60%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>
        <circle cx="60" cy="60" r="55" fill="var(--df-bg-section)" stroke="rgba(0,0,0,0.45)" />
        {active && <circle cx="60" cy="60" r="50" fill="url(#led-glow)" opacity="0.9" />}
        <circle
          cx="60" cy="60" r="36"
          fill={active ? "color-mix(in srgb, var(--df-accent-user, #ff5524) 40%, var(--df-bg-button-tactile))" : "var(--df-bg-button-tactile)"}
          stroke="rgba(0,0,0,0.4)"
          style={{ transition: "fill 180ms ease" }}
        />
        <circle cx="60" cy="60" r="36" fill="url(#led-cap)" />
        <circle cx="60" cy="60" r="6" fill={active ? "var(--df-accent-user, #ff5524)" : "rgba(255,255,255,0.15)"}>
          {active && <animate attributeName="r" values="6;8;6" dur="0.8s" repeatCount="indefinite" />}
        </circle>
      </svg>
    </button>
  );
}

// ────────────────────────────────────────────────────────────────
// 06 · Rotary encoder — click ± to step
// ────────────────────────────────────────────────────────────────

function RotaryEncoder() {
  const [angle, setAngle] = useState(0);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <button type="button" onClick={() => setAngle((a) => a - 15)} style={stepperBtnStyle}>−</button>
      <svg width="100" height="100" viewBox="0 0 100 100">
        <defs>
          <radialGradient id="enc-face" cx="50%" cy="50%" r="50%">
            <stop offset="80%" stopColor="var(--df-bg-button-tactile)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.35)" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="42" fill="url(#enc-face)" stroke="rgba(0,0,0,0.45)" />
        {Array.from({ length: 24 }).map((_, i) => {
          const a = i * 15;
          const x = 50 + Math.cos((a - 90) * Math.PI / 180) * 40;
          const y = 50 + Math.sin((a - 90) * Math.PI / 180) * 40;
          return <circle key={i} cx={x} cy={y} r="1.2" fill="rgba(0,0,0,0.3)" />;
        })}
        <g transform={`rotate(${angle} 50 50)`} style={{ transition: "transform 280ms cubic-bezier(0.4,1.4,0.5,1)" }}>
          <circle cx="50" cy="50" r="26" fill="var(--df-bg-button-tactile)" stroke="rgba(0,0,0,0.3)" />
          <circle cx="50" cy="50" r="26" fill="url(#knob-face)" />
          <line x1="50" y1="30" x2="50" y2="40" stroke="var(--df-accent-user, #ff5524)" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      </svg>
      <button type="button" onClick={() => setAngle((a) => a + 15)} style={stepperBtnStyle}>+</button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// 07 · Bezel breathe — passive concentric pulse
// ────────────────────────────────────────────────────────────────

function BezelBreathe() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120">
      <defs>
        <radialGradient id="bz-face" cx="50%" cy="50%" r="50%">
          <stop offset="60%" stopColor="var(--df-bg-button-tactile)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.5)" />
        </radialGradient>
      </defs>
      {[42, 50, 58].map((r, i) => (
        <circle
          key={i}
          cx="60" cy="60" r={r}
          fill="none"
          stroke="color-mix(in srgb, var(--df-accent-user, #ff5524) 30%, transparent)"
          strokeWidth="1"
          opacity="0.6"
        >
          <animate attributeName="r" values={`${r};${r + 6};${r}`} dur="3.4s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.6;0.05;0.6" dur="3.4s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
        </circle>
      ))}
      <circle cx="60" cy="60" r="38" fill="url(#bz-face)" stroke="rgba(0,0,0,0.45)" />
      <circle cx="60" cy="60" r="6" fill="var(--df-accent-user, #ff5524)">
        <animate attributeName="opacity" values="0.5;1;0.5" dur="3.4s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

// ────────────────────────────────────────────────────────────────
// 08 · LED bank — Kitt-style sequencer on hover
// ────────────────────────────────────────────────────────────────

function LedBank() {
  const [active, setActive] = useState(false);
  const [pos, setPos] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setPos((p) => (p + 1) % 16), 80);
    return () => window.clearInterval(id);
  }, [active]);
  const litIdx = pos < 8 ? pos : 14 - pos;
  return (
    <div
      onPointerEnter={() => setActive(true)}
      onPointerLeave={() => setActive(false)}
      style={{ padding: "10px 14px", background: "rgba(0,0,0,0.32)", borderRadius: 10, border: "1px solid rgba(0,0,0,0.5)" }}
    >
      <div style={{ display: "flex", gap: 6 }}>
        {Array.from({ length: 8 }).map((_, i) => {
          const distance = Math.abs(i - litIdx);
          const intensity = active ? Math.max(0, 1 - distance / 3) : 0.18;
          return (
            <span
              key={i}
              style={{
                width: 12, height: 12, borderRadius: 999,
                background: `color-mix(in srgb, var(--df-accent-user, #ff5524) ${intensity * 100}%, rgba(0,0,0,0.6))`,
                boxShadow: intensity > 0.7 ? `0 0 8px color-mix(in srgb, var(--df-accent-user, #ff5524) ${intensity * 80}%, transparent)` : "inset 0 1px 1px rgba(0,0,0,0.4)",
                transition: "background 80ms linear, box-shadow 80ms linear",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// 09 · Capacitive ripple — click anywhere on the pad
// ────────────────────────────────────────────────────────────────

function CapacitiveRipple() {
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const idRef = useRef(0);
  const onClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const id = ++idRef.current;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setRipples((prev) => [...prev, { id, x, y }]);
    window.setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 900);
  }, []);
  return (
    <div
      onClick={onClick}
      style={{
        position: "relative",
        width: 160, height: 110,
        borderRadius: 12,
        background: "var(--df-bg-button-tactile)",
        boxShadow: "inset 0 1px 0 var(--df-skeu-top-light), inset 0 0 0 1px rgba(0,0,0,0.4), inset 0 -1px 0 rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.25)",
        overflow: "hidden",
        cursor: "pointer",
      }}
    >
      <svg width="100%" height="100%" viewBox="0 0 160 110" preserveAspectRatio="none" style={{ pointerEvents: "none" }}>
        <defs>
          {ripples.map((r) => (
            <radialGradient key={r.id} id={`rip-${r.id}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="color-mix(in srgb, var(--df-accent-user, #ff5524) 60%, transparent)" />
              <stop offset="100%" stopColor="color-mix(in srgb, var(--df-accent-user, #ff5524) 0%, transparent)" />
            </radialGradient>
          ))}
        </defs>
        {ripples.map((r) => (
          <circle key={r.id} cx={r.x} cy={r.y} r="4" fill={`url(#rip-${r.id})`} opacity="0.9">
            <animate attributeName="r" values="4;90" dur="0.9s" fill="freeze" />
            <animate attributeName="opacity" values="0.9;0" dur="0.9s" fill="freeze" />
          </circle>
        ))}
      </svg>
      <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontFamily: "var(--df-font-mono)", fontSize: 10, letterSpacing: "0.18em", color: "var(--df-text-faint)", textTransform: "uppercase", pointerEvents: "none" }}>
        tap surface
      </span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// 10 · Goo loader — gooey 3-dot bloom, passive
// ────────────────────────────────────────────────────────────────

function GooLoader() {
  return (
    <svg width="120" height="120" viewBox="0 0 200 200">
      <defs>
        <filter id="goo10" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
          <feColorMatrix values="1 0 0 0 0   0 1 0 0 0   0 0 1 0 0   0 0 0 18 -7" />
        </filter>
      </defs>
      <g style={{ filter: "url(#goo10)", color: "var(--df-accent-user, #ff5524)" }}>
        <circle cx="100" cy="100" r="14" fill="currentColor">
          <animate attributeName="cx" values="100;130;100;70;100" dur="2.2s" repeatCount="indefinite" />
          <animate attributeName="cy" values="100;100;130;100;100" dur="2.2s" repeatCount="indefinite" />
        </circle>
        <circle cx="100" cy="100" r="14" fill="currentColor">
          <animate attributeName="cx" values="100;70;100;130;100" dur="2.2s" repeatCount="indefinite" />
          <animate attributeName="cy" values="100;100;70;100;100" dur="2.2s" repeatCount="indefinite" />
        </circle>
        <circle cx="100" cy="100" r="14" fill="currentColor">
          <animate attributeName="cx" values="100;100;100;100;100" dur="2.2s" repeatCount="indefinite" />
          <animate attributeName="cy" values="100;130;100;70;100" dur="2.2s" repeatCount="indefinite" />
        </circle>
      </g>
    </svg>
  );
}

// ────────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────────

const screenStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  background: "var(--df-bg-base)",
  color: "var(--df-text-primary)",
  minHeight: "100vh",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 20,
  padding: "24px 32px",
  borderBottom: "1px solid var(--df-border-subtle)",
};

const headerTitleStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const kickerStyle: CSSProperties = {
  fontFamily: "var(--df-font-mono)",
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.20em",
  textTransform: "uppercase",
  color: "var(--df-text-faint)",
};

const titleStyle: CSSProperties = {
  fontSize: "var(--df-text-lg)",
  fontWeight: 600,
  letterSpacing: "-0.015em",
};

const gridStyle: CSSProperties = {
  flex: 1,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
  gap: 20,
  padding: 32,
};

const tileStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const tileChromeStyle: CSSProperties = {
  position: "relative",
  borderRadius: 14,
  padding: 16,
  background: "var(--df-bg-section)",
  boxShadow: [
    "inset 0 1px 0 var(--df-skeu-top-light)",
    "inset 0 0 0 1px var(--df-border-subtle)",
    "inset 0 -1px 0 rgba(0,0,0,0.2)",
    "0 2px 4px rgba(0,0,0,0.08)",
    "0 12px 24px -10px rgba(0,0,0,0.18)",
  ].join(", "),
};

const tileCanvasStyle: CSSProperties = {
  height: 160,
  display: "grid",
  placeItems: "center",
};

const tileLabelRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  padding: "0 4px",
};

const tileTitleStyle: CSSProperties = {
  fontFamily: "var(--df-font-mono)",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--df-text-secondary)",
};

const tileHintStyle: CSSProperties = {
  fontFamily: "var(--df-font-sans)",
  fontSize: 11,
  color: "var(--df-text-faint)",
  fontStyle: "italic",
};

const stepperBtnStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 8,
  background: "var(--df-bg-button-tactile)",
  border: "1px solid rgba(0,0,0,0.4)",
  boxShadow: "inset 0 1px 0 var(--df-skeu-top-light)",
  color: "var(--df-text-on-tactile)",
  fontFamily: "var(--df-font-mono)",
  fontSize: 16,
  fontWeight: 600,
  cursor: "pointer",
};

export default SkeuShowcaseScreen;

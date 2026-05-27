import { useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShaderScan, SCAN_DEFAULTS, type ScanParams,
  ShaderPolish, POLISH_DEFAULTS, type PolishParams,
  ShaderAurora, AURORA_DEFAULTS, type AuroraParams,
  ShaderSparkle, SPARKLE_DEFAULTS, type SparkleParams,
  ShaderGlitch, GLITCH_DEFAULTS, type GlitchParams,
} from "@/components/VerbShaders";
import { ColorPickerPopover } from "@/components/dfds";

// /shaders — preview every per-category shader live, tweak params, copy
// the final values for me to paste back into the canonical defaults.

interface CardProps {
  title: string;
  category: string;
  verbsLabel: string;
  preview: ReactNode;
  panel: ReactNode;
  jsonPreview: string;
}

function PreviewCard({ title, category, verbsLabel, preview, panel, jsonPreview }: CardProps) {
  const [copied, setCopied] = useState(false);
  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 320px",
        gap: 24,
        padding: 24,
        background: "var(--df-surface-base)",
        border: "1px solid var(--df-border-subtle)",
        borderRadius: "var(--df-r-lg, 14px)",
        boxShadow: "0 1px 2px var(--df-skeu-near), 0 6px 18px -4px var(--df-skeu-deep-near)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <header style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: "var(--df-text-lg)", fontWeight: 600, color: "var(--df-text-primary)" }}>{title}</h2>
          <span style={{
            fontFamily: "var(--df-font-mono)",
            fontSize: "var(--df-text-xs)",
            color: "var(--df-text-muted)",
            letterSpacing: "0.04em",
          }}>{category}</span>
        </header>

        <p style={{ margin: 0, color: "var(--df-text-secondary)", fontSize: "var(--df-text-sm)" }}>
          Plays inside verb-card while running: <code style={{ fontFamily: "var(--df-font-mono)", fontSize: "var(--df-text-xs)", color: "var(--df-text-muted)" }}>{verbsLabel}</code>
        </p>

        {/* Faux verb-card — same dimensions as in chat */}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "11px 14px 11px 12px",
            minHeight: 64,
            background: "var(--df-surface-elevated)",
            borderRadius: "var(--df-r-md, 10px)",
            boxShadow: `
              inset 0 1px 0 var(--df-skeu-top-light),
              inset 0 0 0 1px var(--df-border-subtle),
              0 1px 2px var(--df-skeu-near),
              0 4px 14px -4px var(--df-skeu-deep-near)
            `,
            color: "var(--df-text-primary)",
            overflow: "hidden",
          }}
        >
          {preview}
          <span
            aria-hidden
            style={{
              position: "relative",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 18,
              height: 18,
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: "var(--df-text-primary)",
                boxShadow: "0 0 0 4px color-mix(in srgb, var(--df-text-primary) 14%, transparent)",
                animation: "df-verb-pill-breath 1400ms ease-in-out infinite",
              }}
            />
          </span>
          <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
            <span style={{ fontWeight: 600, letterSpacing: "var(--df-tracking-tight)", fontSize: "var(--df-text-sm)" }}>
              /{verbsLabel.split(",")[0].trim()}
              <span style={{ marginLeft: 8, color: "var(--df-text-secondary)", fontWeight: 400 }}>{title}</span>
            </span>
            <span style={{
              color: "var(--df-text-muted)",
              fontFamily: "var(--df-font-mono)",
              fontSize: "var(--df-text-xs)",
              letterSpacing: "0.04em",
            }}>
              running<span className="df-verb-dots" aria-hidden>...</span>
            </span>
          </div>
        </div>

        <details style={{ background: "var(--df-surface-raised)", borderRadius: "var(--df-r-sm, 6px)", padding: 12 }}>
          <summary style={{ cursor: "pointer", color: "var(--df-text-secondary)", fontSize: "var(--df-text-xs)", fontFamily: "var(--df-font-mono)" }}>
            current values (paste in chat to apply)
          </summary>
          <pre style={{
            margin: "10px 0 0",
            padding: 10,
            background: "var(--df-surface-base)",
            borderRadius: 4,
            fontFamily: "var(--df-font-mono)",
            fontSize: 11,
            color: "var(--df-text-primary)",
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}>{jsonPreview}</pre>
          <button
            onClick={() => {
              navigator.clipboard.writeText(jsonPreview).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
            style={{
              marginTop: 8,
              padding: "5px 10px",
              fontSize: "var(--df-text-xs)",
              fontFamily: "var(--df-font-mono)",
              background: "var(--df-surface-elevated)",
              border: "1px solid var(--df-border-subtle)",
              borderRadius: 4,
              color: "var(--df-text-primary)",
              cursor: "pointer",
            }}
          >
            {copied ? "copied ✓" : "copy"}
          </button>
        </details>
      </div>

      <aside
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          padding: 16,
          background: "var(--df-surface-raised)",
          borderRadius: "var(--df-r-md, 10px)",
          border: "1px solid var(--df-border-subtle)",
        }}
      >
        <div style={{
          fontFamily: "var(--df-font-mono)",
          fontSize: 10,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--df-text-muted)",
          marginBottom: 4,
        }}>
          tweaks
        </div>
        {panel}
      </aside>
    </section>
  );
}

const labelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: "var(--df-text-xs)",
  color: "var(--df-text-secondary)",
  fontFamily: "var(--df-font-mono)",
};

const rangeStyle: CSSProperties = {
  width: "100%",
  accentColor: "var(--df-text-primary)",
};

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
  unit?: string;
}
function Slider({ label, value, min, max, step = 1, onChange, unit }: SliderProps) {
  return (
    <label style={labelStyle}>
      <span style={{ display: "flex", justifyContent: "space-between" }}>
        <span>{label}</span>
        <span style={{ color: "var(--df-text-muted)" }}>{value}{unit ?? ""}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={rangeStyle}
      />
    </label>
  );
}

interface ColorProps {
  label: string;
  value: string;
  onChange: (s: string) => void;
}
function ColorInput({ label, value, onChange }: ColorProps) {
  // Convert rgba(r,g,b,a) → #rrggbb for the native color picker.
  const m = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  const hex = m
    ? "#" + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("")
    : "#888888";
  return (
    <label style={labelStyle}>
      <span style={{ display: "flex", justifyContent: "space-between" }}>
        <span>{label}</span>
        <span style={{ color: "var(--df-text-muted)" }}>{hex}</span>
      </span>
      <ColorPickerPopover
        value={hex}
        onChange={(h) => {
          const r = parseInt(h.slice(1, 3), 16);
          const g = parseInt(h.slice(3, 5), 16);
          const b = parseInt(h.slice(5, 7), 16);
          onChange(`rgba(${r}, ${g}, ${b}, 1)`);
        }}
      />
    </label>
  );
}

export function ShadersScreen() {
  const navigate = useNavigate();

  const [scan, setScan] = useState<ScanParams>(SCAN_DEFAULTS);
  const [polish, setPolish] = useState<PolishParams>(POLISH_DEFAULTS);
  const [aurora, setAurora] = useState<AuroraParams>(AURORA_DEFAULTS);
  const [sparkle, setSparkle] = useState<SparkleParams>(SPARKLE_DEFAULTS);
  const [glitch, setGlitch] = useState<GlitchParams>(GLITCH_DEFAULTS);

  const reset = () => {
    setScan(SCAN_DEFAULTS);
    setPolish(POLISH_DEFAULTS);
    setAurora(AURORA_DEFAULTS);
    setSparkle(SPARKLE_DEFAULTS);
    setGlitch(GLITCH_DEFAULTS);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--df-surface-base)",
        color: "var(--df-text-primary)",
        padding: "32px 40px 64px",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 32,
          paddingBottom: 16,
          borderBottom: "1px solid var(--df-border-subtle)",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "var(--df-text-2xl, 24px)", fontWeight: 600, letterSpacing: "var(--df-tracking-tight)" }}>
            Shaders
          </h1>
          <p style={{ margin: "4px 0 0", color: "var(--df-text-secondary)", fontSize: "var(--df-text-sm)" }}>
            One CSS shader per verb category. Tweak knobs, copy values, paste in chat.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={reset}
            style={{
              padding: "7px 14px",
              fontSize: "var(--df-text-sm)",
              background: "var(--df-surface-elevated)",
              border: "1px solid var(--df-border-subtle)",
              borderRadius: 6,
              color: "var(--df-text-primary)",
              cursor: "pointer",
              fontFamily: "var(--df-font-mono)",
            }}
          >
            reset all
          </button>
          <button
            onClick={() => navigate("/")}
            style={{
              padding: "7px 14px",
              fontSize: "var(--df-text-sm)",
              background: "transparent",
              border: "1px solid var(--df-border-subtle)",
              borderRadius: 6,
              color: "var(--df-text-secondary)",
              cursor: "pointer",
            }}
          >
            ← home
          </button>
        </div>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1280, margin: "0 auto" }}>
        <PreviewCard
          title="Scan"
          category="evaluate"
          verbsLabel="review, check"
          preview={<ShaderScan params={scan} />}
          jsonPreview={JSON.stringify(scan, null, 2)}
          panel={
            <>
              <ColorInput label="color" value={scan.color} onChange={(color) => setScan({ ...scan, color })} />
              <Slider label="grid size" value={scan.gridSize} min={6} max={32} onChange={(gridSize) => setScan({ ...scan, gridSize })} unit="px" />
              <Slider label="grid opacity" value={scan.gridOpacity} min={0} max={0.4} step={0.01} onChange={(gridOpacity) => setScan({ ...scan, gridOpacity })} />
              <Slider label="scan thickness" value={scan.scanThickness} min={4} max={32} onChange={(scanThickness) => setScan({ ...scan, scanThickness })} unit="px" />
              <Slider label="scan speed" value={scan.scanSpeedMs} min={600} max={4000} step={50} onChange={(scanSpeedMs) => setScan({ ...scan, scanSpeedMs })} unit="ms" />
              <Slider label="scan opacity" value={scan.scanOpacity} min={0.2} max={1} step={0.05} onChange={(scanOpacity) => setScan({ ...scan, scanOpacity })} />
            </>
          }
        />

        <PreviewCard
          title="Polish"
          category="refine"
          verbsLabel="polish, simplify, reinforce"
          preview={<ShaderPolish params={polish} />}
          jsonPreview={JSON.stringify(polish, null, 2)}
          panel={
            <>
              <ColorInput label="color 1 (gold)" value={polish.color1} onChange={(color1) => setPolish({ ...polish, color1 })} />
              <ColorInput label="color 2 (champagne)" value={polish.color2} onChange={(color2) => setPolish({ ...polish, color2 })} />
              <Slider label="conic A speed" value={polish.conicSpeedAMs} min={2000} max={14000} step={100} onChange={(conicSpeedAMs) => setPolish({ ...polish, conicSpeedAMs })} unit="ms" />
              <Slider label="conic B speed" value={polish.conicSpeedBMs} min={2000} max={16000} step={100} onChange={(conicSpeedBMs) => setPolish({ ...polish, conicSpeedBMs })} unit="ms" />
              <Slider label="sheen speed" value={polish.sheenSpeedMs} min={800} max={6000} step={50} onChange={(sheenSpeedMs) => setPolish({ ...polish, sheenSpeedMs })} unit="ms" />
              <Slider label="intensity" value={polish.intensity} min={0.2} max={2} step={0.05} onChange={(intensity) => setPolish({ ...polish, intensity })} />
              <Slider label="blur" value={polish.blurPx} min={2} max={24} onChange={(blurPx) => setPolish({ ...polish, blurPx })} unit="px" />
            </>
          }
        />

        <PreviewCard
          title="Aurora"
          category="direction"
          verbsLabel="bolder, calmer, charm"
          preview={<ShaderAurora params={aurora} />}
          jsonPreview={JSON.stringify(aurora, null, 2)}
          panel={
            <>
              <ColorInput label="color 1 (coral)" value={aurora.color1} onChange={(color1) => setAurora({ ...aurora, color1 })} />
              <ColorInput label="color 2 (magenta)" value={aurora.color2} onChange={(color2) => setAurora({ ...aurora, color2 })} />
              <ColorInput label="color 3 (purple)" value={aurora.color3} onChange={(color3) => setAurora({ ...aurora, color3 })} />
              <Slider label="speed A" value={aurora.speedAMs} min={2000} max={12000} step={100} onChange={(speedAMs) => setAurora({ ...aurora, speedAMs })} unit="ms" />
              <Slider label="speed B" value={aurora.speedBMs} min={2000} max={12000} step={100} onChange={(speedBMs) => setAurora({ ...aurora, speedBMs })} unit="ms" />
              <Slider label="speed C" value={aurora.speedCMs} min={2000} max={12000} step={100} onChange={(speedCMs) => setAurora({ ...aurora, speedCMs })} unit="ms" />
              <Slider label="blur" value={aurora.blurPx} min={8} max={50} onChange={(blurPx) => setAurora({ ...aurora, blurPx })} unit="px" />
              <Slider label="opacity" value={aurora.opacity} min={0.3} max={1} step={0.05} onChange={(opacity) => setAurora({ ...aurora, opacity })} />
            </>
          }
        />

        <PreviewCard
          title="Sparkle"
          category="enhance"
          verbsLabel="animate, type, color, rewrite"
          preview={<ShaderSparkle params={sparkle} />}
          jsonPreview={JSON.stringify(sparkle, null, 2)}
          panel={
            <>
              <ColorInput label="dot color" value={sparkle.color} onChange={(color) => setSparkle({ ...sparkle, color })} />
              <Slider label="count" value={sparkle.count} min={4} max={28} onChange={(count) => setSparkle({ ...sparkle, count })} />
              <Slider label="size" value={sparkle.size} min={2} max={12} onChange={(size) => setSparkle({ ...sparkle, size })} unit="px" />
              <Slider label="min speed" value={sparkle.minSpeedMs} min={500} max={3000} step={50} onChange={(minSpeedMs) => setSparkle({ ...sparkle, minSpeedMs })} unit="ms" />
              <Slider label="max speed" value={sparkle.maxSpeedMs} min={1000} max={4000} step={50} onChange={(maxSpeedMs) => setSparkle({ ...sparkle, maxSpeedMs })} unit="ms" />
              <Slider label="scale max" value={sparkle.scaleMax} min={1} max={3} step={0.1} onChange={(scaleMax) => setSparkle({ ...sparkle, scaleMax })} />
            </>
          }
        />

        <PreviewCard
          title="Glitch"
          category="fix (reserved)"
          verbsLabel="rewrite (alternate)"
          preview={<ShaderGlitch params={glitch} />}
          jsonPreview={JSON.stringify(glitch, null, 2)}
          panel={
            <>
              <Slider label="noise opacity" value={glitch.noiseOpacity} min={0.1} max={0.9} step={0.05} onChange={(noiseOpacity) => setGlitch({ ...glitch, noiseOpacity })} />
              <Slider label="noise speed" value={glitch.noiseSpeedMs} min={80} max={600} step={20} onChange={(noiseSpeedMs) => setGlitch({ ...glitch, noiseSpeedMs })} unit="ms" />
              <ColorInput label="track color" value={glitch.trackColor} onChange={(trackColor) => setGlitch({ ...glitch, trackColor })} />
              <Slider label="track speed" value={glitch.trackSpeedMs} min={1000} max={5000} step={100} onChange={(trackSpeedMs) => setGlitch({ ...glitch, trackSpeedMs })} unit="ms" />
            </>
          }
        />
      </div>
    </div>
  );
}

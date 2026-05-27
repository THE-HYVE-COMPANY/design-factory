// NewProjectSpatialLab — paradigm E: spatial spec.
//
// Premise (user, 2026-05-04). Explorers want to feel the texture of the
// brief, not declare it in words. This lab puts a single prompt textarea in
// the center surrounded by 6 dial sliders. Each slider has 2 polar labels
// (e.g. clean ↔ expressive) and a 0–100 value. Adjusting them composes a
// short tag-line below the prompt: "Tone 65 expressive · Density 30 minimal…"
//
// Layout: centered prompt card with 3 sliders on the left side and 3 on the
// right (CSS grid 3-col, prompt spans middle). On narrow widths everything
// stacks vertically — sliders above prompt.
//
// Lab-only constraints: same as A — Begin logs payload + toast.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import "@/styles/np-e.css";

interface DialSpec {
  id: string;
  label: string;
  polarLow: string;
  polarHigh: string;
  side: "left" | "right";
  defaultValue: number;
}

const DIALS: DialSpec[] = [
  { id: "tone",    label: "Tone",    polarLow: "clean",     polarHigh: "expressive", side: "left",  defaultValue: 50 },
  { id: "density", label: "Density", polarLow: "minimal",   polarHigh: "rich",       side: "left",  defaultValue: 40 },
  { id: "color",   label: "Color",   polarLow: "muted",     polarHigh: "vivid",      side: "left",  defaultValue: 50 },
  { id: "motion",  label: "Motion",  polarLow: "still",     polarHigh: "active",     side: "right", defaultValue: 30 },
  { id: "format",  label: "Format",  polarLow: "free",      polarHigh: "structured", side: "right", defaultValue: 60 },
  { id: "voice",   label: "Voice",   polarLow: "technical", polarHigh: "poetic",     side: "right", defaultValue: 50 },
];

const LS_LAST_PAYLOAD = "df-np-spatial-last-payload";

// Pick the closer polar word based on the dial value. Above 50 leans high,
// 50 itself is treated as balanced — show "balanced" then.
function dialDescriptor(spec: DialSpec, value: number): { word: string; emphasis: number } {
  if (value === 50) return { word: "balanced", emphasis: 0 };
  if (value > 50) return { word: spec.polarHigh, emphasis: value };
  return { word: spec.polarLow, emphasis: 100 - value };
}

// ─────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────

export function NewProjectSpatialLab() {
  const navigate = useNavigate();

  const [prompt, setPrompt] = useState("");
  const [values, setValues] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    DIALS.forEach((d) => { init[d.id] = d.defaultValue; });
    return init;
  });
  const [toast, setToast] = useState<{ msg: string; key: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const setDial = useCallback((id: string, value: number) => {
    setValues((curr) => ({ ...curr, [id]: value }));
  }, []);

  const summaryText = useMemo(() => {
    return DIALS.map((d) => {
      const v = values[d.id];
      const { word, emphasis } = dialDescriptor(d, v);
      // For the special "balanced" case (value === 50) the emphasis is 0,
      // which would read awkwardly ("Tone 0 balanced"). Print just the
      // word in that case.
      if (v === 50) return `${d.label} balanced`;
      return `${d.label} ${emphasis} ${word}`;
    }).join("  ·  ");
  }, [values]);

  const canBegin = prompt.trim().length > 0;

  const handleBegin = useCallback(() => {
    if (!canBegin) return;
    const payload = {
      prompt: prompt.trim(),
      dials: values,
      summary: summaryText,
      ts: Date.now(),
    };
    // eslint-disable-next-line no-console
    console.log("[np-spatial] would create project with payload:", payload);
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(LS_LAST_PAYLOAD, JSON.stringify(payload));
      }
    } catch {
      /* lab — best-effort persistence only */
    }
    setToast({
      msg: `Would create project — "${payload.prompt.slice(0, 32)}${payload.prompt.length > 32 ? "…" : ""}"`,
      key: Date.now(),
    });
  }, [canBegin, prompt, values, summaryText]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const handleTextareaKey = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleBegin();
      }
    },
    [handleBegin],
  );

  // Reset all dials to defaults.
  const resetDials = useCallback(() => {
    const init: Record<string, number> = {};
    DIALS.forEach((d) => { init[d.id] = d.defaultValue; });
    setValues(init);
  }, []);

  const leftDials = DIALS.filter((d) => d.side === "left");
  const rightDials = DIALS.filter((d) => d.side === "right");

  return (
    <div className="np-spatial-root">
      {/* Topbar */}
      <header className="np-spatial-topbar">
        <button
          type="button"
          className="np-spatial-back"
          onClick={() => navigate("/")}
          aria-label="Voltar para Home"
        >
          <span className="np-spatial-back-arrow" aria-hidden="true">←</span>
          <span>Home</span>
        </button>
        <div className="np-spatial-topbar-mark">
          <Logo size={18} />
          <span className="np-spatial-topbar-label">np · spatial spec lab</span>
        </div>
        <div className="np-spatial-theme">
          <ThemeToggleInline />
        </div>
      </header>

      <main className="np-spatial-main">
        <header className="np-spatial-section-head">
          <h1 className="np-spatial-h1">Sintonize as 6 dimensões.</h1>
          <p className="np-spatial-h1-sub">
            Mexa os sliders pra moldar o tom. O texto curto guia o que construir.
          </p>
        </header>

        <div className="np-spatial-stage">
          <aside className="np-spatial-side np-spatial-side--left">
            {leftDials.map((d) => (
              <Dial key={d.id} spec={d} value={values[d.id]} onChange={(v) => setDial(d.id, v)} />
            ))}
          </aside>

          <section className="np-spatial-center">
            <textarea
              ref={textareaRef}
              className="np-spatial-textarea"
              placeholder="O que vamos criar? (uma frase já basta — os dials definem o tom)"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleTextareaKey}
              rows={6}
              spellCheck={false}
            />
            <div className="np-spatial-summary" aria-live="polite">
              {summaryText}
            </div>
          </section>

          <aside className="np-spatial-side np-spatial-side--right">
            {rightDials.map((d) => (
              <Dial key={d.id} spec={d} value={values[d.id]} onChange={(v) => setDial(d.id, v)} />
            ))}
          </aside>
        </div>

        <footer className="np-spatial-foot">
          <button type="button" className="np-spatial-reset" onClick={resetDials}>
            Reset dials
          </button>
          <span className="np-spatial-hint">⌘ + Enter para criar</span>
          <button
            type="button"
            className="np-spatial-begin"
            onClick={handleBegin}
            disabled={!canBegin}
            aria-label="Begin"
          >
            <span>Begin</span>
            <span className="np-spatial-begin-arrow" aria-hidden="true">→</span>
          </button>
        </footer>
      </main>

      {toast && (
        <div className="np-spatial-toast" role="status" aria-live="polite" key={toast.key}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────

function Dial({
  spec,
  value,
  onChange,
}: {
  spec: DialSpec;
  value: number;
  onChange: (v: number) => void;
}) {
  const desc = dialDescriptor(spec, value);
  return (
    <div className="np-spatial-dial">
      <div className="np-spatial-dial-head">
        <span className="np-spatial-dial-label">{spec.label}</span>
        <span className="np-spatial-dial-value">
          <span className="np-spatial-dial-value-num">{value}</span>
          <span className="np-spatial-dial-value-word">{desc.word}</span>
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="np-spatial-dial-range"
        aria-label={`${spec.label} slider`}
      />
      <div className="np-spatial-dial-poles">
        <span>{spec.polarLow}</span>
        <span>{spec.polarHigh}</span>
      </div>
    </div>
  );
}

function ThemeToggleInline() {
  const [isLight, setIsLight] = useState<boolean>(() => {
    if (typeof document === "undefined") return false;
    return document.documentElement.getAttribute("data-theme") === "light";
  });
  useEffect(() => {
    const el = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsLight(el.getAttribute("data-theme") === "light");
    });
    observer.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return (
    <button
      type="button"
      className="np-spatial-theme-toggle"
      onClick={() => {
        const next = isLight ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", next);
        setIsLight(next === "light");
      }}
      aria-label={`Alternar para ${isLight ? "dark" : "light"}`}
    >
      {isLight ? "dark" : "light"}
    </button>
  );
}

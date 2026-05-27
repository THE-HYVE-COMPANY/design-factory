// NewProjectMoodLab — paradigm C: mood board.
//
// Premise (user, 2026-05-04). Designers think visually, not lexically. This
// lab lets the user pick 1–5 mood cards from a 12-tile palette before
// typing the prompt. Selected cards become a chip-list above the textarea
// so the prompt can stay short ("hero pra workshop") while the visual tone
// is encoded in the selection.
//
// 12 cards each carry: gradient (df-tokens only), label, descriptor.
// Gradients are conjured from existing surface/accent tokens — no hex
// literals. Variety comes from gradient angle + stop opacities.
//
// Lab-only constraints: same as A — Begin logs payload + toast, no real
// project creation.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import "@/styles/np-c.css";

interface MoodCard {
  id: string;
  label: string;       // 2–3 word title
  descriptor: string;  // 1-line vibe
  gradient: string;    // CSS background composition (uses tokens only)
}

// 12 mood cards — distinct vibes. Gradient angles + stops vary; colors
// are always tokens (text-primary, accent-user, surface-elevated, etc).
// We avoid hardcoded hex values — even in placeholder visuals.
const MOOD_CARDS: MoodCard[] = [
  {
    id: "brutal-print",
    label: "Brutalist Print",
    descriptor: "Tipo gritante, grade rígida",
    gradient: "linear-gradient(135deg, var(--df-text-primary) 0%, var(--df-surface-elevated) 70%)",
  },
  {
    id: "editorial-soft",
    label: "Editorial Soft",
    descriptor: "Foto de detalhe, espaço amplo",
    gradient: "linear-gradient(180deg, var(--df-surface-elevated) 0%, var(--df-bg-section) 60%, var(--df-bg-base) 100%)",
  },
  {
    id: "tech-glow",
    label: "Tech Glow",
    descriptor: "Dark mode, accent radiante",
    gradient: "radial-gradient(circle at 30% 30%, var(--df-accent-user) 0%, transparent 55%), linear-gradient(180deg, var(--df-bg-sunken), var(--df-bg-section))",
  },
  {
    id: "newspaper",
    label: "Newspaper",
    descriptor: "Coluna estrita, serifa pesada",
    gradient: "repeating-linear-gradient(90deg, var(--df-bg-section) 0 24px, var(--df-bg-base) 24px 25px), linear-gradient(0deg, var(--df-bg-section), var(--df-bg-section))",
  },
  {
    id: "halftone",
    label: "Halftone",
    descriptor: "Pontilhado retro, contraste alto",
    gradient: "radial-gradient(circle at 1px 1px, var(--df-text-primary) 1px, transparent 1.6px), linear-gradient(135deg, var(--df-surface-elevated), var(--df-surface-raised))",
  },
  {
    id: "minimal-white",
    label: "Minimal White",
    descriptor: "Espaço primário, regra fina",
    gradient: "linear-gradient(0deg, var(--df-surface-elevated), var(--df-surface-elevated))",
  },
  {
    id: "tactile-warm",
    label: "Tactile Warm",
    descriptor: "Skeuomorfismo morno, sombra macia",
    gradient: "linear-gradient(160deg, var(--df-surface-raised) 0%, var(--df-bg-section) 50%, var(--df-surface-elevated) 100%)",
  },
  {
    id: "monochrome-stripe",
    label: "Monochrome Stripe",
    descriptor: "Faixas verticais, ruído leve",
    gradient: "repeating-linear-gradient(0deg, var(--df-text-primary) 0 2px, transparent 2px 8px), var(--df-bg-section)",
  },
  {
    id: "swiss-grid",
    label: "Swiss Grid",
    descriptor: "Modular, sans alto, tipo objetivo",
    gradient: "linear-gradient(90deg, var(--df-bg-section) 0 33%, var(--df-surface-raised) 33% 66%, var(--df-bg-section) 66%)",
  },
  {
    id: "poster-rough",
    label: "Poster Rough",
    descriptor: "Tipo grande, paleta saturada",
    gradient: "conic-gradient(from 200deg at 60% 40%, var(--df-accent-user), var(--df-text-primary), var(--df-surface-elevated), var(--df-accent-user))",
  },
  {
    id: "data-dense",
    label: "Data Dense",
    descriptor: "Grade táctica, números monoespaçados",
    gradient: "repeating-linear-gradient(0deg, transparent 0 12px, var(--df-border-subtle) 12px 13px), repeating-linear-gradient(90deg, transparent 0 12px, var(--df-border-subtle) 12px 13px), var(--df-bg-section)",
  },
  {
    id: "neon-deep",
    label: "Neon Deep",
    descriptor: "Fundo escuro, accent vibrante",
    gradient: "radial-gradient(ellipse at 50% 80%, var(--df-accent-user) 0%, transparent 50%), linear-gradient(180deg, var(--df-bg-sunken), var(--df-bg-base))",
  },
];

const MAX_PICKS = 5;
const LS_LAST_PAYLOAD = "df-np-mood-last-payload";

// ─────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────

export function NewProjectMoodLab() {
  const navigate = useNavigate();

  const [picks, setPicks] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [toast, setToast] = useState<{ msg: string; key: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const togglePick = useCallback((id: string) => {
    setPicks((curr) => {
      if (curr.includes(id)) {
        return curr.filter((x) => x !== id);
      }
      if (curr.length >= MAX_PICKS) {
        // At cap — replace the oldest pick. Better than blocking; user
        // can always click again to remove a specific one.
        return [...curr.slice(1), id];
      }
      return [...curr, id];
    });
  }, []);

  const removePick = useCallback((id: string) => {
    setPicks((curr) => curr.filter((x) => x !== id));
  }, []);

  // Auto-focus textarea once the user picks the first card.
  const previousCount = useRef(0);
  useEffect(() => {
    if (previousCount.current === 0 && picks.length === 1) {
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
    previousCount.current = picks.length;
  }, [picks]);

  const canBegin = picks.length > 0 && prompt.trim().length > 0;

  const handleBegin = useCallback(() => {
    if (!canBegin) return;
    const payload = {
      prompt: prompt.trim(),
      moodIds: picks,
      moodLabels: picks
        .map((id) => MOOD_CARDS.find((c) => c.id === id)?.label ?? id)
        .filter(Boolean),
      ts: Date.now(),
    };
    // eslint-disable-next-line no-console
    console.log("[np-mood] would create project with payload:", payload);
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(LS_LAST_PAYLOAD, JSON.stringify(payload));
      }
    } catch {
      /* lab — best-effort persistence only */
    }
    setToast({
      msg: `Would create project — ${payload.moodLabels.length} mood${payload.moodLabels.length === 1 ? "" : "s"} · "${payload.prompt.slice(0, 30)}${payload.prompt.length > 30 ? "…" : ""}"`,
      key: Date.now(),
    });
  }, [canBegin, prompt, picks]);

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

  const pickedCards = useMemo(
    () => picks.map((id) => MOOD_CARDS.find((c) => c.id === id)).filter(Boolean) as MoodCard[],
    [picks],
  );

  return (
    <div className="np-mood-root">
      {/* Topbar */}
      <header className="np-mood-topbar">
        <button
          type="button"
          className="np-mood-back"
          onClick={() => navigate("/")}
          aria-label="Voltar para Home"
        >
          <span className="np-mood-back-arrow" aria-hidden="true">←</span>
          <span>Home</span>
        </button>
        <div className="np-mood-topbar-mark">
          <Logo size={18} />
          <span className="np-mood-topbar-label">np · mood board lab</span>
        </div>
        <div className="np-mood-theme">
          <ThemeToggleInline />
        </div>
      </header>

      <main className="np-mood-main">
        {/* Section header */}
        <header className="np-mood-section-head">
          <h1 className="np-mood-h1">Escolha 1 a 5 referências de tom.</h1>
          <p className="np-mood-h1-sub">
            Não precisa explicar — clique nos que falam com o projeto. {picks.length} de {MAX_PICKS} selecionado{picks.length === 1 ? "" : "s"}.
          </p>
        </header>

        {/* Mood grid */}
        <section className="np-mood-grid" aria-label="Cards de mood">
          {MOOD_CARDS.map((card) => {
            const active = picks.includes(card.id);
            return (
              <button
                key={card.id}
                type="button"
                className={`np-mood-card${active ? " np-mood-card--active" : ""}`}
                onClick={() => togglePick(card.id)}
                aria-pressed={active}
              >
                <span
                  className="np-mood-card-thumb"
                  style={{ backgroundImage: card.gradient }}
                  aria-hidden="true"
                />
                {active && (
                  <span className="np-mood-card-check" aria-hidden="true">✓</span>
                )}
                <span className="np-mood-card-meta">
                  <span className="np-mood-card-label">{card.label}</span>
                  <span className="np-mood-card-descriptor">{card.descriptor}</span>
                </span>
              </button>
            );
          })}
        </section>

        {/* Prompt area — only after at least one pick */}
        {picks.length > 0 && (
          <section className="np-mood-prompt" aria-label="Prompt">
            <div className="np-mood-pickedrow">
              {pickedCards.map((c) => (
                <span key={c.id} className="np-mood-chip">
                  <span className="np-mood-chip-label">{c.label}</span>
                  <button
                    type="button"
                    className="np-mood-chip-x"
                    onClick={() => removePick(c.id)}
                    aria-label={`Remover ${c.label}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="np-mood-prompt-card">
              <textarea
                ref={textareaRef}
                className="np-mood-textarea"
                placeholder="O que vamos construir? (pode ser curto — o tom já está nos moods)"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleTextareaKey}
                rows={4}
                spellCheck={false}
              />
              <div className="np-mood-prompt-foot">
                <span className="np-mood-hint">⌘ + Enter para criar</span>
                <button
                  type="button"
                  className="np-mood-begin"
                  onClick={handleBegin}
                  disabled={!canBegin}
                  aria-label="Begin"
                >
                  <span>Begin</span>
                  <span className="np-mood-begin-arrow" aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          </section>
        )}

        {picks.length === 0 && (
          <p className="np-mood-empty">
            Comece selecionando ao menos um card acima.
          </p>
        )}
      </main>

      {toast && (
        <div className="np-mood-toast" role="status" aria-live="polite" key={toast.key}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────

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
      className="np-mood-theme-toggle"
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

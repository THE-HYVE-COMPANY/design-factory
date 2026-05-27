// NewProjectConvLab — paradigm B: conversational onboarding.
//
// Premise (user, 2026-05-04). Beginners freeze when faced with a blank
// prompt + 6 modifiers. This lab asks 3 narrow questions in sequence,
// each one chat-bubble style. Earlier answers become small pills in the
// header so the user still sees the whole spec accumulating.
//
// Sequence:
//   Q1. "O que você quer construir?"  → free text (textarea, 2 rows)
//   Q2. "Em que formato/tamanho?"     → 5 chips (Square/Landscape/Story/Web/Free)
//   Q3. "Refs visuais ou tom específico?" → free text (skip OK)
//
// Final state shows a summary card with all 3 answers and a Begin button.
// "Voltar" arrow (previous bubble) lets the user edit any earlier answer.
//
// Lab-only constraints (mirrors the A lab):
//   · Begin logs payload + shows toast; no real project creation.
//   · No global ToastProvider — local toast component (.np-conv-toast).
//   · Self-contained ThemeToggleInline (data-theme attr only).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import "@/styles/np-b.css";

type StepId = 0 | 1 | 2 | 3; // 3 = summary

type FormatChoice = "square" | "landscape" | "story" | "web" | "free";

interface FormatOption {
  id: FormatChoice;
  label: string;
  ratio: string;
}

const FORMATS: FormatOption[] = [
  { id: "square", label: "Quadrado", ratio: "1:1" },
  { id: "landscape", label: "Paisagem", ratio: "16:9" },
  { id: "story", label: "Story", ratio: "9:16" },
  { id: "web", label: "Web hero", ratio: "21:9" },
  { id: "free", label: "Free", ratio: "ratio livre" },
];

const QUESTIONS: { id: StepId; prompt: string; sub: string }[] = [
  {
    id: 0,
    prompt: "O que você quer construir?",
    sub: "Pode ser uma frase curta. Detalhamos depois.",
  },
  {
    id: 1,
    prompt: "Em que formato vai viver?",
    sub: "Escolha o que mais combina — pode trocar depois.",
  },
  {
    id: 2,
    prompt: "Refs visuais ou tom específico?",
    sub: "Opcional. Pode pular se não tem nada em mente.",
  },
];

const LS_LAST_PAYLOAD = "df-np-conv-last-payload";

// ─────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────

export function NewProjectConvLab() {
  const navigate = useNavigate();

  const [step, setStep] = useState<StepId>(0);
  const [a1, setA1] = useState(""); // what to build
  const [a2, setA2] = useState<FormatChoice | null>(null);
  const [a3, setA3] = useState(""); // tone/refs
  const [toast, setToast] = useState<{ msg: string; key: number } | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus the active textarea when the step changes.
  useEffect(() => {
    if (step === 0 || step === 2) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [step]);

  const canAdvance = useMemo(() => {
    if (step === 0) return a1.trim().length > 0;
    if (step === 1) return a2 !== null;
    if (step === 2) return true; // optional — skip allowed
    return false;
  }, [step, a1, a2]);

  const advance = useCallback(() => {
    if (!canAdvance) return;
    setStep((s) => (s < 3 ? ((s + 1) as StepId) : s));
  }, [canAdvance]);

  const goBackTo = useCallback((target: StepId) => {
    setStep(target);
  }, []);

  const handleTextareaKey = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Cmd+Enter / Ctrl+Enter advances. Plain Enter inserts newline.
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        advance();
      }
    },
    [advance],
  );

  const handleBegin = useCallback(() => {
    const payload = {
      build: a1.trim(),
      format: a2,
      tone: a3.trim() || null,
      ts: Date.now(),
    };
    // eslint-disable-next-line no-console
    console.log("[np-conv] would create project with payload:", payload);
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(LS_LAST_PAYLOAD, JSON.stringify(payload));
      }
    } catch {
      /* lab — best-effort persistence only */
    }
    const summary = [
      `build: ${payload.build.slice(0, 36)}${payload.build.length > 36 ? "…" : ""}`,
      payload.format && `format ${payload.format}`,
      payload.tone && "tone definido",
    ]
      .filter(Boolean)
      .join(" · ");
    setToast({ msg: `Would create project — ${summary}`, key: Date.now() });
  }, [a1, a2, a3]);

  // Auto-dismiss toast after 4s.
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const formatLabel = useMemo(() => {
    if (!a2) return null;
    const opt = FORMATS.find((f) => f.id === a2);
    return opt ? `${opt.label} (${opt.ratio})` : null;
  }, [a2]);

  // ── Header pills (accumulated answers) ─────────────────────────────────
  const headerPills: { key: string; label: string; value: string; target: StepId }[] = [];
  if (a1 && step >= 1) {
    headerPills.push({
      key: "a1",
      label: "construir",
      value: a1.length > 28 ? `${a1.slice(0, 28)}…` : a1,
      target: 0,
    });
  }
  if (a2 && step >= 2) {
    headerPills.push({
      key: "a2",
      label: "formato",
      value: formatLabel ?? a2,
      target: 1,
    });
  }
  if (a3 && step >= 3) {
    headerPills.push({
      key: "a3",
      label: "tom",
      value: a3.length > 28 ? `${a3.slice(0, 28)}…` : a3,
      target: 2,
    });
  }

  return (
    <div className="np-conv-root">
      {/* Topbar */}
      <header className="np-conv-topbar">
        <button
          type="button"
          className="np-conv-back"
          onClick={() => navigate("/")}
          aria-label="Voltar para Home"
        >
          <span className="np-conv-back-arrow" aria-hidden="true">←</span>
          <span>Home</span>
        </button>
        <div className="np-conv-topbar-mark">
          <Logo size={18} />
          <span className="np-conv-topbar-label">np · conversational lab</span>
        </div>
        <div className="np-conv-theme">
          <ThemeToggleInline />
        </div>
      </header>

      {/* Accumulated answers — pills */}
      {headerPills.length > 0 && (
        <div className="np-conv-pills" aria-label="Respostas anteriores">
          {headerPills.map((p) => (
            <button
              key={p.key}
              type="button"
              className="np-conv-pill"
              onClick={() => goBackTo(p.target)}
              title={`Editar — ${p.label}`}
            >
              <span className="np-conv-pill-label">{p.label}</span>
              <span className="np-conv-pill-sep">·</span>
              <span className="np-conv-pill-value">{p.value}</span>
            </button>
          ))}
        </div>
      )}

      <main className="np-conv-main">
        <div className="np-conv-thread">
          {/* Each Bubble shows once we reach its step. We render up to the
              current step so the conversation keeps on scrolling. Past
              answers stay editable via the header pills. */}
          {step >= 0 && (
            <Bubble
              role="ai"
              question={QUESTIONS[0].prompt}
              sub={QUESTIONS[0].sub}
              expanded={step === 0}
            >
              {step === 0 && (
                <div className="np-conv-input-block">
                  <textarea
                    ref={inputRef}
                    className="np-conv-textarea"
                    placeholder="ex: landing pra workshop sobre creative coding…"
                    value={a1}
                    onChange={(e) => setA1(e.target.value)}
                    onKeyDown={handleTextareaKey}
                    rows={2}
                  />
                  <div className="np-conv-input-foot">
                    <span className="np-conv-hint">⌘ + Enter para seguir</span>
                    <button
                      type="button"
                      className="np-conv-go"
                      onClick={advance}
                      disabled={!canAdvance}
                    >
                      Continuar
                    </button>
                  </div>
                </div>
              )}
            </Bubble>
          )}

          {step >= 1 && a1.trim().length > 0 && (
            <Bubble role="user" question={null} sub={null} expanded={false}>
              <p className="np-conv-bubble-text">{a1}</p>
            </Bubble>
          )}

          {step >= 1 && (
            <Bubble
              role="ai"
              question={QUESTIONS[1].prompt}
              sub={QUESTIONS[1].sub}
              expanded={step === 1}
            >
              {step === 1 && (
                <div className="np-conv-input-block">
                  <div className="np-conv-formats">
                    {FORMATS.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        className={`np-conv-format${a2 === f.id ? " np-conv-format--active" : ""}`}
                        onClick={() => setA2(f.id)}
                      >
                        <span className="np-conv-format-label">{f.label}</span>
                        <span className="np-conv-format-ratio">{f.ratio}</span>
                      </button>
                    ))}
                  </div>
                  <div className="np-conv-input-foot">
                    <span className="np-conv-hint">Escolha 1 e siga</span>
                    <button
                      type="button"
                      className="np-conv-go"
                      onClick={advance}
                      disabled={!canAdvance}
                    >
                      Continuar
                    </button>
                  </div>
                </div>
              )}
            </Bubble>
          )}

          {step >= 2 && a2 && (
            <Bubble role="user" question={null} sub={null} expanded={false}>
              <p className="np-conv-bubble-text">{formatLabel}</p>
            </Bubble>
          )}

          {step >= 2 && (
            <Bubble
              role="ai"
              question={QUESTIONS[2].prompt}
              sub={QUESTIONS[2].sub}
              expanded={step === 2}
            >
              {step === 2 && (
                <div className="np-conv-input-block">
                  <textarea
                    ref={inputRef}
                    className="np-conv-textarea"
                    placeholder="ex: editorial sereno, paleta morna, fotos de detalhe…"
                    value={a3}
                    onChange={(e) => setA3(e.target.value)}
                    onKeyDown={handleTextareaKey}
                    rows={2}
                  />
                  <div className="np-conv-input-foot">
                    <span className="np-conv-hint">⌘ + Enter ou pule</span>
                    <div className="np-conv-foot-actions">
                      <button
                        type="button"
                        className="np-conv-skip"
                        onClick={() => {
                          setA3("");
                          advance();
                        }}
                      >
                        Pular
                      </button>
                      <button
                        type="button"
                        className="np-conv-go"
                        onClick={advance}
                      >
                        Continuar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </Bubble>
          )}

          {step === 3 && a3 && (
            <Bubble role="user" question={null} sub={null} expanded={false}>
              <p className="np-conv-bubble-text">{a3}</p>
            </Bubble>
          )}

          {step === 3 && !a3 && (
            <Bubble role="user" question={null} sub={null} expanded={false}>
              <p className="np-conv-bubble-text np-conv-bubble-text--muted">
                Sem refs por enquanto.
              </p>
            </Bubble>
          )}

          {/* Summary card on final step. */}
          {step === 3 && (
            <section className="np-conv-summary" aria-label="Resumo do projeto">
              <header className="np-conv-summary-header">
                <span className="np-conv-summary-icon" aria-hidden="true">→</span>
                <span>Pronto pra começar</span>
              </header>
              <dl className="np-conv-summary-grid">
                <div>
                  <dt>construir</dt>
                  <dd>{a1}</dd>
                </div>
                <div>
                  <dt>formato</dt>
                  <dd>{formatLabel}</dd>
                </div>
                <div>
                  <dt>tom</dt>
                  <dd>{a3 || <span className="np-conv-summary-empty">livre</span>}</dd>
                </div>
              </dl>
              <div className="np-conv-summary-actions">
                <button
                  type="button"
                  className="np-conv-edit"
                  onClick={() => goBackTo(0)}
                >
                  Editar do início
                </button>
                <button
                  type="button"
                  className="np-conv-begin"
                  onClick={handleBegin}
                  aria-label="Begin"
                >
                  <span>Begin</span>
                  <span className="np-conv-begin-arrow" aria-hidden="true">→</span>
                </button>
              </div>
            </section>
          )}
        </div>
      </main>

      {toast && (
        <div className="np-conv-toast" role="status" aria-live="polite" key={toast.key}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────

function Bubble({
  role,
  question,
  sub,
  expanded,
  children,
}: {
  role: "ai" | "user";
  question: string | null;
  sub: string | null;
  expanded: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`np-conv-bubble np-conv-bubble--${role}${expanded ? " np-conv-bubble--expanded" : ""}`}>
      {role === "ai" && (
        <div className="np-conv-bubble-avatar" aria-hidden="true">
          <span />
        </div>
      )}
      <div className="np-conv-bubble-content">
        {question && <div className="np-conv-bubble-question">{question}</div>}
        {sub && <div className="np-conv-bubble-sub">{sub}</div>}
        {children}
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
      className="np-conv-theme-toggle"
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

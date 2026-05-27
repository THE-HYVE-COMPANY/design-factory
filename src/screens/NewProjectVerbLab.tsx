// NewProjectVerbLab — paradigm D: verb-led wizard.
//
// Premise: users with a checklist think in verbs — "fazer um branding",
// "criar uma landing", "validar um fluxo". This lab surfaces 5 explicit
// verbs as cards; picking one swaps to a verb-specific guided form.
// Each verb has 2–3 fields tailored to its domain (e.g. landing asks
// which sections; branding asks logo type + color).
//
// Two screens:
//   Screen 1 (verb picker) — 5 large cards, 2x3 grid (3rd row centered)
//   Screen 2 (form) — fields specific to the verb + Back to verb picker
//
// Lab-only constraints: same as A — Begin logs payload + toast.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import "@/styles/np-d.css";

type VerbId = "branding" | "landing" | "prototype" | "exploration" | "free";

interface VerbCard {
  id: VerbId;
  label: string;
  hint: string;
  example: string;
}

const VERBS: VerbCard[] = [
  {
    id: "branding",
    label: "Branding",
    hint: "Identidade, logo, paleta, sistema visual",
    example: "ex: identidade pra estúdio de cinema independente",
  },
  {
    id: "landing",
    label: "Landing",
    hint: "Página única para conversão ou apresentação",
    example: "ex: landing pra workshop de creative coding",
  },
  {
    id: "prototype",
    label: "Prototype",
    hint: "Fluxo de telas para validar uma ideia",
    example: "ex: onboarding de app de leitura compartilhada",
  },
  {
    id: "exploration",
    label: "Exploration",
    hint: "Variações abertas em cima de um conceito",
    example: "ex: 5 takes pra cover do livro novo",
  },
  {
    id: "free",
    label: "Free Start",
    hint: "Sem template — só o prompt aberto",
    example: "Use quando nada acima encaixa",
  },
];

// ── Per-verb form state ─────────────────────────────────────────────────

interface BrandingForm {
  logoType: "wordmark" | "lettermark" | "symbol" | "combo" | null;
  primaryColor: string;
  vibe: "bold" | "soft" | "tech" | null;
}

interface LandingForm {
  sections: Set<"hero" | "features" | "pricing" | "cta" | "footer" | "social">;
  ctaCopy: string;
  audience: string;
}

interface PrototypeForm {
  flow: "onboarding" | "checkout" | "dashboard" | "auth" | null;
  format: "mobile" | "desktop" | "tablet" | null;
  screens: number;
}

interface ExplorationForm {
  topic: string;
  variations: number;
  constraints: string;
}

interface FreeForm {
  prompt: string;
}

const LS_LAST_PAYLOAD = "df-np-verb-last-payload";

// ─────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────

export function NewProjectVerbLab() {
  const navigate = useNavigate();
  const [verb, setVerb] = useState<VerbId | null>(null);

  const [branding, setBranding] = useState<BrandingForm>({ logoType: null, primaryColor: "", vibe: null });
  const [landing, setLanding] = useState<LandingForm>({ sections: new Set(["hero", "cta"]), ctaCopy: "", audience: "" });
  const [prototype, setPrototype] = useState<PrototypeForm>({ flow: null, format: null, screens: 4 });
  const [exploration, setExploration] = useState<ExplorationForm>({ topic: "", variations: 4, constraints: "" });
  const [free, setFree] = useState<FreeForm>({ prompt: "" });

  const [toast, setToast] = useState<{ msg: string; key: number } | null>(null);

  const canBegin = useMemo(() => {
    if (!verb) return false;
    if (verb === "branding") return branding.logoType !== null && branding.vibe !== null;
    if (verb === "landing") return landing.sections.size > 0 && landing.ctaCopy.trim().length > 0;
    if (verb === "prototype") return prototype.flow !== null && prototype.format !== null;
    if (verb === "exploration") return exploration.topic.trim().length > 0;
    if (verb === "free") return free.prompt.trim().length > 0;
    return false;
  }, [verb, branding, landing, prototype, exploration, free]);

  const handleBegin = useCallback(() => {
    if (!verb || !canBegin) return;
    const formPayload =
      verb === "branding" ? branding :
      verb === "landing" ? { ...landing, sections: Array.from(landing.sections) } :
      verb === "prototype" ? prototype :
      verb === "exploration" ? exploration :
      free;
    const payload = { verb, form: formPayload, ts: Date.now() };
    // eslint-disable-next-line no-console
    console.log("[np-verb] would create project with payload:", payload);
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(LS_LAST_PAYLOAD, JSON.stringify(payload));
      }
    } catch {
      /* lab — best-effort persistence only */
    }
    setToast({ msg: `Would create project — verb ${verb}`, key: Date.now() });
  }, [verb, canBegin, branding, landing, prototype, exploration, free]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  return (
    <div className="np-verb-root">
      {/* Topbar */}
      <header className="np-verb-topbar">
        <button
          type="button"
          className="np-verb-back"
          onClick={() => navigate("/")}
          aria-label="Voltar para Home"
        >
          <span className="np-verb-back-arrow" aria-hidden="true">←</span>
          <span>Home</span>
        </button>
        <div className="np-verb-topbar-mark">
          <Logo size={18} />
          <span className="np-verb-topbar-label">np · verb-led lab</span>
        </div>
        <div className="np-verb-theme">
          <ThemeToggleInline />
        </div>
      </header>

      <main className="np-verb-main">
        {/* Screen 1: verb picker */}
        {!verb && (
          <section className="np-verb-pickstage" aria-label="Escolher verbo">
            <header className="np-verb-section-head">
              <h1 className="np-verb-h1">Por onde vamos começar?</h1>
              <p className="np-verb-h1-sub">Escolha o tipo de coisa que está construindo. Cada caminho pergunta o que importa.</p>
            </header>
            <div className="np-verb-grid">
              {VERBS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={`np-verb-card${v.id === "free" ? " np-verb-card--free" : ""}`}
                  onClick={() => setVerb(v.id)}
                >
                  <span className="np-verb-card-label">{v.label}</span>
                  <span className="np-verb-card-hint">{v.hint}</span>
                  <span className="np-verb-card-example">{v.example}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Screen 2: verb-specific form */}
        {verb && (
          <section className="np-verb-formstage" aria-label={`Formulário ${verb}`}>
            <header className="np-verb-formhead">
              <button type="button" className="np-verb-swap" onClick={() => setVerb(null)}>
                <span aria-hidden="true">←</span>
                <span>Trocar verbo</span>
              </button>
              <div className="np-verb-formtitle">
                <span className="np-verb-formtitle-eyebrow">verbo</span>
                <h2 className="np-verb-formtitle-h2">{VERBS.find((v) => v.id === verb)?.label}</h2>
              </div>
            </header>

            <div className="np-verb-form">
              {verb === "branding" && (
                <>
                  <Field label="Tipo de logo">
                    <ChipRow
                      options={[
                        { id: "wordmark", label: "Wordmark" },
                        { id: "lettermark", label: "Lettermark" },
                        { id: "symbol", label: "Símbolo" },
                        { id: "combo", label: "Combo" },
                      ]}
                      value={branding.logoType}
                      onPick={(v) => setBranding({ ...branding, logoType: v as BrandingForm["logoType"] })}
                    />
                  </Field>
                  <Field label="Cor primária (free text — ex: ocre quente, verde musgo)">
                    <input
                      type="text"
                      className="np-verb-input"
                      placeholder="ex: verde musgo escuro"
                      value={branding.primaryColor}
                      onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                    />
                  </Field>
                  <Field label="Vibe">
                    <ChipRow
                      options={[
                        { id: "bold", label: "Bold · grita" },
                        { id: "soft", label: "Soft · convida" },
                        { id: "tech", label: "Tech · preciso" },
                      ]}
                      value={branding.vibe}
                      onPick={(v) => setBranding({ ...branding, vibe: v as BrandingForm["vibe"] })}
                    />
                  </Field>
                </>
              )}

              {verb === "landing" && (
                <>
                  <Field label="Sections que entram">
                    <ChipMultiRow
                      options={[
                        { id: "hero", label: "Hero" },
                        { id: "features", label: "Features" },
                        { id: "pricing", label: "Pricing" },
                        { id: "cta", label: "CTA" },
                        { id: "footer", label: "Footer" },
                        { id: "social", label: "Social proof" },
                      ]}
                      value={landing.sections}
                      onToggle={(id) => {
                        const next = new Set(landing.sections);
                        if (next.has(id as never)) next.delete(id as never);
                        else next.add(id as never);
                        setLanding({ ...landing, sections: next as LandingForm["sections"] });
                      }}
                    />
                  </Field>
                  <Field label="CTA copy (uma frase)">
                    <input
                      type="text"
                      className="np-verb-input"
                      placeholder="ex: Reservar minha vaga"
                      value={landing.ctaCopy}
                      onChange={(e) => setLanding({ ...landing, ctaCopy: e.target.value })}
                    />
                  </Field>
                  <Field label="Quem é o público (opcional)">
                    <input
                      type="text"
                      className="np-verb-input"
                      placeholder="ex: designers brasileiros entre 25-40"
                      value={landing.audience}
                      onChange={(e) => setLanding({ ...landing, audience: e.target.value })}
                    />
                  </Field>
                </>
              )}

              {verb === "prototype" && (
                <>
                  <Field label="Tipo de fluxo">
                    <ChipRow
                      options={[
                        { id: "onboarding", label: "Onboarding" },
                        { id: "checkout", label: "Checkout" },
                        { id: "dashboard", label: "Dashboard" },
                        { id: "auth", label: "Auth" },
                      ]}
                      value={prototype.flow}
                      onPick={(v) => setPrototype({ ...prototype, flow: v as PrototypeForm["flow"] })}
                    />
                  </Field>
                  <Field label="Formato">
                    <ChipRow
                      options={[
                        { id: "mobile", label: "Mobile" },
                        { id: "desktop", label: "Desktop" },
                        { id: "tablet", label: "Tablet" },
                      ]}
                      value={prototype.format}
                      onPick={(v) => setPrototype({ ...prototype, format: v as PrototypeForm["format"] })}
                    />
                  </Field>
                  <Field label={`Quantas telas (${prototype.screens})`}>
                    <input
                      type="range"
                      min={2}
                      max={12}
                      step={1}
                      value={prototype.screens}
                      className="np-verb-range"
                      onChange={(e) => setPrototype({ ...prototype, screens: Number(e.target.value) })}
                    />
                  </Field>
                </>
              )}

              {verb === "exploration" && (
                <>
                  <Field label="Tópico — o que vamos explorar">
                    <input
                      type="text"
                      className="np-verb-input"
                      placeholder="ex: cover do livro 'cidade silenciosa'"
                      value={exploration.topic}
                      onChange={(e) => setExploration({ ...exploration, topic: e.target.value })}
                    />
                  </Field>
                  <Field label={`Quantas variações (${exploration.variations})`}>
                    <input
                      type="range"
                      min={2}
                      max={12}
                      step={1}
                      value={exploration.variations}
                      className="np-verb-range"
                      onChange={(e) => setExploration({ ...exploration, variations: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label="Constraints (opcional — paleta, tipografia, formato)">
                    <textarea
                      className="np-verb-textarea"
                      placeholder="ex: sempre paleta ocre/verde, serifa pesada, 1:1"
                      value={exploration.constraints}
                      onChange={(e) => setExploration({ ...exploration, constraints: e.target.value })}
                      rows={3}
                    />
                  </Field>
                </>
              )}

              {verb === "free" && (
                <Field label="Prompt aberto">
                  <textarea
                    className="np-verb-textarea"
                    placeholder="O que vamos criar?"
                    value={free.prompt}
                    onChange={(e) => setFree({ prompt: e.target.value })}
                    rows={6}
                  />
                </Field>
              )}

              <div className="np-verb-formfoot">
                <button
                  type="button"
                  className="np-verb-begin"
                  onClick={handleBegin}
                  disabled={!canBegin}
                  aria-label="Begin"
                >
                  <span>Begin</span>
                  <span className="np-verb-begin-arrow" aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          </section>
        )}
      </main>

      {toast && (
        <div className="np-verb-toast" role="status" aria-live="polite" key={toast.key}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="np-verb-field">
      <div className="np-verb-field-label">{label}</div>
      {children}
    </div>
  );
}

function ChipRow<V extends string>({
  options,
  value,
  onPick,
}: {
  options: { id: V; label: string }[];
  value: V | null;
  onPick: (id: V) => void;
}) {
  return (
    <div className="np-verb-chiprow">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={`np-verb-chip${value === o.id ? " np-verb-chip--active" : ""}`}
          onClick={() => onPick(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ChipMultiRow<V extends string>({
  options,
  value,
  onToggle,
}: {
  options: { id: V; label: string }[];
  value: Set<V>;
  onToggle: (id: V) => void;
}) {
  return (
    <div className="np-verb-chiprow">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={`np-verb-chip${value.has(o.id) ? " np-verb-chip--active" : ""}`}
          onClick={() => onToggle(o.id)}
        >
          {o.label}
        </button>
      ))}
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
      className="np-verb-theme-toggle"
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

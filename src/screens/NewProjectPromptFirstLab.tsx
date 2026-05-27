// NewProjectPromptFirstLab — UX lab for the prompt-first New Project flow.
//
// Premise (user, 2026-05-04). The current canonical create flow forces
// Format + Direction selection BEFORE the user can type — which traps
// rich briefings like "grid 3x3 with 9 SVG animations of machines for a
// brand identity" because the user wants animations + brand + multi-
// asset + anti-slop strict, but the modal only lets them pick one
// format. Result: user either abandons the modal or settles for a
// suboptimal pick.
//
// Solution being prototyped here: prompt is the ONLY required field;
// every modifier (format, direction, DS, anti-slop, refs, verb) is
// optional and discovered from the prompt via a debounced "intent
// autosuggest" (see ../runtime/intent-detection.ts). User can still
// edit any modifier manually.
//
// Lab-only constraints:
//   · Route /np-prompt-first — does not touch / /lab /lab-regions /regions.
//   · DS list, refs upload, model fetch are MOCKED — focus is UX validation,
//     not wiring. The Begin button logs payload + shows an in-screen toast
//     instead of creating a real project.
//   · No ToastProvider exists at app root; we ship a tiny in-screen toast
//     (df-pf-toast) so the lab is self-contained.
//
// If approved, the next step is to extract the modifier model + intent
// hook into shared modules, kill the canonical Format+Direction modal,
// and lift this screen into HomeScreen with real wiring.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { detectIntent, intentTagLabel, type IntentResult } from "@/runtime/intent-detection";
import "@/styles/np-prompt-first.css";

// ─────────────────────────────────────────────────────────────────────────
// Types + constants
// ─────────────────────────────────────────────────────────────────────────

type QuickStartId = "branding" | "landing" | "prototype" | "exploration" | "free";
type ModifierId = "format" | "direction" | "ds" | "antislop" | "refs" | "verb";
type AntiSlopValue = "strict" | "loose";
type VerbValue = "create" | "refine" | "vary" | "explain";
type FormatValue = "1:1" | "16:9" | "9:16" | "4:5" | "custom";
type DsValue = "brand" | "minimal" | "none";

interface QuickStart {
  id: QuickStartId;
  label: string;
  placeholder: string;
  // Modifiers to pre-activate when the chip is clicked. Free start clears
  // all modifiers and uses an empty placeholder.
  preset: {
    antiSlop?: AntiSlopValue;
    ds?: DsValue;
    format?: FormatValue;
    verb?: VerbValue;
  };
}

const QUICK_STARTS: QuickStart[] = [
  {
    id: "branding",
    label: "Branding",
    placeholder: "Que peça? Animação de logo, ícone, header de email…",
    preset: { antiSlop: "strict", ds: "brand" },
  },
  {
    id: "landing",
    label: "Landing",
    placeholder: "Hero + sections para…",
    preset: { format: "16:9", verb: "create" },
  },
  {
    id: "prototype",
    label: "Prototype",
    placeholder: "Fluxo + telas para validar…",
    preset: { verb: "create" },
  },
  {
    id: "exploration",
    label: "Exploration",
    placeholder: "Quero explorar variações de…",
    preset: { verb: "vary" },
  },
  {
    id: "free",
    label: "Free start",
    placeholder: "O que vamos criar?",
    preset: {},
  },
];

const FORMAT_OPTIONS: { id: FormatValue; label: string; sub: string }[] = [
  { id: "1:1", label: "1:1", sub: "square" },
  { id: "16:9", label: "16:9", sub: "wide" },
  { id: "9:16", label: "9:16", sub: "vertical" },
  { id: "4:5", label: "4:5", sub: "portrait" },
  { id: "custom", label: "custom", sub: "ratio livre" },
];

const DIRECTION_PRESETS = ["editorial", "brutal", "soft minimal"];

const DS_OPTIONS: { id: DsValue; label: string }[] = [
  { id: "brand", label: "brand" },
  { id: "minimal", label: "minimal" },
  { id: "none", label: "no DS" },
];

const VERB_OPTIONS: { id: VerbValue; label: string }[] = [
  { id: "create", label: "create" },
  { id: "refine", label: "refine" },
  { id: "vary", label: "vary" },
  { id: "explain", label: "explain" },
];

// Mocked provider/model lists. Lab focuses on UX — real model probing
// happens in production via useLiveModelOptions; out of scope here.
const PROVIDERS: { id: string; label: string }[] = [
  { id: "claude", label: "Claude" },
  { id: "codex", label: "Codex" },
  { id: "gemini", label: "Gemini" },
];

const MODELS_BY_PROVIDER: Record<string, { id: string; label: string }[]> = {
  claude: [
    { id: "opus-4-7", label: "opus 4.7" },
    { id: "sonnet-4-6", label: "sonnet 4.6" },
  ],
  codex: [
    { id: "gpt-5", label: "gpt-5" },
    { id: "gpt-4.1", label: "gpt-4.1" },
  ],
  gemini: [
    { id: "gemini-2.5-pro", label: "gemini 2.5 pro" },
    { id: "gemini-2.5-flash", label: "gemini 2.5 flash" },
  ],
};

interface ModifierState {
  format: FormatValue | null;
  direction: string | null;
  ds: DsValue | null;
  antiSlop: AntiSlopValue | null;
  refs: string[]; // mocked file names
  verb: VerbValue | null;
}

const EMPTY_MODIFIERS: ModifierState = {
  format: null,
  direction: null,
  ds: null,
  antiSlop: null,
  refs: [],
  verb: null,
};

const LS_LAST_PAYLOAD = "df-np-prompt-first-last-payload";
const SUGGEST_DEBOUNCE_MS = 600;

// ─────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────

export function NewProjectPromptFirstLab() {
  const navigate = useNavigate();

  const [quickStart, setQuickStart] = useState<QuickStartId | null>(null);
  const [prompt, setPrompt] = useState("");
  const [modifiers, setModifiers] = useState<ModifierState>(EMPTY_MODIFIERS);
  const [expandedModifier, setExpandedModifier] = useState<ModifierId | null>(null);

  const [provider, setProvider] = useState<string>("claude");
  const [model, setModel] = useState<string>("opus-4-7");
  const [providerOpen, setProviderOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);

  const [intent, setIntent] = useState<IntentResult>({ tags: [], suggestion: {}, summary: "" });
  const [intentDismissed, setIntentDismissed] = useState(false);
  const [toast, setToast] = useState<{ msg: string; key: number } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestTimer = useRef<number | null>(null);

  const placeholder = useMemo(() => {
    if (quickStart) return QUICK_STARTS.find((q) => q.id === quickStart)?.placeholder ?? "";
    return "O que vamos criar?";
  }, [quickStart]);

  // ── Quick start ──────────────────────────────────────────────────────
  const handleQuickStart = useCallback((id: QuickStartId) => {
    const q = QUICK_STARTS.find((x) => x.id === id);
    if (!q) return;
    setQuickStart(id);
    if (id === "free") {
      setModifiers(EMPTY_MODIFIERS);
    } else {
      setModifiers({
        ...EMPTY_MODIFIERS,
        antiSlop: q.preset.antiSlop ?? null,
        ds: q.preset.ds ?? null,
        format: q.preset.format ?? null,
        verb: q.preset.verb ?? null,
      });
    }
    // Focus the textarea so the user can type immediately.
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  // ── Intent autosuggest with debounce ────────────────────────────────
  useEffect(() => {
    if (suggestTimer.current !== null) {
      window.clearTimeout(suggestTimer.current);
      suggestTimer.current = null;
    }
    if (prompt.trim().length === 0) {
      setIntent({ tags: [], suggestion: {}, summary: "" });
      setIntentDismissed(false);
      return;
    }
    suggestTimer.current = window.setTimeout(() => {
      setIntent(detectIntent(prompt));
      setIntentDismissed(false);
    }, SUGGEST_DEBOUNCE_MS);
    return () => {
      if (suggestTimer.current !== null) {
        window.clearTimeout(suggestTimer.current);
        suggestTimer.current = null;
      }
    };
  }, [prompt]);

  // ── Modifier handlers ───────────────────────────────────────────────
  const setMod = useCallback(<K extends keyof ModifierState>(key: K, value: ModifierState[K]) => {
    setModifiers((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearMod = useCallback((key: keyof ModifierState) => {
    setModifiers((prev) => ({
      ...prev,
      [key]: key === "refs" ? [] : null,
    }));
  }, []);

  const toggleExpand = useCallback((id: ModifierId) => {
    setExpandedModifier((curr) => (curr === id ? null : id));
  }, []);

  // ── Intent suggestion actions ───────────────────────────────────────
  const applyIntent = useCallback(() => {
    setModifiers((prev) => ({
      ...prev,
      format: intent.suggestion.format ? (intent.suggestion.format as FormatValue) : prev.format,
      ds: intent.suggestion.ds ? (intent.suggestion.ds as DsValue) : prev.ds,
      antiSlop: intent.suggestion.antiSlop ?? prev.antiSlop,
      verb: intent.suggestion.verb ?? prev.verb,
      direction: intent.suggestion.direction ?? prev.direction,
    }));
    setIntentDismissed(true);
  }, [intent]);

  const customizeIntent = useCallback(() => {
    // Apply suggestion AND open the first relevant modifier in edit mode
    // so user can override values without re-discovering them.
    applyIntent();
    if (intent.suggestion.format) setExpandedModifier("format");
    else if (intent.suggestion.ds) setExpandedModifier("ds");
    else if (intent.suggestion.antiSlop) setExpandedModifier("antislop");
    else if (intent.suggestion.direction) setExpandedModifier("direction");
  }, [applyIntent, intent.suggestion]);

  const ignoreIntent = useCallback(() => {
    setIntentDismissed(true);
  }, []);

  // ── Begin (logs + toast; no real navigation in lab) ─────────────────
  const canBegin = prompt.trim().length > 0;

  const handleBegin = useCallback(() => {
    if (!canBegin) return;
    const payload = {
      prompt: prompt.trim(),
      modifiers,
      provider,
      model,
      intent: { tags: intent.tags, suggestion: intent.suggestion },
      quickStart,
      ts: Date.now(),
    };
    // eslint-disable-next-line no-console
    console.log("[np-prompt-first] would create project with payload:", payload);
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(LS_LAST_PAYLOAD, JSON.stringify(payload));
      }
    } catch {
      /* lab — best-effort persistence only */
    }
    const summary = [
      `prompt: ${payload.prompt.slice(0, 40)}${payload.prompt.length > 40 ? "…" : ""}`,
      modifiers.format && `format ${modifiers.format}`,
      modifiers.ds && `DS ${modifiers.ds}`,
      modifiers.antiSlop && `anti-slop ${modifiers.antiSlop}`,
      modifiers.verb && modifiers.verb,
    ].filter(Boolean).join(" · ");
    setToast({ msg: `Would create project — ${summary}`, key: Date.now() });
  }, [canBegin, prompt, modifiers, provider, model, intent, quickStart]);

  // Auto-dismiss toast after 4s.
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Cmd+Enter / Ctrl+Enter sends.
  const handleTextareaKey = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleBegin();
    }
  }, [handleBegin]);

  // ── Render ──────────────────────────────────────────────────────────
  const showSuggestionCard = intent.tags.length > 0 && !intentDismissed;

  return (
    <div className="np-pf-root">
      {/* Topbar */}
      <header className="np-pf-topbar">
        <button
          type="button"
          className="np-pf-back"
          onClick={() => navigate("/")}
          aria-label="Voltar para Home"
        >
          <span className="np-pf-back-arrow" aria-hidden="true">←</span>
          <span>Home</span>
        </button>
        <div className="np-pf-topbar-mark">
          <Logo size={18} />
          <span className="np-pf-topbar-label">np · prompt-first lab</span>
        </div>
        <div className="np-pf-theme">
          {/* ThemeToggle is owned by the app shell normally; here we mount
              it inline so the lab works as a standalone preview. */}
          <ThemeToggleInline />
        </div>
      </header>

      <main className="np-pf-main">
        {/* Quick start chips */}
        <section className="np-pf-quickstart" aria-label="Quick start">
          <div className="np-pf-quickstart-label">Quick start</div>
          <div className="np-pf-quickstart-row">
            {QUICK_STARTS.map((q) => (
              <button
                key={q.id}
                type="button"
                className={`np-pf-pill${quickStart === q.id ? " np-pf-pill--active" : ""}`}
                onClick={() => handleQuickStart(q.id)}
                aria-pressed={quickStart === q.id}
              >
                {q.label}
              </button>
            ))}
          </div>
        </section>

        {/* Textarea card */}
        <section className="np-pf-prompt-card" aria-label="Prompt">
          <textarea
            ref={textareaRef}
            className="np-pf-textarea"
            placeholder={placeholder}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleTextareaKey}
            rows={6}
            spellCheck={false}
          />
          <div className="np-pf-prompt-footer">
            <span className="np-pf-hint">⌘ + Enter para enviar</span>
            <span className="np-pf-count">{prompt.length} chars</span>
          </div>
        </section>

        {/* Modifier chips */}
        <section className="np-pf-modifiers" aria-label="Modificadores">
          <div className="np-pf-modifiers-label">Modificadores (opcional)</div>
          <div className="np-pf-modifiers-row">
            <ModifierChip
              id="format"
              label="Format"
              activeLabel={modifiers.format}
              expanded={expandedModifier === "format"}
              onToggle={() => toggleExpand("format")}
              onClear={() => clearMod("format")}
            >
              <FormatExpand value={modifiers.format} onPick={(v) => { setMod("format", v); setExpandedModifier(null); }} />
            </ModifierChip>

            <ModifierChip
              id="direction"
              label="Direction"
              activeLabel={modifiers.direction}
              expanded={expandedModifier === "direction"}
              onToggle={() => toggleExpand("direction")}
              onClear={() => clearMod("direction")}
            >
              <DirectionExpand value={modifiers.direction} onChange={(v) => setMod("direction", v)} onDone={() => setExpandedModifier(null)} />
            </ModifierChip>

            <ModifierChip
              id="ds"
              label="DS"
              activeLabel={modifiers.ds}
              expanded={expandedModifier === "ds"}
              onToggle={() => toggleExpand("ds")}
              onClear={() => clearMod("ds")}
            >
              <DsExpand value={modifiers.ds} onPick={(v) => { setMod("ds", v); setExpandedModifier(null); }} />
            </ModifierChip>

            <ModifierChip
              id="antislop"
              label="Anti-slop"
              activeLabel={modifiers.antiSlop}
              expanded={expandedModifier === "antislop"}
              onToggle={() => toggleExpand("antislop")}
              onClear={() => clearMod("antiSlop")}
            >
              <AntiSlopExpand value={modifiers.antiSlop} onPick={(v) => { setMod("antiSlop", v); setExpandedModifier(null); }} />
            </ModifierChip>

            <ModifierChip
              id="refs"
              label="Refs"
              activeLabel={modifiers.refs.length > 0 ? `${modifiers.refs.length} file${modifiers.refs.length === 1 ? "" : "s"}` : null}
              expanded={expandedModifier === "refs"}
              onToggle={() => toggleExpand("refs")}
              onClear={() => clearMod("refs")}
            >
              <RefsExpand
                value={modifiers.refs}
                onAdd={(name) => setMod("refs", [...modifiers.refs, name])}
                onDone={() => setExpandedModifier(null)}
              />
            </ModifierChip>

            <ModifierChip
              id="verb"
              label="Verb"
              activeLabel={modifiers.verb}
              expanded={expandedModifier === "verb"}
              onToggle={() => toggleExpand("verb")}
              onClear={() => clearMod("verb")}
            >
              <VerbExpand value={modifiers.verb} onPick={(v) => { setMod("verb", v); setExpandedModifier(null); }} />
            </ModifierChip>
          </div>
        </section>

        {/* Intent suggestion card */}
        {showSuggestionCard && (
          <section className="np-pf-suggest" aria-label="Sugestão de intent">
            <div className="np-pf-suggest-row">
              <span className="np-pf-suggest-icon" aria-hidden="true">→</span>
              <div className="np-pf-suggest-text">
                <div className="np-pf-suggest-summary">{intent.summary}</div>
                <div className="np-pf-suggest-tags">
                  {intent.tags.map((t) => (
                    <span key={t} className="np-pf-suggest-tag">{intentTagLabel(t)}</span>
                  ))}
                </div>
                <div className="np-pf-suggest-recos">
                  {renderRecoList(intent)}
                </div>
              </div>
            </div>
            <div className="np-pf-suggest-actions">
              <button type="button" className="np-pf-suggest-btn np-pf-suggest-btn--primary" onClick={applyIntent}>Aplicar</button>
              <button type="button" className="np-pf-suggest-btn" onClick={customizeIntent}>Custom</button>
              <button type="button" className="np-pf-suggest-btn np-pf-suggest-btn--ghost" onClick={ignoreIntent}>Ignorar</button>
            </div>
          </section>
        )}

        {/* Provider + model + Begin */}
        <section className="np-pf-runtime" aria-label="Runtime">
          <div className="np-pf-runtime-pickers">
            <PickerPill
              label="Provider"
              value={PROVIDERS.find((p) => p.id === provider)?.label ?? provider}
              open={providerOpen}
              onToggle={() => { setProviderOpen((v) => !v); setModelOpen(false); }}
            >
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`np-pf-picker-item${p.id === provider ? " np-pf-picker-item--active" : ""}`}
                  onClick={() => {
                    setProvider(p.id);
                    setModel(MODELS_BY_PROVIDER[p.id]?.[0]?.id ?? "");
                    setProviderOpen(false);
                  }}
                >
                  {p.label}
                </button>
              ))}
            </PickerPill>
            <PickerPill
              label="Model"
              value={MODELS_BY_PROVIDER[provider]?.find((m) => m.id === model)?.label ?? model}
              open={modelOpen}
              onToggle={() => { setModelOpen((v) => !v); setProviderOpen(false); }}
            >
              {(MODELS_BY_PROVIDER[provider] ?? []).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`np-pf-picker-item${m.id === model ? " np-pf-picker-item--active" : ""}`}
                  onClick={() => { setModel(m.id); setModelOpen(false); }}
                >
                  {m.label}
                </button>
              ))}
            </PickerPill>
          </div>
          <button
            type="button"
            className="np-pf-begin"
            onClick={handleBegin}
            disabled={!canBegin}
            aria-label="Begin"
          >
            <span>Begin</span>
            <span className="np-pf-begin-arrow" aria-hidden="true">→</span>
          </button>
        </section>
      </main>

      {/* Bottom toast (lab self-contained — no global ToastProvider) */}
      {toast && (
        <div className="np-pf-toast" role="status" aria-live="polite" key={toast.key}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────

function ModifierChip({
  id,
  label,
  activeLabel,
  expanded,
  onToggle,
  onClear,
  children,
}: {
  id: ModifierId;
  label: string;
  activeLabel: string | null;
  expanded: boolean;
  onToggle: () => void;
  onClear: () => void;
  children: React.ReactNode;
}) {
  const active = activeLabel !== null;
  return (
    <div className={`np-pf-mod${active ? " np-pf-mod--active" : ""}${expanded ? " np-pf-mod--expanded" : ""}`} data-mod-id={id}>
      <div className="np-pf-mod-chip">
        <button type="button" className="np-pf-mod-trigger" onClick={onToggle} aria-expanded={expanded}>
          {!active && <span className="np-pf-mod-plus" aria-hidden="true">+</span>}
          <span className="np-pf-mod-label">{label}</span>
          {active && <span className="np-pf-mod-dot" aria-hidden="true">·</span>}
          {active && <span className="np-pf-mod-value">{activeLabel}</span>}
        </button>
        {active && (
          <button type="button" className="np-pf-mod-clear" onClick={(e) => { e.stopPropagation(); onClear(); }} aria-label={`Remover ${label}`}>
            ×
          </button>
        )}
      </div>
      {expanded && (
        <div className="np-pf-mod-expand">
          {children}
        </div>
      )}
    </div>
  );
}

function FormatExpand({ value, onPick }: { value: FormatValue | null; onPick: (v: FormatValue) => void }) {
  return (
    <div className="np-pf-expand-grid np-pf-expand-grid--format">
      {FORMAT_OPTIONS.map((f) => (
        <button
          key={f.id}
          type="button"
          className={`np-pf-expand-tile${value === f.id ? " np-pf-expand-tile--active" : ""}`}
          onClick={() => onPick(f.id)}
        >
          <span className="np-pf-expand-tile-label">{f.label}</span>
          <span className="np-pf-expand-tile-sub">{f.sub}</span>
        </button>
      ))}
    </div>
  );
}

function DirectionExpand({ value, onChange, onDone }: { value: string | null; onChange: (v: string | null) => void; onDone: () => void }) {
  const [draft, setDraft] = useState(value ?? "");
  return (
    <div className="np-pf-expand-direction">
      <textarea
        className="np-pf-expand-textarea"
        placeholder="ex: editorial sereno, brutal & directa, layered tactile…"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={2}
      />
      <div className="np-pf-expand-presets">
        {DIRECTION_PRESETS.map((p) => (
          <button key={p} type="button" className="np-pf-expand-preset" onClick={() => setDraft(p)}>
            {p}
          </button>
        ))}
      </div>
      <div className="np-pf-expand-actions">
        <button type="button" className="np-pf-expand-btn" onClick={() => { onChange(draft.trim() || null); onDone(); }}>Salvar</button>
        <button type="button" className="np-pf-expand-btn np-pf-expand-btn--ghost" onClick={onDone}>Fechar</button>
      </div>
    </div>
  );
}

function DsExpand({ value, onPick }: { value: DsValue | null; onPick: (v: DsValue) => void }) {
  return (
    <div className="np-pf-expand-list">
      {DS_OPTIONS.map((d) => (
        <button
          key={d.id}
          type="button"
          className={`np-pf-expand-row${value === d.id ? " np-pf-expand-row--active" : ""}`}
          onClick={() => onPick(d.id)}
        >
          <span className="np-pf-expand-row-label">{d.label}</span>
          <span className="np-pf-expand-row-meta">mock</span>
        </button>
      ))}
    </div>
  );
}

function AntiSlopExpand({ value, onPick }: { value: AntiSlopValue | null; onPick: (v: AntiSlopValue) => void }) {
  return (
    <div className="np-pf-expand-toggle">
      <button
        type="button"
        className={`np-pf-expand-toggle-btn${value === "strict" ? " np-pf-expand-toggle-btn--active" : ""}`}
        onClick={() => onPick("strict")}
      >
        strict
        <span className="np-pf-expand-toggle-sub">bloqueia generic AI slop</span>
      </button>
      <button
        type="button"
        className={`np-pf-expand-toggle-btn${value === "loose" ? " np-pf-expand-toggle-btn--active" : ""}`}
        onClick={() => onPick("loose")}
      >
        loose
        <span className="np-pf-expand-toggle-sub">só warnings</span>
      </button>
    </div>
  );
}

function RefsExpand({ value, onAdd, onDone }: { value: string[]; onAdd: (name: string) => void; onDone: () => void }) {
  return (
    <div className="np-pf-expand-refs">
      <div className="np-pf-expand-refs-drop" role="button" tabIndex={0} onClick={() => onAdd(`mock-ref-${value.length + 1}.png`)}>
        <span className="np-pf-expand-refs-icon" aria-hidden="true">+</span>
        <span>Drop files (mock — adiciona placeholder)</span>
      </div>
      {value.length > 0 && (
        <ul className="np-pf-expand-refs-list">
          {value.map((name) => (
            <li key={name} className="np-pf-expand-refs-item">{name}</li>
          ))}
        </ul>
      )}
      <div className="np-pf-expand-actions">
        <button type="button" className="np-pf-expand-btn np-pf-expand-btn--ghost" onClick={onDone}>Fechar</button>
      </div>
    </div>
  );
}

function VerbExpand({ value, onPick }: { value: VerbValue | null; onPick: (v: VerbValue) => void }) {
  return (
    <div className="np-pf-expand-list">
      {VERB_OPTIONS.map((v) => (
        <button
          key={v.id}
          type="button"
          className={`np-pf-expand-row${value === v.id ? " np-pf-expand-row--active" : ""}`}
          onClick={() => onPick(v.id)}
        >
          <span className="np-pf-expand-row-label">{v.label}</span>
        </button>
      ))}
    </div>
  );
}

function PickerPill({
  label,
  value,
  open,
  onToggle,
  children,
}: {
  label: string;
  value: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`np-pf-picker${open ? " np-pf-picker--open" : ""}`}>
      <button type="button" className="np-pf-picker-trigger" onClick={onToggle} aria-expanded={open}>
        <span className="np-pf-picker-label">{label}</span>
        <span className="np-pf-picker-value">{value}</span>
        <span className="np-pf-picker-chev" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="np-pf-picker-menu" role="menu">
          {children}
        </div>
      )}
    </div>
  );
}

// Compact theme toggle that doesn't need the SettingsProvider — toggles
// `data-theme` directly on <html>. Mirrors the canonical ThemeToggle
// behavior but is self-contained for the lab page.
function ThemeToggleInline() {
  const [isLight, setIsLight] = useState<boolean>(() => {
    if (typeof document === "undefined") return false;
    return document.documentElement.getAttribute("data-theme") === "light";
  });
  // Keep local state in sync if the app shell flips theme too.
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
      className="np-pf-theme-toggle"
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

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function renderRecoList(intent: IntentResult): React.ReactNode {
  const recos: string[] = [];
  if (intent.suggestion.format) recos.push(`format ${intent.suggestion.format}`);
  if (intent.suggestion.ds && intent.suggestion.ds !== "none") recos.push(`DS ${intent.suggestion.ds}`);
  if (intent.suggestion.antiSlop) recos.push(`anti-slop ${intent.suggestion.antiSlop}`);
  if (intent.suggestion.direction) recos.push(`direction ${intent.suggestion.direction}`);
  if (intent.suggestion.verb) recos.push(`verb ${intent.suggestion.verb}`);
  if (recos.length === 0) return <span className="np-pf-suggest-recos-empty">sem modificadores sugeridos</span>;
  return (
    <span className="np-pf-suggest-recos-text">
      Sugiro: {recos.map((r, i) => (
        <span key={r}>
          {i > 0 && <span className="np-pf-suggest-recos-sep"> · </span>}
          <span className="np-pf-suggest-recos-item">{r}</span>
        </span>
      ))}
    </span>
  );
}


import { useEffect, useMemo, useRef, useState } from "react";
import { installSkill, type Skill, type CreateSkillInput } from "@/lib/claude-bridge";
import type { UseSkillRegistry } from "@/hooks/useSkillRegistry";
import { renderMarkdownSafe, sanitizeHtml } from "@/lib/safe-markdown";
// NewProject canonical chrome (kicker, zone, foot, cnp-begin) shipped
// via this stylesheet — pulled in here so the Skill modal renders with
// the same classes even when NewProject hasn't been opened yet.
import "@/styles/np-canonical-plus.css";

/**
 * Single-modal skill editor (Lens spec). Not a wizard — a designer non-dev
 * should think "new skill", type four fields, save, test. Four red flags
 * from Nielsen audit mitigated: auto-save draft, live conflict detection,
 * conflict warning lists alternative trigger, discard confirmation on close
 * when draft is non-empty.
 */

interface Props {
  onClose: () => void;
  onSaved: (skill: Skill) => void;
  /** Registry snapshot used for live conflict detection. */
  registry: UseSkillRegistry;
}

const DRAFT_KEY = "df:skill-draft:v1";
const RESERVED_BUILTINS = [
  "/tweaks", "/edit", "/export", "/present", "/terminal",
  "/init", "/review", "/clear", "/cost", "/model", "/compact", "/undo", "/resume",
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "skill";
}

export function SkillCreateModal({ onClose, onSaved, registry }: Props) {
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("");
  const [triggerManuallyEdited, setTriggerManuallyEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [overrideBuiltin, setOverrideBuiltin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoredDraft, setRestoredDraft] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // ─── Draft autosave ──
  // Restore on mount if non-empty draft exists. Clear on successful save or
  // explicit confirmed cancel.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d && (d.name || d.body)) {
        setName(d.name ?? "");
        setTrigger(d.trigger ?? "");
        setTriggerManuallyEdited(!!d.triggerManuallyEdited);
        setDescription(d.description ?? "");
        setBody(d.body ?? "");
        setOverrideBuiltin(!!d.overrideBuiltin);
        setRestoredDraft(true);
      }
    } catch {}
    nameRef.current?.focus();
  }, []);

  useEffect(() => {
    const payload = JSON.stringify({
      name, trigger, triggerManuallyEdited, description, body, overrideBuiltin,
    });
    try { localStorage.setItem(DRAFT_KEY, payload); } catch {}
  }, [name, trigger, triggerManuallyEdited, description, body, overrideBuiltin]);

  // ─── Trigger auto-inference ──
  // Name → slugified trigger, unless the user has manually edited the trigger
  // field (respect their intent).
  useEffect(() => {
    if (triggerManuallyEdited) return;
    if (!name.trim()) { setTrigger(""); return; }
    setTrigger("/" + slugify(name));
  }, [name, triggerManuallyEdited]);

  // ─── Live conflict detection ──
  const { collision, isBuiltinReserved, alternateTrigger } = useMemo(() => {
    const t = trigger.trim();
    if (!t) return { collision: null as Skill | null, isBuiltinReserved: false, alternateTrigger: null as string | null };
    const reserved = RESERVED_BUILTINS.includes(t);
    const all = registry.byTrigger.get(t) ?? [];
    // Collision = any existing skill with this exact trigger (same or different source)
    const first = all[0] ?? null;
    // Suggest alternate if collision
    let alt: string | null = null;
    if (reserved || first) {
      for (let i = 2; i < 10; i++) {
        const candidate = `${t}-${i}`;
        if (!registry.byTrigger.get(candidate)) { alt = candidate; break; }
      }
    }
    return { collision: first, isBuiltinReserved: reserved, alternateTrigger: alt };
  }, [trigger, registry.byTrigger]);

  // ─── Validation ──
  const nameOk = name.trim().length > 0 && name.trim().length <= 80;
  const bodyOk = body.trim().length >= 20 && body.length <= 100_000;
  const triggerOk = /^\/[a-z0-9:_-]{1,40}$/i.test(trigger.trim());
  const triggerFree = !collision && !isBuiltinReserved;
  const canSave = nameOk && bodyOk && triggerOk && (triggerFree || overrideBuiltin) && !saving;

  // ─── Body preview HTML ──
  const previewHtml = useMemo(() => {
    if (!showPreview) return "";
    return renderMarkdownSafe(body);
  }, [showPreview, body]);
  const emptyPreviewHtml = useMemo(
    () => sanitizeHtml("<em style='color:var(--df-text-faint)'>(empty)</em>"),
    []
  );

  const handleClose = () => {
    const hasDraft = name.trim() || body.trim();
    if (hasDraft && !window.confirm("Discard unsaved skill?")) return;
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    onClose();
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const input: CreateSkillInput = {
      name: name.trim(),
      trigger: trigger.trim(),
      description: description.trim() || null,
      body,
      override: overrideBuiltin || undefined,
    };
    const result = await installSkill(input);
    setSaving(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    onSaved(result);
  };

  const handleTriggerChange = (v: string) => {
    setTrigger(v);
    setTriggerManuallyEdited(true);
  };

  // User ask 2026-05-21: NewProject modal is the canon — Skill +
  // DS modals absorb its editorial header + zones layout (Medium
  // adoption). Surface still uses single-modal form (no wizard),
  // wrapper now applies NP's kicker + title hero, the body splits
  // into `cnp-zone` blocks (Identidade + Instruções), and the foot
  // row uses the canonical foot-reset / primary CTA.
  return (
    <div
      onClick={handleClose}
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "var(--df-surface-overlay)",
        backdropFilter: "blur(14px) saturate(1.02)",
        WebkitBackdropFilter: "blur(14px) saturate(1.02)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="np-modal-card"
        style={{
          width: 1024, maxHeight: "92vh",
          maxWidth: "94vw",
          background: "var(--df-surface-elevated)",
          borderRadius: "var(--df-r-3xl)",
          boxShadow: "var(--df-shadow-card)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header — kicker + title hero (NewProject canon) */}
        <header style={{
          padding: "18px 28px 12px",
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          gap: 16,
        }}>
          <div>
            <div className="settings-kicker" style={{ marginBottom: 0 }}>
              Skill · {restoredDraft ? "Rascunho restaurado" : "Nova"}
            </div>
            <h1 className="settings-title" style={{ marginTop: 4, marginBottom: 0 }}>
              Nova skill
            </h1>
          </div>
          <button
            onClick={handleClose}
            aria-label="Fechar"
            className="cnp-foot-reset"
            style={{ minWidth: 36, padding: "8px 12px", fontSize: 12 }}
          >
            ✕
          </button>
        </header>

        {/* Body — zones */}
        <div style={{
          flex: 1,
          display: "flex", flexDirection: "column",
          padding: "8px 28px 16px",
          gap: 20,
          overflow: "auto",
        }}>
          {/* ZONE 1 — Identidade */}
          <section className="cnp-zone" aria-label="Identidade da skill">
            <header className="cnp-zone-header">
              <span className="cnp-zone-engrave">IDENTIDADE</span>
            </header>
            <div className="cnp-zone-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Name */}
          <LabeledRow label="Name">
            <input
              ref={nameRef}
              className="df-input"
              type="text"
              placeholder="Brand palette generator"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: 10, color: "var(--df-text-faint)", fontFamily: "var(--df-font-mono)" }}>
              {name.length}/80
            </span>
          </LabeledRow>

          {/* Command (trigger) */}
          <LabeledRow label="Command">
            <input
              className="df-input"
              type="text"
              placeholder="/brand-palette"
              value={trigger}
              onChange={(e) => handleTriggerChange(e.target.value)}
              style={{
                flex: 1,
                fontFamily: "var(--df-font-mono)",
                borderColor: triggerOk && triggerFree ? undefined : collision || isBuiltinReserved ? "#e5c07b" : undefined,
              }}
            />
            <TriggerStatus
              collision={collision}
              isBuiltinReserved={isBuiltinReserved}
              overrideBuiltin={overrideBuiltin}
              onOverrideChange={setOverrideBuiltin}
              alternateTrigger={alternateTrigger}
              onPickAlternate={(t) => { setTrigger(t); setTriggerManuallyEdited(true); }}
            />
          </LabeledRow>
          <Helper>Type this in chat to activate. Built-ins: {RESERVED_BUILTINS.slice(0, 5).map((t) => <code key={t} style={{ fontSize: 10, padding: "0 3px", background: "var(--df-surface-raised)", borderRadius: 2, marginRight: 4 }}>{t}</code>)}…</Helper>

          {/* Description */}
          <LabeledRow label="Description">
            <input
              className="df-input"
              type="text"
              placeholder="shown in slash menu · 1-2 lines"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: 10, color: "var(--df-text-faint)", fontFamily: "var(--df-font-mono)" }}>
              {description.length}/200
            </span>
          </LabeledRow>

            </div>
          </section>

          {/* ZONE 2 — Instruções */}
          <section className="cnp-zone" aria-label="Instruções da skill">
            <header className="cnp-zone-header">
              <span className="cnp-zone-engrave">INSTRUÇÕES</span>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, color: "var(--df-text-muted)" }}>
                <input
                  type="checkbox"
                  checked={showPreview}
                  onChange={(e) => setShowPreview(e.target.checked)}
                />
                Preview
              </label>
            </header>
            <div className="cnp-zone-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>

          {showPreview ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, flex: 1, minHeight: 180 }}>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="You are…"
                style={{
                  width: "100%", minHeight: 180,
                  padding: 12,
                  fontFamily: "var(--df-font-mono)", fontSize: 12, lineHeight: 1.5,
                  background: "var(--df-bg-base)",
                  border: "1px solid var(--df-border-subtle)",
                  borderRadius: "var(--df-r-sm)",
                  color: "var(--df-text-primary)",
                  resize: "vertical",
                }}
              />
              <div
                className="markdown-preview"
                style={{
                  width: "100%", minHeight: 180, overflow: "auto",
                  padding: "16px 20px",
                  background: "var(--df-bg-section)",
                  border: "1px solid var(--df-border-subtle)",
                  borderRadius: "var(--df-r-sm)",
                  fontSize: 13,
                }}
                dangerouslySetInnerHTML={{ __html: previewHtml || emptyPreviewHtml }}
              />
            </div>
          ) : (
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="You are…"
              style={{
                width: "100%", minHeight: 180, flex: 1,
                padding: 12,
                fontFamily: "var(--df-font-mono)", fontSize: 12, lineHeight: 1.5,
                background: "var(--df-bg-base)",
                border: "1px solid var(--df-border-subtle)",
                borderRadius: "var(--df-r-sm)",
                color: "var(--df-text-primary)",
                resize: "vertical",
              }}
            />
          )}
          <Helper>
            Markdown supported. Min 20 characters, max 100KB. Keep it behavioral — "you are…", "when you X…" — not code.
          </Helper>

          {error && (
            <div style={{
              padding: "8px 12px",
              background: "rgba(255,107,107,0.1)",
              border: "1px solid rgba(255,107,107,0.32)",
              borderRadius: "var(--df-r-sm)",
              color: "#ff8b8b",
              fontSize: "var(--df-text-sm)",
            }}>
              {error}
            </div>
          )}
            </div>
          </section>

          {/* Status line above foot — mirrors NewProject's submit microcopy */}
          <div style={{ fontSize: 10, color: "var(--df-text-faint)", fontFamily: "var(--df-font-mono)", textAlign: "right", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            {canSave ? "Pronto pra salvar" : !nameOk ? "Nome obrigatório" : !bodyOk ? "Instruções precisam de 20+ caracteres" : !triggerOk ? "Comando inválido" : !triggerFree && !overrideBuiltin ? "Trigger colidindo" : ""}
          </div>
        </div>

        {/* Footer — cnp-foot-row canonical (NewProject parity) */}
        <div className="cnp-foot-row" style={{ padding: "12px 28px 18px" }}>
          <button
            type="button"
            className="cnp-foot-reset"
            onClick={handleClose}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={`cnp-begin cnp-begin--v8${saving ? " is-loading" : ""}`}
            onClick={handleSave}
            disabled={!canSave}
            aria-busy={saving}
          >
            <span className="cnp-begin-led" aria-hidden="true" />
            <span className="cnp-begin-label">
              {saving ? "Salvando…" : "Salvar skill"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function LabeledRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{
        width: 90, flexShrink: 0,
        fontSize: 10, color: "var(--df-text-faint)",
        fontFamily: "var(--df-font-mono)",
        textTransform: "uppercase", letterSpacing: "0.08em",
      }}>
        {label}
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}

function Helper({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      paddingLeft: 100,
      fontSize: 10,
      color: "var(--df-text-faint)",
      lineHeight: 1.4,
    }}>
      {children}
    </div>
  );
}

function TriggerStatus({
  collision, isBuiltinReserved, overrideBuiltin, onOverrideChange,
  alternateTrigger, onPickAlternate,
}: {
  collision: Skill | null;
  isBuiltinReserved: boolean;
  overrideBuiltin: boolean;
  onOverrideChange: (v: boolean) => void;
  alternateTrigger: string | null;
  onPickAlternate: (t: string) => void;
}) {
  if (!collision && !isBuiltinReserved) {
    return <span style={{ fontSize: 10, color: "#5faa54", fontFamily: "var(--df-font-mono)" }}>available</span>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, fontSize: 10 }}>
      <span style={{ color: "#e5c07b", fontFamily: "var(--df-font-mono)" }}>
        {isBuiltinReserved ? "built-in" : `used by ${collision?.source}`}
      </span>
      {alternateTrigger && (
        <button
          onClick={() => onPickAlternate(alternateTrigger)}
          style={{
            background: "transparent", border: "none",
            color: "var(--df-text-secondary)",
            fontFamily: "var(--df-font-mono)",
            fontSize: 10,
            cursor: "pointer",
            textDecoration: "underline",
            textUnderlineOffset: 2,
            padding: 0,
          }}
        >
          try {alternateTrigger}
        </button>
      )}
      {isBuiltinReserved && (
        <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", color: "var(--df-text-muted)" }}>
          <input
            type="checkbox"
            checked={overrideBuiltin}
            onChange={(e) => onOverrideChange(e.target.checked)}
          />
          override
        </label>
      )}
    </div>
  );
}

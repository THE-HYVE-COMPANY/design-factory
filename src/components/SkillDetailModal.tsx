import { useEffect, useMemo, useRef, useState } from "react";
import {
  updateSkill,
  deleteSkill,
  type Skill,
} from "@/lib/claude-bridge";
import { renderMarkdownSafe } from "@/lib/safe-markdown";

// SkillDetailModal — dedicated inspector for any skill record.
// Three tabs: Preview (rendered markdown) / Source (raw body) / Meta.
// df-source skills expose Edit + Delete. Every skill exposes Export .md +
// Test in chat (opens a scratch project with the trigger + a smoke prompt).

type Tab = "preview" | "source" | "meta";

interface Props {
  skill: Skill;
  onClose: () => void;
  onChanged?: (next: Skill) => void;
  onDeleted?: (id: string) => void;
  onTestInChat?: (skill: Skill) => void;
}

export function SkillDetailModal({ skill, onClose, onChanged, onDeleted, onTestInChat }: Props) {
  const [tab, setTab] = useState<Tab>("preview");
  const [editing, setEditing] = useState(false);
  const [draftBody, setDraftBody] = useState(skill.body);
  const [draftDescription, setDraftDescription] = useState(skill.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyAreaRef = useRef<HTMLTextAreaElement>(null);

  const isDf = skill.source === "df";
  const dirty = editing && (draftBody !== skill.body || draftDescription !== (skill.description ?? ""));

  // Keep drafts in sync if the skill prop swaps (e.g. after rescan).
  useEffect(() => {
    setDraftBody(skill.body);
    setDraftDescription(skill.description ?? "");
    setEditing(false);
    setError(null);
  }, [skill.id]);

  // Esc to close (blocked while saving or while a dirty edit is open).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (saving) return;
      if (dirty) {
        const ok = window.confirm("Discard unsaved changes?");
        if (!ok) return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saving, dirty, onClose]);

  const previewHtml = useMemo(() => {
    return renderMarkdownSafe(draftBody, "<pre>failed to render</pre>");
  }, [draftBody]);

  const handleEdit = () => {
    setEditing(true);
    setTab("source");
    setTimeout(() => bodyAreaRef.current?.focus(), 30);
  };

  const handleCancelEdit = () => {
    if (dirty) {
      const ok = window.confirm("Discard unsaved changes?");
      if (!ok) return;
    }
    setDraftBody(skill.body);
    setDraftDescription(skill.description ?? "");
    setEditing(false);
    setError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const result = await updateSkill(skill.id, {
      body: draftBody,
      description: draftDescription.trim() || null,
    });
    setSaving(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setEditing(false);
    onChanged?.(result);
  };

  const handleDelete = async () => {
    // Explicit confirm dialog — user's rule: destructive actions
    // must ask before firing. 2-click pattern was too easy to trip.
    if (!window.confirm(`Delete skill "${skill.name}"? This can't be undone.`)) return;
    setSaving(true);
    const ok = await deleteSkill(skill.id);
    setSaving(false);
    if (ok) {
      onDeleted?.(skill.id);
      onClose();
    } else {
      setError("Failed to delete");
    }
  };

  const handleExport = () => {
    const fm = buildFrontmatter(skill);
    const content = `${fm}\n\n${draftBody}`;
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = skill.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    a.download = `${safeName || "skill"}.md`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 100);
  };

  // handleTest removed alongside the "Test in chat" button. onTestInChat
  // prop stays on the public type for back-compat — restore the handler
  // + button if a different surface needs to re-introduce the action.
  void onTestInChat;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "var(--df-surface-overlay)",
        backdropFilter: "blur(14px) saturate(1.02)",
        WebkitBackdropFilter: "blur(14px) saturate(1.02)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={() => {
        if (dirty) {
          const ok = window.confirm("Discard unsaved changes?");
          if (!ok) return;
        }
        onClose();
      }}
    >
      <div
        style={{
          width: 1024, height: 720,
          maxWidth: "94vw", maxHeight: "92vh",
          background: "var(--df-surface-elevated)",
          borderRadius: "var(--df-r-3xl)",
          boxShadow: "var(--df-shadow-card)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          gap: 12,
          padding: "14px 18px 10px",
          borderBottom: "1px solid var(--df-border-subtle)",
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 4 }}>
              <DetailSourceBadge source={skill.source} />
              {skill.requires.length > 0 && (
                <span style={{
                  padding: "1px 6px",
                  borderRadius: 4,
                  fontSize: 10,
                  fontFamily: "var(--df-font-mono)",
                  color: "var(--df-text-muted)",
                  border: "1px solid var(--df-border-subtle)",
                  background: "var(--df-bg-section)",
                }}>
                  requires: {skill.requires.join(", ")}
                </span>
              )}
            </div>
            <div style={{
              fontSize: "var(--df-text-md)", fontWeight: 600,
              color: "var(--df-text-primary)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {skill.name}
            </div>
            <div style={{
              fontFamily: "var(--df-font-mono)",
              fontSize: "var(--df-text-xs)",
              color: "var(--df-text-secondary)",
              marginTop: 2,
            }}>
              {skill.trigger}
            </div>
          </div>
          <button
            className="df-btn df-btn--ghost"
            onClick={() => {
              if (dirty) {
                const ok = window.confirm("Discard unsaved changes?");
                if (!ok) return;
              }
              onClose();
            }}
            style={{ fontSize: 16, lineHeight: 1, padding: "2px 8px" }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex", gap: 2,
          padding: "6px 12px 0",
          borderBottom: "1px solid var(--df-border-subtle)",
        }}>
          {(["preview", "source", "meta"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "6px 12px",
                background: tab === t ? "var(--df-surface-elevated)" : "transparent",
                border: "1px solid",
                borderColor: tab === t ? "var(--df-border-strong)" : "transparent",
                borderBottom: "none",
                borderRadius: "var(--df-r-sm) var(--df-r-sm) 0 0",
                color: tab === t ? "var(--df-text-primary)" : "var(--df-text-muted)",
                fontSize: "var(--df-text-sm)",
                fontFamily: "var(--df-font-mono)",
                cursor: "pointer",
                textTransform: "lowercase",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto" }}>
          {tab === "preview" && (
            <div
              className="markdown-preview"
              style={{
                padding: "16px 20px",
                fontSize: "var(--df-text-sm)",
                color: "var(--df-text-primary)",
                lineHeight: 1.55,
              }}
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          )}

          {tab === "source" && (
            editing ? (
              <textarea
                ref={bodyAreaRef}
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                spellCheck={false}
                style={{
                  width: "100%", height: "100%",
                  padding: "14px 18px",
                  background: "var(--df-bg-section)",
                  border: "none", outline: "none",
                  color: "var(--df-text-primary)",
                  fontFamily: "var(--df-font-mono)",
                  fontSize: 12,
                  lineHeight: 1.55,
                  resize: "none",
                }}
              />
            ) : (
              <pre style={{
                margin: 0,
                padding: "14px 18px",
                background: "var(--df-bg-section)",
                color: "var(--df-text-primary)",
                fontFamily: "var(--df-font-mono)",
                fontSize: 12,
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                minHeight: "100%",
              }}>
                {draftBody}
              </pre>
            )
          )}

          {tab === "meta" && (
            <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
              <MetaRow label="Name" value={skill.name} />
              <MetaRow label="Trigger" value={skill.trigger} mono />
              {editing ? (
                <div>
                  <div style={{ fontSize: "var(--df-text-xs)", color: "var(--df-text-muted)", marginBottom: 4 }}>
                    Description
                  </div>
                  <input
                    type="text"
                    className="df-input"
                    value={draftDescription}
                    onChange={(e) => setDraftDescription(e.target.value)}
                    placeholder="Short summary shown in slash menu and cards"
                    style={{ width: "100%", fontSize: "var(--df-text-sm)" }}
                  />
                </div>
              ) : (
                <MetaRow label="Description" value={skill.description || "(none)"} />
              )}
              <MetaRow label="Source" value={skill.source} />
              {skill.path && <MetaRow label="Path" value={skill.path} mono wrap />}
              {skill.override_trigger && <MetaRow label="Overrides" value={skill.override_trigger} mono />}
              {skill.version && <MetaRow label="Version" value={skill.version} mono />}
              <MetaRow label="Body hash" value={skill.body_hash} mono />
              <MetaRow label="Size" value={`${draftBody.length.toLocaleString()} chars`} />
              {!isDf && (
                <div style={{
                  marginTop: 4,
                  padding: "8px 10px",
                  background: "var(--df-bg-section)",
                  border: "1px solid var(--df-border-subtle)",
                  borderRadius: "var(--df-r-sm)",
                  fontSize: "var(--df-text-xs)",
                  color: "var(--df-text-muted)",
                }}>
                  Read-only. Edits to {skill.source} skills happen in their source file.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 10,
          padding: "10px 16px",
          borderTop: "1px solid var(--df-border-subtle)",
          background: "var(--df-bg-section)",
        }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
            {isDf && !editing && (
              <button
                className="df-btn df-btn--secondary"
                onClick={handleDelete}
                disabled={saving}
                style={{ fontSize: "var(--df-text-xs)" }}
              >
                Delete
              </button>
            )}
            {error && (
              <span style={{
                fontSize: "var(--df-text-xs)",
                color: "var(--df-accent-warn, #c27c2c)",
                fontFamily: "var(--df-font-mono)",
              }}>
                {error}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="df-btn df-btn--ghost" onClick={handleExport} style={{ fontSize: "var(--df-text-xs)" }}>
              Export .md
            </button>
            {/* "Test in chat" button removed 2026-05-21 — user ask:
                "remova opcao testar no chat e remova do modal tambem".
                onTestInChat prop kept on the type for one cycle of
                back-compat; the handler stays in case a different surface
                wants to wire the action later. */}
            {isDf && !editing && (
              <button className="df-btn df-btn--primary" onClick={handleEdit} style={{ fontSize: "var(--df-text-xs)" }}>
                Edit
              </button>
            )}
            {isDf && editing && (
              <>
                <button className="df-btn df-btn--secondary" onClick={handleCancelEdit} disabled={saving} style={{ fontSize: "var(--df-text-xs)" }}>
                  Cancel
                </button>
                <button className="df-btn df-btn--primary" onClick={handleSave} disabled={saving || !dirty} style={{ fontSize: "var(--df-text-xs)" }}>
                  {saving ? "Saving…" : "Save"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, value, mono, wrap }: { label: string; value: string; mono?: boolean; wrap?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: "var(--df-text-xs)", color: "var(--df-text-muted)", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{
        fontSize: mono ? 12 : "var(--df-text-sm)",
        fontFamily: mono ? "var(--df-font-mono)" : undefined,
        color: "var(--df-text-primary)",
        wordBreak: wrap ? "break-all" : undefined,
        whiteSpace: wrap ? "normal" : "nowrap",
        overflow: wrap ? "visible" : "hidden",
        textOverflow: wrap ? undefined : "ellipsis",
      }}>
        {value}
      </div>
    </div>
  );
}

function DetailSourceBadge({ source }: { source: Skill["source"] }) {
  const map: Record<Skill["source"], { label: string; tint: string }> = {
    df:      { label: "yours",    tint: "rgba(220,234,208,0.18)" },
    project: { label: "project",  tint: "rgba(229,197,123,0.22)" },
    global:  { label: "global",   tint: "rgba(128,167,255,0.20)" },
    builtin: { label: "built-in", tint: "rgba(128,167,255,0.20)" },
  };
  const { label, tint } = map[source];
  return (
    <span style={{
      padding: "2px 7px",
      fontSize: 10,
      fontFamily: "var(--df-font-mono)",
      color: "var(--df-text-primary)",
      background: tint,
      border: "1px solid var(--df-border-subtle)",
      borderRadius: "var(--df-r-xs)",
      textTransform: "lowercase",
      letterSpacing: 0.2,
    }}>
      {label}
    </span>
  );
}

function buildFrontmatter(skill: Skill): string {
  const lines = ["---"];
  lines.push(`name: ${skill.name}`);
  if (skill.description) lines.push(`description: ${JSON.stringify(skill.description)}`);
  lines.push(`trigger: ${skill.trigger}`);
  if (skill.requires.length > 0) lines.push(`requires: [${skill.requires.join(", ")}]`);
  if (skill.override_trigger) lines.push(`override: ${JSON.stringify(skill.override_trigger)}`);
  if (skill.version) lines.push(`version: ${skill.version}`);
  lines.push("---");
  return lines.join("\n");
}

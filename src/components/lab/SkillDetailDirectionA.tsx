// SkillDetailDirectionA — view + edit a skill in the faceplate language.
// Trigger + source as engraved meta chips, description as a single field,
// body in the recessed bowl (always editable; Save is enabled when dirty).
// Delete is destructive — confirms before stub-firing. Real updateSkill /
// deleteSkill re-wire onto this when the direction is approved.

import { useState } from "react";
import { ArrowRight, Download, Trash2 } from "lucide-react";
import { updateSkill, deleteSkill, type Skill } from "@/lib/claude-bridge";

// Same frontmatter shape the shipped SkillDetailModal exports — kept in
// sync so both surfaces produce identical .md downloads.
function buildFrontmatter(skill: Skill): string {
  const lines = ["---", `name: ${skill.name}`];
  if (skill.description) lines.push(`description: ${JSON.stringify(skill.description)}`);
  lines.push(`trigger: ${skill.trigger}`);
  if (skill.requires.length > 0) lines.push(`requires: [${skill.requires.join(", ")}]`);
  if (skill.override_trigger) lines.push(`override: ${JSON.stringify(skill.override_trigger)}`);
  if (skill.version) lines.push(`version: ${skill.version}`);
  lines.push("---");
  return lines.join("\n");
}

interface Props {
  skill: Skill;
  onClose: () => void;
  onChanged: (next: Skill) => void;
  onDeleted: (id: string) => void;
}

export function SkillDetailDirectionA({ skill, onClose, onChanged, onDeleted }: Props) {
  const [description, setDescription] = useState(skill.description ?? "");
  const [body, setBody] = useState(skill.body);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = description !== (skill.description ?? "") || body !== skill.body;

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    const result = await updateSkill(skill.id, {
      body,
      description: description.trim() || null,
    });
    setSaving(false);
    if ("error" in result) { setError(result.error); return; }
    onChanged(result);
    onClose();
  };

  const remove = async () => {
    if (saving) return;
    if (!window.confirm(`Excluir a skill "${skill.name}"? Essa ação não tem volta.`)) return;
    setSaving(true);
    const ok = await deleteSkill(skill.id);
    setSaving(false);
    if (!ok) { setError("Falha ao excluir."); return; }
    onDeleted(skill.id);
    onClose();
  };

  const exportMd = () => {
    const content = `${buildFrontmatter(skill)}\n\n${body}`;
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safe = skill.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    a.download = `${safe || "skill"}.md`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
  };

  return (
    <div>
      {/* Meta — trigger + source as engraved chips, read-only */}
      <div className="dsl-zone">
        <span className="dsl-engrave">identidade</span>
        <div className="dsl-engine">
          <div className="dsl-engine-chip" style={{ cursor: "default" }}>
            <span className="dsl-engine-k">trigger</span> {skill.trigger || "—"}
          </div>
          <div className="dsl-engine-chip" style={{ cursor: "default" }}>
            <span className="dsl-engine-k">fonte</span> {skill.source}
          </div>
        </div>
      </div>

      <div className="dsl-zone">
        <span className="dsl-engrave">descrição</span>
        <input
          className="dsl-input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="O que essa skill faz e quando usar"
          spellCheck={false}
          autoComplete="off"
          style={{ fontFamily: "var(--df-font-sans)" }}
        />
      </div>

      <div className="dsl-zone">
        <span className="dsl-engrave">corpo (instruções)</span>
        <textarea
          className="dsl-textarea"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          spellCheck={false}
        />
      </div>

      {error && (
        <div className="dsl-zone" style={{ color: "var(--df-accent-danger)", fontSize: "var(--df-text-xs)" }} role="alert">
          {error}
        </div>
      )}

      <div className="dsl-foot" style={{ justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="dsl-engine-chip"
            onClick={remove}
            disabled={saving}
            title="Excluir skill"
            style={{ color: "var(--df-accent-danger)", borderColor: "color-mix(in srgb, var(--df-accent-danger) 40%, var(--df-border-subtle))" }}
          >
            <Trash2 size={14} strokeWidth={2} aria-hidden="true" /> Excluir
          </button>
          <button type="button" className="dsl-engine-chip" onClick={exportMd} title="Baixar como .md">
            <Download size={14} strokeWidth={2} aria-hidden="true" /> Exportar .md
          </button>
        </div>
        <button
          type="button"
          className={`cnp-begin cnp-begin--v8${saving ? " is-loading" : ""}`}
          onClick={() => { void save(); }}
          disabled={!dirty || saving}
          aria-busy={saving}
        >
          <span className="cnp-begin-led" aria-hidden="true" />
          <span className="cnp-begin-label">{saving ? "Salvando…" : "Salvar"}</span>
          <span className="cnp-begin-arrow" aria-hidden="true"><ArrowRight size={16} strokeWidth={2} /></span>
        </button>
      </div>
    </div>
  );
}

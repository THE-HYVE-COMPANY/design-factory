// SkillDetailDirectionA — view + edit a skill in the faceplate language.
// Trigger + source as engraved meta chips, description as a single field,
// body in the recessed bowl (always editable; Save is enabled when dirty).
// Delete is destructive — confirms before stub-firing. Real updateSkill /
// deleteSkill re-wire onto this when the direction is approved.

import { useState } from "react";
import { ArrowRight, Trash2 } from "lucide-react";
import type { Skill } from "@/lib/claude-bridge";

export function SkillDetailDirectionA({ skill, onClose }: { skill: Skill; onClose: () => void }) {
  const [description, setDescription] = useState(skill.description ?? "");
  const [body, setBody] = useState(skill.body);
  const dirty = description !== (skill.description ?? "") || body !== skill.body;

  const save = () => {
    if (!dirty) return;
    // Presentational stub — real updateSkill re-wires here.
    // eslint-disable-next-line no-console
    console.info("[skill-detail-lab] save", { id: skill.id, description, bodyLen: body.length });
    onClose();
  };

  const remove = () => {
    if (!window.confirm(`Excluir a skill "${skill.name}"? Essa ação não tem volta.`)) return;
    // Presentational stub — real deleteSkill re-wires here.
    // eslint-disable-next-line no-console
    console.info("[skill-detail-lab] delete", { id: skill.id });
    onClose();
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

      <div className="dsl-foot" style={{ justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <button
          type="button"
          className="dsl-engine-chip"
          onClick={remove}
          title="Excluir skill"
          style={{ color: "var(--df-accent-danger)", borderColor: "color-mix(in srgb, var(--df-accent-danger) 40%, var(--df-border-subtle))" }}
        >
          <Trash2 size={14} strokeWidth={2} aria-hidden="true" /> Excluir
        </button>
        <button
          type="button"
          className="cnp-begin cnp-begin--v8"
          onClick={save}
          disabled={!dirty}
        >
          <span className="cnp-begin-led" aria-hidden="true" />
          <span className="cnp-begin-label">Salvar</span>
          <span className="cnp-begin-arrow" aria-hidden="true"><ArrowRight size={16} strokeWidth={2} /></span>
        </button>
      </div>
    </div>
  );
}

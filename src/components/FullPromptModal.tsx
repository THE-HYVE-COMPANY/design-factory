// FullPromptModal.tsx — Audit the full prompt that was used to start a project.
//
// Combines:
//  - System prompt (workspace preamble + fidelity + DS + core)
//  - User-composed prompt (formato.prompt_prefix + anti_slop + selected
//    directions + raw user input)
//
// Read-only. Copy-to-clipboard supported per section + full.

import { useEffect, useMemo, useState } from "react";
import { DfModal } from "@/components/DfModal";
import { db } from "@/lib/claude-bridge";
import {
  getFormatoById,
  getDirectionsByIds,
  composePrompt,
  type DirectionSelection,
} from "@/data/direction-data";
import { GENERATE_CORE_SYSTEM, workspaceContextPreamble } from "@/runtime/prompt-invoker";
import type { ProjectContext } from "@/runtime/prompt-invoker";

interface FullPromptModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectContext: ProjectContext;
}

interface Section {
  id: string;
  label: string;
  body: string;
}

const IconCopy = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const IconClose = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <line x1="6" y1="6" x2="18" y2="18" />
    <line x1="18" y1="6" x2="6" y2="18" />
  </svg>
);

export function FullPromptModal({ open, onClose, projectId, projectContext }: FullPromptModalProps) {
  const [rawPrompt, setRawPrompt] = useState<string>("");
  const [composedSeed, setComposedSeed] = useState<string>("");
  const [directionSelection, setDirectionSelection] = useState<DirectionSelection | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !projectId) return;
    (async () => {
      const [raw, savedComposed, dirSelStr] = await Promise.all([
        db.getSetting(`rawPrompt:${projectId}`).catch(() => null),
        db.getSetting(`initialPrompt:${projectId}`).catch(() => null),
        db.getSetting(`directionSelection:${projectId}`).catch(() => null),
      ]);
      setRawPrompt(raw || "");
      setComposedSeed(savedComposed || "");
      if (dirSelStr) {
        try {
          setDirectionSelection(JSON.parse(dirSelStr) as DirectionSelection);
        } catch {
          setDirectionSelection(null);
        }
      } else {
        setDirectionSelection(null);
      }
    })();
  }, [open, projectId]);

  // ─── Compose all sections ───────────────────────────────────────────
  const sections: Section[] = useMemo(() => {
    const out: Section[] = [];

    // 1. System prompt (preamble + fidelity + DS + core)
    const preamble = workspaceContextPreamble(projectContext);
    const fidelity = `Fidelity: ${projectContext.mode === "wireframe" ? "Wireframe (skeleton, no polished colours)" : "High fidelity (polished type + real colours)"}`;
    const dsLine = projectContext.hasDesignSystem && projectContext.designSystemPath
      ? `Design system available at: ${projectContext.designSystemPath}`
      : "";
    const systemFull = [preamble, "", fidelity, dsLine, "", GENERATE_CORE_SYSTEM]
      .filter(Boolean)
      .join("\n");
    out.push({
      id: "system",
      label: "System prompt (built-in + DS context)",
      body: systemFull,
    });

    // 2. Direction breakdown (if any)
    if (directionSelection) {
      const formato = getFormatoById(directionSelection.formatoId);
      if (formato) {
        out.push({
          id: "formato",
          label: `Formato — ${formato.nome}`,
          body: formato.prompt_prefix.trim(),
        });

        const enabledFromPreset = formato.anti_slop.filter(
          (s) => directionSelection.enabledAntiSlop.includes(s)
        );
        const allAntiSlop = [...enabledFromPreset, ...directionSelection.customAntiSlop];
        if (allAntiSlop.length > 0) {
          out.push({
            id: "anti-slop",
            label: `Anti-slop — ${allAntiSlop.length} enabled`,
            body: allAntiSlop.map((s) => `- ${s}`).join("\n"),
          });
        }

        const dirs = getDirectionsByIds(directionSelection.directionIds);
        if (dirs.length > 0) {
          out.push({
            id: "directions",
            label: `Directions — ${dirs.length} active`,
            body: dirs.map((d) => `[${d.eixo}] ${d.nome}\n${d.prompt_addon.trim()}`).join("\n\n"),
          });
        }
      }
    }

    // 3. Raw user input
    if (rawPrompt) {
      out.push({
        id: "user",
        label: "User prompt (your typed input)",
        body: rawPrompt,
      });
    }

    // 4. Final composed user-side prompt (what actually was sent as `seed`)
    let finalUserPrompt = composedSeed;
    if (!finalUserPrompt && directionSelection) {
      finalUserPrompt = composePrompt(directionSelection, rawPrompt);
    } else if (!finalUserPrompt) {
      finalUserPrompt = rawPrompt;
    }
    if (finalUserPrompt) {
      out.push({
        id: "composed",
        label: "Final user-side prompt sent to LLM",
        body: finalUserPrompt,
      });
    }

    return out;
  }, [projectContext, rawPrompt, composedSeed, directionSelection]);

  const copy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      window.setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
    } catch {
      // ignore
    }
  };

  const fullText = useMemo(
    () => sections.map((s) => `# ${s.label}\n\n${s.body}`).join("\n\n---\n\n"),
    [sections]
  );

  return (
    <DfModal
      open={open}
      onClose={onClose}
      size="xl"
      className="fp-modal"
      head={
        <div className="fp-head">
          <div className="fp-head-text">
            <div className="fp-eyebrow">design factory · prompt audit</div>
            <h2 className="fp-title">Full project prompt</h2>
          </div>
          <button className="fp-close" type="button" aria-label="Close" onClick={onClose}>
            <IconClose />
          </button>
        </div>
      }
      foot={
        <div className="fp-foot">
          <span className="fp-foot-info">
            {sections.length} {sections.length === 1 ? "section" : "sections"}
            <span className="fp-sep">·</span>
            ~{Math.round(fullText.length / 4).toLocaleString()} tokens (rough)
          </span>
          <div className="fp-foot-actions">
            <button
              type="button"
              className="fp-btn"
              onClick={() => copy(fullText, "_all")}
            >
              <IconCopy /> {copied === "_all" ? "Copied" : "Copy all"}
            </button>
            <button type="button" className="fp-btn fp-btn--ghost" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      }
    >
      <div className="fp-body">
        {sections.length === 0 ? (
          <div className="fp-empty">
            <p>No prompt recorded for this project.</p>
          </div>
        ) : (
          sections.map((s) => (
            <section key={s.id} className="fp-section">
              <header className="fp-section-head">
                <h3 className="fp-section-label">{s.label}</h3>
                <button
                  type="button"
                  className="fp-section-copy"
                  onClick={() => copy(s.body, s.id)}
                  title="Copy this section"
                >
                  <IconCopy /> {copied === s.id ? "Copied" : "Copy"}
                </button>
              </header>
              <pre className="fp-section-body">{s.body}</pre>
            </section>
          ))
        )}
      </div>
    </DfModal>
  );
}

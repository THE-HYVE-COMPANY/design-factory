// SceneInspector — sidebar panel for the selected scene.
//
// Compact: inputs only, no explanatory prose. The goal is fast
// per-scene customization without the inspector reading like a help
// page.

import { useMemo, useRef, useState } from "react";
import type { Scene, SceneManifest } from "@/runtime/scene-manifest";
import {
  applySceneEdit,
  buildSceneRefinePrompt,
  findReplaceInScene,
  extractSceneTextSnippets,
} from "@/runtime/scene-manifest";

interface Props {
  scene: Scene;
  manifest: SceneManifest;
  html: string;
  onHtmlChange?: (next: string) => void;
  onRefineScene?: (sceneId: string, prompt: string) => void;
  onClose?: () => void;
}

export function SceneInspector({ scene, manifest: _manifest, html, onHtmlChange, onRefineScene, onClose }: Props) {
  const [refineDraft, setRefineDraft] = useState("");
  const [findDraft, setFindDraft] = useState("");
  const [replaceDraft, setReplaceDraft] = useState("");
  const [textNotice, setTextNotice] = useState<string | null>(null);
  const replaceRef = useRef<HTMLInputElement>(null);

  const snippets = useMemo(() => extractSceneTextSnippets(html, scene.id), [html, scene.id]);

  const handleTimingChange = (patch: Partial<Pick<Scene, "start" | "duration" | "name">>) => {
    if (!onHtmlChange) return;
    onHtmlChange(applySceneEdit(html, scene.id, patch));
  };

  const handleFindReplace = () => {
    if (!onHtmlChange) return;
    const f = findDraft.trim();
    if (!f) {
      setTextNotice("Type the text first.");
      return;
    }
    const result = findReplaceInScene(html, scene.id, f, replaceDraft);
    if (!result.changed) {
      setTextNotice(`"${f.slice(0, 28)}${f.length > 28 ? "…" : ""}" not found.`);
      return;
    }
    onHtmlChange(result.html);
    setTextNotice("Replaced.");
    setFindDraft("");
    setReplaceDraft("");
    window.setTimeout(() => setTextNotice(null), 1500);
  };

  const handleRefine = () => {
    if (!onRefineScene) return;
    onRefineScene(scene.id, buildSceneRefinePrompt(scene, refineDraft));
    setRefineDraft("");
  };

  return (
    <div className="si-root">
      <header className="si-head">
        <div className="si-eyebrow">
          <span className="si-eyebrow-id">scene · {scene.id}</span>
          {onClose && (
            <button type="button" className="si-close" onClick={onClose} aria-label="Close">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>
          )}
        </div>
        <input
          type="text"
          className="si-name"
          value={scene.name}
          onChange={(e) => handleTimingChange({ name: e.target.value })}
        />
      </header>

      <section className="si-section">
        <div className="si-grid si-grid-3">
          <NumField label="Start" value={scene.start} step={0.1} unit="s" onChange={(v) => handleTimingChange({ start: v })} />
          <NumField label="Length" value={scene.duration} step={0.1} unit="s" min={0.05} onChange={(v) => handleTimingChange({ duration: v })} />
          <ReadField label="Ends" value={`${(scene.start + scene.duration).toFixed(2)}s`} />
        </div>
      </section>

      {onRefineScene && (
        <section className="si-section">
          <div className="si-quick-actions">
            <button
              type="button"
              className="si-btn"
              onClick={() => onRefineScene(scene.id, buildSceneRefinePrompt(scene, "Refaça esta cena do zero, mantendo apenas o id e a duração. Visual, motion e copy podem mudar."))}
              title="Regenerate this scene"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10" />
              </svg>
              Refazer cena
            </button>
            <button
              type="button"
              className="si-btn"
              onClick={() => onRefineScene(scene.id, buildSceneRefinePrompt(scene, `Pula esta cena: remove todo o conteúdo dela, mantém só o <section data-scene="${scene.id}"> vazio com a duração original, ajusta a manifest pra refletir.`))}
              title="Empty this scene (keeps slot, drops content)"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Skip
            </button>
          </div>
        </section>
      )}

      <section className="si-section">
        <div className="si-section-label">Text</div>
        {snippets.length > 0 && (
          <div className="si-snippets">
            {snippets.slice(0, 6).map((s, i) => (
              <button
                key={`${s}-${i}`}
                type="button"
                className="si-snippet"
                onClick={() => {
                  setFindDraft(s);
                  setReplaceDraft(s);
                  setTextNotice(null);
                  window.setTimeout(() => { replaceRef.current?.focus(); replaceRef.current?.select(); }, 0);
                }}
                title="Click to fill find/replace"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="si-grid si-grid-2">
          <input
            type="text"
            className="si-input"
            placeholder="Find"
            value={findDraft}
            onChange={(e) => setFindDraft(e.target.value)}
          />
          <input
            ref={replaceRef}
            type="text"
            className="si-input"
            placeholder="Replace with"
            value={replaceDraft}
            onChange={(e) => setReplaceDraft(e.target.value)}
          />
        </div>
        <div className="si-row-end">
          {textNotice && <span className="si-notice">{textNotice}</span>}
          <button
            type="button"
            className="si-btn"
            onClick={handleFindReplace}
            disabled={!findDraft.trim()}
          >
            Replace
          </button>
        </div>
      </section>

      {onRefineScene && (
        <section className="si-section">
          <div className="si-section-label">Refine in chat</div>
          <textarea
            className="si-textarea"
            rows={3}
            value={refineDraft}
            onChange={(e) => setRefineDraft(e.target.value)}
            placeholder={`What to change in ${scene.id}?`}
          />
          <div className="si-row-end">
            <button type="button" className="si-btn si-btn-primary" onClick={handleRefine}>
              Send
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function NumField({
  label, value, step, unit, min, onChange,
}: {
  label: string;
  value: number;
  step: number;
  unit: string;
  min?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="si-field">
      <span className="si-field-label">{label}</span>
      <span className="si-field-input-wrap">
        <input
          type="number"
          className="si-input si-input-num"
          value={value}
          step={step}
          min={min}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="si-field-unit">{unit}</span>
      </span>
    </label>
  );
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <label className="si-field">
      <span className="si-field-label">{label}</span>
      <span className="si-field-readonly">{value}</span>
    </label>
  );
}

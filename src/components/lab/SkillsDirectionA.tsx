// SkillsDirectionA — unified Criar/Importar skill flow in the faceplate
// language. Mode toggle (two tactile keys) → the matching form. Reuses the
// dsl-* tactile vocabulary from the DS lab. Presentational: submit is stubbed
// (logs intent); real installSkill / import re-wires when this is chosen.

import { useRef, useState } from "react";
import { ArrowRight, Folder, Link, Sparkles, Upload, type LucideIcon } from "lucide-react";
import {
  installSkill, fetchUrlViaBridge, listFolder, readFileViaBridge,
  parseSkillMarkdown, type CreateSkillInput, type Skill,
} from "@/lib/claude-bridge";
import { parseSkillZip } from "@/lib/skill-zip-import";
import type { UseSkillRegistry } from "@/hooks/useSkillRegistry";

type Mode = "create" | "import";
type ImportSource = "upload" | "url" | "folder";

function slugify(name: string): string {
  return "/" + name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const IMPORT_SOURCES: Array<{ id: ImportSource; Icon: LucideIcon; name: string; hint: string; placeholder?: string }> = [
  { id: "upload", Icon: Upload, name: "Upload", hint: "Suba um arquivo .md ou um bundle .zip de skill.", placeholder: undefined },
  { id: "url",    Icon: Link,   name: "URL",    hint: "Cole a URL de um SKILL.md ou bundle publicado.", placeholder: "https://…/SKILL.md" },
  { id: "folder", Icon: Folder, name: "Pasta",  hint: "Escolha skills de uma pasta skills/ (ou .claude/skills/ legado).", placeholder: "~/projeto/skills" },
];

interface Props {
  initialMode: Mode;
  onClose: () => void;
  registry: UseSkillRegistry;
  onCreated: (skill: Skill) => void;
  onImported: (skill: Skill) => void;
}

export function SkillsDirectionA({ initialMode, onClose, onCreated, onImported }: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);

  // create state
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("");
  const [triggerEdited, setTriggerEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");

  // import state
  const [source, setSource] = useState<ImportSource>("upload");
  const [importValue, setImportValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeSource = IMPORT_SOURCES.find((s) => s.id === source)!;

  // submission shared state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCreate = name.trim().length > 0 && trigger.trim().length > 0 && body.trim().length > 0 && !saving;

  const onNameChange = (v: string) => {
    setName(v);
    if (!triggerEdited) setTrigger(v ? slugify(v) : "");
  };

  // Shared install path for imports — minimal version without the staging
  // preview screen the old SkillImportModal had. The user can fine-tune the
  // imported skill via Skill Detail after.
  const installStaged = async (input: CreateSkillInput) => {
    setSaving(true);
    const result = await installSkill(input);
    setSaving(false);
    if ("error" in result) { setError(result.error); return; }
    onImported(result);
    onClose();
  };

  const handleFileUpload = async (file: File) => {
    setError(null);
    try {
      if (file.name.toLowerCase().endsWith(".zip")) {
        const parsed = parseSkillZip(new Uint8Array(await file.arrayBuffer()), file.name);
        await installStaged(parsed.installInput);
        return;
      }
      if (file.size > 200_000) { setError(`${file.name} é grande demais (máx 200KB para SKILL.md)`); return; }
      const text = await file.text();
      const parsed = parseSkillMarkdown(text);
      const fallback = file.name.replace(/\.md$/i, "").replace(/[-_]/g, " ").trim();
      await installStaged({
        name: parsed.name ?? fallback,
        trigger: parsed.trigger ?? "",
        description: parsed.description,
        body: parsed.body,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const submit = async () => {
    if (saving) return;
    setError(null);
    if (mode === "create") {
      if (!canCreate) return;
      setSaving(true);
      const result = await installSkill({
        name: name.trim(),
        trigger: trigger.trim(),
        description: description.trim() || null,
        body,
      });
      setSaving(false);
      if ("error" in result) { setError(result.error); return; }
      onCreated(result);
      onClose();
      return;
    }
    // Import — different action per source.
    if (source === "upload") { fileInputRef.current?.click(); return; }
    const raw = importValue.trim();
    if (!raw) { setError(source === "url" ? "Cole uma URL." : "Cole o caminho da pasta."); return; }
    setSaving(true);
    try {
      if (source === "url") {
        const res = await fetchUrlViaBridge(raw);
        if ("error" in res) throw new Error(res.error);
        const md = res.html;
        if (raw.toLowerCase().endsWith(".zip")) throw new Error("ZIP via URL ainda não — use Upload.");
        const parsed = parseSkillMarkdown(md);
        const fallback = raw.split("/").pop()?.replace(/\.md$/i, "").replace(/[-_]/g, " ").trim() ?? "";
        await installStaged({
          name: parsed.name ?? fallback,
          trigger: parsed.trigger ?? "",
          description: parsed.description,
          body: parsed.body,
        });
        return;
      }
      // folder — walk the source tree (depth ≤ 3), find SKILL.md
      // manifest, bundle every sibling/child file as extraFiles. Mirrors
      // parseSkillZip so a folder-imported skill arrives with the same
      // shape as a zip-imported one (references/, scripts/, assets/, …).
      type Entry = { path: string; name: string; size: number; relPath: string };
      const all: Entry[] = [];
      const walk = async (p: string, depth: number, rel: string) => {
        if (depth > 3 || all.length >= 80) return;
        const r = await listFolder(p);
        if (!r || "error" in r) return;
        for (const e of r.entries) {
          if (all.length >= 80) break;
          const childRel = rel ? `${rel}/${e.name}` : e.name;
          if (e.isDir) {
            if (/node_modules|\.git|dist|build/.test(e.name)) continue;
            await walk(e.path, depth + 1, childRel);
            continue;
          }
          all.push({ path: e.path, name: e.name, size: e.size, relPath: childRel });
        }
      };
      await walk(raw, 0, "");

      // Manifest selection: prefer SKILL.md (any case, any depth), else
      // shallowest .md with `name:` frontmatter. parseSkillZip uses the
      // same priority.
      const mdEntries = all.filter((e) => e.name.toLowerCase().endsWith(".md") && e.size <= 200_000);
      if (mdEntries.length === 0) throw new Error("Nenhum .md encontrado nessa pasta.");
      const skillMdMatch = mdEntries.find((e) => /^SKILL\.md$/i.test(e.name));
      let manifest: Entry | null = null;
      let manifestParsed: ReturnType<typeof parseSkillMarkdown> | null = null;
      if (skillMdMatch) {
        const f = await readFileViaBridge(skillMdMatch.path);
        if (f?.isText) {
          manifest = skillMdMatch;
          manifestParsed = parseSkillMarkdown(f.content);
        }
      }
      if (!manifest) {
        const candidates = [...mdEntries].sort((a, b) => a.relPath.split("/").length - b.relPath.split("/").length);
        for (const c of candidates) {
          const f = await readFileViaBridge(c.path);
          if (!f?.isText) continue;
          const parsed = parseSkillMarkdown(f.content);
          if (parsed.name) { manifest = c; manifestParsed = parsed; break; }
        }
      }
      if (!manifest || !manifestParsed) throw new Error("Nenhuma SKILL.md (ou .md com `name:` no frontmatter) encontrada.");

      // Collect siblings relative to the manifest's folder. Files outside
      // the manifest's subtree are skipped — same rule as parseSkillZip.
      const manifestDir = manifest.relPath.includes("/")
        ? manifest.relPath.slice(0, manifest.relPath.lastIndexOf("/") + 1)
        : "";
      const extraFiles: Record<string, string> = {};
      const textToBase64 = (text: string): string => {
        // utf-8 string → base64. btoa() chokes on multi-byte chars,
        // so route through TextEncoder.
        const bytes = new TextEncoder().encode(text);
        let bin = "";
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        return btoa(bin);
      };
      for (const entry of all) {
        if (entry.path === manifest.path) continue;
        if (entry.size > 1_000_000) continue; // skip oversized assets (1MB cap per extra)
        if (manifestDir && !entry.relPath.startsWith(manifestDir)) continue;
        const rel = manifestDir ? entry.relPath.slice(manifestDir.length) : entry.relPath;
        if (!rel || rel.includes("..") || rel.startsWith("/")) continue;
        if (/^SKILL\.md$/i.test(rel)) continue; // never overwrite the manifest slot
        const f = await readFileViaBridge(entry.path);
        if (!f) continue;
        // f.content is utf-8 for text files, data URI for binary.
        // For binary, strip the `data:...;base64,` prefix.
        if (f.isText) {
          extraFiles[rel] = textToBase64(f.content);
        } else {
          const comma = f.content.indexOf(",");
          if (comma < 0) continue;
          extraFiles[rel] = f.content.slice(comma + 1);
        }
      }

      const fallbackName = raw.split(/[/\\]/).filter(Boolean).pop() || "";
      await installStaged({
        name: manifestParsed.name ?? fallbackName,
        trigger: manifestParsed.trigger ?? "",
        description: manifestParsed.description,
        body: manifestParsed.body,
        extraFiles: Object.keys(extraFiles).length > 0 ? extraFiles : undefined,
      });
    } catch (e) {
      setSaving(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div>
      {/* Mode — two tactile keys */}
      <div className="dsl-zone">
        <span className="dsl-engrave">o que você quer</span>
        <div className="dsl-keys dsl-keys--2">
          <button type="button" className="dsl-key" data-active={mode === "create"} onClick={() => setMode("create")}>
            <div className="dsl-key-head">
              <span className="dsl-key-glyph" aria-hidden="true"><Sparkles size={20} strokeWidth={2} /></span>
              <span className="dsl-key-led" aria-hidden="true" />
            </div>
            <span className="dsl-key-name">Criar do zero</span>
          </button>
          <button type="button" className="dsl-key" data-active={mode === "import"} onClick={() => setMode("import")}>
            <div className="dsl-key-head">
              <span className="dsl-key-glyph" aria-hidden="true"><Upload size={20} strokeWidth={2} /></span>
              <span className="dsl-key-led" aria-hidden="true" />
            </div>
            <span className="dsl-key-name">Importar</span>
          </button>
        </div>
      </div>

      {mode === "create" ? (
        <>
          <div className="dsl-zone">
            <span className="dsl-engrave">nome</span>
            <input className="dsl-input" value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="Minha skill" spellCheck={false} autoComplete="off" style={{ fontFamily: "var(--df-font-sans)" }} />
          </div>
          <div className="dsl-zone">
            <span className="dsl-engrave">trigger</span>
            <input className="dsl-input" value={trigger} onChange={(e) => { setTrigger(e.target.value); setTriggerEdited(true); }} placeholder="/minha-skill" spellCheck={false} autoComplete="off" />
          </div>
          <div className="dsl-zone">
            <span className="dsl-engrave">descrição</span>
            <input className="dsl-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="O que essa skill faz e quando usar" spellCheck={false} autoComplete="off" style={{ fontFamily: "var(--df-font-sans)" }} />
          </div>
          <div className="dsl-zone">
            <span className="dsl-engrave">corpo (instruções)</span>
            <textarea className="dsl-textarea" value={body} onChange={(e) => setBody(e.target.value)} placeholder="As instruções que o agente segue quando a skill é ativada…" spellCheck={false} />
          </div>
        </>
      ) : (
        <>
          <div className="dsl-zone">
            <span className="dsl-engrave">de onde</span>
            <div className="dsl-keys dsl-keys--3">
              {IMPORT_SOURCES.map((s) => (
                <button key={s.id} type="button" className="dsl-key" data-active={source === s.id} onClick={() => setSource(s.id)}>
                  <div className="dsl-key-head">
                    <span className="dsl-key-glyph" aria-hidden="true"><s.Icon size={20} strokeWidth={2} /></span>
                    <span className="dsl-key-led" aria-hidden="true" />
                  </div>
                  <span className="dsl-key-name">{s.name}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="dsl-zone">
            <span className="dsl-engrave">{source === "upload" ? "arquivo" : "entrada"}</span>
            <div className="dsl-bowl">
              {source === "upload" ? (
                <div className="dsl-bowl-hint">
                  {activeSource.hint}
                  <div style={{ marginTop: 10 }}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".md,.zip"
                      style={{ display: "none" }}
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) await handleFileUpload(f);
                      }}
                    />
                    <button
                      className="dsl-engine-chip"
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={saving}
                    >
                      <Upload size={14} strokeWidth={2} aria-hidden="true" /> Escolher .md ou .zip…
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="dsl-bowl-hint" style={{ marginBottom: 9 }}>{activeSource.hint}</div>
                  <input className="dsl-input" value={importValue} onChange={(e) => setImportValue(e.target.value)} placeholder={activeSource.placeholder} spellCheck={false} autoComplete="off" />
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Footer — premium begin */}
      {error && (
        <div className="dsl-zone" style={{ color: "var(--df-accent-danger)", fontSize: "var(--df-text-xs)" }} role="alert">
          {error}
        </div>
      )}

      <div className="dsl-foot" style={{ justifyContent: "flex-end" }}>
        <button
          type="button"
          className={`cnp-begin cnp-begin--v8${saving ? " is-loading" : ""}`}
          onClick={() => { void submit(); }}
          disabled={mode === "create" ? !canCreate : saving}
          aria-busy={saving}
        >
          <span className="cnp-begin-led" aria-hidden="true" />
          <span className="cnp-begin-label">
            {saving ? (mode === "create" ? "Criando…" : "Importando…") : (mode === "create" ? "Criar skill" : "Importar skill")}
          </span>
          <span className="cnp-begin-arrow" aria-hidden="true"><ArrowRight size={16} strokeWidth={2} /></span>
        </button>
      </div>
    </div>
  );
}

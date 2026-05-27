import { useState, useEffect, useCallback, useRef } from "react";
import {
  listFolder,
  readFileViaBridge,
  writeFile,
  writeBinaryViaBridge,
  ghHasToken,
  ghListRepos,
  ghDeviceStart,
  ghDevicePoll,
  gitShallowClone,
  gitCleanup,
  designSystemsDir,
  BRIDGE_URL,
  type GithubRepo,
} from "@/lib/claude-bridge";
import {
  defaultModelForProvider,
  readLastModel,
  writeLastModel,
  useLiveModelOptions,
} from "@/providers/model-lists";
import type { ProviderId } from "@/providers/types";

// Derive a stable, filesystem-safe slug for the persistent DS directory.
// Shared by GitHub (from repo fullName) and Upload (from DS name or filename)
// so the bridge endpoint gets the same shape regardless of source.
function dsSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, "")        // drop file extension
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
import {
  invokeDsGeneration,
  buildFolderPrompt,
  buildGithubPrompt,
  looksLikeDesignMd,
} from "@/runtime/ds-invoker";
// ModalClose dropped 2026-05-21 — DS modal close uses cnp-foot-reset
// chrome, same as the NewProject + Skill modals.
// NewProject canonical chrome (.settings-kicker, .settings-title,
// .cnp-foot-reset, .cnp-foot-row) pulled in here so the DS modal
// renders correctly before NewProject has been opened.
import "@/styles/np-canonical-plus.css";
import { Logo } from "@/components/Logo";
import { useT } from "@/i18n";

export interface DsEntry {
  name: string;
  path: string;
  designMdPath: string;
  source: "folder" | "github" | "upload" | "paste";
  sourceRef?: string;
  addedAt: number;
  /** Optional cover image saved next to design.md as cover.{ext}. */
  coverPath?: string;
  /** Absolute path to preview.html when the user has generated one via
   *  the Generate Preview modal. Surfaced by /fs/list-design-systems
   *  alongside coverPath. */
  previewPath?: string;
}

interface Props {
  onClose: () => void;
  /** Navega pro preview após o DS ser gerado (botão "Open preview"). */
  onSaved: (entry: DsEntry) => void;
  /**
   * Persiste o DS assim que a geração completa, sem depender do usuário
   * clicar "Open preview". Fecha o bug onde "Close" / ESC / click-fora
   * descartavam o DS mesmo com o design.md já gravado no disco.
   */
  onAutoPersist?: (entry: DsEntry) => void;
}

type Source = "folder" | "github" | "upload" | "paste";

const CSS_LIKE_EXT = [".css", ".scss", ".sass", ".less", ".md", ".yaml", ".yml", ".json", ".ts", ".js"];
const DS_HINT_NAMES = ["globals.css", "tokens.css", "theme.css", "design.md", "DESIGN.md", "design-system.md", "tailwind.config", "tokens.json", "theme.ts"];

// ─── Shell ────────────────────────────────────────────────────────────────

export function DsSetupModal({ onClose, onSaved, onAutoPersist }: Props) {
  const { t } = useT();
  const [source, setSource] = useState<Source>("folder");
  const [status, setStatus] = useState<"idle" | "generating" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [outputMd, setOutputMd] = useState("");
  const [systemName, setSystemName] = useState("");
  // Preview-generation intent + active source tab's submit action —
  // both live at the modal level so the unified modal footer can
  // render them together. Each source tab calls setSubmit on render
  // with its current { label, disabled, onClick }; this lets a single
  // primary CTA in the footer drive whichever tab is active.
  const [genPreview, setGenPreview] = useState(true);
  const [genProvider, setGenProvider] = useState<ProviderId>("claude");
  const [genModel, setGenModel] = useState<string>(() => readLastModel("claude") ?? defaultModelForProvider("claude"));
  const handleGenProviderChange = (p: ProviderId) => {
    setGenProvider(p);
    setGenModel(readLastModel(p) ?? defaultModelForProvider(p));
  };
  const [submit, setSubmit] = useState<{ label: string; disabled: boolean; onClick: () => void } | null>(null);
  const [targetFolder, setTargetFolder] = useState("");
  const [savedEntry, setSavedEntry] = useState<DsEntry | null>(null);
  // Dedup guard — useEffect com deps [status, savedEntry] roda também em
  // re-renders com mesmo par; sem isso chamariamos onAutoPersist várias vezes
  // pro mesmo entry. HomeScreen.handleDsSaved é idempotente por path, mas
  // mesmo assim evitar noise.
  const persistedPathRef = useRef<string | null>(null);

  // Auto-persist decoupled from "Open preview" navigation: o arquivo design.md
  // já foi gravado por saveDs(), então faz sentido registrar no localStorage/
  // SQLite imediatamente. "Close" / ESC / click-fora não descartam mais.
  useEffect(() => {
    if (status !== "done" || !savedEntry) return;
    if (persistedPathRef.current === savedEntry.path) return;
    persistedPathRef.current = savedEntry.path;
    onAutoPersist?.(savedEntry);
  }, [status, savedEntry, onAutoPersist]);

  const appendLog = (msg: string) => setLog((prev) => [...prev.slice(-40), msg]);
  const reset = () => { setStatus("idle"); setError(null); setLog([]); setOutputMd(""); };

  // genProvider/genModel double as the design.md generation pick for
  // folder/github (and as the preview pick downstream). The user picks
  // once in the source tab and it flows through both stages.
  const handleGenerate = useCallback(async (prompt: string, tgt: string, name: string, src: DsEntry["source"], sourceRef?: string) => {
    setTargetFolder(tgt);
    setSystemName(name);
    setStatus("generating");
    setOutputMd("");
    writeLastModel(genProvider, genModel);
    appendLog(`streaming from ${genProvider} · ${genModel}…`);
    let acc = "";
    await invokeDsGeneration(prompt, {
      onText: (t) => { acc += t; setOutputMd(acc); },
      onMeta: (m) => appendLog(`model ${m.model ?? "?"} · ttft ${m.ttftMs ?? "?"}ms`),
      onUsage: () => {},
      onResult: (r) => appendLog(`done · ${r.durationMs ?? "?"}ms · $${(r.costUsd ?? 0).toFixed(4)}`),
      onDone: (clean) => {
        setOutputMd(clean);
        saveDs(clean, tgt, name, src, sourceRef).catch((e) => { setError(String(e)); setStatus("error"); });
      },
      onError: (e) => { setError(e); setStatus("error"); },
    }, { provider: genProvider, model: genModel });
  }, [genProvider, genModel]);

  // Fast path for design.md uploads. When the user already has a canonical
  // design.md in hand, they expect the app to use it as-is — not pipe it
  // through Claude for "normalization" that risks rewriting their tokens.
  // This bypasses invokeDsGeneration entirely and writes the file straight
  // to disk.
  const handleSaveDirect = useCallback(async (content: string, tgt: string, name: string, src: DsEntry["source"], sourceRef?: string) => {
    setTargetFolder(tgt);
    setSystemName(name);
    setOutputMd(content);
    appendLog(`saving as-is (no processing)…`);
    saveDs(content, tgt, name, src, sourceRef).catch((e) => { setError(String(e)); setStatus("error"); });
  }, []);

  const saveDs = async (markdown: string, folder: string, name: string, src: DsEntry["source"], sourceRef?: string) => {
    setStatus("saving");
    // Guard against empty / near-empty generations. Claude sometimes closes
    // the stream without any text (auth hiccup, provider glitch) and we'd
    // happily write an empty design.md — the DS appears in the grid with
    // nothing inside. Fail loud instead so the user can retry.
    const trimmed = (markdown ?? "").trim();
    if (trimmed.length < 40) {
      const detail = trimmed.length === 0
        ? "The provider returned no content."
        : `Only ${trimmed.length} chars came back — looks truncated.`;
      console.error("[ds] generation produced empty markdown", { folder, name, length: trimmed.length });
      appendLog(`error — ${detail}`);
      setError(`${detail} Nothing was saved to disk. Retry.`);
      setStatus("error");
      return;
    }
    const designMdPath = folder.replace(/\/$/, "") + "/design.md";
    try {
      await writeFile(designMdPath, markdown);
    } catch (e) {
      console.error("[ds] writeFile failed", designMdPath, e);
      setError(`Could not write design.md to ${designMdPath}: ${String(e)}`);
      setStatus("error");
      return;
    }
    // Verify the write landed. In browser mode writeFile quietly falls back
    // to a blob download if the bridge is unreachable — the file ends up in
    // the user's Downloads, not the target folder. Read it back to confirm.
    const readback = await readFileViaBridge(designMdPath).catch(() => null);
    if (!readback || !readback.content || readback.content.trim().length < 40) {
      console.error("[ds] readback failed after write", designMdPath, { got: readback?.content?.length ?? 0 });
      setError(`design.md saved as a download instead of to ${folder}. The bridge may be offline — make sure the dev bridge is running or run the app in Tauri.`);
      setStatus("error");
      return;
    }
    appendLog(`saved → ${designMdPath} (${readback.size} bytes)`);
    const entry: DsEntry = {
      name: name || folder.split("/").filter(Boolean).pop() || "design system",
      path: folder,
      designMdPath,
      source: src,
      sourceRef,
      addedAt: Date.now(),
    };
    setSavedEntry(entry);
    setStatus("done");
  };

  // Match NewProject modal v9 canonical aesthetic:
  //   · Faceplate with logo glow + mono-uppercase kicker + display title
  //   · No corner rivets (user spec v9 + )
  //   · Skeu picker keys for source rail (uppercase mono, premium tátil)
  //   · Footer right-aligned smaller (status left, close button right)
  return (
    <div
      onClick={onClose}
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
        className="ds-setup-modal-shell"
      >
        {/* FACEPLATE — user ask 2026-05-21: DS modal absorbs the
            NewProject editorial header (kicker + title hero) so every
            primary surface in the app reads in the same family. Logo
            stays on the left as a small mark, the close affordance
            switches to the cnp-foot-reset chrome used everywhere else.
            Left rail + right main grid below is preserved — DS-setup
            has its own picker keys (paste / upload / github / folder)
            that NewProject doesn't have an equivalent for. */}
        <div className="ds-setup-face" style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          gap: 18,
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flex: 1, minWidth: 0 }}>
            <Logo size={28} style={{ marginTop: 6, flexShrink: 0 }} />
            <div>
              <div className="settings-kicker" style={{ marginBottom: 0 }}>
                Design System · any input → design.md
              </div>
              <h1 className="settings-title" style={{ marginTop: 4, marginBottom: 0 }}>
                Novo design system
              </h1>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="cnp-foot-reset"
            style={{ minWidth: 36, padding: "8px 12px", fontSize: 12, flexShrink: 0 }}
          >
            ✕
          </button>
        </div>

        {/* LEFT RAIL — skeu picker keys */}
        <nav className="ds-setup-rail">
          <button
            type="button"
            className="ds-setup-rail-key"
            aria-pressed={source === "paste"}
            onClick={() => { setSource("paste"); reset(); }}
          >
            <IconClipboard />
            <span>{t("dssetup.paste")}</span>
          </button>
          <button
            type="button"
            className="ds-setup-rail-key"
            aria-pressed={source === "upload"}
            onClick={() => { setSource("upload"); reset(); }}
          >
            <IconUpload />
            <span>{t("dssetup.upload")}</span>
          </button>
          <button
            type="button"
            className="ds-setup-rail-key"
            aria-pressed={source === "github"}
            onClick={() => { setSource("github"); reset(); }}
          >
            <IconBranch />
            <span>GitHub</span>
          </button>
          <button
            type="button"
            className="ds-setup-rail-key"
            aria-pressed={source === "folder"}
            onClick={() => { setSource("folder"); reset(); }}
          >
            <IconFolder />
            <span>{t("dssetup.folder")}</span>
          </button>
          <div style={{ flex: 1 }} />
        </nav>

        {/* RIGHT PANEL — content */}
        <main style={{
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>
          {status === "idle" && source === "folder" && (
            <FolderTab
              onGenerate={(prompt, folder, name) => handleGenerate(prompt, folder, name, "folder")}
              appendLog={appendLog}
              setSubmit={setSubmit}
            />
          )}
          {status === "idle" && source === "github" && (
            <GithubTab
              onGenerate={(prompt, folder, name, repo) => handleGenerate(prompt, folder, name, "github", repo)}
              appendLog={appendLog}
              setSubmit={setSubmit}
            />
          )}
          {status === "idle" && source === "upload" && (
            <UploadTab
              onSaveDirect={(content, folder, name, fileName) => handleSaveDirect(content, folder, name, "upload", fileName)}
              appendLog={appendLog}
              setSubmit={setSubmit}
            />
          )}
          {status === "idle" && source === "paste" && (
            <PasteTab
              onSaveDirect={(content, folder, name) => handleSaveDirect(content, folder, name, "paste")}
              appendLog={appendLog}
              setSubmit={setSubmit}
            />
          )}

          {status !== "idle" && (
            <ProgressPane
              status={status}
              error={error}
              log={log}
              outputMd={outputMd}
              systemName={systemName}
              targetFolder={targetFolder}
              savedEntry={savedEntry}
              onRetry={reset}
              onClose={onClose}
              onSaved={onSaved}
              genPreview={genPreview}
              genProvider={genProvider}
              genModel={genModel}
            />
          )}
        </main>

        {/* FOOTER — single unified bar holding the global provider/model
         *  picker, the "generate preview" checkbox, and the primary
         *  action button. Per-tab footers got dropped (cleaner UX +
         *  cuts visual noise). Each source tab still publishes its
         *  action via setSubmit; the modal owns the chrome. */}
        <ModalFooter
          status={status}
          source={source}
          submit={submit}
          genProvider={genProvider}
          genModel={genModel}
          genPreview={genPreview}
          onProviderChange={handleGenProviderChange}
          onModelChange={setGenModel}
          onPreviewChange={setGenPreview}
        />
      </div>
    </div>
  );
}

// ─── SVG icons (no emojis) ────────────────────────────────────────────────

function IconFolder() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function IconBranch() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  );
}
function IconUpload() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
function IconClipboard() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  );
}
function IconArrow() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
// ─── Panel shell ─────────────────────────────────────────────────────────

function PanelShell({
  title, hint, children, footer,
}: {
  title: string; hint: string;
  children: React.ReactNode;
  /** Optional pre-2026-05-17 footer slot. Most tabs publish their
   *  primary action via setSubmit to the modal-level footer now;
   *  legacy panes that still pass children render them as a bottom
   *  strip. ProgressPane uses this for its Close/Open Preview pair. */
  footer?: React.ReactNode;
}) {
  return (
    <>
      <div style={{
        padding: "18px 22px 14px",
        borderBottom: "1px solid var(--df-border-subtle)",
      }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--df-text-primary)" }}>{title}</div>
        <div style={{ fontSize: 11, color: "var(--df-text-muted)", marginTop: 3, lineHeight: 1.5 }}>{hint}</div>
      </div>
      <div style={{
        flex: 1, overflow: "auto",
        padding: "18px 22px",
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        {children}
      </div>
      {footer && (
        <div style={{
          padding: "12px 22px",
          borderTop: "1px solid var(--df-border-subtle)",
          background: "var(--df-bg-section)",
          display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8,
        }}>
          {footer}
        </div>
      )}
    </>
  );
}

// ─── Folder Tab ───────────────────────────────────────────────────────────

function FolderTab({
  onGenerate, appendLog, setSubmit,
}: {
  onGenerate: (prompt: string, folder: string, name: string) => void;
  appendLog: (m: string) => void;
  setSubmit: (s: { label: string; disabled: boolean; onClick: () => void } | null) => void;
}) {
  const { t } = useT();
  const [folder, setFolder] = useState("");
  const [name, setName] = useState("");
  const [files, setFiles] = useState<Array<{ path: string; content: string }>>([]);
  const [scanning, setScanning] = useState(false);

  const handlePick = async () => {
    let picked: string | null = null;
    if ("showDirectoryPicker" in window) {
      try {
        await (window as any).showDirectoryPicker();
        const typed = window.prompt("Confirm the absolute path of the folder you just picked (browser can't read it directly):");
        if (typed) picked = typed.trim();
      } catch (e) {
        appendLog(`folder pick cancelled: ${e}`);
        return;
      }
    } else {
      const typed = window.prompt("Paste the absolute path of the folder:");
      if (typed) picked = typed.trim();
    }
    if (!picked) return;
    setFolder(picked);
    if (!name) setName(picked.split("/").filter(Boolean).pop() || "design system");
    await scanFolder(picked);
  };

  const scanFolder = async (root: string) => {
    setScanning(true);
    setFiles([]);
    try {
      const seen: Array<{ path: string; content: string }> = [];
      const walk = async (p: string, depth: number) => {
        if (depth > 3 || seen.length > 20) return;
        const res = await listFolder(p);
        if (!res || "error" in res) return;
        for (const e of res.entries) {
          if (seen.length >= 20) break;
          if (e.isDir) {
            if (/node_modules|\.git|dist|build|\.next|\.turbo|coverage/.test(e.name)) continue;
            await walk(e.path, depth + 1);
          } else {
            const ext = "." + e.name.split(".").pop()!.toLowerCase();
            const isDsHint = DS_HINT_NAMES.some((hint) => e.name.toLowerCase().includes(hint.toLowerCase()));
            if (!CSS_LIKE_EXT.includes(ext) && !isDsHint) continue;
            if (e.size > 200_000) continue;
            const f = await readFileViaBridge(e.path);
            if (f?.isText) seen.push({ path: e.path, content: f.content });
          }
        }
      };
      await walk(root, 0);
      setFiles(seen);
      appendLog(`scanned ${seen.length} file(s)`);
    } finally { setScanning(false); }
  };

  const canGo = !!(folder && files.length > 0 && !scanning);
  const go = () => {
    if (!canGo) return;
    onGenerate(
      buildFolderPrompt(files, name || folder.split("/").pop() || "DS"),
      folder,
      name || folder.split("/").pop() || "DS"
    );
  };

  // Publish this tab's action to the modal-level footer.
  useEffect(() => {
    setSubmit({ label: "Generate", disabled: !canGo, onClick: go });
    return () => setSubmit(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canGo, folder, files, name]);

  return (
    <PanelShell
      title={t("dssetup.pick.folder")}
      hint="We'll scan it for tokens, globals.css, theme files, and any existing design.md — then let the picked model produce a canonical design.md inside it."
    >
      <LabeledRow label="Folder">
        <button className="df-btn df-btn--secondary" onClick={handlePick} style={{ alignSelf: "flex-start", fontSize: 12 }}>
          {folder ? "Change" : "Pick…"}
        </button>
        {folder && <Path>{folder}</Path>}
      </LabeledRow>

      {folder && (
        <LabeledRow label="Name">
          <input
            className="df-input"
            type="text"
            placeholder="e.g. My DS"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ maxWidth: 360 }}
          />
        </LabeledRow>
      )}

      {scanning && <Muted>{t("dssetup.scanning")}</Muted>}

      {!scanning && folder && files.length > 0 && (
        <LabeledRow label={`Files (${files.length})`}>
          <div style={{
            maxHeight: 140, overflow: "auto",
            background: "var(--df-bg-base)",
            border: "1px solid var(--df-border-subtle)",
            borderRadius: "var(--df-r-sm)",
            padding: 8,
            fontFamily: "var(--df-font-mono)", fontSize: 10,
            color: "var(--df-text-secondary)",
          }}>
            {files.map((f) => (
              <div key={f.path} style={{ padding: "2px 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {f.path.replace(folder, "")}
              </div>
            ))}
          </div>
        </LabeledRow>
      )}

      {!scanning && folder && files.length === 0 && (
        <Muted>No DS-relevant files found in this folder. Try a different one.</Muted>
      )}

      {folder && (
        <Muted>Will write to <code style={{ fontFamily: "var(--df-font-mono)" }}>{folder}/design.md</code></Muted>
      )}
    </PanelShell>
  );
}

// ─── GitHub Tab ────────────────────────────────────────────────────────────

function GithubTab({
  onGenerate, appendLog, setSubmit,
}: {
  onGenerate: (prompt: string, folder: string, name: string, repoFullName: string) => void;
  appendLog: (m: string) => void;
  setSubmit: (s: { label: string; disabled: boolean; onClick: () => void } | null) => void;
}) {
  const { t } = useT();
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [tokenSource, setTokenSource] = useState<string | null>(null);
  const [pat, setPat] = useState("");
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<GithubRepo | null>(null);
  const [cloning, setCloning] = useState(false);
  const [customUrl, setCustomUrl] = useState("");

  // Device-flow state. userCode is surfaced to the user with a copyable chip
  // alongside a link to verificationUri. The poll loop runs while deviceCode
  // is set and stops when the API returns ok / error / expires.
  const [device, setDevice] = useState<null | {
    deviceCode: string;
    userCode: string;
    verificationUri: string;
    pollingUntil: number; // epoch ms when the code expires
  }>(null);
  const [deviceStatus, setDeviceStatus] = useState<"idle" | "starting" | "polling" | "ok" | "error">("idle");
  const [deviceErr, setDeviceErr] = useState<string | null>(null);

  const refreshAuth = () => {
    ghHasToken().then((r) => { setHasToken(r.hasToken); setTokenSource(r.source); });
  };

  useEffect(() => { refreshAuth(); }, []);

  const loadRepos = async (override?: string) => {
    setLoading(true);
    const r = await ghListRepos({ search, pat: override || pat || undefined, limit: 100 });
    setLoading(false);
    if ("error" in r) { appendLog(`gh error: ${r.error}`); return; }
    setRepos(r.repos);
  };

  useEffect(() => {
    if (hasToken) loadRepos();
  }, [hasToken]);

  // Poll loop while device flow is active
  useEffect(() => {
    if (!device || deviceStatus !== "polling") return;
    let cancelled = false;
    let delay = 5000;
    const tick = async () => {
      if (cancelled) return;
      if (Date.now() > device.pollingUntil) {
        setDeviceStatus("error");
        setDeviceErr("Code expired. Start again.");
        setDevice(null);
        return;
      }
      const res = await ghDevicePoll(device.deviceCode);
      if (cancelled) return;
      if (res.status === "ok") {
        setDeviceStatus("ok");
        setDevice(null);
        refreshAuth();
        appendLog("github connected via device flow");
        return;
      }
      if (res.status === "error") {
        setDeviceStatus("error");
        setDeviceErr(res.error);
        setDevice(null);
        return;
      }
      if (res.status === "slow_down") delay = Math.min(delay + 5000, 30000);
      setTimeout(tick, delay);
    };
    setTimeout(tick, delay);
    return () => { cancelled = true; };
  }, [device, deviceStatus, appendLog]);

  const handleDeviceConnect = async () => {
    setDeviceErr(null);
    setDeviceStatus("starting");
    const r = await ghDeviceStart();
    if ("error" in r) {
      setDeviceStatus("error");
      setDeviceErr(r.error);
      return;
    }
    setDevice({
      deviceCode: r.deviceCode,
      userCode: r.userCode,
      verificationUri: r.verificationUri,
      pollingUntil: Date.now() + r.expiresIn * 1000,
    });
    setDeviceStatus("polling");
    // Open GitHub in a new tab so the user lands right on the code input
    const target = r.verificationUriComplete || r.verificationUri;
    try { window.open(target, "_blank", "noopener"); } catch {}
  };

  // Two-stage flow per user request: clicking a repo only SELECTS
  // it. The Finalize button in the footer then runs clone+scan+gen.
  // This stops the modal from auto-firing on row click — the user can
  // browse the list, change their mind, configure preview generation,
  // then commit explicitly.
  const handlePickRepo = (repo: GithubRepo) => {
    setSelectedRepo(repo);
    appendLog(`selected ${repo.fullName} — click Finalize to generate`);
  };

  const handleFinalize = async () => {
    if (!selectedRepo || cloning) return;
    setCloning(true);
    appendLog(`cloning ${selectedRepo.fullName}…`);
    const r = await gitShallowClone(selectedRepo.cloneUrl, pat || undefined);
    setCloning(false);
    if ("error" in r) { appendLog(`clone failed: ${r.error}`); return; }
    appendLog(`clone → ${r.path}`);
    const files = await scanRepo(r.path);
    const summary = files.map((f) => f.path.replace(r.path + "/", "")).join("\n");
    const name = selectedRepo.name;
    const cleanupPath = r.path;
    const persistent = await designSystemsDir(dsSlug(selectedRepo.fullName));
    if (!persistent) {
      appendLog(`bridge offline — can't resolve persistent DS dir`);
      return;
    }
    appendLog(`output → ${persistent}/design.md`);
    onGenerate(buildGithubPrompt(selectedRepo.fullName, summary, files), persistent, name, selectedRepo.fullName);
    setTimeout(() => { gitCleanup(cleanupPath).catch(() => {}); }, 5 * 60_000);
  };

  const handleCustomUrl = async () => {
    if (!customUrl.trim()) return;
    const fake: GithubRepo = {
      id: 0, fullName: customUrl.replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, ""),
      name: customUrl.split("/").pop()?.replace(/\.git$/, "") || "repo",
      description: null, cloneUrl: customUrl, htmlUrl: customUrl,
      defaultBranch: "main", private: false, updatedAt: new Date().toISOString(), stargazersCount: 0,
    };
    handlePickRepo(fake);
  };

  // Publish action to the modal footer. "Finalize" only enables once a
  // repo is selected and we're not mid-clone.
  useEffect(() => {
    setSubmit({
      label: cloning ? "Cloning…" : "Finalize",
      disabled: !selectedRepo || cloning,
      onClick: handleFinalize,
    });
    return () => setSubmit(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRepo, cloning, pat]);

  return (
    <PanelShell
      title={t("dssetup.pick.repo")}
      hint="We clone it shallowly to a temp folder, extract relevant files, and generate the design.md there."
    >
      {hasToken === false && (
        <div style={{
          padding: 12,
          background: "var(--df-bg-base)",
          border: "1px solid var(--df-border-subtle)",
          borderRadius: "var(--df-r-md)",
          display: "flex", flexDirection: "column", gap: 8,
        }}>
          <div style={{ fontSize: 12, color: "var(--df-text-secondary)", lineHeight: 1.5 }}>
            Not connected. Pick one:
          </div>

          {/* Device flow — recommended (no CLI, no token to manage) */}
          {!device && deviceStatus !== "ok" && (
            <button
              className="df-btn df-btn--primary"
              style={{ alignSelf: "flex-start", fontSize: 12 }}
              onClick={handleDeviceConnect}
              disabled={deviceStatus === "starting"}
            >
              {deviceStatus === "starting" ? "Preparing…" : "Connect with GitHub"}
            </button>
          )}

          {device && (
            <div style={{
              padding: 10,
              background: "var(--df-surface-elevated)",
              border: "1px solid var(--df-border-strong)",
              borderRadius: "var(--df-r-sm)",
              display: "flex", flexDirection: "column", gap: 6,
            }}>
              <div style={{ fontSize: 11, color: "var(--df-text-muted)" }}>
                1. Open <a href={device.verificationUri} target="_blank" rel="noreferrer" style={{ color: "#80a7ff", textDecoration: "underline" }}>{device.verificationUri}</a>
              </div>
              <div style={{ fontSize: 11, color: "var(--df-text-muted)" }}>
                2. Enter this code:
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <code
                  style={{
                    padding: "6px 12px",
                    fontSize: 18, fontFamily: "var(--df-font-mono)",
                    letterSpacing: "0.15em", fontWeight: 600,
                    background: "var(--df-bg-base)",
                    border: "1px solid var(--df-border-subtle)",
                    borderRadius: "var(--df-r-sm)",
                    color: "var(--df-text-primary)",
                  }}
                >
                  {device.userCode}
                </code>
                <button
                  className="df-btn df-btn--secondary"
                  style={{ fontSize: 11 }}
                  onClick={() => navigator.clipboard?.writeText(device.userCode).catch(() => {})}
                >
                  Copy
                </button>
                <span style={{ fontSize: 10, color: "var(--df-text-faint)", fontFamily: "var(--df-font-mono)" }}>
                  waiting…
                </span>
              </div>
            </div>
          )}

          {deviceErr && (
            <div style={{ fontSize: 11, color: "#ff8b8b" }}>device flow · {deviceErr}</div>
          )}

          {/* PAT fallback */}
          <div style={{ fontSize: 10, color: "var(--df-text-faint)", marginTop: 4 }}>
            Or paste a Personal Access Token (scope <code>repo</code>):
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              className="df-input"
              type="password"
              placeholder="ghp_…"
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              style={{ flex: 1, fontFamily: "var(--df-font-mono)", fontSize: 11 }}
            />
            <button className="df-btn df-btn--secondary" onClick={() => loadRepos(pat)} disabled={!pat.trim()} style={{ fontSize: 12 }}>
              Connect
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 6 }}>
        <input
          className="df-input"
          type="text"
          placeholder={t("dssetup.repos.filter")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") loadRepos(); }}
          style={{ flex: 1, fontSize: 12 }}
        />
        <button className="df-btn df-btn--secondary" onClick={() => loadRepos()} disabled={loading || (!hasToken && !pat)} style={{ fontSize: 12 }}>
          {loading ? "…" : "Refresh"}
        </button>
      </div>

      <div style={{
        flex: 1,
        minHeight: 180,
        overflow: "auto",
        border: "1px solid var(--df-border-subtle)",
        borderRadius: "var(--df-r-sm)",
        background: "var(--df-bg-base)",
      }}>
        {repos.length === 0 && !loading && (
          <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--df-text-faint)", fontSize: 11 }}>
            {hasToken ? "no repos match" : "connect github to list your repos"}
          </div>
        )}
        {repos.map((r) => (
          <button
            key={r.id}
            onClick={() => handlePickRepo(r)}
            disabled={cloning}
            style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "7px 12px",
              background: selectedRepo?.id === r.id ? "var(--df-interactive-hover)" : "transparent",
              border: "none",
              borderBottom: "1px solid var(--df-border-subtle)",
              cursor: cloning ? "wait" : "pointer",
            }}
            onMouseEnter={(e) => { if (!cloning && selectedRepo?.id !== r.id) e.currentTarget.style.background = "var(--df-interactive-hover)"; }}
            onMouseLeave={(e) => { if (selectedRepo?.id !== r.id) e.currentTarget.style.background = "transparent"; }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, fontFamily: "var(--df-font-mono)", color: "var(--df-text-primary)" }}>
                {r.fullName}
              </span>
              {r.private && (
                <span style={{ fontSize: 8, padding: "1px 4px", background: "var(--df-surface-raised)", borderRadius: 2, color: "var(--df-text-faint)", fontFamily: "var(--df-font-mono)", letterSpacing: "0.08em" }}>
                  PRIVATE
                </span>
              )}
            </div>
            {r.description && (
              <div style={{ fontSize: 10, color: "var(--df-text-faint)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.description}
              </div>
            )}
          </button>
        ))}
      </div>

      <LabeledRow label="Or paste any repo URL">
        <input
          className="df-input"
          type="text"
          placeholder="https://github.com/vercel/next.js"
          value={customUrl}
          onChange={(e) => setCustomUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleCustomUrl(); }}
          style={{ flex: 1, fontFamily: "var(--df-font-mono)", fontSize: 11 }}
        />
        <button className="df-btn df-btn--secondary" onClick={handleCustomUrl} disabled={!customUrl.trim() || cloning} style={{ fontSize: 12 }}>
          Select
        </button>
      </LabeledRow>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <AuthChip hasToken={!!hasToken} source={tokenSource} />
        {selectedRepo && (
          <span style={{ fontSize: 11, color: "var(--df-text-muted)", fontFamily: "var(--df-font-mono)" }}>
            · {selectedRepo.fullName}
          </span>
        )}
      </div>
    </PanelShell>
  );
}

// Chip explaining where the GitHub token comes from
function AuthChip({ hasToken, source }: { hasToken: boolean; source?: string | null }) {
  const sourceLabel = source === "gh-cli" ? "gh CLI"
    : source === "device-flow" ? "github · device flow"
    : source ? source : "github";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "3px 8px",
      background: hasToken ? "rgba(95,170,84,0.12)" : "var(--df-bg-base)",
      border: `1px solid ${hasToken ? "rgba(95,170,84,0.35)" : "var(--df-border-subtle)"}`,
      borderRadius: "var(--df-r-sm)",
      fontSize: 10, fontFamily: "var(--df-font-mono)",
      color: hasToken ? "#5faa54" : "var(--df-text-faint)",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 3, background: hasToken ? "#5faa54" : "var(--df-text-faint)" }} />
      {hasToken ? `${sourceLabel} · connected` : "not connected"}
    </div>
  );
}

async function scanRepo(root: string): Promise<Array<{ path: string; content: string }>> {
  const keep: Array<{ path: string; content: string }> = [];
  const walk = async (p: string, depth: number) => {
    if (depth > 4 || keep.length > 10) return;
    const res = await listFolder(p);
    if (!res || "error" in res) return;
    for (const e of res.entries) {
      if (keep.length >= 10) break;
      if (e.isDir) {
        if (/node_modules|\.git|dist|build|\.next|coverage|pnpm-store/.test(e.name)) continue;
        await walk(e.path, depth + 1);
      } else {
        const low = e.name.toLowerCase();
        const isHint = DS_HINT_NAMES.some((n) => low.includes(n.toLowerCase()));
        const isCss = low.endsWith(".css") || low.endsWith(".scss");
        if (!isHint && !isCss) continue;
        if (e.size > 200_000) continue;
        const f = await readFileViaBridge(e.path);
        if (f?.isText) keep.push({ path: e.path, content: f.content });
      }
    }
  };
  await walk(root, 0);
  return keep;
}

// ─── Upload Tab ────────────────────────────────────────────────────────────

function UploadTab({
  onSaveDirect, appendLog, setSubmit,
}: {
  onSaveDirect: (content: string, folder: string, name: string, fileName: string) => void;
  appendLog: (m: string) => void;
  setSubmit: (s: { label: string; disabled: boolean; onClick: () => void } | null) => void;
}) {
  const { t } = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [name, setName] = useState("");

  const handleFilePick = () => fileInputRef.current?.click();
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    setFileName(f.name);
    setFileContent(text);
    if (!name) setName(f.name.replace(/\.[^.]+$/, ""));
    appendLog(`loaded ${f.name} (${(f.size / 1024).toFixed(1)}kb)`);
  };

  const canGo = !!fileContent;
  const pendingSlug = dsSlug(name || fileName || "upload");
  // Heuristic only — drives the hint below, not the dispatch. User
  // decision 2026-05-16: Upload always saves direct, never Claude. The
  // user picked a file intentionally; rewriting their tokens through a
  // model is destructive, not helpful. Folder / GitHub still use Claude
  // because those sources don't have a canonical design.md yet.
  const looksCanonical = canGo && /\.(md|markdown)$/i.test(fileName) && looksLikeDesignMd(fileContent);

  const go = async () => {
    if (!canGo) return;
    const persistent = await designSystemsDir(pendingSlug);
    if (!persistent) {
      appendLog(`bridge offline — can't resolve persistent DS dir`);
      return;
    }
    appendLog(`output → ${persistent}/design.md`);
    onSaveDirect(fileContent, persistent, name || fileName, fileName);
  };

  useEffect(() => {
    setSubmit({ label: t("dssetup.save"), disabled: !canGo, onClick: go });
    return () => setSubmit(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canGo, fileContent, name, fileName, pendingSlug]);

  return (
    <PanelShell
      title={t("dssetup.upload.title")}
      hint={looksCanonical
        ? t("dssetup.upload.hint.canonical")
        : t("dssetup.upload.hint.raw")}
    >
      <input ref={fileInputRef} type="file" accept=".md,.markdown" onChange={handleFileChange} style={{ display: "none" }} />
      <LabeledRow label="File">
        <button className="df-btn df-btn--secondary" onClick={handleFilePick} style={{ alignSelf: "flex-start", fontSize: 12 }}>
          {fileName ? "Replace" : "Pick file…"}
        </button>
        {fileName && <Path>{fileName}</Path>}
      </LabeledRow>
      {fileContent && (
        <>
          <LabeledRow label="Name">
            <input
              className="df-input"
              type="text"
              placeholder={t("dssetup.name.placeholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ maxWidth: 360 }}
            />
          </LabeledRow>
          <LabeledRow label="Preview">
            <div style={{
              flex: 1,
              maxHeight: 160, overflow: "auto",
              padding: 10,
              background: "var(--df-bg-base)",
              border: "1px solid var(--df-border-subtle)",
              borderRadius: "var(--df-r-sm)",
              fontFamily: "var(--df-font-mono)", fontSize: 10,
              color: "var(--df-text-muted)",
              whiteSpace: "pre-wrap",
            }}>
              {fileContent.slice(0, 1800)}{fileContent.length > 1800 ? "\n…" : ""}
            </div>
          </LabeledRow>
        </>
      )}

      {canGo && (
        <Muted>Will write to <code style={{ fontFamily: "var(--df-font-mono)" }}>design-systems/{pendingSlug}/design.md</code></Muted>
      )}
    </PanelShell>
  );
}

// ─── Paste Tab ─────────────────────────────────────────────────────────────
//
// The smallest possible path from an existing design.md sitting in
// someone's clipboard to a registered DS in the app. No file dialog,
// no repo picker — just a textarea. User decision 2026-05-16: this
// tab always saves direct, never via Claude. If someone has the content
// already, the model has nothing to add and risks rewriting their
// tokens. Use Folder / GitHub when there isn't a design.md yet.

function PasteTab({
  onSaveDirect, appendLog, setSubmit,
}: {
  onSaveDirect: (content: string, folder: string, name: string) => void;
  appendLog: (m: string) => void;
  setSubmit: (s: { label: string; disabled: boolean; onClick: () => void } | null) => void;
}) {
  const { t } = useT();
  const [content, setContent] = useState("");
  const [name, setName] = useState("");

  const trimmed = content.trim();
  const canGo = trimmed.length > 0;
  const pendingSlug = dsSlug(name || "pasted");
  // Heuristic only — drives the hint below, not the dispatch. User
  // decision 2026-05-16: Paste always saves direct. If someone has the
  // content already, the model has nothing to add and risks rewriting
  // their tokens. Use Folder / GitHub when there isn't a design.md yet.
  const looksCanonical = canGo && looksLikeDesignMd(content);

  const go = async () => {
    if (!canGo) return;
    const persistent = await designSystemsDir(pendingSlug);
    if (!persistent) {
      appendLog(`bridge offline — can't resolve persistent DS dir`);
      return;
    }
    appendLog(`output → ${persistent}/design.md`);
    const finalName = name || "Pasted DS";
    onSaveDirect(content, persistent, finalName);
  };

  useEffect(() => {
    setSubmit({ label: t("dssetup.save"), disabled: !canGo, onClick: go });
    return () => setSubmit(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canGo, content, name, pendingSlug]);

  return (
    <PanelShell
      title={t("dssetup.paste.title")}
      hint={looksCanonical
        ? t("dssetup.paste.hint.canonical")
        : t("dssetup.paste.hint.raw")}
    >
      <LabeledRow label="Name">
        <input
          className="df-input"
          type="text"
          placeholder={t("dssetup.name.placeholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ maxWidth: 360 }}
        />
      </LabeledRow>
      <LabeledRow label="Paste">
        <textarea
          className="df-input"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t("dssetup.paste.placeholder")}
          spellCheck={false}
          style={{
            // .df-input is sized for single-line inputs (height:36px,
            // padding:0 12px). Textareas need top/bottom padding so
            // text isn't glued to the border + a tall min-height. Both
            // overridden inline. resize:vertical lets the user drag
            // when their pasted doc is long.
            width: "100%",
            height: "auto",
            minHeight: 240,
            maxHeight: 420,
            padding: "14px 16px",
            fontFamily: "var(--df-font-mono)",
            fontSize: 12,
            lineHeight: 1.6,
            resize: "vertical",
            whiteSpace: "pre",
            overflowWrap: "normal",
          }}
        />
      </LabeledRow>

      {canGo && (
        <Muted>Will write to <code style={{ fontFamily: "var(--df-font-mono)" }}>design-systems/{pendingSlug}/design.md</code></Muted>
      )}
    </PanelShell>
  );
}

// ─── Progress / Done Pane ──────────────────────────────────────────────────

function ProgressPane({
  status, error, log, outputMd, systemName, targetFolder, savedEntry, onRetry, onClose, onSaved,
  genPreview, genProvider, genModel,
}: {
  status: string; error: string | null;
  log: string[]; outputMd: string;
  systemName: string; targetFolder: string;
  savedEntry: DsEntry | null;
  onRetry: () => void; onClose: () => void;
  onSaved: (entry: DsEntry) => void;
  /** Generate-preview intent + selection — picked up in the source tab
   *  before reaching this pane. The Done state kicks off the actual
   *  fetch as the user clicks "Open preview" so DsPreviewScreen mounts
   *  with the marker file already on disk. */
  genPreview: boolean;
  genProvider: ProviderId;
  genModel: string;
}) {
  const { t } = useT();
  const handleOpen = () => {
    if (!savedEntry) return;
    if (genPreview) {
      writeLastModel(genProvider, genModel);
      // Fire-and-forget — daemon returns 202; preview state survives
      // because DsPreviewScreen reads .preview-generating.json on mount.
      void fetch(`${BRIDGE_URL}/ds/generate-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dsPath: savedEntry.path,
          designMdPath: savedEntry.designMdPath,
          provider: genProvider,
          model: genModel,
        }),
      }).catch(() => { /* DsPreviewScreen handles surfacing failure */ });
    }
    onSaved(savedEntry);
  };
  const title = status === "generating" ? "Gerando design.md…"
              : status === "saving"     ? "Salvando…"
              : status === "done"       ? "Pronto"
              : status === "error"      ? "Algo falhou"
              : "";

  // Hint must reflect the active path. `generating` is the only state
  // where Claude is in the loop — `saving` is the direct-write path
  // used by Upload + Paste, and surfacing a "Claude is producing…"
  // string there is a lie (user caught this 2026-05-16: "colei um
  // design md e ainda aparece q claude ta processando").
  const hint = status === "done"
    ? `Salvo em ${targetFolder}/design.md. Clica em "Abrir preview" pra inspecionar os tokens.`
    : status === "error"
    ? "Confira o log abaixo e tente de novo."
    : status === "saving"
    ? "Gravando seu design.md no disco — sem processamento."
    : status === "generating"
    ? "Claude está produzindo o markdown canônico. Geralmente 30–60s."
    : "";

  return (
    <PanelShell
      title={title}
      hint={hint}
      footer={
        <>
          <div style={{ flex: 1 }} />
          {status === "done" && savedEntry ? (
            <>
              <button className="df-btn df-btn--secondary" onClick={onClose} style={{ fontSize: 12 }}>{t("dssetup.close")}</button>
              <button className="df-btn df-btn--primary" onClick={handleOpen}>
                {genPreview ? "Open preview + generate" : "Open preview"} <IconArrow />
              </button>
            </>
          ) : status === "error" ? (
            <>
              <button className="df-btn df-btn--secondary" onClick={onClose} style={{ fontSize: 12 }}>{t("dssetup.close")}</button>
              <button className="df-btn df-btn--primary" onClick={onRetry}>{t("dssetup.tryagain")}</button>
            </>
          ) : (
            <div style={{ fontSize: 11, color: "var(--df-text-faint)", fontFamily: "var(--df-font-mono)" }}>
              <InlineSpinner /> {status}…
            </div>
          )}
        </>
      }
    >
      <KV label="system" value={systemName || "—"} />
      <KV label="destination" value={targetFolder ? `${targetFolder}/design.md` : "—"} mono />

      {error && (
        <div style={{
          padding: 10,
          background: "rgba(255,107,107,0.08)",
          border: "1px solid rgba(255,107,107,0.3)",
          borderRadius: "var(--df-r-sm)",
          color: "#ff8b8b", fontSize: 12, lineHeight: 1.5,
        }}>
          {error}
        </div>
      )}

      {log.length > 0 && (
        <div style={{
          padding: 8,
          background: "var(--df-bg-base)",
          border: "1px solid var(--df-border-subtle)",
          borderRadius: "var(--df-r-sm)",
          fontFamily: "var(--df-font-mono)", fontSize: 10, lineHeight: 1.55,
          color: "var(--df-text-muted)",
          maxHeight: 80, overflow: "auto",
        }}>
          {log.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}

      {status === "done" && savedEntry && (
        <CoverUploadRow dsPath={savedEntry.path} />
      )}

      {outputMd && (
        <div style={{
          flex: 1,
          minHeight: 160,
          overflow: "auto",
          padding: 14,
          background: "var(--df-bg-base)",
          border: "1px solid var(--df-border-subtle)",
          borderRadius: "var(--df-r-sm)",
          fontFamily: "var(--df-font-mono)", fontSize: 11,
          color: "var(--df-text-primary)",
          whiteSpace: "pre-wrap", lineHeight: 1.6,
        }}>
          {outputMd}
          {status === "generating" && <span style={{ color: "var(--df-accent-primary, #5faa54)" }}>▋</span>}
        </div>
      )}
    </PanelShell>
  );
}

// ─── Cover Upload Row ─────────────────────────────────────────────────────
//
// Optional cover image step that surfaces on the Done pane. Writes the
// chosen image to `<dsPath>/cover.{ext}` via writeBinaryViaBridge. The
// daemon scan in /fs/list-design-systems then picks it up on the next
// home refresh — no need to plumb the new path back through onSaved,
// because the next listDesignSystemsFromFilesystem() call discovers it.
//
// Constraints (kept loose intentionally — this is a thumb image):
//   · png / jpg / jpeg / webp only
//   · ~5 MB ceiling — bigger and the base64 encode round-trip drags the
//     daemon; not a security limit (the daemon enforces its own).
//   · No image processing: whatever the user picked is what gets saved.
//     The card thumb uses object-fit: cover so awkward aspect ratios
//     still look sane.

// ─── Modal Footer ─────────────────────────────────────────────────────────
//
// Single source of chrome for the bottom strip: provider + model
// picker on the left, "Gerar preview" checkbox in the middle, primary
// action button on the right. The action comes from whichever source
// tab is currently active (each tab publishes via setSubmit). For
// non-idle states (generating / done / error) the picker fades and
// ProgressPane's own footer takes over the action zone.
function ModalFooter({
  status, source, submit,
  genProvider, genModel, genPreview,
  onProviderChange, onModelChange, onPreviewChange,
}: {
  status: string;
  source: Source;
  submit: { label: string; disabled: boolean; onClick: () => void } | null;
  genProvider: ProviderId;
  genModel: string;
  genPreview: boolean;
  onProviderChange: (p: ProviderId) => void;
  onModelChange: (m: string) => void;
  onPreviewChange: (v: boolean) => void;
}) {
  return (
    <div className="ds-setup-footer" style={{
      display: "flex",
      alignItems: "center",
      gap: 14,
      padding: "10px 18px",
      borderTop: "1px solid var(--df-border-subtle)",
      background: "var(--df-bg-section)",
      flexWrap: "wrap",
    }}>
      {status === "idle" ? (
        <>
          <FooterModelPicker
            provider={genProvider}
            model={genModel}
            onProviderChange={onProviderChange}
            onModelChange={onModelChange}
          />
          <label style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            cursor: "pointer",
            fontSize: 11,
            color: "var(--df-text-primary)",
            whiteSpace: "nowrap",
          }}>
            <input
              type="checkbox"
              checked={genPreview}
              onChange={(e) => onPreviewChange(e.target.checked)}
              style={{ accentColor: "var(--df-accent-primary, #5faa54)" }}
            />
            Gerar preview ao terminar
          </label>
          <div style={{ flex: 1 }} />
          {submit ? (
            <button
              type="button"
              onClick={submit.onClick}
              disabled={submit.disabled}
              className="df-btn df-btn--primary"
            >
              {submit.label} <IconArrow />
            </button>
          ) : (
            <span style={{ fontSize: 11, color: "var(--df-text-faint)" }}>
              Source · {source.toUpperCase()}
            </span>
          )}
        </>
      ) : (
        <span className="ds-setup-footer-status" style={{ fontSize: 11, color: "var(--df-text-muted)", fontFamily: "var(--df-font-mono)" }}>
          {status.toUpperCase()}
        </span>
      )}
    </div>
  );
}

function FooterModelPicker({
  provider, model, onProviderChange, onModelChange,
}: {
  provider: ProviderId;
  model: string;
  onProviderChange: (p: ProviderId) => void;
  onModelChange: (m: string) => void;
}) {
  const [providers, setProviders] = useState<Array<{ id: ProviderId; label: string; available?: boolean; readiness?: string }>>([]);
  useEffect(() => {
    fetch(`${BRIDGE_URL}/providers`)
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data?.providers) ? data.providers : [];
        setProviders(list);
      })
      .catch(() => {});
  }, []);
  const liveModels = useLiveModelOptions(provider);
  const modelOptions = liveModels.options;
  return (
    <>
      <select
        value={provider}
        onChange={(e) => onProviderChange(e.target.value as ProviderId)}
        style={{
          padding: "5px 8px",
          background: "var(--df-bg-base)",
          border: "1px solid var(--df-border-subtle)",
          borderRadius: "var(--df-r-sm)",
          color: "var(--df-text-primary)",
          fontFamily: "inherit",
          fontSize: 11,
          minWidth: 130,
        }}
      >
        {providers.length === 0 && <option value="claude">Claude</option>}
        {providers.map((p) => (
          <option key={p.id} value={p.id} disabled={p.available === false}>
            {p.label}{p.available === false ? " · n/a" : ""}
          </option>
        ))}
      </select>
      <select
        value={model}
        onChange={(e) => onModelChange(e.target.value)}
        style={{
          padding: "5px 8px",
          background: "var(--df-bg-base)",
          border: "1px solid var(--df-border-subtle)",
          borderRadius: "var(--df-r-sm)",
          color: "var(--df-text-primary)",
          fontFamily: "var(--df-font-mono)",
          fontSize: 11,
          minWidth: 170,
        }}
      >
        {modelOptions.length === 0 && <option value="">(sem modelos)</option>}
        {modelOptions.map((m) => (
          <option key={m.id} value={m.id}>{m.label}</option>
        ))}
      </select>
    </>
  );
}

const COVER_ACCEPT = "image/png,image/jpeg,image/jpg,image/webp";
const COVER_MAX_BYTES = 5 * 1024 * 1024;

function CoverUploadRow({ dsPath }: { dsPath: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "uploading" | "saved" | "error">("idle");
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = () => inputRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > COVER_MAX_BYTES) {
      setState("error");
      setError(`Image is ${(file.size / 1024 / 1024).toFixed(1)} MB — keep it under 5 MB.`);
      return;
    }
    setState("uploading");
    setError(null);
    try {
      const ext = (file.name.match(/\.([a-z0-9]+)$/i)?.[1] || "png").toLowerCase();
      const safeExt = ["png", "jpg", "jpeg", "webp"].includes(ext) ? ext : "png";
      const targetPath = `${dsPath.replace(/\/$/, "")}/cover.${safeExt}`;
      // Read file → base64 → POST to /fs/write-base64. The daemon writes
      // it next to design.md; list-design-systems will surface it the
      // next time the home grid refreshes.
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      // Chunked base64 — large files via String.fromCharCode(...bytes)
      // explode the call stack. 32 KB chunks are safe.
      let binary = "";
      for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
      }
      const base64 = btoa(binary);
      const result = await writeBinaryViaBridge(targetPath, base64);
      if (!result) {
        setState("error");
        setError("Bridge offline — cover not saved.");
        return;
      }
      setPreviewUri(URL.createObjectURL(file));
      setState("saved");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: 12,
      background: "var(--df-bg-base)",
      border: "1px solid var(--df-border-subtle)",
      borderRadius: "var(--df-r-sm)",
    }}>
      <input
        ref={inputRef}
        type="file"
        accept={COVER_ACCEPT}
        onChange={onFileChange}
        style={{ display: "none" }}
      />
      {previewUri ? (
        <img
          src={previewUri}
          alt=""
          style={{
            width: 64, height: 36, objectFit: "cover",
            borderRadius: "var(--df-r-xs)",
            border: "1px solid var(--df-border-subtle)",
          }}
        />
      ) : (
        <div style={{
          width: 64, height: 36,
          borderRadius: "var(--df-r-xs)",
          border: "1px dashed var(--df-border-subtle)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--df-text-faint)",
        }}>
          <IconImage />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: 500,
          color: "var(--df-text-primary)",
          marginBottom: 2,
        }}>
          Capa do card <span style={{ color: "var(--df-text-faint)", fontWeight: 400 }}>(opcional)</span>
        </div>
        <div style={{
          fontSize: 11, color: "var(--df-text-muted)",
          fontFamily: "var(--df-font-mono)",
        }}>
          {state === "idle"     && "PNG · JPG · WebP — até 5 MB"}
          {state === "uploading" && "Enviando…"}
          {state === "saved"    && "✓ salvo · aparece no card na próxima visita à Home"}
          {state === "error"    && (error || "Falhou — tente outra imagem.")}
        </div>
      </div>
      <button
        className="df-btn df-btn--secondary"
        onClick={pick}
        disabled={state === "uploading"}
        style={{ fontSize: 12, flexShrink: 0 }}
      >
        {state === "saved" ? "Trocar" : "Escolher imagem"}
      </button>
    </div>
  );
}

function IconImage() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function InlineSpinner() {
  return (
    <span style={{
      display: "inline-block", width: 8, height: 8,
      border: "1px solid currentColor", borderTopColor: "transparent",
      borderRadius: "50%",
      animation: "df-spin 0.9s linear infinite",
      verticalAlign: "middle", marginRight: 4,
    }}>
      <style>{`@keyframes df-spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  );
}

// ─── Shared bits ──────────────────────────────────────────────────────────

function LabeledRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{
        width: 78, flexShrink: 0,
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

function Path({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      flex: 1,
      fontFamily: "var(--df-font-mono)", fontSize: 11,
      color: "var(--df-text-muted)",
      padding: "4px 8px",
      background: "var(--df-bg-base)",
      border: "1px solid var(--df-border-subtle)",
      borderRadius: "var(--df-r-sm)",
      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
    }}>
      {children}
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, color: "var(--df-text-faint)", fontStyle: "italic" }}>{children}</div>;
}

function KV({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10 }}>
      <span style={{ color: "var(--df-text-faint)", fontFamily: "var(--df-font-mono)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {label}
      </span>
      <span style={{
        color: "var(--df-text-secondary)",
        fontFamily: mono || label === "destination" || label === "will write" ? "var(--df-font-mono)" : "inherit",
        maxWidth: 340,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {value}
      </span>
    </div>
  );
}

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { listFolder, type FolderResult } from "@/lib/claude-bridge";
import { DfBtn } from "@/components/DfBtn";

export interface FolderPickerModalProps {
  open: boolean;
  onClose: () => void;
  onPick: (path: string) => void;
  /** Starting directory. Default: home dir ("~") — bridge expands it. */
  startPath?: string;
  title?: string;
}

interface Entry {
  name: string;
  path: string;
  isDir: boolean;
}

/**
 * Browser-friendly folder picker. Navigates via the dev bridge
 * `/fs/list` endpoint (already exists) — no Tauri required.
 *
 * UX:
 *  - Shows current path at top (editable for typing a known path)
 *  - Lists subfolders of current path (files grayed out / hidden)
 *  - Click a folder -> navigate into it
 *  - ".." row goes up
 *  - "Use this folder" button confirms current path
 *
 * In Tauri builds, consumers should prefer the native dialog via
 * `openFolderDialog()`. This modal is a dev-mode / fallback option.
 */
export function FolderPickerModal({
  open,
  onClose,
  onPick,
  startPath = "~",
  title = "Pick a folder",
}: FolderPickerModalProps) {
  const [cwd, setCwd] = useState(startPath);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    const r: FolderResult = await listFolder(path);
    setLoading(false);
    if (!r || "error" in r) {
      setError(r && "error" in r ? r.error : "Could not read folder");
      setEntries([]);
      return;
    }
    // Only directories are navigable — files grayed out lower
    setEntries(
      r.entries
        .filter((e) => !e.name.startsWith("."))
        .sort((a, b) => {
          if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
          return a.name.localeCompare(b.name);
        })
        .map((e) => ({ name: e.name, path: e.path, isDir: e.isDir }))
    );
    // r.path is the resolved absolute path (bridge expands ~)
    if (r.path && r.path !== path) setCwd(r.path);
  }, []);

  useEffect(() => {
    if (!open) return;
    void load(cwd);
  }, [open, cwd, load]);

  const parent = cwd.replace(/\/+$/, "").split("/").slice(0, -1).join("/") || "/";
  const canGoUp = cwd !== "/" && cwd !== "";

  if (!open) return null;

  return createPortal(
    <div
      className="df-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="df-modal df-modal--lg"
        role="dialog"
        aria-modal="true"
        style={{ width: 640, maxHeight: "80vh", display: "flex", flexDirection: "column" }}
      >
        <div className="df-modal-head">
          <div className="df-modal-title">{title}</div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ width: 24, height: 24, borderRadius: 6, background: "none", border: "1px solid var(--df-border-subtle)", color: "var(--df-text-muted)", cursor: "pointer", display: "grid", placeItems: "center" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "14px 20px", borderBottom: "1px solid var(--df-border-subtle)" }}>
          <input
            className="df-input"
            value={cwd}
            spellCheck={false}
            onChange={(e) => setCwd(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void load(cwd);
            }}
            placeholder="/absolute/path"
            style={{ fontFamily: "var(--df-font-mono)", fontSize: "var(--df-text-xs)" }}
          />
          {error && (
            <div style={{ fontSize: "var(--df-text-xs)", color: "var(--df-accent-danger)", fontFamily: "var(--df-font-mono)" }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "8px 10px" }}>
          {loading && <div style={{ padding: 20, color: "var(--df-text-muted)", fontSize: "var(--df-text-sm)" }}>Loading…</div>}
          {!loading && (
            <>
              {canGoUp && (
                <button
                  onClick={() => setCwd(parent)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "8px 12px",
                    background: "transparent",
                    border: "none",
                    color: "var(--df-text-muted)",
                    fontSize: "var(--df-text-sm)",
                    fontFamily: "var(--df-font-mono)",
                    cursor: "pointer",
                    borderRadius: "var(--df-r-sm)",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--df-interactive-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                  ..
                </button>
              )}
              {entries.map((e) => (
                <button
                  key={e.path}
                  onClick={() => e.isDir && setCwd(e.path)}
                  disabled={!e.isDir}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "8px 12px",
                    background: "transparent",
                    border: "none",
                    color: e.isDir ? "var(--df-text-primary)" : "var(--df-text-faint)",
                    fontSize: "var(--df-text-sm)",
                    fontFamily: "var(--df-font-mono)",
                    cursor: e.isDir ? "pointer" : "default",
                    borderRadius: "var(--df-r-sm)",
                    textAlign: "left",
                  }}
                  onMouseEnter={(ev) => {
                    if (e.isDir) ev.currentTarget.style.background = "var(--df-interactive-hover)";
                  }}
                  onMouseLeave={(ev) => (ev.currentTarget.style.background = "transparent")}
                >
                  {e.isDir ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2z" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  )}
                  {e.name}
                </button>
              ))}
              {!loading && entries.length === 0 && !error && (
                <div style={{ padding: 20, color: "var(--df-text-faint)", fontSize: "var(--df-text-sm)", fontFamily: "var(--df-font-mono)" }}>
                  Empty folder
                </div>
              )}
            </>
          )}
        </div>

        <div className="df-modal-foot">
          <span style={{ flex: 1, fontSize: "var(--df-text-xs)", color: "var(--df-text-faint)", fontFamily: "var(--df-font-mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            Pick: {cwd}
          </span>
          <DfBtn variant="ghost" onClick={onClose}>Cancel</DfBtn>
          <DfBtn
            variant="primary"
            onClick={() => {
              onPick(cwd);
              onClose();
            }}
          >
            Use this folder
          </DfBtn>
        </div>
      </div>
    </div>,
    document.body
  );
}

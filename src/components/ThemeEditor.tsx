// ThemeEditor — edit named theme presets (dark + light per preset).
// Lives in Settings → Appearance. User can have multiple named
// presets and switch between them. Active preset is applied at runtime
// via useThemeOverrides; persisted to ~/.design-factory/theme.json.

import { useEffect, useMemo, useState } from "react";
import { useThemeOverrides } from "@/hooks/useThemeOverrides";
import {
  EDITABLE_TOKENS,
  getComputedTokenValue,
  type ThemeId,
  type TokenGroup,
} from "@/lib/theme-bridge";
import { useT } from "@/i18n";

const HEX = /^#[0-9a-fA-F]{6}$/;
const RGBA = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/;
const GROUPS: TokenGroup[] = ["Surfaces", "Text", "Borders", "Accents"];

function toHex(value: string): string {
  const v = value.trim();
  if (HEX.test(v)) return v.toLowerCase();
  const m = RGBA.exec(v);
  if (m) {
    const [r, g, b] = [m[1], m[2], m[3]].map((x) => Number(x));
    return "#" + [r, g, b].map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0")).join("").toLowerCase();
  }
  return "#000000";
}

export function ThemeEditor() {
  const { t, tf } = useT();
  const {
    activeName,
    activePreset,
    presetNames,
    setTokenOverride,
    resetTheme,
    switchPreset,
    createPreset,
    seedPreset,
    renamePreset,
    deletePreset,
    save,
    reload,
    loaded,
  } = useThemeOverrides();

  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [activeGroup, setActiveGroup] = useState<TokenGroup>("Surfaces");
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [flash, setFlash] = useState<string | null>(null);

  const flashMsg = (msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash((cur) => (cur === msg ? null : cur)), 2400);
  };

  const handleSetOverride = (theme: ThemeId, varName: string, value: string | null) => {
    setTokenOverride(theme, varName, value);
    setDirty(true);
    setSavedAt(null);
  };

  const handleResetTheme = (theme: ThemeId) => {
    resetTheme(theme);
    setDirty(true);
    setSavedAt(null);
  };

  const handleSwitchPreset = (name: string) => {
    if (name === activeName) return;
    switchPreset(name);
    setDirty(true);
    setSavedAt(null);
    setError(null);
    flashMsg(tf("theme.flash.switched", name));
  };

  const handleSave = async () => {
    setError(null);
    try {
      await save();
      setSavedAt(Date.now());
      setDirty(false);
      flashMsg(t("theme.flash.saved"));
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      const friendly = /failed to fetch/i.test(raw)
        ? t("theme.bridge.offline")
        : raw;
      setError(friendly);
    }
  };

  const handleDiscard = () => {
    if (!window.confirm(t("theme.confirm.discard"))) return;
    void reload();
    setDirty(false);
    setSavedAt(null);
    setError(null);
    flashMsg(t("theme.flash.reload"));
  };

  const handleNew = () => {
    createPreset("", false);
    setDirty(true);
    setSavedAt(null);
    flashMsg(t("theme.flash.new"));
  };

  const handleDuplicate = () => {
    createPreset(`${activeName}${t("theme.copy.suffix")}`, true);
    setDirty(true);
    setSavedAt(null);
    flashMsg(tf("theme.flash.duplicated", activeName));
  };

  const handleDelete = () => {
    if (presetNames.length <= 1) return;
    if (!window.confirm(tf("theme.confirm.delete", activeName))) return;
    deletePreset(activeName);
    setDirty(true);
    setSavedAt(null);
  };

  // Reset entire active preset to Factory defaults (clears all overrides for both themes).
  const handleResetToFactory = () => {
    if (!window.confirm(tf("theme.confirm.factory", activeName))) return;
    resetTheme("dark");
    resetTheme("light");
    setDirty(true);
    setSavedAt(null);
    flashMsg(tf("theme.flash.factory", activeName));
  };

  // Capture the current visual state (whatever the app is showing right now) into a new preset.
  // Solves: user wants to save the current factory look as a starting point.
  const handleCaptureCurrent = () => {
    const snap = { dark: {} as Record<string, string>, light: {} as Record<string, string> };
    for (const t of EDITABLE_TOKENS) {
      const dv = getComputedTokenValue(t.id, "dark");
      const lv = getComputedTokenValue(t.id, "light");
      if (dv) snap.dark[t.id] = dv;
      if (lv) snap.light[t.id] = lv;
    }
    const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    seedPreset(tf("theme.snapshot.name", stamp), snap);
    setDirty(true);
    setSavedAt(null);
    flashMsg(t("theme.flash.snapshot"));
  };

  const startRename = () => {
    setRenameDraft(activeName);
    setRenaming(true);
  };

  const commitRename = () => {
    const next = renameDraft.trim();
    if (next && next !== activeName && !presetNames.includes(next)) {
      renamePreset(activeName, next);
      setDirty(true);
    }
    setRenaming(false);
  };

  if (!loaded) {
    return <div style={{ color: "var(--df-text-faint)", fontSize: 13 }}>{t("theme.loading")}</div>;
  }

  const overrideCount = Object.keys(activePreset.dark).length + Object.keys(activePreset.light).length;
  const canDelete = presetNames.length > 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <header style={headerStyle}>
        <div style={{ minWidth: 0 }}>
          <h3 style={titleStyle}>{t("theme.heading")}</h3>
          <p style={subtitleStyle}>
            {t("theme.active.preset")} <strong style={{ color: "var(--df-text-secondary)" }}>{activeName}</strong>
            {overrideCount > 0 && <> · {overrideCount === 1 ? t("theme.override.one") : tf("theme.override.many", overrideCount)}</>}
            {dirty && <> · <span style={{ color: "var(--df-accent-warn)" }}>{t("theme.unsaved")}</span></>}
            {savedAt && !dirty && <> · <span style={{ color: "var(--df-text-faint)" }}>{t("theme.saved.flag")}</span></>}
          </p>
          <p style={{ ...subtitleStyle, marginTop: 2, fontSize: 12 }}>
            {t("theme.stored")} <code style={codeStyle}>~/.design-factory/theme.json</code>.
          </p>
        </div>
        <div style={actionRowStyle}>
          <button type="button" className="df-tactile df-tactile--sm" onClick={handleDiscard} disabled={!dirty} title={t("theme.discard.title")}>{t("theme.discard")}</button>
          <button type="button" className={`df-tactile df-tactile--sm${dirty ? " is-selected" : ""}`} onClick={handleSave} disabled={!dirty} title={dirty ? t("theme.save.title") : t("theme.save.title.disabled")}>{t("theme.save.button")}</button>
        </div>
      </header>

      {flash && <div style={flashStyle}>{flash}</div>}
      {error && (
        <div style={errorStyle}>
          <span style={{ flex: 1 }}>{error}</span>
          <button type="button" onClick={handleSave} style={retryBtnStyle}>{t("theme.retry")}</button>
        </div>
      )}

      {/* Preset switcher */}
      <div style={presetBarStyle}>
        <label style={{ fontSize: 12, color: "var(--df-text-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {t("theme.preset.label")}
        </label>
        {renaming ? (
          <input
            type="text"
            value={renameDraft}
            onChange={(e) => setRenameDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
              if (e.key === "Escape") setRenaming(false);
            }}
            autoFocus
            style={renameInputStyle}
            spellCheck={false}
          />
        ) : (
          <select
            value={activeName}
            onChange={(e) => handleSwitchPreset(e.target.value)}
            style={presetSelectStyle}
          >
            {presetNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        )}
        <div style={{ display: "flex", gap: 6, marginLeft: "auto", flexWrap: "wrap" }}>
          <button type="button" className="df-tactile df-tactile--sm is-selected" onClick={handleCaptureCurrent} title={t("theme.capture.title")}>{t("theme.capture.current")}</button>
          <span style={{ width: 1, background: "var(--df-border-subtle)", margin: "0 2px" }} aria-hidden="true" />
          <button type="button" className="df-tactile df-tactile--sm" onClick={handleNew} title={t("theme.preset.new.title")}>{t("theme.preset.new")}</button>
          <button type="button" className="df-tactile df-tactile--sm" onClick={handleDuplicate} title={t("theme.preset.duplicate.title")}>{t("theme.preset.duplicate")}</button>
          <button type="button" className="df-tactile df-tactile--sm" onClick={startRename} title={t("theme.preset.rename.title")}>{t("theme.preset.rename")}</button>
          <button
            type="button"
            className="df-tactile df-tactile--sm"
            onClick={handleDelete}
            disabled={!canDelete}
            title={canDelete ? t("theme.preset.delete.title") : t("theme.preset.delete.disabled")}
          >
            {t("theme.preset.delete")}
          </button>
        </div>
      </div>

      {/* Group tabs — tactile chips */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} role="tablist" aria-label={t("theme.tabs.aria")}>
        {GROUPS.map((group) => {
          const active = group === activeGroup;
          return (
            <button
              key={group}
              type="button"
              role="tab"
              aria-selected={active}
              className={`df-tactile df-tactile--sm${active ? " is-selected" : ""}`}
              onClick={() => setActiveGroup(group)}
            >
              {group}
            </button>
          );
        })}
      </div>

      {/* Column headers */}
      <div style={colHeaderRowStyle}>
        <span style={{ flex: 1 }} />
        <span style={colHeaderStyle}>{t("theme.col.dark")}</span>
        <span style={colHeaderStyle}>{t("theme.col.light")}</span>
      </div>

      <div style={listStyle}>
        {EDITABLE_TOKENS.filter((t) => t.group === activeGroup).map((token) => (
          <TokenRow
            key={token.id}
            tokenId={token.id}
            label={token.label}
            darkValue={activePreset.dark[token.id] ?? ""}
            lightValue={activePreset.light[token.id] ?? ""}
            onChange={handleSetOverride}
          />
        ))}
      </div>

      <div style={resetRowStyle}>
        <button
          type="button"
          className="df-tactile df-tactile--sm"
          onClick={handleResetToFactory}
          disabled={overrideCount === 0}
          title={t("theme.reset.factory.title")}
        >
          {t("theme.reset.factory")}
        </button>
        <button
          type="button"
          className="df-tactile df-tactile--sm"
          onClick={() => handleResetTheme("dark")}
          disabled={Object.keys(activePreset.dark).length === 0}
        >
          {t("theme.reset.dark")}
        </button>
        <button
          type="button"
          className="df-tactile df-tactile--sm"
          onClick={() => handleResetTheme("light")}
          disabled={Object.keys(activePreset.light).length === 0}
        >
          {t("theme.reset.light")}
        </button>
      </div>
    </div>
  );
}

interface RowProps {
  tokenId: string;
  label: string;
  darkValue: string;
  lightValue: string;
  onChange: (theme: ThemeId, varName: string, value: string | null) => void;
}

function TokenRow({ tokenId, label, darkValue, lightValue, onChange }: RowProps) {
  return (
    <div style={tokenRowStyle}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={tokenLabelStyle}>{label}</div>
        <div style={tokenIdStyle}>{tokenId}</div>
      </div>
      <ColorCell theme="dark"  tokenId={tokenId} value={darkValue}  onChange={onChange} />
      <ColorCell theme="light" tokenId={tokenId} value={lightValue} onChange={onChange} />
    </div>
  );
}

interface CellProps {
  theme: ThemeId;
  tokenId: string;
  value: string;
  onChange: (theme: ThemeId, varName: string, value: string | null) => void;
}

function ColorCell({ theme, tokenId, value, onChange }: CellProps) {
  const { t, tf } = useT();
  const computed = useMemo(() => getComputedTokenValue(tokenId, theme), [tokenId, theme, value]);
  const effective = value || computed || "";
  const overridden = value.trim().length > 0;

  const [textDraft, setTextDraft] = useState(value);
  useEffect(() => { setTextDraft(value); }, [value]);

  const commit = (next: string) => onChange(theme, tokenId, next.trim() || null);

  return (
    <div style={cellStyle}>
      <label style={swatchWrapStyle} title={tf("theme.cell.pick.title", tokenId, theme)}>
        <span style={{ ...swatchStyle, background: effective }} aria-hidden="true">
          {overridden && <span style={overrideDotStyle} aria-hidden="true" />}
        </span>
        <input
          type="color"
          value={toHex(effective)}
          onChange={(e) => commit(e.target.value)}
          style={hiddenColorInputStyle}
          aria-label={tf("theme.cell.aria", theme, tokenId)}
        />
      </label>
      <input
        type="text"
        value={textDraft}
        onChange={(e) => setTextDraft(e.target.value)}
        onBlur={() => textDraft !== value && commit(textDraft)}
        onKeyDown={(e) => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur(); }}
        placeholder={computed}
        style={hexInputStyle}
        spellCheck={false}
      />
      {overridden && (
        <button
          type="button"
          onClick={() => commit("")}
          title={t("theme.cell.reset.title")}
          style={resetCellBtnStyle}
        >
          ↺
        </button>
      )}
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
};

const titleStyle: React.CSSProperties = { fontSize: 17, margin: 0, color: "var(--df-text-primary)" };
const subtitleStyle: React.CSSProperties = { fontSize: 13, color: "var(--df-text-muted)", margin: "4px 0 0 0", lineHeight: 1.5 };

const codeStyle: React.CSSProperties = {
  fontFamily: "var(--df-font-mono, ui-monospace)",
  fontSize: 12,
  background: "var(--df-bg-base)",
  padding: "1px 6px",
  borderRadius: 4,
};

const actionRowStyle: React.CSSProperties = { display: "flex", gap: 8, alignItems: "center", flexShrink: 0 };

const presetBarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  background: "var(--df-bg-section)",
  border: "1px solid var(--df-border-subtle)",
  borderRadius: 8,
  flexWrap: "wrap",
};

const presetSelectStyle: React.CSSProperties = {
  fontSize: 13,
  padding: "5px 28px 5px 10px",
  borderRadius: 6,
  border: "1px solid var(--df-border-subtle)",
  background: "var(--df-bg-base)",
  color: "var(--df-text-primary)",
  fontWeight: 500,
  minWidth: 140,
  appearance: "none",
};

const renameInputStyle: React.CSSProperties = {
  fontSize: 13,
  padding: "5px 10px",
  borderRadius: 6,
  border: "1px solid var(--df-text-primary)",
  background: "var(--df-bg-base)",
  color: "var(--df-text-primary)",
  fontWeight: 500,
  minWidth: 140,
};

const colHeaderRowStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, padding: "0 0 4px 0" };
const colHeaderStyle: React.CSSProperties = {
  width: 154,
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--df-text-faint)",
  paddingLeft: 4,
};

const listStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 0,
  background: "var(--df-bg-section)",
  border: "1px solid var(--df-border-subtle)",
  borderRadius: 10,
  padding: "4px 12px",
  overflow: "hidden",
};

const tokenRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 0",
  borderBottom: "1px solid var(--df-border-subtle)",
  minWidth: 0,
};

const tokenLabelStyle: React.CSSProperties = { fontSize: 13, color: "var(--df-text-primary)", fontWeight: 500 };
const tokenIdStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--df-text-faint)",
  fontFamily: "var(--df-font-mono, ui-monospace)",
  marginTop: 2,
};

const cellStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 4, width: 154, flexShrink: 0 };

const swatchWrapStyle: React.CSSProperties = { position: "relative", display: "inline-block", cursor: "pointer", flexShrink: 0 };

const swatchStyle: React.CSSProperties = {
  display: "block",
  width: 22,
  height: 22,
  borderRadius: 5,
  border: "1px solid var(--df-border-strong)",
  position: "relative",
};

const overrideDotStyle: React.CSSProperties = {
  position: "absolute",
  top: -3,
  right: -3,
  width: 7,
  height: 7,
  borderRadius: 3.5,
  background: "var(--df-accent-warn)",
  border: "1px solid var(--df-bg-section)",
};

const hiddenColorInputStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  opacity: 0,
  width: "100%",
  height: "100%",
  cursor: "pointer",
  border: "none",
  padding: 0,
  background: "transparent",
};

const hexInputStyle: React.CSSProperties = {
  fontFamily: "var(--df-font-mono, ui-monospace)",
  fontSize: 11,
  padding: "5px 7px",
  borderRadius: 5,
  border: "1px solid var(--df-border-subtle)",
  background: "var(--df-bg-base)",
  color: "var(--df-text-primary)",
  width: 92,
  minWidth: 0,
};

const resetCellBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--df-border-subtle)",
  color: "var(--df-text-muted)",
  fontSize: 11,
  width: 22,
  height: 22,
  borderRadius: 5,
  cursor: "pointer",
  flexShrink: 0,
  padding: 0,
  lineHeight: 1,
};

const resetRowStyle: React.CSSProperties = { display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" };

const errorStyle: React.CSSProperties = {
  background: "rgba(255, 107, 107, 0.10)",
  border: "1px solid var(--df-accent-danger)",
  color: "var(--df-accent-danger)",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const retryBtnStyle: React.CSSProperties = {
  background: "var(--df-accent-danger)",
  color: "var(--df-bg-base)",
  border: "none",
  fontSize: 12,
  padding: "4px 12px",
  borderRadius: 5,
  cursor: "pointer",
  fontWeight: 500,
  flexShrink: 0,
};

const flashStyle: React.CSSProperties = {
  background: "var(--df-surface-raised)",
  border: "1px solid var(--df-accent-user)",
  color: "var(--df-text-primary)",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  lineHeight: 1.4,
};


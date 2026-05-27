// TokensPanel — Settings section for BYOK credentials. Two cards:
//
//   1. Anthropic API key — sk-ant-... pasted by the user. Daemon
//      persists at ~/.design-factory/anthropic.json (chmod 600). Used by
//      the "Anthropic API" provider when no Claude Code CLI is installed,
//      or when the user wants to bypass the CLI for any reason.
//
//   2. Vercel token + teamId — used by the "Publish to Vercel" Share/Export
//      action. Daemon persists at ~/.design-factory/vercel.json (chmod
//      600). Each user brings their own Vercel account.
//
// Both cards never display the saved token. They show {tokenSet, source}
// state and a redacted placeholder. Pasting + Save round-trips through
// the daemon's PUT /config/* endpoints.

import { useEffect, useState } from "react";
import {
  getAnthropicTokenState,
  saveAnthropicToken,
  type AnthropicTokenState,
} from "@/lib/anthropic-bridge";
import {
  getVercelConfigState,
  saveVercelConfig,
  type VercelConfigState,
} from "@/lib/vercel-bridge";
import {
  getTokenState,
  saveToken,
  type ByokService,
  type ByokTokenState,
} from "@/lib/byok-tokens";

export function TokensPanel() {
  return (
    <>
      <div className="settings-kicker">Settings · Tokens</div>
      <h1 className="settings-title">Tokens</h1>

      <section className="settings-group" style={{ borderTop: 0, paddingTop: 0 }}>
        <p className="settings-group-sub" style={{ margin: 0 }}>
          API keys saved here stay on your machine, chmod 600. The browser
          never holds the value — only `tokenSet:bool` is read back.
        </p>
      </section>

      <AnthropicCard />
      <ByokCard
        service="openai"
        title="OpenAI API key"
        envVar="OPENAI_API_KEY"
        helpText="Used by the OpenAI BYOK provider. Get one at platform.openai.com → API keys."
        placeholder="sk-..."
        prefix="sk-"
      />
      <ByokCard
        service="gemini"
        title="Gemini API key"
        envVar="GEMINI_API_KEY"
        helpText="Used by the Gemini BYOK provider. Get one at aistudio.google.com → Get API key."
        placeholder="AIza..."
      />
      <VercelCard />
    </>
  );
}

interface ByokCardProps {
  service: ByokService;
  title: string;
  envVar: string;
  helpText: string;
  placeholder: string;
  /** Optional prefix the daemon validates before persisting (e.g. "sk-"). */
  prefix?: string;
}

function ByokCard({ service, title, envVar, helpText, placeholder, prefix }: ByokCardProps) {
  const [state, setState] = useState<ByokTokenState>({ tokenSet: false, source: null });
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<"saved" | "cleared" | null>(null);

  useEffect(() => {
    void getTokenState(service).then(setState);
  }, [service]);

  const validate = (value: string): string | null => {
    if (!value) return null;
    if (prefix && !value.startsWith(prefix)) return `must start with ${prefix}`;
    if (value.length < 20) return "looks too short";
    return null;
  };

  const handleSave = async () => {
    const trimmed = draft.trim();
    const v = validate(trimmed);
    if (v) { setError(v); return; }
    setSaving(true);
    setError(null);
    const r = await saveToken(service, trimmed);
    setSaving(false);
    if (!r.ok) { setError(r.error ?? "save failed"); return; }
    setDraft("");
    const next = await getTokenState(service);
    setState(next);
    setFlash("saved");
    window.setTimeout(() => setFlash(null), 2200);
  };

  const handleClear = async () => {
    setSaving(true);
    setError(null);
    await saveToken(service, "");
    setSaving(false);
    const next = await getTokenState(service);
    setState(next);
    setFlash("cleared");
    window.setTimeout(() => setFlash(null), 2200);
  };

  const disableSave = saving || !draft.trim() || !!validate(draft.trim());

  return (
    <section className="settings-group">
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <h2 className="settings-group-title">{title}</h2>
        <span style={badgeStyle(state.tokenSet)}>
          {state.tokenSet ? (state.source === "env" ? "from env" : "saved") : "not set"}
        </span>
      </div>
      <p className="settings-group-sub" style={{ marginTop: 4, marginBottom: 12 }}>
        {helpText}
        {state.source === "env" && ` Currently using ${envVar} env var; pasting here overrides at the daemon level only.`}
      </p>
      <input
        type="password"
        autoComplete="off"
        spellCheck={false}
        placeholder={state.tokenSet ? "•••••••••••••••• (paste a new one to replace)" : placeholder}
        value={draft}
        onChange={(e) => { setDraft(e.target.value); setError(null); }}
        style={inputStyle}
      />
      {error && <div style={errStyle}>{error}</div>}
      {flash && <div style={okStyle}>{flash === "saved" ? "Saved." : "Cleared."}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button
          className="df-btn df-btn--primary"
          onClick={handleSave}
          disabled={disableSave}
          style={{ fontSize: "var(--df-text-xs)" }}
        >
          {saving ? "Saving…" : "Save token"}
        </button>
        {state.tokenSet && state.source !== "env" && (
          <button
            className="df-btn df-btn--secondary"
            onClick={handleClear}
            disabled={saving}
            style={{ fontSize: "var(--df-text-xs)" }}
          >
            Clear saved
          </button>
        )}
      </div>
    </section>
  );
}

function AnthropicCard() {
  const [state, setState] = useState<AnthropicTokenState>({ tokenSet: false, source: null });
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<"saved" | "cleared" | null>(null);

  useEffect(() => {
    void getAnthropicTokenState().then(setState);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const r = await saveAnthropicToken(draft.trim());
    setSaving(false);
    if (!r.ok) {
      setError(r.error ?? "save failed");
      return;
    }
    setDraft("");
    const next = await getAnthropicTokenState();
    setState(next);
    setFlash("saved");
    window.setTimeout(() => setFlash(null), 2200);
  };

  const handleClear = async () => {
    setSaving(true);
    setError(null);
    await saveAnthropicToken("");
    setSaving(false);
    const next = await getAnthropicTokenState();
    setState(next);
    setFlash("cleared");
    window.setTimeout(() => setFlash(null), 2200);
  };

  return (
    <section className="settings-group">
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <h2 className="settings-group-title">Anthropic API key</h2>
        <span style={badgeStyle(state.tokenSet)}>
          {state.tokenSet ? (state.source === "env" ? "from env" : "saved") : "not set"}
        </span>
      </div>
      <p className="settings-group-sub" style={{ marginTop: 4, marginBottom: 12 }}>
        Used by the "Anthropic API" provider (BYOK direct API access).
        Get one at console.anthropic.com → API Keys.
        {state.source === "env" && " Currently using ANTHROPIC_API_KEY env var; pasting here overrides at the daemon level only."}
      </p>
      <input
        type="password"
        autoComplete="off"
        spellCheck={false}
        placeholder={state.tokenSet ? "•••••••••••••••• (paste a new one to replace)" : "sk-ant-..."}
        value={draft}
        onChange={(e) => { setDraft(e.target.value); setError(null); }}
        style={inputStyle}
      />
      {error && <div style={errStyle}>{error}</div>}
      {flash && <div style={okStyle}>{flash === "saved" ? "Saved." : "Cleared."}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button
          className="df-btn df-btn--primary"
          onClick={handleSave}
          disabled={saving || !draft.trim() || (draft.trim().length > 0 && !draft.trim().startsWith("sk-ant-"))}
          style={{ fontSize: "var(--df-text-xs)" }}
        >
          {saving ? "Saving…" : "Save token"}
        </button>
        {state.tokenSet && state.source !== "env" && (
          <button
            className="df-btn df-btn--secondary"
            onClick={handleClear}
            disabled={saving}
            style={{ fontSize: "var(--df-text-xs)" }}
          >
            Clear saved
          </button>
        )}
      </div>
    </section>
  );
}

function VercelCard() {
  const [state, setState] = useState<VercelConfigState>({ tokenSet: false, teamId: "", teamSlug: "" });
  const [draftToken, setDraftToken] = useState("");
  const [draftTeam, setDraftTeam] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    void getVercelConfigState().then((s) => {
      setState(s);
      setDraftTeam(s.teamId);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const r = await saveVercelConfig({
      ...(draftToken.trim() ? { token: draftToken.trim() } : {}),
      teamId: draftTeam.trim(),
    });
    setSaving(false);
    if (!r.ok) {
      setError(r.error ?? "save failed");
      return;
    }
    setDraftToken("");
    const next = await getVercelConfigState();
    setState(next);
    setDraftTeam(next.teamId);
    setFlash("Saved.");
    window.setTimeout(() => setFlash(null), 2200);
  };

  const handleClear = async () => {
    setSaving(true);
    setError(null);
    await saveVercelConfig({ token: "" });
    setSaving(false);
    const next = await getVercelConfigState();
    setState(next);
    setFlash("Cleared.");
    window.setTimeout(() => setFlash(null), 2200);
  };

  return (
    <section className="settings-group">
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <h2 className="settings-group-title">Vercel publish</h2>
        <span style={badgeStyle(state.tokenSet)}>
          {state.tokenSet ? "saved" : "not set"}
        </span>
      </div>
      <p className="settings-group-sub" style={{ marginTop: 4, marginBottom: 12 }}>
        Used by the "Publish to Vercel" item in the Share/Export menu.
        Generate a token at vercel.com/account/tokens (scope: deployments).
        Team id is optional — only needed if you deploy under a team account.
      </p>
      <input
        type="password"
        autoComplete="off"
        spellCheck={false}
        placeholder={state.tokenSet ? "•••••••••••••••• (paste a new one to replace)" : "vercel_token..."}
        value={draftToken}
        onChange={(e) => { setDraftToken(e.target.value); setError(null); }}
        style={inputStyle}
      />
      <input
        type="text"
        autoComplete="off"
        spellCheck={false}
        placeholder="team_... (optional)"
        value={draftTeam}
        onChange={(e) => { setDraftTeam(e.target.value); setError(null); }}
        style={{ ...inputStyle, marginTop: 8 }}
      />
      {error && <div style={errStyle}>{error}</div>}
      {flash && <div style={okStyle}>{flash}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button
          className="df-btn df-btn--primary"
          onClick={handleSave}
          disabled={saving || (!draftToken.trim() && draftTeam === state.teamId)}
          style={{ fontSize: "var(--df-text-xs)" }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {state.tokenSet && (
          <button
            className="df-btn df-btn--secondary"
            onClick={handleClear}
            disabled={saving}
            style={{ fontSize: "var(--df-text-xs)" }}
          >
            Clear token
          </button>
        )}
      </div>
    </section>
  );
}

function badgeStyle(set: boolean): React.CSSProperties {
  return {
    fontFamily: "var(--df-font-mono)",
    fontSize: 10,
    color: set ? "var(--df-accent-ok, #5faa54)" : "var(--df-text-faint)",
    border: "1px solid var(--df-border-subtle)",
    background: set ? "color-mix(in srgb, var(--df-accent-ok, #5faa54) 12%, transparent)" : "transparent",
    padding: "2px 8px",
    borderRadius: 4,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  };
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "9px 11px",
  background: "var(--df-bg-input, var(--df-bg-base))",
  border: "1px solid var(--df-border-subtle)",
  borderRadius: 6,
  color: "var(--df-text-primary)",
  fontFamily: "var(--df-font-mono)",
  fontSize: 12,
  outline: "none",
};

const errStyle: React.CSSProperties = {
  marginTop: 8,
  fontFamily: "var(--df-font-mono)",
  fontSize: 11,
  color: "var(--df-accent-warn, #f0a500)",
};

const okStyle: React.CSSProperties = {
  marginTop: 8,
  fontFamily: "var(--df-font-mono)",
  fontSize: 11,
  color: "var(--df-accent-ok, #5faa54)",
};

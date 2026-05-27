// DFDSPanel — Design Factory Design System reference page.
//
// Lives inside Settings → Components. Surfaces every token + visual
// pattern the app actually uses, side-by-side, so the user can spot
// inconsistencies without grepping the codebase.
//
// Rule: nothing in here is invented. Every component uses the same CSS
// classes / token mix the live UI does. Native form controls (<select>,
// <input type=color>) are forbidden in DF — all dropdowns are custom
// popovers — so DFDS demos the custom variants only.

import { useState } from "react";
import { CustomSelect, ColorPickerPopover, ModalClose } from "@/components/dfds";

const COLOR_TOKENS = {
  Backgrounds: ["bg-sunken", "bg-base", "bg-section", "surface-raised", "surface-elevated"],
  Text: ["text-primary", "text-secondary", "text-muted", "text-faint"],
  Borders: ["border-subtle", "border-hover", "border-strong", "border-focus", "border-divider"],
  Interactive: ["interactive-hover", "interactive-pressed", "interactive-selected"],
  Accents: ["accent-user", "accent-ok", "accent-warn", "accent-danger"],
  Skeumorph: ["skeu-top-light", "skeu-bottom-edge", "skeu-contact", "skeu-near", "skeu-deep-near", "skeu-deep-far"],
};

const RADIUS_TOKENS = ["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl"];
const TYPE_SIZES = ["xs", "sm", "md", "lg", "xl", "2xl", "3xl"];
const SPACING = ["1", "2", "3", "4", "5", "6", "7", "8"];

const SECTION_NAV: { id: string; label: string }[] = [
  { id: "tokens", label: "Tokens" },
  { id: "radius", label: "Radius" },
  { id: "type", label: "Type" },
  { id: "spacing", label: "Spacing" },
  { id: "shadows", label: "Shadows" },
  { id: "buttons", label: "Buttons" },
  { id: "tactile", label: "Tactile (skeu)" },
  { id: "inputs", label: "Inputs" },
  { id: "toggles", label: "Toggles" },
  { id: "dropdowns", label: "Dropdowns" },
  { id: "color", label: "Color picker" },
  { id: "tabs", label: "Tabs" },
  { id: "details", label: "Details (accordion)" },
  { id: "navitems", label: "Nav items" },
  { id: "cards", label: "Cards" },
  { id: "pills", label: "Pills" },
  { id: "status", label: "Status" },
  { id: "progress", label: "Progress" },
  { id: "tooltips", label: "Tooltips" },
  { id: "kbd", label: "Keyboard" },
  { id: "modal", label: "Modal" },
  { id: "newproject", label: "New Project" },
  { id: "surfaces", label: "Surfaces" },
];

export function DFDSPanel() {
  return (
    <>
      <div className="settings-kicker">Settings · Components</div>
      <h1 className="settings-title">DFDS</h1>
      <section className="settings-group" style={{ borderTop: 0, paddingTop: 0 }}>
        <p className="settings-group-sub" style={{ margin: 0, marginBottom: 14 }}>
          Live reference of every token + visual pattern the app uses.
          All hover / active states are real — try them.
        </p>
        <div style={anchorRowStyle}>
          {SECTION_NAV.map((s) => (
            <a key={s.id} href={`#dfds-${s.id}`} style={anchorChipStyle}>
              {s.label}
            </a>
          ))}
        </div>
      </section>

      <Section id="tokens" title="Color tokens" sub="Hover any swatch to see the var() name.">
        <Tokens />
      </Section>
      <Section id="radius" title="Border radius"><Radii /></Section>
      <Section id="type" title="Type scale"><TypeScale /></Section>
      <Section id="spacing" title="Spacing"><SpacingScale /></Section>
      <Section id="shadows" title="Shadows" sub="Composed from skeu-* primitives. Use these directly instead of stacking inline shadows."><ShadowStack /></Section>

      <Section id="buttons" title="Buttons" sub="df-btn classes. Avoid inline-styled controls for new code.">
        <Buttons />
      </Section>
      <Section id="tactile" title="Tactile (skeu)" sub="Raised buttons that physically depress on press. Click and hold the 'Try me' to feel it.">
        <Tactile />
      </Section>

      <Section id="inputs" title="Inputs"><Inputs /></Section>
      <Section id="toggles" title="Toggles & switches" sub="Switch (binary), checkbox (multi-select), radio (single-pick group).">
        <Toggles />
      </Section>
      <Section id="dropdowns" title="Dropdowns" sub="DF rule: no native <select>. All dropdowns are custom popovers — they live above scrolling content, support click-outside to close, and animate the chevron.">
        <Dropdowns />
      </Section>
      <Section id="color" title="Color picker" sub="Custom popover with curated swatches + hex input. Native <input type=color> is banned in the app.">
        <ColorPicker />
      </Section>

      <Section id="tabs" title="Tabs" sub="Segmented pill (chat/comments style). Underline tabs were retired — use segmented everywhere.">
        <Tabs />
      </Section>

      <Section id="details" title="Details / accordion" sub="Native <details>/<summary> styled to match (same as the ShadersScreen pattern).">
        <DetailsDemo />
      </Section>

      <Section id="navitems" title="Sidebar nav items" sub="Real .df-nav-item class — the one Settings sidebar uses.">
        <NavItems />
      </Section>

      <Section id="cards" title="Cards"><Cards /></Section>
      <Section id="pills" title="Pills & badges" sub="Status badges (saved/not-set/muted), counter, and toolbar pill."><Pills /></Section>
      <Section id="status" title="Status dots"><StatusDots /></Section>
      <Section id="progress" title="Progress & spinners"><Progress /></Section>
      <Section id="tooltips" title="Tooltips"><Tooltips /></Section>
      <Section id="kbd" title="Keyboard shortcuts"><KbdShortcuts /></Section>
      <Section id="modal" title="Modal / Dialog"><ModalDemo /></Section>

      <Section id="newproject" title="New Project layout" sub="Anatomy of HomeScreen's create-project sidebar. Every primitive used by the live screen is rendered here once.">
        <NewProjectLayout />
      </Section>

      <Section id="surfaces" title="Surface stack" sub="Stack in z-order. Each step adds light."><Surfaces /></Section>
    </>
  );
}

// ─── Section wrapper ─────────────────────────────────────────────────

function Section({ id, title, sub, children }: { id: string; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="settings-group" id={`dfds-${id}`}>
      <h2 className="settings-group-title">{title}</h2>
      {sub && <p className="settings-group-sub" style={{ marginBottom: 12 }}>{sub}</p>}
      {children}
    </section>
  );
}

// ─── Tokens / scales ─────────────────────────────────────────────────

function Tokens() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {Object.entries(COLOR_TOKENS).map(([group, tokens]) => (
        <div key={group}>
          <div style={groupLabelStyle}>{group}</div>
          <div style={swatchRowStyle}>
            {tokens.map((t) => (
              <div key={t} style={swatchItemStyle}>
                <div title={`var(--df-${t})`} style={{
                  width: 56, height: 56, borderRadius: 8,
                  background: `var(--df-${t})`,
                  border: "1px solid var(--df-border-subtle)",
                }} />
                <code style={swatchCodeStyle}>{t}</code>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Radii() {
  return (
    <div style={swatchRowStyle}>
      {RADIUS_TOKENS.map((r) => (
        <div key={r} style={swatchItemStyle}>
          <div style={{ width: 64, height: 48, borderRadius: `var(--df-r-${r})`, background: "var(--df-surface-raised)", border: "1px solid var(--df-border-subtle)" }} />
          <code style={swatchCodeStyle}>{r}</code>
        </div>
      ))}
    </div>
  );
}

function TypeScale() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {TYPE_SIZES.map((s) => (
        <div key={s} style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "6px 0", borderBottom: "1px solid var(--df-border-subtle)" }}>
          <code style={{ ...swatchCodeStyle, width: 48 }}>{s}</code>
          <span style={{ fontSize: `var(--df-text-${s})`, fontFamily: "var(--df-font-sans)", color: "var(--df-text-primary)" }}>
            The quick brown fox
          </span>
        </div>
      ))}
    </div>
  );
}

function SpacingScale() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {SPACING.map((s) => (
        <div key={s} style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <code style={{ ...swatchCodeStyle, width: 48 }}>sp-{s}</code>
          <div style={{ height: 14, width: `var(--df-sp-${s})`, background: "var(--df-accent-user, #c7955a)", borderRadius: 2 }} />
        </div>
      ))}
    </div>
  );
}

function ShadowStack() {
  const shadows = [
    "shadow-sm", "shadow-md", "shadow-lg",
    "shadow-card", "shadow-card-hover", "shadow-button-tactile",
  ];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
      {shadows.map((name) => (
        <div key={name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 96, height: 64, borderRadius: 10,
            background: "var(--df-surface-raised)",
            border: "1px solid var(--df-border-subtle)",
            boxShadow: `var(--df-${name})`,
          }} />
          <code style={swatchCodeStyle}>{name}</code>
        </div>
      ))}
    </div>
  );
}

// ─── Buttons (df-btn classes) ────────────────────────────────────────

function Buttons() {
  const [count, setCount] = useState(0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={groupLabelStyle}>Variants</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <button className="df-btn df-btn--primary" onClick={() => setCount(count + 1)}>Primary</button>
          <button className="df-btn df-btn--secondary">Secondary</button>
          <button className="df-btn df-btn--ghost">Ghost</button>
          <button className="df-btn df-btn--primary" disabled>Disabled</button>
          <button className="df-btn df-btn--icon" title="Icon-only">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          {count > 0 && <span style={{ fontFamily: "var(--df-font-mono)", fontSize: 11, color: "var(--df-text-faint)" }}>clicked {count}×</span>}
        </div>
      </div>
      <div>
        <div style={groupLabelStyle}>Icon + label</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <button className="df-btn df-btn--primary" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            Save
          </button>
          <button className="df-btn df-btn--secondary" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /></svg>
            Save copy
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tactile (skeu) ──────────────────────────────────────────────────

function Tactile() {
  const [pressed, setPressed] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={groupLabelStyle}>States — click and hold</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
          <button style={tactileBtnStyle("rest")}>Resting</button>
          <button style={tactileBtnStyle("hover")}>Hover (sim)</button>
          <button style={tactileBtnStyle("pressed")}>Pressed (sim)</button>
          <button
            type="button"
            onMouseDown={() => setPressed(true)}
            onMouseUp={() => setPressed(false)}
            onMouseLeave={() => setPressed(false)}
            style={tactileBtnStyle(pressed ? "pressed" : "rest")}
          >
            Try me
          </button>
        </div>
      </div>
      <div>
        <div style={groupLabelStyle}>Sizes</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button style={{ ...tactileBtnStyle("rest"), padding: "5px 10px", fontSize: 11 }}>sm</button>
          <button style={tactileBtnStyle("rest")}>md</button>
          <button style={{ ...tactileBtnStyle("rest"), padding: "11px 18px", fontSize: 14 }}>lg</button>
        </div>
      </div>
    </div>
  );
}

// ─── Inputs ──────────────────────────────────────────────────────────

function Inputs() {
  const [text, setText] = useState("");
  const [pwd, setPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [search, setSearch] = useState("");
  const [num, setNum] = useState("12");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 480 }}>
      <Field label="Text">
        <input type="text" placeholder="Project name" value={text} onChange={(e) => setText(e.target.value)} style={inputStyle} />
      </Field>
      <Field label="Password (toggle)">
        <div style={{ position: "relative" }}>
          <input type={showPwd ? "text" : "password"} placeholder="sk-..." value={pwd} onChange={(e) => setPwd(e.target.value)} style={inputStyle} />
          <button type="button" onClick={() => setShowPwd((s) => !s)} style={inputAdornStyle} title={showPwd ? "Hide" : "Show"}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {showPwd ? (
                <>
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </>
              ) : (
                <>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </>
              )}
            </svg>
          </button>
        </div>
      </Field>
      <Field label="Search (with icon)">
        <div style={{ position: "relative" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 10, top: 11, color: "var(--df-text-faint)" }}>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input type="text" placeholder="Search projects" value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...inputStyle, paddingLeft: 32 }} />
        </div>
      </Field>
      <Field label="Number">
        <input type="number" min={1} max={120} value={num} onChange={(e) => setNum(e.target.value)} style={{ ...inputStyle, width: 100 }} />
      </Field>
      <Field label="Textarea">
        <textarea placeholder="Multi-line input" rows={3} style={{ ...inputStyle, resize: "vertical" }} />
      </Field>
      <Field label="Disabled">
        <input type="text" placeholder="Disabled input" disabled style={{ ...inputStyle, opacity: 0.5, cursor: "not-allowed" }} />
      </Field>
    </div>
  );
}

// ─── Toggles ─────────────────────────────────────────────────────────

function Toggles() {
  const [sw1, setSw1] = useState(true);
  const [sw2, setSw2] = useState(false);
  const [chk, setChk] = useState({ a: true, b: false, c: true });
  const [rad, setRad] = useState<"a" | "b" | "c">("b");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <div style={groupLabelStyle}>Switch</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <SkeuSwitch checked={sw1} onChange={setSw1} label="Auto-save" />
          <SkeuSwitch checked={sw2} onChange={setSw2} label="Loop preview" />
          <SkeuSwitch checked={false} onChange={() => {}} label="Disabled" disabled />
        </div>
      </div>
      <div>
        <div style={groupLabelStyle}>Checkbox</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(["a", "b", "c"] as const).map((k) => (
            <label key={k} style={checkLabelStyle}>
              <input type="checkbox" checked={chk[k]} onChange={(e) => setChk({ ...chk, [k]: e.target.checked })} style={checkboxStyle} />
              <span>Option {k.toUpperCase()}</span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <div style={groupLabelStyle}>Radio (single-pick)</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(["a", "b", "c"] as const).map((k) => (
            <label key={k} style={checkLabelStyle}>
              <input type="radio" name="dfds-radio" checked={rad === k} onChange={() => setRad(k)} style={checkboxStyle} />
              <span>Pick {k.toUpperCase()}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function SkeuSwitch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label style={{ ...checkLabelStyle, opacity: disabled ? 0.45 : 1, cursor: disabled ? "not-allowed" : "pointer" }}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        style={{
          width: 36, height: 20, padding: 2,
          background: checked ? "var(--df-accent-user, #c7955a)" : "var(--df-surface-raised)",
          border: "1px solid var(--df-border-subtle)",
          borderRadius: 999,
          boxShadow: checked
            ? "inset 0 1px 2px rgba(0,0,0,0.32), inset 0 0 0 1px rgba(0,0,0,0.18)"
            : "inset 0 1px 2px rgba(0,0,0,0.42), inset 0 -1px 0 rgba(255,255,255,0.04)",
          cursor: disabled ? "not-allowed" : "pointer",
          position: "relative",
          flex: "none",
        }}
      >
        <span style={{
          display: "block", width: 14, height: 14, borderRadius: "50%",
          background: "var(--df-text-primary)",
          transform: `translateX(${checked ? 16 : 0}px)`,
          transition: "transform 160ms cubic-bezier(0.4, 0, 0.2, 1)",
          boxShadow: "0 1px 2px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.18)",
        }} />
      </button>
      <span>{label}</span>
    </label>
  );
}

// ─── Custom dropdown (no native select) ──────────────────────────────

function Dropdowns() {
  const [pickA, setPickA] = useState("Sonnet 4.6");
  const [pickB, setPickB] = useState("default");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Field label="Plain dropdown">
        <CustomSelect
          value={pickA}
          onChange={setPickA}
          options={[
            { value: "Opus 4.7", sub: "max quality" },
            { value: "Sonnet 4.6", sub: "balanced" },
            { value: "Haiku 4.5", sub: "fastest" },
          ]}
        />
      </Field>
      <Field label="With dot indicator (provider-style)">
        <CustomSelect
          value={pickB}
          onChange={setPickB}
          options={[
            { value: "default", sub: "CLI config", dot: "var(--df-text-faint)" },
            { value: "claude", sub: "Anthropic", dot: "var(--df-accent-claude, #c7955a)" },
            { value: "codex", sub: "OpenAI", dot: "var(--df-accent-ok, #5faa54)" },
            { value: "gemini", sub: "Google", dot: "#7c8aa6" },
          ]}
        />
      </Field>
    </div>
  );
}

// CustomSelect + ColorPickerPopover are imported from @/components/dfds.
// This DFDS page imports them too — same primitive, same code path,
// guaranteed parity between the reference and the live UI.

function ColorPicker() {
  const [accent, setAccent] = useState("#c7955a");
  const presets = ["#c7955a", "#8ab06b", "#7c8aa6", "#a87d8e", "#9b7a52"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <ColorPickerPopover value={accent} onChange={setAccent} />
      <div>
        <div style={groupLabelStyle}>Color badges (token chips)</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {presets.map((c) => (
            <span key={c} style={colorBadgeStyle}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: c, border: "1px solid var(--df-border-subtle)" }} />
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tabs (segmented only — underline retired) ───────────────────────

function Tabs() {
  const [seg, setSeg] = useState<"chat" | "comments">("chat");
  const [seg3, setSeg3] = useState<"all" | "drafts" | "shared">("all");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <div style={groupLabelStyle}>Two options</div>
        <SegmentedTabs
          options={[{ value: "chat", label: "Chat" }, { value: "comments", label: "Comments" }] as const}
          value={seg}
          onChange={setSeg as (v: string) => void}
        />
      </div>
      <div>
        <div style={groupLabelStyle}>Three options</div>
        <SegmentedTabs
          options={[{ value: "all", label: "All" }, { value: "drafts", label: "Drafts" }, { value: "shared", label: "Shared" }] as const}
          value={seg3}
          onChange={setSeg3 as (v: string) => void}
        />
      </div>
    </div>
  );
}

function SegmentedTabs<T extends string>({ options, value, onChange }: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{
      display: "inline-flex", padding: 3, gap: 2,
      background: "var(--df-surface-raised)",
      border: "1px solid var(--df-border-subtle)",
      borderRadius: 8,
      boxShadow: "inset 0 1px 2px rgba(0,0,0,0.28)",
    }}>
      {options.map((s) => (
        <button
          key={s.value}
          onClick={() => onChange(s.value)}
          style={{
            padding: "5px 12px",
            background: value === s.value ? "var(--df-bg-section)" : "transparent",
            border: "1px solid",
            borderColor: value === s.value ? "var(--df-border-subtle)" : "transparent",
            borderRadius: 6,
            fontFamily: "var(--df-font-sans)", fontSize: 12,
            color: value === s.value ? "var(--df-text-primary)" : "var(--df-text-muted)",
            fontWeight: value === s.value ? 600 : 400,
            cursor: "pointer",
            boxShadow: value === s.value ? "inset 0 1px 0 rgba(255,255,255,0.06), 0 1px 2px rgba(0,0,0,0.24)" : "none",
            transition: "background 100ms ease, color 100ms ease",
          }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

// ─── Details / accordion (native <details>/<summary>) ────────────────

function DetailsDemo() {
  const items = [
    { title: "What is BYOK?", body: "Bring Your Own Key — paste an API key in Settings → Tokens. Daemon persists chmod 600." },
    { title: "How does the agent picker work?", body: "Picks the active CLI for the next chat send. Reads default_provider from disk, reacts to df:provider-change events." },
    { title: "Vercel publish workflow", body: "Paste token in Settings → Tokens. Click Share → Publish to Vercel. Daemon POSTs to /v13/deployments and the URL lands in your clipboard." },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((item) => (
        <details key={item.title} style={detailsStyle}>
          <summary style={summaryStyle}>
            {item.title}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
              <path d="m6 9 6 6 6-6" />
            </svg>
          </summary>
          <div style={{ padding: "0 14px 12px", fontFamily: "var(--df-font-sans)", fontSize: 12, color: "var(--df-text-secondary)", lineHeight: 1.55 }}>
            {item.body}
          </div>
        </details>
      ))}
      <style>{`details[open] > summary > svg { transform: rotate(180deg); transition: transform 160ms ease; } details > summary > svg { transition: transform 160ms ease; } details > summary { list-style: none; } details > summary::-webkit-details-marker { display: none; }`}</style>
    </div>
  );
}

// ─── Sidebar nav items (real .df-nav-item) ───────────────────────────

function NavItems() {
  const [active, setActive] = useState("providers");
  const items = [
    { id: "providers", label: "Providers" },
    { id: "tokens", label: "Tokens" },
    { id: "components", label: "Components" },
    { id: "appearance", label: "Appearance" },
    { id: "about", label: "About" },
  ];
  return (
    <nav className="settings-nav" style={{
      display: "flex", flexDirection: "column", gap: 2,
      maxWidth: 220,
      background: "var(--df-bg-section)",
      border: "1px solid var(--df-border-subtle)",
      borderRadius: 10,
      padding: 8,
    }}>
      {items.map((it) => (
        <button
          key={it.id}
          className="df-nav-item"
          aria-selected={active === it.id}
          onClick={() => setActive(it.id)}
        >
          {it.label}
        </button>
      ))}
    </nav>
  );
}

// ─── Cards ───────────────────────────────────────────────────────────

function Cards() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
      <div className="home-pcard-tile">
        <div className="home-pcard" style={{ width: "100%" }}>
          <div className="home-pcard-thumb">
            <span style={{ fontFamily: "var(--df-font-mono)", fontSize: 10, color: "var(--df-text-faint)" }}>16:9 thumb</span>
          </div>
          <div className="home-pcard-meta">
            <div className="home-pcard-name">Project card</div>
            <div className="home-pcard-sub">just now</div>
          </div>
        </div>
      </div>
      <div style={{
        background: "var(--df-bg-section)",
        border: "1px solid var(--df-border-subtle)",
        borderRadius: "var(--df-r-xl)",
        padding: 14,
        boxShadow: "var(--df-shadow-card)",
      }}>
        <div style={{ fontFamily: "var(--df-font-sans)", fontWeight: 600, marginBottom: 4 }}>Bordered card</div>
        <div style={{ fontFamily: "var(--df-font-mono)", fontSize: 10, color: "var(--df-text-muted)" }}>bg-section · border-subtle · r-xl · shadow-card</div>
      </div>
    </div>
  );
}

// ─── Pills & badges ──────────────────────────────────────────────────

function Pills() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={groupLabelStyle}>Status badges</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <span style={badge("ok")}>saved</span>
          <span style={badge("warn")}>not set</span>
          <span style={badge("danger")}>error</span>
          <span style={badge("muted")}>idle</span>
          <span style={badge("info")}>info</span>
        </div>
      </div>
      <div>
        <div style={groupLabelStyle}>Counter</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <span style={counterStyle}>3</span>
          <span style={counterStyle}>12</span>
          <span style={{ ...counterStyle, minWidth: 26 }}>99+</span>
        </div>
      </div>
      <div>
        <div style={groupLabelStyle}>Toolbar pill</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <span style={pillToolbar(true)}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--df-accent-ok, #5faa54)" }} />
            Active
          </span>
          <span style={pillToolbar(false)}>Idle</span>
        </div>
      </div>
    </div>
  );
}

// ─── Status dots ─────────────────────────────────────────────────────

function StatusDots() {
  return (
    <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
      {(["idle", "ready", "streaming", "error"] as const).map((state) => (
        <div key={state} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="statusbar-dot" data-state={state} />
          <code style={swatchCodeStyle}>{state}</code>
        </div>
      ))}
    </div>
  );
}

// ─── Progress / spinner ──────────────────────────────────────────────

function Progress() {
  const [pct, setPct] = useState(42);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 360 }}>
      <div>
        <div style={groupLabelStyle}>Determinate</div>
        <div style={{
          height: 6,
          background: "var(--df-surface-raised)",
          borderRadius: 999,
          overflow: "hidden",
          border: "1px solid var(--df-border-subtle)",
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.32)",
        }}>
          <div style={{
            width: `${pct}%`,
            height: "100%",
            background: "var(--df-accent-user, #c7955a)",
            transition: "width 200ms ease",
          }} />
        </div>
        <input type="range" min={0} max={100} value={pct} onChange={(e) => setPct(Number(e.target.value))} style={{ width: "100%", marginTop: 8 }} />
      </div>
      <div>
        <div style={groupLabelStyle}>Indeterminate / spinner</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 16, height: 16,
            border: "1px solid var(--df-border-subtle)",
            borderTopColor: "var(--df-accent-user, #c7955a)",
            borderRadius: "50%",
            animation: "df-spin 0.9s linear infinite",
          }} />
          <span style={{ fontFamily: "var(--df-font-mono)", fontSize: 11, color: "var(--df-text-muted)" }}>loading…</span>
        </div>
      </div>
      <style>{`@keyframes df-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Tooltips ────────────────────────────────────────────────────────

function Tooltips() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
      <button title="Native title attribute tooltip" style={tactileBtnStyle("rest")}>Hover (native)</button>
      <CustomTooltip text="Custom popover — appears on hover, no native delay">
        <button style={tactileBtnStyle("rest")}>Hover (custom)</button>
      </CustomTooltip>
    </div>
  );
}

function CustomTooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex" }} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <span style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
          padding: "6px 10px",
          background: "var(--df-surface-elevated)",
          border: "1px solid var(--df-border-subtle)",
          borderRadius: 6,
          fontFamily: "var(--df-font-mono)", fontSize: 10,
          color: "var(--df-text-secondary)",
          whiteSpace: "nowrap",
          boxShadow: "var(--df-shadow-card)",
          zIndex: 30,
        }}>
          {text}
        </span>
      )}
    </span>
  );
}

// ─── Keyboard shortcuts ──────────────────────────────────────────────

function KbdShortcuts() {
  const shortcuts = [
    { keys: ["⌘", "K"], label: "Open command palette" },
    { keys: ["⌘", "Enter"], label: "Send chat" },
    { keys: ["Esc"], label: "Close modal / cancel" },
    { keys: ["⌘", "S"], label: "Save version" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {shortcuts.map((s) => (
        <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, color: "var(--df-text-secondary)" }}>
          <div style={{ display: "inline-flex", gap: 4 }}>
            {s.keys.map((k) => <Kbd key={k}>{k}</Kbd>)}
          </div>
          <span>{s.label}</span>
        </div>
      ))}
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      minWidth: 22, height: 22, padding: "0 6px",
      background: "var(--df-surface-raised)",
      border: "1px solid var(--df-border-subtle)",
      borderRadius: 4,
      boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.04)",
      fontFamily: "var(--df-font-mono)", fontSize: 10,
      color: "var(--df-text-primary)",
    }}>
      {children}
    </kbd>
  );
}

// ─── Modal demo ──────────────────────────────────────────────────────

function ModalDemo() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button className="df-btn df-btn--primary" onClick={() => setOpen(true)}>Open modal</button>
      {open && (
        <div onClick={() => setOpen(false)} style={{
          position: "fixed", inset: 0, zIndex: 600,
          background: "var(--df-surface-overlay)",
          backdropFilter: "blur(14px) saturate(1.02)",
          WebkitBackdropFilter: "blur(14px) saturate(1.02)",
          display: "grid", placeItems: "center",
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: 480, maxWidth: "90vw",
            background: "var(--df-surface-elevated)",
            borderRadius: "var(--df-r-2xl)",
            boxShadow: "var(--df-shadow-card)",
            overflow: "hidden",
          }}>
            <header style={{ padding: "14px 18px", borderBottom: "1px solid var(--df-border-subtle)", background: "var(--df-bg-section)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <strong style={{ fontFamily: "var(--df-font-sans)", fontSize: 13, color: "var(--df-text-primary)" }}>Modal title</strong>
              <ModalClose onClick={() => setOpen(false)} />
            </header>
            <div style={{ padding: 18, fontFamily: "var(--df-font-sans)", fontSize: 13, color: "var(--df-text-secondary)", lineHeight: 1.55 }}>
              Same anatomy as DsSetupModal / SkillImportModal / FullPromptModal: header (with close), scrollable body, footer with cancel + confirm buttons.
            </div>
            <footer style={{ padding: "12px 18px", borderTop: "1px solid var(--df-border-subtle)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="df-btn df-btn--secondary" onClick={() => setOpen(false)}>Cancel</button>
              <button className="df-btn df-btn--primary" onClick={() => setOpen(false)}>Confirm</button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── New project layout (real anatomy reference) ─────────────────────

function NewProjectLayout() {
  const [name, setName] = useState("");
  const [skill, setSkill] = useState("Web prototype");
  const [provider, setProvider] = useState("claude");
  return (
    <div style={{ maxWidth: 360, display: "flex", flexDirection: "column", gap: 14, background: "var(--df-bg-section)", border: "1px solid var(--df-border-subtle)", borderRadius: "var(--df-r-2xl)", padding: 16, boxShadow: "var(--df-shadow-card)" }}>
      {/* Hero / header */}
      <div style={{ position: "relative", overflow: "hidden", padding: "12px 14px", background: "var(--df-surface-raised)", borderRadius: "var(--df-r-xl)", border: "1px solid var(--df-border-subtle)" }}>
        <pre style={{ position: "absolute", inset: 0, margin: 0, padding: 12, fontFamily: "var(--df-font-mono)", fontSize: 8, lineHeight: 1.2, color: "var(--df-text-faint)", opacity: 0.45, pointerEvents: "none", whiteSpace: "pre" }}>{"·  ·  ·  ·  ·  ·  ·  ·  ·  ·\n·  ·  ·  ·  ·  ·  ·  ·  ·  ·\n·  ·  ·  ·  ·  ·  ·  ·  ·  ·\n·  ·  ·  ·  ·  ·  ·  ·  ·  ·"}</pre>
        <div style={{ position: "relative" }}>
          <div style={{ fontFamily: "var(--df-font-mono)", fontSize: 9, color: "var(--df-text-faint)", letterSpacing: 0.6, textTransform: "uppercase" }}>new project</div>
          <div style={{ fontFamily: "var(--df-font-sans)", fontSize: 16, fontWeight: 600, color: "var(--df-text-primary)" }}>What are we building?</div>
        </div>
      </div>

      {/* Name with > sigil + ⌘N kbd */}
      <Field label="Name">
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", background: "var(--df-bg-base)", border: "1px solid var(--df-border-subtle)", borderRadius: 8, boxShadow: "inset 0 1px 2px rgba(0,0,0,0.28)" }}>
          <span style={{ color: "var(--df-accent-ok, #5faa54)", fontWeight: 700 }}>&gt;</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="name-this-thing" style={{ flex: 1, background: "transparent", border: 0, outline: 0, color: "var(--df-text-primary)", fontFamily: "var(--df-font-sans)", fontSize: 13 }} />
          <Kbd>⌘N</Kbd>
        </div>
      </Field>

      {/* Format & direction trigger */}
      <Field label="Format & direction">
        <button type="button" style={triggerLikeStyle}>
          <span style={{ flex: 1, textAlign: "left", color: "var(--df-text-muted)", fontFamily: "var(--df-font-mono)", fontSize: 11 }}>
            Pick format + directions
          </span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </Field>

      {/* DS swatch row */}
      <Field label="Design system">
        <div style={{ display: "flex", gap: 8, padding: 8, background: "var(--df-bg-base)", border: "1px solid var(--df-border-subtle)", borderRadius: 8, alignItems: "center" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 10px)", gap: 2 }}>
            {["#c7955a", "#8ab06b", "#7c8aa6", "#a87d8e"].map((c) => (
              <span key={c} style={{ width: 10, height: 26, borderRadius: 2, background: c, border: "1px solid var(--df-border-subtle)" }} />
            ))}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--df-font-sans)", fontSize: 13, fontWeight: 600 }}>Default</div>
            <div style={{ fontFamily: "var(--df-font-mono)", fontSize: 9, color: "var(--df-text-muted)" }}>4 tokens · folder</div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--df-accent-ok, #5faa54)" }}><polyline points="20 6 9 17 4 12" /></svg>
        </div>
      </Field>

      {/* Model picker — custom dropdown */}
      <Field label="Model">
        <CustomSelect
          value={provider}
          onChange={setProvider}
          width={undefined}
          options={[
            { value: "claude", sub: "Claude Code", dot: "var(--df-accent-claude, #c7955a)" },
            { value: "codex", sub: "OpenAI", dot: "var(--df-accent-ok, #5faa54)" },
            { value: "gemini", sub: "Google", dot: "#7c8aa6" },
            { value: "anthropic", sub: "API direct", dot: "#a87d8e" },
          ]}
        />
      </Field>

      {/* Skill — second custom dropdown to show consistency */}
      <Field label="Skill">
        <CustomSelect
          value={skill}
          onChange={setSkill}
          width={undefined}
          options={[
            { value: "Web prototype", sub: "single-file HTML" },
            { value: "Reels (9:16)", sub: "motion video" },
            { value: "Dashboard", sub: "data layout" },
          ]}
        />
      </Field>

      {/* Prompt textarea + chip + toolbar */}
      <Field label="Initial prompt">
        <div style={{ background: "var(--df-bg-base)", border: "1px solid var(--df-border-subtle)", borderRadius: 8, overflow: "hidden", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.28)" }}>
          <div style={{ padding: "8px 8px 0", display: "flex", flexWrap: "wrap", gap: 4 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 8px", background: "var(--df-surface-raised)", border: "1px solid var(--df-border-subtle)", borderRadius: 999, fontFamily: "var(--df-font-mono)", fontSize: 10, color: "var(--df-text-secondary)" }}>
              attached.png
              <span style={{ cursor: "pointer", color: "var(--df-text-faint)" }}>×</span>
            </span>
          </div>
          <textarea rows={3} placeholder="Describe what to create…" style={{ width: "100%", resize: "vertical", background: "transparent", border: 0, outline: 0, color: "var(--df-text-primary)", fontFamily: "var(--df-font-sans)", fontSize: 13, padding: "8px 10px" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", borderTop: "1px solid var(--df-border-subtle)" }}>
            <div style={{ display: "flex", gap: 4 }}>
              {[
                <svg key="1" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21 12-9 9a6 6 0 0 1-8.5-8.5l9-9a4 4 0 0 1 5.7 5.7l-9 9a2 2 0 0 1-2.8-2.8l8.5-8.5" /></svg>,
                <svg key="2" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" /></svg>,
                <svg key="3" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" x2="12" y1="19" y2="22" /></svg>,
              ].map((icon, i) => (
                <button key={i} type="button" style={{ width: 24, height: 24, padding: 0, background: "transparent", border: 0, color: "var(--df-text-muted)", cursor: "pointer", borderRadius: 4, display: "grid", placeItems: "center" }}>
                  {icon}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Field>

      {/* Primary CTA + arrow */}
      <button type="button" className="df-btn df-btn--primary" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%" }}>
        <span>Create project</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </button>
      <button type="button" style={{ background: "transparent", border: 0, padding: "8px 0", color: "var(--df-text-muted)", fontFamily: "var(--df-font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, cursor: "pointer" }}>
        or start from existing HTML →
      </button>
    </div>
  );
}

function Surfaces() {
  return (
    <div style={{ background: "var(--df-bg-sunken)", padding: 16, borderRadius: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      {(["bg-base", "bg-section", "surface-raised", "surface-elevated"] as const).map((level) => (
        <div key={level} style={{ background: `var(--df-${level})`, border: "1px solid var(--df-border-subtle)", borderRadius: 10, padding: 10, fontFamily: "var(--df-font-mono)", fontSize: 11, color: "var(--df-text-secondary)" }}>
          {level}
        </div>
      ))}
    </div>
  );
}

// ─── shared inline styles ────────────────────────────────────────────

function tactileBtnStyle(state: "rest" | "hover" | "pressed"): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "inline-flex", alignItems: "center",
    padding: "7px 14px",
    fontFamily: "var(--df-font-sans)", fontSize: 12, fontWeight: 500,
    color: "var(--df-text-on-tactile, var(--df-text-primary))",
    background: "var(--df-bg-button-tactile)",
    border: "none",
    borderRadius: "var(--df-r-md)",
    cursor: "pointer",
    transition: "transform 100ms ease, box-shadow 100ms ease, background 100ms ease",
  };
  if (state === "rest") return { ...base, boxShadow: "var(--df-shadow-button-tactile)" };
  if (state === "hover") return { ...base, background: "var(--df-bg-button-tactile-hover)", boxShadow: "var(--df-shadow-button-tactile-hover, var(--df-shadow-button-tactile))", transform: "translateY(-1px)" };
  return { ...base, boxShadow: "var(--df-shadow-button-tactile-pressed, var(--df-shadow-button-tactile))", transform: "translateY(1px)" };
}

const anchorRowStyle: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 6 };
const anchorChipStyle: React.CSSProperties = {
  display: "inline-flex", padding: "4px 10px",
  fontFamily: "var(--df-font-mono)", fontSize: 10,
  color: "var(--df-text-secondary)",
  background: "var(--df-surface-raised)",
  border: "1px solid var(--df-border-subtle)",
  borderRadius: 999,
  textDecoration: "none",
};
const groupLabelStyle: React.CSSProperties = {
  fontFamily: "var(--df-font-mono)", fontSize: 10,
  color: "var(--df-text-faint)",
  textTransform: "uppercase", letterSpacing: 0.4,
  marginBottom: 8,
};
const swatchRowStyle: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 12 };
const swatchItemStyle: React.CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", gap: 6 };
const swatchCodeStyle: React.CSSProperties = { fontFamily: "var(--df-font-mono)", fontSize: 10, color: "var(--df-text-secondary)", textAlign: "center" };

const inputStyle: React.CSSProperties = {
  display: "block", width: "100%",
  padding: "9px 11px",
  background: "var(--df-bg-base)",
  border: "1px solid var(--df-border-subtle)",
  borderRadius: 6,
  color: "var(--df-text-primary)",
  fontFamily: "var(--df-font-mono)", fontSize: 12,
  outline: "none",
  boxShadow: "inset 0 1px 2px rgba(0,0,0,0.28), inset 0 -1px 0 rgba(255,255,255,0.02)",
};
const inputAdornStyle: React.CSSProperties = {
  position: "absolute", right: 8, top: 8,
  width: 24, height: 24,
  background: "transparent", border: "none",
  color: "var(--df-text-muted)", cursor: "pointer",
  display: "grid", placeItems: "center",
  borderRadius: 4,
};
const checkLabelStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10,
  fontFamily: "var(--df-font-sans)", fontSize: 12,
  color: "var(--df-text-primary)", cursor: "pointer",
};
const checkboxStyle: React.CSSProperties = {
  width: 14, height: 14,
  accentColor: "var(--df-accent-user, #c7955a)",
};

// Details/accordion
const detailsStyle: React.CSSProperties = {
  background: "var(--df-bg-section)",
  border: "1px solid var(--df-border-subtle)",
  borderRadius: 8,
  overflow: "hidden",
};
const summaryStyle: React.CSSProperties = {
  padding: "10px 14px",
  display: "flex", alignItems: "center", justifyContent: "space-between",
  color: "var(--df-text-primary)",
  fontFamily: "var(--df-font-sans)", fontSize: 13, fontWeight: 500,
  cursor: "pointer",
  userSelect: "none",
};

// Pills
function badge(kind: "ok" | "warn" | "danger" | "muted" | "info"): React.CSSProperties {
  const tones: Record<typeof kind, { fg: string; bg: string }> = {
    ok:     { fg: "var(--df-accent-ok, #5faa54)",     bg: "color-mix(in srgb, var(--df-accent-ok, #5faa54) 12%, transparent)" },
    warn:   { fg: "var(--df-accent-warn, #f0a500)",   bg: "color-mix(in srgb, var(--df-accent-warn, #f0a500) 12%, transparent)" },
    danger: { fg: "var(--df-accent-danger, #ff6b6b)", bg: "color-mix(in srgb, var(--df-accent-danger, #ff6b6b) 12%, transparent)" },
    muted:  { fg: "var(--df-text-faint)",             bg: "var(--df-surface-raised)" },
    info:   { fg: "var(--df-text-secondary)",         bg: "var(--df-surface-raised)" },
  };
  const t = tones[kind];
  return {
    display: "inline-flex", alignItems: "center",
    fontFamily: "var(--df-font-mono)", fontSize: 10,
    padding: "3px 9px",
    borderRadius: 999,
    background: t.bg,
    color: t.fg,
    border: "1px solid var(--df-border-subtle)",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontWeight: 600,
    lineHeight: 1.4,
  };
}
function pillToolbar(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "5px 12px",
    borderRadius: 999,
    background: active ? "var(--df-surface-raised)" : "transparent",
    border: "1px solid var(--df-border-subtle)",
    fontFamily: "var(--df-font-sans)", fontSize: 12,
    color: active ? "var(--df-text-primary)" : "var(--df-text-muted)",
  };
}
const counterStyle: React.CSSProperties = {
  display: "inline-grid", placeItems: "center",
  minWidth: 18, height: 18,
  padding: "0 6px",
  borderRadius: 999,
  background: "var(--df-accent-user, #c7955a)",
  color: "var(--df-text-inverse, #161613)",
  fontFamily: "var(--df-font-mono)", fontSize: 10, fontWeight: 700,
};

// Color badge
const colorBadgeStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "4px 8px",
  background: "var(--df-surface-raised)",
  border: "1px solid var(--df-border-subtle)",
  borderRadius: 999,
  fontFamily: "var(--df-font-mono)", fontSize: 10,
  color: "var(--df-text-secondary)",
};

// "Trigger like" — used by Format & direction (open-modal-on-click style)
const triggerLikeStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8,
  width: "100%",
  padding: "8px 11px",
  background: "var(--df-bg-base)",
  border: "1px solid var(--df-border-subtle)",
  borderRadius: 8,
  color: "var(--df-text-secondary)",
  cursor: "pointer",
  boxShadow: "inset 0 1px 2px rgba(0,0,0,0.28)",
};

// Form field wrapper with label
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontFamily: "var(--df-font-mono)", fontSize: 10, color: "var(--df-text-faint)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

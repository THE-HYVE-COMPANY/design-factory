import { useState, type ReactNode } from "react";
import { DfBtn } from "@/components/DfBtn";
import { DfCard, DfCardBody, DfCardTitle, DfCardSub, DfCardThumb } from "@/components/DfCard";
import { DfInput, DfField } from "@/components/DfInput";
import { DfTextarea } from "@/components/DfTextarea";
import { DfSelect } from "@/components/DfSelect";
import { DfChip } from "@/components/DfChip";
import { DfBanner } from "@/components/DfBanner";
import { DfModal } from "@/components/DfModal";
import { DfProgress, DfSpinner } from "@/components/DfProgress";
import { DfLoader } from "@/components/DfLoader";
import { DfLoaderInline } from "@/components/DfLoaderInline";
import { Skeleton } from "@/components/Skeleton";
import { DfToastStack } from "@/components/DfToast";
import { ToastProvider, useToast } from "@/hooks/useToast";
import { useFieldError } from "@/hooks/useFieldError";
import { useUndoableAction } from "@/hooks/useUndoableAction";

type Tab =
  | "foundations"
  | "button"
  | "card"
  | "input"
  | "modal"
  | "chip"
  | "tab-nav"
  | "banner"
  | "loader"
  | "motion"
  | "migration";

const TABS: Array<{ id: Tab; label: string; num: string }> = [
  { id: "foundations", label: "Foundations", num: "01" },
  { id: "button",      label: "Button",      num: "02" },
  { id: "card",        label: "Card",        num: "03" },
  { id: "input",       label: "Input / Field", num: "04" },
  { id: "modal",       label: "Modal",       num: "05" },
  { id: "chip",        label: "Chip",        num: "06" },
  { id: "tab-nav",     label: "Tab / Nav",   num: "07" },
  { id: "banner",      label: "Banner",      num: "08" },
  { id: "loader",      label: "Loader",      num: "09" },
  { id: "motion",      label: "Motion",      num: "10" },
  { id: "migration",   label: "Migration",   num: "11" },
];

const ARTIFACT_URL = "http://localhost:4200/df-components-ds-2026-04-21/";

interface DevScreenProps {
  onExit: () => void;
}

export function DevScreen(props: DevScreenProps) {
  return (
    <ToastProvider>
      <DevScreenInner {...props} />
      <DfToastStack />
    </ToastProvider>
  );
}

function DevScreenInner({ onExit }: DevScreenProps) {
  const [tab, setTab] = useState<Tab>("button");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100vw", overflow: "hidden" }}>
      <DevHeader tab={tab} onExit={onExit} />
      <nav
        className="df-tabs-strip"
        role="tablist"
        aria-label="DS v0.2 atom harness"
        style={{ paddingLeft: "var(--df-sp-7)", paddingRight: "var(--df-sp-7)" }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className="df-tab"
            onClick={() => setTab(t.id)}
          >
            <span style={{ fontFamily: "var(--df-font-mono)", fontSize: 10, color: "var(--df-text-faint)", marginRight: 8 }}>{t.num}</span>
            {t.label}
          </button>
        ))}
      </nav>
      <div style={{ flex: 1, overflowY: "auto", padding: "var(--df-sp-7)" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          {tab === "foundations" && <FoundationsPanel />}
          {tab === "button" && <ButtonPanel />}
          {tab === "card" && <CardPanel />}
          {tab === "input" && <InputPanel />}
          {tab === "modal" && <ModalPanel />}
          {tab === "chip" && <ChipPanel />}
          {tab === "tab-nav" && <TabNavPanel />}
          {tab === "banner" && <BannerPanel />}
          {tab === "loader" && <LoaderPanel />}
          {tab === "motion" && <MotionPanel />}
          {tab === "migration" && <MigrationPanel />}
        </div>
      </div>
    </div>
  );
}

function DevHeader({ tab, onExit }: { tab: Tab; onExit: () => void }) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "var(--df-sp-3) var(--df-sp-7)",
        borderBottom: "1px solid var(--df-border-divider)",
        background: "var(--df-bg-section)",
      }}
    >
      <div>
        <div style={{ fontFamily: "var(--df-font-mono)", fontSize: 10, color: "var(--df-text-faint)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
          DS v0.2 · Fase A harness
        </div>
        <div style={{ fontSize: "var(--df-text-sm)", fontWeight: 600, color: "var(--df-text-primary)", marginTop: 2 }}>
          Atoms live — compare side-by-side with the artifact preview
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <DfBtn
          variant="secondary"
          size="sm"
          onClick={() => window.open(`${ARTIFACT_URL}#${tab}`, "_blank")}
        >
          Open artifact ↗
        </DfBtn>
        <DfBtn variant="ghost" size="sm" onClick={onExit}>
          Exit dev
        </DfBtn>
      </div>
    </header>
  );
}

/* ──────────── Panels ──────────── */

function Section({ kicker, title, desc, children }: { kicker: string; title: string; desc?: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: "var(--df-sp-7)" }}>
      <div style={{ fontFamily: "var(--df-font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--df-text-faint)", marginBottom: 6 }}>{kicker}</div>
      <h2 style={{ fontSize: "var(--df-text-md)", fontWeight: 600, letterSpacing: "-0.015em", marginBottom: 6 }}>{title}</h2>
      {desc && <p style={{ fontSize: "var(--df-text-sm)", color: "var(--df-text-muted)", marginBottom: "var(--df-sp-5)", maxWidth: 720 }}>{desc}</p>}
      {children}
    </section>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", gap: "var(--df-sp-3)", flexWrap: "wrap", alignItems: "flex-start" }}>{children}</div>;
}

function FoundationsPanel() {
  const layers: Array<{ name: string; token: string }> = [
    { name: "sunken",   token: "--df-bg-sunken" },
    { name: "base",     token: "--df-bg-base" },
    { name: "section",  token: "--df-bg-section" },
    { name: "raised",   token: "--df-surface-raised" },
    { name: "elevated", token: "--df-surface-elevated" },
  ];
  return (
    <>
      <Section kicker="layers" title="Surface layer scale">
        <Row>
          {layers.map((l) => (
            <div
              key={l.name}
              style={{
                width: 160,
                height: 80,
                background: `var(${l.token})`,
                border: "1px solid var(--df-border-subtle)",
                borderRadius: "var(--df-r-md)",
                padding: 10,
                fontFamily: "var(--df-font-mono)",
                fontSize: 10,
                color: "var(--df-text-faint)",
              }}
            >
              {l.name}
            </div>
          ))}
        </Row>
      </Section>
      <Section kicker="accents" title="Semantic accents + tints (v0.2)">
        <Row>
          {(["warn", "danger", "ok", "info"] as const).map((tone) => (
            <DfChip key={tone} status={tone}>{tone}</DfChip>
          ))}
        </Row>
      </Section>
    </>
  );
}

function ButtonPanel() {
  return (
    <>
      <Section kicker="variants" title="Four hierarchies, one base class" desc="Primary > Secondary > Ghost > Danger. Each variant is a class modifier on .df-btn; sizes are orthogonal.">
        <Row>
          <DfBtn variant="primary">Primary</DfBtn>
          <DfBtn variant="secondary">Secondary</DfBtn>
          <DfBtn variant="ghost">Ghost</DfBtn>
          <DfBtn variant="danger">Danger</DfBtn>
        </Row>
      </Section>
      <Section kicker="sizes" title="Three sizes — 28 / 36 / 44">
        <Row>
          <DfBtn variant="primary" size="sm">Small</DfBtn>
          <DfBtn variant="primary" size="md">Medium</DfBtn>
          <DfBtn variant="primary" size="lg">Large</DfBtn>
        </Row>
      </Section>
      <Section kicker="states" title="States inherit base transitions (120ms ease-out)">
        <Row>
          <DfBtn variant="primary" disabled>Disabled</DfBtn>
          <DfBtn variant="primary" loading>Loading</DfBtn>
          <DfBtn variant="secondary" icon aria-label="Icon button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
          </DfBtn>
        </Row>
      </Section>
    </>
  );
}

function CardPanel() {
  return (
    <>
      <Section kicker="variants" title="Card variants — hover lift -2px (interactive) / -4px (feature)">
        <Row>
          <div style={{ width: 240 }}>
            <DfCard variant="interactive">
              <DfCardThumb>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>
              </DfCardThumb>
              <DfCardBody>
                <DfCardTitle>Interactive</DfCardTitle>
                <DfCardSub>hover lift -2px</DfCardSub>
              </DfCardBody>
            </DfCard>
          </div>
          <div style={{ width: 240 }}>
            <DfCard variant="feature">
              <DfCardThumb>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2l3 7h7l-5.5 4 2 8L12 17l-6.5 4 2-8L2 9h7z" /></svg>
              </DfCardThumb>
              <DfCardBody>
                <DfCardTitle>Feature</DfCardTitle>
                <DfCardSub>hover lift -4px</DfCardSub>
              </DfCardBody>
            </DfCard>
          </div>
          <div style={{ width: 240 }}>
            <DfCard variant="dashed">
              <span style={{ fontSize: 24 }}>+</span>
              <span>Add design system</span>
            </DfCard>
          </div>
          <div style={{ width: 240 }}>
            <DfCard variant="empty">
              <div style={{ color: "var(--df-text-muted)", marginBottom: 8 }}>No skills yet</div>
              <DfBtn variant="secondary" size="sm">Browse catalog</DfBtn>
            </DfCard>
          </div>
        </Row>
      </Section>
    </>
  );
}

function InputPanel() {
  const [value, setValue] = useState("");
  const err = useFieldError();
  return (
    <>
      <Section kicker="field" title="Input + Field composition">
        <div style={{ maxWidth: 400, display: "flex", flexDirection: "column", gap: 14 }}>
          <DfField label="Project name" hint="Used as the folder name on disk.">
            <DfInput placeholder="e.g. editorial-week-01" value={value} onChange={(e) => setValue(e.target.value)} />
          </DfField>
          <DfField label="With error" error={err.error}>
            <DfInput error={!!err.error} shake={err.shaking} placeholder="Submit empty to test" onBlur={() => !value.trim() && err.trigger("Name required")} />
          </DfField>
          <DfField label="Search" search leadingIcon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" strokeLinecap="round" /></svg>}>
            <DfInput placeholder="Search projects…" />
          </DfField>
          <DfField label="Notes">
            <DfTextarea placeholder="Optional description" />
          </DfField>
          <DfField label="Provider">
            <DfSelect
              items={[
                { value: "claude", label: "Claude", sub: "sonnet 4.6" },
              ]}
              value="claude"
              onChange={() => {}}
              aria-label="Provider"
              minWidth={220}
            />
          </DfField>
        </div>
      </Section>
    </>
  );
}

function ModalPanel() {
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState<"sm" | "md" | "lg" | "xl">("md");
  return (
    <Section kicker="dialog" title="Modal sizes + focus trap">
      <Row>
        {(["sm", "md", "lg", "xl"] as const).map((s) => (
          <DfBtn key={s} variant="secondary" onClick={() => { setSize(s); setOpen(true); }}>
            Open {s}
          </DfBtn>
        ))}
      </Row>
      <DfModal
        open={open}
        onClose={() => setOpen(false)}
        size={size}
        title={`Modal — ${size}`}
        foot={
          <>
            <DfBtn variant="ghost" onClick={() => setOpen(false)}>Cancel</DfBtn>
            <DfBtn variant="primary" onClick={() => setOpen(false)}>Confirm</DfBtn>
          </>
        }
      >
        <p style={{ color: "var(--df-text-secondary)", marginBottom: 12 }}>
          Focus is trapped inside the modal. Tab cycles through focusables; Shift+Tab cycles backwards. Escape closes. Backdrop click closes.
        </p>
        <DfField label="Sample input">
          <DfInput placeholder="Focus lands here on mount" />
        </DfField>
      </DfModal>
    </Section>
  );
}

function ChipPanel() {
  return (
    <>
      <Section kicker="status" title="Status chips — dot + tinted background">
        <Row>
          <DfChip status="ok">Connected</DfChip>
          <DfChip status="warn">Degraded</DfChip>
          <DfChip status="danger">Offline</DfChip>
          <DfChip status="info">Syncing</DfChip>
          <DfChip status="neutral">Idle</DfChip>
        </Row>
      </Section>
      <Section kicker="labels" title="Label + capability + source chips">
        <Row>
          <DfChip label>tokens</DfChip>
          <DfChip label>canvas</DfChip>
          <DfChip capability>tools</DfChip>
          <DfChip capability>mcp</DfChip>
          <DfChip capability off>agents</DfChip>
          <DfChip source="df">df</DfChip>
          <DfChip source="project">project</DfChip>
          <DfChip source="global">global</DfChip>
          <DfChip source="builtin">builtin</DfChip>
        </Row>
      </Section>
    </>
  );
}

function TabNavPanel() {
  const [active, setActive] = useState("projects");
  return (
    <>
      <Section kicker="tabs" title="Underline tabs">
        <nav className="df-tabs-strip" style={{ marginBottom: 12 }} role="tablist">
          {["projects", "templates", "design-systems", "skills"].map((id) => (
            <button
              key={id}
              role="tab"
              aria-selected={active === id}
              className="df-tab"
              onClick={() => setActive(id)}
            >
              {id}
            </button>
          ))}
        </nav>
      </Section>
      <Section kicker="nav" title="Left-rail nav items">
        <div style={{ width: 240, display: "flex", flexDirection: "column", gap: 2, padding: 8, background: "var(--df-bg-section)", borderRadius: "var(--df-r-lg)" }}>
          <button className="df-nav-item" aria-selected>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>
            General
          </button>
          <button className="df-nav-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M12 1v6M12 17v6M4.22 4.22l4.24 4.24M15.54 15.54l4.24 4.24" /></svg>
            Providers
            <span className="count">4</span>
          </button>
          <button className="df-nav-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7h18M3 12h18M3 17h12" strokeLinecap="round" /></svg>
            Skills
            <span className="count">228</span>
          </button>
        </div>
      </Section>
    </>
  );
}

function BannerPanel() {
  return (
    <>
      <Section kicker="severity" title="Banner severities — info / warn / danger / ok">
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 520 }}>
          <DfBanner severity="info" title="No providers connected" sub="Install a CLI to start generating." action={<DfBtn variant="ghost" size="sm">Open Settings</DfBtn>} onDismiss={() => {}} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" strokeLinecap="round" /></svg>} />
          <DfBanner severity="warn" title="Gemini quota at 80%" sub="Switch to Claude to avoid interruption." icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 22h20L12 2z" strokeLinecap="round" strokeLinejoin="round" /><path d="M12 9v4M12 17h.01" /></svg>} />
          <DfBanner severity="danger" title="claude: command not found" sub="CLI is not in PATH." action={<DfBtn variant="ghost" size="sm">Fix in Settings</DfBtn>} />
          <DfBanner severity="ok" title="Provider connected" sub="Claude is ready to use." />
        </div>
      </Section>
    </>
  );
}

function LoaderPanel() {
  const [pct, setPct] = useState(0.35);
  return (
    <>
      <Section kicker="progress" title="Progress — determinate + indeterminate">
        <div style={{ maxWidth: 420, display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <DfProgress value={pct} label="Upload progress" />
            <Row>
              <DfBtn size="sm" variant="ghost" onClick={() => setPct((p) => Math.max(0, p - 0.1))}>-10%</DfBtn>
              <DfBtn size="sm" variant="ghost" onClick={() => setPct((p) => Math.min(1, p + 0.1))}>+10%</DfBtn>
            </Row>
          </div>
          <DfProgress label="Connecting…" />
        </div>
      </Section>
      <Section kicker="goo" title="Loader — 6 goo relations" desc="Three dots through a goo filter. Pick the relation that matches the task shape.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--df-sp-5)" }}>
          {(["heartbeat", "stream", "cascade", "bloom", "triad", "morse"] as const).map((r) => (
            <div key={r} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "var(--df-sp-4)", background: "var(--df-bg-sunken)", borderRadius: "var(--df-r-lg)" }}>
              <DfLoader relation={r} size={160} />
              <span style={{ fontFamily: "var(--df-font-mono)", fontSize: 10, color: "var(--df-text-faint)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{r}</span>
            </div>
          ))}
        </div>
      </Section>
      <Section kicker="inline" title="DfLoaderInline — dense UI chrome" desc="CSS-only 3-dot pulse. Drops into buttons, chat tails, status lines.">
        <Row>
          <DfBtn variant="primary">
            Submitting <DfLoaderInline />
          </DfBtn>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--df-text-secondary)" }}>
            Waiting for response <DfLoaderInline />
          </span>
        </Row>
      </Section>
      <Section kicker="spinner" title="Spinner sizes" desc="Legacy CSS-only spinner — use for very tight spaces where even DfLoaderInline feels heavy.">
        <Row>
          <DfSpinner size="sm" /> <DfSpinner /> <DfSpinner size="lg" />
        </Row>
      </Section>
      <Section kicker="skeleton" title="Skeleton placeholders">
        <div style={{ maxWidth: 400, display: "flex", flexDirection: "column", gap: 10 }}>
          <Skeleton h={16} w="60%" />
          <Skeleton h={12} w="90%" />
          <Skeleton h={12} w="80%" />
          <Skeleton h={100} radius={10} />
        </div>
      </Section>
    </>
  );
}

function MotionPanel() {
  return (
    <Section kicker="motion" title="Motion catalog — consult artifact tab 10 for the 12 patterns" desc="Individual patterns are demonstrated in the artifact and baked into atom CSS (button press, card lift, dropdown fade, modal in, toast slide, undo bar, skeleton shimmer, spinner spin, progress indet).">
      <p style={{ color: "var(--df-text-muted)", fontSize: "var(--df-text-sm)" }}>
        All motion in this harness uses the canonical 4 durations × 6 curves from tokens.css. Open the artifact Motion tab to see each pattern isolated with its duration × easing annotation.
      </p>
    </Section>
  );
}

function MigrationPanel() {
  return (
    <Section kicker="spec" title="Migration spec-of-record" desc="6 phases, ~16-19h, split 3 PRs. File:line references for every rename/bug/ARIA gap live in the artifact Migration tab.">
      <p style={{ color: "var(--df-text-muted)", fontSize: "var(--df-text-sm)" }}>
        PR1 (this) ships tokens + atoms. PR2 migrates call sites + ships Loaders v2 + 48-icon library. PR3 applies Layouts Day A to all screens and closes ARIA backfill.
      </p>
      <div style={{ marginTop: 16 }}>
        <DfBtn
          variant="secondary"
          onClick={() => window.open(`${ARTIFACT_URL}#migration`, "_blank")}
        >
          Open migration tab ↗
        </DfBtn>
      </div>
    </Section>
  );
}

/* Also export the harness demo for a toast action, so ToastProvider consumers
 * within App.tsx can exercise the flow. */
export function DevToastDemo() {
  const { push } = useToast();
  return (
    <DfBtn
      variant="secondary"
      onClick={() =>
        push({
          severity: "ok",
          title: "Toast pushed",
          body: "useToast + DfToastStack are live.",
          action: { label: "Undo", onClick: () => {} },
        })
      }
    >
      Push toast
    </DfBtn>
  );
}

/* Exported so tests can mount the raw inner without ToastProvider wrap. */
export { DevScreenInner };

/* Re-export for tests that cover the rollback timer. */
export { useUndoableAction };

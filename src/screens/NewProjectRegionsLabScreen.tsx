// NewProjectRegionsLabScreen — pick one variation per region (hero, name,
// direction, design-systems, model, button) and watch the layout assemble
// live in the right pane. All variations stay inside the skeu refined
// visual vocabulary (plate / bowl / engrave / key / LED / recess) so any
// combination still feels like one design.
//
// No "start with HTML" mode — the user attaches HTML files via the
// regular file picker on the prompt area instead.

import { useEffect, useState, useRef, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { DfModal } from "@/components/DfModal";
import { DirectionModal } from "@/components/DirectionModal";
import {
  db,
  listDesignSystemsFromFilesystem,
  readFileViaBridge,
  type FsDesignSystem,
} from "@/lib/claude-bridge";
import { parseDesignSystem } from "@/lib/ds-google";
import { ProviderIdSchema } from "@/lib/schemas";
import {
  getModelsForProvider,
  defaultModelForProvider,
  readLastModel,
  writeLastModel,
  useLiveModelOptions,
} from "@/providers/model-lists";
import type { ProviderId } from "@/providers/types";
import {
  getFormatoById,
  type DirectionSelection,
} from "@/data/direction-data";

// Direction label for any variant — formato name + (optional) direction count.
function formatDirectionLabel(sel: DirectionSelection | null): string | null {
  if (!sel) return null;
  const fmt = getFormatoById(sel.formatoId);
  if (!fmt) return null;
  const dirCount = sel.directionIds?.length ?? 0;
  return dirCount > 0 ? `${fmt.nome} · ${dirCount} direction${dirCount === 1 ? "" : "s"}` : fmt.nome;
}
import "@/styles/np-regions-lab.css";

type RegionKey = "hero" | "name" | "direction" | "ds" | "model" | "button";
type Picks = Record<RegionKey, number>;

interface RegionState {
  name: string;
  setName: (v: string) => void;
  // Direction is the real DirectionSelection; `directionLabel` is the
  // formatted human-readable label for display in any variant.
  direction: DirectionSelection | null;
  directionLabel: string | null;
  setDirection: (v: DirectionSelection | null) => void;
  // DS picks come from the filesystem now (FsDesignSystem). Identity is
  // the `path` (stable across renames) and swatches come from a parsed
  // design.md cache.
  designSystems: FsDesignSystem[];
  dsSwatches: Record<string, string[]>;
  selectedDsPath: string | null;
  pickDs: (path: string | null) => void;
  // Model + provider are read from the topbar's `default_provider`. The
  // model dropdown is opened via openModelMenu so a single instance lives
  // at screen level (escapes any ancestor overflow).
  provider: ProviderId;
  model: string;
  setModel: (v: string) => void;
  modelMenuOpen: boolean;
  setModelMenuOpen: (next: boolean) => void;
  // Cross-region modals.
  openDsModal: () => void;
  openDirectionModal: () => void;
}

// Visible-3 strategy — selected first, then the 2 most-recently-added.
// `mtime`-sorted upstream so "recent" is meaningful.
function visibleThreeDs(systems: FsDesignSystem[], selectedPath: string | null): FsDesignSystem[] {
  if (systems.length === 0) return [];
  const sorted = [...systems].sort((a, b) => b.mtime - a.mtime);
  if (!selectedPath) return sorted.slice(0, 3);
  const sel = sorted.find((d) => d.path === selectedPath);
  const rest = sorted.filter((d) => d.path !== selectedPath);
  return [sel ?? sorted[0], ...rest].slice(0, 3);
}

// ─── HERO (5) ───────────────────────────────────────────────────────────
function HeroV1() { // production-aligned — ASCII grain + Logo + title (mirrors home-np-header)
  return (
    <div className="reg-card reg-hero reg-hero--prod">
      <pre className="reg-prod-ascii" aria-hidden="true">{`· · · · · · · · · · · · · · · · · · · · · · ·
· · · · · · · · · · · · · · · · · · · · · · ·
· · · · · · · · · · · · · · · · · · · · · · ·
· · · · · · · · · · · · · · · · · · · · · · ·
· · · · · · · · · · · · · · · · · · · · · · ·`}</pre>
      <Logo size={26} className="reg-prod-mark" />
      <div className="reg-prod-copy">
        <div className="reg-prod-kicker">new project</div>
        <div className="reg-prod-title">What are we building?</div>
      </div>
    </div>
  );
}
function HeroV2() { // brushed bar
  return (
    <div className="reg-card reg-hero reg-hero--brushed">
      <Logo size={18} className="reg-brushed-mark" />
      <div className="reg-brushed-divider" />
      <div className="reg-brushed-title">New Project</div>
      <div className="reg-brushed-meta">DF · {new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit" })}</div>
    </div>
  );
}
function HeroV3() { // embossed wedge
  return (
    <div className="reg-card reg-hero reg-hero--wedge">
      <div className="reg-wedge-block">
        <div className="reg-wedge-num">01</div>
        <div className="reg-wedge-stack">
          <div className="reg-wedge-eyebrow">Workspace · DF</div>
          <div className="reg-wedge-title">New Project</div>
        </div>
      </div>
      <div className="reg-wedge-rivets" aria-hidden="true">
        <span /><span /><span /><span />
      </div>
    </div>
  );
}
function HeroV4({ s }: { s: RegionState }) { // recessed LCD window — live name w/ cursor
  const display = s.name.trim() ? s.name.toUpperCase() : "DF–01";
  return (
    <div className="reg-card reg-hero reg-hero--lcd">
      <div className="reg-lcd-frame reg-lcd-frame--full">
        <div className="reg-lcd-screen">
          <span className="reg-lcd-line">
            {display}<span className="reg-lcd-caret" aria-hidden="true">_</span>
          </span>
          <span className="reg-lcd-line reg-lcd-line--sub">
            {s.name.trim() ? "PROJECT NAMED" : "AWAITING NAME"}
          </span>
        </div>
      </div>
    </div>
  );
}
function HeroV5() { // stencil folder tab
  return (
    <div className="reg-card reg-hero reg-hero--stencil">
      <div className="reg-stencil-tab">FILE</div>
      <div className="reg-stencil-body">
        <div className="reg-stencil-title">NEW PROJECT</div>
        <div className="reg-stencil-sub">/ design factory / 01</div>
      </div>
    </div>
  );
}

// ─── NAME (5) ───────────────────────────────────────────────────────────
function NameV1({ s }: { s: RegionState }) { // recessed bowl, no prefix, no focus ring
  return (
    <div className="reg-bowl">
      <span className="reg-engrave">Project name</span>
      <div className="reg-input-wrap">
        <input className="reg-input" placeholder="my-next-thing" value={s.name} onChange={(e) => s.setName(e.target.value)} />
      </div>
    </div>
  );
}
function NameV2({ s }: { s: RegionState }) { // tape label
  return (
    <div className="reg-name-tape">
      <span className="reg-tape-clip" aria-hidden="true">◤</span>
      <input className="reg-tape-input" placeholder="MY NEXT THING" value={s.name} onChange={(e) => s.setName(e.target.value)} />
      <span className="reg-tape-clip reg-tape-clip--right" aria-hidden="true">◥</span>
    </div>
  );
}
function NameV3({ s }: { s: RegionState }) { // engrave above, recessed below (no prefix)
  return (
    <div className="reg-bowl">
      <span className="reg-engrave reg-engrave--center">Name this project</span>
      <div className="reg-input-wrap reg-input-wrap--deep">
        <input className="reg-input reg-input--center" placeholder="enter project name" value={s.name} onChange={(e) => s.setName(e.target.value)} />
      </div>
      <span className="reg-input-helper">lowercase, dashes ok</span>
    </div>
  );
}
function NameV4({ s }: { s: RegionState }) { // type slug brackets
  return (
    <div className="reg-bowl">
      <span className="reg-engrave">SLUG</span>
      <div className="reg-slug-row">
        <span className="reg-slug-bracket">[</span>
        <input className="reg-slug-input" placeholder="project-slug" value={s.name} onChange={(e) => s.setName(e.target.value)} />
        <span className="reg-slug-bracket">]</span>
      </div>
    </div>
  );
}
function NameV5({ s }: { s: RegionState }) { // dial counter chunky
  return (
    <div className="reg-name-dial">
      <div className="reg-dial-side">
        <span className="reg-dial-tick">●</span>
        <span className="reg-dial-tick">●</span>
        <span className="reg-dial-tick">●</span>
      </div>
      <input className="reg-dial-input" placeholder="my-next-thing" value={s.name} onChange={(e) => s.setName(e.target.value)} />
      <div className="reg-dial-side">
        <span className="reg-dial-tick">●</span>
        <span className="reg-dial-tick">●</span>
        <span className="reg-dial-tick">●</span>
      </div>
    </div>
  );
}

// ─── DIRECTION (5) ──────────────────────────────────────────────────────
// All variants open the real DirectionModal on click. The ONLY visual
// diff between empty and configured is the LED — every other surface
// element stays identical between the two states.
const PLACEHOLDER = "Pick a direction";
function DirectionV1({ s }: { s: RegionState }) { // ribbon tab
  const filled = !!s.direction;
  return (
    <div className="reg-bowl">
      <span className="reg-engrave">Direction</span>
      <button className="reg-dir-ribbon" onClick={s.openDirectionModal}>
        <span className="reg-dir-ribbon-tab">{filled ? <span className="reg-led" /> : "▸"}</span>
        <span className="reg-dir-ribbon-label">{s.directionLabel ?? PLACEHOLDER}</span>
      </button>
    </div>
  );
}
function DirectionV2({ s }: { s: RegionState }) { // selector wheel
  const filled = !!s.direction;
  return (
    <div className="reg-bowl">
      <span className="reg-engrave">Direction</span>
      <button className="reg-dir-wheel" onClick={s.openDirectionModal}>
        <span className="reg-dir-wheel-arrow">‹</span>
        <span className="reg-dir-wheel-label">{s.directionLabel ?? PLACEHOLDER}</span>
        {filled ? <span className="reg-led reg-dir-wheel-led" /> : <span className="reg-dir-wheel-arrow">›</span>}
      </button>
    </div>
  );
}
function DirectionV3({ s }: { s: RegionState }) { // engraved plaque
  return (
    <div className="reg-bowl">
      <span className="reg-engrave">Direction</span>
      <button className="reg-dir-plaque" onClick={s.openDirectionModal}>
        <span className="reg-dir-plaque-bevel" />
        <span className="reg-dir-plaque-label">{s.directionLabel ?? PLACEHOLDER}</span>
        {s.direction && <span className="reg-led reg-dir-plaque-led" />}
      </button>
    </div>
  );
}
function DirectionV4({ s }: { s: RegionState }) { // stamp chip
  return (
    <div className="reg-dir-inline">
      <span className="reg-engrave reg-engrave--inline">Direction:</span>
      <button className="reg-dir-stamp" onClick={s.openDirectionModal}>
        {s.direction && <span className="reg-led" style={{ marginRight: 6, verticalAlign: "middle" }} />}
        {s.directionLabel ?? PLACEHOLDER}
        <span className="reg-dir-stamp-caret">▾</span>
      </button>
    </div>
  );
}
function DirectionV5({ s }: { s: RegionState }) { // numbered tile
  return (
    <div className="reg-bowl">
      <span className="reg-engrave">Direction</span>
      <button className="reg-dir-tile" onClick={s.openDirectionModal}>
        <div className="reg-dir-tile-num">
          {s.direction ? "✓" : "—"}
        </div>
        <div className="reg-dir-tile-name">{s.directionLabel ?? PLACEHOLDER}</div>
        {s.direction && <span className="reg-led reg-dir-tile-led" />}
      </button>
    </div>
  );
}

// ─── DS (5) — REAL data from filesystem; last 3 + "see more" modal ──────
// Swatches come from parsed design.md (cached at screen level).
// Empty state when no DS exists yet — variants degrade gracefully to a
// single "Add design system" CTA that opens the modal.
function dsSwatchOrPlaceholder(s: RegionState, path: string, n = 4): string[] {
  const live = s.dsSwatches[path] ?? [];
  if (live.length >= n) return live.slice(0, n);
  // Pad with neutral fillers so the bar always renders 4 cells.
  return [...live, ...Array(n - live.length).fill("var(--df-surface-raised)")];
}

function DsV1({ s }: { s: RegionState }) { // tactile keys row + "+N more"
  const visible = visibleThreeDs(s.designSystems, s.selectedDsPath);
  const more = Math.max(0, s.designSystems.length - 3);
  if (s.designSystems.length === 0) return <DsEmpty s={s} />;
  return (
    <div className="reg-bowl">
      <span className="reg-engrave">Design system</span>
      <div className="reg-ds-row">
        {visible.map((ds) => (
          <button key={ds.path} className={`reg-ds-key${s.selectedDsPath === ds.path ? " is-on" : ""}`} onClick={() => s.pickDs(s.selectedDsPath === ds.path ? null : ds.path)}>
            <span className="reg-ds-swatches">
              {dsSwatchOrPlaceholder(s, ds.path).map((sw, i) => <span key={i} className="reg-ds-sw" style={{ background: sw }} />)}
            </span>
            <span className="reg-ds-name">{ds.name}</span>
          </button>
        ))}
        {more > 0 && (
          <button className="reg-ds-key reg-ds-key--more" onClick={s.openDsModal}>
            <span className="reg-ds-more-num">+{more}</span>
          </button>
        )}
      </div>
    </div>
  );
}
function DsV2({ s }: { s: RegionState }) { // 3 cards + "library →" CTA
  const visible = visibleThreeDs(s.designSystems, s.selectedDsPath);
  if (s.designSystems.length === 0) return <DsEmpty s={s} />;
  return (
    <div className="reg-bowl">
      <span className="reg-engrave">Design system</span>
      <div className="reg-ds-row">
        {visible.map((ds) => (
          <button key={ds.path} className={`reg-ds-card${s.selectedDsPath === ds.path ? " is-on" : ""}`} onClick={() => s.pickDs(s.selectedDsPath === ds.path ? null : ds.path)}>
            <div className="reg-ds-card-swatchbar">
              {dsSwatchOrPlaceholder(s, ds.path).map((sw, i) => <span key={i} style={{ background: sw, flex: 1 }} />)}
            </div>
            <div className="reg-ds-card-name">{ds.name}</div>
          </button>
        ))}
        <button className="reg-ds-library-cta" onClick={s.openDsModal}>
          <span>Library</span>
          <span className="reg-ds-library-meta">{s.designSystems.length} systems →</span>
        </button>
      </div>
    </div>
  );
}
function DsV3({ s }: { s: RegionState }) { // single chip (current) + "browse"
  const current = s.designSystems.find((d) => d.path === s.selectedDsPath) ?? null;
  if (s.designSystems.length === 0) return <DsEmpty s={s} />;
  return (
    <div className="reg-bowl reg-bowl--row">
      <span className="reg-engrave">Design system</span>
      <div className="reg-ds-chip-row">
        {current ? (
          <button className="reg-ds-current-chip is-on" onClick={s.openDsModal}>
            <span className="reg-ds-drop-swatches">
              {dsSwatchOrPlaceholder(s, current.path, 3).map((sw, i) => <span key={i} style={{ background: sw }} />)}
            </span>
            <span>{current.name}</span>
          </button>
        ) : (
          <button className="reg-ds-current-chip" onClick={s.openDsModal}>
            <span className="reg-ds-drop-placeholder">none picked</span>
          </button>
        )}
        <button className="reg-ds-browse-link" onClick={s.openDsModal}>browse {s.designSystems.length} →</button>
      </div>
    </div>
  );
}
function DsV4({ s }: { s: RegionState }) { // 3 chips + "···" overflow
  const visible = visibleThreeDs(s.designSystems, s.selectedDsPath);
  const more = Math.max(0, s.designSystems.length - 3);
  if (s.designSystems.length === 0) return <DsEmpty s={s} />;
  return (
    <div className="reg-bowl">
      <span className="reg-engrave">Design system · last 3</span>
      <div className="reg-ds-chips">
        {visible.map((ds) => (
          <button key={ds.path} className={`reg-ds-chip${s.selectedDsPath === ds.path ? " is-on" : ""}`} onClick={() => s.pickDs(s.selectedDsPath === ds.path ? null : ds.path)}>
            <span className="reg-ds-chip-dot" style={{ background: (s.dsSwatches[ds.path] ?? [])[1] ?? "var(--df-text-muted)" }} />
            {ds.name}
          </button>
        ))}
        {more > 0 && (
          <button className="reg-ds-chip reg-ds-chip--more" onClick={s.openDsModal}>
            ··· +{more}
          </button>
        )}
      </div>
    </div>
  );
}
function DsV5({ s }: { s: RegionState }) { // 3 plates + footer "open library"
  const visible = visibleThreeDs(s.designSystems, s.selectedDsPath);
  if (s.designSystems.length === 0) return <DsEmpty s={s} />;
  return (
    <div className="reg-bowl">
      <span className="reg-engrave">Design system</span>
      <div className="reg-ds-stack">
        {visible.map((ds, i) => (
          <button key={ds.path} className={`reg-ds-plate${s.selectedDsPath === ds.path ? " is-on" : ""}`} onClick={() => s.pickDs(s.selectedDsPath === ds.path ? null : ds.path)}>
            <span className="reg-ds-plate-num">{(i + 1).toString().padStart(2, "0")}</span>
            <span className="reg-ds-plate-name">{ds.name}</span>
            <span className="reg-ds-plate-swatches">
              {dsSwatchOrPlaceholder(s, ds.path).map((sw, j) => <span key={j} style={{ background: sw }} />)}
            </span>
          </button>
        ))}
      </div>
      <button className="reg-ds-drawer-cta" onClick={s.openDsModal}>
        Open library · {s.designSystems.length} systems
      </button>
    </div>
  );
}
function DsEmpty({ s }: { s: RegionState }) {
  return (
    <div className="reg-bowl">
      <span className="reg-engrave">Design system</span>
      <button className="reg-ds-library-cta" onClick={s.openDsModal} style={{ alignSelf: "stretch", padding: 16 }}>
        <span>+ No design systems yet</span>
        <span className="reg-ds-library-meta">create one to start</span>
      </button>
    </div>
  );
}

// ─── MODEL (5) — REAL models from provider registry ─────────────────────
// Pulls live model list (Ollama/OpenRouter probe runtime; others static).
// V1 rocker opens the screen-level menu (escapes prompt-bar overflow).
function useModelsForState(s: RegionState) {
  const { options: live } = useLiveModelOptions(s.provider);
  const fallback = getModelsForProvider(s.provider);
  return live.length > 0 ? live : fallback;
}
function shortModelLabel(label: string): string {
  // Compress long Ollama/OpenRouter ids for the prompt bar.
  if (label.length <= 22) return label;
  return label.slice(0, 20) + "…";
}
function cycleModel(s: RegionState, opts: { id: string }[], dir: 1 | -1) {
  if (opts.length === 0) return;
  const i = opts.findIndex((o) => o.id === s.model);
  const next = (i + dir + opts.length) % opts.length;
  s.setModel(opts[next].id);
  writeLastModel(s.provider, opts[next].id);
}

function ModelV1({ s }: { s: RegionState }) { // rocker → opens screen-level menu
  const opts = useModelsForState(s);
  const current = opts.find((o) => o.id === s.model);
  return (
    <div className="reg-bowl reg-bowl--row">
      <span className="reg-engrave">Engine</span>
      <button
        className="reg-model-rocker"
        onClick={() => s.setModelMenuOpen(!s.modelMenuOpen)}
        aria-haspopup="listbox"
        aria-expanded={s.modelMenuOpen}
        data-model-trigger="true"
      >
        <span className="reg-led" />
        <span>{shortModelLabel(current?.label ?? s.model)}</span>
        <span className="reg-rocker-caret">▾</span>
      </button>
    </div>
  );
}
function ModelV2({ s }: { s: RegionState }) { // toggle bank — first 4 models
  const opts = useModelsForState(s).slice(0, 4);
  return (
    <div className="reg-bowl">
      <span className="reg-engrave">Engine</span>
      <div className="reg-model-bank">
        {opts.map((m) => (
          <button key={m.id} className={`reg-model-toggle${s.model === m.id ? " is-on" : ""}`} onClick={() => { s.setModel(m.id); writeLastModel(s.provider, m.id); }}>
            <span className="reg-model-toggle-ring" />
            <span>{m.label.split(/[-\s]/)[0]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
function ModelV3({ s }: { s: RegionState }) { // engraved plate with arrows
  const opts = useModelsForState(s);
  const current = opts.find((o) => o.id === s.model);
  return (
    <div className="reg-bowl">
      <span className="reg-engrave">Engine</span>
      <div className="reg-model-plate">
        <button className="reg-model-plate-arrow" onClick={() => cycleModel(s, opts, -1)}>‹</button>
        <div className="reg-model-plate-screen">{shortModelLabel(current?.label ?? s.model)}</div>
        <button className="reg-model-plate-arrow" onClick={() => cycleModel(s, opts, 1)}>›</button>
      </div>
    </div>
  );
}
function ModelV4({ s }: { s: RegionState }) { // pill switch — opens menu
  const opts = useModelsForState(s);
  const current = opts.find((o) => o.id === s.model);
  return (
    <div className="reg-bowl reg-bowl--row">
      <span className="reg-engrave">Engine</span>
      <button className="reg-model-pill" onClick={() => s.setModelMenuOpen(!s.modelMenuOpen)} data-model-trigger="true">
        <span className="reg-led" />
        <span className="reg-model-pill-label">{shortModelLabel(current?.label ?? s.model)}</span>
      </button>
    </div>
  );
}
function ModelV5({ s }: { s: RegionState }) { // dial — cycles through real models
  const opts = useModelsForState(s);
  const idx = Math.max(0, opts.findIndex((o) => o.id === s.model));
  const current = opts[idx];
  return (
    <div className="reg-bowl reg-bowl--row">
      <span className="reg-engrave">Engine</span>
      <button className="reg-model-dial" onClick={() => cycleModel(s, opts, 1)}>
        <div
          className="reg-model-dial-marker"
          style={{ transform: `rotate(${opts.length > 0 ? (idx / opts.length) * 360 : 0}deg)` }}
        />
        <div className="reg-model-dial-label">{shortModelLabel(current?.label ?? "—")}</div>
      </button>
    </div>
  );
}

// ─── BUTTON (5) ─────────────────────────────────────────────────────────
function ButtonV1({ s }: { s: RegionState }) { // ribbon CTA with key
  return (
    <button className="reg-cta reg-cta--ribbon" disabled={!s.name.trim()}>
      <span>Create project</span>
      <span className="reg-cta-key">⏎</span>
    </button>
  );
}
function ButtonV2({ s }: { s: RegionState }) { // embossed slab
  return (
    <button className="reg-cta reg-cta--slab" disabled={!s.name.trim()}>
      <span className="reg-cta-bevel" />
      Create project
    </button>
  );
}
function ButtonV3({ s }: { s: RegionState }) { // engraved plaque
  return (
    <button className="reg-cta reg-cta--plaque" disabled={!s.name.trim()}>
      <span className="reg-engrave reg-engrave--cta">CREATE</span>
      <span className="reg-cta-plaque-name">{s.name.trim() || "untitled"}</span>
    </button>
  );
}
function ButtonV4({ s }: { s: RegionState }) { // tactile big key
  return (
    <button className="reg-cta reg-cta--bigkey" disabled={!s.name.trim()}>
      Create
      <small>press to spawn</small>
    </button>
  );
}
function ButtonV5({ s }: { s: RegionState }) { // stamped square
  return (
    <button className="reg-cta reg-cta--stamp" disabled={!s.name.trim()}>
      <span className="reg-cta-stamp-arrow">▶</span>
      Create project
    </button>
  );
}

// ─── REGISTRY ────────────────────────────────────────────────────────────
const REGIONS: Record<RegionKey, { label: string; render: (s: RegionState, idx: number) => ReactNode }> = {
  hero: {
    label: "Hero",
    render: (s, i) => {
      const fns: Array<(p?: { s: RegionState }) => ReactNode> = [HeroV1, HeroV2, HeroV3, HeroV4 as never, HeroV5];
      return i === 4 ? HeroV4({ s }) : fns[i - 1]();
    },
  },
  name: {
    label: "Name",
    render: (s, i) => [NameV1, NameV2, NameV3, NameV4, NameV5][i - 1]({ s }),
  },
  direction: {
    label: "Direction",
    render: (s, i) => [DirectionV1, DirectionV2, DirectionV3, DirectionV4, DirectionV5][i - 1]({ s }),
  },
  ds: {
    label: "Design systems",
    render: (s, i) => [DsV1, DsV2, DsV3, DsV4, DsV5][i - 1]({ s }),
  },
  model: {
    label: "Model",
    render: (s, i) => [ModelV1, ModelV2, ModelV3, ModelV4, ModelV5][i - 1]({ s }),
  },
  button: {
    label: "Button",
    render: (s, i) => [ButtonV1, ButtonV2, ButtonV3, ButtonV4, ButtonV5][i - 1]({ s }),
  },
};

const REGION_ORDER: RegionKey[] = ["hero", "name", "direction", "ds", "model", "button"];

// ─── SCREEN ──────────────────────────────────────────────────────────────
export function NewProjectRegionsLabScreen() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [direction, setDirection] = useState<DirectionSelection | null>(null);
  const [designSystems, setDesignSystems] = useState<FsDesignSystem[]>([]);
  const [dsSwatches, setDsSwatches] = useState<Record<string, string[]>>({});
  const [selectedDsPath, setSelectedDsPath] = useState<string | null>(null);
  // Provider mirrors the topbar AgentPicker. Listens to df:provider-change.
  const [provider, setProvider] = useState<ProviderId>("claude");
  const [model, setModel] = useState<string>(() => readLastModel("claude") ?? defaultModelForProvider("claude"));
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  // Defaults reflect user pick on 2026-05-03: hero=production (V1),
  // name=no-prefix, direction=plaque, DS=keys+more, model=rocker, button=slab.
  const [picks, setPicks] = useState<Picks>({
    hero: 1, name: 1, direction: 3, ds: 1, model: 1, button: 2,
  });
  const [prompt, setPrompt] = useState("");
  const [dsModalOpen, setDsModalOpen] = useState(false);
  const [dsModalQuery, setDsModalQuery] = useState("");
  const [dirModalOpen, setDirModalOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  // Load DS list from filesystem (real data) on mount.
  useEffect(() => {
    void listDesignSystemsFromFilesystem().then((list) => {
      if (list) setDesignSystems(list);
    });
  }, []);

  // Lazy-parse design.md for swatches (cached). Same pattern as HomeScreen.
  useEffect(() => {
    designSystems.forEach(async (ds) => {
      if (dsSwatches[ds.path]) return;
      try {
        const content = await readFileViaBridge(ds.designMdPath);
        if (!content) return;
        const text = typeof content === "string" ? content : (content as { content?: string })?.content ?? "";
        const parsed = parseDesignSystem(text);
        const hexes = parsed.colors.slice(0, 4).map((c) => c.hex).filter(Boolean);
        if (hexes.length > 0) {
          setDsSwatches((prev) => ({ ...prev, [ds.path]: hexes }));
        }
      } catch { /* swallow — UI degrades to placeholder */ }
    });
  }, [designSystems]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hydrate provider from saved default_provider + listen for topbar changes.
  useEffect(() => {
    void db.getSetting("default_provider").then((raw) => {
      const parsed = ProviderIdSchema.safeParse(raw);
      if (parsed.success) {
        setProvider(parsed.data);
        const remembered = readLastModel(parsed.data);
        setModel(remembered ?? defaultModelForProvider(parsed.data));
      }
    });
    const onProviderChange = (e: Event) => {
      const detail = (e as CustomEvent<{ providerId?: string }>).detail;
      const parsed = ProviderIdSchema.safeParse(detail?.providerId);
      if (parsed.success) {
        setProvider(parsed.data);
        const remembered = readLastModel(parsed.data);
        setModel(remembered ?? defaultModelForProvider(parsed.data));
      }
    };
    window.addEventListener("df:provider-change", onProviderChange);
    return () => window.removeEventListener("df:provider-change", onProviderChange);
  }, []);

  // Click-outside to close model menu.
  useEffect(() => {
    if (!modelMenuOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (modelMenuRef.current?.contains(target)) return;
      // Don't close if clicking the trigger (it'll toggle itself)
      const trigger = (target as Element)?.closest?.('[data-model-trigger="true"]');
      if (trigger) return;
      setModelMenuOpen(false);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [modelMenuOpen]);

  const directionLabel = formatDirectionLabel(direction);

  const state: RegionState = {
    name, setName,
    direction, directionLabel, setDirection,
    designSystems, dsSwatches,
    selectedDsPath, pickDs: setSelectedDsPath,
    provider, model, setModel,
    modelMenuOpen, setModelMenuOpen,
    openDsModal: () => setDsModalOpen(true),
    openDirectionModal: () => setDirModalOpen(true),
  };

  const dsModalFiltered = dsModalQuery.trim()
    ? designSystems.filter((d) => d.name.toLowerCase().includes(dsModalQuery.toLowerCase()))
    : designSystems;

  const setPick = (region: RegionKey, idx: number) => {
    setPicks((p) => ({ ...p, [region]: idx }));
  };

  const reset = () => {
    setName(""); setDirection(null); setSelectedDsPath(null); setPrompt("");
    setPicks({ hero: 1, name: 1, direction: 3, ds: 1, model: 1, button: 2 });
  };

  return (
    <div className="reg-lab">
      <header className="reg-lab-bar">
        <button className="reg-lab-back" onClick={() => navigate("/")}>← Home</button>
        <div className="reg-lab-titles">
          <div className="reg-lab-kicker">design factory · regions A/B</div>
          <div className="reg-lab-title">New Project · Regions Lab</div>
        </div>
        <button className="reg-lab-reset" onClick={reset}>reset</button>
      </header>

      <div className="reg-lab-body">
        {/* LEFT — picker per region */}
        <aside className="reg-picker">
          {REGION_ORDER.map((region) => (
            <div key={region} className="reg-picker-section">
              <div className="reg-picker-head">
                <span className="reg-picker-label">{REGIONS[region].label}</span>
                <span className="reg-picker-count">0{picks[region]}/05</span>
              </div>
              <div className="reg-picker-thumbs">
                {[1, 2, 3, 4, 5].map((idx) => (
                  <button
                    key={idx}
                    className={`reg-picker-thumb${picks[region] === idx ? " is-on" : ""}`}
                    onClick={() => setPick(region, idx)}
                  >
                    <span className="reg-picker-thumb-num">0{idx}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </aside>

        {/* RIGHT — live assembled preview */}
        <main className="reg-preview">
          <div className="reg-preview-frame">
            <div className="reg-preview-card">
              {/* Regions above the prompt — model moved INTO the prompt
                  bar (a dedicated line wasn't needed); the button is
                  rendered after the prompt. */}
              {(["hero", "name", "direction", "ds"] as RegionKey[]).map((region) => (
                <div key={region} className="reg-preview-slot" data-region={region}>
                  {REGIONS[region].render(state, picks[region])}
                </div>
              ))}

              {/* Initial prompt — production-aligned (mirrors home-np-prompt).
                  Reuses the existing prompt box: canonical chip + textarea
                  + 3-icon bar (file/image/mic) lifted from HomeScreen. */}
              <div className="reg-prod-prompt-block">
                <div className="reg-prod-prompt-label-row">
                  <span className="reg-prod-prompt-label">Initial prompt</span>
                  <span className="reg-prod-prompt-optional">optional</span>
                </div>
                <div className="reg-prod-prompt">
                  <textarea
                    className="reg-prod-prompt-field"
                    rows={3}
                    placeholder="Describe what to create… attach files, drop images, or dictate."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                  />
                  <div className="reg-prod-prompt-bar">
                    <div className="reg-prod-prompt-bar-left">
                      <button className="reg-prod-prompt-ico" title="Attach file" onClick={() => fileRef.current?.click()}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m21 12-9 9a6 6 0 0 1-8.5-8.5l9-9a4 4 0 0 1 5.7 5.7l-9 9a2 2 0 0 1-2.8-2.8l8.5-8.5" />
                        </svg>
                      </button>
                      <button className="reg-prod-prompt-ico" title="Attach image">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect width="18" height="18" x="3" y="3" rx="2" />
                          <circle cx="9" cy="9" r="2" />
                          <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
                        </svg>
                      </button>
                      <button className="reg-prod-prompt-ico" title="Dictate">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                          <line x1="12" x2="12" y1="19" y2="22" />
                        </svg>
                      </button>
                      <input ref={fileRef} type="file" multiple style={{ display: "none" }} />
                    </div>
                    {/* Model picker lives in the prompt bar (no dedicated row).
                        UX rule: keep the bar tight; model = inline. */}
                    <div className="reg-prod-prompt-bar-right">
                      {REGIONS.model.render(state, picks.model)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Button last, after the prompt. */}
              <div className="reg-preview-slot" data-region="button">
                {REGIONS.button.render(state, picks.button)}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* REAL DirectionModal — opened from any direction variant. */}
      <DirectionModal
        open={dirModalOpen}
        initial={direction}
        onClose={() => setDirModalOpen(false)}
        onApply={(next) => { setDirection(next); setDirModalOpen(false); }}
      />

      {/* DS library modal — uses REAL FsDesignSystem entries. */}
      <DfModal
        open={dsModalOpen}
        onClose={() => { setDsModalOpen(false); setDsModalQuery(""); }}
        size="lg"
        title="Choose design system"
      >
        <div className="reg-ds-modal">
          <input
            className="reg-ds-modal-search"
            autoFocus
            value={dsModalQuery}
            onChange={(e) => setDsModalQuery(e.target.value)}
            placeholder={`search ${designSystems.length} systems…`}
          />
          <div className="reg-ds-modal-grid">
            {dsModalFiltered.map((ds) => {
              const swatches = (dsSwatches[ds.path] ?? []).slice(0, 4);
              const padded = [...swatches, ...Array(Math.max(0, 4 - swatches.length)).fill("var(--df-surface-raised)")];
              return (
                <button
                  key={ds.path}
                  className={`reg-ds-modal-card${selectedDsPath === ds.path ? " is-on" : ""}`}
                  onClick={() => { setSelectedDsPath(ds.path); setDsModalOpen(false); setDsModalQuery(""); }}
                >
                  <div className="reg-ds-modal-swatchbar">
                    {padded.map((sw, i) => <span key={i} style={{ background: sw, flex: 1 }} />)}
                  </div>
                  <div className="reg-ds-modal-name">{ds.name}</div>
                  {selectedDsPath === ds.path && <div className="reg-ds-modal-check">✓ selected</div>}
                </button>
              );
            })}
            {dsModalFiltered.length === 0 && designSystems.length > 0 && (
              <div className="reg-ds-modal-empty">No systems match &quot;{dsModalQuery}&quot;</div>
            )}
            {designSystems.length === 0 && (
              <div className="reg-ds-modal-empty">
                No design systems on disk. Create one from the Home → Design Systems tab.
              </div>
            )}
          </div>
        </div>
      </DfModal>

      {/* Screen-level model menu — fixed position, escapes any ancestor
          overflow / stacking. Anchored visually to the prompt bar's right
          side; we just pin it to bottom-right of the viewport for now. */}
      {modelMenuOpen && (
        <div
          ref={modelMenuRef}
          className="reg-model-menu"
          role="listbox"
        >
          <ScreenModelMenu
            provider={provider}
            value={model}
            onPick={(id) => { setModel(id); writeLastModel(provider, id); setModelMenuOpen(false); }}
          />
        </div>
      )}
    </div>
  );
}

// Screen-level model menu list (separate component so useLiveModelOptions
// only triggers when the menu is mounted).
function ScreenModelMenu({ provider, value, onPick }: { provider: ProviderId; value: string; onPick: (id: string) => void }) {
  const { options: live, loading } = useLiveModelOptions(provider);
  const fallback = getModelsForProvider(provider);
  const opts = live.length > 0 ? live : fallback;
  const [q, setQ] = useState("");
  const filtered = q.trim() ? opts.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()) || o.id.toLowerCase().includes(q.toLowerCase())) : opts;
  const showSearch = opts.length > 8;
  return (
    <>
      {showSearch && (
        <div style={{ position: "sticky", top: 0, padding: 4, background: "var(--df-surface-elevated)", borderBottom: "1px solid var(--df-border-subtle)" }}>
          <input
            type="text"
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`search ${opts.length} models…`}
            style={{
              width: "100%",
              padding: "6px 8px",
              background: "var(--df-bg-section)",
              border: "1px solid var(--df-border-subtle)",
              borderRadius: "var(--df-r-sm)",
              fontFamily: "var(--df-font-mono)",
              fontSize: 11,
              color: "var(--df-text-primary)",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
      )}
      {opts.length === 0 && loading && (
        <div style={{ padding: "10px 12px", fontSize: 11, color: "var(--df-text-faint)" }}>loading models…</div>
      )}
      {filtered.map((m) => (
        <button
          key={m.id}
          role="option"
          aria-selected={m.id === value}
          onClick={() => onPick(m.id)}
          className={`reg-model-menu-opt${m.id === value ? " is-on" : ""}`}
        >
          <span style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-start", flex: 1 }}>
            <span>{m.label}</span>
            {m.sub && <span style={{ fontSize: 10, color: "var(--df-text-faint)" }}>{m.sub}</span>}
          </span>
          {m.id === value && <span style={{ color: "var(--df-accent-ok)", marginLeft: 8 }}>✓</span>}
        </button>
      ))}
    </>
  );
}

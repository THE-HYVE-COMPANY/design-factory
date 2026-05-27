// NewProjectLabScreen.tsx — Dev-only A/B harness for the "New Project" block.
//
// Renders 5 visually distinct variations of the SAME create form, side by side,
// so the user can pick a direction before lifting one into HomeScreen.
//
// All 5 variants share ONE state object (useNpState below). Typing the name in
// variant 3 updates the field that variant 1 reads. The provider menu opens
// per-variant (each has its own `showProviderMenu` because the menu is
// position-anchored to its trigger), but everything else is shared.
//
// Style scoping: each variant's root has `data-variant="N"` and all its CSS
// lives under `[data-np-variant="N"]` selectors in new-project-lab.css. Zero
// reach into the real `home-np-*` namespace.
//
// Resumed from 2026-04 pause (multi-model took priority). Path
// registered at /new-project-lab in App.tsx — no nav link, only direct URL.

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { DirectionTrigger } from "@/components/DirectionTrigger";
import type { DirectionSelection } from "@/data/direction-data";
import "@/styles/new-project-lab.css";

// ─────────────────────────────────────────────────────────────────────────
// Shared state hook
// ─────────────────────────────────────────────────────────────────────────

type ProviderId = "claude";

interface FakeDs {
  name: string;
  swatches: string[];
  source: string;
}

const FAKE_DS: FakeDs[] = [
  { name: "Hyve LAB", swatches: ["#1a1a17", "#8ab06b", "#d88a6b", "#f0eee5"], source: "folder" },
  { name: "Editorial Press", swatches: ["#f6f3ec", "#1a1a17", "#a23226", "#3a5a40"], source: "github" },
  { name: "Brutal Mono", swatches: ["#000000", "#ffffff", "#ff4d00", "#888888"], source: "folder" },
];

interface NpState {
  name: string;
  setName: (v: string) => void;
  prompt: string;
  setPrompt: (v: string) => void;
  direction: DirectionSelection | null;
  setDirection: (v: DirectionSelection | null) => void;
  showDirectionModal: boolean;
  setShowDirectionModal: (v: boolean) => void;
  selectedDsIdx: number | null;
  pickDs: (idx: number) => void;
  provider: ProviderId;
  setProvider: (p: ProviderId) => void;
  attachments: { name: string; kind: "file" | "image" | "audio" }[];
  addAttachment: (a: { name: string; kind: "file" | "image" | "audio" }) => void;
  removeAttachment: (i: number) => void;
}

function useNpState(): NpState {
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [direction, setDirection] = useState<DirectionSelection | null>(null);
  const [showDirectionModal, setShowDirectionModal] = useState(false);
  const [selectedDsIdx, setSelectedDsIdx] = useState<number | null>(null);
  const [provider, setProvider] = useState<ProviderId>("claude");
  const [attachments, setAttachments] = useState<NpState["attachments"]>([]);

  const pickDs = useCallback((idx: number) => {
    setSelectedDsIdx((curr) => (curr === idx ? null : idx));
  }, []);
  const addAttachment = useCallback((a: { name: string; kind: "file" | "image" | "audio" }) => {
    setAttachments((prev) => [...prev, a]);
  }, []);
  const removeAttachment = useCallback((i: number) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== i));
  }, []);

  return {
    name, setName,
    prompt, setPrompt,
    direction, setDirection,
    showDirectionModal, setShowDirectionModal,
    selectedDsIdx, pickDs,
    provider, setProvider,
    attachments, addAttachment, removeAttachment,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Variant 1 — Editorial Print
// ─────────────────────────────────────────────────────────────────────────
// Magazine cover. Serif display title centered with a thin rule above and
// below. Numbered fields like a print form (01, 02, 03…). Faux paper grain.
// Direction trigger reads as a byline; CTA reads as a credit line.

function Variant1Editorial({ s }: { s: NpState }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  return (
    <div data-np-variant="1" className="np-card np-v1">
      <header className="np-v1-masthead">
        <div className="np-v1-rule" />
        <div className="np-v1-meta">
          <span className="np-v1-folio">No. 001</span>
          <span className="np-v1-issue">Vol. {new Date().getFullYear()} · DesignFactory Quarterly</span>
        </div>
        <h1 className="np-v1-title">A New Project</h1>
        <p className="np-v1-deck">Five fields, one intent. Set the cover, then go to press.</p>
        <div className="np-v1-rule" />
      </header>

      <section className="np-v1-field">
        <span className="np-v1-num">01</span>
        <div className="np-v1-body">
          <label className="np-v1-label">Title</label>
          <input
            className="np-v1-input"
            placeholder="The Quiet Renaissance"
            value={s.name}
            onChange={(e) => s.setName(e.target.value)}
          />
        </div>
      </section>

      <section className="np-v1-field">
        <span className="np-v1-num">02</span>
        <div className="np-v1-body">
          <label className="np-v1-label">Direction &amp; Format</label>
          <div className="np-v1-direction-wrap">
            <DirectionTrigger
              selection={s.direction}
              onOpen={() => s.setShowDirectionModal(!s.showDirectionModal)}
            />
          </div>
        </div>
      </section>

      <section className="np-v1-field">
        <span className="np-v1-num">03</span>
        <div className="np-v1-body">
          <label className="np-v1-label">Design System</label>
          <ul className="np-v1-ds">
            {FAKE_DS.map((ds, idx) => (
              <li
                key={ds.name}
                className={`np-v1-ds-item${s.selectedDsIdx === idx ? " is-on" : ""}`}
                onClick={() => s.pickDs(idx)}
              >
                <span className="np-v1-ds-name">{ds.name}</span>
                <span className="np-v1-ds-dot-row">
                  {ds.swatches.map((sw, i) => (
                    <span key={i} className="np-v1-ds-dot" style={{ background: sw }} />
                  ))}
                </span>
                <span className="np-v1-ds-meta">{ds.source}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="np-v1-field">
        <span className="np-v1-num">04</span>
        <div className="np-v1-body">
          <label className="np-v1-label">Engine</label>
          <div className="np-v1-engine">
            <span className="np-v1-engine-dot" />
            <span className="np-v1-engine-name">{s.provider}</span>
            <span className="np-v1-engine-note">— online, listening</span>
          </div>
        </div>
      </section>

      <section className="np-v1-field">
        <span className="np-v1-num">05</span>
        <div className="np-v1-body">
          <label className="np-v1-label">Brief</label>
          <textarea
            className="np-v1-textarea"
            placeholder="Tell the printer what to set in type. The longer your brief, the sharper the run."
            value={s.prompt}
            onChange={(e) => s.setPrompt(e.target.value)}
            rows={4}
          />
          {s.attachments.length > 0 && (
            <div className="np-v1-attaches">
              {s.attachments.map((a, i) => (
                <span key={i} className="np-v1-attach">
                  {a.kind === "image" ? "Plate" : a.kind === "audio" ? "Reel" : "Galley"} — {a.name}
                  <button onClick={() => s.removeAttachment(i)}>×</button>
                </span>
              ))}
            </div>
          )}
          <div className="np-v1-toolbar">
            <button className="np-v1-tool" onClick={() => fileRef.current?.click()}>Attach galley</button>
            <button className="np-v1-tool" onClick={() => imgRef.current?.click()}>Attach plate</button>
            <button className="np-v1-tool">Dictate</button>
            <input ref={fileRef} type="file" multiple style={{ display: "none" }} onChange={(e) => {
              if (e.target.files) for (let i = 0; i < e.target.files.length; i += 1) s.addAttachment({ name: e.target.files[i].name, kind: "file" });
              e.target.value = "";
            }} />
            <input ref={imgRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => {
              if (e.target.files) for (let i = 0; i < e.target.files.length; i += 1) s.addAttachment({ name: e.target.files[i].name, kind: "image" });
              e.target.value = "";
            }} />
          </div>
        </div>
      </section>

      <footer className="np-v1-colophon">
        <div className="np-v1-rule" />
        <button className="np-v1-cta" disabled={!s.name.trim()}>
          Send to press
        </button>
        <div className="np-v1-credit">Set in Geist · Printed by Claude · DesignFactory</div>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Variant 2 — Brutalist Minimal
// ─────────────────────────────────────────────────────────────────────────
// Black and white. Monospace everywhere. 1-2px hard borders. Oversized
// uppercase labels stacked on inputs. Field separators are full-width rules.
// Provider/DS pickers are radio rows. Form reads like an old DOS dialog.

function Variant2Brutalist({ s }: { s: NpState }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  return (
    <div data-np-variant="2" className="np-card np-v2">
      <div className="np-v2-bar">
        <span>NEW_PROJECT.FORM</span>
        <span className="np-v2-bar-meta">[ESC] CANCEL · [↵] SUBMIT</span>
      </div>

      <div className="np-v2-row">
        <span className="np-v2-key">NAME</span>
        <input
          className="np-v2-input"
          placeholder="UNTITLED-001"
          value={s.name}
          onChange={(e) => s.setName(e.target.value.toUpperCase())}
        />
      </div>

      <div className="np-v2-row">
        <span className="np-v2-key">DIRECTION</span>
        <button className="np-v2-pick" onClick={() => s.setShowDirectionModal(!s.showDirectionModal)}>
          {s.direction ? "[X] CONFIGURED" : "[ ] PICK FORMAT + DIRECTION"}
        </button>
      </div>

      <div className="np-v2-row np-v2-row--col">
        <span className="np-v2-key">DESIGN_SYSTEM</span>
        <div className="np-v2-radios">
          {FAKE_DS.map((ds, idx) => (
            <button
              key={ds.name}
              className="np-v2-radio"
              onClick={() => s.pickDs(idx)}
            >
              <span className="np-v2-radio-mark">{s.selectedDsIdx === idx ? "[X]" : "[ ]"}</span>
              <span className="np-v2-radio-name">{ds.name.toUpperCase()}</span>
              <span className="np-v2-radio-meta">{ds.source.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="np-v2-row">
        <span className="np-v2-key">MODEL</span>
        <div className="np-v2-model">
          <span className="np-v2-model-dot">●</span>
          <span>{s.provider.toUpperCase()}</span>
          <span className="np-v2-model-meta">// ONLINE</span>
        </div>
      </div>

      <div className="np-v2-row np-v2-row--col">
        <span className="np-v2-key">PROMPT</span>
        <textarea
          className="np-v2-textarea"
          placeholder="> describe the build. plain text. no fluff."
          value={s.prompt}
          onChange={(e) => s.setPrompt(e.target.value)}
          rows={5}
        />
        {s.attachments.length > 0 && (
          <div className="np-v2-attach-list">
            {s.attachments.map((a, i) => (
              <span key={i} className="np-v2-attach">
                {a.kind === "image" ? "IMG" : a.kind === "audio" ? "AUD" : "FILE"} :: {a.name}
                <button onClick={() => s.removeAttachment(i)}>[X]</button>
              </span>
            ))}
          </div>
        )}
        <div className="np-v2-toolbar">
          <button className="np-v2-tool" onClick={() => fileRef.current?.click()}>+FILE</button>
          <button className="np-v2-tool" onClick={() => imgRef.current?.click()}>+IMG</button>
          <button className="np-v2-tool">+MIC</button>
          <input ref={fileRef} type="file" multiple style={{ display: "none" }} onChange={(e) => {
            if (e.target.files) for (let i = 0; i < e.target.files.length; i += 1) s.addAttachment({ name: e.target.files[i].name, kind: "file" });
            e.target.value = "";
          }} />
          <input ref={imgRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => {
            if (e.target.files) for (let i = 0; i < e.target.files.length; i += 1) s.addAttachment({ name: e.target.files[i].name, kind: "image" });
            e.target.value = "";
          }} />
        </div>
      </div>

      <button className="np-v2-cta" disabled={!s.name.trim()}>
        ▶ EXECUTE_CREATE_PROJECT
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Variant 3 — Skeu Refined (HYVE preferred — go deeper)
// ─────────────────────────────────────────────────────────────────────────
// Hardware control panel. Each field sits in a recessed bowl with its label
// engraved above. Provider becomes a tactile rocker switch. CTA is a real
// pressable key with full skeu shadow stack. ASCII grain sits beneath
// floating chips of state.

function Variant3SkeuRefined({ s }: { s: NpState }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const [providerOpen, setProviderOpen] = useState(false);
  return (
    <div data-np-variant="3" className="np-card np-v3">
      <div className="np-v3-plate">
        <div className="np-v3-plate-grain" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="np-v3-plate-grain-row">
              {Array.from({ length: 28 }).map((__, j) => <span key={j}>·</span>)}
            </div>
          ))}
        </div>
        <Logo size={22} className="np-v3-plate-mark" />
        <div className="np-v3-plate-id">DF–01 · NEW PROJECT</div>
        <div className="np-v3-plate-status">
          <span className="np-v3-led" />
          ready
        </div>
      </div>

      <div className="np-v3-bowl">
        <span className="np-v3-engrave">Project name</span>
        <div className="np-v3-input-wrap">
          <span className="np-v3-prefix">DF /</span>
          <input
            className="np-v3-input"
            placeholder="my-next-thing"
            value={s.name}
            onChange={(e) => s.setName(e.target.value)}
          />
        </div>
      </div>

      <div className="np-v3-bowl">
        <span className="np-v3-engrave">Direction</span>
        <DirectionTrigger
          selection={s.direction}
          onOpen={() => s.setShowDirectionModal(!s.showDirectionModal)}
        />
      </div>

      <div className="np-v3-bowl">
        <span className="np-v3-engrave">Design system</span>
        <div className="np-v3-ds">
          {FAKE_DS.map((ds, idx) => (
            <button
              key={ds.name}
              className={`np-v3-ds-key${s.selectedDsIdx === idx ? " is-on" : ""}`}
              onClick={() => s.pickDs(idx)}
            >
              <span className="np-v3-ds-swatches">
                {ds.swatches.map((sw, i) => (
                  <span key={i} className="np-v3-ds-sw" style={{ background: sw }} />
                ))}
              </span>
              <span className="np-v3-ds-name">{ds.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="np-v3-rocker-row">
        <span className="np-v3-engrave">Engine</span>
        <button
          className="np-v3-rocker"
          onClick={() => setProviderOpen((v) => !v)}
          aria-expanded={providerOpen}
        >
          <span className="np-v3-rocker-led" />
          <span className="np-v3-rocker-name">{s.provider}</span>
          <span className="np-v3-rocker-caret">▾</span>
        </button>
        {providerOpen && (
          <div className="np-v3-rocker-menu" role="listbox">
            <button onClick={() => { s.setProvider("claude"); setProviderOpen(false); }}>claude</button>
          </div>
        )}
      </div>

      <div className="np-v3-bowl np-v3-bowl--prompt">
        <span className="np-v3-engrave">Initial prompt</span>
        <textarea
          className="np-v3-textarea"
          placeholder="Describe what to build. The keys will route it."
          value={s.prompt}
          onChange={(e) => s.setPrompt(e.target.value)}
          rows={3}
        />
        {s.attachments.length > 0 && (
          <div className="np-v3-chips">
            {s.attachments.map((a, i) => (
              <span key={i} className="np-v3-chip">
                <span className="np-v3-chip-ico">{a.kind === "image" ? "▢" : a.kind === "audio" ? "◉" : "▭"}</span>
                {a.name}
                <button onClick={() => s.removeAttachment(i)}>×</button>
              </span>
            ))}
          </div>
        )}
        <div className="np-v3-key-row">
          <button className="np-v3-mini-key" onClick={() => fileRef.current?.click()}>file</button>
          <button className="np-v3-mini-key" onClick={() => imgRef.current?.click()}>image</button>
          <button className="np-v3-mini-key">mic</button>
          <input ref={fileRef} type="file" multiple style={{ display: "none" }} onChange={(e) => {
            if (e.target.files) for (let i = 0; i < e.target.files.length; i += 1) s.addAttachment({ name: e.target.files[i].name, kind: "file" });
            e.target.value = "";
          }} />
          <input ref={imgRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => {
            if (e.target.files) for (let i = 0; i < e.target.files.length; i += 1) s.addAttachment({ name: e.target.files[i].name, kind: "image" });
            e.target.value = "";
          }} />
        </div>
      </div>

      <button className="np-v3-cta" disabled={!s.name.trim()}>
        <span className="np-v3-cta-label">Create project</span>
        <span className="np-v3-cta-key" aria-hidden="true">⏎</span>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Variant 4 — Spatial / 3D
// ─────────────────────────────────────────────────────────────────────────
// Tilted cards stacked in z-space. Each field is its own floating tile that
// rises on hover. Direction & DS are physical coins. The whole assembly
// sits on a soft drop-shadow that suggests a desktop scene viewed at angle.

function Variant4Spatial({ s }: { s: NpState }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  return (
    <div data-np-variant="4" className="np-card np-v4">
      <div className="np-v4-stage">
        <div className="np-v4-floor" aria-hidden="true" />

        <div className="np-v4-tile np-v4-tile--header">
          <Logo size={22} />
          <div>
            <div className="np-v4-kicker">desk · 1 of 1</div>
            <div className="np-v4-title">Lay out the new project</div>
          </div>
        </div>

        <div className="np-v4-tile np-v4-tile--name" data-tilt="left">
          <label className="np-v4-label">Project name</label>
          <input
            className="np-v4-input"
            placeholder="brand-deck-2026"
            value={s.name}
            onChange={(e) => s.setName(e.target.value)}
          />
        </div>

        <div className="np-v4-tile np-v4-tile--direction" data-tilt="right">
          <label className="np-v4-label">Direction</label>
          <DirectionTrigger
            selection={s.direction}
            onOpen={() => s.setShowDirectionModal(!s.showDirectionModal)}
          />
        </div>

        <div className="np-v4-tile np-v4-tile--ds">
          <label className="np-v4-label">Design system</label>
          <div className="np-v4-coins">
            {FAKE_DS.map((ds, idx) => (
              <button
                key={ds.name}
                className={`np-v4-coin${s.selectedDsIdx === idx ? " is-on" : ""}`}
                onClick={() => s.pickDs(idx)}
                title={ds.name}
              >
                <span className="np-v4-coin-disc" style={{
                  background: `conic-gradient(${ds.swatches[0]} 0deg 90deg, ${ds.swatches[1]} 90deg 180deg, ${ds.swatches[2]} 180deg 270deg, ${ds.swatches[3]} 270deg 360deg)`,
                }} />
                <span className="np-v4-coin-label">{ds.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="np-v4-tile np-v4-tile--engine" data-tilt="left">
          <label className="np-v4-label">Engine</label>
          <div className="np-v4-engine">
            <span className="np-v4-engine-orb" />
            <span>{s.provider}</span>
          </div>
        </div>

        <div className="np-v4-tile np-v4-tile--prompt">
          <label className="np-v4-label">Brief</label>
          <textarea
            className="np-v4-textarea"
            placeholder="Talk about it. Drag in references. The desk listens."
            value={s.prompt}
            onChange={(e) => s.setPrompt(e.target.value)}
            rows={3}
          />
          {s.attachments.length > 0 && (
            <div className="np-v4-attaches">
              {s.attachments.map((a, i) => (
                <span key={i} className="np-v4-attach">
                  {a.name}
                  <button onClick={() => s.removeAttachment(i)}>×</button>
                </span>
              ))}
            </div>
          )}
          <div className="np-v4-tools">
            <button className="np-v4-tool" onClick={() => fileRef.current?.click()}>＋ file</button>
            <button className="np-v4-tool" onClick={() => imgRef.current?.click()}>＋ image</button>
            <button className="np-v4-tool">＋ mic</button>
            <input ref={fileRef} type="file" multiple style={{ display: "none" }} onChange={(e) => {
              if (e.target.files) for (let i = 0; i < e.target.files.length; i += 1) s.addAttachment({ name: e.target.files[i].name, kind: "file" });
              e.target.value = "";
            }} />
            <input ref={imgRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => {
              if (e.target.files) for (let i = 0; i < e.target.files.length; i += 1) s.addAttachment({ name: e.target.files[i].name, kind: "image" });
              e.target.value = "";
            }} />
          </div>
        </div>

        <button className="np-v4-cta np-v4-tile" disabled={!s.name.trim()}>
          Push to canvas →
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Variant 5 — Density-First Dashboard
// ─────────────────────────────────────────────────────────────────────────
// All fields visible in a tight 2-column grid. Field labels left-aligned in
// a fixed gutter. Status strip at top with telemetry. Power-user vibe — no
// hand-holding, no decorative whitespace. 13px everything.

function Variant5Density({ s }: { s: NpState }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const completeness = useMemo(() => {
    let n = 0;
    if (s.name.trim()) n += 1;
    if (s.direction) n += 1;
    if (s.selectedDsIdx !== null) n += 1;
    if (s.prompt.trim()) n += 1;
    n += 1; // model is always set
    return n;
  }, [s.name, s.direction, s.selectedDsIdx, s.prompt]);
  return (
    <div data-np-variant="5" className="np-card np-v5">
      <header className="np-v5-strip">
        <span className="np-v5-strip-cell"><b>NEW</b> /projects/new</span>
        <span className="np-v5-strip-cell">model:<b>{s.provider}</b></span>
        <span className="np-v5-strip-cell">ds:<b>{s.selectedDsIdx !== null ? FAKE_DS[s.selectedDsIdx].name : "—"}</b></span>
        <span className="np-v5-strip-cell">dir:<b>{s.direction ? "set" : "—"}</b></span>
        <span className="np-v5-strip-cell">attach:<b>{s.attachments.length}</b></span>
        <span className="np-v5-strip-cell">{completeness}/5</span>
      </header>

      <div className="np-v5-grid">
        <div className="np-v5-row">
          <label className="np-v5-l">name</label>
          <input
            className="np-v5-i"
            placeholder="slug-here"
            value={s.name}
            onChange={(e) => s.setName(e.target.value)}
          />
        </div>

        <div className="np-v5-row">
          <label className="np-v5-l">direction</label>
          <button className="np-v5-i np-v5-trigger" onClick={() => s.setShowDirectionModal(!s.showDirectionModal)}>
            {s.direction ? "configured · click to edit" : "click to configure (optional)"}
          </button>
        </div>

        <div className="np-v5-row">
          <label className="np-v5-l">ds</label>
          <div className="np-v5-ds-row">
            {FAKE_DS.map((ds, idx) => (
              <button
                key={ds.name}
                className={`np-v5-ds${s.selectedDsIdx === idx ? " is-on" : ""}`}
                onClick={() => s.pickDs(idx)}
              >
                <span className="np-v5-ds-strip">
                  {ds.swatches.map((sw, i) => (
                    <span key={i} className="np-v5-ds-stripe" style={{ background: sw }} />
                  ))}
                </span>
                <span className="np-v5-ds-name">{ds.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="np-v5-row">
          <label className="np-v5-l">model</label>
          <div className="np-v5-model">
            <span className="np-v5-model-dot" /> {s.provider} <span className="np-v5-model-meta">· online · sonnet-4.7</span>
          </div>
        </div>

        <div className="np-v5-row np-v5-row--prompt">
          <label className="np-v5-l">prompt</label>
          <div className="np-v5-prompt">
            <textarea
              className="np-v5-textarea"
              placeholder="brief… (md ok, paths ok, references ok)"
              value={s.prompt}
              onChange={(e) => s.setPrompt(e.target.value)}
              rows={4}
            />
            <div className="np-v5-prompt-foot">
              <div className="np-v5-prompt-tools">
                <button className="np-v5-tool" onClick={() => fileRef.current?.click()} title="attach file">file</button>
                <button className="np-v5-tool" onClick={() => imgRef.current?.click()} title="attach image">image</button>
                <button className="np-v5-tool" title="dictate">mic</button>
              </div>
              <div className="np-v5-prompt-meta">{s.prompt.length} chars · {s.prompt.trim().split(/\s+/).filter(Boolean).length} words</div>
              <input ref={fileRef} type="file" multiple style={{ display: "none" }} onChange={(e) => {
                if (e.target.files) for (let i = 0; i < e.target.files.length; i += 1) s.addAttachment({ name: e.target.files[i].name, kind: "file" });
                e.target.value = "";
              }} />
              <input ref={imgRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => {
                if (e.target.files) for (let i = 0; i < e.target.files.length; i += 1) s.addAttachment({ name: e.target.files[i].name, kind: "image" });
                e.target.value = "";
              }} />
            </div>
            {s.attachments.length > 0 && (
              <div className="np-v5-attach-table">
                {s.attachments.map((a, i) => (
                  <div key={i} className="np-v5-attach-row">
                    <span className="np-v5-attach-kind">{a.kind}</span>
                    <span className="np-v5-attach-name">{a.name}</span>
                    <button onClick={() => s.removeAttachment(i)}>rm</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="np-v5-foot">
        <button className="np-v5-cta" disabled={!s.name.trim()}>
          create →
        </button>
        <span className="np-v5-foot-meta">⏎ to submit · ⌘K command palette</span>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Lab shell
// ─────────────────────────────────────────────────────────────────────────

const VARIANTS: Array<{ id: number; label: string; render: (s: NpState) => ReactNode }> = [
  { id: 1, label: "Editorial Print", render: (s) => <Variant1Editorial s={s} /> },
  { id: 2, label: "Brutalist Minimal", render: (s) => <Variant2Brutalist s={s} /> },
  { id: 3, label: "Skeu Refined", render: (s) => <Variant3SkeuRefined s={s} /> },
  { id: 4, label: "Spatial / 3D", render: (s) => <Variant4Spatial s={s} /> },
  { id: 5, label: "Density Dashboard", render: (s) => <Variant5Density s={s} /> },
];

export function NewProjectLabScreen() {
  const navigate = useNavigate();
  const state = useNpState();
  const [zoomedVariant, setZoomedVariant] = useState<number | null>(null);
  return (
    <div className="np-lab">
      <header className="np-lab-bar">
        <button className="np-lab-back" onClick={() => navigate("/")}>← Home</button>
        <div className="np-lab-titles">
          <div className="np-lab-kicker">design factory · A/B</div>
          <div className="np-lab-title">New Project · 5 variations</div>
        </div>
        <div className="np-lab-meta">
          <span>same state · different containers</span>
          <button
            className="np-lab-reset"
            onClick={() => {
              state.setName("");
              state.setPrompt("");
              state.setDirection(null);
              state.pickDs(state.selectedDsIdx ?? -1); // clears if was set
            }}
          >
            reset state
          </button>
        </div>
      </header>

      <nav className="np-lab-nav">
        <button
          className={`np-lab-tab${zoomedVariant === null ? " is-on" : ""}`}
          onClick={() => setZoomedVariant(null)}
        >
          all 5
        </button>
        {VARIANTS.map((v) => (
          <button
            key={v.id}
            className={`np-lab-tab${zoomedVariant === v.id ? " is-on" : ""}`}
            onClick={() => setZoomedVariant(v.id)}
          >
            <span className="np-lab-tab-num">0{v.id}</span> {v.label}
          </button>
        ))}
      </nav>

      <div className={`np-lab-grid${zoomedVariant !== null ? " is-zoomed" : ""}`}>
        {VARIANTS
          .filter((v) => zoomedVariant === null || v.id === zoomedVariant)
          .map((v) => (
            <section key={v.id} className="np-lab-cell">
              <header className="np-lab-cell-head">
                <span className="np-lab-cell-num">0{v.id}</span>
                <span className="np-lab-cell-label">{v.label}</span>
              </header>
              {v.render(state)}
            </section>
          ))}
      </div>
    </div>
  );
}

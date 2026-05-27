// NewProjectLabsHub — top-tab switcher for the 5 New Project experience labs.
//
// ed for 5 distinct interaction paradigms to evaluate side-by-side
// before promoting one to canonical. This hub wraps each lab so the user
// can toggle without leaving the page; the tab choice is mirrored to a
// `?lab=a|b|c|d|e` query param so links can be shared and bookmarks land on
// the same paradigm next session.
//
// Why a thin wrapper instead of a router-level swap:
//   · Each lab keeps its own root component, CSS, and behavior — they're
//     independent paradigms, not variants. The hub only renders one at a time.
//   · Tab persistence is URL-only — no localStorage. Reload preserves choice
//     because the URL is the source of truth.
//   · Direct routes (/np-b /np-c /np-d /np-e /np-prompt-first) still mount
//     each lab WITHOUT the hub wrapper for deep-link sharing of a single
//     paradigm.

import { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { NewProjectPromptFirstLab } from "@/screens/NewProjectPromptFirstLab";
import { NewProjectConvLab } from "@/screens/NewProjectConvLab";
import { NewProjectMoodLab } from "@/screens/NewProjectMoodLab";
import { NewProjectVerbLab } from "@/screens/NewProjectVerbLab";
import { NewProjectSpatialLab } from "@/screens/NewProjectSpatialLab";
import { NewProjectCanonicalPlusLab } from "@/screens/NewProjectCanonicalPlusLab";
import "@/styles/np-hub.css";

type LabSlot = "a" | "b" | "c" | "d" | "e" | "f";

interface LabSpec {
  slot: LabSlot;
  code: string;
  label: string;
  hint: string; // sub-line in the tab; explains the paradigm in 3 words
}

const LABS: LabSpec[] = [
  { slot: "a", code: "A", label: "Prompt-First", hint: "modificadores opcionais" },
  { slot: "b", code: "B", label: "Conversational", hint: "3 perguntas guiadas" },
  { slot: "c", code: "C", label: "Mood Board", hint: "selecione referências" },
  { slot: "d", code: "D", label: "Verb-Led", hint: "escolha o verbo" },
  { slot: "e", code: "E", label: "Spatial Spec", hint: "ajuste 6 dimensões" },
  { slot: "f", code: "F", label: "Canonical+", hint: "regions + dials skeu" },
];

function isLabSlot(value: string | null): value is LabSlot {
  return value === "a" || value === "b" || value === "c" || value === "d" || value === "e" || value === "f";
}

export function NewProjectLabsHub() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeSlot: LabSlot = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    const candidate = sp.get("lab");
    return isLabSlot(candidate) ? candidate : "a";
  }, [location.search]);

  // Normalize URL — when /?lab is missing, write `a` so bookmarks/shares
  // capture the default explicitly. This is a one-time replace per visit
  // when the param is absent.
  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    if (!sp.has("lab")) {
      sp.set("lab", "a");
      navigate({ pathname: "/", search: `?${sp.toString()}` }, { replace: true });
    }
  }, [location.search, navigate]);

  const handleTabClick = (slot: LabSlot) => {
    if (slot === activeSlot) return;
    const sp = new URLSearchParams(location.search);
    sp.set("lab", slot);
    navigate({ pathname: "/", search: `?${sp.toString()}` }, { replace: false });
  };

  // Keyboard support: 1-5 jumps tabs (when not focused on text input).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
      const idx = Number(e.key) - 1;
      if (idx >= 0 && idx < LABS.length) {
        e.preventDefault();
        handleTabClick(LABS[idx].slot);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSlot, location.search]);

  return (
    <div className="np-hub-root">
      <nav className="np-hub-tabs" aria-label="New Project lab paradigms">
        <div className="np-hub-tabs-inner">
          {LABS.map((lab) => {
            const active = lab.slot === activeSlot;
            return (
              <button
                key={lab.slot}
                type="button"
                className={`np-hub-tab${active ? " np-hub-tab--active" : ""}`}
                onClick={() => handleTabClick(lab.slot)}
                aria-pressed={active}
                title={`${lab.code} — ${lab.label} (atalho: ${LABS.indexOf(lab) + 1})`}
              >
                <span className="np-hub-tab-code">{lab.code}</span>
                <span className="np-hub-tab-label">{lab.label}</span>
                <span className="np-hub-tab-hint">{lab.hint}</span>
              </button>
            );
          })}
        </div>
      </nav>
      <div className="np-hub-stage" data-lab={activeSlot}>
        {activeSlot === "a" && <NewProjectPromptFirstLab />}
        {activeSlot === "b" && <NewProjectConvLab />}
        {activeSlot === "c" && <NewProjectMoodLab />}
        {activeSlot === "d" && <NewProjectVerbLab />}
        {activeSlot === "e" && <NewProjectSpatialLab />}
        {activeSlot === "f" && <NewProjectCanonicalPlusLab />}
      </div>
    </div>
  );
}

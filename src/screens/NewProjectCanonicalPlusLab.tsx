// NewProjectCanonicalPlusLab — preview that extends the canonical New
// Project surface (NewProjectRegionsLabScreen) with the additions the
// user approved on 2026-05-04 after rejecting the 5-paradigm direction:
//
//   1. Big prompt textarea (recessed bowl, ~6 lines).
//   2. Format picker (tactile key) → modal stub with 8 formats.
//   3. Anti-slop rules picker (embossed badge) → modal multi-select stub.
//   4. Refs drop-zone (recessed area, paste link / drop file / chip rail).
//   5. Taste dials row (5 bipolar rocker dials — TONE/DENSITY/MOTION/
//      VOICE/COLOR). The dial is the star: drag the knob along the recess,
//      knob color flips bronze at the midpoint to read as "balanced".
//   6. Begin button (V1 ribbon plate).
//
// Refactor 2026-05-04: the form body is now in <NewProjectFormSkeu />
// (src/components/NewProjectFormSkeu.tsx) so the same surface can also be
// rendered inside <NewProjectModal /> from HomeScreen. This file keeps the
// lab shell (header bar w/ back, title, theme, reset) and renders the
// shared form inside.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { NewProjectFormSkeu } from "@/components/NewProjectFormSkeu";
import "@/styles/np-regions-lab.css";
import "@/styles/np-canonical-plus.css";

// Theme toggle — same pattern used in the Spatial lab so light / dark are
// switchable without leaving the screen.
function ThemeToggleInline() {
  const [isLight, setIsLight] = useState<boolean>(() => {
    if (typeof document === "undefined") return false;
    return document.documentElement.getAttribute("data-theme") === "light";
  });
  useEffect(() => {
    const el = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsLight(el.getAttribute("data-theme") === "light");
    });
    observer.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return (
    <button
      type="button"
      className="cnp-lab-reset"
      onClick={() => {
        const next = isLight ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", next);
        setIsLight(next === "light");
      }}
      aria-label={`Switch to ${isLight ? "dark" : "light"} theme`}
    >
      {isLight ? "dark" : "light"}
    </button>
  );
}

export function NewProjectCanonicalPlusLab() {
  const navigate = useNavigate();
  // Force-remount the form on reset by bumping a key. Cheap, no need to
  // expose imperative reset on the form for this lab usage.
  const [resetKey, setResetKey] = useState(0);

  return (
    <div className="cnp-lab">
      <header className="cnp-lab-bar">
        <button className="cnp-lab-back" onClick={() => navigate("/")}>← Home</button>
        <div className="cnp-lab-titles">
          <div className="cnp-lab-kicker">design factory · canonical+</div>
          <div className="cnp-lab-title">New Project · Regions Lab + dials</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <ThemeToggleInline />
          <button className="cnp-lab-reset" onClick={() => setResetKey((k) => k + 1)}>reset</button>
        </div>
      </header>

      <div className="cnp-stage">
        <NewProjectFormSkeu key={resetKey} showHero />
      </div>
    </div>
  );
}

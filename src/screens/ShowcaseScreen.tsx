/**
 * ShowcaseScreen — visual catalog for the 10 cover style variants.
 *
 * Live at /showcase. Used to spot which variants are working visually
 * and to give a portfolio-feel reference page. Directions catalog
 * removed 2026-04-28 (concept deprecated).
 */

import { useNavigate } from "react-router-dom";
import { ProjectCover, DOT_GRID_STYLES, pickStyleForSlug, type DotGridStyle } from "@/components/ProjectCover";
import { ThemeToggle } from "@/components/ThemeToggle";

interface Props {
  theme?: "dark" | "light";
  onThemeChange?: (theme: "dark" | "light") => void;
}

// 4 sample slugs per cover variant — enough variety to see the
// composition vary, not so many that the page bloats.
const SAMPLE_SLUGS = ["loom-archive", "atlas-mono", "verdant-files", "cobalt-press"];

// 30 slugs simulating real projects in the wild. Each runs through the
// dot-grid modulator hash → unique composition. Watch shape variety at
// scale: forms, gradients, waves, silhouettes — all from the same dot grammar.
const THIRTY_SLUGS: string[] = [
  "loom-archive",     "atlas-mono",       "verdant-files",    "cobalt-press",
  "north-pavilion",   "moss-quarterly",   "amber-station",    "iron-sketch",
  "harbor-notes",     "linden-lab",       "kiln-studio",      "rye-collective",
  "saffron-press",    "umber-foundry",    "tide-library",     "clay-quarterly",
  "ledger-2026",      "almanac-fall",     "maker-lab",        "field-press",
  "chambers-press",   "porter-archive",   "mira-studio",      "verge-lab",
  "kepler-letters",   "salt-paper",       "windrose",         "sundial",
  "pinion-press",     "drift-paper",
];

export function ShowcaseScreen({ theme, onThemeChange }: Props) {
  const navigate = useNavigate();

  return (
    <div style={{
      height: "100%", width: "100%",
      display: "flex", flexDirection: "column",
      background: "var(--df-bg-base)",
      color: "var(--df-text-primary)",
      overflow: "hidden",
    }}>
      {/* HEADER */}
      <header style={{
        height: 48,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px",
        borderBottom: "1px solid var(--df-border-divider)",
        background: "var(--df-bg-section)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            className="df-btn df-btn--ghost df-btn--sm"
            onClick={() => navigate("/")}
            style={{ fontSize: "var(--df-text-xs)" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back
          </button>
          <div style={{
            fontFamily: "var(--df-font-mono)",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "var(--df-tracking-label)",
            textTransform: "uppercase",
            color: "var(--df-text-muted)",
          }}>
            Showcase · 20 generatives
          </div>
        </div>
        {theme && onThemeChange && <ThemeToggle theme={theme} onChange={onThemeChange} />}
      </header>

      {/* BODY */}
      <main style={{
        flex: 1,
        overflowY: "auto",
        padding: "44px clamp(24px, 5vw, 64px) 80px",
      }}>
        {/* HERO */}
        <section style={{ marginBottom: 56, maxWidth: 720 }}>
          <div style={{
            fontFamily: "var(--df-font-mono)",
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "var(--df-tracking-label)",
            color: "var(--df-text-muted)",
            marginBottom: 12,
          }}>
            Catalog
          </div>
          <h1 style={{
            margin: 0,
            fontFamily: "var(--df-font-display)",
            fontSize: "clamp(36px, 5vw, 56px)",
            fontWeight: "var(--df-fw-bold, 700)",
            letterSpacing: "var(--df-tracking-display)",
            lineHeight: 1.04,
            color: "var(--df-text-primary)",
          }}>
            One language, many shapes.<br />
            <span style={{ color: "var(--df-text-secondary)", fontWeight: "var(--df-fw-medium, 500)" }}>
              Dot grids and aesthetic directions.
            </span>
          </h1>
          <p style={{
            margin: "16px 0 0",
            fontSize: "var(--df-text-base)",
            color: "var(--df-text-secondary)",
            lineHeight: 1.55,
            maxWidth: 580,
          }}>
            Every cover is a dot grid — modulated by waves, gradients, silhouettes, spirals.
            Below: 30 hypothetical projects rendered side-by-side, then ten layout directions
            for first-pass generation.
          </p>
        </section>

        {/* SECTION 1 — COVERS */}
        <section style={{ marginBottom: 80 }}>
          <SectionHeader
            kicker="Section 01 · Project covers"
            title="Cover styles"
            sub="Each project gets one — picked deterministically from its slug. All monochrome warm-grey, dot-based, theme-aware."
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 28, marginTop: 28 }}>
            {DOT_GRID_STYLES.map((v, idx) => (
              <CoverRow key={v} variant={v} index={idx + 1} />
            ))}
          </div>
        </section>

        {/* SECTION 1.5 — 50 IN THE WILD */}
        <section style={{ marginBottom: 80 }}>
          <SectionHeader
            kicker="Section 01b · Stress test"
            title="Thirty in the wild"
            sub="Each slug is a hypothetical project. The dot-grid is the only language; the hash decides which modulator (waves, gradients, silhouettes, cross, spiral, hourglass…) and its parameters. Same vocabulary, completely different shapes."
          />
          <FiftyDistribution />
          <div style={{
            marginTop: 22,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))",
            gap: 14,
          }}>
            {THIRTY_SLUGS.map((slug) => {
              const variant = pickStyleForSlug(slug);
              return (
                <article
                  key={slug}
                  title={`${slug} · ${variant}`}
                  style={{
                    background: "var(--df-bg-section)",
                    borderRadius: "var(--df-r-lg)",
                    overflow: "hidden",
                    boxShadow:
                      "inset 0 1px 0 var(--df-skeu-top-light), inset 0 0 0 1px var(--df-border-subtle), 0 1px 2px var(--df-skeu-near)",
                  }}
                >
                  <div style={{
                    aspectRatio: "4 / 3",
                    background: "var(--df-surface-raised)",
                    boxShadow: "inset 0 -1px 0 var(--df-border-subtle)",
                  }}>
                    <ProjectCover slug={slug} />
                  </div>
                  <div style={{ padding: "8px 11px 10px" }}>
                    <div style={{
                      fontFamily: "var(--df-font-display)",
                      fontSize: 12.5,
                      fontWeight: "var(--df-fw-semibold, 600)",
                      letterSpacing: "var(--df-tracking-tight)",
                      color: "var(--df-text-primary)",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                    }}>
                      {slug.replace(/-/g, " ")}
                    </div>
                    <div style={{
                      fontFamily: "var(--df-font-mono)",
                      fontSize: 9,
                      color: "var(--df-text-faint)",
                      letterSpacing: "0.04em",
                      marginTop: 2,
                    }}>
                      {variant}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

      </main>
    </div>
  );
}

function FiftyDistribution() {
  const counts = DOT_GRID_STYLES.reduce((acc, v) => ({ ...acc, [v]: 0 }), {} as Record<DotGridStyle, number>);
  for (const slug of THIRTY_SLUGS) {
    counts[pickStyleForSlug(slug)]++;
  }
  const max = Math.max(...Object.values(counts));
  const expected = THIRTY_SLUGS.length / DOT_GRID_STYLES.length; // 5 per variant if perfectly uniform

  return (
    <div style={{
      marginTop: 24,
      padding: "14px 18px",
      background: "var(--df-bg-section)",
      borderRadius: "var(--df-r-lg)",
      boxShadow: "inset 0 1px 0 var(--df-skeu-top-light), inset 0 0 0 1px var(--df-border-subtle)",
    }}>
      <div style={{
        fontFamily: "var(--df-font-mono)",
        fontSize: 9,
        color: "var(--df-text-muted)",
        textTransform: "uppercase",
        letterSpacing: "var(--df-tracking-label)",
        marginBottom: 10,
        display: "flex", justifyContent: "space-between",
      }}>
        <span>Distribution · {THIRTY_SLUGS.length} slugs across {DOT_GRID_STYLES.length} variants</span>
        <span>expected ~{expected.toFixed(1)} each</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 6 }}>
        {DOT_GRID_STYLES.map((v) => (
          <div key={v} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{
              height: 38,
              display: "flex", alignItems: "flex-end",
            }}>
              <div style={{
                width: "100%",
                height: `${Math.max(8, (counts[v] / max) * 100)}%`,
                background: "var(--df-text-primary)",
                opacity: counts[v] === 0 ? 0.18 : 0.62,
                borderRadius: 2,
              }} />
            </div>
            <div style={{
              fontFamily: "var(--df-font-mono)",
              fontSize: 14,
              fontWeight: 700,
              color: "var(--df-text-primary)",
              letterSpacing: "-0.01em",
            }}>
              {counts[v]}
            </div>
            <div style={{
              fontFamily: "var(--df-font-mono)",
              fontSize: 9,
              color: "var(--df-text-faint)",
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
            }}>
              {v}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionHeader({ kicker, title, sub }: { kicker: string; title: string; sub: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 18, borderBottom: "1px solid var(--df-border-subtle)" }}>
      <div style={{
        fontFamily: "var(--df-font-mono)",
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "var(--df-tracking-label)",
        color: "var(--df-text-muted)",
      }}>
        {kicker}
      </div>
      <h2 style={{
        margin: 0,
        fontFamily: "var(--df-font-display)",
        fontSize: "var(--df-text-xl)",
        fontWeight: "var(--df-fw-bold, 700)",
        letterSpacing: "var(--df-tracking-display)",
        color: "var(--df-text-primary)",
      }}>
        {title}
      </h2>
      <p style={{
        margin: 0,
        fontSize: "var(--df-text-sm)",
        color: "var(--df-text-secondary)",
        lineHeight: 1.55,
        maxWidth: 720,
      }}>
        {sub}
      </p>
    </div>
  );
}

function CoverRow({ variant, index }: { variant: DotGridStyle; index: number }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "180px 1fr",
      gap: 24,
      alignItems: "start",
    }}>
      {/* label column */}
      <div style={{ paddingTop: 4 }}>
        <div style={{
          fontFamily: "var(--df-font-mono)",
          fontSize: 9,
          color: "var(--df-text-faint)",
          letterSpacing: "var(--df-tracking-label)",
        }}>
          {String(index).padStart(2, "0")}
        </div>
        <div style={{
          fontFamily: "var(--df-font-display)",
          fontSize: 18,
          fontWeight: "var(--df-fw-semibold, 600)",
          letterSpacing: "var(--df-tracking-tight)",
          color: "var(--df-text-primary)",
          marginTop: 2,
        }}>
          {variant}
        </div>
      </div>
      {/* sample grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 10,
      }}>
        {SAMPLE_SLUGS.map((slug) => (
          <div
            key={`${variant}-${slug}`}
            style={{
              aspectRatio: "4 / 3",
              background: "var(--df-surface-raised)",
              borderRadius: "var(--df-r-lg)",
              overflow: "hidden",
              boxShadow:
                "inset 0 1px 0 var(--df-skeu-top-light), inset 0 0 0 1px var(--df-border-subtle), 0 1px 2px var(--df-skeu-near)",
            }}
          >
            <ProjectCover slug={`${variant}-${slug}`} variant={variant} />
          </div>
        ))}
      </div>
    </div>
  );
}

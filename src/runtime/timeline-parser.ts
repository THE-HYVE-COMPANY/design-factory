// Timeline parser — reads the HTML composition of a project and returns
// a structured summary of the animations + their durations. The Video Tab
// consumes this to render its multi-track timeline. Best-effort regex
// scanning over <script> and <style> blocks. No AST.
//
// Frame's blueprint §4.4 is the authoritative spec; this implementation
// follows the rules there:
//   - anime.js calls    → duration + optional delay extracted via regex
//   - CSS @keyframes    → looked up by name, paired with animation: usage
//   - CSS animation:    → duration + optional delay
//   - CSS transition:   → listed but NOT summed (transitions fire on
//                          interaction, not the timeline)
//   - Zero animations   → totalDurationMs = 5000 (still-frame default)

export interface AnimationTrack {
  id: string;
  label: string;
  /** Offset from t=0 of the composition. */
  startMs: number;
  /** How long this animation runs. */
  durationMs: number;
  source: "anime-js" | "css-keyframe" | "transition";
  /** First ~80 chars of the matching code, for tooltip / debug. */
  excerpt: string;
}

export interface TimelineSummary {
  /** Sum of the longest path through the timeline. Defaults to 5000ms
   *  when nothing was detected — Hyperframes still produces a still-frame
   *  MP4 useful for OG images / social previews. */
  totalDurationMs: number;
  tracks: AnimationTrack[];
}

/** Convert "300ms" / "0.6s" / "1500" (bare number = ms) to milliseconds. */
function durationToMs(raw: string): number {
  const t = raw.trim();
  if (t.endsWith("ms")) return parseFloat(t) || 0;
  if (t.endsWith("s")) return Math.round((parseFloat(t) || 0) * 1000);
  return parseFloat(t) || 0;
}

/** Truncate excerpt for tooltips / labels. Single line. */
function excerpt(s: string, max = 80): string {
  const oneLine = s.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine;
}

/** Try to derive a friendly label from an anime.js call snippet. */
function labelFromAnimeCall(code: string): string {
  // Common patterns:
  //   anime({ targets: '.hero', ... })  →  "hero"
  //   anime.timeline({ }).add({ targets: '.card', ... })  →  "card"
  const m = code.match(/targets:\s*['"`]([^'"`]+)['"`]/);
  if (m && m[1]) return m[1].replace(/^[.#]/, "");
  return "anime";
}

/** Try to derive a friendly label from a CSS rule snippet. */
function labelFromCssRule(rule: string): string {
  // ".hero { animation: fadeIn 0.6s; ... }"  →  "hero · fadeIn"
  // ".card:hover { transition: ... }"        →  "card hover"
  const sel = rule.split("{")[0]?.trim() ?? "";
  const animMatch = rule.match(/animation:\s*([\w-]+)/);
  const sanitized = sel.replace(/^[.#]/, "").replace(/\s+/g, " ").slice(0, 24);
  if (animMatch) return `${sanitized} · ${animMatch[1]}`;
  return sanitized || "css";
}

/** Pull anime.js timeline calls. Both top-level `anime({...})` and
 *  `anime.timeline().add({...})` chains are handled the same way — each
 *  add() block becomes its own track. */
function parseAnimeJs(html: string): AnimationTrack[] {
  const tracks: AnimationTrack[] = [];
  // Scan <script> blocks. We accept inline + module scripts.
  const scriptMatches = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
  let counter = 0;
  for (const block of scriptMatches) {
    const code = block[1];
    // Find every object literal that has a `duration:` property AND looks
    // like an anime call somewhere in the surrounding ~120 chars. This is
    // intentionally fuzzy — false positives are fine in v1 (the user can
    // always rename the track).
    const literals = [...code.matchAll(/\{[^{}]*duration\s*:\s*(\d+(?:\.\d+)?)(?:\s*[,}])/g)];
    for (const lit of literals) {
      const fullText = lit[0];
      const start = lit.index ?? 0;
      const before = code.slice(Math.max(0, start - 60), start);
      // Only count this literal if "anime(" or ".add(" appears in the
      // 60-char window leading up to it.
      if (!/anime\s*\(|\.\s*add\s*\(/.test(before)) continue;

      const durationMs = parseFloat(lit[1]);
      const delayMatch = fullText.match(/delay\s*:\s*(\d+(?:\.\d+)?)/);
      const delayMs = delayMatch ? parseFloat(delayMatch[1]) : 0;

      tracks.push({
        id: `anime-${counter++}`,
        label: labelFromAnimeCall(fullText),
        startMs: delayMs,
        durationMs,
        source: "anime-js",
        excerpt: excerpt(fullText),
      });
    }
  }
  return tracks;
}

/** Pull CSS @keyframes-driven animations. We pair each `animation:` rule
 *  with the @keyframes block it references (when both exist) so the
 *  track label can show e.g. "card · fadeIn" instead of just "card". */
function parseCssAnimations(html: string): AnimationTrack[] {
  const tracks: AnimationTrack[] = [];
  // Scan <style> blocks AND inline style="" attributes (rare for animations
  // but technically valid).
  const styleBlocks = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)];
  let counter = 0;

  for (const block of styleBlocks) {
    const css = block[1];
    // Each rule body that contains an `animation:` shorthand declaration.
    // We match outside @keyframes blocks (those define motion, they don't
    // apply it).
    const ruleRegex = /([^@{}][^{}]*)\{([^{}]*animation\s*:\s*[^;]+;[^{}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = ruleRegex.exec(css)) !== null) {
      const ruleHead = m[1].trim();
      // Skip rules nested inside @media etc. — naive but acceptable v1.
      if (ruleHead.startsWith("@")) continue;
      const ruleBody = m[2];
      // `animation: <name> <duration> [<easing>] [<delay>] ...`
      const animMatch = ruleBody.match(/animation\s*:\s*[\w-]+\s+(\d+(?:\.\d+)?(?:s|ms)?)(?:\s+[\w(),.\s-]+?)?(?:\s+(\d+(?:\.\d+)?(?:s|ms)?))?\s*[;,]/);
      if (!animMatch) continue;
      const durationMs = durationToMs(animMatch[1]);
      const delayMs = animMatch[2] ? durationToMs(animMatch[2]) : 0;
      // animation-delay: takes precedence if also specified separately
      const sepDelay = ruleBody.match(/animation-delay\s*:\s*(\d+(?:\.\d+)?(?:s|ms)?)/);
      const finalDelay = sepDelay ? durationToMs(sepDelay[1]) : delayMs;

      tracks.push({
        id: `css-${counter++}`,
        label: labelFromCssRule(`${ruleHead} { ${ruleBody} }`),
        startMs: finalDelay,
        durationMs,
        source: "css-keyframe",
        excerpt: excerpt(`${ruleHead} { ${ruleBody.trim()} }`),
      });
    }
  }
  return tracks;
}

/** Pull CSS transitions (informational only — not added to the timeline
 *  total, since transitions fire on interaction not on a fixed schedule).
 *  We surface them so the user can see "card has a hover transition"
 *  in the inspector even though it doesn't have a clip on the timeline. */
function parseCssTransitions(html: string): AnimationTrack[] {
  const tracks: AnimationTrack[] = [];
  const styleBlocks = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)];
  let counter = 0;

  for (const block of styleBlocks) {
    const css = block[1];
    const ruleRegex = /([^@{}][^{}]*)\{([^{}]*transition\s*:\s*[^;]+;[^{}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = ruleRegex.exec(css)) !== null) {
      const ruleHead = m[1].trim();
      if (ruleHead.startsWith("@")) continue;
      const ruleBody = m[2];
      // `transition: <prop> <duration> [<easing>] [<delay>]`
      const transMatch = ruleBody.match(/transition\s*:\s*[\w-]+\s+(\d+(?:\.\d+)?(?:s|ms)?)/);
      if (!transMatch) continue;
      const durationMs = durationToMs(transMatch[1]);

      tracks.push({
        id: `tr-${counter++}`,
        label: `${labelFromCssRule(`${ruleHead} { ${ruleBody} }`)} (transition)`,
        startMs: 0,
        durationMs,
        source: "transition",
        excerpt: excerpt(`${ruleHead} { ${ruleBody.trim()} }`),
      });
    }
  }
  return tracks;
}

/** Main entry point — public API of this module. */
export function parseTimeline(html: string): TimelineSummary {
  if (!html || html.trim().length < 20) {
    return { totalDurationMs: 5000, tracks: [] };
  }

  const tracks: AnimationTrack[] = [
    ...parseAnimeJs(html),
    ...parseCssAnimations(html),
    ...parseCssTransitions(html),
  ];

  if (tracks.length === 0) {
    return { totalDurationMs: 5000, tracks: [] };
  }

  // Total duration = longest path through the playable tracks (anime-js +
  // css-keyframe). Transitions are excluded because they don't drive the
  // export timeline — they fire on interaction, which doesn't happen in
  // headless render anyway.
  let total = 0;
  for (const t of tracks) {
    if (t.source === "transition") continue;
    const end = t.startMs + t.durationMs;
    if (end > total) total = end;
  }
  if (total === 0) total = 5000; // all transitions, no clips → still frame default

  return { totalDurationMs: total, tracks };
}

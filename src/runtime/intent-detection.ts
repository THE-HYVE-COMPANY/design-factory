// intent-detection.ts — pure heuristic that turns a free-form prompt into
// a list of detected "intent tags" + suggested modifier defaults.
//
// Background. The current canonical New Project flow forces the user to
// open a Format + Direction modal BEFORE typing the prompt — which traps
// briefings like "grid 3x3 com 9 SVG animations de máquinas pra branding
// HYVE Design Factory" because the user wants animations + brand + multi-
// asset + anti-slop strict, but the modal only lets them pick ONE format.
//
// This module flips that: prompt is the source of truth, modifiers are
// optional defaults derived FROM the prompt. The function below is a
// deterministic, dependency-free heuristic so it stays cheap, testable,
// and easy to evolve. Intentionally simple — no NLP, no fuzzy matching;
// keyword scan + boolean composition.
//
// Lab scope: this lives at /np-prompt-first only. The canonical
// NewProjectLabScreen + NewProjectRegionsLabScreen are untouched. If
// the user approves the UX, the the next iteration promotes intent-detection
// + the screen into the production HomeScreen flow.

/** A single semantic tag detected from prompt content. Order = priority
 *  for display (motion shows first because it implies multi-output).
 */
export type IntentTag =
  | "motion"
  | "brand"
  | "multi-asset"
  | "landing"
  | "prototype"
  | "asset";

/** Modifier defaults the UI should pre-activate when the user clicks
 *  "Aplicar" on the suggestion card. All optional — empty object means
 *  "no suggestion confident enough to apply". */
export interface IntentSuggestion {
  /** Suggested format (1:1, 16:9, 9:16, 4:5, "custom"). Null = leave default. */
  format?: string | null;
  /** Suggested DS slug (from the user's library). Null = leave default. */
  ds?: string | null;
  /** Anti-slop strictness when motion+brand combined. */
  antiSlop?: "strict" | "loose" | null;
  /** Suggested verb. "create" is the default if nothing else is clearer. */
  verb?: "create" | "refine" | "vary" | "explain" | null;
  /** Free-form direction hint surfaced as a chip suggestion. */
  direction?: string | null;
}

export interface IntentResult {
  /** Tags detected in the prompt, deduped, in display priority order. */
  tags: IntentTag[];
  /** Modifier defaults the UI should pre-activate on "Aplicar". */
  suggestion: IntentSuggestion;
  /** Short human-readable summary (pt-BR, used in the suggestion card). */
  summary: string;
}

// Keyword tables. Each keyword is matched as a whole word OR as a
// substring depending on the entry — for short tokens like "9" we
// require word-boundary so we don't match "1990". For brand we accept
// substring because "branding"/"rebrand" etc. all count.
//
// Accented Portuguese words use case-insensitive substring matching
// instead of `\b` boundaries because JS's default `\b` treats `ç`, `ã`,
// `é` as non-word characters and the boundary anchors silently fail.
// We compensate by making each accented pattern explicit enough to
// avoid false positives (no two-letter substrings).
const KEYWORDS: Record<IntentTag, RegExp[]> = {
  motion: [
    /anima[cç][oõã]es?/i, // animação, animações, animacao, animacoes
    /\banimation(s)?\b/i,
    /\bmotion\b/i,
    /\bsvg\b/i,
    /\bgif\b/i,
    /\bvideo(s)?\b/i,
    /v[íi]deo(s)?/i,
    /\bloop(s)?\b/i,
    /\btransition(s)?\b/i,
  ],
  brand: [
    /\bbrand(ing)?\b/i,
    /\brebrand\b/i,
    /\blogo(s|tipo)?\b/i,
    /\bmarca\b/i,
    /\bidentidade\b/i,
  ],
  "multi-asset": [
    /\bgrid\b/i,
    /\b\d+x\d+\b/i, // 3x3, 4x4, etc.
    /\b(9|12|16|24)\b/, // common multi counts
    /\bmulti(-?asset)?\b/i,
    /v[áa]rios?/i,
    /m[úu]ltipl(o|a)s?/i,
    /cole[cç][ãa]o/i,
    /\bcollection(s)?\b/i,
  ],
  landing: [
    /\blanding(-?page)?\b/i,
    /\bsite\b/i,
    /\bhomepage\b/i,
    /\bhero\b/i,
    /\bsection(s)?\b/i,
  ],
  prototype: [
    /\bprototype(s)?\b/i,
    /prot[óo]tipo(s)?/i,
    /\bwireframe(s)?\b/i,
    /\bmockup(s)?\b/i,
    /\bfluxo(s)?\b/i,
    /\buser flow(s)?\b/i,
  ],
  asset: [
    /[íi]cone(s)?/i, // ícone, ícones, icone, icones
    /\bicon(s)?\b/i,
    /ilustra[cç][ãa]o/i,
    /\billustration(s)?\b/i,
    /\bbadge(s)?\b/i,
    /\bsticker(s)?\b/i,
  ],
};

// Display priority: motion + brand surface first because they drive the
// strongest modifier suggestions (anti-slop strict + brand-aware DS).
const TAG_ORDER: IntentTag[] = [
  "motion",
  "brand",
  "multi-asset",
  "landing",
  "prototype",
  "asset",
];

/** Detect intent tags + suggested modifiers from a free-form prompt.
 *  Pure function; no IO; safe to call on every keystroke (debounce in UI).
 */
export function detectIntent(prompt: string): IntentResult {
  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    return { tags: [], suggestion: {}, summary: "" };
  }

  const found = new Set<IntentTag>();
  for (const tag of TAG_ORDER) {
    const patterns = KEYWORDS[tag];
    if (patterns.some((re) => re.test(prompt))) {
      found.add(tag);
    }
  }

  const tags: IntentTag[] = TAG_ORDER.filter((t) => found.has(t));

  // Compose suggestion. Rules:
  //   · brand alone → anti-slop strict (DS stays user-controlled).
  //   · motion alone → format depends; default 16:9 unless multi-asset.
  //   · multi-asset → 1:1 (grid-friendly) overrides motion's 16:9.
  //   · landing → format 16:9, DS none (user picks site DS later).
  //   · prototype → verb=refine if "iterate" / "refine" appears, else create.
  //   · asset (icon-only) → 1:1.
  //   · brand + motion + multi-asset (the canonical "grid 3x3 9 SVG …" case)
  //     → format 1:1, anti-slop strict, verb create. DS suggestion stays
  //     blank — there's no shipped default brand DS; the user picks.
  const suggestion: IntentSuggestion = {};

  if (tags.includes("brand")) {
    suggestion.antiSlop = "strict";
  }
  if (tags.includes("multi-asset")) {
    suggestion.format = "1:1";
  } else if (tags.includes("motion")) {
    suggestion.format = "16:9";
  } else if (tags.includes("asset")) {
    suggestion.format = "1:1";
  } else if (tags.includes("landing")) {
    suggestion.format = "16:9";
  }

  if (tags.includes("prototype")) {
    suggestion.verb = /\b(refin|iterar|iterat|melhor)/i.test(prompt) ? "refine" : "create";
  } else if (tags.length > 0) {
    suggestion.verb = "create";
  }

  // Direction hint. Cheap heuristic — if "editorial", "brutal", "soft" or
  // "minimal" appear, surface as a presetable direction.
  if (/\beditorial\b/i.test(prompt)) suggestion.direction = "editorial";
  else if (/\bbrutal/i.test(prompt)) suggestion.direction = "brutal";
  else if (/\bsoft\b/i.test(prompt) || /\bminimal/i.test(prompt)) suggestion.direction = "soft minimal";

  // Summary text — pt-BR, used in the suggestion card. Empty if no tags.
  const summary = tags.length === 0
    ? ""
    : `Detectei: ${tags.join(" · ")}`;

  return { tags, suggestion, summary };
}

/** Friendly label for a tag — pt-BR, used as chip text. */
export function intentTagLabel(tag: IntentTag): string {
  switch (tag) {
    case "motion": return "motion";
    case "brand": return "brand";
    case "multi-asset": return "multi-asset";
    case "landing": return "landing";
    case "prototype": return "prototype";
    case "asset": return "asset";
  }
}

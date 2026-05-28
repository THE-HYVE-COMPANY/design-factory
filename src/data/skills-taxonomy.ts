// skills-taxonomy.ts — Installable extensions.
//
// One of the 7 canonical defaults categories in DF v1:
//   canvas · formats · rules · dials · commands · skills · system prompts
//
// "Skills" are bundles a user installs into their library. They extend
// the agent's capability surface (e.g. a Responsive Audit skill, a
// Dark Mode generator, a Video-Ready post-pass). Skills are
// CONCEPTUALLY DISTINCT from commands:
//   - commands are slash triggers built into the platform (typed `/x`)
//   - skills are user-managed library entries selected per-project
//     via the NewProject modal (or attached later via the project
//     drawer)
//
// User model (canon 2026-05-18): skills are uploaded MANUALLY —
// this taxonomy ships empty and stays empty until the user lands
// the first batch. The runtime + UI should:
//   1. Render the skills picker empty without erroring.
//   2. Allow the user's upload pipeline to push entries here as
//      `Object.freeze`-able items.
//
// When skills land, each entry follows this shape:

export interface BuiltinSkill {
  id: string;
  /** Human label for the picker. */
  label: string;
  /** One-liner describing the capability. */
  description?: string;
  /** Optional category for picker grouping ("audit", "transform", "post-pass"). */
  category?: string;
  /** Markdown body the agent receives — instructions for applying
   *  this skill to the current project state. Mirrors the .md body
   *  pattern that command agents (formerly verbs) use. */
  body: string;
  /** If true, response is parsed as HTML and replaces the iframe;
   *  otherwise the response is surfaced in chat as prose. */
  modifiesHtml: boolean;
}

/** Builtin skills bundled with DF. Empty until user upload —
 *  the runtime is contract-correct with the empty list. */
export const DEFAULT_BUILTIN_SKILLS: ReadonlyArray<BuiltinSkill> = Object.freeze([]);

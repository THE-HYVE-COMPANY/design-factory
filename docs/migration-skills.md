# Skills migration — `.claude/skills/` → `/skills/`

The DesignFactory skills registry now canonicalises on
`<repoRoot>/skills/`. The legacy path `<repoRoot>/.claude/skills/` is
still read for backward-compat. This page explains why, what changed,
and what (if anything) you need to do.

---

## TL;DR

- **New canonical path:** `<repoRoot>/skills/`
- **Legacy path:** `<repoRoot>/.claude/skills/` (read-only, deprecated)
- **App writes go to:** `/skills/` only
- **App reads merge:** both paths, with `/skills/` winning on collision
- **Manual migration:** one `mv` command (see below)

---

## Why this changed

DesignFactory ships with 10 providers — Claude Code, Codex CLI,
Gemini CLI, Opencode, Kimi Code CLI (CLI-based) and Anthropic API,
OpenAI API, Gemini API, OpenRouter API, Ollama (artifact-driven).
Skills are a provider-agnostic surface — DF expands the skill body
into the system prompt at turn-build time, regardless of which CLI or
API is active.

Hiding skills inside `.claude/` implied Claude-only ownership and made
the registry feel coupled to the Claude harness. Moving them to
`/skills/` makes the contract explicit:

> Any provider can consume any skill. The registry is the source of
> truth, not the harness convention.

---

## What stays the same

- The SKILL.md format. Frontmatter + body, exactly as before.
- The slash-menu UX. `/<trigger>` still expands the same way.
- The per-skill folder structure (`<slug>/SKILL.md` + optional
  attachments).
- The mutation API (`POST /skills`, `PATCH /skills/:id`,
  `DELETE /skills/:id`).
- The registry endpoint shape (`GET /skills/registry`).

---

## What changed

| Surface | Before | Now |
|---|---|---|
| App writes | `<repoRoot>/.claude/skills/` | `<repoRoot>/skills/` |
| App reads | `.claude/skills/` only | `/skills/` first, then `.claude/skills/` |
| `id` shape | inconsistent between install and registry | `df:<rel-from-repo-root>` everywhere |
| Documentation | `.claude/skills/` referenced as canonical | `/skills/` referenced as canonical |

---

## Migrating an existing install

If your `.claude/skills/` has real skills (not just a `.gitkeep`), one
command is enough:

```bash
cd <repoRoot>
mkdir -p skills
mv .claude/skills/* skills/   # move folders + files
rmdir .claude/skills          # cleanup (only if now empty)
```

If `.claude/skills/` only contains `.gitkeep`, you can leave it alone —
the folder is informational, marked as deprecated in its `.gitkeep`.

After moving, restart the daemon (or simply re-open the Skills tab in
the app — the registry rescans on focus).

---

## Conflicts (canonical vs legacy)

Both paths are walked. If the same `(source, trigger)` exists in both,
the **canonical wins**. The legacy entry is dropped silently from the
registry. To audit:

```bash
ls skills/         # canonical (active)
ls .claude/skills  # legacy (read-only)
```

If the same skill exists in both, delete the legacy copy after
verifying the canonical one is what you want.

---

## Provider parity

The walker change ensures every provider sees the same registry. The
`nativeSkills` capability flag in `src/providers/types.ts` no longer
gates skill access — it only describes whether the underlying CLI
binary (Claude Code, Codex CLI, etc.) has its own native skill
resolution. The runtime expands skill bodies into the system prompt
**before** the provider runs, so all 13 providers get the same
context.

---

## Rollback

If something breaks, move the skills back and the daemon will walk
the legacy path again:

```bash
mv skills/* .claude/skills/
```

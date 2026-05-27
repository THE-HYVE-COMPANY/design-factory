# Roadmap

What's next for Design Factory, in plain terms. This file is the
short version; the longer narrative lives in [README.md](README.md)
under "Why this exists" and "The loop".

This doc names **direction**, not deadlines. The order below is
the order we expect things to land, not a calendar. We update this
file when direction changes — pull requests against ROADMAP.md are
fine and expected.

---

## Now — `v1.0.0-beta.x` public preview

These are the surfaces that ship in the first public preview.
Status as of the file's last edit:

- 10 multi-provider adapters (5 CLI + 4 BYOK API + 1 local Ollama).
- Persistent canvas, `/tweaks` panel, inline text edit, `/comment`
  loop, 9 editorial Commands.
- Design system import (paste / upload / GitHub / folder).
- 7 starter skills + ZIP skill import.
- 10 starter design systems shipped in the repo.
- 30 default rules (hyve-agnostic, bilingual).
- 6 taste dials.
- Manual version snapshots.
- Embedded terminal + file manager.
- Theme editor (light / dark / token overrides).
- Local Node daemon — no cloud calls except to the provider you
  picked.

The preview ships with two intentional gaps: the editor UI for
animation export (the runtime exists in the repo) and the deploy
adapters (Vercel / GitHub) are deferred to v1.1.

---

## Next — what we're working on toward v1.1

In rough priority order, top → bottom:

1. **Stronger strict-sandbox path.** The opt-in strict sandbox
   trades some interactive features for tighter iframe security.
   Goal: bring the strict mode to feature parity with the
   permissive default.
2. **Side-by-side version diff.** Snapshots restore one-click
   today; v1.1 adds a diff view so you can compare drafts before
   choosing which one to keep.
3. **Direction blending.** Multi-variant turns — fork the same
   prompt into N parallel attempts, compare, pick.
4. **Provider recovery UX.** Cleaner messaging when a provider's
   auth or quota fails, plus a one-click "retry with another
   provider" path.
5. **Onboarding for design systems.** First-time importers don't
   always know what a design.md needs. Adding a one-pager and an
   in-app primer.
6. **Comments → direction.** Tighter loop from "highlighted
   comment on the preview" to "next turn ships with that comment
   as a constraint".
7. **MP4 / animation export.** The Hyperframes runtime is already
   in the repo. Surface an export UI in the editor.
8. **Provider promotions.** As each adapter is validated against
   real workloads, promote it `experimental → beta → stable` in
   the picker.

---

## Later — directions we're committed to but not actively building

- **Multi-pane diff editor** for HTML artefacts. Today the loop is
  full-page; later we want section-level edits with structural
  diff.
- **First-class plugin surface.** Today an extension means a fork.
  A real plugin surface would mean the daemon can host
  community-built adapters and skills as drop-ins.
- **Public examples gallery.** `examples/` ships three files today;
  later we want a curated gallery (still on disk, no cloud) with
  notes on what each artefact demonstrates.

---

## Not on the roadmap (and why)

These are deliberate exclusions, not "we haven't gotten to it".

- **Cloud sync.** Files belong on the user's disk. Sync introduces
  account systems, conflict resolution, and trust questions the
  project is explicitly designed to avoid.
- **Hosted inference.** The picker treats every provider the same.
  Adding a "HYVE-hosted" option would privilege one path and
  undermine the multi-provider thesis.
- **Vector canvas.** The substance is HTML. We are not aiming to
  replace Figma; we're aiming to give HTML output a real editing
  loop.
- **Marketplace / commerce mechanics.** No skill marketplace, no
  template store, no in-app purchases. Forks are welcome to add
  these.
- **MCP / connector ecosystem.** The daemon stays autonomous. We
  add adapters case-by-case, in the codebase, rather than via a
  generic connector layer.

---

## How to influence the roadmap

- **Open an issue** with the `roadmap` label if you want a new
  item in the "Next" list or want to argue against one.
- **Open a discussion** for ideas that haven't shaped up into an
  actionable issue yet.
- **Open a PR** if you want to make the case in code.

The final shape of the roadmap is HYVE's call (see
[GOVERNANCE.md](GOVERNANCE.md)), but the road there is open.

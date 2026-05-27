# Smoke runbook

A repeatable manual walk that takes a fresh clone from "git pull"
to "first generated HTML on disk" in **under 20 minutes**. Run this
before every `v*.0.0` tag, after every dependency bump, and as the
final gate before the public-repo cut.

The runbook is intentionally manual: each step exercises a surface
that isn't covered by automated tests (see
[`FEATURE-COVERAGE.md`](FEATURE-COVERAGE.md) for the matrix). If
something fails, fix the underlying bug — don't paper over the
runbook.

---

## Prerequisites

- Node 20 or newer (`node -v` should print `v20.*`, `v22.*`, or
  later).
- Git + a working browser (Chromium / Firefox / Safari all OK).
- At least one provider available. The cheapest path is
  **Anthropic API** with `ANTHROPIC_API_KEY` exported, but any of
  the 10 adapters works.

```bash
node -v
git --version
echo "${ANTHROPIC_API_KEY:0:8}…"   # any provider key works; this just confirms one is set
```

---

## Step 1 — Clean install (target: < 3 min)

```bash
cd /tmp
rm -rf df-smoke
git clone https://github.com/the-hyve-company/design-factory.git df-smoke
cd df-smoke
npm install
```

Expect: `npm install` completes with no `engine`, `peer`, or
`audit` errors. The Apache-2.0 LICENSE + NOTICE files exist at the
repo root.

---

## Step 2 — Static gates (target: < 90 s)

```bash
npx tsc --noEmit
npm test
npm run smoke:public-files
npx vite build
```

Expect: all four clean. `npx vite build` ends with `✓ built in
N.NNs`. A bundle-size warning is fine; an error is not.

`npm run smoke:public-files` confirms the legal/governance files and
license metadata are present and consistent.

---

## Step 3 — Daemon smoke (target: < 30 s)

```bash
npm run smoke:daemon
```

Expect: every probed endpoint reports 200 OK. The script
(`scripts/daemon-smoke.mjs`) spins the daemon up, hits `/healthz`,
`/fs/workspace-info`, `/fs/list-projects`, `/skills/registry`,
`/providers/status`, then tears the daemon down.

---

## Step 4 — Bring the app up (target: < 1 min)

```bash
npm run dev:web
```

Expect: the daemon binds `:1421` first, then Vite binds `:1420`,
then both stay up. Open http://localhost:1420 in a browser.

Visual check on the Home screen:

- Projects tab empty state visible.
- Design systems tab shows 10 shipped DS (apple, claude, framer,
  linear, nike, raycast, spotify, vercel, wired, xai).
- Skills tab shows 7 starter skills.
- Slash dropup appears when typing `/` in any chat input.

---

## Step 5 — Create a project (target: < 1 min)

1. Home → **+ Novo projeto**.
2. Name it `smoke-test`. Pick any provider that's ready (green
   LED).
3. Submit. The Editor screen opens, iframe shows the project's
   name centred, chat input is focused.

Expect: a folder appears at `projects/smoke-test/` with `.df/`
metadata inside. The URL changes to `#/projects/smoke-test`.

---

## Step 6 — Generate one turn (target: < 2 min)

In the chat input, send:

> A landing page for a notes app called Stencil. Editorial type,
> one accent colour, tabular nums on the stats row.

Expect:

- The processing banner appears above the chat input.
- Tool events stream into the chat as the model writes.
- The iframe re-renders with the generated HTML.
- An HTML file appears at `projects/smoke-test/smoke-test.html`.

If the model errors (rate-limited, bad key), swap providers via
the picker in the header and re-send.

---

## Step 7 — `/tweaks` (target: < 1 min)

1. Type `/tweaks` in chat. The slash dropup highlights the
   command; press Enter.
2. The model rewrites the HTML to expose CSS variables, then the
   Tweaks panel opens with sliders bound to those variables.
3. Drag any slider — the iframe updates **without** an extra LLM
   call (instant).
4. Close the panel; the changes persist in the HTML on disk.

---

## Step 8 — Inline text edit (target: < 1 min)

1. Hover any text in the iframe. The element should highlight.
2. Click. An inline edit panel opens with the current text.
3. Change a word. Press `Cmd/Ctrl+Enter`.
4. The HTML on disk updates with the new text. The iframe
   re-renders.

---

## Step 9 — Design system import (target: < 2 min)

1. Open Settings → Design systems → **+ Importar**.
2. Choose **Pasta local** and point it at
   `examples/fixtures/design-system/`. The runbook uses this
   bundled fixture so the test stays stable across clones — no
   reliance on third-party design.md URLs.
3. After parsing, "Smoke DS" appears in the list.
4. Open `projects/smoke-test`, attach **Smoke DS** via the
   toolbar.
5. Send a new turn ("polish this with the attached DS"). The
   model honours the fixture's palette + spacing + radii tokens.

If the "Pasta local" entrypoint can't reach the fixture (sandbox
restriction, etc.), fall back to **Carregar arquivo** with the
single `design.md` inside the fixture folder — same result.

---

## Step 10 — Skill ZIP import (target: < 1 min)

1. Open Home → Skills → **+ Importar**.
2. Drop `examples/fixtures/skills/minimal-skill.zip` into the
   upload area. The runbook uses this bundled fixture so the test
   stays stable across clones — no reliance on whatever ZIPs
   happen to be in the user's skills folder.
3. The skill appears in the list. Verify on disk that the import
   preserved the folder structure:

   ```bash
   ls skills/minimal-skill/
   # SKILL.md   references/
   ls skills/minimal-skill/references/
   # style.md
   ```

   If `references/style.md` is missing, the full-payload import
   from PR #210 regressed.
4. Type `/impeccable-main` in chat — the dropup completes it.

---

## Result line

If every step passed, write the result line at the end of the
session:

```txt
Smoke runbook 2026-MM-DD — version XX — N steps pass (M flagged)
```

Where `M flagged` lists any step that limped (worked but slow,
visual jank, etc). A failed step is **not** a pass — fix and
re-run before tagging.

---

## What this runbook deliberately doesn't cover

- **Production deploys.** The public preview runs as app + daemon;
  there is no hosted-app smoke.
- **Heavy load.** The runbook hits one project, one turn per
  command. Stress testing lives in `tests/visual/` and dedicated
  perf scripts.
- **Cross-platform.** Before a public announcement, maintainers should
  run the app on macOS and Windows. The runbook
  itself is OS-agnostic but doesn't enforce any particular
  combination.
- **Provider-specific quirks.** Each adapter ships its own quirks
  (CLI auth, BYOK rate limits, Ollama model selection). The
  runbook treats "any provider" as sufficient.

---

## Updating this runbook

When the app gains a surface that a fresh user can't reach via the
existing steps, add a step. Order them by "what a new user would
try first". The runbook should stay walkable in under 20 minutes;
if it gets longer, split a follow-up runbook (deployment, advanced
provider config, etc.) rather than bloating this one.

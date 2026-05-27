# Launch plan — clean public cut of Design Factory

> **The public repo should not be where HYVE thinks out loud. It
> should be where HYVE publishes what has become method.**

This document used to track "flip the private repo to public" — that
framing was wrong. The private repo carries ~220 PRs of internal
decisions, founder-feedback artefacts, dialog drafts, and exploratory
work that we don't want inverted into a launch-day archaeology dig.

The new framing is a **clean public cut**:

1. Keep this repo private indefinitely as the source-of-truth working
   copy.
2. Land every deliverable a public-facing project needs **inside this
   repo**, side-by-side with the existing internal artefacts.
3. When the deliverables are ready, create a brand-new repo
   (`design-factory` under THE-HYVE-COMPANY or similar) and copy
   only the public surface into it.
4. Announce the public repo as v1.0.0-beta.1.

Until step 3, the private repo doesn't change visibility. The founder
keeps editing freely without worrying about audience.

---

## Decisions already taken

| Decision | Value | Rationale |
| --- | --- | --- |
| License | **Apache-2.0** | Stronger patent grant, explicit attribution clause, recognised as the safer permissive licence for AI-adjacent code. Supersedes the 2026-05-15 MIT decision. |
| Public cut strategy | **New repo** (not visibility flip, not filter-branch) | Avoids leaking ~220 internal PRs + the founder-only doc artefacts. Filter-branch would force every existing clone to re-clone and still leak commit metadata. |
| Trademark | **Code permissive, brand reserved** | A `NOTICE` file scopes the Apache grant to code + docs only; "HYVE" and the Design Factory wordmark stay reserved. Distribution allowed, derivative branding not. |

---

## Tier 0 — Foundation (must land before any other tier means anything)

| # | Item | Owner | Status | DoD |
| --- | --- | --- | --- | --- |
| T0.1 | Reframe `OPEN-SOURCE-CHECKLIST.md` (this PR) | Claude | ✓ | The doc explicitly carries the "clean public cut" framing. Old "Tier 1 = visibility flip" sections replaced. |
| T0.2 | Swap LICENSE MIT → Apache-2.0 + add NOTICE | Claude | ✓ | `LICENSE` carries the Apache-2.0 text; `NOTICE` at the repo root scopes the grant to code + docs and reserves the HYVE / Design Factory marks; `package.json` `"license": "Apache-2.0"`; README EN + PT footers updated to badge + body. Decision record landed at `docs/decisions/2026-05-21-apache-2-0.md` supersedes the prior MIT note. |
| T0.3 | Public-cut manifest | Claude | ✓ | `docs/PUBLIC-CUT-MANIFEST.md` shipped. Lists every public-bound path (src, apps/daemon, design-systems allowlist, skills allowlist, templates, examples, docs allowlist, .github, root configs) and every private-only path (`.aios/`, `_internal/`, `scripts/audit-full/`, `docs/OPEN-SOURCE-CHECKLIST.md`, `docs/PUBLIC-CUT-MANIFEST.md` itself, `docs/decisions/`, `.claude/`). Includes copy procedure (`rsync --exclude`, smoke verify, cross-walk audit, single squash commit). |
| T0.4 | `GOVERNANCE.md` + `ROADMAP.md` | Claude | ✓ | `GOVERNANCE.md` (HYVE final-say on roadmap / taste / architecture / scope / brand, contributor roles, brand boundary, what's deliberately not codified) and `ROADMAP.md` (Now / Next / Later / Not on the roadmap, plus "how to influence the roadmap") both shipped at the repo root. |

## Tier 1 — Docs truth sweep (resolve every public-facing contradiction)

| # | Item | Owner | Status | DoD |
| --- | --- | --- | --- | --- |
| T1.1 | Provider count consistency | Claude | ✓ | `docs/providers.md`, `README.md`, `README.en.md`, `docs/quickstart.md`, and `src/providers/registry.ts` all describe the same **5 CLI + 4 BYOK + 1 local** split. Kimi reclassified from API → CLI to match the actual adapter (spawns `kimi --print`). |
| T1.2 | CHANGELOG rewrite | Claude | ✓ | Internal diary entries replaced with a single clean `1.0.0-beta.1 — Initial public preview` entry. Lists what ships across workspace, multi-provider, Direction Engine, editor surface, public-cut hygiene, and bundled docs. |
| T1.3 | README footer + banner placeholder review | Claude | ✓ | License badge points at the Apache LICENSE on both EN + PT-BR. BANNER SLOT comment intact. Footer links resolve. No orphan TODOs. |
| T1.4 | `docs/quickstart.md` + `docs/providers.md` polish | Claude | ✓ | Kimi install switched to canonical `curl` flow (was wrong `npm i -g @moonshot/kimi-code`). Opencode install harmonised to `opencode-cli` (was `opencode-ai`). Anthropic billing note tightened — dropped dated URL and founder-ask commentary, kept the operational fact. |
| T1.5 | Bundled-skill attribution + license confirmation | Claude | ◑ | Vendored monorepo dumps stripped from `skills/<name>/<name>/` (1783→96 files); upstream LICENSE/NOTICE preserved at each skill root; root `NOTICE` "Third-party bundled skills" section now carries the GitHub source URL + declared license for each: impeccable (Apache-2.0), taste (MIT), ui-skills (MIT), frontend-design (Anthropic Apache-2.0), frontend-guidelines (bendc), emil-design-eng (emilkowalski/skill), make-interfaces (MIT, jakubkrehel), frontend-slides (MIT, zarazhangrui). Resolved: `design-lab` (unconfirmed source) and `frontend-slides` (missing `STYLE_PRESETS.md`) were removed at the founder's call — 9 → 7 shipped skills. The remaining seven all carry a GitHub source + declared license in `NOTICE`. |

## Tier 2 — QA foundation (so the public cut isn't trust-me)

| # | Item | Owner | Status | DoD |
| --- | --- | --- | --- | --- |
| T2.1 | `docs/FEATURE-COVERAGE.md` | Claude | ✓ | Matrix shipped: 60 features grouped in 8 sections (projects, chat, canvas, providers, slash, DS+skills, editor, settings, cross-cutting). Each row scored Unit / Integration / Visual / Manual on a four-step ladder. Five critical gaps named explicitly (slash dropup+routing, DS import, Skills ZIP, EditorScreen E2E, real provider stream) with the exact test to add. |
| T2.2 | `docs/SMOKE-RUNBOOK.md` | Claude | ✓ | Ten-step manual runbook shipped. Clone → install → static gates → daemon smoke → app boot → create project → one turn → `/tweaks` → inline edit → DS import → Skill ZIP import. Each step has a target time, expected output, fallback if it fails. Pass criteria + result-line format at the end. |
| T2.3 | `scripts/daemon-smoke.mjs` + `npm run smoke:daemon` | Claude | ✓ | Script shipped. Spawns a daemon on a random free port (14210-14299), waits for `/healthz`, probes 5 endpoints (`/healthz`, `/fs/workspace-info`, `/fs/list-projects`, `/skills/registry`, `/providers/status`), prints per-probe PASS/FAIL line, exits non-zero on any failure. Verified locally: 5/5 PASS in ~70ms. |
| T2.4 | CI billing unblocked | Founder | ✓ | GitHub Actions billing limit raised; `ci.yml` now runs typecheck, unit tests, production build, i18n audit, public-files smoke, daemon smoke, and Playwright visual regression on PRs to `main`. |
| T2.5 | Critical automated coverage gaps | Claude | ✓ | Public-cut blockers are covered: <ul><li>Slash dropup + routing tests cover `findMatches` + `triggerAtCursor` over initial / prefix / substring / hidden / collision.</li><li>DS import parser test covers paste / upload / GitHub / folder entrypoints against `examples/fixtures/design-system/design.md`.</li><li>Skill ZIP import has a round-trip integration test using `examples/fixtures/skills/minimal-skill.zip`, asserting `SKILL.md` + `references/style.md` land under `skills/minimal-skill/`.</li><li>EditorScreen happy-path E2E mounts the product screen, renders slash suggestions, dispatches a first prompt, and verifies persistence/provider handoff.</li><li>Remaining hardening: real provider stream smoke behind opt-in secret.</li></ul> |
| T2.6 | Public-files smoke step | Claude | ✓ | `npm run smoke:public-files` asserts the public legal/governance files are present and consistent: `LICENSE` carries "Apache License", `NOTICE` exists, `package.json` and `package-lock.json` both declare Apache-2.0, and SECURITY / CONTRIBUTING / CODE_OF_CONDUCT / GOVERNANCE / ROADMAP are present. |

## Tier 3 — Polish + content (lower risk, higher leverage)

| # | Item | Owner | Status | DoD |
| --- | --- | --- | --- | --- |
| T3.1 | Banner art | Founder | ☐ | 1600×600 or 8:3 image dropped at `docs/readme/assets/banner.svg`. README BANNER SLOT uncommented. |
| T3.2 | Demo asset (GIF or MP4) | Founder + Claude | ☐ | 3-5s clip showing prompt → HTML appears → slider → text edit. Embed in README. |
| T3.3 | Cross-platform spot-check | Founder | ☐ | Run the app once on macOS and once on Windows. Confirm install + dev:web + first generated HTML work without code changes. |
| T3.4 | Launch communications | Founder | ☐ | Short post (Twitter/X + LinkedIn + HN) explaining the operational-taste thesis + link. Claude can draft if asked. |

## Tier 4 — The cut itself

Only run when every checkbox above is ✓.

| # | Item | Owner | Status | DoD |
| --- | --- | --- | --- | --- |
| T4.1 | Create new repo on GitHub | Founder | ☐ | `design-factory` (or `df`) under THE-HYVE-COMPANY. Public. Licence set to Apache-2.0. Description + topics set per T1.3 specs. |
| T4.2 | Copy public surface from this repo | Claude | ☐ | Driven by `docs/PUBLIC-CUT-MANIFEST.md`. Single squash commit "initial public preview, see CHANGELOG.md". |
| T4.3 | Tag `v1.0.0-beta.1` release | Founder + Claude | ☐ | Release notes drafted from the (rewritten) CHANGELOG.md, marked pre-release. |
| T4.4 | Branch protection on public main | Founder | ☐ | Require 1 PR review, dismiss stale approvals, no force-push. Founder in bypass list. |
| T4.5 | Smoke + audit fresh-clone the public repo | Claude | ☐ | Clone the public repo into `/tmp`. Run `npm install`, `npx tsc --noEmit`, `npm test`, `npx vite build`, `npm run smoke:daemon`. All green. |
| T4.6 | Cross-walk PUBLIC-CUT-MANIFEST | Claude | ☐ | Confirm zero `_internal/`, `.aios/`, founder-named files, internal decision records, or HYVE-private docs in the cut. |
| T4.7 | Announce | Founder | ☐ | Push T3.4 communications. |

---

## What changed from the previous version of this doc

- Removed Tier 1 visibility-flip language. The private repo stays private.
- Removed the "3 cliques no GitHub" bottom rows from Tier 1. They re-appear in Tier 4 against the **new** public repo (topics, branch protection, etc.).
- License decision now sits in Tier 0 — Apache-2.0 canonical.
- Added Tier 0 PUBLIC-CUT-MANIFEST + GOVERNANCE/ROADMAP rows.
- Reframed the QA tier from "first-run UX audit" (already done) to the real gap: feature coverage matrix + smoke runbook + daemon smoke script.
- Moved cross-platform check from "blockers before announce" to Tier 3 — it doesn't block the cut, only the announce.
- Old Tier 2 — Already done in this session — section preserved at the bottom under "Past work" so the prior PRs (#195-#222) are still discoverable.

---

## What this doc deliberately does NOT track

- Day-to-day editor / UI iterations. Those land via their own PRs and live in the commit log.
- Internal decisions, founder feedback, exploratory notes. Those continue to live in this private repo and are excluded from the public cut by the manifest.
- Anything that requires a public audience to be useful. The public cut is the audience.

---

## Past work (preserved from the prior version of this doc)

Everything below this line landed before the reframe and is kept here
for traceability. None of it is a launch blocker any more — the
deliverables either feed Tier 0–T4 directly (e.g. the smoke test
informs T4.5) or already shipped to main.

### Already-shipped foundation (PRs #195-#222)

- ✓ README rewritten with the operational-taste thesis (EN canonical
  + PT translation, language-toggle badges).
- ✓ CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md, CHANGELOG.md present (CHANGELOG rewrite still pending — see T1.2).
- ✓ Issue templates (bug + feature) + PR template (Conventional Commits).
- ✓ Internal `/workspace/` paths scrubbed from runtime
  (`src/lib/turn-recorder.ts`, `apps/daemon/src/index.mjs`
  `/audio/transcribe` body, `.claude/CLAUDE.md` boot snippet).
- ✓ `"engines": { "node": ">=20" }` declared in `package.json`.
- ✓ `vite@7` major bump (PR #222) — `npm audit` now clean (was 2
  moderate vulns in esbuild via vite@5).
- ✓ `.aios/` confirmed `.gitignore`d with zero tracked files.
- ✓ 30 default rules shipped hyve-agnostic + bilingualised.
- ✓ Skill ZIP import unpacks full payload into `skills/<zip-folder>/`.
- ✓ Card shadow + dark-mode refinement passes.
- ✓ Settings modals adopted NewProject editorial chrome.
- ✓ Ship 10 public design systems + 9 starter skills + gitignore
  allowlist (PR #218).
- ✓ Taxonomy trimmed to 9 editorial Commands (PR #219).
- ✓ Slash dropup single-line layout (PR #220).
- ✓ `examples/` folder with three single-file HTML artifacts (PR #221).

### Dependency licence audit (run 2026-05-21)

Walked every `package.json` under `node_modules` and grepped for AGPL
/ LGPL / SSPL / GPL-2 / GPL-3 declarations.

**Result: zero copyleft hits across 300 packages.** Dep tree is
dominated by MIT, Apache-2.0, ISC, and BSD-3-Clause. Re-run the
audit before each `v*.0.0` tag and whenever a major dep is added:

```bash
find node_modules -maxdepth 2 -name package.json | while read f; do
  node -e "const p=require('./$f'); const l=p.license||p.licenses;
    if (l && /AGPL|LGPL|SSPL|GPL-?[23]/i.test(typeof l==='string'?l:JSON.stringify(l)))
    console.log(p.name+'@'+p.version+' -> '+JSON.stringify(l));"
done
```

### Smoke audit (run 2026-05-21)

Cloned `/tmp/df-smoke`: `npm install` clean on Node 22.22.2, `npx
tsc --noEmit` clean, `vitest` 914/914 pass, `vite build` succeeds
(only the chunk-size warning, not a regression).

### First-run UX audit (run 2026-05-21)

Source-level walk of HomeScreen, EditorScreen, Settings empty
states. No blockers. Three polish items logged for v0.2:

1. Templates tab empty state could carry one canonical example.
2. Skills import flow could link to a SKILL.md frontmatter
   one-pager so first-timers know the shape.
3. Provider status badges use English labels (`ready`,
   `auth-required`); could route through the existing i18n bridge.

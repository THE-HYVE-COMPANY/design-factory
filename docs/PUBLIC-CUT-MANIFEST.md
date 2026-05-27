# Public-cut manifest

This file is the **spec** for the eventual copy operation that
creates the public Design Factory repo. Until that operation runs,
this manifest is the single source of truth for which paths land in
the public repo and which ones stay private.

The public cut is **a one-time copy into a new repo**, not a git
filter-branch on this one. The new repo starts at a single squash
commit titled "initial public preview, see CHANGELOG.md". This
repo continues life as the private working copy.

---

## Ships (public surface)

These paths copy verbatim into the public repo.

### Code

| Path | Note |
| --- | --- |
| `src/` | React app. Verified clean of internal paths (PRs #202, #212). |
| `apps/daemon/` | Node bridge on `:1421`. Verified clean of internal paths. |
| `scripts/` | Dev launcher + helpers. `scripts/audit-full/` and private cut helpers are excluded — see "Stays private" below. |
| `tests/` | Unit + visual regression. |
| `index.html` | App entrypoint. |
| `vite.config.ts` | Build config. |
| `vitest.config.ts` | Test config. |
| `playwright.config.ts` | Visual regression config. |
| `tsconfig.json`, `tsconfig.*.json` | TS configs. |
| `package.json` | License field already on Apache-2.0 (PR #224). |
| `package-lock.json` | Resolved deps. |
| `public/` | Static app assets. |

### Content shipped with the app

| Path | Note |
| --- | --- |
| `design-systems/` | 10 curated DS examples shipped via allowlist (PR #218). The three HYVE-internal DS were removed. |
| `skills/` | 7 starter skills shipped via allowlist: `README.md`, each curated root `SKILL.md`, and only the explicitly referenced support files for those skills. Do **not** copy embedded upstream repos or hidden agent/tool folders. User installs land here but are gitignored. |
| `templates/` | NewProject presets. |
| `examples/` | 3 single-file HTML artifacts plus test fixtures required by public tests. |

### Public-facing docs

| Path | Note |
| --- | --- |
| `README.md` | PT-BR canonical (default), operational-taste thesis. |
| `README.en.md` | English translation. |
| `LICENSE` | Apache-2.0 (PR #224). |
| `NOTICE` | Trademark boundary (PR #224). |
| `CONTRIBUTING.md` | Dev setup + adapter pattern + quality gates. |
| `CODE_OF_CONDUCT.md` | Standard. |
| `SUPPORT.md` | Where to get help: docs, discussions, issues, security process. |
| `SECURITY.md` | Threat model + reporting. |
| `CHANGELOG.md` | Clean `1.0.0-beta.1` public preview entry. |
| `GOVERNANCE.md` | Public contributor governance, final-say, and brand boundary. |
| `AGENTS.md` | Universal agent contract entry point. |
| `GEMINI.md` | Gemini CLI adapter alias for the universal agent contract. |
| `docs/` | Public docs allowlist only: docs hub, quickstart, providers, architecture, direction-engine, migration-skills, feature coverage, smoke runbook, troubleshooting, readme assets. Internal launch plans, decisions, and cut manifests stay private. |
| `examples/README.md` | Index of the example files. |

### Infrastructure

| Path | Note |
| --- | --- |
| `.github/workflows/ci.yml` | Typecheck, tests, build, i18n audit, smoke gates, and Playwright visual regression. |
| `.github/ISSUE_TEMPLATE/` | Bug + feature templates. |
| `.github/pull_request_template.md` | Conventional Commits + checklist. |
| `.github/dependabot.yml` | Dependency update checks. |
| `.gitignore` | Already curated with allowlists (PR #218). |
| `.editorconfig`, `.prettierrc.json`, `.prettierignore` | Formatting/editor defaults. |
| `.husky/` if present | Pre-commit + pre-push hooks (project-level). |
| `.nvmrc` if present | Node version pin. |

---

## Stays private (does NOT ship)

These paths are intentionally excluded from the public cut.

### Internal working artefacts

| Path | Why |
| --- | --- |
| `.aios/` | Session handoffs, worktrees, research scratchpads, audit probes. Gitignored already; the new repo simply doesn't carry the directory. |
| `_internal/` | Anything under this name across the tree. Holds internal planning, audits, founder notes, and capture scripts. Untracked + gitignored so it can't reach the public repo. |
| `scripts/audit-full/` | Private probe/snapshot scripts that capture internal state. Not useful to external readers. |
| `projects/` | Per-user project work. Already gitignored. |
| `dist/` | Build output. Already gitignored. |
| `coverage/` | Test coverage output. Already gitignored. |
| `node_modules/` | Reproducible from `package-lock.json`. |
| `.tmp-*` | Any tmp files at root. |
| `.vercel/`, `.idea/`, `.vscode/` | IDE / deploy artefacts. |
| `scratch/` | Scratchpad if present. |
| `landing/` | HYVE marketing/waitlist landing page, wired to internal infra (`lab.hyve.company`). HYVE-specific, not part of the OSS app surface. |
| `PUBLIC_RELEASE_MANIFEST.md` | Superseded staging-era manifest. `docs/PUBLIC-CUT-MANIFEST.md` is the current private source of truth. |
| `_internal/scripts/public-cut-dry-run.mjs` | Private helper for building and auditing the one-time public cut. |
| `ROADMAP.md` | Private planning surface. The public preview should not publish roadmap promises before maintainer review. |

### Internal docs + decisions

| Path | Why |
| --- | --- |
| `docs/OPEN-SOURCE-CHECKLIST.md` | **The plan to cut the repo doesn't ship with the cut.** Stays in the private repo as the historical artefact. |
| `docs/PUBLIC-CUT-MANIFEST.md` | This file. Same reason: the plan to cut doesn't ship with the cut. |
| `docs/decisions/` | Internal decision records (the v1 beta decisions doc, the Apache-2.0 decision, the older MIT note). Decisions that became canon ship inside `LICENSE` / `NOTICE` / README / CHANGELOG; the decision-record format itself stays private. |
| `docs/research/` if present | Founder-only research and stress-matrix outputs. |
| `docs/founder-*` | Anything named founder-* by convention. |
| `docs/audit-*` | Periodic internal audits. |
| `docs/*-2026-05-*.md` | Most dated docs are internal session output. Audit individually; ship only if the doc is general-purpose (e.g. a quickstart updated on that date is fine — a session report is not). |
| Internal launch / sprint plans | Whatever lands under `docs/launch/`, `docs/sprint/`, etc. |

### Claude / agent infrastructure

| Path | Why |
| --- | --- |
| `.claude/` | Claude Code agent configuration. Internal-only. The new repo gets a minimal `.claude/CLAUDE.md` adapter (rewritten clean) if it gets one at all — current adapter still mentions internal paths. |
| `.aios-core/` if present | AIOS framework files. Not part of this project's public surface. |
| `CLAUDE.md` at root (if present) | Same reason. |

### Per-founder configuration

| Path | Why |
| --- | --- |
| `~/.config/design-factory/` (out of repo, but worth noting) | Provider tokens. Never enters the repo by construction. |

---

## Decision points the founder still has to flag at copy time

1. **`.claude/CLAUDE.md`** — adapter file. Either ship a rewritten clean version (~50 lines for the public flow) or omit entirely. Founder decides at copy time.
2. **Public repo name** — `design-factory` is preferred; use `df` only if the target name is unavailable.
3. **Announcement timing** — Tier 3 banner/demo/cross-platform checks can happen before or immediately after the public repo is created, depending on launch appetite.

---

## How the cut runs

When every Tier 0 + Tier 1 + Tier 2 row in `OPEN-SOURCE-CHECKLIST.md`
is ✓:

1. Founder creates the new public repo on GitHub (`design-factory`
   or `df` under THE-HYVE-COMPANY). Licence: Apache-2.0.
   Description: "A multi-provider AI design workspace that turns
   prompts into editable HTML artifacts." Topics per `T1.3`.
2. Clone the new repo into `/tmp/df-public`.
3. From this repo's `main`, walk this manifest top-to-bottom and
   `rsync --exclude` everything in the "Stays private" section into
   `/tmp/df-public`.
4. Run the smoke verification (`T4.5`): `npm install`, `npx tsc
   --noEmit`, `npm test`, `npx vite build`, `npm run smoke:daemon`.
5. Cross-walk the manifest one more time (`T4.6`) — confirm zero
   `_internal/`, `.aios/`, `OPEN-SOURCE-CHECKLIST.md`, decision
   records, or founder-named files in `/tmp/df-public`.
6. Commit + push: one squash commit titled "initial public preview,
   see CHANGELOG.md".
7. Tag `v1.0.0-beta.1` (Tier 4 `T4.3`).
8. Announce per Tier 3 `T3.4`.

After the cut, this manifest stops being a spec and becomes a
historical record of what was carried across.

---

## Updating this manifest

Anyone adding a top-level path to the private repo should also
update this manifest. New paths default to **private**; promoting
a path to public requires an explicit row in "Ships" + a one-line
rationale.

The manifest is the authoritative record. If a contributor reads
the manifest and the directory tree together and they disagree, the
manifest wins — track down the drift and reconcile.

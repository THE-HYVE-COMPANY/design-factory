# Feature coverage matrix

What ships, where it lives, and how well it's tested today. Built
from the 2026-05-21 audit (60 surfaces enumerated against
`tests/`, `src/**/*.test.ts*`, `apps/daemon/**/*.test.mjs`,
`tests/visual/`).

Cover stat as of writing: **50 source test files + 13 daemon
integration / unit files + 1 visual spec = 928/928 vitest pass +
1 Playwright spec**. The matrix below names every shipped feature
and ranks coverage on a four-step ladder:

| Symbol | Meaning |
| --- | --- |
| ✓✓✓ | Strong: unit + integration, or runtime path tested with real inputs |
| ✓✓ | Solid: at least one unit test exercises the hot path |
| ✓ | Touched: covered indirectly via a related test |
| ✗ | Gap: no automated coverage today |

The four columns flag the type of coverage we have. Multiple ticks
in different columns is normal — a feature can have Unit + Integration
but no Visual.

---

## Projects + persistence (8 features)

| # | Feature | Unit | Integration | Visual | Manual | Notes |
| --- | --- | :-: | :-: | :-: | :-: | --- |
| 1 | Project creation (slugify + mkdir) | ✓✓ | ✓ | — | manual smoke | daemon `slug.test.mjs` |
| 2 | Project list + DB reconcile | — | ✗ | — | manual smoke | gap |
| 3 | Project rename | — | ✗ | — | manual smoke | gap |
| 4 | Project duplicate (copy-dir) | — | ✗ | — | manual smoke | gap |
| 5 | Project delete (rm -rf scoped) | — | ✗ | — | manual smoke | gap |
| 6 | Project pagination (load more) | — | — | — | manual smoke | UX-only, low risk |
| 7 | `.df/meta.json` round-trip | ✓✓ | — | — | — | covered via `chat-persist.test.ts` adjacents |
| 8 | Version snapshots (save / restore) | ✓✓ | ✓ | — | manual smoke | daemon `versions-fs.test.mjs` |

## Chat + turn pipeline (8 features)

| # | Feature | Unit | Integration | Visual | Manual | Notes |
| --- | --- | :-: | :-: | :-: | :-: | --- |
| 9 | Streaming turn (sendUserTurn) | ✓✓✓ | ✓✓ | — | manual smoke | `turn-pipeline.test.ts`, `stream-lifecycle.test.ts` |
| 10 | Chat history persist + recover | ✓✓✓ | ✓✓ | — | — | `chat-persist.test.ts`, `chat-recovery.test.ts`, `chat-recovery-sync.test.ts`, `chat-journal-gate.test.ts` |
| 11 | Tool events (NormalizedToolEvent) | ✓✓ | — | ✓ | — | `tool-events.test.ts`, `ToolEventBubble.test.tsx` |
| 12 | Chat stats footer (model, tokens, elapsed) | — | — | — | manual smoke | UI-only gap |
| 13 | Processing banner (above input) | — | — | — | manual smoke | UI-only gap |
| 14 | Cancel turn (Esc / STOP) | ✓ | ✓✓ | — | manual smoke | daemon `abort-stream.test.mjs` |
| 15 | Markdown rendering (highlight + DOMPurify) | ✓ | — | — | — | sanitizer covered via `chat-sanitizer.test.ts` |
| 16 | Attachment chips (paste + drag) | ✓✓ | — | — | manual smoke | `AttachmentChips.test.tsx`, `ChatMessage.attachment.test.tsx`, `chat-attachment-schema.test.ts` |

## Canvas + preview (6 features)

| # | Feature | Unit | Integration | Visual | Manual | Notes |
| --- | --- | :-: | :-: | :-: | :-: | --- |
| 17 | Iframe sandbox (default permissive) | ✓ | — | ✓ | — | `PreviewSandboxBadge.test.tsx`, atoms spec |
| 18 | Strict sandbox opt-in | — | — | — | manual smoke | wiring confirmed (PR #212) |
| 19 | Persistent canvas (DOM patch in place) | ✓✓ | ✓ | — | manual smoke | `patch-invoker.test.ts`, `artifact-processor.test.ts` |
| 20 | Artifact writer (static check + retry) | ✓✓✓ | ✓ | — | — | daemon `artifact-writer.test.mjs`, `static-p0.test.ts`, `static-p0.test.mjs`, `runtime-p0.test.ts` |
| 21 | Element overlay (hit-test) | ✓✓ | — | — | — | `element-overlay.test.ts`, `ElementInspectorPanel.test.tsx` |
| 22 | Viewport fit (responsive scaling) | ✓✓ | — | — | — | `viewport-fit.test.ts` |

## Providers (10 adapters + picker)

| # | Feature | Unit | Integration | Visual | Manual | Notes |
| --- | --- | :-: | :-: | :-: | :-: | --- |
| 23 | Provider bridge factory | ✓✓ | ✓ | — | — | `provider-bridge-factory.test.ts` |
| 24 | Provider sessions (token storage) | ✓✓ | — | — | — | `provider-sessions.test.ts` |
| 25 | Provider contract (each adapter) | — | ✓✓ | — | — | daemon `providers/contract.test.mjs` |
| 26 | `/providers/status` endpoint | — | ✓ | — | — | daemon `integration/providers-endpoint.test.mjs` |
| 27 | Picker UI + readiness badges | — | — | — | manual smoke | UI-only gap |
| 28 | Real provider stream (any adapter) | ✗ | ✗ | — | manual smoke | needs API keys / Ollama; out of CI scope |
| 29 | Stream lifecycle (heartbeat + timeout) | ✓✓ | ✓ | — | — | `stream-lifecycle.test.ts`, daemon `sse-heartbeat.test.mjs` |
| 30 | Provider model switching | — | — | — | manual smoke | UX-only gap |

## Slash + commands (5 features)

| # | Feature | Unit | Integration | Visual | Manual | Notes |
| --- | --- | :-: | :-: | :-: | :-: | --- |
| 31 | Slash dropup (find + trigger) | ✓✓ | — | — | manual smoke | `slash-data.test.ts`, `EditorScreen.e2e.test.tsx` |
| 32 | 9 editorial Commands | ✓ | — | — | manual smoke | descriptions covered by canonicalization test |
| 33 | Skills registry walk | ✓✓ | ✓ | — | — | daemon `skills-walker.test.mjs` |
| 34 | Slash routing (verb vs skill vs passthrough) | ✓✓ | ✓ | — | manual smoke | `slash-data.test.ts`, `EditorScreen.e2e.test.tsx` |
| 35 | Canonicalization (taxonomy load) | ✓✓✓ | — | — | — | `defaults-canonicalization.test.ts` |

## Design systems + skills (5 features)

| # | Feature | Unit | Integration | Visual | Manual | Notes |
| --- | --- | :-: | :-: | :-: | :-: | --- |
| 36 | DS attach mid-project | — | — | — | manual smoke | UI gap |
| 37 | DS import (paste / upload / GitHub / folder) | ✓✓ | — | — | manual smoke | `ds-import.test.ts` |
| 38 | Skill install / update / delete | ✗ | ✓ | — | manual smoke | daemon path only |
| 39 | Skill ZIP import (full payload) | ✓✓ | ✓✓ | — | manual smoke | `skill-zip-import.test.ts`, daemon round-trip integration |
| 40 | Skill markdown parsing | — | — | — | manual smoke | gap |

## Editor surfaces (8 features)

| # | Feature | Unit | Integration | Visual | Manual | Notes |
| --- | --- | :-: | :-: | :-: | :-: | --- |
| 41 | `/tweaks` panel (CSS vars → sliders) | ✓✓ | ✓ | — | manual smoke | `tweaks-bridge.test.ts` |
| 42 | Inline text edit | ✓✓ | ✓ | — | manual smoke | `inline-edit-bridge.test.ts`, `InlineEditPanel.test.tsx` |
| 43 | `/comment` mode | — | — | — | manual smoke | gap |
| 44 | `/export` menu | — | — | — | manual smoke | gap |
| 45 | `/present` fullscreen | — | — | — | manual smoke | gap |
| 46 | `/terminal` (xterm.js) | — | — | — | manual smoke | gap |
| 47 | File manager (gallery view) | ✗ | ✓ | — | manual smoke | daemon `project-files.test.mjs` |
| 48 | EditorScreen end-to-end | ✓ | ✓ | — | manual smoke | `EditorScreen.e2e.test.tsx` mounts screen, slash menu, first prompt dispatch |

## Settings + taxonomies (8 features)

| # | Feature | Unit | Integration | Visual | Manual | Notes |
| --- | --- | :-: | :-: | :-: | :-: | --- |
| 49 | Rules taxonomy (30 bilingual defaults) | ✓✓✓ | — | — | — | `rules-taxonomy.test.ts` |
| 50 | Format taxonomy + canvas presets | ✓✓✓ | — | — | — | `format-taxonomy.test.ts`, `canvas-presets.test.ts` |
| 51 | Taste dials (6 sliders) | — | — | — | manual smoke | data is static |
| 52 | Commands taxonomy (9 verbs) | ✓✓ | — | — | — | covered via `defaults-canonicalization.test.ts` |
| 53 | Direction data | ✓✓ | — | — | — | `direction-data.test.ts` |
| 54 | Theme editor (token overrides) | — | — | — | manual smoke | gap |
| 55 | Settings nav + sections | — | — | — | manual smoke | UI-only |
| 56 | bilingual i18n (PT + EN) | ✓ | — | — | manual smoke | spot-checked, no coverage assertion |

## Cross-cutting (4 features)

| # | Feature | Unit | Integration | Visual | Manual | Notes |
| --- | --- | :-: | :-: | :-: | :-: | --- |
| 57 | Reduced-motion respect | — | — | — | manual smoke | examples honour it; app spot-checked |
| 58 | ETag cached fs reads | ✓ | — | — | — | covered indirectly via daemon fs tests |
| 59 | Schemas at every boundary (Zod) | ✓✓✓ | — | — | — | `schemas.test.ts`, `migrations.test.ts`, `process-artifacts.test.ts` |
| 60 | Origin guard (cross-origin posts) | ✓✓ | — | — | — | `origin-guard.test.ts` |

---

## Critical gaps (priority order for the launch plan)

Five surfaces have **zero automated coverage** and have shipped
real bugs this cycle. Three of the five **block public announcement**
of `v1.0.0-beta.1`; the last two are high-priority post-beta
follow-ups.

### Block public announcement (must land before v1.0.0-beta.1)

1. **Slash dropup + routing (features 31, 34).** Covered by
   `src/components/slash-data.test.ts`. Fixed 4× in the
   last week (PRs #213, #214, #215, #217, #220). The test is now
   the single source of truth over `findMatches` + `triggerAtCursor`,
   exhausting initial / prefix / substring / hidden / collision paths.
2. **DS import (feature 37).** Covered by
   `src/lib/ds-import.test.ts`. Four entrypoints (paste / upload /
   GitHub URL / folder scan) are exercised against the
   `examples/fixtures/design-system/design.md` fixture.
3. **Skill ZIP import (feature 39).** Covered by
   `src/lib/skill-zip-import.test.ts` and
   `apps/daemon/src/skill-zip-import.integration.test.mjs`. The
   integration test feeds
   `examples/fixtures/skills/minimal-skill.zip` through
   `installSkill({ extraFiles, forceSlug })` and asserts the
   folder layout includes `SKILL.md` + `references/style.md`
   verbatim.

### High-priority post-beta follow-ups

4. **EditorScreen E2E (feature 48).** Covered by
   `src/screens/EditorScreen.e2e.test.tsx`. The test mounts the
   product screen with mocked boundaries, renders the chat composer
   and slash menu, dispatches a first prompt, and verifies persistence
   plus provider handoff.
5. **Real provider stream (feature 28).** Mocks today, never a
   real call. Add a CI lane gated on a secret (Ollama local by
   default; CLI providers via env-gated CI lane) that exercises
   the SSE protocol and message-shape contract.

The smoke runbook at `docs/SMOKE-RUNBOOK.md` covers all five
**manually**, and the daemon smoke script
(`npm run smoke:daemon`) catches a subset automatically. T2.5 is
the gap toward "first contributor lands a PR and CI gates it".

---

## How to use this matrix

- When you add a feature, add a row here. Default the coverage
  columns to `✗` and call out launch-critical gaps in this file.
- When you add a test that fills a gap, flip the relevant cell
  (`✗` → `✓✓` or higher) and adjust the "critical gaps" list at
  the bottom.
- This file is part of the public surface. Keep it readable as an
  honest, current snapshot rather than aspirational marketing.

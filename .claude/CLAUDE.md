# DesignFactory — Claude Code adapter

This file is loaded by **two kinds of agent** with the same CWD:

- **Dev Agent** — a human is editing DesignFactory's own source. Read
  this whole file (architecture map, bridge endpoints, commits, red
  flags). Tools: Write/Edit/Bash/Read/Glob/Grep/AskUserQuestion.
- **Project Agent** — the running app spawned you via `claude --prompt`
  to build/edit the user's HTML in `projects/{slug}/`. **Read
  [`../docs/agent-contract.md`](../docs/agent-contract.md) first** — it
  is the canonical contract for what goes on disk vs in chat. Then come
  back here for harness-specific notes (§Harness gotchas below).

A Dev Agent's change to `src/runtime/prompt-invoker.ts` becomes the
system prompt injected into the Project Agent on the next user turn.
The two loops stay disciplined only if both obey the contract.

---

## Canonical contract

**[`docs/agent-contract.md`](../docs/agent-contract.md)** is the source of
truth for ALL providers (Claude, Codex, Gemini, Cursor, Aider, etc.) on:

- Project workspace layout (`projects/{slug}/`)
- Output rules (file gets code, chat gets prose, never mixed)
- Surgical-edit-first discipline
- The `::question` inline protocol
- Language contract (match the user's language, don't translate copy)
- Anti-patterns

Read it once. The rest of this file is Claude-Code-specific.

---

## Harness gotchas (Project Agent on `claude --prompt`)

You're running via Claude CLI in --prompt mode, NOT inside the full
Claude Code harness. These tools error on call — never use them:

- `AskUserQuestion`
- `ToolSearch`

For decisions with discrete options use the `::question` inline
protocol from the contract.

Tools you DO have: `Read`, `Write`, `Edit`, `Bash` (scoped to workspace
root), `Glob`, `Grep`. Skills like `/tweaks` are expanded by the app
before you see the prompt — you get a system-prompt update, not a tool
call.

---

## Canonical paths (Dev Agent — know these cold)

Everything the app writes or reads lives in one of these slots. The
bridge anchors all of them at the **repo root** (resolved via
`git rev-parse --git-common-dir` so worktrees still land outputs at the
top-level checkout).

| Path | Owner | Purpose | Tracked? |
|---|---|---|---|
| `src/` | code | React app (screens, components, hooks, lib) | ✓ |
| `apps/daemon/src/index.mjs` | code | HTTP bridge daemon (`@df/daemon`) on `:1421` | ✓ |
| `docs/agent-contract.md` | docs | Canonical agent contract (all providers) | ✓ |
| `docs/` | docs | Reviews, briefings, ux-audit | ✓ |
| `projects/{slug}/{slug}.html` | runtime | User HTML per project | gitignored |
| `projects/{slug}/.df/meta.json` | runtime | Per-project metadata | gitignored |
| `projects/{slug}/.df/chat/{threadId}.jsonl` | runtime | Per-thread chat log | gitignored |
| `projects/{slug}/.df/versions/{vid}.json` | runtime | Saved version snapshots | gitignored |
| `design-systems/{slug}/design.md` | runtime | DS markdown per slug | gitignored |
| `~/.config/design-factory/config.json` | runtime | Cross-project user prefs | (outside repo) |
| `.aios/handoffs/` | runtime | Local session handoffs | gitignored |

**Path rules in code:**

1. Never write a literal `~/...` string. Resolve via
   `fetchWorkspaceInfo()` (client) or `GET /fs/workspace-info` (bridge).
2. For DS outputs use `designSystemsDir(slug)` / `POST /fs/design-systems-dir`
   — never write into `$HOME/.design-factory-cache/git/...` (ephemeral).
3. Claude CLI auth lives at `~/.claude/`, which DF does not manage. DF
   skills live in `<repoRoot>/skills/` (canonical); the legacy
   path `<repoRoot>/.claude/skills/` is still read for backward-compat
   but new skills only land in `/skills/`. See
   [`../docs/migration-skills.md`](../docs/migration-skills.md).

---

## App flow (one paragraph)

Home (`src/screens/HomeScreen.tsx`) → tabs for Projects / Templates /
Design Systems / Directions / Skills → Create project → mkdir `projects/{slug}/` →
navigate to `/projects/{id}` → Editor (`src/screens/EditorScreen.tsx`,
chat left, iframe right) → each user message spawns the configured
provider through the bridge and streams SSE back → tool calls render as
rich blocks in chat → writes to `projects/{slug}/{slug}.html` refresh
the iframe from disk.

---

## The bridge (`apps/daemon/src/index.mjs`, port `:1421`)

Filesystem ops, provider streams, GitHub flows, audio transcription.

| Method + path | What it does |
|---|---|
| `POST /claude/stream` `/codex/stream` `/gemini/stream` `/ollama/stream` `/openrouter/stream` `/opencode/stream` `/anthropic/stream` | SSE provider streams. Events: `text`, `meta`, `usage`, `tool_call`, `tool_result`, `session`, `result`, `done`, `error`, `log`, `auth_required`. |
| `POST /*/once` | One-shot completion per provider. |
| `POST /fs/write` · `GET /fs/read?path=` · `POST /fs/list` · `POST /fs/mkdir` · `POST /fs/copy-dir` · `POST /fs/move-dir` | FS ops. Throws loud on failure. |
| `GET /fs/workspace-info` | `{ repoRoot, home, projectsDir, designSystemsDir }`. |
| `POST /fs/design-systems-dir { slug }` | mkdir-p `<repoRoot>/design-systems/<slug>/`. |
| `GET /fs/list-projects` | Scans `<repoRoot>/projects/*` → list. |
| `POST /fs/remove-project { slug }` | `rm -rf` of `<repoRoot>/projects/<slug>/`. |
| `GET\|POST /fs/project-meta` | Read/write `.df/meta.json`. |
| `GET\|POST /fs/chat-{read,append}` | Read/append per-thread `.df/chat/{threadId}.jsonl`. |
| `GET\|POST /config/read,write` | `~/.config/design-factory/config.json` user prefs. |
| `GET /fs/list-design-systems` | Scans `design-systems/*/design.md` (yaml frontmatter for name). |
| `POST /audio/transcribe` | Forwards audio to Groq Whisper. Needs `GROQ_API_KEY`. |
| `POST /git/shallow-clone` | Clones into `$HOME/.design-factory-cache/git/...` (ephemeral). |
| `GET /projects/:slug/zip` | Streams a `.zip` of the project folder. |
| `GET\|POST\|DELETE /projects/:slug/versions[/:vid]` | Filesystem-backed version snapshots in `.df/versions/`. |

**Bridge contract:** fail loud (non-2xx + `{ error }`); resolve `~`
explicitly with `process.env.HOME`; anchor outputs at repo root via
`git rev-parse --git-common-dir`.

---

## Top-level architecture map

| Path | What lives there |
|---|---|
| `src/App.tsx` | Router root. HashRouter + route wrappers. |
| `src/main.tsx` | React mount + `installDiagnostics()` + `<ErrorBoundary>`. |
| `src/screens/` | Home, Editor, Settings, DsPreview, Dev. Self-contained — props composition. |
| `src/components/` | Atoms + composites (DsSetupModal, DiagnosticsDrawer, etc.). |
| `src/hooks/` | `useProjects`, `useClaude`, `useSkillRegistry`, `useDebugLog`. |
| `src/lib/claude-bridge.ts` | UI ↔ environment. Every fs/db/spawn/transcribe call. |
| `src/lib/diagnostics.ts` | Ring buffer + event capture (console/window/df-dev-log/[ds]/[react]). |
| `src/lib/ds-google.ts` | Parses `design.md` into tokens. |
| `src/providers/` | Provider adapters + registry + types. |
| `src/runtime/` | `cli-spawner.ts`, `ds-invoker.ts`, `prompt-invoker.ts`, `builtin-prompts.ts`, turn pipeline. |
| `src/styles/` | `tokens.css` + `components.css` + `global.css`. |

Routes (HashRouter): `/`, `/templates`, `/design-systems`, `/directions`,
`/skills`, `/projects/:id`, `/ds/:slug`, `/settings`, `/settings/:section`.
Dev-only routes (registered behind `import.meta.env.DEV`, tree-shaken from
the public build): `/dev`, `/showcase`, `/skeu`, `/shaders`, and the
`/lab` · `/regions` · `/np-*` · `/np-hub` new-project experiments.

---

## Design system (the app's own look)

- Tokens in `src/styles/tokens.css`. Warm green text on warm olive
  layers. 5-tier layer system: `sunken < base < section < raised < elevated`.
- Fonts: Geist + Geist Mono. No Inter, no JetBrains Mono, no Fraunces.
- Focus ring: `rgba(220, 234, 208, 0.55)` (warm green). Not cool blue.
- Spacing: `4 / 8 / 14 / 18 / 24 / 30 / 40 / 52 / 68 / 88 / 112`.
- Radii top out at 14px.
- Type base 17px. Scale: `11 / 12 / 15 / 17 / 19 / 23 / 28 / 36 / 52 / 68`.
- Every color from a `--df-*` token. No hardcoded hex (a hook blocks at 3+).
- Motion: 4 durations × 6 curves (`--df-motion-*`, `--df-ease-*`).

---

## Conventions

- **TypeScript** — no `any`. `unknown` + type guards at boundaries.
- **Imports** — absolute (`@/components/...`). Never relative.
- **React** — screens / components / hooks split. No global store. Props composition.
- **CSS** — class-based selectors. Inline only for dynamic values.
- **Modals** — `var(--df-surface-overlay)` + `backdrop-filter: blur(14px) saturate(1.02)`.
- **Errors** — `try { ... } catch (e) { console.error("[scope] what broke", e); setError(String(e)); }`.
- **Paths** — never literal `~`. Resolve via the bridge.

---

## Development standards (read once, internalize)

The non-negotiables every change has to obey:

1. **Schemas at every boundary.** Filesystem / bridge / db / process
   crossings have a Zod schema in `src/lib/schemas.ts`. Read with
   `safeRead(...)`. Write with `safeWriteOrThrow(...)`.

2. **No silent `.catch(() => {})`.** Use `traceOr` / `trace` /
   `surfaceError` from `src/lib/error-surface.ts`. The mounted
   `<ErrorToastDock>` makes silent failures visible. NOT to surface:
   errors that already have UI feedback (chat error bubbles, modal
   alerts) — don't double-notify.

3. **Tests for every critical flow.** `npm run test` (vitest +
   happy-dom). Mandatory coverage: `src/lib/schemas.ts`,
   `src/data/direction-data.ts`, `src/runtime/scene-manifest.ts`,
   any prompt builder / output parser, any new helper in `src/lib/`.

4. **Edge cases tested before declaring success.** Empty / single /
   many / error / mid-stream / narrow viewport / light+dark theme /
   long text. "Looks fine on my screen" is NOT a green light.

5. **Per-project state is per-project.** Always include `projectId` in
   the key. Cross-project caches are why old projects lost chat history.

6. **The "100% checklist" before claiming done:**
   - `npx tsc --noEmit` clean
   - `npm run test` clean (with NEW tests for the new logic)
   - `npx vite build` clean
   - Manual exercise (edge cases above)
   - Console clean (no `[error]` toasts)
   - New boundary has a schema
   - Every new `.catch()` either uses `surfaceError` or comments why silent

7. **Process discipline.** "Go yolo" doesn't skip standards. Bug
   reports aren't fixed until a test would catch them. Surface, don't
   swallow. "Tested and works" — not "should work".

---

## Commits & branches

Conventional Commits + `Agent-Id:` trailer.

```bash
git commit -m "feat(home): add tag filter to skills tab" \
  --trailer "Agent-Id: dev"
```

Branches: `feat/*`, `fix/*`, `chore/*`, `refactor/*`, `test/*`, `docs/*`.
Hook rejects invalid names.

**Only `@devops` pushes.** Everyone else: commit locally, then
`@devops *push` (or `AIOS_PUSH_AUTHORITY=devops` if already in devops).

---

## Red flags / do-not

- No `git push` (devops territory — hook blocks).
- No hardcoded hex in `.tsx`/`.css`. 3+ occurrences blocks commit.
- No `rgba(0,0,0,0.x)` backdrops. Use `var(--df-surface-overlay)` +
  backdrop-filter.
- No relative imports. `@/...` always.
- No `any`.
- No silent error swallow. Use `surfaceError(e, "context")`.
- No new boundary without a schema.
- No new logic without a test.
- No literal `~` in paths. Resolve via the bridge.
- No writes into `$HOME/.design-factory-cache/...` (gets wiped).
- No `kill $(lsof -t ...)` pipe form (hook blocks).

---

## Before you finish

1. `npx tsc --noEmit` — clean.
2. `npm run test` — clean. New logic has new tests.
3. `npx vite build` — clean.
4. Exercise the change in the dev server at `http://localhost:1420`.
   Walk through edge cases. Touch chat / iframe / DS / direction flows
   if you changed them.
5. Check the Inspector (statusbar footer or ⌘⇧D) for `[error]` entries.
   Resolve or document.
6. Boundary check: new fs/bridge/db read or write has a schema?
7. Catch check: every new `.catch()` either uses `surfaceError` or has a
   one-line comment explaining the silence.

---

## Running locally

```bash
# Export the provider keys your turn will use. None of them are required
# to start the app — the picker greys out adapters that lack creds. The
# bridge reads from `process.env`, so any export style works (direnv,
# `.envrc`, plain `export` in your shell, etc.).
export ANTHROPIC_API_KEY=...
export GEMINI_API_KEY=...
export OPENROUTER_API_KEY=...
export GROQ_API_KEY=...     # optional, for /audio/transcribe

npm run dev:web              # bridge :1421 + vite :1420
```

Open `http://localhost:1420`.

---

*Claude Code adapter. Canonical contract:
[`docs/agent-contract.md`](../docs/agent-contract.md). Edit me when the
architecture shifts — don't let this file drift.*

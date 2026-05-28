# Architecture

A conceptual map of how Design Factory is wired. For exact endpoints
see [docs/providers.md](providers.md); for the contract every agent
honours see [docs/agent-contract.md](agent-contract.md).

---

## Three pieces

```
Browser (Vite)        ←  HTTP / SSE  →  Daemon (Node)        ←  spawn  →  Provider CLIs / APIs
:1420                                    :1421                                (Claude Code, Codex,
                                                                              Gemini, Ollama, ...)
                                            │
                                            └── filesystem (projects/, design-systems/, ~/.config/design-factory/)
```

### Browser — React + Vite web app

A single-page React 18 + TypeScript app served from
`http://localhost:1420` by Vite during development. Routes are
hash-based (`#/projects/:id`, `#/settings`, etc.) so the app works
without a server-side router. The chat, the iframe preview, and the
settings/picker UIs all live here.

The browser never talks to a model directly. Every prompt goes through
the daemon over HTTP/SSE, and every file read or write goes through
the daemon's `/fs/*` endpoints. This is by design — provider keys and
filesystem access stay on the host process.

### Daemon — Node HTTP/SSE server

`apps/daemon/src/index.mjs` exposes a small HTTP server on
`localhost:1421`:

- `POST /<provider>/stream` and `POST /<provider>/once` — generic
  per-provider entrypoints. The dispatcher auto-routes to whichever
  adapter declares that id.
- `POST /fs/*` and `GET /fs/*` — filesystem operations scoped under
  `projects/<slug>/`.
- `GET /providers` — the registry, with capability flags and runtime
  availability.
- `POST /audio/transcribe` — Groq Whisper bridge for dictation.

Every endpoint fails loud (non-2xx + `{ error }`). There is no auth
layer — the daemon binds to `localhost` only and trusts whatever
process is on the same machine.

### Provider adapters

Each provider has two halves:

- **Daemon adapter** (`apps/daemon/src/providers/<id>.mjs`) — owns
  spawn / HTTP fetch, the SSE wire shape, and the close-path
  contract.
- **Frontend adapter** (`src/providers/<id>.ts`) — thin client that
  posts to the daemon's `/<id>/stream` and `/<id>/once` endpoints.

Both halves share a typed contract. Capabilities are declarative on
the adapter — the runtime and UI read those flags to decide what to
expose. New providers register themselves via the two registries
(`apps/daemon/src/providers/index.mjs` and
`src/providers/registry.ts`). No edits to the dispatch hot path are
needed.

See [docs/providers.md](providers.md) for the full list and
[CONTRIBUTING.md](../CONTRIBUTING.md) for the adapter pattern.

---

## Output channels

The runtime reads each provider's `capabilities.fileWrite` to decide
how the agent's output reaches disk:

- `tool` — provider chains native Write/Edit calls; the runtime
  observes the tool-event stream and writes nothing extra.
- `artifact` — provider streams text and ends with one `<artifact>`
  block; the runtime parses it and writes via `/fs/write/artifact`.

There are exactly two channels. The capability gate determines which
one is active for a given turn.

The full contract (file vs chat, surgical edits, language matching,
the `::question` inline protocol) lives in
[docs/agent-contract.md](agent-contract.md).

---

## Filesystem boundary

The daemon scopes every write under `projects/<slug>/` via
`assertPathInScope`. Path traversal attempts are rejected with
`PATH_INVALID`. The artifact-writer test suite exercises these paths
directly.

For artifact-channel writes, the daemon additionally validates content
via `validateArtifactStaticP0Minimal` (byte floor + HTML-shape sanity
checks) before any disk write. Empty completions and malformed
artifacts surface as red error bubbles in chat — they never silently
land on disk.

### Project layout on disk

```
projects/{slug}/
├── {slug}.html          ← the entry file the iframe renders (PRIMARY_FILE)
├── tab-N-foo.html       ← optional secondary tabs
├── assets/              ← images, fonts, anything the HTML imports
└── .df/                 ← app-managed metadata
    ├── meta.json
    ├── chat.jsonl
    └── versions/{vid}.json
```

The repo's `projects/` and `design-systems/` directories are
gitignored — your work is yours.

---

## Iframe model

The preview iframe runs project HTML in a sandbox. The daemon never
injects scripts into the iframe; the model does, and the user sees
exactly what the model wrote.

Two sandbox modes:

- **Permissive** (`allow-scripts allow-same-origin`) — the default.
  Required for inline text edit, comment-mode, in-place DOM patching,
  and the animated-scene transport bridge.
- **Strict** (`allow-scripts` only) — opt-in via `?strictSandbox=1`
  or `DF_STRICT_SANDBOX=1`. Disables the features above.

The tweaks-bridge and element-overlay paths are postMessage-only and
forward-compatible with strict sandbox. See
[SECURITY.md](../SECURITY.md) for the full threat model.

---

## Turn pipeline

Each user message goes through a small three-stage pipeline
(`src/runtime/turn-pipeline.ts`):

1. **Prepare** — resolve provider, capabilities, model, system prompt,
   and user prompt (with attachments). Pure, no I/O beyond the
   registry lookup.
2. **Stream** — call the provider, accumulate tokens and tool events,
   forward sticky session ids for providers that support resume.
   Side-channel callbacks fire live so the UI can stream feedback.
3. **Finalize** — capability-driven artifact dispatch. Tool-driven
   providers no-op here (they wrote bytes via native tool calls);
   artifact-driven providers delegate to the parser and the
   artifact-writer endpoint.

The pipeline is intentionally minimal. There is no layered identity /
project / artifact / conversation handoff, no sticky multi-file
canonical state, and no auto-fix loop blocking the stream. Providers
receive a system prompt with the project preamble, optional output
contract, the user prompt with attachments inline, and conversation
history forwarded by the wrapper. That's all.

---

## Security model

Design Factory is a single-user app with a localhost daemon. The trust
boundary is the machine running the repo. The daemon binds to
`localhost` only and trusts whatever process is on the same host.

The relevant adversaries are:

- An HTML payload generated by the LLM (or pasted by the user) that
  tries to escalate from the iframe to the daemon to the filesystem.
- A crafted prompt that tries to trick the daemon into writing
  outside the project scope.

Mitigations:

- Iframe sandbox (permissive default, strict opt-in).
- `assertPathInScope` on every filesystem write.
- Artifact validation before disk write.
- Provider tokens stored at `~/.config/design-factory/` with
  `chmod 600`. Env vars override files. Keys never enter the browser.

See [SECURITY.md](../SECURITY.md) for the full threat model and the
disclosure process.

---

## Skills registry

The universal skill registry lives at `<repoRoot>/skills/`. Every
provider — CLI-based and artifact-driven — consumes the same set. The
runtime expands a skill's body into the system prompt at turn-build
time; the provider never sees the filesystem path.

A legacy path (`<repoRoot>/.claude/skills/`) is still walked
read-only; the canonical path wins on collision.

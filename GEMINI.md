# DesignFactory — Gemini CLI adapter

Gemini CLI loads `GEMINI.md` from the project root. This file is a thin
adapter — the canonical agent contract lives in
**[docs/agent-contract.md](docs/agent-contract.md)**.

Read that contract first. It defines:

- The project workspace layout (`projects/{slug}/`)
- The output channel rules (file gets code, chat gets prose)
- The surgical-edit-first discipline (no full regen unless necessary)
- The `::question` inline protocol for discrete decisions
- The language contract (match the user's language, don't translate
  their copy)
- Anti-patterns (Lorem ipsum, decorative emoji, AI-shimmer haze, etc.)

## Gemini-specific notes

- Gemini CLI exposes file ops, search, and shell. Use absolute paths
  rooted at `PROJECT_PATH` (provided in the session preamble).
- If Gemini's tool layer doesn't include `Edit`, prefer Write to
  overwrite the primary HTML — but still try to make the change as
  surgical as possible by re-emitting the file with only the targeted
  diff applied.
- The `::question` protocol is rendered by the DF app as clickable
  buttons. Emit it inline in chat text, NOT in a code fence.

That's it. The contract in `docs/agent-contract.md` covers the rest.

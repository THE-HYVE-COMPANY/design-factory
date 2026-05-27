# DesignFactory — Claude Code adapter

Claude Code loads `.claude/CLAUDE.md` from the project root. This file is
a thin adapter — the canonical agent contract lives in
**[docs/agent-contract.md](../docs/agent-contract.md)**.

Read that contract first. It defines:

- The project workspace layout (`projects/{slug}/`)
- The output channel rules (file gets code, chat gets prose)
- The surgical-edit-first discipline (no full regen unless necessary)
- The `::question` inline protocol for discrete decisions
- The language contract (match the user's language, don't translate
  their copy)
- Anti-patterns (Lorem ipsum, decorative emoji, AI-shimmer haze, etc.)

## Claude-specific notes

- When DF spawns the Project Agent it runs via `claude --prompt`, NOT the
  full interactive harness. Tools like `AskUserQuestion` and `ToolSearch`
  error on call — never use them. For decisions with discrete options,
  use the `::question` inline protocol from the contract.
- Tools you do have: `Read`, `Write`, `Edit`, `Bash` (scoped to the
  workspace root), `Glob`, `Grep`.
- The `::question` protocol is rendered by the DF app as clickable
  buttons. Emit it inline in chat text, NOT in a code fence.

That's it. The contract in `docs/agent-contract.md` covers the rest.

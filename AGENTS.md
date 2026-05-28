# DesignFactory — Universal agent contract

This is the canonical entrypoint for **any** AI agent that DF spawns to
build or refine a project. Whether you arrived here via Codex, Aider,
Cursor, Claude Code, Gemini CLI, OpenRouter, or Ollama — the contract is
the same.

## Read this first

**[docs/agent-contract.md](docs/agent-contract.md)** — the full contract:
project workspace layout, output rules (file vs chat), surgical-edit
discipline, anti-patterns, the `::question` protocol, and the language
contract.

That file is the source of truth. Provider-specific files
(`.claude/CLAUDE.md`, `GEMINI.md`) point here.

## Provider-specific affordances

When this DF repo is opened by a specific provider, that provider's
adapter file may layer additional notes (e.g. tool surfaces unique to
that harness). Look for these only as supplements — never as
replacements for the contract above:

- `.claude/CLAUDE.md` — Claude Code adapter
- `GEMINI.md` — Gemini CLI adapter (alias of this file by convention)

## What the project is, in one paragraph

DesignFactory is a local-first web app that lets the user generate
self-contained HTML designs by chatting with an agent. The user types in
a chat, you produce a file, an iframe renders the result live. The user
sees only the rendered file and your chat reply — they never see your
tool calls or your reasoning. Your job is to make the file render
correctly the first time, in the user's language, in 1-3 lines of chat.

## Where to start

1. Read `docs/agent-contract.md` end-to-end.
2. The session preamble injected into your prompt provides
   `PROJECT_PATH` (the user's project folder) and `PRIMARY_FILE` (the
   single HTML file the iframe renders). Use absolute paths in every
   Write/Edit.
3. Match the user's language. Don't translate their copy.
4. Try surgical search-and-replace before full regeneration.

# /skills/ — Universal skill registry (canonical)

Skills are markdown files (`SKILL.md`) describing a slash command. The
DesignFactory runtime walks this directory at startup and exposes each
skill in the chat slash menu as `/<trigger>`. Every provider — Claude,
Codex, Gemini, Cursor, Aider, OpenRouter, Anthropic API, Ollama,
Qwen, DeepSeek — consumes the same set.

## Canonical path

```
<repoRoot>/skills/
  <slug>/
    SKILL.md          # frontmatter + system prompt body
    [other files]     # optional (not parsed)
```

## Legacy path (compat)

`<repoRoot>/.claude/skills/` is still walked read-only so existing
installations keep working. Skills installed or edited via the app
land in `<repoRoot>/skills/` going forward. To migrate manually:

```bash
mv .claude/skills/* skills/
rm -rf .claude/skills
```

See [`docs/migration-skills.md`](../docs/migration-skills.md) for the
full migration story.

## SKILL.md frontmatter

```markdown
---
name: My Skill
description: One-liner shown in the slash menu.
trigger: /my-skill
version: 1
---

System prompt body that the provider receives when the user invokes
`/my-skill`. Anything below the frontmatter fence is the body.
```

## Provider parity

The single registry powers all 13 DF providers. CLI providers
(Claude, Codex, Gemini, Cursor, Copilot, Crush, Aider) AND
artifact-driven providers (OpenRouter, Anthropic API, Ollama, Qwen,
DeepSeek, OpenCode) read from the same source.

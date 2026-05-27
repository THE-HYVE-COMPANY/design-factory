---
name: Minimal Smoke Skill
trigger: "/smoke-skill"
description: Deliberately tiny skill used by the SMOKE-RUNBOOK to exercise ZIP import.
---

# Minimal Smoke Skill

This skill exists to test the skill-import pipeline end-to-end
without relying on any real production skill. When the user types
`/smoke-skill`, the model receives the body below as a system-prompt
fragment.

The body is intentionally short and uncontroversial:

> Reply in one sentence. Use plain language. Avoid decorative
> emojis, marketing speak, and AI-tells. Keep your answer concrete.

That is the entire instruction. The runbook's Step 10 zips the
`minimal-skill/` folder, drops it into the importer, and asserts
that the skill appears in the registry plus the trigger completes
in the slash dropup.

## Folder layout this fixture demonstrates

```
minimal-skill/
├── SKILL.md             — this file (manifest + body)
└── references/
    └── style.md         — secondary doc the importer must preserve
```

After import, the skill lives at:

```
<repoRoot>/skills/minimal-skill/
├── SKILL.md
└── references/
    └── style.md
```

That is exactly what the importer's full-payload mode (PR #210)
promises. If `references/style.md` is missing after import, the
fixture proves the regression.

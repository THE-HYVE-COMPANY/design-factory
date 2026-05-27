# Design Systems

Design systems give the model project-specific direction before it
writes files. They are useful when a generated screen needs to follow a
brand, product language, component vocabulary, or visual constraint set.

## What a design system contains

A design system is stored as Markdown, usually in `design.md`. Keep it
practical and specific:

- product or brand context;
- layout rules and spacing preferences;
- color, type, motion, and interaction guidance;
- component patterns to use or avoid;
- visual references or links when available;
- constraints that should apply across turns.

Short, concrete rules work better than broad taste statements. For
example, describe how dense a dashboard should feel, which controls are
acceptable, and which UI patterns should not appear.

## How to add one

Use the design system flow in the app to create or import a system. The
app supports local Markdown, folders with a `design.md`, and remote
sources that can be read as Markdown.

Imported systems are stored under:

```text
design-systems/{slug}/design.md
```

The repository also includes public examples under `design-systems/`.
They are examples of structure and tone, not requirements for every
project.

## How it affects generation

When a project has a design system attached, the direction engine adds
that content to the turn preamble. The provider receives it as context
alongside the project brief, prompt, selected format, and any active
skill.

The model still writes the project files. The design system is guidance,
not a renderer or component library.

For the composition model, see [direction-engine.md](direction-engine.md).

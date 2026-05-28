# Skills

Skills are reusable instruction blocks that can be inserted into a
prompt with `/` commands. They are provider-agnostic: the app reads the
skill registry, inserts the selected instruction text, and sends the
compiled prompt to the active provider.

## Registry

The canonical registry lives at:

```text
skills/{slug}/SKILL.md
```

Each `SKILL.md` can include frontmatter such as name, description, and
trigger metadata, followed by the instruction body. The instruction body
should be clear, scoped, and written for the model that will apply it.

The app can also read legacy `.claude/skills/` folders for import and
migration, but new skills created or imported through the app land in
`skills/`.

## Using a skill

In the chat box, type `/` to open the skills menu. Pick a skill, then
send the prompt or keep typing to add arguments. Inserting a skill does
not send the prompt automatically.

Skills work best when they describe a repeatable behavior: interface
review, motion polish, slide structure, accessibility pass, or a
specific product writing style.

## Importing a skill

The import flow accepts:

- a Markdown file;
- a zip bundle containing a skill file;
- a raw URL such as a GitHub raw file or Gist;
- a local skills folder.

Every import path shows a preview before install. Read imported skills
before enabling them. A skill becomes prompt context for the provider,
so it should not contain secrets or instructions you would not want sent
with a generation request.

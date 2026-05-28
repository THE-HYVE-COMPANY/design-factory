# Project Files

Design Factory stores generated work as regular files under
`projects/` at the repository root. That folder is ignored by git in
this repo, so local project work does not get committed unless you
choose to copy or track it elsewhere.

## Folder shape

Each project gets one folder:

```text
projects/{slug}/
  {slug}.html
  tab-1-example.html
  assets/
  .df/
    meta.json
    chat.jsonl
    versions/{versionId}.json
```

The primary HTML file is the file rendered in the preview iframe.
Additional HTML files can be used for tabs or alternate screens.
`assets/` holds images, fonts, audio, and other files imported by the
HTML.

## What to edit

You can edit generated HTML and assets directly if you want to inspect,
version, or reuse the output outside the app.

Do not edit `.df/` by hand. The app owns that directory:

- `meta.json` stores project metadata used by the project list and
  editor.
- `chat.jsonl` stores the local chat transcript.
- `versions/` stores saved snapshots created through the app.

If a `.df/` file is damaged, the UI can lose project metadata even when
the generated HTML still exists.

## How writes happen

The browser UI does not write project files directly. It talks to the
local daemon, and the daemon scopes file operations under the project
folder. Providers either call native file tools or return an artifact
block that the runtime parses and writes.

For the exact agent-side write contract, see
[agent-contract.md](agent-contract.md).

## Moving work elsewhere

Generated outputs are standard HTML and assets. You can open them in a
browser, put them under version control, copy them into another app, or
use them as references for production code.

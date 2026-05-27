// friendly-status.ts — humanized status-pill label.
//
// The raw labels emitted by useClaude (`thinking...`, `generating...`,
// `working...`, `starting agent...`, `done`) read like SDK verbs and
// don't help a designer understand what the agent is actually doing.
// This helper maps them to editorial strings via i18n
// (`chat.status.*`) and, when a tool is currently running, pivots the
// label to reflect the tool's *intent* ("Lendo seu projeto",
// "Atualizando arquivo") rather than a generic spinner word. The
// mapping logic lives here, isolated from EditorScreen, so it can be
// tested without mounting the editor.
//
// Pure function: takes the raw label + the live tools ledger + the i18n
// `t` fn, returns the display string. Falls back to the raw label when no
// mapping is found, so unknown labels never disappear.

import type { ToolUseRecord } from "@/components/ChatMessage";

export function friendlyStatusLabel(
  raw: string,
  tools: ReadonlyArray<ToolUseRecord>,
  t: (key: string) => string,
): string {
  // Latest tool that hasn't returned a result yet drives the "in-progress"
  // copy. Without an in-flight tool, fall back to the abstract spinner verb.
  const active = [...tools].reverse().find((tool) => !tool.result);
  if (active) {
    const name = active.name.toLowerCase();
    if (name === "read") return t("chat.status.reading");
    if (name === "write") return t("chat.status.writing");
    if (name === "edit") return t("chat.status.editing");
    if (name === "bash") return t("chat.status.bash");
    if (name === "webfetch" || name === "web_fetch") return t("chat.status.fetching");
    if (name === "glob" || name === "grep") return t("chat.status.searching");
  }
  // Map known raw labels.
  if (raw.startsWith("starting")) return t("chat.status.starting");
  if (raw.startsWith("thinking")) return t("chat.status.thinking");
  if (raw.startsWith("generating")) return t("chat.status.generating");
  if (raw === "working...") return t("chat.status.generating");
  if (raw === "done") return t("chat.status.done");
  return raw;
}

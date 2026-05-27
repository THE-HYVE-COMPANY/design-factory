// friendly-status.test.ts — humanized chat status pill mapping.
//
// (2026-05-06) — locks the user-facing copy contract:
//   · Tool-driven labels win over abstract spinner verbs while a tool
//     is in flight ("Lendo seu projeto" beats "thinking...").
//   · Once tools complete (all have a result) and the SDK label is
//     `generating...` / `working...`, the status reflects the editorial
//     intent (writing the code).
//   · Unknown labels pass through verbatim — never silently empty.

import { describe, it, expect } from "vitest";
import { friendlyStatusLabel } from "./friendly-status";
import type { ToolUseRecord } from "@/components/ChatMessage";

const tStub = (key: string) => `[${key}]`;

const finishedTool = (name: string): ToolUseRecord => ({
  id: `${name}-1`,
  name,
  input: { file_path: "/tmp/x" },
  result: { content: "ok", isError: false },
});

const inFlightTool = (name: string): ToolUseRecord => ({
  id: `${name}-2`,
  name,
  input: { file_path: "/tmp/x" },
});

describe("friendlyStatusLabel", () => {
  it("returns the thinking copy when no tool is in flight", () => {
    expect(friendlyStatusLabel("thinking...", [], tStub)).toBe("[chat.status.thinking]");
  });

  it("returns the starting copy for the boot label", () => {
    expect(friendlyStatusLabel("starting agent...", [], tStub)).toBe("[chat.status.starting]");
  });

  it("maps generating + working spinner labels to the editorial 'writing the code' line", () => {
    expect(friendlyStatusLabel("generating...", [], tStub)).toBe("[chat.status.generating]");
    expect(friendlyStatusLabel("working...", [], tStub)).toBe("[chat.status.generating]");
  });

  it("maps the done label to the friendly 'concluído' copy", () => {
    expect(friendlyStatusLabel("done", [], tStub)).toBe("[chat.status.done]");
  });

  it("pivots to a tool-specific label while a Read tool is in flight", () => {
    expect(friendlyStatusLabel("working...", [inFlightTool("Read")], tStub))
      .toBe("[chat.status.reading]");
  });

  it("pivots to the editing label for an in-flight Edit tool", () => {
    expect(friendlyStatusLabel("working...", [inFlightTool("Edit")], tStub))
      .toBe("[chat.status.editing]");
  });

  it("pivots to the writing label for an in-flight Write tool", () => {
    expect(friendlyStatusLabel("working...", [inFlightTool("Write")], tStub))
      .toBe("[chat.status.writing]");
  });

  it("falls through to the spinner mapping when all tools have a result already", () => {
    // Even though tools were used, every one finished — go back to the
    // abstract spinner copy rather than freezing on the last tool's verb.
    expect(friendlyStatusLabel("working...", [finishedTool("Read"), finishedTool("Write")], tStub))
      .toBe("[chat.status.generating]");
  });

  it("uses the latest in-flight tool when multiple overlap", () => {
    // [Read finished, Write in-flight] — show the writing copy.
    expect(friendlyStatusLabel(
      "working...",
      [finishedTool("Read"), inFlightTool("Write")],
      tStub,
    )).toBe("[chat.status.writing]");
  });

  it("maps Bash + WebFetch + Grep to their editorial copy", () => {
    expect(friendlyStatusLabel("working...", [inFlightTool("Bash")], tStub))
      .toBe("[chat.status.bash]");
    expect(friendlyStatusLabel("working...", [inFlightTool("WebFetch")], tStub))
      .toBe("[chat.status.fetching]");
    expect(friendlyStatusLabel("working...", [inFlightTool("Grep")], tStub))
      .toBe("[chat.status.searching]");
  });

  it("returns unknown raw labels verbatim — never silently empty", () => {
    expect(friendlyStatusLabel("queueing rebuild", [], tStub)).toBe("queueing rebuild");
  });
});

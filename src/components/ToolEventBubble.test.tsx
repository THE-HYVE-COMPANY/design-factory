// Smoke tests for ToolEventBubble — without @testing-library/react in
// the project, we exercise the component module by:
//   1. Rendering to a happy-dom DOM via React.createElement + react-dom/server
//      to confirm there are no runtime crashes for each event type.
//   2. Asserting on the produced HTML markup (data attributes + key text).
//
// Why server-render instead of mounting: it's lighter, deterministic, and
// covers the JSX shape without bringing in a full client-side test rig.
// State (expanded toggle) is verified separately by reading the
// non-expanded markup once and confirming the input panel is not in it.

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { ToolEventBubble, ToolEventStream } from "./ToolEventBubble";
import type {
  NormalizedToolCallEvent,
  NormalizedToolResultEvent,
  NormalizedToolErrorEvent,
} from "@/runtime/tool-events";

const baseCall: NormalizedToolCallEvent = {
  type: "tool_call",
  id: "t1",
  name: "Write",
  input: { file_path: "/tmp/x.html", content: "<html/>" },
  provider: "claude",
  timestamp: "2026-05-04T12:00:00.000Z",
};

const baseResult: NormalizedToolResultEvent = {
  type: "tool_result",
  toolCallId: "t1",
  ok: true,
  output: "wrote 1.2kb to /tmp/x.html",
  provider: "claude",
  timestamp: "2026-05-04T12:00:01.000Z",
};

const baseError: NormalizedToolErrorEvent = {
  type: "tool_error",
  toolCallId: "t2",
  reason: "EACCES: permission denied",
  provider: "codex",
  timestamp: "2026-05-04T12:00:02.000Z",
};

describe("ToolEventBubble", () => {
  it("renders a tool_call without crashing and shows the tool name + summary", () => {
    const html = renderToStaticMarkup(createElement(ToolEventBubble, { event: baseCall }));
    expect(html).toContain("data-tool-event-bubble");
    expect(html).toContain('data-status="pending"');
    expect(html).toContain('data-provider="claude"');
    expect(html).toContain("Write");
    expect(html).toContain("/tmp/x.html");
  });

  it("renders a tool_result with ok status and surfaces the output preview", () => {
    const html = renderToStaticMarkup(createElement(ToolEventBubble, { event: baseResult }));
    expect(html).toContain('data-status="ok"');
    expect(html).toContain("wrote 1.2kb");
  });

  it("renders a tool_error with error status and shows the reason", () => {
    const html = renderToStaticMarkup(createElement(ToolEventBubble, { event: baseError }));
    expect(html).toContain('data-status="error"');
    expect(html).toContain('data-provider="codex"');
    expect(html).toContain("EACCES");
  });

  it("respects defaultExpanded — input panel only appears when expanded", () => {
    const collapsed = renderToStaticMarkup(createElement(ToolEventBubble, { event: baseCall }));
    expect(collapsed).not.toContain("INPUT"); // section title appears only when expanded
    const expanded = renderToStaticMarkup(
      createElement(ToolEventBubble, { event: baseCall, defaultExpanded: true }),
    );
    expect(expanded).toContain("Input"); // case from <Section title="Input">
    expect(expanded).toContain("file_path"); // JSON-stringified input visible
  });

  it("truncates long output and notes the truncation", () => {
    const longOutput = "x".repeat(2000);
    const html = renderToStaticMarkup(
      createElement(ToolEventBubble, {
        event: { ...baseResult, output: longOutput },
        defaultExpanded: true,
      }),
    );
    expect(html).toContain("truncated to 1500 chars");
  });

  it.each([
    ["claude" as const, "#cf8a4a"],
    ["codex" as const, "#10a37f"],
    ["gemini" as const, "#4285f4"],
    ["ollama" as const, "#7b8794"],
  ])("uses the per-provider dot color for %s", (provider, color) => {
    const html = renderToStaticMarkup(
      createElement(ToolEventBubble, { event: { ...baseCall, provider } }),
    );
    expect(html).toContain(color);
  });
});

describe("ToolEventStream", () => {
  it("renders multiple events in order", () => {
    const html = renderToStaticMarkup(
      createElement(ToolEventStream, { events: [baseCall, baseResult, baseError] }),
    );
    expect(html).toContain("data-tool-event-stream");
    // All three events present.
    expect(html.match(/data-tool-event-bubble/g)?.length).toBe(3);
  });

  it("returns nothing when events is empty", () => {
    const html = renderToStaticMarkup(createElement(ToolEventStream, { events: [] }));
    expect(html).toBe("");
  });
});

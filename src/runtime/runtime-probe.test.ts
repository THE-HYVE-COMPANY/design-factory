import { describe, it, expect } from "vitest";
import {
  RUNTIME_PROBE_SOURCE_ID,
  RUNTIME_PROBE_MESSAGE_TYPE,
  RUNTIME_PROBE_SOURCE,
  injectProbeIntoHtml,
  isRuntimeProbePayload,
} from "./runtime-probe";

describe("RUNTIME_PROBE_SOURCE", () => {
  it("is a self-contained IIFE", () => {
    expect(RUNTIME_PROBE_SOURCE.startsWith("(() => {")).toBe(true);
    expect(RUNTIME_PROBE_SOURCE.endsWith("})();")).toBe(true);
  });

  it("references the canonical message type and source ID", () => {
    expect(RUNTIME_PROBE_SOURCE).toContain(RUNTIME_PROBE_MESSAGE_TYPE);
    expect(RUNTIME_PROBE_SOURCE).toContain(RUNTIME_PROBE_SOURCE_ID);
  });

  it("never throws when parsed by `new Function`", () => {
    // The probe lives as a string and is mounted inside the iframe. We
    // verify it parses cleanly so a typo in this file doesn't ship a
    // syntactically-broken probe.
    expect(() => new Function(RUNTIME_PROBE_SOURCE)).not.toThrow();
  });
});

describe("injectProbeIntoHtml", () => {
  it("injects the probe just before </body>", () => {
    const html = "<!DOCTYPE html><html><body><h1>hi</h1></body></html>";
    const out = injectProbeIntoHtml(html);
    const bodyClose = out.indexOf("</body>");
    const probeOpen = out.indexOf("<script>");
    expect(probeOpen).toBeGreaterThan(0);
    expect(probeOpen).toBeLessThan(bodyClose);
    expect(out).toContain("df-runtime-probe");
  });

  it("appends the probe when </body> is missing", () => {
    const html = "<svg width='10' height='10'></svg>";
    const out = injectProbeIntoHtml(html);
    expect(out.endsWith("</script>")).toBe(true);
    expect(out).toContain("df-runtime-probe");
  });

  it("uses the LAST </body> when there are multiple (defense)", () => {
    // Edge case: artifact contains the literal string "</body>" inside a
    // <pre> block. We still want to land before the structural closing
    // tag, which is the LAST one.
    const html =
      "<!DOCTYPE html><html><body><pre>example: &lt;/body&gt;</pre>" +
      "<p>real content</p></body></html>";
    const out = injectProbeIntoHtml(html);
    // Probe must not appear inside the <pre> block.
    const preEnd = out.indexOf("</pre>");
    const probe = out.indexOf("<script>");
    expect(probe).toBeGreaterThan(preEnd);
  });
});

describe("isRuntimeProbePayload", () => {
  it("accepts a fully-formed payload", () => {
    const payload = {
      source: RUNTIME_PROBE_SOURCE_ID,
      type: RUNTIME_PROBE_MESSAGE_TYPE,
      bodyRect: { width: 800, height: 600 },
      visibleChildCount: 7,
      consoleErrors: [],
      fontsReady: true,
      asset404s: [],
      firstPaintMs: 120,
    };
    expect(isRuntimeProbePayload(payload)).toBe(true);
  });

  it("rejects payloads with the wrong source field", () => {
    const payload = {
      source: "imposter",
      type: RUNTIME_PROBE_MESSAGE_TYPE,
      bodyRect: { width: 1, height: 1 },
      visibleChildCount: 0,
      consoleErrors: [],
      fontsReady: true,
      asset404s: [],
      firstPaintMs: 1,
    };
    expect(isRuntimeProbePayload(payload)).toBe(false);
  });

  it("rejects payloads missing required numeric fields", () => {
    const payload = {
      source: RUNTIME_PROBE_SOURCE_ID,
      type: RUNTIME_PROBE_MESSAGE_TYPE,
      bodyRect: { width: 1, height: 1 },
      visibleChildCount: "many",
      consoleErrors: [],
      fontsReady: true,
      asset404s: [],
      firstPaintMs: 1,
    };
    expect(isRuntimeProbePayload(payload)).toBe(false);
  });

  it("rejects null / non-objects / arrays", () => {
    expect(isRuntimeProbePayload(null)).toBe(false);
    expect(isRuntimeProbePayload(undefined)).toBe(false);
    expect(isRuntimeProbePayload(42)).toBe(false);
    expect(isRuntimeProbePayload("hi")).toBe(false);
    expect(isRuntimeProbePayload([])).toBe(false);
  });
});

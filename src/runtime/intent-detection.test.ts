// intent-detection.test.ts — verifies the heuristic for the canonical
// user briefing + edge cases.

import { describe, expect, it } from "vitest";
import { detectIntent, intentTagLabel, type IntentTag } from "./intent-detection";

describe("detectIntent", () => {
  it("returns empty result for empty prompt", () => {
    const r = detectIntent("");
    expect(r.tags).toEqual([]);
    expect(r.suggestion).toEqual({});
    expect(r.summary).toBe("");
  });

  it("returns empty result for whitespace-only prompt", () => {
    const r = detectIntent("   \n\t  ");
    expect(r.tags).toEqual([]);
    expect(r.summary).toBe("");
  });

  it("detects motion + brand + multi-asset for a rich multi-asset briefing", () => {
    const r = detectIntent("grid 3x3 com 9 SVG animations de máquinas para branding");
    // Display order is fixed (motion → brand → multi-asset → …)
    expect(r.tags).toContain("motion");
    expect(r.tags).toContain("brand");
    expect(r.tags).toContain("multi-asset");
    // Suggestion follows the brand+multi-asset combination rule.
    expect(r.suggestion.format).toBe("1:1");
    // DS suggestion stays user-controlled (no brand DS shipped by default).
    expect(r.suggestion.ds).toBeUndefined();
    expect(r.suggestion.antiSlop).toBe("strict");
    expect(r.suggestion.verb).toBe("create");
    expect(r.summary).toMatch(/^Detectei:/);
  });

  it("detects landing for site-style prompts", () => {
    const r = detectIntent("landing page for the new product hero");
    expect(r.tags).toContain("landing");
    // Without brand, no DS suggestion; format defaults to 16:9.
    expect(r.suggestion.format).toBe("16:9");
    expect(r.suggestion.ds).toBeUndefined();
  });

  it("detects prototype + verb=refine when wording implies iteration", () => {
    const r = detectIntent("prototype para refinar o fluxo de onboarding");
    expect(r.tags).toContain("prototype");
    expect(r.suggestion.verb).toBe("refine");
  });

  it("detects asset (icon) → format 1:1", () => {
    const r = detectIntent("preciso de 12 ícones para a barra lateral");
    expect(r.tags).toContain("asset");
    expect(r.tags).toContain("multi-asset"); // "12" matches the multi-asset count regex
    expect(r.suggestion.format).toBe("1:1");
  });

  it("brand alone → anti-slop strict, no format override, DS stays user-controlled", () => {
    const r = detectIntent("revisão da marca e do logo");
    expect(r.tags).toEqual(["brand"]);
    // DS suggestion deliberately stays empty — no brand DS shipped.
    expect(r.suggestion.ds).toBeUndefined();
    expect(r.suggestion.antiSlop).toBe("strict");
    expect(r.suggestion.format).toBeUndefined();
  });

  it("motion alone → 16:9", () => {
    const r = detectIntent("uma animation de transição entre seções");
    expect(r.tags).toContain("motion");
    expect(r.suggestion.format).toBe("16:9");
  });

  it("ignores irrelevant prompts (no tags)", () => {
    const r = detectIntent("texto qualquer sem palavras-chave");
    expect(r.tags).toEqual([]);
    expect(r.summary).toBe("");
    expect(r.suggestion).toEqual({});
  });

  it("multi-asset overrides motion for format (grid wins)", () => {
    // motion alone → 16:9; multi-asset present → 1:1.
    const r = detectIntent("grid de 9 animações");
    expect(r.tags).toContain("motion");
    expect(r.tags).toContain("multi-asset");
    expect(r.suggestion.format).toBe("1:1");
  });

  it("detects direction hints (editorial/brutal/soft minimal)", () => {
    expect(detectIntent("layout editorial sereno").suggestion.direction).toBe("editorial");
    expect(detectIntent("estilo brutal e direto").suggestion.direction).toBe("brutal");
    expect(detectIntent("algo soft e clean").suggestion.direction).toBe("soft minimal");
    expect(detectIntent("um minimal apresentável").suggestion.direction).toBe("soft minimal");
  });

  it("Portuguese 'animações' (with accent) triggers motion", () => {
    const r = detectIntent("preciso de animações sutis");
    expect(r.tags).toContain("motion");
  });

  it("display order is stable (motion before brand before multi-asset)", () => {
    const r = detectIntent("brand grid 3x3 motion");
    const expected: IntentTag[] = ["motion", "brand", "multi-asset"];
    expect(r.tags).toEqual(expected);
  });
});

describe("intentTagLabel", () => {
  it("returns the label for each tag id", () => {
    expect(intentTagLabel("motion")).toBe("motion");
    expect(intentTagLabel("brand")).toBe("brand");
    expect(intentTagLabel("multi-asset")).toBe("multi-asset");
    expect(intentTagLabel("landing")).toBe("landing");
    expect(intentTagLabel("prototype")).toBe("prototype");
    expect(intentTagLabel("asset")).toBe("asset");
  });
});

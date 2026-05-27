// NewProjectFormSkeu.taste.test.ts
//
// v5 (2026-05-05) — guards the user's "ative-only state" rule:
// dials neutros (value === 50) NÃO podem aparecer no payload nem no
// prompt suffix. activeTaste() é a função pura que filtra isso.

import { describe, expect, it } from "vitest";
import { activeTaste } from "@/components/NewProjectFormSkeu";

const NEUTRAL = {
  density: 50,
  motion: 50,
  contrast: 50,
  interactions: 50,
  surface: 50,
  originality: 50,
} as const;

describe("activeTaste — v5 ative-only state", () => {
  it("returns an empty object when every dial is at the neutral 50", () => {
    const out = activeTaste(NEUTRAL);
    expect(out).toEqual({});
    expect(Object.keys(out)).toHaveLength(0);
  });

  it("includes only the dial the user moved away from 50", () => {
    const out = activeTaste({ ...NEUTRAL, density: 30 });
    expect(out).toEqual({ density: 30 });
    expect(Object.keys(out)).toHaveLength(1);
  });

  it("includes both poles (low and high) when the user splits two dials", () => {
    const out = activeTaste({ ...NEUTRAL, density: 20, motion: 80 });
    expect(out).toEqual({ density: 20, motion: 80 });
  });

  it("includes all six dials when none are neutral", () => {
    const all = {
      density: 10,
      motion: 90,
      contrast: 25,
      interactions: 75,
      surface: 40,
      originality: 60,
    };
    expect(activeTaste(all)).toEqual(all);
    expect(Object.keys(activeTaste(all))).toHaveLength(6);
  });

  it("treats 49 and 51 as ACTIVE — only exact 50 is neutral", () => {
    expect(activeTaste({ ...NEUTRAL, density: 49 })).toEqual({ density: 49 });
    expect(activeTaste({ ...NEUTRAL, density: 51 })).toEqual({ density: 51 });
  });

  it("treats 0 and 100 (extreme poles) as active", () => {
    const out = activeTaste({ ...NEUTRAL, density: 0, originality: 100 });
    expect(out).toEqual({ density: 0, originality: 100 });
  });

  it("does NOT mutate the input object", () => {
    const input = { ...NEUTRAL, density: 30 };
    const before = JSON.stringify(input);
    activeTaste(input);
    expect(JSON.stringify(input)).toEqual(before);
  });

  it("supports the 6 v5 dial ids only — Tone (legacy v4) not present", () => {
    const out = activeTaste({
      density: 10,
      motion: 90,
      contrast: 25,
      interactions: 75,
      surface: 40,
      originality: 60,
    });
    const keys = Object.keys(out).sort();
    expect(keys).toEqual([
      "contrast",
      "density",
      "interactions",
      "motion",
      "originality",
      "surface",
    ]);
  });
});

// format-taxonomy.test.ts — sanity tests for format taxonomy.

import { describe, expect, it, beforeEach } from "vitest";
import {
  DEFAULT_FORMAT_TAXONOMY,
  describeFormatSelection,
  findFormatItem,
  getEffectiveFormatTaxonomy,
  setCustomFormatCategories,
  setDisabledFormatItemIds,
  type FormatCategory,
  type FormatSelection,
} from "./format-taxonomy";

beforeEach(() => {
  setCustomFormatCategories([]);
  setDisabledFormatItemIds([]);
});

describe("format-taxonomy defaults", () => {
  // 2026-05-17 pruning kept just 6 prompted formats across interface +
  // social. P0-D Rota A migration (PR #147, 2026-05-18) restored the
  // auditor's priority list back into the taxonomy: video (explainer,
  // hero-loop, logo-reveal) and print (poster) categories returned, and
  // interface + social each gained one more entry (hero-section,
  // carousel). Re-adding more means appending entries in
  // format-taxonomy.ts, not toggling hidden flags.
  it("ships Interface + Social + Video + Print categories", () => {
    const ids = DEFAULT_FORMAT_TAXONOMY.map((c) => c.id);
    expect(ids).toEqual(["interface", "social", "video", "print"]);
  });

  it("Interface has landing/hero-section/dashboard/app-screen/email — all prompted", () => {
    const iface = DEFAULT_FORMAT_TAXONOMY.find((c) => c.id === "interface")!;
    const itemIds = iface.items.map((i) => i.id);
    expect(itemIds).toEqual(["landing", "hero-section", "dashboard", "app-screen", "email"]);
    for (const item of iface.items) {
      expect(typeof item.prompt).toBe("string");
      expect((item.prompt ?? "").length).toBeGreaterThan(0);
    }
  });

  it("Social has post/story/carousel — all prompted", () => {
    const social = DEFAULT_FORMAT_TAXONOMY.find((c) => c.id === "social")!;
    const itemIds = social.items.map((i) => i.id);
    expect(itemIds).toEqual(["post", "story", "carousel"]);
    for (const item of social.items) {
      expect(typeof item.prompt).toBe("string");
      expect((item.prompt ?? "").length).toBeGreaterThan(0);
    }
  });

  it("Video has explainer/hero-loop/logo-reveal — all prompted", () => {
    const video = DEFAULT_FORMAT_TAXONOMY.find((c) => c.id === "video")!;
    const itemIds = video.items.map((i) => i.id);
    expect(itemIds).toEqual(["explainer", "hero-loop", "logo-reveal"]);
    for (const item of video.items) {
      expect(typeof item.prompt).toBe("string");
      expect((item.prompt ?? "").length).toBeGreaterThan(0);
    }
  });

  it("Print has poster — prompted", () => {
    const print = DEFAULT_FORMAT_TAXONOMY.find((c) => c.id === "print")!;
    const itemIds = print.items.map((i) => i.id);
    expect(itemIds).toEqual(["poster"]);
    expect(typeof print.items[0].prompt).toBe("string");
    expect((print.items[0].prompt ?? "").length).toBeGreaterThan(0);
  });
});

describe("format-taxonomy effective catalog", () => {
  it("default taxonomy is returned when no overrides", () => {
    const eff = getEffectiveFormatTaxonomy();
    expect(eff.length).toBe(DEFAULT_FORMAT_TAXONOMY.length);
  });

  it("custom category replaces default by id", () => {
    const customInterface: FormatCategory = {
      id: "interface",
      label: "Interface custom",
      items: [{ id: "kiosk", label: "Kiosk" }],
    };
    setCustomFormatCategories([customInterface]);
    const eff = getEffectiveFormatTaxonomy();
    const iface = eff.find((c) => c.id === "interface")!;
    expect(iface.label).toBe("Interface custom");
    expect(iface.items.length).toBe(1);
    expect(iface.items[0].id).toBe("kiosk");
  });

  it("disabled item ids strip from items list", () => {
    setDisabledFormatItemIds(["interface/landing"]);
    const eff = getEffectiveFormatTaxonomy();
    const iface = eff.find((c) => c.id === "interface")!;
    expect(iface.items.find((i) => i.id === "landing")).toBeUndefined();
  });
});

describe("format-taxonomy lookup helpers", () => {
  it("findFormatItem locates a default item", () => {
    const sel: FormatSelection = { categoryId: "interface", itemId: "landing" };
    const found = findFormatItem(sel);
    expect(found?.item.label).toBe("Landing page");
    expect(found?.category.label).toBe("Interface");
  });

  it("findFormatItem returns null for unknown ids", () => {
    expect(findFormatItem({ categoryId: "x", itemId: "y" })).toBeNull();
  });

  it("describeFormatSelection produces 'Category · Item' string", () => {
    const sel: FormatSelection = { categoryId: "social", itemId: "post" };
    expect(describeFormatSelection(sel)).toBe("Social · Post");
  });

  it("describeFormatSelection returns null for null selection", () => {
    expect(describeFormatSelection(null)).toBeNull();
  });
});

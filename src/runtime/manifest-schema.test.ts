import { describe, it, expect } from "vitest";
import {
  MANIFEST_VERSION,
  validateManifest,
  migrateManifest,
  isCurrentManifest,
  stampVersion,
} from "./manifest-schema";

const validBase = {
  duration: 10,
  fps: 30,
  scenes: [
    { id: "01", name: "Opening", start: 0, duration: 4 },
    { id: "02", name: "Middle", start: 4, duration: 4 },
    { id: "03", name: "End", start: 8, duration: 2 },
  ],
  fromManifestTag: true,
};

describe("manifest-schema", () => {
  describe("validateManifest", () => {
    it("accepts a current-version manifest", () => {
      const r = validateManifest({ ...validBase, manifest_version: MANIFEST_VERSION });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.warnings).toEqual([]);
    });

    it("coerces v0 (no version field) and warns", () => {
      const r = validateManifest(validBase);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.value.manifest_version).toBe(MANIFEST_VERSION);
        expect(r.warnings.some((w) => w.includes("no version"))).toBe(true);
      }
    });

    it("rejects manifest_version newer than supported", () => {
      const r = validateManifest({ ...validBase, manifest_version: 999 });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.some((e) => e.includes("newer than supported"))).toBe(true);
    });

    it("rejects negative duration", () => {
      const r = validateManifest({ ...validBase, duration: -5 });
      expect(r.ok).toBe(false);
    });

    it("rejects fps out of range", () => {
      const r = validateManifest({ ...validBase, fps: 9999 });
      expect(r.ok).toBe(false);
    });

    it("rejects scene with zero duration", () => {
      const bad = { ...validBase, scenes: [{ id: "01", name: "x", start: 0, duration: 0 }] };
      const r = validateManifest(bad);
      expect(r.ok).toBe(false);
    });

    it("warns on overlapping scenes", () => {
      const overlap = {
        ...validBase,
        duration: 8,
        scenes: [
          { id: "a", name: "A", start: 0, duration: 5 },
          { id: "b", name: "B", start: 4, duration: 4 }, // overlaps a
        ],
      };
      const r = validateManifest(overlap);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.warnings.some((w) => w.includes("overlap"))).toBe(true);
    });

    it("warns on duration mismatch", () => {
      const r = validateManifest({ ...validBase, duration: 25 });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.warnings.some((w) => w.includes("doesn't match"))).toBe(true);
    });

    it("warns on duplicate scene ids", () => {
      const dups = {
        ...validBase,
        scenes: [
          { id: "01", name: "A", start: 0, duration: 4 },
          { id: "01", name: "B", start: 4, duration: 4 },
        ],
        duration: 8,
      };
      const r = validateManifest(dups);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.warnings.some((w) => w.includes("appears 2 times"))).toBe(true);
    });

    it("rejects non-object input", () => {
      expect(validateManifest(null).ok).toBe(false);
      expect(validateManifest(42).ok).toBe(false);
      expect(validateManifest("foo").ok).toBe(false);
    });
  });

  describe("migrateManifest", () => {
    it("stamps v0 → v1", () => {
      const out = migrateManifest(validBase);
      expect(out).not.toBeNull();
      expect(out?.manifest_version).toBe(MANIFEST_VERSION);
    });

    it("returns null for invalid input", () => {
      expect(migrateManifest({ broken: true })).toBeNull();
    });
  });

  describe("isCurrentManifest", () => {
    it("returns true for stamped manifest", () => {
      const stamped = stampVersion(validBase);
      expect(isCurrentManifest(stamped)).toBe(true);
    });

    it("returns false for unstamped legacy", () => {
      expect(isCurrentManifest(validBase as any)).toBe(false);
    });
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDesignSystemImport, type DsImportSource } from "./ds-import";

const fixture = readFileSync(
  resolve(process.cwd(), "examples/fixtures/design-system/design.md"),
  "utf8",
);

describe("design-system import parser", () => {
  it.each([
    ["paste", "clipboard"] as const,
    ["upload", "design.md"] as const,
    ["github", "the-hyve-company/design-factory"] as const,
    ["folder", "/tmp/design-system"] as const,
  ])("parses canonical design.md for %s entrypoint", (source: DsImportSource, sourceRef: string) => {
    const result = parseDesignSystemImport({ source, sourceRef, content: fixture });
    expect(result.source).toBe(source);
    expect(result.sourceRef).toBe(sourceRef);
    expect(result.parsed.name).toBeTruthy();
    expect(result.parsed.colors.length).toBeGreaterThan(0);
    expect(result.parsed.sections.some((section) => section.heading === "Palette")).toBe(true);
    expect(result.parsed.sections.some((section) => section.heading === "Typography")).toBe(true);
  });
});

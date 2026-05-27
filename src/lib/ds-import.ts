import { parseDesignSystem, type ParsedDesignSystem } from "@/lib/ds-google";

export type DsImportSource = "paste" | "upload" | "github" | "folder";

export interface DsImportParseResult {
  source: DsImportSource;
  sourceRef?: string;
  parsed: ParsedDesignSystem;
}

export function parseDesignSystemImport(input: {
  source: DsImportSource;
  content: string;
  sourceRef?: string;
}): DsImportParseResult {
  return {
    source: input.source,
    sourceRef: input.sourceRef,
    parsed: parseDesignSystem(input.content),
  };
}

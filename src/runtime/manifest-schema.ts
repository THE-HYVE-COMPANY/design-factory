// manifest-schema.ts — Versioned validation for the DF scene manifest.
//
// Why versioned: as the manifest gains fields (transitions, audio cues, motion
// presets, per-scene tweak knobs), older projects on disk would still parse
// but with missing fields. A version pin lets the parser route stale shapes
// through migrations instead of silently drifting.
//
// Inspired by Open Design's artifact-manifest.ts pattern (apps/daemon/src/
// artifact-manifest.ts in nexu-io/open-design): bounded-size validation,
// allowed-set checks, single MANIFEST_VERSION constant, soft warnings.
//
// API:
//   MANIFEST_VERSION    — current schema version (number)
//   validateManifest    — returns { ok: true, value } | { ok: false, errors }
//   migrateManifest     — migrates older-version inputs forward to current
//   isCurrentManifest   — narrow check for the current version
//
// scene-manifest.ts remains the source-of-truth parser; this module sits
// alongside it for callers (chat refine, version history, future export
// formats) that want to validate a manifest object after they construct or
// receive it.

import type { Scene, SceneManifest } from "./scene-manifest";

export const MANIFEST_VERSION = 1;

const MAX_SCENES = 64;
const MAX_TOTAL_DURATION_SEC = 600;
const MAX_NAME_LEN = 80;
const MAX_ID_LEN = 40;
const MIN_FPS = 1;
const MAX_FPS = 120;

export interface VersionedSceneManifest extends SceneManifest {
  /** Schema version. Always equals MANIFEST_VERSION when emitted by current code. */
  manifest_version: number;
}

export type ValidateResult =
  | { ok: true; value: VersionedSceneManifest; warnings: string[] }
  | { ok: false; errors: string[] };

function pushIf(arr: string[], cond: boolean, msg: string) {
  if (cond) arr.push(msg);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function validateScene(scene: unknown, idx: number, errors: string[]): scene is Scene {
  if (!scene || typeof scene !== "object") {
    errors.push(`scenes[${idx}] is not an object`);
    return false;
  }
  const s = scene as Record<string, unknown>;
  pushIf(errors, typeof s.id !== "string" || !s.id, `scenes[${idx}].id must be a non-empty string`);
  pushIf(errors, typeof s.id === "string" && s.id.length > MAX_ID_LEN, `scenes[${idx}].id exceeds max length (${MAX_ID_LEN})`);
  pushIf(errors, typeof s.name !== "string" || !s.name, `scenes[${idx}].name must be a non-empty string`);
  pushIf(errors, typeof s.name === "string" && s.name.length > MAX_NAME_LEN, `scenes[${idx}].name exceeds max length (${MAX_NAME_LEN})`);
  pushIf(errors, !isFiniteNumber(s.start) || (s.start as number) < 0, `scenes[${idx}].start must be a non-negative number`);
  pushIf(errors, !isFiniteNumber(s.duration) || (s.duration as number) <= 0, `scenes[${idx}].duration must be a positive number`);
  return errors.length === 0;
}

/**
 * Validate a manifest-shaped object. Returns errors when structural fields
 * are wrong; returns warnings for soft issues (overlaps, total duration
 * mismatch, etc) that don't block use but help the user spot drift.
 *
 * Accepts both SceneManifest (no version) and VersionedSceneManifest. When
 * input lacks `manifest_version`, the validator coerces to the current
 * version — the migrator handles structural changes between versions if/when
 * v2 lands.
 */
export function validateManifest(input: unknown): ValidateResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!input || typeof input !== "object") {
    return { ok: false, errors: ["manifest is not an object"] };
  }
  const m = input as Record<string, unknown>;

  // Version — accept missing (v0/legacy) and coerce to current
  let version: number;
  if (m.manifest_version === undefined) {
    version = MANIFEST_VERSION;
    warnings.push("manifest had no version field; coerced to v1");
  } else if (typeof m.manifest_version !== "number") {
    errors.push("manifest_version must be a number");
    version = MANIFEST_VERSION;
  } else {
    version = m.manifest_version;
    if (version > MANIFEST_VERSION) {
      errors.push(`manifest_version ${version} is newer than supported (${MANIFEST_VERSION})`);
    }
  }

  pushIf(errors, !isFiniteNumber(m.duration) || (m.duration as number) < 0, "duration must be a non-negative number");
  pushIf(errors, isFiniteNumber(m.duration) && (m.duration as number) > MAX_TOTAL_DURATION_SEC, `duration exceeds max (${MAX_TOTAL_DURATION_SEC}s)`);
  pushIf(errors, !isFiniteNumber(m.fps), "fps must be a number");
  if (isFiniteNumber(m.fps)) {
    const fps = m.fps as number;
    pushIf(errors, fps < MIN_FPS || fps > MAX_FPS, `fps must be between ${MIN_FPS} and ${MAX_FPS}`);
  }

  if (!Array.isArray(m.scenes)) {
    return { ok: false, errors: [...errors, "scenes must be an array"] };
  }
  if ((m.scenes as unknown[]).length > MAX_SCENES) {
    errors.push(`scenes exceeds max (${MAX_SCENES})`);
  }
  const scenes: Scene[] = [];
  for (let i = 0; i < (m.scenes as unknown[]).length; i++) {
    const s = (m.scenes as unknown[])[i];
    if (validateScene(s, i, errors)) scenes.push(s);
  }

  // Soft checks
  const idCounts = new Map<string, number>();
  for (const s of scenes) idCounts.set(s.id, (idCounts.get(s.id) ?? 0) + 1);
  for (const [id, n] of idCounts) {
    if (n > 1) warnings.push(`scene id "${id}" appears ${n} times`);
  }
  // Overlap warnings
  const sorted = [...scenes].sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (cur.start < prev.start + prev.duration - 0.01) {
      warnings.push(`scenes "${prev.id}" and "${cur.id}" overlap`);
    }
  }
  // Total-duration sanity
  if (isFiniteNumber(m.duration) && scenes.length > 0) {
    const last = sorted[sorted.length - 1];
    const computed = last.start + last.duration;
    if (Math.abs(computed - (m.duration as number)) > 0.5) {
      warnings.push(`duration (${m.duration}) doesn't match scenes' span (${computed.toFixed(2)})`);
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  const value: VersionedSceneManifest = {
    manifest_version: version,
    duration: m.duration as number,
    fps: m.fps as number,
    scenes,
    fromManifestTag: m.fromManifestTag === true,
  };
  return { ok: true, value, warnings };
}

/**
 * Migrate a v0 (legacy, no version field) or v1 manifest forward to the
 * current version. v1 is current — calling migrate on a v1 manifest is a
 * no-op except for stamping `manifest_version`. Future v2+ will add real
 * field transformations here.
 */
export function migrateManifest(input: unknown): VersionedSceneManifest | null {
  const r = validateManifest(input);
  return r.ok ? r.value : null;
}

/** True iff `m` is a SceneManifest stamped with the current schema version. */
export function isCurrentManifest(m: SceneManifest | VersionedSceneManifest): m is VersionedSceneManifest {
  return (m as VersionedSceneManifest).manifest_version === MANIFEST_VERSION;
}

/** Stamp a parser-output SceneManifest with the current version field. */
export function stampVersion(m: SceneManifest): VersionedSceneManifest {
  return { ...m, manifest_version: MANIFEST_VERSION };
}

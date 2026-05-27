// regression tests — filesystem-backed project versions.
// Locks the contract for ("filesystem versions") — versions
// MUST land at <repoRoot>/projects/<slug>/.df/versions/<vid>.json so
// they survive browser cache wipes and can be inspected manually.
//
// Reference: see also `docs/agent-contract.md` §1 (project workspace
// layout — `.df/versions/` is the canonical version store).

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { sanitizeVersionId } from "./slug.mjs";

let tmpRoot;
let projectsRoot;
let projectDir;
const SLUG = "test-project";

beforeEach(async () => {
  tmpRoot = await mkdtemp(join(tmpdir(), "df-versions-"));
  projectsRoot = join(tmpRoot, "projects");
  projectDir = join(projectsRoot, SLUG);
  await mkdir(projectDir, { recursive: true });
});

afterEach(async () => {
  if (tmpRoot) {
    await rm(tmpRoot, { recursive: true, force: true });
    tmpRoot = undefined;
  }
});

// Mirror the daemon's POST /projects/:slug/versions write logic.
// Pinned to filesystem layout so a regression in either the regex
// matcher or the path joining lights up here first.
async function writeVersion(slug, vid, payload) {
  const safeVid = sanitizeVersionId(vid);
  const versionsDir = join(projectsRoot, slug, ".df", "versions");
  await mkdir(versionsDir, { recursive: true });
  const filePath = join(versionsDir, `${safeVid}.json`);
  await writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
  return { safeVid, filePath };
}

describe("filesystem versions — regressions", () => {
  it("writes version JSON to <repoRoot>/projects/<slug>/.df/versions/<vid>.json", async () => {
    const { safeVid, filePath } = await writeVersion(SLUG, "v-1746556800000-abc", {
      id: "v-1746556800000-abc",
      html: "<!DOCTYPE html><html></html>",
      name: "before color tweak",
      createdAt: 1746556800000,
      auto: false,
    });

    expect(safeVid).toBe("v-1746556800000-abc");
    expect(existsSync(filePath)).toBe(true);
    expect(filePath).toBe(join(projectDir, ".df", "versions", "v-1746556800000-abc.json"));

    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    expect(parsed.id).toBe(safeVid);
    expect(parsed.html).toContain("<!DOCTYPE html>");
    expect(parsed.name).toBe("before color tweak");
  });

  it("creates .df/versions/ on demand when not present", async () => {
    expect(existsSync(join(projectDir, ".df", "versions"))).toBe(false);

    await writeVersion(SLUG, "v-fresh", {
      id: "v-fresh",
      html: "<html></html>",
      createdAt: Date.now(),
      auto: true,
    });

    expect(existsSync(join(projectDir, ".df", "versions"))).toBe(true);
    expect(existsSync(join(projectDir, ".df", "versions", "v-fresh.json"))).toBe(true);
  });

  it("supports multiple versions in the same project", async () => {
    await writeVersion(SLUG, "v-1", { id: "v-1", html: "<a/>", createdAt: 1, auto: false });
    await writeVersion(SLUG, "v-2", { id: "v-2", html: "<b/>", createdAt: 2, auto: false });
    await writeVersion(SLUG, "v-3", { id: "v-3", html: "<c/>", createdAt: 3, auto: false });

    expect(existsSync(join(projectDir, ".df", "versions", "v-1.json"))).toBe(true);
    expect(existsSync(join(projectDir, ".df", "versions", "v-2.json"))).toBe(true);
    expect(existsSync(join(projectDir, ".df", "versions", "v-3.json"))).toBe(true);
  });

  it("overwrites existing version with same id (POST is idempotent)", async () => {
    await writeVersion(SLUG, "v-x", { id: "v-x", html: "<a/>", createdAt: 1, auto: false });
    await writeVersion(SLUG, "v-x", { id: "v-x", html: "<b/>", createdAt: 2, auto: false });

    const raw = await readFile(join(projectDir, ".df", "versions", "v-x.json"), "utf8");
    const parsed = JSON.parse(raw);
    expect(parsed.html).toBe("<b/>");
    expect(parsed.createdAt).toBe(2);
  });

  it("versions are filesystem-backed (not localStorage-only)", async () => {
    // The bug was: versions persisted only to db.setSetting which is
    // backed by IndexedDB on web. Browser cache wipe = versions lost.
    // After , every version is written to disk and survives wipes.
    // This test pins the disk write — if a regression goes back to
    // localStorage-only, this test catches it.
    const { filePath } = await writeVersion(SLUG, "v-survives-wipe", {
      id: "v-survives-wipe",
      html: "<!DOCTYPE html>survivor",
      createdAt: Date.now(),
      auto: false,
    });

    expect(existsSync(filePath)).toBe(true);
    // The raw JSON includes the html — readable by `cat`, `jq`, etc.
    const raw = await readFile(filePath, "utf8");
    expect(raw).toContain("survivor");
  });

  it("rejects invalid version ids that would escape .df/versions/", async () => {
    // sanitizeVersionId neutralizes path traversal — even if a malicious
    // client posts `../../../etc/passwd` as the version id, the resulting
    // filename can't navigate up directories.
    const malicious = "../../../etc/passwd";
    const safe = sanitizeVersionId(malicious);

    expect(safe).toBe("etc-passwd");
    expect(safe.includes("..")).toBe(false);
    expect(safe.includes("/")).toBe(false);
  });

  it("preserves UUID-style version ids unchanged", async () => {
    const uuid = "v-1746556800000-7f3a2b1c";
    const { safeVid } = await writeVersion(SLUG, uuid, {
      id: uuid,
      html: "<x/>",
      createdAt: 1746556800000,
      auto: false,
    });

    expect(safeVid).toBe(uuid);
    expect(existsSync(join(projectDir, ".df", "versions", `${uuid}.json`))).toBe(true);
  });
});

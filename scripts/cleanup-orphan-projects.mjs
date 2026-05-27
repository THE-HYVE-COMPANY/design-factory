#!/usr/bin/env node
// cleanup-orphan-projects.mjs — detect and (optionally) remove project
// folders left behind by path-resolution bugs in non-Claude CLIs.
//
// F3.4 — User repro 2026-05-20: switching providers mid-project
// occasionally landed Gemini turns into the wrong cwd (the dev-server
// root) and the agent created a nested project tree instead of
// `projects/<slug>/<file>`.
// The folder is harmless but clutters the project list and confuses
// the Files gallery.
//
// What we look for:
//   1. the literal `workspace` slug under `projects/` — a special-case
//      name nobody should ever use; Gemini's path bug created this directly.
//   2. `projects/<slug>/projects/...` — any nested-projects/ directory
//      under an existing project. Always a misroot, never legitimate.
//
// What we DON'T touch:
//   - Anything with a healthy `.df/meta.json` matching the slug.
//   - Recent folders (mtime < 24h) — could be in-progress work the
//     user hasn't committed yet.
//   - Any folder above the projects root (paranoia guard).
//
// Usage:
//   node scripts/cleanup-orphan-projects.mjs                       # dry-run
//   node scripts/cleanup-orphan-projects.mjs --apply               # delete
//   node scripts/cleanup-orphan-projects.mjs --root /path/to/repo  # override

import { readdir, rm, stat, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const apply = process.argv.includes("--apply");
const force = process.argv.includes("--force"); // bypass 24h grace
const rootArgIdx = process.argv.indexOf("--root");
const ROOT_OVERRIDE = rootArgIdx >= 0 ? process.argv[rootArgIdx + 1] : null;
// Default: resolve `projects/` relative to where the script lives. When
// invoked from a worktree (.aios/worktrees/<branch>/scripts/...) that
// resolves to the worktree's own (empty) `projects/`, which is the
// wrong target — pass `--root <main-checkout>` in that case.
const REPO_ROOT = ROOT_OVERRIDE ? resolve(ROOT_OVERRIDE) : resolve(__dirname, "..");
const PROJECTS_ROOT = resolve(REPO_ROOT, "projects");
const SAFE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h fresh-folder grace

async function isOrphanCandidate(absPath) {
  // Refuse to operate above the projects root — paranoia guard so a
  // mis-call can't recursively delete the repo.
  if (!absPath.startsWith(PROJECTS_ROOT)) return false;
  if (absPath === PROJECTS_ROOT) return false;

  const name = absPath.slice(PROJECTS_ROOT.length + 1).split("/")[0];

  // Case 1: literal `workspace` slug — Gemini's mis-rooted writes only.
  if (name === "workspace") return true;

  // Case 2: anything BELOW `projects/<slug>/projects/...` — always a
  // misroot, no legitimate path puts `projects` inside a project.
  const segments = absPath.slice(PROJECTS_ROOT.length + 1).split("/");
  if (segments.length >= 2 && segments[1] === "projects") return true;

  return false;
}

async function isWithinSafeWindow(absPath) {
  try {
    const s = await stat(absPath);
    return Date.now() - s.mtimeMs < SAFE_WINDOW_MS;
  } catch {
    return false;
  }
}

async function hasHealthyMeta(absPath) {
  try {
    const raw = await readFile(join(absPath, ".df", "meta.json"), "utf8");
    const parsed = JSON.parse(raw);
    return typeof parsed?.id === "string" && parsed.id.length > 0;
  } catch {
    return false;
  }
}

async function findOrphans() {
  let entries;
  try {
    entries = await readdir(PROJECTS_ROOT, { withFileTypes: true });
  } catch (err) {
    console.error(`[cleanup] cannot read ${PROJECTS_ROOT}:`, err.message);
    process.exit(1);
  }
  const orphans = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const abs = join(PROJECTS_ROOT, e.name);
    if (!(await isOrphanCandidate(abs))) continue;
    if (!force && await isWithinSafeWindow(abs)) {
      console.log(`[cleanup] skip ${e.name} — modified < 24h ago (use --force to override)`);
      continue;
    }
    if (await hasHealthyMeta(abs)) {
      console.log(`[cleanup] skip ${e.name} — healthy .df/meta.json (treat as real project)`);
      continue;
    }
    orphans.push(abs);
  }
  return orphans;
}

async function main() {
  console.log(`[cleanup] scanning ${PROJECTS_ROOT}`);
  console.log(`[cleanup] mode: ${apply ? "APPLY (will delete)" : "DRY-RUN (no deletions)"}`);
  const orphans = await findOrphans();
  if (orphans.length === 0) {
    console.log("[cleanup] no orphans found.");
    return;
  }
  for (const path of orphans) {
    if (apply) {
      try {
        await rm(path, { recursive: true, force: true });
        console.log(`[cleanup] removed: ${path}`);
      } catch (err) {
        console.error(`[cleanup] failed to remove ${path}:`, err.message);
      }
    } else {
      console.log(`[cleanup] would remove: ${path}`);
    }
  }
  if (!apply) {
    console.log("");
    console.log("[cleanup] re-run with --apply to delete the listed folders.");
  }
}

main().catch((err) => {
  console.error("[cleanup] uncaught:", err);
  process.exit(1);
});

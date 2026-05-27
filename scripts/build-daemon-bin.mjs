#!/usr/bin/env node
// build-daemon-bin — compile the Node daemon into a single binary (Tauri sidecar).
// Proven in the spike: `bun build … --compile` bundles 574 modules into a
// standalone ~107MB executable that runs and answers /healthz with no Node
// installed. Tauri's externalBin expects a per-target suffix
// (<name>-<target-triple>), so we stamp it from `rustc -Vv`.
//
// Requires: bun on PATH. Output: src-tauri/binaries/df-daemon-<triple>[.exe]
//
// SPIKE scaffold — wire into tauri.conf.json `beforeBuildCommand`.

import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "src-tauri", "binaries");
mkdirSync(outDir, { recursive: true });

// Tauri sidecar naming: <name>-<target-triple>
const rv = spawnSync("rustc", ["-Vv"], { encoding: "utf8" });
const triple = (rv.stdout || "").split("\n").find((l) => l.startsWith("host:"))?.split(" ")[1];
if (!triple) { console.error("rustc not found — needed for the target triple"); process.exit(1); }
const ext = process.platform === "win32" ? ".exe" : "";
const outFile = join(outDir, `df-daemon-${triple}${ext}`);

const r = spawnSync("bun", [
  "build", join(root, "apps/daemon/src/index.mjs"),
  "--compile", "--outfile", outFile,
], { stdio: "inherit" });
process.exit(r.status ?? 1);

---
title: "Design Factory — Launch & Onboarding Blueprint (faseado)"
type: analysis
version: 1.0.0
status: active
created: 2026-05-25
updated: 2026-05-25
author: frame
squad: hyve-core
tags: [architecture, blueprint, launcher, tauri, onboarding, process-lifecycle]
---

# DF — Launch & Onboarding Blueprint

Synthesis of Scout's research (`squads/_shared/research/technical/2026-05-25-df-single-instance-e-onboarding.md`)
+ the launcher review (`2026-05-25-df-launcher-review.md`) + the #245 code-review
findings. Goal (founder, layperson, OSS, cross-platform): always start fresh
(kill prior instances, port-independent); open without a terminal; a beginner
quick-start.

---

## Phase 1 — Start-fresh-on-launch (replaces the buggy idle-shutdown)

### Decision: REVERT the #245 idle-shutdown + client heartbeat. Recommended.

The #245 idle-shutdown introduced four real bugs (kills long in-flight streams;
`process.exit(0)` leaks ffmpeg/puppeteer/pty children; a clean idle-exit is
mis-reported as "Bridge daemon caiu"; a reused daemon has no exit watcher). It
was solving the wrong end of the problem — "let an orphan clean *itself* up
later." The founder's actual ask is simpler and safer: **on launch, kill the
previous instance and start fresh.**

Why start-fresh-on-launch is strictly better here:
- **Deterministic & safe timing:** the kill runs at startup, when nothing is
  in-flight — it can't truncate a running generation (the idle-shutdown's worst bug).
- **Makes self-cleanup unnecessary:** even if an orphan lingers after a Windows
  window-close, the *next* launch reaps it. You don't need the daemon to self-exit.
- **Removes complexity:** deletes the heartbeat, the idle timer, and the
  reused-daemon-no-watcher hazard entirely.
- **Port-independent:** kills by recorded PID, not by port heuristics.

### Design

1. **Lockfile with identity:** on successful boot, write `.df/daemon.lock` =
   `{ daemonPid, vitePid, bridgePort, vitePort, startedAt }`.
2. **On launch (before resolvePorts):** if the lock exists and `daemonPid` is
   alive, **verify it's really ours** before killing — probe
   `http://127.0.0.1:<bridgePort>/healthz`; only if it responds as our daemon do
   we tree-kill `daemonPid` (and `vitePid`). This guards the **recycled-PID
   footgun** (a dead DF PID reused by an unrelated process). Then delete the lock.
3. **Cross-platform tree-kill (the Windows blocker):** `process.kill(-pid)` does
   not kill process groups on Windows. Two options:
   - **(a) inline, zero-dep (recommended to preserve the launcher's "pure Node
     core" principle):** Windows → `taskkill /PID <pid> /T /F`; Unix → spawn the
     daemon `detached:true` and `process.kill(-pid)` on the group (or walk
     children). ~30 lines.
   - **(b) `tree-kill` dep:** battle-tested (1300+ dependents) but breaks the
     zero-dep rule. Acceptable if (a) proves fiddly.
4. **resolvePorts/reuseDaemon:** with start-fresh, the prior DF instance is gone,
   so 1420/1421 are free → web lands on 1420 (which CORS/guard already trust) and
   the dynamic-port machinery (#244) becomes a rarely-used *fallback* for the
   foreign-process-on-1420 case (keep it — it's correct and cheap). **Drop
   `reuseDaemon`** (always spawn fresh after killing our prior); it's now
   vestigial and was the source of the no-watcher hazard.
5. **Keep** the #245 launcher SIGHUP + `process.on('exit')` reaper (those are
   good, low-risk). **Remove** only the idle-shutdown (daemon) + heartbeat (client).

### Assessment
- **Complexity: LOW–MED.** Effort: ~1–2 days. **Risk: LOW** (startup kill of our
  own verified PID). Residual: recycled-PID — mitigated by the /healthz identity
  check. Dependencies: none (inline) or `tree-kill` (option b).

---

## Phase 2 — Tauri 2 desktop app (the real "no terminal")

### Shape
- **Frontend:** the existing Vite web build, served in Tauri's native WebView.
- **Daemon as sidecar:** Tauri `externalBin`. The daemon is a Node script, and
  Tauri sidecars are **binaries** — so a sub-step compiles the daemon to a single
  binary via **Bun `--compile`** (smaller/faster than Node SEA per benchmark;
  pkg is dead). Tauri ships it per-OS and **owns its lifecycle** — it reaps the
  sidecar when the app quits, *including window-close on Windows* (the exact case
  pure-Node couldn't catch). This is the structural fix for orphans.
- **Single-instance:** `tauri-plugin-single-instance` → native fresh/focus
  behavior; **retires the Phase-1 lockfile+tree-kill** for the app path (keep it
  for the `npm run dev:web` dev path).
- **First-run onboarding (the layperson unlock):** a first-run screen that asks
  for an **API key** (OpenRouter/Anthropic) and writes it via the daemon's
  EXISTING `/config/openrouter` · `/config/anthropic` endpoints. Result: install
  → open → paste key → use. **No CLI, no Node, no terminal.** The CLI path stays
  for power users.
- **Distribution:** per-OS installers (.dmg/.msi/.exe/.AppImage) via **GitHub
  Releases** + Tauri updater.
- **Signing:** Apple Developer **$99/yr** + Windows cert for a clean install; or
  ship unsigned initially with a documented "right-click → Open" workaround.

### Repo changes
- `src-tauri/` (Rust shell, `tauri.conf.json`, icons), a daemon→binary build
  step (Bun compile), CI matrix to build/sign per-OS bundles, the first-run UI,
  and config so the WebView talks to the sidecar daemon.

### Risks
- **WebView quirks:** the app uses an iframe sandbox (`allow-scripts
  allow-same-origin`, per troubleshooting.md) and Three.js/shaders — must be
  validated in WKWebView (macOS) / WebView2 (Windows) / WebKitGTK (Linux).
- **Sidecar lifecycle & ports:** binding/handshake between WebView and the
  bundled daemon; first-launch permissions/AV on Windows.
- **Signing/notarization** setup and cost; Linux packaging targets.
- **Cannot eliminate:** the AI **CLIs** for users who choose the CLI path (only
  the API-key path is CLI-free). Honest framing required in onboarding.

### Assessment
- **Complexity: HIGH (épico).** Effort: weeks. **Risk: MED–HIGH** (signing,
  WebView, sidecar). Dependencies: Bun (build), Rust toolchain, Apple/Windows
  signing accounts.

---

## README / quick-start (didactic)

- **Phase 1:** can only improve the *dev* path clarity — laypeople still need a
  real installer, which doesn't exist until Phase 2. Don't over-promise.
- **Phase 2:** lead the README with a **Download** section (per-OS installers +
  screenshots), "what you need" = just the app + an API key; move `git clone`
  into a "For developers" section. Régua: GPT4All ("removes every decision point").

---

## Sequencing & recommendation

1. **Now → Phase 1:** revert idle-shutdown, add lockfile+identity+tree-kill
   start-fresh. Ships the founder's "always fresh" ask, kills the #245 bugs, days
   of work, low risk. **This is the immediate move.**
2. **Then → Phase 2 (Tauri):** the strategic "real product for laypeople." Treat
   as a planned epic (Bun-compiled daemon sidecar → Tauri shell → single-instance
   → first-run API-key → signing → installers). Tauri's sidecar lifecycle is what
   *structurally* ends the zombie problem on every OS.

Phase 1 and Phase 2 are independent; Phase 1 delivers value regardless of when
Phase 2 starts.

---
title: "Design Factory — Launcher & Startup Architecture Review"
type: analysis
version: 1.0.0
status: active
created: 2026-05-25
updated: 2026-05-25
author: frame
squad: hyve-core
tags: [architecture, launcher, dev-web, process-lifecycle, windows, review]
---

# Design Factory — Launcher & Startup Architecture Review

**Scope:** robustness of `scripts/dev-web.mjs` (launcher), `apps/daemon/src/index.mjs`
(startup + CORS), and `src/lib/origin-guard.ts` + `OriginGuardBanner.tsx`, after PRs
#242 (spawn EINVAL), #243 (port collision), #244 (dynamic-port CORS/guard).

**Product decision (fixed, not under review):** "work on any port" (Option A).

---

## Verdict: CONCERNS

The three merged fixes are correct, surgical, and the dynamic-port design is **sound
and secure**. But the **root cause of the founder's pain — zombie process
accumulation — is not addressed**, and a residual `reuseDaemon` edge can still
reproduce the exact "Origem não permitida" error under specific conditions. A 4th
hardening fix is warranted (P1).

---

## Q1 — Dynamic-port + CORS/origin-guard design

**Sound, localhost-only preserved. One real edge.**

- The launcher is the single source of truth for the resolved web port and propagates
  it to both consumers: `DF_VITE_PORT` → daemon CORS, `VITE_DF_WEB_PORT` → client guard.
  Clean separation.
- **No security hole.** Both env vars are set by the trusted launcher; the daemon only
  ever adds `localhost`/`127.0.0.1` origins; the client guard still rejects production
  origins, wrong protocol, `:3000`, and the bridge port. Posture unchanged.
- **EDGE (CONCERNS) — `reuseDaemon`:** when a healthy DF daemon is reused on 1421, the
  launcher cannot pass the new `DF_VITE_PORT` (no respawn). If this run's web port
  differs from what the reused daemon was configured for, the daemon's CORS rejects the
  origin → "Origem não permitida" returns (server-side). The client guard is fine (this
  run injects `VITE_DF_WEB_PORT` correctly), so it fails silently as a bridge error.
  Narrow, but it is exactly the founder's failure mode under reuse conditions. #244
  explicitly scoped this out.

---

## Q2 — Zombie root cause (the founder's real pain)

**NOT solved. This is the central gap.**

Graceful exits are covered — `shutdown()` kills children on:
- Ctrl+C (`SIGINT`) ✓
- `q` keypress ✓
- daemon or vite dying ✓

**Not covered (all leak the daemon + vite as orphans holding ports):**
- **Window close (X) on Windows** — sends `CTRL_CLOSE_EVENT`; Node does not emit a
  catchable `SIGINT`/`SIGTERM` for it, so `shutdown()` never runs. **This is precisely
  the founder's 1420–1428 pile-up.**
- **`SIGHUP`** (Unix terminal close) — no handler.
- **Launcher hard-crash / `SIGKILL`** — no `process.on('exit')` last-resort kill.

Compounding factors:
- The **daemon has no signal handlers and no idle-shutdown** — once orphaned it runs
  forever holding its port. Nothing ever reaps it.
- Children are spawned without process-group/job-object semantics, so an abnormal
  parent death does not cascade to them.

---

## Q3 — Other fragilities

- **TOCTOU (P2):** `resolvePorts()` picks ports without binding them; an external
  process could grab one before `boot()` binds. #243 fixed the *self*-collision; the
  external race remains (low probability, fails loudly at bind).
- **Health budget (P2):** `waitHealthy` 10s may be tight on a cold Windows machine
  (AV scanning `node` on first run) → false "daemon não respondeu" fatal.
- **`portInUse` (benign):** treats non-`EADDRINUSE` errors as "free".
- **Daemon subprocess orphans (minor):** a hard-killed daemon can orphan its own
  spawned `ffmpeg`/`puppeteer` children.

---

## Recommendations (prioritized)

### P1 — Clean-shutdown hardening (the 4th fix; cures zombies at the root)
Zero-dep, respects the launcher's "pure Node core" principle:
1. `process.on('SIGHUP', …)` → `shutdown()` (Unix terminal close). ~5 min.
2. `process.on('exit', …)` last-resort **synchronous** `child.kill()` (sync is allowed
   in `exit`). Catches more abnormal paths. ~10 min.
3. **Windows window-close** cannot be caught reliably in pure Node. Cure accumulation
   from the other side — pick one:
   - **(a) Daemon idle-shutdown** — daemon self-exits after N min with no client/health
     activity. Orphans self-clean. ~1–2h. *Recommended — true root fix.*
   - **(b) Startup stale-daemon sweep** — on launch, scan the range and reclaim/kill
     stale DF daemons (`isOurDaemon`) instead of climbing to a new port. ~1h. Carries
     process-kill risk (a legit second instance).

   Avoid a Windows job-object lib — it would break the zero-dep principle.

### P1/P2 — `reuseDaemon` CORS edge
When reusing a daemon AND the resolved web port is not one it is known to allow, **do
not reuse — respawn fresh** with the correct `DF_VITE_PORT` (simplest, ~30 min). The
`DF_BRIDGE_ORIGIN=*` escape hatch covers it manually in the meantime.

### P2 — Health budget
Make `HEALTH_TIMEOUT_MS` longer or env-configurable for cold Windows starts. Trivial.

---

## Bottom line for non-technical direction

The 3 fixes made Design Factory **work** on any port. They are good, not weak. What is
still missing is making it **stay clean**: today, closing the window with the X (instead
of Ctrl+C / `q`) leaves invisible processes running that clog ports — which is the whole
reason ports kept climbing to 1429. The P1 hardening (clean shutdown + daemon
idle-shutdown) is the responsible follow-up and is low-to-moderate effort. It is a
*nice-to-have*, not a fire: the tool is usable today.

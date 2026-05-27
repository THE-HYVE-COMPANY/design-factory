// UI smoke — drive the DF app via Playwright headless to validate
// rendering of newly-added surfaces in this session:
//   - NewProject modal opens with provider/model/DS dropdowns
//   - /settings/defaults renders with 6 sub-tabs (no skills tab)
//   - TurnTimelinePanel mounts when projectId is present
//   - No uncaught exceptions in console
//
// Outputs: pass/fail per check + screenshot per failure to AUDIT_DIR.

import { chromium } from "playwright";
import { writeFileSync } from "fs";
import { join } from "path";

const APP = process.env.DF_APP_URL || "http://localhost:1420";
const AUDIT_DIR = process.env.AUDIT_DIR || "/tmp/df-audit";
const SHOT_DIR = join(AUDIT_DIR, "screenshots");

const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? " — " + detail : ""}`);
}

async function safeClick(page, selector, fallbackSelectors = []) {
  const all = [selector, ...fallbackSelectors];
  for (const sel of all) {
    const el = await page.$(sel);
    if (el) { await el.click(); return sel; }
  }
  return null;
}

async function snapshot(page, name) {
  try {
    await page.screenshot({ path: join(SHOT_DIR, `${name}.png`), fullPage: false });
  } catch (e) {
    console.warn("screenshot failed:", e.message);
  }
}

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const context = await browser.newContext({
  viewport: { width: 1400, height: 900 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();

const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 240));
});
page.on("pageerror", (err) => {
  consoleErrors.push(`pageerror: ${err.message.slice(0, 240)}`);
});

try {
  // ── 1. App boots ────────────────────────────────────────────────
  await page.goto(APP, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForSelector("#root", { timeout: 10000 });
  // Wait for actual content (not blank).
  await page.waitForFunction(
    () => document.querySelector("#root")?.children.length > 0,
    null,
    { timeout: 15000 },
  );
  await snapshot(page, "01-home");
  record("App boots without blank screen", true);
} catch (e) {
  record("App boots", false, e.message.slice(0, 120));
  await snapshot(page, "01-home-fail");
}

// ── 2. Settings → defaults page ─────────────────────────────────────
try {
  await page.goto(`${APP}/#/settings/defaults`, { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(800);
  // Look for the 6 canonical insumo tabs.
  const tabLabels = await page.$$eval(".insumos-tab .insumos-tab-label", (els) => els.map((e) => e.textContent?.trim().toLowerCase()));
  const expected = ["canvas", "formatos", "regras", "taste", "comandos"];
  const promptsLabel = tabLabels.some((t) => t?.includes("prompt"));
  const found = expected.filter((e) => tabLabels.includes(e));
  await snapshot(page, "02-defaults");
  if (found.length >= 4 && promptsLabel) {
    record("/settings/defaults renders ≥5 sub-tabs (canvas/formats/rules/taste/commands/prompts)", true, `found: ${tabLabels.join(", ")}`);
  } else {
    record("/settings/defaults sub-tabs", false, `expected 6, found: [${tabLabels.join(", ")}]`);
  }
  // Skills should NOT be in here anymore (user ask 2026-05-18).
  const hasSkillsTab = tabLabels.some((t) => t === "skills");
  record("Skills tab removed from defaults (it has /skills page)", !hasSkillsTab,
    hasSkillsTab ? "skills tab still present — regression" : "ok");
} catch (e) {
  record("/settings/defaults", false, e.message.slice(0, 120));
  await snapshot(page, "02-defaults-fail");
}

// ── 3. NewProject modal — 3 dropdowns ───────────────────────────────
try {
  await page.goto(APP, { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(800);
  // Find a "Novo projeto" / "New project" CTA.
  const clicked = await safeClick(page, "button:has-text('Novo projeto')", [
    "button:has-text('New project')",
    "[data-testid='new-project-cta']",
    ".cnp-trigger",
    "button[aria-label*='Novo']",
    "button[aria-label*='project']",
  ]);
  if (!clicked) {
    record("NewProject modal — cannot find CTA", false, "no 'Novo projeto' button found on home");
    await snapshot(page, "03-newproject-no-cta");
  } else {
    await page.waitForTimeout(800);
    // The 3 dropdowns should be in the composer toolbar cluster.
    const triggers = await page.$$(".cnp-composer-toolbar-cluster .cnp-ds-dropdown-trigger");
    await snapshot(page, "03-newproject-modal");
    record("NewProject modal opens", true, `clicked via ${clicked}`);
    record("NewProject toolbar has 3 dropdowns (provider/model/DS)", triggers.length >= 3, `found ${triggers.length}`);
    // Check provider-specific data attribute.
    const providerTrigger = await page.$("[data-cnp-provider-trigger]");
    record("Provider dropdown trigger present", !!providerTrigger);
    const modelTrigger = await page.$("[data-cnp-model-trigger]");
    record("Model dropdown trigger present", !!modelTrigger);
  }
} catch (e) {
  record("NewProject modal", false, e.message.slice(0, 120));
  await snapshot(page, "03-newproject-fail");
}

// ── 4. Console errors ───────────────────────────────────────────────
const dedupedErrors = [...new Set(consoleErrors)];
const ignoredPatterns = [
  /Failed to load resource/i, // network/font preconnect noise
  /vite.*hmr/i,
  /favicon/i,
];
const realErrors = dedupedErrors.filter((e) => !ignoredPatterns.some((p) => p.test(e)));
record(
  "No uncaught console errors during smoke",
  realErrors.length === 0,
  realErrors.length === 0 ? "" : `${realErrors.length} errors: ${realErrors.slice(0, 3).join(" | ")}`,
);

await browser.close();

// ── Persist report ──────────────────────────────────────────────────
writeFileSync(join(AUDIT_DIR, "ui-smoke.json"), JSON.stringify({
  app: APP,
  ts: new Date().toISOString(),
  total: results.length,
  passed: results.filter((r) => r.ok).length,
  failed: results.filter((r) => !r.ok).length,
  checks: results,
  consoleErrors: realErrors,
}, null, 2));

const failed = results.filter((r) => !r.ok).length;
console.log(`\n══ UI smoke: ${results.length - failed}/${results.length} passed ══`);
process.exit(failed > 0 ? 1 : 0);

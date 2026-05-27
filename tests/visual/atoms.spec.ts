import { test, expect } from "@playwright/test";

/**
 * Atom parity sweep.
 *
 * Each test navigates DevScreen to a specific atom tab, scrolls content into
 * view, and captures a screenshot scoped to the atoms container — NOT the
 * whole page, so tabs-nav chrome differences don't pollute the diff.
 *
 * Reference screenshots live in tests/visual/__snapshots__ and are generated
 * once via `npx playwright test --update-snapshots` after Gate signs off on
 * the harness match. Subsequent runs fail if the diff exceeds 5%.
 */

const ATOMS: Array<{ label: RegExp; name: string }> = [
  { label: /button/i,       name: "button" },
  { label: /card/i,          name: "card" },
  { label: /input/i,         name: "input" },
  { label: /modal/i,         name: "modal" },
  { label: /chip/i,          name: "chip" },
  { label: /tab \/ nav/i,    name: "tab-nav" },
  { label: /banner/i,        name: "banner" },
  { label: /loader/i,        name: "loader" },
  { label: /foundations/i,   name: "foundations" },
];

test.describe("DS v0.2 atoms", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?dev=1");
    await page.waitForSelector('[role="tablist"]');
  });

  for (const { label, name } of ATOMS) {
    test(`atom: ${name}`, async ({ page }) => {
      await page.getByRole("tab", { name: label }).first().click();
      // Let motion settle — 280ms matches the longest standard transition.
      await page.waitForTimeout(320);
      // Scope the capture to the scrollable content below the header/nav.
      const container = page.locator("main, [data-panel], div").filter({ has: page.locator("h2") }).first();
      await expect(container).toHaveScreenshot(`${name}.png`, {
        animations: "disabled",
      });
    });
  }
});

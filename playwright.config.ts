import { defineConfig, devices } from "@playwright/test";

/**
 * Visual parity tests for DS v0.2 atoms against the components-ds artifact.
 *
 * Expectation: DevScreen (served via `npm run dev` with `?dev=1`) renders the
 * same atom set as the artifact at localhost:4200/df-components-ds-2026-04-21/.
 *
 * Runs:
 *   npx playwright install chromium   # one-time
 *   npx playwright test
 *
 * The `webServer` block boots Vite on 1420 + serves the artifact preview on
 * 4200 before tests run. If 4200 is already up (Chief keeps it alive), the
 * second server is skipped.
 */
export default defineConfig({
  testDir: "./tests/visual",
  snapshotDir: "./tests/visual/__snapshots__",
  outputDir: "/tmp/visual-tests",
  fullyParallel: false,
  reporter: [["list"], ["html", { open: "never", outputFolder: "/tmp/visual-tests-html" }]],
  use: {
    baseURL: "http://localhost:1420",
    viewport: { width: 1280, height: 900 },
    colorScheme: "dark",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.05, // 5% per plan done criterion
      threshold: 0.2,
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "npm run dev",
      port: 1420,
      reuseExistingServer: true,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});

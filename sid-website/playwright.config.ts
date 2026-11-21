import { defineConfig } from "@playwright/test";

// Tests d'affichage (Lot 95) : voir tests/affichage.spec.ts.
export default defineConfig({
  testDir: "tests",
  outputDir: "test-results",
  timeout: 60_000,
  workers: 3,
  reporter: [["list"]],
  use: { browserName: "chromium" },
});

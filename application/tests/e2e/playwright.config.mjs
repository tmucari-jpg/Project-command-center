import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";

const appRoot = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig({
  testDir: "./",
  testMatch: "*.spec.mjs",
  fullyParallel: false,
  outputDir: appRoot + "/test-results",
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"], ["html", { open: "never", outputFolder: appRoot + "/playwright-report" }]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:3100",
    trace: "on",
    screenshot: "on",
  },
  webServer: [
    {
      command: "node tests/e2e/mock-supabase.mjs",
      cwd: appRoot,
      url: "http://127.0.0.1:43187/__qa/health",
      reuseExistingServer: false,
      timeout: 15_000,
    },
    {
      command: "npm run start -- -p 3100",
      cwd: appRoot,
      url: "http://127.0.0.1:3100/client-diagnostic/" + "A".repeat(43),
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:43187",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "qa-isolated-test-only",
      },
    },
  ],
});

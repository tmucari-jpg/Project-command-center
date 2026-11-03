import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./",
  testMatch: "*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "node tests/e2e/mock-supabase.mjs",
      url: "http://127.0.0.1:43187/__qa/health",
      reuseExistingServer: false,
      timeout: 15_000,
    },
    {
      command: "npm run start -- -p 3100",
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

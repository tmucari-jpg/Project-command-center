import { defineConfig } from '@playwright/test';
import path from 'node:path';
export default defineConfig({
  testDir: __dirname,
  testMatch: 'gie360-browser-smoke.spec.ts',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  outputDir: path.resolve(__dirname, '../../validation-browser-artifacts'),
  reporter: [['list'], ['json', { outputFile: path.resolve(__dirname, '../../validation-browser.json') }]],
  use: {
    baseURL: 'http://localhost:3000',
    browserName: 'chromium',
    viewport: { width: 1280, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'off',
    video: 'off',
  },
});

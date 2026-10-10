import { defineConfig } from '@playwright/test';

// End-to-end tests of the study flow against the production build (vite preview).
// Speech is simulated in the page (tests/e2e/fake-speech.js); Sefaria is blocked so
// the app runs on its built-in snapshot and the results are deterministic.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 2,
  use: {
    baseURL: 'http://127.0.0.1:4173/chavruta/',
    locale: 'he-IL',
    viewport: { width: 1400, height: 900 },
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort --host 127.0.0.1',
    cwd: '..',
    url: 'http://127.0.0.1:4173/chavruta/',
    reuseExistingServer: true,
  },
});

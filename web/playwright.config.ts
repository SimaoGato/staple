import { defineConfig, devices } from '@playwright/test';

// Runs against the production build (vite preview), so e2e covers what ships.
const port = 4173;

export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.e2e.ts', // keeps Vitest (*.test.ts) and Playwright apart
  forbidOnly: !!process.env.CI,
  use: { baseURL: `http://localhost:${port}` },
  // shortcut: Chromium only; add firefox/webkit projects when cross-browser bugs matter.
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && vite preview --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
  },
});

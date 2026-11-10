import { defineConfig, devices } from '@playwright/test';

// Runs against a production build (mode e2e only adds the window.staple test hook).
const port = 4173;
// A second, default-mode build (no hook, no PDFium) for the prod-*.e2e.ts checks.
const prodPort = 4174;

export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.e2e.ts', // keeps Vitest (*.test.ts) and Playwright apart
  forbidOnly: !!process.env.CI,
  use: { baseURL: `http://localhost:${port}` },
  // shortcut: Chromium only; add firefox/webkit projects when cross-browser bugs matter.
  projects: [
    {
      name: 'chromium',
      testIgnore: 'prod-*.e2e.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-prod',
      testMatch: 'prod-*.e2e.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: `http://localhost:${prodPort}`,
      },
    },
  ],
  webServer: [
    {
      // Builds wasm once, then both bundles (no race on src/wasm-pkg), then serves the e2e one.
      command: `npm run build:pdfium && npm run build:wasm && vite build --outDir dist-prod && vite build --mode e2e && vite preview --port ${port} --strictPort`,
      url: `http://localhost:${port}`,
      reuseExistingServer: false, // a stale non-e2e build on this port lacks window.staple
      timeout: 300_000,
    },
    {
      // Waits for the first server's builds (dist-prod exists only then), by polling its url.
      // Failure mode: if the first command fails, this one polls until its own cap (300 s) and the
      // run reports a timeout, not the build error: read the first server's output.
      command: `node scripts/wait-for-url.mjs http://localhost:${port} && vite preview --outDir dist-prod --port ${prodPort} --strictPort`,
      url: `http://localhost:${prodPort}`,
      reuseExistingServer: false,
      timeout: 300_000,
    },
  ],
});

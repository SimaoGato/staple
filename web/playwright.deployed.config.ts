import { defineConfig, devices } from '@playwright/test';

// Post-deploy check against the live site: E2E_BASE_URL=https://... npm run test:e2e:deployed
export default defineConfig({
  testDir: 'e2e',
  testMatch: 'headers.e2e.ts',
  use: { baseURL: process.env.E2E_BASE_URL },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});

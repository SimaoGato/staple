import { defineConfig } from 'vitest/config';

// Deep links: Vite dev/preview serve index.html for unknown paths (SPA fallback).
// The Cloudflare equivalent is configured in STORY-05.
export default defineConfig({
  test: { environment: 'jsdom' },
});

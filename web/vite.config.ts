import { defineConfig } from 'vitest/config';

// Deep links: Vite dev/preview serve index.html for unknown paths (SPA fallback).
// The Cloudflare equivalent is configured in STORY-05.
export default defineConfig({
  worker: { format: 'es' },
  // Never inline the tiny .wasm as a data: URL: CSP forbids it; the wasm must be a real, separately fetched asset.
  build: { assetsInlineLimit: 0 },
  test: { environment: 'jsdom' },
});

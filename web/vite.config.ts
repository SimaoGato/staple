import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// `vite preview` ignores Cloudflare's _headers: reuse it so e2e runs under the real headers.
// shortcut: reads only the single `/*` block; upgrade if _headers gains path rules.
const headers = Object.fromEntries(
  readFileSync('public/_headers', 'utf8')
    .split('\n')
    .filter((l) => /^\s+\S+:\s/.test(l))
    .map((l) => l.trim().split(/:\s+/, 2) as [string, string]),
);

// Deep links: Vite dev/preview serve index.html for unknown paths (SPA fallback).
// Cloudflare does the same via not_found_handling in wrangler.jsonc.
export default defineConfig({
  worker: { format: 'es' },
  // Never inline the tiny .wasm as a data: URL: CSP forbids it; the wasm must be a real, separately fetched asset.
  build: { assetsInlineLimit: 0 },
  preview: { headers },
  test: { environment: 'jsdom' },
});

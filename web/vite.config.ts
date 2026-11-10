import { cpSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';

// `vite preview` ignores Cloudflare's _headers: reuse it so e2e runs under the real headers.
// shortcut: reads only the single `/*` block; upgrade if _headers gains path rules.
const headers = Object.fromEntries(
  readFileSync(join(import.meta.dirname, 'public/_headers'), 'utf8')
    .split('\n')
    .filter((l) => /^\s+\S+:\s/.test(l))
    .map((l) => {
      const t = l.trim();
      const i = t.indexOf(':');
      return [t.slice(0, i), t.slice(i + 1).trim()] as [string, string];
    }),
);

// Spike: the prebuilt PDFium (fetched by scripts/fetch-pdfium-wasm.sh) is copied
// into the build only in mode e2e, so the production build never contains or references it.
const copyPdfium = (outDir: string): Plugin => ({
  name: 'copy-pdfium',
  apply: 'build',
  closeBundle() {
    const src = join(import.meta.dirname, 'pdfium-wasm');
    if (!existsSync(src))
      throw new Error(`${src} missing: run \`npm run build:pdfium\` first`);
    cpSync(src, join(import.meta.dirname, outDir, 'pdfium'), {
      recursive: true,
    });
  },
});

// Deep links: Vite dev/preview serve index.html for unknown paths (SPA fallback).
// Cloudflare does the same via not_found_handling in wrangler.jsonc.
export default defineConfig(({ mode }) => ({
  worker: { format: 'es' },
  plugins: mode === 'e2e' ? [copyPdfium('dist')] : [],
  // Never inline the tiny .wasm as a data: URL: CSP forbids it; the wasm must be a real, separately fetched asset.
  build: { assetsInlineLimit: 0 },
  preview: { headers },
  test: { environment: 'jsdom' },
}));

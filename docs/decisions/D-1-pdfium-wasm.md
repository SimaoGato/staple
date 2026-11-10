# D-1: PDFium in the browser (WASM)

**Decision: keep PDFium via `pdfium-render`, loaded lazily inside the Worker, only by tools that render.** Date: 2026-11-10. Spike: STORY-11. Confirms PRD D-1.

## What was built

- **Prebuilt PDFium WASM**: `paulocoutinhox/pdfium-lib` release `8046d`, asset `wasm.zip`, sha256 `062d10055de90a01120acf307ce16e0022021a32203f4aeae4877750f9a08427`. `scripts/fetch-pdfium-wasm.sh` downloads it, checks the hash and writes `pdfium.esm.js` + `pdfium.esm.wasm` to `web/pdfium-wasm/` (gitignored, nothing committed). The bblanchon WASM builds have a fixed heap and fail after a few pages (`pdfium-render` README), so they were not tried.
- **Path A (chosen)**: `crates/staple-pdfium-wasm` (`pdfium-render` 0.9.5, wasm32 only) built by `npm run build:wasm`. JS calls `initialize_pdfium_render(pdfiumModule, wasmBindgenInit, false)` once, then Rust opens documents and renders. It worked at the first attempt, so path B (TypeScript calling the Emscripten exports) was not needed.
- **Spike only**: the worker code (`web/src/worker/pdfium.ts`), the `window.staple.pdfiumRenderPage` hook and the copy of the PDFium files into the build exist only under `import.meta.env.MODE === 'e2e'`. The production build contains no PDFium file or reference (Playwright project `chromium-prod`, `web/e2e/prod-no-pdfium.e2e.ts`).

## CSP finding

No CSP change and no glue patch. `pdfium.esm.js` is an ES module with no `eval` or `new Function`; it runs in a module Worker under `script-src 'self' 'wasm-unsafe-eval'` and loads its `.wasm` from `self` (`new URL('pdfium.esm.wasm', import.meta.url)`). `pdfium-render` reaches the module through `js_sys::global()`, so it works in a Worker (no `window`). The e2e test fails on any console error or `securitypolicyviolation` event and passes.

## Sizes (AC3)

Command: `node` with `zlib` (`gzip` level 9, `brotli` quality 11) on each file. Sizes in bytes.

| File | Raw | gzip | brotli |
|---|---:|---:|---:|
| `pdfium.esm.wasm` (PDFium engine) | 5,298,237 | 2,470,216 | 1,908,738 |
| `pdfium.esm.js` (Emscripten glue) | 256,055 | 46,458 | 36,672 |
| `staple_pdfium_wasm_bg.wasm` (Rust `pdfium-render` bindings) | 4,201,413 | 301,689 | 180,830 |
| `staple_pdfium_wasm.js` (wasm-bindgen glue) | 10,291 | 3,618 | 3,214 |
| **Total** | **9,765,996** | **2,821,981** | **2,129,454** |

The tiny spike-only worker chunk (`pdfium-*.js`, 911 B) is not counted. Totals are about 9.3 MiB raw, 2.7 MiB gzip, 2.0 MiB brotli.

`vite preview` sends no `Content-Encoding`; the figures above are what a compressing host sends. Cloudflare Workers Static Assets compresses with gzip or brotli for clients that accept it (not measured here).

The Rust bindings wasm is 4.2 MB raw only because `pdfium-render` links the whole PDFium API surface. It compresses well (181 KB brotli). Path B would drop it. Decide in EPIC-06.

## Load time (AC4)

Measured inside the Worker with `performance.now()` around the whole load: dynamic `import()` of the glue, fetch and compile of `pdfium.esm.wasm`, PDFium init, then fetch, compile and init of the Rust bindings wasm. Median of 5 runs. Served by `vite preview` on localhost (no network latency, no compression), so a real connection adds the download time.

| Cache | Runs (ms) | Median |
|---|---|---:|
| Cold (new browser context per run, `Network.setCacheDisabled`) | 91.6, 90.3, 90.8, 90.1, 90.8 | **90.8 ms** |
| Warm (same context, page reload after a priming load) | 79.3, 77.9, 76.9, 76.8, 77.3 | **77.3 ms** |

On a 10 Mbit/s link the 2.0 MiB brotli payload adds about 1.7 s to the cold figure; on 50 Mbit/s about 0.3 s.

## Render time (AC5)

All 50 pages of `bench/refset/image-heavy-20mb.pdf`, one run per DPI after loading. The timer covers `page.render()` plus the RGBA copy out of PDFium's bitmap, per page. It excludes opening the document (17 ms at 96 DPI, 14 ms at 150 DPI) and moving pixels to the main thread.

| DPI | Median per page | Total (50 pages) |
|---|---:|---:|
| 96 (thumbnail) | 41.0 ms | 2054 ms |
| 150 | 43.2 ms | 2165 ms |

Page time is almost flat across DPI because the pages are one full-page JPEG each: decoding the image dominates. Text-heavy pages will scale differently; re-measure in EPIC-06.

## Lazy loading (AC6)

- Load PDFium only when a rendering tool opens (thumbnails, PDF to images): the Worker runs `await import(<url of pdfium.esm.js>)` then the bindings wasm, on the first render job, and caches the promise. A failed load clears the cache so the next job retries (as `web/src/worker/pdfium.ts`).
- Never on home or the non-rendering tools. Start the load when the tool page opens, before the user picks a file, to hide the cost.
- Serve the glue and `.wasm` as plain assets (`assetsInlineLimit: 0`, no `data:` URLs).
- EPIC-08 (offline) must precache both PDFium files; they are the largest assets.

**First-load budget (PRD section 7, under 3 s on broadband).** The budget concerns the first load of the site. The home page requests no PDFium file (checked by Playwright on the production build), so it is unaffected. For rendering tools the load itself is about 0.1 s of CPU (above); the 2.0 MiB brotli download is about 0.3 s on 50 Mbit/s and 1.7 s on 10 Mbit/s. The budget holds for those tools on broadband, provided the host compresses. Without compression the download is 9.3 MiB; check that the Cloudflare response is compressed before EPIC-06 relies on this.

## Licences

PDFium is BSD-3-Clause/Apache-2.0; `pdfium-render` is MIT/Apache-2.0. `cargo deny check` passes. The only new licence is ISC for `libloading`, a non-wasm32 dependency of `pdfium-render` that cargo-deny sees but the wasm never contains (per-crate exception in `deny.toml`). The `wasm.zip` release has no licence file; before shipping a rendering tool, include PDFium's third-party notices (EPIC-10 about/licence page).

## Machine

AMD Ryzen 7 5700X3D, 8 cores / 16 threads, 15 GB RAM, WSL2 (Linux 6.6.114), Chromium 158.0.8127.18 (Playwright). Not measured on the M1 reference laptop: expect slower render times.

Re-run: `scripts/fetch-pdfium-wasm.sh`, `cargo run -p staple-bench --release --bin gen-refset`, then in `web/`: `PDFIUM_SPIKE=1 npx playwright test pdfium-spike -g measure --workers=1` (prints one `PDFIUM_SPIKE {json}` line).

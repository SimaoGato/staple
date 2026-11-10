---
id: STORY-11
epic: EPIC-02
status: draft
pr: null
---

# Spike: PDFium WASM build size, load time and render time

## User story
As a Staple developer, I want to know how big PDFium's WASM build is, how long it takes to load, and how fast it renders a page in the browser, so that EPIC-06 can set budgets for thumbnails and PDF to images, and lazy-load PDFium the right way.

## Context
EPIC-02 (`docs/epics/EPIC-02-engine-spikes.md`). PRD D-1 (PDFium via `pdfium-render`, loaded only in tools that render), §7 Performance (first load under 3 s; heavy codecs load only when a tool needs them), FR-17 and FR-19. Builds on the STORY-04 worker bridge and runs under the STORY-05 CSP and COOP/COEP headers. EPIC-06 depends on the outcome.

## Acceptance criteria
1. Given the spike build, when `vite build` and `vite preview` run, then a page opened only in `--mode e2e` loads PDFium inside the Web Worker and renders page 1 of the 50-page reference PDF to an image, with no CSP violation in the console. A Playwright test covers this.
2. Given the home page in the production build, when it loads, then no PDFium file is requested. A Playwright test that watches network requests covers this.
3. Given the PDFium WASM build, when the spike is done, then `docs/decisions/D-1-pdfium-wasm.md` records the size of every file PDFium needs (`.wasm` and JS glue): raw, gzip and brotli.
4. Given Chrome on the developer's machine, when PDFium is loaded with a cold cache and then a warm cache, then the record gives the median of 5 runs for each (download plus compile plus initialise, measured inside the worker).
5. Given the 50-page reference PDF, when every page is rendered at 96 DPI (thumbnail size) and at 150 DPI, then the record gives the median time per page and the total for each DPI.
6. Given the measurements, when the spike is done, then the record says how to lazy-load PDFium (for example, a dynamic import inside the worker, started when a rendering tool opens), and whether the PRD first-load budget still holds for those tools.
7. Given the measurements, when the spike is done, then PRD D-1 links the decision record and states the size and load-time figures.
8. Given the spike's new dependencies and files, when CI runs, then all existing gates pass and every new dependency passes `cargo deny`.

## Out of scope
- Thumbnail UI, PDF to images, ZIP output (EPIC-06).
- Compression with PDFium (STORY-10).
- Multi-threaded PDFium or SharedArrayBuffer use.
- Production-quality loader code: the spike may be simplified, behind the `e2e` test hook only.

## Technical notes
- `pdfium-render` on WASM binds to a separately built `pdfium.wasm` plus its Emscripten JS glue, not to a Rust-compiled PDFium. Check the docs for the `Cargo.lock` version for the exact setup (CLAUDE.md rule).
- Prebuilt PDFium WASM releases exist. Use one, pinned by version and checksum, rather than building PDFium from source. Do not commit the binary if a fetch step works. If committing is simpler, record the size impact on the repo.
- CSP allows `'wasm-unsafe-eval'` but no `unsafe-eval`. Emscripten glue may need changes or a build flag to run under it; this is a key finding for the record.
- Vite must not inline `.wasm` (`assetsInlineLimit: 0`); keep it that way for the PDFium file.
- Test hook only exists in `vite build --mode e2e`; the deployed site has no hook (CLAUDE.md).
- Licences: PDFium is BSD-3/Apache-2.0, `pdfium-render` is MIT/Apache-2.0. Confirm with `cargo deny` and note the PDFium binary licence in the record.

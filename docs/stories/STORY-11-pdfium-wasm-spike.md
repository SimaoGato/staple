---
id: STORY-11
epic: EPIC-02
status: in_review
pr: 12
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

## Implementation Plan

**Affected areas**: backend (Rust: new spike crate, `deny.toml`), frontend (worker, e2e hook, Vite config, Playwright config), infra (CI fetch and gen-refset steps, `_headers` check), docs (D-1 record, PRD D-1).

**Approach.** Fetch a prebuilt PDFium WASM (Emscripten `.wasm` + JS glue) from `paulocoutinhox/pdfium-lib` releases (the `pdfium-render` 0.9.5 README recommends it: growable heap; the bblanchon WASM builds OOM on more than a few pages). Pin version and sha256 in a script; do not commit the binary (gitignore it). Drive it from a separate Rust wasm crate using `pdfium-render` 0.9.5 (wasm32 path, `PdfiumRenderWasmState`, worker-compatible since 0.7.14). Keep it out of `staple-wasm` so the main wasm stays small and home stays PDFium-free.

**Fixed decisions**
- AC1 input is `bench/refset/image-heavy-20mb.pdf`. Confirmed: `Spec::default().image_pages == 50` (`crates/staple-bench/src/lib.rs:112`) and `gen-refset` writes that file (line 301). No `pages-50.pdf` exists; do not add one. `pages-200.pdf` and `text-1mb.pdf` are not 50 pages. Measurements (AC4, AC5) use the same file.
- `bench/refset/` is gitignored, so CI must generate it: add a `cargo run -p staple-bench --release --bin gen-refset` step (working-directory repo root) in the `web` job of `ci.yml`, before "Install Playwright Chromium". The Rust toolchain is already installed in that job. The AC1 test never skips when `process.env.CI` is set: it throws if the file is missing. Locally (no `CI`) it skips with a clear message to run `gen-refset`.
- AC2 mechanism: a second Playwright project and a second webServer for the default-mode production build (see step 3). Every PDFium import, copy and hook is gated on `import.meta.env.MODE === 'e2e'` so Vite tree-shakes it out of the default build. The `vite.config.ts` copy step is skipped when `mode !== 'e2e'`.

**Steps (test-first)**

1. GATE (throwaway, before any crate, CI or doc work). Prove PDFium loads and renders 1 page inside a Worker under the real CSP.
   - Read `pdfium-render` 0.9.5 source (`~/.cargo/registry/src/*/pdfium-render-0.9.5/src`, WASM binding code and the upstream `examples/` at the 0.9.5 tag) for the init contract: which global the glue must expose (`Module`, `wasmTable`/`wasmExports`, `malloc`/`free`) and how it behaves without `window`.
   - Run `fetch-pdfium-wasm.sh` (step 4, written first as a minimal version) and build a scratch page plus worker (in the scratchpad or a local uncommitted branch, served with the `web/public/_headers` CSP) that loads the glue and `.wasm`, opens `image-heavy-20mb.pdf` and renders page 1 to RGBA. Check no CSP violation in the console.
   - Try path A: `pdfium-render` wasm path from a Rust wasm crate in a Worker. If it fails, try path B: TypeScript calls the Emscripten exports directly (`FPDF_LoadMemDocument`, `FPDF_LoadPage`, `FPDFBitmap_*`, `FPDF_RenderPageBitmap`) with no Rust crate.
   - STOP CONDITION. Decide the path now and record it in this plan before step 2:
     - Path A works: continue with steps 5 to 10 as written.
     - Path A fails, path B works: delete step 5 (no new crate, no `deny.toml` change, no wasm build script), and put the renderer in `web/src/worker/pdfium.ts`. Steps 6 to 10 keep their meaning, minus the crate. Record the reason as a finding for D-1.
     - Neither works under the CSP (for example the glue needs `eval` and the prebuilt has no `-sDYNAMIC_EXECUTION=0`): stop. Do not weaken the CSP. The spike result is the finding: write D-1 with sizes (AC3) and the blocker, and flag AC1, AC4, AC5 as unmet to the human. Do not do steps 2 to 8.
   - Discard the scratch code; keep the findings.
   - GATE RESULT: path A works. Prebuilt `pdfium-lib` 8046d `pdfium.esm.js` (ES module, no `eval`/`new Function`, no `window` need in a Worker) runs under the real CSP; `pdfium-render` 0.9.5 binds via `initialize_pdfium_render(pdfiumModule, wasmBindgenInit, false)` with no glue patch or flag. Continue with steps 5 to 10 as written (wasm crate built by `build:wasm`, because `tsc` in `npm run build` needs `src/pdfium-pkg`).
2. Write the failing Playwright test `web/e2e/pdfium-spike.e2e.ts` (AC1), project `chromium` on port 4173 (e2e build): `window.staple.pdfiumRenderPage(bytes, 0, 96)` returns width, height and non-blank pixels (not all one colour). A `console` (error) / `pageerror` listener and a `securitypolicyviolation` listener fail the test on any hit (covers CSP violations). Input `bench/refset/image-heavy-20mb.pdf`; missing file: `throw` if `process.env.CI`, else `test.skip` with the `gen-refset` hint.
3. Write the failing home test (AC2) and its Playwright wiring.
   - `web/playwright.config.ts`: change `webServer` to an array of two. Server 1 unchanged (port 4173, `vite build --mode e2e`). Server 2, port 4174: `vite build --outDir dist-prod && vite preview --outDir dist-prod --port 4174 --strictPort`, default mode, `reuseExistingServer: false`. To avoid a race on `src/wasm-pkg/`, server 1's command runs `build:wasm` once, then both builds (`vite build --mode e2e` and `vite build --outDir dist-prod`), then the 4173 preview; server 2 only runs `vite preview --outDir dist-prod --port 4174 --strictPort` and its `url` check waits until the build is done. Add `dist-prod` to `.gitignore`.
   - Projects: `chromium` (baseURL 4173, `testIgnore: 'prod-*.e2e.ts'`) and `chromium-prod` (baseURL 4174, `testMatch: 'prod-*.e2e.ts'`).
   - `web/e2e/prod-no-pdfium.e2e.ts` (runs on 4174): `page.on('request')` collects URLs; open `/`, wait for `networkidle`; assert zero URLs match `/pdfium/i`. Also in the test (Node side): walk `dist-prod` recursively; assert no file name matches `/pdfium/i`, and no `.js`/`.wasm` content contains `pdfium` (case-insensitive). Assert the walked file count is above 0 so an empty dir cannot pass.
   - Also assert on the e2e project (4173) that home requests no PDFium before the hook call.
4. `scripts/fetch-pdfium-wasm.sh` (curl + `sha256sum -c`, pinned URL) writing to `web/pdfium-wasm/` (gitignored). npm script `build:pdfium` runs it; the e2e webServer command and CI call it. Gate in `web/vite.config.ts`: turn the config into `defineConfig(({ mode }) => ...)`; copy the `.wasm` and glue into the build output (small inline plugin, `closeBundle` or `generateBundle`, or `publicDir` extra) only when `mode === 'e2e'`. In default mode the copy step is skipped and nothing references `web/pdfium-wasm/`. Keep `assetsInlineLimit: 0`.
5. (Path A only) New crate `crates/staple-pdfium-wasm` (cdylib, `pdfium-render` with `default-features = false`, `image_latest`, wasm bindings; workspace lints). Exposes `init()` and `render_page(bytes, index, dpi) -> {w, h, rgba}`. No `unwrap`/`expect`/`panic`; typed errors. Guard with `#[cfg(target_arch = "wasm32")]` so native `cargo test --workspace` and clippy pass (`unsafe_code` forbidden: safe API only). Extend the `build:wasm` npm script to build both crates and run `wasm-bindgen --target web --out-dir src/pdfium-pkg` (gitignored) for the PDFium one; it runs before `dev` and `build`, so `tsc` finds the package (trade-off: a little extra build time in production builds).
6. Worker: `web/src/worker/pdfium.ts` (spike), reached only through `if (import.meta.env.MODE === 'e2e') { await import('./pdfium') }` in the worker and a matching gate on the `window.staple.pdfiumRenderPage` hook in `main.ts` and the message types in `protocol.ts`/`client.ts`. The gate expression must be the literal `import.meta.env.MODE === 'e2e'` so Vite replaces it with `false` and drops the branch. CSP: `script-src 'self' 'wasm-unsafe-eval'`, no `unsafe-eval`; use the step 1 finding (flag or glue patch) and record it. Add Vitest only if pure logic appears.
7. Measurement test (not a gate; behind `PDFIUM_SPIKE=1`, as `compress-spike`) in `web/e2e/pdfium-spike.e2e.ts`: inside the worker, `performance.now()` around fetch + `WebAssembly.compile` + init.
   - AC4: cold = new browser context per run with cache disabled (CDP `Network.setCacheDisabled`); warm = same context, reload. 5 runs each, median.
   - AC5: all 50 pages at 96 and 150 DPI; median per page and total, per DPI. Time render plus pixel extraction, and say so.
   - AC3 sizes: `stat`, `gzip -9`, `brotli -q 11` of the `.wasm` and the glue. Note the content-encoding served if measurable from preview.
8. Write `docs/decisions/D-1-pdfium-wasm.md` (style of `D-2-compression-engine.md`): pinned release + checksum; which path (A or B) and why; size table (raw/gzip/brotli per file); load medians (cold/warm); render table (96/150 DPI); CSP finding; lazy-load recipe (dynamic `import()` inside the worker, started when a rendering tool opens, never on home; precache in EPIC-08); verdict on the PRD §7 first-load budget; licences; the machine, CPU, Chrome version and run count.
9. Edit PRD D-1 (`docs/product/PRD.md` line 130) to link the record and state the size and load-time figures (AC7). Update CLAUDE.md Commands/Gotchas: the fetch step, the `dist-prod` second server, the `MODE === 'e2e'` gating rule, and any CSP gotcha.
10. `cargo deny check`: add any new licence to `deny.toml` after review (shipped dep: global `allow`; dev-only: per-crate exception). `ci.yml` `web` job: add `gen-refset` and `fetch-pdfium-wasm.sh` steps before the Playwright step; add the new crate to the wasm build step if path A. Check the existing "Upload build for deploy" step still uploads `web/dist` from the default build (the prod e2e build goes to `dist-prod`, so nothing is clobbered). Run the full CI command list (AC8).

**Test plan**
- AC1: `pdfium-spike.e2e.ts` (project `chromium`) renders page 1 of `image-heavy-20mb.pdf` (50 pages), asserts dimensions and non-blank pixels, no console error or CSP violation. Fails, not skips, when `CI=true` and the refset is missing; CI generates the refset first.
- AC2: `prod-no-pdfium.e2e.ts` (project `chromium-prod`, port 4174, default-mode build in `dist-prod`): zero requests matching `/pdfium/i` on `/`, and no PDFium file name or content in `dist-prod`. Sanity: the same hook-free check shows `window.staple` is undefined there.
- AC3, AC4, AC5: the `PDFIUM_SPIKE=1` run plus shell size commands; figures pasted into the record with re-run commands.
- AC6, AC7: doc review (lazy-load section and budget verdict; PRD D-1 links the record and quotes the figures).
- AC8: full CI command list passes locally; `cargo deny check` green.

**Risks / rollback**
- Biggest unknown, now retired up front by the step 1 gate: glue needing `eval`/`new Function` (CSP) or `window` (Worker), and `pdfium-render` wasm bindings assuming the main thread. Outcomes and fallbacks are in step 1; never weaken the CSP.
- Two webServers: port 4174 clash or a race on `src/wasm-pkg/` between the two builds. Mitigation: one build of the wasm, then both `vite build` runs.
- If tree-shaking fails to drop the gated code, the `dist-prod` content assertion in AC2 catches it.
- A new wasm crate can break native `cargo test --workspace` and clippy: target guard (step 5).
- Timings depend on the machine; record CPU, Chrome version and run count.
- Rollback: the work is additive and gated on `MODE === 'e2e'`; the production bundle is unchanged.

**Complexity**: complex. New crate (maybe), third-party binary under a strict CSP, unknown glue/worker integration, new Playwright project and CI wiring, measurement across 8 ACs.

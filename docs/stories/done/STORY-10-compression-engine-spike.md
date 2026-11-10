---
id: STORY-10
epic: EPIC-02
status: done
pr: 11
---

# Spike: PDF compression engine, pure Rust vs PDFium

## User story
As a Staple developer, I want measured size and time figures for compressing the reference PDFs with pure Rust and with PDFium, so that the compression engine (PRD D-2) is chosen on data before EPIC-05 builds the Compress tool.

## Context
EPIC-02 (`docs/epics/EPIC-02-engine-spikes.md`). PRD D-2 (pick the simpler engine that meets output size and the M1 time budget), M1 (20 MB, ~50 pages, under 5 s), FR-10 (recompress and downscale images, optimise streams and objects). Uses the STORY-06 benchmark harness and reference set. EPIC-05 depends on the outcome.

## Acceptance criteria
1. Given the reference set, when `bench -- compress-rust` runs, then it compresses every PDF in the set with `lopdf` + `image` and prints the usual timing JSON, plus the input and output size in bytes for each file.
2. Given the reference set and a local PDFium library, when `bench -- compress-pdfium` runs, then it compresses every PDF in the set through `pdfium-render` and prints the same JSON fields as AC1.
3. Given both candidates, when they run, then they use the same settings: images re-encoded as JPEG quality 75 and downscaled to at most 150 DPI. A test checks that the settings are one shared value, not two copies.
4. Given the output of either candidate, when it is opened, then it parses again with `lopdf` and has the same page count as the input. A test checks this for each candidate on the small test spec.
5. Given a PDF the pure Rust candidate cannot handle (truncated file, or not a PDF), when it runs, then it returns a typed error and does not panic. A test covers both cases.
6. Given the pure Rust candidate, when the CI command `cargo build -p staple-wasm --target wasm32-unknown-unknown` runs with it linked in, then the build succeeds. PDFium's WASM build is STORY-11's job.
7. Given the measurements, when the spike is done, then `docs/decisions/D-2-compression-engine.md` records, for each reference PDF and each candidate: input size, output size, ratio, and native median time. It also gives the in-browser (Chrome, worker) time on the 20 MB file for pure Rust (always measured, the AC8 rule needs it); if PDFium is chosen, PDFium's in-browser time is deferred to STORY-11. It names the engine and the reason. (Amended 2026-11-10, approved by the human in step 0.)
8. Given the decision rule, when the record names an engine, then it applies this rule: pick pure Rust if, on the 20 MB file, its output is no more than 10% larger than PDFium's and its in-browser time is under 5 s; otherwise pick PDFium. If `compress-pdfium` cannot produce a valid output (parses with `lopdf`, same page count) on `image-heavy-20mb.pdf` within the time-box, the record states this, PDFium is not viable, and Rust is picked if its in-browser time is under 5 s; if Rust also fails the 5 s test, the record states no engine met the budget and the decision goes back to the PRD owner. (Amended 2026-11-10, approved by the human in step 0.)
9. Given the decision, when the spike is done, then PRD D-2 states the chosen engine and links the decision record, and `CLAUDE.md` Stack no longer says "decided by spike".

## Out of scope
- Presets, target size, UI and the worker job for Compress (EPIC-05).
- PDFium WASM build, size and load time (STORY-11).
- Production quality: spike code may be simplified or thrown away; it stays only as a starting point for EPIC-05.

## Technical notes
- Spike code most likely lives in `crates/staple-bench` (ops registry, one line per op). The pure Rust path could move to `staple-core` if that is the simplest way to satisfy AC6.
- Native PDFium for AC2: dynamic library from a prebuilt PDFium release, downloaded locally and gitignored. Do not commit binaries. If `compress-pdfium` needs that library, CI must not run it; gate it behind an `#[ignore]` test or a feature flag.
- PDFium has no "compress" call. The likely route is to walk page image objects, re-encode each image and save. Read the `pdfium-render` docs for the `Cargo.lock` version before relying on that (CLAUDE.md rule).
- Reference images are synthetic with seeded noise (STORY-06), which compresses worse than real photos. Note this in the record; the comparison between engines still holds.
- New deps (`lopdf`, `image`, `pdfium-render`) must pass `cargo deny`. Dev-only exceptions go in `deny.toml` per crate.

## Implementation Plan

**Affected areas**: backend (Rust core, wasm bindings, bench harness), infra (`deny.toml`, `.gitignore`), docs (decision record, PRD, CLAUDE.md), frontend (small e2e-only hook for the in-browser timing).

### Design decisions
- Shared settings: `staple_core::compress::Settings { jpeg_quality: 75, max_dpi: 150 }` with `pub static DEFAULT: Settings` (a `static`, not a `const`, so there is one address). `compress_pdf(input, &Settings)` and the PDFium path both take `&Settings`; the bench ops `compress-rust` and `compress-pdfium` each call one shared `run(&DEFAULT)`-style helper in `staple-bench` (e.g. `fn run(engine, bytes) { engine(bytes, &DEFAULT) }`), so there is a single call site that names `DEFAULT`. No second copy of 75/150 anywhere. No `settings_for` API.
- Pure Rust lives in `staple-core` (`compress.rs`, `lopdf` + `image` with `default-features = false`, features `jpeg` only; lopdf without rayon/default extras). This satisfies AC6 and is the EPIC-05 starting point.
- PDFium candidate lives in `staple-bench` behind cargo feature `pdfium` (off by default, so CI never builds or needs the library). `pdfium-render` is an optional dep of staple-bench only.
- Bench `Op` changes from `fn(&[u8])` to `fn(&[u8]) -> Result<usize, String>` (Ok = output bytes). `demo` returns `Ok(0)`. JSON per result gains `input_bytes` and `output_bytes`. For ops whose name starts with `compress-`, bench skips non-`.pdf` files in the dir (refset also holds jpg/png). Update `bench.rs` and existing tests accordingly.
- DPI downscale: for each image XObject, DPI = pixels / (placed size in inches). Spike shortcut: take placed size from the page MediaBox (refset images fill the page); `shortcut: assumes one full-page image, EPIC-05 must read the CTM`. Re-encode only DCTDecode images (refset images are DCT RGB 8-bit); skip others untouched. Decode with `image`, `resize` (Triangle) if over 150 DPI, encode JPEG q75, replace stream, fix `/Width /Height /Length`. Finish with `prune_objects` + `compress` (flate streams) + `save_to`.
- Typed error: `CompressError` (`thiserror`): `NotPdf`, `Truncated`, `Parse(lopdf::Error)`, `Image`. No `unwrap`/`panic`. `lopdf::Document::load_mem` is lenient (it can rebuild a broken xref and return `Ok` for a half-cut file), so do not rely on its error alone. Checks, in order: (1) no `%PDF-` header -> `NotPdf`; (2) the last ~1 KB must contain `startxref` and `%%EOF`, else `Truncated` (cheap, catches a cut file before lopdf recovers it); (3) after load, walk `get_pages()` and require that each page's `/Contents` and each image XObject stream resolve, else `Truncated`; (4) other lopdf load errors -> `Parse`. Output also re-checked with the same page walk.

### Steps (test-first)
0. Gate, before any code: get the human to approve two AC amendments, then edit the ACs in this file. DONE 2026-11-10: the human approved both amendments; AC7 and AC8 above now carry the amended wording. Proceed to step 1.
   - AC7 now: "...one in-browser (Chrome, worker) time for the chosen engine on the 20 MB file". Amend to: "in-browser (Chrome, worker) time on the 20 MB file for pure Rust (always measured, the AC8 rule needs it); if PDFium is chosen, PDFium's in-browser time is deferred to STORY-11". The decision record must quote this wording.
   - AC8 now has no case for PDFium failing. Amend to add: "If `compress-pdfium` cannot produce a valid output (parses with `lopdf`, same page count) on `image-heavy-20mb.pdf` within the time-box, the record states this, PDFium is not viable, and Rust is picked if its in-browser time is under 5 s; if Rust also fails the 5 s test, the record states no engine met the budget and the decision goes back to the PRD owner."
   - Without approval, do not start step 1.
1. Read `lopdf` and `image` docs for the exact versions after `cargo add` (CLAUDE.md rule); check `cargo deny check` passes, add per-crate exceptions to `deny.toml` only if a licence is not on the allowlist.
2. Write tests against failing stubs. `Spec` and `generate` live in `staple-bench` (which depends on core), so core has no PDF generator; all PDF-based tests go in `crates/staple-bench/tests/compress.rs` (generate into a temp dir, as `tests/refset.rs` does). Core keeps only a unit test for `DEFAULT` value and the non-PDF case.
   - AC3: core unit test `DEFAULT == Settings { jpeg_quality: 75, max_dpi: 150 }`. Bench test: both ops go through the single shared `run`-style helper taking `&DEFAULT` (test calls it with a probe engine closure and asserts the `&Settings` it receives is `std::ptr::eq(&DEFAULT)`, valid because `DEFAULT` is a `static`).
   - AC4: `Spec::small()` PDF, `compress_pdf`, reparse with `lopdf::Document::load_mem`, assert page count equals input and output nonempty.
   - AC4 downscale: `Spec::small()` images are 64x80 px on a 595x842 pt page (about 7 DPI), and the refset 20 MB file is 1240x1754 px on the same page (about 150 DPI), so neither downscales. Add a test spec `Spec { image_pages: 1, image_dims: (2480, 3508), ..Spec::small() }` (about 300 DPI, one page, fast). Assert the output image XObject pixel `/Width` x `/Height` is at most 1240x1754 (150 DPI) for the Rust candidate, and for the PDFium candidate in its ignored test; also assert page count. This is the only check that the 150 DPI clamp runs.
   - AC5 (write first, run against the naive loader, and confirm the truncated test FAILS before adding the trailer/page-walk checks): `compress_pdf(b"not a pdf")` -> `NotPdf`; a valid small-spec PDF cut at half, and also one cut so the trailer is intact but an image stream is cut short, each -> `Err` (`Truncated`), no panic. Truncated tests sit in `crates/staple-bench/tests/compress.rs`.
3. Implement `staple-core/src/compress.rs`, export `pub mod compress` in `lib.rs`; rustdoc on public items.
4. Add `compress_pdf(input: &[u8]) -> Result<Vec<u8>, JsValue>` to `staple-wasm/src/lib.rs` (error as code string, same style as `demo`). Run `cargo build -p staple-wasm --target wasm32-unknown-unknown` (AC6). If `lopdf`/`image` fail to build on wasm32, fix feature flags; if impossible, that is itself a spike finding and forces PDFium.
5. Bench: change `Op` signature, add `compress-rust` op, and `input_bytes`/`output_bytes` in JSON (AC1). Extend `tests/` to check the JSON-producing helper or op returns sizes (keep `json_escape` test).
6. Add feature `pdfium` and `compress-pdfium` op (AC2), cfg-gated. Read `pdfium-render` docs for the `Cargo.lock` version first: route is open doc, iterate pages -> page objects -> image objects, get raw/processed image, downscale and re-encode with the same `Settings` (via a shared helper in core, e.g. `compress::reencode_jpeg(&DynamicImage, &Settings)`), set bitmap back, `save_to_bytes`. Library load via `Pdfium::bind_to_library` using env `PDFIUM_DYNAMIC_LIB_PATH` or `./pdfium/`. Add `/pdfium/` to `.gitignore`. Time-box: if no valid 20 MB PDFium output after the time-box (suggest half a day), stop, keep what works (for example JPEG-only objects), and record `compress-pdfium` as not viable on `image-heavy-20mb.pdf` with the failure reason (this triggers the amended AC8 fallback in step 0). Without the feature the op name is absent and bench prints the normal "unknown operation" message. AC3: the pdfium op goes through the same shared helper as `compress-rust` (step 2 test); no extra API.
7. PDFium tests: `#[ignore]`d (and `#[cfg(feature = "pdfium")]`) test running AC4 for the PDFium candidate on the small spec; run it locally with the downloaded library.
8. Measure native: `gen-refset` then `bench -- compress-rust` and `bench -- compress-pdfium --runs 5` (release). Capture JSON. Also generate one high-DPI file (the 2480x3508 single-page spec from step 2, via a small `gen-refset`-style call into a scratch dir) and run both ops with `--dir` on it, so the 150 DPI downscale is measured at least once; record it as an extra row in D-2.
9. In-browser time for pure Rust on `image-heavy-20mb.pdf` (always measured, regardless of which engine wins): expose `runCompress` on the e2e-only `window.staple` hook (`web/src/main.ts`) with worker op `compress` (extend `protocol.ts`, `handler.ts` `Core`, `worker.ts`); add error code(s) via i18n if needed. Write a Playwright test (`web/e2e/compress-spike.e2e.ts`) that times it in Chromium and logs the ms; it may be skipped by default (env flag) so CI stays fast, with only a small-spec correctness assertion running always. PDFium browser time is not measured here (STORY-11), per the amended AC7.
10. Write `docs/decisions/D-2-compression-engine.md` (new dir): table per reference PDF (`image-heavy-20mb.pdf`, `pages-200.pdf`, `text-1mb.pdf`) x candidate: input, output, ratio, native median ms; synthetic-noise caveat; Rust browser time (and, if PDFium is chosen, the sentence that PDFium browser time is deferred to STORY-11, quoting the amended AC7); note that the refset 20 MB file is about 150 DPI so it exercises JPEG q75 re-encode only, not the downscale (downscale measured separately on the 2480x3508 extra row from step 8); apply the amended AC8 rule literally: Rust if output <= 1.10 x PDFium's on the 20 MB file AND browser time < 5 s, else PDFium; if PDFium produced no valid 20 MB output, state that, mark PDFium not viable and apply the fallback (Rust if 5 s test passes); name engine and reason.
11. Update PRD D-2 (line ~131) with chosen engine and link; edit CLAUDE.md Stack line to drop "decided by spike" and name the engine. If the chosen engine is Rust, keep the PDFium spike code feature-gated or delete it; say so in the record.

### Test plan
- AC1: `bench -- compress-rust` run over refset prints JSON with `input_bytes`/`output_bytes` per PDF (unit test on op returning `Ok(len)` for small spec; manual full run recorded in D-2).
- AC2: manual `compress-pdfium` run with `--features pdfium` and local library; ignored test for the small spec.
- AC3: value test `DEFAULT == {75,150}`; `ptr::eq(&DEFAULT)` test on the shared helper that both ops call (static, so address is stable).
- AC4: integration test per candidate (PDFium one ignored) comparing lopdf page counts on `Spec::small()`, plus the 2480x3508 spec asserting output pixel dimensions shrink to at most 1240x1754 for each candidate.
- AC5: tests in `crates/staple-bench/tests/compress.rs`: non-PDF bytes -> `NotPdf`; half-cut PDF and trailer-intact-but-stream-cut PDF -> `Truncated`; no panic. Truncated test first seen failing against the naive `load_mem`-only version.
- AC6: CI command `cargo build -p staple-wasm --target wasm32-unknown-unknown`.
- AC7/AC8/AC9: step 0 approval recorded; doc review (also: record quotes amended AC7 wording and, if relevant, the PDFium-not-viable fallback): record has all rows, rule applied literally, PRD and CLAUDE.md edited (grep "decided by spike" returns nothing in CLAUDE.md).
- Full gate: fmt, clippy `-D warnings` (pedantic; no unwrap/expect/panic outside tests), `cargo test --workspace`, `cargo deny check`, wasm build, and in `web/` lint/test/build/e2e.

### Risks / rollback
- Output validity: pdfium-render image replacement may be awkward (filters, masks); spike may simplify to JPEG-only objects. Time-box it. If still no valid 20 MB output, the amended AC8 fallback applies (PDFium not viable, pick Rust if the 5 s test passes). Both amendments need human approval in step 0 before delivery.
- Rust browser time is always measured. If PDFium is chosen, its browser time is deferred to STORY-11 per the amended AC7, not silently dropped; the record says so.
- `lopdf` or `image` may not build on wasm32 or may be too slow in-browser; that outcome is a valid result.
- `lopdf` parsing 20 MB or 200-page files may be slow; a native timing issue is data, not a bug.
- New deps may need licence exceptions; keep dev-only ones per-crate.
- Rollback: the work is additive (new module, feature-gated op); the `Op` signature change is the only cross-cutting edit.

**Complexity**: complex. Two engines, new deps, wasm build risk, harness API change, in-browser measurement and a decision record across code, docs and CI.

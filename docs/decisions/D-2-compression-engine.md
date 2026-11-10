# D-2: PDF compression engine

**Decision: pure Rust (`lopdf` + `image`).** Date: 2026-11-10. Spike: STORY-10.

## Rule (STORY-10 AC8, as amended)

Pick pure Rust if, on the 20 MB file, its output is no more than 10% larger than PDFium's and its in-browser time is under 5 s; otherwise pick PDFium. If `compress-pdfium` cannot produce a valid output on `image-heavy-20mb.pdf`, PDFium is not viable and Rust is picked if its in-browser time is under 5 s.

## Applying it

- PDFium produced valid output on every reference PDF: it parses again with `lopdf` and keeps the page count (50, 200 and 100 pages). The not-viable fallback does not apply. Checked with a one-off local test, not kept in the repo: for each reference PDF, `staple_bench::pdfium::compress(&bytes, &DEFAULT)`, then `lopdf::Document::load_mem(&out)?.get_pages().len()` compared with the input's page count. The kept `#[ignore]` test `pdfium_output_reparses_with_same_pages` checks the same on the small spec.
- Size: Rust 4,252,842 B against PDFium 4,260,140 B. The limit is 1.10 × 4,260,140 = 4,686,154 B. Rust is 0.2% smaller. **Pass.**
- In-browser time: 4758 ms, under 5000 ms. **Pass.**
- Result: **pure Rust**. It meets both tests, ships no C++ engine, and is already the code that EPIC-05 starts from.

## Settings

Both candidates use one shared `staple_core::compress::DEFAULT`: images re-encoded as JPEG quality 75, downscaled to at most 150 DPI.

## Native measurements

Command: `bench -- compress-rust|compress-pdfium --runs 5`, release build. Times are the median of 5 runs. Ratio is output size / input size.

| File | Input (B) | Engine | Output (B) | Ratio | Median (ms) |
|---|---:|---|---:|---:|---:|
| `image-heavy-20mb.pdf` | 18,710,636 | Rust | 4,252,842 | 22.7% | 2618 |
| | | PDFium | 4,260,140 | 22.8% | 4020 |
| `pages-200.pdf` | 88,850 | Rust | 74,540 | 83.9% | 8 |
| | | PDFium | 76,894 | 86.5% | 6 |
| `text-1mb.pdf` | 1,177,743 | Rust | 228,006 | 19.4% | 26 |
| | | PDFium | 229,227 | 19.5% | 49 |
| Extra: 1 page, 2480x3508 image | 1,011,574 | Rust | 67,310 | 6.7% | 276 |
| | | PDFium | 67,480 | 6.7% | 434 |

The page images in the reference `image-heavy-20mb.pdf` are about 150 DPI already. So that file tests only the JPEG q75 re-encode, not the downscale. The extra row is a 300 DPI A4 page from `Spec { image_pages: 1, image_dims: (2480, 3508), ..Spec::small() }`, and both engines downscale it to 150 DPI.

## In-browser time (Chrome, worker)

Pure Rust on `image-heavy-20mb.pdf`. Command: `COMPRESS_SPIKE_FILE=../bench/refset/image-heavy-20mb.pdf npx playwright test compress-spike -g "large file" --workers=1`, Playwright Chromium. The timer covers one `runCompress` call after the WASM is loaded, including the transfer into the worker. Three runs: 4758, 4776, 4746 ms. **Median 4758 ms.**

AC7 as amended: "in-browser (Chrome, worker) time on the 20 MB file for pure Rust (always measured, the AC8 rule needs it); if PDFium is chosen, PDFium's in-browser time is deferred to STORY-11". PDFium was not chosen, so its in-browser time was not measured.

## Caveats

- **The 5 s margin is thin and was measured on fast hardware.** The test machine has an 8-core AMD Ryzen 7 5700X3D desktop under WSL2. The M1 manual check uses a mid-range laptop (4 cores, 8 GB RAM), which will likely be slower than 5 s on this file. This does not change the choice: natively, PDFium was about 54% slower than Rust on the same file (4020 ms against 2618 ms). EPIC-05 must win the time back. Options: decode, resize and encode images in parallel across workers (COOP/COEP already allow threads), skip images that would not shrink, and profile the JPEG encode.
- The reference images are synthetic: a gradient with seeded noise. Noise does not compress well, so real scans may get better ratios. Treat the ratios as relative between engines, not as what users will see.
- Native timing only approximates WASM speed.

## Known limits of the Rust candidate (for EPIC-05)

- It re-encodes only RGB DCT (JPEG) images with no `/Decode` array. It leaves gray, CMYK and indexed images untouched, and keeps any image it cannot decode as it is.
- It returns the input unchanged if the result would not be smaller.
- The placed size used for the 150 DPI limit is the page MediaBox width, not the image's real size on the page.
- It does not read images from `/Resources` inherited from a parent `/Pages` node.
- It sets no limit on decoded image size beyond the `image` crate's default allocation limit.

None of these affect the measurements: every reference image is a full-page RGB JPEG with page-level resources.

## What happens to the PDFium candidate

The `compress-pdfium` op stays in `crates/staple-bench`, behind the `pdfium` feature, so it can be measured again. It needs a local PDFium library, and CI never builds or runs it. Nothing that ships depends on it. PDFium stays the rendering engine (D-1, STORY-11).

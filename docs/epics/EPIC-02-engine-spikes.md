# EPIC-02 — Engine spikes

**Goal.** Settle two engine questions with data before building the PDF tools. D-2 asks whether pure Rust (`lopdf` + `image`) compresses well enough, or whether a heavier engine is needed. D-1 asks how big PDFium's WASM build is and how long it takes to load. Both choices affect the size, speed and design of three later epics, so guessing wrong would cost the most here.

## In scope
- Compression spike: compare pure Rust with PDFium on the reference file set (EPIC-01). Measure output size and time against M1 (20 MB, about 50 pages, under 5 s).
- PDFium spike: build `pdfium-render` with PDFium for WASM. Measure binary size, load time and render time per page.
- A short decision record in `docs/` for each spike, and an updated PRD D-1 / D-2.

## Out of scope
- Production-quality code or UI. Spike code is thrown away or kept only as a starting point.

## Depends on
- EPIC-01

## Done signals
- The decision record names the compression engine, with size and time figures for each reference file.
- The decision record gives PDFium's WASM size and load time, and says how to lazy-load it.
- PRD D-1 and D-2 are updated.

## Candidate stories
- Spike: PDF compression, pure Rust vs PDFium
- Spike: PDFium WASM build size and load time

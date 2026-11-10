# EPIC-06 — PDF rendering: thumbnails and PDF to images

**Goal.** Add PDFium rendering. It powers page thumbnails in Split and the PDF to JPG/PNG conversion. PDFium is heavy, so it loads lazily and only in the tools that need it. This keeps the home page and the other tools light.

## In scope
- Lazy-loaded PDFium WASM module, loaded the way EPIC-02 recommends (D-1).
- Page thumbnails in Split, to help pick pages (FR-17).
- PDF to images: each page as JPG or PNG at a chosen DPI. More than one page downloads as a ZIP (FR-19).

## Out of scope
- Page-level edit (EPIC-12).

## Depends on
- EPIC-02, EPIC-04

## Done signals
- Split shows thumbnails for the reference PDF. PDFium is not downloaded on pages that do not use it.
- PDF to images produces correct JPG and PNG pages at the chosen DPI.
- Load and render times are within the budgets in the EPIC-02 decision record.

## Candidate stories
- Lazy-load PDFium in the worker
- Page thumbnails in Split
- PDF to JPG/PNG at chosen DPI

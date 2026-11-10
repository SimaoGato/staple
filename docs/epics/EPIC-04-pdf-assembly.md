# EPIC-04 — PDF assembly: merge, split, images to PDF

**Goal.** Ship the PDF tools that only rearrange content: merge PDFs and images, split or extract pages, and turn images into a PDF. Opening password-protected PDFs is included. These tools cover key journeys 2, 3, 4 and 6 and need no rendering engine, so they are the fastest route to real user value.

## In scope
- Merge 2 or more PDFs and/or JPG/PNG/WebP images into one PDF (FR-13).
- Reorder and remove merge inputs, with the mouse and the keyboard (FR-14, D-5).
- Extract pages with a range expression such as `1-3, 7, 10-` (FR-15).
- Split into one PDF per page, or every N pages, as a ZIP (FR-16).
- Images to PDF: one page per image, in a chosen order (FR-18).
- Open encrypted PDFs with a password prompt and retry. Output is not encrypted (FR-7).

## Out of scope
- Page thumbnails (EPIC-06).
- Page-level edit (EPIC-12).
- Adding passwords (EPIC-12).

## Depends on
- EPIC-01, EPIC-03

## Done signals
- Key journeys 2, 3 and 6, and the PDF part of journey 4, work end to end on the deployed app.
- Merge and split of the M1 reference file finish in under 5 s.
- Range-expression parsing is covered by unit tests, including invalid input.

## Candidate stories
- Merge PDFs into one PDF
- Merge images and PDFs together
- Reorder and remove merge inputs (mouse and keyboard)
- Extract pages by range expression
- Split into one PDF per page or every N pages
- Images to PDF
- Open password-protected PDFs

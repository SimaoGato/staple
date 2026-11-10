# EPIC-05 — PDF compression

**Goal.** Shrink PDFs with presets and an optional target size. This is key journey 1, "get under an upload limit", and the most common reason people reach for these tools. It is also the hardest tool to do well, so it depends on the engine chosen in EPIC-02.

## In scope
- Presets light, balanced and strong: recompress and downscale images, optimise streams and objects (FR-10).
- Optional target size, best effort. If the target is missed, show the size reached (FR-11).
- Show the size before and after.

## Out of scope
- Image file compression (EPIC-07).

## Depends on
- EPIC-02, EPIC-03

## Done signals
- Key journey 1 works end to end on the deployed app.
- Compressing the M1 reference file takes under 5 s.
- Each preset makes the reference set smaller, with size figures recorded.
- Target-size mode either hits the target or reports the closest size reached.

## Candidate stories
- Compress PDF with presets
- Compress PDF to a target size

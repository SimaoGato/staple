# EPIC-07 — Image tools: convert, resize, compress

**Goal.** Ship the image tools for everyday photos: convert between JPG, PNG and WebP, resize, and compress. Location metadata is stripped by default. These cover key journeys 4 and 5. They share one image pipeline (decode, EXIF orient, transform, encode), so they fit in one epic.

## In scope
- Convert between JPG, PNG and WebP. Transparent areas become white when converting to JPG (FR-20).
- Resize by max width or height, exact pixels, or percentage, keeping the aspect ratio (FR-21).
- Apply EXIF orientation. Strip EXIF and GPS data by default, and tell the user (FR-22).
- Compress JPG, PNG and WebP with a quality setting (FR-12).
- Batch processing through the shared flow, with a ZIP download.

## Out of scope
- HEIC input (EPIC-12).
- Images to PDF (EPIC-04).

## Depends on
- EPIC-03

## Done signals
- Key journey 5 and the image part of journey 4 work end to end on the deployed app.
- Output images keep the correct orientation and contain no GPS data. Tests check this.

## Candidate stories
- Convert between JPG, PNG and WebP
- Resize images
- Apply EXIF orientation and strip metadata
- Compress images with a quality setting

# EPIC-03 — Shared tool flow

**Goal.** Build the input → process → result → download flow that every tool shares, so each tool epic only adds its own options and engine call. One shared flow keeps the five tools consistent. A first-time user learns it once (M4).

## In scope
- File input by drag-and-drop or file picker, single and multiple files (FR-2).
- Progress and a cancel button (FR-3, FR-9).
- Result card showing the output name, size and size change, with a one-click download (FR-4).
- ZIP download for more than one output (FR-5).
- Per-file plain-language errors. One bad file does not stop the others (FR-6).
- Out-of-memory handling with a clear message (FR-8).
- A single module for size and count checks, with no caps in v1 (D-7 v1 impact).
- Keyboard use and screen-reader announcements for all of the above.

## Out of scope
- Tool-specific options and engines.
- Encrypted PDF password prompt (EPIC-04).

## Depends on
- EPIC-01

## Done signals
- A demo tool (e.g. "copy file") goes through the full flow: input, progress, cancel, result, single download and ZIP download.
- Errors and out-of-memory produce the specified messages. Automated tests cover them.
- The flow works with the keyboard alone.

## Candidate stories
- File input: drag-and-drop and picker, single and multiple
- Progress display and cancel
- Result card with one-click download
- Multi-output ZIP download
- Per-file errors and out-of-memory message
- Central limits module (no caps in v1)

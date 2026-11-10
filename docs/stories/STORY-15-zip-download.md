---
id: STORY-15
epic: EPIC-03
status: draft
pr: null
---

# Download all outputs as one ZIP

## User story
As a user who processed several files, I want to download all the outputs in one ZIP, so that I do not have to click a download for every file.

## Context
EPIC-03 (`docs/epics/EPIC-03-shared-tool-flow.md`). PRD FR-5 (more than one output downloads as a single ZIP; single downloads are still offered), journeys 3 and 4 in §5 (split into pages, convert several photos), FR-8 (no artificial limits; memory is the real ceiling). Builds on STORY-14 (result cards and single download).

Copy (add to `web/src/i18n/en.ts`, wording may be polished in review):
- Button: "Download all (ZIP)"; accessible name includes the count, e.g. "Download all 3 files as ZIP"
- While building: "Preparing ZIP…"

## Acceptance criteria
1. Given a result step with 2 or more outputs, when it shows, then a "Download all (ZIP)" button appears above the result cards. Given exactly 1 output, then no ZIP button appears.
2. Given 3 outputs, when I activate "Download all (ZIP)", then the browser downloads one file named `staple-{tool}.zip` (demo: `staple-demo.zip`). Opened with a standard unzip tool (or a test-side ZIP reader), it contains exactly the 3 outputs with their shown names and byte-for-byte contents.
3. Given 2 outputs with the same name (e.g. `scan.pdf` twice), when they are zipped, then the entries are named `scan.pdf` and `scan (2).pdf`. A third becomes `scan (3).pdf`. No entry is overwritten or lost.
4. Given entry names with non-ASCII characters (e.g. `relatório.pdf`), when they are zipped, then the names open correctly in a standard unzip tool (UTF-8 flag set).
5. Given the ZIP is being built, when it takes time, then the button is disabled and "Preparing ZIP…" is shown and announced. The main thread stays responsive: the build runs in the worker, not on the main thread.
6. Given building the ZIP fails (e.g. out of memory), when it fails, then a plain-language error is shown and announced, and every single "Download" button still works.
7. Given the ZIP download, when it starts, then the object URL is revoked afterwards and the button can be used again.
8. Given only a keyboard, when I tab through the result step, then the ZIP button is reachable, shows the visible focus ring and works with Enter or Space.
9. Given a ZIP of 2 outputs of 1 MB each, when it is built, then entries may be stored without compression (PDF, JPEG and PNG are already compressed); the ZIP size is at most the sum of the outputs plus 1 KB of overhead per entry.
10. Given `cargo test --workspace`, `npm run build`, `npm run lint`, `npm test` and `npm run test:e2e`, when they run, then they pass. `cargo deny check` passes with any new crate.

## Out of scope
- Choosing a subset of outputs to zip.
- Streaming a ZIP larger than memory to disk (File System Access API).
- ZIP64 beyond what the chosen library gives by default; inputs over 4 GB are not expected (PRD §8 assumptions).

## Technical notes
- Build the ZIP in Rust (`staple-core`, a crate such as `zip` with default features off and only `Stored`/`deflate` as needed) so it runs in the worker and gets native tests. Check its licence and wasm32 support; read the docs for the exact version in `Cargo.lock`. A hand-written stored-only writer in TypeScript is the fallback if the crate adds too much size.
- Name de-duplication is a pure function; unit-test it in the language it lives in.
- A ZIP job needs several inputs in one message: transfer each output's buffer, or copy, per the `postMessage` gotcha in CLAUDE.md. Keep the per-file outputs usable for single downloads after the ZIP is built (do not transfer away buffers the cards still need, or keep a copy).

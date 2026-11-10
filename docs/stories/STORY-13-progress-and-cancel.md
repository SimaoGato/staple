---
id: STORY-13
epic: EPIC-03
status: draft
pr: null
---

# Run files with progress and cancel

## User story
As a user who has chosen files, I want to start the tool, see how far it has got and stop it if I change my mind, so that the page never feels frozen and I stay in control.

## Context
EPIC-03 (`docs/epics/EPIC-03-shared-tool-flow.md`). PRD FR-3 (processing in a Web Worker on the WASM core, UI stays responsive, shows progress), FR-9 (cancel a running operation), §7 Accessibility (progress announced to screen readers). Builds on STORY-12 (file input) and the worker bridge from STORY-04 (`web/src/worker/`).

A tool hands the flow one job per input file. The flow runs them one after another in the worker and reports progress for the whole batch. The engine has no cancellation points, so cancel stops the worker itself.

Copy (add to `web/src/i18n/en.ts`, wording may be polished in review):
- Start button: per tool, demo "Copy files"
- Status while running: "Processing {name} ({n} of {total})"
- Cancel button: "Cancel"
- After cancel: "Cancelled. Your files are still selected."

## Acceptance criteria
1. Given files are listed, when I activate the tool's start button, then the input controls (add, remove, start) are disabled and a progress bar plus a "Cancel" button appear. The start button is disabled while the list is empty.
2. Given a run of 3 files, when it runs, then the files are processed one at a time in list order. The status text names the current file and its position ("Processing b.pdf (2 of 3)").
3. Given a run, when the worker reports progress, then the progress bar shows overall progress across the batch, from 0 to 100, and it never goes backwards. A job that reports no progress still advances the bar when it finishes.
4. Given a run, when it is in progress, then the main thread stays responsive: a Playwright test clicks or focuses another control during a run of at least 1 s and it reacts within 200 ms.
5. Given a run in progress, when I activate "Cancel", then processing stops within 500 ms, no results are shown, the files are still listed, the input controls are enabled again, focus moves to the start button, and the "Cancelled" status is shown and announced.
6. Given a cancelled run, when I start again, then the run works normally from the first file (a fresh worker is started; no state leaks from the cancelled run).
7. Given a run, when it starts, moves to the next file, finishes or is cancelled, then a polite live region announces it. Per-percent updates are not announced. The progress bar has an accessible name and exposes its value (`<progress>` or `role="progressbar"` with `aria-valuenow`).
8. Given only a keyboard, when a run starts, then the "Cancel" button can be reached with Tab and activated with Enter or Space.
9. Given the user leaves the tool page during a run, when the route changes, then the run is cancelled and the worker is terminated.
10. Given a successful run, when every file has finished, then the flow hands the list of outputs (bytes, file name, and the matching input size where the tool provides it) to the result step. Until STORY-14 lands, a test can read that list. The demo tool's output for each file is a byte-for-byte copy of the input.
11. Given `npm run build`, `npm run lint`, `npm test` and `npm run test:e2e`, when they run, then they pass. The existing worker tests (`web/src/worker/*.test.ts`, `web/e2e/worker.e2e.ts`) still pass.

## Out of scope
- Result card and download (STORY-14), ZIP (STORY-15).
- Per-file error display and out-of-memory (STORY-16). A failing job may stop the run with the generic error until then.
- Running files in parallel or across several workers.

## Technical notes
- `web/src/worker/client.ts` has one module-level worker and a `pending` map. Cancel = `worker.terminate()`, reset `worker` to `undefined`, reject pending jobs with a new `cancelled` code (`failAll` already does most of this). Add `cancelled` to `ErrorCode` in `protocol.ts` and keep `ERROR_CODES` in sync.
- A generic "bytes in, bytes out + progress" job shape would serve every tool; the current `compress` reply has no progress. The demo "copy" op can live in `staple-core` + `staple-wasm` (reports progress like `demo`) or in the worker alone; Refine decides.
- Cancel and progress tests need a job that runs long enough. Prefer a large generated input over a test-only delay; if a delay knob is used, it must exist only in the e2e build.
- Input bytes are read from the `File` just before each job (STORY-12 AC 11) and transferred, not copied (CLAUDE.md `postMessage` gotcha).

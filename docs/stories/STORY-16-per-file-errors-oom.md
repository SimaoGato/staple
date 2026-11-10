---
id: STORY-16
epic: EPIC-03
status: draft
pr: null
---

# Per-file errors and out-of-memory message

## User story
As a user processing several files, I want a bad file to be named with a plain explanation while the others still finish, and a clear message if my computer runs out of memory, so that one problem does not cost me the whole job.

## Context
EPIC-03 (`docs/epics/EPIC-03-shared-tool-flow.md`). PRD FR-6 (plain-language error that names the file; one bad file does not stop the others), FR-8 (out of memory shows a clear message instead of crashing), §8 assumptions (100 MB+ files may fail on low-memory machines), §7 Accessibility (errors announced). Builds on STORY-13 (run) and STORY-14 (result step). The worker already maps engine errors to codes and messages (`web/src/worker/protocol.ts`, `handler.ts`).

Copy (add to `web/src/i18n/en.ts`, wording may be polished in review):
- File error line: "{name}: {message}" using the existing `error.*` messages
- Unreadable input: "{name} could not be read. It may have been moved or deleted."
- Out of memory: "{name} needs more memory than this browser tab has. Close other tabs or try a smaller file."
- Summary: "{ok} of {total} files done. {failed} could not be processed."

## Acceptance criteria
1. Given a run of 3 files where the 2nd fails in the engine (e.g. a non-PDF given to a PDF op, error code `not_pdf`), when the run finishes, then the 1st and 3rd files have result cards and downloads, and the 2nd shows an error line that names it and gives that code's message.
2. Given a run with at least one failed file, when the result step shows, then a summary states how many files succeeded and how many failed. Given every file failed, then no download or ZIP button is shown, only the errors and "Start over".
3. Given a run where a file fails, when the ZIP is built (STORY-15), then it contains only the successful outputs. The ZIP button appears only when 2 or more outputs succeeded.
4. Given an input file that can no longer be read (`File.arrayBuffer()` rejects), when its turn comes, then it gets the "could not be read" error and the run continues with the next file.
5. Given a job runs out of memory in the worker (a wasm allocation failure trap, or a `RangeError` from allocating its buffers), when it fails, then that file gets the out-of-memory message, the worker is terminated and replaced, and the run continues with the next file on the fresh worker.
6. Given the main thread fails to allocate while reading an input file or building a download `Blob`, when it fails, then that file gets the out-of-memory message and the page keeps working (no uncaught error, no blank page).
7. Given the worker crashes for another reason (`onerror`), when it crashes, then the current file gets the generic `error.internal` message, and the run continues on a fresh worker.
8. Given an error, when it is shown, then it is announced through a live region (one announcement per run summary, not one per file for large batches) and every error line is reachable by a screen reader in the results list.
9. Given every error code in `ERROR_CODES` plus `out_of_memory` and the unreadable-input case, when an automated test triggers each one, then the expected message names the file. Unit tests cover the mapping; one Playwright test covers a mixed good/bad batch end to end; one Playwright test covers the out-of-memory path end to end.
10. Given `cargo test --workspace`, `npm run build`, `npm run lint`, `npm test` and `npm run test:e2e`, when they run, then they pass.

## Out of scope
- Encrypted PDF password prompt (EPIC-04, FR-7).
- Retrying a single failed file from the result step.
- Predicting memory needs before running.

## Technical notes
- Add `out_of_memory` to `ErrorCode`/`ERROR_CODES` and its message to `en.ts`. Messages that include the file name need a placeholder in the i18n layer; check how `t()` handles parameters today and extend it with typed keys, not casts.
- On wasm32, a failed Rust allocation calls `handle_alloc_error`, which aborts as a `RuntimeError: unreachable` trap; `memory.grow` failures can also surface as `RangeError`. A trapped instance is not safe to reuse: terminate the worker (CLAUDE.md: never cache a failed wasm state). The classifier is a pure function over the thrown value; unit-test it with sample errors.
- OOM e2e: a real allocation failure can exhaust CI RAM. Prefer an e2e-only op (literal `import.meta.env.MODE === 'e2e'` guard) that requests an allocation the wasm32 4 GB address space cannot satisfy, so it fails fast and deterministically. Keep it out of the default build (`prod-no-pdfium.e2e.ts` pattern).
- The flow currently stops on the first error (STORY-13); this story changes the loop to record per-file outcomes.

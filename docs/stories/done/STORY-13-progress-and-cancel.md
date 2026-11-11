---
id: STORY-13
epic: EPIC-03
status: done
pr: 14
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

## Implementation Plan

**Affected areas**: frontend (flow, worker bridge, i18n, css), ux (a11y, focus, live region). No Rust change.

**Decisions**
- Demo "copy" op lives in the worker only (no core/wasm change): op `copy` runs `core.demo(input, onProgress)` for progress, then replies with a copy of the input in a new `{type:'bytes', id, output}` message (output transferred; update the transfer test in `worker.ts` `post`). Generic shape for later tools: `process(bytes, onProgress) => Promise<Uint8Array>`.
- Long-running test job: e2e-only `delayMs` field on `JobMessage` (optional). Handler honours it only when `import.meta.env.MODE === 'e2e'` (literal test): inside the progress callback, busy-wait `delayMs` via `Date.now()` loop. 1 MB input = 16 callbacks; `?delay=100` gives about 1.6 s per file. Demo view reads `?delay` (e2e only already).
- Cancel = new exported `cancelAll()` in `client.ts`: `worker?.terminate(); worker = undefined; failAll(new WorkerError('cancelled', t('error.cancelled')))`. Add `'cancelled'` to `ErrorCode` + `ERROR_CODES` in `protocol.ts`, `error.cancelled` in `en.ts`, and an entry in `MESSAGES` in `handler.ts` (`satisfies Record<ErrorCode,string>` fails otherwise).
- Outputs hand-off (AC 10): flow takes `onDone(outputs: {bytes, name, inputSize}[])`. Demo view stores them on `window.stapleOutputs` (e2e only, type in the existing hook declaration in `main.ts`). STORY-14 replaces it.
- Flow instances own no worker state beyond the client module; one run at a time.

**Steps (test first)**
1. `worker/handler.test.ts`: `copy` op posts progress then `bytes` equal to input; `delayMs` ignored outside e2e; `cancelled` code in `ERROR_CODES`. `client.test.ts`: `cancelAll()` rejects pending with code `cancelled`, terminates the worker, next `runCopy` spawns a new Worker. Implement `protocol.ts`, `handler.ts`, `worker.ts`, `client.ts` (`runCopy(input, onProgress?, delayMs?)`, `cancelAll`).
2. `flow/input.ts`: add `setDisabled(b)` (disables choose, every remove button, ignores drop while disabled; `render()` re-applies it) and an `onChange` callback param called after each list change. Extend `input.test.ts`.
3. New `flow/run.ts` pure helpers + unit tests (`run.test.ts`): `overall(i, n, p) = floor((i*100 + p) / n)`; monotonic clamp (`max(prev, next)`); a finished job counts as `(i+1)*100/n`, so a job without progress still advances.
4. New `flow/flow.ts` `createFlow(spec, startLabel, process, onDone)`: wraps `createInput`; builds start button (disabled while list empty, via `onChange`), `<progress max=100>` with `aria-label` (value via `.value`), Cancel button, visible status `<p>`, own `role=status aria-live=polite` region. Run loop: for each file in order, status `Processing {name} ({n} of {total})`, announce at start, each file switch, finish; read `new Uint8Array(await file.arrayBuffer())` right before the job; progress callback updates bar only (never announced). On start: disable input and start, show bar and Cancel, move focus to Cancel (Tab-reachable, native button gives Enter/Space). **Cancel does not rely on a job rejecting** (between files the loop awaits `file.arrayBuffer()` and no job is pending, so `cancelAll()` would reject nothing). The Cancel click handler runs the transition itself: `token++` (run token captured by the loop as `const my = token`), `running = false`, `cancelAll()`, then apply the cancelled UI directly: hide bar, `setDisabled(false)`, show start, focus start (after unhiding), status "Cancelled. Your files are still selected." shown and announced; no `onDone`. The run loop checks `my !== token` after EVERY `await` (after `file.arrayBuffer()`, after the job resolves, and in the job's catch) and returns silently with no DOM writes, no next job, no worker spawn. The catch for a `cancelled` rejection is therefore a no-op (token already bumped). On other error (token still current): stop, show generic `error.internal`-style message, re-enable. `destroy()`: if running, `token++`, `cancelAll()` (no UI update needed), then `input.destroy()`. A new Start bumps the token too, so a stale loop can never resume. Unit tests with a mocked client (jsdom): order, status text, disabled states, progress monotonic, cancel during a job (pending job rejects, UI shown once), **cancel during `file.arrayBuffer()`** (use a `File`/stub whose `arrayBuffer()` is a deferred promise; click Cancel; assert cancelled UI + status + focus on start immediately; resolve the deferred; flush; assert no job was started, `runCopy` not called again, no further DOM change, no `onDone`), cancel then start again runs from file 1, destroy cancels.
5. `flow/demo.ts`: use `createFlow` with `runCopy`, start label `demo.start`, `delay` from query, `onDone` sets `window.stapleOutputs`. Router already calls the view `destroy` on route change (AC 9).
6. `i18n/en.ts`: `flow.status` ("Processing {name} ({n} of {total})"), `flow.cancel`, `flow.cancelled`, `flow.done` (announce), `flow.progress.label`, `demo.start` ("Copy files"), `error.cancelled`. Add flow state `.flow-run`, `progress` styling under `main.tool-flow` using only `var(--…)` tokens; negative `outline-offset` if inside overflow-hidden; `[hidden]` needs `display:none` honoured.
7. `e2e/flow-run.e2e.ts` (see test plan). Update `window.staple` type if needed.

**Test plan**
- AC1: unit + e2e: start disabled on empty list; after add enabled; on click add/remove/start disabled, bar + Cancel visible.
- AC2: e2e with 3 files `a/b/c`, delay on: status text reads "Processing b.pdf (2 of 3)" at some point; unit asserts job call order.
- AC3: unit for `overall` and clamp; e2e samples `progress.value`, asserts non-decreasing and ends at 100; unit: job with no progress still advances.
- AC4: e2e, run of about 1.6 s per file: click theme toggle during run, `aria-pressed` flips within 200 ms.
- AC5: unit: cancel during `arrayBuffer()` shows cancelled UI with no pending job and starts no further job (see step 4). e2e: Cancel mid-run, time to "Cancelled" status under 500 ms, `stapleOutputs` unset, files still listed, input controls enabled, `document.activeElement` is start button, live region contains the cancelled text.
- AC6: e2e: after cancel, start again; run completes with all 3 outputs from first file (count and bytes equal inputs); unit: client spawns a new worker.
- AC7: e2e: live region text changes at start, per file, finish, cancel; no per-percent text (assert region texts set is only those messages); `progress` has accessible name (`getByRole('progressbar', {name})`).
- AC8: e2e: keyboard only (focus start, Enter, Tab or auto-focus lands on Cancel, Space/Enter cancels).
- AC9: e2e: during a run `history.pushState` + popstate (click home link) then assert no further result, and re-visiting `/demo` starts clean; unit: `destroy()` calls `cancelAll`.
- AC10: e2e: `window.stapleOutputs` has 3 entries with name, `inputSize`, bytes byte-equal to inputs.
- AC11: run `npm run lint && npm test && npm run build && npm run test:e2e`; existing `worker.e2e.ts` and `worker/*.test.ts` untouched and green.

**Risks / rollback**
- `delayMs` busy-wait must not ship: gated on the literal e2e MODE check; `prod-no-pdfium` style check is not needed but grep `dist-prod` for `delayMs` is a cheap guard.
- Terminating a worker mid-wasm drops the cached wasm load; next job refetches (fast, cached by HTTP). Accepted per story.
- Focus handoffs (to Cancel on start, to start on cancel) can be lost if the element is `hidden` at focus time: toggle visibility before `focus()`.
- Late promise from a destroyed or cancelled run must not touch the DOM or start a job: guard by run token, checked after every `await` in the loop (notably `file.arrayBuffer()`, where no job is pending and `cancelAll()` alone rejects nothing).
- Rollback: revert the commit; no data or format changes.

**Complexity**: standard. Several frontend modules, async cancellation and a11y focus/live-region behaviour, but no Rust, auth or data risk.

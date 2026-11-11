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

## Implementation Plan

**Affected areas**: backend (Rust core + wasm bindings), frontend (result step, worker client/protocol, i18n, CSS), data (ZIP correctness).

**Decision**: no `zip` crate (not in `Cargo.lock`, pulls flate2/time/etc., size). Hand-write a stored-only ZIP writer in `staple-core` (`src/zip.rs`), using `crc32fast` (already in `Cargo.lock` v1.5.5; add as a direct dep `crc32fast = "1.5.5"`, default-features off if it builds; licence MIT/Apache, `cargo deny` fine). Stored = AC9 satisfied (overhead ~ 30+46+2*name bytes + 22 per ZIP). Tech note allows the fallback; Rust keeps it in the worker with native tests. ZIP64 out of scope: return a typed error if total > u32::MAX or entries > 65535.

### Steps (test first)
1. `crates/staple-core/src/zip.rs` (+ `pub mod zip;` in `lib.rs`):
   - `pub fn unique_names(names: &[String]) -> Vec<String>`: pure. Split at last `.` when index > 0 (so `.gitignore` and extensionless names get `name (2)`). Comparison is CASE-FOLDED (`to_lowercase()` key in a `HashSet`) because Windows/macOS default file systems merge `Scan.pdf` and `scan.pdf` on extraction; output keeps original casing. TWO PASSES: pass 1 walks the inputs in order and marks an input "keeper" if its folded name is not yet in the reserved set (first occurrence), inserting it into the set, so every non-colliding literal name (e.g. `scan (2).pdf`) is reserved up front, wherever it sits in the list. Pass 2 walks the non-keepers (later duplicates) in order and tries `(2)`, `(3)`... until the folded candidate is unused, inserting each result. Result: `[scan.pdf, scan.pdf, scan (2).pdf]` -> `[scan.pdf, scan (3).pdf, scan (2).pdf]` (the literal `scan (2).pdf` keeps its name and position, the duplicate skips to 3). Output order matches input order.
   - `pub fn zip_stored(entries: &[(&str, &[u8])]) -> Result<Vec<u8>, ZipError>`: local header (sig 0x04034b50, version 20, flags bit 11 = 0x0800 UTF-8, method 0, DOS time/date fixed 1980-01-01 = date 0x0021, crc32, sizes, name), data, then central directory + EOCD. No `unwrap`/`expect`/panic: use `u32::try_from`/`u16::try_from` -> `ZipError::TooLarge`. `thiserror` enum with `code()` like `demo.rs`/`compress.rs` (look at their pattern; map to existing codes `too_large`, `internal`; do not add new ErrorCode unless needed).
   - Tests first: dedup (`scan.pdf` x3 -> `scan.pdf`, `scan (2).pdf`, `scan (3).pdf`; EXACT case `[scan.pdf, scan.pdf, scan (2).pdf]` -> `[scan.pdf, scan (3).pdf, scan (2).pdf]`; case-fold `[Scan.pdf, scan.pdf]` -> `[Scan.pdf, scan (2).pdf]`; also `[scan.pdf, SCAN.PDF, scan (2).pdf]` all distinct after fold; no extension; dotfile); ZIP round trip using a tiny test-only parser of the central directory (names, crc via `crc32fast`, contents, flag bit 11 set for `relatório.pdf`); size <= sum + 1 KB/entry; empty list and 0-byte entry ok.
2. `crates/staple-wasm/src/lib.rs`: `#[wasm_bindgen] pub fn zip_files(names: Vec<String>, datas: &js_sys::Array) -> Result<Vec<u8>, JsValue>`; convert each item with `js_sys::Uint8Array::new(&v).to_vec()`; length mismatch -> error `internal`. Errors thrown as code string, as the other bindings.
3. `web/src/worker/protocol.ts`: add `ZipJobMessage { type: 'zip'; id; names: string[]; datas: ArrayBuffer[] }`, add to `WorkerIn`. Reply reuses `BytesMessage`.
4. `web/src/worker/handler.ts`: add `zip_files` to `Core`; new `handleZip(msg, core, post)` with the same try/catch -> error message pattern (reuse `toCode`/`MESSAGES`; refactor the catch into a small shared helper). `worker.ts`: dispatch `msg.type === 'zip'` to `handleZip` before `handleJob`; `handler.test.ts` gets cases (success posts `bytes`; throw `too_large` -> error msg; unknown -> `internal`).
5. `web/src/worker/client.ts`: `runZip(files: {name; bytes}[]): Promise<Uint8Array>`. COPY each output (`bytes.slice().buffer`) and transfer the copies, so the cards' originals stay usable (AC6, tech note). Same pending/try-postMessage error handling as `post()`; share by generalising `post` minimally or duplicating the small promise block like `runPdfium`. `client.test.ts`: copies sent, originals not detached, result returned.
6. `web/src/i18n/en.ts`: `result.zip` 'Download all (ZIP)', `result.zip.label` 'Download all {n} files as ZIP', `result.zip.busy` 'Preparing ZIP…'. Error text: reuse the worker error `message` (plain-language `error.internal`/`error.too_large`); no new key unless a ZIP-specific message is wanted.
7. `web/src/flow/result.ts`: `createResults(outputs, onStartOver, zipName)` where `zipName` is `staple-{tool}.zip`. Add a `.result-zip` primary button BEFORE `list` only when `outputs.length >= 2`. Click: disable, set button text to busy text and set the existing `live` region text to the busy text (via rAF per CLAUDE.md; `live` is visually-hidden, so it is for announcing only), `await runZip(...)`, `downloadBytes(zip, zipName)`, finally re-enable and restore label. ERROR (decided): add a VISIBLE `p.result-zip-error` with `role="alert"`, created empty and `hidden` (or not attached) and inserted above `list`, below the ZIP button. Catch: set its text (via rAF) to `WorkerError.message` (else `t('error.internal')`), show it, re-enable the button. Clear text and hide it at the start of the next attempt. Do NOT put the error only in `live`. Single Download buttons are untouched. AC7: `downloadBytes` already revokes on a later task; keep a guard so a destroyed view does not touch the DOM (token/flag cleared in `destroy`). `aria-label` = `tf('result.zip.label', {n})`; while busy keep aria-disabled semantics via `disabled`.
   - `demo.ts`: pass `'staple-demo.zip'`. Any other caller of `createResults` (grep) gets the name from its tool id.
8. `web/src/style.css`: spacing rule for `main.tool-flow .result-zip` (margin-bottom with `var(--…)` tokens only); reuse existing button styles/focus ring. Add `main.tool-flow .result-zip-error` using the existing error colour token (grep `style.css` for how other error text is styled; reuse that token, text must NOT use the visually-hidden class; `tokens.test.ts` contrast check must pass). No hard-coded colours.
9. `web/src/flow/result.test.ts`: mock `../worker/client` `runZip`; cases for AC1 (2 -> button, 1 -> none, position before list), busy state/disabled/text, error path (`p.result-zip-error` exists, has `role=alert`, is NOT inside/under the visually-hidden `live`, is not `hidden`, text equals the error message after rAF; button re-enabled; single downloads still call `downloadBytes`; a second attempt clears the error first), ZIP name passed to the download, count in aria-label.
10. `web/e2e/result.e2e.ts` (or new `zip.e2e.ts`): demo route with 3 files incl. two identical names and `relatório.pdf`; `Promise.all([waitForEvent('download'), click])`; suggested filename `staple-demo.zip`; read the download with a small stored-ZIP central-directory parser in the test (helper in `web/e2e/`), assert entry names (`scan.pdf`, `scan (2).pdf`, `relatório.pdf` incl. UTF-8 flag), byte-for-byte contents, size bound; keyboard: focus the button via Tab, Enter and Space trigger it, `outline-style`/width non-zero (computed); button re-enabled after; main thread responsiveness is covered by "build is in the worker" (assert via the `zip` worker op being used, not a timing test). Cancel nothing else.
11. Run the full CI command list from CLAUDE.md (`cargo fmt --check`, clippy `-D warnings`, `cargo test --workspace`, `cargo deny check`, wasm build; in `web/`: lint, test, build, `test:e2e`).

### Test plan per AC
1. result.test.ts (2 vs 1 outputs, DOM order) + e2e visible.
2. e2e: download name `staple-demo.zip`, parsed entries and bytes; Rust round-trip test.
3. Rust `unique_names` unit tests (incl. `[scan.pdf, scan.pdf, scan (2).pdf]` and `[Scan.pdf, scan.pdf]`) + e2e with duplicate names.
4. Rust test for flag bit 11 and UTF-8 name bytes; e2e name check.
5. result.test.ts with a deferred `runZip` promise: disabled + busy text + live region; worker usage verified by handler/client tests (build is only reachable via `runZip`).
6. result.test.ts rejected `runZip`: visible `p.result-zip-error` (role=alert) with text, re-enabled, single Download still works; optional e2e check of computed visibility is not needed (jsdom cannot see layout, so the unit test asserts it is not `hidden` and not in `live`).
7. result.test.ts: `URL.revokeObjectURL` called after timers run, button re-enabled; e2e second click works.
8. e2e keyboard (Tab/Enter/Space, computed outline).
9. Rust size-bound test (2 x 1 MB); e2e size assertion.
10. Full command list above; `cargo deny check` (crc32fast already allowed).

### Risks / rollback
- ZIP bugs corrupt user data: mitigated by round-trip tests plus the e2e parse; real `unzip` check manually once.
- Memory: ZIP build holds originals + copies + output (about 3x total). Accepted per FR-8; OOM surfaces as the AC6 error path (a wasm alloc failure may trap -> worker `onerror` -> `internal` error, worker is respawned).
- `Vec<String>` / `js_sys::Array` binding shape on wasm-bindgen 0.2.130: verify by building; fall back to passing names joined as a JSON string if it fails.
- `createResults` signature change: grep all callers/tests.
- Rollback: revert the PR; no data migration.

**Complexity**: standard. New binary-format writer plus worker protocol change across Rust and TS; data integrity matters, but the scope is small and well bounded.

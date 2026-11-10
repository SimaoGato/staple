---
id: STORY-04
epic: EPIC-01
status: draft
pr: null
---

# Run the WASM core in a Web Worker with progress messages

## User story
As a Staple user, I want file processing to run off the main thread with visible progress, so that the page never freezes, even on large files.

## Context
EPIC-01 (`docs/epics/EPIC-01-foundation.md`). PRD FR-3, plus §7 Security: parse untrusted input only inside the WASM sandbox in a worker. This story proves the pipeline with a demo operation. Real tools come in later epics.

## Acceptance criteria
1. Given the app is loaded, when the main thread sends a job to the worker, then the WASM module is instantiated inside the worker, never on the main thread.
2. Given a demo core operation that takes input bytes and returns them transformed (e.g. a byte count and checksum), when it runs through the worker, then the main thread receives the correct result. A test covers this.
3. Given a long demo job, when it runs, then the worker sends progress messages from 0 to 100 that only go up, and the main thread receives them before the final result.
4. Given input bytes, when they are sent to the worker, then they are transferred (zero-copy `Transferable`), not structured-cloned.
5. Given the core operation returns an error, when it crosses the WASM boundary, then the main thread receives a typed error object with a stable error code. No uncaught exception reaches the console.
6. Given the production build, when it is served, then the `.wasm` file loads with `Content-Type: application/wasm`, and the home page does not download it until a job starts.
7. Given the core crate, when the demo operation is tested natively with `cargo test`, then it passes without the WASM target.

## Out of scope
- Cancel button and user-facing progress UI (EPIC-03).
- Multi-threaded WASM (COOP and COEP headers are set in STORY-05).

## Technical notes
- `wasm-bindgen` + `wasm-pack` (or `wasm-bindgen-cli`) builds the WASM. Use a Vite module worker. Check the APIs against the exact versions in the lockfiles (CLAUDE.md § Rust practices).
- Define the message protocol as a small typed union in TypeScript: `job`, `progress`, `result`, `error`.
- Progress callback: the core takes a `FnMut(u8)`-style reporter. The WASM crate forwards it to `postMessage`.

## Implementation Plan

**Affected areas**: backend (core + wasm crates), frontend (worker bridge, Vite config), infra (CI web job, build scripts).

**Decisions made (not blocking)**
- Demo op: `demo_checksum(input, progress)` returns `{ byte_count, checksum }` (FNV-1a 32-bit, chunked loop so progress is real). Empty input returns `CoreError::EmptyInput`, which is the error path for AC5.
- Error crossing WASM boundary: wasm fn returns `Err(JsValue::from_str(code))` with stable codes (`empty_input`, ...). The worker wraps it as `{ type:'error', code, message }`. No exception escapes: worker catches everything; unknown throw maps to `internal`.
- Build: `wasm-bindgen-cli` pinned to the Cargo.lock version (0.2.130), `--target web`, output to `web/src/wasm-pkg/` (gitignored). Neither `wasm-bindgen` nor `wasm-pack` is installed locally: story must add install steps (CI + CLAUDE.md).
- Browser hook: `main.ts` sets `window.staple = { runDemo }` so Playwright can drive a real job (no UI is in scope). Remove in EPIC-03.

**Steps (test first)**
1. Core: add `thiserror` and `crates/staple-core/src/demo.rs` (`pub mod demo`). `CoreError` enum with `code(&self) -> &'static str`. Tests first: known checksum/count for fixed bytes; empty input errors; progress starts at 0, ends at 100, is non-decreasing; large input (e.g. 1 MiB) still ends at 100. Rustdoc example on the public fn. Reporter is `impl FnMut(u8)`. Never panic (no indexing or unwrap). Run `cargo deny check` for thiserror licence.
2. WASM crate: add `js-sys` (same wasm-bindgen family). `#[wasm_bindgen] pub fn demo(input: &[u8], on_progress: &js_sys::Function) -> Result<DemoResult, JsValue>`. `DemoResult` is a wasm_bindgen struct with getters `byte_count` (u32 or f64) and `checksum` (u32). Calls the callback with the `u8` as `JsValue`; ignore callback errors. Keep `version()`.
3. Web scripts: add `build:wasm` (`cargo build -p staple-wasm --target wasm32-unknown-unknown --release && wasm-bindgen --target web --out-dir src/wasm-pkg ../target/wasm32-unknown-unknown/release/staple_wasm.wasm`). Make `dev`, `build`, `test` and `lint` run it first, or add `pre*` scripts. Add `src/wasm-pkg` to `.gitignore`, `.prettierignore` and the eslint `ignores`.
4. `web/vite.config.ts`: `worker: { format: 'es' }`, `build.assetsInlineLimit: 0` (so the tiny `.wasm` is never inlined as a `data:` URL, which would break CSP and AC6).
5. `web/src/worker/protocol.ts`: typed unions. In: `{type:'job', id, op:'demo', input: ArrayBuffer}`. Out: `{type:'progress', id, percent}`, `{type:'result', id, byteCount, checksum}`, `{type:'error', id, code, message}`. Error codes are a string-literal union.
6. Tests first (Vitest), then `web/src/worker/handler.ts`: pure `handleJob(msg, core, post)` with `core` injected. Test with a fake core: progress then result order; core throwing a code becomes a typed error; non-string throw becomes `internal`; no throw escapes. Error messages go through `t()` (add keys to `web/src/i18n/en.ts`).
7. `web/src/worker/worker.ts`: module worker. On first message it does `const m = await import('../wasm-pkg/staple_wasm.js'); await m.default()` (lazy; cached promise). Then it calls `handleJob` and `self.postMessage`. The input buffer is already owned by the worker (transferred).
8. `web/src/worker/client.ts`: `runDemo(input: Uint8Array, onProgress?)`. It lazily creates the worker on first call via `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })`. It posts `postMessage(msg, [buf])` (AC4), correlates by `id`, resolves with the result, and rejects with a typed `WorkerError {code,message}`. Handle `worker.onerror` by rejecting pending jobs with `internal`. Tests with a fake Worker: transfer list contains the buffer and the sent buffer is detached (AC4); progress callbacks precede resolution; error rejects with the code; worker not constructed until first call.
9. `main.ts`: expose `window.staple.runDemo`, with a type declaration.
10. Playwright `web/e2e/worker.e2e.ts` (same console-error guard as the app-shell test): addInitScript spies `WebAssembly.instantiate*` on the main thread; home load makes no `.wasm` request; `runDemo` on a known buffer returns the right count and checksum; progress array is monotonic and ends at 100; `.wasm` response has `content-type: application/wasm`; `runDemo(new Uint8Array(0))` rejects with `code === 'empty_input'`; the main-thread spy was never called; no console errors.
11. CI web job: add Rust toolchain install (`rustup toolchain install`) and the `wasm-bindgen-cli@0.2.130` install (taiki-e install-action, or `cargo install --locked --version 0.2.130`). Pin the action by SHA as the existing ones are. Add a comment that the version must match Cargo.lock. Update the `CLAUDE.md` Commands section (wasm build, install of wasm-bindgen-cli).

**Test plan**
- AC1: e2e main-thread `WebAssembly` spy not called; worker file holds the only instantiate; Vitest: worker is not created before the first call.
- AC2: Rust unit test (fixed vector) plus Vitest handler test plus e2e real run with the known checksum.
- AC3: Rust progress test (0 start, 100 end, monotonic); Vitest ordering test; e2e check on the real worker.
- AC4: Vitest transfer-list and detached-buffer (`byteLength === 0`) assertion.
- AC5: Rust `code()` test; Vitest error mapping; e2e empty input gives `empty_input` and no console error.
- AC6: e2e: no `.wasm` request on home; after a job the response has `application/wasm` (preview server serves it so; STORY-05 re-checks on the deployed site).
- AC7: `cargo test --workspace` with no wasm target.

**Risks / rollback**
- The local and CI toolchain gain a new dependency (`wasm-bindgen-cli`); a version mismatch with Cargo.lock fails at runtime. Pin it and document.
- The `rustc` release wasm build makes `npm test`/`lint` slower; if that annoys, split the scripts so only `build`/`dev`/`tsc` need the pkg.
- Callback posts from inside the sync wasm loop: messages queue and are delivered in order, so the ordering guarantee holds. Progress is not live-rendered until the worker yields, which is fine for the demo.
- Rollback: revert the PR; additive only.

**Complexity**: complex. Multiple modules (core, wasm, worker, Vite, CI) and a new build toolchain with several unverifiable-in-jsdom behaviours, so e2e is required.

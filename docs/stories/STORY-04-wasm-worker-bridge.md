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

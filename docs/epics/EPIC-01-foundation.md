# EPIC-01 — Foundation

**Goal.** Set up the skeleton every tool runs on. This means a Rust core and a WASM crate, a TypeScript + Vite app shell with one page per tool, a Web Worker bridge, CI quality gates and a Cloudflare deploy with strict headers. With these in place, every later epic only adds features. Doing it first also locks in the privacy promise (CSP) and the Rust practices from `CLAUDE.md`.

## In scope
- Cargo workspace: a core crate with no `wasm-bindgen`, plus a thin `-wasm` bindings crate. Pinned toolchain and `[workspace.lints]`.
- Vite + TypeScript app: a home page listing the five tools, and one route per tool, each a placeholder for now (FR-1).
- Worker bridge: the WASM core runs in a Web Worker and sends progress messages (FR-3).
- i18n string layer, with all UI strings in English.
- CI gates: `cargo fmt`, `cargo clippy -D warnings`, `cargo test`, `cargo deny`, TypeScript lint and tests, and a build.
- Benchmark harness and a reference file set, for checking M1.
- Deploy to Cloudflare Workers Static Assets. `_headers` sets CSP (FR-24), COOP and COEP (D-3).
- AGPL-3.0 `LICENSE` file.
- Fill the Commands and Layout sections of `CLAUDE.md`.

## Out of scope
- Any real tool logic.
- Analytics endpoint in the CSP (EPIC-09).
- Service worker (EPIC-08).
- Custom domain (EPIC-10).

## Depends on
- None

## Done signals
- A push to `main` runs all CI gates and deploys to a Cloudflare URL.
- The deployed app shows the home page and five tool routes. A dummy WASM call returns through the worker.
- Response headers include the CSP, COOP and COEP.

## Candidate stories
- Scaffold Cargo workspace (core + wasm crates) with lints and toolchain
- Scaffold Vite + TypeScript app shell with home page and tool routes
- Run the WASM core in a Web Worker with progress messages
- Add i18n string layer
- CI pipeline with Rust and TypeScript quality gates
- Benchmark harness and reference file set
- Deploy to Cloudflare with CSP, COOP and COEP headers

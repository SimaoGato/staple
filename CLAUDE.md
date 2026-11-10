# Staple

<!-- Project brief. Loaded into every Claude session and subagent: keep it under ~60 lines, link docs instead of copying them. -->

## What
Browser-only PDF and image tools (compress, merge, split, convert, resize) for everyday paperwork, for the general public on desktop. Files never leave the device: all processing runs locally in Rust compiled to WebAssembly. Free, no account, no ads. Details: `docs/product/PRD.md`.

## Stack
- Core: Rust library compiled to WebAssembly, run in a Web Worker
- Front end: TypeScript + Vite, no UI framework
- Static hosting, no backend; offline PWA via service worker
- PDF rendering: PDFium via `pdfium-render`, lazy-loaded. PDF compression engine: decided by spike (PRD D-2)
- Hosting: Cloudflare Workers Static Assets; headers (CSP, COOP/COEP) in `_headers`
- Analytics: Umami Cloud, cookieless, tool-name events only
- Licence: AGPL-3.0; `cargo deny` checks dependency licences

## Commands
- Build: `cargo build --workspace`; WASM: `cargo build -p staple-wasm --target wasm32-unknown-unknown`
- Test: `cargo test --workspace`. CI also runs the Lint gates below.
- Lint / format: `cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo deny check`
- Run locally: <tbd>

## Layout
- `crates/staple-core`: Rust core, no `wasm-bindgen`
- `crates/staple-wasm`: thin WASM bindings over the core

## Rust practices
- Edition 2024, stable toolchain pinned in `rust-toolchain.toml`. Follow the Rust API Guidelines: https://rust-lang.github.io/api-guidelines/
- CI gates: `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test`, `cargo deny check`.
- Set lints in `[workspace.lints]`: `clippy::pedantic` warn; `unwrap_used`, `expect_used`, `panic` deny outside tests; `unsafe_code` forbid except in the PDFium FFI glue.
- Input files are untrusted. Never panic on bad input: return a typed error (`thiserror` enum). Map errors to user messages at the WASM boundary.
- Keep the core crate free of `wasm-bindgen`. A thin `-wasm` crate does the bindings, so the core is tested natively with `cargo test`.
- Public items get rustdoc. Prefer doc examples that run as tests.
- Before using a crate API, read the docs for the exact version in `Cargo.lock`: `cargo doc -p <crate>`, `https://docs.rs/<crate>/<version>`, or the source in `~/.cargo/registry/src`. Never guess an API from memory.

## Conventions & gotchas
<!-- codifier maintains this: one line each, obsolete lines removed. -->
- Never send file bytes, names or sizes over the network. CSP allows only self + the analytics endpoint.
- All UI strings go through the i18n layer (English only at launch).

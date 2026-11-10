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
- Test: `cargo test --workspace`
- CI: `.github/workflows/ci.yml` is the source of truth for what CI runs
- Lint / format: `cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo deny check`
- Web (Node >=22.12, `web/.nvmrc`; e2e is not in CI): install `cd web && npm ci`; run locally `npm run dev`; build `npm run build`; test `npm test`; browser tests `npm run test:e2e` (Playwright, Chromium; once per machine: `npx playwright install --with-deps chromium`); lint `npm run lint`

## Layout
- `crates/staple-core`: Rust core, no `wasm-bindgen`
- `crates/staple-wasm`: thin WASM bindings over the core
- `web/`: TypeScript + Vite app (vanilla TS, Vitest, ESLint, Prettier)

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
- Never send file bytes, names or sizes over the network. CSP allows only self + the analytics endpoint, and forbids `unsafe-inline`: no inline `<script>`/`<style>`, `style=` attributes or `el.style` writes; CSS lives in `web/src/style.css`.
- All UI strings go through the i18n layer (English only at launch). `t()` keys are typed from `web/src/i18n/en.ts`, so a missing key fails `tsc`: no `as Key` casts or runtime fallbacks.
- Web DOM is built with `createElement` + `textContent`, never `innerHTML`.
- jsdom has no layout or focus-ring rendering: check visible focus and computed styles in Playwright (`web/e2e`), not Vitest.

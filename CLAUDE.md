# Staple

<!-- Project brief. Loaded into every Claude session and subagent: keep it under ~60 lines, link docs instead of copying them. -->

## What
Browser-only PDF and image tools (compress, merge, split, convert, resize) for everyday paperwork, for the general public on desktop. Files never leave the device: all processing runs locally in Rust compiled to WebAssembly. Free, no account, no ads. Details: `docs/product/PRD.md`.

## Stack
- Core: Rust library compiled to WebAssembly, run in a Web Worker
- Front end: TypeScript + Vite, no UI framework
- Static hosting, no backend; offline PWA via service worker
- PDF rendering: PDFium via `pdfium-render`, lazy-loaded. PDF compression engine: pure Rust (`lopdf` + `image`, `staple-core::compress`), PRD D-2, record `docs/decisions/D-2-compression-engine.md`
- Hosting: Cloudflare Workers Static Assets; headers (CSP, COOP/COEP) in `web/public/_headers`
- Deploy: CI `deploy` job runs `wrangler deploy` on push to main (secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`). Config `web/wrangler.jsonc`. Production URL: TBD, fill from the first deploy log (custom domain: EPIC-10)
- Analytics: Umami Cloud, cookieless, tool-name events only
- Licence: AGPL-3.0; `cargo deny` checks dependency licences

## Commands
- Build: `cargo build --workspace`; WASM: `cargo build -p staple-wasm -p staple-pdfium-wasm --target wasm32-unknown-unknown`
- Test (exact CI commands, `.github/workflows/ci.yml`): `cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test --workspace && cargo deny check && cargo build -p staple-wasm -p staple-pdfium-wasm --target wasm32-unknown-unknown`; in `web/`: `npm ci && npm run lint && npm test && npm run build` (needs the Rust toolchain + `wasm-bindgen-cli`)
- Benchmark (native, dev-only `crates/staple-bench`): `cargo run -p staple-bench --release --bin gen-refset` writes the gitignored reference set to `bench/refset/`; `cargo run -p staple-bench --release --bin bench -- demo [--runs N] [--dir PATH]` prints JSON timings; full-size check: `cargo test -p staple-bench --release -- --ignored`; compression spike ops `compress-rust` and (feature `pdfium`, needs a local PDFium library from `PDFIUM_DYNAMIC_LIB_PATH` or gitignored `./pdfium/lib`) `compress-pdfium`; in-browser timing: `COMPRESS_SPIKE_FILE=<pdf> npx playwright test compress-spike --workers=1` in `web/` (one worker: parallel runs of the 20 MB file can exhaust RAM)
- PDFium spike: `scripts/fetch-pdfium-wasm.sh` (pinned prebuilt, to gitignored `web/pdfium-wasm/`; `npm run build:pdfium`); e2e needs it and `gen-refset` first; measurements `PDFIUM_SPIKE=1 npx playwright test pdfium-spike -g measure --workers=1` in `web/`; record `docs/decisions/D-1-pdfium-wasm.md`
- Deployed check: `E2E_BASE_URL=<url> npm run test:e2e:deployed` in `web/` (CI runs it after deploy, with the header `curl` assertions)
- WASM for web: needs `wasm-bindgen-cli` at the `Cargo.lock` wasm-bindgen version (`cargo install --locked --version <that version> wasm-bindgen-cli`; CI pin: `ci.yml`); `npm run build:wasm` writes `web/src/wasm-pkg/` and `web/src/pdfium-pkg/` (gitignored), run automatically before `dev` and `build`
- Web (Node >=22.12, `web/.nvmrc`): install `cd web && npm ci`; run locally `npm run dev`; build `npm run build`; test `npm test`; browser tests `npm run test:e2e` (Playwright, also run in CI, Chromium; once per machine: `npx playwright install --with-deps chromium`); lint `npm run lint`

## Layout
- `crates/staple-core`: Rust core, no `wasm-bindgen`
- `crates/staple-wasm`: thin WASM bindings over the core
- `crates/staple-pdfium-wasm`: spike: PDFium rendering via `pdfium-render`, wasm32 only, built by `npm run build:wasm`
- `crates/staple-bench`: dev-only benchmark harness and reference file generator
- `web/`: TypeScript + Vite app (vanilla TS, Vitest, ESLint, Prettier)

## Rust practices
- Edition 2024, stable toolchain pinned in `rust-toolchain.toml`. Follow the Rust API Guidelines: https://rust-lang.github.io/api-guidelines/
- CI gates: see Commands > Test.
- Set lints in `[workspace.lints]`: `clippy::pedantic` warn; `unwrap_used`, `expect_used`, `panic` deny outside tests; `unsafe_code` forbid except in the PDFium FFI glue.
- Input files are untrusted. Never panic on bad input: return a typed error (`thiserror` enum). Map errors to user messages at the WASM boundary.
- Keep the core crate free of `wasm-bindgen`. A thin `-wasm` crate does the bindings, so the core is tested natively with `cargo test`.
- Public items get rustdoc. Prefer doc examples that run as tests.
- Before using a crate API, read the docs for the exact version in `Cargo.lock`: `cargo doc -p <crate>`, `https://docs.rs/<crate>/<version>`, or the source in `~/.cargo/registry/src`. Never guess an API from memory.

## Conventions & gotchas
<!-- codifier maintains this: one line each, obsolete lines removed. -->
- Never send file bytes, names or sizes over the network. CSP allows only self + the analytics endpoint, and forbids `unsafe-inline`: no inline `<script>`/`<style>`, `style=` attributes or `el.style` writes; CSS lives in `web/src/style.css`.
- Colours, fonts, sizes, spacing, radii are `:root` custom properties in `style.css`; dark set in the `:root[data-theme='dark']` block plus a no-JS `:root:not([data-theme])` copy (`tokens.test.ts` checks both); blocking `web/public/theme-init.js` sets `data-theme` before paint (stored choice or OS); header System/Light/Dark toggle stored in localStorage. New rules use `var(--…)`: `tokens.test.ts` fails on hard-coded colours and checks WCAG contrast of token pairs.
- Tests that regex-parse CSS/source must assert match counts, or a reformat passes silently.
- `vite.config.ts` feeds `web/public/_headers` to `vite preview`, so e2e runs under the real CSP. Keep header lines indented (`  Name: value`) or they are silently dropped.
- All UI strings go through the i18n layer (English only at launch). `t()` keys are typed from `web/src/i18n/en.ts`, so a missing key fails `tsc`: no `as Key` casts or runtime fallbacks.
- Web DOM is built with `createElement` + `textContent`, never `innerHTML`.
- jsdom has no layout or focus-ring rendering: check visible focus and computed styles in Playwright (`web/e2e`), not Vitest.
- Focus outlines are clipped by any `overflow: hidden` ancestor: use a negative `outline-offset` so the ring sits inside the box.
- CSS is global: scope page-only rules to a route class (e.g. `main.home > h1`), or they leak into every route.
- wasm32 `usize` is 32-bit: do size × percent math in u64 (a u32 multiply overflows on large inputs).
- Vite must not inline `.wasm` (`build.assetsInlineLimit: 0` in `web/vite.config.ts`): CSP forbids `data:` URLs. `pdfium.esm.js` (ES-module glue) runs under `'wasm-unsafe-eval'` with no patch.
- `postMessage` transfers only a whole ArrayBuffer: copy partial views or SharedArrayBuffer first (`web/src/worker/client.ts`).
- Worker error: `terminate()` and drop the worker; never cache a failed wasm load, so the next job retries.
- `window.staple` hook and PDFium code exist only under the literal `import.meta.env.MODE === 'e2e'` (a non-literal test leaves them in the build): Playwright's `--mode e2e` server on :4173 is never reused; `prod-no-pdfium.e2e.ts` checks the default-mode `dist-prod` on :4174. The deployed site has no hook.
- A non-allowlisted licence for a dev-only or native-only dep (cargo-deny checks all targets, e.g. `libloading` under `pdfium-render`) goes in `deny.toml` as a per-crate `[[licenses.exceptions]]` entry, never a global `allow`. A shipped wasm dep's licence goes in `allow` after review.
- Untrusted images: decoded size is not file size. Check Width/Height from the PDF dict or set `image::Limits` before decoding (a tiny JPEG can decode to GBs and OOM wasm32).
- Rewriting a PDF image: `ColorSpace`, `BitsPerComponent` and `Decode` must match the new pixels, or leave the image untouched (`staple-core::compress`).

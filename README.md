# Staple

Browser-only PDF and image tools (compress, merge, split, convert, resize). All processing runs locally in Rust compiled to WebAssembly, inside a Web Worker. No backend; files never leave the device. Static site, offline PWA.

Product spec: `docs/product/PRD.md`. Architecture decisions: `docs/decisions/`.

## Prerequisites

- Rust: toolchain pinned in `rust-toolchain.toml` (installs automatically via rustup, includes the `wasm32-unknown-unknown` target)
- `wasm-bindgen-cli`, exact version from `Cargo.lock` (CI fails on mismatch):
  ```sh
  cargo install --locked --version 0.2.130 wasm-bindgen-cli
  ```
- Node >= 22.12 (`web/.nvmrc`)
- `cargo-deny` for the licence check: `cargo install --locked cargo-deny`
- Playwright browser, once per machine: `cd web && npx playwright install --with-deps chromium`

## Daily commands

```sh
cd web
npm ci
npm run dev          # builds WASM (predev), starts Vite
npm test             # Vitest
npm run lint         # ESLint + Prettier
npm run test:e2e     # Playwright, Chromium, under the real CSP
npm run build        # builds WASM (prebuild), tsc, vite build
```

Rust:

```sh
cargo build --workspace
cargo test --workspace
cargo build -p staple-wasm -p staple-pdfium-wasm --target wasm32-unknown-unknown
```

## Before pushing: run what CI runs

From the repo root:

```sh
cargo fmt --check \
  && cargo clippy --all-targets -- -D warnings \
  && cargo test --workspace \
  && cargo deny check \
  && cargo build -p staple-wasm -p staple-pdfium-wasm --target wasm32-unknown-unknown
```

Then in `web/`:

```sh
npm ci && npm run lint && npm test && npm run build
```

Source of truth: `.github/workflows/ci.yml`.

## Layout

| Path | Purpose |
|------|---------|
| `crates/staple-core` | Rust core. No `wasm-bindgen`, tested natively. |
| `crates/staple-wasm` | Thin WASM bindings over the core. |
| `crates/staple-pdfium-wasm` | PDFium rendering via `pdfium-render` (wasm32 only). |
| `crates/staple-bench` | Dev-only benchmark harness and reference file generator. |
| `web/` | TypeScript + Vite app, no UI framework. |

## Benchmarks and PDFium

```sh
cargo run -p staple-bench --release --bin gen-refset               # writes bench/refset/ (gitignored)
cargo run -p staple-bench --release --bin bench -- demo --runs 5   # JSON timings
cargo test -p staple-bench --release -- --ignored                  # full-size checks
scripts/fetch-pdfium-wasm.sh                                       # pinned PDFium WASM to web/pdfium-wasm/
```

PDFium e2e tests need both `gen-refset` and `fetch-pdfium-wasm.sh` first.

## Deploy

Push to `main` runs the CI `deploy` job (`wrangler deploy` to Cloudflare Workers Static Assets), then e2e and header checks against the deployed URL. Config: `web/wrangler.jsonc`. Security headers (CSP, COOP/COEP): `web/public/_headers`.

Check a deployed build manually:

```sh
cd web && E2E_BASE_URL=<url> npm run test:e2e:deployed
```

## Rules that bite

- Never send file bytes, names or sizes over the network. CSP allows only self and the analytics endpoint.
- No inline scripts or styles, no `innerHTML`, no `el.style` writes. CSS lives in `web/src/style.css` and uses `var(--…)` tokens.
- Input files are untrusted. Rust code returns typed errors, never panics (`unwrap`/`expect`/`panic` are denied by lint).
- All UI strings go through `t()` in `web/src/i18n/`.

Full contributor notes: `CLAUDE.md`.

## Licence

AGPL-3.0. See `LICENSE`.

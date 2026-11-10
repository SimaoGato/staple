---
id: STORY-01
epic: EPIC-01
status: draft
pr: null
---

# Cargo workspace with core and WASM crates

## User story
As a Staple developer, I want a Rust workspace with a native-testable core crate and a thin WASM bindings crate, both under strict lints, so that every later feature starts from code that follows the project's Rust practices.

## Context
This is the first story of EPIC-01 (`docs/epics/EPIC-01-foundation.md`). Rust practices are in `CLAUDE.md` § Rust practices. Licence decision: PRD §8 D-6 (AGPL-3.0).

## Acceptance criteria
1. Given a fresh clone, when `cargo build --workspace` runs, then it builds two crates: a core crate with no `wasm-bindgen` dependency, and a `-wasm` crate that depends on the core.
2. Given the repo root, when `rustup show` runs, then the toolchain comes from `rust-toolchain.toml` (pinned stable) and includes the `wasm32-unknown-unknown` target.
3. Given `[workspace.lints]` in the root `Cargo.toml`, when a member crate uses `unwrap()` outside test code, then `cargo clippy --all-targets -- -D warnings` fails.
4. Given `[workspace.lints]`, when code uses `unsafe`, then compilation fails.
5. Given the core crate, when `cargo test --workspace` runs, then at least one unit test and one doc test pass on the native target. The doc test is on a placeholder public function such as `version()`.
6. Given the workspace, when `cargo build -p <wasm crate> --target wasm32-unknown-unknown` runs, then it succeeds.
7. Given a `deny.toml`, when `cargo deny check` runs, then it passes. A dependency with a licence that is not on the allow-list makes it fail.
8. Given the repo root, when someone reads it, then `LICENSE` holds the AGPL-3.0 text and `Cargo.toml` declares `license = "AGPL-3.0-only"`.
9. Given `CLAUDE.md`, when the story is done, then the Rust commands (build, test, lint, format) appear under Commands and the crate paths under Layout.

## Out of scope
- Web front end, worker and WASM loading in the browser (STORY-02, STORY-04).
- CI pipeline (STORY-03).
- Real PDF or image logic.

## Technical notes
- Suggested layout: `crates/staple-core`, `crates/staple-wasm`.
- `unsafe_code = "forbid"` at workspace level. The PDFium FFI glue (EPIC-06) can relax it later in its own crate.
- Lints: `clippy::pedantic` warn; `unwrap_used`, `expect_used`, `panic` deny. Allow them in tests via `clippy.toml` `allow-unwrap-in-tests` / `allow-expect-in-tests`.
- Edition 2024.

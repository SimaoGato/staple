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

## Implementation Plan

**Affected areas**: infra (toolchain, deny, licence), backend (Rust crates), docs (CLAUDE.md).

**Environment note**: `cargo`/`rustup` are not installed in this sandbox. Install rustup first (`sudo apt install rustup` or rustup.rs), then `cargo install cargo-deny --locked`. Pin a concrete stable version in `rust-toolchain.toml` (current stable at implementation time, must be >= 1.85 for edition 2024).

### Steps (test-first)
1. `rust-toolchain.toml`: `channel = "<pinned x.y.z>"`, `targets = ["wasm32-unknown-unknown"]`, `components = ["rustfmt", "clippy"]`, `profile = "minimal"`.
2. Root `Cargo.toml`: `[workspace] resolver = "3"`, `members = ["crates/*"]`; `[workspace.package]` with `edition = "2024"`, `license = "AGPL-3.0-only"`, `version`, `rust-version`, `repository`; `[workspace.lints.rust] unsafe_code = "forbid"`; `[workspace.lints.clippy] pedantic = { level = "warn", priority = -1 }`, `unwrap_used = "deny"`, `expect_used = "deny"`, `panic = "deny"`. Each member: `[lints] workspace = true`, `license.workspace = true`, `edition.workspace = true`.
3. `clippy.toml`: `allow-unwrap-in-tests = true`, `allow-expect-in-tests = true`, `allow-panic-in-tests = true` (verify the last key exists for the pinned clippy; if not, put `#![cfg_attr(test, allow(clippy::panic))]` in the crates).
4. `crates/staple-core` (lib, no deps): `pub fn version() -> &'static str { env!("CARGO_PKG_VERSION") }` with rustdoc and a running doc example (`assert_eq!(staple_core::version(), env!("CARGO_PKG_VERSION"))` or a non-empty check). Add a `#[cfg(test)]` unit test. Add a `thiserror` error enum only if needed; skip it here (YAGNI, no real logic).
5. `crates/staple-wasm` (`crate-type = ["cdylib", "rlib"]`): deps `staple-core = { path = "../staple-core" }` and `wasm-bindgen`. Read the docs for the exact version in `Cargo.lock` before use (CLAUDE.md rule). Expose `#[wasm_bindgen] pub fn version() -> String` calling core. Note that `wasm_bindgen` macro output may trip `unsafe_code = forbid`; the 0.2 macros are normally fine, but if the build fails, set `unsafe_code = "deny"` in this crate only and tell the reviewer. Verify rather than assume.
6. `deny.toml`: `[licenses] allow = ["AGPL-3.0-only", "AGPL-3.0-or-later", "MIT", "Apache-2.0", "Apache-2.0 WITH LLVM-exception", "BSD-2-Clause", "BSD-3-Clause", "ISC", "Unicode-3.0", "Zlib"]` (trim to what `cargo deny check` actually needs; the cargo-deny version determines the schema, so check its docs); `[advisories]` and `[bans]` defaults; `[sources]` unknown-registry/git = deny. Add `publish = false` or `[licenses.private]` handling to the workspace crates if they are flagged as unlicensed.
7. `LICENSE`: official AGPL-3.0 text (fetch from gnu.org/licenses/agpl-3.0.txt). Add `.gitignore` with `/target`. Commit `Cargo.lock`.
8. Update `CLAUDE.md` Commands and Layout:
   - Build: `cargo build --workspace`
   - Test: `cargo test --workspace` (full gates: fmt, clippy, test, deny)
   - Lint: `cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo deny check`
   - WASM: `cargo build -p staple-wasm --target wasm32-unknown-unknown`
   - Leave Run locally `<tbd>`.
   - Layout: `crates/staple-core`, `crates/staple-wasm`.

### Test plan (per AC)
1. `cargo build --workspace` succeeds; `cargo tree -p staple-core | grep -c wasm-bindgen` gives 0; `cargo tree -p staple-wasm` shows `staple-core`.
2. `rustup show` in the repo root reports the pinned channel, source `rust-toolchain.toml`, and the wasm32 target installed.
3. Temporarily add `Some(1).unwrap();` in non-test code: `cargo clippy --all-targets -- -D warnings` fails. Revert. A `unwrap` inside `#[cfg(test)]` passes.
4. Temporarily add an `unsafe {}` block: the build fails with a forbid error. Revert.
5. `cargo test --workspace` shows 1 or more unit test and 1 or more doc test passing in staple-core.
6. `cargo build -p staple-wasm --target wasm32-unknown-unknown` succeeds.
7. `cargo deny check` passes. Negative check: temporarily remove `MIT` from allow (or add a GPL-only dep) and confirm failure. Revert.
8. `head LICENSE` shows the AGPL-3.0 text; `grep license Cargo.toml` shows `AGPL-3.0-only`.
9. Review the CLAUDE.md diff.

Also run `cargo fmt --check`.

### Risks / rollback
- `wasm-bindgen` macro vs `unsafe_code = forbid`: see step 5. Fallback is a per-crate `deny`, noted in a comment.
- `pedantic` may flag the placeholder code (`must_use_candidate` on `version()`): add `#[must_use]`.
- cargo-deny schema changes between versions: follow the installed version's docs.
- Toolchain pin may lag stable; STORY-03 CI must use the same file.
- Rollback: pure addition of new files plus a CLAUDE.md edit, so revert the commit.

**Complexity**: standard. Many config files across two crates and a lint/licence policy that later stories depend on, but no logic.

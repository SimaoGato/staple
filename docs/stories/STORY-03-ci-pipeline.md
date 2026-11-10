---
id: STORY-03
epic: EPIC-01
status: draft
pr: null
---

# CI pipeline with Rust and TypeScript quality gates

## User story
As a Staple developer, I want every pull request and every push to `main` checked by CI, so that code that breaks formatting, lints, tests, licences or the build never lands.

## Context
EPIC-01 (`docs/epics/EPIC-01-foundation.md`). The gates are listed in `CLAUDE.md` § Rust practices. PRD §7 Security: pin dependencies and audit them in CI.

## Acceptance criteria
1. Given a pull request to `main`, when it opens or updates, then a GitHub Actions workflow runs `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test --workspace`, `cargo deny check`, the front-end lint, the front-end tests and `npm run build`.
2. Given any one of those steps fails, when the workflow finishes, then the run is red and names the failed step.
3. Given a push to `main`, when it lands, then the same workflow runs.
4. Given a dependency with a known RustSec advisory, when CI runs, then `cargo deny check` fails the run.
5. Given the WASM crate, when CI runs, then it also builds for `wasm32-unknown-unknown`.
6. Given a repeat run with unchanged `Cargo.lock` and `package-lock.json`, when CI runs, then Rust and npm dependencies come from cache.
7. Given `CLAUDE.md`, when the story is done, then "Test (what CI runs)" lists the exact CI commands.

## Out of scope
- Deployment (STORY-05).
- Benchmarks (STORY-06).

## Technical notes
- Pin each third-party action to a commit SHA.
- `npm ci` with a committed lockfile.
- Depends on STORY-01 and STORY-02 existing. If only one is merged, gate only what exists.

---
id: STORY-03
epic: EPIC-01
status: in_review
pr: 3
---

# CI pipeline with Rust and TypeScript quality gates

## User story
As a Staple developer, I want every pull request and every push to `main` checked by CI, so that code that breaks formatting, lints, tests, licences or the build never lands.

## Context
EPIC-01 (`docs/epics/EPIC-01-foundation.md`). The gates are listed in `CLAUDE.md` § Commands (Test). PRD §7 Security: pin dependencies and audit them in CI.

## Acceptance criteria
1. Given a pull request to `main`, when it opens or updates, then a GitHub Actions workflow runs `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test --workspace`, `cargo deny check`, the front-end lint, the front-end tests and `npm run build`.
2. Given any one of those steps fails, when the workflow finishes, then the run is red and names the failed step.
3. Given a push to `main`, when it lands, then the same workflow runs.
4. Given a dependency with a known RustSec advisory, when CI runs, then `cargo deny check` fails the run.
5. Given the WASM crate, when CI runs, then it also builds for `wasm32-unknown-unknown`.
6. Given a repeat run with unchanged `Cargo.lock` and `package-lock.json`, when CI runs, then Rust and npm dependencies come from cache.
7. Given `CLAUDE.md`, when the story is done, then "Test" lists the exact CI commands.

## Out of scope
- Deployment (STORY-05).
- Benchmarks (STORY-06).

## Technical notes
- Pin each third-party action to a commit SHA.
- `npm ci` with a committed lockfile.
- Depends on STORY-01 and STORY-02 existing. If only one is merged, gate only what exists.

## Implementation Plan

**Affected areas**: infra (GitHub Actions), docs (`CLAUDE.md`). No app code.

**Facts found**: no `.github/` yet. STORY-01 and STORY-02 are merged, so Rust and web both exist. `Cargo.lock`, `web/package-lock.json`, `web/.nvmrc`, `deny.toml` are committed. `rust-toolchain.toml` pins 1.99.1 with the wasm32 target, rustfmt and clippy, so rustup installs them automatically. `.claude/factory.yml` is untracked (`ci_required: false`, a temporary flag).

**Steps**
1. Create `.github/workflows/ci.yml`.
   - Triggers: `pull_request` (branches: main) and `push` (branches: main). Top-level `permissions: contents: read`. Add `concurrency` with cancel-in-progress for PRs.
   - Job `rust` (ubuntu-latest). Steps, each with its own `name` so a red run names the failed step:
     - `actions/checkout`.
     - Toolchain: run `rustup toolchain install` so rustup installs the pinned toolchain from `rust-toolchain.toml`. Do not use a third-party toolchain action.
     - `Swatinem/rust-cache` (keyed on `Cargo.lock`).
     - Install cargo-deny with `taiki-e/install-action` (tool: cargo-deny), or `EmbarkStudios/cargo-deny-action` as an alternative.
     - `cargo fmt --check`.
     - `cargo clippy --all-targets -- -D warnings`. Add `--workspace` only if the CLAUDE.md command is changed to match.
     - `cargo test --workspace`.
     - `cargo deny check`.
     - `cargo build -p staple-wasm --target wasm32-unknown-unknown`.
   - Job `web` (ubuntu-latest, `defaults.run.working-directory: web`). Steps:
     - checkout.
     - `actions/setup-node` with `node-version-file: web/.nvmrc`, `cache: npm`, `cache-dependency-path: web/package-lock.json`.
     - `npm ci`.
     - `npm run lint`.
     - `npm test`.
     - `npm run build`.
   - Pin every third-party action to a full commit SHA with a `# vX.Y.Z` comment. Resolve SHAs with `gh api repos/<owner>/<repo>/git/ref/tags/<tag>` (dereference annotated tags).
   - Skip the Playwright e2e run. It is not in the AC, and CLAUDE.md says web is "not in CI yet" (to be updated, see step 2).
2. Edit `CLAUDE.md`.
   - Change "Test" to list the exact CI commands: `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test --workspace`, `cargo deny check`, `cargo build -p staple-wasm --target wasm32-unknown-unknown`, and in `web/` `npm ci && npm run lint && npm test && npm run build`.
   - Remove "not in CI yet" from the Web line and note that e2e is not in CI.
3. Delete `.claude/factory.yml` (`rm`). It is untracked, so no git change. Do this last, after CI is in place, and leave other `.claude/` content alone. The file's own comment says to remove it after STORY-03 merges.
4. Verify locally: run each command from the workflow once. Lint the YAML (`actionlint` if available, otherwise a YAML parse). After the PR opens, confirm both jobs go green on GitHub.
5. AC4 check: temporarily add a crate with a known advisory, or an `[advisories]` check, to confirm `cargo deny check` fails. Do not commit it. `cargo deny check` runs the advisories check by default, so no `deny.toml` change is needed. Confirm that `deny check` fetches the advisory DB over the network in CI (it does).

**Test plan**
- AC1/AC3: workflow `on:` has both `pull_request` and `push` to main. Check with a YAML read, then observe the PR run on GitHub.
- AC2: each command is its own named step with no `continue-on-error`, so a failure makes the run red and shows the step name. Optionally push a throwaway commit with a formatting error and confirm a red `cargo fmt --check` step.
- AC4: `cargo deny check` includes advisories. Local sanity run, plus the throwaway check from step 5.
- AC5: the wasm build step exists. Confirm it is green in CI.
- AC6: re-run the workflow with unchanged lockfiles. Confirm the Rust cache and npm cache report "cache hit" in the logs.
- AC7: `grep` the CLAUDE.md "Test" line for the commands above.

**Risks / rollback**
- Risk: SHA pinning mistakes (annotated vs lightweight tags). Mitigate by verifying each SHA resolves.
- Risk: the first CI run may expose existing failures, for example a toolchain download issue, a licence missing from the `deny.toml` allow list, or an advisory hit. Fix them in this PR if small. Otherwise raise them.
- Risk: the `rust-cache` and `rustup show` steps hit the network. This is acceptable on GitHub runners.
- Rollback: delete `.github/workflows/ci.yml` and revert `CLAUDE.md`. The factory.yml deletion is not tracked by git.
- Required status checks in branch protection are a repo setting, not part of this PR. Mention it in the PR description.

**Complexity**: standard. Multi-job CI config with SHA pinning and caching across two toolchains. Low code risk, but the first run may surface existing failures.

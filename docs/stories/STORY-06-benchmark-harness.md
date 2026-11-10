---
id: STORY-06
epic: EPIC-01
status: in_review
pr: 7
---

# Benchmark harness and reference file set

## User story
As a Staple developer, I want a repeatable benchmark that times core operations on a fixed set of reference files, so that the engine spikes and the M1 speed target (under 5 s for a 20 MB, ~50-page PDF) are measured, not guessed.

## Context
EPIC-01 (`docs/epics/EPIC-01-foundation.md`). PRD M1, §8 assumptions (typical inputs). EPIC-02 spikes and the EPIC-10 CI gate use this.

## Acceptance criteria
1. Given a clean checkout, when the reference-set generator runs, then it writes the same files every time: (a) a ~20 MB, ~50-page image-heavy PDF, (b) a ~1 MB text-only PDF, (c) a 200-page PDF, (d) a set of 10 JPG and PNG photos of 12 MP. Running it twice gives byte-identical output, checked by a test that compares SHA-256 hashes.
2. Given the generated files, when someone looks for them in git, then they are not committed: the directory is in `.gitignore` and the generator recreates them.
3. Given the reference set, when the benchmark command runs with an operation name (initially the STORY-04 demo operation), then it runs that operation on every file a set number of times. It prints JSON with the file, the operation, and the median and max time in ms.
4. Given an unknown operation name, when the benchmark command runs, then it exits non-zero with the list of valid operations.
5. Given the benchmark command, when it runs in release mode, then it uses the core crate natively, with no browser.
6. Given `CLAUDE.md`, when the story is done, then the generator and benchmark commands are listed under Commands.

## Out of scope
- In-browser timing and the CI gate that fails on budget (EPIC-10).
- Real PDF operations to benchmark (EPIC-02 onwards adds them).

## Technical notes
- Generate the reference PDFs with fixed-seed synthetic images. This avoids licensing problems with real documents and keeps the repo small.
- The benchmark could be a `bench` binary in a dev-only crate (e.g. `crates/staple-bench`), so the core stays free of dev dependencies.
- Native timing only approximates WASM speed. Record that caveat in the output.

## Implementation Plan

**Affected areas**: backend (Rust workspace, new dev-only crate), infra (`.gitignore`, `CLAUDE.md`). No web/ux.

**Decisions** (no blockers)
- New crate `crates/staple-bench` (auto-member via `crates/*`), depends on `staple-core` by path. Core stays untouched and dev-dep free. Crate holds a lib (generator + op registry, so tests reach it) and two bins: `gen-refset`, `bench`.
- Deps (all MIT/Apache, pass `cargo deny`; check `cargo deny check` after adding): `flate2` (already in lock, for PDF Flate streams), `png`, `jpeg-encoder`, `sha2` (dev-dep, tests). Read docs for the Cargo.lock versions before use (CLAUDE.md rule). No `image`, no PDF crate.
- Determinism: own tiny seeded PRNG (splitmix64/xorshift) in the crate, not `rand` (stream is not guaranteed stable across versions). Synthetic image = smooth gradient + seeded noise (noise makes it incompressible, so size targets hold). PDFs are written by hand (header, objects, xref, trailer) with no timestamps or random IDs. Pin everything via `Cargo.lock`.
- Files go to `bench/refset/` (gitignored). Names: `image-heavy-20mb.pdf`, `text-1mb.pdf`, `pages-200.pdf`, `photo-01..10.{jpg,png}` (5 JPG + 5 PNG, 4000x3000 = 12 MP). Text PDFs use a built-in Helvetica font with seeded word text. 200-page PDF: tiny text pages.
- Sizes: "~" targets; tune the per-page image dimensions so file (a) lands 18-22 MB with 50 pages. Assert size range in a test.
- Op registry: `fn ops() -> &[(&str, fn(&[u8]))]` with one entry `demo`, calling `staple_core::demo::demo_checksum(bytes, |_| {})`. Adding ops in EPIC-02 = one line.
- Bench CLI: `cargo run -p staple-bench --release --bin bench -- <op> [--runs N] [--dir PATH]`; default runs 5, dir `bench/refset`. Per file: 1 warmup-free timed loop of N runs with `std::time::Instant`, median and max in ms. Prints one JSON object to stdout: `{"caveat":"native timing only approximates WASM speed","operation":..,"runs":N,"results":[{"file","operation","median_ms","max_ms"}]}`. Hand-format JSON (no serde) or add `serde_json` if it is simpler; escape file names (they are fixed ASCII, so simple formatting is fine). Missing refset dir: exit non-zero with "run gen-refset first".
- Unknown op: print `unknown operation "x"; valid: demo` to stderr, exit code 2. Validate op before touching the files.
- Error handling: no unwrap/expect/panic (workspace lint, deny). Use `Result` from `main` helpers and `std::process::ExitCode`.
- AC5 "release mode": `--release` is a cargo flag, nothing to code; document in CLAUDE.md. Native only, no wasm target for this crate (CI `cargo build -p staple-wasm` is unaffected).

**Steps (test first)**
1. Add crate skeleton, `.gitignore` line `/bench/refset`, deps. `cargo deny check`.
2. Write failing tests in `crates/staple-bench/src/lib.rs` (or `tests/`): determinism, sizes, op lookup, median/max helper.
3. Implement PRNG + image synth, JPEG/PNG encoders, PDF writer, `generate(dir, &Spec)`. `Spec` has a full-size default and a small override so tests run fast in debug mode.
4. Implement `gen-refset` bin (writes the full spec to `bench/refset`, prints file names and sizes).
5. Implement op registry, timing (`median`, `max` pure fn), `bench` bin, exit codes.
6. Update `CLAUDE.md` Commands: `cargo run -p staple-bench --release --bin gen-refset` and `cargo run -p staple-bench --release --bin bench -- demo`.
7. Run full CI Rust command set; run both bins manually in release and eyeball sizes and JSON.

**Test plan**
- AC1: test generates the small spec twice into two temp dirs, compares SHA-256 of every file (same names, same hashes). One `#[ignore]` test (or manual step 7) does the same at full spec and asserts size/page-count ranges: (a) 18-22 MB, 50 `/Type /Page`, (b) about 1 MB, (c) 200 pages, (d) 10 files, 5 jpg + 5 png, decoded dims 12 MP. Also a check that the PDFs start with `%PDF-` and end with `%%EOF`, and that xref offsets are correct (parse offsets, assert `obj` found there). Optionally open with `pdfium`/`qpdf` manually once.
- AC2: manual `git status` after generation shows clean; test or `git check-ignore bench/refset/x.pdf` in step 7.
- AC3: unit test for `median`/`max` (odd, even, single run); integration test runs the `bench` binary (`env!("CARGO_BIN_EXE_bench")`) on a small generated dir and parses output for keys `file`, `operation`, `median_ms`, `max_ms`, one entry per file.
- AC4: integration test: `bench nope` exits non-zero and stderr contains `demo`.
- AC5: manual `cargo run --release`; code review that the crate has no browser/wasm deps.
- AC6: read `CLAUDE.md` diff.

**Risks / rollback**
- Generating 12 MP x10 plus 20 MB PDF in debug `cargo test` is slow: tests use the small spec only; full spec is `#[ignore]`/manual.
- New crate runs under `cargo test --workspace` and clippy pedantic (`cast_*` lints on size math: use `u64`/`try_from`, per the u64 rule in CLAUDE.md).
- Byte-identical output relies on pinned flate2/png/jpeg-encoder versions; a lockfile bump may change hashes, which is fine since the test compares run-to-run, not against stored hashes.
- Rollback: delete the crate, `.gitignore` line and CLAUDE.md lines. No other code touched.

**Complexity**: standard. New crate, hand-written PDF writer and several deps, but no auth, security or data-integrity risk.

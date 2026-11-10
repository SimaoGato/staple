---
id: STORY-06
epic: EPIC-01
status: draft
pr: null
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

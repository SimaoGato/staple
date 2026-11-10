---
id: STORY-14
epic: EPIC-03
status: draft
pr: null
---

# Result card with one-click download

## User story
As a user whose files have been processed, I want to see each output's name and size, how much the size changed, and download it with one click, so that I know the tool worked and can use the file right away.

## Context
EPIC-03 (`docs/epics/EPIC-03-shared-tool-flow.md`). PRD FR-4 (clear result: output name, size, size change where relevant, one-click download), FR-5 (a single download is always offered), journey 1 in §5 (size before and after), §7 Accessibility. Builds on STORY-13, which hands over the list of outputs.

Copy (add to `web/src/i18n/en.ts`, wording may be polished in review):
- Results heading: "Done" (screen-reader text includes the count, e.g. "Done: 3 files ready")
- Size change: "{percent}% smaller" / "{percent}% larger" / "Same size"
- Download button: "Download"; accessible name "Download {name}"
- Start over button: "Start over"

## Acceptance criteria
1. Given a finished run, when the result step shows, then there is one result card per output, in output order. Each card shows the output file name and its size.
2. Given sizes, when they are shown, then they use 1024-based units: under 1024 bytes as "{n} B", then "KB", "MB" and "GB" with one decimal (e.g. 1536 → "1.5 KB", 12,582,912 → "12.0 MB"). Unit tests cover 0, 1023, 1024, 1536, 1,048,575 and 5 GB.
3. Given an output that has a matching input size, when its card shows, then it shows the size change against that input, rounded to a whole percent: "42% smaller", "3% larger", or "Same size" when the rounded change is 0. Given an output with no matching input size, then no size change is shown.
4. Given a result card, when I activate its "Download" button once, then the browser downloads the output with exactly the shown file name and byte-for-byte the output's bytes. A Playwright test checks the name and the bytes of the demo tool's download under the real CSP.
5. Given an output's download, when it starts, then the temporary object URL is revoked afterwards, and the same button can be used again to download the file a second time.
6. Given the result step, when it appears, then focus moves to the results heading and a polite live region announces that the files are ready.
7. Given only a keyboard, when I tab through the result step, then every "Download" button and the "Start over" button are reachable, show the visible focus ring and work with Enter or Space.
8. Given the result step, when I activate "Start over", then the results and input files are cleared, the page returns to the empty input step and focus moves to the "Choose files" button.
9. Given a multi-file run, when the result step shows, then every output also has its own "Download" button, even when STORY-15 adds the ZIP option.
10. Given every visible string, when checked, then it comes from `web/src/i18n/en.ts`. The DOM uses `createElement` + `textContent` and styles live in `web/src/style.css` with tokens.
11. Given `npm run build`, `npm run lint`, `npm test` and `npm run test:e2e`, when they run, then they pass.

## Out of scope
- ZIP download of several outputs (STORY-15).
- Previews or thumbnails of the output.
- Per-tool naming rules for outputs (each tool epic sets its own; the demo tool may use the input name).

## Technical notes
- Download: `Blob` → `URL.createObjectURL` → a temporary `<a download="{name}">` click → `revokeObjectURL` on a later task. The router's click handler already skips anchors with `download` (`web/src/router.ts`). Check that the CSP in `web/public/_headers` allows the `blob:` download in Chromium (e2e under `vite preview`).
- The size formatter and size-change rule are pure functions: unit-test them in Vitest; keep i18n strings out of the math.
- Keep output bytes as the `Uint8Array`/`ArrayBuffer` the worker returned; avoid copies (large files).

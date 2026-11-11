---
id: STORY-14
epic: EPIC-03
status: in-review
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

## Implementation Plan

**Affected areas**: frontend, ux (no Rust/worker changes).

**Findings**
- `web/src/flow/format.ts` already has `formatSize` (+ test). Gap: 1,048,575 gives "1024.0 KB". Decision: roll over to the next unit when the one-decimal rounding reaches 1024, so it prints "1.0 MB". Cap at GB.
- `createFlow` calls `onDone(outputs: Output[])` (`{bytes, name, inputSize}`); `demoView` (`web/src/flow/demo.ts`) currently only sets `window.stapleOutputs` (e2e only, used by `flow-run.e2e.ts`; keep it).
- `createInput` has no clear/focus API. Start over = destroy the flow and build a fresh one in `demoView`, then focus its "Choose files" button (`.choose`). No input.ts change needed beyond maybe exposing nothing; query `.choose` inside the new flow `el`.
- CSP `default-src 'self'` has no `blob:`, but a blob `<a download>` click is a download, not a fetch. Expect no change to `_headers`; the e2e under the real CSP proves it. Only edit `_headers` if the e2e fails.

**Steps (test first)**
1. `format.test.ts`: add 1024 -> "1.0 KB", 1,048,575 -> "1.0 MB", 5 GB -> "5.0 GB" (keep 0, 1023, 1536, 12,582,912 -> "12.0 MB"). Fix `formatSize`.
2. New pure `web/src/flow/change.ts`: `sizeChange(inputSize, outputSize): {kind:'smaller'|'larger'|'same'; percent:number} | null`. Null when inputSize <= 0 or not finite (no matching input). percent = round(abs(out-in)/in*100); percent 0 -> 'same'. Vitest `change.test.ts`: 42% smaller, 3% larger, 0.4% -> same, equal -> same, input 0 -> null.
3. `i18n/en.ts`: add `result.heading` "Done", `result.ready.one` "Done: 1 file ready", `result.ready.other` "Done: {n} files ready", `result.smaller` "{percent}% smaller", `result.larger` "{percent}% larger", `result.same` "Same size", `result.download` "Download", `result.download.label` "Download {name}", `result.startOver` "Start over". Follow the existing `.one/.other` pattern of `flow.added.*`.
4. New `web/src/flow/result.ts`: `createResults(outputs, onStartOver): {el, focus(), destroy()}`.
   - Section with `h2` (tabIndex -1, text `t('result.heading')`), a `role=status aria-live=polite` visually-hidden region with the ready text, `ul.result-list` with one `li.result-card` per output in order: name, `formatSize(bytes.length)`, size change text (omitted when null), button "Download" with `aria-label` = `tf('result.download.label', {name})`. Then "Start over" button. All via createElement/textContent, `type=button`.
   - Live region: set text after insertion (rAF or after append, like `input.ts` announce) so it is announced. `focus()` focuses the h2.
   - Download: `new Blob([o.bytes])` (Blob copies once; acceptable, keep the Uint8Array itself uncopied) -> `URL.createObjectURL` -> temp `a` with `download=o.name`, append, click, remove -> `setTimeout(() => URL.revokeObjectURL(url), 0)` (later task). Each click makes a fresh URL, so a second download works. Pure helper `downloadBytes(bytes, name)` exported for unit test.
5. `demo.ts`: on `onDone`, still set `window.stapleOutputs`, hide the flow (`flow.el.hidden`; keep it alive, input files kept) and show results; render results below h1 in `main`. Wait: Start over must clear input, so on Start over: `flow.destroy()`, build new flow, replace old el, remove results, focus `.choose` of new flow. Refactor demo into a `mount()` function to avoid duplicating the createFlow call. The returned `destroy` must destroy the current flow and results.
   - Note: `createFlow` focuses the Start button and sets "Done." before `onDone`; hide the flow first, then focus the heading (hidden elements cannot take focus; focus after un-hiding results).
6. `style.css`: scoped `main.tool-flow .result-list/.result-card/...` rules, tokens only (`var(--space-*)`, `--color-*`, `--radius-*`, existing font-size tokens). Card as a flex row with name (`overflow-wrap: anywhere`), size, change, button. Reuse existing button focus style (`button:focus-visible`); if the card has `overflow:hidden` use a negative outline-offset. `main.tool-flow button[hidden]` rule already exists.
7. Unit tests `result.test.ts` (jsdom): cards count/order, name+size text, change text present/absent, aria-label, Start over callback, `downloadBytes` with mocked `URL.createObjectURL/revokeObjectURL` and fake timers: anchor `download` equals name, revoke called after the timer, second click calls create again.
8. Playwright `e2e/result.e2e.ts` (on `/demo`): upload 2 files via `setInputFiles`, Start, await heading; assert focus on h2, live region text "Done: 2 files ready", card names/sizes/order; `waitForEvent('download')` on first card button: `suggestedFilename()` equals name, bytes from `download.path()` equal the input bytes (demo tool is a copy, so "Same size"); click again and download a second time; Tab through buttons asserting `:focus-visible` outline width non-zero (computed style) and Enter/Space activation; Start over -> empty list, results gone, `.choose` focused; single-file run still has a Download button.

**Test plan per AC**
1. result.test.ts + e2e (cards, order, name, size). 2. format.test.ts (all listed values). 3. change.test.ts + result.test.ts (null -> no text). 4. e2e download name + bytes under `vite preview` CSP. 5. result.test.ts (revoke after timer, repeat click) + e2e second download. 6. e2e focus on h2 + live text. 7. e2e keyboard + computed focus ring. 8. e2e Start over. 9. e2e with 2 files: 2 Download buttons (STORY-15 adds ZIP later; structure keeps per-card buttons independent). 10. `i18n` typed keys (tsc), no innerHTML, `tokens.test.ts` passes for CSS. 11. run `npm run lint && npm test && npm run build && npm run test:e2e`.

**Risks / rollback**
- Blob download blocked by CSP: unlikely; the e2e shows it, then add the minimal directive to `_headers`.
- Focus ordering after hiding the flow; covered by the e2e.
- Large outputs: `new Blob([bytes])` holds a second copy briefly; acceptable.
- No real tools use the flow yet (demo only, e2e mode), so rollback = revert the commit; no data or user impact. Existing `flow-run.e2e.ts` relies on `window.stapleOutputs` and on the flow staying usable after Done, which changes (flow hidden after done); update those tests if they interact with the input after a successful run.

**Complexity**: standard. Several small modules (pure fns, DOM component, demo wiring, CSS, e2e) with focus and a11y behavior, but no auth, money or data risk.

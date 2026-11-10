---
id: STORY-12
epic: EPIC-03
status: done
pr: 13
---

# File input: drag-and-drop and picker, single and multiple

## User story
As a first-time user on a tool page, I want to drop my files or pick them with a button and see them listed before anything runs, so that I know the tool has the right files.

## Context
EPIC-03 (`docs/epics/EPIC-03-shared-tool-flow.md`), first step of the shared input → process → result → download flow. PRD FR-2 (drag-and-drop or picker, several files where it makes sense), FR-6 (unsupported input gets an error that names the file), FR-8 and D-7 "v1 impact" (no caps in v1; every size and count check lives in one module), §7 Accessibility (WCAG 2.2 AA, full keyboard use).

Each tool describes itself to the shared flow: which file types it accepts and whether it takes one file or many. This story builds that description, the input step and the central limits module. Running the files is STORY-13.

Copy (add to `web/src/i18n/en.ts`, wording may be polished in review):
- Drop zone: "Drop files here or choose files" (single-file tool: "Drop a file here or choose a file")
- Picker button: "Choose files" / "Choose a file"
- Unsupported type: "{name} is not a supported file type."
- Single-file tool given several files: "This tool takes one file at a time. Using {name}."
- Remove button accessible name: "Remove {name}"

## Acceptance criteria
1. Given a tool page using the shared flow, when it loads, then it shows a drop zone with a visible "Choose files" button. The button opens the system file picker, filtered to the tool's accepted types. The picker allows several files only when the tool takes several.
2. Given a multi-file tool, when I drop 3 accepted files on the drop zone, then all 3 are listed in drop order, each with its name and size. Given files already listed, when I add more by drop or picker, then they are appended after the existing ones.
3. Given a single-file tool, when I drop 2 files, then only the first is listed and the "one file at a time" notice names it. Given a single-file tool with a file listed, when I add another, then the new file replaces it.
4. Given a multi-file tool that accepts only PDFs, when I drop `a.pdf` and `photo.png` together, then `a.pdf` is listed and an error names `photo.png` as not supported. `a.pdf` is still listed and usable. The type check uses the file extension and the MIME type, so a `.pdf` with an empty MIME type is accepted.
5. Given a file is dragged over the drop zone, when it hovers, then the zone shows a visible drag-over state. When the drag leaves or the file drops, then the state clears.
6. Given a file is dropped anywhere on the page outside the drop zone, when it drops, then the browser does not open or download the file and the app stays on the tool page.
7. Given a listed file, when I activate its "Remove {name}" button, then the file leaves the list and focus moves to the next file's remove button, or to the "Choose files" button when the list is empty.
8. Given only a keyboard, when I tab through the input step, then I can reach the "Choose files" button, open the picker with Enter or Space, and reach every remove button. All of them show the visible focus ring (checked in Playwright).
9. Given a screen reader, when files are added, removed or rejected, then a polite live region announces the change, e.g. "3 files added", "a.pdf removed", or the unsupported-type error text.
10. Given the limits module, when it checks 10,000 files totalling 20 GB (sizes declared, no real bytes), then it allows them all: v1 has no caps. The input step calls this module for every add. No other module compares a file's size or count against a limit.
11. Given the run step, when it starts, then each input file's bytes are read only at that point, not when the file is added, so a large file list costs no memory before the run.
12. Given every visible string, when checked, then it comes from `web/src/i18n/en.ts`. The DOM uses `createElement` + `textContent` and styles live in `web/src/style.css` with tokens. There are no CSP violations under `vite preview`.
13. Given `npm run build`, `npm run lint`, `npm test` and `npm run test:e2e`, when they run, then they pass.

## Out of scope
- Running the files, progress and cancel (STORY-13).
- Reordering files (Merge, EPIC-04) and per-tool options.
- Folder drop and paste from the clipboard.
- Any real cap (Phase 2, D-7).

## Technical notes
- Likely new `web/src/flow/` for the shared flow: a tool spec (`accept`, `multiple`) and an input component. `web/src/limits.ts` for the central check, with a result type that can carry a reason, so Phase 2 can add caps without changing callers.
- The 5 real tool pages keep their "coming soon" placeholder until their epics. A demo tool page (e.g. "copy file", accepts any file, multi) for the done signals should exist only under the literal `import.meta.env.MODE === 'e2e'` (CLAUDE.md) and must not ship in the default build.
- `<input type="file">` must stay keyboard-reachable: a visually hidden input with a `<label>` styled as a button, or a real `<button>` that calls `input.click()`.
- Page-wide `dragover`/`drop` `preventDefault()` stops the browser from navigating to the dropped file. Remove the listeners when the route changes (`mount` teardown pattern in `web/src/router.ts`).
- Playwright can drop files with `page.dispatchEvent('drop', { dataTransfer })` built via `page.evaluateHandle`, or use `setInputFiles` for the picker.

## Implementation Plan

**Affected areas**: frontend, ux (no Rust, no worker changes).

**Design decisions (no blockers)**
- `web/src/limits.ts`: `checkAdd(existing: {size:number}[], incoming: {size:number}[]): {ok:true} | {ok:false; reason: string}`. v1 always returns `{ok:true}`. Only module that compares size or count.
- `web/src/flow/spec.ts`: `ToolSpec = { accept: string[] /* extensions e.g. '.pdf' */; mimes: string[]; multiple: boolean }`. `isAccepted(file, spec)` accepts if extension (case-insensitive) OR MIME matches (empty MIME ok via extension). Pure, unit-tested.
- `web/src/flow/input.ts`: `createInput(spec): { el: HTMLElement; files(): File[]; destroy(): void }`. Keeps `File[]` (File objects hold no bytes in memory, so AC11 holds: never call `arrayBuffer()`/`FileReader` here; bytes are read in STORY-13's run step). Builds drop zone (`div.dropzone`), real `<button type=button>` calling a hidden `<input type=file>` `.click()` (input gets `accept`, `multiple` only if spec.multiple; hidden via a `.visually-hidden` class, `tabindex=-1`), `<ul>` of files (name + formatted size + `Remove {name}` button), and a polite live region (`role=status`, `aria-live=polite`, visually hidden).
- Size formatting lives in its own `web/src/flow/format.ts` (`formatSize(bytes)`), so no size arithmetic or comparison appears in `input.ts` and the AC10 source scan stays unambiguous.
- Add logic `add(files)`: for each, reject unsupported (error text via `t`, shown in a visible `role=alert`-free error `<p>`); accepted ones go through `checkAdd` (exactly one call per `add()`, from drop or picker, with `existing` and the accepted `incoming`); multi: append; single: take first accepted, show "one file at a time" notice naming it if >1 offered, replace existing.
- Live region (AC9): `announce(msg)` is called at most once per `add()`/remove. Per `add()`, build ONE message by joining the added-count text ("{n} files added", omitted if 0) and every rejection text (and the one-at-a-time notice), separated by a space, then set it once. Mixed drop of `a.pdf` + `photo.png` announces "1 file added. photo.png is not a supported file type." Remove announces "{name} removed". To re-announce identical text (e.g. "a.pdf removed" twice), `announce` sets `textContent = ''` then sets the new text inside `requestAnimationFrame`; a pending frame is cancelled by the next `announce`. Unit tests use fake rAF.
- Remove: on click, splice, re-render list, then focus the remove button now at the same index (the next file's); if the removed file was last, focus the new last remove button; if the list is empty, focus `Choose files`.
- Drag state: `dragenter`/`dragover` on zone add class `dragover` + preventDefault; `dragleave` (check `relatedTarget` not inside zone) and `drop` clear. Zone `drop` handler preventDefault, stopPropagation, calls add with `dataTransfer.files`.
- Page-wide: `window` `dragover` and `drop` `preventDefault()` listeners added in `createInput`, removed in `destroy()`.
- Router teardown: `render` in `web/src/router.ts` is synchronous. Add module-local `let destroyView = () => {}` in `mount`; call it (then reset) at the start of every `render` and in the returned teardown. Gated demo view is async (dynamic `import()`): `render` bumps a `renderId` counter; the import's `.then` bails if `renderId` changed or teardown ran, else swaps `<main>` and sets `destroyView`. Until it resolves, render the existing `notFound()` view. `views.ts` real tool views stay placeholders.
- Demo page: in `router.resolve`/`render`, gated by the literal `import.meta.env.MODE === 'e2e'`, path `/demo` renders `demoView()` from `web/src/flow/demo.ts` (dynamic `import()` inside the gated branch so it is tree-shaken from default build; heading "Demo", spec `{accept: [], mimes: [], multiple: true}` meaning any file; plus a `?single` query for a single-file variant, and a `?pdf` variant spec accepting `.pdf`/`application/pdf` for AC4). Demo strings: use `t()` keys too (add `demo.heading`), no hard-coded copy. Verify `dist-prod` has no `demo` chunk (grep in a prod e2e check or unit).
- i18n keys in `en.ts` (`web/src/i18n/en.ts`; helper in `web/src/i18n/index.ts`, test in existing `web/src/i18n.test.ts`) (copy from story): `flow.drop.multi`, `flow.drop.single`, `flow.choose.multi`, `flow.choose.single`, `flow.error.unsupported` (`{name}`), `flow.notice.oneAtATime` (`{name}`), `flow.remove` (`{name}`), `flow.added.one/other` and `flow.removed` for live text. `t()` has no interpolation: add `fmt(template, {name})` helper in `web/src/i18n/index.ts` (`tf(key, vars)`) with a test; keep typed keys.
- CSS in `style.css` with tokens only: `.dropzone` (dashed border `var(--…)`, radius/padding tokens), `.dropzone.dragover` (accent border + tinted bg token), `.file-list`, `.visually-hidden`, `:focus-visible` on remove/choose buttons using existing button focus rule with negative `outline-offset` if inside overflow-hidden. Scope under `main.tool-flow` route class. If a new colour token is needed, add to light, dark and `:not([data-theme])` blocks (tokens.test).

**Steps (test first)**
1. Vitest `limits.test.ts`: 10,000 files x 2 MB = 20 GB declared sizes returns ok (AC10). Then implement `limits.ts`.
2. Vitest `flow/spec.test.ts`: `.PDF`, empty MIME with `.pdf`, `image/png` rejected, any-file spec. Implement.
2b. Vitest `flow/format.test.ts` for `formatSize`; implement `flow/format.ts`.
2c. Vitest `flow/limits-usage.test.ts` (AC10 second half): (a) with `vi.spyOn` on the `checkAdd` export of `limits.ts` (via `vi.mock('../limits')` wrapping the real fn), create an input, call add via a simulated `drop` event (1 call) and via picker `change` event (1 call), and a mixed drop of 2 files (still 1 call); assert `toHaveBeenCalledTimes` exactly. (b) Source scan: read every file under `web/src/flow/**` (non-test, via `import.meta.glob('./**/*.ts', {query:'?raw', eager:true})`, excluding `*.test.ts`) and assert no `\.size\b` match and no `\.length\s*[<>]=?` comparison against a limit. Assert the glob found at least the expected files (`input.ts`, `spec.ts`, `format.ts`, `demo.ts`, count asserted exactly) and that the scan regex runs on non-empty content (match count of `\.size\b` in `format.ts` is 0 as well: `formatSize` takes a number param, `input.ts` passes `file.size` only as an argument in a single asserted location, so allow exactly that one `file.size` match in `input.ts` and zero elsewhere in flow/**, asserted by count). Also scan `web/src/**` outside `limits.ts` and `flow/` for `\.size\s*[<>]` and assert 0 matches.
3. Vitest (jsdom) `flow/input.test.ts`: multi append order, single replace, single drop of 2 notice, mixed reject keeps good, remove focus move, live region text (mixed drop `a.pdf`+`photo.png` yields one combined message set once, region text set a single time; identical "a.pdf removed" twice clears then re-sets on next frame), destroy removes window listeners (spy on removeEventListener), no `arrayBuffer` called (spy on File.prototype.arrayBuffer, AC11), no `innerHTML` use. Implement `input.ts`, `tf`, i18n keys.
4. CSS + demo view + router gating/cleanup; router test: navigating away calls destroy.
5. Playwright `web/e2e/file-input.e2e.ts` on `/demo`: drop 3 files via `dataTransfer` (AC2), single (AC3), pdf+png (AC4), drag-over class on `dispatchEvent('dragenter')` and cleared on leave/drop (AC5), drop outside zone: `defaultPrevented` true and URL unchanged (AC6), remove focus (AC7), keyboard Tab/Enter opens `filechooser` event with `page.waitForEvent('filechooser')`, `toBeFocused` + computed outline-style not none (AC8), live region text (AC9), no console/CSP errors (AC12). Add prod check to `prod-no-pdfium.e2e.ts`: `/demo` renders not-found on port 4174 and no chunk contains the demo marker.
6. Run full CI web commands: `npm run lint && npm test && npm run build && npm run test:e2e`.

**Test plan per AC**
- AC1: e2e picker button visible, filechooser event, `input.accept`/`multiple` attrs (unit + e2e).
- AC2, AC3, AC4: unit (input.test) + e2e drops.
- AC5, AC6, AC8: e2e only (jsdom lacks real drag/focus ring).
- AC7: unit + e2e.
- AC9: unit (combined single message for mixed drop, clear-then-set re-announce with fake rAF) + e2e (mixed drop on `/demo?pdf`: live region contains both "1 file added" and the `photo.png` error text).
- AC10: unit `limits.test.ts` (20 GB allowed); second half: `flow/limits-usage.test.ts` (step 2c) spies `checkAdd` for exactly one call per `add()` via drop and picker, plus source scans with asserted match counts over `web/src/flow/**` and the rest of `web/src/**`.
- AC11: unit spy on `File.prototype.arrayBuffer`/`FileReader` stays uncalled after add.
- AC12: existing `tokens.test.ts`, i18n typed keys, e2e console listener under `vite preview` CSP.
- AC13: full command run.

**Risks / rollback**
- `dragleave` flicker from child elements: use relatedTarget check or an enter/leave counter.
- Playwright drop needs a `DataTransfer` built in page via `evaluateHandle`; Chromium accepts it for synthetic events.
- Demo leaking into prod build: gate with the literal `import.meta.env.MODE === 'e2e'` and dynamic import; verified by prod e2e.
- Rollback: pure addition plus small router change; revert the commit.

**Complexity**: standard. Several modules (flow, limits, i18n, router, CSS, e2e), accessibility and focus logic, but no security/data risks.

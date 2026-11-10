---
id: STORY-09
epic: EPIC-01
status: in_review
pr: 10
---

# Theme toggle: light, dark or OS default

## User story
As a visitor, I want a control in the header to switch between light, dark and my operating system's setting, so that the site matches how I like to read, even when it differs from my OS.

## Context
EPIC-01 (`docs/epics/EPIC-01-foundation.md`). STORY-07 added light and dark tokens, but dark is driven only by `prefers-color-scheme`, with no way to override it. STORY-08 added the shared header that wraps every page, where the control belongs. This story reverses the "OS-driven, no toggle" rule in `CLAUDE.md`, so update that line when it ships. The choice is stored only in the browser (no network, per the privacy promise).

## Acceptance criteria
1. Given any route, when it renders, then the header has one theme control with three states: "System" (default), "Light" and "Dark". Its label and the state names come from `web/src/i18n/en.ts`.
2. Given a first visit with no stored choice, when the page loads, then the state is "System" and the page follows the OS `prefers-color-scheme`, as it does today.
3. Given I choose "Dark" (or "Light"), when the choice is applied, then the page uses that theme at once, whatever the OS setting is, and the colour tokens still meet the WCAG contrast checks in `tokens.test.ts` in both themes.
4. Given I chose a theme, when I reload or open another route, then the choice is kept. Given I choose "System", then the stored choice is cleared and the page follows the OS again, including when the OS setting changes while the page is open.
5. Given a stored "Dark" choice and a light OS, when the page loads, then there is no visible flash of the light theme before the dark one appears.
6. Given only a keyboard, when I tab to the control, then it shows the STORY-07 focus indicator, can be operated with Enter or Space, and its current state is announced to assistive technology.
7. Given the page, when it loads under the CSP, then there are no CSP violations and no inline `<script>`, `<style>` or `style=` attributes. If browser storage is unavailable or throws, then the page still works and follows the OS.
8. Given `npm run build`, `npm run lint`, `npm test` and `npm run test:e2e`, when they run, then they pass.

## Out of scope
- More than three states, custom palettes or high-contrast themes.
- Syncing the choice between devices or tabs.
- Any new colour tokens beyond what the dark set already defines.

## Technical notes
- Depends on STORY-07 (tokens) and STORY-08 (header).
- The dark token set is currently only in the `@media (prefers-color-scheme: dark)` block in `web/src/style.css`. An explicit choice needs the same values under an attribute on `<html>` (for example `data-theme`), without a hand-copied second set that can drift. `tokens.test.ts` parses the dark block with a regex, so extend it to cover the new selectors and assert match counts.
- No flash (AC 5) under a CSP without `unsafe-inline`: a tiny blocking external script in `<head>` (served from `web/public/`, allowed by `script-src 'self'`) must set the attribute before first paint. A deferred module script will flash.
- Wrap every `localStorage` read and write in try/catch.
- Set `color-scheme` to match the active theme so native controls and scrollbars follow it.
- Build the control with `createElement` and `textContent`. Icons use `createElementNS` as in `web/src/icons.ts`.
- Update the "dark set only in the `prefers-color-scheme` block (OS-driven, no toggle)" line in `CLAUDE.md`.
- Check theme e2e with Playwright `emulateMedia({ colorScheme })`, using computed styles.

## Implementation Plan

**Affected areas**: frontend, ux (no backend, no Rust).

**Design decision (no drift, no blocking question)**: delete the `@media (prefers-color-scheme: dark)` block. Keep one dark set, `:root[data-theme='dark'] { ... }`. A blocking script ALWAYS sets `data-theme` on `<html>` to the resolved theme (`light`|`dark`) before first paint: stored choice, else `matchMedia('(prefers-color-scheme: dark)')`. Set `color-scheme: light` in `:root` and `color-scheme: dark` in the dark block (replaces `light dark`). Consequence: the OS-follow depends on the script running; accepted, since it is same-origin and external. Side effect to note: with no `data-theme` the page is light.

### Steps (test-first)
1. `web/src/theme.ts` (new), exports:
   - `type Choice = 'system'|'light'|'dark'`; `KEY = 'staple-theme'`.
   - `getChoice()`: try `localStorage.getItem`, accept only `light`/`dark`, else `system`; catch returns `system`.
   - `resolve(choice)`: system maps to `matchMedia` result.
   - `setChoice(c)`: try `setItem` (or `removeItem` for system), catch ignored; then `applyTheme()`.
   - `applyTheme()`: sets `document.documentElement.dataset.theme`.
   - `initTheme()`: registers a `matchMedia` `change` listener that calls `applyTheme()` only when `getChoice()==='system'`.
   Write `theme.test.ts` first (jsdom: stub `matchMedia`; stub `localStorage` throwing): defaults, stored dark/light, junk value, system clears key, storage throws still applies, OS change listener only in system.
2. `web/public/theme-init.js` (plain ES5, same logic in about 6 lines, own try/catch, same key). Add `<script src="/theme-init.js"></script>` (no `defer`/`type=module`) in `index.html` `<head>`. Vite leaves the `public/` file as is; CSP `script-src 'self'` allows it. Add a vitest check that the key string in `theme-init.js` equals `KEY` (read file, assert match count 1).
3. `en.ts`: add `theme.label` ('Theme'), `theme.system` ('System'), `theme.light` ('Light'), `theme.dark` ('Dark').
4. Control in `shell()` header (`views.ts`), appended after the wordmark in the `.container`. Use a `<div role="group" aria-label=t('theme.label')>` holding three `<button type="button">` with `aria-pressed` (true on the current choice). Each button has a text label from the i18n keys, plus an optional `createElementNS` icon (sun/moon/monitor, add to `icons.ts`, `aria-hidden`). Click calls `setChoice` and refreshes `aria-pressed` on all three. Native buttons give Enter/Space and the state announcement. Alternative considered: a single cycling button. Rejected, because the three-button group announces better and is simpler. Call `initTheme()` in `main.ts` before `mount`.
5. `style.css`: header layout so the group sits at the right (`justify-content: space-between` on the header `.container`; check the existing `header` rules near line 110, scope to `header`). Button styles only with `var(--…)` tokens: border `--color-border`, selected state uses `--color-accent` bg with `--color-on-accent` text. Add `button:focus-visible` as its own separate rule (do NOT merge into `a:focus-visible`: `views.test.ts` matches `selectorText === 'a:focus-visible'` exactly, a merge breaks it). Same declarations: 3px solid `--color-accent`, negative `outline-offset` for any clipped ancestor. Also update `web/src/views.test.ts` ("links have a visible focus outline"): keep the `a:focus-visible` assertion, and add a second lookup for `selectorText === 'button:focus-visible'` asserting `outlineStyle` solid and width >= 2 (assert each rule found, not undefined). Also add `@media (max-width: 40rem)` so wordmark plus group do not overflow.
6. `tokens.test.ts`: change `darkRe` to `/:root\[data-theme='dark'\]\s*{([^}]*)}/g`; keep `toHaveLength(1)` for dark and light-block counts. Add an assertion that `prefers-color-scheme` no longer appears in the CSS (count 0), and that `color-scheme` appears exactly 2 times. Contrast checks run unchanged on the same dark values.
7. e2e: extend `e2e/theme.e2e.ts`. The existing `emulateMedia` tests keep passing (System follows the OS via the script). The existing focus test uses `getByRole('link').first()` and Tab; the header gets a new tab stop after the wordmark, which is fine since the link stays first.
8. `CLAUDE.md`: replace "dark set only in the `prefers-color-scheme` block (OS-driven, no toggle)" with "dark set only in the `:root[data-theme='dark']` block; `public/theme-init.js` sets `data-theme` before paint; header toggle System/Light/Dark stored in localStorage". Also mention `public/theme-init.js` in the Layout section if needed.
9. Run the full web CI: `npm run lint && npm test && npm run build && npm run test:e2e`.

### Test plan
- AC1: vitest on `shell()`: group has 3 buttons with i18n text and the group label; e2e checks the header on `/`, a tool route and a 404 route.
- AC2: e2e, no storage, `emulateMedia` dark gives dark ground; light gives light; "System" has `aria-pressed=true`. Unit: `getChoice()` default is `system`.
- AC3: e2e, `emulateMedia` light, click Dark, then `body` bg is `rgb(18, 18, 18)`, and the reverse; `<html>` `color-scheme` computed matches. `tokens.test.ts` contrast checks still pass.
- AC4: e2e, choose Dark, reload and navigate to another route, still dark; choose System, `localStorage` key is null, then `emulateMedia` change flips the theme live. Unit for the listener.
- AC5: e2e, `addInitScript` sets localStorage `staple-theme=dark`, light OS; on `goto` with `waitUntil: 'commit'`, check that `data-theme` is `dark` before `DOMContentLoaded` (e.g. an init script observing the first `requestAnimationFrame` or `getComputedStyle` of the root bg). Plus the unit check that the `theme-init.js` script tag is in `<head>`, is not `defer`/`module`, and comes before the module script.
- AC6: vitest `views.test.ts` asserts both `a:focus-visible` and `button:focus-visible` rules exist with solid outline >= 2px. e2e, Tab to the control, `outline-style: solid`, width 3px; press Space and Enter to switch; `aria-pressed` reflects state.
- AC7: e2e `errors` array empty (CSP) and `locator('style, [style]')` count 0; an init script that makes `localStorage` throw: page loads, follows OS, clicking a button does not throw. Unit covers the throwing storage.
- AC8: run the four commands.

### Risks / rollback
- If the script fails to load, the page is stuck in light (the OS is not followed). Mitigation: it is same-origin, tiny and cached. The service worker precache (EPIC) must include `/theme-init.js` once the PWA exists; check whether a precache list exists (none seen in `web/`).
- `public/` files are not hashed, so edits to `theme-init.js` can be cached stale. Acceptable at this size.
- Possible `vite preview` ordering issue with the blocking script and the CSP: covered by e2e.
- Rollback: revert the PR. There is no data migration; the localStorage key is harmless.

**Complexity**: standard. Several modules (CSS, a script in `public/`, header, tests), but no auth, money or data risk. The no-flash and CSP behaviour needs careful e2e.

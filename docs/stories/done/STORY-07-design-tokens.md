---
id: STORY-07
epic: EPIC-01
status: done
pr: 8
---

# Design tokens and base theme

## User story
As a Staple developer, I want one set of design tokens (colours, type, spacing, focus ring) in `web/src/style.css`, so that every tool screen built in EPIC-03 and later looks consistent and meets WCAG 2.2 AA without restyling.

## Context
EPIC-01 (`docs/epics/EPIC-01-foundation.md`). PRD §7 (WCAG 2.2 AA) and the "polish" positioning in §1. STORY-02 left visual design out of scope, so `web/src/style.css` holds only plain defaults. No epic plans a visual direction, and EPIC-03 builds the shared tool UI next. This story sets the foundation first, so that work does not need restyling later.

## Design references
- `docs/stories/assets/STORY-07/home-light-desktop.png` — the chosen "Clear blue" direction, light theme.
- `docs/stories/assets/STORY-07/home-dark-desktop.png` — the same page in the dark theme, used when the device is set to dark mode.
- The owner chose these on 2026-11-10 from three options. The token values below are the source of truth; the PNGs show how they look together.

| Token | Light | Dark |
|---|---|---|
| Ground (page background) | `#FFFFFF` | `#121212` |
| Surface (cards, footer) | `#F8FAFC` | `#1C1C1C` |
| Border | `#E2E8F0` | `#2A2A2A` |
| Text | `#0F172A` | `#F2F2F2` |
| Muted text | `#475569` | `#A3A3A3` |
| Accent (links, icons, logo tile, focus ring) | `#1D4ED8` | `#60A5FA` |
| Accent hover | `#1E3A8A` | `#93C5FD` |
| Privacy banner background / text | `#EFF4FF` / `#1E3A8A` | `#172554` / `#BFDBFE` |
| Text on accent (logo tile glyph) | `#FFFFFF` | `#121212` |

- Type: system font stack (`system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`). Page heading 46 px / 800 weight on desktop, card titles 18 px / 650, body 18 px, card descriptions and secondary text at least 15 px (14 px only in the footer).
- Radii: cards 12 px, icon tiles and logo tile 8 to 10 px. Spacing on a 4 px scale.

## Acceptance criteria
1. Given `web/src/style.css`, when it is read, then colours, font families, font sizes, spacing and radii are CSS custom properties on `:root` with the values in the Design references table, and the existing rules use them with no hard-coded colour values left.
2. Given the token set, when every text/background and focus-indicator colour pair is checked, then each meets WCAG 2.2 AA contrast (4.5:1 for body text, 3:1 for large text and UI components). A test computes the ratios from the token values and fails if any pair is below its threshold.
3. Given an OS set to dark mode, when the app loads, then it uses the dark token set from the Design references table, with the same contrast guarantees. Given light mode, then the light set, which is also the default. Both sets are covered by the test in AC 2.
4. Given only a keyboard, when I tab through the home page, then the focus indicator is visible, uses the token colour and passes contrast in both themes. A Playwright test checks the computed outline in `web/e2e`, because jsdom cannot.
5. Given the production build, when the page loads under the CSP, then no CSP violation appears in the console: the styles come from `style.css` only, with no inline `<style>`, `style=` attribute or `el.style` write.
6. Given `npm run build`, `npm run lint` and `npm test`, when they run, then they pass.

## Out of scope
- Logo and final brand identity (owner decision; a text wordmark is enough for now).
- Home page layout and header/footer (STORY-08).
- A user-facing theme toggle. The theme follows the OS setting only.
- Custom web fonts. Use the system font stack, since the CSP allows only `self` and a font file would add weight.

## Technical notes
- Contrast test: a small Vitest helper that parses the token values from `style.css` and computes WCAG ratios. No new dependency for a few lines.
- Dark theme via `@media (prefers-color-scheme: dark)` redefining the same tokens.
- Priority: should land before EPIC-03 stories start. Estimated effort: one deliver run.

## Implementation Plan

**Affected areas**: frontend, ux (only `web/src/style.css` plus two new test files; no Rust, no markup change).

**Findings**: `style.css` is imported by `web/src/main.ts`. It has 4 rules with hard-coded colours (`body`, `a`, `a:focus-visible`, `h1:focus`). Existing e2e AC6 in `web/e2e/app-shell.e2e.ts` asserts focus `outline-style: solid` and `outline-width: 3px`, so keep a 3px outline. Home page layout, header, footer, cards and banner are STORY-08: define their tokens now, do not style them.

**Steps (test first)**
1. Add `web/src/tokens.test.ts` (Vitest, node `fs` reads `style.css`):
   - Parse custom properties from the first `:root { ... }` block (light) and from the `:root` block inside `@media (prefers-color-scheme: dark)` (dark). A small regex is enough.
   - Write `luminance` and `ratio` helpers (about 10 lines).
   - For each theme, assert the pairs below. Text pairs need >= 4.5; accent/focus on ground and surface needs >= 3.
     - text on ground, surface
     - muted on ground, surface
     - accent on ground, surface
     - accent-hover on ground
     - banner-text on banner-bg
     - on-accent on accent
   - Assert the dark block redefines every colour token that the light block defines.
   - Assert `style.css` has no hex or `rgb(` literal outside the two token blocks (strip the blocks, then regex for `#[0-9a-f]{3,8}\b`).
   - Skip border: it is decorative, not a UI component boundary.
2. Rewrite `web/src/style.css`:
   - `:root` tokens, using the table values. Names: `--color-ground`, `--color-surface`, `--color-border`, `--color-text`, `--color-muted`, `--color-accent`, `--color-accent-hover`, `--color-banner-bg`, `--color-banner-text`, `--color-on-accent`.
   - Other tokens: `--font-sans` (stack from the story), `--font-size-body: 1.125rem`, `--font-size-secondary: 0.9375rem`, `--font-size-small: 0.875rem`, `--font-size-title: 1.125rem`, `--font-size-heading: 2.875rem` (46 px). Add `--weight-heading: 800`, `--weight-title: 650`. Spacing `--space-1..` on a 4 px scale (0.25rem steps: 1, 2, 3, 4, 6, 8, 12, 16). Radii `--radius-card: 12px`, `--radius-tile: 10px`.
   - `@media (prefers-color-scheme: dark) { :root { ...dark colours... } }`. Also set `color-scheme: light dark` on `:root`.
   - Existing rules use the tokens: body (font, colour, background, size), `a` colour with `:hover` using accent-hover, `a:focus-visible { outline: 3px solid var(--color-accent); outline-offset: 2px }`, `h1:focus { outline: none }` stays. Keep the current `max-width` and padding layout, using space tokens. STORY-08 will replace it.
   - h1 size: apply the heading token and weight to `h1`. Because the heading is a 46 px desktop value, add a `@media (max-width: 40rem)` override to a smaller size, or leave it unresponsive. Choose a smaller size (2rem) for narrow screens, since this is a desktop-first product and the override is one line.
3. Add a Playwright test, `web/e2e/theme.e2e.ts`, in the same style as `app-shell.e2e.ts`. It must keep the console-error guard.
   - For each `colorScheme` (`light`, `dark`) via `test.use` or `page.emulateMedia`:
     - load `/`, press Tab, assert the first link is focused,
     - assert computed `outline-style: solid`, `outline-width: 3px`, and `outline-color` equals the expected accent as `rgb(...)` (`rgb(29, 78, 216)` light, `rgb(96, 165, 250)` dark),
     - assert body `background-color` equals the ground (`rgb(255, 255, 255)` / `rgb(18, 18, 18)`).
   - The console-error guard fails on any CSP violation (AC5). Also assert `document.querySelectorAll('style, [style]').length === 0`.
4. Run `npm run lint` (prettier will check CSS and the tests), `npm test`, `npm run build`, `npm run test:e2e`.

**Test plan**
- AC1: tokens.test.ts hard-coded colour check, plus a check that the listed tokens exist on `:root`.
- AC2: tokens.test.ts contrast ratios for light.
- AC3: tokens.test.ts for dark (same pairs plus token parity); theme.e2e.ts dark emulation shows the dark ground.
- AC4: theme.e2e.ts focus outline in both themes (the 3:1 contrast is covered by the accent pairs in AC2).
- AC5: theme.e2e.ts console-error guard under the preview CSP, and no `style` elements or attributes.
- AC6: run the commands. Existing e2e AC6 must still pass.

**Risks / rollback**
- Single CSS file and two test files: revert the commit to roll back.
- The regex parser is brittle if the CSS is reformatted (prettier). Keep one declaration per line and assert that parsing returned the expected token count, so the test fails loudly rather than passing on nothing.
- The PNGs show the STORY-08 layout. Do not build it here.

**Complexity**: standard. Small diff, but two themes, a contrast calculation and a new e2e test with computed styles need care. Not trivial.

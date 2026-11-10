---
id: STORY-07
epic: EPIC-01
status: draft
pr: null
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

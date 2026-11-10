---
id: STORY-08
epic: EPIC-01
status: draft
pr: null
---

# Home page layout with header, tool cards and privacy line

## User story
As a first-time visitor, I want a home page that looks finished, names the product, shows the five tools clearly and states that my files stay on my device, so that I trust it and find the right tool quickly.

## Context
EPIC-01 (`docs/epics/EPIC-01-foundation.md`). PRD FR-1 (home lists the five tools), the privacy promise in §1 and M4 (a first-time user completes a task unaided). STORY-02 built the home page as a plain list of links. This story gives it a real layout using the tokens from STORY-07, and the same header and footer wrap every tool page.

## Design references
- `docs/stories/assets/STORY-08/home-light-desktop.png` — desktop layout: header, privacy banner, centred heading, five tool cards in one row, footer.
- `docs/stories/assets/STORY-08/home-light-phone.png` — narrow layout: the cards become full-width list rows (icon, name, description, chevron).
- The owner chose this "Clear blue" layout on 2026-11-10, with the heading from another option because it states the differentiator. Colours and type come from STORY-07.

Copy (add to `web/src/i18n/en.ts`):
- Heading: "PDF and image tools that never upload your files."
- Subheading: "Free, no account, no ads. Pick a tool to start."
- Privacy banner: "Your files are processed on this device and never uploaded."
- Tool descriptions: Compress "Make PDFs and images smaller." · Merge "Combine files into one PDF." · Split "Pull pages out of a PDF." · Convert "Images to PDF and back." · Resize "Change image dimensions."
- Footer: "Free and open source (AGPL-3.0). No account. No ads." plus a "Source code" link to the GitHub repository.

## Acceptance criteria
1. Given any route, when it renders, then the page has a header with the logo tile and the wordmark "Staple" linking to `/`, the privacy banner below it, a main region and a footer, as landmark elements (`header`, `main`, `footer`).
2. Given the home page, when it loads, then it shows the heading and subheading from the Design references, and each of the five tools as a card with an icon, its name and its one-line description. The whole card is one link to that tool's path. The existing STORY-02 checks (five links, own URL, deep links, not-found view) still pass.
3. Given any route, when it renders, then the privacy banner text "Your files are processed on this device and never uploaded." is visible. The text comes from the i18n layer.
4. Given a viewport from 1024 px to 1920 px wide, when the home page renders, then the five cards sit in one row with no horizontal scrolling. Given a viewport 390 px wide, then the cards become full-width list rows, one per tool, with no horizontal scrolling. A Playwright test checks 1024 px, 1920 px and 390 px.
5. Given the rendered home page, when the card descriptions are measured, then their computed font size is at least 15 px. A Playwright test checks this.
6. Given only a keyboard, when I tab through the page, then focus moves in reading order, each card shows the focus indicator from STORY-07 and opens with Enter.
7. Given the page, when it loads under the CSP, then there are no CSP violations and no inline styles. All new styles are in `web/src/style.css` and use the STORY-07 tokens. Icons are inline SVG built with `createElementNS`, marked `aria-hidden="true"`.
8. Given every visible string, when checked, then it comes from `web/src/i18n/en.ts`, with no `innerHTML` use in the new DOM code.
9. Given `npm run build`, `npm run lint`, `npm test` and `npm run test:e2e`, when they run, then they pass.

## Out of scope
- Logo artwork and final brand identity (owner decision). The logo tile with a staple glyph stands in.
- The "How it works" and "Privacy" links shown in the mockup. They point to the privacy page, which EPIC-09 builds; that story adds the links.
- Full mobile support (touch testing, mobile browsers). The PRD targets desktop in v1; AC 4 only keeps narrow windows usable.
- Per-tool page content and the shared input flow (EPIC-03).

## Technical notes
- Depends on STORY-07 for the tokens.
- Build the shell in `web/src/views.ts` with `createElement` and `textContent`, following the existing pattern.
- Priority: before EPIC-03 stories start.

## Implementation Plan

**Affected areas**: frontend, ux.

**Design notes** (from the two mockups): header = 32px logo tile (accent bg, white staple glyph, `--radius-tile`) + bold wordmark "Staple" on the left, bottom border. Banner = full-width `--color-banner-bg` strip under the header, shield icon + text in `--color-banner-text`. Home: centred h1 (two lines at desktop) + muted subheading, then five equal cards in one row (surface bg, 1px border, `--radius-card`, 46px icon tile top-left, bold title, `--color-muted` description). Below 40rem the cards stack into one bordered list: row = icon tile, title + description, chevron right, hairline dividers. Footer = `--color-surface` strip, text left, "Source code" link right (stacked on narrow). No "How it works"/"Privacy" links (out of scope).

**Design decision**: the shell (header, banner, footer) is built once in `mount()` and only `<main>` is swapped per route. Views keep returning `<main>`, so view tests stay simple.

**Steps (test-first)**
1. `web/src/i18n/en.ts`: add `home.heading`, `home.subheading`, `privacy.banner`, `tool.<id>.desc` x5, `footer.text`, `footer.source`, `header.logoAlt`-free (the logo is aria-hidden; the wordmark is the link text). Remove `home.intro` (now unused). Keep `app.title`.
2. Update/add tests first (they fail):
   - `views.test.ts`: home h1 is the new heading; subheading present; `nav` has five links `href` = path, each containing an `svg[aria-hidden=true]`, name and desc text; no `tabindex`. Add a `shell()` test (see 4): `header`, `main` slot, `footer` exist, wordmark link `/` with `data-link`, banner text, footer link to `https://github.com/SimaoGato/staple`. Add a guard that `views.ts` and the icon file contain no `innerHTML`.
   - `router.test.ts`: home h1 now the new heading (lines ~62, 69, 87, 129); `document.title` for home stays "Staple". Add: after navigating, root contains exactly one header/footer, and the shell is not rebuilt between routes.
   - `e2e/app-shell.e2e.ts`: replace `toHaveText('Staple')` heading checks with the new heading. AC1 links: `getByRole('navigation').getByRole('link')` now has accessible names with descriptions; use `toHaveText` per card with a regex, or assert by `href`. Tab test: the wordmark link is now the first tab stop, so tab count is `i + 2`. `getByRole('link', { name })` is a substring match, but "Convert" is fine; check that "Home" still resolves uniquely on tool pages.
   - `e2e/theme.e2e.ts`: `getByRole('link').first()` is now the wordmark; the assertion still holds (still `a`).
   - New `e2e/home.e2e.ts`: landmarks (`header`, `main`, `footer`) and banner visible on `/`, a tool page and not-found; at 1024, 1920 and 390 px, `document.documentElement.scrollWidth <= innerWidth`; at 1024 and 1920 the five cards share the same `boundingBox().y`; at 390 they have equal x and widths of about the container width, with strictly increasing y; description computed `font-size` >= 15px (use `toHaveCSS` or evaluate and `parseFloat`); a CSP-error and `style, [style]` count of 0 check; Tab goes wordmark, then 5 cards in order, then footer link, each card has outline 3px, and Enter on a card opens its path.
3. `web/src/icons.ts` (new): `svg(paths: string[], size)` helper using `createElementNS('http://www.w3.org/2000/svg', …)`, sets `aria-hidden="true"`, `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"` (set via attributes; `setAttribute` is not a CSP `style=`). Exports for staple glyph, shield, chevron, compress, merge, split, convert, resize. Draw simple stroke paths (lucide-style) by hand; no dependency.
4. `web/src/views.ts`: add `shell(): { root: DocumentFragment; slot: HTMLElement }`-style helper or export `header()`, `banner()`, `footer()`. Rewrite `home()`: `<main>` with `<h1 tabindex=-1>` heading, `<p>` subheading, `<nav><ul class="cards">` of `<li><a class="card" href data-link>` containing icon tile span, `<span class="card-title">`, `<span class="card-desc">`, chevron icon (shown only narrow via CSS). Footer source link: plain `<a href=… rel="noopener">`, with no `data-link` (external; router ignores it anyway because of the origin check). Tool and not-found views are unchanged.
5. `web/src/router.ts` `mount()`: build shell once (`root.replaceChildren(header, banner, ...)` with a placeholder for main), and in `render` replace the current `<main>` with the new view (`root.querySelector('main')?.replaceWith(view)` after the first render). The click listener on `root` already covers the header wordmark link. The teardown remains correct (listeners are on root). Check that the h1 focus and the title logic are untouched.
6. `web/src/style.css`: drop `body` `max-width: 40rem` and the padding; `body { margin: 0 }`, flex column with `min-height: 100vh` so the footer sits at the bottom. Add a `.container` (max-width ~70rem, auto margins, padding `var(--space-6)`) for header, banner, main and footer inner content. Add rules for header, banner, `.logo-tile`, `.cards` (grid `repeat(5, 1fr)`, gap `var(--space-4)`, `list-style: none`), `.card` (block, surface bg, border, radius, `text-decoration: none`, text colour, padding), `.card:hover` using `--color-accent`/`--color-accent-hover`, `.card-desc` with `font-size: var(--font-size-secondary)` (15px) and `--color-muted`, and `@media (max-width: 40rem)`, which makes the grid one column, merges the cards into a bordered list (grid row, icon / text / chevron, dividers between rows, outer radius on the `ul`) and stacks the footer. At 1024px a 5-col grid has ~190px per card; this is fine because the mockup shows the same at 1280. Set `min-width: 0` on grid items to prevent overflow. Keep `a:focus-visible` (3px solid accent); `.card` must not override outline. Use only `var(--…)`; no colour literals (tokens.test fails on those). Do not add `style` writes. Add no new colour tokens (the token test counts exactly 10); use the existing ones. New spacing/size tokens are allowed (the test only checks a few keys).
7. Run `cargo`-free web checks: `cd web && npm run lint && npm test && npm run build && npm run test:e2e`. Fix Prettier formatting.

**Test plan (per AC)**
1. Vitest shell test + e2e landmarks on `/`, `/compress`, `/nope`; wordmark link href `/`.
2. Vitest home test (heading, subheading, five cards with svg/name/desc, one `a` per card); updated STORY-02 e2e and router tests still pass.
3. Vitest banner text equals `en['privacy.banner']`; e2e banner visible on three routes.
4. e2e at 1024, 1920 and 390 px: no horizontal scroll, equal-y row vs stacked column.
5. e2e computed font size of `.card-desc` >= 15.
6. e2e Tab order and focus outline 3px per card, Enter opens the path.
7. Existing theme e2e (zero console errors and `style, [style]` count 0, CSP under preview); icons use `createElementNS` and `aria-hidden`; the tokens test still passes.
8. Vitest: no `innerHTML` in `views.ts` and `icons.ts` (assert count 0 of the regex on the file text, plus that the file was read non-empty); typed `t()` keys give tsc coverage of missing strings. The GitHub URL is a constant, not a UI string.
9. Full command run in step 7.

**Risks / rollback**
- Widespread existing-test churn (home h1 changed from "Staple"); update all references, grep `'Staple'` in the tests.
- Card accessible names now include the description; e2e name locators need care.
- 5 columns at 1024px may wrap the title or be tight; verify by screenshot, tune padding. The breakpoint for the list layout is 40rem (640px); 1024 is well above it.
- `body` layout change affects the tool and not-found pages (they gain the shell, intended).
- Roll back by reverting the single PR; there is no data or backend impact.

**Complexity**: standard. Single front end module, but it touches router, views, CSS and several test files, and it has responsive layout risk.

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

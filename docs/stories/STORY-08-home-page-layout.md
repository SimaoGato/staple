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
- `docs/stories/assets/STORY-08/` — the owner supplies a rough layout sketch or a reference site (a PNG) before delivery. Without one, Refine proposes a simple layout and the owner confirms it in review.

## Acceptance criteria
1. Given any route, when it renders, then the page has a header with the text wordmark "Staple" linking to `/`, a main region and a footer, as landmark elements (`header`, `main`, `footer`).
2. Given the home page, when it loads, then each of the five tools is shown as a card with its name and a one-line description, and the whole card is one link to that tool's path. The existing STORY-02 checks (five links, own URL, deep links, not-found view) still pass.
3. Given the home page, when it loads, then a visible line says that files are processed on the device and never uploaded. The text comes from the i18n layer.
4. Given a viewport from 1024 px to 1920 px wide (desktop, per the PRD), when the home page renders, then the cards form a grid with no horizontal scrolling. A Playwright test checks this at both widths.
5. Given only a keyboard, when I tab through the page, then focus moves in reading order, each card shows the focus indicator from STORY-07 and opens with Enter.
6. Given the page, when it loads under the CSP, then there are no CSP violations and no inline styles. All new styles are in `web/src/style.css` and use the STORY-07 tokens.
7. Given every visible string, when checked, then it comes from `web/src/i18n/en.ts`, with no `innerHTML` use in the new DOM code.
8. Given `npm run build`, `npm run lint`, `npm test` and `npm run test:e2e`, when they run, then they pass.

## Out of scope
- Logo artwork and final brand identity (owner decision).
- Mobile layout. The PRD targets desktop.
- Per-tool page content and the shared input flow (EPIC-03).
- Tool icons.

## Technical notes
- Depends on STORY-07 for the tokens.
- Build the shell in `web/src/views.ts` with `createElement` and `textContent`, following the existing pattern.
- Priority: before EPIC-03 stories start.

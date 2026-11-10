---
id: STORY-02
epic: EPIC-01
status: draft
pr: null
---

# App shell with home page, tool routes and i18n strings

## User story
As a visitor, I want a home page that lists the five tools and links to a page for each one, so that I can find the tool I need in one click.

## Context
EPIC-01 (`docs/epics/EPIC-01-foundation.md`). PRD FR-1, plus the §7 non-functional requirements for i18n, accessibility and performance. The tool pages are placeholders; later epics fill them in.

## Acceptance criteria
1. Given the dev server, when I open `/`, then I see the title "Staple" and five links: Compress, Merge, Split, Convert, Resize.
2. Given the home page, when I follow each link, then the URL changes to that tool's own path (e.g. `/compress`) and the page shows that tool's heading.
3. Given a tool URL opened directly (deep link) or after a reload, when the page loads, then the same tool page renders, with no 404.
4. Given an unknown path, when it loads, then a "Page not found" view links back to home.
5. Given the source, when every visible UI string is checked, then it comes from the i18n layer (one English strings module). A test fails if a translation key is missing.
6. Given only a keyboard, when I tab through the home page, then every tool link can be reached, has a visible focus indicator and opens with Enter.
7. Given the production build, when `npm run build` runs, then it succeeds and `npm run lint` and `npm test` pass.
8. Given `CLAUDE.md`, when the story is done, then the front-end commands (install, dev, build, test, lint) and the web app path appear under Commands and Layout.

## Out of scope
- WASM and the worker (STORY-04).
- Real tool UI or shared input flow (EPIC-03).
- Visual design polish beyond clean, readable defaults.

## Technical notes
- TypeScript + Vite, no UI framework (CLAUDE.md § Stack).
- Use the History API for routing. Each tool path must also work as a deep link on Cloudflare: use the SPA fallback or one HTML entry per tool. STORY-05 sets up the hosting side.
- Test runner: Vitest (fits Vite). Lint: ESLint + Prettier. Refine confirms.
- Suggested path: `web/`.

---
id: STORY-02
epic: EPIC-01
status: done
pr: 2
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

## Implementation Plan

**Affected areas:** frontend, ux (a11y/focus), docs (`CLAUDE.md`). No Rust changes.

**Decisions (resolving "Refine confirms")**
- Path `web/`: Vite + vanilla TS (`vite`, `typescript`), `npm` (Node 22, `.nvmrc` 22, `engines` >=22.12). Vitest with `jsdom`; ESLint flat config + `typescript-eslint`; Prettier (+ `eslint-config-prettier`). Scripts: `dev`, `build` (`tsc --noEmit && vite build`), `test` (`vitest run`), `lint` (`eslint . && prettier --check .`). Commit `package-lock.json`. Add `web/node_modules` and `web/dist` to `.gitignore`.
- Deep links: Vite dev and `vite preview` already use SPA fallback (`appType: 'spa'`), so no extra work here. The Cloudflare side (`not_found_handling: "single-page-application"`) is STORY-05. Say so in a README line or code comment, do not build it here.
- CSP-safe from the start (STORY-05 forbids `unsafe-inline`): no inline `<script>`, no inline `<style>`, no `style="..."` attributes or `el.style` writes. All CSS lives in `src/style.css`, imported from `main.ts`.

**Files (all under `web/`)**
- `index.html`: `<div id="app">`, `<script type="module" src="/src/main.ts">`. The `<title>` and `lang="en"` are static. A static title is a visible string. Accept it, or have `main.ts` set `document.title` from i18n. Prefer the latter, with a short placeholder title in the HTML.
- `src/i18n/en.ts`: `export const en = {...} as const`. Keys: `app.title`, `nav.home`, `home.intro`, `tool.compress.name`/`.heading`, and the same for merge, split, convert and resize, plus `placeholder.comingSoon`, `notFound.title`, `notFound.back`, `nav.skip` if used.
- `src/i18n/index.ts`: `t(key: keyof typeof en): string`. The type makes a missing key a compile error. No runtime fallback (unreachable under the type).
- `src/tools.ts`: `TOOLS = [{id:'compress', path:'/compress'}, ...]`, the single source for the home links and the route table. Names come from `t()`.
- `src/router.ts`: `resolve(pathname): Route` (pure; strips a trailing slash; unknown returns `notFound`). `mount(root)` renders and returns a teardown. Click delegation on `a[data-link]`: ignore modified clicks (ctrl/meta/shift/alt, non-zero button), `target`, `download` and cross-origin links; otherwise `preventDefault`, `pushState` path + query + hash (skip if same URL), render. `popstate` re-renders. Both click and `popstate` move focus to the `h1`.
- `src/views.ts`: `home()`, `tool(id)`, `notFound()` build DOM with `createElement` and `textContent` (no `innerHTML`). Render `<main>` with one `<h1>`. Home: `h1` "Staple" plus `<nav><ul>` of 5 `<a href>`. Tool: `h1` with the tool heading, a placeholder `<p>`, and a Home link. Not found: `h1` "Page not found" and a link to `/`. Move focus to `h1` (`tabindex="-1"`) after client-side navigation, and update `document.title`.
- `src/main.ts`: mount, initial render.
- `src/style.css`: readable defaults (system font stack, max-width ~40rem, spacing). Explicit `a:focus-visible { outline: 3px solid ...; outline-offset: 2px }` (do not rely on the browser default). Ensure contrast of at least 4.5:1.
- Config: `tsconfig.json` (strict), `vite.config.ts` (Vitest `environment: 'jsdom'`), `eslint.config.js`, `.prettierrc`.
- `CLAUDE.md`: replace "Run locally: <tbd>" with one Web line (install, run locally, build, test, lint; Node >=22.12; not in CI yet). Layout gets `web/`: TypeScript + Vite app.

**Steps (test-first)**
1. Scaffold `web/` (package.json, configs, empty `src`), and confirm that `npm run lint` and `npm test` run (with one placeholder test).
2. Write tests, see them fail:
   - `router.test.ts`: `resolve('/')`, each tool path, trailing slash, unknown path.
   - `i18n.test.ts`: every key used by `TOOLS` and views exists in `en`, and values are non-empty. Also a test that scans `src/**/*.ts` (excluding `i18n/` and tests) for `t('...')` literals and asserts each is a key in `en`.
   - `views.test.ts` (jsdom): home has `h1` "Staple" and 5 links with the right hrefs and text. Each tool view has the right `h1`. The not-found view has a link to `/`. The `a:focus-visible` rule has a solid outline >= 2px.
   - `router.test.ts` `mount` (fresh root per test, teardown in `afterEach`): clicking each link changes `location.pathname`, renders the heading and focuses it. `popstate` re-renders and focuses the heading. A deep link (`history.replaceState` to `/merge` before mount) renders the merge heading. Same-URL click adds no history entry; query and hash are kept; modified/`target`/cross-origin clicks are left to the browser; teardown removes listeners.
3. Implement i18n, tools, router, views, main, CSS until green.
4. Manual check with the dev server: open `/`, `/split` directly, and reload it. Check an unknown path, and tab and Enter across the links.
5. `npm run build`, then `npm run preview` and curl `/convert` for 200 with the app HTML. Check that `dist/index.html` has no inline script or style.
6. Update `CLAUDE.md`. Run `npm run lint && npm test && npm run build` from a clean `npm ci`.

**Test plan per AC**
1. views test (title and 5 links) plus manual check of `/` in the dev server.
2. Navigation test (pushState, path, heading) for all 5 tools.
3. Deep-link test (jsdom, `replaceState` then mount) plus `curl` against dev and preview for 200 on `/compress` and the other tool paths.
4. `resolve` unknown-path test, not-found view test (link to `/`), and a click test that goes home.
5. i18n completeness test (keys in `en` are non-empty, and a source scan for `t()` keys). The `keyof` typing guards at compile time. Reviewer greps for hardcoded strings in `views.ts`.
6. Manual keyboard pass (Tab order, visible focus ring). Automated: all home links are `<a href>` (natively focusable, Enter-activated), with no `tabindex=-1` on them. Assert that the `a:focus-visible` rule has a visible outline. jsdom cannot verify the rendering.
7. Run `npm run build`, `lint` and `test` as the final gate.
8. Review `CLAUDE.md` diff.

**Browser tests (added in rework)**
- `web/e2e/app-shell.e2e.ts` (Playwright, headless Chromium, `npm run test:e2e`) runs against the production build via `vite preview`. It covers AC1 to AC4 and AC6 in a real browser: the links, navigation, deep link + reload (200), not found, Tab order, the computed focus outline and Enter. It also checks back/forward focus, and fails on any console or page error.

**Risks / rollback**
- Pure addition under `web/` plus a `CLAUDE.md` edit and `.gitignore` lines; revert the commit to roll back.
- Dependency versions: use current majors, and read the docs of the installed Vitest and ESLint flat-config before writing config (per CLAUDE.md, no guessing APIs).
- Inline styles or scripts would break STORY-05's CSP, so this plan forbids them.
- jsdom does not implement layout or focus ring rendering; the Playwright e2e test covers it.
- `tsc` and ESLint both have to cover the test files. Keep `tsconfig` `include` as `src` and the config files.
- Deep links in production are only proven in STORY-05 (Cloudflare SPA fallback).
- Cross-story: STORY-04 will add worker code to `web/`; keep `main.ts` small so that merge is easy.

**Complexity:** standard. Several small modules and new toolchain config, but there is no auth, data or security logic beyond the CSP-safe constraint.

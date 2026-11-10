---
id: STORY-05
epic: EPIC-01
status: done
pr: 5
---

# Deploy to Cloudflare with CSP, COOP and COEP headers

## User story
As a Staple user, I want the app served from a fast host with a strict Content-Security-Policy, so that the browser itself blocks any attempt to send my files elsewhere.

## Context
EPIC-01 (`docs/epics/EPIC-01-foundation.md`). PRD FR-24, D-3 (Cloudflare Workers Static Assets, `_headers`) and M3.

## Acceptance criteria
1. Given a push to `main` with green CI, when the deploy job runs, then the build is published to Cloudflare Workers Static Assets and the job prints the deployed URL.
2. Given a pull request, when CI runs, then no production deploy happens.
3. Given the deployed site, when any HTML page is requested, then the response has a `Content-Security-Policy` with `default-src 'self'`, `connect-src 'self'`, `script-src 'self' 'wasm-unsafe-eval'`, `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`, and no `unsafe-inline` or `unsafe-eval`.
4. Given the deployed site, when any page is requested, then the response has `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`, and `crossOriginIsolated` is `true` in the page.
5. Given the deployed site, when a tool URL (e.g. `/merge`) is opened directly, then the tool page renders, with no 404.
6. Given the deployed site, when the demo worker job from STORY-04 runs, then it succeeds with no CSP violation in the console.
7. Given a page script tries `fetch('https://example.com')`, when it runs on the deployed site, then the browser blocks it under the CSP. An automated check (e.g. a Playwright test against the deployed URL) covers this.
8. Given the deploy job ends, when it checks the headers, then a post-deploy step uses `curl -I` to assert the CSP, COOP and COEP headers and fails the job if any is missing.
9. Given `CLAUDE.md`, when the story is done, then the deploy command and the production URL are recorded.

## Out of scope
- Custom domain `haveitstapled.com` (EPIC-10).
- Analytics origin in the CSP (EPIC-09).
- Preview deploys for each pull request.

## Technical notes
- **Human prerequisite:** create a Cloudflare account and an API token with Workers edit rights. Add the GitHub secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` before delivery.
- `wrangler.jsonc` with an `assets` directory pointing at the Vite build output. Use `not_found_handling: "single-page-application"` for deep links. Check this against current Cloudflare docs.
- Put `_headers` in the build output (Vite `public/`).
- If the worker is a blob or module script, `worker-src 'self'` may be needed. Verify on the deploy.

## Implementation Plan

**Affected areas**: infra (CI, wrangler), frontend (build config, e2e), docs.

**Design**
- `web/public/_headers` (Vite copies it to `dist/`), one block `/*`: CSP `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`, plus `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`. No `unsafe-inline`/`unsafe-eval`. Add `worker-src 'self'` only if e2e shows a violation (Vite emits a real worker file, so likely not needed). `style-src` falls back to `default-src 'self'`, fine since CSS is external.
- `web/wrangler.jsonc`: `name: "staple"`, `compatibility_date` set to today's date, `assets: { directory: "./dist", not_found_handling: "single-page-application" }`. No `main` (assets-only). Verify keys against current Cloudflare docs (context7) before writing.
- Add `wrangler` as a `web` devDependency (lockfile pinned; no global install in CI).
- Local header parity: `vite preview` ignores `_headers`. In `web/vite.config.ts` set `preview.headers` by parsing `public/_headers` (the `/*` block, about 10 lines), so the existing e2e suite runs under the real CSP/COOP/COEP. Single source of truth.

**Steps (test-first)**
1. Playwright `web/e2e/headers.e2e.ts` (fails first): for `/` and `/merge`, response headers contain CSP directives from AC3 (exact-match each directive; assert no `unsafe-inline`/`unsafe-eval`), COOP, COEP; `evaluate(() => crossOriginIsolated)` is true; `fetch('https://example.com')` rejects and a `securitypolicyviolation` event / console CSP message fires. Reuse the console-error guard from `worker.e2e.ts` except where the violation is expected.
2. Create `web/public/_headers`; add `preview.headers` parser to `vite.config.ts`. Tests go green. Existing `worker.e2e.ts` (demo worker, AC6) and `app-shell.e2e.ts` now run under the CSP; fix any violation (worker-src, wasm).
3. Make the AC7 test reusable against the deployed site: the headers/fetch-block spec reads `E2E_BASE_URL` and, if set, uses it as `baseURL` and skips webServer (add a second Playwright config `web/playwright.deployed.config.ts`, no webServer, `testMatch: 'headers.e2e.ts'`). Script `test:e2e:deployed`.
4. Add `wrangler.jsonc`, `npm i -D wrangler`, script `deploy`: `wrangler deploy`.
5. CI (`.github/workflows/ci.yml`): in the `web` job, after `npm run build`, upload `web/dist` as an artifact (only needed on push, but harmless). Add job `deploy`: `needs: [rust, web]`, `if: github.event_name == 'push' && github.ref == 'refs/heads/main'` (AC2), `permissions: contents: read`, own concurrency group `deploy` with `cancel-in-progress: false`. Steps: checkout (pinned SHA as existing), setup-node, `npm ci`, download artifact into `web/dist`, `npx wrangler deploy` with `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` secrets, tee output, extract `https://\S+\.workers\.dev` into a step output and print it (AC1). Pin any new action by SHA like existing ones.
6. Post-deploy step in the same job (AC8): for `/` and `/merge`, `curl -sSI "$URL"`, grep -i each of CSP (`default-src 'self'`, `connect-src 'self'`, `script-src 'self' 'wasm-unsafe-eval'`, `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`), COOP, COEP; `exit 1` on any miss. Then install Chromium and run `test:e2e:deployed` with `E2E_BASE_URL=$URL` (AC4 crossOriginIsolated, AC5 `/merge` 200 with heading, AC7).
7. `CLAUDE.md`: record deploy command (`cd web && npx wrangler deploy`, run by CI on push to main), production URL (fill from first deploy output), `_headers` location, and the secrets needed (AC9). Update the comment in `vite.config.ts` about "configured in STORY-05". Set story status per workflow.

**Test plan**
- AC1: first push to main after merge; job log shows deployed URL. Manual verification (cannot be unit tested).
- AC2: `if:` guard; verify the PR's CI run shows deploy skipped.
- AC3, AC4 (headers + `crossOriginIsolated`): `headers.e2e.ts` locally (preview with parsed `_headers`) and on deployed URL.
- AC5: `/merge` 200 + heading in deployed e2e; locally already covered by `app-shell.e2e.ts`.
- AC6: existing `worker.e2e.ts` run locally under the CSP preview (console-error guard fails on any violation). Note: `window.staple` hook exists only in `--mode e2e` builds, so the demo job cannot run against the production deploy; the local run under identical headers is the proof. State this in the PR.
- AC7: `headers.e2e.ts` local and deployed.
- AC8: the curl step itself; sanity-check the grep logic once locally against `vite preview`.
- AC9: review of CLAUDE.md diff.

**Risks / rollback**
- Human prerequisite: secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` must exist, or the deploy job fails on main (CI gates unaffected since deploy is a separate job). Production URL (workers.dev subdomain) is only known after the first deploy, so CLAUDE.md URL may need a follow-up commit.
- COEP `require-corp` breaks any cross-origin resource; the app has none today (analytics comes in EPIC-09).
- SPA `not_found_handling` makes unknown paths return 200 index.html (the app shows its own not found). Expected.
- `preview.headers` parser is a shortcut for the single `/*` block; upgrade if `_headers` gains path rules.
- Rollback: revert the deploy job; Cloudflare dashboard can roll back a version.

**Complexity**: standard. Multi-file infra and CI with security headers, but no application logic.

Bug fix: fix/deploy-header-check-race — post-deploy header check retries until the edge serves the new deploy (BUGFIX-01, #6).

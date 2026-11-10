---
id: STORY-05
epic: EPIC-01
status: draft
pr: null
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

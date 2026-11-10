# EPIC-09 — Privacy, trust and analytics

**Goal.** Make the privacy promise visible and testable, and count usage without breaking it. A user-facing explanation, an automated zero-upload test (M3) and cookieless analytics (M2) together let users trust Staple and let the team measure success.

## In scope
- "Files never leave your device" statement, plus an explanation page on how to check it (FR-23).
- Privacy page.
- Umami Cloud: page views, plus an anonymous "operation completed/failed" event that carries only the tool name. Add the endpoint to the CSP (FR-30, D-4).
- Automated E2E test: run every tool while watching network traffic, and run every tool offline. No request may carry file data (M3).

## Out of scope
- Any analytics beyond the tool name and outcome.

## Depends on
- EPIC-01, EPIC-03, EPIC-08

## Done signals
- The Umami dashboard shows page views and completed and failed operations for each tool.
- The M3 E2E test runs in CI and passes for every tool.
- The privacy and "how to check" pages are live and linked from every tool.

## Candidate stories
- "Files never leave" statement and how-to-check page
- Privacy page
- Umami analytics with tool-outcome events
- Automated zero-upload and offline E2E test

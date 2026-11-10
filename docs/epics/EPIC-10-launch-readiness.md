# EPIC-10 — Launch readiness

**Goal.** Confirm v1 meets its success bar and put it on its real domain: performance (M1), accessibility (WCAG 2.2 AA), the browser matrix and task completion (M4). This is the gate between "built" and "launched".

## In scope
- Benchmark in CI on the reference set, failing the build when the M1 budget is exceeded.
- WCAG 2.2 AA audit and fixes for all tools.
- Check the browser matrix: latest 2 versions of Chrome, Edge, Firefox and Safari on desktop.
- Moderated usability test with 5 first-time users. At least 4 of 5 must finish each task without help (M4).
- Register `haveitstapled.com` at Cloudflare Registrar and point it at the deploy (D-10).
- Check that the first load takes under 3 s.

## Out of scope
- Marketing and SEO.

## Depends on
- EPIC-04, EPIC-05, EPIC-06, EPIC-07, EPIC-08, EPIC-09

## Done signals
- The M1 benchmark gate is green in CI.
- The a11y audit shows no AA failures.
- M4 results are written up, with every task passing.
- The app is live at `https://haveitstapled.com`.

## Candidate stories
- M1 benchmark gate in CI
- WCAG 2.2 AA audit and fixes
- Browser matrix verification
- Usability test (M4) and fixes
- Custom domain on Cloudflare

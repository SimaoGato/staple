# EPIC-08 — Offline PWA

**Goal.** Make Staple work with no network after the first visit, and let users install it. Offline use backs up the privacy promise (G2, M3): if it works offline, nothing is being uploaded. Users with an unreliable connection can still use it.

## In scope
- Service worker that caches the app shell and the WASM modules, including the lazy-loaded PDFium (FR-25).
- Web app manifest and icons, so the app can be installed (FR-26).
- "New version available" prompt (FR-26).

## Out of scope
- Offline licence checks (EPIC-11).

## Depends on
- EPIC-01

## Done signals
- After one visit, every tool works with the network turned off.
- The app installs from Chrome and Edge on desktop.
- A new deploy shows the update prompt to open tabs.

## Candidate stories
- Service worker caching the app shell and WASM
- Installable PWA manifest
- New-version prompt

# EPIC-11 — Pro tier (Phase 2)

**Goal.** Start earning without breaking the privacy promise. The free tier gets visible caps (50 MB per file, 10 files per operation). Pro is sold through Polar for $24 a year or $49 for life, and is unlocked with a licence key that keeps working offline (D-7 to D-9).

## In scope
- Turn on the free caps in the limits module, and show them up front on every tool.
- Pricing page and Polar checkout ($24/year and $49 lifetime).
- Licence key entry, a one-time online activation through Polar, a local cache, and a weekly re-check when online (D-8).
- Add Polar's API origin to the CSP for the activation path only.

## Out of scope
- Pro-only features (EPIC-12).
- User accounts.

## Depends on
- EPIC-10

## Done signals
- Free users see the caps before they hit them. Going over a cap shows an upgrade prompt and the steps to get under it.
- A test purchase in Polar's sandbox produces a key that unlocks Pro, and Pro keeps working offline.
- No request other than licence activation reaches Polar. The M3 test still passes.

## Candidate stories
- Turn on free caps and show them in each tool
- Pricing page and Polar checkout
- Licence key activation and offline cache
- CSP and zero-upload test update for Polar

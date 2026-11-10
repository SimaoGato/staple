# Staple

<!-- Project brief. Loaded into every Claude session and subagent: keep it under ~60 lines, link docs instead of copying them. -->

## What
Browser-only PDF and image tools (compress, merge, split, convert, resize) for everyday paperwork, for the general public on desktop. Files never leave the device: all processing runs locally in Rust compiled to WebAssembly. Free, no account, no ads. Details: `docs/product/PRD.md`.

## Stack
- Core: Rust library compiled to WebAssembly, run in a Web Worker
- Front end: TypeScript + Vite, no UI framework
- Static hosting, no backend; offline PWA via service worker
- Analytics: cookieless, aggregate only (provider <tbd>)
- PDF rendering engine: <tbd> (PRD OQ-1)

## Commands
- Build: <tbd>
- Test (what CI runs): <tbd>
- Lint / format: <tbd>
- Run locally: <tbd>

## Layout
- <tbd>

## Conventions & gotchas
<!-- codifier maintains this: one line each, obsolete lines removed. -->
- Never send file bytes, names or sizes over the network. CSP allows only self + the analytics endpoint.
- All UI strings go through the i18n layer (English only at launch).

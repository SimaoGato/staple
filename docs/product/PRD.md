# Staple — Product Requirements

Status: draft v1 · 2026-11-10

## 1. Problem & context

Everyday paperwork often needs small file fixes. People need to get a PDF under an upload size limit, merge scans for an application, split out the pages a form asks for, or turn photos into JPGs. The usual fix is an ad-filled website that uploads personal documents (IDs, contracts, tax forms) to an unknown server. Desktop software is heavy, often paid, and sometimes not allowed on work machines.

Staple is a set of PDF and image tools that runs entirely in the browser. Files are processed locally by Rust compiled to WebAssembly and never leave the computer. It is free and needs no account. v1 sets no artificial limits. A later paid tier adds visible caps (D-7).

**Why now.** Two reasons. Staple shows off Rust + WebAssembly skills in a real, useful product. It also goes after a real gap: the popular tools upload your files and are full of ads. Local-first browser tools already exist (e.g. MantisPDF, PDFkoi, PDFCraft), so Staple competes on focus, speed, polish and a privacy promise anyone can check. It does not compete on tool count.

## 2. Users

The broad public, with no single primary persona. Typical users:
- **Everyday individuals** doing applications (job, visa, school, tax). They are not technical.
- **Privacy-conscious users** who will not upload IDs or contracts to unknown sites.
- **Office / small-business staff** who handle documents weekly, often on machines where they cannot install software.

Platform: **desktop browsers only** in v1.

## 3. Goals / non-goals

**Goals (v1)**
- G1. Five core tools work well: compress, merge, split, convert, resize.
- G2. No file bytes ever leave the device, and anyone can check this.
- G3. The tools are fast enough to feel instant for typical paperwork.
- G4. A first-time, non-technical user finishes each task without help.
- G5. The app works offline after the first visit (installable PWA).

**Non-goals (v1)**
- OCR / text recognition.
- PDF editing: annotations, form filling, signatures, text editing.
- Office formats (Word, Excel, PowerPoint).
- Adding passwords to PDFs. (Opening protected PDFs is in scope.)
- HEIC input (Pro, Phase 2).
- Mobile browser support (Phase 3).
- Accounts, payments, cloud storage. The paid tier comes in Phase 2 (D-7), so v1 must not make it hard to add.
- Ads.

## 4. Success metrics

| # | Metric | Target | How measured |
|---|---|---|---|
| M1 | Speed | Compress, merge or split a 20 MB, ~50-page PDF in **< 5 s** | Benchmark in CI on a reference file set. Manual check on a mid-range laptop (4 cores, 8 GB RAM, current Chrome) |
| M2 | Usage | **≥ 1,000 completed operations / month** within 3 months of launch | Cookieless aggregate analytics (FR-30) |
| M3 | Zero uploads | **0** requests carry file data. Every tool works with the network off after the first load | Automated E2E test that watches network traffic and runs each tool offline. CSP blocks other origins |
| M4 | Task completion | **≥ 4 of 5** first-time users finish each of the 5 tasks without help | Moderated usability test before launch |

## 5. Key journeys

1. **Get under an upload limit.** Open Compress, drop a 12 MB PDF, choose a target ("under 2 MB") or a preset, download the result. The app shows the size before and after.
2. **Merge scans for an application.** Open Merge, drop 4 PDFs and/or images, reorder them, download one PDF.
3. **Extract pages.** Open Split, drop a PDF, enter a page range (e.g. `1-3, 7`) or choose "every page", download a PDF or a ZIP.
4. **Photos to JPG / PDF.** Open Convert, drop several PNG/WebP photos, choose JPG (one file each, ZIP if more than one) or one combined PDF.
5. **Resize photos for a form.** Open Resize, drop photos, set the max width/height or a percentage, download.
6. **Protected PDF.** Drop a password-protected PDF into any PDF tool. Enter the password when asked. The tool continues as normal.

## 6. Functional requirements

**General**
- FR-1. Each tool has its own URL/page. A home page lists the five tools.
- FR-2. Input by drag-and-drop or file picker. More than one file where it makes sense.
- FR-3. All processing runs in a Web Worker on the WASM core. The UI stays responsive and shows progress.
- FR-4. Each tool shows a clear result: output file name, size, and the size change where relevant. Download is one click.
- FR-5. More than one output file downloads as a single ZIP. A single download is also offered.
- FR-6. Corrupt or unsupported input gets a plain-language error that names the file. One bad file does not stop the other files.
- FR-7. Encrypted PDFs ask for the password and open locally. A wrong password shows a retry message. The output is not encrypted.
- FR-8. There are no artificial limits on file count or size. If the device runs out of memory, the app shows a clear message instead of crashing.
- FR-9. The user can cancel a running operation.

**Compress**
- FR-10. Compress a PDF with presets: light, balanced, strong. This covers recompressing and downscaling images plus optimising streams and objects.
- FR-11. Optional target size (e.g. "under 2 MB"). This is best effort: the app reports the size reached when it cannot hit the target.
- FR-12. Compress JPG/PNG/WebP images with a quality setting.

**Merge**
- FR-13. Merge 2 or more PDFs and/or images (JPG, PNG, WebP) into one PDF.
- FR-14. Reorder and remove inputs before merging, with the mouse and with the keyboard.

**Split**
- FR-15. Extract pages by range expression (`1-3, 7, 10-`) into one PDF.
- FR-16. Split into one PDF per page, or every N pages, as a ZIP.
- FR-17. Show page thumbnails to help choose pages.

**Convert**
- FR-18. Images (JPG, PNG, WebP) to PDF, one page per image, in a chosen order.
- FR-19. PDF to images: each page as JPG or PNG at a chosen DPI.
- FR-20. Convert between JPG, PNG and WebP. Transparency gets a white background when the target is JPG.

**Resize**
- FR-21. Resize images by max width/height (keeping the aspect ratio), by exact pixels, or by percentage.
- FR-22. Apply EXIF orientation. Strip EXIF/GPS metadata by default and say so in the UI.

**Privacy & trust**
- FR-23. A visible "files never leave your device" statement links to a short explanation of how to check it (DevTools network tab, offline test).
- FR-24. A strict Content-Security-Policy blocks network requests to any origin except the app's own origin and the analytics endpoint.

**Offline**
- FR-25. A service worker caches the app shell and WASM. After the first visit, every tool works offline.
- FR-26. The app can be installed as a PWA. When a new version is available, the app says so.

**Analytics**
- FR-30. Cookieless aggregate analytics (Umami, D-4): page views and an anonymous "operation completed/failed" event with tool name only. No file names, contents, sizes or user identifiers.

## 7. Non-functional requirements

- **Performance.** M1 budget. First load under 3 s on a broadband connection. Load the WASM per tool, or lazily, so the home page stays light. Heavy codecs (e.g. a PDF renderer) load only when a tool needs them.
- **Security.** Treat all input files as untrusted and parse them only inside the WASM sandbox in a worker. Use no third-party scripts except analytics. Pin dependencies and audit them in CI. Do not use `eval`.
- **Privacy.** No cookies, no fingerprinting, no file data in logs or analytics. A privacy page explains this.
- **Accessibility.** WCAG 2.2 AA. Full keyboard use, including reordering. Progress and errors are announced to screen readers.
- **i18n.** English at launch. Keep all UI strings in a translation layer from day one.
- **Browsers.** The latest 2 versions of Chrome, Edge, Firefox and Safari on desktop.
- **Maintainability.** The Rust core is a library with native unit tests. The browser layer is thin.

## 8. Constraints, assumptions, open questions

**Constraints**
- Static hosting only, no backend.
- Rust core compiled to WebAssembly. TypeScript + Vite front end with no UI framework.
- Desktop browsers only.
- Open source under AGPL-3.0 (D-6).

**Assumptions**
- Typical inputs are under 50 MB and under 200 pages.
- Browser memory is the real ceiling. 100 MB+ files may fail on low-memory machines (FR-8 covers this).
- A privacy-friendly analytics service (Plausible/GoatCounter style) is acceptable under the privacy promise.

**Decisions** (resolved 2026-11-10)
- D-1. **PDF rendering engine: PDFium** via the `pdfium-render` crate, compiled to WASM. A C++ engine under Rust bindings is acceptable for performance. Load it only in tools that render (FR-17, FR-19).
- D-2. **PDF compression engine: pure Rust (`lopdf` + `image`)**, decided by the Phase 0 spike (STORY-10). On the 20 MB reference file, its output was 0.2% smaller than PDFium's, and it took 4.76 s in Chrome on an 8-core desktop, under the M1 budget. The M1 reference laptop (4 cores, 8 GB) was not measured and will likely be slower than 5 s, so EPIC-05 must make it faster. Record: [`docs/decisions/D-2-compression-engine.md`](../decisions/D-2-compression-engine.md).
- D-3. **Hosting: Cloudflare (Workers Static Assets, free plan).** Static asset requests are free and unlimited, so a traffic spike costs nothing. Cloudflare sets custom response headers through a `_headers` file. The app needs that for the CSP (FR-24) and for COOP/COEP (multi-threaded WASM). GitHub Pages cannot set headers. Netlify's free plan caps bandwidth. Domain: to be bought before launch.
- D-4. **Analytics: Umami Cloud, free Hobby tier.** It is cookieless and supports the custom events FR-30 needs. It is open source, so it can be self-hosted if the app outgrows the free tier. Cloudflare Web Analytics has no custom events. Check the free-tier event cap at signup; M2 needs far less.
- D-5. **Merge granularity:** reordering whole files is enough for v1 (FR-14).
- D-6. **Licence: AGPL-3.0.** Anyone can check the privacy promise. Anyone who hosts a modified copy must publish their source, which protects a later paid tier. Third-party licences (PDFium is BSD/Apache) are checked in CI.
- D-7. **Freemium shape (Phase 2).**
  - **Market:** Smallpdf allows about 2 free tasks a day (Pro about $9–15/month). iLovePDF caps free documents and file size (Premium about $5–7/month). Adobe Acrobat Pro costs about $20/month. PDF24 is free with no caps.
  - **Rule:** limit by **file size and batch size**, never by tasks per month. Counting tasks needs a server that sees every operation, which breaks the privacy promise and offline use.
  - **Free caps:**
    - Max file size: **50 MB per file**. This covers typical paperwork (§8 assumptions).
    - Max batch: **10 files per operation** (merge, convert, resize, image compress).
    - Everything else free: all five tools, all presets, target-size compress, PDF to images, page thumbnails.
    - Every core journey (§5) stays free. Pro never takes away something the free tier had.
  - **Pro:**
    - No caps.
    - Pro-only features: page-level edit (rotate, reorder, delete), adding PDF passwords, HEIC input.
  - **Caps:** shown up front on every tool, never hidden. The pitch changes from "no limits" to "clear limits".
  - **Honour system:** this is open source, so anyone can remove the caps. This is accepted, and the AGPL stops closed forks.
  - **v1 impact:** v1 ships with no caps (FR-8). All size and count checks live in one module so the Pro phase can add caps there.
- D-8. **Payment provider: Polar (polar.sh).**
  - **Why Polar:**
    - Merchant of record: Polar collects and pays EU VAT and sales tax worldwide, so there is no tax filing per country.
    - Built for open-source developers.
    - Licence keys built in, with expiry and activation limits.
    - No monthly fee.
  - **Fees:** about 5% + $0.50 per sale. International cards add about 1.5%. Check polar.sh/pricing at signup.
  - **Rejected:**
    - Paddle: same fee, aimed at larger SaaS.
    - Lemon Squeezy: moving to Stripe Managed Payments, so its future is unclear.
    - Gumroad: about 10% fee.
    - Stripe direct: not a merchant of record, so VAT would be handled by hand.
  - **Licence check:** Polar validates keys online. The app activates the key once, with one call to Polar's API (never file data), and caches the result locally. Pro then works offline. It re-validates when online, at most once a week. The CSP (FR-24) adds Polar's API origin only on this activation path.
- D-9. **Pro price: $24 / year or $49 one-time (lifetime).** USD, VAT added by Polar at checkout.
  - **Price:** about $2/month, under half of iLovePDF and well under Smallpdf or Acrobat.
  - **Margin:** Staple has no server costs, so the low price still keeps about 90% per sale after fees.
  - **No monthly plan:** a fixed $0.50 fee would take about 17% of a $3–4 sale.
  - **Lifetime option:** suits people who do paperwork a few times a year.
  - **Review:** after 3 months of sales data.
- D-10. **Domain: `haveitstapled.com`** (unregistered as of 2026-11-10).
  - **Registrar:** register it at **Cloudflare Registrar**, not GoDaddy. Cloudflare sells at cost, about $10.50–11/year with no renewal markup. GoDaddy's cheap first year renews at about $22/year. Cloudflare also hosts the app (D-3), so DNS and HTTPS need no setup.
  - **Optional:** `usestaple.app` (also unregistered) is a short alias that matches the brand. Buying it is up to the owner.

## 9. Phasing

- **Phase 0: Spikes.** Run the compression spike (D-2). Check the size and load time of the PDFium WASM build (D-1). Set up the WASM build, the worker bridge, CI, the benchmark harness and Cloudflare deploy (D-3).
- **Phase 1: v1 launch.** All five tools (FR-1 to FR-22), privacy features (FR-23, FR-24), offline PWA (FR-25, FR-26), analytics (FR-30), a11y, and the usability test (M4).
- **Phase 2: Pro launch.** Paid tier with free caps (D-7 to D-9). Pro-only features: page-level edit, adding PDF passwords, HEIC input.
- **Phase 3: Reach.** Mobile browsers, more languages.

/// <reference lib="webworker" />
// Spike: PDFium in the worker. Reached only from the e2e build (see worker.ts).
import type { PdfiumJobMessage, PdfiumResultMessage } from './protocol';

type Pkg = typeof import('../pdfium-pkg/staple_pdfium_wasm.js');

let loaded: Promise<Pkg> | undefined;

// The prebuilt PDFium (Emscripten ES module + .wasm) is copied to /pdfium/ by vite.config.ts.
// Lazy: nothing is fetched until the first render job.
function load(): Promise<Pkg> {
  return (loaded ??= (async () => {
    const glue = (await import(
      /* @vite-ignore */ `${self.location.origin}/pdfium/pdfium.esm.js`
    )) as { default: () => Promise<object> };
    const pdfium = await glue.default();
    const pkg = await import('../pdfium-pkg/staple_pdfium_wasm.js');
    const local = await pkg.default();
    if (!pkg.initialize_pdfium_render(pdfium, local, false))
      throw new Error('initialize_pdfium_render failed');
    return pkg;
  })().catch((e: unknown) => {
    loaded = undefined; // never cache a failed load
    throw e;
  }));
}

export async function renderJob(
  msg: PdfiumJobMessage,
): Promise<PdfiumResultMessage> {
  let t = performance.now();
  const pkg = await load();
  const loadMs = performance.now() - t;
  t = performance.now();
  const doc = new pkg.Doc(new Uint8Array(msg.input));
  const openMs = performance.now() - t;
  const pageCount = doc.page_count();
  const pages = msg.all
    ? Array.from({ length: pageCount }, (_, i) => i)
    : [msg.index];
  const pageMs: number[] = [];
  let width = 0;
  let height = 0;
  let nonBlank = false;
  for (const i of pages) {
    t = performance.now();
    const r = doc.render(i, msg.dpi);
    pageMs.push(performance.now() - t);
    width = r.width;
    height = r.height;
    // Consumes (and frees) r, outside the timed section.
    const px = new Uint32Array(r.take_rgba().buffer);
    if (!nonBlank) nonBlank = px.some((v) => v !== px[0]);
  }
  doc.free();
  return {
    type: 'pdfium-result',
    id: msg.id,
    pageCount,
    width,
    height,
    nonBlank,
    loadMs,
    openMs,
    pageMs,
  };
}

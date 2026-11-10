import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// Minimal one-page PDF; offsets computed so the xref is valid.
function tinyPdf(): number[] {
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>',
  ];
  let s = '%PDF-1.4\n';
  const offs = objs.map((o, i) => {
    const at = s.length;
    s += `${i + 1} 0 obj\n${o}\nendobj\n`;
    return at;
  });
  const xref = s.length;
  s += `xref\n0 4\n0000000000 65535 f \n`;
  s += offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  s += `trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return [...Buffer.from(s, 'latin1')];
}

test('compress returns a PDF; bad input gives a typed error', async ({
  page,
}) => {
  await page.goto('/');
  const r = await page.evaluate(async (bytes) => {
    const out = await window.staple.runCompress(new Uint8Array(bytes));
    return new TextDecoder().decode(out.slice(0, 5));
  }, tinyPdf());
  expect(r).toBe('%PDF-');
  const code = await page.evaluate(() =>
    window.staple.runCompress(new TextEncoder().encode('nope')).then(
      () => 'resolved',
      (e: { code: string }) => e.code,
    ),
  );
  expect(code).toBe('not_pdf');
});

// Spike timing: COMPRESS_SPIKE_FILE=../bench/refset/image-heavy-20mb.pdf npx playwright test compress-spike
test('in-browser compress time on a large file', async ({ page }) => {
  const file = process.env.COMPRESS_SPIKE_FILE;
  test.skip(!file, 'set COMPRESS_SPIKE_FILE to time a large PDF');
  test.setTimeout(300_000);
  const bytes = [...readFileSync(file!)];
  await page.goto('/');
  // Warm the wasm load so the timing is the compress call only.
  await page.evaluate(
    (b) => window.staple.runCompress(new Uint8Array(b)),
    tinyPdf(),
  );
  const ms = await page.evaluate(async (b) => {
    const t = performance.now();
    const out = await window.staple.runCompress(new Uint8Array(b));
    return { ms: performance.now() - t, out: out.length };
  }, bytes);
  console.log(
    `COMPRESS_SPIKE ${file}: ${ms.ms.toFixed(0)} ms, ${ms.out} bytes out`,
  );
  expect(ms.out).toBeGreaterThan(0);
});

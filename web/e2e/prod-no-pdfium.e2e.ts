import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

// Runs against the default-mode build in dist-prod (port 4174): no hook, no PDFium.
const DIST = join(import.meta.dirname, '../dist-prod');

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

test('home requests no PDFium file and the hook is absent', async ({
  page,
}) => {
  const urls: string[] = [];
  page.on('request', (r) => urls.push(r.url()));
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(urls.length).toBeGreaterThan(0);
  expect(urls.filter((u) => /pdfium/i.test(u))).toEqual([]);
  expect(await page.evaluate(() => 'staple' in window)).toBe(false);
});

test('the production build contains no PDFium file or reference', () => {
  const files = walk(DIST);
  expect(files.length).toBeGreaterThan(0);
  expect(files.filter((f) => /pdfium/i.test(f))).toEqual([]);
  const code = files.filter((f) => /\.(js|wasm)$/.test(f));
  expect(code.length).toBeGreaterThan(0);
  const hits = code.filter((f) =>
    /pdfium/i.test(readFileSync(f).toString('latin1')),
  );
  expect(hits).toEqual([]);
});

test('the demo page is not in the production build', async ({ page }) => {
  await page.goto('/demo');
  await expect(page.locator('h1')).toHaveText('Page not found');
  const code = walk(DIST).filter((f) => /\.js$/.test(f));
  expect(code.length).toBeGreaterThan(0);
  expect(
    code.filter((f) => readFileSync(f, 'utf8').includes('tool-flow')),
  ).toEqual([]); // the demo (the only user of the class) does not
});

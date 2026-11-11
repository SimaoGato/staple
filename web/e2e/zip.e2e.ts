import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { readZip } from './zip-reader';

const errors: string[] = [];
test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
});
test.afterEach(() => expect(errors).toEqual([]));

const mk = (name: string, body: string) => ({
  name,
  mimeType: 'application/pdf',
  buffer: Buffer.from(body),
});
async function run(page: Page, batches: ReturnType<typeof mk>[][]) {
  await page.goto('/demo');
  await page.locator('.dropzone').waitFor();
  for (const b of batches)
    await page.locator('input[type=file]').setInputFiles(b);
  await page.getByRole('button', { name: 'Copy files' }).click();
  await page.getByRole('heading', { name: 'Done' }).waitFor();
}

const zipBtn = (page: Page) =>
  page.getByRole('button', { name: 'Download all 3 files as ZIP' });

test('AC1-4,9: one ZIP, de-duplicated and UTF-8 names, same bytes', async ({
  page,
}) => {
  const files = [
    mk('scan.pdf', 'first'),
    mk('scan.pdf', 'second'),
    mk('relatório.pdf', 'third'),
  ];
  await page.goto('/demo');
  await page.locator('.dropzone').waitFor();
  await page.locator('input[type=file]').setInputFiles(files);
  await page.getByRole('button', { name: 'Copy files' }).click();
  await page.getByRole('heading', { name: 'Done' }).waitFor();
  const [d] = await Promise.all([
    page.waitForEvent('download'),
    zipBtn(page).click(),
  ]);
  expect(d.suggestedFilename()).toBe('staple-demo.zip');
  const raw = readFileSync((await d.path()) as string);
  const entries = readZip(raw);
  expect(entries.map((e) => e.name)).toEqual([
    'scan.pdf',
    'scan (2).pdf',
    'relatório.pdf',
  ]);
  expect(entries.map((e) => e.data.toString())).toEqual([
    'first',
    'second',
    'third',
  ]);
  expect(entries.every((e) => (e.flags & 0x0800) !== 0)).toBe(true);
  const sum = files.reduce((n, f) => n + f.buffer.length, 0);
  expect(raw.length).toBeLessThanOrEqual(sum + 1024 * files.length);
  await expect(zipBtn(page)).toBeEnabled(); // AC7: usable again
});

test('AC1: no ZIP button for a single output', async ({ page }) => {
  await run(page, [[mk('a.pdf', 'x')]]);
  await expect(page.locator('.result-zip')).toHaveCount(0);
});

test('AC8: keyboard reach, focus ring, Enter and Space', async ({ page }) => {
  await run(page, [[mk('a.pdf', 'x'), mk('b.pdf', 'y'), mk('c.pdf', 'z')]]);
  await page.keyboard.press('Tab');
  await expect(zipBtn(page)).toBeFocused();
  const w = await zipBtn(page).evaluate(
    (e) => getComputedStyle(e).outlineWidth,
  );
  expect(parseFloat(w)).toBeGreaterThan(0);
  for (const key of ['Enter', 'Space']) {
    const [d] = await Promise.all([
      page.waitForEvent('download'),
      page.keyboard.press(key),
    ]);
    expect(d.suggestedFilename()).toBe('staple-demo.zip');
    await expect(zipBtn(page)).toBeEnabled();
    await expect(zipBtn(page)).toBeFocused();
  }
});

import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const errors: string[] = [];
test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
});
test.afterEach(() => expect(errors).toEqual([]));

const bytesA = Buffer.from('hello result A');
const files = [
  { name: 'a.txt', mimeType: 'text/plain', buffer: bytesA },
  { name: 'b.txt', mimeType: 'text/plain', buffer: Buffer.from('second') },
];
async function run(page: Page, fs = files) {
  await page.goto('/demo');
  await page.locator('.dropzone').waitFor();
  await page.locator('input[type=file]').setInputFiles(fs);
  await page.getByRole('button', { name: 'Copy files' }).click();
  await page.getByRole('heading', { name: 'Done' }).waitFor();
}

test('AC1,3,6,9: cards, focus and live region', async ({ page }) => {
  await run(page);
  await expect(page.locator('h2')).toBeFocused();
  await expect(page.locator('.results [role=status]')).toHaveText(
    'Done: 2 files ready',
  );
  const cards = page.locator('.result-card');
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toContainText('a.txt');
  await expect(cards.nth(0)).toContainText('14 B');
  await expect(cards.nth(0)).toContainText('Same size');
  await expect(cards.nth(1)).toContainText('b.txt');
  await expect(
    page.locator('.result-card').getByRole('button', { name: /^Download / }),
  ).toHaveCount(2);
});

test('AC4,5: download name and bytes, twice, under the real CSP', async ({
  page,
}) => {
  await run(page);
  const btn = page.getByRole('button', { name: 'Download a.txt' });
  for (let i = 0; i < 2; i++) {
    const [d] = await Promise.all([page.waitForEvent('download'), btn.click()]);
    expect(d.suggestedFilename()).toBe('a.txt');
    expect(readFileSync((await d.path()) as string)).toEqual(bytesA);
  }
});

test('AC7: keyboard reach, focus ring, Enter/Space', async ({ page }) => {
  await run(page);
  const names = [
    'Download all 2 files as ZIP',
    'Download a.txt',
    'Download b.txt',
    'Start over',
  ];
  for (const n of names) {
    await page.keyboard.press('Tab');
    const b = page.getByRole('button', { name: n });
    await expect(b).toBeFocused();
    const w = await b.evaluate((e) => getComputedStyle(e).outlineWidth);
    expect(parseFloat(w)).toBeGreaterThan(0);
  }
  await page.getByRole('button', { name: 'Download a.txt' }).focus();
  for (const key of ['Enter', 'Space']) {
    const [d] = await Promise.all([
      page.waitForEvent('download'),
      page.keyboard.press(key),
    ]);
    expect(d.suggestedFilename()).toBe('a.txt');
  }
});

test('AC8: start over resets to the input step', async ({ page }) => {
  await run(page);
  await page.getByRole('button', { name: 'Start over' }).click();
  await expect(page.locator('.results')).toHaveCount(0);
  await expect(page.locator('.file-list li')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Choose files' }),
  ).toBeFocused();
});

test('single file still has Download', async ({ page }) => {
  await run(page, files.slice(0, 1));
  await expect(
    page.getByRole('button', { name: 'Download a.txt' }),
  ).toBeVisible();
  await expect(page.locator('.results [role=status]')).toHaveText(
    'Done: 1 file ready',
  );
});

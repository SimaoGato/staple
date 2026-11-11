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

// Drops `names` as 1 MB files (16 progress callbacks each), first byte = index.
async function drop(page: Page, names: string[]) {
  const dataTransfer = await page.evaluateHandle((ns) => {
    const dt = new DataTransfer();
    ns.forEach((n, i) => {
      const b = new Uint8Array(1 << 20);
      b[0] = i + 1;
      dt.items.add(new File([b], n));
    });
    return dt;
  }, names);
  await page.dispatchEvent('.dropzone', 'drop', { dataTransfer });
}
const open = async (page: Page, delay = 100) => {
  await page.goto(`/demo?delay=${delay}`);
  await page.locator('.dropzone').waitFor();
};
const startBtn = (p: Page) => p.getByRole('button', { name: 'Copy files' });
const cancelBtn = (p: Page) => p.getByRole('button', { name: 'Cancel' });
const live = (p: Page) => p.locator('.flow-live');
const cancelledText = 'Cancelled. Your files are still selected.';

test('AC1,2,3,10: run three files in order with monotonic progress', async ({
  page,
}) => {
  await open(page, 20);
  await expect(startBtn(page)).toBeDisabled();
  await drop(page, ['a.pdf', 'b.pdf', 'c.pdf']);
  await expect(startBtn(page)).toBeEnabled();
  await page.evaluate(() => {
    const w = window as unknown as { seen: number[]; texts: string[] };
    w.seen = [];
    w.texts = [];
    const bar = document.querySelector('progress')!;
    const status = document.querySelector('.flow-status')!;
    const live = document.querySelector('.flow-live')!;
    new MutationObserver(() => w.seen.push(bar.value)).observe(bar, {
      attributes: true,
    });
    new MutationObserver(() => w.texts.push(live.textContent ?? '')).observe(
      live,
      { childList: true, characterData: true, subtree: true },
    );
    setInterval(() => w.seen.push(bar.value), 5);
    void status;
  });
  await startBtn(page).click();
  await expect(startBtn(page)).toBeHidden();
  await expect(cancelBtn(page)).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Choose files' }),
  ).toBeDisabled();
  await expect(page.locator('.file-list button').first()).toBeDisabled();
  await expect(
    page.getByRole('progressbar', { name: 'Progress' }),
  ).toBeVisible();
  await expect(live(page)).toHaveText('Done.');
  const r = await page.evaluate(() => {
    const w = window as unknown as {
      seen: number[];
      texts: string[];
      stapleOutputs: { name: string; inputSize: number; bytes: Uint8Array }[];
    };
    return {
      seen: w.seen,
      texts: [...new Set(w.texts.filter(Boolean))],
      outs: w.stapleOutputs.map((o) => [
        o.name,
        o.inputSize,
        o.bytes.length,
        o.bytes[0],
      ]),
    };
  });
  expect(r.seen).toEqual([...r.seen].sort((a, b) => a - b));
  expect(r.seen.at(-1)).toBe(100);
  expect(r.texts).toEqual([
    'Processing a.pdf (1 of 3)',
    'Processing b.pdf (2 of 3)',
    'Processing c.pdf (3 of 3)',
    'Done.',
  ]);
  expect(r.outs).toEqual([
    ['a.pdf', 1 << 20, 1 << 20, 1],
    ['b.pdf', 1 << 20, 1 << 20, 2],
    ['c.pdf', 1 << 20, 1 << 20, 3],
  ]);
  await expect(page.locator('.results')).toBeVisible(); // result step replaces the input
});

test('AC4: page stays responsive during a run', async ({ page }) => {
  await open(page);
  await drop(page, ['a.pdf']);
  await startBtn(page).click();
  await expect(cancelBtn(page)).toBeVisible();
  const toggle = page.getByRole('button', { name: 'Dark' });
  const t0 = Date.now();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true', {
    timeout: 200,
  });
  expect(Date.now() - t0).toBeLessThan(500);
  await cancelBtn(page).click();
});

test('AC5,6,7: cancel stops fast, keeps files, restart works', async ({
  page,
}) => {
  await open(page);
  await drop(page, ['a.pdf', 'b.pdf', 'c.pdf']);
  await startBtn(page).click();
  await expect(page.locator('.flow-status')).toHaveText(
    'Processing a.pdf (1 of 3)',
  );
  await page.waitForTimeout(300);
  const t0 = Date.now();
  await cancelBtn(page).click();
  await expect(page.locator('.flow-status')).toHaveText(cancelledText);
  expect(Date.now() - t0).toBeLessThan(500);
  await expect(live(page)).toHaveText(cancelledText);
  await expect(startBtn(page)).toBeFocused();
  await expect(page.locator('.file-name')).toHaveCount(3);
  await expect(
    page.getByRole('button', { name: 'Choose files' }),
  ).toBeEnabled();
  await expect(cancelBtn(page)).toBeHidden();
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => 'stapleOutputs' in window)).toBe(false);
  // restart: fresh worker, all three files from the first
  await open(page, 0);
  await drop(page, ['a.pdf', 'b.pdf', 'c.pdf']);
  await startBtn(page).click();
  await expect(live(page)).toHaveText('Done.');
  expect(
    await page.evaluate(() =>
      (
        window as unknown as { stapleOutputs: { name: string }[] }
      ).stapleOutputs.map((o) => o.name),
    ),
  ).toEqual(['a.pdf', 'b.pdf', 'c.pdf']);
});

test('AC6: start again after cancel in the same page', async ({ page }) => {
  await open(page, 20);
  await drop(page, ['a.pdf', 'b.pdf']);
  await startBtn(page).click();
  await cancelBtn(page).click();
  await expect(startBtn(page)).toBeFocused();
  await startBtn(page).click();
  await expect(live(page)).toHaveText('Done.');
  expect(
    await page.evaluate(() =>
      (
        window as unknown as { stapleOutputs: { name: string }[] }
      ).stapleOutputs.map((o) => o.name),
    ),
  ).toEqual(['a.pdf', 'b.pdf']);
});

test('AC8: keyboard only start and cancel', async ({ page }) => {
  await open(page);
  await drop(page, ['a.pdf']);
  await startBtn(page).focus();
  await page.keyboard.press('Enter');
  await expect(cancelBtn(page)).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.locator('.flow-status')).toHaveText(cancelledText);
  await expect(startBtn(page)).toBeFocused();
});

test('AC9: leaving the page cancels the run', async ({ page }) => {
  await open(page);
  await drop(page, ['a.pdf']);
  await startBtn(page).click();
  await expect(cancelBtn(page)).toBeVisible();
  await page.getByRole('link', { name: 'Staple' }).first().click();
  await expect(page).toHaveURL('/');
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => 'stapleOutputs' in window)).toBe(false);
  await page.goBack();
  await page.locator('.dropzone').waitFor();
  await expect(startBtn(page)).toBeDisabled();
});

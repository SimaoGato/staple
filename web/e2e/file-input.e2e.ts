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

// Dispatches a drop with real File objects on `selector`.
async function drop(page: Page, selector: string, names: [string, string][]) {
  const dataTransfer = await page.evaluateHandle((items) => {
    const dt = new DataTransfer();
    for (const [n, type] of items) dt.items.add(new File(['x'], n, { type }));
    return dt;
  }, names);
  await page.dispatchEvent(selector, 'drop', { dataTransfer });
}
const zone = '.dropzone';
const items = (page: Page) => page.locator('.file-name');

test('AC1: visible Choose files button opens a filtered picker', async ({
  page,
}) => {
  await page.goto('/demo?pdf');
  const btn = page.getByRole('button', { name: 'Choose files' });
  await expect(btn).toBeVisible();
  const chooser = page.waitForEvent('filechooser');
  await btn.click();
  expect((await chooser).isMultiple()).toBe(true);
  await expect(page.locator('input[type=file]')).toHaveAttribute(
    'accept',
    '.pdf,application/pdf',
  );
  await page.goto('/demo?single');
  await expect(
    page.getByRole('button', { name: 'Choose a file' }),
  ).toBeVisible();
  await expect(page.locator('input[type=file]')).not.toHaveAttribute(
    'multiple',
  );
});

test('AC2: three files in order, then appended', async ({ page }) => {
  await page.goto('/demo');
  await drop(page, zone, [
    ['c.txt', ''],
    ['a.txt', ''],
    ['b.txt', ''],
  ]);
  await expect(items(page)).toHaveText(['c.txt', 'a.txt', 'b.txt']);
  await page.locator('input[type=file]').setInputFiles({
    name: 'd.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('x'),
  });
  await expect(items(page)).toHaveText(['c.txt', 'a.txt', 'b.txt', 'd.txt']);
});

test('AC3: single file tool', async ({ page }) => {
  await page.goto('/demo?single');
  await drop(page, zone, [
    ['a.txt', ''],
    ['b.txt', ''],
  ]);
  await expect(items(page)).toHaveText(['a.txt']);
  await expect(page.locator('.flow-error')).toHaveText(
    'This tool takes one file at a time. Using a.txt.',
  );
  await drop(page, zone, [['c.txt', '']]);
  await expect(items(page)).toHaveText(['c.txt']);
});

test('AC4/9: pdf and png together', async ({ page }) => {
  await page.goto('/demo?pdf');
  await drop(page, zone, [
    ['a.pdf', ''],
    ['photo.png', 'image/png'],
  ]);
  await expect(items(page)).toHaveText(['a.pdf']);
  await expect(page.locator('.flow-error')).toHaveText(
    'photo.png is not a supported file type.',
  );
  await expect(page.getByRole('status')).toHaveText(
    /1 file added.*photo\.png is not a supported file type\./,
  );
});

test('remove clears a stale error', async ({ page }) => {
  await page.goto('/demo?pdf');
  await drop(page, zone, [
    ['a.pdf', ''],
    ['photo.png', 'image/png'],
  ]);
  await expect(page.locator('.flow-error')).not.toBeEmpty();
  await page.getByRole('button', { name: 'Remove a.pdf' }).click();
  await expect(page.locator('.flow-error')).toBeEmpty();
});

test('drag between children keeps drag-over state', async ({ page }) => {
  await page.goto('/demo');
  await page.dispatchEvent(zone, 'dragenter');
  await page.dispatchEvent('.dropzone .choose', 'dragenter');
  await page.dispatchEvent(zone, 'dragleave'); // null relatedTarget, as Safari sends
  await expect(page.locator(zone)).toHaveClass(/dragover/);
  await page.dispatchEvent('.dropzone .choose', 'dragleave');
  await expect(page.locator(zone)).not.toHaveClass(/dragover/);
});

test('AC5: drag-over state', async ({ page }) => {
  await page.goto('/demo');
  await page.dispatchEvent(zone, 'dragenter');
  await expect(page.locator(zone)).toHaveClass(/dragover/);
  await page.dispatchEvent(zone, 'dragleave');
  await expect(page.locator(zone)).not.toHaveClass(/dragover/);
  await page.dispatchEvent(zone, 'dragenter');
  await drop(page, zone, [['a.txt', '']]);
  await expect(page.locator(zone)).not.toHaveClass(/dragover/);
});

test('AC6: drop outside the zone is prevented', async ({ page }) => {
  await page.goto('/demo');
  const prevented = await page.evaluate(() => {
    const ev = new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      dataTransfer: new DataTransfer(),
    });
    document.querySelector('h1')!.dispatchEvent(ev);
    return ev.defaultPrevented;
  });
  expect(prevented).toBe(true);
  expect(new URL(page.url()).pathname).toBe('/demo');
});

test('AC7/9: remove moves focus and announces', async ({ page }) => {
  await page.goto('/demo');
  await drop(page, zone, [
    ['a', ''],
    ['b', ''],
  ]);
  await page.getByRole('button', { name: 'Remove a' }).click();
  await expect(page.getByRole('button', { name: 'Remove b' })).toBeFocused();
  await expect(page.getByRole('status')).toHaveText('a removed');
  await page.getByRole('button', { name: 'Remove b' }).click();
  await expect(
    page.getByRole('button', { name: 'Choose files' }),
  ).toBeFocused();
});

test('AC8: keyboard reaches picker and remove buttons with a focus ring', async ({
  page,
}) => {
  await page.goto('/demo');
  await drop(page, zone, [['a', '']]);
  const choose = page.getByRole('button', { name: 'Choose files' });
  const remove = page.getByRole('button', { name: 'Remove a' });
  for (const btn of [choose, remove]) {
    for (
      let i = 0;
      i < 10 && !(await btn.evaluate((e) => e === document.activeElement));
      i++
    )
      await page.keyboard.press('Tab');
    await expect(btn).toBeFocused();
    // The browser default ring is `auto`; `solid` only comes from our rule.
    const ring = await btn.evaluate((e) => {
      const c = getComputedStyle(e);
      return [c.outlineStyle, parseFloat(c.outlineWidth)] as const;
    });
    expect(ring[0]).toBe('solid');
    expect(ring[1]).toBeGreaterThan(0);
  }
  await choose.focus();
  const chooser = page.waitForEvent('filechooser');
  await page.keyboard.press('Enter');
  await chooser;
  const chooser2 = page.waitForEvent('filechooser');
  await page.keyboard.press('Space');
  await chooser2;
});

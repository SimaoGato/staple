import { expect, test } from '@playwright/test';

// Collect console errors (includes CSP violations) and page errors; asserted per test.
const errors: string[] = [];
test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console error: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(String(e)));
});

const THEMES = [
  ['light', 'rgb(29, 78, 216)', 'rgb(255, 255, 255)'],
  ['dark', 'rgb(96, 165, 250)', 'rgb(18, 18, 18)'],
] as const;

for (const [scheme, accent, ground] of THEMES) {
  test(`AC3-5: ${scheme} theme colours, focus ring, no inline styles`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/');
    await expect(page.locator('body')).toHaveCSS('background-color', ground);
    await page.keyboard.press('Tab');
    const link = page.getByRole('link').first();
    await expect(link).toBeFocused();
    await expect(link).toHaveCSS('outline-style', 'solid');
    await expect(link).toHaveCSS('outline-width', '3px');
    await expect(link).toHaveCSS('outline-color', accent);
    expect(await page.locator('style, [style]').count()).toBe(0);
    expect(errors).toEqual([]);
  });
}

const toggle = (page: import('@playwright/test').Page, name: string) =>
  page.getByRole('group', { name: 'Theme' }).getByRole('button', { name });

test('AC1-2: header toggle on every route, System default follows OS', async ({
  page,
}) => {
  for (const path of ['/', '/compress', '/nope']) {
    await page.goto(path);
    await expect(page.getByRole('group', { name: 'Theme' })).toHaveCount(1);
  }
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(toggle(page, 'System')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    'rgb(18, 18, 18)',
  );
});

test('AC3-4: choice overrides OS, persists, System clears and follows OS live', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await toggle(page, 'Dark').click();
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    'rgb(18, 18, 18)',
  );
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
  await page.reload();
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    'rgb(18, 18, 18)',
  );
  await page.getByRole('link', { name: 'Compress' }).click();
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    'rgb(18, 18, 18)',
  );
  await toggle(page, 'System').click();
  expect(
    await page.evaluate(() => localStorage.getItem('staple-theme')),
  ).toBeNull();
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    'rgb(255, 255, 255)',
  );
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    'rgb(18, 18, 18)',
  );
});

test('AC5: stored dark is set before first paint on a light OS', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => {
    localStorage.setItem('staple-theme', 'dark');
    (window as unknown as { seen: string[] }).seen = [];
    new MutationObserver(() => {
      const w = window as unknown as { seen: string[] };
      w.seen.push(document.documentElement.dataset.theme ?? '');
    }).observe(document.documentElement, { attributes: true });
  });
  await page.goto('/');
  const seen = await page.evaluate(
    () => (window as unknown as { seen: string[] }).seen,
  );
  expect(seen).not.toContain('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('AC6: keyboard operation and focus ring', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const light = toggle(page, 'System');
  await expect(light).toBeFocused();
  await expect(light).toHaveCSS('outline-style', 'solid');
  await expect(light).toHaveCSS('outline-width', '3px');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space');
  await expect(toggle(page, 'Light')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(toggle(page, 'Dark')).toHaveAttribute('aria-pressed', 'true');
});

test('AC7: throwing storage still works, no CSP errors', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('blocked');
      },
    });
  });
  await page.goto('/');
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    'rgb(18, 18, 18)',
  );
  await toggle(page, 'Light').click();
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    'rgb(255, 255, 255)',
  );
  expect(await page.locator('style, [style]').count()).toBe(0);
  expect(errors).toEqual([]);
});

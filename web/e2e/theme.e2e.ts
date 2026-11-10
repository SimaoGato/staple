import { expect, test } from '@playwright/test';

// Fail any test that logs a console error (includes CSP violations) or throws.
test.beforeEach(({ page }) => {
  page.on('console', (m) => {
    if (m.type() === 'error') throw new Error(`console error: ${m.text()}`);
  });
  page.on('pageerror', (e) => {
    throw e;
  });
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
  });
}

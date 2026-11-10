import { expect, test } from '@playwright/test';

const TOOLS = ['/compress', '/merge', '/split', '/convert', '/resize'];
const BANNER = 'Your files are processed on this device and never uploaded.';

const errors: string[] = [];
test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
});

for (const path of ['/', '/compress', '/no-such-tool']) {
  test(`AC1/3: landmarks and banner on ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();
    await expect(page.getByText(BANNER)).toBeVisible();
    await expect(page.locator('header a')).toHaveAttribute('href', '/');
    await expect(page.locator('header a')).toHaveText('Staple');
  });
}

const cards = (page: import('@playwright/test').Page) =>
  page.locator('nav a.card');

for (const width of [1024, 1920]) {
  test(`AC4: five cards in one row at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    const boxes = await cards(page).evaluateAll((els) =>
      els.map((e) => e.getBoundingClientRect().y),
    );
    expect(boxes).toHaveLength(5);
    expect(new Set(boxes).size).toBe(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test('AC4: cards stack as full-width rows at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/');
  const boxes = await cards(page).evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width };
    }),
  );
  expect(boxes).toHaveLength(5);
  for (const [i, b] of boxes.entries()) {
    expect(b.x).toBe(boxes[0].x);
    expect(b.w).toBe(boxes[0].w);
    expect(b.w).toBeGreaterThan(300);
    if (i) expect(b.y).toBeGreaterThan(boxes[i - 1].y);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('AC4: cards wrap to two rows at 768px, stack at the 40rem edge', async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 800 });
  await page.goto('/');
  const ys = await cards(page).evaluateAll((els) =>
    els.map((e) => e.getBoundingClientRect().y),
  );
  expect(new Set(ys).size).toBe(2);
  await page.setViewportSize({ width: 640, height: 800 });
  const ys2 = await cards(page).evaluateAll((els) =>
    els.map((e) => e.getBoundingClientRect().y),
  );
  expect(new Set(ys2).size).toBe(5);
});

test('AC6: focus ring stays inside the stacked list at 390px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/');
  for (const path of [TOOLS[0], TOOLS[4]]) {
    const c = page.locator(`nav a[href="${path}"]`);
    await c.focus();
    await expect(c).toHaveCSS('outline-offset', '-3px');
  }
});

test('home layout does not leak to tool pages', async ({ page }) => {
  await page.goto('/compress');
  await expect(page.locator('main > h1')).toHaveCSS('text-align', 'start');
});

test('AC5: card descriptions are at least 15px', async ({ page }) => {
  await page.goto('/');
  const sizes = await page
    .locator('.card-desc')
    .evaluateAll((els) =>
      els.map((e) => parseFloat(getComputedStyle(e).fontSize)),
    );
  expect(sizes).toHaveLength(5);
  for (const s of sizes) expect(s).toBeGreaterThanOrEqual(15);
});

test('AC6: Tab order, focus ring, Enter opens a card', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.locator('header a')).toBeFocused();
  for (let n = 0; n < 3; n++) await page.keyboard.press('Tab'); // theme buttons
  for (const path of TOOLS) {
    await page.keyboard.press('Tab');
    const c = page.locator(`nav a[href="${path}"]`);
    await expect(c).toBeFocused();
    await expect(c).toHaveCSS('outline-width', '3px');
  }
  await page.keyboard.press('Tab');
  await expect(page.locator('footer a')).toBeFocused();
  await page.goto('/');
  await page.locator('nav a[href="/merge"]').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/merge');
});

test('AC7: no CSP errors or inline styles', async ({ page }) => {
  await page.goto('/');
  expect(await page.locator('style, [style]').count()).toBe(0);
  expect(errors).toEqual([]);
});

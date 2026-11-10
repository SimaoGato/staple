import { expect, test, type Page } from '@playwright/test';

const TOOLS = [
  ['Compress', '/compress'],
  ['Merge', '/merge'],
  ['Split', '/split'],
  ['Convert', '/convert'],
  ['Resize', '/resize'],
] as const;

const heading = (page: Page) => page.getByRole('heading', { level: 1 });

// Fail any test that logs a console error or throws in the page.
test.beforeEach(({ page }) => {
  page.on('console', (m) => {
    if (m.type() === 'error') throw new Error(`console error: ${m.text()}`);
  });
  page.on('pageerror', (e) => {
    throw e;
  });
});

test('AC1: home shows the title and five tool links', async ({ page }) => {
  await page.goto('/');
  await expect(heading(page)).toHaveText('Staple');
  await expect(page).toHaveTitle('Staple');
  const links = page.getByRole('navigation').getByRole('link');
  await expect(links).toHaveText(TOOLS.map(([name]) => name));
  for (const [name, path] of TOOLS)
    await expect(page.getByRole('link', { name })).toHaveAttribute(
      'href',
      path,
    );
});

test('AC2: each link opens its tool page', async ({ page }) => {
  await page.goto('/');
  for (const [name, path] of TOOLS) {
    await page.getByRole('link', { name }).click();
    await expect(page).toHaveURL(path);
    await expect(heading(page)).toHaveText(name);
    await expect(page).toHaveTitle(`${name} - Staple`);
    await page.getByRole('link', { name: 'Home' }).click();
    await expect(heading(page)).toHaveText('Staple');
  }
});

for (const [name, path] of TOOLS) {
  test(`AC3: deep link and reload on ${path}`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(heading(page)).toHaveText(name);
    await page.reload();
    await expect(heading(page)).toHaveText(name);
  });
}

test('AC4: unknown path shows not found and links home', async ({ page }) => {
  await page.goto('/no-such-tool');
  await expect(heading(page)).toHaveText('Page not found');
  await page.getByRole('link', { name: 'Back to home' }).click();
  await expect(page).toHaveURL('/');
  await expect(heading(page)).toHaveText('Staple');
});

test('AC6: keyboard reaches every link with a visible focus ring and Enter opens it', async ({
  page,
}) => {
  for (const [i, [name, path]] of TOOLS.entries()) {
    await page.goto('/');
    for (let n = 0; n <= i; n++) await page.keyboard.press('Tab');
    const link = page.getByRole('link', { name });
    await expect(link).toBeFocused();
    await expect(link).toHaveCSS('outline-style', 'solid');
    await expect(link).toHaveCSS('outline-width', '3px');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(path);
    await expect(heading(page)).toBeFocused();
  }
});

test('back and forward re-render and move focus to the heading', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Split' }).click();
  await page.goBack();
  await expect(heading(page)).toHaveText('Staple');
  await expect(heading(page)).toBeFocused();
  await page.goForward();
  await expect(heading(page)).toHaveText('Split');
  await expect(heading(page)).toBeFocused();
});

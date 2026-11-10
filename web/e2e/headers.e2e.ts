import { expect, test } from '@playwright/test';

const CSP = [
  "default-src 'self'",
  "connect-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
];

for (const path of ['/', '/merge']) {
  test(`${path}: CSP, COOP, COEP and isolation`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    const h = res?.headers() ?? {};
    const directives = (h['content-security-policy'] ?? '')
      .split(';')
      .map((d) => d.trim());
    for (const d of CSP) expect(directives).toContain(d);
    expect(h['content-security-policy']).not.toMatch(
      /'unsafe-inline'|'unsafe-eval'/,
    );
    expect(h['cross-origin-opener-policy']).toBe('same-origin');
    expect(h['cross-origin-embedder-policy']).toBe('require-corp');
    expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
}

test('CSP blocks fetch to another origin', async ({ page }) => {
  await page.goto('/');
  const blocked = await page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        document.addEventListener('securitypolicyviolation', (e) =>
          resolve(e.violatedDirective),
        );
        fetch('https://example.com').catch(() => undefined);
      }),
  );
  expect(blocked).toBe('connect-src');
});

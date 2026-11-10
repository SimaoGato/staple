import { expect, test } from '@playwright/test';

test.beforeEach(({ page }) => {
  page.on('console', (m) => {
    if (m.type() === 'error') throw new Error(`console error: ${m.text()}`);
  });
  page.on('pageerror', (e) => {
    throw e;
  });
});

// FNV-1a 32-bit of "foobar".
const FOOBAR = [102, 111, 111, 98, 97, 114];

test('worker runs the core off the main thread, lazily', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __wasmCalls: number };
    w.__wasmCalls = 0;
    for (const k of [
      'instantiate',
      'instantiateStreaming',
      'compile',
    ] as const) {
      const orig = WebAssembly[k] as (...a: unknown[]) => unknown;
      (WebAssembly as unknown as Record<string, unknown>)[k] = (
        ...a: unknown[]
      ) => {
        w.__wasmCalls++;
        return orig.apply(WebAssembly, a);
      };
    }
  });
  const wasmResponses: string[] = [];
  page.on('response', (r) => {
    if (r.url().endsWith('.wasm'))
      wasmResponses.push(r.headers()['content-type'] ?? '');
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(wasmResponses).toEqual([]); // lazy: not downloaded on home

  const ok = await page.evaluate(async (bytes) => {
    const progress: number[] = [];
    const r = await window.staple.runDemo(new Uint8Array(bytes), (p) =>
      progress.push(p),
    );
    return { r, progress };
  }, FOOBAR);
  expect(ok.r).toEqual({ byteCount: 6, checksum: 0xbf9cf968 });
  expect(ok.progress[0]).toBe(0);
  expect(ok.progress.at(-1)).toBe(100);
  expect(ok.progress).toEqual([...ok.progress].sort((a, b) => a - b));
  expect(wasmResponses).toEqual(['application/wasm']);

  const code = await page.evaluate(() =>
    window.staple.runDemo(new Uint8Array(0)).then(
      () => 'resolved',
      (e: { code: string }) => e.code,
    ),
  );
  expect(code).toBe('empty_input');

  expect(
    await page.evaluate(
      () => (window as unknown as { __wasmCalls: number }).__wasmCalls,
    ),
  ).toBe(0);
});

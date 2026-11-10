import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

// 50-page reference PDF (Spec::default().image_pages == 50), written by `gen-refset`.
const REF = join(
  import.meta.dirname,
  '../../bench/refset/image-heavy-20mb.pdf',
);
const have = existsSync(REF);
if (!have && process.env.CI)
  throw new Error(`${REF} missing: CI must run gen-refset first`);
test.skip(
  !have,
  'run `cargo run -p staple-bench --release --bin gen-refset` first',
);

type Hook = {
  pdfiumRenderPage(
    bytes: Uint8Array,
    index: number,
    dpi: number,
    all?: boolean,
  ): Promise<{
    pageCount: number;
    width: number;
    height: number;
    nonBlank: boolean;
    loadMs: number;
    openMs: number;
    pageMs: number[];
  }>;
};

// Throwing inside an event callback does not fail a Playwright test: collect, assert in afterEach.
let errors: string[] = [];
test.beforeEach(({ page }) => {
  errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console error: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
});
test.afterEach(() => {
  expect(errors).toEqual([]);
});

// base64 over evaluate: a 20 MB number[] would be a 20M-element JSON array.
const bytes = () => readFileSync(REF).toString('base64');

test('home requests no PDFium before the hook is called', async ({ page }) => {
  const urls: string[] = [];
  page.on('request', (r) => urls.push(r.url()));
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(urls.filter((u) => /pdfium/i.test(u))).toEqual([]);
});

test('worker renders page 1 of the 50-page PDF with PDFium under the CSP', async ({
  page,
}) => {
  const violations: string[] = [];
  await page.exposeFunction('__csp', (v: string) => violations.push(v));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) =>
      (window as unknown as { __csp(v: string): void }).__csp(
        `${e.violatedDirective} ${e.blockedURI}`,
      ),
    );
  });
  await page.goto('/');
  const r = await page.evaluate(async (b) => {
    const w = window as unknown as { staple: Hook };
    return w.staple.pdfiumRenderPage(
      Uint8Array.from(atob(b), (c) => c.charCodeAt(0)),
      0,
      96,
    );
  }, bytes());
  expect(r.pageCount).toBe(50);
  expect(r.width).toBeGreaterThan(100);
  expect(r.height).toBeGreaterThan(100);
  expect(r.nonBlank).toBe(true);
  expect(violations).toEqual([]);
});

// Measurements for docs/decisions/D-1-pdfium-wasm.md (not a gate): PDFIUM_SPIKE=1.
const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length % 2
    ? s[(s.length - 1) / 2]
    : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

test.describe('measure', () => {
  test.skip(!process.env.PDFIUM_SPIKE, 'set PDFIUM_SPIKE=1');
  test.setTimeout(600_000);
  const RUNS = 5;

  async function call(
    page: import('@playwright/test').Page,
    b64: string,
    dpi: number,
    all: boolean,
  ) {
    return page.evaluate(
      async ([b, d, a]) => {
        const w = window as unknown as { staple: Hook };
        return w.staple.pdfiumRenderPage(
          Uint8Array.from(atob(b as string), (c) => c.charCodeAt(0)),
          0,
          d as number,
          a as boolean,
        );
      },
      [b64, dpi, all] as const,
    );
  }

  test('load time cold and warm, render time per page', async ({
    browser,
    page,
  }) => {
    const b64 = bytes();
    const cold: number[] = [];
    for (let i = 0; i < RUNS; i++) {
      const ctx = await browser.newContext();
      const p = await ctx.newPage();
      await (
        await ctx.newCDPSession(p)
      ).send('Network.setCacheDisabled', { cacheDisabled: true });
      await p.goto('/');
      cold.push((await call(p, b64, 96, false)).loadMs);
      await ctx.close();
    }
    const warm: number[] = [];
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto('/');
    await call(p, b64, 96, false); // primes the HTTP and wasm code caches
    for (let i = 0; i < RUNS; i++) {
      await p.reload();
      warm.push((await call(p, b64, 96, false)).loadMs);
    }
    await ctx.close();

    await page.goto('/');
    await call(page, b64, 96, false); // load once; not part of the render timing
    const render: Record<
      number,
      { median: number; total: number; open: number }
    > = {};
    for (const dpi of [96, 150]) {
      const r = await call(page, b64, dpi, true);
      render[dpi] = {
        median: median(r.pageMs),
        total: r.pageMs.reduce((a, c) => a + c, 0),
        open: r.openMs,
      };
    }
    console.log(
      'PDFIUM_SPIKE ' +
        JSON.stringify({
          chrome: browser.version(),
          runs: RUNS,
          coldMs: cold,
          coldMedian: median(cold),
          warmMs: warm,
          warmMedian: median(warm),
          render,
        }),
    );
  });
});

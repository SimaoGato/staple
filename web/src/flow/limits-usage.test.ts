import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as limits from '../limits';
import { createInput } from './input';

vi.mock('../limits', async (orig) => {
  const real = await orig<typeof import('../limits')>();
  return { ...real, checkAdd: vi.fn(real.checkAdd) };
});

const f = (n: string) => new File(['x'], n);
let cur: ReturnType<typeof createInput>;
beforeEach(() => {
  vi.mocked(limits.checkAdd).mockClear();
  cur = createInput({ accept: [], mimes: [], multiple: true });
});
afterEach(() => cur.destroy());

describe('checkAdd usage (AC10)', () => {
  it('one call per drop, even with several files', () => {
    const ev = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'dataTransfer', {
      value: { files: [f('a'), f('b')] },
    });
    cur.el.querySelector('.dropzone')!.dispatchEvent(ev);
    expect(limits.checkAdd).toHaveBeenCalledTimes(1);
  });
  it('one call per picker change', () => {
    const i = cur.el.querySelector('input')!;
    Object.defineProperty(i, 'files', { value: [f('a')], configurable: true });
    i.dispatchEvent(new Event('change'));
    expect(limits.checkAdd).toHaveBeenCalledTimes(1);
  });
});

const raw = import.meta.glob<string>(
  [
    './*.ts',
    '../**/*.ts',
    '!../**/*.test.ts',
    '!../wasm-pkg/**',
    '!../pdfium-pkg/**',
  ],
  {
    query: '?raw',
    import: 'default',
    eager: true,
  },
);
const inFlow = Object.entries(raw).filter(([p]) => p.startsWith('./'));
const outside = Object.entries(raw).filter(
  ([p]) => !p.startsWith('./') && !p.endsWith('/limits.ts'),
);
const count = (s: string, re: RegExp) => s.match(re)?.length ?? 0;

describe('size and count checks live only in limits.ts', () => {
  it('flow/ has exactly the expected files', () => {
    expect(inFlow.map(([p]) => p).sort()).toEqual([
      './demo.ts',
      './format.ts',
      './input.ts',
      './spec.ts',
    ]);
  });
  it('flow/ reads .size once (input.ts, passed to formatSize) and compares no length', () => {
    const sizes = inFlow.map(([p, s]) => [p, count(s, /\.size\b/g)]);
    expect(sizes.filter(([, n]) => n !== 0)).toEqual([['./input.ts', 1]]);
    expect(
      inFlow.reduce((n, [, s]) => n + count(s, /\.length\s*[<>]=?/g), 0),
    ).toBe(0);
    expect(count(raw['./input.ts']!, /file\.size|f\.size/g)).toBe(1);
  });
  it('no other module compares a size', () => {
    expect(outside.length).toBeGreaterThan(5);
    expect(
      outside.reduce((n, [, s]) => n + count(s, /\.size\s*[<>]/g), 0),
    ).toBe(0);
  });
});

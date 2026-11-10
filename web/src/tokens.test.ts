import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(`${__dirname}/style.css`, 'utf8');
const darkStart = css.indexOf('@media (prefers-color-scheme: dark)');
const lightBlock = css.slice(css.indexOf(':root'), darkStart);
const darkBlock = css.slice(css.indexOf(':root', darkStart));

const vars = (block: string, end: number) =>
  Object.fromEntries(
    [...block.slice(0, end).matchAll(/^\s*(--[\w-]+):\s*(.+);$/gm)].map((m) => [
      m[1],
      m[2],
    ]),
  );
const light = vars(lightBlock, lightBlock.indexOf('}'));
const dark = vars(darkBlock, darkBlock.indexOf('}'));
const colours = (v: Record<string, string>) =>
  Object.keys(v).filter((k) => k.startsWith('--color-'));

const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) =>
    channel(parseInt(hex.slice(i, i + 2), 16)),
  );
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

describe('design tokens', () => {
  it('parses the expected token sets', () => {
    expect(colours(light)).toHaveLength(10);
    expect(Object.keys(light)).toContain('--font-sans');
    expect(Object.keys(light)).toContain('--radius-card');
    expect(Object.keys(light)).toContain('--space-4');
  });

  it('dark redefines every colour token', () => {
    expect(colours(dark).sort()).toEqual(colours(light).sort());
  });

  it('has no colour literals outside the token blocks', () => {
    const rest = css.replace(lightBlock, '').replace(darkBlock, '');
    expect(rest).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });

  for (const [name, v] of [
    ['light', light],
    ['dark', dark],
  ] as const) {
    describe(name, () => {
      const c = (k: string) => v[`--color-${k}`]!;
      const pairs: [string, string, number][] = [
        ['text', 'ground', 4.5],
        ['text', 'surface', 4.5],
        ['muted', 'ground', 4.5],
        ['muted', 'surface', 4.5],
        ['accent', 'ground', 4.5],
        ['accent', 'surface', 4.5],
        ['accent-hover', 'ground', 4.5],
        ['banner-text', 'banner-bg', 4.5],
        ['on-accent', 'accent', 4.5],
      ];
      for (const [fg, bg, min] of pairs)
        it(`${fg} on ${bg} >= ${min}`, () => {
          expect(ratio(c(fg), c(bg))).toBeGreaterThanOrEqual(min);
        });
    });
  }
});

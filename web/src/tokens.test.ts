import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(`${__dirname}/style.css`, 'utf8');
const rootRe = /:root\s*{([^}]*)}/g;
const darkRe =
  /@media \(prefers-color-scheme: dark\)\s*{\s*:root\s*{([^}]*)}\s*}/g;
const darkMatches = [...css.matchAll(darkRe)];
const lightCss = css.replace(darkRe, '');
const blocks = [...lightCss.matchAll(rootRe)].map((m) => m[1]!);
const vars = (block: string) =>
  Object.fromEntries(
    [...block.matchAll(/^\s*(--[\w-]+):\s*(.+);$/gm)].map((m) => [m[1], m[2]]),
  );
const light = vars(blocks[0] ?? '');
const dark = vars(darkMatches[0]?.[1] ?? '');
// Values from the STORY-07 design table.
const expected = {
  light: {
    ground: '#ffffff',
    surface: '#f8fafc',
    border: '#e2e8f0',
    text: '#0f172a',
    muted: '#475569',
    accent: '#1d4ed8',
    'accent-hover': '#1e3a8a',
    'banner-bg': '#eff4ff',
    'banner-text': '#1e3a8a',
    'on-accent': '#ffffff',
  },
  dark: {
    ground: '#121212',
    surface: '#1c1c1c',
    border: '#2a2a2a',
    text: '#f2f2f2',
    muted: '#a3a3a3',
    accent: '#60a5fa',
    'accent-hover': '#93c5fd',
    'banner-bg': '#172554',
    'banner-text': '#bfdbfe',
    'on-accent': '#121212',
  },
};
const colours = (v: Record<string, string>) =>
  Object.keys(v).filter((k) => k.startsWith('--color-'));

const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const lum = (hex: string) => {
  if (!/^#[0-9a-f]{6}$/i.test(hex))
    throw new Error(`expected 6-digit hex, got "${hex}"`);
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
    expect(blocks).toHaveLength(1);
    expect(darkMatches).toHaveLength(1);
    expect(colours(light)).toHaveLength(10);
    expect(Object.keys(light)).toContain('--font-sans');
    expect(Object.keys(light)).toContain('--radius-card');
    expect(Object.keys(light)).toContain('--space-4');
  });

  it('dark redefines every colour token', () => {
    expect(colours(dark).sort()).toEqual(colours(light).sort());
  });

  it('has no colour literals outside the token blocks', () => {
    const rest = lightCss.replace(rootRe, '');
    expect(rest).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });

  for (const [name, v] of [
    ['light', light],
    ['dark', dark],
  ] as const) {
    describe(name, () => {
      it('matches the story table values', () => {
        const actual = Object.fromEntries(
          colours(v).map((k) => [
            k.slice('--color-'.length),
            v[k]!.toLowerCase(),
          ]),
        );
        expect(actual).toEqual(expected[name]);
      });
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

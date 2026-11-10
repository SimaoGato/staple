import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { home, notFound, tool } from './views';
import { en } from './i18n/en';
import { TOOLS } from './tools';

const links = (el: Element) =>
  [...el.querySelectorAll('a')].map((a) => [
    a.textContent,
    a.getAttribute('href'),
  ]);

describe('views', () => {
  it('home', () => {
    const el = home();
    expect(el.querySelector('h1')?.textContent).toBe('Staple');
    expect(links(el.querySelector('nav')!)).toEqual([
      ['Compress', '/compress'],
      ['Merge', '/merge'],
      ['Split', '/split'],
      ['Convert', '/convert'],
      ['Resize', '/resize'],
    ]);
    for (const a of el.querySelectorAll('a'))
      expect(a.getAttribute('tabindex')).toBeNull();
  });
  it.each(TOOLS)('tool $id', ({ id }) => {
    const el = tool(id);
    expect(el.querySelectorAll('h1')).toHaveLength(1);
    expect(el.querySelector('h1')?.textContent).toBe(en[`tool.${id}.heading`]);
  });
  it('not found links home', () => {
    const el = notFound();
    expect(el.querySelector('h1')?.textContent).toBe('Page not found');
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/');
  });
  it('links have a visible focus outline', () => {
    const style = document.createElement('style');
    style.textContent = readFileSync(`${__dirname}/style.css`, 'utf8');
    document.head.append(style);
    const rule = [...style.sheet!.cssRules].find(
      (r): r is CSSStyleRule =>
        r instanceof CSSStyleRule && r.selectorText === 'a:focus-visible',
    );
    expect(rule?.style.outlineStyle).toBe('solid');
    expect(parseFloat(rule?.style.outlineWidth ?? '')).toBeGreaterThanOrEqual(
      2,
    );
    style.remove();
  });
});

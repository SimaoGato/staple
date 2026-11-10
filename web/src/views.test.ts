import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { home, notFound, shell, tool, SOURCE_URL } from './views';
import { en } from './i18n/en';
import { TOOLS } from './tools';

describe('views', () => {
  it('home', () => {
    const el = home();
    expect(el.querySelector('h1')?.textContent).toBe(en['home.heading']);
    expect(el.querySelector('.subheading')?.textContent).toBe(
      en['home.subheading'],
    );
    const cards = [...el.querySelectorAll('nav a')];
    expect(cards.map((a) => a.getAttribute('href'))).toEqual(
      TOOLS.map((x) => x.path),
    );
    for (const [i, a] of cards.entries()) {
      const { id } = TOOLS[i];
      expect(a.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
      expect(a.querySelector('.card-title')?.textContent).toBe(
        en[`tool.${id}.name`],
      );
      expect(a.querySelector('.card-desc')?.textContent).toBe(
        en[`tool.${id}.desc`],
      );
      expect(a.getAttribute('tabindex')).toBeNull();
    }
  });
  it('shell', () => {
    const host = document.createElement('div');
    host.append(shell());
    expect(host.querySelectorAll('header, main, footer')).toHaveLength(3);
    const wordmark = host.querySelector('header a');
    expect(wordmark?.getAttribute('href')).toBe('/');
    expect(wordmark?.hasAttribute('data-link')).toBe(true);
    expect(wordmark?.textContent).toBe(en['app.title']);
    expect(host.querySelector('.banner')?.textContent).toBe(
      en['privacy.banner'],
    );
    const src = host.querySelector('footer a');
    expect(src?.getAttribute('href')).toBe(SOURCE_URL);
    expect(src?.textContent).toBe(en['footer.source']);
  });
  it('no innerHTML in view or icon code', () => {
    for (const f of ['views.ts', 'icons.ts']) {
      const text = readFileSync(`${__dirname}/${f}`, 'utf8');
      expect(text.length).toBeGreaterThan(0);
      expect(text.match(/innerHTML/g)).toBeNull();
    }
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
  it('shell has a labelled theme group with three buttons', () => {
    const host = document.createElement('div');
    host.append(shell());
    const g = host.querySelector('header [role=group]')!;
    expect(g.getAttribute('aria-label')).toBe(en['theme.label']);
    const bs = [...g.querySelectorAll('button')];
    expect(bs.map((b) => b.textContent)).toEqual(['System', 'Light', 'Dark']);
    expect(bs.map((b) => b.getAttribute('aria-pressed'))).toEqual([
      'true',
      'false',
      'false',
    ]);
  });
  it('index.html loads theme-init.js blocking, before the module script', () => {
    const html = readFileSync(`${__dirname}/../index.html`, 'utf8');
    const tags = html.match(/<script[^>]*>/g)!;
    expect(tags).toHaveLength(2);
    expect(tags[0]).toContain('src="/theme-init.js"');
    expect(tags[0]).not.toMatch(/defer|module|async/);
    expect(html.indexOf('theme-init.js')).toBeLessThan(html.indexOf('</head>'));
  });
  it('links have a visible focus outline', () => {
    const style = document.createElement('style');
    style.textContent = readFileSync(`${__dirname}/style.css`, 'utf8');
    document.head.append(style);
    for (const sel of ['a:focus-visible', 'button:focus-visible']) {
      const rule = [...style.sheet!.cssRules].find(
        (r): r is CSSStyleRule =>
          r instanceof CSSStyleRule && r.selectorText === sel,
      );
      expect(rule?.style.outlineStyle).toBe('solid');
      expect(parseFloat(rule?.style.outlineWidth ?? '')).toBeGreaterThanOrEqual(
        2,
      );
    }
    style.remove();
  });
});

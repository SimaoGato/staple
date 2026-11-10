import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { home, notFound, tool } from './views';
import { en } from './i18n/en';
import { TOOLS } from './tools';
import { mount } from './router';

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
  it('css has focus-visible', () => {
    expect(readFileSync(`${__dirname}/style.css`, 'utf8')).toContain(
      ':focus-visible',
    );
  });
});

describe('navigation', () => {
  let root: HTMLElement;
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    root = document.getElementById('app')!;
  });
  const h1 = () => root.querySelector('h1')?.textContent;

  it('deep link renders tool', () => {
    history.replaceState(null, '', '/merge');
    mount(root);
    expect(h1()).toBe('Merge');
  });
  it('click navigates, popstate re-renders', () => {
    history.replaceState(null, '', '/');
    mount(root);
    expect(h1()).toBe('Staple');
    for (const { id, path } of TOOLS) {
      root.querySelector<HTMLAnchorElement>(`a[href="${path}"]`)!.click();
      expect(location.pathname).toBe(path);
      expect(h1()).toBe(en[`tool.${id}.heading`]);
      expect(document.activeElement).toBe(root.querySelector('h1'));
      root.querySelector<HTMLAnchorElement>('a[href="/"]')!.click();
      expect(h1()).toBe('Staple');
    }
    history.pushState(null, '', '/split');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(h1()).toBe('Split');
  });
  it('unknown path goes home via link', () => {
    history.replaceState(null, '', '/zzz');
    mount(root);
    expect(h1()).toBe('Page not found');
    root.querySelector<HTMLAnchorElement>('a')!.click();
    expect(h1()).toBe('Staple');
  });
});

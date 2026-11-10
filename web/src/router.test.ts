import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { en } from './i18n/en';
import { mount, resolve } from './router';
import { TOOLS } from './tools';

describe('resolve', () => {
  it('home', () => expect(resolve('/')).toEqual({ kind: 'home' }));
  it.each(TOOLS)('tool $id', ({ id, path }) => {
    expect(resolve(path)).toEqual({ kind: 'tool', id });
  });
  it('trailing slash', () =>
    expect(resolve('/merge/')).toEqual({ kind: 'tool', id: 'merge' }));
  it('unknown', () => expect(resolve('/nope')).toEqual({ kind: 'notFound' }));
});

describe('mount', () => {
  let root: HTMLElement;
  let unmount: () => void;

  const start = (path: string) => {
    history.replaceState(null, '', path);
    unmount = mount(root);
  };
  const h1 = () => root.querySelector('h1');
  const linkTo = (href: string) =>
    root.querySelector<HTMLAnchorElement>(`a[href="${href}"]`)!;
  const click = (a: HTMLAnchorElement, init: MouseEventInit = {}) => {
    const ev = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      ...init,
    });
    a.dispatchEvent(ev);
    return ev;
  };
  const addLink = (href: string) => {
    const a = document.createElement('a');
    a.href = href;
    a.dataset.link = '';
    root.append(a);
    return a;
  };

  beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    root = document.createElement('div');
    document.body.replaceChildren(root);
  });
  afterEach(() => {
    unmount();
    vi.restoreAllMocks();
  });

  it('deep link renders the tool page', () => {
    start('/merge');
    expect(h1()?.textContent).toBe('Merge');
    expect(document.title).toBe('Merge - Staple');
  });

  it('each home link navigates to its tool and back', () => {
    start('/');
    expect(document.title).toBe('Staple');
    for (const { id, path } of TOOLS) {
      click(linkTo(path));
      expect(location.pathname).toBe(path);
      expect(h1()?.textContent).toBe(en[`tool.${id}.heading`]);
      expect(document.activeElement).toBe(h1());
      click(linkTo('/'));
      expect(h1()?.textContent).toBe('Staple');
    }
  });

  it('popstate re-renders and moves focus to the heading', () => {
    start('/');
    linkTo('/split').focus();
    history.pushState(null, '', '/split');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(h1()?.textContent).toBe('Split');
    expect(document.activeElement).toBe(h1());
  });

  it('unknown path shows not found, which links home', () => {
    start('/zzz');
    expect(h1()?.textContent).toBe('Page not found');
    click(linkTo('/'));
    expect(location.pathname).toBe('/');
    expect(h1()?.textContent).toBe('Staple');
  });

  it('a link to the current URL adds no history entry', () => {
    start('/merge');
    const len = history.length;
    expect(click(addLink('/merge')).defaultPrevented).toBe(true);
    expect(history.length).toBe(len);
  });

  it('keeps query and hash', () => {
    start('/');
    click(addLink('/split?x=1#y'));
    expect(location.pathname + location.search + location.hash).toBe(
      '/split?x=1#y',
    );
  });

  it.each([
    ['target=_blank', (a: HTMLAnchorElement) => (a.target = '_blank'), {}],
    ['ctrl-click', () => {}, { ctrlKey: true }],
    ['middle click', () => {}, { button: 1 }],
    [
      'other origin',
      (a: HTMLAnchorElement) => (a.href = 'https://x.test/'),
      {},
    ],
  ])('leaves %s to the browser', (_, tweak, init) => {
    start('/');
    const a = linkTo('/compress');
    tweak(a);
    expect(click(a, init).defaultPrevented).toBe(false);
    expect(location.pathname).toBe('/');
  });

  it('teardown removes listeners', () => {
    start('/');
    unmount();
    const a = linkTo('/compress');
    expect(click(a).defaultPrevented).toBe(false);
    history.pushState(null, '', '/split');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(h1()?.textContent).toBe('Staple');
    unmount = () => {};
  });
});

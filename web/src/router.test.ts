import { describe, expect, it, vi } from 'vitest';
import { mount, resolve } from './router';

describe('resolve', () => {
  it('home', () => expect(resolve('/')).toEqual({ kind: 'home' }));
  it.each(['compress', 'merge', 'split', 'convert', 'resize'])(
    'tool %s',
    (id) => {
      expect(resolve(`/${id}`)).toEqual({ kind: 'tool', id });
    },
  );
  it('trailing slash', () =>
    expect(resolve('/merge/')).toEqual({ kind: 'tool', id: 'merge' }));
  it('unknown', () => expect(resolve('/nope')).toEqual({ kind: 'notFound' }));
});

describe('mount', () => {
  const root = document.createElement('div');
  document.body.append(root);
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  mount(root);
  const link = () => root.querySelector<HTMLAnchorElement>('a[data-link]')!;
  const click = (a: HTMLAnchorElement) => {
    const ev = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      button: 0,
    });
    a.dispatchEvent(ev);
    return ev;
  };

  it('sets page titles', () => {
    expect(document.title).toBe('Staple');
    click(link());
    expect(location.pathname).toBe('/compress');
    expect(document.title).toBe('Compress - Staple');
  });
  it('same-path click adds no history entry', () => {
    const len = history.length;
    click(link()); // "Home" link on /compress
    expect(history.length).toBe(len + 1);
    click(link()); // "Compress" link; still navigates
    click(link()); // now on /compress, link is Home
    const after = history.length;
    const here = location.pathname;
    const a = document.createElement('a');
    a.href = here;
    a.dataset.link = '';
    root.append(a);
    click(a);
    expect(history.length).toBe(after);
  });
  it('ignores target=_blank', () => {
    const a = link();
    a.target = '_blank';
    expect(click(a).defaultPrevented).toBe(false);
  });
});

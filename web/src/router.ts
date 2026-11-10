import { t } from './i18n';
import { TOOLS, type ToolId } from './tools';
import { home, notFound, shell, tool } from './views';

export type Route =
  { kind: 'home' } | { kind: 'tool'; id: ToolId } | { kind: 'notFound' };

export function resolve(pathname: string): Route {
  const path = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  if (path === '/') return { kind: 'home' };
  const found = TOOLS.find((x) => x.path === path);
  return found ? { kind: 'tool', id: found.id } : { kind: 'notFound' };
}

/** Renders the current route into `root` and wires navigation. Returns a teardown. */
export function mount(root: HTMLElement): () => void {
  const render = (focus: boolean) => {
    const route = resolve(location.pathname);
    const view =
      route.kind === 'home'
        ? home()
        : route.kind === 'tool'
          ? tool(route.id)
          : notFound();
    root.querySelector('main')!.replaceWith(view);
    const h1 = view.querySelector('h1');
    document.title =
      route.kind === 'home'
        ? t('app.title')
        : `${h1?.textContent ?? ''} - ${t('app.title')}`;
    // Move focus off the removed link so keyboard and screen-reader users keep their place.
    if (focus) h1?.focus({ preventScroll: true });
  };

  const onClick = (e: MouseEvent) => {
    const a = (e.target as Element).closest<HTMLAnchorElement>('a[data-link]');
    if (
      !a ||
      e.button !== 0 ||
      e.ctrlKey ||
      e.metaKey ||
      e.shiftKey ||
      e.altKey
    )
      return;
    if (a.origin !== location.origin || a.target || a.hasAttribute('download'))
      return;
    e.preventDefault();
    if (a.href === location.href) return; // no duplicate history entry
    // shortcut: a same-page #hash link re-renders and focuses h1 instead of scrolling to the anchor; handle it when a page gets in-page anchors.
    history.pushState(null, '', a.pathname + a.search + a.hash);
    render(true);
    window.scrollTo(0, 0);
  };
  // Back/forward: the browser restores scroll; only move focus.
  const onPop = () => render(true);

  root.replaceChildren(shell());
  root.addEventListener('click', onClick);
  window.addEventListener('popstate', onPop);
  render(false);
  return () => {
    root.removeEventListener('click', onClick);
    window.removeEventListener('popstate', onPop);
  };
}

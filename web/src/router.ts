import { t } from './i18n';
import { TOOLS, type ToolId } from './tools';
import { home, notFound, tool } from './views';

export type Route =
  { kind: 'home' } | { kind: 'tool'; id: ToolId } | { kind: 'notFound' };

export function resolve(pathname: string): Route {
  const path = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  if (path === '/') return { kind: 'home' };
  const found = TOOLS.find((x) => x.path === path);
  return found ? { kind: 'tool', id: found.id } : { kind: 'notFound' };
}

export function mount(root: HTMLElement): void {
  const render = (focus: boolean) => {
    const route = resolve(location.pathname);
    const view =
      route.kind === 'home'
        ? home()
        : route.kind === 'tool'
          ? tool(route.id)
          : notFound();
    root.replaceChildren(view);
    const h1 = view.querySelector('h1');
    document.title =
      route.kind === 'home'
        ? t('app.title')
        : `${h1?.textContent ?? ''} - ${t('app.title')}`;
    if (focus) {
      h1?.focus();
      window.scrollTo(0, 0);
    }
  };

  root.addEventListener('click', (e) => {
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
    if (a.pathname === location.pathname) return; // no duplicate history entry
    history.pushState(null, '', a.pathname);
    render(true);
  });
  window.addEventListener('popstate', () => render(false));
  render(false);
}

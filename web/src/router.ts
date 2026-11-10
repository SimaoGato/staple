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
    document.title = h1?.textContent ?? '';
    if (focus) h1?.focus();
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
    if (a.origin !== location.origin) return;
    e.preventDefault();
    history.pushState(null, '', a.pathname);
    render(true);
  });
  window.addEventListener('popstate', () => render(true));
  render(false);
}

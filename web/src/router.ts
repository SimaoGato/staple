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
  let main: HTMLElement; // current <main>; set after the shell is built
  let destroyView = () => {}; // cleanup of the current view, if it has any
  let renderId = 0; // bumped per render and on teardown, so a late async view is dropped
  const show = (view: HTMLElement, home: boolean, focus: boolean) => {
    main.replaceWith(view);
    main = view;
    const h1 = view.querySelector('h1');
    document.title = home
      ? t('app.title')
      : `${h1?.textContent ?? ''} - ${t('app.title')}`;
    // Move focus off the removed link so keyboard and screen-reader users keep their place.
    if (focus) h1?.focus({ preventScroll: true });
  };
  const render = (focus: boolean) => {
    const id = ++renderId;
    destroyView();
    destroyView = () => {};
    // The literal MODE test lets the bundler drop the demo page from the default build.
    if (import.meta.env.MODE === 'e2e' && location.pathname === '/demo') {
      void import('./flow/demo')
        .then(({ demoView }) => {
          if (id !== renderId) return;
          const v = demoView();
          destroyView = v.destroy;
          show(v.el, false, focus);
        })
        .catch(() => {
          if (id === renderId) show(notFound(), false, focus);
        });
      return;
    }
    const route = resolve(location.pathname);
    show(
      route.kind === 'home'
        ? home()
        : route.kind === 'tool'
          ? tool(route.id)
          : notFound(),
      route.kind === 'home',
      focus,
    );
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

  const frag = shell();
  const slot = frag.querySelector('main');
  if (!slot) throw new Error('shell() must render a <main>');
  main = slot;
  root.replaceChildren(frag);
  root.addEventListener('click', onClick);
  window.addEventListener('popstate', onPop);
  render(false);
  return () => {
    renderId++;
    destroyView();
    root.removeEventListener('click', onClick);
    window.removeEventListener('popstate', onPop);
  };
}

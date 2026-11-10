import { t } from './i18n';
import { icon } from './icons';
import { TOOLS, type ToolId } from './tools';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  return e;
}

function link(href: string, text: string) {
  const a = el('a', text);
  a.href = href;
  a.dataset.link = '';
  return a;
}

function page(heading: string) {
  const main = el('main');
  const h1 = el('h1', heading);
  h1.tabIndex = -1; // focus target after client-side navigation
  main.append(h1);
  return main;
}

export const SOURCE_URL = 'https://github.com/SimaoGato/staple';

function container(tag: 'header' | 'footer' | 'div', ...kids: Node[]) {
  const outer = el(tag);
  const inner = el('div');
  inner.className = 'container';
  inner.append(...kids);
  outer.append(inner);
  return outer;
}

/** Header, privacy banner, an empty `<main>` slot and footer; built once, views replace the slot. */
export function shell(): DocumentFragment {
  const logo = link('/', t('app.title'));
  logo.className = 'wordmark';
  const tile = el('span');
  tile.className = 'logo-tile';
  tile.append(icon('staple'));
  logo.prepend(tile);

  const banner = container(
    'div',
    icon('shield'),
    el('span', t('privacy.banner')),
  );
  banner.className = 'banner';

  const src = el('a', t('footer.source'));
  src.href = SOURCE_URL;
  src.rel = 'noopener';

  const f = document.createDocumentFragment();
  f.append(
    container('header', logo),
    banner,
    el('main'),
    container('footer', el('span', t('footer.text')), src),
  );
  return f;
}

export function home(): HTMLElement {
  const main = page(t('home.heading'));
  const ul = el('ul');
  ul.className = 'cards';
  for (const { id, path } of TOOLS) {
    const a = link(path, '');
    a.className = 'card';
    const tile = el('span');
    tile.className = 'icon-tile';
    tile.append(icon(id));
    const title = el('span', t(`tool.${id}.name`));
    title.className = 'card-title';
    const desc = el('span', t(`tool.${id}.desc`));
    desc.className = 'card-desc';
    const chev = el('span');
    chev.className = 'card-chevron';
    chev.append(icon('chevron'));
    a.append(tile, title, desc, chev);
    const li = el('li');
    li.append(a);
    ul.append(li);
  }
  const nav = el('nav');
  nav.append(ul);
  const sub = el('p', t('home.subheading'));
  sub.className = 'subheading';
  main.append(sub, nav);
  return main;
}

export function tool(id: ToolId): HTMLElement {
  const main = page(t(`tool.${id}.heading`));
  main.append(el('p', t('placeholder.comingSoon')), link('/', t('nav.home')));
  return main;
}

export function notFound(): HTMLElement {
  const main = page(t('notFound.title'));
  main.append(link('/', t('notFound.back')));
  return main;
}

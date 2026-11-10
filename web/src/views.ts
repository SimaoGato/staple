import { t } from './i18n';
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

export function home(): HTMLElement {
  const main = page(t('app.title'));
  const ul = el('ul');
  for (const { id, path } of TOOLS) {
    const li = el('li');
    li.append(link(path, t(`tool.${id}.name`)));
    ul.append(li);
  }
  const nav = el('nav');
  nav.append(ul);
  main.append(el('p', t('home.intro')), nav);
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

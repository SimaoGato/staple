import { t, tf } from '../i18n';
import { checkAdd } from '../limits';
import { formatSize } from './format';
import { isAccepted, type ToolSpec } from './spec';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/**
 * Input step of the shared flow: drop zone, picker, file list, live region.
 * Holds `File` objects only; bytes are read by the run step, never here.
 */
export function createInput(
  spec: ToolSpec,
  onChange?: () => void,
): {
  el: HTMLElement;
  files(): File[];
  setDisabled(b: boolean): void;
  destroy(): void;
} {
  let files: File[] = [];
  let disabled = false;

  const root = el('div', 'flow-input');
  const zone = el('div', 'dropzone');
  const input = el('input');
  input.type = 'file';
  input.hidden = true; // display:none: not focusable, and input.click() still opens the picker
  input.accept = [...spec.accept, ...spec.mimes].join(',');
  input.multiple = spec.multiple;
  const choose = el(
    'button',
    'choose',
    spec.multiple ? t('flow.choose.multi') : t('flow.choose.single'),
  );
  choose.type = 'button';
  choose.addEventListener('click', () => input.click());
  const error = el('p', 'flow-error');
  const list = el('ul', 'file-list');
  const live = el('div', 'visually-hidden');
  live.setAttribute('role', 'status');
  live.setAttribute('aria-live', 'polite');
  zone.append(
    el(
      'p',
      undefined,
      spec.multiple ? t('flow.drop.multi') : t('flow.drop.single'),
    ),
    choose,
    input,
  );
  root.append(zone, error, list, live);

  let raf = 0;
  // Clear, then set on the next frame, so identical text is announced again.
  const announce = (msg: string) => {
    cancelAnimationFrame(raf);
    live.textContent = '';
    raf = requestAnimationFrame(() => {
      live.textContent = msg;
    });
  };

  const render = () => {
    list.replaceChildren(
      ...files.map((f, i) => {
        const rm = el('button', undefined, tf('flow.remove', { name: f.name }));
        rm.type = 'button';
        rm.disabled = disabled;
        rm.addEventListener('click', () => remove(i));
        const li = el('li');
        li.append(
          el('span', 'file-name', f.name),
          el('span', 'file-size', formatSize(f.size)),
          rm,
        );
        return li;
      }),
    );
  };

  const remove = (i: number) => {
    if (disabled) return;
    const [gone] = files.splice(i, 1);
    error.textContent = '';
    render();
    const btns = list.querySelectorAll('button');
    (btns[Math.min(i, btns.length - 1)] ?? choose).focus();
    announce(tf('flow.removed', { name: gone!.name }));
    onChange?.();
  };

  const add = (offered: File[]) => {
    if (disabled) return;
    const problems: string[] = [];
    const ok: File[] = [];
    for (const f of offered)
      if (isAccepted(f, spec)) ok.push(f);
      else problems.push(tf('flow.error.unsupported', { name: f.name }));
    const incoming = spec.multiple ? ok : ok.slice(0, 1);
    if (!spec.multiple && ok[1])
      problems.push(tf('flow.notice.oneAtATime', { name: ok[0]!.name }));
    const res = checkAdd(spec.multiple ? files : [], incoming);
    let added = 0;
    if (res.ok) {
      added = incoming.length;
      if (added) files = spec.multiple ? [...files, ...incoming] : incoming;
    } else problems.push(res.reason);
    error.textContent = problems.join(' ');
    const msg = [
      added === 0
        ? ''
        : added === 1
          ? t('flow.added.one')
          : tf('flow.added.other', { n: added }),
      ...problems,
    ]
      .filter(Boolean)
      .join(' ');
    render();
    if (msg) announce(msg);
    onChange?.();
  };

  input.addEventListener('change', () => {
    add(Array.from(input.files ?? []));
    input.value = ''; // lets the same file be picked again
  });

  // Enter/leave counter: relatedTarget is often null in Safari/Firefox between child elements.
  let depth = 0;
  const hasFiles = (e: Event) =>
    (e as DragEvent).dataTransfer?.types.includes('Files') ?? false;
  const over = (e: Event) => {
    if (!hasFiles(e)) return; // dragged text or links: no highlight, no drop target
    e.preventDefault();
    zone.classList.add('dragover');
  };
  const enter = (e: Event) => {
    if (!hasFiles(e)) return;
    depth++;
    over(e);
  };
  const leave = () => {
    depth = Math.max(0, depth - 1);
    if (!depth) zone.classList.remove('dragover');
  };
  const drop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    depth = 0;
    zone.classList.remove('dragover');
    add(Array.from(e.dataTransfer?.files ?? []));
  };
  zone.addEventListener('dragenter', enter);
  zone.addEventListener('dragover', over);
  zone.addEventListener('dragleave', leave);
  zone.addEventListener('drop', drop);

  // Stops the browser opening a file dropped outside the zone.
  const stop = (e: Event) => e.preventDefault();
  window.addEventListener('dragover', stop);
  window.addEventListener('drop', stop);

  return {
    el: root,
    files: () => [...files],
    setDisabled(b) {
      disabled = b;
      choose.disabled = b;
      render();
    },
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener('dragover', stop);
      window.removeEventListener('drop', stop);
    },
  };
}

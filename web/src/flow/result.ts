import { t, tf } from '../i18n';
import { sizeChange } from './change';
import type { Output } from './flow';
import { formatSize } from './format';
import { runZip, WorkerError } from '../worker/client';

const CHANGE_KEY = {
  smaller: 'result.smaller',
  larger: 'result.larger',
  same: 'result.same',
} as const;

/** Downloads bytes as `name` via a temporary object URL, revoked on a later task. */
export function downloadBytes(bytes: Uint8Array, name: string): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart]));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Result step: one card per output with a Download button, a ZIP button for 2+, plus Start over. */
export function createResults(
  outputs: Output[],
  onStartOver: () => void,
  zipName: string,
): { el: HTMLElement; focus(): void; destroy(): void } {
  const mk = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    text?: string,
    cls?: string,
  ) => {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  };
  const btn = (text: string, onClick: () => void) => {
    const b = mk('button', text);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  };
  const h2 = mk('h2', t('result.heading'));
  h2.tabIndex = -1;
  const live = mk('div', undefined, 'visually-hidden');
  live.setAttribute('role', 'status');
  live.setAttribute('aria-live', 'polite');
  const list = mk('ul', undefined, 'result-list');
  for (const o of outputs) {
    const li = mk('li', undefined, 'result-card');
    li.append(
      mk('span', o.name, 'file-name'),
      mk('span', formatSize(o.bytes.length), 'file-size'),
    );
    const c = sizeChange(o.inputSize, o.bytes.length);
    if (c) {
      const key = CHANGE_KEY[c.kind];
      li.append(mk('span', tf(key, { percent: c.percent }), 'result-change'));
    }
    const dl = btn(t('result.download'), () => downloadBytes(o.bytes, o.name));
    dl.setAttribute(
      'aria-label',
      tf('result.download.label', { name: o.name }),
    );
    li.append(dl);
    list.append(li);
  }
  const el = mk('section', undefined, 'results');
  el.append(h2, live);
  let raf = 0;
  let zipRaf = 0;
  let busyRaf = 0;
  let dead = false;
  if (outputs.at(1)) {
    const label = t('result.zip');
    const err = mk('p', undefined, 'result-zip-error');
    err.setAttribute('role', 'alert');
    err.hidden = true;
    const zip = btn(label, () => {
      // aria-disabled, not disabled: a disabled button drops keyboard focus
      if (zip.getAttribute('aria-disabled')) return;
      void (async () => {
        err.hidden = true;
        err.textContent = '';
        zip.setAttribute('aria-disabled', 'true');
        zip.textContent = t('result.zip.busy');
        cancelAnimationFrame(zipRaf);
        busyRaf = requestAnimationFrame(() => {
          live.textContent = t('result.zip.busy');
        });
        try {
          const bytes = await runZip(outputs);
          if (!dead) downloadBytes(bytes, zipName);
        } catch (e) {
          if (dead) return;
          const message =
            e instanceof WorkerError ? e.message : t('error.internal');
          zipRaf = requestAnimationFrame(() => {
            err.hidden = false;
            err.textContent = message;
          });
        } finally {
          if (!dead) {
            cancelAnimationFrame(busyRaf);
            live.textContent = ''; // drop the stale busy text
            zip.removeAttribute('aria-disabled');
            zip.textContent = label;
          }
        }
      })();
    });
    zip.className = 'result-zip';
    zip.setAttribute(
      'aria-label',
      tf('result.zip.label', { n: outputs.length }),
    );
    el.append(zip, err);
  }
  el.append(list, btn(t('result.startOver'), onStartOver));
  return {
    el,
    focus() {
      h2.focus();
      // Same as input.ts: set text on the next frame so the live region announces it.
      raf = requestAnimationFrame(() => {
        live.textContent = tf(
          outputs.length === 1 ? 'result.ready.one' : 'result.ready.other',
          { n: outputs.length },
        );
      });
    },
    destroy() {
      dead = true;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(zipRaf);
      cancelAnimationFrame(busyRaf);
    },
  };
}

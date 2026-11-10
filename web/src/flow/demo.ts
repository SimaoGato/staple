import { t } from '../i18n';
import { createInput } from './input';
import type { ToolSpec } from './spec';

/** E2e-only page that exercises the shared input step; `?single` and `?pdf` pick variants. */
export function demoView(): { el: HTMLElement; destroy(): void } {
  const q = new URLSearchParams(location.search);
  const spec: ToolSpec = {
    accept: q.has('pdf') ? ['.pdf'] : [],
    mimes: q.has('pdf') ? ['application/pdf'] : [],
    multiple: !q.has('single'),
  };
  const main = document.createElement('main');
  main.className = 'tool-flow';
  const h1 = document.createElement('h1');
  h1.textContent = t('demo.heading');
  h1.tabIndex = -1;
  const input = createInput(spec);
  main.append(h1, input.el);
  return { el: main, destroy: input.destroy };
}

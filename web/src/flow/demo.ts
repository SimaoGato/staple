import { t } from '../i18n';
import { runCopy } from '../worker/client';
import { createFlow } from './flow';
import { createResults } from './result';
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
  const delay = Number(q.get('delay') ?? 0); // e2e only: slows each job so tests can observe a run
  let flow: ReturnType<typeof createFlow>;
  let results: ReturnType<typeof createResults> | undefined;
  const mount = () => {
    const f = createFlow(
      spec,
      'demo.start',
      (bytes, onProgress) => runCopy(bytes, onProgress, delay),
      (outputs) => {
        window.stapleOutputs = outputs; // e2e reads the outputs here
        f.el.hidden = true;
        results = createResults(outputs, startOver, 'staple-demo.zip');
        main.append(results.el);
        results.focus();
      },
    );
    flow = f;
    main.append(f.el);
  };
  const startOver = () => {
    flow.el.remove();
    flow.destroy();
    results?.el.remove();
    results?.destroy();
    results = undefined;
    mount();
    flow.el.querySelector<HTMLElement>('.choose')?.focus();
  };
  main.append(h1);
  mount();
  return {
    el: main,
    destroy() {
      flow.destroy();
      results?.destroy();
    },
  };
}

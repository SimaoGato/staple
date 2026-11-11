import { t } from '../i18n';
import { runCopy } from '../worker/client';
import { createFlow } from './flow';
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
  const flow = createFlow(
    spec,
    'demo.start',
    (bytes, onProgress) => runCopy(bytes, onProgress, delay),
    // Until the result step (STORY-14) lands, tests read the outputs here.
    (outputs) => (window.stapleOutputs = outputs),
  );
  main.append(h1, flow.el);
  return { el: main, destroy: flow.destroy };
}

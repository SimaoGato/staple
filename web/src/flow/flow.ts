import { t, tf, type Key } from '../i18n';
import { cancelAll } from '../worker/client';
import { createInput } from './input';
import { finished, monotonic, overall } from './run';
import type { ToolSpec } from './spec';

export type Output = { bytes: Uint8Array; name: string; inputSize: number };

/** One job: bytes in, bytes out, with progress (0-100). */
export type Process = (
  bytes: Uint8Array,
  onProgress: (percent: number) => void,
) => Promise<Uint8Array>;

/**
 * Input + run step: start button, progress bar, Cancel. Files run one at a
 * time in list order. Cancel stops the worker; a run token makes a stale
 * loop return silently after any `await`.
 */
export function createFlow(
  spec: ToolSpec,
  startLabel: Key,
  process: Process,
  onDone: (outputs: Output[]) => void,
): { el: HTMLElement; destroy(): void } {
  const mk = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const input = createInput(spec, () => {
    start.disabled = input.files().length === 0;
  });
  const start = mk('button', t(startLabel));
  start.type = 'button';
  start.disabled = true;
  const bar = mk('progress');
  bar.max = 100;
  bar.value = 0;
  bar.setAttribute('aria-label', t('flow.progress.label'));
  const cancel = mk('button', t('flow.cancel'));
  cancel.type = 'button';
  const status = mk('p');
  status.className = 'flow-status';
  const live = mk('div');
  live.className = 'visually-hidden flow-live';
  live.setAttribute('role', 'status');
  live.setAttribute('aria-live', 'polite');
  const run = mk('div');
  run.className = 'flow-run';
  run.hidden = true;
  run.append(bar, cancel);
  const root = mk('div');
  root.append(input.el, start, run, status, live);

  let token = 0;
  let running = false;

  const say = (msg: string) => {
    status.textContent = msg;
    live.textContent = msg;
  };
  // Show the idle controls before focusing: a hidden element cannot take focus.
  const idle = () => {
    running = false;
    run.hidden = true;
    start.hidden = false;
    input.setDisabled(false);
  };

  start.addEventListener('click', async () => {
    const files = input.files();
    if (running || files.length === 0) return;
    const my = ++token;
    running = true;
    input.setDisabled(true);
    start.hidden = true;
    start.disabled = true;
    bar.value = 0;
    run.hidden = false;
    cancel.focus();
    const outputs: Output[] = [];
    let pct = 0;
    const n = files.length;
    try {
      for (const [i, f] of files.entries()) {
        say(tf('flow.status', { name: f.name, n: i + 1, total: n }));
        const bytes = new Uint8Array(await f.arrayBuffer());
        if (my !== token) return;
        const out = await process(bytes, (p) => {
          if (my !== token) return;
          pct = monotonic(pct, overall(i, n, p));
          bar.value = pct;
        });
        if (my !== token) return;
        pct = monotonic(pct, finished(i, n));
        bar.value = pct;
        outputs.push({ bytes: out, name: f.name, inputSize: f.size });
      }
    } catch {
      if (my !== token) return; // cancelled: the Cancel handler already updated the UI
      idle();
      start.disabled = false;
      status.textContent = t('error.internal');
      live.textContent = t('error.internal');
      return;
    }
    idle();
    start.disabled = false;
    say(t('flow.done'));
    onDone(outputs);
  });

  cancel.addEventListener('click', () => {
    if (!running) return;
    token++;
    cancelAll();
    idle();
    start.disabled = input.files().length === 0;
    start.focus();
    say(t('flow.cancelled'));
  });

  return {
    el: root,
    destroy() {
      if (running) {
        token++;
        running = false;
        cancelAll();
      }
      input.destroy();
    },
  };
}

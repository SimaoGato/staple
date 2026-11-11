import { afterEach, describe, expect, it, vi } from 'vitest';

const cancelAll = vi.fn();
vi.mock('../worker/client', () => ({ cancelAll: () => cancelAll() }));
import { createFlow, type Output, type Process } from './flow';

const spec = { accept: [], mimes: [], multiple: true };
const flush = () => new Promise((r) => setTimeout(r, 0));
const file = (name: string, body = 'x') => new File([body], name);
const deferred = <T>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((a, b) => ((resolve = a), (reject = b)));
  return { promise, resolve, reject };
};

let cur: ReturnType<typeof createFlow>;
function make(process: Process, files: File[], onDone = vi.fn()) {
  cur = createFlow(spec, 'demo.start', process, onDone);
  document.body.replaceChildren(cur.el);
  const ev = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'dataTransfer', { value: { files } });
  cur.el.querySelector('.dropzone')!.dispatchEvent(ev);
  return onDone;
}
const q = <T extends Element>(s: string) => cur.el.querySelector<T>(s)!;
const start = () =>
  q<HTMLButtonElement>('.flow-run').previousElementSibling as HTMLButtonElement;
const cancel = () => q<HTMLButtonElement>('.flow-run button');
const status = () => q('.flow-status').textContent;
const bar = () => q<HTMLProgressElement>('progress');

afterEach(() => {
  cur.destroy();
  cancelAll.mockClear();
});

describe('createFlow', () => {
  it('start is disabled while the list is empty', () => {
    make(async (b) => b, []);
    expect(start().disabled).toBe(true);
  });

  it('runs in order, names the file, progress is monotonic, hands off outputs', async () => {
    const order: number[] = [];
    const seen: number[] = [];
    const onDone = make(
      async (b, onProgress) => {
        order.push(b.length);
        if (b.length === 2) onProgress(50);
        if (b.length === 2) onProgress(10); // goes backwards: must be ignored
        seen.push(bar().value);
        return b;
      },
      [file('a', 'x'), file('b', 'xx'), file('c', 'xxx')],
    );
    expect(start().disabled).toBe(false);
    start().click();
    expect(start().hidden).toBe(true);
    expect(q<HTMLElement>('.flow-run').hidden).toBe(false);
    expect(q<HTMLButtonElement>('.choose').disabled).toBe(true);
    expect(status()).toBe('Processing a (1 of 3)');
    await flush();
    expect(order).toEqual([1, 2, 3]);
    // job 3 has no progress calls and the bar still advanced
    expect(seen).toEqual([0, 50, 66]);
    expect(bar().value).toBe(100);
    const outs = onDone.mock.calls[0]![0] as Output[];
    expect(outs.map((o) => [o.name, o.inputSize, o.bytes.length])).toEqual([
      ['a', 1, 1],
      ['b', 2, 2],
      ['c', 3, 3],
    ]);
    expect(start().hidden).toBe(false);
    expect(q<HTMLButtonElement>('.choose').disabled).toBe(false);
  });

  it('status names the second file', async () => {
    const d = deferred<Uint8Array>();
    let n = 0;
    make(
      () => (++n === 1 ? Promise.resolve(new Uint8Array()) : d.promise),
      [file('a'), file('b')],
    );
    start().click();
    await flush();
    expect(status()).toBe('Processing b (2 of 2)');
    expect(cur.el.querySelector('.flow-live')!.textContent).toBe(
      'Processing b (2 of 2)',
    );
  });

  it('cancel during a job: UI restored once, no onDone, restart from file 1', async () => {
    const d = deferred<Uint8Array>();
    const calls: string[] = [];
    const onDone = make(
      (b) => {
        calls.push(String(b.length));
        return calls.length === 1 ? d.promise : Promise.resolve(b);
      },
      [file('a', 'x'), file('b', 'xx')],
    );
    start().click();
    await flush();
    cancel().click();
    expect(cancelAll).toHaveBeenCalledTimes(1);
    expect(status()).toBe('Cancelled. Your files are still selected.');
    expect(document.activeElement).toBe(start());
    expect(q<HTMLButtonElement>('.choose').disabled).toBe(false);
    d.reject(new Error('cancelled')); // what cancelAll does to the pending job
    await flush();
    expect(onDone).not.toHaveBeenCalled();
    expect(calls).toEqual(['1']);
    start().click();
    await flush();
    expect(calls).toEqual(['1', '1', '2']);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('cancel during file.arrayBuffer(): cancelled UI now, no job afterwards', async () => {
    const d = deferred<ArrayBuffer>();
    const f = file('a');
    f.arrayBuffer = () => d.promise;
    const process = vi.fn<Process>(async (b) => b);
    const onDone = make(process, [f]);
    start().click();
    cancel().click();
    expect(status()).toBe('Cancelled. Your files are still selected.');
    expect(document.activeElement).toBe(start());
    d.resolve(new ArrayBuffer(1));
    await flush();
    expect(process).not.toHaveBeenCalled();
    expect(status()).toBe('Cancelled. Your files are still selected.');
    expect(onDone).not.toHaveBeenCalled();
  });

  it('a failing job stops the run with the generic error', async () => {
    const onDone = make(
      async () => Promise.reject(new Error('x')),
      [file('a')],
    );
    start().click();
    await flush();
    expect(status()).toBe('Something went wrong. Please try again.');
    expect(start().hidden).toBe(false);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('destroy during a run cancels the worker', async () => {
    make(() => new Promise(() => {}), [file('a')]);
    start().click();
    await flush();
    cur.destroy();
    expect(cancelAll).toHaveBeenCalledTimes(1);
  });
});

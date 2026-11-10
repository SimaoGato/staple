import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkerIn, WorkerOut } from './protocol';

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((e: MessageEvent<WorkerOut>) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  sent: { msg: WorkerIn; transfer: Transferable[] }[] = [];
  constructor() {
    FakeWorker.instances.push(this);
  }
  postMessage(msg: WorkerIn, transfer: Transferable[]) {
    // Mimic a real transfer: detach the buffer.
    structuredClone(msg, { transfer });
    this.sent.push({ msg, transfer });
  }
  reply(m: WorkerOut) {
    this.onmessage?.({ data: m } as MessageEvent<WorkerOut>);
  }
}

beforeEach(() => {
  vi.resetModules();
  FakeWorker.instances = [];
  vi.stubGlobal('Worker', FakeWorker);
});
afterEach(() => vi.unstubAllGlobals());

describe('client', () => {
  it('does not construct the worker before the first call', async () => {
    await import('./client');
    expect(FakeWorker.instances).toHaveLength(0);
  });

  it('transfers the buffer (detaches it)', async () => {
    const { runDemo } = await import('./client');
    const input = new Uint8Array([1, 2, 3]);
    const buf = input.buffer;
    void runDemo(input);
    const [{ transfer }] = FakeWorker.instances[0].sent;
    expect(transfer).toEqual([buf]);
    expect(buf.byteLength).toBe(0);
  });

  it('copies a partial view instead of transferring the whole buffer', async () => {
    const { runDemo } = await import('./client');
    const whole = new Uint8Array([9, 1, 2, 3, 9]);
    void runDemo(whole.subarray(1, 4));
    const [{ transfer }] = FakeWorker.instances[0].sent;
    expect(transfer[0]).not.toBe(whole.buffer); // a fresh copy was sent
    expect(whole.buffer.byteLength).toBe(5); // caller's buffer untouched
  });

  it('delivers progress before resolving', async () => {
    const { runDemo } = await import('./client');
    const seen: number[] = [];
    const p = runDemo(new Uint8Array([1]), (x) => seen.push(x));
    const w = FakeWorker.instances[0];
    const id = w.sent[0].msg.id;
    w.reply({ type: 'progress', id, percent: 0 });
    w.reply({ type: 'progress', id, percent: 100 });
    w.reply({ type: 'result', id, byteCount: 1, checksum: 5 });
    await expect(p).resolves.toEqual({ byteCount: 1, checksum: 5 });
    expect(seen).toEqual([0, 100]);
  });

  it('rejects with the typed error code', async () => {
    const { runDemo, WorkerError } = await import('./client');
    const p = runDemo(new Uint8Array([1]));
    const w = FakeWorker.instances[0];
    w.reply({
      type: 'error',
      id: w.sent[0].msg.id,
      code: 'empty_input',
      message: 'x',
    });
    const e = await p.catch((x: unknown) => x);
    expect(e).toBeInstanceOf(WorkerError);
    expect(e).toMatchObject({ code: 'empty_input' });
  });

  it('rejects pending jobs with internal on worker error', async () => {
    const { runDemo } = await import('./client');
    const p = runDemo(new Uint8Array([1]));
    FakeWorker.instances[0].onerror?.({
      preventDefault() {},
    } as ErrorEvent);
    await expect(p).rejects.toMatchObject({ code: 'internal' });
  });

  it('spawns a fresh worker after a worker error', async () => {
    const { runDemo } = await import('./client');
    const p = runDemo(new Uint8Array([1]));
    FakeWorker.instances[0].onerror?.({ preventDefault() {} } as ErrorEvent);
    await p.catch(() => {});
    void runDemo(new Uint8Array([1]));
    expect(FakeWorker.instances).toHaveLength(2);
  });

  it('rejects and does not leak when postMessage throws', async () => {
    const { runDemo } = await import('./client');
    vi.spyOn(FakeWorker.prototype, 'postMessage').mockImplementation(() => {
      throw new Error('boom');
    });
    await expect(runDemo(new Uint8Array([1]))).rejects.toMatchObject({
      code: 'internal',
    });
  });
});

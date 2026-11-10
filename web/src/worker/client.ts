import { t } from '../i18n';
import type { ErrorCode, WorkerIn, WorkerOut } from './protocol';

export class WorkerError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export type DemoResult = { byteCount: number; checksum: number };

type Pending = {
  resolve: (r: DemoResult) => void;
  reject: (e: WorkerError) => void;
  onProgress?: (percent: number) => void;
};

let worker: Worker | undefined;
let nextId = 1;
const pending = new Map<number, Pending>();

function failAll(e: WorkerError) {
  for (const p of pending.values()) p.reject(e);
  pending.clear();
}

function getWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(new URL('./worker.ts', import.meta.url), {
    type: 'module',
  });
  w.onmessage = (e: MessageEvent<WorkerOut>) => {
    const m = e.data;
    const p = pending.get(m.id);
    if (!p) return;
    if (m.type === 'progress') return p.onProgress?.(m.percent);
    pending.delete(m.id);
    if (m.type === 'result')
      p.resolve({ byteCount: m.byteCount, checksum: m.checksum });
    else p.reject(new WorkerError(m.code, m.message));
  };
  w.onerror = (e) => {
    e.preventDefault(); // keep it out of the console; callers get a typed error
    worker = undefined; // dead: the next call spawns a fresh worker
    failAll(new WorkerError('internal', t('error.internal')));
  };
  return (worker = w);
}

/**
 * Runs the demo op in the worker. When `input` spans its whole ArrayBuffer the
 * buffer is transferred (and detached); a partial view or shared buffer is copied.
 */
export function runDemo(
  input: Uint8Array,
  onProgress?: (percent: number) => void,
): Promise<DemoResult> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject, onProgress });
    const b = input.buffer;
    const whole =
      b instanceof ArrayBuffer &&
      input.byteOffset === 0 &&
      input.byteLength === b.byteLength;
    const buf = whole ? b : input.slice().buffer;
    const msg: WorkerIn = { type: 'job', id, op: 'demo', input: buf };
    try {
      getWorker().postMessage(msg, [buf]);
    } catch (e) {
      pending.delete(id);
      reject(
        e instanceof WorkerError
          ? e
          : new WorkerError('internal', t('error.internal')),
      );
    }
  });
}

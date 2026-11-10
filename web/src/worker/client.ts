import { t } from '../i18n';
import type {
  ErrorCode,
  JobMessage,
  PdfiumResultMessage,
  WorkerIn,
  WorkerOut,
} from './protocol';

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
  resolve: (m: Exclude<WorkerOut, { type: 'progress' | 'error' }>) => void;
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
    if (m.type === 'error') p.reject(new WorkerError(m.code, m.message));
    else p.resolve(m);
  };
  w.onerror = (e) => {
    e.preventDefault(); // keep it out of the console; callers get a typed error
    w.terminate(); // don't leak a half-dead worker
    worker = undefined; // dead: the next call spawns a fresh worker
    failAll(new WorkerError('internal', t('error.internal')));
  };
  return (worker = w);
}

/**
 * Posts one job. When `input` spans its whole ArrayBuffer the buffer is
 * transferred (and detached); a partial view or shared buffer is copied.
 */
function post(
  op: JobMessage['op'],
  input: Uint8Array,
  onProgress?: (percent: number) => void,
) {
  return new Promise<Parameters<Pending['resolve']>[0]>((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject, onProgress });
    const b = input.buffer;
    const whole =
      b instanceof ArrayBuffer &&
      input.byteOffset === 0 &&
      input.byteLength === b.byteLength;
    const buf = whole ? b : input.slice().buffer;
    const msg: WorkerIn = { type: 'job', id, op, input: buf };
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

/** Runs the demo op in the worker. */
export async function runDemo(
  input: Uint8Array,
  onProgress?: (percent: number) => void,
): Promise<DemoResult> {
  const m = await post('demo', input, onProgress);
  if (m.type !== 'result')
    throw new WorkerError('internal', t('error.internal'));
  return { byteCount: m.byteCount, checksum: m.checksum };
}

/** Compresses a PDF in the worker (spike: pure Rust engine, default settings). */
export async function runCompress(input: Uint8Array): Promise<Uint8Array> {
  const m = await post('compress', input);
  if (m.type !== 'compressed')
    throw new WorkerError('internal', t('error.internal'));
  return new Uint8Array(m.output);
}

/** Spike (STORY-11), e2e build only: PDFium render in the worker. */
export function runPdfium(
  input: Uint8Array,
  index: number,
  dpi: number,
  all = false,
): Promise<PdfiumResultMessage> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, {
      resolve: (m) => resolve(m as PdfiumResultMessage),
      reject,
    });
    const buf = input.slice().buffer;
    const msg: WorkerIn = { type: 'pdfium', id, input: buf, index, dpi, all };
    getWorker().postMessage(msg, [buf]);
  });
}

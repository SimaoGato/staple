/// <reference lib="webworker" />
import { t } from '../i18n';
import { handleJob, type Core } from './handler';
import type { WorkerIn, WorkerOut } from './protocol';

// Lazy and cached: the .wasm is fetched on the first job only.
let core: Promise<Core> | undefined;
const load = (): Promise<Core> =>
  (core ??= import('../wasm-pkg/staple_wasm.js')
    .then(async (m) => {
      await m.default();
      return m;
    })
    .catch((e: unknown) => {
      core = undefined; // don't cache a failure: the next job retries
      throw e;
    }));

// Transfer the output bytes instead of cloning them.
const post = (out: WorkerOut) =>
  self.postMessage(
    out,
    out.type === 'compressed' || out.type === 'bytes' ? [out.output] : [],
  );

const internalError = (id: number): WorkerOut => ({
  type: 'error',
  id,
  code: 'internal',
  message: t('error.internal'),
});

self.onmessage = async (e: MessageEvent<WorkerIn>) => {
  const msg = e.data;
  try {
    if (msg.type === 'pdfium') {
      // PDFium ships only in the e2e build; production answers with a plain error.
      return post(
        import.meta.env.MODE === 'e2e'
          ? await (await import('./pdfium')).renderJob(msg)
          : internalError(msg.id),
      );
    }
    handleJob(msg, await load(), post);
  } catch {
    // Load failure (e.g. network): report instead of leaving the job hanging.
    post(internalError(msg.id));
  }
};

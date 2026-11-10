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

const post = (out: WorkerOut) => self.postMessage(out);

self.onmessage = async (e: MessageEvent<WorkerIn>) => {
  const msg = e.data;
  try {
    handleJob(msg, await load(), post);
  } catch {
    // Load failure (e.g. network): report instead of leaving the job hanging.
    post({
      type: 'error',
      id: msg.id,
      code: 'internal',
      message: t('error.internal'),
    });
  }
};

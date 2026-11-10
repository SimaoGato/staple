import { t } from '../i18n';
import {
  ERROR_CODES,
  type ErrorCode,
  type JobMessage,
  type WorkerOut,
} from './protocol';

/** The slice of the wasm module the handler needs. Injected so tests need no wasm. */
export type Core = {
  demo(
    input: Uint8Array,
    onProgress: (percent: number) => void,
  ): { byte_count: number; checksum: number };
};

const MESSAGES = {
  empty_input: t('error.empty_input'),
  too_large: t('error.too_large'),
  internal: t('error.internal'),
} satisfies Record<ErrorCode, string>;

const toCode = (e: unknown): ErrorCode =>
  ERROR_CODES.find((c) => c === e) ?? 'internal';

/** Runs one job. Never throws: every failure becomes an `error` message. */
export function handleJob(
  msg: JobMessage,
  core: Core,
  post: (out: WorkerOut) => void,
): void {
  try {
    const r = core.demo(new Uint8Array(msg.input), (percent) =>
      post({ type: 'progress', id: msg.id, percent }),
    );
    post({
      type: 'result',
      id: msg.id,
      byteCount: r.byte_count,
      checksum: r.checksum,
    });
  } catch (e) {
    const code = toCode(e);
    post({ type: 'error', id: msg.id, code, message: MESSAGES[code] });
  }
}

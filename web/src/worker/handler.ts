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
  compress_pdf(input: Uint8Array): Uint8Array;
};

const MESSAGES = {
  empty_input: t('error.empty_input'),
  too_large: t('error.too_large'),
  internal: t('error.internal'),
  not_pdf: t('error.not_pdf'),
  truncated: t('error.truncated'),
  parse: t('error.parse'),
  image: t('error.image'),
  cancelled: t('error.cancelled'),
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
    if (msg.op === 'compress') {
      const out = core.compress_pdf(new Uint8Array(msg.input));
      // slice(): typed ArrayBuffer (glue's .buffer is ArrayBufferLike); ~1 ms on 4 MB.
      const output = out.slice().buffer;
      return post({ type: 'compressed', id: msg.id, output });
    }
    if (msg.op === 'copy') {
      const input = new Uint8Array(msg.input);
      // Literal MODE test so the bundler drops the busy-wait loop from the default build.
      const delay = import.meta.env.MODE === 'e2e' ? (msg.delayMs ?? 0) : 0;
      core.demo(input, (percent) => {
        post({ type: 'progress', id: msg.id, percent });
        if (import.meta.env.MODE === 'e2e')
          for (const end = Date.now() + delay; Date.now() < end;);
      });
      return post({ type: 'bytes', id: msg.id, output: input.slice().buffer });
    }
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

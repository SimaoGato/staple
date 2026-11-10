import { describe, expect, it } from 'vitest';
import { handleJob, type Core } from './handler';
import type { WorkerOut } from './protocol';

const job = {
  type: 'job',
  id: 7,
  op: 'demo',
  input: new ArrayBuffer(3),
} as const;

function run(core: Core): WorkerOut[] {
  const out: WorkerOut[] = [];
  handleJob(job, core, (m) => out.push(m));
  return out;
}

describe('handleJob', () => {
  it('posts progress before the result', () => {
    const out = run({
      demo(_input, onProgress) {
        onProgress(0);
        onProgress(100);
        return { byte_count: 3, checksum: 9 };
      },
    });
    expect(out).toEqual([
      { type: 'progress', id: 7, percent: 0 },
      { type: 'progress', id: 7, percent: 100 },
      { type: 'result', id: 7, byteCount: 3, checksum: 9 },
    ]);
  });

  it('maps a thrown code to a typed error', () => {
    const out = run({
      demo() {
        throw 'empty_input';
      },
    });
    expect(out).toEqual([
      {
        type: 'error',
        id: 7,
        code: 'empty_input',
        message: 'The file is empty.',
      },
    ]);
  });

  it.each([new Error('boom'), 42, 'unknown_code', undefined])(
    'maps %s to internal without throwing',
    (thrown) => {
      const out = run({
        demo() {
          throw thrown;
        },
      });
      expect(out).toMatchObject([{ type: 'error', code: 'internal' }]);
    },
  );
});

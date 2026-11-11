import { describe, expect, it } from 'vitest';
import { handleJob, handleZip, type Core } from './handler';
import { ERROR_CODES, type WorkerOut, type ZipJobMessage } from './protocol';

const job = {
  type: 'job',
  id: 7,
  op: 'demo',
  input: new ArrayBuffer(3),
} as const;

function run(core: Pick<Core, 'demo'>): WorkerOut[] {
  const out: WorkerOut[] = [];
  handleJob(
    job,
    {
      compress_pdf() {
        throw 'internal';
      },
      zip_files() {
        throw 'internal';
      },
      ...core,
    },
    (m) => out.push(m),
  );
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

describe('handleJob compress', () => {
  const cjob = {
    ...job,
    op: 'compress',
    input: new Uint8Array([1, 2]).buffer,
  } as const;
  const core: Core = {
    demo: () => ({ byte_count: 0, checksum: 0 }),
    compress_pdf: (i) => i.slice(1),
    zip_files: () => new Uint8Array(),
  };

  it('posts the compressed bytes', () => {
    const out: WorkerOut[] = [];
    handleJob(cjob, core, (m) => out.push(m));
    expect(out).toEqual([
      { type: 'compressed', id: 7, output: new Uint8Array([2]).buffer },
    ]);
  });

  it('maps a core error code to a typed error', () => {
    const out: WorkerOut[] = [];
    handleJob(
      cjob,
      {
        ...core,
        compress_pdf() {
          throw 'not_pdf';
        },
      },
      (m) => out.push(m),
    );
    expect(out).toMatchObject([
      { type: 'error', code: 'not_pdf', message: 'This file is not a PDF.' },
    ]);
  });
});

describe('handleJob copy', () => {
  const core: Core = {
    demo: (_i, onProgress) => {
      onProgress(50);
      return { byte_count: 0, checksum: 0 };
    },
    compress_pdf: (i) => i,
    zip_files: () => new Uint8Array(),
  };
  const cp = {
    ...job,
    op: 'copy',
    input: new Uint8Array([4, 5]).buffer,
    delayMs: 100000,
  } as const;

  it('posts progress then a byte-equal copy; delayMs ignored outside e2e', () => {
    const out: WorkerOut[] = [];
    const t0 = Date.now();
    handleJob(cp, core, (m) => out.push(m));
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(out).toEqual([
      { type: 'progress', id: 7, percent: 50 },
      { type: 'bytes', id: 7, output: new Uint8Array([4, 5]).buffer },
    ]);
  });

  it('has the cancelled code', () => {
    expect(ERROR_CODES).toContain('cancelled');
  });
});

describe('handleZip', () => {
  const zjob: ZipJobMessage = {
    type: 'zip',
    id: 7,
    names: ['a', 'b'],
    datas: [new Uint8Array([1]).buffer, new Uint8Array([2]).buffer],
  };
  const core = (zip_files: Core['zip_files']): Core => ({
    demo: () => ({ byte_count: 0, checksum: 0 }),
    compress_pdf: (i) => i,
    zip_files,
  });

  it('posts the zip bytes', () => {
    const out: WorkerOut[] = [];
    let seen: [string[], number[]] | undefined;
    handleZip(
      zjob,
      core((n, d) => {
        seen = [n, d.map((x) => x[0] as number)];
        return new Uint8Array([9]);
      }),
      (m) => out.push(m),
    );
    expect(seen).toEqual([
      ['a', 'b'],
      [1, 2],
    ]);
    expect(out).toEqual([
      { type: 'bytes', id: 7, output: new Uint8Array([9]).buffer },
    ]);
  });

  it.each([
    ['too_large', 'too_large'],
    ['nope', 'internal'],
  ])('maps thrown %s to %s', (thrown, code) => {
    const out: WorkerOut[] = [];
    handleZip(
      zjob,
      core(() => {
        throw thrown;
      }),
      (m) => out.push(m),
    );
    expect(out).toMatchObject([{ type: 'error', id: 7, code }]);
  });
});

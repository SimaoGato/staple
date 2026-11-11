// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { runZip, WorkerError } from '../worker/client';
import { createResults, downloadBytes } from './result';

vi.mock('../worker/client', () => ({
  runZip: vi.fn(),
  WorkerError: class extends Error {
    constructor(
      readonly code: string,
      message: string,
    ) {
      super(message);
    }
  },
}));

const outs = [
  { bytes: new Uint8Array(58), name: 'a.pdf', inputSize: 100 },
  { bytes: new Uint8Array(2048), name: 'b.pdf', inputSize: 0 },
];

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

it('renders one card per output in order with size, change and label', () => {
  const r = createResults(outs, () => {}, 'staple-x.zip');
  const cards = [...r.el.querySelectorAll('.result-card')];
  expect(cards).toHaveLength(2);
  expect(cards[0]?.textContent).toContain('a.pdf');
  expect(cards[0]?.textContent).toContain('58 B');
  expect(cards[0]?.textContent).toContain('42% smaller');
  expect(cards[1]?.textContent).toContain('2.0 KB');
  expect(cards[1]?.querySelector('.result-change')).toBeNull();
  expect(cards[1]?.querySelector('button')?.getAttribute('aria-label')).toBe(
    'Download b.pdf',
  );
});

it('announces the count and calls onStartOver', async () => {
  vi.useRealTimers(); // proves the real frame callback fires
  const cb = vi.fn();
  const r = createResults(outs, cb, 'staple-x.zip');
  document.body.append(r.el);
  r.focus();
  await vi.waitFor(() =>
    expect(r.el.querySelector('[role=status]')?.textContent).toBe(
      'Done: 2 files ready',
    ),
  );
  expect(document.activeElement?.tagName).toBe('H2');
  [...r.el.querySelectorAll('button')].at(-1)?.click();
  expect(cb).toHaveBeenCalledOnce();
});

it('downloads with the name, revokes later, and works twice', () => {
  const create = vi.fn(() => 'blob:x');
  const revoke = vi.fn();
  vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke });
  const names: string[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    names.push(this.download);
  });
  downloadBytes(new Uint8Array(1), 'a.pdf');
  expect(names).toEqual(['a.pdf']);
  expect(revoke).not.toHaveBeenCalled();
  vi.runAllTimers();
  expect(revoke).toHaveBeenCalledWith('blob:x');
  downloadBytes(new Uint8Array(1), 'a.pdf');
  expect(create).toHaveBeenCalledTimes(2);
});

it('revokes the object URL after the card Download button is clicked', () => {
  const revoke = vi.fn();
  vi.stubGlobal('URL', {
    createObjectURL: () => 'blob:card',
    revokeObjectURL: revoke,
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  const r = createResults(outs, () => {}, 'staple-x.zip');
  r.el.querySelector<HTMLElement>('.result-card button')?.click();
  expect(revoke).not.toHaveBeenCalled();
  vi.runAllTimers();
  expect(revoke).toHaveBeenCalledWith('blob:card');
});

const zipBtn = (r: { el: HTMLElement }) =>
  r.el.querySelector<HTMLButtonElement>('button.result-zip');
const nextFrame = () => vi.advanceTimersByTimeAsync(20);

it('shows the ZIP button above the list only for 2+ outputs', () => {
  const r = createResults(outs, () => {}, 'staple-x.zip');
  const z = zipBtn(r);
  expect(z?.textContent).toBe('Download all (ZIP)');
  expect(z?.getAttribute('aria-label')).toBe('Download all 2 files as ZIP');
  expect(
    z?.compareDocumentPosition(r.el.querySelector('.result-list') as Node),
  ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  expect(zipBtn(createResults(outs.slice(0, 1), () => {}, 'x.zip'))).toBeNull();
});

it('disables while building, downloads the ZIP under its name, then re-enables', async () => {
  const revoke = vi.fn();
  vi.stubGlobal('URL', {
    createObjectURL: () => 'blob:zip',
    revokeObjectURL: revoke,
  });
  const names: string[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    names.push(this.download);
  });
  let done!: (b: Uint8Array) => void;
  vi.mocked(runZip).mockReturnValue(new Promise((r) => (done = r)));
  const r = createResults(outs, () => {}, 'staple-x.zip');
  document.body.append(r.el);
  const z = zipBtn(r) as HTMLButtonElement;
  z.click();
  await nextFrame();
  expect(z.disabled).toBe(true);
  expect(z.textContent).toBe('Preparing ZIP…');
  expect(r.el.querySelector('[role=status]')?.textContent).toBe(
    'Preparing ZIP…',
  );
  expect(runZip).toHaveBeenCalledWith(outs);
  done(new Uint8Array(1));
  await nextFrame();
  expect(names).toEqual(['staple-x.zip']);
  expect(z.disabled).toBe(false);
  expect(z.textContent).toBe('Download all (ZIP)');
  vi.runAllTimers();
  expect(revoke).toHaveBeenCalledWith('blob:zip');
});

it('shows a visible alert on failure, keeps single downloads, clears on retry', async () => {
  vi.stubGlobal('URL', {
    createObjectURL: () => 'blob:c',
    revokeObjectURL: () => {},
  });
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => {});
  vi.mocked(runZip).mockRejectedValueOnce(
    new WorkerError('too_large', 'The file is too large.'),
  );
  const r = createResults(outs, () => {}, 'staple-x.zip');
  document.body.append(r.el);
  const z = zipBtn(r) as HTMLButtonElement;
  z.click();
  await nextFrame();
  const err = r.el.querySelector<HTMLElement>('p.result-zip-error');
  expect(err?.getAttribute('role')).toBe('alert');
  expect(err?.hidden).toBe(false);
  expect(err?.textContent).toBe('The file is too large.');
  expect(err?.closest('.visually-hidden')).toBeNull();
  expect(z.disabled).toBe(false);
  r.el.querySelector<HTMLButtonElement>('.result-card button')?.click();
  expect(click).toHaveBeenCalledOnce();
  vi.mocked(runZip).mockReturnValueOnce(new Promise(() => {}));
  z.click();
  expect(err?.hidden).toBe(true);
  expect(err?.textContent).toBe('');
});

it('does not touch a destroyed view when the ZIP finishes', async () => {
  let done!: (b: Uint8Array) => void;
  vi.mocked(runZip).mockReturnValue(new Promise((r) => (done = r)));
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => {});
  const r = createResults(outs, () => {}, 'staple-x.zip');
  zipBtn(r)?.click();
  r.destroy();
  done(new Uint8Array(1));
  await nextFrame();
  expect(click).not.toHaveBeenCalled();
  expect(zipBtn(r)?.disabled).toBe(true);
});

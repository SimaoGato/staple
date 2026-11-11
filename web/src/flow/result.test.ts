// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createResults, downloadBytes } from './result';

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
  const r = createResults(outs, () => {});
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
  const r = createResults(outs, cb);
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
  const r = createResults(outs, () => {});
  r.el.querySelector('button')?.click();
  expect(revoke).not.toHaveBeenCalled();
  vi.runAllTimers();
  expect(revoke).toHaveBeenCalledWith('blob:card');
});

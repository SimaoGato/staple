import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInput } from './input';
import type { ToolSpec } from './spec';

const multi: ToolSpec = { accept: [], mimes: [], multiple: true };
const single: ToolSpec = { ...multi, multiple: false };
const pdf: ToolSpec = {
  accept: ['.pdf'],
  mimes: ['application/pdf'],
  multiple: true,
};
const file = (name: string, type = '') => new File(['x'], name, { type });

let cur: ReturnType<typeof createInput>;
const make = (spec: ToolSpec) => {
  cur = createInput(spec);
  document.body.replaceChildren(cur.el);
  return cur;
};
const drop = (files: File[]) => {
  const ev = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'dataTransfer', { value: { files } });
  cur.el.querySelector('.dropzone')!.dispatchEvent(ev);
  return ev;
};
const names = () =>
  [...cur.el.querySelectorAll('.file-name')].map((e) => e.textContent);
const live = () => cur.el.querySelector('[role=status]')!.textContent;
const removeBtn = (i: number) =>
  cur.el.querySelectorAll<HTMLButtonElement>('.file-list button')[i]!;
const frame = () => vi.advanceTimersToNextFrame();

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['requestAnimationFrame', 'cancelAnimationFrame'],
  });
});
afterEach(() => {
  cur.destroy();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('createInput', () => {
  it('picker input gets accept and multiple only for multi tools', () => {
    const i = make(pdf).el.querySelector('input')!;
    expect(i.accept).toBe('.pdf,application/pdf');
    expect(i.multiple).toBe(true);
    expect(make(single).el.querySelector('input')!.multiple).toBe(false);
  });

  it('multi: lists in drop order with size, appends later adds', () => {
    make(multi);
    drop([file('b'), file('a'), file('c')]);
    expect(names()).toEqual(['b', 'a', 'c']);
    expect(cur.el.querySelector('.file-size')!.textContent).toBe('1 B');
    drop([file('d')]);
    expect(names()).toEqual(['b', 'a', 'c', 'd']);
    frame();
    expect(live()).toBe('1 file added');
  });

  it('drop prevents default', () => {
    make(multi);
    expect(drop([file('a')]).defaultPrevented).toBe(true);
  });

  it('single: keeps first of two and names it; new file replaces', () => {
    make(single);
    drop([file('a'), file('b')]);
    expect(names()).toEqual(['a']);
    expect(cur.el.querySelector('.flow-error')!.textContent).toBe(
      'This tool takes one file at a time. Using a.',
    );
    drop([file('c')]);
    expect(names()).toEqual(['c']);
    expect(cur.el.querySelector('.flow-error')!.textContent).toBe('');
  });

  it('mixed drop keeps the good file, names the bad one, announces once', () => {
    make(pdf);
    const set = vi.spyOn(Node.prototype, 'textContent', 'set');
    drop([file('a.pdf', 'application/pdf'), file('photo.png', 'image/png')]);
    expect(names()).toEqual(['a.pdf']);
    expect(cur.el.querySelector('.flow-error')!.textContent).toBe(
      'photo.png is not a supported file type.',
    );
    set.mockClear();
    frame();
    expect(live()).toBe('1 file added photo.png is not a supported file type.');
    expect(set).toHaveBeenCalledTimes(1);
  });

  it('all rejected: nothing listed, existing single file kept', () => {
    make({ ...pdf, multiple: false });
    drop([file('a.pdf')]);
    drop([file('x.png')]);
    expect(names()).toEqual(['a.pdf']);
  });

  it('picker change adds files', () => {
    make(multi);
    const i = cur.el.querySelector('input')!;
    Object.defineProperty(i, 'files', {
      value: [file('p')],
      configurable: true,
    });
    i.dispatchEvent(new Event('change'));
    expect(names()).toEqual(['p']);
  });

  it('remove moves focus to the next, then last, then the choose button', () => {
    make(multi);
    drop([file('a'), file('b'), file('c')]);
    removeBtn(1).click();
    expect(document.activeElement).toBe(removeBtn(1)); // c
    expect(removeBtn(1).textContent).toBe('Remove c');
    removeBtn(1).click();
    expect(document.activeElement).toBe(removeBtn(0)); // a
    removeBtn(0).click();
    expect(document.activeElement).toBe(cur.el.querySelector('.choose'));
    frame();
    expect(live()).toBe('a removed');
  });

  it('re-announces identical text: clears, then sets on the next frame', () => {
    make(multi);
    for (let n = 0; n < 2; n++) {
      drop([file('a.pdf')]);
      frame();
      removeBtn(0).click();
      expect(live()).toBe('');
      frame();
      expect(live()).toBe('a.pdf removed');
    }
  });

  it('destroy removes the window listeners', () => {
    make(multi);
    const spy = vi.spyOn(window, 'removeEventListener');
    cur.destroy();
    expect(spy.mock.calls.map((c) => c[0]).sort()).toEqual([
      'dragover',
      'drop',
    ]);
  });

  it('page-wide drop is default-prevented', () => {
    make(multi);
    const ev = new Event('drop', { cancelable: true });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('reads no bytes when adding (AC11)', () => {
    const spy = vi.spyOn(File.prototype, 'arrayBuffer');
    const fr = vi.spyOn(FileReader.prototype, 'readAsArrayBuffer');
    make(multi);
    drop([file('a')]);
    expect(spy).not.toHaveBeenCalled();
    expect(fr).not.toHaveBeenCalled();
  });
});

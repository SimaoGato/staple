import { describe, expect, it } from 'vitest';
import { isAccepted, type ToolSpec } from './spec';

const pdf: ToolSpec = {
  accept: ['.pdf'],
  mimes: ['application/pdf'],
  multiple: true,
};
const any: ToolSpec = { accept: [], mimes: [], multiple: true };

describe('isAccepted', () => {
  it('extension is case-insensitive', () =>
    expect(isAccepted({ name: 'A.PDF', type: 'application/pdf' }, pdf)).toBe(
      true,
    ));
  it('empty MIME relies on the extension', () =>
    expect(isAccepted({ name: 'a.pdf', type: '' }, pdf)).toBe(true));
  it('MIME alone is enough', () =>
    expect(isAccepted({ name: 'a', type: 'application/pdf' }, pdf)).toBe(true));
  it('rejects other types', () =>
    expect(isAccepted({ name: 'p.png', type: 'image/png' }, pdf)).toBe(false));
  it('empty spec accepts any file', () =>
    expect(isAccepted({ name: 'x', type: '' }, any)).toBe(true));
});

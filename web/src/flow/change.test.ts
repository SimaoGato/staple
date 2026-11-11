import { expect, it } from 'vitest';
import { sizeChange } from './change';

it.each([
  [100, 58, { kind: 'smaller', percent: 42 }],
  [100, 103, { kind: 'larger', percent: 3 }],
  [1000, 1004, { kind: 'same', percent: 0 }],
  [100, 100, { kind: 'same', percent: 0 }],
  [0, 5, null],
  [NaN, 5, null],
])('%d -> %d', (i, o, r) => expect(sizeChange(i, o)).toEqual(r));

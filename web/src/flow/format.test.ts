import { expect, it } from 'vitest';
import { formatSize } from './format';

it.each([
  [0, '0 B'],
  [1023, '1023 B'],
  [1536, '1.5 KB'],
  [5 * 1024 ** 2, '5.0 MB'],
  [3 * 1024 ** 4, '3072.0 GB'],
])('%d -> %s', (n, s) => expect(formatSize(n)).toBe(s));

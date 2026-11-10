import { expect, it } from 'vitest';
import { checkAdd } from './limits';

it('allows 10,000 files totalling 20 GB: v1 has no caps', () => {
  const files = Array.from({ length: 10_000 }, () => ({
    size: 2 * 1024 ** 2 * 1000,
  }));
  expect(files.reduce((n, f) => n + f.size, 0)).toBeGreaterThanOrEqual(
    20 * 1024 ** 3,
  );
  expect(checkAdd([], files)).toEqual({ ok: true });
});

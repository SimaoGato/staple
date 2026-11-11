import { describe, expect, it } from 'vitest';
import { finished, monotonic, overall } from './run';

describe('run helpers', () => {
  it('overall spreads jobs across 0-100', () => {
    expect(overall(0, 3, 0)).toBe(0);
    expect(overall(1, 3, 50)).toBe(50);
    expect(overall(2, 3, 100)).toBe(100);
  });
  it('monotonic never decreases', () => {
    expect(monotonic(40, 30)).toBe(40);
    expect(monotonic(40, 50)).toBe(50);
  });
  it('finished counts the whole job', () => {
    expect(finished(0, 3)).toBe(33);
    expect(finished(2, 3)).toBe(100);
  });
});

import { describe, expect, it } from 'vitest';
import { resolve } from './router';

describe('resolve', () => {
  it('home', () => expect(resolve('/')).toEqual({ kind: 'home' }));
  it.each(['compress', 'merge', 'split', 'convert', 'resize'])(
    'tool %s',
    (id) => {
      expect(resolve(`/${id}`)).toEqual({ kind: 'tool', id });
    },
  );
  it('trailing slash', () =>
    expect(resolve('/merge/')).toEqual({ kind: 'tool', id: 'merge' }));
  it('unknown', () => expect(resolve('/nope')).toEqual({ kind: 'notFound' }));
});

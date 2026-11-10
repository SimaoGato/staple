import { en } from './en';

export type Key = keyof typeof en;

/** Returns the English string for `key`. An unknown key is a compile error. */
export function t(key: Key): string {
  return en[key];
}

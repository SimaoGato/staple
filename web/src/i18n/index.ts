import { en } from './en';

export type Key = keyof typeof en;

/** Returns the English string for `key`. An unknown key is a compile error. */
export function t(key: Key): string {
  return en[key];
}

/** `t()` plus `{name}`-style placeholder substitution. */
export function tf(key: Key, vars: Record<string, string | number>): string {
  return en[key].replace(/\{(\w+)\}/g, (m, k: string) =>
    k in vars ? String(vars[k]) : m,
  );
}

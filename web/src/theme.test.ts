import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, getChoice, initTheme, KEY, setChoice } from './theme';

let dark = false;
let onChange: (() => void) | undefined;
beforeEach(() => {
  dark = false;
  onChange = undefined;
  localStorage.clear();
  vi.stubGlobal('matchMedia', () => ({
    get matches() {
      return dark;
    },
    addEventListener: (_: string, f: () => void) => (onChange = f),
  }));
});
afterEach(() => vi.unstubAllGlobals());
const theme = () => document.documentElement.dataset.theme;

describe('theme', () => {
  it('defaults to system and follows the OS', () => {
    expect(getChoice()).toBe('system');
    dark = true;
    applyTheme();
    expect(theme()).toBe('dark');
  });
  it('stored choice wins over the OS; junk is ignored', () => {
    localStorage.setItem(KEY, 'dark');
    applyTheme();
    expect(theme()).toBe('dark');
    localStorage.setItem(KEY, 'light');
    dark = true;
    applyTheme();
    expect(theme()).toBe('light');
    localStorage.setItem(KEY, 'purple');
    expect(getChoice()).toBe('system');
  });
  it('system clears the stored key', () => {
    setChoice('dark');
    expect(localStorage.getItem(KEY)).toBe('dark');
    setChoice('system');
    expect(localStorage.getItem(KEY)).toBeNull();
  });
  it('still applies when storage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('no');
      },
      setItem: () => {
        throw new Error('no');
      },
      removeItem: () => {
        throw new Error('no');
      },
    });
    expect(getChoice()).toBe('system');
    setChoice('dark');
    expect(theme()).toBe('dark');
    expect(getChoice()).toBe('dark');
    setChoice('system');
  });
  it('OS change re-applies only in system', () => {
    initTheme();
    dark = true;
    onChange!();
    expect(theme()).toBe('dark');
    setChoice('light');
    dark = false;
    dark = true;
    onChange!();
    expect(theme()).toBe('light');
  });
  it('theme-init.js uses the same key', () => {
    const js = readFileSync(`${__dirname}/../public/theme-init.js`, 'utf8');
    expect(js.match(new RegExp(`'${KEY}'`, 'g'))).toHaveLength(1);
  });
});

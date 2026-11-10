export type Choice = 'system' | 'light' | 'dark';
export const KEY = 'staple-theme';
let memo: Choice = 'system'; // used only when storage throws
const query = () => matchMedia('(prefers-color-scheme: dark)');

export function getChoice(): Choice {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return memo;
  }
}

export function resolve(choice: Choice): 'light' | 'dark' {
  if (choice !== 'system') return choice;
  return query().matches ? 'dark' : 'light';
}

export function applyTheme(): void {
  document.documentElement.dataset.theme = resolve(getChoice());
}

export function setChoice(c: Choice): void {
  memo = c;
  try {
    if (c === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, c);
  } catch {
    // storage unavailable: choice lasts until reload
  }
  applyTheme();
}

export function initTheme(): void {
  query().addEventListener('change', () => {
    if (getChoice() === 'system') applyTheme();
  });
}

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { en } from './i18n/en';
import { TOOLS } from './tools';

const keys = Object.keys(en);

// Keys passed to t() in app source. `${id}` templates expand over every tool.
function usedKeys(): string[] {
  const files = readdirSync(__dirname, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .filter((f) => !f.startsWith('i18n'));
  const out: string[] = [];
  for (const f of files) {
    const src = readFileSync(join(__dirname, f), 'utf8');
    for (const [, key] of src.matchAll(/\bt\(\s*['"`]([^'"`]+)['"`]\s*\)/g)) {
      if (key.includes('${id}'))
        out.push(...TOOLS.map(({ id }) => key.replace('${id}', id)));
      else out.push(key);
    }
  }
  return out;
}

describe('i18n', () => {
  it('values are non-empty', () => {
    for (const v of Object.values(en)) expect(v.trim()).not.toBe('');
  });
  it('every t() key in the source exists', () => {
    const used = usedKeys();
    expect(used.length).toBeGreaterThan(0);
    for (const k of used) expect(keys, `missing key ${k}`).toContain(k);
  });
});

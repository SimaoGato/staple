import { describe, expect, it } from 'vitest';
import { en } from './i18n/en';
import { t } from './i18n';
import { TOOLS } from './tools';

describe('i18n', () => {
  it('values are non-empty', () => {
    for (const v of Object.values(en)) expect(v.length).toBeGreaterThan(0);
  });
  it('tools have keys', () => {
    for (const { id } of TOOLS) {
      expect(en).toHaveProperty(`tool.${id}.name`);
      expect(en).toHaveProperty(`tool.${id}.heading`);
    }
  });
  it('falls back to the key', () => {
    expect(t('nope' as never)).toBe('nope');
  });
});

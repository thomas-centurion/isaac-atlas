import { describe, expect, it } from 'vitest';
import en from './en.json';
import es from './es.json';

const flatten = (obj: Record<string, unknown>, prefix = ''): string[] =>
  Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null
      ? flatten(v as Record<string, unknown>, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );

describe('i18n', () => {
  it('ES y EN tienen exactamente las mismas claves', () => {
    expect(flatten(es).sort()).toEqual(flatten(en).sort());
  });
});

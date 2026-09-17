import { describe, expect, it } from 'vitest';
import { langFromUrl, pickFromUrl, pickToParam, type Pick } from '../src/web/api';

const valid = new Set(['tomato', 'apple', 'kale']);

describe('produce selection in the URL', () => {
  it('reads presets, all, and id lists, dropping unknown ids', () => {
    expect(pickFromUrl(valid, '?produce=top30')).toEqual({ kind: 'preset', n: 30 });
    expect(pickFromUrl(valid, '?produce=all')).toEqual({ kind: 'all' });
    expect(pickFromUrl(valid, '?produce=tomato,unknown,kale')).toEqual({ kind: 'ids', ids: ['tomato', 'kale'] });
    expect(pickFromUrl(valid, '?produce=unknown')).toBeNull();
    expect(pickFromUrl(valid, '?lat=1&lon=2')).toBeNull();
  });

  it('round-trips every kind', () => {
    const picks: Pick[] = [{ kind: 'preset', n: 10 }, { kind: 'all' }, { kind: 'ids', ids: ['apple', 'kale'] }];
    for (const p of picks) expect(pickFromUrl(valid, `?produce=${pickToParam(p)}`)).toEqual(p);
  });

  it('reads the language parameter', () => {
    expect(langFromUrl('?lat=1&lon=2&lang=de')).toBe('de');
    expect(langFromUrl('?lat=1&lon=2')).toBeNull();
  });
});

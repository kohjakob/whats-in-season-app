import { describe, expect, it } from 'vitest';
import { doyToWeek, emptyMask, maskToSpans, nearMask, storageMask } from '../src/engine/mask';

function maskOf(ranges: [number, number][]): boolean[] {
  const m = emptyMask();
  for (const [a, b] of ranges) for (let d = a; d <= b; d++) m[d] = true;
  return m;
}

describe('doyToWeek', () => {
  it('puts the last eight days into week 51', () => {
    expect(doyToWeek(0)).toBe(0);
    expect(doyToWeek(356)).toBe(50);
    expect(doyToWeek(357)).toBe(51);
    expect(doyToWeek(364)).toBe(51);
  });
});

describe('maskToSpans', () => {
  it('turns a mid-year block into one span', () => {
    expect(maskToSpans(maskOf([[140, 209]]), 'peak')).toEqual([{ level: 'peak', from: 20, to: 29 }]);
  });
  it('splits a season straddling New Year into two spans', () => {
    const spans = maskToSpans(maskOf([[350, 364], [0, 20]]), 'available');
    expect(spans).toEqual([
      { level: 'available', from: 0, to: 2 },
      { level: 'available', from: 50, to: 51 },
    ]);
  });
  it('ignores a week with fewer than half its days on', () => {
    expect(maskToSpans(maskOf([[7, 9]]), 'peak')).toEqual([]);
    expect(maskToSpans(maskOf([[7, 10]]), 'peak')).toEqual([{ level: 'peak', from: 1, to: 1 }]);
  });
});

describe('storageMask', () => {
  it('extends after the harvest without overlapping it and wraps the year', () => {
    const avail = maskOf([[340, 364]]);
    const stored = storageMask(avail, 30);
    expect(stored[364]).toBe(false);
    expect(stored[0]).toBe(true);
    expect(stored[29]).toBe(true);
    expect(stored[30]).toBe(false);
  });
  it('adds nothing for zero storage or a year-round produce', () => {
    expect(storageMask(maskOf([[100, 200]]), 0).some(Boolean)).toBe(false);
    expect(storageMask(new Array(365).fill(true), 60).some(Boolean)).toBe(false);
  });
});

describe('nearMask', () => {
  it('reaches the given number of days either side and wraps the year', () => {
    const near = nearMask(maskOf([[0, 9]]), 91);
    expect(near[100]).toBe(true);
    expect(near[101]).toBe(false);
    expect(near[364 - 90]).toBe(true);
    expect(near[364 - 91]).toBe(false);
  });
});

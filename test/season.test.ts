import { describe, expect, it } from 'vitest';
import { frostFreeRun, inRun, longestRun } from '../src/engine/season';

describe('longestRun', () => {
  it('returns null when nothing is true and the whole circle when everything is', () => {
    expect(longestRun([false, false, false])).toBeNull();
    expect(longestRun([true, true, true])).toEqual({ start: 0, end: 2, length: 3 });
  });
  it('finds a run in the middle', () => {
    expect(longestRun([false, true, true, true, false, true])).toEqual({ start: 1, end: 3, length: 3 });
  });
  it('finds a run that wraps the end of the array', () => {
    expect(longestRun([true, true, false, false, false, true])).toEqual({ start: 5, end: 1, length: 3 });
  });
});

describe('frostFreeRun', () => {
  it('anchors a year-round run at the coldest day', () => {
    const p = new Array(365).fill(0);
    expect(frostFreeRun(p, 0.1, 200)).toEqual({ start: 200, end: 199, length: 365 });
  });
  it('keeps a bounded run as is', () => {
    const p = new Array(365).fill(1).map((_, i) => (i >= 100 && i < 300 ? 0 : 1));
    expect(frostFreeRun(p, 0.1, 15)).toEqual({ start: 100, end: 299, length: 200 });
  });
});

describe('inRun', () => {
  it('handles wrapping runs', () => {
    const run = { start: 300, end: 50, length: 116 };
    expect(inRun(run, 300)).toBe(true);
    expect(inRun(run, 0)).toBe(true);
    expect(inRun(run, 50)).toBe(true);
    expect(inRun(run, 51)).toBe(false);
    expect(inRun(run, 299)).toBe(false);
  });
});

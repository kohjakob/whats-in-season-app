import { describe, expect, it } from 'vitest';
import type { ChartRow } from '../src/engine/types';
import { currentWeek, freshExtent, levelAt, levelHeights, ridgePath, touchesEdge, weekLabel, weekLabelLong, wrapsYear } from '../src/web/ridge';

const row: ChartRow = {
  produceId: 'tomato',
  name: 'Tomatoes',
  category: 'vegetable',
  spans: [
    { level: 'peak', from: 30, to: 36 },
    { level: 'available', from: 37, to: 41 },
    { level: 'stored', from: 42, to: 42 },
  ],
};

describe('levelHeights', () => {
  it('peak weeks count for both peak and available layers', () => {
    const peak = levelHeights(row, 'peak');
    const avail = levelHeights(row, 'available');
    expect(peak[30]).toBe(1);
    expect(peak[37]).toBe(0);
    expect(avail[30]).toBe(0.55);
    expect(avail[41]).toBe(0.55);
    expect(levelHeights(row, 'stored')[42]).toBe(0.25);
  });
});

describe('ridgePath', () => {
  const g = { x0: 100, cw: 10, baseline: 200, amplitude: 40 };
  it('is empty when nothing is on', () => {
    expect(ridgePath(new Array(52).fill(0), g)).toBe('');
  });
  it('starts and ends on the baseline and never goes below it', () => {
    const d = ridgePath(levelHeights(row, 'peak'), g);
    expect(d.startsWith('M100.0,200.0')).toBe(true);
    expect(d.endsWith('L620.0,200.0Z')).toBe(true);
    const ys = [...d.matchAll(/,(-?\d+\.\d)/g)].map((m) => Number(m[1]));
    expect(Math.max(...ys)).toBe(200);
    expect(Math.min(...ys)).toBe(160);
  });
});

describe('ridgePath across New Year', () => {
  const g = { x0: 100, cw: 10, baseline: 200, amplitude: 40 };
  const wrapped = new Array(52).fill(0).map((_, w) => (w <= 3 || w >= 48 ? 1 : 0));

  it('recognises a season that is on in both the first and the last week', () => {
    expect(wrapsYear(wrapped)).toBe(true);
    expect(wrapsYear(levelHeights(row, 'peak'))).toBe(false);
  });

  it('keeps full height at both edges instead of dipping to the baseline', () => {
    const d = ridgePath(wrapped, g);
    expect(d.startsWith('M100.0,200.0L100.0,160.0')).toBe(true);
    expect(d.endsWith('L620.0,160.0L620.0,200.0Z')).toBe(true);
    // the only shoulders are the ones at week 4 and week 48, none at the edges
    expect(d.match(/C/g)?.length).toBe(2);
  });

  it('fades a late-December end and an early-January start too, without inventing a wrap', () => {
    const lateDec = new Array(52).fill(0).map((_, w) => (w >= 46 ? 1 : 0));
    const dDec = ridgePath(lateDec, { ...g, extendLeft: 4.3 });
    expect(touchesEdge(lateDec)).toBe(true);
    expect(wrapsYear(lateDec)).toBe(false);
    expect(dDec.startsWith('M100.0,200.0L')).toBe(true);
    expect(dDec.endsWith('L620.0,160.0L620.0,200.0Z')).toBe(true);
    const earlyJan = new Array(52).fill(0).map((_, w) => (w <= 5 ? 1 : 0));
    const dJan = ridgePath(earlyJan, { ...g, extendLeft: 4.3 });
    // flat continuation of the January height across the whole left extension
    expect(dJan.startsWith('M50.0,200.0L50.0,160.0L155.5,160.0')).toBe(true);
    expect(dJan.endsWith('L620.0,200.0Z')).toBe(true);
  });

  it('draws the previous December left of week 0 when asked, only for wrapping seasons', () => {
    const d = ridgePath(wrapped, { ...g, extendLeft: 4.3 });
    // five weeks of last December are drawn from x = 50; week 47 is off there, week 48 rises at x = 60
    expect(d.startsWith('M50.0,200.0L50.0,200.0')).toBe(true);
    expect(d).toContain('L55.5,200.0C60.0,200.0 60.0,160.0 64.5,160.0');
    const plain = ridgePath(levelHeights(row, 'peak'), { ...g, extendLeft: 4.3 });
    expect(plain.startsWith('M100.0,200.0')).toBe(true);
  });
});

describe('helpers', () => {
  it('reports fresh extent, level at week and week labels', () => {
    expect(freshExtent(row)).toEqual({ first: 30, last: 41 });
    expect(levelAt(row, 33)).toBe('peak');
    expect(levelAt(row, 40)).toBe('available');
    expect(levelAt(row, 42)).toBe('stored');
    expect(levelAt(row, 5)).toBeNull();
    expect(weekLabel(0)).toBe('early Jan');
    expect(weekLabel(33)).toBe('late Aug');
    expect(weekLabelLong(33)).toBe('late August');
    expect(weekLabelLong(0)).toBe('early January');
    expect(currentWeek(new Date(Date.UTC(2026, 8, 16)))).toBe(36);
  });
});

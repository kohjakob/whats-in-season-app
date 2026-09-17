import { describe, expect, it } from 'vitest';
import { chillHoursOfDay, computeNormals, doyOf, percentile, smoothCircular } from '../src/engine/normals';
import type { DailySeries } from '../src/engine/types';

/** Synthetic northern-hemisphere climate: sinusoidal, coldest mid January, some winter frost. */
export function syntheticSeries(years = 3, meanT = 9, amplitude = 10): DailySeries {
  const s: DailySeries = { time: [], tmin: [], tmax: [], tmean: [], precip: [] };
  for (let y = 2001; y < 2001 + years; y++) {
    for (let d = 0; d < 365; d++) {
      const date = new Date(Date.UTC(y, 0, 1 + d));
      const t = meanT - amplitude * Math.cos((2 * Math.PI * (d - 15)) / 365);
      s.time.push(date.toISOString().slice(0, 10));
      s.tmean.push(t);
      s.tmin.push(t - 4);
      s.tmax.push(t + 4);
      s.precip.push(1.5);
    }
  }
  return s;
}

describe('doyOf', () => {
  it('maps Jan 1 to 0 and Dec 31 to 364 in ordinary years', () => {
    expect(doyOf('2001-01-01')).toBe(0);
    expect(doyOf('2001-12-31')).toBe(364);
  });
  it('folds leap-year Dec 31 onto 364', () => {
    expect(doyOf('2000-12-31')).toBe(364);
    expect(doyOf('2000-03-01')).toBe(60);
  });
});

describe('smoothCircular', () => {
  it('leaves a constant unchanged and wraps around the ends', () => {
    expect(smoothCircular([2, 2, 2, 2, 2], 3)).toEqual([2, 2, 2, 2, 2]);
    const out = smoothCircular([9, 0, 0, 0, 0], 3);
    expect(out[0]).toBeCloseTo(3);
    expect(out[4]).toBeCloseTo(3);
    expect(out[1]).toBeCloseTo(3);
    expect(out[2]).toBeCloseTo(0);
  });
});

describe('chillHoursOfDay', () => {
  it('counts a full day when the whole diurnal range sits in the chill band', () => {
    expect(chillHoursOfDay(1, 6)).toBe(24);
  });
  it('counts nothing on a warm day or a deep-freeze day', () => {
    expect(chillHoursOfDay(15, 25)).toBe(0);
    expect(chillHoursOfDay(-20, -10)).toBe(0);
  });
  it('counts part of a day that crosses the band', () => {
    const h = chillHoursOfDay(-2, 10);
    expect(h).toBeGreaterThan(6);
    expect(h).toBeLessThan(20);
  });
});

describe('percentile', () => {
  it('uses nearest rank', () => {
    expect(percentile([5, 1, 3], 0.5)).toBe(3);
    expect(percentile([5, 1, 3], 0.1)).toBe(1);
    expect(percentile([5, 1, 3], 0.9)).toBe(5);
  });
});

describe('computeNormals', () => {
  const n = computeNormals(syntheticSeries());

  it('recovers the seasonal curve and the coldest day', () => {
    expect(n.tmean).toHaveLength(365);
    expect(n.coldestDoy).toBeGreaterThanOrEqual(10);
    expect(n.coldestDoy).toBeLessThanOrEqual(20);
    expect(n.tmean[n.coldestDoy]).toBeCloseTo(-1, 0);
    expect(Math.max(...n.tmean)).toBeCloseTo(19, 0);
  });

  it('gives frost probability 1 in deep winter and 0 in summer', () => {
    expect(n.frostProb[15]).toBeCloseTo(1);
    expect(n.frostProb[200]).toBe(0);
  });

  it('reports winter low, chill and year count', () => {
    expect(n.annualMinTmin).toBeCloseTo(-5, 0);
    expect(n.chillHours).toBeGreaterThan(500);
    expect(n.years).toBe(3);
  });

  it('derives a frost-free season whose safe run sits inside the typical run', () => {
    const { safe, typical } = n.frostFree;
    expect(safe).not.toBeNull();
    expect(typical).not.toBeNull();
    // tmin = tmean - 4 crosses 0 C when tmean crosses 4 C, roughly day 78 and day 317 in the synthetic year
    expect(typical!.start).toBeGreaterThan(60);
    expect(typical!.start).toBeLessThan(100);
    expect(typical!.end).toBeGreaterThan(300);
    expect(typical!.end).toBeLessThan(340);
    expect(safe!.length).toBeLessThanOrEqual(typical!.length);
  });

  it('reports a year-round season for a frost-free climate', () => {
    const warm = computeNormals(syntheticSeries(3, 20, 5));
    expect(warm.frostFree.typical).toEqual({ start: warm.coldestDoy, end: (warm.coldestDoy + 364) % 365, length: 365 });
  });

  it('rejects mismatched arrays', () => {
    const s = syntheticSeries(1);
    s.tmax.pop();
    expect(() => computeNormals(s)).toThrow(/differ in length/);
  });
});

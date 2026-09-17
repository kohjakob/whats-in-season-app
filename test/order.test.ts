import { describe, expect, it } from 'vitest';
import { circularRuns, computeChart, peakMidWeek } from '../src/engine/compute';
import type { ChartRow, Span } from '../src/engine/types';
import { loadProduce } from '../src/produce/load';
import { computeNormals } from '../src/engine/normals';
import { toDailySeries, type OpenMeteoArchive } from '../src/climate/openMeteo';
import { readFileSync } from 'node:fs';

const row = (spans: Span[], name = 'x'): ChartRow => ({ produceId: name, name, category: 'vegetable', spans });
const peak = (from: number, to: number): Span => ({ level: 'peak', from, to });

describe('circularRuns', () => {
  it('joins a run across New Year into one', () => {
    const w = new Array(52).fill(false).map((_, i) => i <= 8 || i >= 44);
    expect(circularRuns(w)).toEqual([{ start: 44, length: 17 }]);
  });
});

describe('peakMidWeek', () => {
  it('takes the middle of a simple peak', () => {
    expect(peakMidWeek(row([peak(30, 36)]))).toBe(33);
  });

  it('puts a peak centred on New Year at the very top', () => {
    expect(peakMidWeek(row([peak(0, 8), peak(44, 51)]))).toBe(0);
  });

  it('keeps a mostly-December wrap at the bottom and a mostly-January wrap near the top', () => {
    expect(peakMidWeek(row([peak(0, 1), peak(46, 51)]))).toBe(49.5);
    expect(peakMidWeek(row([peak(0, 9), peak(50, 51)]))).toBe(3.5);
  });

  it('uses the longest peak when there are two', () => {
    expect(peakMidWeek(row([peak(16, 24), peak(36, 40)]))).toBe(20);
  });

  it('falls back to the available run, puts year-round peaks mid-year, and nothing fresh is null', () => {
    expect(peakMidWeek(row([{ level: 'available', from: 10, to: 20 }]))).toBe(15);
    expect(peakMidWeek(row([peak(0, 51)]))).toBe(25.5);
    expect(peakMidWeek(row([{ level: 'stored', from: 0, to: 10 }]))).toBeNull();
  });
});

describe('computeChart order', () => {
  it('sorts Berlin rows by peak middle, January first, nothing-fresh rows last', () => {
    const archive = JSON.parse(readFileSync(new URL('../data/fixtures/climate/berlin.json', import.meta.url), 'utf8')) as OpenMeteoArchive;
    const rows = computeChart(loadProduce(), computeNormals(toDailySeries(archive)));
    const mids = rows.map(peakMidWeek);
    const firstNull = mids.indexOf(null);
    const fresh = (firstNull < 0 ? mids : mids.slice(0, firstNull)) as number[];
    for (let i = 1; i < fresh.length; i++) expect(fresh[i]).toBeGreaterThanOrEqual(fresh[i - 1]);
    if (firstNull >= 0) expect(mids.slice(firstNull).every((m) => m === null)).toBe(true);
    // leek peaks late July to late February as one run, so its middle is mid November, below May asparagus
    const idx = (id: string) => rows.findIndex((r) => r.produceId === id);
    expect(idx('leek')).toBeGreaterThan(idx('asparagus'));
  });

  it('puts Sydney summer produce whose peak straddles New Year at the top', () => {
    const archive = JSON.parse(readFileSync(new URL('../data/fixtures/climate/sydney.json', import.meta.url), 'utf8')) as OpenMeteoArchive;
    const rows = computeChart(loadProduce(), computeNormals(toDailySeries(archive)));
    const first = rows[0];
    const peakWeeks = first.spans.filter((s) => s.level === 'peak');
    expect(peakMidWeek(first)).toBeLessThan(4);
    expect(peakWeeks.some((s) => s.from === 0)).toBe(true);
    expect(peakWeeks.some((s) => s.to === 51)).toBe(true);
  });
});

describe('available reach', () => {
  it('never shows available weeks more than about three months from a peak week', () => {
    const archive = JSON.parse(readFileSync(new URL('../data/fixtures/climate/berlin.json', import.meta.url), 'utf8')) as OpenMeteoArchive;
    for (const r of computeChart(loadProduce(), computeNormals(toDailySeries(archive)))) {
      const peakWeeks = r.spans.filter((s) => s.level === 'peak').flatMap((s) => Array.from({ length: s.to - s.from + 1 }, (_, i) => s.from + i));
      if (!peakWeeks.length) continue;
      for (const s of r.spans.filter((x) => x.level === 'available')) {
        for (let w = s.from; w <= s.to; w++) {
          const gap = Math.min(...peakWeeks.map((p) => Math.min(Math.abs(p - w), 52 - Math.abs(p - w))));
          // 91 days is 13 weeks; week rounding in maskToSpans can add one
          expect(gap, `${r.produceId} week ${w}`).toBeLessThanOrEqual(14);
        }
      }
    }
  });
});

describe('peak required', () => {
  it('gives every shown row a peak and every hidden row a reason, in every climate fixture', () => {
    for (const slug of ['berlin', 'sydney', 'nairobi', 'phoenix', 'salinas', 'geneva-ny', 'fresno', 'toronto', 'london']) {
      const archive = JSON.parse(readFileSync(new URL(`../data/fixtures/climate/${slug}.json`, import.meta.url), 'utf8')) as OpenMeteoArchive;
      for (const r of computeChart(loadProduce(), computeNormals(toDailySeries(archive)))) {
        if (r.spans.length) expect(r.spans.some((s) => s.level === 'peak'), `${slug} ${r.produceId}`).toBe(true);
        else expect(r.note, `${slug} ${r.produceId}`).toBeTruthy();
      }
    }
  });
});

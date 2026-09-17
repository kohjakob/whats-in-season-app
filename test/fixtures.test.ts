/**
 * Engine against real thirty-year ERA5 fixtures. Expectations come from what actually shows up at
 * markets in each place, written down before looking at model output, so a failure here means the
 * model or a produce record is wrong, not that the test needs adjusting.
 */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { computeNormals } from '../src/engine/normals';
import { computeChart } from '../src/engine/compute';
import type { ChartRow, Normals } from '../src/engine/types';
import { loadProduce } from '../src/produce/load';
import { toDailySeries, type OpenMeteoArchive } from '../src/climate/openMeteo';

const produce = loadProduce();

function load(slug: string): { normals: Normals; rows: Map<string, ChartRow> } {
  const file = new URL(`../data/fixtures/climate/${slug}.json`, import.meta.url).pathname;
  if (!existsSync(file)) throw new Error(`missing fixture ${slug}, run pnpm fetch-fixture`);
  const archive = JSON.parse(readFileSync(file, 'utf8')) as OpenMeteoArchive;
  const normals = computeNormals(toDailySeries(archive));
  const rows = new Map(computeChart(produce, normals).map((r) => [r.produceId, r]));
  return { normals, rows };
}

/** Weeks with fresh produce, peak or available. */
function freshWeeks(row: ChartRow): Set<number> {
  const s = new Set<number>();
  for (const span of row.spans) if (span.level !== 'stored') for (let w = span.from; w <= span.to; w++) s.add(w);
  return s;
}
function levelWeeks(row: ChartRow, level: ChartRow['spans'][number]['level']): Set<number> {
  const s = new Set<number>();
  for (const span of row.spans) if (span.level === level) for (let w = span.from; w <= span.to; w++) s.add(w);
  return s;
}
const has = (set: Set<number>, ...weeks: number[]) => weeks.every((w) => set.has(w));
const lacks = (set: Set<number>, ...weeks: number[]) => weeks.every((w) => !set.has(w));
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

describe('Berlin, humid continental', () => {
  const { normals, rows } = load('berlin');

  it('has a long cold winter with plenty of chill', () => {
    expect(normals.chillHours).toBeGreaterThan(1500);
    expect(normals.annualMinTmin).toBeLessThan(-8);
  });
  it('field tomatoes peak in August and are gone by November', () => {
    const peak = levelWeeks(rows.get('tomato')!, 'peak');
    expect(peak.size).toBeGreaterThan(0);
    expect([...peak].every((w) => w >= 30 && w <= 40)).toBe(true);
    expect(lacks(freshWeeks(rows.get('tomato')!), ...range(44, 51), ...range(0, 20))).toBe(true);
  });
  it('apples are picked late August to October and eaten from storage through winter', () => {
    const apple = rows.get('apple')!;
    expect([...levelWeeks(apple, 'peak')].every((w) => w >= 32 && w <= 42)).toBe(true);
    expect(has(levelWeeks(apple, 'stored'), ...range(0, 8))).toBe(true);
  });
  it('kale stands through winter and disappears in late spring', () => {
    const kale = freshWeeks(rows.get('kale')!);
    expect(has(kale, 2, 44)).toBe(true);
    expect(lacks(kale, 18)).toBe(true);
  });
  it('spinach peaks in spring and again in autumn', () => {
    const peak = levelWeeks(rows.get('spinach')!, 'peak');
    expect(range(18, 26).some((w) => peak.has(w))).toBe(true);
    expect(range(36, 44).some((w) => peak.has(w))).toBe(true);
  });
  it('cherries are a June produce', () => {
    const peak = levelWeeks(rows.get('sweet-cherry')!, 'peak');
    expect(peak.size).toBeGreaterThan(0);
    expect([...peak].every((w) => w >= 22 && w <= 29)).toBe(true);
  });
  it('has no fresh strawberries in January', () => {
    expect(lacks(freshWeeks(rows.get('strawberry')!), 0, 1, 2, 3)).toBe(true);
  });
});

describe('Sydney, southern hemisphere subtropical', () => {
  const { normals, rows } = load('sydney');

  it('never frosts on the coast', () => {
    expect(Math.max(...normals.frostProb)).toBeLessThan(0.1);
  });
  it('tomatoes span New Year and are absent in August', () => {
    const fresh = freshWeeks(rows.get('tomato')!);
    expect(has(fresh, ...range(0, 10), 50, 51)).toBe(true);
    expect(lacks(fresh, ...range(30, 36))).toBe(true);
  });
  it('grows lettuce in every quarter', () => {
    expect(has(freshWeeks(rows.get('lettuce')!), 5, 20, 33, 46)).toBe(true);
  });
  it('has no local apples and says why', () => {
    const apple = rows.get('apple')!;
    expect(apple.spans).toEqual([]);
    expect(apple.note).toMatch(/chill/);
  });
});

describe('Nairobi, tropical highland', () => {
  const { normals, rows } = load('nairobi');

  it('has neither frost nor chill', () => {
    expect(normals.chillHours).toBeLessThan(10);
    expect(Math.max(...normals.frostProb)).toBe(0);
  });
  it('has tomatoes all year and no temperate tree fruit', () => {
    expect(freshWeeks(rows.get('tomato')!).size).toBe(52);
    expect(rows.get('apple')!.spans).toEqual([]);
    expect(rows.get('sweet-cherry')!.spans).toEqual([]);
  });
});

describe('Phoenix, hot desert', () => {
  const { rows } = load('phoenix');

  it('grows spinach in winter, none in high summer', () => {
    const fresh = freshWeeks(rows.get('spinach')!);
    expect(has(fresh, 2)).toBe(true);
    expect(lacks(fresh, ...range(24, 34))).toBe(true);
  });
  it('has a spring and an autumn tomato produce with a heat gap between', () => {
    const fresh = freshWeeks(rows.get('tomato')!);
    expect(range(18, 24).some((w) => fresh.has(w))).toBe(true);
    expect(range(42, 50).some((w) => fresh.has(w))).toBe(true);
    expect(lacks(fresh, ...range(28, 36))).toBe(true);
  });
  it('has no apples', () => {
    expect(rows.get('apple')!.spans).toEqual([]);
  });
});

describe('Salinas, cool Mediterranean coast', () => {
  const { rows } = load('salinas');

  it('is lettuce country most of the year', () => {
    expect(freshWeeks(rows.get('lettuce')!).size).toBeGreaterThanOrEqual(30);
  });
  it('has strawberries in early summer', () => {
    expect(has(freshWeeks(rows.get('strawberry')!), 22)).toBe(true);
  });
});

describe('Geneva NY, Finger Lakes', () => {
  const { rows } = load('geneva-ny');

  it('apples peak September to October as the state harvest chart says', () => {
    const peak = levelWeeks(rows.get('apple')!, 'peak');
    expect(peak.size).toBeGreaterThan(0);
    expect([...peak].every((w) => w >= 33 && w <= 44)).toBe(true);
  });
  it('sweetcorn is a mid-July to early October produce', () => {
    const fresh = freshWeeks(rows.get('sweetcorn')!);
    expect(fresh.size).toBeGreaterThan(0);
    expect([...fresh].every((w) => w >= 27 && w <= 42)).toBe(true);
  });
});

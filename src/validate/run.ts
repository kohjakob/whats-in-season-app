import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeNormals } from '../engine/normals';
import { computeChart } from '../engine/compute';
import type { ChartRow } from '../engine/types';
import { loadProduce } from '../produce/load';
import { toDailySeries, type OpenMeteoArchive } from '../climate/openMeteo';
import type { TruthSet } from './truth';
import { scoreSet, type SetScore } from './score';

const ROOT = new URL('../../', import.meta.url).pathname;
export const TRUTH_DIR = join(ROOT, 'data', 'fixtures', 'truth');
const CLIMATE_DIR = join(ROOT, 'data', 'fixtures', 'climate');

export function loadTruthSets(dir = TRUTH_DIR): TruthSet[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as TruthSet);
}

const chartCache = new Map<string, ChartRow[]>();

export function chartForFixture(slug: string): ChartRow[] {
  let rows = chartCache.get(slug);
  if (!rows) {
    const archive = JSON.parse(readFileSync(join(CLIMATE_DIR, `${slug}.json`), 'utf8')) as OpenMeteoArchive;
    rows = computeChart(loadProduce(), computeNormals(toDailySeries(archive)));
    chartCache.set(slug, rows);
  }
  return rows;
}

export function scoreAll(sets = loadTruthSets()): SetScore[] {
  return sets.map((t) => scoreSet(t, new Map(t.fixtures.map((f) => [f, chartForFixture(f)]))));
}

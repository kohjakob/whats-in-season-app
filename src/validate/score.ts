import type { ChartRow } from '../engine/types';
import type { TruthSet } from './truth';

export interface ItemScore {
  name: string;
  produce: string;
  truthWeeks: number;
  modelWeeks: number;
  /** Intersection over union of fresh weeks */
  jaccard: number;
  /** Share of truth weeks the model covers */
  recall: number;
  /** Share of model weeks the truth confirms */
  precision: number;
  /** Same, with the model's stored weeks counted as available, for charts that do not separate storage */
  jaccardWithStorage: number;
  modelFresh: number[];
  modelStored: number[];
  truthFresh: number[];
}

export interface SetScore {
  id: string;
  region: string;
  items: ItemScore[];
  unmodelled: string[];
  meanJaccard: number;
  meanJaccardWithStorage: number;
  meanRecall: number;
  meanPrecision: number;
}

function weeksOf(rows: ChartRow[], levels: Set<string>): Set<number> {
  const s = new Set<number>();
  for (const row of rows) {
    for (const span of row.spans) {
      if (!levels.has(span.level)) continue;
      for (let w = span.from; w <= span.to; w++) s.add(w);
    }
  }
  return s;
}

function jaccard(a: Set<number>, b: Set<number>): number {
  if (!a.size && !b.size) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

function mean(v: number[]): number {
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}

/**
 * Score one truth set against model rows. `rowsByFixture` holds the chart for each climate
 * fixture the region is made of; an item counts as fresh in a week if any fixture says so, the
 * same way vertumnus unions its shipping districts.
 */
export function scoreSet(truth: TruthSet, rowsByFixture: Map<string, ChartRow[]>): SetScore {
  const items: ItemScore[] = [];
  const unmodelled: string[] = [];
  for (const item of truth.items) {
    if (!item.produce) {
      unmodelled.push(item.name);
      continue;
    }
    const produce = item.produce;
    const rows = truth.fixtures.flatMap((f) => (rowsByFixture.get(f) ?? []).filter((r) => r.produceId === produce));
    if (!rows.length) throw new Error(`${truth.id}: no model row for produce ${produce} (${item.name})`);
    const fresh = weeksOf(rows, new Set(['peak', 'available']));
    const stored = weeksOf(rows, new Set(['stored']));
    const withStorage = new Set([...fresh, ...stored]);
    const t = new Set(item.fresh_weeks);
    let inter = 0;
    for (const w of fresh) if (t.has(w)) inter++;
    items.push({
      name: item.name,
      produce,
      truthWeeks: t.size,
      modelWeeks: fresh.size,
      jaccard: jaccard(fresh, t),
      recall: t.size ? inter / t.size : 1,
      precision: fresh.size ? inter / fresh.size : 0,
      jaccardWithStorage: jaccard(withStorage, t),
      modelFresh: [...fresh].sort((a, b) => a - b),
      modelStored: [...stored].sort((a, b) => a - b),
      truthFresh: [...t].sort((a, b) => a - b),
    });
  }
  items.sort((a, b) => a.jaccard - b.jaccard);
  return {
    id: truth.id,
    region: truth.region,
    items,
    unmodelled,
    meanJaccard: mean(items.map((i) => i.jaccard)),
    meanJaccardWithStorage: mean(items.map((i) => i.jaccardWithStorage)),
    meanRecall: mean(items.map((i) => i.recall)),
    meanPrecision: mean(items.map((i) => i.precision)),
  };
}

/** 52-character strip, one glyph per week: both, model only, truth only, neither. */
export function strip(model: number[], truth: number[]): string {
  const m = new Set(model);
  const t = new Set(truth);
  let s = '';
  for (let w = 0; w < 52; w++) {
    s += m.has(w) && t.has(w) ? '█' : m.has(w) ? '▓' : t.has(w) ? '░' : '·';
  }
  return s;
}

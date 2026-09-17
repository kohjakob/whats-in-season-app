import type { ChartRow, DayMask, Normals, Span } from './types';
import type { Produce } from '../produce/schema';
import { andMask, andNotMask, emptyMask, maskToSpans, nearMask, orMask, storageMask } from './mask';
import { warmAnnualMask } from './models/warmAnnual';
import { coolAnnualMask, finishMask } from './models/coolAnnual';
import { perennialMask } from './models/perennial';

/** Early and late cultivars beyond the mainstream spread, counted as "available" */
export const PERENNIAL_SLACK_DAYS = 14;

interface Pass {
  peak: DayMask;
  available: DayMask;
  note?: string;
}

function runModels(produce: Produce, n: Normals): Pass {
  const grow: [number, number] = [produce.thermal.t_grow_min_c, produce.thermal.t_grow_max_c];
  const opt = produce.thermal.t_opt_c;

  switch (produce.kind) {
    case 'warm_annual': {
      const p = {
        tBase: produce.model.t_base_c,
        tGrowMin: produce.thermal.t_grow_min_c,
        tGrowMax: produce.thermal.t_grow_max_c,
        gddToFirstHarvest: produce.model.gdd_to_first_harvest,
        harvestDurationDays: produce.model.harvest_duration_days,
      };
      const { safe, typical } = n.frostFree;
      if (!typical) return { peak: emptyMask(), available: emptyMask(), note: 'no frost-free season' };
      return {
        peak: safe ? warmAnnualMask(n, safe, p, opt) : emptyMask(),
        available: warmAnnualMask(n, typical, p, grow),
      };
    }
    case 'cool_annual': {
      const p = {
        tGrowMin: produce.thermal.t_grow_min_c,
        tGrowMax: produce.thermal.t_grow_max_c,
        tKill: produce.thermal.t_kill_c,
        cycleDays: produce.model.cycle_days,
        standDays: produce.model.stand_days,
      };
      const available = coolAnnualMask(n, p, grow);
      return { peak: andMask(available, finishMask(n, opt)), available };
    }
    case 'perennial': {
      const p = {
        chillHoursMin: produce.model.chill_hours_min,
        tKillDormant: produce.model.t_kill_dormant_c,
        bloomT: produce.model.bloom_t_c,
        bloomToHarvestDays: produce.model.bloom_to_harvest_days,
        everbearing: produce.model.everbearing,
        tOpt: opt,
      };
      const peak = perennialMask(n, p, 0, false);
      const available = perennialMask(n, p, PERENNIAL_SLACK_DAYS, true);
      return { peak: peak.mask, available: available.mask, note: peak.note };
    }
  }
}

/** "Available" never reaches further than about three months before or after the peak */
export const AVAILABLE_REACH_DAYS = 91;

/** Reason shown for an item that grows but never reaches a reliable peak */
export const NO_PEAK_NOTE = 'no reliable peak season in this climate';

/**
 * Chart row for one produce item. An item is only shown with a peak: without one (at week
 * resolution) the row has no spans and a note, and the UI lists it among the produce not grown
 * in the area.
 */
export function computeRow(produce: Produce, n: Normals): ChartRow {
  const pass = runModels(produce, n);
  const base = { produceId: produce.id, name: produce.names.en, category: produce.category };
  const peakSpans = maskToSpans(pass.peak, 'peak');
  if (!peakSpans.length) {
    return { ...base, spans: [], note: pass.note ?? NO_PEAK_NOTE };
  }
  const available = andMask(orMask(pass.available, pass.peak), nearMask(pass.peak, AVAILABLE_REACH_DAYS));
  const stored = storageMask(available, produce.storage_weeks * 7);
  const spans: Span[] = [
    ...peakSpans,
    ...maskToSpans(andNotMask(available, pass.peak), 'available'),
    ...maskToSpans(stored, 'stored'),
  ];
  const row: ChartRow = { ...base, spans };
  if (pass.note) row.note = pass.note;
  return row;
}

const WEEKS = 52;

/** Runs of consecutive weeks on a 52-week circle; a run crossing New Year is one run. */
export function circularRuns(weeks: boolean[]): { start: number; length: number }[] {
  const n = weeks.length;
  if (!weeks.some(Boolean)) return [];
  if (weeks.every(Boolean)) return [{ start: 0, length: n }];
  const off = weeks.indexOf(false);
  const runs: { start: number; length: number }[] = [];
  let start = -1;
  let length = 0;
  for (let k = 1; k <= n; k++) {
    const i = (off + k) % n;
    if (weeks[i]) {
      if (start < 0) {
        start = i;
        length = 0;
      }
      length++;
    } else if (start >= 0) {
      runs.push({ start, length });
      start = -1;
    }
  }
  return runs;
}

/**
 * Fractional week at the middle of an item's main peak, 0 = first week of January. The main peak
 * is the longest peak run on the circular year, so a season from November to February has its
 * middle around New Year, not in summer. Ties go to the earlier middle. An item without a peak
 * uses its available run; a peak lasting all year sits at mid-year; nothing fresh at all is null.
 */
export function peakMidWeek(row: ChartRow): number | null {
  for (const level of ['peak', 'available'] as const) {
    const mask = new Array<boolean>(WEEKS).fill(false);
    for (const span of row.spans) {
      if (span.level !== level) continue;
      for (let w = span.from; w <= span.to; w++) mask[w] = true;
    }
    const runs = circularRuns(mask);
    if (!runs.length) continue;
    if (runs[0].length === WEEKS) return (WEEKS - 1) / 2;
    const mids = runs
      .map((r) => ({ length: r.length, mid: (r.start + (r.length - 1) / 2) % WEEKS }))
      .sort((a, b) => b.length - a.length || a.mid - b.mid);
    return mids[0].mid;
  }
  return null;
}

/** Rows ordered top to bottom by the middle of their peak, January first; produce with nothing fresh last. */
export function computeChart(produce: Produce[], n: Normals): ChartRow[] {
  return produce
    .map((c) => computeRow(c, n))
    .sort((a, b) => (peakMidWeek(a) ?? 99) - (peakMidWeek(b) ?? 99) || a.name.localeCompare(b.name));
}

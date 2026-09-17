/**
 * Truth fixtures: what real charts say is in season, in one normalised shape.
 * Weeks are 0..51 like the engine's spans.
 */
export interface TruthItem {
  /** Name as printed by the source */
  name: string;
  /** Our produce id, or null when we do not model this item */
  produce: string | null;
  /** Weeks in which the source says the item is available fresh (all confidence levels) */
  fresh_weeks: number[];
  /** Weeks the source marks as peak, when it distinguishes */
  peak_weeks?: number[];
  /** Weeks the source marks as from storage, when it distinguishes */
  stored_weeks?: number[];
}

export interface TruthSet {
  id: string;
  region: string;
  /** Climate fixture slugs whose model output is unioned to represent the region */
  fixtures: string[];
  source: { credit: string; url: string; license: string; granularity: 'week' | 'month'; fetched: string };
  items: TruthItem[];
}

const MONTH_START_DOY = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365];

/** Weeks covered by month m (0 = January). A week belongs to the month holding its middle day. */
export function monthWeeks(m: number): number[] {
  const out: number[] = [];
  for (let w = 0; w < 52; w++) {
    const mid = w === 51 ? 360 : w * 7 + 3;
    if (mid >= MONTH_START_DOY[m] && mid < MONTH_START_DOY[m + 1]) out.push(w);
  }
  return out;
}

/** Twelve booleans, January first, to a sorted week list. */
export function monthsToWeeks(months: boolean[]): number[] {
  const weeks = new Set<number>();
  months.forEach((on, m) => {
    if (on) for (const w of monthWeeks(m)) weeks.add(w);
  });
  return [...weeks].sort((a, b) => a - b);
}

export function spansToWeeks(spans: { from: number; to: number }[]): number[] {
  const weeks = new Set<number>();
  for (const s of spans) for (let w = s.from; w <= s.to; w++) weeks.add(w);
  return [...weeks].sort((a, b) => a - b);
}

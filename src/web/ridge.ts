import type { ChartRow, Level } from '../engine/types';

export const WEEKS = 52;
export const LEVEL_HEIGHT: Record<Level, number> = { peak: 1, available: 0.55, stored: 0.25 };

/** Height 0..1 per week for one level of a row (peak also counts as available). */
export function levelHeights(row: ChartRow, level: Level): number[] {
  const h = new Array<number>(WEEKS).fill(0);
  for (const span of row.spans) {
    const on = span.level === level || (level === 'available' && span.level === 'peak');
    if (!on) continue;
    for (let w = span.from; w <= span.to; w++) h[w] = LEVEL_HEIGHT[level];
  }
  return h;
}

export interface Geometry {
  /** x of week 0's left edge */
  x0: number;
  /** Weeks of the previous December to draw left of week 0 for seasons that wrap the year */
  extendLeft?: number;
  /** width of one week */
  cw: number;
  /** y of the row baseline */
  baseline: number;
  /** pixel height of height 1 */
  amplitude: number;
  /** half width of the rounded shoulder, as a share of a week */
  shoulder?: number;
}

/** A layer that is on in both the first and the last week is one season running across New Year. */
export function wrapsYear(heights: number[]): boolean {
  return heights[0] > 0 && heights[WEEKS - 1] > 0;
}

/** A layer that is on in the first or the last week meets a sheet edge and gets faded there. */
export function touchesEdge(heights: number[]): boolean {
  return heights[0] > 0 || heights[WEEKS - 1] > 0;
}

/**
 * Closed SVG path: plateaus with rounded shoulders, like the vertumnus poster. Steps between weeks
 * become an S-curve centred on the week boundary, so nothing overshoots the baseline. A layer
 * that reaches a sheet edge keeps its height there instead of dropping to the baseline (the
 * caller fades it with a mask): at the left it is drawn `extendLeft` weeks further out, with last
 * December's real shape when the season wraps the year and a flat continuation otherwise; at
 * the right it runs flat to the end of week 52.
 */
export function ridgePath(heights: number[], g: Geometry): string {
  const s = (g.shoulder ?? 0.45) * g.cw;
  const y = (h: number) => g.baseline - h * g.amplitude;
  const xb = (w: number) => g.x0 + w * g.cw;
  if (!heights.some((h) => h > 0)) return '';
  const openLeft = heights[0] > 0;
  const openRight = heights[WEEKS - 1] > 0;
  const wrap = openLeft && openRight;
  const ext = openLeft ? Math.ceil(g.extendLeft ?? 0) : 0;
  const at = (w: number) => (w < 0 ? (wrap ? heights[((w % WEEKS) + WEEKS) % WEEKS] : heights[0]) : heights[w]);
  const first = openLeft ? at(-ext) : 0;
  // always begin on the baseline so the closing segment runs along it, then step up if open
  const parts: string[] = [`M${xb(-ext).toFixed(1)},${y(0).toFixed(1)}`];
  if (openLeft) parts.push(`L${xb(-ext).toFixed(1)},${y(first).toFixed(1)}`);
  let prev = first;
  for (let w = -ext + (openLeft ? 1 : 0); w <= (openRight ? WEEKS - 1 : WEEKS); w++) {
    const next = w < WEEKS ? at(w) : 0;
    if (next !== prev) {
      const x = xb(w);
      parts.push(`L${(x - s).toFixed(1)},${y(prev).toFixed(1)}`);
      parts.push(`C${x.toFixed(1)},${y(prev).toFixed(1)} ${x.toFixed(1)},${y(next).toFixed(1)} ${(x + s).toFixed(1)},${y(next).toFixed(1)}`);
      prev = next;
    }
  }
  if (openRight) parts.push(`L${xb(WEEKS).toFixed(1)},${y(prev).toFixed(1)}`);
  parts.push(`L${xb(WEEKS).toFixed(1)},${y(0).toFixed(1)}Z`);
  return parts.join('');
}

/** First and last week with any fresh span, or null. */
export function freshExtent(row: ChartRow): { first: number; last: number } | null {
  let first = WEEKS;
  let last = -1;
  for (const s of row.spans) {
    if (s.level === 'stored') continue;
    first = Math.min(first, s.from);
    last = Math.max(last, s.to);
  }
  return last < 0 ? null : { first, last };
}

/** Level at a week for the tooltip, strongest wins. */
export function levelAt(row: ChartRow, week: number): Level | null {
  let best: Level | null = null;
  for (const s of row.spans) {
    if (week < s.from || week > s.to) continue;
    if (s.level === 'peak') return 'peak';
    if (s.level === 'available') best = 'available';
    else if (!best) best = 'stored';
  }
  return best;
}

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_START_DOY = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

/** Fractional week where a month starts, for gridlines. */
export function monthStartWeek(m: number): number {
  return MONTH_START_DOY[m] / 7;
}

export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function weekPart(week: number): { part: string; month: number } {
  const doy = week * 7 + 3;
  let m = 11;
  while (m > 0 && MONTH_START_DOY[m] > doy) m--;
  const dayInMonth = doy - MONTH_START_DOY[m];
  return { part: dayInMonth < 10 ? 'early' : dayInMonth < 20 ? 'mid' : 'late', month: m };
}

/** "late Aug" */
export function weekLabel(week: number): string {
  const { part, month } = weekPart(week);
  return `${part} ${MONTHS[month]}`;
}

/** "late August" */
export function weekLabelLong(week: number): string {
  const { part, month } = weekPart(week);
  return `${part} ${MONTHS_LONG[month]}`;
}

export function currentWeek(date = new Date()): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const doy = Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start) / 86_400_000);
  return Math.min(Math.floor(doy / 7), WEEKS - 1);
}

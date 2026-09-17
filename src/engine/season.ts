import { DAYS, type FrostRun } from './types';

export type Run = FrostRun;

/** Longest run of true values on a circle. Whole circle if all true, null if none. */
export function longestRun(mask: boolean[]): Run | null {
  const n = mask.length;
  const first = mask.indexOf(false);
  if (first === -1) return { start: 0, end: n - 1, length: n };
  if (!mask.includes(true)) return null;
  let best: Run | null = null;
  let cur = -1;
  for (let k = 1; k <= n; k++) {
    const i = (first + k) % n;
    if (mask[i]) {
      if (cur === -1) cur = i;
    } else if (cur !== -1) {
      const length = (i - cur + n) % n;
      if (!best || length > best.length) best = { start: cur, end: (i - 1 + n) % n, length };
      cur = -1;
    }
  }
  return best;
}

/**
 * Frost-free season: longest run of days whose frost probability is under the threshold.
 * When the whole year qualifies, the run is anchored at the coldest day so that "season start"
 * means the same thing in Sydney, Nairobi and Berlin.
 */
export function frostFreeRun(frostProb: number[], threshold: number, coldestDoy: number): Run | null {
  const run = longestRun(frostProb.map((p) => p < threshold));
  if (!run) return null;
  if (run.length === DAYS) return { start: coldestDoy, end: (coldestDoy + DAYS - 1) % DAYS, length: DAYS };
  return run;
}

export function inRun(run: Run, doy: number): boolean {
  return (doy - run.start + DAYS) % DAYS < run.length;
}

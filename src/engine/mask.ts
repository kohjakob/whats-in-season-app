import { DAYS, type DayMask, type Level, type Span } from './types';

export function emptyMask(): DayMask {
  return new Array<boolean>(DAYS).fill(false);
}

export function orMask(a: DayMask, b: DayMask): DayMask {
  return a.map((v, i) => v || b[i]);
}

export function andMask(a: DayMask, b: DayMask): DayMask {
  return a.map((v, i) => v && b[i]);
}

/** Days within `days` of any on day, before or after, wrapping the year. */
export function nearMask(mask: DayMask, days: number): DayMask {
  const out = emptyMask();
  for (let d = 0; d < DAYS; d++) {
    if (!mask[d]) continue;
    for (let k = -days; k <= days; k++) out[(d + k + DAYS * 2) % DAYS] = true;
  }
  return out;
}

export function andNotMask(a: DayMask, b: DayMask): DayMask {
  return a.map((v, i) => v && !b[i]);
}

export function countTrue(m: DayMask): number {
  return m.reduce((n, v) => n + (v ? 1 : 0), 0);
}

/** Week 0..51. Week 51 holds eight days. */
export function doyToWeek(doy: number): number {
  return Math.min(Math.floor(doy / 7), 51);
}

/**
 * Collapse a day mask into inclusive week spans. A week counts when at least half its days are
 * on. Spans never wrap the year boundary; a season that straddles New Year becomes two spans,
 * matching the vertumnus data shape.
 */
export function maskToSpans(mask: DayMask, level: Level): Span[] {
  const on = new Array<number>(52).fill(0);
  const total = new Array<number>(52).fill(0);
  for (let d = 0; d < DAYS; d++) {
    const w = doyToWeek(d);
    total[w]++;
    if (mask[d]) on[w]++;
  }
  const spans: Span[] = [];
  let start = -1;
  for (let w = 0; w <= 52; w++) {
    const isOn = w < 52 && on[w] * 2 >= total[w];
    if (isOn && start === -1) start = w;
    if (!isOn && start !== -1) {
      spans.push({ level, from: start, to: w - 1 });
      start = -1;
    }
  }
  return spans;
}

/** Days within `days` after any available day, excluding days that are themselves available. */
export function storageMask(avail: DayMask, days: number): DayMask {
  const out = emptyMask();
  const reach = Math.min(days, DAYS - 1);
  if (reach <= 0) return out;
  for (let d = 0; d < DAYS; d++) {
    if (avail[d]) continue;
    for (let k = 1; k <= reach; k++) {
      if (avail[(d - k + DAYS) % DAYS]) {
        out[d] = true;
        break;
      }
    }
  }
  return out;
}

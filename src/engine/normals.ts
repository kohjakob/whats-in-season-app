import { DAYS, type DailySeries, type Normals } from './types';
import { longestRun, type Run } from './season';

const MS_PER_DAY = 86_400_000;

/** Day of year 0..364. Dec 31 of a leap year folds onto day 364. */
export function doyOf(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  const doy = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / MS_PER_DAY);
  return Math.min(doy, DAYS - 1);
}

/** Circular moving average with an odd window. */
export function smoothCircular(xs: number[], window: number): number[] {
  const n = xs.length;
  const h = Math.floor(window / 2);
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = -h; j <= h; j++) s += xs[(i + j + n) % n];
    out[i] = s / (2 * h + 1);
  }
  return out;
}

/**
 * Hours between 0 and 7.2 C in one day, from a sinusoidal diurnal curve through tmin and tmax
 * peaking at 15:00. Crude but standard for chill hour estimates from daily data.
 */
export function chillHoursOfDay(tmin: number, tmax: number): number {
  const mid = (tmin + tmax) / 2;
  const amp = (tmax - tmin) / 2;
  let hours = 0;
  for (let k = 0; k < 24; k++) {
    const t = mid + amp * Math.cos((2 * Math.PI * (k - 15)) / 24);
    if (t >= 0 && t <= 7.2) hours++;
  }
  return hours;
}

function mean(v: number[]): number {
  let s = 0;
  for (const x of v) s += x;
  return s / v.length;
}

function argmin(v: number[]): number {
  let best = 0;
  for (let i = 1; i < v.length; i++) if (v[i] < v[best]) best = i;
  return best;
}

/** Nearest-rank percentile of a numeric array, q in 0..1. */
export function percentile(v: number[], q: number): number {
  const s = [...v].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))];
}

/**
 * Frost-free season per thermal year (starting at the coldest day), then percentiles across
 * years. "safe" is the season you get nine years in ten, "typical" the median. Offsets are
 * measured from the coldest day so the statistics never straddle a wrap.
 */
export function frostSeasons(
  tminByYear: Map<number, Float64Array>,
  coldestDoy: number,
): { safe: Run | null; typical: Run | null } {
  const starts: number[] = [];
  const ends: number[] = [];
  for (const [year, tmin] of tminByYear) {
    const next = tminByYear.get(year + 1);
    const noFrost: boolean[] = [];
    let missing = 0;
    for (let k = 0; k < DAYS; k++) {
      const doy = (coldestDoy + k) % DAYS;
      const src = coldestDoy + k < DAYS ? tmin : next;
      const t = src ? src[doy] : NaN;
      if (Number.isNaN(t)) missing++;
      noFrost.push(!Number.isNaN(t) && t >= 0);
    }
    if (missing > DAYS / 10) continue;
    // pad so the circular helper works on a linear year
    const run = longestRun([false, ...noFrost, false]);
    if (!run) {
      starts.push(DAYS);
      ends.push(-1);
    } else {
      starts.push(run.start - 1);
      ends.push(run.end - 1);
    }
  }
  if (!starts.length) return { safe: null, typical: null };
  const make = (startOff: number, endOff: number): Run | null => {
    if (endOff < startOff) return null;
    const length = endOff - startOff + 1;
    const start = (coldestDoy + startOff) % DAYS;
    return { start, end: (start + length - 1) % DAYS, length };
  };
  return {
    safe: make(percentile(starts, 0.9), percentile(ends, 0.1)),
    typical: make(percentile(starts, 0.5), percentile(ends, 0.5)),
  };
}

type Bucket = 'tmin' | 'tmax' | 'tmean' | 'frost' | 'precip' | 'chill';

export function computeNormals(series: DailySeries): Normals {
  const n = series.time.length;
  for (const arr of [series.tmin, series.tmax, series.tmean, series.precip]) {
    if (arr.length !== n) throw new Error('DailySeries arrays differ in length');
  }
  const buckets: Record<Bucket, number[][]> = {
    tmin: [], tmax: [], tmean: [], frost: [], precip: [], chill: [],
  };
  for (const k of Object.keys(buckets) as Bucket[]) {
    buckets[k] = Array.from({ length: DAYS }, () => []);
  }
  const yearMin = new Map<number, number>();
  const yearDays = new Map<number, number>();
  const tminByYear = new Map<number, Float64Array>();

  for (let i = 0; i < n; i++) {
    const tmin = series.tmin[i];
    const tmax = series.tmax[i];
    const tmean = series.tmean[i];
    if (tmin == null || tmax == null || tmean == null) continue;
    const doy = doyOf(series.time[i]);
    buckets.tmin[doy].push(tmin);
    buckets.tmax[doy].push(tmax);
    buckets.tmean[doy].push(tmean);
    buckets.frost[doy].push(tmin < 0 ? 1 : 0);
    buckets.precip[doy].push(series.precip[i] ?? 0);
    buckets.chill[doy].push(chillHoursOfDay(tmin, tmax));
    const y = Number(series.time[i].slice(0, 4));
    yearMin.set(y, Math.min(yearMin.get(y) ?? Infinity, tmin));
    yearDays.set(y, (yearDays.get(y) ?? 0) + 1);
    let row = tminByYear.get(y);
    if (!row) {
      row = new Float64Array(DAYS).fill(NaN);
      tminByYear.set(y, row);
    }
    row[doy] = Math.min(Number.isNaN(row[doy]) ? Infinity : row[doy], tmin);
  }

  const raw = (k: Bucket): number[] =>
    buckets[k].map((b, i) => {
      if (!b.length) throw new Error(`no observations for day of year ${i}`);
      return mean(b);
    });

  const tmean = smoothCircular(raw('tmean'), 15);
  const coldestDoy = argmin(tmean);
  const chill = raw('chill');
  const fullYears = [...yearDays.entries()].filter(([, d]) => d >= 300).map(([y]) => y);
  const annualMinTmin = mean(fullYears.map((y) => yearMin.get(y) as number));

  return {
    tmean,
    tmin: smoothCircular(raw('tmin'), 15),
    tmax: smoothCircular(raw('tmax'), 15),
    frostProb: smoothCircular(raw('frost'), 15),
    precip: smoothCircular(raw('precip'), 31),
    frostFree: frostSeasons(tminByYear, coldestDoy),
    annualMinTmin,
    chill,
    chillHours: chill.reduce((a, b) => a + b, 0),
    coldestDoy,
    years: fullYears.length,
  };
}

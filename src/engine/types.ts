/** Days in the model year. Feb 29 is folded onto the following day, Dec 31 of leap years onto day 364. */
export const DAYS = 365;

/** Raw daily observations for one location, all arrays the same length. */
export interface DailySeries {
  /** ISO dates YYYY-MM-DD */
  time: string[];
  tmin: (number | null)[];
  tmax: (number | null)[];
  tmean: (number | null)[];
  /** mm per day */
  precip: (number | null)[];
}

/** Climatology per day of year, index 0 = Jan 1. */
export interface Normals {
  /** 15 day circular moving average of mean daily temperature, C */
  tmean: number[];
  /** 15 day smoothed mean daily minimum, C */
  tmin: number[];
  /** 15 day smoothed mean daily maximum, C */
  tmax: number[];
  /** Smoothed probability that the daily minimum is below 0 C */
  frostProb: number[];
  /** 31 day smoothed mean precipitation, mm per day */
  precip: number[];
  /**
   * Frost-free season from per-year last and first frost dates. `safe` holds nine years in ten,
   * `typical` is the median year. Null when there is no frost-free run at all.
   */
  frostFree: { safe: FrostRun | null; typical: FrostRun | null };
  /** Mean over years of each year's coldest daily minimum, C */
  annualMinTmin: number;
  /** Mean chill hours (0 to 7.2 C) per day of year */
  chill: number[];
  /** Mean annual hours with temperature between 0 and 7.2 C */
  chillHours: number;
  /** Day of year with the lowest smoothed mean temperature */
  coldestDoy: number;
  /** Number of calendar years that contributed */
  years: number;
}

/** Inclusive circular range of days of year. */
export interface FrostRun {
  start: number;
  end: number;
  length: number;
}

export type Level = 'peak' | 'available' | 'stored';

/** Inclusive week range, weeks 0 to 51. Same shape as the vertumnus poster data. */
export interface Span {
  level: Level;
  from: number;
  to: number;
}

export interface ChartRow {
  produceId: string;
  name: string;
  category: string;
  spans: Span[];
  /** Why this item is missing or limited, for the UI */
  note?: string;
}

/** One boolean per day of year */
export type DayMask = boolean[];

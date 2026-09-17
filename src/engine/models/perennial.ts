import { DAYS, type DayMask, type Normals } from '../types';
import { emptyMask } from '../mask';

export interface PerennialParams {
  /** Winter chill (hours between 0 and 7.2 C) needed to break dormancy */
  chillHoursMin: number;
  /** Mean annual coldest minimum below which the plant does not survive, C */
  tKillDormant: number;
  /** Smoothed mean temperature after the coldest day that marks bloom, C */
  bloomT: number;
  /** Days from bloom to harvest, earliest to latest variety */
  bloomToHarvestDays: [number, number];
  /** Keeps fruiting while conditions stay mild (day-neutral strawberries, autumn raspberries) */
  everbearing: boolean;
  /** Optimum mean temperature range; everbearing plants keep flowering only inside it */
  tOpt: [number, number];
}

/** Base temperature for forcing heat after dormancy, C */
export const FORCING_BASE_C = 5;
/** Degree days above FORCING_BASE_C, after chill is complete, before bloom */
export const FORCING_GDD = 150;
/** How far above the optimum the smoothed daily maximum may sit before an everbearing produce stops flowering */
export const EVERBEARING_HEAT_MARGIN_C = 3;

function argmax(v: number[]): number {
  let best = 0;
  for (let i = 1; i < v.length; i++) if (v[i] > v[best]) best = i;
  return best;
}

export interface PerennialResult {
  mask: DayMask;
  note?: string;
}

/**
 * Tree and bush fruit, perennial vegetables and herbs. Gated by winter chill (zero for citrus,
 * mango and the like) and winter survival, then bloom is placed at the first day after the coldest
 * day that is warm enough, and harvest follows by a fixed varietal spread.
 * `slackDays` widens the window for the "available" level and `extend` lets an everbearing produce
 * keep going while the weather stays mild, which is a light continued harvest and so only
 * belongs in "available", never in "peak".
 */
export function perennialMask(n: Normals, p: PerennialParams, slackDays: number, extend: boolean): PerennialResult {
  if (n.chillHours < p.chillHoursMin) {
    return {
      mask: emptyMask(),
      note: `needs ${p.chillHoursMin} chill hours, this location averages ${Math.round(n.chillHours)}`,
    };
  }
  if (n.annualMinTmin <= p.tKillDormant) {
    return {
      mask: emptyMask(),
      note: `winter lows around ${n.annualMinTmin.toFixed(0)} C are below its ${p.tKillDormant} C survival limit`,
    };
  }
  // Dormancy: chill accumulates from the warmest day. Bloom cannot happen before the produce's
  // chill requirement is met, nor before the coldest day, whichever is later. In mild winters
  // this is what keeps January from counting as spring.
  const warmest = argmax(n.tmean);
  const coldestOff = (n.coldestDoy - warmest + DAYS) % DAYS;
  let chillOff = 0;
  if (p.chillHoursMin > 0) {
    let acc = 0;
    while (chillOff < DAYS && acc < p.chillHoursMin) acc += n.chill[(warmest + chillOff++) % DAYS];
  }
  const startOff = Math.max(chillOff, coldestOff);
  // Forcing: buds need a heat sum after dormancy ends, which is what separates a mild
  // January from spring in a Mediterranean valley.
  let bloom = -1;
  let forcing = 0;
  for (let k = startOff; k < startOff + DAYS; k++) {
    const d = (warmest + k) % DAYS;
    forcing += Math.max(0, n.tmean[d] - FORCING_BASE_C);
    if (forcing >= FORCING_GDD && n.tmean[d] >= p.bloomT) {
      bloom = d;
      break;
    }
  }
  if (bloom < 0) return { mask: emptyMask(), note: `never reaches the ${p.bloomT} C needed to bloom` };

  const mask = emptyMask();
  const [first, last] = p.bloomToHarvestDays;
  for (let k = Math.max(0, first - slackDays); k <= last + slackDays && k < DAYS; k++) {
    mask[(bloom + k) % DAYS] = true;
  }
  if (p.everbearing && extend) {
    const [optLo, optHi] = p.tOpt;
    for (let k = last + slackDays + 1; k < DAYS; k++) {
      const d = (bloom + k) % DAYS;
      if (n.tmean[d] < optLo || n.tmax[d] > optHi + EVERBEARING_HEAT_MARGIN_C || n.frostProb[d] >= 0.5) break;
      mask[d] = true;
    }
  }
  return { mask };
}

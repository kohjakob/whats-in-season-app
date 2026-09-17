import { DAYS, type DayMask, type Normals } from '../types';
import { emptyMask } from '../mask';

export interface CoolAnnualParams {
  /** Smoothed mean temperature range in which the produce grows, C */
  tGrowMin: number;
  tGrowMax: number;
  /** Smoothed daily minimum below which the standing produce is lost, C */
  tKill: number;
  /** Days of in-range weather needed from sowing to harvest */
  cycleDays: number;
  /** Days mature produce can stand in the field before it is harvested */
  standDays: number;
}

/**
 * Cool-season produce with a short cycle and some frost tolerance. A day is harvestable when produce
 * matured within the last `standDays` and the weather since then neither froze nor cooked it.
 * Continental climates get spring and autumn windows, hot deserts a winter window and hardy produce
 * like kale stand through a mild winter, all from the same rule.
 */
export function coolAnnualMask(n: Normals, p: CoolAnnualParams, growRange: [number, number]): DayMask {
  const growOk = (d: number) =>
    n.tmean[d] >= growRange[0] && n.tmean[d] <= growRange[1] && n.tmax[d] <= p.tGrowMax && n.tmin[d] > p.tKill;
  const standOk = (d: number) => n.tmin[d] > p.tKill && n.tmax[d] <= p.tGrowMax;

  const matureOk = emptyMask();
  for (let m = 0; m < DAYS; m++) {
    let ok = true;
    for (let k = 1; k <= p.cycleDays; k++) {
      if (!growOk((m - k + DAYS) % DAYS)) {
        ok = false;
        break;
      }
    }
    matureOk[m] = ok;
  }

  const mask = emptyMask();
  for (let d = 0; d < DAYS; d++) {
    for (let s = 0; s <= p.standDays; s++) {
      const m = (d - s + DAYS) % DAYS;
      if (!standOk(m)) break;
      if (matureOk[m]) {
        mask[d] = true;
        break;
      }
    }
  }
  return mask;
}

/** Days before harvest whose temperature decides eating quality for a cool-season produce */
export const FINISH_DAYS = 21;

/**
 * Days whose preceding FINISH_DAYS days all had a smoothed mean inside the optimum range. A cool
 * produce that grew anywhere in its growth range but finished in its optimum is at its best: the
 * sweet autumn Brussels sprout, the spring lettuce before the heat. Requiring the whole cycle in
 * the optimum instead made continental springs, which warm quickly, show no peak at all.
 */
export function finishMask(n: Normals, optRange: [number, number]): DayMask {
  const mask = emptyMask();
  for (let d = 0; d < DAYS; d++) {
    let ok = true;
    for (let k = 0; k < FINISH_DAYS; k++) {
      const t = n.tmean[(d - k + DAYS) % DAYS];
      if (t < optRange[0] || t > optRange[1]) {
        ok = false;
        break;
      }
    }
    mask[d] = ok;
  }
  return mask;
}

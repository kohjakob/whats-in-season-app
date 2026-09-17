import { DAYS, type DayMask, type Normals } from '../types';
import { inRun, type Run } from '../season';
import { emptyMask } from '../mask';

/**
 * Heat or cold stops fruit set, but fruit already on the plant keeps ripening for about three
 * weeks, so the temperature quality of a harvest day is judged three weeks earlier. Frost is
 * judged on the day itself because it takes the fruit with the plant.
 */
export const HARVEST_LAG_DAYS = 21;

export interface WarmAnnualParams {
  /** Base temperature for growing degree days, C */
  tBase: number;
  /** Smoothed mean temperature needed to plant and grow, C */
  tGrowMin: number;
  /** Smoothed daily maximum above which growth and fruit set stop, C */
  tGrowMax: number;
  /** Degree days above tBase from planting to first harvest */
  gddToFirstHarvest: number;
  /** How long one planting keeps producing, or how long staggered plantings keep the market supplied */
  harvestDurationDays: number;
}

/**
 * Frost-sensitive annual planted after the last frost. Every day of the frost-free run is tried
 * as a planting date, so successive plantings and a second autumn window (Phoenix tomatoes) fall
 * out without special cases. `harvestRange` bounds the smoothed mean temperature at fruit set
 * (HARVEST_LAG_DAYS before harvest): the growth range for "available", the optimum for "peak".
 */
export function warmAnnualMask(
  n: Normals,
  run: Run,
  p: WarmAnnualParams,
  harvestRange: [number, number],
): DayMask {
  const mask = emptyMask();
  const growOk = (d: number) => n.tmean[d] >= p.tGrowMin && n.tmax[d] <= p.tGrowMax;
  const harvestOk = (d: number) => {
    const set = (d - HARVEST_LAG_DAYS + DAYS) % DAYS;
    return inRun(run, d) && n.tmean[set] >= harvestRange[0] && n.tmean[set] <= harvestRange[1] && n.tmax[set] <= p.tGrowMax;
  };

  for (let k = 0; k < run.length; k++) {
    const plant = (run.start + k) % DAYS;
    if (!growOk(plant)) continue;
    let gdd = 0;
    let d = plant;
    let grown = 0;
    while (gdd < p.gddToFirstHarvest) {
      if (!inRun(run, d) || !growOk(d) || grown >= DAYS) {
        grown = -1;
        break;
      }
      gdd += Math.min(Math.max(n.tmean[d], p.tBase), p.tGrowMax) - p.tBase;
      d = (d + 1) % DAYS;
      grown++;
    }
    if (grown < 0) continue;
    for (let h = 0; h < p.harvestDurationDays; h++) {
      const day = (d + h) % DAYS;
      if (!harvestOk(day)) break;
      mask[day] = true;
    }
  }
  return mask;
}

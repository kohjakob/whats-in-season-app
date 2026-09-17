import type { DailySeries } from '../engine/types';
import { PERIOD } from './openMeteo';

export const POWER_BASE = 'https://power.larc.nasa.gov/api/temporal/daily/point';

/** MERRA-2 based, coarser than ERA5 (0.5 by 0.625 degrees), no key, no formal rate limit. */
export function powerUrl(lat: number, lon: number, period = PERIOD): string {
  const q = new URLSearchParams({
    parameters: 'T2M,T2M_MIN,T2M_MAX,PRECTOTCORR',
    community: 'AG',
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    start: period.start.replaceAll('-', ''),
    end: period.end.replaceAll('-', ''),
    format: 'JSON',
  });
  return `${POWER_BASE}?${q}`;
}

interface PowerResponse {
  properties: { parameter: Record<'T2M' | 'T2M_MIN' | 'T2M_MAX' | 'PRECTOTCORR', Record<string, number>> };
  geometry?: { coordinates: [number, number, number] };
}

export async function fetchPower(lat: number, lon: number): Promise<{ series: DailySeries; elevation?: number }> {
  const res = await fetch(powerUrl(lat, lon));
  if (!res.ok) throw new Error(`NASA POWER ${res.status}`);
  return parsePower((await res.json()) as PowerResponse);
}

/** POWER uses -999 for missing values and YYYYMMDD keys. */
export function parsePower(json: PowerResponse): { series: DailySeries; elevation?: number } {
  const p = json.properties.parameter;
  const days = Object.keys(p.T2M).sort();
  const val = (v: number | undefined): number | null => (v === undefined || v <= -999 ? null : v);
  return {
    series: {
      time: days.map((d) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`),
      tmean: days.map((d) => val(p.T2M[d])),
      tmin: days.map((d) => val(p.T2M_MIN[d])),
      tmax: days.map((d) => val(p.T2M_MAX[d])),
      precip: days.map((d) => val(p.PRECTOTCORR[d])),
    },
    elevation: json.geometry?.coordinates[2],
  };
}

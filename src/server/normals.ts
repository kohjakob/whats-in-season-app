/**
 * GET /api/normals?lat=..&lon=..
 * Climate normals for the 0.25 degree cell around a point. The cell is in the URL, so every
 * visitor in the same cell hits the same URL and the CDN cache is the per-cell cache. Open-Meteo
 * ERA5 first, NASA POWER when Open-Meteo throttles or fails.
 */
import { computeNormals } from '../engine/normals';
import type { DailySeries, Normals } from '../engine/types';
import { fetchArchive, toDailySeries } from '../climate/openMeteo';
import { fetchPower } from '../climate/nasaPower';

export const CELL_DEG = 0.25;

export interface NormalsResponse {
  cell: { lat: number; lon: number };
  elevation?: number;
  source: 'era5' | 'merra2';
  normals: Normals;
}

export interface Deps {
  era5: (lat: number, lon: number) => Promise<{ series: DailySeries; elevation?: number }>;
  power: (lat: number, lon: number) => Promise<{ series: DailySeries; elevation?: number }>;
}

const defaultDeps: Deps = {
  era5: async (lat, lon) => {
    const a = await fetchArchive(lat, lon);
    return { series: toDailySeries(a), elevation: a.elevation };
  },
  power: fetchPower,
};

/** Centre of the grid cell containing the point. */
export function cellOf(lat: number, lon: number): { lat: number; lon: number } {
  const snap = (v: number) => Math.round((Math.floor(v / CELL_DEG) + 0.5) * CELL_DEG * 1000) / 1000;
  return { lat: snap(lat), lon: snap(lon) };
}

/** Two decimals are plenty for a chart and halve the payload. */
function compact(n: Normals): Normals {
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return {
    ...n,
    tmean: n.tmean.map(r2),
    tmin: n.tmin.map(r2),
    tmax: n.tmax.map(r2),
    frostProb: n.frostProb.map(r2),
    precip: n.precip.map(r2),
    chill: n.chill.map(r2),
    annualMinTmin: r2(n.annualMinTmin),
    chillHours: Math.round(n.chillHours),
  };
}

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

export async function handleNormals(url: URL, deps: Deps = defaultDeps): Promise<Response> {
  const latRaw = url.searchParams.get('lat');
  const lonRaw = url.searchParams.get('lon');
  const lat = latRaw === null || latRaw.trim() === '' ? NaN : Number(latRaw);
  const lon = lonRaw === null || lonRaw.trim() === '' ? NaN : Number(lonRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return json({ error: 'lat and lon are required, lat in -90..90, lon in -180..180' }, 400, { 'cache-control': 'no-store' });
  }
  const cell = cellOf(lat, lon);

  let data: { series: DailySeries; elevation?: number } | undefined;
  let source: NormalsResponse['source'] = 'era5';
  const errors: string[] = [];
  try {
    data = await deps.era5(cell.lat, cell.lon);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
    try {
      data = await deps.power(cell.lat, cell.lon);
      source = 'merra2';
    } catch (e2) {
      errors.push(e2 instanceof Error ? e2.message : String(e2));
    }
  }
  if (!data) {
    return json({ error: 'climate sources unavailable', detail: errors }, 503, {
      'cache-control': 'no-store',
      'retry-after': '60',
    });
  }

  let normals: Normals;
  try {
    normals = computeNormals(data.series);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 502, { 'cache-control': 'no-store' });
  }
  const body: NormalsResponse = { cell, elevation: data.elevation, source, normals: compact(normals) };
  return json(body, 200, {
    // climate normals do not change: a day in the browser, a year at the CDN
    'cache-control': 'public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800',
    'access-control-allow-origin': '*',
  });
}

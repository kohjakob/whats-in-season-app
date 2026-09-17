import type { DailySeries } from '../engine/types';

export const ARCHIVE_BASE = 'https://archive-api.open-meteo.com/v1/archive';
export const GEOCODE_BASE = 'https://geocoding-api.open-meteo.com/v1/search';

/** Normals period. Thirty years, ending on the last complete year before the project started. */
export const PERIOD = { start: '1995-01-01', end: '2024-12-31' };

export const DAILY_VARS = [
  'temperature_2m_max',
  'temperature_2m_min',
  'temperature_2m_mean',
  'precipitation_sum',
] as const;

/** Verbatim shape of an Open-Meteo archive response, only the fields we use. */
export interface OpenMeteoArchive {
  latitude: number;
  longitude: number;
  elevation?: number;
  timezone?: string;
  daily: {
    time: string[];
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
    temperature_2m_mean: (number | null)[];
    precipitation_sum: (number | null)[];
  };
}

export function archiveUrl(lat: number, lon: number, period = PERIOD): string {
  const q = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    start_date: period.start,
    end_date: period.end,
    daily: DAILY_VARS.join(','),
    timezone: 'auto',
  });
  return `${ARCHIVE_BASE}?${q}`;
}

export class OpenMeteoError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** One request, roughly 340 KB for thirty years. Callers are expected to cache the result. */
export async function fetchArchive(lat: number, lon: number): Promise<OpenMeteoArchive> {
  const res = await fetch(archiveUrl(lat, lon));
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new OpenMeteoError(`Open-Meteo archive ${res.status}: ${body.slice(0, 200)}`, res.status);
  }
  const json = (await res.json()) as OpenMeteoArchive & { error?: boolean; reason?: string };
  if (json.error) throw new OpenMeteoError(`Open-Meteo archive: ${json.reason}`, res.status);
  return json;
}

export function toDailySeries(a: OpenMeteoArchive): DailySeries {
  return {
    time: a.daily.time,
    tmin: a.daily.temperature_2m_min,
    tmax: a.daily.temperature_2m_max,
    tmean: a.daily.temperature_2m_mean,
    precip: a.daily.precipitation_sum,
  };
}

export interface GeocodeResult {
  name: string;
  country?: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  elevation?: number;
  timezone?: string;
}

export async function geocode(name: string, count = 1): Promise<GeocodeResult[]> {
  const q = new URLSearchParams({ name, count: String(count), language: 'en', format: 'json' });
  const res = await fetch(`${GEOCODE_BASE}?${q}`);
  if (!res.ok) throw new OpenMeteoError(`Open-Meteo geocoding ${res.status}`, res.status);
  const json = (await res.json()) as { results?: GeocodeResult[] };
  return json.results ?? [];
}

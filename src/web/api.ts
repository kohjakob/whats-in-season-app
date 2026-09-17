import type { NormalsResponse } from '../server/normals';
import { cellOf, handleNormals } from '../server/normals';
import { GEOCODE_BASE, type GeocodeResult } from '../climate/openMeteo';

export interface Place {
  /** Short label for the poster and the URL, e.g. "Vienna, Austria" */
  name: string;
  /** Longer label for the suggestion list, e.g. "Vienna, State of Vienna, Austria" */
  detail?: string;
  lat: number;
  lon: number;
}

const CACHE_PREFIX = 'normals:v1:';
const CACHE_INDEX = 'normals:v1:index';
const CACHE_MAX = 24;

function readCache(key: string): NormalsResponse | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    return raw ? (JSON.parse(raw) as NormalsResponse) : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: NormalsResponse): void {
  try {
    const index = (JSON.parse(localStorage.getItem(CACHE_INDEX) ?? '[]') as string[]).filter((k) => k !== key);
    index.push(key);
    while (index.length > CACHE_MAX) localStorage.removeItem(CACHE_PREFIX + index.shift());
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value));
    localStorage.setItem(CACHE_INDEX, JSON.stringify(index));
  } catch {
    // storage full, blocked or unavailable: the cache is only a convenience
  }
}

/** Set once `/api/normals` turns out not to exist, e.g. on a plain static host */
let apiMissing = false;

/** Test hook */
export function resetNormalsClientState(): void {
  apiMissing = false;
}

/**
 * Climate normals for the 0.25 degree cell around a point. Asks `/api/normals` first (Vercel,
 * Vite dev), where the CDN caches one copy per cell. On a static host without that function the
 * same handler runs in the browser against Open-Meteo, with NASA POWER as fallback, so rate limits
 * apply per visitor. Either way the result is kept in localStorage for the most recent cells.
 */
export async function fetchNormals(lat: number, lon: number): Promise<NormalsResponse> {
  const cell = cellOf(lat, lon);
  const key = `${cell.lat},${cell.lon}`;
  const cached = readCache(key);
  if (cached) return cached;

  const query = `lat=${cell.lat}&lon=${cell.lon}`;
  if (!apiMissing) {
    try {
      const res = await fetch(`/api/normals?${query}`);
      const isJson = (res.headers.get('content-type') ?? '').includes('application/json');
      if (res.ok && isJson) {
        const body = (await res.json()) as NormalsResponse;
        writeCache(key, body);
        return body;
      }
      if (res.status === 404 || !isJson) apiMissing = true;
    } catch {
      // network error on the API: fall through to the in-browser path
    }
  }

  const local = await handleNormals(new URL(`http://browser/api/normals?${query}`));
  const body = (await local.json()) as NormalsResponse & { error?: string };
  if (!local.ok) throw new Error(body.error ?? `normals ${local.status}`);
  writeCache(key, body);
  return body;
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const q = new URLSearchParams({ name: query, count: '6', language: 'en', format: 'json' });
  const res = await fetch(`${GEOCODE_BASE}?${q}`, { signal });
  if (!res.ok) throw new Error(`geocoding ${res.status}`);
  const json = (await res.json()) as { results?: GeocodeResult[] };
  const join = (parts: (string | undefined)[]) => parts.filter((x, i, a) => x && a.indexOf(x) === i).join(', ');
  return (json.results ?? []).map((r) => ({
    name: join([r.name, r.country]),
    detail: join([r.name, r.admin1, r.country]),
    lat: r.latitude,
    lon: r.longitude,
  }));
}

const REVERSE_GEOCODE_BASE = 'https://api.bigdatacloud.net/data/reverse-geocode-client';

/**
 * Nearest city for a coordinate, via BigDataCloud's free keyless reverse geocoder (no server-side
 * secret, so it works on the static-only deploy too). Falls back to raw coordinates when nothing
 * resolves nearby, e.g. mid-ocean or a sparsely mapped area.
 */
export async function reverseGeocode(lat: number, lon: number, signal?: AbortSignal): Promise<string> {
  const q = new URLSearchParams({ latitude: lat.toFixed(4), longitude: lon.toFixed(4), localityLanguage: 'en' });
  const res = await fetch(`${REVERSE_GEOCODE_BASE}?${q}`, { signal });
  if (!res.ok) throw new Error(`reverse geocoding ${res.status}`);
  const json = (await res.json()) as { city?: string; locality?: string; countryName?: string };
  const place = json.city || json.locality;
  if (!place) throw new Error('no nearby place found');
  return [place, json.countryName].filter((x, i, a) => x && a.indexOf(x) === i).join(', ');
}

export function placeFromUrl(): Place | null {
  const p = new URLSearchParams(location.search);
  const lat = Number(p.get('lat'));
  const lon = Number(p.get('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !p.has('lat')) return null;
  return { name: p.get('name') ?? `${lat.toFixed(2)}, ${lon.toFixed(2)}`, lat, lon };
}

/** What the chart shows: a popularity preset, everything grown at the place, or an explicit list. */
export type Pick = { kind: 'preset'; n: number } | { kind: 'all' } | { kind: 'ids'; ids: string[] };

/** `produce=top30`, `produce=all` or `produce=tomato,apple,...`; unknown ids are dropped, an empty result is null. */
export function pickFromUrl(validIds: Set<string>, search = location.search): Pick | null {
  const raw = new URLSearchParams(search).get('produce');
  if (!raw) return null;
  if (raw === 'all') return { kind: 'all' };
  const top = /^top(\d+)$/.exec(raw);
  if (top) return { kind: 'preset', n: Number(top[1]) };
  const ids = raw.split(',').filter((id) => validIds.has(id));
  return ids.length ? { kind: 'ids', ids } : null;
}

export function pickToParam(pick: Pick): string {
  return pick.kind === 'all' ? 'all' : pick.kind === 'preset' ? `top${pick.n}` : pick.ids.join(',');
}

export function stateToUrl(place: Place, pick: Pick, lang = 'en'): void {
  const p = new URLSearchParams({ lat: place.lat.toFixed(3), lon: place.lon.toFixed(3), name: place.name, produce: pickToParam(pick) });
  if (lang !== 'en') p.set('lang', lang);
  history.replaceState(null, '', `?${p}`);
}

/** `lang=de` etc.; anything unknown is ignored. */
export function langFromUrl(search = location.search): string | null {
  return new URLSearchParams(search).get('lang');
}

const localizedCache = new Map<string, string>();

/**
 * The place name in another language, via the geocoder's localized names: search the city part
 * of the English label in that language and take the hit closest to the coordinates. Falls back
 * to the English label when nothing matches within a quarter degree.
 */
export async function localizedPlaceName(place: Place, lang: string, signal?: AbortSignal): Promise<string> {
  if (lang === 'en') return place.name;
  const key = `${lang}|${place.lat.toFixed(3)}|${place.lon.toFixed(3)}|${place.name}`;
  const hit = localizedCache.get(key);
  if (hit) return hit;
  const city = place.name.split(',')[0].trim();
  if (!city || /^Your location/i.test(place.name)) return place.name;
  const q = new URLSearchParams({ name: city, count: '10', language: lang, format: 'json' });
  const res = await fetch(`${GEOCODE_BASE}?${q}`, { signal });
  if (!res.ok) return place.name;
  const json = (await res.json()) as { results?: GeocodeResult[] };
  const near = (json.results ?? [])
    .map((r) => ({ r, d: Math.hypot(r.latitude - place.lat, r.longitude - place.lon) }))
    .filter((x) => x.d < 0.25)
    .sort((a, b) => a.d - b.d)[0]?.r;
  const label = near ? [near.name, near.country].filter((x, i, a) => x && a.indexOf(x) === i).join(', ') : place.name;
  localizedCache.set(key, label);
  return label;
}

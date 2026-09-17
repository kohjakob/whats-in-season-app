import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fetchNormals, resetNormalsClientState } from '../src/web/api';

const berlin = readFileSync(new URL('../data/fixtures/climate/berlin.json', import.meta.url), 'utf8');

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

describe('fetchNormals on a host without the API', () => {
  let calls: string[];

  beforeEach(() => {
    resetNormalsClientState();
    calls = [];
    vi.stubGlobal('localStorage', memoryStorage());
    vi.stubGlobal('fetch', async (input: string | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.startsWith('/api/normals')) return new Response('<html>not found</html>', { status: 404, headers: { 'content-type': 'text/html' } });
      if (url.includes('archive-api.open-meteo.com')) return new Response(berlin, { status: 200, headers: { 'content-type': 'application/json' } });
      throw new Error(`unexpected fetch ${url}`);
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('computes normals in the browser from Open-Meteo, then skips the API and serves repeats from cache', async () => {
    const first = await fetchNormals(52.52, 13.41);
    expect(first.source).toBe('era5');
    expect(first.normals.tmean).toHaveLength(365);
    expect(calls.filter((c) => c.startsWith('/api/'))).toHaveLength(1);

    await fetchNormals(52.52, 13.41); // same cell: cache
    await fetchNormals(48.2, 16.37); // new cell: no second API attempt
    expect(calls.filter((c) => c.startsWith('/api/'))).toHaveLength(1);
    expect(calls.filter((c) => c.includes('archive-api'))).toHaveLength(2);
  });
});

describe('fetchNormals with the API present', () => {
  beforeEach(() => {
    resetNormalsClientState();
    vi.stubGlobal('localStorage', memoryStorage());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('uses the API response and never calls Open-Meteo directly', async () => {
    const calls: string[] = [];
    const payload = { cell: { lat: 52.625, lon: 13.375 }, source: 'era5', normals: { tmean: [1] } };
    vi.stubGlobal('fetch', async (input: string | URL) => {
      calls.push(String(input));
      return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json; charset=utf-8' } });
    });
    const res = await fetchNormals(52.52, 13.41);
    expect(res.source).toBe('era5');
    expect(calls).toEqual(['/api/normals?lat=52.625&lon=13.375']);
  });
});

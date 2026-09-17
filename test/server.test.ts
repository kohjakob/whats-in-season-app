import { describe, expect, it } from 'vitest';
import { cellOf, handleNormals, type Deps } from '../src/server/normals';
import { syntheticSeries } from './normals.test';
import { parsePower } from '../src/climate/nasaPower';

const ok: Deps['era5'] = async () => ({ series: syntheticSeries(3), elevation: 40 });
const fail = async (): Promise<never> => {
  throw new Error('429 Minutely API request limit exceeded');
};

describe('cellOf', () => {
  it('snaps to the centre of the 0.25 degree cell', () => {
    expect(cellOf(52.52, 13.41)).toEqual({ lat: 52.625, lon: 13.375 });
    expect(cellOf(-33.87, 151.21)).toEqual({ lat: -33.875, lon: 151.125 });
    expect(cellOf(0, 0)).toEqual({ lat: 0.125, lon: 0.125 });
  });
});

describe('handleNormals', () => {
  it('rejects missing or out of range coordinates without caching', async () => {
    for (const q of ['', 'lat=91&lon=0', 'lat=abc&lon=1', 'lat=10']) {
      const res = await handleNormals(new URL(`http://x/api/normals?${q}`), { era5: ok, power: ok });
      expect(res.status).toBe(400);
      expect(res.headers.get('cache-control')).toBe('no-store');
    }
  });

  it('returns ERA5 normals for the cell with long cache headers', async () => {
    const res = await handleNormals(new URL('http://x/api/normals?lat=52.52&lon=13.41'), { era5: ok, power: fail });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('s-maxage=31536000');
    const body = (await res.json()) as { cell: { lat: number }; source: string; normals: { tmean: number[]; years: number } };
    expect(body.cell.lat).toBe(52.625);
    expect(body.source).toBe('era5');
    expect(body.normals.tmean).toHaveLength(365);
    expect(body.normals.years).toBe(3);
  });

  it('falls back to NASA POWER when Open-Meteo fails', async () => {
    const res = await handleNormals(new URL('http://x/api/normals?lat=1&lon=1'), { era5: fail, power: ok });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { source: string }).source).toBe('merra2');
  });

  it('answers 503 with retry-after when both sources fail', async () => {
    const res = await handleNormals(new URL('http://x/api/normals?lat=1&lon=1'), { era5: fail, power: fail });
    expect(res.status).toBe(503);
    expect(res.headers.get('retry-after')).toBe('60');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});

describe('parsePower', () => {
  it('converts POWER keys and treats -999 as missing', () => {
    const out = parsePower({
      geometry: { coordinates: [13.4, 52.5, 38] },
      properties: {
        parameter: {
          T2M: { '19950101': 1.5, '19950102': -999 },
          T2M_MIN: { '19950101': -1, '19950102': -3 },
          T2M_MAX: { '19950101': 4, '19950102': 2 },
          PRECTOTCORR: { '19950101': 0.2, '19950102': -999 },
        },
      },
    });
    expect(out.elevation).toBe(38);
    expect(out.series.time).toEqual(['1995-01-01', '1995-01-02']);
    expect(out.series.tmean).toEqual([1.5, null]);
    expect(out.series.precip).toEqual([0.2, null]);
  });
});

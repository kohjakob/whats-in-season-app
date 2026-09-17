import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { computeNormals } from './engine/normals';
import { computeChart } from './engine/compute';
import { doyToWeek } from './engine/mask';
import type { ChartRow, Normals } from './engine/types';
import { loadProduce } from './produce/load';
import { fetchArchive, geocode, toDailySeries, type OpenMeteoArchive } from './climate/openMeteo';

const ROOT = new URL('../', import.meta.url).pathname;
const CACHE_DIR = join(ROOT, '.cache', 'archive');
const FIXTURE_DIR = join(ROOT, 'data', 'fixtures', 'climate');

const GLYPH = { peak: '█', available: '▒', stored: '░', none: '·' } as const;
const MONTH_START_DOY = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
const MONTH_LETTER = 'JFMAMJJASOND';

function usage(): never {
  console.error(`usage:
  pnpm cli --lat 52.52 --lon 13.41
  pnpm cli --city Berlin
  pnpm cli --fixture berlin
options:
  --produce tomato,apple   only these produce ids
  --json                 print rows as JSON instead of a text chart`);
  process.exit(2);
}

async function loadArchive(opts: { lat?: string; lon?: string; city?: string; fixture?: string }): Promise<{
  archive: OpenMeteoArchive;
  label: string;
}> {
  if (opts.fixture) {
    const file = join(FIXTURE_DIR, `${opts.fixture}.json`);
    if (!existsSync(file)) throw new Error(`no fixture ${file}`);
    return { archive: JSON.parse(readFileSync(file, 'utf8')), label: `fixture ${opts.fixture}` };
  }
  let lat: number;
  let lon: number;
  let label: string;
  if (opts.city) {
    const [hit] = await geocode(opts.city);
    if (!hit) throw new Error(`no geocoding result for "${opts.city}"`);
    lat = hit.latitude;
    lon = hit.longitude;
    label = [hit.name, hit.admin1, hit.country].filter(Boolean).join(', ');
  } else if (opts.lat && opts.lon) {
    lat = Number(opts.lat);
    lon = Number(opts.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) usage();
    label = `${lat}, ${lon}`;
  } else {
    usage();
  }
  mkdirSync(CACHE_DIR, { recursive: true });
  const cacheFile = join(CACHE_DIR, `${lat.toFixed(2)}_${lon.toFixed(2)}.json`);
  if (existsSync(cacheFile)) return { archive: JSON.parse(readFileSync(cacheFile, 'utf8')), label };
  const archive = await fetchArchive(lat, lon);
  writeFileSync(cacheFile, JSON.stringify(archive));
  return { archive, label };
}

function ruler(): string {
  const cells = new Array<string>(52).fill(' ');
  MONTH_START_DOY.forEach((doy, i) => (cells[doyToWeek(doy)] = MONTH_LETTER[i]));
  return cells.join('');
}

function renderRow(row: ChartRow): string {
  const cells = new Array<string>(52).fill(GLYPH.none);
  for (const level of ['stored', 'available', 'peak'] as const) {
    for (const s of row.spans.filter((x) => x.level === level)) {
      for (let w = s.from; w <= s.to; w++) cells[w] = GLYPH[level];
    }
  }
  return cells.join('');
}

function header(label: string, a: OpenMeteoArchive, n: Normals): string {
  const { safe, typical } = n.frostFree;
  const fmt = (r: { start: number; end: number; length: number } | null) =>
    !r ? 'none' : r.length === 365 ? 'all year' : `wk ${doyToWeek(r.start)} to ${doyToWeek(r.end)}`;
  const frost = `frost-free ${fmt(safe)} (safe), ${fmt(typical)} (typical)`;
  return [
    `${label} (${a.latitude}, ${a.longitude}, ${a.elevation ?? '?'} m)`,
    `ERA5 ${n.years} years, ${frost}, ${Math.round(n.chillHours)} chill hours, coldest day wk ${doyToWeek(n.coldestDoy)}, winter low ${n.annualMinTmin.toFixed(1)} C`,
  ].join('\n');
}

async function main(): Promise<void> {
  // pnpm forwards a literal "--" when invoked as "pnpm cli -- --lat ..."; drop it so both forms work
  const args = process.argv.slice(2).filter((a, i) => !(i === 0 && a === '--'));
  const { values } = parseArgs({
    args,
    options: {
      lat: { type: 'string' },
      lon: { type: 'string' },
      city: { type: 'string' },
      fixture: { type: 'string' },
      produce: { type: 'string' },
      json: { type: 'boolean', default: false },
    },
  });
  const { archive, label } = await loadArchive(values);
  const normals = computeNormals(toDailySeries(archive));
  let produce = loadProduce();
  if (values.produce) {
    const want = new Set(values.produce.split(','));
    produce = produce.filter((c) => want.has(c.id));
  }
  const rows = computeChart(produce, normals);

  if (values.json) {
    console.log(JSON.stringify({ label, rows }, null, 2));
    return;
  }
  const width = Math.max(12, ...rows.map((r) => r.name.length)) + 2;
  console.log(header(label, archive, normals));
  console.log();
  console.log(' '.repeat(width) + ruler());
  for (const row of rows) console.log(row.name.padEnd(width) + renderRow(row));
  console.log();
  console.log(`${GLYPH.peak} peak  ${GLYPH.available} available  ${GLYPH.stored} stored  ${GLYPH.none} not in season`);
  const notes = rows.filter((r) => r.note);
  if (notes.length) {
    console.log();
    for (const r of notes) console.log(`${r.name}: ${r.note}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

/**
 * Render the A4 poster for a climate fixture to an SVG file, for eyeballing the layout without a
 * browser session (QuickLook renders SVG).
 *   pnpm render-chart berlin out.svg [--all] [--storage]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { computeNormals } from '../src/engine/normals';
import { computeChart } from '../src/engine/compute';
import { loadProduce } from '../src/produce/load';
import { toDailySeries, type OpenMeteoArchive } from '../src/climate/openMeteo';
import { Poster } from '../src/web/Poster';
import { defaultSelection } from '../src/web/popularity';
import type { Category } from '../src/web/categories';
import { produceName, isLang, posterLabels } from '../src/web/i18n';

const args = process.argv.slice(2);
const [slug, out] = args;
if (!slug || !out) {
  console.error('usage: pnpm render-chart <fixture> <out.svg> [--all] [--storage]');
  process.exit(2);
}
const archive = JSON.parse(readFileSync(new URL(`../data/fixtures/climate/${slug}.json`, import.meta.url), 'utf8')) as OpenMeteoArchive;
const produce = loadProduce();
const categoryOf = new Map(produce.map((c) => [c.id, c.category as Category]));
const catOf = (id: string) => categoryOf.get(id) as Category;
const all = computeChart(produce, computeNormals(toDailySeries(archive))).filter((r) => r.spans.some((s) => s.level !== 'stored'));
const langArg = args[args.indexOf('--lang') + 1];
const lang = args.includes('--lang') && isLang(langArg) ? langArg : 'en';
const byId = new Map(produce.map((c) => [c.id, c]));
const rows = (args.includes('--all') ? all : all.filter((r) => defaultSelection(all.map((x) => x.produceId), catOf).has(r.produceId))).map((r) => ({
  ...r,
  name: produceName(byId.get(r.produceId)!, lang),
}));
const labels = posterLabels(lang);
const svg = renderToStaticMarkup(
  <Poster
    rows={rows}
    categoryOf={catOf}
    place={`fixture ${slug}`}
    showStorage={args.includes('--storage')}
    labels={labels}
  />,
);
if (out.endsWith('.html')) {
  const css = readFileSync(new URL('../src/web/styles.css', import.meta.url), 'utf8');
  const stage = renderToStaticMarkup(
    <div className="stage">
      <Poster rows={rows} categoryOf={catOf} place={`fixture ${slug}`} showStorage={args.includes('--storage')} />
    </div>,
  );
  writeFileSync(out, `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${css}</style></head><body><main class="app">${stage}</main></body></html>`);
} else {
  writeFileSync(out, `<?xml version="1.0" encoding="UTF-8"?>\n${svg}\n`);
}
console.log(`${out}: ${rows.length} rows`);

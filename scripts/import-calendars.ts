/**
 * Turn the month-level calendars in data/raw/calendars into truth fixtures under
 * data/fixtures/truth, mapping each source item onto one of our produce ids.
 *   pnpm import-calendars
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { monthsToWeeks, type TruthItem, type TruthSet } from '../src/validate/truth';
import { loadProduce } from '../src/produce/load';

const RAW = new URL('../data/raw/calendars/', import.meta.url).pathname;
const OUT = new URL('../data/fixtures/truth/', import.meta.url).pathname;

interface RawItem {
  name: string;
  name_en: string;
  months: boolean[];
  stored_months?: boolean[];
  notes?: string;
}
interface RawSource {
  source: string;
  url: string | string[];
  license: string;
  fetched: string;
}

/** Source English name to our produce id. Null means we knowingly do not model it. */
const MAP: Record<string, string | null> = {
  apple: 'apple', apricot: 'apricot', artichoke: 'artichoke', asparagus: 'asparagus', beetroot: 'beetroot',
  blueberry: 'blueberry', 'bok choy': 'pak-choi', broccoli: 'broccoli', 'brussels sprout': 'brussels-sprouts',
  cabbage: 'cabbage', 'white cabbage': 'cabbage', 'pointed cabbage': 'cabbage', 'sweetheart cabbage': 'cabbage',
  'red cabbage': 'red-cabbage', 'savoy cabbage': 'savoy-cabbage', carrot: 'carrot', cauliflower: 'cauliflower',
  celery: 'celery', celeriac: 'celeriac', cherry: 'sweet-cherry', cranberry: 'cranberry', cucumber: 'cucumber',
  currant: 'red-currant', redcurrant: 'red-currant', blackcurrant: 'black-currant', daikon: 'daikon',
  eggplant: 'aubergine', garlic: 'garlic', gooseberry: 'gooseberry', grape: 'grape', 'green bean': 'green-bean',
  'runner bean': 'green-bean', 'broad bean': 'broad-bean', kale: 'kale', kohlrabi: 'kohlrabi', leek: 'leek',
  lettuce: 'lettuce', muskmelon: 'melon', 'napa cabbage': 'napa-cabbage', nectarine: 'nectarine', onion: 'onion',
  'red onion': 'onion', parsnip: 'parsnip', pea: 'peas', 'snow pea': 'peas', peach: 'peach', pear: 'pear',
  plum: 'plum', damson: 'plum', greengage: 'plum', 'mirabelle plum': 'plum', potato: 'potato', 'new potato': 'potato',
  pumpkin: 'pumpkin', radish: 'radish', raspberry: 'raspberry', rhubarb: 'rhubarb', spinach: 'spinach',
  'spring onion': 'spring-onion', strawberry: 'strawberry', 'summer squash': 'zucchini', zucchini: 'zucchini',
  marrow: 'zucchini', swede: 'swede', 'sweet pepper': 'sweet-pepper', 'chili pepper': 'chili',
  'sweet potato': 'sweet-potato', sweetcorn: 'sweetcorn', tomato: 'tomato', watermelon: 'watermelon',
  'winter squash': 'winter-squash', 'butternut squash': 'winter-squash', squash: 'winter-squash', quince: 'quince',
  chestnut: 'chestnut', blackberry: 'blackberry', fennel: 'fennel', rocket: 'rocket', 'swiss chard': 'chard',
  turnip: 'turnip', chicory: 'endive', radicchio: 'endive',
  // not modelled: forced, foraged, fungi, or niche
  'forced rhubarb': null, watercress: null, sorrel: null, samphire: null, mushroom: null, 'wild mushroom': null,
  morel: null, elderflower: null, elderberry: null, 'jerusalem artichoke': null, salsify: null, loganberry: null,
  tayberry: null, haskap: null, 'amaranth greens': null, 'bitter melon': null, 'choy sum': null, 'gai lan': null,
  rapini: null, 'water spinach': null, 'mustard greens': null, 'pea shoots': null, 'garlic scape': null, sprouts: null,
  'purple sprouting broccoli': null, 'spring greens': null,
};

const SETS: { file: string; id: string; region: string; fixtures: string[]; granularity: 'month' }[] = [
  { file: 'ontario', id: 'ontario', region: 'Ontario, Canada (Foodland Ontario availability guide)', fixtures: ['toronto'], granularity: 'month' },
  { file: 'uk', id: 'uk', region: 'United Kingdom (Vegetarian Society seasonal UK grown produce)', fixtures: ['london'], granularity: 'month' },
  { file: 'germany', id: 'germany', region: 'Germany (regional-saisonal.de Saisonkalender, field harvest only)', fixtures: ['berlin'], granularity: 'month' },
];

const produceIds = new Set(loadProduce().map((c) => c.id));
for (const set of SETS) {
  const items = JSON.parse(readFileSync(`${RAW}${set.file}.json`, 'utf8')) as RawItem[];
  const src = JSON.parse(readFileSync(`${RAW}${set.file}.source.json`, 'utf8')) as RawSource;
  const out: TruthItem[] = [];
  const skipped: string[] = [];
  for (const it of items) {
    if (/greenhouse/i.test(it.name) || /greenhouse/i.test(it.notes ?? '')) {
      skipped.push(it.name);
      continue;
    }
    if (!(it.name_en in MAP)) throw new Error(`${set.id}: no mapping for "${it.name_en}" (${it.name})`);
    const produce = MAP[it.name_en];
    if (produce && !produceIds.has(produce)) throw new Error(`${set.id}: mapped to unknown produce ${produce}`);
    const item: TruthItem = { name: it.name, produce, fresh_weeks: monthsToWeeks(it.months) };
    if (it.stored_months?.some(Boolean)) item.stored_weeks = monthsToWeeks(it.stored_months);
    out.push(item);
  }
  const truth: TruthSet = {
    id: set.id,
    region: set.region,
    fixtures: set.fixtures,
    source: {
      credit: src.source,
      url: Array.isArray(src.url) ? src.url[0] : src.url,
      license: src.license,
      granularity: set.granularity,
      fetched: src.fetched,
    },
    items: out,
  };
  writeFileSync(`${OUT}${set.id}.json`, JSON.stringify(truth, null, 2) + '\n');
  console.log(`${set.id}: ${out.length} items (${out.filter((i) => i.produce).length} mapped), skipped ${skipped.length} greenhouse rows`);
}

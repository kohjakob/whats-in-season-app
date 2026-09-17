/**
 * Fetch a thirty-year daily archive for a test-bed location and store the verbatim response.
 *   pnpm fetch-fixture berlin 52.52 13.41
 * Open-Meteo bills a thirty-year request as many calls, so run these one at a time.
 */
import { writeFileSync } from 'node:fs';
import { fetchArchive } from '../src/climate/openMeteo';

const [slug, lat, lon] = process.argv.slice(2);
if (!slug || !lat || !lon) {
  console.error('usage: pnpm fetch-fixture <slug> <lat> <lon>');
  process.exit(2);
}
const out = new URL(`../data/fixtures/climate/${slug}.json`, import.meta.url).pathname;
const archive = await fetchArchive(Number(lat), Number(lon));
writeFileSync(out, JSON.stringify(archive));
console.log(`${out}: ${archive.daily.time.length} days`);

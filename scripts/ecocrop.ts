/**
 * Look up crops in the vendored FAO EcoCrop table.
 *   pnpm ecocrop "Cucumis sativus"        exact or prefix match on scientific name
 *   pnpm ecocrop --common cucumber        substring match on common names
 */
import { readFileSync } from 'node:fs';

const CSV = new URL('../data/raw/EcoCrop_DB.csv', import.meta.url).pathname;
const KEEP = [
  'EcoPortCode', 'ScientificName', 'COMNAME', 'LIFO', 'CAT',
  'TOPMN', 'TOPMX', 'TMIN', 'TMAX', 'KTMP', 'KTMPR',
  'ROPMN', 'ROPMX', 'RMIN', 'RMAX', 'GMIN', 'GMAX', 'PHOTO', 'CLIZ',
];

/** Minimal RFC 4180 parser: quoted fields, doubled quotes, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function loadEcocrop(): Record<string, string>[] {
  const [head, ...body] = parseCsv(readFileSync(CSV, 'utf8'));
  return body.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

function main(): void {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error('usage: pnpm ecocrop "<Scientific name>" | --common <word>');
    process.exit(2);
  }
  const rows = loadEcocrop();
  let hits: Record<string, string>[];
  if (args[0] === '--common') {
    const needle = args.slice(1).join(' ').toLowerCase();
    hits = rows.filter((r) => r.COMNAME.toLowerCase().includes(needle));
  } else {
    const needle = args.join(' ').toLowerCase();
    hits = rows.filter((r) => r.ScientificName.toLowerCase().startsWith(needle));
  }
  for (const r of hits) {
    const picked = Object.fromEntries(KEEP.map((k) => [k, k === 'COMNAME' ? r[k].slice(0, 80) : r[k]]));
    console.log(JSON.stringify(picked));
  }
  if (!hits.length) console.error('no match');
}

main();

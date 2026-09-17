import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ProduceSchema, type Produce } from './schema';

export const PRODUCE_DIR = new URL('../../data/produce/', import.meta.url).pathname;

/** Parse one produce record, throwing with the file name on validation errors. */
export function parseProduce(json: unknown, label = 'produce'): Produce {
  const result = ProduceSchema.safeParse(json);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
    throw new Error(`invalid ${label}: ${issues}`);
  }
  return result.data;
}

/** Load every produce record in data/produce, sorted by id. Duplicate ids are an error. */
export function loadProduce(dir: string = PRODUCE_DIR): Produce[] {
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  const produce = files.map((f) => parseProduce(JSON.parse(readFileSync(join(dir, f), 'utf8')), f));
  const seen = new Set<string>();
  for (const c of produce) {
    if (seen.has(c.id)) throw new Error(`duplicate produce id ${c.id}`);
    seen.add(c.id);
  }
  return produce.sort((a, b) => a.id.localeCompare(b.id));
}

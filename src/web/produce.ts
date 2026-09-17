import records from 'virtual:produce';
import { ProduceSchema, type Produce } from '../produce/schema';

/** Every produce record, validated at load, sorted by id. */
export const PRODUCE: Produce[] = records
  .map((json, i) => {
    const r = ProduceSchema.safeParse(json);
    if (!r.success) throw new Error(`invalid produce record ${i}: ${r.error.issues.map((x) => x.message).join('; ')}`);
    return r.data;
  })
  .sort((a, b) => a.id.localeCompare(b.id));

export { CATEGORIES, type Category } from './categories';

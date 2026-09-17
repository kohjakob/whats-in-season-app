import { describe, expect, it } from 'vitest';
import { loadProduce } from '../src/produce/load';
import { POPULARITY, defaultSelection, rankOf } from '../src/web/popularity';

const produce = loadProduce();
const cat = new Map(produce.map((c) => [c.id, c.category]));

describe('popularity order', () => {
  it('ranks every item exactly once and nothing else', () => {
    expect([...POPULARITY].sort()).toEqual(produce.map((c) => c.id).sort());
    expect(new Set(POPULARITY).size).toBe(POPULARITY.length);
  });
  it('puts tomatoes and apples first and herbs and nuts last', () => {
    expect(rankOf('tomato')).toBe(0);
    expect(rankOf('apple')).toBe(1);
    expect(rankOf('basil')).toBeGreaterThan(rankOf('lambs-lettuce'));
    expect(rankOf('unknown-produce')).toBe(POPULARITY.length);
  });
});

describe('defaultSelection', () => {
  const categoryOf = (id: string) => cat.get(id) as 'fruit' | 'vegetable' | 'herb' | 'nut';

  it('picks ten fruit and ten vegetables, no herbs or nuts, from what grows here', () => {
    const sel = defaultSelection(produce.map((c) => c.id), categoryOf);
    const cats = [...sel].map(categoryOf);
    expect(cats.filter((c) => c === 'fruit')).toHaveLength(10);
    expect(cats.filter((c) => c === 'vegetable')).toHaveLength(10);
    expect(cats.some((c) => c === 'herb' || c === 'nut')).toBe(false);
    expect(sel.has('tomato')).toBe(true);
    expect(sel.has('apple')).toBe(true);
  });

  it('skips produce that do not grow here and takes fewer when fewer exist', () => {
    const sel = defaultSelection(['banana', 'mango', 'tomato', 'basil'], categoryOf);
    expect([...sel].sort()).toEqual(['banana', 'mango', 'tomato']);
  });
});

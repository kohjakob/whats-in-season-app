import { describe, expect, it } from 'vitest';
import { loadProduce, parseProduce } from '../src/produce/load';

describe('produce records', () => {
  const produce = loadProduce();

  it('load, validate and have unique ids', () => {
    expect(produce.length).toBeGreaterThanOrEqual(90);
    expect(new Set(produce.map((c) => c.id)).size).toBe(produce.length);
  });

  it('carry an EcoCrop reference for their thermal block, or say why not', () => {
    for (const c of produce) {
      const thermal = c.sources.find((s) => s.field === 'thermal');
      expect(thermal, c.id).toBeDefined();
      if (c.ecocrop_code === undefined) expect(thermal!.credit, c.id).toMatch(/Not in FAO EcoCrop/);
      else expect(c.ecocrop_code, c.id).toBeGreaterThan(0);
    }
  });

  it('reject an optimum range outside the grow range', () => {
    const bad = { ...produce[0], thermal: { ...produce[0].thermal, t_opt_c: [0, 60] } };
    expect(() => parseProduce(bad, 'bad')).toThrow(/inside the grow range/);
  });
});

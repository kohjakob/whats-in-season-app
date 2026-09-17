import { z } from 'zod';

const source = z.object({
  /** Which part of the record this source backs, e.g. "thermal" or "model" */
  field: z.string(),
  credit: z.string(),
  url: z.string().url().optional(),
});

const thermal = z
  .object({
    /** Smoothed mean temperature below which the produce does not grow, C */
    t_grow_min_c: z.number(),
    /** Smoothed daily maximum above which growth stops, C */
    t_grow_max_c: z.number(),
    /** Optimal mean temperature range, used for the "peak" level, C */
    t_opt_c: z.tuple([z.number(), z.number()]),
    /** Smoothed daily minimum that kills the growing produce, C */
    t_kill_c: z.number(),
  })
  .refine((t) => t.t_opt_c[0] <= t.t_opt_c[1], { message: 't_opt_c must be ordered' })
  .refine((t) => t.t_grow_min_c <= t.t_opt_c[0] && t.t_opt_c[1] <= t.t_grow_max_c, {
    message: 't_opt_c must lie inside the grow range',
  });

const base = {
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'kebab-case id'),
  names: z.object({ en: z.string() }).catchall(z.string()),
  /** Scientific name as spelled in EcoCrop */
  species: z.string(),
  ecocrop_code: z.number().int().optional(),
  category: z.enum(['vegetable', 'fruit', 'herb', 'nut']),
  thermal,
  /** Weeks the harvest keeps in ordinary storage and still counts as local produce */
  storage_weeks: z.number().int().min(0).max(52),
  sources: z.array(source).min(1),
};

const warmAnnual = z.object({
  ...base,
  kind: z.literal('warm_annual'),
  model: z.object({
    t_base_c: z.number(),
    gdd_to_first_harvest: z.number().positive(),
    harvest_duration_days: z.number().int().positive(),
  }),
});

const coolAnnual = z.object({
  ...base,
  kind: z.literal('cool_annual'),
  model: z.object({
    cycle_days: z.number().int().positive(),
    stand_days: z.number().int().min(0),
  }),
});

const perennial = z.object({
  ...base,
  kind: z.literal('perennial'),
  model: z.object({
    /** 0 for subtropical and tropical fruit that needs no winter */
    chill_hours_min: z.number().min(0),
    t_kill_dormant_c: z.number(),
    bloom_t_c: z.number(),
    bloom_to_harvest_days: z
      .tuple([z.number().int().positive(), z.number().int().positive()])
      .refine(([a, b]) => a <= b, { message: 'bloom_to_harvest_days must be ordered' }),
    everbearing: z.boolean().default(false),
  }),
});

export const ProduceSchema = z.discriminatedUnion('kind', [warmAnnual, coolAnnual, perennial]);

export type Produce = z.infer<typeof ProduceSchema>;
export type ProduceKind = Produce['kind'];

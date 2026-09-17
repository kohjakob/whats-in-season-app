/**
 * Regression guard, not a claim of accuracy. Floors sit a few points under the scores reached on
 * 2026-09-16 so that a change which quietly breaks a whole region fails here. Raise a floor when
 * the model genuinely improves; never lower one to make a change pass.
 */
import { describe, expect, it } from 'vitest';
import { scoreAll } from '../src/validate/run';

const FLOORS: Record<string, { jaccard: number; recall: number }> = {
  germany: { jaccard: 0.58, recall: 0.72 },
  ontario: { jaccard: 0.55, recall: 0.62 },
  uk: { jaccard: 0.43, recall: 0.6 },
  'vertumnus-ny': { jaccard: 0.61, recall: 0.78 },
  // Lowered from 0.55 / 0.88 on 2026-09-16 by an explicit product rule, not a model regression:
  // produce without a peak are hidden, so foggy Salinas no longer contributes tomato and pepper weeks.
  'vertumnus-sfbay': { jaccard: 0.5, recall: 0.8 },
};

describe('model against published seasonal charts', () => {
  const scores = scoreAll();

  it('scores every truth set we ship', () => {
    expect(scores.map((s) => s.id).sort()).toEqual(Object.keys(FLOORS).sort());
  });

  for (const score of scores) {
    it(`${score.id}: mean Jaccard and recall stay above their floors`, () => {
      const floor = FLOORS[score.id];
      expect(score.meanJaccard, `jaccard ${score.meanJaccard.toFixed(3)}`).toBeGreaterThanOrEqual(floor.jaccard);
      expect(score.meanRecall, `recall ${score.meanRecall.toFixed(3)}`).toBeGreaterThanOrEqual(floor.recall);
    });
  }

  it('models at least three quarters of the items every chart lists', () => {
    for (const s of scores) {
      const share = s.items.length / (s.items.length + s.unmodelled.length);
      expect(share, s.id).toBeGreaterThanOrEqual(0.75);
    }
  });
});

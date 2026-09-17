/**
 * Score the model against every truth fixture and print a report.
 *   pnpm validate            summary per region plus the weakest items
 *   pnpm validate --all      every item with a week strip
 *   pnpm validate --set ny   one region
 */
import { scoreAll, loadTruthSets } from '../src/validate/run';
import { strip } from '../src/validate/score';

const args = process.argv.slice(2).filter((a, i) => !(i === 0 && a === '--'));
const all = args.includes('--all');
const setIdx = args.indexOf('--set');
const only = setIdx >= 0 ? args[setIdx + 1] : undefined;

const pct = (x: number) => `${Math.round(x * 100)}%`;
const sets = loadTruthSets().filter((s) => !only || s.id === only);

for (const score of scoreAll(sets)) {
  console.log(`\n${score.region} (${score.id}): ${score.items.length} items scored, ${score.unmodelled.length} not modelled`);
  console.log(
    `  mean Jaccard ${pct(score.meanJaccard)}  with storage ${pct(score.meanJaccardWithStorage)}  recall ${pct(score.meanRecall)}  precision ${pct(score.meanPrecision)}`,
  );
  const shown = all ? score.items : score.items.slice(0, 8);
  console.log(`  ${''.padEnd(20)} ${'J'.padStart(4)} ${'R'.padStart(4)} ${'P'.padStart(4)}  JFMAMJJASOND (█ both  ▓ model only  ░ truth only)`);
  for (const it of shown) {
    console.log(
      `  ${it.name.slice(0, 20).padEnd(20)} ${pct(it.jaccard).padStart(4)} ${pct(it.recall).padStart(4)} ${pct(it.precision).padStart(4)}  ${strip(it.modelFresh, it.truthFresh)}`,
    );
  }
  if (score.unmodelled.length) console.log(`  not modelled: ${score.unmodelled.join(', ')}`);
}

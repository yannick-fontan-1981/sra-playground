import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';

const reportPath = process.env.SIC_L1_SELECTION_REPORT;
if (!reportPath) throw new Error('Set SIC_L1_SELECTION_REPORT to a completed targeted campaign');
const report = JSON.parse(readFileSync(reportPath, 'utf8'));
const ranking = report.validation?.rule?.ranking;
if (!ranking || !Number.isFinite(ranking.mixed) || !Number.isFinite(ranking.distance)) {
  throw new Error('Missing induced selection ranking');
}
const source = new URL('../src/sic/observed-role-selection.ts', import.meta.url);
const imported = JSON.stringify(source.href);
const code = 'import {observedSelectionHypotheses as observe} from ' + imported
  + '; export {maskedRole, witnessedSelection, selectionReturnFacts, selectionNeedsWitness} from ' + imported
  + '; const rank = ' + JSON.stringify(ranking)
  + '; const score = h => Number(h.mixed)*rank.mixed'
  + '+(Math.abs(h.target[0]-h.current[0])+Math.abs(h.target[1]-h.current[1]))*rank.distance;'
  + 'export const observedSelectionHypotheses = (...args) => observe(...args).sort((a,b)=>score(b)-score(a));';
const experimental = 'data:text/javascript,' + encodeURIComponent(code);
registerHooks({
  resolve(specifier, context, next) {
    const result = next(specifier,context);
    return result.url === source.href && context.parentURL !== experimental
      ? { url: experimental, shortCircuit:true } : result;
  },
});

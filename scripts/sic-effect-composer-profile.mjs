import { writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';

const source = new URL('../src/sic/effect-composer.ts', import.meta.url).href;
const arm = process.env.SIC_COMPOSER_ARM;
const output = process.env.SIC_COMPOSER_USAGE;
const usage = {};
if (!['compose', 'one-effect-per-search'].includes(arm) || !output) throw new Error('Missing composer profile');

export function observe(compose, problem) {
  const { domain, budget, goal } = problem;
  const result = compose(arm === 'compose' ? problem : {
    ...problem, budget: { ...budget, commands: Math.min(1, budget.commands) },
  });
  const entry = usage[domain] ??= { attempts: 0, plans: 0, multi: 0, longest: 0 };
  entry.attempts++;
  if (!result?.effects.length) return result;
  entry.plans++;
  entry.longest = Math.max(entry.longest, result.effects.length);
  if (result.effects.length > 1) {
    entry.multi++;
    entry.first ??= { goal: goal.relation, length: result.effects.length,
      requires: relations(result.effects, 'requires'), maintains: relations(result.effects, 'maintains'),
      ensures: relations(result.effects, 'ensures'),
      witnessedEffects: result.effects.filter(effect => effect.evidence?.length).length };
  }
  return result;
}

function relations(effects, property) {
  return [...new Set(effects.flatMap(effect => effect[property]?.map(condition => condition.relation) ?? []))].sort();
}

const wrapper = 'data:text/javascript,' + encodeURIComponent(
  'import { composePlan as plan } from ' + JSON.stringify(source)
  + '; import { observe } from ' + JSON.stringify(import.meta.url)
  + '; export function composePlan(problem) { return observe(plan, problem); }'
);
registerHooks({
  resolve(specifier, context, nextResolve) {
    const result = nextResolve(specifier, context);
    return result.url === source && context.parentURL !== wrapper ? { url: wrapper, shortCircuit: true } : result;
  },
});
process.once('exit', () => writeFileSync(output, JSON.stringify(usage) + '\n'));

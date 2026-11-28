import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { scenario } from './terrain.mjs';
import { initialModels, observationKey, transitions } from './models.mjs';
import { fixedWorkflow, onlineComposition } from './policies.mjs';

const distinct = values => [...new Set(values)];

export function play(spec, policy, prior = undefined) {
  const terrain = scenario(spec);
  const { rules } = terrain;
  const compatiblePrior = prior?.alphabet === JSON.stringify([...rules.controls].sort()) ? prior : undefined;
  const controller = policy(rules, compatiblePrior);
  let models = initialModels(rules), observed = terrain.read(), stop, learned;
  const steps = [];
  while (steps.length < rules.moveBudget && !observed.outcome) {
    const decision = controller.decide({ observed, models, remaining: rules.moveBudget - steps.length });
    if (decision.action === undefined) {
      stop = { ...decision, observed, hypotheses: models.length };
      break;
    }
    const predictions = transitions(rules, observed, models, decision.action);
    const next = terrain.step(decision.action);
    const branches = predictions.get(observationKey(next));
    if (!branches) throw new Error('Public model omitted observed return at command ' + (steps.length + 1));
    const before = distinct(models.map(model => model.control));
    const after = distinct(branches.models.map(model => model.control));
    steps.push({ number: steps.length + 1, observed, decision, returned: next,
      hypothesesBefore: models.length, hypothesesAfter: branches.models.length, possibleControls: after });
    if (before.length > 1 && after.length === 1) {
      learned = { control: after[0], alphabet: JSON.stringify([...rules.controls].sort()), evidence: steps.length };
    }
    observed = next;
    models = branches.models;
  }
  stop ??= { reason: observed.outcome ?? 'move_budget_exhausted', observed, hypotheses: models.length };
  return { prior: compatiblePrior, gestures: steps.length, expanded: controller.expanded(), stop, learned, steps };
}

function firstDifference(a, b) {
  for (let index = 0; index <= Math.max(a.steps.length, b.steps.length); index++) {
    const control = a.steps[index], composed = b.steps[index];
    const left = control?.decision.action ?? a.stop.reason;
    const right = composed?.decision.action ?? b.stop.reason;
    if (left !== right) return { turn: index + 1, fixed: control ?? a.stop, composed: composed ?? b.stop };
    if (!control && !composed) return null;
  }
  return null;
}

export function run(fixture) {
  if (fixture.version !== 1 || !Array.isArray(fixture.cases) || !Array.isArray(fixture.transfers)) throw new Error('Invalid fixture');
  const byId = new Map(fixture.cases.map(spec => [spec.id, spec]));
  if (byId.size !== fixture.cases.length) throw new Error('Duplicate scenario identity');
  const cases = {};
  for (const spec of byId.values()) {
    const fixed = play(spec, fixedWorkflow);
    const composed = play(spec, onlineComposition);
    Object.defineProperty(cases, spec.id, { value: { fixed, composed, firstDifference: firstDifference(fixed, composed) }, enumerable: true });
  }
  const transfers = fixture.transfers.map(({ from, to }) => {
    const source = byId.get(from), target = byId.get(to);
    if (!source || !target || source.mechanic === target.mechanic) throw new Error('Invalid transfer pair');
    const withEvidence = play(target, onlineComposition, cases[from].composed.learned);
    const without = cases[to].composed;
    return { from, to, withEvidence, without, firstDifference: firstDifference(without, withEvidence) };
  });
  return { version: 1, cases, transfers };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { cases: { type: 'string' }, report: { type: 'string' } } });
  if (!values.cases || !values.report) throw new Error('Usage: node rejouer.mjs --cases fixture.json --report report.json');
  const result = run(JSON.parse(readFileSync(values.cases, 'utf8')));
  writeFileSync(values.report, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  const cases = Object.values(result.cases);
  const summary = key => ({ wins: cases.filter(row => row[key].stop.reason === 'win').length,
    losses: cases.filter(row => row[key].stop.reason === 'loss').length,
    gestures: cases.reduce((sum, row) => sum + row[key].gestures, 0) });
  console.log(JSON.stringify({ cases: cases.length, fixed: summary('fixed'), composed: summary('composed'),
    transfers: result.transfers.length }));
}

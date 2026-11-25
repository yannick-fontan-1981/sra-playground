import { accepts, cycleHypotheses } from './sic-transfer-rule.mjs';

const features = ['onset', 'period', 'prefixConflicts', 'minimumWitnesses', 'coverage'];
const forbidden = new Set(['contradiction', 'insufficient']);

function examplesFrom(rows) {
  const examples = [];
  for (const row of rows) {
    const negative = forbidden.has(row.spec.intent);
    const source = row.baseline.traces ? row.baseline : row.candidate;
    if (!negative && source.frontier !== 'phase-measurement') continue;
    const models = (source.traces ?? []).flatMap(trace => cycleHypotheses(trace));
    if (models.length) examples.push({ id: row.id, negative, strategy: row.spec.strategy, models });
  }
  return examples;
}

function score(examples, conditions) {
  let admitted = 0, falseAdmissions = 0;
  const consumers = new Set();
  const ids = [];
  for (const example of examples) {
    if (!example.models.some(model => accepts(model, conditions))) continue;
    if (example.negative) falseAdmissions++;
    else {
      admitted++;
      consumers.add(example.strategy);
      if (ids.length < 16) ids.push(example.id);
    }
  }
  return { admitted, falseAdmissions, consumers: [...consumers], ids };
}

function better(candidate, current) {
  if (candidate.consumers.length < 2) return false;
  if (candidate.falseAdmissions !== current.falseAdmissions) return candidate.falseAdmissions < current.falseAdmissions;
  if (candidate.consumers.length !== current.consumers.length) return candidate.consumers.length > current.consumers.length;
  return candidate.admitted > current.admitted;
}

export function induceAbstraction(rows) {
  const examples = examplesFrom(rows);
  const atoms = features.flatMap(feature => {
    const observed = new Set();
    for (const example of examples) for (const model of example.models) observed.add(model.features[feature]);
    return [...observed].sort((a, b) => a - b).flatMap(value => ['<=', '>='].map(op => ({ feature, op, value })));
  });
  const conditions = [];
  let best = score(examples, conditions);
  const unconstrained = best;
  while (conditions.length < 3 && best.falseAdmissions > 0) {
    let choice;
    for (const atom of atoms) {
      if (conditions.some(existing => existing.feature === atom.feature && existing.op === atom.op)) continue;
      const candidate = score(examples, [...conditions, atom]);
      if (better(candidate, choice?.score ?? best)) choice = { atom, score: candidate };
    }
    if (!choice) break;
    conditions.push(choice.atom);
    best = choice.score;
  }
  return { inference: 'periodic-suffix-with-agreeing-predictions', conditions,
    evaluatedConditions: atoms.length, examples: examples.length, unconstrained, fit: best };
}

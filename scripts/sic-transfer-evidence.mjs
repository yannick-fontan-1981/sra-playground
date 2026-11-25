import { startupLength } from './sic-transfer-generator.mjs';

const expectsAbstention = spec => ['contradiction', 'insufficient'].includes(spec.intent);
const hasProof = result => result.proof?.some(phase => phase.start > 0
  && phase.witnesses.length >= 2 && phase.witnesses.every(count => count >= 3));

function groupName({ spec, candidate }) {
  if (expectsAbstention(spec)) return candidate.outcome === 'abstained' ? null : 'guard/' + candidate.frontier;
  if (candidate.outcome === 'verified') return null;
  if (candidate.frontier === 'phase-measurement' && startupLength(spec) > 3) return 'phase-measurement/long-transient';
  return candidate.outcome + '/' + candidate.frontier;
}

function complexity(spec) {
  return spec.strategy === 'clocked-arrival' ? spec.gates.length * 10 + spec.delays.length * 2
    + spec.gates.reduce((total, gate) => total + gate.phases.length, 0) : spec.span * 3 + spec.phases.length;
}

export function summarize(rows, plan) {
  const strategies = {}, failures = {};
  for (const row of rows) {
    const { id, spec, baseline, candidate } = row;
    const strategy = spec.strategy;
    const counts = strategies[strategy] ??= {
      pairs: 0, positive: 0, beforeVerified: 0, afterVerified: 0, gains: 0, gainsWithProof: 0, losses: 0,
      negative: 0, beforeGuardViolations: 0, afterGuardViolations: 0, newGuardViolations: 0, newExecutionMismatches: 0,
    };
    counts.pairs++;
    if (expectsAbstention(spec)) {
      counts.negative++;
      if (baseline.outcome !== 'abstained') counts.beforeGuardViolations++;
      if (candidate.outcome !== 'abstained') counts.afterGuardViolations++;
      if (baseline.outcome === 'abstained' && candidate.outcome !== 'abstained') counts.newGuardViolations++;
    } else {
      counts.positive++;
      if (baseline.outcome === 'verified') counts.beforeVerified++;
      if (candidate.outcome === 'verified') counts.afterVerified++;
      if (candidate.outcome === 'verified' && baseline.outcome !== 'verified') {
        counts.gains++;
        if (hasProof(candidate)) counts.gainsWithProof++;
      }
      if (baseline.outcome === 'verified' && candidate.outcome !== 'verified') counts.losses++;
      if (baseline.outcome !== 'mismatch' && candidate.outcome === 'mismatch') counts.newExecutionMismatches++;
    }
    const label = groupName(row);
    if (!label) continue;
    const group = failures[label] ??= { count: 0, strategies: {}, examples: {} };
    group.count++;
    group.strategies[strategy] = (group.strategies[strategy] ?? 0) + 1;
    const score = complexity(spec);
    if ((group.examples[strategy]?.score ?? Infinity) > score) {
      group.examples[strategy] = { id, score, intent: spec.intent, onset: startupLength(spec), frontier: candidate.frontier };
    }
  }
  const supported = Object.keys(strategies).filter(name => strategies[name].gainsWithProof > 0);
  const qualified = supported.length >= 2 && Object.values(strategies)
    .every(value => value.losses === 0 && value.newGuardViolations === 0 && value.newExecutionMismatches === 0);
  return { ...plan, comparisons: rows.length, strategies, supported, qualified, failures };
}

export function chooseProbe(discovery) {
  const target = 'phase-measurement/long-transient';
  const evidence = discovery.failures[target];
  if (Object.values(evidence?.strategies ?? {}).filter(count => count >= 3).length >= 2) {
    return { baseline: 'production', candidate: 'extended', target, reason: evidence.count };
  }
  return { baseline: 'disabled', candidate: 'production', target: null, reason: 0 };
}

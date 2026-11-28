import { createHash } from 'node:crypto';
import { planAccess } from './candidate.mjs';
import { planFrozen } from './frozen.mjs';
import { oraclePolicyTrace, oracleReplay, oracleSolve } from './oracle.mjs';
import { runP09 } from './p09.mjs';
import { auditP09, certifyP09 } from './p09-audit.mjs';
import { executePolicy, initialState, normalizeBelief, observe, observationKey, stepState } from './runtime.mjs';
import { structuralSignature, transformScenario } from './generator.mjs';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function certify(spec, { parent = false } = {}) {
  const specHash = hash(spec);
  const solution = oracleSolve(spec, { parent });
  if (!solution.solvable) return { accepted: false, specHash, reason: solution.reason, explored: solution.explored };
  const worlds = spec.initial.map((_, world) => {
    const steps = oraclePolicyTrace(spec, solution, { world, parent });
    const audit = oracleReplay(spec, steps, { world, parent });
    return { world, steps, audit };
  });
  const accepted = worlds.every(({ audit }) => audit.valid && audit.accessVerified && audit.goalAtEnd
    && audit.commands <= spec.budget.commands);
  return { accepted, reason: accepted ? 'certified-executable-policy' : 'oracle-certificate-failed',
    specHash,
    certificateHash: solution.certificateHash, worstCommands: solution.worstCommands,
    explored: solution.explored, generated: solution.generated, worlds };
}

function play(spec, plan) {
  const worlds = spec.initial.map((_, world) => {
    const played = executePolicy(spec, plan.policy, { world });
    const audit = oracleReplay(spec, played.steps, { world });
    const mismatch = played.accessVerified !== audit.accessVerified || played.crossings !== audit.crossings
      || played.newObservations !== audit.newObservations || played.officialWins !== audit.officialWins
      || played.commands !== audit.commands || !audit.valid;
    return { world, played, audit, mismatch };
  });
  return {
    status: plan.status, explored: plan.explored, declaredWorstCommands: plan.worstCommands,
    verified: worlds.every(world => world.audit.valid && world.audit.accessVerified && world.audit.goalAtEnd),
    worstCommands: Math.max(...worlds.map(world => world.audit.commands)),
    commands: worlds.reduce((sum, world) => sum + world.audit.commands, 0),
    crossings: worlds.reduce((sum, world) => sum + world.audit.crossings, 0),
    newObservations: worlds.reduce((sum, world) => sum + world.audit.newObservations, 0),
    simulatedWins: worlds.reduce((sum, world) => sum + world.audit.officialWins, 0),
    mismatches: worlds.filter(world => world.mismatch).length,
    worlds,
  };
}

export function compareInvariance(spec, original, variant) {
  const transformed = transformScenario(spec, variant);
  const frozen = play(transformed, planFrozen(transformed));
  const candidate = play(transformed, planAccess(transformed));
  return { variant, signatureStable: structuralSignature(spec) === structuralSignature(transformed),
    frozenAccessStable: frozen.verified === original.frozen.verified,
    candidateAccessStable: candidate.verified === original.candidate.verified,
    frozenCommandDelta: frozen.commands - original.frozen.commands,
    candidateCommandDelta: candidate.commands - original.candidate.commands,
    mismatches: frozen.mismatches + candidate.mismatches,
    transformedTraceHash: hash([frozen.worlds.map(world => world.played.steps), candidate.worlds.map(world => world.played.steps)]) };
}

function firstDifference(frozen, candidate) {
  const differences = [];
  for (let world = 0; world < candidate.worlds.length; world++) {
    const before = frozen.worlds[world].played.steps, after = candidate.worlds[world].played.steps;
    for (let index = 0; index < Math.max(before.length, after.length); index++) {
      if (before[index]?.action === after[index]?.action
        && observationKey(before[index]?.observation) === observationKey(after[index]?.observation)
        && before[index]?.identityClaim === after[index]?.identityClaim) continue;
      differences.push({ world, command: index + 1,
        frozen: before[index] ?? null, candidate: after[index] ?? null,
        prefixHash: hash(after.slice(0, index)),
        reason: !before[index] ? 'frozen-has-no-next-command' : !after[index] ? 'candidate-already-ended'
          : before[index].action !== after[index].action ? 'different-command' : 'different-return' });
      break;
    }
  }
  return differences.sort((a, b) => a.command - b.command || a.world - b.world)[0] ?? null;
}

function applyUpdates(state, updates) {
  const next = structuredClone(state);
  for (const change of updates ?? []) {
    if ('set' in change) next.values[change.variable] = change.set;
    else next.values[change.variable] += change.add;
  }
  return next;
}

/** Replay the same prefix and remove only the dependency at its first real use. */
export function ablateConsumedDependencies(spec, candidate) {
  const results = [];
  for (const { world, played } of candidate.worlds) {
    for (const ablation of spec.ablations ?? []) {
      const receipt = played.receipts.find(event => event.kind === 'crossing'
        && event.dependency === ablation.dependency && (!ablation.actions || ablation.actions.includes(event.action)));
      if (!receipt) continue;
      const at = Number(receipt.id.split(':')[1]) - 1;
      const prefix = played.steps.slice(0, at);
      let actual = initialState(spec, world);
      const observedAtStart = observationKey(observe(spec, actual));
      let belief = spec.initial.map((_, hypothesis) => initialState(spec, hypothesis))
        .filter(state => observationKey(observe(spec, state)) === observedAtStart);
      for (const step of prefix) {
        actual = stepState(spec, actual, step.action).state;
        belief = normalizeBelief(belief.map(state => stepState(spec, state, step.action))
          .filter(result => observationKey(result.observation) === observationKey(step.observation)).map(result => result.state));
      }
      const checkpointHash = hash(actual), knowledgeHash = hash(belief);
      const withheldActions = ablation.kind === 'route-proof' ? [receipt.action] : [];
      const updates = ablation.kind === 'route-proof' ? [] : ablation.updates ?? [];
      actual = applyUpdates(actual, updates);
      belief = belief.map(state => applyUpdates(state, updates));
      const remaining = spec.budget.commands - at;
      const model = { ...spec, actions: spec.actions.filter(action => !withheldActions.includes(action.id)),
        initial: belief.map(state => state.values), budget: { ...spec.budget, commands: remaining } };
      const plan = planAccess(model, { initialBelief: belief });
      const tail = executePolicy(spec, plan.policy, { world, startState: actual, limit: remaining });
      const steps = [...prefix, ...tail.steps];
      const intervention = { at, updates, withheldActions };
      const audit = oracleReplay(spec, steps, { world, intervention });
      const counterfactual = oracleSolve(model, { initialEvidence: belief.every(state => state.evidence) });
      const intended = stepState(spec, actual, receipt.action);
      results.push({ world, dependency: ablation.dependency, kind: ablation.kind, atCommand: at + 1,
        consumedAction: receipt.action, prefixHash: hash(prefix), checkpointHash, knowledgeHash,
        intervention, changedVariables: updates.map(update => update.variable),
        physicalWorldChanged: updates.length > 0, remainingCommands: remaining,
        plannerStatus: plan.status, explored: plan.explored,
        counterfactualOracle: { solvable: counterfactual.solvable, worstCommands: counterfactual.worstCommands,
          reason: counterfactual.reason ?? null },
        originalActionNowBlocked: intended.blocked,
        nextAction: tail.steps[0]?.action ?? null, decisionChanged: tail.steps[0]?.action !== receipt.action,
        accessRetained: audit.valid && audit.goalAtEnd, totalCommands: steps.length,
        extraCommands: steps.length - played.commands,
        audit, tail: tail.steps,
      });
    }
  }
  return results;
}

/** All metrics below concern independently replayed component simulations. */
export function compareScenario(spec, certificate, { ablations = true, p09 = true } = {}) {
  if (!certificate?.accepted || certificate.specHash !== hash(spec)) throw new Error('Comparison requires the executable certificate of this exact scenario');
  const frozen = play(spec, planFrozen(spec));
  const candidate = play(spec, planAccess(spec));
  const accessGain = candidate.verified && !frozen.verified;
  const shorter = candidate.verified && frozen.verified && candidate.worstCommands < frozen.worstCommands;
  const regression = frozen.verified && !candidate.verified;
  const dependencyTests = ablations && (accessGain || shorter) ? ablateConsumedDependencies(spec, candidate) : [];
  let parent = null;
  if (p09) {
    const subgoal = { ...spec, budget: { ...spec.budget, commands: spec.budget.commands - 1 } };
    const parentCertificate = certifyP09(spec);
    const plan = planAccess(subgoal, { parent: true });
    const unconstrained = planAccess(subgoal);
    const worlds = spec.initial.map((_, world) => {
      const result = runP09(spec, { world, planner: () => plan });
      const audit = result.execution ? oracleReplay(subgoal, result.execution.steps, { world, parent: true }) : null;
      const fullAudit = auditP09(spec, result, { world });
      const withoutInvariant = executePolicy(subgoal, unconstrained.policy, { world });
      const decisionChanged = result.execution?.steps.map(step => step.action).join('\n') !== withoutInvariant.steps.map(step => step.action).join('\n');
      return { world, result, audit, fullAudit, decisionChanged,
        unconstrainedSameBudget: { commands: withoutInvariant.commands, actions: withoutInvariant.steps.map(step => step.action) } };
    });
    parent = { oracleFeasible: parentCertificate.accepted, oracleWorstCommands: parentCertificate.worstCommands,
      certificateHash: parentCertificate.certificateHash,
      completed: worlds.every(({ result, audit, fullAudit }) => result.completed && result.parentResumed && audit?.valid
        && audit.accessVerified && audit.goalAtEnd && fullAudit.completed && fullAudit.valid
        && result.commands <= spec.budget.commands),
      invariantChangesDecision: worlds.some(world => world.decisionChanged),
      worstCommands: Math.max(...worlds.map(({ result }) => result.commands)), worlds };
  }
  const retainedSegments = candidate.worlds.map(({ world, played, audit }) => {
    const changes = audit.events.filter(event => event.kind === 'invalidation');
    const first = changes[0]?.index;
    return { world, invalidated: changes.map(event => ({ command: event.index + 1, segment: event.segment })),
      reusedAfterChange: first === undefined ? [] : audit.events.filter(event => event.kind === 'crossing'
        && event.dependency === 'retained-route' && event.index > first).map(event => ({ action: event.action, command: event.index + 1 })),
      prefixCommandsPreserved: first === undefined ? 0 : first + 1,
      finalAccess: played.accessVerified };
  });
  return { id: spec.id, family: spec.family, provenance: 'simulated-declarative-P07',
    budget: spec.budget, worlds: spec.initial.length,
    oracle: { certificateHash: certificate.certificateHash, worstCommands: certificate.worstCommands,
      explored: certificate.explored, worlds: certificate.worlds },
    frozen, candidate, accessGain, shorter, regression, firstDifference: firstDifference(frozen, candidate),
    ablations: dependencyTests, parent, retainedSegments, nativeVictories: 0 };
}

export function emptyTotals() {
  const arm = () => ({ accesses: 0, verifiedWorlds: 0, crossings: 0, newObservations: 0, simulatedWins: 0, commands: 0,
    worstCommands: 0, explored: 0 });
  return { cases: 0, worlds: 0, certified: 0, frozen: arm(), candidate: arm(), accessGains: 0, shorter: 0,
    regressions: 0, replayMismatches: 0, candidateMisses: 0, firstDifferences: 0, parentFeasible: 0,
    parentCompleted: 0, parentInvariantChangesDecision: 0, ablations: 0, ablatedAccessLost: 0,
    ablatedAccessRetained: 0, ablatedMoreCommands: 0, ablationDecisionsChanged: 0, ablationAuditErrors: 0,
    ablationOracleFeasible: 0, ablationOracleImpossible: 0, ablationPlannerMisses: 0,
    recoveryWorlds: 0, recoveryWorldsWithRetainedSegments: 0, savedCommandsOnJointSuccess: 0, nativeVictories: 0 };
}

export function addResult(totals, row) {
  totals.cases++;
  totals.worlds += row.worlds;
  totals.certified++;
  for (const arm of ['frozen', 'candidate']) {
    const value = row[arm], target = totals[arm];
    target.accesses += Number(value.verified);
    target.verifiedWorlds += value.worlds.filter(world => world.audit.accessVerified).length;
    for (const metric of ['crossings', 'newObservations', 'simulatedWins', 'commands', 'explored']) target[metric] += value[metric];
    target.worstCommands = Math.max(target.worstCommands, value.worstCommands);
    totals.replayMismatches += value.mismatches;
  }
  totals.accessGains += Number(row.accessGain);
  totals.shorter += Number(row.shorter);
  totals.regressions += Number(row.regression);
  totals.candidateMisses += Number(!row.candidate.verified);
  totals.firstDifferences += Number(!!row.firstDifference);
  totals.parentFeasible += Number(Boolean(row.parent?.oracleFeasible));
  totals.parentCompleted += Number(Boolean(row.parent?.completed));
  totals.parentInvariantChangesDecision += Number(Boolean(row.parent?.invariantChangesDecision));
  if (row.frozen.verified && row.candidate.verified) totals.savedCommandsOnJointSuccess += row.frozen.commands - row.candidate.commands;
  for (const ablation of row.ablations) {
    totals.ablations++;
    totals.ablatedAccessLost += Number(!ablation.accessRetained);
    totals.ablatedAccessRetained += Number(ablation.accessRetained);
    totals.ablatedMoreCommands += Number(ablation.accessRetained && ablation.extraCommands > 0);
    totals.ablationDecisionsChanged += Number(ablation.decisionChanged);
    totals.ablationAuditErrors += Number(!ablation.audit.valid);
    totals.ablationOracleFeasible += Number(ablation.counterfactualOracle.solvable);
    totals.ablationOracleImpossible += Number(!ablation.counterfactualOracle.solvable);
    totals.ablationPlannerMisses += Number(ablation.counterfactualOracle.solvable && !ablation.accessRetained);
  }
  for (const recovery of row.retainedSegments) {
    if (!recovery.invalidated.length) continue;
    totals.recoveryWorlds++;
    totals.recoveryWorldsWithRetainedSegments += Number(recovery.reusedAfterChange.length > 0 && recovery.finalAccess);
  }
  return totals;
}

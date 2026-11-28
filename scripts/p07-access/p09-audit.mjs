/**
 * Independent P09 integration audit. Reconstructs the declarative parent action
 * from the protocol and uses only the independent oracle for its semantics.
 * Does not import p09.mjs, runtime.mjs, candidate.mjs or the historical composer.
 */
import { oraclePolicyTrace, oracleReplay, oracleSolve } from './oracle.mjs';

function parentProblem(spec) {
  const variableNames = new Set(spec.variables.map(variable => variable.id));
  let marker = '__p09_parent_completed';
  while (variableNames.has(marker)) marker += '_';
  const actionNames = new Set(spec.actions.map(action => action.id));
  let actionId = '__p09_resume_parent';
  while (actionNames.has(actionId)) actionId += '_';
  const augmented = structuredClone(spec);
  augmented.variables.push({ id: marker, role: 'parent-completion' });
  augmented.initial = augmented.initial.map(values => ({ ...values, [marker]: 0 }));
  augmented.actions.push({
    id: actionId,
    kind: 'interact',
    requires: { all: [structuredClone(spec.goal), structuredClone(spec.parentInvariant)] },
    updates: [{ variable: marker, set: 1 }],
    events: [],
  });
  augmented.goal = { all: [structuredClone(spec.goal), { variable: marker, eq: 1 }] };
  return { spec: augmented, marker, actionId };
}

/** Certify the whole access-plus-parent policy under the original common ceiling. */
export function certifyP09(spec) {
  const problem = parentProblem(spec);
  const solution = oracleSolve(problem.spec, { parent: true });
  if (!solution.solvable) return {
    solvable: false,
    accepted: false,
    worstCommands: null,
    explored: solution.explored,
    generated: solution.generated,
    reason: solution.reason,
    certificateHash: null,
    worlds: [],
  };
  const worlds = spec.initial.map((_, world) => {
    const steps = oraclePolicyTrace(problem.spec, solution, { world, parent: true });
    const audit = oracleReplay(problem.spec, steps, { world, parent: true });
    const parentCommands = steps.filter(step => step.action === problem.actionId).length;
    return { world, steps, audit, parentCommands };
  });
  const accepted = worlds.every(({ steps, audit, parentCommands }) => audit.valid && audit.accessVerified
    && audit.goalAtEnd && audit.commands === steps.length && audit.commands <= spec.budget.commands
    && parentCommands === 1);
  return {
    solvable: accepted,
    accepted,
    worstCommands: solution.worstCommands,
    explored: solution.explored,
    generated: solution.generated,
    reason: accepted ? 'certified-access-and-parent-policy' : 'parent-oracle-certificate-failed',
    certificateHash: solution.certificateHash,
    worlds,
  };
}

/** Replay all actually reported commands, including the final parent interaction. */
export function auditP09(spec, result, { world = 0 } = {}) {
  const problem = parentProblem(spec);
  const childSteps = result?.execution?.steps ?? [];
  const steps = childSteps.map(step => ({ ...structuredClone(step),
    observation: { ...structuredClone(step.observation),
      values: { ...step.observation.values, [problem.marker]: 0 } } }));
  if (result?.parentStep) steps.push(structuredClone(result.parentStep));
  const audit = oracleReplay(problem.spec, steps, { world, parent: true });
  const parentCommandMatched = !!result?.parentStep && result.parentStep.action === problem.actionId;
  const reportedCommandsMatch = result?.commands === audit.commands && audit.commands === steps.length;
  return {
    ...audit,
    completed: audit.valid && audit.accessVerified && audit.goalAtEnd && parentCommandMatched
      && reportedCommandsMatch && audit.commands <= spec.budget.commands,
    parentCommandMatched,
    reportedCommandsMatch,
    fullTraceCommands: steps.length,
    provenance: 'independent-oracle-access-and-parent-replay',
  };
}

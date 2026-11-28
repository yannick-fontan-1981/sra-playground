import { createHash } from 'node:crypto';
import { composePlan } from '../../src/sic/effect-composer.ts';
import { planAccess } from './candidate.mjs';
import { executePolicy, identifyInView, initialState, isGoal, observationKey, observe,
  predicate, stateKey, stepState } from './runtime.mjs';

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Issue a receipt from a replayed execution, never from a predicted end state. */
export function issueAccessReceipt(spec, execution, { world = 0 } = {}) {
  if (!execution || execution.accessVerified !== true || execution.firstViolation
    || !Array.isArray(execution.steps) || execution.commands !== execution.steps.length
    || execution.commands > spec.budget.commands || !execution.finalState) return null;
  let state = initialState(spec, world);
  if (!predicate(spec.invariant, state.values) || !predicate(spec.parentInvariant, state.values)) return null;
  const consumed = [];
  let witnessed = false;
  for (const [index, recorded] of execution.steps.entries()) {
    if (!spec.actions.some(action => action.id === recorded.action)) return null;
    const next = stepState(spec, state, recorded.action, { parent: true });
    if (!next.valid || observationKey(next.observation) !== observationKey(recorded.observation)) return null;
    if (next.observation.view && recorded.identityClaim !== identifyInView(next.observation.view)) return null;
    for (const event of next.events) {
      if (event.kind === 'crossing' || event.kind === 'observation') witnessed = true;
      if (event.dependency) consumed.push({ return: index + 1, action: recorded.action, dependency: event.dependency });
    }
    state = next.state;
  }
  if (!witnessed || !isGoal(spec, state) || stateKey(state) !== stateKey(execution.finalState)) return null;
  return {
    kind: 'played-access-receipt',
    provenance: 'simulated-component-execution',
    scenario: spec.id,
    commands: execution.commands,
    traceHash: digest(execution.steps),
    finalObservationHash: digest(observe(spec, state)),
    invariantPreserved: true,
    consumed,
  };
}

/**
 * Resume a parent only with a matching played receipt. The parent interaction is
 * an explicit simulator command, not an official native victory. Its one gesture
 * is added to the same physical command ledger as all commands of the subgoal.
 */
export function resumeP09(spec, receipt, execution, { world = 0 } = {}) {
  const checked = issueAccessReceipt(spec, execution, { world });
  const rejected = reason => ({ completed: false, parentResumed: false, parentCommands: 0,
    commands: execution?.commands ?? 0, reason, metaExplored: 0, parentStep: null });
  if (!checked || !receipt || digest(receipt) !== digest(checked)) return rejected('unverified-access-receipt');
  if (execution.commands >= spec.budget.commands) return rejected('no-parent-command-budget');

  let marker = '__p09_parent_completed';
  while (spec.variables.some(variable => variable.id === marker)) marker += '_';
  let actionId = '__p09_resume_parent';
  while (spec.actions.some(action => action.id === actionId)) actionId += '_';
  const parentAction = {
    id: actionId,
    kind: 'interact',
    requires: { all: [spec.goal, spec.parentInvariant] },
    updates: [{ variable: marker, set: 1 }],
    events: [],
  };
  const augmented = { ...spec,
    variables: [...spec.variables, { id: marker, role: 'parent-completion' }],
    actions: [...spec.actions, parentAction],
  };
  const before = { ...execution.finalState, values: { ...execution.finalState.values, [marker]: 0 } };
  const initial = { physical: before, spent: execution.commands, receiptAccepted: true };
  let examined = 0;
  const composition = composePlan({
    initial,
    key: state => `${state.spent}/${state.physical.values[marker]}`,
    goal: { relation: 'The parent interaction was reached after a verified access receipt',
      holds: state => { examined++; return state.physical.values[marker] === 1; } },
    *choices(state) {
      const predicted = stepState(augmented, state.physical, actionId, { parent: true });
      if (!predicted.valid || predicted.blocked) return;
      yield {
        action: { kind: 'resume-parent', command: actionId, receipt: checked.traceHash },
        after: { ...state, physical: predicted.state, spent: state.spent + 1 },
        requires: [{ relation: 'Played receipt and remaining primitive gesture budget',
          holds: current => current.receiptAccepted && current.spent < spec.budget.commands }],
        maintains: [{ relation: 'The requested invariant still holds on parent resumption',
          holds: current => predicate(spec.parentInvariant, current.physical.values) }],
        ensures: [{ relation: 'The complete primitive ledger remains within the original ceiling',
          holds: current => current.spent <= spec.budget.commands }],
        evidence: [checked.traceHash, checked.finalObservationHash],
      };
    },
    // This is a one-step parent decision; the physical ledger above includes the
    // entire P07 trajectory. A macro trajectory is never counted as one gesture.
    budget: { commands: 1, states: Math.max(1, Math.min(2, spec.budget.states)) },
  });
  if (!composition) return { ...rejected('parent-invariant-or-guard'), metaExplored: examined };
  const played = stepState(augmented, before, actionId, { parent: true });
  const completed = played.valid && !played.blocked && played.state.values[marker] === 1
    && stateKey(played.state) === stateKey(composition.end.physical);
  return {
    completed,
    parentResumed: completed,
    parentCommands: 1,
    commands: execution.commands + 1,
    reason: completed ? 'played-parent-interaction' : 'parent-return-contradicted',
    metaExplored: composition.explored,
    parentStep: { action: actionId, observation: played.observation },
  };
}

/** Component integration: real P09 composePlan requests P07, then consumes its receipt. */
export function runP09(spec, { world = 0, planner = planAccess } = {}) {
  const request = {
    primitive: 'P07',
    goal: spec.goal,
    preserve: { all: [spec.invariant, spec.parentInvariant] },
    budget: { ...spec.budget, commands: Math.max(0, spec.budget.commands - 1) },
    returnContract: 'A replayed crossing or new observation with the invariant maintained',
  };
  const requested = composePlan({
    initial: { requested: false, physicalCommands: 0 },
    key: state => Number(state.requested),
    goal: { relation: 'Request the access subgoal needed by the parent', holds: state => state.requested },
    *choices(state) {
      yield { action: request, after: { ...state, requested: true },
        requires: [{ relation: 'There is room for an access and the parent interaction',
          holds: () => spec.budget.commands >= 2 }] };
    },
    budget: { commands: 1, states: Math.max(1, Math.min(2, spec.budget.states)) },
  });
  if (!requested) return { requested: false, request, completed: false, parentResumed: false,
    parentCommands: 0, commands: 0, accessVerified: false, reason: 'request-budget', metaExplored: 0 };

  const subgoal = { ...spec, budget: request.budget };
  const plan = planner(subgoal, { parent: true });
  if (!plan.policy) return { requested: true, request, completed: false, parentResumed: false,
    parentCommands: 0, commands: 0, accessVerified: false, reason: 'access-policy-unavailable',
    plannerStatus: plan.status, explored: plan.explored, metaExplored: requested.explored };
  const execution = executePolicy(subgoal, plan.policy, { world, parent: true });
  // Validation against the original ceiling leaves the already-reserved parent
  // command available, while execution itself used the smaller subgoal ceiling.
  const receipt = issueAccessReceipt(spec, execution, { world });
  const resumed = resumeP09(spec, receipt, execution, { world });
  return {
    requested: true,
    request,
    ...resumed,
    accessVerified: execution.accessVerified && !!receipt,
    receipt,
    execution,
    explored: plan.explored,
    plannerStatus: plan.status,
    metaExplored: requested.explored + resumed.metaExplored,
    provenance: 'simulated-P09-to-P07-component-contract',
    nativeVictories: 0,
    // No official-win event is invented by the parent interaction.
    officialWins: execution.officialWins,
  };
}

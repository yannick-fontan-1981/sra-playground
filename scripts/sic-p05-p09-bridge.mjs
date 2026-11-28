import { composePlan } from '../src/sic/effect-composer.ts';

/*
 * P05 -> P09 evaluation boundary.
 *
 * `scene` is fixed independently of the candidate. It contains an initial public
 * observation, a support { subjectId, position: [x, y] }, optional clock
 * { field, period }, deliveryResourceCost, and command/state budgets. The task is
 * to hold the support while a different relay/cargo mechanism is prepared,
 * charged, loaded and delivered.
 *
 * `acquisition` is a public P05 result. The planner never receives the private
 * executor. `executeCommand(before, action)` is called ONLY after composePlan
 * has returned, in chronological order. Its actions are either
 * { kind: 'command', command } or { kind: 'wait' }. Every known relay
 * action advances the physical world by one wait before its own effects.
 * The executor owns any hidden pending effects and must start from scene.initial.
 * It must use `before` as the current public state, including any reserve spent
 * by the known cargo mechanism. A world with an internally owned reserve needs
 * an adapter for this synchronization (or deliveryResourceCost=0, the default).
 * The campaign must independently verify acquisition provenance before counting
 * this check: this module checks presence of return IDs, not their full history.
 *
 * Delay convention: delay=0 moves in the command's return; delay=N moves after
 * N additional physical ticks. Resource cost is paid when the command is issued.
 * This is a generated composition check, never a native-game victory.
 */

const clone = value => structuredClone(value);
const samePosition = (a, b) => Array.isArray(a) && Array.isArray(b)
  && a.length === 2 && b.length === 2 && a[0] === b[0] && a[1] === b[1];

function scalarAt(observation, field) {
  if (field.startsWith('context.')) return observation.context[field.slice(8)];
  if (Object.hasOwn(observation.context, field)) return observation.context[field];
  return ['selected', 'reserve', 'remote', 'tick'].includes(field) ? observation[field] : undefined;
}

function conditionHolds(observation, { field, equals }) {
  return typeof field === 'string' && scalarAt(observation, field) !== undefined
    && Object.is(scalarAt(observation, field), equals);
}

function supported(scene, observation) {
  return samePosition(observation.subjects.find(subject => subject.id === scene.support.subjectId)?.position,
    scene.support.position);
}

function validObservation(observation) {
  return observation && Array.isArray(observation.subjects)
    && observation.subjects.every(subject => typeof subject.id === 'string'
      && Array.isArray(subject.position) && subject.position.length === 2
      && subject.position.every(Number.isFinite))
    && new Set(observation.subjects.map(subject => subject.id)).size === observation.subjects.length
    && observation.context && typeof observation.context === 'object'
    && Number.isFinite(observation.reserve) && Number.isFinite(observation.remote)
    && Number.isInteger(observation.tick) && observation.tick >= 0;
}

function checkInputs(scene, acquisition) {
  if (!validObservation(scene?.initial) || !scene.initial.subjects.some(subject => subject.id === scene.support?.subjectId)
    || !Array.isArray(scene.support?.position) || scene.support.position.length !== 2
    || !scene.support.position.every(Number.isFinite)) throw new Error('Invalid public P09 bridge scene');
  if (supported(scene, scene.initial)) throw new Error('P09 bridge must require a newly acquired movement');
  if (scene.clock && (typeof scene.clock.field !== 'string' || !Number.isInteger(scene.clock.period)
    || scene.clock.period < 1 || !Number.isInteger(scalarAt(scene.initial, scene.clock.field)))) {
    throw new Error('Invalid public P09 bridge clock');
  }
  if (scene.deliveryResourceCost !== undefined
    && (!Number.isFinite(scene.deliveryResourceCost) || scene.deliveryResourceCost < 0)) {
    throw new Error('Invalid delivery resource cost');
  }
  const budget = scene.budget ?? { commands: 16, states: 2048 };
  if (!Number.isInteger(budget.commands) || budget.commands < 0
    || !Number.isInteger(budget.states) || budget.states < 1) throw new Error('Invalid P09 bridge budget');
  if (!acquisition) return;
  if (typeof acquisition.effectId !== 'string' || typeof acquisition.command !== 'string'
    || typeof acquisition.receiver !== 'string' || !Array.isArray(acquisition.delta)
    || acquisition.delta.length !== 2 || !acquisition.delta.every(Number.isFinite)
    || !Number.isInteger(acquisition.delay) || acquisition.delay < 0
    || !Number.isFinite(acquisition.resourceCost) || acquisition.resourceCost < 0
    || !Number.isFinite(acquisition.remoteDelta) || !Array.isArray(acquisition.conditions)
    || !Array.isArray(acquisition.supportingReturnIds) || !Array.isArray(acquisition.limitingReturnIds)) {
    throw new Error('Invalid public P05 acquisition');
  }
}

function availableAcquisition(acquisition, availableReturnIds) {
  if (!acquisition || !['confirmed', 'restricted'].includes(acquisition.status)
    || acquisition.supportingReturnIds.length === 0) return false;
  const ids = new Set(availableReturnIds);
  return acquisition.supportingReturnIds.every(id => typeof id === 'string' && ids.has(id));
}

function receiverId(acquisition, observation) {
  return acquisition.receiver === 'selected' ? observation.selected : acquisition.receiver;
}

function canUse(acquisition, observation) {
  return observation.reserve >= acquisition.resourceCost
    && acquisition.conditions.every(condition => conditionHolds(observation, condition))
    && observation.subjects.some(subject => subject.id === receiverId(acquisition, observation));
}

function applyProjectedMovement(observation, pending) {
  const subject = observation.subjects.find(entry => entry.id === pending.receiver);
  if (!subject) throw new Error('Projected receiver disappeared');
  subject.position = [subject.position[0] + pending.delta[0], subject.position[1] + pending.delta[1]];
  observation.remote += pending.remoteDelta;
}

function projectTick(scene, before) {
  const after = clone(before);
  after.observation.tick++;
  if (scene.clock) {
    const field = scene.clock.field.replace(/^context\./, '');
    after.observation.context[field] = (after.observation.context[field] + 1) % scene.clock.period;
  }
  if (after.pending && --after.pending.remaining === 0) {
    applyProjectedMovement(after.observation, after.pending);
    after.pending = null;
  }
  return after;
}

function key(state) {
  return JSON.stringify([state.stage, state.observation.selected,
    state.observation.subjects.map(subject => [subject.id, ...subject.position]).sort(),
    Object.entries(state.observation.context).sort(([a], [b]) => a.localeCompare(b)),
    state.observation.reserve, state.observation.remote, state.observation.tick, state.pending]);
}

function projectedEffect(scene, before, action, acquisition) {
  const after = projectTick(scene, before);
  if (action.kind === 'command') {
    const pending = { receiver: receiverId(acquisition, before.observation), delta: acquisition.delta,
      remaining: acquisition.delay, remoteDelta: acquisition.remoteDelta };
    after.observation.reserve -= acquisition.resourceCost;
    if (pending.remaining) after.pending = pending;
    else applyProjectedMovement(after.observation, pending);
  } else if (action.kind === 'prepare-relay') after.stage = 'armed';
  else if (action.kind === 'charge-relay') after.stage = 'charged';
  else if (action.kind === 'load-cargo') {
    after.stage = 'loaded';
    after.observation.reserve -= scene.deliveryResourceCost ?? 0;
  } else if (action.kind === 'deliver-cargo') after.stage = 'delivered';

  const holding = ['charge-relay', 'load-cargo', 'deliver-cargo'].includes(action.kind);
  return {
    action,
    after,
    requires: action.kind === 'command' ? [
      { relation: 'P05 acquired context and resource bounds', holds: state => canUse(acquisition, state.observation) },
    ] : [],
    maintains: holding ? [{ relation: 'carrier holds the support throughout cargo transfer',
      holds: state => supported(scene, state.observation) }] : [],
    ensures: [{ relation: 'resource reserve remains nonnegative', holds: state => state.observation.reserve >= 0 }],
    evidence: action.kind === 'command' ? [...acquisition.supportingReturnIds] : ['public relay/cargo rule'],
  };
}

/** Public-only problem builder. Deliberately has no simulator/executor parameter. */
export function buildP05CompositionProblem({ scene, acquisition, availableReturnIds }) {
  checkInputs(scene, acquisition);
  const usable = availableAcquisition(acquisition, availableReturnIds);
  const initial = { observation: clone(scene.initial), stage: 'unarmed', pending: null };
  return {
    initial,
    key,
    goal: { relation: 'cargo delivered while the newly occupied support stays held',
      holds: state => state.stage === 'delivered' && supported(scene, state.observation) },
    *choices(state) {
      if (state.stage === 'delivered') return;
      if (state.stage === 'unarmed') yield projectedEffect(scene, state, { kind: 'prepare-relay' }, acquisition);
      if (usable && !state.pending && !supported(scene, state.observation) && canUse(acquisition, state.observation)) {
        yield projectedEffect(scene, state, { kind: 'command', command: acquisition.command,
          receiver: receiverId(acquisition, state.observation), effectId: acquisition.effectId }, acquisition);
      }
      if (supported(scene, state.observation)) {
        const kind = { armed: 'charge-relay', charged: 'load-cargo', loaded: 'deliver-cargo' }[state.stage];
        if (kind) yield projectedEffect(scene, state, { kind }, acquisition);
      }
      // Waiting is useful only for a pending arrival or a publicly cycling guard.
      if (state.pending || scene.clock) yield projectedEffect(scene, state, { kind: 'wait' }, acquisition);
    },
    budget: scene.budget ?? { commands: 16, states: 2048 },
  };
}

function observationMismatch(expected, observed) {
  if (!validObservation(observed)) return 'invalid public return';
  for (const field of ['selected', 'reserve', 'tick']) if (!Object.is(expected[field], observed[field])) return field;
  for (const subject of expected.subjects) {
    if (!samePosition(subject.position, observed.subjects.find(other => other.id === subject.id)?.position)) {
      return 'subject position: ' + subject.id;
    }
  }
  // Context guards are checked again by the next command. An unrelated distant
  // cochange is not treated as a carrier failure in this pressure-support task.
  return null;
}

/**
 * Plan first, then replay with the evaluation-owned physical executor.
 * The result keeps predicted effects separate from observed returns.
 */
export function verifyP05Composition({ scene, acquisition, availableReturnIds, executeCommand }) {
  const problem = buildP05CompositionProblem({ scene, acquisition, availableReturnIds });
  const certificate = composePlan(problem);
  const summary = {
    planned: Boolean(certificate), success: false, validReplay: false,
    usedEffect: false, usedEffectId: null, usedEvidenceIds: [], consumedConditions: [],
    commands: certificate?.effects.length ?? null, plan: [], returns: [], firstMismatch: null,
    native: { tested: 0, wins: 0 },
  };
  if (!certificate) return summary;
  if (typeof executeCommand !== 'function') throw new Error('Independent P09 replay executor is required');
  summary.plan = certificate.effects.map(effect => ({ action: clone(effect.action), evidence: [...effect.evidence],
    requires: (effect.requires ?? []).map(condition => condition.relation),
    maintains: (effect.maintains ?? []).map(condition => condition.relation) }));
  let observed = clone(scene.initial);
  let stage = 'unarmed';
  for (let index = 0; index < certificate.effects.length; index++) {
    const effect = certificate.effects[index];
    const action = effect.action;
    const before = clone(observed);
    const fail = reason => {
      summary.firstMismatch = { index, action: clone(action), reason,
        expected: clone(effect.after.observation), observed: clone(observed) };
      return summary;
    };
    if (action.kind === 'command' && !canUse(acquisition, before)) return fail('P05 context guard no longer holds');
    const holding = ['charge-relay', 'load-cargo', 'deliver-cargo'].includes(action.kind);
    if (holding && !supported(scene, before)) return fail('support absent before cargo transition');
    if (action.kind === 'load-cargo' && before.reserve < (scene.deliveryResourceCost ?? 0)) return fail('cargo resource exhausted');
    // Only the public command is given to the independent physical executor.
    // In particular no inferred receiver, projected after-state, acquisition,
    // proof, or goal is sent. The true law resolves the receiver from the world.
    const physicalAction = action.kind === 'command'
      ? { kind: 'command', command: action.command }
      : { kind: 'wait' };
    observed = executeCommand(clone(before), physicalAction);
    if (!validObservation(observed)) return fail('invalid public return');
    observed = clone(observed);
    if (holding && !supported(scene, observed)) return fail('support lost during cargo transition');
    if (action.kind === 'prepare-relay') {
      if (stage !== 'unarmed') return fail('relay prepared out of order');
      stage = 'armed';
    } else if (action.kind === 'charge-relay') {
      if (stage !== 'armed') return fail('relay charged out of order');
      stage = 'charged';
    } else if (action.kind === 'load-cargo') {
      if (stage !== 'charged') return fail('cargo loaded out of order');
      stage = 'loaded';
      observed.reserve -= scene.deliveryResourceCost ?? 0;
    } else if (action.kind === 'deliver-cargo') {
      if (stage !== 'loaded') return fail('cargo delivered out of order');
      stage = 'delivered';
    } else if (action.kind === 'command') {
      summary.usedEffect = true;
      summary.usedEffectId = action.effectId;
      summary.usedEvidenceIds = [...effect.evidence];
      summary.consumedConditions = clone(acquisition.conditions);
    }
    summary.returns.push({ index, action: clone(action), observation: clone(observed) });
    const mismatch = observationMismatch(effect.after.observation, observed);
    if (mismatch) return fail(mismatch);
  }
  summary.validReplay = stage === 'delivered' && supported(scene, observed);
  summary.success = summary.validReplay && summary.usedEffect && summary.usedEvidenceIds.length > 0;
  return summary;
}

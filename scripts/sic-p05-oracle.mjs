/**
 * Independent evaluator for the finite, controlled P05 observation laboratory.
 *
 * No learner, generator, engine adapter or simulator is imported here. The
 * execution law below and the evidence checks are evaluator-owned. A policy is
 * constructed from the PUBLIC interface before any private transition runs.
 * Certification means identification in this finite, deterministic laboratory;
 * it does not claim optimality, discovery of new contexts, or a native victory.
 */

const copy = value => structuredClone(value);
const finite = value => typeof value === 'number' && Number.isFinite(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
const point = value => Array.isArray(value) && value.length === 2 && value.every(finite);
const normal = value => Array.isArray(value) ? value.map(normal)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, normal(value[key])])) : value;
const same = (a, b) => JSON.stringify(normal(a)) === JSON.stringify(normal(b));
const nonzero = delta => delta[0] !== 0 || delta[1] !== 0;

export const P05_ORACLE_ASSUMPTIONS = Object.freeze([
  'The public context catalogue is finite and each PREPARE is available at a cost of one command.',
  'PREPARE restores the displayed geometry, selection, reserve and remote value; it clears pending effects and starts a fresh epoch.',
  'Within an epoch the selected receiver and displayed context remain fixed, apart from the explicitly observed reserve.',
  'An impulse is deterministic, acts on at most one subject, and completes by the public maxLatency bound.',
  'Resource cost is charged immediately only when the current reserve is sufficient.',
  'Ambient remote drift is deterministic and repeatable between matched control and intervention epochs.',
  'Claims are restricted to the finite observed contexts; no infinite-domain guard or native game success is inferred.',
]);

function validatePublic(publicSpec) {
  const errors = [];
  if (!publicSpec || !Array.isArray(publicSpec.contexts) || publicSpec.contexts.length === 0) {
    return ['missing-public-contexts'];
  }
  if (!Array.isArray(publicSpec.commands) || publicSpec.commands.length === 0
    || publicSpec.commands.some(command => typeof command !== 'string' || !command)
    || new Set(publicSpec.commands).size !== publicSpec.commands.length) errors.push('invalid-public-commands');
  if (!integer(publicSpec.maxLatency)) errors.push('invalid-latency-bound');
  if (!integer(publicSpec.commandBudget)) errors.push('invalid-command-budget');
  const ids = new Set();
  for (const context of publicSpec.contexts) {
    if (!context || typeof context.id !== 'string' || !context.id || ids.has(context.id)) {
      errors.push('invalid-context-identity');
      continue;
    }
    ids.add(context.id);
    if (!Array.isArray(context.subjects) || context.subjects.length === 0
      || context.subjects.some(subject => !subject || typeof subject.id !== 'string' || !subject.id || !point(subject.position))
      || new Set(context.subjects.map(subject => subject.id)).size !== context.subjects.length
      || !context.subjects.some(subject => subject.id === context.selected)) errors.push('invalid-public-subjects:' + context.id);
    if (!finite(context.reserve) || context.reserve < 0 || !finite(context.remote)) errors.push('invalid-public-reserve-or-remote:' + context.id);
    if (!context.context || typeof context.context !== 'object' || Array.isArray(context.context)
      || Object.values(context.context).some(value => !['string', 'number', 'boolean'].includes(typeof value)
        || typeof value === 'number' && !finite(value))) errors.push('invalid-public-context-fields:' + context.id);
  }
  return errors;
}

export function validateP05OracleContract(spec) {
  const errors = validatePublic(spec?.publicSpec);
  if (spec?.schema !== 'sic-p05-lab-v1') errors.push('unsupported-schema');
  if (errors.length) return errors;
  if (!Array.isArray(spec.privateSpec?.laws) || !Array.isArray(spec.privateSpec?.ambient)) {
    return ['missing-private-evaluation-law'];
  }
  const byContext = new Map(spec.publicSpec.contexts.map(context => [context.id, context]));
  const rows = new Set();
  for (const law of spec.privateSpec.laws) {
    const context = byContext.get(law.contextId), key = JSON.stringify([law.contextId, law.command]);
    if (!context || !spec.publicSpec.commands.includes(law.command)) errors.push('law-outside-public-catalogue');
    if (rows.has(key)) errors.push('duplicate-law-row');
    rows.add(key);
    if (!point(law.delta) || !integer(law.delay) || !finite(law.resourceCost) || law.resourceCost < 0
      || !finite(law.remoteDelta)) errors.push('invalid-law-value');
    if (law.delay > spec.publicSpec.maxLatency) errors.push('effect-outside-public-horizon');
    if (context && law.receiver !== 'selected' && !context.subjects.some(subject => subject.id === law.receiver)) {
      errors.push('unknown-law-receiver');
    }
  }
  for (const context of spec.publicSpec.contexts) for (const command of spec.publicSpec.commands) {
    if (!rows.has(JSON.stringify([context.id, command]))) errors.push('incomplete-private-law-table');
  }
  const ambientContexts = new Set();
  for (const ambient of spec.privateSpec.ambient) {
    if (!byContext.has(ambient.contextId) || !finite(ambient.remotePerTick)) errors.push('invalid-ambient-law');
    if (ambientContexts.has(ambient.contextId)) errors.push('duplicate-ambient-law');
    ambientContexts.add(ambient.contextId);
  }
  if (ambientContexts.size !== byContext.size) errors.push('incomplete-ambient-law-table');
  return [...new Set(errors)];
}

/** Pure, public-only policy. Its action sequence is unchanged by hidden laws. */
export function p05OraclePolicy(publicSpec) {
  const errors = validatePublic(publicSpec);
  if (errors.length) throw new Error(errors.join(', '));
  const policy = [];
  for (const context of publicSpec.contexts) {
    policy.push({ kind: 'prepare', command: 'PREPARE', contextId: context.id });
    for (let tick = 0; tick <= publicSpec.maxLatency; tick++) policy.push({ kind: 'wait', command: 'WAIT' });
    for (const command of publicSpec.commands) {
      policy.push({ kind: 'prepare', command: 'PREPARE', contextId: context.id });
      policy.push({ kind: 'command', command });
      for (let tick = 0; tick < publicSpec.maxLatency; tick++) policy.push({ kind: 'wait', command: 'WAIT' });
    }
  }
  return policy;
}

/** Independent, tick-by-tick reference interpreter. */
export function createOracleWorld(source) {
  const errors = validateP05OracleContract(source);
  if (errors.length) throw new Error(errors.join(', '));
  const spec = copy(source), contexts = new Map(spec.publicSpec.contexts.map(context => [context.id, context]));
  const laws = new Map(spec.privateSpec.laws.map(law => [JSON.stringify([law.contextId, law.command]), law]));
  const ambient = new Map(spec.privateSpec.ambient.map(law => [law.contextId, law.remotePerTick]));
  let contextId = spec.publicSpec.contexts[0].id, epoch = 0, serial = 0, tick = 0, queue = [];
  let state = copy(contexts.get(contextId));
  const observation = () => ({ ref: `e${epoch}:t${tick}`, epoch: `e${epoch}`, tick,
    selected: state.selected, subjects: copy(state.subjects), context: copy(state.context),
    reserve: state.reserve, remote: state.remote });
  const apply = effect => {
    const subject = state.subjects.find(candidate => candidate.id === effect.receiver);
    if (!subject) throw new Error('Independent oracle lost a publicly declared subject');
    subject.position[0] += effect.delta[0];
    subject.position[1] += effect.delta[1];
    state.remote += effect.remoteDelta;
  };
  const step = input => {
    const action = copy(input), before = observation();
    if (action.kind === 'prepare') {
      if (action.command !== 'PREPARE' || !contexts.has(action.contextId)) throw new Error('Unavailable PREPARE');
      contextId = action.contextId;
      state = copy(contexts.get(contextId));
      epoch++;
      tick = 0;
      queue = [];
    } else {
      if (action.kind === 'command') {
        if (!spec.publicSpec.commands.includes(action.command)) throw new Error('Unavailable opaque command');
        const law = laws.get(JSON.stringify([contextId, action.command]));
        if (law && state.reserve >= law.resourceCost) {
          state.reserve -= law.resourceCost;
          const effect = { receiver: law.receiver === 'selected' ? state.selected : law.receiver,
            delta: copy(law.delta), remoteDelta: law.remoteDelta, due: tick + 1 + law.delay };
          if (law.delay === 0) apply(effect);
          else queue.push(effect);
        }
      } else if (action.kind !== 'wait' || action.command !== 'WAIT') throw new Error('Unavailable action');
      tick++;
      state.remote += ambient.get(contextId) ?? 0;
      const pending = [];
      for (const effect of queue) {
        if (effect.due <= tick) apply(effect);
        else pending.push(effect);
      }
      queue = pending;
    }
    return { id: `r${++serial}`, kind: action.kind, command: action.command,
      ...(action.kind === 'prepare' ? { contextId: action.contextId } : {}), before, after: observation(), elapsed: 1 };
  };
  return { observation, step };
}

function conditionList(observation) {
  const fields = { ...Object.fromEntries(Object.entries(observation.context).map(([field, value]) => ['context.' + field, value])),
    reserve: observation.reserve, selected: observation.selected };
  return Object.keys(fields).sort().map(field => ({ field, equals: fields[field] }));
}

function setupKey(observation) {
  return JSON.stringify(normal({ selected: observation.selected, context: observation.context,
    reserve: observation.reserve, remote: observation.remote,
    subjects: [...observation.subjects].sort((a, b) => a.id.localeCompare(b.id)) }));
}

function scopeHolds(conditions, context) {
  const values = { ...Object.fromEntries(Object.entries(context.context).map(([field, value]) => ['context.' + field, value])),
    reserve: context.reserve, selected: context.selected };
  return conditions.every(condition => Object.hasOwn(values, condition.field) && values[condition.field] === condition.equals);
}

function episodeRows(publicSpec, history) {
  const episodes = new Map();
  for (const receipt of history) {
    if (!receipt) continue;
    if (receipt.kind === 'prepare') {
      if (receipt.after?.tick === 0) episodes.set(receipt.after.epoch,
        { contextId: receipt.contextId, start: receipt.after, returns: [] });
      continue;
    }
    if (!receipt.before) continue;
    let episode = episodes.get(receipt.before.epoch);
    if (!episode && receipt.before.tick === 0) {
      const matches = publicSpec.contexts.filter(context => setupKey(context) === setupKey(receipt.before));
      episode = { contextId: matches.length === 1 ? matches[0].id : undefined, start: receipt.before, returns: [] };
      episodes.set(receipt.before.epoch, episode);
    }
    if (episode) episode.returns.push(receipt);
  }
  const horizon = publicSpec.maxLatency + 1;
  const complete = [];
  for (const episode of episodes.values()) {
    if (episode.returns.length < horizon) continue;
    const receipts = episode.returns.slice(0, horizon);
    let previous = episode.start, valid = true;
    for (let index = 0; index < horizon; index++) {
      const receipt = receipts[index];
      if (!receipt.after || receipt.elapsed !== 1 || !same(receipt.before, previous)
        || receipt.before.tick !== index || receipt.after.tick !== index + 1
        || receipt.after.epoch !== episode.start.epoch || receipt.before.epoch !== episode.start.epoch
        || index > 0 && receipt.kind !== 'wait') valid = false;
      previous = receipt.after;
    }
    if (!valid || !['wait', 'command'].includes(receipts[0].kind)) continue;
    complete.push({ ...episode, returns: receipts, key: setupKey(episode.start) });
  }
  const controls = complete.filter(episode => episode.returns.every(receipt => receipt.kind === 'wait'));
  const rows = [];
  for (const trial of complete.filter(episode => episode.returns[0].kind === 'command')) {
    const control = controls.find(episode => episode.key === trial.key);
    if (!control) continue;
    const differences = trial.returns.map((receipt, index) => {
      const other = control.returns[index].after;
      const subjects = receipt.after.subjects.map(subject => {
        const corresponding = other.subjects.find(candidate => candidate.id === subject.id);
        return corresponding ? { id: subject.id,
          delta: [subject.position[0] - corresponding.position[0], subject.position[1] - corresponding.position[1]] } : null;
      });
      if (subjects.some(subject => subject === null)) return null;
      return { subjects, remote: receipt.after.remote - other.remote, cost: other.reserve - receipt.after.reserve };
    });
    if (differences.some(value => value === null)) continue;
    const final = differences.at(-1), moving = final.subjects.filter(subject => nonzero(subject.delta));
    if (moving.length > 1) continue;
    const delta = moving[0]?.delta ?? [0, 0], receiver = moving[0]?.id ?? trial.start.selected;
    const onset = nonzero(delta)
      ? differences.findIndex(value => value.subjects.some(subject => subject.id === receiver && nonzero(subject.delta)))
      : final.remote !== 0 ? differences.findIndex(value => value.remote !== 0) : 0;
    const noEffect = !nonzero(delta) && final.remote === 0 && final.cost === 0;
    const effectKind = nonzero(delta) ? final.cost || final.remote ? 'combined' : 'translation'
      : final.cost && final.remote ? 'combined' : final.remote ? 'remote' : final.cost ? 'resource' : 'none';
    rows.push({ contextId: trial.contextId, command: trial.returns[0].command,
      receiver, delta, delay: noEffect ? null : onset, resourceCost: final.cost, remoteDelta: final.remote,
      effectKind, conditions: conditionList(trial.start), stationary: !nonzero(delta), noEffect,
      selected: trial.start.selected, epoch: trial.start.epoch,
      supportingReturnIds: [...new Set([...trial.returns, ...control.returns].map(receipt => receipt.id))],
      decisiveReturnId: noEffect ? null : trial.returns[onset].id,
      controlReturnId: noEffect ? null : control.returns[onset].id,
      commandReturnId: trial.returns[0].id,
      finalReturnId: trial.returns.at(-1).id,
    });
  }
  return rows;
}

/** Extract only actually received, complete controlled measurements. */
export function observedP05OracleOutcomes(publicSpec, history) {
  return copy(episodeRows(publicSpec, history));
}

export function certifyP05(spec) {
  const invalid = validateP05OracleContract(spec);
  if (invalid.length) return { solvable: false, reason: 'invalid-contract', invalid,
    policy: [], commandUpperBound: null, minimality: 'not-claimed', outcomes: [], expectedAcquisitions: [],
    stationaryAttempts: [], history: [], assumptions: [...P05_ORACLE_ASSUMPTIONS] };
  const policy = p05OraclePolicy(spec.publicSpec), commandUpperBound = policy.length;
  const base = { policy, commandUpperBound, minimality: 'not-claimed', assumptions: [...P05_ORACLE_ASSUMPTIONS] };
  if (commandUpperBound > spec.publicSpec.commandBudget) return { ...base, solvable: false,
    reason: 'policy-exceeds-budget', outcomes: [], expectedAcquisitions: [], stationaryAttempts: [], history: [] };
  const world = createOracleWorld(spec), history = policy.map(action => world.step(action));
  const outcomes = episodeRows(spec.publicSpec, history);
  const expectedAcquisitions = outcomes.filter(outcome => !outcome.noEffect);
  const expectedRows = spec.publicSpec.contexts.length * spec.publicSpec.commands.length;
  const complete = outcomes.length === expectedRows;
  const scopeExpressible = expectedAcquisitions.every(row => spec.publicSpec.contexts
    .filter(context => scopeHolds(row.conditions, context))
    .every(context => sameEffect(row, actualRow(spec, context, row.command), context.selected)));
  // This is an existence certificate, never a proof that a rejected case has no
  // shorter policy. The fixed policy covers every return branch in the public
  // deterministic impulse model; its next action never reads a private law.
  return { ...base, solvable: complete && scopeExpressible && expectedAcquisitions.length > 0,
    reason: !complete ? 'unidentified-public-row' : !scopeExpressible ? 'scope-not-expressible'
      : !expectedAcquisitions.length ? 'no-nonzero-effect' : 'public-policy-certified',
    history, outcomes, expectedAcquisitions, stationaryAttempts: outcomes.filter(outcome => outcome.stationary),
    identifiedRows: outcomes.length, expectedRows,
    policyKind: 'public-only-complete-factorial-impulse-policy',
  };
}

function actualRow(spec, context, command) {
  const law = spec.privateSpec.laws.find(candidate => candidate.contextId === context.id && candidate.command === command);
  if (!law || context.reserve < law.resourceCost) return { receiver: context.selected, delta: [0, 0],
    delay: null, resourceCost: 0, remoteDelta: 0, noEffect: true };
  const moving = nonzero(law.delta), effective = moving || law.remoteDelta !== 0 || law.resourceCost !== 0;
  return { receiver: moving && law.receiver !== 'selected' ? law.receiver : context.selected,
    delta: law.delta, delay: !effective ? null : moving || law.remoteDelta !== 0 ? law.delay : 0,
    resourceCost: law.resourceCost, remoteDelta: law.remoteDelta, noEffect: !effective };
}

function sameEffect(claim, row, selected) {
  return same(claim.delta, row.delta) && claim.delay === row.delay
    && claim.resourceCost === row.resourceCost && claim.remoteDelta === row.remoteDelta
    && (claim.receiver === row.receiver || claim.receiver === 'selected' && row.receiver === selected);
}

function authenticHistory(spec, history) {
  const world = createOracleWorld(spec), ids = new Set();
  for (const receipt of history) {
    if (!receipt || !receipt.id || ids.has(receipt.id)) return { valid: false, reason: 'invalid-or-repeated-return-id' };
    ids.add(receipt.id);
    let expected;
    try {
      expected = world.step({ kind: receipt.kind, command: receipt.command,
        ...(receipt.kind === 'prepare' ? { contextId: receipt.contextId } : {}) });
    } catch { return { valid: false, reason: 'unavailable-action-in-history' }; }
    const beforeValid = receipt.before ? same(receipt.before, expected.before)
      : receipt.beforeRef === expected.before.ref && receipt.epoch === expected.before.epoch && receipt.tick === expected.before.tick;
    if (receipt.id !== expected.id || receipt.elapsed !== expected.elapsed || !beforeValid
      || receipt.after !== null && receipt.after !== undefined && !same(receipt.after, expected.after)) {
      return { valid: false, reason: 'history-disagrees-with-independent-replay', returnId: receipt.id };
    }
  }
  return { valid: true };
}

/**
 * Validate truth AND the evidence actually received. A true hidden-law guess is
 * rejected when the decisive return, matched control, or horizon is missing.
 */
export function verifyP05Claim(spec, history, claim) {
  const fail = (reason, fields = {}) => ({ valid: false, correctEffect: false, justified: false,
    reason, matchedContextIds: [], ...fields });
  const invalid = validateP05OracleContract(spec);
  if (invalid.length) return fail('invalid-contract', { invalid });
  if (!claim || !Array.isArray(history) || !spec.publicSpec.commands.includes(claim.command) || !point(claim.delta)
    || typeof claim.receiver !== 'string' || !claim.receiver || !['confirmed', 'restricted'].includes(claim.status)
    || !integer(claim.delay) || !finite(claim.resourceCost) || !finite(claim.remoteDelta)
    || !Array.isArray(claim.conditions) || !Array.isArray(claim.supportingReturnIds)
    || !Array.isArray(claim.limitingReturnIds)
    || claim.conditions.some(condition => !condition || typeof condition.field !== 'string'
      || !['string', 'number', 'boolean'].includes(typeof condition.equals)
      || typeof condition.equals === 'number' && !finite(condition.equals))) return fail('invalid-claim');
  if (!nonzero(claim.delta) && claim.resourceCost === 0 && claim.remoteDelta === 0) return fail('stationary-is-not-an-acquisition');
  if (new Set(claim.conditions.map(condition => condition.field)).size !== claim.conditions.length) return fail('duplicate-scope-field');
  const contexts = spec.publicSpec.contexts.filter(context => scopeHolds(claim.conditions, context));
  if (!contexts.length) return fail('scope-has-no-public-context');
  const matchedContextIds = contexts.map(context => context.id);
  const correctEffect = contexts.every(context => sameEffect(claim, actualRow(spec, context, claim.command), context.selected));
  if (!correctEffect) return fail('incorrect-effect-or-overbroad-scope', { matchedContextIds });
  const authenticity = authenticHistory(spec, history);
  if (!authenticity.valid) return fail(authenticity.reason, { correctEffect: true, matchedContextIds,
    ...(authenticity.returnId ? { returnId: authenticity.returnId } : {}) });
  const rows = episodeRows(spec.publicSpec, history);
  const measured = rows.find(row => row.command === claim.command && !row.noEffect
    && sameEffect(claim, row, row.selected)
    && same([...claim.conditions].sort((a, b) => a.field.localeCompare(b.field)),
      [...row.conditions].sort((a, b) => a.field.localeCompare(b.field))));
  if (!measured) return fail('no-complete-matched-public-measurement', { correctEffect: true, matchedContextIds });
  if (claim.effectKind !== undefined && claim.effectKind !== measured.effectKind) return fail('incorrect-effect-kind', { matchedContextIds });
  const ids = new Map(history.map(receipt => [receipt.id, receipt]));
  if (claim.supportingReturnIds.some(id => !ids.get(id)?.after)
    || !measured.supportingReturnIds.every(id => claim.supportingReturnIds.includes(id))) {
    return fail('missing-or-uncited-command-effect-return', { correctEffect: true, matchedContextIds,
      decisiveReturnId: measured.decisiveReturnId });
  }
  if (claim.limitingReturnIds.some(id => !ids.get(id)?.after
    || !rows.some(row => row.command === claim.command && row.stationary
      && row.supportingReturnIds.includes(id)))) {
    return fail('unsupported-limiting-return', { correctEffect: true, matchedContextIds });
  }
  if (claim.receiver === 'selected' && !rows.some(row => row.command === claim.command
    && row.selected !== measured.selected && row.receiver === row.selected
    && sameEffect({ ...claim, receiver: row.selected }, row, row.selected))) {
    return fail('selection-role-not-contrasted', { correctEffect: true, matchedContextIds });
  }
  return { valid: true, correctEffect: true, justified: true, reason: 'effect-and-public-return-verified',
    matchedContextIds, decisiveReturnId: measured.decisiveReturnId,
    commandReturnId: measured.commandReturnId, controlReturnId: measured.controlReturnId };
}

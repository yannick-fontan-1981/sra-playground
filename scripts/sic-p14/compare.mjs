import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { createEnvironment } from './environment.mjs';
import { createOracleWorld } from './oracle.mjs';
import { createSubject } from './subject.mjs';

export const digest = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const copy = value => JSON.parse(JSON.stringify(value));
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

/** The sole subject boundary. Private specs, world indices and certificates never cross it. */
export function runEpisode(spec, worldIndex, variant, { removeFrame = null, verifyOracle = true, meterSearch = false } = {}) {
  const started = performance.now();
  const environment = createEnvironment(spec, worldIndex);
  const reference = verifyOracle ? createOracleWorld(spec, worldIndex) : null;
  let expanded = 0;
  const chargeSearchState = meterSearch ? () => {
    if (expanded >= spec.budget.states) return false;
    expanded++;
    return true;
  } : undefined;
  const subject = createSubject(freeze(copy(spec.public)), freeze(copy(spec.budget)), variant, { chargeSearchState });
  const history = [], decisions = [], actions = [], frames = new Map(), pending = [];
  let observation = environment.observation();
  let referenceObservation = reference?.observation();
  let firstError = null, inferenceMs = 0, oracleChecks = 0, oracleMismatch = null;
  const metrics = {
    gestures: 0, ticks: 0, predicted: 0, confirmed: 0, contradicted: 0,
    censored: 0, unresolved: 0, timedActions: 0, rightInstant: 0, mistimed: 0,
    revisions: 0, supportedRevisions: 0, unsupportedRevisions: 0,
    proofViolations: 0, intermediateWitnesses: 0, observations: 0,
    waits: 0, abstentions: 0, holds: 0, triggers: 0, moves: 0, unguardedTimedActions: 0,
  };
  const verify = () => {
    if (reference && !isDeepStrictEqual(observation, referenceObservation)) {
      oracleMismatch = { command: actions.at(-1) ?? null, ordinal: actions.length,
        actual: observation, expected: referenceObservation };
      throw new Error('P14 independent transition mismatch: ' + JSON.stringify(oracleMismatch));
    }
    if (reference) oracleChecks++;
  };
  const publicObservation = observed => {
    const safe = copy(observed);
    for (const frame of safe.frames) {
      if (frame.ref === removeFrame) {
        for (const channel of Object.keys(frame.values)) {
          frame.values[channel] = null;
          frame.reliable[channel] = false;
        }
      }
      frames.set(frame.ref, frame);
    }
    return freeze(safe);
  };
  verify();
  history.push(publicObservation(observation));
  while (!observation.terminal && actions.length < spec.budget.actions && observation.tick < spec.budget.ticks) {
    const before = history.at(-1);
    const inferenceStart = performance.now();
    const decision = copy(subject.decide(Object.freeze(history.slice())));
    inferenceMs += performance.now() - inferenceStart;
    if (!decision || typeof decision.action !== 'string') {
      firstError ??= { kind: 'no-decision', ordinal: actions.length, tick: observation.tick };
      break;
    }
    const descriptor = spec.public.actions.find(action => action.id === decision.action);
    const invalidEvidence = new Set();
    const checkEvidence = evidence => {
      for (const ref of evidence ?? []) if (!frames.has(ref) || frames.get(ref).tick > observation.tick) invalidEvidence.add(ref);
    };
    checkEvidence(decision.evidence);
    for (const prediction of decision.predictions ?? []) {
      checkEvidence(prediction.evidence);
      if (!spec.public.channels.includes(prediction.channel) || !Number.isSafeInteger(prediction.tick)
        || prediction.tick <= observation.tick || ![0, 1].includes(prediction.value)
        || !prediction.evidence?.length) invalidEvidence.add('invalid-prediction');
      pending.push({ ...prediction, issued: actions.length, resolved: false });
      metrics.predicted++;
    }
    if (descriptor?.kind === 'move' && descriptor.gates?.length) {
      const guards = decision.composition?.executedGuards ?? [];
      let guarded = true;
      for (let tick = observation.tick + 1; tick <= observation.tick + descriptor.duration; tick++) {
        for (const channel of descriptor.gates) {
          const guard = guards.find(item => item.channel === channel && item.tick === tick && item.value === 1);
          if (!guard?.evidence?.length) guarded = false;
          checkEvidence(guard?.evidence);
        }
      }
      if (!guarded) {
        metrics.unguardedTimedActions++;
        firstError ??= { kind: 'unjustified-timed-move', ordinal: actions.length, tick: observation.tick };
      }
    }
    const witnessRefs = new Set([...(decision.evidence ?? []), ...(decision.predictions ?? []).flatMap(p => p.evidence ?? [])]);
    metrics.intermediateWitnesses += [...witnessRefs].filter(ref => frames.get(ref)?.intermediate).length;
    for (const revision of decision.revisions ?? []) {
      metrics.revisions++;
      checkEvidence(revision.evidence);
      const hasReceipt = history.some(event => event.receipt?.interventions?.includes(revision.channel)
        && event.frames.some(frame => (revision.evidence ?? []).includes(frame.ref)));
      const contradiction = revision.previous && history.some(event => event.frames.some(frame =>
        frame.tick === revision.previous.tick && frame.reliable[revision.channel]
        && frame.values[revision.channel] !== null && frame.values[revision.channel] !== revision.previous.value
        && (revision.evidence ?? []).includes(frame.ref)));
      if (hasReceipt || contradiction) metrics.supportedRevisions++;
      else metrics.unsupportedRevisions++;
    }
    metrics.proofViolations += invalidEvidence.size;
    if (invalidEvidence.size) firstError ??= { kind: 'invalid-evidence', ordinal: actions.length,
      tick: observation.tick, refs: [...invalidEvidence] };
    decisions.push({ ordinal: actions.length, tick: observation.tick, observationHash: digest(before), ...decision });
    actions.push(decision.action);
    if (descriptor?.kind === 'inspect') metrics.observations++;
    if (descriptor?.kind === 'wait') metrics.waits++;
    if (decision.mode === 'abstain') metrics.abstentions++;
    if (descriptor?.kind === 'hold') metrics.holds++;
    if (descriptor?.kind === 'trigger') metrics.triggers++;
    if (descriptor?.kind === 'move') metrics.moves++;
    observation = environment.step(decision.action);
    referenceObservation = reference?.step(decision.action);
    verify();
    const visible = publicObservation(observation);
    history.push(visible);
    for (const prediction of pending) {
      if (prediction.resolved || prediction.tick > observation.tick) continue;
      prediction.resolved = true;
      const returned = visible.frames.find(frame => frame.tick === prediction.tick);
      if (!returned || !returned.reliable[prediction.channel] || returned.values[prediction.channel] === null) {
        metrics.censored++;
      } else if (returned.values[prediction.channel] === prediction.value) metrics.confirmed++;
      else {
        metrics.contradicted++;
        firstError ??= { kind: 'prediction-contradicted', ordinal: actions.length - 1,
          prediction, frame: returned };
      }
    }
    if (descriptor?.kind === 'move' && descriptor.gates?.length) {
      metrics.timedActions++;
      if (observation.position === descriptor.to && observation.position !== before.position) metrics.rightInstant++;
      else {
        metrics.mistimed++;
        firstError ??= { kind: 'mistimed-move', ordinal: actions.length - 1, tick: before.tick,
          action: descriptor.id, duration: descriptor.duration, gates: descriptor.gates };
      }
    }
    if (observation.terminal === 'failed') firstError ??= { kind: 'failed', ordinal: actions.length - 1, tick: observation.tick };
  }
  metrics.gestures = actions.length;
  metrics.ticks = observation.tick;
  metrics.unresolved = pending.filter(p => !p.resolved).length;
  const crossed = observation.terminal === 'crossed' && observation.position === spec.public.goal;
  const success = crossed && !metrics.proofViolations && !metrics.unsupportedRevisions && !metrics.unguardedTimedActions;
  return { success, crossed, terminal: observation.terminal ?? 'budget', position: observation.position,
    ...(meterSearch ? { expanded } : {}),
    metrics, wallMs: performance.now() - started, inferenceMs, oracleChecks,
    firstError, actions, decisions, history, traceHash: digest({ actions, history, decisions }) };
}

export function firstDifference(left, right) {
  const limit = Math.max(left.decisions.length, right.decisions.length);
  for (let ordinal = 0; ordinal < limit; ordinal++) {
    const a = left.decisions[ordinal], b = right.decisions[ordinal];
    if (a?.action !== b?.action || a?.tick !== b?.tick) {
      return { ordinal, samePublicPrefix: a?.observationHash === b?.observationHash,
        frozen: a ? { tick: a.tick, action: a.action, mode: a.mode, reason: a.reason } : null,
        candidate: b ? { tick: b.tick, action: b.action, mode: b.mode, reason: b.reason,
          evidence: b.evidence, predictions: b.predictions } : null };
    }
  }
  return null;
}

/** Select a real, previously consumed temporal witness, preferring an intermediate frame. */
function ablationWitness(episode, spec) {
  for (const decision of episode.decisions) {
    const action = spec.public.actions.find(a => a.id === decision.action);
    if (action?.kind !== 'move' || !action.gates?.length) continue;
    const consumed = new Set((decision.composition?.executedGuards ?? [])
      .filter(guard => action.gates.includes(guard.channel)).flatMap(guard => guard.evidence ?? []));
    const available = episode.history.flatMap(observation => observation.frames).filter(frame =>
      consumed.has(frame.ref) && frame.tick <= decision.tick && Object.keys(frame.values).some(channel =>
        frame.reliable[channel] && frame.values[channel] !== null));
    available.sort((a, b) => Number(b.intermediate) - Number(a.intermediate) || b.tick - a.tick);
    if (available.length) return { ref: available[0].ref, tick: available[0].tick,
      intermediate: available[0].intermediate, consumedAtOrdinal: decision.ordinal,
      action: action.id, gates: action.gates };
  }
  return null;
}

export function compactEpisode(episode) {
  const { actions, decisions, history, ...compact } = episode;
  return { ...compact, actions, modes: decisions.map(decision => decision.mode) };
}

export function compareCase(spec, { ablate = true } = {}) {
  const worlds = [];
  for (let index = 0; index < spec.worlds.length; index++) {
    // Alternate order to avoid always warming the same implementation first.
    const outputs = {};
    for (const variant of index % 2 ? ['candidate', 'frozen'] : ['frozen', 'candidate']) {
      outputs[variant] = runEpisode(spec, index, variant);
    }
    const { frozen, candidate } = outputs;
    let ablation = null;
    if (ablate && candidate.success && !frozen.success) {
      const witness = ablationWitness(candidate, spec);
      if (!witness) ablation = { error: 'gain-without-consumed-temporal-witness' };
      else {
        const removed = runEpisode(spec, index, 'candidate', { removeFrame: witness.ref });
        ablation = { witness, success: removed.success, lostSuccess: !removed.success,
          changedActions: JSON.stringify(candidate.actions) !== JSON.stringify(removed.actions),
          extraGestures: removed.metrics.gestures - candidate.metrics.gestures,
          extraObservations: removed.metrics.observations - candidate.metrics.observations,
          extraTicks: removed.metrics.ticks - candidate.metrics.ticks,
          clocksUnchanged: true, removal: 'one-frame-values-only',
          result: compactEpisode(removed) };
      }
    }
    worlds.push({ world: index, frozen: compactEpisode(frozen), candidate: compactEpisode(candidate),
      firstDifference: firstDifference(frozen, candidate), ablation });
  }
  return { worlds, frozen: worlds.every(row => row.frozen.success),
    candidate: worlds.every(row => row.candidate.success) };
}

export function summarize(rows) {
  const stats = { cases: rows.length, oracleCertified: rows.filter(row => row.oracle.solvable).length,
    frozen: rows.filter(row => row.frozen).length, candidate: rows.filter(row => row.candidate).length,
    gains: rows.filter(row => row.candidate && !row.frozen).length,
    regressions: rows.filter(row => row.frozen && !row.candidate).length,
    episodes: 0, oracleTransitionChecks: 0,
    ablations: { tested: 0, lostSuccess: 0, changedActions: 0, retainedSameActions: 0,
      additionalObservation: 0, intermediate: 0, missingWitness: 0 },
    byVariant: { frozen: { success: 0, crossed: 0, wallMs: 0, inferenceMs: 0 }, candidate: { success: 0, crossed: 0, wallMs: 0, inferenceMs: 0 } } };
  for (const row of rows) for (const world of row.worlds) {
    stats.episodes++;
    for (const variant of ['frozen', 'candidate']) {
      const output = world[variant], totals = stats.byVariant[variant];
      totals.success += Number(output.success);
      totals.crossed += Number(output.crossed);
      totals.wallMs += output.wallMs;
      totals.inferenceMs += output.inferenceMs;
      for (const [name, value] of Object.entries(output.metrics)) totals[name] = (totals[name] ?? 0) + value;
      stats.oracleTransitionChecks += output.oracleChecks;
    }
    if (world.ablation?.error) stats.ablations.missingWitness++;
    else if (world.ablation) {
      const ablation = world.ablation;
      stats.ablations.tested++;
      stats.ablations.lostSuccess += Number(ablation.lostSuccess);
      stats.ablations.changedActions += Number(ablation.changedActions);
      stats.ablations.retainedSameActions += Number(!ablation.changedActions && ablation.success);
      stats.ablations.additionalObservation += Number(ablation.extraObservations > 0);
      stats.ablations.intermediate += Number(ablation.witness.intermediate);
    }
  }
  return stats;
}

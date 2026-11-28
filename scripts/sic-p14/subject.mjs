import { inferWitnessedSuffixCycle } from '../../src/sic/witnessed-cycle.ts';
import { composePlan } from '../../src/sic/effect-composer.ts';
import { createTemporalEvidence, inferDelayedResponse } from '../../src/sic/temporal-evidence.ts';

export const INFERENCE_LIMITS = Object.freeze({ maximumPeriod: 24, witnessesPerPhase: 4 });
const unique = values => [...new Set(values)];
const createClock = () => createTemporalEvidence({ witnesses: INFERENCE_LIMITS.witnessesPerPhase });

/**
 * Both subjects receive exactly this adapter. Only the inference implementation
 * changes; the frozen inference is the unmodified native SIC primitive at the base.
 */
export function createSubject(publicTask, budget, variant = 'candidate') {
  if (!['candidate', 'frozen'].includes(variant)) throw new Error('Unknown subject variant');
  const task = structuredClone(publicTask), limits = structuredClone(budget);
  const rank = new Map(task.channels.map((id, index) => [id, index]));
  const shape = action => JSON.stringify([action.kind, action.duration, action.from ?? -1, action.to ?? -1,
    (action.gates ?? []).map(id => rank.get(id)), (action.targets ?? []).map(id => rank.get(id)), action.holdTicks ?? 0]);
  const actions = [...task.actions].sort((a, b) => shape(a).localeCompare(shape(b)));
  const byId = new Map(actions.map(action => [action.id, action]));
  const moves = actions.filter(action => action.kind === 'move');
  const required = new Set(moves.flatMap(action => action.gates ?? []));
  const waitActions = actions.filter(action => action.kind === 'wait').sort((a, b) => a.duration - b.duration);
  const inspectActions = actions.filter(action => action.kind === 'inspect').sort((a, b) => b.duration - a.duration);
  const memory = new Map(task.channels.map(channel => [channel, {
    epoch: 0, samples: [], learner: createClock(), model: undefined, dirty: true,
    pulseStart: null, pulseSamples: [], pulse: undefined, latest: undefined,
  }]));
  let processed = 0, predictions = [], cached = null;
  const heldUntil = new Map(), holdProofs = new Map();
  let pendingHold = null;

  function resetCycle(entry, tick) {
    entry.epoch = tick;
    entry.samples = [];
    entry.learner = createClock();
    entry.model = undefined;
    entry.dirty = true;
  }

  function clockModel(entry) {
    if (!entry.dirty) return entry.model;
    entry.dirty = false;
    if (variant === 'candidate') {
      const alternatives = entry.learner.hypotheses();
      entry.model = alternatives.length ? { kind: 'cycle',
        predict: tick => entry.learner.predict(tick - entry.epoch),
        evidence: unique(alternatives.flatMap(model => model.evidence)),
        summary: alternatives.map(model => ({ period: model.period, since: model.since + entry.epoch })) } : undefined;
    } else {
      const observed = [];
      for (const sample of entry.samples) observed[sample.tick - entry.epoch] = sample.reliable ? sample.value : null;
      for (let index = 0; index < observed.length; index++) if (observed[index] === undefined) observed[index] = null;
      const model = inferWitnessedSuffixCycle(observed);
      const evidence = model ? entry.samples.filter(sample => sample.reliable && sample.value !== null).map(sample => sample.ref) : [];
      entry.model = model ? { kind: 'cycle', evidence, summary: [{ period: model.phases.length, since: model.onset + entry.epoch }],
        predict: tick => ({ value: model.phases[(tick - entry.epoch - model.onset) % model.phases.length], evidence }) } : undefined;
    }
    return entry.model;
  }

  function modelFor(channel) {
    const entry = memory.get(channel);
    if (variant === 'candidate' && entry.pulse && entry.pulseStart !== null) {
      const law = entry.pulse, start = entry.pulseStart;
      return { kind: 'response', evidence: law.evidence, summary: [{ delay: law.delay, width: law.width, activation: start }],
        predict: tick => ({ value: tick - start >= law.delay && tick - start < law.delay + law.width ? 1 : 0,
          evidence: law.evidence }) };
    }
    return clockModel(entry);
  }

  function consume(history) {
    const revisions = [];
    for (const observation of history.slice(processed)) {
      const receipt = observation.receipt, command = receipt ? byId.get(receipt.action) : null;
      const interventions = receipt?.interventions ?? [];
      if (receipt?.kind === 'hold') for (const channel of command?.targets ?? []) {
        const until = receipt.start + command.holdTicks;
        heldUntil.set(channel, until);
        const prior = memory.get(channel).latest;
        const proof = pendingHold?.action === receipt.action && pendingHold.start === receipt.start
          ? pendingHold.values[channel] : prior?.tick === receipt.start && prior.reliable && prior.value !== null
            ? { value: prior.value, evidence: [prior.ref] } : undefined;
        if (proof?.evidence.length) holdProofs.set(channel, { ...proof, until });
      }
      if (receipt?.kind === 'trigger') {
        for (const channel of command?.targets ?? interventions) {
          const entry = memory.get(channel), before = entry.latest;
          resetCycle(entry, receipt.start);
          entry.pulseStart = receipt.start;
          entry.pulseSamples = before?.tick === receipt.start ? [before] : [];
        }
      } else if (interventions.length) {
        for (const channel of interventions) {
          const entry = memory.get(channel);
          if (modelFor(channel)) revisions.push({ channel, reason: 'intervention',
            evidence: observation.frames.filter(frame => frame.tick === receipt.end).map(frame => frame.ref) });
          resetCycle(entry, receipt.end);
          heldUntil.delete(channel);
          holdProofs.delete(channel);
          entry.pulseStart = null;
          entry.pulseSamples = [];
          entry.pulse = undefined;
        }
        cached = null;
      }
      for (const frame of observation.frames) {
        for (const channel of task.channels) {
          const entry = memory.get(channel), sample = { tick: frame.tick, value: frame.values[channel] ?? null,
            reliable: frame.reliable[channel] === true, ref: frame.ref };
          if (entry.latest && sample.tick <= entry.latest.tick) continue;
          const conflict = predictions.find(prediction => prediction.channel === channel && prediction.tick === frame.tick
            && sample.reliable && sample.value !== null && sample.value !== prediction.value);
          if (conflict) {
            revisions.push({ channel, reason: 'contradiction', evidence: [sample.ref],
              previous: { tick: conflict.tick, value: conflict.value } });
            if (entry.pulse && entry.pulseStart !== null) entry.pulse = undefined;
            cached = null;
          }
          entry.latest = sample;
          if (sample.tick >= entry.epoch && sample.tick > (heldUntil.get(channel) ?? -1)) {
            entry.samples.push(sample);
            entry.learner.observe({ ...sample, tick: sample.tick - entry.epoch });
            entry.dirty = true;
          }
          if (entry.pulseStart !== null && sample.tick >= entry.pulseStart && sample.tick > (heldUntil.get(channel) ?? -1)) entry.pulseSamples.push(sample);
        }
      }
      for (const entry of memory.values()) if (variant === 'candidate' && entry.pulseStart !== null && !entry.pulse) {
        entry.pulse = inferDelayedResponse(entry.pulseSamples, entry.pulseStart);
      }
    }
    processed = history.length;
    predictions = [];
    return revisions;
  }

  function observed(channel, tick) {
    const sample = memory.get(channel).latest;
    return sample?.tick === tick && sample.reliable && sample.value !== null
      ? { value: sample.value, evidence: [sample.ref] } : undefined;
  }

  function predict(channel, tick, state) {
    const hold = state.holds[channel];
    if (hold && tick <= hold.until) {
      const proof = hold.evidence?.length ? hold : holdProofs.get(channel);
      if (proof?.evidence.length && proof.value === hold.value && proof.until >= tick)
        return { value: hold.value, evidence: proof.evidence };
      const current = observed(channel, state.tick);
      if (current?.value === hold.value) return current;
      return;
    }
    if (tick === state.tick) {
      const actual = observed(channel, tick);
      if (actual) return actual;
    }
    return modelFor(channel)?.predict(tick);
  }

  function route(observation, remainingActions) {
    const initial = { tick: observation.tick, position: observation.position,
      holds: Object.fromEntries(Object.entries(observation.holds).map(([id, hold]) => [id,
        { ...hold, evidence: holdProofs.get(id)?.evidence ?? observed(id, observation.tick)?.evidence ?? [] }])), uses: { ...observation.uses }, revalidate: false };
    const canModel = moves.some(action => action.from === initial.position && (action.gates ?? []).every(channel => modelFor(channel)
      || initial.holds[channel]?.until >= initial.tick + action.duration))
      || actions.some(action => action.kind === 'hold' && (action.from === undefined || action.from === initial.position)
        && (initial.uses[action.id] ?? action.uses ?? 0) > 0
        && (action.targets ?? []).every(channel => observed(channel, initial.tick)?.value === 1));
    if (!canModel) return null;
    const passiveActions = [...waitActions, ...inspectActions].sort((a, b) => a.duration - b.duration);
    const chosen = composePlan({ initial,
      key: state => JSON.stringify([state.tick, state.position, state.revalidate, state.holds, state.uses]),
      goal: { relation: 'observed_temporal_access', holds: state => state.position === task.goal || state.revalidate
        || state.position !== initial.position && moves.some(action => action.from === state.position
          && (action.gates ?? []).some(channel => !modelFor(channel))) },
      budget: { commands: Math.min(remainingActions, 160), states: limits.states },
      choices: function* (state) {
        if (state.revalidate) return;
        for (const action of moves) {
          if (action.from !== state.position || state.tick + action.duration > limits.ticks) continue;
          const evidence = [], guards = [];
          let permitted = true;
          for (let tick = state.tick + 1; tick <= state.tick + action.duration; tick++) {
            for (const channel of action.gates ?? []) {
              const prediction = predict(channel, tick, state);
              if (prediction?.value !== 1) permitted = false;
              if (prediction) { evidence.push(...prediction.evidence); guards.push({ channel, tick, ...prediction }); }
            }
          }
          if (!permitted) continue;
          const after = { ...state, tick: state.tick + action.duration, position: action.to,
            revalidate: Boolean(action.perturbs?.length) };
          yield { action: { id: action.id, guards }, after, evidence: unique(evidence),
            requires: [{ relation: 'window_covers_all_movement_ticks', holds: () => permitted }],
            ensures: [{ relation: 'actual_destination_requires_replay', holds: result => result.position === action.to }] };
        }
        for (const action of actions.filter(item => item.kind === 'hold')) {
          if (action.from !== undefined && action.from !== state.position) continue;
          const uses = state.uses[action.id] ?? action.uses ?? 0;
          if (uses < 1 || state.tick + action.duration > limits.ticks) continue;
          const values = (action.targets ?? []).map(channel => [channel, predict(channel, state.tick, state)]);
          if (values.some(([, value]) => value?.value !== 1)) continue;
          const holds = { ...state.holds }, evidence = [];
          for (const [channel, value] of values) {
            holds[channel] = { value: value.value, until: state.tick + action.holdTicks, evidence: value.evidence };
            evidence.push(...value.evidence);
          }
          yield { action: { id: action.id, guards: [] }, evidence: unique(evidence),
            after: { ...state, tick: state.tick + action.duration, holds, uses: { ...state.uses, [action.id]: uses - 1 } } };
        }
        const passive = passiveActions.find(action => action.from === undefined || action.from === state.position);
        if (passive && state.tick + passive.duration <= limits.ticks) yield {
          action: { id: passive.id, guards: [] }, evidence: [], after: { ...state, tick: state.tick + passive.duration } };
      },
    });
    if (!chosen?.effects.length) return null;
    return { effects: chosen.effects, explored: chosen.explored };
  }

  return {
    decide(history) {
      if (!Array.isArray(history) || !history.length) throw new Error('Public history is required');
      const revisions = consume(history), current = history.at(-1), remainingActions = limits.actions - (history.length - 1);
      if (current.terminal || remainingActions < 1) return null;
      const enabled = new Set(current.enabled);
      let chosen, evidence = [], reason, mode, planned = [], explored = 0, executedGuards = [];
      if (cached?.effects.length && cached.effects[0].after.tick - byId.get(cached.effects[0].action.id).duration === current.tick
        && enabled.has(cached.effects[0].action.id) && !revisions.length) {
        const first = cached.effects[0], action = byId.get(first.action.id);
        const checked = first.action.guards.map(guard => ({ channel: guard.channel, tick: guard.tick,
          ...predict(guard.channel, guard.tick, { ...current, holds: current.holds }) }));
        const valid = checked.every((guard, index) => guard.value === first.action.guards[index].value && guard.evidence?.length);
        if (valid) { chosen = action; evidence.push(...first.evidence); executedGuards = checked;
          planned = cached.effects.map(effect => effect.action.id); cached.effects.shift(); }
      }
      if (!chosen) {
        cached = route(current, remainingActions);
        if (cached && enabled.has(cached.effects[0].action.id)) {
          const first = cached.effects.shift();
          chosen = byId.get(first.action.id); evidence.push(...first.evidence); executedGuards = first.action.guards;
          planned = [chosen.id, ...cached.effects.map(effect => effect.action.id)]; explored = cached.explored;
        }
      }
      if (!chosen) {
        const trigger = actions.find(action => action.kind === 'trigger' && enabled.has(action.id)
          && (action.targets ?? []).some(channel => required.has(channel)));
        if (trigger) { chosen = trigger; reason = 'Observe a command-relative return before reusing its timing'; }
      }
      if (!chosen) {
        const availableInspect = inspectActions.find(action => enabled.has(action.id)
          && current.tick + action.duration <= limits.ticks);
        const relevant = [...required].filter(channel => moves.some(action => action.from === current.position && action.gates?.includes(channel)));
        const unknown = relevant.some(channel => !modelFor(channel));
        const unread = relevant.some(channel => !observed(channel, current.tick));
        if (availableInspect && (unknown || unread)) { chosen = availableInspect; reason = 'Obtain dated reliable observations that distinguish temporal hypotheses'; }
        else { chosen = waitActions.find(action => enabled.has(action.id)) ?? availableInspect;
          reason = unknown ? 'Abstain from an unsupported crossing and collect another return' : 'Wait for a jointly supported opening'; }
      }
      if (!chosen) return null;
      mode = chosen.kind === 'inspect' ? 'observe' : chosen.kind === 'wait'
        ? ([...required].some(channel => !modelFor(channel)) ? 'abstain' : 'wait') : 'act';
      if (revisions.length) mode = 'revise';
      reason ??= planned.length ? 'Compose learned temporal validity with measured access and check the executed prefix'
        : 'Act within a supported temporal condition';
      const state = { ...current, holds: { ...current.holds } };
      pendingHold = chosen.kind === 'hold' ? { action: chosen.id, start: current.tick, values: {} } : null;
      if (chosen.kind === 'hold') for (const channel of chosen.targets ?? []) {
        const value = predict(channel, current.tick, state);
        if (value) {
          pendingHold.values[channel] = value;
          state.holds[channel] = { value: value.value, until: current.tick + chosen.holdTicks, evidence: value.evidence };
        }
      }
      predictions = [];
      for (const channel of task.channels) for (let tick = current.tick + 1; tick <= current.tick + chosen.duration; tick++) {
        // A command that resets this mechanism cannot reuse its previous phase.
        if (chosen.kind === 'trigger' && chosen.targets?.includes(channel) || chosen.perturbs?.includes(channel) && tick === current.tick + chosen.duration) continue;
        const prediction = predict(channel, tick, state);
        if (prediction) predictions.push({ channel, tick, value: prediction.value, evidence: prediction.evidence });
      }
      evidence.push(...predictions.flatMap(prediction => prediction.evidence), ...revisions.flatMap(revision => revision.evidence),
        ...executedGuards.flatMap(guard => guard.evidence));
      return { action: chosen.id, reason, mode, predictions: structuredClone(predictions), evidence: unique(evidence), revisions,
        composition: { primitive: 'P09', planned, explored, executedGuards },
        models: Object.fromEntries(task.channels.map(channel => [channel, modelFor(channel)?.summary ?? []])) };
    },
  };
}

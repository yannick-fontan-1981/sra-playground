import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeCommand, NativeFamily, NativeObservation, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { currentRelayControl, inferRelayBindings, planRelayRoute, readRelayScene, recordRelayCalibration, relayPhase, relaySelection, retainScoredRelay, sameRelayLayout,
  type RelayCalibration, type RelayRoute, type RelayScene, type RelayWitness } from './relay-configuration.ts';
import { sicNeedId } from './need-identity.ts';

export const observedRelayRouteId = 'sic_configure_observed_relay_route';
export const observedRelayStrategies = {
  identify_relay_control: 'Select the controller and verify which relay responds',
  find_observed_relay_phase: 'Turn the selected relay until an observed direction is recognized',
  align_relay_with_receiver: 'Turn the selected relay toward its receiver',
  launch_configured_relay_route: 'Launch the route after the required relay directions are ready',
} as const;

type Strategy = keyof typeof observedRelayStrategies;
type Local = { epoch: number; scene: RelayScene; route: RelayRoute; bindings: Record<number, string>; selected: number | null;
  directions: Record<number, number>; seen: Record<number, string[]>; facts: string[]; stopped: boolean;
  phaseDirections?: Record<string, number | null>; pendingPhases?: Record<number, string[]> };
type Decision = { strategy: Strategy; command: NativeCommand; slot: number | null; phase: string | null; direction: number | null };
type Proposal = NativeProposal & { decision: Decision; local: Local; needId: string };
type Result = { valid: boolean; body?: string; direction?: number | null; phase?: string };

const mod = (a: number, n: number) => ((a % n) + n) % n;
const command = (action_ref: string): NativeCommand => ({ action_ref, data: {} });
const point = ([x, y]: NativePoint): NativeCommand => ({ action_ref: 'ACTION6', data: { x, y } });

function chooseRelay(local: Local, view: RelayScene, rows: NativeRows, witness: RelayWitness): Decision | null {
  const next = local.route.legs.find(leg => {
    const slot = Object.keys(local.bindings).find(i => local.bindings[Number(i)] === leg.body.ref);
    return slot === undefined || local.directions[Number(slot)] !== leg.direction;
  });
  if (!next) return { strategy: 'launch_configured_relay_route', command: command(witness.launch), slot: null, phase: null, direction: null };
  const bound = Object.keys(local.bindings).find(i => local.bindings[Number(i)] === next.body.ref);
  const slot = bound === undefined ? local.scene.controls.findIndex((_control, index) => !local.bindings[index]) : Number(bound);
  if (slot < 0) return null;
  const control = currentRelayControl(view, local.scene.controls[slot]!);
  if (!control) return null;
  if (local.selected !== slot) {
    return { strategy: 'identify_relay_control', command: point(control.point), slot, phase: null, direction: null };
  }
  const { direction: measured, phase } = relayPhase(rows, control, witness, witness.sourceMark ? local.phaseDirections : undefined);
  const current = measured ?? local.directions[slot];
  if (current === undefined) {
    if (local.seen[slot]?.includes(phase)) return null;
    return { strategy: 'find_observed_relay_phase', command: command(witness.reverse), slot, phase, direction: null };
  }
  const gap = mod(next.direction - current, witness.count);
  if (gap === 0) return null;
  const forward = gap <= witness.count / 2;
  return { strategy: 'align_relay_with_receiver', command: command(forward ? witness.forward : witness.reverse), slot, phase,
    direction: mod(current + (forward ? 1 : -1), witness.count) };
}

function inspectRelayReturn(proposal: Pick<Proposal, 'decision' | 'local'>, witness: RelayWitness, first: NativeRows, second: NativeRows): Result {
  const { decision, local } = proposal, slot = decision.slot;
  const view = readRelayScene(second, local.scene, witness.goalMark);
  if (slot === null || !view || !sameRelayLayout(local.scene, view)) return { valid: false };
  const control = currentRelayControl(view, local.scene.controls[slot]!);
  if (!control) return { valid: false };
  const { phase, direction } = relayPhase(second, control, witness, witness.sourceMark ? local.phaseDirections : undefined);
  if (decision.strategy === 'identify_relay_control') {
    const selected = local.selected === null ? null : local.scene.objects.find(body => body.ref === local.bindings[local.selected!]) ?? null;
    const body = relaySelection(local.scene, first, second, selected);
    const other = Object.keys(local.bindings).some(index => Number(index) !== slot && local.bindings[Number(index)] === body?.ref);
    if (!body || other || body.ref === local.scene.goal.ref || body.ref === local.route.source.ref
      || local.bindings[slot] && local.bindings[slot] !== body.ref) return { valid: false };
    return { valid: true, body: body.ref, direction, phase };
  }
  return { valid: phase !== decision.phase && (direction === null || decision.direction === null || direction === decision.direction),
    direction: direction ?? decision.direction, phase };
}

function rememberRelayPhases(state: Local, decision: Decision, returned: Result, slot: number, count: number) {
  if (!returned.phase) return {};
  const measuring = decision.strategy === 'find_observed_relay_phase' && decision.phase;
  const pending = measuring ? [...(state.pendingPhases?.[slot] ?? []), decision.phase!] : [];
  if (returned.direction == null) return { pendingPhases: { ...state.pendingPhases, [slot]: pending } };
  const phaseDirections = { ...state.phaseDirections };
  const observed = [...pending, returned.phase];
  for (const [index, phase] of observed.entries()) {
    const direction = mod(returned.direction + pending.length - index, count);
    phaseDirections[phase] = !Object.hasOwn(phaseDirections, phase) || phaseDirections[phase] === direction ? direction : null;
  }
  return { phaseDirections, pendingPhases: { ...state.pendingPhases, [slot]: [] } };
}

export type RelayAcquisition = { calibration: RelayCalibration; witness?: RelayWitness };

export function acquireRelayReturn(prior: RelayAcquisition | undefined, before: NativeObservation, after: NativeObservation,
  action: NativeCommand, first: NativeRows, second: NativeRows, frames: readonly NativeRows[]): RelayAcquisition | undefined {
  if (!before.available_action_refs.includes('ACTION6') || !before.available_action_refs.includes('ACTION5')
    || before.available_action_refs.includes('ACTION1') || before.available_action_refs.includes('ACTION2')) return prior;
  if (frames.length < 3 && prior?.calibration.epoch !== before.level_epoch) return prior;
  const measured = recordRelayCalibration(prior?.calibration ?? null, before, after, action, first, second, frames);
  if (!measured) return prior;
  const witness = measured.witness ?? prior?.witness;
  return { calibration: measured.local, ...(witness ? { witness } : {}) };
}

export function projectRecalledRelay(prior: Local | null, observation: NativeObservation, rows: NativeRows, memory: RelayWitness) {
  if (memory.epoch !== observation.level_epoch) return null;
  const previous = prior?.epoch === observation.level_epoch ? prior : null;
  const view = readRelayScene(rows, previous?.scene, memory.goalMark);
  if (!view) return null;
  if (previous?.stopped || previous && !sameRelayLayout(previous.scene, view)) return null;
  const route = previous?.route ?? planRelayRoute(view, rows, memory);
  if (!route) return null;
  const bindings = !previous && view.recoveredGoal ? inferRelayBindings(view, route.source, rows) : {};
  const directions = Object.fromEntries(Object.keys(bindings).flatMap(index => {
    const slot = Number(index), { direction } = relayPhase(rows, view.controls[slot]!, memory, memory.phaseDirections);
    return direction === null ? [] : [[slot, direction]];
  }));
  const state: Local = previous ?? { epoch: observation.level_epoch, scene: view, route, bindings,
    selected: null, directions, seen: {}, facts: [], stopped: false,
    ...(memory.phaseDirections ? { phaseDirections: memory.phaseDirections } : {}) };
  const decision = chooseRelay(state, view, rows, memory);
  if (!decision || !observation.available_action_refs.includes(decision.command.action_ref)) return null;
  return { state, decision, view, route };
}

export function observeRecalledRelay(proposal: Pick<Proposal, 'decision' | 'local'>, witness: RelayWitness,
  first: NativeRows, second: NativeRows, observationRef: string) {
  const state = proposal.local, decision = proposal.decision, slot = decision.slot;
  const returned = inspectRelayReturn(proposal, witness, first, second);
  const next: Local = { ...state, stopped: !returned.valid, facts: [...state.facts.slice(-5), observationRef] };
  if (!returned.valid || slot === null) return { matched: returned.valid, local: next };
  next.selected = slot;
  if (returned.body) next.bindings = { ...state.bindings, [slot]: returned.body };
  if (returned.direction !== undefined && returned.direction !== null) next.directions = { ...state.directions, [slot]: returned.direction };
  if (decision.phase) next.seen = { ...state.seen, [slot]: [...(state.seen[slot] ?? []), decision.phase] };
  Object.assign(next, rememberRelayPhases(state, decision, returned, slot, witness.count));
  return { matched: returned.valid, local: next };
}

export function createSicObservedRelayRoute(): NativeFamily<Proposal> {
  let calibration: RelayCalibration | null = null, witness: RelayWitness | null = null, local: Local | null = null;
  return {
    id: observedRelayRouteId,
    observePublicOutcome(before, after, action, first, second, frames = []) {
      if (!before.available_action_refs.includes('ACTION6') || !before.available_action_refs.includes('ACTION5')
        || before.available_action_refs.includes('ACTION1') || before.available_action_refs.includes('ACTION2')) return;
      if (frames.length < 3 && calibration?.epoch !== before.level_epoch) return;
      const measured = recordRelayCalibration(calibration, before, after, action, first, second, frames);
      if (!measured) return;
      calibration = measured.local;
      if (measured.witness) witness = measured.witness;
    },
    async propose(observation, rows, _inputs, remaining) {
      const memory = witness;
      if (remaining < 1 || memory?.epoch !== observation.level_epoch) return null;
      const selected = projectRecalledRelay(local, observation, rows, memory);
      if (!selected) return null;
      const { state, decision, view, route } = selected;
      const ref = observation.observation_ref, parent = 'G_official_completion';
      const traceableControl = decision.slot !== null && view.recoveredGoal && state.bindings[decision.slot];
      const label = decision.strategy === 'identify_relay_control' && traceableControl
        ? 'Select the relay linked by the visible wire to verify its direction' : observedRelayStrategies[decision.strategy];
      const action = decision.command, actions = [action];
      const evidence: [string, ...string[]] = [ref, ...new Set([...memory.evidence, ...state.facts.slice(-5)].filter(value => value !== ref))];
      const control = decision.slot === null ? null : currentRelayControl(view, state.scene.controls[decision.slot]!);
      const binding = control && action.action_ref === 'ACTION6'
        ? await ObservedInputDomain.makeLocusWitness(observation, rows, control.point, { reason: label, evidence }) : null;
      if (action.action_ref === 'ACTION6' && !binding) return null;
      const objective = { kind: 'prepare_visible_relay_chain', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['sender', 'selected_relay', 'receiver'], parentObjective: parent,
        satisfactionContract: 'public_route_prepared_and_official_progress_observed' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = 'relay-route:' + need.id;
      return { status: 'proposed', kind: observedRelayRouteId, actions, local: state, decision, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        steps: [{ action, ...(binding ? { point_binding: binding } : {}), expected_after: decision.direction }],
        sicSituationCard: { strategy: decision.strategy, need: 'Prepare a visible path from the emitter to the receiver',
          situation: label, mode: decision.strategy === 'identify_relay_control' ? 'assimilation' : 'solving', evidence, agenda: [],
          source: route.source.bbox, control: control?.bbox ?? null, receivers: route.legs.map(leg => leg.receiver.bbox) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy: decision.strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label, preconditions: {},
          preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'current_relay_bound' : 'relay_context_changed' };
    },
    after(proposal, _index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) {
        return { matched: true, seal_prefix: true, reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      }
      const matched = !!witness && inspectRelayReturn(proposal, witness, first, second).valid;
      return { matched, seal_prefix: true, reason: matched ? 'relay_selection_or_phase_confirmed' : 'relay_prediction_unconfirmed' };
    },
    record(before, after, _action, first, second, proposal, _index, frames) {
      if (witness && after.levels_completed > before.levels_completed && proposal.decision.strategy === 'launch_configured_relay_route') {
        witness = retainScoredRelay(witness, proposal.local.route, before, after, first, frames, proposal.local.phaseDirections, proposal.local.scene) ?? witness;
      }
      if (!witness || before.level_epoch !== after.level_epoch) return { events: [] };
      local = observeRecalledRelay(proposal, witness, first, second, after.observation_ref).local;
      return { events: [] };
    },
    state: () => ({ calibration, witness, local }),
    restore(value: NativeRecord) {
      calibration = structuredClone((value.calibration as RelayCalibration | undefined) ?? null);
      witness = structuredClone((value.witness as RelayWitness | undefined) ?? null);
      local = structuredClone((value.local as Local | undefined) ?? null);
    },
  };
}

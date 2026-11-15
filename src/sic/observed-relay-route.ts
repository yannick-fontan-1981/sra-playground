import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeCommand, NativeFamily, NativeObservation, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { currentRelayControl, planRelayRoute, readRelayScene, recordRelayCalibration, relayPhase, relaySelection, sameRelayLayout,
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
  directions: Record<number, number>; seen: Record<number, string[]>; facts: string[]; stopped: boolean };
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
  const { direction: measured, phase } = relayPhase(rows, control, witness);
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

function inspectRelayReturn(proposal: Proposal, witness: RelayWitness, first: NativeRows, second: NativeRows): Result {
  const { decision, local } = proposal, slot = decision.slot;
  const view = readRelayScene(second);
  if (slot === null || !view || !sameRelayLayout(local.scene, view)) return { valid: false };
  const control = currentRelayControl(view, local.scene.controls[slot]!);
  if (!control) return { valid: false };
  const { phase, direction } = relayPhase(second, control, witness);
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
      const view = readRelayScene(rows);
      if (!view) return null;
      const previous = local?.epoch === observation.level_epoch ? local : null;
      if (previous?.stopped || previous && !sameRelayLayout(previous.scene, view)) return null;
      const route = previous?.route ?? planRelayRoute(view, rows, memory);
      if (!route) return null;
      const state: Local = previous ?? { epoch: observation.level_epoch, scene: view, route, bindings: {},
        selected: null, directions: {}, seen: {}, facts: [], stopped: false };
      const decision = chooseRelay(state, view, rows, memory);
      if (!decision || !observation.available_action_refs.includes(decision.command.action_ref)) return null;
      const ref = observation.observation_ref, parent = 'G_official_completion';
      const label = observedRelayStrategies[decision.strategy], action = decision.command, actions = [action];
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
    record(before, after, _action, first, second, proposal) {
      if (!witness || before.level_epoch !== after.level_epoch) return { events: [] };
      const state = proposal.local, decision = proposal.decision, slot = decision.slot;
      const returned = inspectRelayReturn(proposal, witness, first, second);
      local = { ...state, stopped: !returned.valid, facts: [...state.facts.slice(-5), after.observation_ref] };
      if (!returned.valid || slot === null) return { events: [] };
      local.selected = slot;
      if (returned.body) local.bindings = { ...state.bindings, [slot]: returned.body };
      if (returned.direction !== undefined && returned.direction !== null) local.directions = { ...state.directions, [slot]: returned.direction };
      if (decision.phase) local.seen = { ...state.seen, [slot]: [...(state.seen[slot] ?? []), decision.phase] };
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

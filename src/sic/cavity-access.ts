import { measureOpenCavityStopGeometry, rectangularOpenComplements } from '../logos-engine/v6-cavity-measurements.ts';
import { supportParts, supportResidualCorrespondences } from '../logos-engine/v6-support-measurements.ts';
import type { NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';
import { sicNeedId } from './need-identity.ts';

export const cavityAccessId = 'sic_cavity_access';
const objective = 'G_official_completion';
const names = ['follow_measured_slide', 'learn_slide_control'] as const;
const graph = compileStrategyGraph({ id: 'understand_access_to_open_cavity', version: 1, order: 'FALLBACK', priorities: names,
  strategies: {
    follow_measured_slide: [{ fact: 'conditionalRoute', expected: true, label: 'The measured stop and open face support a route' }],
    learn_slide_control: [{ fact: 'untestedDirection', expected: true, label: 'An available direction remains unmeasured' }],
  },
}, ['conditionalRoute', 'untestedDirection']);
type Displacement = { action: string; delta: NativePoint; ref: string };
type State = { epoch: number; body: readonly [number, number, number] | null; floor: number | null;
  directions: Record<string, Displacement>; recent: Displacement | null; tried: string[]; packet: readonly NativeRows[] };
type Proposal = NativeProposal & { key: string; needId: string };
const empty: State = { epoch: 0, body: null, floor: null, directions: {}, recent: null, tried: [], packet: [] };

export function createSicCavityAccess(): NativeFamily<Proposal> {
  let state: State = structuredClone(empty);
  return {
    id: cavityAccessId,
    propose(observation, rows, inputs, remaining) {
      const options = inputs.filter(command => /^ACTION[1-4]$/.test(command.action_ref));
      if (remaining < 1 || options.length < 2) return null;
      const components = supportParts(rows);
      const openings = rectangularOpenComplements(components).map(([, box]) => box);
      if (!openings.some(box => components.some(part => part.area === box.width * box.height
        && part.bbox.width === box.width && part.bbox.height === box.height))) return null;
      const local = state.epoch === observation.level_epoch ? state : empty;
      const body = local.body && components.filter(part => part.area === local.body![1] * local.body![2]
        && part.value === local.body![0] && part.bbox.width === local.body![1] && part.bbox.height === local.body![2]);
      const ref = observation.observation_ref;
      const directions = Object.values(local.directions);
      const measured = body?.length === 1 && local.floor !== null ? measureOpenCavityStopGeometry({
        frame: { rows }, components: { components }, available_action_refs: observation.available_action_refs,
        current_observed_frame: { rows }, current_observation_frame_ref: ref,
        input_aligned_entity_bboxes: [body[0]!.bbox], current_input_aligned_underlay_values: [local.floor],
        interface_action_translation_deltas: directions.map(d => [d.action, ...d.delta.map(Math.sign)]),
        known_action_translation_deltas: local.recent ? [[local.recent.action, ...local.recent.delta]] : [],
        last_action_ref: local.recent?.action, canonical_surface_stop_facts: [], canonical_screen_wrap_facts: [],
        latest_ordered_action_frames: local.packet.map(rows => ({ rows })),
        route_generation_policy: { open_cavity_action_order: options.map(action => action.action_ref), open_cavity_search_state_bound: 256 },
      }) : null;
      const path: string[] = measured?.open_cavity_conditional_route_action_refs?.length ? measured.open_cavity_conditional_route_action_refs
        : measured?.open_cavity_next_stop_equals_core ? measured.open_cavity_nonreturn_first_action_refs ?? [] : [];
      const key = (action: string) => `${observation.frame_hash}:${action}`;
      const known = options.find(command => command.action_ref === path[0] && !local.tried.includes(key(command.action_ref)));
      const untested = options.find(command => !Object.hasOwn(local.directions, command.action_ref)
        && !local.tried.some(attempt => attempt.endsWith(`:${command.action_ref}`)))
        ?? (body?.length === 1 && local.floor !== null
          ? options.find(command => !Object.hasOwn(local.directions, command.action_ref) && !local.tried.includes(key(command.action_ref)))
          : undefined);
      const proof: [string, ...string[]] = [ref, ...new Set(directions.map(direction => direction.ref))];
      const { selected } = resolveStrategyGraph({ graph, mode: 'active', facts: {
        conditionalRoute: { value: !!known, evidence: proof }, untestedDirection: { value: !!untested, evidence: [ref] },
      }, planners: { follow_measured_slide: () => known ?? null, learn_slide_control: () => untested ?? null } });
      if (!selected) return null;
      const { id: strategy, plan: command } = selected;
      const label = strategy === 'follow_measured_slide' ? 'Test a measured slide toward the open cavity' : 'Measure a direction while looking for a movable piece that fits the opening';
      const goal = { kind: 'access_open_cavity', scope: ref.split(':revision:', 1)[0]!, subjects: ['measured_cavity'],
        parentObjective: objective, satisfactionContract: 'observe_official_progress_after_access' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence: proof };
      const id = `cavity:${need.id}`;
      const actions = [command];
      return { status: 'proposed', kind: cavityAccessId, actions, steps: [{ action: command, expected_after: null }],
        key: key(command.action_ref), needId: need.id, binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${objective}`] }],
        question: { reason: label, hypothesis_refs: proof }, route_refs: proof,
        sicLocalDecision: { strategy, objective: { id, label, parent: objective }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: objective, purpose: label,
          evidence: proof, preconditions: {}, preserve_refs: [], actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'current_cavity_scope_bound' : 'cavity_scope_changed' };
    },
    after(proposal, _index, before, after) {
      const scored = after.levels_completed > before.levels_completed;
      return { matched: null, seal_prefix: true, reason: scored ? 'official_boundary' : 'observe_slide_and_stop',
        ...(scored ? { sic_need: { id: proposal.needId, status: 'satisfied' } } : {}) };
    },
    record(before, after, command, first, second, proposal, _index, frames) {
      if (after.level_epoch !== before.level_epoch || after.state !== before.state) return { events: [] };
      if (state.epoch !== before.level_epoch) state = { ...structuredClone(empty), epoch: before.level_epoch };
      state.tried.push(proposal.key);
      const openings = rectangularOpenComplements(supportParts(second));
      const moved = supportResidualCorrespondences(before, after, first, second).candidates.filter((pair: { after: { bbox: number[]; palette_value: number } }) => {
        const [l, t, r, b] = pair.after.bbox, width = r! - l! + 1, height = b! - t! + 1;
        return openings.some(([, box]) => width === box.width && height === box.height)
          && (!state.body || state.body[0] === pair.after.palette_value && state.body[1] === width && state.body[2] === height);
      });
      if (moved.length !== 1) return { events: [] };
      const { before: from, after: to } = moved[0]!;
      const delta = [to.position[1] - from.position[1], to.position[0] - from.position[0]] as const;
      if ((delta[0] === 0) === (delta[1] === 0)) return { events: [] };
      state.body = [to.palette_value, to.bbox[2] - to.bbox[0] + 1, to.bbox[3] - to.bbox[1] + 1];
      const [l, t, r, b] = from.bbox, floor = new Set<number>();
      for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) floor.add(second[y]![x]!);
      if (floor.size === 1 && !floor.has(to.palette_value)) state.floor = [...floor][0]!;
      state.recent = { action: command.action_ref, delta, ref: after.observation_ref };
      state.directions[command.action_ref] = state.recent;
      state.packet = [first, ...(frames.length ? frames : [second])];
      return { events: [{ kind: 'sic_observed_slide', command: command.action_ref, delta, observation: after.observation_ref }] };
    },
    state: () => ({ ...state }),
    restore(value: NativeRecord) { state = structuredClone(value as State); },
  };
}

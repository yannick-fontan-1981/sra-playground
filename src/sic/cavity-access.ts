import { measureOpenCavityStopGeometry, rectangularOpenComplements } from '../logos-engine/v6-cavity-measurements.ts';
import { supportParts, supportResidualCorrespondences } from '../logos-engine/v6-support-measurements.ts';
import type { NativeFamily, NativeObservation, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
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
// Directions and animation offsets use row/column order.
type Displacement = { action: string; delta: NativePoint; ref: string };
type Stop = { claim_ref: string; local_row_pitch: number; local_column_pitch: number; revisable_floor_value: number; stop_surface_values: number[] };
type State = { epoch: number; body: readonly [number, number, number] | null; floor: number | null;
  directions: Record<string, Displacement>; recent: Displacement | null; tried: string[]; packet: readonly NativeRows[]; stop: Stop | null };
type Proposal = NativeProposal & { key: string; needId: string };
const empty: State = { epoch: 0, body: null, floor: null, directions: {}, recent: null, tried: [], packet: [], stop: null };

function matchingBodies(rows: NativeRows, [color, width, height]: NonNullable<State['body']>) {
  return supportParts(rows).filter(part => part.area === width * height && part.value === color
    && part.bbox.width === width && part.bbox.height === height);
}

export function animationSlideDirection(positions: readonly NativePoint[], width: number, height: number): NativePoint | null {
  const directions = new Map<string, NativePoint>();
  for (const [i, [row, column]] of positions.slice(1).entries()) {
    const [previousRow, previousColumn] = positions[i]!;
    const dr = row - previousRow, dc = column - previousColumn;
    if ((dr === 0) === (dc === 0) || Math.abs(dr) > height || Math.abs(dc) > width) continue;
    const direction = [Math.sign(dr), Math.sign(dc)] as const;
    directions.set(direction.join(','), direction);
  }
  return directions.size === 1 ? [...directions.values()][0]! : null;
}

function measureAccess(state: State, observation: NativeObservation, rows: NativeRows, bbox: NativeRecord) {
  const options = observation.available_action_refs.filter(action => /^ACTION[1-4]$/.test(action));
  return measureOpenCavityStopGeometry({
    frame: { rows }, components: { components: supportParts(rows) }, available_action_refs: observation.available_action_refs,
    current_observed_frame: { rows }, current_observation_frame_ref: observation.observation_ref,
    input_aligned_entity_bboxes: [bbox], current_input_aligned_underlay_values: [state.floor],
    interface_action_translation_deltas: Object.values(state.directions).map(d => [d.action, ...d.delta]),
    known_action_translation_deltas: state.recent ? [[state.recent.action, ...state.recent.delta]] : [],
    last_action_ref: state.recent?.action, canonical_surface_stop_facts: state.stop ? [state.stop] : [],
    canonical_screen_wrap_facts: [], latest_ordered_action_frames: state.packet.map(frame => ({ rows: frame })),
    route_generation_policy: { open_cavity_action_order: options, open_cavity_search_state_bound: 256 },
  });
}

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
      const body = local.body && matchingBodies(rows, local.body);
      const ref = observation.observation_ref;
      const directions = Object.values(local.directions);
      const measured = body?.length === 1 && local.floor !== null ? measureAccess(local, observation, rows, body[0]!.bbox) : null;
      const path: string[] = measured?.open_cavity_conditional_route_action_refs?.length ? measured.open_cavity_conditional_route_action_refs
        : measured?.open_cavity_next_stop_equals_core ? measured.open_cavity_nonreturn_first_action_refs ?? [] : [];
      const key = (action: string) => `${observation.frame_hash}:${action}`;
      const known = options.find(command => command.action_ref === path[0] && !local.tried.includes(key(command.action_ref)));
      const untested = options.find(command => !Object.hasOwn(local.directions, command.action_ref)
        && !local.tried.some(attempt => attempt.endsWith(`:${command.action_ref}`)))
        ?? (body?.length === 1 && local.floor !== null
          ? options.find(command => !Object.hasOwn(local.directions, command.action_ref) && !local.tried.includes(key(command.action_ref)))
          : undefined);
      const proof: [string, ...string[]] = [ref, ...new Set([...directions.map(direction => direction.ref), ...(local.stop ? [local.stop.claim_ref] : [])])];
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
      state.packet = [first, ...(frames.length ? frames : [second])];
      const [, width, height] = state.body;
      const positions: NativePoint[] = state.packet.flatMap(frame => {
        const bodies = matchingBodies(frame, state.body!);
        return bodies.length === 1 ? [[bodies[0]!.bbox.top, bodies[0]!.bbox.left]] : [];
      });
      const direction = animationSlideDirection(positions, width, height);
      if (direction) state.directions[command.action_ref] = { ...state.recent, delta: direction };
      const body = matchingBodies(second, state.body);
      const checked = body.length === 1 && state.floor !== null ? measureAccess(state, after, second, body[0]!.bbox) : null;
      if (checked?.open_cavity_observed_first_stop_matches && state.floor !== null && !state.stop) {
        state.stop = { claim_ref: after.observation_ref, local_row_pitch: height, local_column_pitch: width,
          revisable_floor_value: state.floor, stop_surface_values: checked.open_cavity_stop_surface_values ?? [] };
      }
      return { events: [{ kind: 'sic_observed_slide', command: command.action_ref, delta, direction, observation: after.observation_ref }] };
    },
    state: () => ({ ...state }),
    restore(value: NativeRecord) { state = structuredClone(value as State); },
  };
}

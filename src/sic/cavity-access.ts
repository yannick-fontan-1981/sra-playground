import { measureOpenCavityStopGeometry, rectangularOpenComplements } from '../logos-engine/v6-cavity-measurements.ts';
import { supportParts, supportResidualCorrespondences } from '../logos-engine/v6-support-measurements.ts';
import type { NativeBox, NativeFamily, NativeObservation, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';
import { sicNeedId } from './need-identity.ts';
import { acquireTemporalOpening, intersectsBox, movingOpeningMask, planTemporalCavity } from './temporal-cavity.ts';
import { observedCommandFrontier, rememberCommandReturn, type ObservedCommandGraph } from './observed-command-frontier.ts';
import { pairedOpenings } from './paired-opening.ts';

export const cavityAccessId = 'sic_cavity_access';
const objective = 'G_official_completion';
export const cavityStrategies = {
  follow_timed_slide: 'Time a slide around a moving obstacle',
  follow_measured_slide: 'Follow a measured slide',
  learn_slide_control: 'Measure a direction',
  compare_direction_after_motion: 'Compare a direction at another phase',
  compare_access_to_slot: 'Explore access to a slot between matching sides',
} as const;
const graph = compileStrategyGraph({ id: 'understand_access_to_open_cavity', version: 3, order: 'FALLBACK',
  priorities: ['follow_timed_slide', 'follow_measured_slide', 'learn_slide_control', 'compare_direction_after_motion', 'compare_access_to_slot'] as const,
  strategies: {
    follow_timed_slide: [{ fact: 'timedRoute', expected: true, label: 'Both observed-motion hypotheses support the same route' }],
    follow_measured_slide: [{ fact: 'conditionalRoute', expected: true, label: 'The measured stop and open face support a route' }],
    learn_slide_control: [{ fact: 'untestedDirection', expected: true, label: 'An available direction remains unmeasured' }],
    compare_direction_after_motion: [{ fact: 'reachableContrast', expected: true, label: 'A reachable board offers a new timing comparison' }],
    compare_access_to_slot: [{ fact: 'reachableSlotContrast', expected: true, label: 'Matching sides mark a candidate slot and a new return can be compared' }],
  },
}, ['timedRoute', 'conditionalRoute', 'untestedDirection', 'reachableContrast', 'reachableSlotContrast']);
// Directions and animation offsets use row/column order.
type Displacement = { action: string; delta: NativePoint; ref: string };
type Stop = { claim_ref: string; local_row_pitch: number; local_column_pitch: number; revisable_floor_value: number; stop_surface_values: number[] };
type State = { epoch: number; body: readonly [number, number, number] | null; floor: number | null;
  directions: Record<string, Displacement>; recent: Displacement | null; tried: string[]; packet: readonly NativeRows[]; stop: Stop | null;
  motion: ReturnType<typeof acquireTemporalOpening>; motionEvidence: readonly string[]; transitions: ObservedCommandGraph;
  slots: readonly NativeBox[]; slotEvidence: string | null };
type Proposal = NativeProposal & { key: string; needId: string; expectedStop?: NativePoint; expectedFrame?: string;
  slots?: readonly NativeBox[] };
const empty: State = { epoch: 0, body: null, floor: null, directions: {}, recent: null, tried: [], packet: [], stop: null,
  motion: null, motionEvidence: [], transitions: {}, slots: [], slotEvidence: null };

function matchingBodies(rows: NativeRows, [color, width, height]: NonNullable<State['body']>) {
  return supportParts(rows).filter(part => part.area === width * height && part.value === color
    && part.bbox.width === width && part.bbox.height === height);
}

function bodyOutsideMask(rows: NativeRows, body: NonNullable<State['body']>, motion: State['motion']) {
  const mask = motion && movingOpeningMask(rows, motion);
  return matchingBodies(rows, body).filter(({ bbox: { left, top, right, bottom } }) =>
    !mask || !intersectsBox([left, top, right, bottom], mask));
}

function observedRectangleTranslation(first: NativeRows, second: NativeRows, motion: NonNullable<State['motion']>) {
  const beforeMask = movingOpeningMask(first, motion), afterMask = movingOpeningMask(second, motion);
  if (!beforeMask || !afterMask) return [];
  const before = supportParts(first), after = supportParts(second);
  const openings = rectangularOpenComplements(after);
  const bodies = (parts: typeof before, mask: NativeBox) => parts.flatMap(part => {
    const { left, top, right, bottom, width, height } = part.bbox;
    const bbox: NativeBox = [left, top, right, bottom];
    return part.area === width * height && !intersectsBox(bbox, mask)
      && openings.some(([, box]) => box.width === width && box.height === height)
      ? [{ bbox, position: [left, top] as const, palette_value: part.value }] : [];
  });
  const old = bodies(before, beforeMask), next = bodies(after, afterMask);
  const key = (body: (typeof old)[number]) => [body.palette_value, body.bbox[2] - body.bbox[0], body.bbox[3] - body.bbox[1]].join(',');
  return old.flatMap(body => {
    const signature = key(body);
    const matches = next.filter(candidate => key(candidate) === signature);
    if (matches.length !== 1 || old.filter(candidate => key(candidate) === signature).length !== 1) return [];
    const to = matches[0]!;
    return (body.position[0] === to.position[0]) !== (body.position[1] === to.position[1]) ? [{ before: body, after: to }] : [];
  });
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
      const local = state.epoch === observation.level_epoch ? state : empty;
      const visibleFit = openings.some(box => components.some(part => part.area === box.width * box.height
        && part.bbox.width === box.width && part.bbox.height === box.height));
      const testedEveryDirection = options.every(({ action_ref }) => local.tried.some(attempt => attempt.endsWith(`:${action_ref}`)));
      const shouldLookForSlots = !visibleFit || (!local.body && testedEveryDirection);
      const slots = local.slotEvidence ? local.slots : shouldLookForSlots ? pairedOpenings(rows, components) : [];
      if (!visibleFit && !slots.length) return null;
      const body = local.body && bodyOutsideMask(rows, local.body, local.motion);
      const ref = observation.observation_ref;
      const directions = Object.values(local.directions);
      const measured = body?.length === 1 && local.floor !== null ? measureAccess(local, observation, rows, body[0]!.bbox) : null;
      const path: string[] = measured?.open_cavity_conditional_route_action_refs?.length ? measured.open_cavity_conditional_route_action_refs
        : measured?.open_cavity_next_stop_equals_core ? measured.open_cavity_nonreturn_first_action_refs ?? [] : [];
      const key = (action: string) => `${observation.frame_hash}:${action}`;
      const box = body?.length === 1 ? body[0]!.bbox : null;
      const temporal = box && local.motion && local.floor !== null ? planTemporalCavity(rows, [box.left, box.top, box.right, box.bottom],
        local.floor, local.motion, directions, remaining, ref) : null;
      const timed = options.find(command => command.action_ref === temporal?.action && !local.tried.includes(key(command.action_ref)));
      const known = options.find(command => command.action_ref === path[0] && !local.tried.includes(key(command.action_ref)));
      const unmeasured = visibleFit && !slots.length ? options.filter(command => !Object.hasOwn(local.directions, command.action_ref)) : [];
      const untested = unmeasured.find(command => !local.tried.some(attempt => attempt.endsWith(`:${command.action_ref}`)))
        ?? (body?.length === 1 && local.floor !== null
          ? unmeasured.filter(command => !local.tried.includes(key(command.action_ref))).sort((a, b) => {
            const attempts = (action: string) => local.tried.filter(attempt => attempt.endsWith(`:${action}`)).length;
            return attempts(a.action_ref) - attempts(b.action_ref);
          })[0]
          : undefined);
      const frontier = !timed && !known && !untested && ((box && local.motionEvidence.length) || slots.length)
        ? observedCommandFrontier(local.transitions, observation.frame_hash, options.map(command => command.action_ref), remaining) : null;
      const contrast = options.find(command => command.action_ref === frontier?.action);
      const proof: [string, ...string[]] = [ref, ...new Set([...directions.map(direction => direction.ref), ...(local.stop ? [local.stop.claim_ref] : []),
        ...local.motionEvidence, ...(local.slotEvidence ? [local.slotEvidence] : []), ...(frontier?.first ? [frontier.first.evidence] : [])])];
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active', facts: {
        timedRoute: { value: !!timed, evidence: proof }, reachableContrast: { value: !!contrast && !slots.length, evidence: proof },
        reachableSlotContrast: { value: !!contrast && !!slots.length, evidence: proof },
        conditionalRoute: { value: !!known, evidence: proof }, untestedDirection: { value: !!untested, evidence: [ref] },
      }, planners: { follow_timed_slide: () => timed ?? null, follow_measured_slide: () => known ?? null,
        learn_slide_control: () => untested ?? null, compare_direction_after_motion: () => contrast ?? null,
        compare_access_to_slot: () => contrast ?? null } });
      if (!selected) return null;
      const { id: strategy, plan: command } = selected;
      const labels = {
        follow_timed_slide: 'Test a slide timed against the moving obstacle',
        follow_measured_slide: 'Test a measured slide toward the open cavity',
        learn_slide_control: 'Measure a direction while looking for a movable piece that fits the opening',
        compare_direction_after_motion: frontier?.depth ? 'Follow an observed return to compare a direction at a new phase'
          : 'Compare an untried direction at the current obstacle phase',
        compare_access_to_slot: frontier?.depth ? 'Replay a witnessed transition to reach an untested board near a candidate slot'
          : 'Compare an untried direction while the purpose of the slot is still unknown',
      };
      const label = labels[strategy];
      const motionMask = local.motion ? movingOpeningMask(rows, local.motion) : null;
      const goal = { kind: slots.length ? 'explore_access_to_slot' : 'access_open_cavity',
        scope: ref.split(':revision:', 1)[0]!, subjects: [slots.length ? 'paired_sides' : 'measured_cavity'],
        parentObjective: objective, satisfactionContract: 'observe_official_progress_after_access' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence: proof };
      const id = `cavity:${need.id}`;
      const actions = [command];
      return { status: 'proposed', kind: cavityAccessId, actions, steps: [{ action: command, expected_after: null }],
        ...(local.motionEvidence.length || slots.length ? { sicSituationCard: {
          strategy, need: slots.length ? 'Find what the slot does and whether a piece can reach it' : 'Reach the opening with the controlled piece',
          mode: strategy === 'follow_timed_slide' || strategy === 'follow_measured_slide' ? 'solving' : 'exploration',
          situation: label, agenda: entries, evidence: proof,
          ...(motionMask ? { movingObstacle: motionMask } : {}),
          ...(box ? { controlledPiece: [box.left, box.top, box.right, box.bottom] } : {}),
          ...(slots.length ? { slots } : {}),
        } } : {}),
        ...(strategy === 'follow_timed_slide' && temporal ? { expectedStop: temporal.stop } : {}),
        ...(frontier?.first?.destination ? { expectedFrame: frontier.first.destination } : {}),
        ...(slots.length && !local.slotEvidence ? { slots } : {}),
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
    after(proposal, _index, before, after, _first, second) {
      const scored = after.levels_completed > before.levels_completed;
      const boxes = proposal.expectedStop && state.body ? bodyOutsideMask(second, state.body, state.motion) : [];
      const matched = scored ? null : proposal.expectedFrame ? after.frame_hash === proposal.expectedFrame
        : proposal.expectedStop && boxes.length === 1
          ? boxes[0]!.bbox.left === proposal.expectedStop[0] && boxes[0]!.bbox.top === proposal.expectedStop[1] : null;
      return { matched, seal_prefix: true, reason: scored ? 'official_boundary'
        : matched === false ? proposal.expectedFrame ? 'observed_board_differs_from_replayed_transition'
          : 'observed_return_contradicts_timing_forecast' : 'observe_slide_and_stop',
        ...(scored ? { sic_need: { id: proposal.needId, status: 'satisfied' } } : {}) };
    },
    record(before, after, command, first, second, proposal, _index, frames) {
      if (after.level_epoch !== before.level_epoch || after.state !== before.state) return { events: [] };
      if (state.epoch !== before.level_epoch) state = { ...structuredClone(empty), epoch: before.level_epoch };
      if (proposal.slots?.length) {
        state.slots = proposal.slots;
        state.slotEvidence = before.observation_ref;
      }
      state.tried.push(proposal.key);
      rememberCommandReturn(state.transitions, before.frame_hash, after.frame_hash, command.action_ref, after.observation_ref);
      state.motion = acquireTemporalOpening(first, second, command.action_ref, after.observation_ref, state.motion);
      if (state.motion?.otherEvidence && !state.motionEvidence.length) state.motionEvidence = [state.motion.otherEvidence, state.motion.evidence];
      const openings = rectangularOpenComplements(supportParts(second));
      const correspondences = state.motion ? observedRectangleTranslation(first, second, state.motion)
        : supportResidualCorrespondences(before, after, first, second).candidates;
      const moved = correspondences.filter((pair: { after: { bbox: number[]; palette_value: number } }) => {
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
        const bodies = bodyOutsideMask(frame, state.body!, state.motion);
        return bodies.length === 1 ? [[bodies[0]!.bbox.top, bodies[0]!.bbox.left]] : [];
      });
      const direction = animationSlideDirection(positions, width, height);
      if (direction) state.directions[command.action_ref] = { ...state.recent, delta: direction };
      const body = bodyOutsideMask(second, state.body, state.motion);
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

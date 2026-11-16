import { alternatingDescription, alternatingHistogram, alternatingOverlays, measureAlternatingGraph,
  type AlternatingActor, type AlternatingBox, type AlternatingPosition } from '../logos-engine/v6-alternating-graph-observation.ts';
import { alternatingTopology, instrumentalAlternatingContact, type AlternatingGuard } from '../logos-engine/v6-alternating-graph-questions.ts';
import type { NativeBox, NativeFamily, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { movedPatrol, observePatrolReturn, planPatrolStep, type PatrolMemory, type PatrolStep } from './material-route-patrol.ts';

export const materialRouteId = 'sic_material_route';
export const verifyConnectedRouteId = 'sic_verify_connected_route';
export const materialRouteStrategies = {
  probe_grid_direction: 'Test an input from the current grid position',
  follow_observed_grid_edge: 'Return along measured moves to a position with an open question',
  follow_material_connections: 'Follow the connected tiles toward the distinct piece',
  follow_guarded_connections: 'Follow the measured connections outside each guard’s facing direction',
  test_side_contact: 'Test a side approach using the previous removal as evidence',
  measure_patrol_phase: 'Use a safe move to measure when the patrol advances',
  follow_patrol_phase: 'Move along a route that stays clear when the patrol advances',
} as const;

type Move = { input: string; delta: AlternatingPosition };
type Edge = { input: string; from: string; to: string };
type Calibration = { alternating_material_full_step_pitch: number; alternating_material_first_value: number;
  alternating_material_connector_values: number[] };
type Contact = { guard: AlternatingGuard; evidence: string[] };
type Removal = { guard_histogram: number[][]; size: number; evidence: string[] };
type ContactRoute = { guard: AlternatingGuard; prefix: { action_ref: string; to: AlternatingPosition; contact_index: number | null }[] };
type State = { epoch: number; size: number; histogram: number[][]; samples: Move[]; edges: Edge[];
  evidence: string[]; lastMoved: string | null; repeat: string | null; count: number; stopped: boolean;
  calibration?: Calibration; pendingContact?: Contact | null; removals?: Removal[]; guardedTransfer?: boolean;
  patrol?: PatrolMemory;
  completed?: { readonly nextEpoch: number; readonly score: number; readonly evidence: string } };
type Choice = { input: string; to: AlternatingBox | null; ordinary: boolean; floor: number | null;
  guarded?: boolean; contact?: boolean; patrol?: PatrolStep };
type Proposal = NativeProposal & { local: State; choice: Choice; actor: AlternatingActor; needId: string };
const order = ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4'];
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
const location = (actor: AlternatingActor) => actor.bbox.slice(0, 2).join(',');
const displayBox = ([t, l, b, r]: AlternatingBox): NativeBox => [l, t, r, b];

function frontierStep(edges: readonly Edge[], here: string, available: readonly string[]): Edge | null {
  const queue: { position: string; first: Edge | null }[] = [{ position: here, first: null }];
  const visited = new Set([here]);
  for (const { position, first } of queue) {
    const actions = edges.filter(edge => edge.from === position && available.includes(edge.input));
    if (first && available.some(input => !actions.some(edge => edge.input === input))) return first;
    for (const edge of actions) {
      if (visited.has(edge.to)) continue;
      visited.add(edge.to);
      queue.push({ position: edge.to, first: first ?? edge });
    }
  }
  return null;
}

function hasRepeatedTiles(rows: NativeRows, size: number): boolean {
  const groups = new Map<number, number>();
  for (const component of alternatingDescription(rows).components) {
    if (component.touches_frame_boundary || component.bbox.width !== size || component.bbox.height !== size || component.area !== size ** 2) continue;
    groups.set(component.value, (groups.get(component.value) ?? 0) + 1);
  }
  return [...groups.values()].filter(count => count >= 4).length >= 2;
}

function matchOrdinary(first: NativeRows, second: NativeRows, actor: AlternatingActor, to: AlternatingBox, floor: number): boolean {
  if (!same(alternatingHistogram(second, to), actor.histogram)
    || !same(alternatingHistogram(second, actor.bbox), [[floor, actor.size ** 2]])) return false;
  for (let y = 1; y < first.length - 1; y++) for (let x = 1; x < first[y]!.length - 1; x++) {
    if (first[y]![x] === second[y]?.[x]) continue;
    if (![actor.bbox, to].some(([top, left, bottom, right]) => top <= y && y <= bottom && left <= x && x <= right)) return false;
  }
  return true;
}

function observedCalibration(facts: ReturnType<typeof measureAlternatingGraph> | null): Calibration | null {
  if (facts?.unique_alternating_material_graph_description_present !== true) return null;
  const { alternating_material_full_step_pitch, alternating_material_first_value, alternating_material_connector_values } = facts;
  return { alternating_material_full_step_pitch, alternating_material_first_value, alternating_material_connector_values };
}

function removalAtDeparture(local: State, rows: NativeRows, destination: AlternatingBox, ref: string): Removal | null {
  const { pendingContact, calibration, size } = local;
  if (!pendingContact || !calibration || same(pendingContact.guard.bbox, destination)) return null;
  if (!same(alternatingHistogram(rows, pendingContact.guard.bbox), [[calibration.alternating_material_first_value, size ** 2]])) return null;
  return { guard_histogram: pendingContact.guard.histogram, size, evidence: [...pendingContact.evidence, ref] };
}

export function createSicVerifyConnectedRoute(): NativeFamily<Proposal> {
  let state: State | null = null;
  let decide: NativeProgramHandle | undefined;
  return {
    id: verifyConnectedRouteId,
    async attachPrograms(registry) {
      decide = await registry.registerProgram(chooseLanding, {}, await landingModule());
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      const available = order.filter(input => observation.available_action_refs.includes(input));
      if (remaining < 1 || available.length < 3 || !rows.length) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      if (prior?.stopped || (prior?.count ?? 0) >= 80) return null;
      const actors = alternatingOverlays(rows);
      const matches = (known: State) => actors.filter(actor => actor.size === known.size && same(actor.histogram, known.histogram));
      const completed = state?.completed;
      const remembered = state && completed?.nextEpoch === observation.level_epoch && completed.score === observation.levels_completed &&
        matches(state).length === 1 ? state : null;
      const known = prior ?? remembered;
      const eligible = known ? matches(known) : actors;
      if (eligible.length !== 1) return null;
      const actor = eligible[0]!;
      if (!known && !hasRepeatedTiles(rows, actor.size)) return null;
      const local: State = prior ?? { epoch: observation.level_epoch, size: actor.size, histogram: actor.histogram,
        samples: remembered?.samples ?? [], edges: [], evidence: remembered ? [...remembered.evidence, remembered.completed!.evidence] : [],
        lastMoved: null, repeat: null, count: 0, stopped: false,
        ...(remembered?.calibration && remembered.removals?.length ? {
          calibration: remembered.calibration, removals: remembered.removals, guardedTransfer: true,
        } : {}) };
      const ref = observation.observation_ref;
      const supported = new Map<string, Map<string, AlternatingPosition>>();
      for (const { input, delta } of local.samples) {
        const values = supported.get(input) ?? new Map();
        values.set(delta.join(','), delta);
        supported.set(input, values);
      }
      const controls = Object.fromEntries([...supported].flatMap(([input, values]) =>
        values.size === 1 ? [[input, [...values.values()][0]!]] : []));
      const here = location(actor);
      const tested = new Set(local.edges.filter(edge => edge.from === here).map(edge => edge.input));
      const probe = [...new Set([local.repeat, ...available])].find(input => input !== null && available.includes(input) && !tested.has(input));
      const frontier = !probe ? frontierStep(local.edges, here, available) : null;
      const graphFacts = Object.keys(controls).length >= 2 ? measureAlternatingGraph(rows, observation, actor, controls, local.evidence, local.lastMoved, true) : null;
      const calibration = observedCalibration(graphFacts) ?? local.calibration;
      const topology = local.guardedTransfer && calibration ? alternatingTopology(rows, actor, calibration) : null;
      const conditional = topology && calibration && topology.guards.length
        ? instrumentalAlternatingContact(rows, actor, controls, calibration, local.removals ?? [], remaining) as ContactRoute | null : null;
      const patrol = topology && (local.patrol || !conditional && topology.guards.length > 1)
        ? planPatrolStep(topology, actor, controls, local.removals ?? [], local.patrol, remaining) : null;
      if (local.patrol && !patrol) return null;
      const step = conditional?.prefix[0];
      const evidence: [string, ...string[]] = [ref, ...new Set([...local.evidence, ...(local.patrol?.evidence ?? []),
        ...(topology ? local.removals?.slice(-3).flatMap(item => item.evidence) ?? [] : [])].filter(item => item !== ref))];
      const route = graphFacts?.alternating_material_first_shortest_action_refs as string[] | undefined;
      const input = step?.action_ref ?? route?.[0], delta = input ? controls[input] : null;
      const asBox = (y: number, x: number): AlternatingBox => [y, x, y + actor.size - 1, x + actor.size - 1];
      const to = step ? asBox(...step.to) : delta ? asBox(actor.bbox[0] + delta[0], actor.bbox[1] + delta[1]) : null;
      const floor = topology?.first ?? graphFacts?.alternating_material_first_value ?? null;
      const planned: Choice | null = to && input ? { input, to, floor,
        ordinary: floor !== null && same(alternatingHistogram(rows, to), [[floor, actor.size ** 2]]),
        ...(topology ? { guarded: true, contact: !!step && step.contact_index !== null } : {}) } : null;
      const timed: Choice | null = patrol ? { input: patrol.input, to: asBox(...patrol.to), floor, ordinary: false, guarded: true, patrol } : null;
      const explore: Choice | null = timed?.patrol?.learning ? timed
        : probe && !topology ? { input: probe, to: null, floor: null, ordinary: false } : null;
      const revisit: Choice | null = frontier && !topology ? { input: frontier.input, to: null, floor: null, ordinary: false } : null;
      const mode = execution?.reasoningMode ?? 'exploration';
      const routeOffer = timed ? timed.patrol!.learning ? null : timed : planned ?? (explore ? null : revisit);
      const facts = { routeSupported: !!routeOffer, eligibleProbe: !!explore, knownInteraction: false, mode };
      const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
      if (!decision) return null;
      const strategy = decision.result;
      if (strategy !== 'P07' && strategy !== 'P05') return null;
      const choice = strategy === 'P07' ? routeOffer : explore;
      if (!choice) return null;
      const label = patrol ? patrol.learning ? materialRouteStrategies.measure_patrol_phase
        : patrol.capture ? materialRouteStrategies.test_side_contact : materialRouteStrategies.follow_patrol_phase
        : strategy === 'P05' ? materialRouteStrategies.probe_grid_direction
        : choice.contact ? materialRouteStrategies.test_side_contact
          : topology?.guards.length ? materialRouteStrategies.follow_guarded_connections
            : planned ? materialRouteStrategies.follow_material_connections : materialRouteStrategies.follow_observed_grid_edge;
      const parent = 'G_official_completion';
      const objective = { kind: 'reach_distinct_piece_through_visible_connections', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['controlled_piece', 'connecting_tiles', 'possible_destination'], parentObjective: parent,
        satisfactionContract: 'official_progress_after_contact_along_observed_connections' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = 'material-route:' + need.id, action = { action_ref: choice.input, data: {} }, actions = [action];
      return { status: 'proposed', kind: verifyConnectedRouteId, actions, local: calibration ? { ...local, calibration } : local, actor, choice, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        steps: [{ action, expected_after: choice.ordinary || choice.guarded ? choice.to : null }],
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: facts },
        sicSituationCard: { strategy, need: 'Find an accessible route across the connected tiles', situation: label,
          evidence, agenda: [], mode, triggerCard: chooseLanding,
          actor: displayBox(actor.bbox), target: choice.to ? displayBox(choice.to) : null,
          ...(patrol ? { patrol: displayBox(patrol.obstacle.bbox),
            ...(patrol.expected ? { patrolNext: displayBox(asBox(...patrol.expected)) } : {}) } : {}),
          ...(patrol?.capture ? { guard: displayBox(patrol.capture.bbox), front: displayBox(asBox(...patrol.capture.front)) } : {}),
          ...(conditional ? { guard: displayBox(conditional.guard.bbox), front: displayBox(asBox(...conditional.guard.front)) } : {}) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'current_piece_and_grid_bound' : 'piece_or_grid_context_changed' };
    },
    after(proposal, _index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const { choice, actor, local } = proposal;
      if (choice.patrol) {
        const matched = before.state === after.state && !!movedPatrol(choice.patrol, actor, second);
        return { matched, seal_prefix: true, reason: matched ? 'patrol_and_player_positions_observed' : 'patrol_transition_contradicted' };
      }
      const matched = (choice.ordinary || choice.guarded) && choice.to && choice.floor !== null
        ? before.state === after.state && matchOrdinary(first, second, actor, choice.to, choice.floor) : null;
      const revealed = matched && choice.guarded && choice.to && removalAtDeparture(local, second, choice.to, after.observation_ref);
      return { matched, seal_prefix: true, reason: revealed ? 'ordinary_tile_revealed_after_guard_contact'
        : matched && choice.contact ? 'contact_observed_waiting_to_reveal_tile'
          : matched === true ? 'observed_tile_displacement' : 'compare_piece_displacement_and_contact' };
    },
    record(before, after, command, first, second, proposal, _index, frames = []) {
      if (after.levels_completed > before.levels_completed) {
        state = { ...proposal.local, completed: { nextEpoch: after.level_epoch, score: after.levels_completed, evidence: after.observation_ref } };
        return { events: [] };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, actor, choice } = proposal;
      if (choice.patrol) {
        const at = movedPatrol(choice.patrol, actor, second);
        const patrol = at && observePatrolReturn(choice.patrol, actor, at, frames, local.patrol, after.observation_ref);
        state = { ...local, count: local.count + 1, stopped: !patrol,
          ...(patrol ? { patrol, evidence: [...local.evidence.slice(-5), after.observation_ref] } : {}) };
        return { events: [] };
      }
      const matches = alternatingOverlays(second).filter(next => next.size === actor.size && same(next.histogram, actor.histogram));
      const next = matches.length === 1 ? matches[0]! : null;
      const delta: AlternatingPosition = next ? [next.bbox[0] - actor.bbox[0], next.bbox[1] - actor.bbox[1]] : [0, 0];
      const moved = (delta[0] === 0) !== (delta[1] === 0);
      const input = command.action_ref, from = location(actor);
      const matched = !(choice.ordinary || choice.guarded) || choice.to && choice.floor !== null && matchOrdinary(first, second, actor, choice.to, choice.floor);
      const revealed = moved && next && removalAtDeparture(local, second, next.bbox, after.observation_ref);
      const guard = moved && next && local.calibration &&
        !same(alternatingHistogram(first, next.bbox), [[local.calibration.alternating_material_first_value, local.size ** 2]])
        ? alternatingTopology(first, actor, local.calibration)?.guards.find(item => same(item.bbox, next.bbox)
          && !same(item.front, actor.bbox.slice(0, 2))) : null;
      const pendingContact = guard ? { guard, evidence: [before.observation_ref, after.observation_ref] }
        : moved ? null : local.pendingContact ?? null;
      const edges = next ? [...local.edges.filter(edge => !(edge.from === from && edge.input === input)), { input, from, to: location(next) }] : local.edges;
      const samples = moved && !local.samples.some(sample => sample.input === input && same(sample.delta, delta)) ? [...local.samples, { input, delta }] : local.samples;
      state = { ...local, samples, edges, count: local.count + 1,
        lastMoved: moved ? input : local.lastMoved, repeat: moved ? input : null,
        evidence: moved ? [...local.evidence.slice(-5), after.observation_ref] : local.evidence,
        ...(guard || local.pendingContact ? { pendingContact } : {}),
        ...(revealed ? { removals: [...(local.removals ?? []).slice(-7), revealed] } : {}),
        stopped: !next || (delta.some(Boolean) && !moved) || !matched };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}

import { alternatingDescription, alternatingHistogram, alternatingOverlays, measureAlternatingGraph,
  type AlternatingActor, type AlternatingBox, type AlternatingPosition } from '../logos-engine/v6-alternating-graph-observation.ts';
import type { NativeBox, NativeFamily, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const materialRouteId = 'sic_material_route';
export const materialRouteStrategies = {
  probe_grid_direction: 'Test an input from the current grid position',
  follow_observed_grid_edge: 'Return along measured moves to a position with an open question',
  follow_material_connections: 'Follow the connected tiles toward the distinct piece',
} as const;

const graph = compileStrategyGraph({
  id: 'reach_distinct_piece_through_visible_connections', version: 1, order: 'FALLBACK',
  priorities: ['follow_material_connections', 'probe_grid_direction', 'follow_observed_grid_edge'],
  strategies: {
    follow_material_connections: [{ fact: 'path', expected: true, label: 'One route through the measured tile connections is compatible with the observed controls' }],
    probe_grid_direction: [{ fact: 'probe', expected: true, label: 'The piece stays identifiable and a direction remains untested at this position' }],
    follow_observed_grid_edge: [{ fact: 'frontier', expected: true, label: 'Observed displacements lead to a nearby position with an untested direction' }],
  },
}, ['path', 'probe', 'frontier']);

type Move = { input: string; delta: AlternatingPosition };
type Edge = { input: string; from: string; to: string };
type State = { epoch: number; size: number; histogram: number[][]; samples: Move[]; edges: Edge[];
  evidence: string[]; lastMoved: string | null; repeat: string | null; count: number; stopped: boolean };
type Choice = { input: string; to: AlternatingBox | null; ordinary: boolean; floor: number | null };
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

export function createSicMaterialRoute(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: materialRouteId,
    propose(observation, rows, _inputs, remaining) {
      const available = order.filter(input => observation.available_action_refs.includes(input));
      if (remaining < 1 || available.length < 3 || !rows.length) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      if (prior?.stopped || (prior?.count ?? 0) >= 80) return null;
      const actors = alternatingOverlays(rows);
      const eligible = prior ? actors.filter(actor => actor.size === prior.size && same(actor.histogram, prior.histogram)) : actors;
      if (eligible.length !== 1) return null;
      const actor = eligible[0]!;
      if (!prior && !hasRepeatedTiles(rows, actor.size)) return null;
      const local: State = prior ?? { epoch: observation.level_epoch, size: actor.size, histogram: actor.histogram,
        samples: [], edges: [], evidence: [], lastMoved: null, repeat: null, count: 0, stopped: false };
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...local.evidence.filter(item => item !== ref)];
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
      const route = graphFacts?.alternating_material_first_shortest_action_refs as string[] | undefined;
      const input = route?.[0], delta = input ? controls[input] : null;
      const asBox = (y: number, x: number): AlternatingBox => [y, x, y + actor.size - 1, x + actor.size - 1];
      const to = delta ? asBox(actor.bbox[0] + delta[0], actor.bbox[1] + delta[1]) : null;
      const floor = typeof graphFacts?.alternating_material_first_value === 'number' ? graphFacts.alternating_material_first_value : null;
      const planned: Choice | null = to && input ? { input, to, floor,
        ordinary: floor !== null && same(alternatingHistogram(rows, to), [[floor, actor.size ** 2]]) } : null;
      const explore: Choice | null = probe ? { input: probe, to: null, floor: null, ordinary: false } : null;
      const revisit: Choice | null = frontier ? { input: frontier.input, to: null, floor: null, ordinary: false } : null;
      const { selected, entries } = resolveStrategyGraph({
        graph, mode: 'active',
        facts: { path: { value: !!planned, evidence }, probe: { value: !!explore, evidence }, frontier: { value: !!revisit, evidence } },
        planners: { follow_material_connections: () => planned, probe_grid_direction: () => explore, follow_observed_grid_edge: () => revisit },
      });
      if (!selected) return null;
      const choice = selected.plan, strategy = selected.id, label = materialRouteStrategies[strategy], parent = 'G_official_completion';
      const objective = { kind: 'reach_distinct_piece_through_visible_connections', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['controlled_piece', 'connecting_tiles', 'possible_destination'], parentObjective: parent,
        satisfactionContract: 'official_progress_after_contact_along_observed_connections' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = 'material-route:' + need.id, action = { action_ref: choice.input, data: {} }, actions = [action];
      return { status: 'proposed', kind: materialRouteId, actions, local, actor, choice, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        steps: [{ action, expected_after: choice.ordinary ? choice.to : null }],
        sicSituationCard: { strategy, need: 'Find an accessible route across the connected tiles', situation: label,
          evidence, agenda: entries, mode: planned ? 'solving' : 'exploration',
          actor: displayBox(actor.bbox), target: choice.to ? displayBox(choice.to) : null },
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
      const { choice, actor } = proposal;
      const matched = choice.ordinary && choice.to && choice.floor !== null ? matchOrdinary(first, second, actor, choice.to, choice.floor) : null;
      return { matched, seal_prefix: true, reason: matched === true ? 'observed_tile_displacement' : 'compare_piece_displacement_and_contact' };
    },
    record(before, after, command, first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, actor, choice } = proposal;
      const matches = alternatingOverlays(second).filter(next => next.size === actor.size && same(next.histogram, actor.histogram));
      const next = matches.length === 1 ? matches[0]! : null;
      const delta: AlternatingPosition = next ? [next.bbox[0] - actor.bbox[0], next.bbox[1] - actor.bbox[1]] : [0, 0];
      const moved = (delta[0] === 0) !== (delta[1] === 0);
      const input = command.action_ref, from = location(actor);
      const matched = !choice.ordinary || choice.to && choice.floor !== null && matchOrdinary(first, second, actor, choice.to, choice.floor);
      const edges = next ? [...local.edges.filter(edge => !(edge.from === from && edge.input === input)), { input, from, to: location(next) }] : local.edges;
      const samples = moved && !local.samples.some(sample => sample.input === input && same(sample.delta, delta)) ? [...local.samples, { input, delta }] : local.samples;
      state = { ...local, samples, edges, count: local.count + 1,
        lastMoved: moved ? input : local.lastMoved, repeat: moved ? input : null,
        evidence: moved ? [...local.evidence.slice(-5), after.observation_ref] : local.evidence,
        stopped: !next || (delta.some(Boolean) && !moved) || !matched };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}

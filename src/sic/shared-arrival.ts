import { configuredCrosses, configuredRoute, configuredScene, type ConfiguredScene } from '../logos-engine/v6-configured-arrivals.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const sharedArrivalId = 'sic_shared_arrival';
export const sharedArrivalStrategies = {
  observe_launch: 'Observe how the pieces travel after launch',
  test_route_edit: 'Test a route edit that could bring arrival times together',
  launch_after_route_edit: 'Test the edited route with equal projected lengths',
} as const;
const graph = compileStrategyGraph({ id: 'compare_arrivals_at_common_receiver', version: 1, order: 'FALLBACK',
  priorities: ['launch_after_route_edit', 'test_route_edit', 'observe_launch'],
  strategies: {
    launch_after_route_edit: [{ fact: 'equalRoutes', expected: true, label: 'The tested edit leaves equally long routes to the receiver' }],
    test_route_edit: [{ fact: 'routeEdit', expected: true, label: 'Removing one visited marked cell would equalize route lengths' }],
    observe_launch: [{ fact: 'launchTrial', expected: true, label: 'Two visible pieces can approach a common receiver' }],
  },
}, ['equalRoutes', 'routeEdit', 'launchTrial']);

type Point = [number, number];
type Arrival = { interval: number; visited: string[] };
type State = { epoch: number; launched: boolean; arrivals: Arrival[]; launchRef: string | null;
  edited: Point | null; editRef: string | null; replayed: boolean };
type Strategy = keyof typeof sharedArrivalStrategies;
type Proposal = NativeProposal & { strategy: Strategy; grid: ConfiguredScene['grid']; actors: ConfiguredScene['actors']; receiver: Point;
  edit: Point | null; needId: string };
const empty = (epoch = 0): State => ({ epoch, launched: false, arrivals: [], launchRef: null, edited: null, editRef: null, replayed: false });
const order: readonly Point[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const key = (p: NativePoint) => p.join(',');
const distance = (a: NativePoint, b: NativePoint) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
const neighborhood = ([x, y]: NativePoint): NativeBox => [x - 1, y - 1, x + 1, y + 1];
const equal = (values: readonly number[]) => values.length > 1 && values.every(value => value === values[0]);
const routeLengths = (scene: ConfiguredScene, without?: Point) => {
  const nodes = new Set(scene.base);
  if (without) nodes.delete(key(without));
  return scene.actors.map(([, x, y]) => (configuredRoute(nodes, [x, y], scene.target, order, scene.grid[0])?.length ?? 0) - 1);
};

function observeApproaches(proposal: Proposal, frames: readonly NativeRows[]): Arrival[] {
  const [pitch, left, top] = proposal.grid;
  const poses = frames.map(configuredCrosses);
  return proposal.actors.flatMap(([color, x, y]) => {
    const visited = new Set<string>();
    let current: Point = [x, y], lastIndex = 0;
    for (const [index, components] of poses.entries()) {
      const matches = components.filter(([value, ax, ay]) => value === color && ax % pitch === left && ay % pitch === top);
      if (matches.length !== 1) continue;
      const [, ax, ay] = matches[0]!, next: Point = [ax, ay];
      if (distance(current, next) !== pitch) continue;
      visited.add(key(next));
      current = next;
      lastIndex = index;
      if (distance(current, proposal.receiver) <= pitch) break;
    }
    return visited.size >= 2 && distance(current, proposal.receiver) <= pitch ? [{ interval: lastIndex, visited: [...visited] }] : [];
  });
}

export function createSicSharedArrival(): NativeFamily<Proposal> {
  let state = empty();
  return {
    id: sharedArrivalId,
    async propose(observation, rows, inputs, remaining) {
      const local = state.epoch === observation.level_epoch ? state : empty(observation.level_epoch);
      const launch = inputs.find(input => input.action_ref === 'ACTION5');
      if (!launch || remaining < 1 || local.replayed || !observation.available_action_refs.includes('ACTION6')) return null;
      const scene = configuredScene(rows);
      if (!scene || scene.actors.length !== 2 || !scene.candidates.length || scene.candidates.length > 8) return null;
      const lengths = routeLengths(scene);
      if (lengths.some(length => length < 1)) return null;
      const differentApproaches = local.arrivals.length === scene.actors.length && !equal(local.arrivals.map(arrival => arrival.interval));
      const candidates = differentApproaches
        ? scene.candidates.filter(point => scene.base.has(key(point)) && local.arrivals.some(a => a.visited.includes(key(point)))
          && equal(routeLengths(scene, point))) : [];
      const edit = !local.edited && !equal(lengths) && candidates.length === 1 ? candidates[0]! : null;
      const command: NativeCommand = edit ? { action_ref: 'ACTION6', data: { x: edit[0], y: edit[1] } } : launch;
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...(local.launchRef ? [local.launchRef] : []), ...(local.editRef ? [local.editRef] : [])];
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active', facts: {
        equalRoutes: { value: !!local.editRef && equal(lengths), evidence },
        routeEdit: { value: !!edit, evidence },
        launchTrial: { value: !local.launched, evidence },
      }, planners: { observe_launch: () => command, test_route_edit: () => command, launch_after_route_edit: () => command } });
      if (!selected) return null;
      const strategy = selected.id, label = sharedArrivalStrategies[strategy], objective = 'G_official_completion';
      const goal = { kind: 'test_shared_receiver_arrival', scope: ref.split(':revision:', 1)[0]!, subjects: [key(scene.target)],
        parentObjective: objective, satisfactionContract: 'observe_official_progress_at_shared_receiver' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `shared-arrival:${need.id}`, actions = [command];
      const binding = edit ? await ObservedInputDomain.makeLocusWitness(observation, rows, edit, { reason: label, evidence }) : null;
      return { status: 'proposed', kind: sharedArrivalId, actions, strategy, grid: scene.grid, actors: scene.actors,
        receiver: scene.target, edit, needId: need.id,
        steps: [{ action: command, expected_after: null, ...(binding ? { point_binding: binding } : {}) }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Find how both pieces can reach the common receiver',
          mode: strategy === 'launch_after_route_edit' ? 'solving' : 'exploration',
          situation: edit ? `Current route lengths are ${lengths.join(' and ')}. Test the marked cell that could make them equal.` : label,
          agenda: entries, evidence, subjects: [...scene.actors.map(([, x, y]) => neighborhood([x, y])), neighborhood(scene.target),
            ...(edit ? [neighborhood(edit)] : [])] },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${objective}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent: objective }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: objective, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'shared_receiver_scope_bound' : 'shared_receiver_scope_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      const scored = after.levels_completed > before.levels_completed;
      const scene = proposal.edit && !scored ? configuredScene(second, proposal.grid) : null;
      const matched = proposal.edit && !scored ? !!scene && !scene.base.has(key(proposal.edit)) && equal(routeLengths(scene)) : null;
      return { matched, seal_prefix: true, reason: scored ? 'official_boundary' : matched === false ? 'local_route_edit_contradicted'
        : 'observe_route_or_arrival_return', ...(scored ? { sic_need: { id: proposal.needId, status: 'satisfied' } } : {}) };
    },
    record(before, after, _command, _first, second, proposal, _index, frames) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      if (state.epoch !== before.level_epoch) state = empty(before.level_epoch);
      if (proposal.strategy === 'observe_launch') {
        state.launched = true;
        state.arrivals = observeApproaches(proposal, frames);
        if (state.arrivals.length === proposal.actors.length) state.launchRef = after.observation_ref;
      } else if (proposal.edit) {
        state.edited = proposal.edit;
        const scene = configuredScene(second, proposal.grid);
        if (scene && !scene.base.has(key(proposal.edit)) && equal(routeLengths(scene))) state.editRef = after.observation_ref;
      } else state.replayed = true;
      return { events: [] };
    },
    state: () => ({ ...state }),
    restore(value: NativeRecord) { state = structuredClone(value as State); },
  };
}

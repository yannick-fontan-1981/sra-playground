import { configuredCrosses, configuredRoute, configuredScene, type ConfiguredScene } from '../logos-engine/v6-configured-arrivals.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { choosePreparedConfiguration, preparedConfigurationFacts, preparedConfigurationModule } from './prepared-configuration-card.ts';
import { sicNeedId } from './need-identity.ts';
import { measureArrivalTiming, planTimedArrival, timedNetwork, type ArrivalTiming } from './shared-arrival-timing.ts';

export const sharedArrivalId = 'sic_shared_arrival';
export const verifySharedArrivalId = 'sic_verify_shared_arrival_configuration';
export const sharedArrivalStrategies = {
  observe_launch: 'Observe how the pieces travel after launch',
  test_route_edit: 'Test a route edit that could bring arrival times together',
  test_projected_arrivals: 'Test whether the edited routes synchronize arrivals',
  launch_after_route_edit: 'Test the edited route with equal projected lengths',
} as const;

type Point = [number, number];
type Arrival = { interval: number; visited: string[] };
type State = { epoch: number; launched: boolean; arrivals: Arrival[]; launchRef: string | null;
  edited: Point | null; editRef: string | null; replayed: boolean; timing?: ArrivalTiming };
type Strategy = keyof typeof sharedArrivalStrategies;
type Proposal = NativeProposal & { strategy: Strategy; grid: ConfiguredScene['grid']; actors: ConfiguredScene['actors']; receiver: Point;
  edit: Point | null; needId: string; timed: boolean };
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

function confirmedGateEdit(proposal: Proposal, first: NativeRows, second: NativeRows): boolean {
  const before = configuredScene(first, proposal.grid), after = configuredScene(second, proposal.grid);
  if (!before || !after || !proposal.edit || key(before.target) !== key(after.target)
    || JSON.stringify(before.actors) !== JSON.stringify(after.actors)) return false;
  const former = timedNetwork(before), current = timedNetwork(after);
  if (!former || !current) return false;
  const changed = key(proposal.edit);
  return former.gates.some(gate => key(gate.point) === changed)
    && former.gates.length === current.gates.length && former.gates.every((gate, index) => {
    const next = current.gates[index]!;
    const position = key(gate.point);
    return key(next.point) === position && next.open === (position === changed ? !gate.open : gate.open);
  }) && [...former.nodes].every(node => current.nodes.has(node) || node === changed)
    && [...current.nodes].every(node => former.nodes.has(node) || node === changed)
    && current.pads.size === former.pads.size && [...former.pads].every(([cell, mark]) => current.pads.get(cell) === mark);
}

export function createSicVerifySharedArrival(): NativeFamily<Proposal> {
  let state = empty();
  let decide: NativeProgramHandle | undefined;
  return {
    id: verifySharedArrivalId,
    async attachPrograms(registry) {
      decide = await registry.registerProgram(choosePreparedConfiguration, {}, await preparedConfigurationModule());
    },
    async propose(observation, rows, inputs, remaining, execution) {
      const local = state.epoch === observation.level_epoch ? state : empty(observation.level_epoch);
      const launch = inputs.find(input => input.action_ref === 'ACTION5');
      if (!launch || remaining < 1 || local.replayed || !observation.available_action_refs.includes('ACTION6')) return null;
      const scene = configuredScene(rows);
      if (!scene) return null;
      const timed = timedNetwork(scene);
      if (!timed && (scene.actors.length !== 2 || !scene.candidates.length || scene.candidates.length > 8)) return null;
      const lengths = timed ? [] : routeLengths(scene);
      if (lengths.some(length => length < 1)) return null;
      const differentApproaches = local.arrivals.length === scene.actors.length && !equal(local.arrivals.map(arrival => arrival.interval));
      const candidates = differentApproaches
        ? scene.candidates.filter(point => scene.base.has(key(point)) && local.arrivals.some(a => a.visited.includes(key(point)))
          && equal(routeLengths(scene, point))) : [];
      const timedPlan = timed && local.timing ? planTimedArrival(scene, timed, local.timing, remaining) : null;
      const edit = timed ? timedPlan?.edits[0]?.point ?? null
        : !local.edited && !equal(lengths) && candidates.length === 1 ? candidates[0]! : null;
      const command: NativeCommand = edit ? { action_ref: 'ACTION6', data: { x: edit[0], y: edit[1] } } : launch;
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...(local.launchRef ? [local.launchRef] : []), ...(local.editRef ? [local.editRef] : [])];
      const verifyTiming = !!timedPlan && timedPlan.edits.length === 0;
      const ready = timed ? verifyTiming && timedPlan.matchingOrders === local.timing?.orders.length : !!local.editRef && equal(lengths);
      const phase = ready ? 'launch_after_route_edit' : edit ? 'test_route_edit' : verifyTiming ? 'test_projected_arrivals'
        : !local.launched ? 'observe_launch' : null;
      if (!phase) return null;
      const mode = execution?.reasoningMode ?? (ready ? 'solving' : 'exploration');
      const facts = preparedConfigurationFacts(mode, { readyWithKnownApplication: ready, pendingWithUntestedEdit: !!edit,
        needsApplicationObservation: !local.launched || (verifyTiming && !ready) });
      const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
      const strategy = ready ? 'P02' : 'P05';
      if (decision?.result !== strategy) return null;
      const label = timed && ready ? 'Launch with coincident projected arrival times' : sharedArrivalStrategies[phase];
      const condition = timed && timedPlan && local.timing
        ? `Observed arrivals at ticks ${local.timing.observed.join(', ')}. After ${timedPlan.edits.length} gate edits, ${timedPlan.matchingOrders} of ${local.timing.orders.length} compatible route orders predict a shared arrival at tick ${timedPlan.ticks.join(' or ')} including measured pauses.`
        : edit ? `Current route lengths are ${lengths.join(' and ')}. Test the marked cell that could make them equal.` : label;
      const objective = 'G_official_completion';
      const goal = { kind: 'test_shared_receiver_arrival', scope: ref.split(':revision:', 1)[0]!, subjects: [key(scene.target)],
        parentObjective: objective, satisfactionContract: 'observe_official_progress_at_shared_receiver' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `shared-arrival:${need.id}`, actions = [command];
      const binding = edit ? await ObservedInputDomain.makeLocusWitness(observation, rows, edit, { reason: label, evidence }) : null;
      return { status: 'proposed', kind: verifySharedArrivalId, actions, strategy: phase, grid: scene.grid, actors: scene.actors,
        receiver: scene.target, edit, needId: need.id, timed: !!timed,
        steps: [{ action: command, expected_after: null, ...(binding ? { point_binding: binding } : {}) }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: facts },
        sicSituationCard: { strategy, need: timed ? 'Synchronize arrivals at the common receiver' : 'Find how both pieces can reach the common receiver', mode,
          situation: condition,
          agenda: [], evidence, triggerCard: decision.receipt.workflow,
          subjects: [...scene.actors.map(([, x, y]) => neighborhood([x, y])), neighborhood(scene.target),
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
    after(proposal, _index, before, after, first, second) {
      const scored = after.levels_completed > before.levels_completed;
      const scene = proposal.edit && !scored && !proposal.timed ? configuredScene(second, proposal.grid) : null;
      const matched = proposal.edit && !scored ? proposal.timed ? confirmedGateEdit(proposal, first, second)
        : !!scene && !scene.base.has(key(proposal.edit)) && equal(routeLengths(scene)) : null;
      return { matched, seal_prefix: true, reason: scored ? 'official_boundary' : matched === false ? 'local_route_edit_contradicted'
        : 'observe_route_or_arrival_return', ...(scored ? { sic_need: { id: proposal.needId, status: 'satisfied' } } : {}) };
    },
    record(before, after, _command, first, second, proposal, _index, frames) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      if (state.epoch !== before.level_epoch) state = empty(before.level_epoch);
      if (proposal.strategy === 'observe_launch' || proposal.strategy === 'test_projected_arrivals') {
        state.launched = true;
        if (proposal.timed) {
          const scene = configuredScene(first, proposal.grid);
          const network = scene && timedNetwork(scene);
          const timing = scene && network && measureArrivalTiming(scene, network, frames);
          if (timing && state.timing) {
            const previous = state.timing;
            const valid = timing.orders.filter(order => previous.orders.some(candidate => String(candidate) === String(order)));
            if (valid.length < previous.orders.length && valid.length > 0) {
              state.timing = { ...timing, orders: valid, delays: { ...previous.delays, ...timing.delays } };
            } else delete state.timing;
          } else if (timing) state.timing = timing;
          else delete state.timing;
          if (state.timing) {
            state.launchRef = after.observation_ref;
          }
        } else {
          state.arrivals = observeApproaches(proposal, frames);
          if (state.arrivals.length === proposal.actors.length) state.launchRef = after.observation_ref;
        }
      } else if (proposal.edit) {
        if (proposal.timed) {
          if (confirmedGateEdit(proposal, first, second)) state.editRef = after.observation_ref;
          else delete state.timing;
        } else {
          state.edited = proposal.edit;
          const scene = configuredScene(second, proposal.grid);
          if (scene && !scene.base.has(key(proposal.edit)) && equal(routeLengths(scene))) state.editRef = after.observation_ref;
        }
      } else state.replayed = true;
      return { events: [] };
    },
    state: () => ({ ...state }),
    restore(value: NativeRecord) { state = structuredClone(value as State); },
  };
}

import { compareUnicode } from '../logos-engine/canonical.ts';
import {
  decodeReflectedWorld, encodeReflectedWorld, initializeReflectedWorld, matchesReflectedWorld,
  measureReflectedLattice, reflectCoverPoints, reflectedFocus, shiftReflectionPoints, solveReflectedPlacement,
} from '../logos-engine/v6-reflected-cover.ts';
import { sortedPoints, supportKey } from '../logos-engine/v6-support-measurements.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const reflectedPlacementId = 'sic_reflected_placement';
export const reflectedPlacementStrategies = {
  test_reflected_displacement: 'Test a direction and compare the piece with its reflection',
  select_reflected_contributor: 'Select the piece or axis that still needs to move',
  place_reflected_contributor: 'Move the selected piece or axis toward the cover',
} as const;

const graph = compileStrategyGraph({
  id: 'cover_targets_with_correlated_reflections', version: 1, order: 'FALLBACK',
  priorities: ['place_reflected_contributor', 'select_reflected_contributor', 'test_reflected_displacement'],
  strategies: {
    place_reflected_contributor: [{ fact: 'move', expected: true, label: 'The reflected layout predicts how a measured displacement reduces the remaining gap' }],
    select_reflected_contributor: [{ fact: 'select', expected: true, label: 'A different piece or axis must move to reach the candidate cover' }],
    test_reflected_displacement: [{ fact: 'test', expected: true, label: 'A direction can be tested on the current selection to measure movement and reflected changes' }],
  },
}, ['move', 'select', 'test']);

type Owner = number | 'axis' | null;
type World = {
  pitch: number; phase: NativePoint; nx: number; ny: number; axis: number; dim: 0 | 1; axis_color: number;
  direct: number; image: number; target: number; marker_value: number; focus: Owner; bodies: Set<string>[]; targets: Set<string>;
};
type Scene = { axis: number; cells: Map<string, number>; families: Map<number, Set<string>> };
type Control = { action: string; role: 'axis' | 'piece'; delta: NativePoint };
type State = { epoch: number; world: NativeRecord; controls: Control[]; tested: string[]; evidence: string[]; stopped: boolean };
type Plan = { action: NativeCommand; after: NativeRecord | null; attempt: string };
type Proposal = NativeProposal & { local: State; plan: Plan; needId: string };
const plain = (action_ref: string): NativeCommand => ({ action_ref, data: {} });
const role = (owner: Owner) => owner === 'axis' ? 'axis' : 'piece';
const at = (world: World, [x, y]: NativePoint): NativePoint => [
  world.phase[0] + x * world.pitch + Math.floor(world.pitch / 2),
  world.phase[1] + y * world.pitch + Math.floor(world.pitch / 2),
];
const point = (p: readonly number[]): NativePoint => [p[0]!, p[1]!];

function box(world: World, cells: Set<string>): NativeBox | null {
  if (!cells.size) return null;
  const points = sortedPoints(cells).map(p => at(world, point(p)));
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]), half = Math.floor(world.pitch / 2);
  return [Math.min(...xs) - half, Math.min(...ys) - half, Math.max(...xs) - half + world.pitch - 1, Math.max(...ys) - half + world.pitch - 1];
}

function moveWorld(world: World, owner: Owner, delta: NativePoint): World {
  const next = { ...world, bodies: [...world.bodies] };
  if (owner === 'axis') next.axis += delta[world.dim];
  else if (owner !== null) next.bodies[owner] = shiftReflectionPoints(world.bodies[owner]!, [...delta]);
  return next;
}

function measureChange(world: World, scene: Scene): { world: World; delta: NativePoint } | null {
  const owner = world.focus;
  const offsets = new Map<string, NativePoint>([['[0,0]', [0, 0]]]);
  if (owner === 'axis') {
    const amount = scene.axis - world.axis;
    const d: NativePoint = world.dim === 0 ? [amount, 0] : [0, amount];
    offsets.set(supportKey(d), d);
  } else if (owner !== null) {
    const observed = sortedPoints(scene.families.get(world.direct) ?? new Set()).map(point);
    const body = sortedPoints(world.bodies[owner]!).map(point);
    for (const [x, y] of observed) for (const [px, py] of body) {
      const delta: NativePoint = [x - px, y - py];
      offsets.set(supportKey(delta), delta);
    }
  }
  const fits = [...offsets.values()].flatMap(delta => {
    const next = moveWorld(world, owner, delta);
    return matchesReflectedWorld(next, scene) ? [{ world: next, delta }] : [];
  });
  if (fits.length !== 1) return null;
  const result = fits[0]!;
  result.world.focus = reflectedFocus(result.world, scene, result.delta.some(Boolean)) as Owner;
  return result;
}

function coveragePlan(world: World, scene: Scene, controls: readonly Control[], keys: readonly string[], canPoint: boolean): { move: Plan | null; select: Plan | null } {
  const solution = solveReflectedPlacement(world, controls.some(control => control.role === 'axis'));
  if (!solution) return { move: null, select: null };
  const [, axis, deltas] = solution as [unknown, number, NativePoint[]];
  const unfinished = deltas.flatMap((delta, i) => delta.some(Boolean) ? [i] : []);
  const desired = axis !== world.axis ? 'axis' : typeof world.focus === 'number' && unfinished.includes(world.focus) ? world.focus : unfinished[0];
  if (desired === undefined) return { move: null, select: null };
  if (world.focus !== desired) {
    const cells = desired === 'axis'
      ? new Set([...scene.cells].flatMap(([key, value]) => value === world.axis_color && JSON.parse(key)[world.dim] === world.axis ? [key] : []))
      : new Set([...world.bodies[desired]!].filter(key => scene.cells.get(key) === world.direct));
    const locus = sortedPoints(cells)[0];
    if (!canPoint || !locus) return { move: null, select: null };
    const [x, y] = at(world, point(locus));
    return { move: null, select: { action: { action_ref: 'ACTION6', data: { x, y } }, after: null, attempt: JSON.stringify([world.focus, x, y]) } };
  }
  const delta = desired === 'axis' ? (world.dim === 0 ? [axis - world.axis, 0] : [0, axis - world.axis]) : deltas[desired]!;
  const dim = delta[0] ? 0 : 1, kind = role(desired), amount = delta[dim]!;
  const control = controls.filter(c => keys.includes(c.action) && (c.role === kind || c.role === 'piece')
    && c.delta[1 - dim] === 0 && c.delta[dim]! * amount > 0 && Math.abs(c.delta[dim]!) <= Math.abs(amount))
    .sort((a, b) => Number(a.role !== kind) - Number(b.role !== kind) || compareUnicode(a.action, b.action))[0];
  return { select: null, move: control ? { action: plain(control.action), after: encodeReflectedWorld(moveWorld(world, desired, control.delta)),
    attempt: JSON.stringify([world.focus, control.action]) } : null };
}

export function createSicReflectedPlacement(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: reflectedPlacementId,
    async propose(observation, rows, _inputs, remaining) {
      const keys = observation.available_action_refs.filter(action => ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4'].includes(action));
      if (remaining < 1 || keys.length < 2 || !rows.length) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      if (prior?.stopped || (prior?.tested.length ?? 0) >= 72) return null;
      const retained = prior ? decodeReflectedWorld(prior.world) as World : null;
      const scene = measureReflectedLattice(rows, retained) as Scene | null;
      if (!scene) return null;
      const world = retained ?? initializeReflectedWorld(scene) as World | null;
      if (!world || world.bodies.length > 5 || world.targets.size > 40 || !matchesReflectedWorld(world, scene)) return null;
      world.focus = reflectedFocus(world, scene, true) as Owner;
      const local: State = prior ? { ...prior, world: encodeReflectedWorld(world) } : {
        epoch: observation.level_epoch, world: encodeReflectedWorld(world), controls: [], tested: [], evidence: [], stopped: false,
      };
      const ref = observation.observation_ref;
      const known = local.controls.filter(control => control.role === 'piece');
      const spansAxes = known.some(c => c.delta[0] !== 0) && known.some(c => c.delta[1] !== 0);
      const { move, select } = spansAxes ? coveragePlan(world, scene, local.controls, keys, observation.available_action_refs.includes('ACTION6')) : { move: null, select: null };
      const attempt = (key: string) => JSON.stringify([world.focus, observation.frame_hash, key]);
      const probe = world.focus === null ? null : keys.find(key => !local.tested.includes(attempt(key))
        && !local.controls.some(control => control.role === role(world.focus) && control.action === key));
      const evidence: [string, ...string[]] = [ref, ...local.evidence.filter(value => value !== ref)];
      const eligibleSelection = select && !local.tested.includes(select.attempt) ? select : null;
      const { selected, entries } = resolveStrategyGraph({
        graph, mode: 'active',
        facts: { move: { value: !!move, evidence }, select: { value: !!eligibleSelection, evidence }, test: { value: !!probe, evidence } },
        planners: { place_reflected_contributor: () => move, select_reflected_contributor: () => eligibleSelection,
          test_reflected_displacement: () => probe ? { action: plain(probe), after: null, attempt: attempt(probe) } : null },
      });
      if (!selected) return null;
      const strategy = selected.id, plan: Plan = selected.plan, label = reflectedPlacementStrategies[strategy], parent = 'G_official_completion';
      const objective = { kind: 'cover_targets_with_correlated_reflections', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['current_piece', 'reflected_piece', 'target_cells'], parentObjective: parent,
        satisfactionContract: 'official_progress_after_observed_reflected_coverage' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = 'reflected-placement:' + need.id, actions = [plan.action];
      const { x, y } = plan.action.data;
      const binding = x !== undefined && y !== undefined ? await ObservedInputDomain.makeLocusWitness(observation, rows, [x, y], { reason: label, evidence }) : null;
      if (plan.action.action_ref === 'ACTION6' && !binding) return null;
      const body = typeof world.focus === 'number' ? world.bodies[world.focus]! : null;
      return { status: 'proposed', kind: reflectedPlacementId, actions, local, plan, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        steps: [{ action: plan.action, expected_after: plan.after, ...(binding ? { point_binding: binding } : {}) }],
        sicSituationCard: { strategy, need: 'Cover the marked cells with pieces and their reflected copies', situation: label, evidence, agenda: entries,
          mode: plan.after ? 'solving' : 'exploration', body: body ? box(world, body) : null,
          reflection: body ? box(world, reflectCoverPoints(body, world.axis, world.dim)) : null, target: box(world, world.targets) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'current_pieces_and_mirror_bound' : 'pieces_or_mirror_context_changed' };
    },
    after(proposal, _index, before, after, _first, rows) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const expected = proposal.plan.after && decodeReflectedWorld(proposal.plan.after) as World | null;
      const scene = expected ? measureReflectedLattice(rows, expected) : null;
      const matched = expected ? matchesReflectedWorld(expected, scene) && reflectedFocus(expected, scene!, true) === expected.focus : null;
      return { matched, seal_prefix: true, reason: 'compare_reflected_placement_return' };
    },
    record(before, after, command, _first, rows, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, plan } = proposal, world = decodeReflectedWorld(local.world) as World;
      const scene = measureReflectedLattice(rows, world) as Scene | null;
      const change = scene && measureChange(world, scene);
      const controls = [...local.controls];
      if (change && change.delta.some(Boolean)) {
        const owner = role(world.focus);
        const index = controls.findIndex(c => c.action === command.action_ref && c.role === owner);
        controls.splice(index < 0 ? controls.length : index, index < 0 ? 0 : 1, { action: command.action_ref, role: owner, delta: change.delta });
      }
      state = { ...local, world: change ? encodeReflectedWorld(change.world) : local.world, controls,
        evidence: [...local.evidence.slice(-4), after.observation_ref], tested: [...local.tested, plan.attempt], stopped: !change };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}

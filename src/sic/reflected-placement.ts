import { compareUnicode } from '../logos-engine/canonical.ts';
import {
  decodeReflectedWorld, encodeReflectedWorld, initializeReflectedWorld, matchesReflectedWorld,
  measureReflectedLattice, reflectCoverPoints, reflectedFocus, shiftReflectionPoints, solveReflectedPlacement,
} from '../logos-engine/v6-reflected-cover.ts';
import { sortedPoints, supportKey, supportPoint } from '../logos-engine/v6-support-measurements.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { maximumCommittedActions } from './plan-step.ts';
import { sicNeedId } from './need-identity.ts';
import type { DirectionalMotion } from './observed-translation.ts';
import { checkObservedMotion, chooseObservedMotion, observedMotionModule } from './reflected-motion-card.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const reflectedPlacementId = 'sic_reflected_placement';
export const coordinateObservedMotionId = 'sic_coordinate_observed_motion';
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
  markerOffset?: NativePoint;
};
type Scene = { axis: number; cells: Map<string, number>; families: Map<number, Set<string>>; mark_values: Map<string, number> };
type Control = { action: string; role: 'axis' | 'piece'; delta: NativePoint };
type Strategy = keyof typeof reflectedPlacementStrategies;
type State = { epoch: number; world: NativeRecord; controls: Control[]; tested: string[]; evidence: string[]; stopped: boolean; recalled?: boolean };
type Transfer = { epoch: number; direct: number; image: number; marker: number; pitch: number; controls: Control[]; evidence: string[] };
type Plan = { action: NativeCommand; after: NativeRecord | null; attempt: string; selection?: Exclude<Owner, null>;
  route?: readonly NativeRecord[] };
type Proposal = NativeProposal & { local: State; plan: Plan; needId: string };
const plain = (action_ref: string): NativeCommand => ({ action_ref, data: {} });
const role = (owner: Owner) => owner === 'axis' ? 'axis' : 'piece';
const at = (world: World, [x, y]: NativePoint): NativePoint => [
  world.phase[0] + x * world.pitch + Math.floor(world.pitch / 2),
  world.phase[1] + y * world.pitch + Math.floor(world.pitch / 2),
];
const point = (p: readonly number[]): NativePoint => [p[0]!, p[1]!];

function visibleMarkerOffset(world: World, scene: Scene, rows: NativeRows): NativePoint | null {
  const focus = reflectedFocus(world, scene) as Owner;
  if (focus === null) return null;
  const offsets = new Map<string, NativePoint>();
  for (const [key, value] of scene.mark_values) {
    const [x, y] = supportPoint(key);
    const selected = focus === 'axis' ? [x, y][world.dim] === world.axis && scene.cells.get(key) === world.axis_color
      : world.bodies[focus]!.has(key) && scene.cells.get(key) === world.direct;
    if (!selected || value !== world.marker_value) continue;
    const left = world.phase[0] + x! * world.pitch, top = world.phase[1] + y! * world.pitch;
    for (let dy = 0; dy < world.pitch; dy++) for (let dx = 0; dx < world.pitch; dx++) {
      if (rows[top + dy]![left + dx] !== value) continue;
      const offset: NativePoint = [dx, dy];
      offsets.set(supportKey(offset), offset);
    }
  }
  return offsets.size === 1 ? offsets.values().next().value! : null;
}

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
  const offsets = new Map<string, NativePoint>([[supportKey([0, 0]), [0, 0]]]);
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

function reconcileOccludedMotion(world: World, rows: NativeRows, controls: readonly Control[]) {
  if (typeof world.focus !== 'number') return null;
  const measured = new Map<string, NativePoint>();
  for (const { role, delta } of controls) {
    if (role !== 'piece') continue;
    measured.set(supportKey(delta), delta);
    const opposite: NativePoint = [-delta[0], -delta[1]];
    measured.set(supportKey(opposite), opposite);
  }
  const matches = [];
  for (const delta of measured.values()) {
    const next = moveWorld(world, world.focus, delta);
    const scene = measureReflectedLattice(rows, next, true) as Scene | null;
    if (!scene || !matchesReflectedWorld(next, scene) || reflectedFocus(next, scene, true) !== world.focus) continue;
    matches.push({ world: next, delta });
  }
  return matches.length === 1 ? matches[0]! : null;
}

function acquireControl(world: World, motion: DirectionalMotion | null): Control | null {
  if (!motion || typeof world.focus !== 'number') return null;
  const body = world.bodies[world.focus]!;
  const piece = box(world, body);
  const reflection = box(world, reflectCoverPoints(body, world.axis, world.dim));
  if (!piece || !reflection) return null;
  const within = (inner: NativeBox, outer: NativeBox) =>
    inner[0] >= outer[0] && inner[1] >= outer[1] && inner[2] <= outer[2] && inner[3] <= outer[3];
  const direct = motion.translations.filter(part => part.color === world.direct && within(part.to, piece));
  const images = motion.translations.filter(part => part.color === world.image && within(part.to, reflection));
  if (direct.length !== 1 || images.length !== 1) return null;
  const displacement = direct[0]!.displacement;
  if (!displacement.some(Boolean) || displacement.some(value => value % world.pitch !== 0) ||
    !images[0]!.displacement.every((value, axis) => value === displacement[axis]! * (axis === world.dim ? -1 : 1))) return null;
  return { action: motion.command, role: 'piece', delta: [displacement[0] / world.pitch, displacement[1] / world.pitch] };
}

function coveragePlan(world: World, scene: Scene, local: State, keys: readonly string[], available: readonly string[],
  attempt: (action: string) => string, remaining: number): { move: Plan | null; select: Plan | null } {
  const { controls, recalled, tested } = local;
  const solution = solveReflectedPlacement(world, controls.some(control => control.role === 'axis') || !!recalled && world.focus === 'axis');
  if (!solution) return { move: null, select: null };
  const [, axis, deltas] = solution as [unknown, number, NativePoint[]];
  const unfinished = deltas.flatMap((delta, i) => delta.some(Boolean) ? [i] : []);
  const desired = axis !== world.axis ? 'axis' : typeof world.focus === 'number' && unfinished.includes(world.focus) ? world.focus : unfinished[0];
  if (desired === undefined) return { move: null, select: null };
  if (world.focus !== desired) {
    const pulse = JSON.stringify([world.focus, desired, 'ACTION5']);
    if (recalled && available.includes('ACTION5') && !tested.includes(pulse)) {
      return { move: null, select: { action: plain('ACTION5'), after: null, attempt: pulse, selection: desired } };
    }
    const cells = desired === 'axis'
      ? new Set([...scene.cells].flatMap(([key, value]) => value === world.axis_color && supportPoint(key)[world.dim] === world.axis ? [key] : []))
      : new Set([...world.bodies[desired]!].filter(key => scene.cells.get(key) === world.direct));
    const locus = sortedPoints(cells)[0];
    if (!available.includes('ACTION6') || !locus) return { move: null, select: null };
    const [x, y] = at(world, point(locus));
    return { move: null, select: { action: { action_ref: 'ACTION6', data: { x, y } }, after: null, attempt: JSON.stringify([world.focus, x, y]) } };
  }
  const delta = desired === 'axis' ? (world.dim === 0 ? [axis - world.axis, 0] : [0, axis - world.axis]) : deltas[desired]!;
  const dim = delta[0] ? 0 : 1, kind = role(desired), amount = delta[dim]!;
  const control = controls.filter(c => keys.includes(c.action) && (c.role === kind || c.role === 'piece')
    && (!recalled || !tested.includes(attempt(c.action)))
    && c.delta[1 - dim] === 0 && c.delta[dim]! * amount > 0 && Math.abs(c.delta[dim]!) <= Math.abs(amount))
    .sort((a, b) => Number(a.role !== kind) - Number(b.role !== kind) || compareUnicode(a.action, b.action))[0];
  if (!control) return { select: null, move: null };
  const first = moveWorld(world, desired, control.delta);
  const route = [encodeReflectedWorld(first)];
  if (typeof desired === 'number' && control.role === kind) {
    let next = first;
    const count = Math.min(remaining, maximumCommittedActions, Math.floor(Math.abs(amount / control.delta[dim])));
    for (let i = 1; i < count; i++) {
      next = moveWorld(next, desired, control.delta);
      const body = next.bodies[desired]!;
      const footprints = [box(next, body), box(next, reflectCoverPoints(body, next.axis, next.dim))];
      if (footprints.some(footprint => !footprint || footprint[0] < 0 || footprint[1] < 0 || footprint[2] > 63 || footprint[3] > 63)) break;
      route.push(encodeReflectedWorld(next));
    }
  }
  return { select: null, move: { action: plain(control.action), after: route[0]!, ...(route.length > 1 ? { route } : {}),
    attempt: recalled ? attempt(control.action) : JSON.stringify([world.focus, control.action]) } };
}

export function createSicReflectedPlacement(family = reflectedPlacementId): NativeFamily<Proposal> {
  const declarative = family === coordinateObservedMotionId;
  let state: State | null = null;
  let transfer: Transfer | null = null;
  let choose: NativeProgramHandle | undefined;
  let verify: NativeProgramHandle | undefined;
  return {
    id: family,
    async attachPrograms(registry) {
      if (!declarative) return;
      const module = await observedMotionModule();
      choose = await registry.registerProgram(chooseObservedMotion, {}, module);
      verify = await registry.registerProgram(checkObservedMotion, {}, module);
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      const keys = observation.available_action_refs.filter(action => ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4'].includes(action));
      if (remaining < 1 || keys.length < 2 || !rows.length) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      const recalled = transfer?.epoch === observation.level_epoch - 1 ? transfer : null;
      if (declarative && (!choose || (!prior && !recalled && !execution?.readDirectionalMotion))) return null;
      if (prior?.stopped || (prior?.tested.length ?? 0) >= 72) return null;
      const retained = prior ? decodeReflectedWorld(prior.world) as World : null;
      const scene = measureReflectedLattice(rows, retained, true) as Scene | null;
      if (!scene) return null;
      const world = retained ?? initializeReflectedWorld(scene, recalled?.direct, recalled?.marker, recalled?.image) as World | null;
      if (!world || world.bodies.length > 5 || world.targets.size > 40 || !matchesReflectedWorld(world, scene)) return null;
      world.focus = reflectedFocus(world, scene, true) as Owner;
      const markerOffset = visibleMarkerOffset(world, scene, rows);
      if (markerOffset) world.markerOffset = markerOffset;
      const revalidated = recalled && world.pitch === recalled.pitch && world.direct === recalled.direct && world.image === recalled.image
        && world.marker_value === recalled.marker && world.focus !== null ? recalled : null;
      const motion = declarative && !prior ? execution?.readDirectionalMotion?.() ?? null : null;
      const acquired = motion?.afterRef === observation.observation_ref && motion.levelEpoch === observation.level_epoch
        ? acquireControl(world, motion) : null;
      if (declarative && !prior && !acquired && !revalidated) return null;
      const local: State = prior ? { ...prior, world: encodeReflectedWorld(world) } : {
        epoch: observation.level_epoch, world: encodeReflectedWorld(world), controls: revalidated?.controls ?? (acquired ? [acquired] : []),
        tested: [], evidence: revalidated?.evidence ?? (acquired && motion ? [motion.beforeRef] : []), stopped: false,
        ...(revalidated ? { recalled: true } : {}),
      };
      const ref = observation.observation_ref;
      const known = local.controls.filter(control => control.role === 'piece');
      const spansAxes = known.some(c => c.delta[0] !== 0) && known.some(c => c.delta[1] !== 0);
      const attempt = (key: string) => JSON.stringify([world.focus, observation.frame_hash, key]);
      const { move, select } = spansAxes ? coveragePlan(world, scene, local, keys, observation.available_action_refs, attempt, remaining)
        : { move: null, select: null };
      const probe = world.focus === null ? null : keys.find(key => !local.tested.includes(attempt(key))
        && !local.controls.some(control => control.role === role(world.focus) && control.action === key));
      const evidence: [string, ...string[]] = [ref, ...local.evidence.filter(value => value !== ref)];
      const eligibleSelection = select && !local.tested.includes(select.attempt) ? select : null;
      const choices: Record<Strategy, Plan | null> = { place_reflected_contributor: move, select_reflected_contributor: eligibleSelection,
        test_reflected_displacement: probe ? { action: plain(probe), after: null, attempt: attempt(probe) } : null };
      const situation = { move: !!move, select: !!eligibleSelection, test: !!probe, measuredDirections: known.length,
        mode: execution?.reasoningMode ?? 'exploration' };
      const decision = declarative ? await choose?.run({ situation }, { signal: execution?.signal }) : null;
      const evaluated = declarative ? null : resolveStrategyGraph({
        graph, mode: 'active',
        facts: { move: { value: situation.move, evidence }, select: { value: situation.select, evidence }, test: { value: situation.test, evidence } },
        planners: { place_reflected_contributor: () => move, select_reflected_contributor: () => eligibleSelection,
          test_reflected_displacement: () => choices.test_reflected_displacement },
      });
      const requested = decision?.result ?? evaluated?.selected?.id;
      if (typeof requested !== 'string' || !Object.hasOwn(choices, requested)) return null;
      const strategy = requested as Strategy, plan = choices[strategy];
      if (!plan) return null;
      const label = plan.selection !== undefined ? 'Test whether the pulse transfers control while the pieces stay in place'
        : plan.after && local.recalled ? world.focus === 'axis'
          ? 'Move the axis and check that the reflected piece approaches the target'
          : 'Move the selected piece while preserving the axis setting'
          : reflectedPlacementStrategies[strategy];
      const parent = 'G_official_completion';
      const objective = { kind: 'cover_targets_with_correlated_reflections', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['current_piece', 'reflected_piece', 'target_cells'], parentObjective: parent,
        satisfactionContract: 'official_progress_after_observed_reflected_coverage' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = 'reflected-placement:' + need.id, actions = plan.route ? plan.route.map(() => plan.action) : [plan.action];
      const { x, y } = plan.action.data;
      const binding = x !== undefined && y !== undefined ? await ObservedInputDomain.makeLocusWitness(observation, rows, [x, y], { reason: label, evidence }) : null;
      if (plan.action.action_ref === 'ACTION6' && !binding) return null;
      const body = typeof world.focus === 'number' ? world.bodies[world.focus]!
        : local.recalled && world.focus === 'axis' && world.bodies.length === 1 ? world.bodies[0]! : null;
      const activeAxis = local.recalled && world.focus === 'axis'
        ? box(world, new Set([...scene.cells].filter(([, value]) => value === world.axis_color).map(([cell]) => cell))) : null;
      return { status: 'proposed', kind: family, actions, local, plan, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        steps: plan.route ? plan.route.map(expected_after => ({ action: plan.action, expected_after }))
          : [{ action: plan.action, expected_after: plan.after, ...(binding ? { point_binding: binding } : {}) }],
        ...(decision ? { sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation } } : {}),
        sicSituationCard: { strategy, need: 'Cover the marked cells with pieces and their reflected copies', situation: label, evidence,
          agenda: evaluated?.entries ?? [],
          mode: plan.after ? 'solving' : 'exploration', body: body ? box(world, body) : null, axis: activeAxis,
          reflection: body ? box(world, reflectCoverPoints(body, world.axis, world.dim)) : null, target: box(world, world.targets) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, packet, observation) {
      if (index > 0 && proposal.plan.route) {
        const expected = decodeReflectedWorld(proposal.plan.route[index - 1]!) as World;
        const scene = measureReflectedLattice(packet.frame_rows, expected, true);
        const admitted = proposal.binding?.level_epoch === observation.level_epoch && matchesReflectedWorld(expected, scene)
          && reflectedFocus(expected, scene!, true) === expected.focus;
        return { admitted, reason: admitted ? 'projected_reflected_scene_still_visible' : 'reflected_route_changed' };
      }
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'current_pieces_and_mirror_bound' : 'pieces_or_mirror_context_changed' };
    },
    async after(proposal, index, before, after, _first, rows) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const selection = proposal.plan.selection;
      const next = proposal.plan.route?.[index] ?? proposal.plan.after;
      const expected = selection === undefined ? next && decodeReflectedWorld(next) as World | null
        : { ...decodeReflectedWorld(proposal.local.world), focus: selection } as World;
      const scene = expected ? measureReflectedLattice(rows, expected, true) : null;
      const matched = expected ? matchesReflectedWorld(expected, scene) && reflectedFocus(expected, scene!, selection === undefined) === expected.focus : null;
      if (verify) {
        const checked = await verify.run({ outcome: { matched } });
        return { matched: typeof checked.result === 'boolean' ? checked.result : null,
          seal_prefix: checked.result !== true || index + 1 >= proposal.actions.length,
          reason: selection === undefined ? 'compare_reflected_placement_return' : 'compare_focus_without_displacement',
          src_check: { workflow: checked.receipt.workflow, hash: checked.receipt.src_hash, matched } };
      }
      return { matched, seal_prefix: !matched || index + 1 >= proposal.actions.length,
        reason: selection === undefined ? 'compare_reflected_placement_return' : 'compare_focus_without_displacement' };
    },
    record(before, after, command, _first, rows, proposal, index) {
      const local = index > 0 && state?.epoch === proposal.local.epoch ? state : proposal.local;
      const { plan } = proposal, world = decodeReflectedWorld(local.world) as World;
      if (after.levels_completed > before.levels_completed) {
        transfer = { epoch: before.level_epoch, direct: world.direct, image: world.image, marker: world.marker_value,
          pitch: world.pitch, controls: local.controls.filter(control => control.role === 'piece'),
          evidence: [before.observation_ref, after.observation_ref] };
        return { events: [], reviewEvidence: 'The reflected pieces covered the target and advanced the level.' };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const scene = measureReflectedLattice(rows, world, true) as Scene | null;
      const directional = ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4'].includes(command.action_ref);
      const change = scene ? measureChange(world, scene)
        : local.recalled && directional ? reconcileOccludedMotion(world, rows, local.controls) : null;
      const controls = [...local.controls];
      if (change && change.delta.some(Boolean)) {
        const owner = role(world.focus);
        const index = controls.findIndex(c => c.action === command.action_ref && c.role === owner);
        controls.splice(index < 0 ? controls.length : index, index < 0 ? 0 : 1, { action: command.action_ref, role: owner, delta: change.delta });
      }
      state = { ...local, world: change ? encodeReflectedWorld(change.world) : local.world, controls,
        evidence: [...new Set([...local.evidence.slice(-4), ...(local.recalled ? transfer?.evidence ?? [] : []), after.observation_ref])],
        tested: [...local.tested, index === 0 ? plan.attempt : local.recalled
          ? JSON.stringify([world.focus, before.frame_hash, command.action_ref]) : JSON.stringify([world.focus, command.action_ref])],
        stopped: !change };
      return { events: [] };
    },
    state: () => ({ state, transfer }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as State | null);
      transfer = structuredClone(value.transfer as Transfer | null) ?? null;
    },
  };
}

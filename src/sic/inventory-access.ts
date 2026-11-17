import { provisional_scenes } from '../logos-engine/v6-inventory-initial.ts';
import { world_complements, transferred_shape, display_matches } from '../logos-engine/v6-inventory-contrast.ts';
import { complements, current_goal_witnesses, revalidate } from '../logos-engine/v6-inventory-boundary.ts';
import { _unique_action_conditioned_control_centered_grid_candidate, box, patch } from '../logos-engine/v6-inventory-measurements.ts';
import type { NativeBox, NativeFamily, NativeObservation, NativeProgramHandle, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { maximumCommittedActions } from './plan-step.ts';
import { navigationPrimitives } from './navigation-primitives.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { observedMechanicsGroup } from './strategy-agenda.ts';
import { planInventoryRoute, slotContents, type InventoryPosition, type InventoryRouteStep } from './inventory-route-plan.ts';
import { inventoryPositionMatches, readInventoryReserve, readInventoryRoute, reusableKeyAt, verifyInventoryReturn,
  type InventoryEvidence, type InventoryRouteScene } from './inventory-route-observation.ts';

export const inventoryAccessId = 'sic_inventory_access';
export const verifyInventoryTransferId = 'sic_verify_inventory_transfer';
export const learnInventoryTransferId = 'sic_learn_inventory_transfer';
export const inventoryAccessStrategies = navigationPrimitives;
const situations = {
  approach_inventory_source: 'Approach the object whose shape matches a blocked passage',
  test_inventory_transfer: 'Test whether the nearby object transfers into the display',
  test_complementary_passage: 'Use the displayed object to test the matching passage',
  reach_reserve_candidate: 'Approach an object that may replenish the declining reserve',
  reuse_inventory_transfer: 'Test the observed transfer command on another object',
  approach_distinct_inventory_goal: 'Approach the distinct marked destination',
  recall_compatible_passage: 'Match the last confirmed object shape to the passage while the display is masked',
  approach_recalled_destination: 'Follow the route opened by the confirmed use of the object',
} as const;

type Cell = { at: NativePoint; box: NativeBox; values: number[]; frequency: number; original: NativeRows };
type Meter = { x: number; y: number; value: number; length: number };
type Link = { source: NativePoint; gate: NativePoint; color: number };
type Scene = { grid: Cell[]; signature: string; travel: number[]; start: NativePoint; link: Link; goal: NativePoint };
type EmptySlot = { bounds: NativeBox; pixels: NativeRows; evidence: string };
type Boundary = InventoryEvidence & { epoch: number; receipt: NativeRecord; meter: Meter };
type Need = 'source' | 'passage' | 'reserve' | 'reuse' | 'goal';
type State = { epoch: number; scene: Scene; passageObserved: boolean; reserveRestored: boolean; anotherTransferObserved: boolean;
  controls: Record<string, NativePoint>; tested: string[];
  visited: string[]; receipt: NativeRecord | null; meter: Meter | null; transfer: string | null; evidence: string[];
  count: number; stopped: boolean; emptySlot?: EmptySlot; recalled?: Boundary; recharge?: number };
type Choice = { input: string; target: Cell; expected: NativePoint | null; interaction: boolean; need: Need };
type InventoryWalk = { input: string; here: NativePoint; destination: Cell; pixels: NativeRows };
type LegacyProposal = NativeProposal & { local: State; choice: Choice; actor: NativeBox; here: NativePoint; walk?: InventoryWalk[]; needId: string };
type RouteState = { epoch: number; scene: InventoryRouteScene; position: InventoryPosition; route: InventoryRouteStep[];
  evidence: string[]; depositProven: boolean; retentionEvidence?: Record<number, string>; stopped: boolean };
type RouteProposal = NativeProposal & { routeState: RouteState; next: InventoryRouteStep; needId: string };
type Proposal = LegacyProposal | RouteProposal;
const isRoute = (proposal: Proposal): proposal is RouteProposal => 'routeState' in proposal;
const directions: Record<string, NativePoint> = { ACTION1: [-1, 0], ACTION2: [1, 0], ACTION3: [0, -1], ACTION4: [0, 1] };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const key = (p: NativePoint) => p.join(',');
const add = (a: NativePoint, b: NativePoint): NativePoint => [a[0] + b[0], a[1] + b[1]];
const negative = ([y, x]: NativePoint): NativePoint => [-y, -x];
const inside = ([l, t, r, b]: NativeBox, [x, y, u, v]: NativeBox) => l <= x && t <= y && u <= r && v <= b;
const extent = (box: NativeBox): NativePoint => [box[2] - box[0], box[3] - box[1]];
const center = ([l, t, r, b]: NativeBox): NativePoint => [Math.floor((l + r) / 2), Math.floor((t + b) / 2)];
const includeAll = (values: readonly number[], sample: readonly number[]) => sample.every(value => values.includes(value));
const cellAt = (scene: Scene, box: NativeBox) => scene.grid.find(cell => inside(cell.box, box));

function gridCells(grid: { cells: readonly { row: number; col: number;
  bbox: { left: number; top: number; right: number; bottom: number }; palette_values: number[]; pattern_occurrence_count: number }[] },
rows: NativeRows): Cell[] {
  return grid.cells.map(cell => {
    const bounds: NativeBox = [cell.bbox.left, cell.bbox.top, cell.bbox.right, cell.bbox.bottom];
    return { at: [cell.row, cell.col], box: bounds, values: cell.palette_values,
      frequency: cell.pattern_occurrence_count, original: patch(rows, bounds) };
  });
}

function initialScene(observation: Parameters<NativeFamily['propose']>[0], rows: NativeRows): Scene | null {
  const options = provisional_scenes(observation, rows).flatMap(scene => {
    const grid = scene.grids[0];
    const actor = scene.body as NativeBox;
    if (!grid || grid.cell_width <= actor[2] - actor[0] + 1 || grid.cells.length > 196) return [];
    const links = world_complements(scene, rows);
    if (links.length !== 1) return [];
    const match = links[0]!;
    const cells = gridCells(grid as Parameters<typeof gridCells>[0], rows);
    const ordinary = cells.filter(cell => cell.values.length === 2 && cell.frequency >= 4).sort((a, b) => b.frequency - a.frequency)[0];
    const start = cells.find(cell => inside(cell.box, actor));
    if (!ordinary || !start) return [];
    const [width, height] = extent(actor), [x, y] = center(actor);
    const peers = cells.filter(cell => !same(cell.at, start.at) && !same(cell.at, match.target_cell)
      && !includeAll(cell.values, ordinary.values) && cell.values.some(value => ordinary.values.includes(value))
      && observation.entities.some(entity => !same(actor, entity.bbox) && entity.area === 2 * (width + height)
        && same(extent(entity.bbox), [width, height]) && same(center(entity.bbox), center(cell.box))
        && entity.mask.every(([dx, dy]) => dx === 0 || dy === 0 || dx === width || dy === height)));
    if (peers.length !== 1) return [];
    const result: Scene = { grid: cells, signature: scene.body_signature,
      travel: ordinary.values, start: start.at, goal: peers[0]!.at,
      link: { source: match.source_cell, gate: match.target_cell, color: match.source_value } };
    const access = path(result, start.at, result.link.source, [], false);
    return access?.length ? [{ result, distance: access.length, start: [y, x] }] : [];
  }).sort((a, b) => a.distance - b.distance || a.start[0]! - b.start[0]! || a.start[1]! - b.start[1]!);
  return options[0]?.result ?? null;
}

function path(scene: Scene, from: NativePoint, to: NativePoint, unavailable: readonly string[], crossed: boolean): NativePoint[] | null {
  const open = new Set(scene.grid.filter(cell => includeAll(cell.values, scene.travel) || same(cell.at, scene.start)
    || crossed && same(cell.at, scene.link.gate)).map(cell => key(cell.at)));
  const queue = [{ at: from, steps: [] as NativePoint[] }], visited = new Set([key(from)]);
  for (const { at, steps } of queue) {
    if (same(at, to)) return steps;
    for (const direction of Object.values(directions)) {
      const next = add(at, direction), nextKey = key(next);
      if (visited.has(nextKey) || unavailable.includes(key(at) + '>' + nextKey) || !open.has(nextKey) && !same(next, to)) continue;
      visited.add(nextKey);
      queue.push({ at: next, steps: [...steps, direction] });
    }
  }
  return null;
}

function slotLooksOccupied(memory: Boundary, observation: NativeObservation, rows: NativeRows): boolean {
  return revalidate({ active: true, target_epoch: memory.epoch, old_control_signature: memory.actor,
    source_receipt: memory.receipt, absence_pattern: memory.slot.pixels,
    evidence: [memory.slot.evidence, memory.before, memory.after], alternatives: [] }, observation, rows, [])
    .status === 'revalidated_hypothesis';
}

function recalledScene(memory: Boundary, observation: NativeObservation, rows: NativeRows): Scene | null {
  if (!slotLooksOccupied(memory, observation, rows)) return null;
  const actor = observation.entities.find(entity => entity.signature === memory.actor);
  if (!actor) return null;
  const grid = _unique_action_conditioned_control_centered_grid_candidate({ frame: rows,
    canonical_provisional_control_geometry_bboxes: [box(actor.bbox)] }, memory.pitch);
  if (!grid) return null;
  const measured = { grids: [grid], body_signature: memory.actor, level_epoch: observation.level_epoch,
    observation_ref: observation.observation_ref };
  const gates = complements(measured, rows, memory.receipt);
  if (gates.length !== 1) return null;
  const gate: NativePoint = [gates[0]!.target_row, gates[0]!.target_col];
  const goals = current_goal_witnesses(measured, rows, [{ role: memory.actor, boundary_before: memory.before,
    boundary_after: memory.after, scoring_pattern: memory.scoredPattern }]);
  const cells = gridCells(grid as Parameters<typeof gridCells>[0], rows);
  const start = cells.find(cell => inside(cell.box, actor.bbox));
  if (!start) return null;
  const possible = goals.flatMap(witness => {
    const goal = witness.current_cell as NativePoint;
    const scene: Scene = { grid: cells, signature: memory.actor, travel: memory.travel, start: start.at, goal,
      link: { source: start.at, gate, color: gates[0]!.source_value } };
    const approach = path(scene, start.at, gate, [], false);
    const continuation = path(scene, gate, goal, [], true);
    if (!approach?.length || !continuation?.length || path(scene, start.at, goal, [], false)) return [];
    return [{ scene, cost: approach.length + continuation.length }];
  });
  if (possible.length !== 1) return null;
  const meter = capturedMeter(rows, rows, memory.meter, actor.bbox, actor.bbox);
  return meter && meter.length >= possible[0]!.cost ? possible[0]!.scene : null;
}

function capturedMeter(first: NativeRows, second: NativeRows, original: Meter | null, actor: NativeBox, moved: NativeBox): Meter | null {
  const count = (rows: NativeRows, x: number, y: number, value: number) => readInventoryReserve(rows, { x, y, value });
  if (original) return { ...original, length: count(second, original.x, original.y, original.value) };
  const candidates: Meter[] = [];
  for (let y = 0; y < first.length; y++) {
    if (Math.min(y, first.length - y - 1) > 3 || y >= Math.min(actor[1], moved[1]) && y <= Math.max(actor[3], moved[3])) continue;
    for (let x = 0; x < first[y]!.length;) {
      const value = first[y]![x]!, length = count(first, x, y, value), next = count(second, x, y, value);
      if (length >= 5 && length - next === 1) candidates.push({ x, y, value, length: next });
      x += length;
    }
  }
  return candidates.length === 1 ? candidates[0]! : null;
}

function commandFor(wanted: NativePoint, state: State, available: readonly string[], here: NativePoint): string | null {
  const tried = (input: string) => state.tested.includes(key(here) + ':' + input);
  const observed = available.find(input => same(state.controls[input], wanted));
  if (observed) return observed;
  const hint = available.find(input => !state.controls[input] && same(directions[input], wanted) && !tried(input));
  return hint ?? available.find(input => !state.controls[input] && !tried(input)) ?? null;
}

export function createSicVerifyInventoryTransfer(family = verifyInventoryTransferId): NativeFamily<Proposal> {
  const learns = family === learnInventoryTransferId;
  let state: State | null = null;
  let boundary: Boundary | null = null;
  let inventoryRoute: RouteState | null = null;
  let decide: NativeProgramHandle | undefined;
  async function offerRoute(observation: NativeObservation, rows: NativeRows, remaining: number,
    execution: Parameters<NativeFamily['propose']>[4]): Promise<RouteProposal | null> {
    if (remaining < 1 || observation.available_action_refs.includes('ACTION6')) return null;
    const previous = inventoryRoute?.epoch === observation.level_epoch ? inventoryRoute : null;
    if (previous?.stopped) return null;
    const measured = !previous && boundary?.epoch === observation.level_epoch ? readInventoryRoute(rows, observation, boundary) : null;
    const local: RouteState | null = previous ?? (measured && boundary ? { ...measured, epoch: observation.level_epoch, route: [],
      evidence: [boundary.slot.evidence, boundary.before, boundary.after], depositProven: false, stopped: false } : null);
    if (!local) return null;
    const { scene, position } = local;
    const actor = inventoryPositionMatches(scene, position, observation, rows);
    if (!actor || readInventoryReserve(rows, scene.meter) !== position.energy) return null;
    const route = local.route.length ? local.route : planInventoryRoute(scene.map, position, scene.moves, scene.interaction, remaining);
    const next = route?.[0];
    if (!next || !observation.available_action_refs.includes(next.input)) return null;
    const task = route!.find(step => step.kind !== 'walk') ?? next;
    const target = scene.boxes[task.position.at]!;
    const reusable = reusableKeyAt(scene, next);
    const retentionEvidence = reusable === null ? undefined : local.retentionEvidence?.[reusable];
    const testRetention = reusable !== null && !retentionEvidence;
    const interaction = next.kind === 'pick' || next.kind === 'deposit' || testRetention;
    const knownInteraction = next.kind === 'pick' || next.kind === 'deposit' && local.depositProven;
    const mode = execution?.reasoningMode ?? (knownInteraction || !interaction ? 'solving' : 'exploration');
    const facts = { routeSupported: !interaction, knownInteraction, eligibleProbe: interaction && !knownInteraction, mode };
    const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
    const strategy = interaction ? knownInteraction ? 'P02' : 'P05' : 'P07';
    if (decision?.result !== strategy) return null;
    const label = testRetention ? 'Test whether crossing the gate keeps the object in the inventory' : {
      walk: 'Continue toward the marked exit',
      pick: 'Collect the object needed for the remaining route',
      deposit: 'Reserve the carried object here so the slot can serve the earlier gate',
      unlock: reusable !== null ? 'Reuse the object that stayed in the inventory after opening the previous gate'
        : 'Use the object whose shape completes this gate',
      charge: 'Replenish the reserve before the remaining transfers',
      finish: 'Reach the exit through the opened route',
    }[task.kind];
    const ref = observation.observation_ref, parent = 'G_official_completion';
    const priorEvidence = retentionEvidence ? [...local.evidence, retentionEvidence] : local.evidence;
    const evidence: [string, ...string[]] = [ref, ...new Set(priorEvidence.filter(item => item !== ref))];
    const objective = { kind: scene.slots ? 'arrange_access_with_multiple_inventory_slots' : 'arrange_access_with_one_inventory_slot', scope: ref.split(':revision:', 1)[0]!,
      subjects: ['carrier', 'temporary_storage', 'complementary_passages', 'reserve'],
      parentObjective: parent, satisfactionContract: 'observe_official_progress_after_bounded_inventory_transfers' };
    const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
    const id = 'inventory-access:' + need.id, action = { action_ref: next.input, data: {} }, actions = [action];
    const meter = scene.meter, [l, t, r, b] = scene.slot.bounds;
    const display: NativeBox = [l, t, scene.slots?.at(-1)?.bounds[2] ?? r, b];
    return { status: 'proposed', kind: verifyInventoryTransferId, actions, routeState: { ...local, route: route! }, next, needId: need.id,
      binding: { observation_ref: ref, level_epoch: observation.level_epoch },
      steps: [{ action, expected_after: scene.map.nodes[next.position.at]!.at }],
      sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
        instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation: facts },
      sicSituationCard: { strategy, need: scene.slots ? 'Open the gates with the available inventory slots' : 'Open the gates in order with one inventory slot',
        evidence, agenda: [], mode, triggerCard: chooseLanding, situation: label, actor, target, display,
        reserve: position.energy > 0 ? [meter.x, meter.y, meter.x + position.energy - 1, meter.y] : null },
      question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
      compositions: [{ id, observed: false, open_question: label, relations: ['contributes_to:' + parent] }],
      sicLocalDecision: { strategy, objective: { id, label, parent }, need },
      bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
        preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
  }
  return {
    id: family,
    async attachPrograms(registry) {
      decide = await registry.registerProgram(chooseLanding, {}, await landingModule());
    },
    proposeInGroup(group, observation, rows, inputs, remaining, execution) {
      return group === observedMechanicsGroup ? offerRoute(observation, rows, remaining, execution)
        : this.propose(observation, rows, inputs, remaining, execution);
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      const ordered = await offerRoute(observation, rows, remaining, execution);
      if (ordered) return ordered;
      const available = Object.keys(directions).filter(input => observation.available_action_refs.includes(input));
      if (remaining < 1 || available.length !== 4 || !observation.available_action_refs.includes('ACTION5') || observation.available_action_refs.includes('ACTION6')) return null;
      const previous = state?.epoch === observation.level_epoch ? state : null;
      if (previous?.stopped || (previous?.count ?? 0) >= 52) return null;
      const memory = !previous && boundary?.epoch === observation.level_epoch ? boundary : null;
      const continued = memory && recalledScene(memory, observation, rows);
      const recalled = previous?.recalled ?? (continued ? memory! : undefined);
      const motion = learns && !previous && !recalled ? execution?.readPriorDirectionalScene?.((first, original) => {
        const scene = initialScene(original, first);
        if (!scene) return null;
        const old = original.entities.filter(entity => entity.signature === scene.signature);
        const moved = observation.entities.filter(entity => entity.signature === scene.signature);
        if (old.length !== 1 || moved.length !== 1) return null;
        const actor = old[0]!.bbox, arrival = moved[0]!.bbox;
        const from = cellAt(scene, actor), to = cellAt(scene, arrival);
        if (!from || !to || !same(to.at, scene.start) && !includeAll(to.values, scene.travel)) return null;
        const delta = add(to.at, negative(from.at));
        const distance = Math.abs(delta[0]) + Math.abs(delta[1]), meter = capturedMeter(first, rows, null, actor, arrival);
        if (distance > 1 || distance === 0 && (!meter || !same(actor, arrival))) return null;
        return { scene, delta, start: from.at, meter, translated: distance === 1 };
      }) : null;
      if (learns && !previous && !recalled && (!motion || !available.includes(motion.command)
        || motion.afterRef !== observation.observation_ref || motion.levelEpoch !== observation.level_epoch)) return null;
      const scene = previous?.scene ?? continued ?? motion?.scene.scene ?? initialScene(observation, rows);
      if (!scene) return null;
      const actors = observation.entities.filter(entity => entity.signature === scene.signature);
      if (actors.length !== 1) return null;
      const actor = actors[0]!.bbox, cell = cellAt(scene, actor);
      if (!cell) return null;
      const here = cell.at;
      const local: State = previous ?? { epoch: observation.level_epoch, scene, passageObserved: false, reserveRestored: false, anotherTransferObserved: false,
        controls: recalled?.controls ?? (motion?.scene.translated ? { [motion.command]: motion.scene.delta } : {}),
        tested: motion && !motion.scene.translated ? [key(here) + ':' + motion.command] : [],
        visited: [key(motion?.scene.start ?? scene.start), key(scene.link.source)], receipt: null,
        meter: recalled ? capturedMeter(rows, rows, recalled.meter, actor, actor) : motion?.scene.meter ?? null, transfer: null,
        evidence: recalled ? [recalled.slot.evidence, recalled.before, recalled.after] : motion ? [motion.beforeRef, motion.afterRef] : [],
        count: Number(!!motion), stopped: false,
        ...(recalled ? { recalled } : {}) };
      const rejected = local.tested.filter(value => value.includes('>'));
      const route = (to: NativePoint) => path(scene, here, to, rejected, local.passageObserved);
      const candidates = () => scene.grid.filter(candidate => includeAll(candidate.values, scene.travel) && candidate.values.length > scene.travel.length
        && !local.visited.includes(key(candidate.at))).map(target => ({ target, route: route(target.at) }))
        .filter((candidate): candidate is { target: Cell; route: NativePoint[] } => candidate.route !== null)
        .sort((a, b) => a.route.length - b.route.length);
      const carrying = local.receipt !== null && display_matches(local.receipt, rows);
      const unfinishedAccess = !local.passageObserved;
      const remainingObject = () => candidates()[0]?.target ?? null;
      const destination = (position: NativePoint) => scene.grid.find(cell => same(cell.at, position)) ?? null;
      const needs: { need: Need; target: () => Cell | null }[] = [];
      if (local.recalled) {
        if (unfinishedAccess && slotLooksOccupied(local.recalled, observation, rows)) {
          needs.push({ need: 'passage', target: () => destination(scene.link.gate) });
        }
        if (!unfinishedAccess) needs.push({ need: 'goal', target: () => destination(scene.goal) });
      } else if (unfinishedAccess) {
        if (!local.receipt) needs.push({ need: 'source', target: () => destination(scene.link.source) });
        if (carrying) needs.push({ need: 'passage', target: () => destination(scene.link.gate) });
      } else {
        if (local.meter && !local.reserveRestored) needs.push({ need: 'reserve', target: remainingObject });
        if (local.reserveRestored && local.transfer && !local.anotherTransferObserved) needs.push({ need: 'reuse', target: remainingObject });
        if (!local.meter || local.anotherTransferObserved) needs.push({ need: 'goal', target: () => destination(scene.goal) });
      }
      const task = needs.flatMap(({ need, target }) => {
        const candidate = target();
        return candidate ? [{ need, target: candidate }] : [];
      })[0];
      if (!task) return null;
      const { need: purpose, target } = task;
      const pathToTarget = route(target.at), wanted = pathToTarget?.[0];
      const interaction = same(here, target.at) && (purpose === 'source' || purpose === 'reuse');
      const mode = execution?.reasoningMode ?? 'exploration';
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...local.evidence.filter(r => r !== ref)];
      const input = interaction ? local.transfer ?? 'ACTION5' : wanted ? commandFor(wanted, local, available, here) : null;
      if (!input) return null;
      const known = local.controls[input];
      const inverse = wanted && available.find(key => same(local.controls[key], negative(wanted)));
      const expected = known ? add(here, known)
        : wanted && inverse && same(directions[input], wanted) ? add(here, wanted) : null;
      const routeSupported = !interaction && !!known;
      const knownInteraction = interaction && !!local.transfer;
      const facts = { routeSupported, knownInteraction, eligibleProbe: !known && !knownInteraction, mode };
      const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
      const strategy = routeSupported ? 'P07' : knownInteraction ? 'P02' : 'P05';
      if (decision?.result !== strategy) return null;
      const choice: Choice = { input, target, expected, interaction, need: purpose };
      const label = navigationPrimitives[strategy], parent = 'G_official_completion';
      const situation = local.recalled ? purpose === 'passage' ? situations.recall_compatible_passage : situations.approach_recalled_destination
        : purpose === 'source' ? interaction ? situations.test_inventory_transfer : situations.approach_inventory_source
        : purpose === 'passage' ? situations.test_complementary_passage
        : purpose === 'reserve' ? situations.reach_reserve_candidate
        : purpose === 'reuse' ? situations.reuse_inventory_transfer : situations.approach_distinct_inventory_goal;
      const objective = { kind: 'gain_access_with_observed_object_transfer', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['carrier', 'transferable_object', 'complementary_passage', 'reserve'], parentObjective: parent,
        satisfactionContract: 'official_progress_after_measured_access_and_continued_route' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = 'inventory-access:' + need.id, action = { action_ref: input, data: {} };
      const walk: InventoryWalk[] = [];
      let at = here;
      if (routeSupported && local.meter && !local.recalled) for (const delta of pathToTarget!.slice(0,
        Math.min(remaining, maximumCommittedActions, 52 - local.count, Math.max(0, local.meter.length - 1)))) {
        const input = available.find(input => same(local.controls[input], delta)), cell = destination(add(at, delta));
        if (!input || !cell || local.tested.includes(key(at) + '>' + key(cell.at))) break;
        walk.push({ input, here: at, destination: cell, pixels: patch(rows, cell.box) });
        at = cell.at;
      }
      const actions = walk.length > 1 ? walk.map(step => ({ action_ref: step.input, data: {} })) : [action];
      return { status: 'proposed', kind: family, actions, local, actor, choice, here, needId: need.id,
        ...(walk.length > 1 ? { walk } : {}),
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        steps: actions.map((action, index) => ({ action, expected_after: walk[index]?.destination.at ?? expected })),
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: facts },
        sicSituationCard: { strategy, need: 'Open the blocked route and reach the marked destination', evidence, agenda: [],
          mode, triggerCard: chooseLanding, situation,
          actor, target: target.box, display: local.recalled && !local.passageObserved ? local.recalled.slot.bounds : local.receipt?.display_bbox ?? null,
          reserve: local.meter && local.meter.length > 0 ? [local.meter.x, local.meter.y, local.meter.x + local.meter.length - 1, local.meter.y] : null },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, packet, observation) {
      if (index > 0 && !isRoute(proposal) && proposal.walk) {
        const { local } = proposal, { meter, scene, receipt } = local, step = proposal.walk[index]!;
        const carrier = observation.entities.find(entity => entity.signature === scene.signature);
        const admitted = local.epoch === observation.level_epoch && !!carrier && same(cellAt(scene, carrier.bbox)?.at, step.here)
          && same(patch(packet.frame_rows, step.destination.box), step.pixels)
          && !!meter && readInventoryReserve(packet.frame_rows, meter) === meter.length - index
          && (!receipt || display_matches(receipt, packet.frame_rows));
        return { admitted, reason: admitted ? 'carrier_landing_and_reserve_confirmed' : 'carrier_or_destination_changed' };
      }
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'current_carrier_and_destination_bound' : 'carrier_or_destination_changed' };
    },
    after(proposal, index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      if (isRoute(proposal)) {
        const { scene, position } = proposal.routeState;
        const observed = verifyInventoryReturn(scene, position, proposal.next, before, after, first, second);
        const reusable = reusableKeyAt(scene, proposal.next);
        const matched = !!observed && (reusable === null || slotContents(observed.held).includes(reusable));
        return { matched, seal_prefix: true, reason: matched ? reusable === null ? 'inventory_route_return_observed' : 'inventory_key_retained_after_unlock'
          : observed && reusable !== null ? 'inventory_key_consumed_after_unlock' : 'inventory_route_return_contradicted' };
      }
      const actor = after.entities.find(entity => entity.signature === proposal.local.scene.signature)?.bbox;
      const current = actor && cellAt(proposal.local.scene, actor);
      const expected = proposal.walk?.[index]?.destination.at ?? proposal.choice.expected;
      const matched = expected ? !!current && same(expected, current.at) : null;
      const recalled = proposal.local.recalled;
      if (recalled && matched && proposal.choice.need === 'passage' && same(current?.at, proposal.choice.target.at)) {
        const consumed = same(patch(second, recalled.slot.bounds), recalled.slot.pixels);
        return { matched: consumed, seal_prefix: true, reason: consumed ? 'recalled_object_used_at_matching_passage' : 'recalled_object_use_unconfirmed' };
      }
      const meter = proposal.local.meter;
      const stable = !!meter && readInventoryReserve(second, meter) === meter.length - index - 1;
      return { matched, seal_prefix: !matched || index + 1 >= proposal.actions.length || !stable,
        reason: 'compare_carrier_and_inventory_return' };
    },
    record(before, after, action, first, second, proposal, index) {
      if (isRoute(proposal)) {
        const { routeState: local, next } = proposal;
        if (after.levels_completed > before.levels_completed && next.kind === 'finish' && boundary?.epoch === before.level_epoch) {
          boundary = { ...boundary, epoch: after.level_epoch, before: before.observation_ref, after: after.observation_ref };
        }
        if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
        const position = verifyInventoryReturn(local.scene, local.position, next, before, after, first, second);
        const reusable = reusableKeyAt(local.scene, next);
        const retained = !!position && reusable !== null && slotContents(position.held).includes(reusable);
        const consumed = !!position && reusable !== null && !retained;
        const scene = consumed ? { ...local.scene, map: { ...local.scene.map,
          reusable: local.scene.map.reusable?.filter(key => key !== reusable) } } : local.scene;
        inventoryRoute = !position ? { ...local, stopped: true } : { ...local, scene, position,
          route: !consumed && position.energy === next.position.energy ? local.route.slice(1) : [],
          depositProven: local.depositProven || next.kind === 'deposit',
          ...(retained && !local.retentionEvidence?.[reusable] ? {
            retentionEvidence: { ...local.retentionEvidence, [reusable]: after.observation_ref },
          } : {}),
          evidence: [...local.evidence.slice(-5), after.observation_ref] };
        return { events: [] };
      }
      const local = (index > 0 && state?.epoch === before.level_epoch ? state : null) ?? proposal.local, scene = local.scene;
      const step = proposal.walk?.[index], here = step?.here ?? proposal.here;
      const actor = index > 0 ? before.entities.find(entity => entity.signature === scene.signature)?.bbox ?? proposal.actor : proposal.actor;
      const choice = step ? { ...proposal.choice, expected: step.destination.at } : proposal.choice;
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) {
        const { receipt, emptySlot, meter } = local;
        if (after.levels_completed > before.levels_completed && choice.need === 'goal' && receipt && emptySlot && meter
          && display_matches(receipt, first) && same(choice.expected, scene.goal)) {
          const pitch = choice.target.box[2] - choice.target.box[0] + 1;
          boundary = { epoch: after.level_epoch, actor: scene.signature, slot: emptySlot, receipt, pitch, travel: scene.travel,
            scoredPattern: choice.target.original.flat(), controls: local.controls, meter, before: before.observation_ref, after: after.observation_ref,
            ...(local.recharge ? { recharge: local.recharge } : {}), ...(local.transfer ? { interaction: local.transfer } : {}) };
        } else if (after.levels_completed > before.levels_completed && choice.need === 'goal' && local.recalled
          && local.passageObserved && same(choice.expected, scene.goal)) {
          boundary = { ...local.recalled, epoch: after.level_epoch, controls: local.controls, before: before.observation_ref, after: after.observation_ref };
        }
        return { events: [] };
      }
      const moved = after.entities.find(entity => entity.signature === scene.signature)?.bbox;
      const current = moved && cellAt(scene, moved);
      const meter = moved ? capturedMeter(first, second, local.meter, actor, moved) : local.meter;
      const next: State = { ...local, meter, count: local.count + 1,
        evidence: [...local.evidence.slice(-5), after.observation_ref], stopped: !current };
      if (!current) { state = next; return { events: [] }; }
      const delta: NativePoint = [current.at[0] - here[0], current.at[1] - here[1]];
      if (delta.some(Boolean)) next.controls = { ...local.controls, [action.action_ref]: delta };
      next.tested = [...local.tested, key(here) + ':' + action.action_ref];
      if (!delta.some(Boolean) && choice.expected) next.tested.push(key(here) + '>' + key(choice.expected));
      const arrived = same(current.at, choice.target.at);
      if (choice.interaction && arrived && moved) {
        const common = { body: actor, level_epoch: before.level_epoch };
        const transfer = transferred_shape(before, after, first, second, { ...common, observation_ref: before.observation_ref,
          retained_underlay_value_count: 1, underlay_evidence: { patch: current.original, cell_bbox: current.box, evidence: local.evidence } },
        { ...common, body: moved, observation_ref: after.observation_ref }, action);
        let matches = transfer.matches ?? [];
        if (choice.need === 'source') matches = matches.filter((candidate: NativeRecord) => candidate.source_value === scene.link.color);
        if (matches.length === 1) {
          next.receipt = matches[0]; next.transfer = action.action_ref;
          const bounds = matches[0]!.display_bbox as NativeBox;
          if (!next.emptySlot || !same(next.emptySlot.bounds, bounds)) {
            next.emptySlot = { bounds, pixels: patch(first, bounds), evidence: before.observation_ref };
          }
          if (choice.need === 'reuse') next.anotherTransferObserved = true;
        } else next.stopped = true;
      } else if (arrived && choice.need === 'passage') {
        next.passageObserved = !local.recalled || same(patch(second, local.recalled.slot.bounds), local.recalled.slot.pixels);
        next.stopped = !next.passageObserved;
      } else if (arrived && choice.need === 'reserve') {
        next.visited = [...local.visited, key(current.at)];
        next.reserveRestored = !!meter && !!local.meter && meter.length > local.meter.length;
        if (next.reserveRestored) next.recharge = meter!.length - local.meter!.length + 1;
      } else if (arrived && choice.need === 'goal') {
        next.stopped = true;
      }
      state = next;
      return { events: [] };
    },
    state: () => ({ state, ...(boundary ? { boundary } : {}), ...(inventoryRoute ? { inventoryRoute } : {}) }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as State | null);
      boundary = structuredClone((value.boundary as Boundary | undefined) ?? null);
      inventoryRoute = structuredClone((value.inventoryRoute as RouteState | undefined) ?? null);
    },
  };
}

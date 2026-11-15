import { provisional_scenes } from '../logos-engine/v6-inventory-initial.ts';
import { world_complements, transferred_shape, display_matches } from '../logos-engine/v6-inventory-contrast.ts';
import { complements, current_goal_witnesses, revalidate } from '../logos-engine/v6-inventory-boundary.ts';
import { _unique_action_conditioned_control_centered_grid_candidate, box, patch } from '../logos-engine/v6-inventory-measurements.ts';
import type { NativeBox, NativeFamily, NativeObservation, NativeProgramHandle, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { navigationPrimitives } from './navigation-primitives.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';

export const inventoryAccessId = 'sic_inventory_access';
export const verifyInventoryTransferId = 'sic_verify_inventory_transfer';
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
type Boundary = {
  epoch: number; actor: string; slot: EmptySlot; receipt: NativeRecord; pitch: number; travel: number[];
  scoredPattern: number[]; controls: State['controls']; meter: Meter; before: string; after: string;
};
type Need = 'source' | 'passage' | 'reserve' | 'reuse' | 'goal';
type State = { epoch: number; scene: Scene; passageObserved: boolean; reserveRestored: boolean; anotherTransferObserved: boolean;
  controls: Record<string, NativePoint>; tested: string[];
  visited: string[]; receipt: NativeRecord | null; meter: Meter | null; transfer: string | null; evidence: string[];
  count: number; stopped: boolean; emptySlot?: EmptySlot; recalled?: Boundary };
type Choice = { input: string; target: Cell; expected: NativePoint | null; interaction: boolean; need: Need };
type Proposal = NativeProposal & { local: State; choice: Choice; actor: NativeBox; here: NativePoint; needId: string };
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
  const count = (rows: NativeRows, x: number, y: number, value: number) => {
    let end = x;
    while (rows[y]?.[end] === value) end++;
    return end - x;
  };
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

export function createSicVerifyInventoryTransfer(): NativeFamily<Proposal> {
  let state: State | null = null;
  let boundary: Boundary | null = null;
  let decide: NativeProgramHandle | undefined;
  return {
    id: verifyInventoryTransferId,
    async attachPrograms(registry) {
      decide = await registry.registerProgram(chooseLanding, {}, await landingModule());
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      const available = Object.keys(directions).filter(input => observation.available_action_refs.includes(input));
      if (remaining < 1 || available.length !== 4 || !observation.available_action_refs.includes('ACTION5') || observation.available_action_refs.includes('ACTION6')) return null;
      const previous = state?.epoch === observation.level_epoch ? state : null;
      if (previous?.stopped || (previous?.count ?? 0) >= 52) return null;
      const memory = !previous && boundary?.epoch === observation.level_epoch ? boundary : null;
      const continued = memory && recalledScene(memory, observation, rows);
      const recalled = previous?.recalled ?? (continued ? memory! : undefined);
      const scene = previous?.scene ?? continued ?? initialScene(observation, rows);
      if (!scene) return null;
      const actors = observation.entities.filter(entity => entity.signature === scene.signature);
      if (actors.length !== 1) return null;
      const actor = actors[0]!.bbox, cell = cellAt(scene, actor);
      if (!cell) return null;
      const here = cell.at;
      const local: State = previous ?? { epoch: observation.level_epoch, scene, passageObserved: false, reserveRestored: false, anotherTransferObserved: false,
        controls: recalled?.controls ?? {}, tested: [],
        visited: [key(scene.start), key(scene.link.source)], receipt: null,
        meter: recalled ? capturedMeter(rows, rows, recalled.meter, actor, actor) : null, transfer: null,
        evidence: recalled ? [recalled.slot.evidence, recalled.before, recalled.after] : [], count: 0, stopped: false,
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
      const wanted = route(target.at)?.[0];
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
      const id = 'inventory-access:' + need.id, action = { action_ref: input, data: {} }, actions = [action];
      return { status: 'proposed', kind: verifyInventoryTransferId, actions, local, actor, choice, here, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, steps: [{ action, expected_after: expected }],
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
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'current_carrier_and_destination_bound' : 'carrier_or_destination_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const actor = after.entities.find(entity => entity.signature === proposal.local.scene.signature)?.bbox;
      const current = actor && cellAt(proposal.local.scene, actor);
      const matched = proposal.choice.expected ? !!current && same(proposal.choice.expected, current.at) : null;
      const recalled = proposal.local.recalled;
      if (recalled && matched && proposal.choice.need === 'passage' && same(current?.at, proposal.choice.target.at)) {
        const consumed = same(patch(second, recalled.slot.bounds), recalled.slot.pixels);
        return { matched: consumed, seal_prefix: true, reason: consumed ? 'recalled_object_used_at_matching_passage' : 'recalled_object_use_unconfirmed' };
      }
      return { matched, seal_prefix: true, reason: 'compare_carrier_and_inventory_return' };
    },
    record(before, after, action, first, second, proposal) {
      const { local, choice, actor, here } = proposal, scene = local.scene;
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) {
        const { receipt, emptySlot, meter } = local;
        if (after.levels_completed > before.levels_completed && choice.need === 'goal' && receipt && emptySlot && meter
          && display_matches(receipt, first) && same(choice.expected, scene.goal)) {
          const pitch = choice.target.box[2] - choice.target.box[0] + 1;
          boundary = { epoch: after.level_epoch, actor: scene.signature, slot: emptySlot, receipt, pitch, travel: scene.travel,
            scoredPattern: choice.target.original.flat(), controls: local.controls, meter, before: before.observation_ref, after: after.observation_ref };
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
      } else if (arrived && choice.need === 'goal') {
        next.stopped = true;
      }
      state = next;
      return { events: [] };
    },
    state: () => ({ state, ...(boundary ? { boundary } : {}) }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as State | null);
      boundary = structuredClone((value.boundary as Boundary | undefined) ?? null);
    },
  };
}

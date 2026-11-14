import { provisional_scenes } from '../logos-engine/v6-inventory-initial.ts';
import { world_complements, transferred_shape, display_matches } from '../logos-engine/v6-inventory-contrast.ts';
import { patch } from '../logos-engine/v6-inventory-measurements.ts';
import type { NativeBox, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const inventoryAccessId = 'sic_inventory_access';
export const inventoryAccessStrategies = {
  approach_inventory_source: 'Approach the object whose shape matches a blocked passage',
  test_inventory_transfer: 'Test whether the nearby object transfers into the display',
  test_complementary_passage: 'Use the displayed object to test the matching passage',
  reach_reserve_candidate: 'Approach an object that may replenish the declining reserve',
  reuse_inventory_transfer: 'Test the observed transfer command on another object',
  approach_distinct_inventory_goal: 'Approach the distinct marked destination',
} as const;

const graph = compileStrategyGraph({
  id: 'gain_access_with_observed_object_transfer', version: 1, order: 'FALLBACK',
  priorities: ['test_inventory_transfer', 'test_complementary_passage', 'reach_reserve_candidate',
    'reuse_inventory_transfer', 'approach_distinct_inventory_goal', 'approach_inventory_source'],
  strategies: {
    approach_inventory_source: [{ fact: 'source', expected: true, label: 'One visible object complements the shape of a passage' }],
    test_inventory_transfer: [{ fact: 'transfer', expected: true, label: 'The carrier is at the object and has an unmeasured interaction available' }],
    test_complementary_passage: [{ fact: 'passage', expected: true, label: 'The same outline disappeared from the source and appeared in the display' }],
    reach_reserve_candidate: [{ fact: 'reserve', expected: true, label: 'The reserve is declining and a distinct object on the route remains untested' }],
    reuse_inventory_transfer: [{ fact: 'reuse', expected: true, label: 'The carrier can approach and test a second object with the previously observed transfer command' }],
    approach_distinct_inventory_goal: [{ fact: 'goal', expected: true, label: 'The passage has been crossed and a distinct matching outline lies at a reachable destination' }],
  },
}, ['source', 'transfer', 'passage', 'reserve', 'reuse', 'goal']);

type Cell = { at: NativePoint; box: NativeBox; values: number[]; frequency: number; original: NativeRows };
type Meter = { x: number; y: number; value: number; length: number };
type Link = { source: NativePoint; gate: NativePoint; color: number };
type Scene = { grid: Cell[]; signature: string; travel: number[]; start: NativePoint; link: Link; goal: NativePoint };
type Phase = 'source' | 'passage' | 'reserve' | 'reuse' | 'goal';
type State = { epoch: number; scene: Scene; phase: Phase; controls: Record<string, NativePoint>; tested: string[];
  visited: string[]; receipt: NativeRecord | null; meter: Meter | null; transfer: string | null; evidence: string[]; count: number; stopped: boolean };
type Choice = { input: string; target: Cell; expected: NativePoint | null; interaction: boolean; phase: Phase };
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

function initialScene(observation: Parameters<NativeFamily['propose']>[0], rows: NativeRows): Scene | null {
  const options = provisional_scenes(observation, rows).flatMap(scene => {
    const grid = scene.grids[0];
    const actor = scene.body as NativeBox;
    if (!grid || grid.cell_width <= actor[2] - actor[0] + 1 || grid.cells.length > 196) return [];
    const links = world_complements(scene, rows);
    if (links.length !== 1) return [];
    const match = links[0]!;
    const cells: Cell[] = grid.cells.map((cell: { row: number; col: number; bbox: { left: number; top: number; right: number; bottom: number };
      palette_values: number[]; pattern_occurrence_count: number }) => ({ at: [cell.row, cell.col],
      box: [cell.bbox.left, cell.bbox.top, cell.bbox.right, cell.bbox.bottom], values: cell.palette_values, frequency: cell.pattern_occurrence_count,
      original: patch(rows, [cell.bbox.left, cell.bbox.top, cell.bbox.right, cell.bbox.bottom]) }));
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

export function createSicInventoryAccess(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: inventoryAccessId,
    propose(observation, rows, _inputs, remaining) {
      const available = Object.keys(directions).filter(input => observation.available_action_refs.includes(input));
      if (remaining < 1 || available.length !== 4 || !observation.available_action_refs.includes('ACTION5') || observation.available_action_refs.includes('ACTION6')) return null;
      const previous = state?.epoch === observation.level_epoch ? state : null;
      if (previous?.stopped || (previous?.count ?? 0) >= 52) return null;
      const scene = previous?.scene ?? initialScene(observation, rows);
      if (!scene) return null;
      const actors = observation.entities.filter(entity => entity.signature === scene.signature);
      if (actors.length !== 1) return null;
      const actor = actors[0]!.bbox, cell = cellAt(scene, actor);
      if (!cell) return null;
      const here = cell.at;
      const local: State = previous ?? { epoch: observation.level_epoch, scene, phase: 'source', controls: {}, tested: [],
        visited: [key(scene.start), key(scene.link.source)], receipt: null, meter: null, transfer: null, evidence: [], count: 0, stopped: false };
      const crossed = local.phase !== 'source' && local.phase !== 'passage';
      const rejected = local.tested.filter(value => value.includes('>'));
      const route = (to: NativePoint) => path(scene, here, to, rejected, crossed);
      const candidates = () => scene.grid.filter(candidate => includeAll(candidate.values, scene.travel) && candidate.values.length > scene.travel.length
        && !local.visited.includes(key(candidate.at))).map(target => ({ target, route: route(target.at) }))
        .filter((candidate): candidate is { target: Cell; route: NativePoint[] } => candidate.route !== null)
        .sort((a, b) => a.route.length - b.route.length);
      let phase = local.phase;
      if (phase === 'reserve' && !local.meter) phase = 'goal';
      if (phase === 'passage' && (!local.receipt || !display_matches(local.receipt, rows))) return null;
      const dynamic = phase === 'reserve' || phase === 'reuse' ? candidates()[0] : null;
      const target = dynamic?.target ?? scene.grid.find(candidate => same(candidate.at,
        phase === 'source' ? scene.link.source : phase === 'passage' ? scene.link.gate : phase === 'goal' ? scene.goal : null));
      if (!target) return null;
      const steps = dynamic?.route ?? route(target.at), wanted = steps?.[0];
      const interaction = same(here, target.at) && (phase === 'source' || phase === 'reuse');
      const input = interaction ? local.transfer ?? 'ACTION5' : wanted ? commandFor(wanted, local, available, here) : null;
      if (!input) return null;
      const known = local.controls[input], opposite = wanted ? available.find(key => same(local.controls[key], negative(wanted))) : null;
      const expected = known ? add(here, known) : wanted && opposite && same(directions[input], wanted) ? add(here, wanted) : null;
      const choice: Choice = { input, target, expected, interaction, phase };
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...local.evidence.filter(r => r !== ref)];
      const { selected, entries } = resolveStrategyGraph({
        graph, mode: 'active',
        facts: { source: { value: phase === 'source' && !interaction, evidence }, transfer: { value: phase === 'source' && interaction, evidence },
          passage: { value: phase === 'passage', evidence }, reserve: { value: phase === 'reserve', evidence },
          reuse: { value: phase === 'reuse', evidence }, goal: { value: phase === 'goal', evidence } },
        planners: { approach_inventory_source: () => choice, test_inventory_transfer: () => choice, test_complementary_passage: () => choice,
          reach_reserve_candidate: () => choice, reuse_inventory_transfer: () => choice, approach_distinct_inventory_goal: () => choice },
      });
      if (!selected) return null;
      const strategy = selected.id, label = inventoryAccessStrategies[strategy], parent = 'G_official_completion';
      const objective = { kind: 'gain_access_with_observed_object_transfer', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['carrier', 'transferable_object', 'complementary_passage', 'reserve'], parentObjective: parent,
        satisfactionContract: 'official_progress_after_measured_access_and_continued_route' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = 'inventory-access:' + need.id, action = { action_ref: input, data: {} }, actions = [action];
      return { status: 'proposed', kind: inventoryAccessId, actions, local, actor, choice, here, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, steps: [{ action, expected_after: expected }],
        sicSituationCard: { strategy, need: 'Open the blocked route and reach the marked destination', situation: label, evidence, agenda: entries,
          mode: ['goal', 'passage'].includes(phase) ? 'solving' : local.transfer ? 'assimilation' : 'exploration',
          actor, target: target.box, display: local.receipt?.display_bbox ?? null,
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
    after(proposal, _index, before, after) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const actor = after.entities.find(entity => entity.signature === proposal.local.scene.signature)?.bbox;
      const current = actor && cellAt(proposal.local.scene, actor);
      const matched = proposal.choice.expected ? !!current && same(proposal.choice.expected, current.at) : null;
      return { matched, seal_prefix: true, reason: 'compare_carrier_and_inventory_return' };
    },
    record(before, after, action, first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, choice, actor, here } = proposal, scene = local.scene;
      const moved = after.entities.find(entity => entity.signature === scene.signature)?.bbox;
      const current = moved && cellAt(scene, moved);
      const meter = moved ? capturedMeter(first, second, local.meter, actor, moved) : local.meter;
      const next: State = { ...local, phase: choice.phase, meter, count: local.count + 1,
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
        if (choice.phase === 'source') matches = matches.filter((candidate: NativeRecord) => candidate.source_value === scene.link.color);
        if (matches.length === 1) {
          next.receipt = matches[0]; next.transfer = action.action_ref;
          next.phase = choice.phase === 'source' ? 'passage' : 'goal';
        } else next.stopped = true;
      } else if (arrived && choice.phase === 'passage') {
        next.phase = 'reserve';
      } else if (arrived && choice.phase === 'reserve') {
        next.visited = [...local.visited, key(current.at)];
        next.phase = meter && local.meter && meter.length > local.meter.length ? 'reuse' : 'reserve';
      } else if (arrived && choice.phase === 'goal') {
        next.stopped = true;
      }
      state = next;
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}

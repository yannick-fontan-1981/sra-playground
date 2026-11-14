import { maximumInjectiveMatching } from '../logos-engine/v5-reference-population-calculus.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { measureReferencePopulation, referencePopulationCellKey, referencePopulationPaths, referencePopulationPoint,
  type ReferencePopulationCell } from '../logos-engine/v6-reference-population-observation.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const populationPlacementId = 'sic_population_placement';
export const populationPlacementStrategies = {
  select_unplaced_piece: 'Select a piece outside the reference positions',
  test_selected_displacement: 'Measure a direction for the selected piece',
  move_to_assigned_slot: 'Move toward a distinct position required by the reference',
} as const;
const graph = compileStrategyGraph({ id: 'place_distinct_pieces_by_reference', version: 1, order: 'FALLBACK',
  priorities: ['move_to_assigned_slot', 'test_selected_displacement', 'select_unplaced_piece'],
  strategies: {
    select_unplaced_piece: [{ fact: 'unselected', expected: true, label: 'An unplaced piece is available for selection' }],
    test_selected_displacement: [{ fact: 'canLearn', expected: true, label: 'A direction can be tested from this measured position' }],
    move_to_assigned_slot: [{ fact: 'assigned', expected: true, label: 'Measured directions give each remaining piece a distinct reachable target' }],
  },
}, ['unselected', 'canLearn', 'assigned']);

type Cell = ReferencePopulationCell;
type Scene = { q: number; offset: Cell; floor: Cell[]; zone_box: NativeBox; reference_box: NativeBox; reference_digest: string;
  target: [number, number, number][]; background: number; empty: number; border: number; population: number;
  bodies: { cell: Cell; appearance: number }[]; observed_marker_overlays?: number[][] };
type State = { epoch: number; scene: Scene; selection: Cell | null; active: boolean; controls: Record<string, { delta: Cell }>;
  tried: string[]; evidence: string[]; frame: string; stopped: boolean };
type Choice = { command: NativeCommand; cell: Cell; expected: Cell | null; slot: Cell | null };
type Proposal = NativeProposal & { local: State; choice: Choice; strategy: keyof typeof populationPlacementStrategies; needId: string };
const key = referencePopulationCellKey;
const cardinal = ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4'];
const distance = ([y, x]: Cell, [r, c]: Cell) => Math.abs(y - r) + Math.abs(x - c);
const cellBox = (scene: Scene, [row, col]: Cell): NativeBox => {
  const x = scene.offset[1] + col * scene.q, y = scene.offset[0] + row * scene.q;
  return [x, y, x + scene.q - 2, y + scene.q - 2];
};

function compareMovement({ local, choice }: Proposal, rows: NativeRows) {
  const next = measureReferencePopulation(rows, local.scene) as Scene | null;
  if (!next) return null;
  const occupied = new Set(local.scene.bodies.map(body => key(body.cell))), current = new Set(next.bodies.map(body => key(body.cell)));
  const gone = [...occupied].filter(cell => !current.has(cell)), added = next.bodies.filter(body => !occupied.has(key(body.cell)));
  if (!gone.length && !added.length) return { next, destination: null };
  if (gone.length !== 1 || gone[0] !== key(choice.cell) || added.length !== 1 || distance(choice.cell, added[0]!.cell) !== 1) return null;
  return { next, destination: added[0]!.cell };
}

function selectionScene(scene: Scene, cell: Cell, first: NativeRows, second: NativeRows) {
  const [l, t, r, b] = cellBox(scene, cell), changed: number[][] = [];
  for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) {
    const value = second[y]?.[x];
    if (value !== undefined && value !== first[y]?.[x]) changed.push([y - t, x - l, value]);
  }
  if (changed.length !== 1) return null;
  const overlays = [...(scene.observed_marker_overlays ?? []), changed[0]!];
  const next = measureReferencePopulation(second, { ...scene, observed_marker_overlays: overlays }) as Scene | null;
  return next && next.bodies.every((body, index) => key(body.cell) === key(scene.bodies[index]!.cell)) ? next : null;
}

export function createSicPopulationPlacement(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: populationPlacementId,
    async propose(observation, rows, _inputs, remaining) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const available = cardinal.filter(action => observation.available_action_refs.includes(action));
      if (!available.length) return null;
      const prior = state?.epoch === observation.level_epoch && state.frame === observation.frame_hash ? state : null;
      if (prior?.stopped || (prior?.tried.length ?? 0) >= 20) return null;
      const scene = prior?.scene ?? (measureReferencePopulation(rows) as Scene | null);
      if (!scene || scene.floor.length > 256 || scene.population > 8) return null;
      const local = prior ?? { epoch: observation.level_epoch, scene, selection: null, active: false, controls: {},
        tried: [], evidence: [], frame: observation.frame_hash, stopped: false };
      const targets = scene.target.map(([y, x]): Cell => [y, x]), occupied = new Set(scene.bodies.map(body => key(body.cell)));
      const unsettled = scene.bodies.map(body => body.cell).filter(cell => targets.every(target => key(target) !== key(cell)));
      const empty = targets.filter(cell => !occupied.has(key(cell)));
      if (!empty.length || unsettled.length !== empty.length) return null;
      const controls = Object.fromEntries(available.flatMap(action => local.controls[action] ? [[action, local.controls[action]]] : []));
      const paths = unsettled.map(cell => referencePopulationPaths(cell, scene.floor, occupied, controls));
      const domains = paths.map(path => empty.filter(slot => path.has(key(slot))).sort((a, b) =>
        path.get(key(a))![0].length - path.get(key(b))![0].length));
      const [matching, missing] = maximumInjectiveMatching(domains);
      const index = unsettled.findIndex(cell => local.selection && key(cell) === key(local.selection));
      const assignment = matching.find(([body]) => body === index);
      let move: Choice | null = null, probe: Choice | null = null, pick: Choice | null = null;
      if (index >= 0) {
        const cell = unsettled[index]!;
        if (local.active && !missing.length && assignment) {
          const slot: Cell = [assignment[1][0]!, assignment[1][1]!];
          const [word, path] = paths[index]!.get(key(slot))!;
          move = { command: { action_ref: word[0]!.action_ref, data: {} }, cell, slot, expected: path[1]! };
        }
        const unexplored = available.filter(action => !local.tried.includes(JSON.stringify([action, cell])) && !local.controls[action]);
        const action = local.active ? unexplored[0] : [...unexplored, ...available.filter(command =>
          !local.tried.includes(JSON.stringify([command, cell])))][0];
        if (action) probe = { command: { action_ref: action, data: {} }, cell, slot: null, expected: null };
      }
      if (index < 0) {
        const score = (cell: Cell) => Math.min(...empty.map(slot => distance(cell, slot)));
        const cell = [...unsettled].sort((a, b) => score(a) - score(b))[0]!;
        pick = { command: { action_ref: 'ACTION6', data: referencePopulationPoint(scene, cell) }, cell, slot: null, expected: null };
      }
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...local.evidence.filter(value => value !== ref)];
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active', facts: {
        unselected: { value: !!pick, evidence }, canLearn: { value: !!probe, evidence }, assigned: { value: !!move, evidence },
      }, planners: { select_unplaced_piece: () => pick, test_selected_displacement: () => probe, move_to_assigned_slot: () => move } });
      if (!selected) return null;
      const strategy = selected.id, choice = selected.plan, label = populationPlacementStrategies[strategy], parent = 'G_official_completion';
      const goal = { kind: 'match_reference_occupancy', scope: scene.reference_digest, subjects: ['movable_pieces', 'distinct_reference_slots'],
        parentObjective: parent, satisfactionContract: 'official_progress_after_matching_reference_positions' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `population-placement:${need.id}`, actions = [choice.command];
      const point = [choice.command.data.x, choice.command.data.y] as NativePoint;
      const binding = strategy === 'select_unplaced_piece'
        ? await ObservedInputDomain.makeLocusWitness(observation, rows, point, { reason: label, evidence }) : undefined;
      return { status: 'proposed', kind: populationPlacementId, actions, local, choice, strategy, needId: need.id,
        steps: [{ action: choice.command, expected_after: null, ...(binding ? { point_binding: binding } : {}) }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Occupy the positions shown by the reference', mode: move && strategy === 'move_to_assigned_slot' ? 'solving' : 'exploration',
          situation: choice.slot ? 'The matched position is reachable with measured commands. Color interactions still need confirmation.' : label,
          agenda: entries, evidence, piece: cellBox(scene, choice.cell), target: choice.slot ? cellBox(scene, choice.slot) : scene.zone_box,
          reference: scene.reference_box },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'population_and_reference_bound' : 'population_or_reference_changed' };
    },
    after(proposal, _index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true,
        reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      if (proposal.strategy === 'select_unplaced_piece') {
        const matched = !!selectionScene(proposal.local.scene, proposal.choice.cell, first, second);
        return { matched, seal_prefix: true, reason: matched ? 'selection_marker_observed' : 'selection_unconfirmed' };
      }
      const measured = compareMovement(proposal, second), expected = proposal.choice.expected;
      const matched = !!measured && (!expected || !!measured.destination && key(measured.destination) === key(expected));
      return { matched, seal_prefix: true, reason: matched ? 'population_return_measured' : 'population_effect_contradicted' };
    },
    record(before, after, _command, first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, choice, strategy } = proposal;
      const evidence = [...local.evidence.slice(-4), after.observation_ref];
      const current = { ...local, frame: after.frame_hash, evidence };
      if (strategy === 'select_unplaced_piece') {
        const measured = selectionScene(local.scene, choice.cell, first, second);
        state = { ...current, scene: measured ?? local.scene, selection: choice.cell, active: false, stopped: !measured };
        return { events: [] };
      }
      const measured = compareMovement(proposal, second), destination = measured?.destination;
      const tried = [...local.tried, JSON.stringify([choice.command.action_ref, choice.cell])];
      const controls = { ...local.controls };
      const contradicted = !!choice.expected && (!destination || key(destination) !== key(choice.expected));
      if (contradicted) delete controls[choice.command.action_ref];
      if (destination) controls[choice.command.action_ref] = { delta: [destination[0] - choice.cell[0], destination[1] - choice.cell[1]] };
      state = { ...current, scene: measured?.next ?? local.scene, selection: destination ?? choice.cell,
        active: local.active || !!destination, tried, controls, stopped: !measured };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}

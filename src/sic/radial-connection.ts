import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { assemblePorts, type PortModel } from '../logos-engine/v6-port-assembly.ts';
import { measureRadialPorts, radialAssemblyModel, radialAtGeometry, rotateRadialPorts } from '../logos-engine/v6-radial-port-observation.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const radialConnectionId = 'sic_radial_connection';
export const radialConnectionStrategies = {
  measure_tile_rotation: 'Test the rotation of an unmatched tile',
  rotate_to_match_ports: 'Rotate the tile toward a connected arrangement',
} as const;
const graph = compileStrategyGraph({ id: 'connect_fixed_tiles_by_rotation', version: 1, order: 'FALLBACK',
  priorities: ['rotate_to_match_ports', 'measure_tile_rotation'],
  strategies: {
    measure_tile_rotation: [{ fact: 'known', expected: false, label: 'The visible ports admit an arrangement and the click rotation is unmeasured' }],
    rotate_to_match_ports: [{ fact: 'known', expected: true, label: 'A measured quarter-turn can bring the tiles toward a connected arrangement' }],
  },
}, ['known']);
type Cell = { point: NativePoint; bbox: NativeBox; ports: number[] };
type Scene = { geometry_ref: string; cells: Cell[] };
type State = { epoch: number; geometry: string; turn: number | null; evidence: string[]; count: number; stopped: boolean };
type Proposal = NativeProposal & { local: State; scene: Scene; cell: number; needId: string };
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function returnedTurn(proposal: Proposal, rows: NativeRows) {
  const { scene, cell, local } = proposal;
  const next = radialAtGeometry(rows, scene) as Scene | null;
  if (!next || next.cells.length !== scene.cells.length || scene.cells.some((value, i) => i !== cell && !equal(value.ports, next.cells[i]?.ports))) return null;
  const rotations = (local.turn === null ? [1, 3] : [local.turn]).filter(turn =>
    equal(rotateRadialPorts(scene.cells[cell]!.ports, turn), next.cells[cell]?.ports));
  return rotations.length === 1 ? rotations[0]! : null;
}

export function createSicRadialConnection(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: radialConnectionId,
    async propose(observation, rows, _inputs, remaining) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const scene = measureRadialPorts(rows) as Scene | null;
      if (!scene || scene.cells.length > 16) return null;
      const prior = state?.epoch === observation.level_epoch && state.geometry === scene.geometry_ref ? state : null;
      if (prior?.stopped || (prior?.count ?? 0) >= 32) return null;
      const local: State = prior ?? { epoch: observation.level_epoch, geometry: scene.geometry_ref, turn: null, evidence: [], count: 0, stopped: false };
      const [model, current] = radialAssemblyModel(scene);
      const target = assemblePorts(model as PortModel, current, null, local.turn);
      const cell = target?.findIndex(([rotation]) => rotation !== 0) ?? -1;
      if (cell < 0) return null;
      const focus = scene.cells[cell]!, [x, y] = focus.point;
      const command = { action_ref: 'ACTION6', data: { x, y } };
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...local.evidence.filter(value => value !== ref)];
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active', facts: {
        known: { value: local.turn !== null, evidence },
      }, planners: { measure_tile_rotation: () => command, rotate_to_match_ports: () => command } });
      if (!selected) return null;
      const strategy = selected.id, label = radialConnectionStrategies[strategy], parent = 'G_official_completion';
      const objective = { kind: 'make_connected_port_arrangement', scope: scene.geometry_ref, subjects: ['fixed_tiles', 'neighboring_ports'],
        parentObjective: parent, satisfactionContract: 'official_progress_after_connecting_the_ports' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence }, id = `radial-connection:${need.id}`;
      const actions = [command], binding = await ObservedInputDomain.makeLocusWitness(observation, rows, focus.point, { reason: label, evidence });
      return { status: 'proposed', kind: radialConnectionId, actions, local, scene, cell, needId: need.id,
        steps: [{ action: command, expected_after: null, point_binding: binding }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Connect neighboring tiles by matching their openings', mode: local.turn === null ? 'exploration' : 'solving',
          situation: local.turn === null ? 'The layout suggests a tile to turn. Test what the click changes.' :
            'The observed rotation gives a route to a connected layout. Verify the changed openings after the click.',
          agenda: entries, evidence, tile: focus.bbox, neighbors: scene.cells.filter((_, i) => i !== cell).slice(0, 3).map(item => item.bbox) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'tile_and_neighbors_bound' : 'tile_or_neighbors_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const matched = returnedTurn(proposal, second) !== null;
      return { matched, seal_prefix: true, reason: matched ? 'tile_rotation_observed' : 'tile_rotation_unconfirmed' };
    },
    record(before, after, _command, _first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local } = proposal, turn = returnedTurn(proposal, second);
      state = { ...local, turn, count: local.count + 1, stopped: turn === null, evidence: [...local.evidence.slice(-4), after.observation_ref] };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}

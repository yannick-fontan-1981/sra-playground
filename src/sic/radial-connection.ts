import { maximumCommittedActions } from './plan-step.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { constrainedPortAssembly, type PortModel } from '../logos-engine/v6-port-assembly.ts';
import { measureRadialPorts, radialAssemblyModel, radialAtGeometry, rotateRadialPorts } from '../logos-engine/v6-radial-port-observation.ts';
import { sicNeedId } from './need-identity.ts';
import { navigationPrimitives } from './navigation-primitives.ts';
import { chooseInteraction, interactionModule } from './observed-interaction-card.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const radialConnectionId = 'sic_radial_connection';
export const learnRadialConnectionId = 'sic_verify_tile_rotation';
export const radialConnectionStrategies = {
  P02: navigationPrimitives.P02,
  P05: navigationPrimitives.P05,
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
type Rotation = { before: Scene; cell: number };
type Proposal = NativeProposal & { local: State; rotations: Rotation[]; needId: string };
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function returnedTurn({ before: scene, cell }: Rotation, turn: number | null, rows: NativeRows) {
  const next = radialAtGeometry(rows, scene) as Scene | null;
  if (!next || next.cells.length !== scene.cells.length || scene.cells.some((value, i) => i !== cell && !equal(value.ports, next.cells[i]?.ports))) return null;
  const rotations = (turn === null ? [1, 3] : [turn]).filter(rotation =>
    equal(rotateRadialPorts(scene.cells[cell]!.ports, rotation), next.cells[cell]?.ports));
  return rotations.length === 1 ? rotations[0]! : null;
}

export function createSicRadialConnection(family = radialConnectionId): NativeFamily<Proposal> {
  const learns = family === learnRadialConnectionId;
  let state: State | null = null;
  let decide: NativeProgramHandle | undefined;
  return {
    id: family,
    async attachPrograms(registry) {
      if (learns) decide = await registry.registerProgram(chooseInteraction, {}, await interactionModule());
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const scene = measureRadialPorts(rows) as Scene | null;
      if (!scene) return null;
      // Any fixed tile can reach its final orientation in at most three quarter-turns.
      const rotationBudget = 3 * scene.cells.length + 1;
      const prior = state?.epoch === observation.level_epoch && state.geometry === scene.geometry_ref ? state : null;
      if (prior?.stopped || (prior?.count ?? 0) >= rotationBudget) return null;
      const local: State = prior ?? { epoch: observation.level_epoch, geometry: scene.geometry_ref, turn: null, evidence: [], count: 0, stopped: false };
      const [model, current] = radialAssemblyModel(scene);
      const now = execution?.now ?? (() => performance.now());
      const target = constrainedPortAssembly(model as PortModel, current, null, local.turn, {
        maxVisits: 50_000, shouldStop: () => !!execution?.signal?.aborted || now() >= (execution?.deadlineMs ?? Infinity),
      });
      const cell = target?.findIndex(([rotation]) => rotation !== 0) ?? -1;
      if (cell < 0) return null;
      const focus = scene.cells[cell]!, [x, y] = focus.point;
      if (learns && local.turn === null && equal(rotateRadialPorts(focus.ports, 1), rotateRadialPorts(focus.ports, 3))) return null;
      const command = { action_ref: 'ACTION6', data: { x, y } };
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...local.evidence.filter(value => value !== ref)];
      const mode = execution?.reasoningMode ?? 'exploration';
      const facts = { probeNeededInteraction: local.turn === null, repeatSupportedInteraction: local.turn !== null, mode };
      const decision = learns ? await decide?.run({ situation: facts }, { signal: execution?.signal }) : null;
      const primitive = facts.probeNeededInteraction ? 'P05' : 'P02';
      if (learns && decision?.result !== primitive) return null;
      const agenda = learns ? null : resolveStrategyGraph({ graph, mode: 'active', facts: {
        known: { value: local.turn !== null, evidence },
      }, planners: { measure_tile_rotation: () => command, rotate_to_match_ports: () => command } });
      const strategy = learns ? primitive : agenda?.selected?.id;
      if (!strategy) return null;
      const label = radialConnectionStrategies[strategy], parent = 'G_official_completion';
      const objective = { kind: 'make_connected_port_arrangement', scope: scene.geometry_ref, subjects: ['fixed_tiles', 'neighboring_ports'],
        parentObjective: parent, satisfactionContract: 'official_progress_after_connecting_the_ports' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence }, id = `radial-connection:${need.id}`;
      const actions = [command], binding = await ObservedInputDomain.makeLocusWitness(observation, rows, focus.point, { reason: label, evidence });
      const steps = [{ action: command, expected_after: null, point_binding: binding }];
      const rotations: Rotation[] = [{ before: scene, cell }];
      if (local.turn !== null && target) {
        let projected = scene;
        for (const [index, [rotation]] of target.entries()) {
          if (index < cell || rotation === 0) continue;
          if (index !== cell) {
            if (actions.length >= Math.min(remaining, maximumCommittedActions, rotationBudget - local.count)) break;
            const [x, y] = scene.cells[index]!.point;
            const next = { action_ref: 'ACTION6', data: { x, y } };
            const witness = await ObservedInputDomain.makeLocusWitness(observation, rows, [x, y], { reason: label, evidence });
            actions.push(next);
            steps.push({ action: next, expected_after: null, point_binding: witness });
            rotations.push({ before: projected, cell: index });
          }
          if (rotation !== local.turn) break;
          const cells = [...projected.cells], tile = cells[index]!;
          cells[index] = { ...tile, ports: rotateRadialPorts(tile.ports, local.turn) };
          projected = { ...projected, cells };
        }
      }
      return { status: 'proposed', kind: family, actions, local, rotations, needId: need.id,
        steps,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Connect neighboring tiles by matching their openings',
          mode: learns ? mode : local.turn === null ? 'exploration' : 'solving',
          situation: local.turn === null ? 'The layout suggests a tile to turn. Test what the click changes.' :
            'The observed rotation gives a route to a connected layout. Verify the changed openings after the click.',
          agenda: agenda?.entries ?? [], evidence, tile: focus.bbox, neighbors: scene.cells.filter((_, i) => i !== cell).slice(0, 3).map(item => item.bbox),
          ...(decision ? { triggerCard: decision.receipt.workflow, rotation: local.turn } : {}) },
        ...(decision ? { sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation: facts } } : {}),
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, packet, observation) {
      const expected = proposal.rotations[index]?.before;
      const actual = index > 0 && expected ? radialAtGeometry(packet.frame_rows, expected) as Scene | null : null;
      const admitted = index === 0 ? proposal.binding?.observation_ref === observation.observation_ref
        : proposal.binding?.level_epoch === observation.level_epoch && !!actual
          && equal(actual.cells.map(cell => cell.ports), expected!.cells.map(cell => cell.ports));
      return { admitted, reason: admitted ? 'tile_and_neighbors_bound' : 'tile_or_neighbors_changed' };
    },
    after(proposal, index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const matched = returnedTurn(proposal.rotations[index]!, proposal.local.turn, second) !== null;
      return { matched, seal_prefix: !matched || index + 1 >= proposal.actions.length, reason: matched ? 'tile_rotation_observed' : 'tile_rotation_unconfirmed' };
    },
    record(before, after, _command, _first, second, proposal, index) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const local = (index > 0 && state?.count === proposal.local.count + index ? state : null) ?? proposal.local;
      const turn = returnedTurn(proposal.rotations[index]!, local.turn, second);
      state = { ...local, turn, count: local.count + 1, stopped: turn === null, evidence: [...local.evidence.slice(-4), after.observation_ref] };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}

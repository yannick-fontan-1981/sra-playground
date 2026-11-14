import { localTraceEffect } from '../logos-engine/v6-trace-field-access.ts';
import { constructTraceField } from '../logos-engine/v6-trace-field-mechanics.ts';
import { measureTraceField, traceFieldCenter } from '../logos-engine/v6-trace-field-observation.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const traceCoverageId = 'sic_trace_coverage';
export const traceCoverageStrategies = {
  test_adjacent_trace_step: 'Test whether clicking the adjacent cell extends the trace',
  extend_verified_trace: 'Continue the trace through the remaining cells',
} as const;
const graph = compileStrategyGraph({ id: 'cover_visible_cells_with_one_trace', version: 1, order: 'FALLBACK',
  priorities: ['extend_verified_trace', 'test_adjacent_trace_step'],
  strategies: {
    test_adjacent_trace_step: [{ fact: 'confirmed', expected: false, label: 'A conditional covering path gives a new adjacent cell to test' }],
    extend_verified_trace: [{ fact: 'confirmed', expected: true, label: 'Two distinct returns confirmed a one-cell extension and the current prefix still agrees' }],
  },
}, ['confirmed']);
type Scene = NonNullable<ReturnType<typeof measureTraceField>>;
type State = { epoch: number; geometry: Scene['geometry']; geometryRef: string; evidence: string[]; count: number; stopped: boolean };
type Proposal = NativeProposal & { local: State; scene: Scene; from: NativePoint; to: NativePoint; needId: string };
const options = { distinguishCellSupport: true };
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function predictedExtension(proposal: Proposal, before: NativeRows, after: NativeRows) {
  const { scene, from, to } = proposal;
  if (!localTraceEffect(scene, from, to, before, after)) return false;
  const next = measureTraceField(after, scene.geometry, options);
  return next !== null && next.geometry_ref === scene.geometry_ref && equal(next.prefix, [...scene.prefix, to]);
}

export function createSicTraceCoverage(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: traceCoverageId,
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6') || execution?.signal?.aborted) return null;
      const local = state?.epoch === observation.level_epoch ? state : null;
      if (local?.stopped) return null;
      const scene = measureTraceField(rows, local?.geometry ?? null, options);
      if (!scene || (local && local.geometryRef !== scene.geometry_ref)) return null;
      const now = execution?.now ?? (() => performance.now());
      const estimate = constructTraceField(scene, observation, remaining, Math.min(now() + 40, execution?.deadlineMs ?? Infinity), now);
      const to = estimate?.path[scene.prefix.length] as NativePoint | undefined;
      if (!to) return null;
      const from = scene.head.cell as NativePoint, point = traceFieldCenter(scene.geometry, to);
      const command = { action_ref: 'ACTION6', data: { x: point[0], y: point[1] } };
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...(local?.evidence.filter(value => value !== ref) ?? [])];
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active', facts: {
        confirmed: { value: (local?.count ?? 0) >= 2, evidence },
      }, planners: { test_adjacent_trace_step: () => command, extend_verified_trace: () => command } });
      if (!selected) return null;
      const strategy = selected.id, label = traceCoverageStrategies[strategy], parent = 'G_official_completion';
      const objective = { kind: 'extend_trace_to_cover_visible_field', scope: scene.geometry_ref, subjects: ['measured_cells', 'distinct_endpoint'],
        parentObjective: parent, satisfactionContract: 'observe_official_progress_after_covering_each_visible_cell_once' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence }, id = `trace-coverage:${need.id}`;
      const actions = [command], binding = await ObservedInputDomain.makeLocusWitness(observation, rows, point, { reason: label, evidence });
      const initial: State = local ?? { epoch: observation.level_epoch, geometry: scene.geometry, geometryRef: scene.geometry_ref,
        evidence: [], count: 0, stopped: false };
      const half = Math.floor((scene.geometry.pitch - 2) / 2);
      const box = (cell: NativePoint): NativeBox => {
        const [x, y] = traceFieldCenter(scene.geometry, cell);
        return [x - half, y - half, x + half, y + half];
      };
      return { status: 'proposed', kind: traceCoverageId, actions, local: initial, scene, from, to, needId: need.id,
        steps: [{ action: command, expected_after: null, point_binding: binding }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Reach the other marker by covering the visible cells once', mode: initial.count >= 2 ? 'solving' : 'exploration',
          situation: `The trace covers ${scene.prefix.length} of ${estimate!.path.length} measured cells. The proposed cell keeps a route to the other marker.`,
          agenda: entries, evidence, head: box(from), next: box(to), endpoint: box(scene.receiver_hypothesis.cell) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'current_trace_head_bound' : 'trace_head_or_support_changed' };
    },
    after(proposal, _index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const matched = predictedExtension(proposal, first, second);
      return { matched, seal_prefix: true, reason: matched ? 'local_trace_extension_observed' : 'trace_extension_unconfirmed' };
    },
    record(before, after, _command, first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local } = proposal;
      state = { ...local, count: local.count + 1, stopped: !predictedExtension(proposal, first, second),
        evidence: [...local.evidence.slice(-3), after.observation_ref] };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}

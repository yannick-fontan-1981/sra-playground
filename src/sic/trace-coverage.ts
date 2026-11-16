import { localTraceEffect } from '../logos-engine/v6-trace-field-access.ts';
import { constructTraceField } from '../logos-engine/v6-trace-field-mechanics.ts';
import { measureTraceField, traceFieldCenter } from '../logos-engine/v6-trace-field-observation.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { LocusWitness } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { sicNeedId } from './need-identity.ts';

export const traceCoverageId = 'sic_trace_coverage';
export const verifyTraceCoverageId = 'sic_verify_trace_coverage';
export const traceCoverageStrategies = {
  test_adjacent_trace_step: 'Test whether clicking the adjacent cell extends the trace',
  extend_verified_trace: 'Continue the trace through the remaining cells',
} as const;
type Scene = NonNullable<ReturnType<typeof measureTraceField>>;
type State = { epoch: number; geometry: Scene['geometry']; geometryRef: string; evidence: string[]; count: number; stopped: boolean };
type TraceLeg = { action: NativeCommand; binding: LocusWitness; to: NativePoint };
type Proposal = NativeProposal & { local: State; scene: Scene; from: NativePoint; to: NativePoint; needId: string;
  route?: readonly TraceLeg[] };
const options = { distinguishCellSupport: true };
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function predictedExtension(proposal: Proposal, index: number, before: NativeRows, after: NativeRows) {
  const scene = index === 0 ? proposal.scene : measureTraceField(before, proposal.scene.geometry, options);
  if (!scene) return false;
  const from = scene.head.cell as NativePoint, to = proposal.route?.[index]?.to ?? proposal.to;
  if (!localTraceEffect(scene, from, to, before, after)) return false;
  const next = measureTraceField(after, scene.geometry, options);
  return next !== null && next.geometry_ref === scene.geometry_ref && equal(next.prefix, [...scene.prefix, to]);
}

export function createSicVerifyTraceCoverage(): NativeFamily<Proposal> {
  let state: State | null = null;
  let decide: NativeProgramHandle | undefined;
  return {
    id: verifyTraceCoverageId,
    async attachPrograms(registry) {
      decide = await registry.registerProgram(chooseLanding, {}, await landingModule());
    },
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
      const confirmed = (local?.count ?? 0) >= 2;
      const mode = execution?.reasoningMode ?? (confirmed ? 'solving' : 'exploration');
      const facts = { routeSupported: confirmed, eligibleProbe: !confirmed, knownInteraction: false, mode };
      const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
      const strategy = confirmed ? 'P07' : 'P05';
      if (decision?.result !== strategy) return null;
      const label = confirmed ? traceCoverageStrategies.extend_verified_trace : traceCoverageStrategies.test_adjacent_trace_step;
      const parent = 'G_official_completion';
      const objective = { kind: 'extend_trace_to_cover_visible_field', scope: scene.geometry_ref, subjects: ['measured_cells', 'distinct_endpoint'],
        parentObjective: parent, satisfactionContract: 'observe_official_progress_after_covering_each_visible_cell_once' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence }, id = `trace-coverage:${need.id}`;
      const binding = await ObservedInputDomain.makeLocusWitness(observation, rows, point, { reason: label, evidence });
      const route: TraceLeg[] = [{ action: command, binding, to }];
      if (confirmed) {
        for (const next of estimate!.path.slice(scene.prefix.length + 1, scene.prefix.length + remaining) as NativePoint[]) {
          const locus = traceFieldCenter(scene.geometry, next);
          try {
            const witness = await ObservedInputDomain.makeLocusWitness(observation, rows, locus, { reason: label, evidence });
            route.push({ action: { action_ref: 'ACTION6', data: { x: locus[0], y: locus[1] } }, binding: witness, to: next });
          } catch (error) { if (!(error instanceof TypeError)) throw error; break; }
        }
      }
      const actions = route.map(leg => leg.action);
      const initial: State = local ?? { epoch: observation.level_epoch, geometry: scene.geometry, geometryRef: scene.geometry_ref,
        evidence: [], count: 0, stopped: false };
      const half = Math.floor((scene.geometry.pitch - 2) / 2);
      const box = (cell: NativePoint): NativeBox => {
        const [x, y] = traceFieldCenter(scene.geometry, cell);
        return [x - half, y - half, x + half, y + half];
      };
      return { status: 'proposed', kind: verifyTraceCoverageId, actions, local: initial, scene, from, to, needId: need.id,
        ...(route.length > 1 ? { route } : {}),
        steps: route.length > 1 ? route.map(leg => ({ action: leg.action, expected_after: leg.to, point_binding: leg.binding }))
          : [{ action: command, expected_after: null, point_binding: binding }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: facts },
        sicSituationCard: { strategy, need: 'Reach the other marker by covering the visible cells once', mode,
          situation: `The trace covers ${scene.prefix.length} of ${estimate!.path.length} measured cells. The proposed cell keeps a route to the other marker.`,
          agenda: [], evidence, triggerCard: decision.receipt.workflow, head: box(from), next: box(to), endpoint: box(scene.receiver_hypothesis.cell),
          ...(route.length > 1 ? { plannedSeries: route.map(leg => traceFieldCenter(scene.geometry, leg.to)) } : {}) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, packet, observation) {
      if (index > 0 && proposal.route) {
        const visible = measureTraceField(packet.frame_rows, proposal.scene.geometry, options);
        const expected = [...proposal.scene.prefix, ...proposal.route.slice(0, index).map(leg => leg.to)];
        const admitted = proposal.binding?.level_epoch === observation.level_epoch && !!visible && visible.geometry_ref === proposal.scene.geometry_ref
          && equal(visible.prefix, expected);
        return { admitted, reason: admitted ? 'confirmed_trace_prefix_still_visible' : 'trace_head_or_support_changed' };
      }
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'current_trace_head_bound' : 'trace_head_or_support_changed' };
    },
    after(proposal, index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const matched = predictedExtension(proposal, index, first, second);
      return { matched, seal_prefix: !matched || index + 1 >= proposal.actions.length,
        reason: matched ? 'local_trace_extension_observed' : 'trace_extension_unconfirmed' };
    },
    record(before, after, _command, first, second, proposal, index) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const local = index > 0 && state?.epoch === proposal.local.epoch ? state : proposal.local;
      state = { ...local, count: local.count + 1, stopped: !predictedExtension(proposal, index, first, second),
        evidence: [...local.evidence.slice(-3), after.observation_ref] };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}

import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import { measureRootedLengths } from '../logos-engine/v6-rooted-quota-observation.ts';
import { currentRootedMarkSupportMatches, measureRootedQuotaWithMarkSupport } from '../logos-engine/v6-rooted-quota-mark-support.ts';
import { propagateRootedQuota, stepRootedQuota } from '../logos-engine/v6-rooted-quota-mechanics.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativeObservation, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';

export const observedPrefixQuotasId = 'sic_satisfy_observed_prefix_quotas';
export const observedPrefixQuotaStrategies = {
  realize_measured_prefix_quota: 'Set a tube to the length required by the visible row and column counts',
} as const;

type Scene = NonNullable<ReturnType<typeof measureRootedQuotaWithMarkSupport>['scene']>;
type Model = {
  empty_palette: number; fill_palette: number | null; addition_observed: boolean; cut_observed: boolean; evidence: string[];
};
type Trial = { epoch: number; scene: Scene | null; model: Model | null };
type Witness = { epoch: number; model: Model; boundary: string };
type Edit = { chain: number; rank: number; point: NativePoint; bounds: NativeBox };
type Proposal = NativeProposal & { scene: Scene; model: Model; expected: number[]; needId: string };
const same = (first: unknown, second: unknown) => JSON.stringify(first) === JSON.stringify(second);

function measureScene(rows: NativeRows, empty: number | null = null): Scene | null {
  const measured = measureRootedQuotaWithMarkSupport(rows, empty);
  return measured.status === 'measured' ? measured.scene : null;
}

function editForPoint(scene: Scene, command: NativeCommand): Edit | null {
  const { x, y } = command.data;
  if (command.action_ref !== 'ACTION6' || typeof x !== 'number' || typeof y !== 'number') return null;
  const column = (scene.x_lines as number[]).findIndex((line, i, lines) => line <= x && x < (lines[i + 1] ?? -Infinity));
  const row = (scene.y_lines as number[]).findIndex((line, i, lines) => line <= y && y < (lines[i + 1] ?? -Infinity));
  if (column < 0 || row < 0) return null;
  for (const [chain, tube] of scene.chains.entries()) {
    const rank = (tube.cells as NativePoint[]).findIndex(([c, r]) => c === column && r === row);
    if (rank < 0) continue;
    return { chain, rank, point: tube.points[rank],
      bounds: [scene.x_lines[column], scene.y_lines[row], scene.x_lines[column + 1] - 1, scene.y_lines[row + 1] - 1] };
  }
  return null;
}

function readFill(scene: Scene, model: Model, rows: NativeRows): number | null {
  if (model.fill_palette !== null) return model.fill_palette;
  const palette = new Set<number>(scene.chains.flatMap((chain: { points: NativePoint[] }) =>
    chain.points.map(([x, y]) => rows[y]![x]!)).filter((value: number) => value !== model.empty_palette));
  return palette.size === 1 ? [...palette][0]! : null;
}

function desiredLengths(scene: Scene, observation: NativeObservation, model: Model, deadline: number, now: () => number): number[] | null {
  const solution = propagateRootedQuota(scene, observation, model, deadline, now);
  return solution.status === 'COMPLETE' && solution.values.all_domains_singleton
    ? (solution.values.retained_domains as number[][]).map(domain => domain[0]!) : null;
}

function confirmQuotaReturn(proposal: Proposal, rows: NativeRows): boolean {
  return currentRootedMarkSupportMatches(rows, proposal.scene, true)
    && same(measureRootedLengths(rows, proposal.scene, proposal.model), proposal.expected);
}

export function createSicObservedPrefixQuotas(): NativeFamily<Proposal> {
  let trial: Trial | null = null, witness: Witness | null = null, stopped: number | null = null;
  return {
    id: observedPrefixQuotasId,
    observePublicOutcome(before, after, command, first, second) {
      if (!before.available_action_refs.includes('ACTION6')) return;
      if (trial?.epoch !== before.level_epoch) {
        const scene = measureScene(first);
        trial = { epoch: before.level_epoch, scene, model: scene ? { empty_palette: scene.empty_content_palette,
          fill_palette: null, addition_observed: false, cut_observed: false, evidence: [] } : null };
      }
      const { scene, model } = trial;
      if (!scene || !model) return;
      const edit = editForPoint(scene, command);
      if (after.levels_completed > before.levels_completed) {
        if (!edit || !model.addition_observed || !model.cut_observed) return;
        const old = measureRootedLengths(first, scene, model) as number[] | null, now = () => performance.now();
        const wanted = desiredLengths(scene, before, model, now() + 100, now);
        if (!old || !wanted) return;
        const predicted = stepRootedQuota(scene, old, edit.chain, edit.rank, before, model, now() + 100, now);
        if (predicted.status === 'COMPLETE' && same(predicted.values.filled_lengths, wanted)) {
          witness = { epoch: after.level_epoch, model, boundary: after.observation_ref };
        }
        return;
      }
      if (before.level_epoch !== after.level_epoch) return;
      const fill = readFill(scene, model, second);
      if (fill === null) return;
      const current = { ...model, fill_palette: fill };
      const old = measureRootedLengths(first, scene, current) as number[] | null;
      const next = measureRootedLengths(second, scene, current) as number[] | null;
      if (!next || !old) return;
      if (!edit) {
        trial.model = current;
        return;
      }
      if (old.some((length, i) => i !== edit.chain && length !== next[i])) return;
      const added = old[edit.chain]! <= edit.rank && next[edit.chain] === edit.rank + 1;
      const cut = old[edit.chain]! > edit.rank && next[edit.chain] === edit.rank;
      if (!added && !cut) return;
      trial.model = { ...current, addition_observed: model.addition_observed || added, cut_observed: model.cut_observed || cut,
        evidence: [...model.evidence.slice(-5), before.observation_ref, after.observation_ref] };
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      const remembered = witness;
      if (remaining < 1 || remembered?.epoch !== observation.level_epoch || stopped === observation.level_epoch
        || !observation.available_action_refs.includes('ACTION6')) return null;
      const model = remembered.model, scene = measureScene(rows, model.empty_palette);
      if (!scene) return null;
      const old = measureRootedLengths(rows, scene, model) as number[] | null;
      if (!old) return null;
      const now = execution?.now ?? (() => performance.now()), deadline = Math.min(execution?.deadlineMs ?? Infinity, now() + 100);
      const desired = desiredLengths(scene, observation, model, deadline, now);
      if (!desired) return null;
      const chain = desired.findIndex((length, i) => length !== old[i]);
      if (chain < 0) return null;
      const length = desired[chain]!, rank = length > old[chain]! ? length - 1 : length;
      const step = stepRootedQuota(scene, old, chain, rank, observation, model, deadline, now);
      if (step.status !== 'COMPLETE') return null;
      const [x, y] = scene.chains[chain].points[rank] as NativePoint;
      const action = { action_ref: 'ACTION6', data: { x, y } }, actions = [action];
      const edit = editForPoint(scene, action);
      if (!edit) return null;
      const ref = observation.observation_ref, parent = 'G_official_completion', strategy = 'realize_measured_prefix_quota';
      const label = observedPrefixQuotaStrategies[strategy];
      const evidence: [string, ...string[]] = [ref, ...new Set([remembered.boundary, ...model.evidence].filter(value => value !== ref))];
      const binding = await ObservedInputDomain.makeLocusWitness(observation, rows, edit.point, { reason: label, evidence });
      if (!binding) return null;
      const objective = { kind: 'satisfy_displayed_row_and_column_counts', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['rooted_tube', 'row_and_column_counts'], parentObjective: parent,
        satisfactionContract: 'observe_expected_prefix_and_official_progress' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = 'prefix-quota:' + need.id;
      return { status: 'proposed', kind: observedPrefixQuotasId, actions, scene, model, expected: step.values.filled_lengths, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        steps: [{ action, point_binding: binding, expected_after: step.values.filled_lengths }],
        sicSituationCard: { strategy, need: 'Make the filled cells satisfy the visible row and column counts',
          situation: label, mode: 'solving', evidence, agenda: [], target: edit.bounds, fromLength: old[chain], toLength: length },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label, preconditions: {},
          preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'rooted_prefix_cell_bound' : 'quota_context_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) {
        return { matched: true, seal_prefix: true, reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      }
      const matched = confirmQuotaReturn(proposal, second);
      return { matched, seal_prefix: true, reason: matched ? 'prefix_and_quota_marks_confirmed' : 'prefix_or_quota_prediction_contradicted' };
    },
    record(before, after, _command, _first, second, proposal) {
      if (after.levels_completed > before.levels_completed && witness) {
        witness = { ...witness, epoch: after.level_epoch, boundary: after.observation_ref };
      } else if (!confirmQuotaReturn(proposal, second)) stopped = before.level_epoch;
      return { events: [] };
    },
    state: () => ({ trial, witness, stopped }),
    restore(value: NativeRecord) {
      trial = structuredClone((value.trial as Trial | undefined) ?? null);
      witness = structuredClone((value.witness as Witness | undefined) ?? null);
      stopped = typeof value.stopped === 'number' ? value.stopped : null;
    },
  };
}

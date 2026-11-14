import { symbolicDigest } from '../logos-engine/v6-hash.ts';
import { acquireQueuedField, activeQueueMemberCount } from '../logos-engine/v6-queued-field-models.ts';
import { measureQueuedField, queuedFieldGrid } from '../logos-engine/v6-queued-field-observation.ts';
import { chooseQueuedField } from '../logos-engine/v6-queued-field-search.ts';
import type { NativeCommand, NativeFamily, NativeProposal, NativeRecord } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const queuedPlacementId = 'sic_queued_placement';
export const queuedPlacementStrategies = {
  test_queue_control: 'Test what this input does to the active group',
  prepare_queued_group: 'Prepare the active group for the projected placement',
  receive_queued_group: 'Place the prepared group and observe which lines clear',
} as const;
const graph = compileStrategyGraph({ id: 'place_groups_in_a_visible_field', version: 1, order: 'FALLBACK',
  priorities: ['receive_queued_group', 'prepare_queued_group', 'test_queue_control'],
  strategies: {
    test_queue_control: [{ fact: 'probe', expected: true, label: 'An input can distinguish the remaining effects on the current group' }],
    prepare_queued_group: [{ fact: 'prepare', expected: true, label: 'A projected placement starts with a measured preparation' }],
    receive_queued_group: [{ fact: 'receive', expected: true, label: 'The current group is ready for its projected placement' }],
  },
}, ['probe', 'prepare', 'receive']);

type Model = Parameters<typeof acquireQueuedField>[0];
type Grid = number[][];
type Proposal = NativeProposal & { model: Model; geometry: NativeRecord; expected: Grid | null; needId: string };
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function createSicQueuedPlacement(): NativeFamily<Proposal> {
  let state: Model = null;
  return {
    id: queuedPlacementId,
    propose(observation, rows, inputs, remaining, execution) {
      if (remaining < 1 || observation.available_action_refs.includes('ACTION6')) return null;
      const available = inputs.filter(command => /^ACTION[1-5]$/.test(command.action_ref)).map(command => command.action_ref).sort();
      if (available.length < 3) return null;
      const local = state?.epoch === observation.level_epoch ? state : null;
      const scene = measureQueuedField(rows, local?.geometry ?? null, activeQueueMemberCount(local));
      if (!scene?.mark || (!local && !scene.preview_alternatives.length)) return null;
      const controls = local?.controls ?? {};
      const laws = Object.values(controls) as { kind: string; delta?: number; permutations?: number[][] }[];
      const move = laws.filter(law => law.kind === 'translate');
      const complete = local && Object.hasOwn(local, 'empty') && Object.hasOwn(local, 'gravity')
        && laws.some(law => law.kind === 'receive')
        && (laws.some(law => law.kind === 'reorder' && law.permutations?.length === 1) || new Set(scene.mark.values).size === 1)
        && move.some(law => law.delta! < 0) && move.some(law => law.delta! > 0);
      const now = execution?.now ?? (() => performance.now());
      const plan = complete ? chooseQueuedField(scene, local, Math.min(remaining, 16),
        Math.min(execution?.deadlineMs ?? Infinity, now() + 1200), 24000, 3, now) : null;
      const first = plan?.actions[0]?.action_ref as string | undefined;
      const ambiguous = available.filter(action => controls[action]?.kind === 'reorder' && controls[action].permutations.length > 1);
      const untried = available.filter(action => !Object.hasOwn(controls, action));
      const probe = !complete ? (ambiguous.length ? ambiguous : untried).find(action =>
        !(local?.attempts ?? []).includes(symbolicDigest([scene.grid, scene.mark.column, { action_ref: action }]))) : undefined;
      const action_ref = first ?? probe;
      if (!action_ref || !available.includes(action_ref)) return null;
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...new Set<string>((local?.evidence ?? []).slice(-10).filter((item: string) => item !== ref))];
      const command: NativeCommand = { action_ref, data: {} };
      const receive = controls[action_ref]?.kind === 'receive';
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active', facts: {
        probe: { value: !first, evidence }, prepare: { value: !!first && !receive, evidence }, receive: { value: !!first && receive, evidence },
      }, planners: { test_queue_control: () => command, prepare_queued_group: () => command, receive_queued_group: () => command } });
      if (!selected) return null;
      const strategy = selected.id, label = queuedPlacementStrategies[strategy], parent = 'G_official_completion';
      const goal = { kind: 'contribute_active_group_to_field', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['active_group_and_receiving_field'], parentObjective: parent, satisfactionContract: 'observe_official_progress_after_group_receptions' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `queued-placement:${need.id}`, actions = [command];
      const law = controls[action_ref], mark = scene.mark;
      let expected: Grid | null = null;
      if (local && Object.hasOwn(local, 'empty') && (law?.kind === 'translate' || (law?.kind === 'reorder' && law.permutations.length === 1))) {
        const column = mark.column + (law.kind === 'translate' ? law.delta : 0);
        if (column >= 0 && column < scene.geometry.shape[0]) {
          const grid: Grid = structuredClone(scene.grid);
          const values: number[] = law.kind === 'translate' ? mark.values : law.permutations[0].map((i: number) => mark.values[i]);
          for (const row of mark.rows as number[]) grid[row]![mark.column] = local.empty;
          for (const [i, row] of (mark.rows as number[]).entries()) grid[row]![column] = values[i]!;
          expected = grid;
        }
      }
      const [left, top] = scene.geometry.origin, [width, height] = scene.geometry.shape;
      const [dx, dy] = scene.geometry.pitch, [cellWidth, cellHeight] = scene.geometry.size;
      const field = [left, top, left + (width - 1) * dx + cellWidth - 1, top + (height - 1) * dy + cellHeight - 1];
      return { status: 'proposed', kind: queuedPlacementId, actions, model: local, geometry: scene.geometry, expected, needId: need.id,
        steps: [{ action: command, expected_after: null }], binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Place each incoming group where it contributes to the field', mode: first ? 'solving' : 'exploration',
          situation: label, agenda: entries, evidence, field, activeGroup: mark.bbox },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'queued_group_observation_bound' : 'queued_group_observation_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true,
        reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      const matched = proposal.expected ? equal(queuedFieldGrid(second, proposal.geometry), proposal.expected) : null;
      return { matched, seal_prefix: true, reason: matched === false ? 'queued_preparation_contradicted'
        : matched ? 'queued_preparation_confirmed' : 'observe_queued_control_or_reception' };
    },
    record(before, after, command, first, second, proposal, _index, frames) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      // The acquisition kernel uses source-shaped commands in its attempt receipts.
      state = acquireQueuedField(proposal.model, before, after, { action_ref: command.action_ref }, first, second, frames) ?? proposal.model;
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as Model); },
  };
}

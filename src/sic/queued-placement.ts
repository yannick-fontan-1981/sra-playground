import { symbolicDigest } from '../logos-engine/v6-hash.ts';
import { acquireQueuedField, activeQueueMemberCount } from '../logos-engine/v6-queued-field-models.ts';
import { measureQueuedField, queuedFieldGrid } from '../logos-engine/v6-queued-field-observation.ts';
import { chooseQueuedField } from '../logos-engine/v6-queued-field-search.ts';
import type { NativeCommand, NativeFamily, NativeProgramHandle, NativeProposal, NativeRecord } from '../logos-engine/v6-native-types.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const queuedPlacementId = 'sic_queued_placement';
export const learnQueuedPlacementId = 'sic_place_after_observed_queue_controls';
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
type Preparation = { grid: Grid; column: number; values: number[] };
type Control = { kind: 'translate'; delta: number } | { kind: 'reorder'; permutations: number[][] } | { kind: 'receive' };
type Proposal = NativeProposal & { model: Model; geometry: NativeRecord; preparations: (Preparation | null)[];
  preview: unknown; needId: string };
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function projectPreparation(width: number, rows: readonly number[], empty: number, law: Control | undefined, current: Preparation): Preparation | null {
  if (!law || !(law.kind === 'translate' || law.kind === 'reorder' && law.permutations.length === 1)) return null;
  const column = current.column + (law.kind === 'translate' ? law.delta : 0);
  if (column < 0 || column >= width) return null;
  const grid = structuredClone(current.grid);
  const values = law.kind === 'translate' ? current.values : law.permutations[0]!.map(i => current.values[i]!);
  for (const row of rows) grid[row]![current.column] = empty;
  for (const [index, row] of rows.entries()) grid[row]![column] = values[index]!;
  return { grid, column, values };
}

export function createSicQueuedPlacement(family = queuedPlacementId): NativeFamily<Proposal> {
  const learns = family === learnQueuedPlacementId;
  let state: Model = null;
  let choose: NativeProgramHandle | undefined;
  return {
    id: family,
    async attachPrograms(registry) {
      if (learns) choose = await registry.registerProgram(chooseLanding, {}, await landingModule());
    },
    async propose(observation, rows, inputs, remaining, execution) {
      if (remaining < 1 || observation.available_action_refs.includes('ACTION6')) return null;
      const available = inputs.filter(command => /^ACTION[1-5]$/.test(command.action_ref)).map(command => command.action_ref).sort();
      if (available.length < 3) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      const acquired = execution?.observedQueue?.epoch === observation.level_epoch ? execution.observedQueue : null;
      const local = prior ?? (learns ? acquired : null);
      if (learns && !local) return null;
      const scene = measureQueuedField(rows, local?.geometry ?? null, activeQueueMemberCount(local));
      if (!scene?.mark || (!local && !scene.preview_alternatives.length)) return null;
      const controls = local?.controls ?? {};
      const laws = Object.values(controls) as { kind: string; delta?: number; permutations?: number[][] }[];
      const move = laws.filter(law => law.kind === 'translate');
      const complete = local && Object.hasOwn(local, 'empty') && Object.hasOwn(local, 'gravity')
        && laws.some(law => law.kind === 'receive')
        && (laws.some(law => law.kind === 'reorder' && law.permutations?.length === 1) || new Set(scene.mark.values).size === 1)
        && move.some(law => law.delta! < 0) && move.some(law => law.delta! > 0);
      if (learns && !prior && !complete) return null;
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
      const facts = { eligibleProbe: !first, routeSupported: !!first && !receive,
        knownInteraction: !!first && receive, mode: execution?.reasoningMode ?? 'exploration' };
      const decision = learns ? await choose?.run({ situation: facts }, { signal: execution?.signal }) : null;
      const resolved = learns ? null : resolveStrategyGraph({ graph, mode: 'active', facts: {
        probe: { value: !first, evidence }, prepare: { value: !!first && !receive, evidence }, receive: { value: !!first && receive, evidence },
      }, planners: { test_queue_control: () => command, prepare_queued_group: () => command, receive_queued_group: () => command } });
      const strategy = learns ? decision?.result === 'P05' && facts.eligibleProbe ? 'test_queue_control'
        : decision?.result === 'P07' && facts.routeSupported ? 'prepare_queued_group'
        : decision?.result === 'P02' && facts.knownInteraction ? 'receive_queued_group' : null : resolved?.selected?.id;
      if (!strategy) return null;
      const label = queuedPlacementStrategies[strategy], parent = 'G_official_completion';
      const goal = { kind: 'contribute_active_group_to_field', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['active_group_and_receiving_field'], parentObjective: parent, satisfactionContract: 'observe_official_progress_after_group_receptions' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `queued-placement:${need.id}`, mark = scene.mark;
      const actions: NativeCommand[] = [command];
      const widthInCells = scene.geometry.shape[0];
      let preparation = local && Object.hasOwn(local, 'empty') ? projectPreparation(widthInCells, mark.rows, local.empty,
        controls[action_ref], { grid: scene.grid, column: mark.column, values: mark.values }) : null;
      const preparations = [preparation];
      if (strategy === 'prepare_queued_group' && local && plan) {
        for (const planned of plan.actions.slice(1)) {
          if (!preparation || !available.includes(planned.action_ref)) break;
          preparation = projectPreparation(widthInCells, mark.rows, local.empty, controls[planned.action_ref], preparation);
          if (!preparation) break;
          actions.push({ action_ref: planned.action_ref, data: {} });
          preparations.push(preparation);
        }
      }
      const [left, top] = scene.geometry.origin, [width, height] = scene.geometry.shape;
      const [dx, dy] = scene.geometry.pitch, [cellWidth, cellHeight] = scene.geometry.size;
      const field = [left, top, left + (width - 1) * dx + cellWidth - 1, top + (height - 1) * dy + cellHeight - 1];
      return { status: 'proposed', kind: family, actions, model: local, geometry: scene.geometry, preparations,
        preview: scene.preview_alternatives, needId: need.id,
        steps: actions.map(action => ({ action, expected_after: null })), binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Place each incoming group where it contributes to the field', mode: first ? 'solving' : 'exploration',
          situation: label, agenda: resolved?.entries ?? [], evidence, field, activeGroup: mark.bbox },
        ...(decision ? { sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation: facts } } : {}),
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, packet, observation) {
      const previous = proposal.preparations[index - 1];
      const admitted = index === 0 ? proposal.binding?.observation_ref === observation.observation_ref
        : !!previous && proposal.binding?.level_epoch === observation.level_epoch
          && equal(queuedFieldGrid(packet.frame_rows, proposal.geometry), previous.grid);
      return { admitted, reason: admitted ? 'queued_group_observation_bound' : 'queued_group_observation_changed' };
    },
    after(proposal, index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true,
        reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      const expected = proposal.preparations[index];
      const matched = expected ? equal(queuedFieldGrid(second, proposal.geometry), expected.grid) : null;
      const next = matched && index + 1 < proposal.actions.length
        ? measureQueuedField(second, proposal.geometry, activeQueueMemberCount(proposal.model)) : null;
      const continuePreparation = !!next?.mark && !!expected && next.mark.column === expected.column
        && equal(next.mark.values, expected.values) && equal(next.preview_alternatives, proposal.preview);
      return { matched, seal_prefix: !continuePreparation, reason: matched === false ? 'queued_preparation_contradicted'
        : matched ? 'queued_preparation_confirmed' : 'observe_queued_control_or_reception' };
    },
    record(before, after, command, first, second, proposal, index, frames) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      // The acquisition kernel uses source-shaped commands in its attempt receipts.
      const previous = index > 0 && state?.epoch === before.level_epoch ? state : proposal.model;
      state = acquireQueuedField(previous, before, after, { action_ref: command.action_ref }, first, second, frames) ?? previous;
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as Model); },
  };
}

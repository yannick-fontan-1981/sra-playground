import { occurrenceCollectionScene } from '../logos-engine/v6-occurrence-program-observer.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const markedCollectionId = 'sic_marked_collection';
export const markedCollectionStrategies = {
  remove_marked_member: 'Test removing the marked member',
  insert_marked_contribution: 'Test inserting the marked contribution',
  run_edited_collection: 'Test the edited collection with the available command',
} as const;
const graph = compileStrategyGraph({ id: 'test_effect_of_editing_a_collection', version: 1, order: 'FALLBACK',
  priorities: ['remove_marked_member', 'insert_marked_contribution', 'run_edited_collection'],
  strategies: {
    remove_marked_member: [{ fact: 'pairedMarks', expected: true, label: 'Both a collection member and a possible contribution are marked' }],
    insert_marked_contribution: [{ fact: 'markedControl', expected: true, label: 'A control remains marked and no collection member is marked' }],
    run_edited_collection: [{ fact: 'editedCollection', expected: true, label: 'The last edit was confirmed, no marks remain, and just one non-point command is available' }],
  },
}, ['pairedMarks', 'markedControl', 'editedCollection']);

type Part = { bbox: NativeBox; color: number };
type Scene = { members: Part[]; marked_members: Part[]; marked_controls: Part[] };
type Strategy = keyof typeof markedCollectionStrategies;
type State = { epoch: number; edit: string | null; stopped: boolean; count: number };
type Proposal = NativeProposal & { strategy: Strategy; expected: number[] | null; needId: string };
const empty = (epoch = 0): State => ({ epoch, edit: null, stopped: false, count: 0 });
const measure = (rows: NativeRows) => occurrenceCollectionScene(rows) as Scene | null;
const memberColors = (scene: Scene) => scene.members.map(member => member.color);
const sortedColors = (colors: readonly number[]) => [...colors].sort((a, b) => a - b);

function observedEdit(rows: NativeRows, expected: readonly number[]) {
  const scene = measure(rows);
  if (!scene || scene.members.length !== expected.length) return false;
  return sortedColors(memberColors(scene)).every((color, index) => color === expected[index]);
}

export function createSicMarkedCollection(): NativeFamily<Proposal> {
  let state = empty();
  return {
    id: markedCollectionId,
    async propose(observation, rows, inputs, remaining) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const local = state.epoch === observation.level_epoch ? state : empty(observation.level_epoch);
      if (local.stopped || local.count >= 12) return null;
      const scene = measure(rows);
      if (!scene) return null;
      const member = scene.marked_members[0] ?? null, contribution = scene.marked_controls[0] ?? null;
      const edits = contribution ? member ?? contribution : null;
      const nonPoint = inputs.filter(command => /^ACTION[1-5]$/.test(command.action_ref));
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...(local.edit === null ? [] : [local.edit])];
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active', facts: {
        pairedMarks: { value: !!member && !!contribution, evidence },
        markedControl: { value: !member && !!contribution, evidence },
        editedCollection: { value: !!local.edit && !member && !contribution && nonPoint.length === 1, evidence },
      }, planners: { remove_marked_member: () => 'edit', insert_marked_contribution: () => 'edit', run_edited_collection: () => 'run' } });
      if (!selected) return null;
      const strategy = selected.id, label = markedCollectionStrategies[strategy], parent = 'G_official_completion';
      const edited = selected.plan === 'edit' ? edits : null;
      const [left, top, right, bottom] = edited?.bbox ?? [0, 0, 0, 0];
      const point: NativePoint = [Math.floor((left + right) / 2), Math.floor((top + bottom) / 2)];
      const command: NativeCommand = edited ? { action_ref: 'ACTION6', data: { x: point[0], y: point[1] } } : nonPoint[0]!;
      const expected = strategy === 'remove_marked_member'
        ? sortedColors(memberColors(scene).filter((_, index) => index !== scene.members.indexOf(member!)))
        : edited ? sortedColors([...memberColors(scene), edited.color]) : null;
      const goal = { kind: 'test_observed_collection_edit', scope: ref.split(':revision:', 1)[0]!, subjects: ['marked_collection'],
        parentObjective: parent, satisfactionContract: 'observe_official_progress_after_verified_edit' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `marked-collection:${need.id}`, actions = [command];
      const pointBinding = edited ? await ObservedInputDomain.makeLocusWitness(observation, rows, point, { reason: label, evidence }) : null;
      return { status: 'proposed', kind: markedCollectionId, actions, strategy, expected, needId: need.id,
        steps: [{ action: command, expected_after: null, ...(pointBinding ? { point_binding: pointBinding } : {}) }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Find what changing the marked collection does', mode: 'exploration',
          situation: label, agenda: entries, evidence, members: scene.members.map(part => part.bbox), addressedRegion: edited?.bbox ?? null },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'marked_collection_bound' : 'marked_collection_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true,
        reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      const matched = proposal.expected ? observedEdit(second, proposal.expected) : null;
      return { matched, seal_prefix: true, reason: matched === null ? 'observe_edited_collection_effect'
        : matched ? 'collection_edit_confirmed' : 'collection_edit_contradicted' };
    },
    record(before, after, _command, _first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const local = state.epoch === before.level_epoch ? state : empty(before.level_epoch);
      const confirmed = proposal.expected !== null && observedEdit(second, proposal.expected);
      state = { ...local, edit: confirmed ? after.observation_ref : null, stopped: !confirmed, count: local.count + 1 };
      return { events: [] };
    },
    state: () => ({ ...state }),
    restore(value: NativeRecord) { state = structuredClone(value as State); },
  };
}

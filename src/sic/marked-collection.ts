import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeCommand, NativeFamily, NativeObservation, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { collectionValues, matchesCollectionEdit, measureCollection } from './collection-experiment.ts';
import { sicNeedId } from './need-identity.ts';
import { chooseObservedProgram, learnObservedProgram, verifyObservedProgram,
  type ProgramChoice, type ProgramEdit, type ProgramWitness, type RetainedProgram } from './observed-program-continuation.ts';
import { compileStrategyGraph, observedMechanicsGroup, resolveStrategyGraph } from './strategy-agenda.ts';

export const markedCollectionId = 'sic_marked_collection';
export const markedCollectionStrategies = {
  remove_marked_member: 'Test removing the marked member',
  insert_marked_contribution: 'Test inserting the marked contribution',
  run_edited_collection: 'Test the edited collection with the available command',
  bind_program_bearer: 'Add a known operator to identify which piece carries the program',
  compose_observed_program: 'Add the next operator in the program projected on the visible board',
  run_verified_program: 'Run the current program and compare the resulting positions and stacks',
} as const;
const graph = compileStrategyGraph({ id: 'test_effect_of_editing_a_collection', version: 1, order: 'FALLBACK',
  priorities: ['remove_marked_member', 'insert_marked_contribution', 'run_edited_collection'],
  strategies: {
    remove_marked_member: [{ fact: 'pairedMarks', expected: true, label: 'Both a collection member and a possible contribution are marked' }],
    insert_marked_contribution: [{ fact: 'markedControl', expected: true, label: 'A control remains marked and no collection member is marked' }],
    run_edited_collection: [{ fact: 'editedCollection', expected: true, label: 'The last edit was confirmed, no marks remain, and just one non-point command is available' }],
  },
}, ['pairedMarks', 'markedControl', 'editedCollection']);

type Strategy = keyof typeof markedCollectionStrategies;
type State = { epoch: number; edit: string | null; stopped: boolean; count: number; samples?: ProgramEdit[];
  program?: ProgramWitness; retained?: RetainedProgram };
type Proposal = NativeProposal & { strategy: Strategy; expected: number[] | null; needId: string; followUp?: ProgramChoice };
const empty = (epoch = 0): State => ({ epoch, edit: null, stopped: false, count: 0 });

async function programProposal(observation: NativeObservation, rows: NativeRows, witness: ProgramWitness, choice: ProgramChoice): Promise<Proposal> {
  const ref = observation.observation_ref, parent = 'G_official_completion';
  const evidence: [string, ...string[]] = [ref, ...witness.evidence.filter(value => value !== ref)];
  const label = markedCollectionStrategies[choice.kind];
  const objective = { kind: 'compose_publicly_observed_operators', scope: ref.split(':revision:', 1)[0]!,
    subjects: ['ordered_program', 'controlled_piece', 'reachable_surface'], parentObjective: parent,
    satisfactionContract: 'official_progress_after_public_program_projection' };
  const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
  const id = `marked-collection:${need.id}`, actions = [choice.action];
  const point = choice.region && [Number(choice.action.data.x), Number(choice.action.data.y)] as NativePoint;
  const pointBinding = point && await ObservedInputDomain.makeLocusWitness(observation, rows, point, { reason: label, evidence });
  return { status: 'proposed', kind: markedCollectionId, actions, strategy: choice.kind, expected: null, needId: need.id, followUp: choice,
    steps: [{ action: choice.action, expected_after: null, ...(pointBinding ? { point_binding: pointBinding } : {}) }],
    binding: { observation_ref: ref, level_epoch: observation.level_epoch },
    sicSituationCard: { strategy: choice.kind, need: 'Reach the remaining pieces with the observed program operators',
      mode: choice.kind === 'bind_program_bearer' ? 'assimilation' : 'solving', situation: label, agenda: [], evidence,
      members: choice.sceneMembers, addressedRegion: choice.region, actor: choice.actor, affected: choice.affected },
    question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
    compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
    sicLocalDecision: { strategy: choice.kind, objective: { id, label, parent }, need },
    bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
      preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
}

export function createSicMarkedCollection(): NativeFamily<Proposal> {
  let state = empty();
  return {
    id: markedCollectionId,
    proposeInGroup(group, observation, rows, inputs, remaining, execution) {
      const scoped = state.epoch === observation.level_epoch && !!state.program;
      if ((group === observedMechanicsGroup) !== scoped) return null;
      return this.propose(observation, rows, inputs, remaining, execution);
    },
    async propose(observation, rows, inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const local = state.epoch === observation.level_epoch ? state : empty(observation.level_epoch);
      if (local.stopped || local.count >= 12) return null;
      if (local.program?.epoch === observation.level_epoch) {
        const deadline = Math.min(execution?.deadlineMs ?? Infinity, performance.now() + 120);
        const choice = chooseObservedProgram(local.program, rows, observation.available_action_refs, remaining, deadline, local.retained);
        return choice ? programProposal(observation, rows, local.program, choice) : null;
      }
      const scene = measureCollection(rows);
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
        ? collectionValues(scene.members.filter(part => part !== member).map(part => part.color))
        : edited ? collectionValues([...scene.members.map(part => part.color), edited.color]) : null;
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
      if (proposal.followUp && state.program) {
        const matched = before.level_epoch === after.level_epoch && verifyObservedProgram(proposal.followUp, state.program, second);
        return { matched, seal_prefix: true, reason: matched ? 'program_projection_confirmed' : 'program_projection_contradicted' };
      }
      const matched = proposal.expected ? matchesCollectionEdit(second, proposal.expected) : null;
      return { matched, seal_prefix: true, reason: matched === null ? 'observe_edited_collection_effect'
        : matched ? 'collection_edit_confirmed' : 'collection_edit_contradicted' };
    },
    record(before, after, command, first, second, proposal, _index, frames) {
      const local = state.epoch === before.level_epoch ? state : empty(before.level_epoch);
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) {
        if (proposal.strategy === 'run_edited_collection') {
          for (const sample of local.samples ?? []) {
            const program = learnObservedProgram(sample, before, after, command, first, frames);
            if (program) { state = { ...empty(after.level_epoch), program }; break; }
          }
        }
        return { events: [] };
      }
      if (proposal.followUp && local.program) {
        const choice = proposal.followUp, matched = verifyObservedProgram(choice, local.program, second);
        const retained = matched && choice.kind === 'run_verified_program' ? { word: choice.word, display: choice.display } : undefined;
        state = { ...local, count: local.count + 1, stopped: !matched, ...(retained ? { retained } : {}) };
        return { events: [] };
      }
      const confirmed = proposal.expected !== null && matchesCollectionEdit(second, proposal.expected);
      const samples = confirmed && (local.samples?.length ?? 0) < 2 ? [
        ...(local.samples ?? []), { before: first, after: second, epoch: before.level_epoch,
          evidence: [before.observation_ref, after.observation_ref] },
      ] : local.samples;
      state = { ...local, edit: confirmed ? after.observation_ref : null, stopped: !confirmed, count: local.count + 1,
        ...(samples ? { samples } : {}) };
      return { events: [] };
    },
    state: () => ({ ...state }),
    restore(value: NativeRecord) { state = structuredClone(value as State); },
  };
}

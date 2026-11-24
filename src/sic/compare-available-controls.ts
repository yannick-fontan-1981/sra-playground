import { digest } from '../logos-engine/canonical.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativeProgramHandle, NativeProposal } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { situationChoiceWorkflow } from './situation-choice-workflow.ts';

export const compareAvailableControlsId = 'sic_compare_available_controls';
export const compareAvailableControlsStrategies = {
  probe_unmeasured_input: 'Test an available control',
  compare_alternative: 'Compare the other control with the observed effect',
} as const;
const moduleId = 'sic.compare_available_controls';
export const chooseAvailableControl = moduleId + '.choose';
type Proposal = NativeProposal & { needId: string; initial: boolean };

export async function availableControlsModule() {
  const workflows = [situationChoiceWorkflow(chooseAvailableControl, [
    { situation: 'compare', strategy: 'compare_alternative' },
    { situation: 'probe', strategy: 'probe_unmeasured_input' },
  ])];
  const hash = await digest(workflows);
  return {
    module_id: moduleId, source_name: 'src/sic/compare-available-controls.ts', source_hash: hash, semantic_hash: hash,
    imports: [], workflows,
  };
}

export function createSicCompareAvailableControls(): NativeFamily<Proposal> {
  let choose: NativeProgramHandle | undefined;
  let probedEpoch: number | null = null;
  let stoppedEpoch: number | null = null;
  return {
    id: compareAvailableControlsId,
    async attachPrograms(registry) {
      choose = await registry.registerProgram(chooseAvailableControl, {}, await availableControlsModule());
    },
    async propose(observation, _rows, inputs, remaining, execution) {
      const { level_epoch: epoch, observation_ref: ref } = observation;
      const keys = observation.available_action_refs.filter(key => key !== 'ACTION7');
      if (!choose || remaining < 1 || stoppedEpoch === epoch || keys.length !== 2 ||
        !keys.every(key => /^ACTION[1-4]$/.test(key))) return null;
      const receipt = execution?.readDirectionalMotion?.();
      const moves = execution?.readAnimatedCells && receipt?.afterRef === ref && receipt.levelEpoch === epoch
        ? receipt.translations.filter(({ displacement }) => displacement.every(value => value !== 0)) : [];
      const comparison = moves.length === 1 && receipt && keys.includes(receipt.command) ? receipt : null;
      const probe = probedEpoch !== epoch && !receipt && remaining >= 2;
      const situation = { probe, compare: !!comparison, mode: execution?.reasoningMode ?? 'exploration' };
      const { result, receipt: audit } = await choose.run({ situation }, { signal: execution?.signal });
      if (result !== 'probe_unmeasured_input' && result !== 'compare_alternative') return null;
      const initial = result === 'probe_unmeasured_input';
      const candidates = keys.filter(key => inputs.some(command => command.action_ref === key));
      const key = initial ? (probe ? candidates[0] : null) : comparison && candidates.find(key => key !== comparison.command);
      if (!key) return null;
      const command: NativeCommand = { action_ref: key, data: {} };
      const evidence = [ref, ...(initial || !comparison ? [] : [comparison.beforeRef])];
      const subject: NativeBox | null = initial ? null : moves[0]?.to ?? null;
      const parent = 'G_official_completion';
      const label = initial ? 'Test a visible input before assigning its effect' : 'Test the other input after a distinct observed displacement';
      const goal = { kind: 'compare_two_control_effects', scope: ref.split(':revision:', 1)[0]!,
        subjects: [...keys], parentObjective: parent, satisfactionContract: 'observe_and_compare_control_returns' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      return { status: 'proposed', kind: compareAvailableControlsId, initial, needId: need.id, actions: [command],
        steps: [{ action: command, expected_after: null }], binding: { observation_ref: ref, level_epoch: epoch },
        sicSrcDecision: { workflow: audit.workflow, hash: audit.src_hash, instructions: audit.instructions,
          edited: 'edited' in audit && audit.edited === true, situation },
        sicSituationCard: { strategy: result, need: 'Identify which effects the available controls produce',
          situation: label, evidence, subject, mode: situation.mode, agenda: [] },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id: need.id, observed: false, open_question: label, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy: result, objective: { id: need.id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: need.id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions: [command], outcome_guard: { path: ['value'], contains: need.id } },
      };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'input_comparison_bound' : 'input_comparison_context_changed' };
    },
    after(proposal, _index, before, after) {
      return after.levels_completed > before.levels_completed
        ? { matched: true, seal_prefix: true, reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } }
        : { matched: null, seal_prefix: true, reason: 'observe_response_to_available_input' };
    },
    record(before, _after, _command, _first, _second, proposal) {
      if (proposal.initial) probedEpoch = before.level_epoch;
      else stoppedEpoch = before.level_epoch;
      return { events: [] };
    },
    state: () => ({ probedEpoch, stoppedEpoch }),
    restore(value) {
      probedEpoch = typeof value.probedEpoch === 'number' ? value.probedEpoch : null;
      stoppedEpoch = typeof value.stoppedEpoch === 'number' ? value.stoppedEpoch : null;
    },
  };
}

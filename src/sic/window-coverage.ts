import { measure, plansCooperative } from '../logos-engine/v6-window-question-geometry.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const windowCoverageId = 'sic_window_coverage';
export const windowCoverageStrategies = {
  adjust_coverage_field: 'Adjust a receiver field toward coverage of the visible sequence',
  test_configured_coverage: 'Run the receivers with their current settings',
} as const;
const graph = compileStrategyGraph({ id: 'cover_ordered_sequence_with_visible_windows', version: 1, order: 'FALLBACK',
  priorities: ['test_configured_coverage', 'adjust_coverage_field'],
  strategies: {
    adjust_coverage_field: [{ fact: 'edit', expected: true, label: 'An available setting would help cover the complete sequence under the current model' }],
    test_configured_coverage: [{ fact: 'ready', expected: true, label: 'The current settings cover the complete sequence under the current model' }],
  },
}, ['edit', 'ready']);
const model = { maximal_group_required: false, one_use_for_run: true, configuration_bound: 4096,
  receiver_order_hypothesis: 'visual_reading_order_not_rail_law',
  dual_field_operation_hypothesis: 'PAINT', single_field_operation_hypothesis: 'CAPTURE' };
type Field = 'capacity' | 'filter' | 'second_field';
type Value = number | null;
type Window = { bbox: NativeBox; capacity: number; capacity_domain: number[]; filter: Value; filter_domain: number[];
  second_field: { value: number; domain: number[] } | null };
type Measured = { boxes: Window[]; word: { bbox: NativeBox; value: number }[]; colors: number[] };
type Edit = { box: number; field: Field; point: NativePoint; desired: Value };
type State = { epoch: number; tried: string[]; evidence: string[]; stopped: boolean };
type Proposal = NativeProposal & { local: State; measurement: Measured; edit: Edit | null; expected: Value; attempt: string; needId: string };
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const value = (box: Window, field: Field) => field === 'second_field' ? box.second_field?.value ?? null : box[field];
const settings = (box: Window) => [box.capacity, box.filter, box.second_field?.value ?? null];
function fieldDomain(box: Window, field: Field): number[] {
  if (field === 'second_field') return box.second_field?.domain ?? [];
  return field === 'capacity' ? box.capacity_domain : box.filter_domain;
}

function verifiesEdit(proposal: Proposal, rows: NativeRows) {
  const next = measure(rows) as Measured | null;
  const { edit, measurement, expected } = proposal;
  if (!edit || !next || !equal(measurement.word, next.word) || next.boxes.length !== measurement.boxes.length) return false;
  return measurement.boxes.every((previous, i) => {
    const current = next.boxes[i]!;
    if (!equal(previous.bbox, current.bbox)) return false;
    const untouched = (['capacity', 'filter', 'second_field'] as const).filter(field => i !== edit.box || field !== edit.field);
    return untouched.every(field => equal(value(previous, field), value(current, field))) &&
      (i !== edit.box || value(current, edit.field) === expected);
  });
}

export function createSicWindowCoverage(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: windowCoverageId,
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6') || !observation.available_action_refs.includes('ACTION5')) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      if (prior?.stopped || (prior?.tried.length ?? 0) >= 18) return null;
      const measurement = measure(rows) as Measured | null;
      if (!measurement || measurement.boxes.length > 5 || measurement.word.length > 20) return null;
      const [choices, receipt] = await plansCooperative(measurement, model, execution);
      if (receipt.truncated) return null;
      const goal = choices.filter(candidate => candidate.cost <= remaining).sort((a, b) => a.cost - b.cost)[0];
      if (!goal) return null;
      const local = prior ?? { epoch: observation.level_epoch, tried: [], evidence: [], stopped: false };
      const edit = (goal.edits[0] ?? null) as Edit | null;
      let expected: Value = null;
      if (edit) {
        const box = measurement.boxes[edit.box]!, domain = fieldDomain(box, edit.field);
        const at = domain.findIndex(item => item === value(box, edit.field));
        if (at < 0 || domain.length < 2) return null;
        expected = domain[(at + 1) % domain.length]!;
      }
      const command: NativeCommand = edit ? { action_ref: 'ACTION6', data: { x: edit.point[0], y: edit.point[1] } }
        : { action_ref: 'ACTION5', data: {} };
      const attempt = JSON.stringify([measurement.boxes.map(settings), command]);
      if (local.tried.includes(attempt)) return null;
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...local.evidence.filter(item => item !== ref)];
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active', facts: {
        edit: { value: !!edit, evidence }, ready: { value: !edit, evidence },
      }, planners: { adjust_coverage_field: () => command, test_configured_coverage: () => command } });
      if (!selected) return null;
      const strategy = selected.id, label = windowCoverageStrategies[strategy], parent = 'G_official_completion';
      const objective = { kind: 'cover_visible_sequence', scope: ref.split(':revision:', 1)[0]!, subjects: ['visible_sequence', 'receiver_windows'],
        parentObjective: parent, satisfactionContract: 'observe_official_progress_after_running_the_configured_receivers' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence }, id = `window-coverage:${need.id}`;
      const actions = [command];
      const binding = edit && await ObservedInputDomain.makeLocusWitness(observation, rows, edit.point, { reason: label, evidence });
      const word = measurement.word.map(unit => unit.bbox);
      const sequence = [word[0]![0], word[0]![1], word.at(-1)![2], word.at(-1)![3]];
      return { status: 'proposed', kind: windowCoverageId, actions, local, measurement, edit, expected, attempt, needId: need.id,
        steps: [{ action: command, expected_after: null, ...(binding ? { point_binding: binding } : {}) }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Configure the receivers to cover the visible sequence', mode: edit ? 'assimilation' : 'solving',
          situation: edit ? 'The measured settings admit a conditional plan. Compare the field after this click.' :
            'The current settings cover all visible units in the model. The launch still needs a real return.',
          agenda: entries, evidence, sequence, receivers: measurement.boxes.map(box => box.bbox) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'visible_window_settings_bound' : 'visible_window_settings_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true,
        reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      const matched = verifiesEdit(proposal, second);
      return { matched, seal_prefix: true, reason: matched ? 'receiver_edit_observed' : 'receiver_coverage_unconfirmed' };
    },
    record(before, after, _command, _first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local } = proposal;
      state = { ...local, tried: [...local.tried, proposal.attempt], stopped: !verifiesEdit(proposal, second),
        evidence: [...local.evidence.slice(-4), after.observation_ref] };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}

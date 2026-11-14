import { measure, plansCooperative } from '../logos-engine/v6-window-question-geometry.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { navigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';
import { chooseInteraction, interactionModule } from './observed-interaction-card.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const windowCoverageId = 'sic_window_coverage';
export const learnWindowCoverageId = 'sic_configure_observed_receiver_fields';
export const windowCoverageStrategies = {
  P02: navigationPrimitives.P02,
  P05: navigationPrimitives.P05,
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
type CapacityControl = { box: NativeBox; command: string; increment: 1 | -1 };
type State = { epoch: number; tried: string[]; evidence: string[]; stopped: boolean; control?: CapacityControl };
type Proposal = NativeProposal & { local: State; measurement: Measured; edit: Edit | null; expected: Value; attempt: string; needId: string };
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const value = (box: Window, field: Field) => field === 'second_field' ? box.second_field?.value ?? null : box[field];
const settings = (box: Window) => [box.capacity, box.filter, box.second_field?.value ?? null];
const captureSettings = (rows: NativeRows) => measure(rows) as Measured | null;
function fieldDomain(box: Window, field: Field): number[] {
  if (field === 'second_field') return box.second_field?.domain ?? [];
  return field === 'capacity' ? box.capacity_domain : box.filter_domain;
}

const cyclicIndex = (index: number, length: number) => (index + length) % length;

function acquiredCapacity(before: Measured, after: Measured, command: string): CapacityControl | null {
  const structure = (scene: Measured) => scene.boxes.map(box => [box.bbox, box.capacity_domain, box.filter, box.filter_domain, box.second_field]);
  if (!equal(before.word, after.word) || !equal(structure(before), structure(after))) return null;
  const changed = after.boxes.filter((box, index) => before.boxes[index]!.capacity !== box.capacity);
  if (changed.length !== 1) return null;
  const box = changed[0]!, domain = box.capacity_domain;
  if (domain.length < 3) return null;
  const prior = before.boxes.find(item => equal(item.bbox, box.bbox))!;
  const from = domain.indexOf(prior.capacity), to = domain.indexOf(box.capacity);
  if (from < 0 || to < 0) return null;
  const increment = ([1, -1] as const).find(step => cyclicIndex(from + step, domain.length) === to);
  return increment ? { box: box.bbox, command, increment } : null;
}

function reuseCapacity(control: CapacityControl | undefined, box: Window, edit: Edit, from: number, domain: number[]) {
  if (!control || edit.field !== 'capacity' || !equal(control.box, box.bbox)) return null;
  if (control.increment === 1) return control;
  const goal = edit.desired === null ? -1 : domain.indexOf(edit.desired);
  if (goal < 0) return null;
  const forward = cyclicIndex(goal - from, domain.length), backward = cyclicIndex(from - goal, domain.length);
  return backward <= forward ? control : null;
}

function verifiesEdit(proposal: Proposal, rows: NativeRows) {
  const next = captureSettings(rows);
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

export function createSicWindowCoverage(family = windowCoverageId): NativeFamily<Proposal> {
  const learns = family === learnWindowCoverageId;
  let state: State | null = null;
  let decide: NativeProgramHandle | undefined;
  return {
    id: family,
    async attachPrograms(registry) {
      if (learns) decide = await registry.registerProgram(chooseInteraction, {}, await interactionModule());
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6') || !observation.available_action_refs.includes('ACTION5')) return null;
      const ref = observation.observation_ref;
      const prior = state?.epoch === observation.level_epoch && (!learns || state.evidence.at(-1) === ref) ? state : null;
      if (prior?.stopped || (prior?.tried.length ?? 0) >= 18) return null;
      if (learns && !prior && !execution?.readPriorDirectionalScene) return null;
      const measurement = captureSettings(rows);
      if (!measurement || measurement.boxes.length > 5 || measurement.word.length > 20) return null;
      const directionalReturn = learns && !prior ? execution?.readPriorDirectionalScene?.(captureSettings) : null;
      const acquired = directionalReturn?.afterRef === ref && directionalReturn.levelEpoch === observation.level_epoch
        ? acquiredCapacity(directionalReturn.scene, measurement, directionalReturn.command) : null;
      if (learns && !prior && !acquired) return null;
      const [choices, receipt] = await plansCooperative(measurement, model, execution);
      if (receipt.truncated) return null;
      const goal = choices.filter(candidate => candidate.cost <= remaining).sort((a, b) => a.cost - b.cost)[0];
      if (!goal) return null;
      const local: State = prior ?? { epoch: observation.level_epoch, tried: [],
        evidence: directionalReturn && acquired ? [directionalReturn.beforeRef, ref] : [],
        stopped: false, ...(acquired ? { control: acquired } : {}) };
      const edit = (goal.edits[0] ?? null) as Edit | null;
      let expected: Value = null;
      let reused: CapacityControl | null = null;
      if (edit) {
        const box = measurement.boxes[edit.box]!, domain = fieldDomain(box, edit.field);
        const at = domain.findIndex(item => item === value(box, edit.field));
        if (at < 0 || domain.length < 2) return null;
        reused = reuseCapacity(local.control, box, edit, at, domain);
        if (reused && !observation.available_action_refs.includes(reused.command)) reused = null;
        expected = domain[cyclicIndex(at + (reused?.increment ?? 1), domain.length)]!;
      }
      const command: NativeCommand = reused ? { action_ref: reused.command, data: {} }
        : edit ? { action_ref: 'ACTION6', data: { x: edit.point[0], y: edit.point[1] } }
        : { action_ref: 'ACTION5', data: {} };
      const attempt = JSON.stringify([measurement.boxes.map(settings), command]);
      if (local.tried.includes(attempt)) return null;
      const evidence: [string, ...string[]] = [ref, ...local.evidence.filter(item => item !== ref)];
      const mode = execution?.reasoningMode ?? 'exploration';
      const facts = { probeNeededInteraction: !reused, repeatSupportedInteraction: !!reused, mode };
      const decision = learns ? await decide?.run({ situation: facts }, { signal: execution?.signal }) : null;
      const primitive = reused ? 'P02' : 'P05';
      if (learns && decision?.result !== primitive) return null;
      const agenda = learns ? null : resolveStrategyGraph({ graph, mode: 'active', facts: {
        edit: { value: !!edit, evidence }, ready: { value: !edit, evidence },
      }, planners: { adjust_coverage_field: () => command, test_configured_coverage: () => command } });
      const strategy = learns ? primitive : agenda?.selected?.id;
      if (!strategy) return null;
      const label = windowCoverageStrategies[strategy], parent = 'G_official_completion';
      const objective = { kind: 'cover_visible_sequence', scope: ref.split(':revision:', 1)[0]!, subjects: ['visible_sequence', 'receiver_windows'],
        parentObjective: parent, satisfactionContract: 'observe_official_progress_after_running_the_configured_receivers' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence }, id = `window-coverage:${need.id}`;
      const actions = [command];
      const binding = edit && !reused && await ObservedInputDomain.makeLocusWitness(observation, rows, edit.point, { reason: label, evidence });
      const word = measurement.word.map(unit => unit.bbox);
      const sequence = [word[0]![0], word[0]![1], word.at(-1)![2], word.at(-1)![3]];
      return { status: 'proposed', kind: family, actions, local, measurement, edit, expected, attempt, needId: need.id,
        steps: [{ action: command, expected_after: null, ...(binding ? { point_binding: binding } : {}) }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        ...(decision ? { sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation: facts } } : {}),
        sicSituationCard: { strategy, need: 'Configure the receivers to cover the visible sequence', mode: learns ? mode : edit ? 'assimilation' : 'solving',
          situation: reused ? `Reuse the measured direction and verify that the selected receiver changes to capacity ${expected}.`
            : edit ? 'The measured settings admit a conditional plan. Compare the field after this click.' :
            'The current settings cover all visible units in the model. The launch still needs a real return.',
          agenda: agenda?.entries ?? [], evidence, sequence, receivers: measurement.boxes.map(box => box.bbox),
          ...(decision ? { triggerCard: decision.receipt.workflow } : {}) },
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
    record(before, after, command, _first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { control, ...local } = proposal.local;
      state = { ...local, ...(control?.command === command.action_ref ? { control } : {}),
        tried: [...local.tried, proposal.attempt], stopped: !verifiesEdit(proposal, second),
        evidence: [...local.evidence.slice(-4), after.observation_ref] };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}

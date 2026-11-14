import { framedRows } from '../logos-engine/v6-coupled-displays.ts';
import { isJsonObject } from '../logos-engine/canonical.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord } from '../logos-engine/v6-native-types.ts';
import { contrastCheck, contrastControlOperations, contrastControlsModule, contrastControlsWorkflow,
  contrastNeed, contrastPrimitive, contrastReturnWorkflow } from './contrast-controls-card.ts';
import { sicNeedId } from './need-identity.ts';
import { solidRegionValue } from './observed-click-regions.ts';

export const contrastControlsId = 'sic_contrast_controls';
export const contrastControlsStrategies = { contrast_observed_controls: 'Test a different control after a measured remote effect' } as const;
const strategy = contrastPrimitive;
const label = contrastControlsStrategies[strategy];
const parent = 'G_official_completion';
const inside = ([l, t, r, b]: NativeBox, [x, y]: NativePoint) => l - 1 <= x && x <= r + 1 && t - 1 <= y && y <= b + 1;
const center = ([l, t, r, b]: NativeBox): NativePoint => [Math.floor((l + r) / 2), Math.floor((t + b) / 2)];
const ids = (a: readonly (number | null)[], b: readonly (number | null)[]) => a.flatMap((value, i) => value === b[i] ? [] : [i]);

type State = { epoch: number; used: boolean };
type Proposal = NativeProposal & { receivers: NativeBox[]; check: typeof contrastCheck; minimumChanges: number; needId: string };

export function createSicContrastControls(): NativeFamily<Proposal> {
  let program: NativeProgramHandle | undefined;
  let verify: NativeProgramHandle | undefined;
  let state: State | null = null;
  return {
    id: contrastControlsId,
    async attachPrograms(registry) {
      const module = await contrastControlsModule();
      program = await registry.registerProgram(contrastControlsWorkflow, contrastControlOperations, module);
      verify = await registry.registerProgram(contrastReturnWorkflow, contrastControlOperations, module);
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      if (!program || !execution?.readClickRegions || remaining < 1 ||
        state?.epoch === observation.level_epoch && state.used ||
        observation.available_action_refs.some(ref => /^ACTION[1-5]$/.test(ref)) ||
        !observation.available_action_refs.includes('ACTION6')) return null;
      const groups = framedRows(observation, rows);
      const candidates = groups.flatMap(controls => {
        if (controls.length < 3) return [];
        return groups.flatMap(receivers => {
          if (controls === receivers || controls.length !== receivers.length || Math.abs(controls[0]![1] - receivers[0]![1]) < 4) return [];
          const receipt = execution.readClickRegions!([...controls, ...receivers]);
          if (!receipt || receipt.afterRef !== observation.observation_ref || receipt.levelEpoch !== observation.level_epoch ||
            receipt.before.some(value => value === null) || receipt.after.some(value => value === null)) return [];
          const count = controls.length, before = receipt.before.slice(0, count), after = receipt.after.slice(0, count);
          const changed = ids(before, after), remote = ids(receipt.before.slice(count), receipt.after.slice(count));
          const [source] = changed;
          if (source === undefined || !inside(controls[source]!, receipt.point)) return [];
          return [{ controls, receivers, source, receipt, changedControls: changed.length, changedIndicators: remote.length,
            previousControlsUniform: new Set(before).size === 1, options: controls.flatMap((box, index) =>
            after[index] === before[index] ? [{ index, separation: Math.abs(center(box)[0] - center(controls[source]!)[0]) }] : []) }];
        });
      });
      if (candidates.length !== 1) return null;
      const { controls, receivers, source, receipt, changedControls, changedIndicators, previousControlsUniform, options } = candidates[0]!;
      const mode = execution.reasoningMode ?? 'exploration';
      const { result, receipt: src } = await program.run({
        situation: { mode, need: contrastNeed, pointOnChangedControl: true, previousControlsUniform, changedControls, changedIndicators, options },
      }, { signal: execution.signal });
      if (!isJsonObject(result) || result.need !== contrastNeed || result.primitive !== contrastPrimitive ||
        result.check !== contrastCheck || typeof result.minimumChanges !== 'number' ||
        !Number.isSafeInteger(result.minimumChanges) || result.minimumChanges < 1 || result.minimumChanges > receivers.length) return null;
      const target = isJsonObject(result.target) && typeof result.target.index === 'number' ? result.target.index : -1;
      if (!options.some(option => option.index === target)) return null;
      const [x, y] = center(controls[target]!), command = { action_ref: 'ACTION6', data: { x, y } };
      const ref = observation.observation_ref, evidence = [receipt.beforeRef, ref];
      const binding = await ObservedInputDomain.makeLocusWitness(observation, rows, [x, y], { reason: label, evidence });
      if (!binding) return null;
      const goal = { kind: result.need, scope: ref.split(':revision:', 1)[0]!,
        subjects: ['control_row', 'indicator_row'], parentObjective: parent, satisfactionContract: result.check };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = contrastControlsId + ':' + need.id;
      return {
        status: 'proposed', kind: contrastControlsId, actions: [command], receivers, check: result.check, minimumChanges: result.minimumChanges, needId: need.id,
        steps: [{ action: command, expected_after: null, point_binding: binding }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Compare how two controls affect the same indicators', situation: label, evidence, mode,
          agenda: [], control: controls[target], source: controls[source], receivers },
        sicSrcDecision: { workflow: src.workflow, hash: src.src_hash, instructions: src.instructions, edited: 'edited' in src && src.edited === true,
          check: result.check, minimumChanges: result.minimumChanges },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          evidence, preconditions: {}, preserve_refs: [], actions: [command], outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'control_comparison_bound' : 'control_comparison_context_changed' };
    },
    async after(proposal, _index, before, after, first, second) {
      const scored = after.levels_completed > before.levels_completed;
      if (scored) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' as const } };
      const stateOf = (boxes: NativeBox[], rows: typeof first) => boxes.map(box => solidRegionValue(rows, box));
      const beforeValues = stateOf(proposal.receivers, first), afterValues = stateOf(proposal.receivers, second);
      const changes = beforeValues.every(value => value !== null) && afterValues.every(value => value !== null)
        ? ids(beforeValues, afterValues).length : null;
      const check = await verify?.run({ outcome: { check: proposal.check, minimumChanges: proposal.minimumChanges, changes } });
      const matched = typeof check?.result === 'boolean' ? check.result : null;
      return { matched, seal_prefix: true,
        reason: matched === true ? 'comparison_changed_indicators' : matched === false ? 'comparison_did_not_confirm_remote_effect' : 'indicator_measurement_unavailable',
        ...(check ? { src_check: { workflow: check.receipt.workflow, hash: check.receipt.src_hash, changes } } : {}),
        ...(matched ? { sic_need: { id: proposal.needId, status: 'satisfied' as const } } : {}) };
    },
    record(before) {
      state = { epoch: before.level_epoch, used: true };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}

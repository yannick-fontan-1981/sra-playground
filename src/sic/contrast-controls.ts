import { isJsonObject } from '../logos-engine/canonical.ts';
import { framedRows } from '../logos-engine/v6-coupled-displays.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord } from '../logos-engine/v6-native-types.ts';
import { contrastCheck, contrastControlOperations, contrastControlsModule, contrastControlsWorkflow,
  contrastNeed, contrastPrimitive, contrastReturnWorkflow } from './contrast-controls-card.ts';
import { sicNeedId } from './need-identity.ts';
import { regionChanged, solidRegionValue, type ClickRegionChanges } from './observed-click-regions.ts';

export const contrastControlsId = 'sic_contrast_controls';
export const contrastProbeId = 'sic_probe_control_grid';
export const contrastControlsStrategies = { contrast_observed_controls: 'Test a different control after a measured remote effect' } as const;
const strategy = contrastPrimitive;
const label = contrastControlsStrategies[strategy];
const parent = 'G_official_completion';
const inside = ([l, t, r, b]: NativeBox, [x, y]: NativePoint) => l - 1 <= x && x <= r + 1 && t - 1 <= y && y <= b + 1;
const center = ([l, t, r, b]: NativeBox): NativePoint => [Math.floor((l + r) / 2), Math.floor((t + b) / 2)];
type State = { epoch: number; controls: NativeBox[]; receivers: NativeBox[]; tried: number[] };
type Proposal = NativeProposal & State & { check: typeof contrastCheck; minimumChanges: number; needId: string };
type Candidate = Omit<State, 'epoch'> & {
  source: number;
  receipt: ClickRegionChanges | null;
  changedControls: number;
  changedIndicators: number;
  previousControlsUniform: boolean;
  options: { index: number; separation: number }[];
};

export function createSicContrastControls(id = contrastControlsId): NativeFamily<Proposal> {
  const initialProbe = id === contrastProbeId;
  let program: NativeProgramHandle | undefined;
  let verify: NativeProgramHandle | undefined;
  let state: State | null = null;
  return {
    id,
    async attachPrograms(registry) {
      const module = await contrastControlsModule();
      program = await registry.registerProgram(contrastControlsWorkflow, contrastControlOperations, module);
      verify = await registry.registerProgram(contrastReturnWorkflow, contrastControlOperations, module);
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      if (!program || (!initialProbe && !execution?.readClickRegionChanges) || remaining < 1 ||
        observation.available_action_refs.some(ref => /^ACTION[1-5]$/.test(ref)) ||
        !observation.available_action_refs.includes('ACTION6')) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      if (initialProbe && prior) return null;
      const groups = initialProbe ? framedRows(observation, rows) : execution?.readPriorFramedRows?.() ?? [];
      const candidates = (prior ? [prior.controls] : groups).flatMap<Candidate>(controls => {
        if (controls.length < 3) return [];
        const receivers = prior?.receivers ?? groups.filter(group => group !== controls && controls.length === group.length
          && Math.abs(controls[0]![1] - group[0]![1]) >= 4).flat();
        if (!receivers.length) return [];
        if (initialProbe) {
          if (receivers.length < 2 * controls.length || receivers.some((box, index) => {
            const original = controls[index % controls.length]!;
            return box[0] !== original[0] || box[2] !== original[2];
          })) return [];
          const values = [...controls, ...receivers].map(box => solidRegionValue(rows, box));
          if (values[0] === null || new Set(values).size !== 1) return [];
          return [{ controls, receivers, source: 0, receipt: null, tried: [], changedControls: 0, changedIndicators: 0,
            previousControlsUniform: true, options: controls.map((_, index) => ({ index, separation: index })) }];
        }
        const receipt = execution?.readClickRegionChanges?.([...controls, ...receivers]);
        if (!receipt || receipt.afterRef !== observation.observation_ref || receipt.levelEpoch !== observation.level_epoch) return [];
        const count = controls.length, before = receipt.beforeUniform.slice(0, count);
        const changed = receipt.changed.slice(0, count), remote = receipt.changed.slice(count);
        const source = changed.findIndex((value, index) => value && inside(controls[index]!, receipt.point));
        if (source < 0) return [];
        const tried = [...new Set([...(prior?.tried ?? []), source])];
        return [{ controls, receivers, source, receipt, tried, changedControls: changed.filter(Boolean).length,
          changedIndicators: remote.filter(Boolean).length, previousControlsUniform: before[0] !== null && new Set(before).size === 1,
          options: controls.flatMap((box, index) => !tried.includes(index) && !changed[index]
            ? [{ index, separation: Math.abs(center(box)[0] - center(controls[source]!)[0]) }] : []) }];
      });
      if ((!initialProbe && candidates.length !== 1) || !candidates.length) return null;
      if (initialProbe) candidates.sort((a, b) => a.controls[0]![1] - b.controls[0]![1]);
      const { controls, receivers, source, receipt, tried, changedControls, changedIndicators, previousControlsUniform, options } = candidates[0]!;
      const mode = execution?.reasoningMode ?? 'exploration';
      const { result, receipt: src } = await program.run({
        situation: { mode, need: contrastNeed, pointOnChangedControl: true, previousControlsUniform, changedControls, changedIndicators,
          continuing: !!prior, initialProbe, options },
      }, { signal: execution?.signal });
      if (!isJsonObject(result) || result.need !== contrastNeed || result.primitive !== contrastPrimitive ||
        result.check !== contrastCheck || typeof result.minimumChanges !== 'number' ||
        !Number.isSafeInteger(result.minimumChanges) || result.minimumChanges < 1 || result.minimumChanges > receivers.length) return null;
      const target = isJsonObject(result.target) && typeof result.target.index === 'number' ? result.target.index : -1;
      if (!options.some(option => option.index === target)) return null;
      const [x, y] = center(controls[target]!), command = { action_ref: 'ACTION6', data: { x, y } };
      const ref = observation.observation_ref, evidence = receipt ? [receipt.beforeRef, ref] : [ref];
      const binding = await ObservedInputDomain.makeLocusWitness(observation, rows, [x, y], { reason: label, evidence });
      if (!binding) return null;
      const goal = { kind: result.need, scope: ref.split(':revision:', 1)[0]!,
        subjects: ['control_row', 'indicator_row'], parentObjective: parent, satisfactionContract: result.check };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const planId = id + ':' + need.id;
      return {
        status: 'proposed', kind: id, actions: [command], controls, receivers, tried: [...tried, target],
        epoch: observation.level_epoch, check: result.check, minimumChanges: result.minimumChanges, needId: need.id,
        steps: [{ action: command, expected_after: null, point_binding: binding }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Compare how two controls affect the same indicators', situation: label, evidence, mode,
          agenda: [], control: controls[target], source: receipt ? controls[source] : null, receivers },
        sicSrcDecision: { workflow: src.workflow, hash: src.src_hash, instructions: src.instructions, edited: 'edited' in src && src.edited === true,
          check: result.check, minimumChanges: result.minimumChanges },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id: planId, observed: false, open_question: label, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id: planId, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: planId, objective_ref: parent, purpose: label,
          evidence, preconditions: {}, preserve_refs: [], actions: [command], outcome_guard: { path: ['value'], contains: planId } },
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
      const changes = proposal.receivers.filter(box => regionChanged(first, second, box)).length;
      const check = await verify?.run({ outcome: { check: proposal.check, minimumChanges: proposal.minimumChanges, changes } });
      const matched = typeof check?.result === 'boolean' ? check.result : null;
      return { matched, seal_prefix: true,
        reason: matched === true ? 'comparison_changed_indicators' : matched === false ? 'comparison_did_not_confirm_remote_effect' : 'indicator_measurement_unavailable',
        ...(check ? { src_check: { workflow: check.receipt.workflow, hash: check.receipt.src_hash, changes } } : {}),
        ...(matched ? { sic_need: { id: proposal.needId, status: 'satisfied' as const } } : {}) };
    },
    record(_before, _after, _command, _first, _second, { epoch, controls, receivers, tried }) {
      state = { epoch, controls, receivers, tried };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}

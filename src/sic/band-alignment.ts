import { bandEffect, bandQuantities, findBandPath, measureBandGeometry, type BandSense } from '../logos-engine/v6-band-transfer.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativeProposal, NativeRecord } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const bandAlignmentId = 'sic_band_alignment';
export const bandAlignmentStrategies = {
  measure_transfer_direction: 'Measure how the control transfers between bands',
  align_bands_by_transfer: 'Compose transfers to align the markers',
} as const;
const graph = compileStrategyGraph({ id: 'align_markers_by_adjacent_transfer', version: 1, order: 'FALLBACK',
  priorities: ['align_bands_by_transfer', 'measure_transfer_direction'],
  strategies: {
    align_bands_by_transfer: [{ fact: 'route', expected: true, label: 'Measured transfers predict a route toward alignment' }],
    measure_transfer_direction: [{ fact: 'trial', expected: true, label: 'A visible control can test the transfer hypothesis' }],
  },
}, ['route', 'trial']);
type Model = NonNullable<ReturnType<typeof measureBandGeometry>>;
type Trial = [number[], number];
type State = { epoch: number; model: Model | null; sense: BandSense | null; tried: Trial[]; blocked: Trial[]; rejected: boolean;
  start: number[]; evidence: string[] };
type Proposal = NativeProposal & { model: Model; current: number[]; start: number[]; control: number; expected: number[] | null; needId: string };
const empty = (epoch = 0): State => ({ epoch, model: null, sense: null, tried: [], blocked: [], rejected: false, start: [], evidence: [] });
const equal = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((value, i) => value === b[i]);
const senses = ['into_clicked', 'away_from_clicked'] as const;

export function createSicBandAlignment(): NativeFamily<Proposal> {
  let state = empty();
  return {
    id: bandAlignmentId,
    async propose(observation, rows, inputs, remaining) {
      const local = state.epoch === observation.level_epoch ? state : empty(observation.level_epoch);
      if (remaining < 1 || local.rejected || local.tried.length >= 32 || !observation.available_action_refs.includes('ACTION6')) return null;
      const model = local.model ?? measureBandGeometry(observation, rows, inputs);
      if (!model || model.controls.length > 6 || model.probes.length > 4) return null;
      const current = bandQuantities(rows, model);
      if (!current.length || Object.entries<number>(model.targets).every(([i, value]) => current[Number(i)] === value)) return null;
      const start = local.start.length ? local.start : current;
      for (const { band, reference, mobile, color } of model.markers) {
        const box = [...mobile] as [number, number, number, number];
        const axis = model.axis as 0 | 1, delta = model.side * (current[band]! - start[band]!);
        box[axis] += delta;
        box[axis + 2] = box[axis + 2]! + delta;
        const visible = ([l, t, r, b]: NativeBox) => l >= 0 && t >= 0 && r < rows[0]!.length && b < rows.length
          && rows.slice(t, b + 1).every(row => row.slice(l, r + 1).every(pixel => pixel === color));
        if (!visible(reference) || !visible(box)) return null;
      }
      const path = local.sense ? findBandPath(current, model.targets, local.sense, model.step, local.blocked, Math.min(remaining, 24)) : [];
      const trial = (model.controls as NativeCommand[]).findIndex((_, i) => !local.tried.some(([before, index]) => i === index && equal(current, before)));
      const control = path[0] ?? trial;
      if (control < 0) return null;
      const command = model.controls[control] as NativeCommand;
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...local.evidence.slice(-4)];
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active',
        facts: { route: { value: !!path.length, evidence }, trial: { value: trial >= 0, evidence } },
        planners: { align_bands_by_transfer: () => command, measure_transfer_direction: () => command } });
      if (!selected) return null;
      const strategy = selected.id, label = bandAlignmentStrategies[strategy], objective = 'G_official_completion';
      const goal = { kind: 'align_band_markers', scope: ref.split(':revision:', 1)[0]!,
        subjects: Object.keys(model.targets), parentObjective: objective, satisfactionContract: 'observe_official_progress_after_marker_alignment' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `band-alignment:${need.id}`, actions = [command];
      const witness = await ObservedInputDomain.makeLocusWitness(observation, rows, [command.data.x!, command.data.y!], { reason: label, evidence });
      const expected = local.sense ? bandEffect(current, control, local.sense, model.step) : null;
      return { status: 'proposed', kind: bandAlignmentId, actions, model, current, start, control, expected, needId: need.id,
        steps: [{ action: command, point_binding: witness, expected_after: expected }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Bring the moving markers into alignment with the fixed markers',
          mode: path.length ? 'solving' : 'exploration', situation: label, agenda: entries, evidence,
          addressedRegion: model.boxes[control], subjects: model.markers.flatMap((marker: { reference: NativeBox; mobile: NativeBox }) =>
            [marker.reference, marker.mobile]).slice(0, 6), ...(path.length ? { distance: path.length } : {}) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${objective}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent: objective }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: objective, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'current_band_scope_bound' : 'band_scope_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      const scored = after.levels_completed > before.levels_completed;
      const matched = !scored && proposal.expected ? equal(bandQuantities(second, proposal.model), proposal.expected) : null;
      return { matched, seal_prefix: true, reason: scored ? 'official_boundary' : matched === false ? 'band_transfer_contradicted' : 'observed_band_return',
        ...(scored ? { sic_need: { id: proposal.needId, status: 'satisfied' } } : {}) };
    },
    record(before, after, _command, _first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      if (state.epoch !== before.level_epoch) {
        state = empty(before.level_epoch);
        state.start = proposal.start;
        state.model = proposal.model;
      }
      const { current, control, model } = proposal;
      const next = bandQuantities(second, model), test: Trial = [current, control];
      state.tried.push(test);
      if (equal(current, next)) {
        state.blocked.push(test);
      } else {
        const rivals = senses.filter(sense => equal(next, bandEffect(current, control, sense, model.step)));
        if (rivals.length === 1 && (!state.sense || rivals[0] === state.sense)) {
          state.sense = rivals[0]!;
          state.evidence.push(after.observation_ref);
        } else state.rejected = true;
      }
      return { events: [] };
    },
    state: () => ({ ...state }),
    restore(value: NativeRecord) { state = structuredClone(value as State); },
  };
}

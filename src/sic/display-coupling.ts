import { framedRows, value } from '../logos-engine/v6-coupled-displays.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativeObservation, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const displayCouplingId = 'sic_display_coupling';
export const displayCouplingStrategies = {
  test_aligned_switch: 'Test a switch near a distinct indicator',
  vary_coupled_switches: 'Compare another switch after the indicator row changes',
} as const;
const graph = compileStrategyGraph({ id: 'relate_switches_to_indicators', version: 1, order: 'FALLBACK',
  priorities: ['vary_coupled_switches', 'test_aligned_switch'],
  strategies: {
    test_aligned_switch: [{ fact: 'untested', expected: true, label: 'A control is horizontally near a minority value in a separate indicator row' }],
    vary_coupled_switches: [{ fact: 'coupled', expected: true, label: 'An earlier click changed its own control and the separate indicators' }],
  },
}, ['untested', 'coupled']);
type State = { epoch: number; controls: NativeBox[]; receivers: NativeBox[]; initial: number; attempts: string[]; inert: number[];
  visited: string[]; coupled: boolean; count: number; stopped: boolean; evidence: string[] };
type Proposal = NativeProposal & { local: State; index: number; controls: number[]; receivers: number[]; attempt: string; needId: string };
const values = (rows: NativeRows, boxes: NativeBox[]) => {
  const measured = boxes.map(box => value(rows, box));
  return measured.some(color => color === null) ? null : measured as number[];
};

function measure(observation: NativeObservation, rows: NativeRows): State | null {
  const groups = framedRows(observation, rows);
  const candidates = groups.flatMap(controls => {
    const initial = values(rows, controls);
    if (controls.length < 3 || !initial || new Set(initial).size !== 1) return [];
    const rowWidth = ([l, , r]: NativeBox) => r - l + 1;
    const rowHeight = ([, t, , b]: NativeBox) => b - t + 1;
    return groups.filter(receivers => receivers !== controls && receivers.length === controls.length
      && rowHeight(receivers[0]!) === rowHeight(controls[0]!)
      && rowWidth(receivers[0]!) > rowWidth(controls[0]!)
      && Math.abs(receivers[0]![1] - controls[0]![1]) >= 4 * rowHeight(controls[0]!)
      && new Set(values(rows, receivers)).size >= 2).map(receivers => ({ controls, receivers, initial: initial[0]! }));
  });
  return candidates.length === 1 ? { ...candidates[0]!, epoch: observation.level_epoch, attempts: [], inert: [],
    visited: [], coupled: false, count: 0, stopped: false, evidence: [] } : null;
}

export function createSicDisplayCoupling(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: displayCouplingId,
    async propose(observation, rows, _inputs, remaining) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const local = state?.epoch === observation.level_epoch ? state : measure(observation, rows);
      if (!local || local.stopped || local.count >= 12) return null;
      const controls = values(rows, local.controls), receivers = values(rows, local.receivers);
      if (!controls || !receivers) return null;
      const alternative = [...new Set(controls.filter(color => color !== local.initial))];
      if (alternative.length > 1) return null;
      const frequency = receivers.map(color => receivers.filter(value => value === color).length);
      const minority = local.receivers.filter((_, index) => frequency[index] === Math.min(...frequency));
      const options = local.controls.map(([l, t, r, b], index) => {
        const projected = controls.map((color, i) => i !== index ? color : color === local.initial ? alternative[0] ?? null : local.initial);
        return { index, point: [Math.floor((l + r) / 2), Math.floor((t + b) / 2)] as const,
          attempt: JSON.stringify([index, controls, receivers]), repeated: local.visited.includes(JSON.stringify(projected)),
          distance: Math.min(...minority.map(([x, , right]) => Math.abs(l + r - x - right))) };
      }).filter(option => !local.inert.includes(option.index) && !local.attempts.includes(option.attempt))
        .sort((a, b) => Number(a.repeated) - Number(b.repeated) || a.distance - b.distance || a.index - b.index);
      const option = options[0];
      if (!option) return null;
      const [x, y] = option.point, command = { action_ref: 'ACTION6', data: { x, y } };
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...local.evidence.filter(value => value !== ref)];
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active', facts: {
        untested: { value: true, evidence }, coupled: { value: local.coupled, evidence },
      }, planners: { test_aligned_switch: () => command, vary_coupled_switches: () => command } });
      if (!selected) return null;
      const strategy = selected.id, label = displayCouplingStrategies[strategy], parent = 'G_official_completion';
      const objective = { kind: 'learn_remote_indicator_effect', scope: ref.split(':revision:', 1)[0]!, subjects: ['switches', 'separate_indicators'],
        parentObjective: parent, satisfactionContract: 'observe_how_switches_change_separate_indicators_and_confirm_progress' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = `display-coupling:${need.id}`, actions = [command];
      const binding = await ObservedInputDomain.makeLocusWitness(observation, rows, option.point, { reason: label, evidence });
      return { status: 'proposed', kind: displayCouplingId, actions, local, index: option.index, controls, receivers, attempt: option.attempt, needId: need.id,
        steps: [{ action: command, expected_after: null, point_binding: binding }], binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Understand how to change the indicators', mode: 'exploration',
          situation: local.coupled ? 'A previous click changed the switch and the remote row. The rule linking them is still uncertain.' : label,
          agenda: entries, evidence, control: local.controls[option.index], receivers: local.receivers },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'indicator_rows_bound' : 'indicator_rows_changed' };
    },
    after(proposal, _index, before, after) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true,
        reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      return { matched: null, seal_prefix: true, reason: 'measure_switch_and_remote_indicators' };
    },
    record(before, after, _command, _first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, index } = proposal, controls = values(second, local.controls), receivers = values(second, local.receivers);
      const localChanges = controls?.flatMap((color, i) => color !== proposal.controls[i] ? [i] : []) ?? [];
      const remoteChanges = receivers?.flatMap((color, i) => color !== proposal.receivers[i] ? [i] : []) ?? [];
      const unchanged = before.frame_hash === after.frame_hash;
      const coupled = localChanges.includes(index) && remoteChanges.length > 0;
      state = { ...local, count: local.count + 1, stopped: !controls || !receivers, coupled: local.coupled || coupled,
        attempts: [...local.attempts, proposal.attempt], inert: unchanged ? [...local.inert, index] : local.inert,
        visited: [...local.visited, JSON.stringify(proposal.controls)], evidence: [...local.evidence.slice(-4), after.observation_ref] };
      return { events: [{ status: coupled ? 'remote_indicator_change_observed' : unchanged ? 'no_visible_change' : 'other_visible_change',
        control: index, changed_indicators: remoteChanges, evidence: [before.observation_ref, after.observation_ref] }] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}

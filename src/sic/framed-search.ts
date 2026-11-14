import { measureFramedWindow } from '../logos-engine/v6-framed-window-observation.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const framedSearchId = 'sic_framed_search';
export const framedSearchStrategies = {
  reveal_reference_window: 'Test an input that may reveal the matching window',
  point_to_unique_window: 'Select the only window matching the framed reference',
} as const;
const graph = compileStrategyGraph({ id: 'find_exact_window_in_visible_field', version: 1, order: 'FALLBACK',
  priorities: ['point_to_unique_window', 'reveal_reference_window'],
  strategies: {
    reveal_reference_window: [{ fact: 'exploration', expected: true, label: 'The framed sample has no current exact match and the view can be tested' }],
    point_to_unique_window: [{ fact: 'unique', expected: true, label: 'Exactly one window has the same visible pixels as the separate sample' }],
  },
}, ['exploration', 'unique']);
type State = { epoch: number; priorDirection: string | null; tried: string[]; stopped: boolean; evidence: string[]; image: NativeBox; reference: NativeBox };
type Proposal = NativeProposal & { local: State; command: NativeCommand; attempt: string; needId: string; window: NativeBox | null };
const directions = ['ACTION3', 'ACTION4', 'ACTION1', 'ACTION2'];
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const crop = (rows: NativeRows, [l, t, r, b]: NativeBox) => rows.slice(t, b + 1).map(row => row.slice(l, r + 1));

export function createSicFramedSearch(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: framedSearchId,
    async propose(observation, rows, _inputs, remaining) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      if (prior?.stopped || (prior?.tried.length ?? 0) >= 12) return null;
      const scene = measureFramedWindow(rows, true);
      if (!scene || scene.matches.length > 1) return null;
      const image = scene.image_box as NativeBox, reference = scene.reference_box as NativeBox;
      const local = prior && equal(prior.image, image) && equal(prior.reference, reference) ? prior
        : { epoch: observation.level_epoch, priorDirection: null, tried: [], stopped: false, evidence: [], image, reference };
      if (!prior && (scene.reference.length < 4 || scene.reference[0].length < 4)) return null;
      const [width, height] = [scene.reference[0].length as number, scene.reference.length as number];
      const displayPosition = scene.matches[0] as NativePoint | undefined;
      const left = displayPosition ? image[0] + 1 + displayPosition[0] : 0;
      const top = displayPosition ? image[1] + 1 + displayPosition[1] : 0;
      const window: NativeBox | null = displayPosition ? [left, top, left + width - 1, top + height - 1] : null;
      const point: NativePoint = [left + Math.floor(width / 2), top + Math.floor(height / 2)];
      const key = (action: string) => JSON.stringify([observation.frame_hash, action]);
      const supported = [...new Set([...(local.priorDirection ? [local.priorDirection] : []), ...directions])]
        .filter(action => observation.available_action_refs.includes(action) && !local.tried.includes(key(action)));
      const probe = supported[0];
      const click = window && { action_ref: 'ACTION6', data: { x: point[0], y: point[1] } };
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...local.evidence.filter(value => value !== ref)];
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active', facts: {
        unique: { value: !!window && !local.tried.includes(key('ACTION6')), evidence }, exploration: { value: !window && !!probe, evidence },
      }, planners: { point_to_unique_window: () => click, reveal_reference_window: () => probe ? { action_ref: probe, data: {} } : null } });
      if (!selected) return null;
      const strategy = selected.id, command = selected.plan, label = framedSearchStrategies[strategy], parent = 'G_official_completion';
      const objective = { kind: 'find_framed_reference', scope: ref.split(':revision:', 1)[0]!, subjects: ['framed_sample', 'search_view'],
        parentObjective: parent, satisfactionContract: 'official_progress_after_pointing_to_exact_reference_match' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = `framed-search:${need.id}`, actions = [command];
      const binding = window ? await ObservedInputDomain.makeLocusWitness(observation, rows, point, { reason: label, evidence }) : undefined;
      return { status: 'proposed', kind: framedSearchId, actions, local, command, window, attempt: key(command.action_ref), needId: need.id,
        steps: [{ action: command, expected_after: null, ...(binding ? { point_binding: binding } : {}) }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Find the exact sample in the larger view', mode: window ? 'solving' : 'exploration',
          situation: window ? 'Only one window reproduces the sample pixel for pixel.' : local.priorDirection
            ? 'The previous direction changed the large view and preserved the sample. Test whether it reveals a match.' : label,
          agenda: entries, evidence, reference, match: window, view: image },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'image_and_sample_bound' : 'image_or_sample_changed' };
    },
    after(proposal, _index, before, after) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true,
        reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      return { matched: proposal.window ? false : null, seal_prefix: true, reason: proposal.window ? 'exact_window_not_accepted' : 'compare_framed_view_return' };
    },
    record(before, after, _command, first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local } = proposal;
      const preserved = equal(crop(first, local.reference), crop(second, local.reference));
      const changed = !equal(crop(first, local.image), crop(second, local.image));
      state = { ...local, priorDirection: changed && preserved && !proposal.window ? proposal.command.action_ref : null,
        tried: [...local.tried, proposal.attempt], stopped: !preserved || !!proposal.window,
        evidence: [...local.evidence.slice(-3), after.observation_ref] };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}

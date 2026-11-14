import { FrameGrid, measureConcentricFrames, type ConcentricFrame } from '../logos-engine/v5-concentric-frames.ts';
import { measureDiagramCandidate, measureDiagramRows, measureDiagramTransition } from '../logos-engine/v5-symbolic-diagrams.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativeObservation, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const symbolContributionId = 'sic_symbol_contribution';
export const symbolContributionStrategies = {
  select_indicated_symbol: 'Test selection of the indicated symbol',
  load_indicated_operand: 'Test placing the selected symbol in the indicated operand',
  apply_indicated_transformation: 'Test the indicated operation on the loaded operands',
  deliver_matching_symbol: 'Test delivering the selected symbol to the matching request',
} as const;
const graph = compileStrategyGraph({ id: 'fill_displayed_symbol_requests', version: 1, order: 'FALLBACK',
  priorities: ['deliver_matching_symbol', 'apply_indicated_transformation', 'load_indicated_operand', 'select_indicated_symbol'],
  strategies: {
    select_indicated_symbol: [{ fact: 'selectable', expected: true, label: 'The guide surrounds one solid symbol of the size shown in the diagrams' }],
    load_indicated_operand: [{ fact: 'operand', expected: true, label: 'A selected symbol and an indicated operand position are both visible' }],
    apply_indicated_transformation: [{ fact: 'operation', expected: true, label: 'The operand pair matches a displayed diagram and the guide points to its operation' }],
    deliver_matching_symbol: [{ fact: 'request', expected: true, label: 'The outlined request has the same appearance as the selected symbol' }],
  },
}, ['selectable', 'operand', 'operation', 'request']);

type Strategy = keyof typeof symbolContributionStrategies;
type State = { epoch: number; count: number; evidence: string[]; appearance: number | null; stopped: boolean };
type Proposal = NativeProposal & { strategy: Strategy; guide: NativeBox; appearance: number; needId: string };
const empty = (epoch = 0): State => ({ epoch, count: 0, evidence: [], appearance: null, stopped: false });
const frameBox = ({ left, top, right, bottom }: ConcentricFrame): NativeBox => [left, top, right, bottom];
const area = ({ left, top, right, bottom }: ConcentricFrame) => (right - left + 1) * (bottom - top + 1);
const atCenter = (frame: ConcentricFrame, x: number, y: number) => frame.center[0] === y && frame.center[1] === x;

function guideAt(frame: FrameGrid, observation: NativeObservation, appearance: number | null) {
  const diagrams = measureDiagramRows(frame);
  if (diagrams.length < 2 || !diagrams.some(row => row.left_values.length === 2)) return null;
  const frames = measureConcentricFrames(frame);
  const eligible = frames.filter(candidate => candidate.maximum_equal_padding > 1
    && (appearance === null || appearance === candidate.outer_value) && observation.entities.some(entity =>
    entity.id === candidate.outer_ref || (entity.palette_value === candidate.outer_value
      && entity.area === 2 * (candidate.right - candidate.left + candidate.bottom - candidate.top)
      && frameBox(candidate).every((value, i) => value === entity.bbox[i]))));
  if (!eligible.length) return null;
  const minimum = Math.min(...eligible.map(area));
  const small = eligible.filter(candidate => area(candidate) === minimum);
  const linked = small.filter(candidate => frames.some(other => other.outer_value === candidate.outer_value
    && other.maximum_equal_padding === 1));
  const choices = linked.length ? linked : small;
  return choices.length === 1 ? choices[0]! : null;
}

export function createSicSymbolContribution(): NativeFamily<Proposal> {
  let state = empty();
  return {
    id: symbolContributionId,
    async propose(observation, rows, _inputs, remaining) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')
        || observation.available_action_refs.some(ref => /^ACTION[1-5]$/.test(ref))) return null;
      const local = state.epoch === observation.level_epoch ? state : empty(observation.level_epoch);
      if (local.stopped || local.count >= 32) return null;
      const frame = new FrameGrid(rows), guide = guideAt(frame, observation, local.appearance);
      if (!guide) return null;
      const [y, x] = guide.center;
      const facts = measureDiagramCandidate(frame, { point: guide.center }, guide.outer_value);
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...local.evidence.filter(item => item !== ref)];
      const command = { action_ref: 'ACTION6', data: { x, y } };
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active', facts: {
        selectable: { value: facts.diagram_point_full_symbol_count === 1 && facts.diagram_tight_white_center_count === 0, evidence },
        operand: { value: facts.diagram_point_equal_pair_center_count === 1 && facts.diagram_tight_white_center_count === 1, evidence },
        operation: { value: facts.diagram_point_branch_value_square_count === 1 && facts.diagram_equal_pair_matches_left_group_count === 1, evidence },
        request: { value: facts.diagram_point_hollow_matches_tight_value_count === 1, evidence },
      }, planners: { select_indicated_symbol: () => command, load_indicated_operand: () => command,
        apply_indicated_transformation: () => command, deliver_matching_symbol: () => command } });
      if (!selected) return null;
      const strategy = selected.id, label = symbolContributionStrategies[strategy], parent = 'G_official_completion';
      const goal = { kind: 'satisfy_visible_symbol_requests', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['visible_symbol_diagram_and_request'], parentObjective: parent, satisfactionContract: 'observe_official_progress_after_symbol_delivery' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `symbol-contribution:${need.id}`, actions = [selected.plan];
      const binding = await ObservedInputDomain.makeLocusWitness(observation, rows, [x, y], { reason: label, evidence });
      return { status: 'proposed', kind: symbolContributionId, strategy, guide: frameBox(guide), appearance: guide.outer_value,
        actions, needId: need.id, steps: [{ action: command, expected_after: null, point_binding: binding }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Use the visible diagram to fill the symbol requests', mode: 'exploration',
          situation: label, agenda: entries, evidence, guide: frameBox(guide) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'symbol_contribution_bound' : 'symbol_contribution_changed' };
    },
    after(proposal, _index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true,
        reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      const matched = observed(proposal, first, second);
      return { matched, seal_prefix: true, reason: matched ? 'symbol_contribution_observed' : 'symbol_contribution_contradicted' };
    },
    record(before, after, _command, first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const local = state.epoch === before.level_epoch ? state : empty(before.level_epoch);
      state = { ...local, count: local.count + 1, stopped: !observed(proposal, first, second),
        appearance: proposal.appearance, evidence: [...local.evidence.slice(-4), after.observation_ref] };
      return { events: [] };
    },
    state: () => ({ ...state }),
    restore(value: NativeRecord) { state = structuredClone(value as State); },
  };
}

function observed({ strategy, actions, appearance, guide }: Proposal, first: NativeRows, second: NativeRows): boolean {
  const after = new FrameGrid(second);
  const { x, y } = actions[0]!.data;
  const frames = measureConcentricFrames(after);
  const tight = frames.filter(frame => frame.outer_value === appearance && frame.maximum_equal_padding === 1);
  if (strategy === 'select_indicated_symbol') return tight.length === 1 && atCenter(tight[0]!, x!, y!);
  if (strategy === 'apply_indicated_transformation') return measureDiagramTransition(new FrameGrid(first), after) > 0;
  const value = second[y!]![x!]!;
  return tight.length === 0 && value !== first[y!]![x!] && !frames.some(frame =>
    frame.outer_value === appearance && frameBox(frame).every((coordinate, i) => coordinate === guide[i]));
}

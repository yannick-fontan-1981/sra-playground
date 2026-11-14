import { measurePanelService, panelServiceProjection } from '../logos-engine/v6-panel-service-observation.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const panelMatchingId = 'sic_panel_matching';
export const panelMatchingStrategies = {
  select_matching_activity: 'Select the activity whose receiver matches the material',
  test_shared_application: 'Run the prepared activities together',
} as const;
const graph = compileStrategyGraph({ id: 'prepare_material_matching_activities', version: 1, order: 'FALLBACK',
  priorities: ['test_shared_application', 'select_matching_activity'],
  strategies: {
    select_matching_activity: [{ fact: 'pending', expected: true, label: 'Each panel has a current material match, with one or more activities unselected' }],
    test_shared_application: [{ fact: 'ready', expected: true, label: 'The matching activity is selected in every panel' }],
  },
}, ['pending', 'ready']);
type Pattern = readonly NativePoint[];
type Control = { point: NativePoint; row: number; outline: number | null };
type Service = { kind: string; input: number; output?: number; symbol: Pattern; control: Control | null };
type Panel = { id: string; bbox: NativeBox; material: number; selection_color: number; operators: Service[]; services: Service[] };
type Scene = { panels: Panel[]; layout: unknown };
type State = { epoch: number; symbols: Pattern[]; attempts: string[]; stopped: boolean; evidence: string[] };
type Proposal = NativeProposal & { local: State; symbols: Pattern[]; expected: NativeRecord[] | null; attempt: string; needId: string };
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function bestLocalActivity(panel: Panel) {
  const direct = panel.operators.filter(service => service.kind === 'displayed_receiver' && service.input === panel.material);
  if (direct.length === 1) return direct[0]!.control;
  if (direct.length > 1) return null;
  const conversion = panel.operators.filter(service => service.kind === 'displayed_rewrite' && service.input === panel.material &&
    panel.services.some(receiver => receiver.kind === 'displayed_receiver' && service.output === receiver.input));
  return conversion.length === 1 ? conversion[0]!.control : null;
}

function measuredMatch(proposal: Proposal, rows: NativeRows) {
  const returned = proposal.expected && measurePanelService(rows, proposal.symbols);
  return !!returned && equal(panelServiceProjection(returned), proposal.expected);
}

export function createSicPanelMatching(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: panelMatchingId,
    async propose(observation, rows, _inputs, remaining) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6') || !observation.available_action_refs.includes('ACTION5')) return null;
      const local: State = state?.epoch === observation.level_epoch ? state :
        { epoch: observation.level_epoch, symbols: [], attempts: [], stopped: false, evidence: [] };
      if (local.stopped || local.attempts.length >= 16) return null;
      const scene = measurePanelService(rows, local.symbols) as Scene | null;
      if (!scene || scene.panels.length < 2 || scene.panels.length > 6) return null;
      const choices = scene.panels.map(panel => ({ panel, control: bestLocalActivity(panel) }));
      if (choices.some(({ control }) => !control)) return null;
      const proposed = choices.find(({ panel, control }) => control!.outline !== panel.selection_color);
      const point = proposed?.control?.point ?? null;
      const command: NativeCommand = point ? { action_ref: 'ACTION6', data: { x: point[0], y: point[1] } }
        : { action_ref: 'ACTION5', data: {} };
      const projection = panelServiceProjection(scene);
      const attempt = JSON.stringify([projection, command]);
      if (local.attempts.includes(attempt)) return null;
      const symbols = [...new Map([...local.symbols, ...scene.panels.flatMap(panel => panel.services.map(service => service.symbol))]
        .map(symbol => [JSON.stringify(symbol), symbol])).values()];
      const expected = proposed ? projection.map(panel => panel.id === proposed.panel.id ? { ...panel, activity: [proposed.control!.row] } : panel) : null;
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...local.evidence.filter(ref => ref !== observation.observation_ref)];
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active', facts: {
        pending: { value: !!proposed, evidence }, ready: { value: !proposed, evidence },
      }, planners: { select_matching_activity: () => command, test_shared_application: () => command } });
      if (!selected) return null;
      const strategy = selected.id, label = panelMatchingStrategies[strategy], parent = 'G_official_completion';
      const objective = { kind: 'apply_matching_material_activities', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['current_materials', 'displayed_receivers'],
        parentObjective: parent, satisfactionContract: 'official_progress_after_applying_the_matching_panel_settings' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence }, id = `panel-matching:${need.id}`;
      const actions = [command];
      const binding = point && await ObservedInputDomain.makeLocusWitness(observation, rows, point, { reason: label, evidence });
      return { status: 'proposed', kind: panelMatchingId, actions, local, symbols, expected, attempt, needId: need.id,
        steps: [{ action: command, expected_after: null, ...(binding ? { point_binding: binding } : {}) }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Prepare an activity for the material in each panel', mode: proposed ? 'assimilation' : 'solving',
          situation: proposed ? 'The shown material matches a proposed activity. Verify the selection and the other panels.' :
            'The observed selections match the displayed material requirements. Their joint effect still needs a return.',
          agenda: entries, evidence, panels: scene.panels.map(panel => panel.bbox) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'current_panel_projections_bound' : 'current_panel_projections_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const matched = proposal.expected ? measuredMatch(proposal, second) : null;
      return { matched, seal_prefix: true, reason: matched ? 'panel_selection_observed' : 'measure_panel_return' };
    },
    record(before, after, _command, _first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, symbols } = proposal;
      state = { ...local, symbols, attempts: [...local.attempts, proposal.attempt],
        stopped: proposal.expected ? !measuredMatch(proposal, second) : before.frame_hash === after.frame_hash,
        evidence: [...local.evidence.slice(-4), after.observation_ref] };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}

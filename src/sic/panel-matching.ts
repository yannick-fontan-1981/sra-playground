import { measurePanelService, panelServiceProjection, remotePanelServiceChoices, type RemotePanelServiceChoice } from '../logos-engine/v6-panel-service-observation.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { choosePreparedConfiguration, preparedConfigurationFacts, preparedConfigurationModule } from './prepared-configuration-card.ts';
import { sicNeedId } from './need-identity.ts';

export const panelMatchingId = 'sic_panel_matching';
export const verifyPanelConfigurationId = 'sic_verify_matching_panel_configuration';
export const panelMatchingStrategies = {
  select_matching_activity: 'Select the activity whose receiver matches the material',
  test_shared_application: 'Run the prepared activities together',
} as const;
type Pattern = readonly NativePoint[];
type Control = { point: NativePoint; row: number; outline: number | null };
type Service = { kind: string; input: number; output?: number; symbol: Pattern; control: Control | null };
type Panel = { id: string; bbox: NativeBox; material: number; room_marker: number; selection_color: number; operators: Service[]; services: Service[] };
type Scene = { panels: Panel[]; layout: unknown };
type Transfer = RemotePanelServiceChoice & { panel: Panel };
type Delivery = { panelId: string; material: number; roomMarker: number };
type State = { epoch: number; symbols: Pattern[]; attempts: string[]; stopped: boolean; evidence: string[];
  verifiedEditRef?: string; verifiedTransferEditRef?: string };
type LearnedSymbols = { completed: number; symbols: Pattern[]; proof: string };
type Proposal = NativeProposal & { local: State; symbols: Pattern[]; expected: NativeRecord[] | null; attempt: string; needId: string;
  outputs?: { panelId: string; value: number }[]; deliveries?: Delivery[]; destinationEdit?: boolean };
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function bestLocalActivity(panel: Panel): Service | null {
  const direct = panel.operators.filter(service => service.kind === 'displayed_receiver' && service.input === panel.material);
  if (direct.length === 1) return direct[0]!;
  if (direct.length > 1) return null;
  const conversion = panel.operators.filter(service => service.kind === 'displayed_rewrite' && service.input === panel.material &&
    panel.services.some(receiver => receiver.kind === 'displayed_receiver' && service.output === receiver.input));
  return conversion.length === 1 ? conversion[0]! : null;
}

function matchedTransfers(scene: Scene): Transfer[] | null {
  if (new Set(scene.panels.map(panel => panel.room_marker)).size !== scene.panels.length) return null;
  const transfers: Transfer[] = [];
  for (const panel of scene.panels) {
    const choices = remotePanelServiceChoices(scene.panels, panel).filter(({ operator }) =>
      operator.outline === panel.selection_color && !panel.operators.some(service => service.control?.row === operator.row));
    if (choices.length !== 1) return null;
    transfers.push({ panel, ...choices[0]! });
  }
  return new Set(transfers.map(transfer => transfer.roomMarker)).size === transfers.length ? transfers : null;
}

function measuredMatch(proposal: Proposal, rows: NativeRows) {
  const returned = proposal.expected && measurePanelService(rows, proposal.symbols);
  return !!returned && equal(panelServiceProjection(returned), proposal.expected);
}

function observedApplication(proposal: Proposal, rows: NativeRows): boolean {
  const scene = measurePanelService(rows, proposal.symbols) as Scene | null;
  if (!scene) return false;
  if (proposal.deliveries) return proposal.deliveries.every(({ panelId, material, roomMarker }) =>
    scene.panels.some(panel => panel.id === panelId && panel.material === material && panel.room_marker === roomMarker
      && panel.services.some(service => service.kind === 'displayed_receiver' && service.input === material)));
  return !!proposal.outputs?.every(({ panelId, value }) => scene.panels.some(panel => panel.id === panelId && panel.material === value));
}

export function createSicVerifyPanelConfiguration(): NativeFamily<Proposal> {
  let state: State | null = null;
  let retained: LearnedSymbols | null = null;
  let decide: NativeProgramHandle | undefined;
  return {
    id: verifyPanelConfigurationId,
    async attachPrograms(registry) {
      decide = await registry.registerProgram(choosePreparedConfiguration, {}, await preparedConfigurationModule());
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6') || !observation.available_action_refs.includes('ACTION5')) return null;
      const learned = retained?.completed === observation.levels_completed ? retained : null;
      const local: State = state?.epoch === observation.level_epoch ? state :
        { epoch: observation.level_epoch, symbols: learned?.symbols ?? [], attempts: [], stopped: false,
          evidence: learned ? [learned.proof] : [] };
      if (local.stopped || local.attempts.length >= 16) return null;
      const scene = measurePanelService(rows, local.symbols) as Scene | null;
      if (!scene || scene.panels.length < 2 || scene.panels.length > 6) return null;
      const choices = scene.panels.map(panel => {
        const service = bestLocalActivity(panel);
        return { panel, service, control: service?.control };
      });
      const localReady = choices.every(({ control }) => !!control);
      const transfers = localReady ? null : matchedTransfers(scene);
      if (!localReady && !transfers) return null;
      const proposed = localReady ? choices.find(({ panel, control }) => control!.outline !== panel.selection_color) : null;
      const destinationEdit = transfers?.find(({ panel, parameter }) => parameter.outline !== panel.selection_color);
      const point = destinationEdit?.parameter.point ?? proposed?.control?.point ?? null;
      const command: NativeCommand = point ? { action_ref: 'ACTION6', data: { x: point[0], y: point[1] } }
        : { action_ref: 'ACTION5', data: {} };
      const projection = panelServiceProjection(scene);
      const attempt = JSON.stringify([projection, command]);
      if (local.attempts.includes(attempt)) return null;
      const symbols = [...new Map([...local.symbols, ...scene.panels.flatMap(panel => panel.services.map(service => service.symbol))]
        .map(symbol => [JSON.stringify(symbol), symbol])).values()];
      const expected = point ? projection.map(panel => {
        if (proposed && panel.id === proposed.panel.id) return { ...panel, activity: [proposed.control!.row] };
        if (destinationEdit && panel.id === destinationEdit.panel.id) {
          const { row, col } = destinationEdit.parameter;
          const parameters: number[][] = [...panel.parameters.filter((item: number[]) => item[0] !== row), [row, col]];
          parameters.sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!);
          return { ...panel, parameters };
        }
        return panel;
      }) : null;
      const outputs = point || transfers ? [] : choices.flatMap(({ panel, service }) =>
        service?.kind === 'displayed_rewrite' && service.output !== undefined ? [{ panelId: panel.id, value: service.output }] : []);
      const deliveries = point ? null : transfers?.map(({ panel, roomMarker }) => ({
        panelId: panel.id, material: panel.material, roomMarker,
      }));
      const ref = observation.observation_ref;
      const editRef = destinationEdit ? local.verifiedTransferEditRef : local.verifiedEditRef;
      const evidence: [string, ...string[]] = [ref, ...new Set([...local.evidence, ...(editRef ? [editRef] : [])]
        .filter(item => item !== ref))];
      const mode = execution?.reasoningMode ?? (point ? 'assimilation' : 'solving');
      const reuseEdit = !!point && !!editRef;
      const facts = preparedConfigurationFacts(mode, { pendingWithKnownEdit: reuseEdit, pendingWithUntestedEdit: !!point && !reuseEdit,
        readyForFirstApplication: !point });
      const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
      const strategy = reuseEdit ? 'P02' : 'P05';
      if (decision?.result !== strategy) return null;
      const phase = proposed ? 'select_matching_activity' : 'test_shared_application';
      const deliverySituation = destinationEdit ? 'Select a room that displays a receiver for this material and verify that the selection changes.'
        : 'Each material has a different matching destination. Run the activities and check the room marker and material in each panel.';
      const label = transfers ? destinationEdit ? 'Select the room with the matching receiver' : 'Test the planned deliveries'
        : outputs.length ? 'Run the selected transformations and compare each material return' : panelMatchingStrategies[phase];
      const parent = 'G_official_completion';
      const objective = { kind: 'apply_matching_material_activities', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['current_materials', 'displayed_receivers'],
        parentObjective: parent, satisfactionContract: 'official_progress_after_applying_the_matching_panel_settings' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence }, id = `panel-matching:${need.id}`;
      const actions = [command];
      const binding = point && await ObservedInputDomain.makeLocusWitness(observation, rows, point, { reason: label, evidence });
      return { status: 'proposed', kind: verifyPanelConfigurationId, actions, local, symbols, expected, attempt, needId: need.id,
        ...(outputs.length ? { outputs } : {}),
        ...(deliveries ? { deliveries } : {}), ...(destinationEdit ? { destinationEdit: true } : {}),
        steps: [{ action: command, expected_after: null, ...(binding ? { point_binding: binding } : {}) }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: facts },
        sicSituationCard: { strategy, need: 'Prepare an activity for the material in each panel', mode,
          situation: transfers ? deliverySituation : proposed ? 'The shown material matches a proposed activity. Verify the selection and the other panels.' :
            outputs.length ? 'The selected activities display the materials needed by the next operation.' :
              'The observed selections match the displayed material requirements. Their joint effect still needs a return.',
          agenda: [], evidence, triggerCard: decision.receipt.workflow, panels: scene.panels.map(panel => panel.bbox),
          ...(transfers ? { destinations: (destinationEdit ? [destinationEdit] : transfers)
            .map(({ parameter, receiverSite: [x, y] }) => ({ choice: parameter.bbox, receiver: [x, y, x + 2, y + 2] })) } : {}) },
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
      const matched = proposal.expected ? measuredMatch(proposal, second)
        : proposal.deliveries || proposal.outputs ? observedApplication(proposal, second) : null;
      const reason = proposal.deliveries ? matched ? 'panel_deliveries_observed' : 'panel_deliveries_contradicted'
        : proposal.outputs ? matched ? 'panel_material_outputs_observed' : 'panel_material_outputs_contradicted'
        : matched ? 'panel_selection_observed' : 'measure_panel_return';
      return { matched, seal_prefix: true, reason };
    },
    record(before, after, _command, _first, second, proposal) {
      if (after.levels_completed > before.levels_completed) {
        retained = { completed: after.levels_completed, symbols: proposal.symbols, proof: after.observation_ref };
        return { events: [] };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, symbols } = proposal;
      const verifiedEdit = !!proposal.expected && measuredMatch(proposal, second);
      state = { ...local, symbols, attempts: [...local.attempts, proposal.attempt],
        ...(verifiedEdit ? proposal.destinationEdit ? { verifiedTransferEditRef: after.observation_ref } : { verifiedEditRef: after.observation_ref } : {}),
        stopped: proposal.expected ? !verifiedEdit : proposal.deliveries || proposal.outputs ? !observedApplication(proposal, second)
          : before.frame_hash === after.frame_hash,
        evidence: [...local.evidence.slice(-4), after.observation_ref] };
      return { events: [] };
    },
    state: () => ({ state, retained }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as State | null);
      retained = structuredClone((value.retained as LearnedSymbols | undefined) ?? null);
    },
  };
}

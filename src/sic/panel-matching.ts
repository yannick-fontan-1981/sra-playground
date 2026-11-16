import { measurePanelService, panelServiceProjection, remotePanelServiceChoices, type PanelLattice, type RemotePanelServiceChoice } from '../logos-engine/v6-panel-service-observation.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeCommand, NativeFamily, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { choosePreparedConfiguration, preparedConfigurationFacts, preparedConfigurationModule } from './prepared-configuration-card.ts';
import { sicNeedId } from './need-identity.ts';
import { matchesServiceChain, prepareServiceChain, type ChainReturn, type Panel, type Pattern, type Scene, type Service } from './panel-service-chain.ts';

export const panelMatchingId = 'sic_panel_matching';
export const verifyPanelConfigurationId = 'sic_verify_matching_panel_configuration';
export const panelMatchingStrategies = {
  select_matching_activity: 'Select the activity whose receiver matches the material',
  test_shared_application: 'Run the prepared activities together',
} as const;
type Transfer = RemotePanelServiceChoice & { panel: Panel };
type Delivery = { panelId: string; material: number; roomMarker: number };
type State = { epoch: number; symbols: Pattern[]; attempts: string[]; stopped: boolean; evidence: string[];
  verifiedEditRef?: string; verifiedTransferEditRef?: string; transport?: Pattern; lattices?: PanelLattice[] };
type LearnedSymbols = { completed: number; symbols: Pattern[]; proof: string; transport?: Pattern };
type ChainEditReturn = { panelId: string; row: number; col?: number; previous: NativeRecord[] };
type Proposal = NativeProposal & { local: State; symbols: Pattern[]; expected: NativeRecord[] | null; attempt: string; needId: string;
  outputs?: { panelId: string; value: number }[]; deliveries?: Delivery[]; destinationEdit?: boolean;
  chainEdit?: ChainEditReturn; chainReturn?: ChainReturn; transport?: Pattern };
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

function observedChain(proposal: Proposal, rows: NativeRows): boolean {
  const scene = measurePanelService(rows, proposal.symbols, proposal.local.lattices) as Scene | null;
  if (!scene) return false;
  if (proposal.chainReturn) return matchesServiceChain(scene, proposal.chainReturn);
  const edit = proposal.chainEdit;
  if (!edit) return false;
  const current = panelServiceProjection(scene);
  if (current.length !== edit.previous.length || current.some((item, index) => {
    const previous = edit.previous[index]!;
    return item.id === edit.panelId
      ? item.id !== previous.id || item.material !== previous.material || item.room_marker !== previous.room_marker
        || !equal(item.activity, [edit.row])
      : !equal(item, previous);
  })) return false;
  if (edit.col === undefined) return true;
  const panel = scene.panels.find(item => item.id === edit.panelId);
  return !!panel?.cells.some(cell => cell.row === edit.row && cell.col === edit.col && cell.outline === panel.selection_color);
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
      let local: State = state?.epoch === observation.level_epoch ? state :
        { epoch: observation.level_epoch, symbols: learned?.symbols ?? [], attempts: [], stopped: false,
          evidence: learned ? [learned.proof] : [], ...(learned?.transport ? { transport: learned.transport } : {}) };
      if (local.stopped || local.attempts.length >= (local.lattices ? 48 : 16)) return null;
      let scene = measurePanelService(rows, local.symbols, local.lattices) as Scene | null;
      if (!scene || scene.panels.length < 2 || scene.panels.length > 6) return null;
      const choices = scene.panels.map(panel => {
        const service = bestLocalActivity(panel);
        return { panel, service, control: service?.control };
      });
      const localReady = choices.every(({ control }) => !!control);
      const transfers = localReady || local.lattices ? null : matchedTransfers(scene);
      const needsChain = !!local.lattices || !localReady && !transfers;
      if (needsChain && !local.lattices && local.transport) {
        const measured = measurePanelService(rows, local.symbols, []) as Scene | null;
        if (!measured || measured.panels.some(panel => !panel.lattice)) return null;
        scene = measured;
        local = { ...local, lattices: measured.panels.map(panel => panel.lattice!) };
      }
      const chain = needsChain && local.transport ? prepareServiceChain(scene, local.transport) : null;
      if (needsChain && !chain) return null;
      const proposed = localReady && !chain ? choices.find(({ panel, control }) => control!.outline !== panel.selection_color) : null;
      const destinationEdit = transfers?.find(({ panel, parameter }) => parameter.outline !== panel.selection_color);
      const point = chain?.edit?.parameter?.point ?? chain?.edit?.control.point ?? destinationEdit?.parameter.point ?? proposed?.control?.point ?? null;
      const command: NativeCommand = point ? { action_ref: 'ACTION6', data: { x: point[0], y: point[1] } }
        : { action_ref: 'ACTION5', data: {} };
      const projection = panelServiceProjection(scene);
      const attempt = JSON.stringify([projection, command]);
      if (local.attempts.includes(attempt)) return null;
      const symbols = [...new Map([...local.symbols, ...scene.panels.flatMap(panel => panel.services.map(service => service.symbol))]
        .map(symbol => [JSON.stringify(symbol), symbol])).values()];
      const expected = point && !chain ? projection.map(panel => {
        if (proposed && panel.id === proposed.panel.id) return { ...panel, activity: [proposed.control!.row] };
        if (destinationEdit && panel.id === destinationEdit.panel.id) {
          const { row, col } = destinationEdit.parameter;
          const parameters: number[][] = [...panel.parameters.filter((item: number[]) => item[0] !== row), [row, col]];
          parameters.sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!);
          return { ...panel, parameters };
        }
        return panel;
      }) : null;
      const outputs = point || transfers || chain ? [] : choices.flatMap(({ panel, service }) =>
        service?.kind === 'displayed_rewrite' && service.output !== undefined ? [{ panelId: panel.id, value: service.output }] : []);
      const deliveries = point ? null : transfers?.map(({ panel, roomMarker }) => ({
        panelId: panel.id, material: panel.material!, roomMarker,
      }));
      const transportControls = deliveries ? transfers?.map(({ panel, operator }) =>
        panel.activity_controls.find(control => control.row === operator.row)?.pattern) : null;
      const transport = transportControls?.[0] && transportControls.every(pattern => equal(pattern, transportControls[0]))
        ? transportControls[0] : undefined;
      const ref = observation.observation_ref;
      const editRef = destinationEdit || chain?.edit?.parameter ? local.verifiedTransferEditRef : local.verifiedEditRef;
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
      const editedTask = chain?.tasks.find(task => task.panel.id === chain.edit?.panel.id);
      const chainLabel = chain?.edit
        ? chain.edit.parameter ? 'Select the receiving room where this material can be processed'
          : editedTask?.parameter ? 'Select transfer to reach the next activity'
          : editedTask?.next ? 'Select the local transformation that prepares the next activity'
          : 'Select the local receiver that accepts this material'
        : 'Run the prepared activities and check the stock in each room after the turn';
      const label = chain ? chainLabel : transfers ? destinationEdit ? 'Select the room with the matching receiver' : 'Test the planned deliveries'
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
        ...(deliveries ? { deliveries } : {}), ...(transport ? { transport } : {}),
        ...(destinationEdit || chain?.edit?.parameter ? { destinationEdit: true } : {}),
        ...(chain?.edit ? { chainEdit: { panelId: chain.edit.panel.id, row: chain.edit.control.row,
          ...(chain.edit.parameter ? { col: chain.edit.parameter.col } : {}), previous: projection } } : chain ? { chainReturn: chain.predicted } : {}),
        steps: [{ action: command, expected_after: null, ...(binding ? { point_binding: binding } : {}) }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: facts },
        sicSituationCard: { strategy, need: 'Prepare an activity for the material in each panel', mode,
          situation: chain ? chainLabel : transfers ? deliverySituation : proposed ? 'The shown material matches a proposed activity. Verify the selection and the other panels.' :
            outputs.length ? 'The selected activities display the materials needed by the next operation.' :
              'The observed selections match the displayed material requirements. Their joint effect still needs a return.',
          agenda: [], evidence, triggerCard: decision.receipt.workflow, panels: scene.panels.map(panel => panel.bbox),
          ...(chain ? { services: chain.tasks.flatMap(({ site }) => site ? [[site[0], site[1], site[0] + 2, site[1] + 2]] : []) } : {}),
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
      if (proposal.chainEdit || proposal.chainReturn) {
        const matched = observedChain(proposal, second);
        return { matched, seal_prefix: true, reason: matched
          ? proposal.chainReturn ? 'panel_chain_turn_observed' : 'panel_chain_selection_observed' : 'panel_chain_prediction_contradicted' };
      }
      const matched = proposal.expected ? measuredMatch(proposal, second)
        : proposal.deliveries || proposal.outputs ? observedApplication(proposal, second) : null;
      const reason = proposal.deliveries ? matched ? 'panel_deliveries_observed' : 'panel_deliveries_contradicted'
        : proposal.outputs ? matched ? 'panel_material_outputs_observed' : 'panel_material_outputs_contradicted'
        : matched ? 'panel_selection_observed' : 'measure_panel_return';
      return { matched, seal_prefix: true, reason };
    },
    record(before, after, _command, _first, second, proposal) {
      if (after.levels_completed > before.levels_completed) {
        retained = { completed: after.levels_completed, symbols: proposal.symbols, proof: after.observation_ref,
          ...(proposal.local.transport ? { transport: proposal.local.transport } : {}) };
        return { events: [] };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, symbols } = proposal;
      const chainVerified = proposal.chainEdit || proposal.chainReturn ? observedChain(proposal, second) : null;
      const verifiedEdit = proposal.chainEdit ? !!chainVerified : !!proposal.expected && measuredMatch(proposal, second);
      const application = proposal.deliveries || proposal.outputs ? observedApplication(proposal, second) : null;
      state = { ...local, symbols, attempts: [...local.attempts, proposal.attempt],
        ...(verifiedEdit ? proposal.destinationEdit ? { verifiedTransferEditRef: after.observation_ref } : { verifiedEditRef: after.observation_ref } : {}),
        ...(application && proposal.transport ? { transport: proposal.transport } : {}),
        stopped: chainVerified !== null ? !chainVerified : proposal.expected ? !verifiedEdit
          : application !== null ? !application : before.frame_hash === after.frame_hash,
        evidence: [...local.evidence.slice(-4), after.observation_ref] };
      return { events: [], ...(chainVerified && proposal.chainReturn
        ? { reviewEvidence: 'The returned material types and worker locations match the work prepared for this turn.' } : {}) };
    },
    state: () => ({ state, retained }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as State | null);
      retained = structuredClone((value.retained as LearnedSymbols | undefined) ?? null);
    },
  };
}

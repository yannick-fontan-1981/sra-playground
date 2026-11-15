import { project } from '../logos-engine/v6-ranked-workshop-geometry.ts';
import { profiles } from '../logos-engine/v6-ranked-workshop-methods.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativeObservation, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { chooseInteraction, interactionModule } from './observed-interaction-card.ts';

export const profileTransferId = 'sic_profile_transfer';
export const verifyProfileTransferId = 'sic_verify_profile_transfer';
export const profileTransferStrategies = {
  locate_compatible_profile: 'Move focus to the profile that fits the receiver',
  test_profile_carry: 'Test picking up the focused profile',
  carry_profile_to_receiver_band: 'Carry the matching profile to the receiver row',
  fit_carried_profile: 'Test fitting the carried profile into its matching receiver',
  release_profile_after_fit: 'Release the fitted profile to select the next one',
} as const;

const geometry = {
  stem: { minimum_rank_count: 2, maximum_rank_count: 12, maximum_component_count: 512,
    maximum_alternatives_per_component: 16, axis_directions: ['up', 'down', 'left', 'right'] },
  scene: { maximum_component_count: 512, maximum_marker_quartets: 16, maximum_receiver_enclosures: 16,
    maximum_receiver_bindings: 64, maximum_reference_side_margin: 2, receiver_axis_directions: ['up'],
    maximum_marker_expansions: 8192, maximum_cut_measurement_requests: 8192, maximum_reference_packets: 32,
    maximum_frame_pixels: 16384 },
};
type Strategy = keyof typeof profileTransferStrategies;
type Part = { box: NativeBox; values: number[] };
type Band = { profile: Part; receiver: Part };
type Scene = { bands: [Band, Band]; focus: 0 | 1; held: boolean; marker: NativeBox };
type State = { epoch: number; count: number; tried: string[]; evidence: string[]; stopped: boolean;
  verified?: Partial<Record<Strategy, { control: string; evidence: string }>> };
type Proposal = NativeProposal & { local: State; scene: Scene; strategy: Strategy; target: 0 | 1; attempt: string; needId: string };
const equal = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((value, i) => value === b[i]);
const empty = (epoch = 0): State => ({ epoch, count: 0, tried: [], evidence: [], stopped: false });
const horizontalBox = ([t, l, b, r]: readonly number[]): NativeBox => [l!, t!, r!, b!];
const rowCenter = ({ box }: Part) => (box[1] + box[3]) / 2;
const filled = ({ values }: Part) => values.every(value => value === 0);

function measure(observation: NativeObservation, rows: NativeRows): Scene | null {
  const [raw, context] = project(observation, rows, geometry);
  const measured = profiles(raw), bindings = raw.receiver_bindings;
  if (measured.length !== 2 || !Array.isArray(bindings) || bindings.length !== 2) return null;
  const inOrder = (parts: Part[]) => parts.sort((a, b) => rowCenter(a) - rowCenter(b));
  const pieces = inOrder(measured.map(item => ({ box: horizontalBox(item.bbox), values: item.profile.stem_relief_rank_height_pixels })));
  const receivers = inOrder(bindings.map(item => ({ box: horizontalBox(item.bbox), values: item.cut_measurements.signed_cut_offsets })));
  if (pieces[0]!.box[3] >= pieces[1]!.box[1] || receivers[0]!.box[3] >= receivers[1]!.box[1]
    || pieces.some((piece, i) => rowCenter(piece) < receivers[i]!.box[1] || rowCenter(piece) > receivers[i]!.box[3])
    || receivers.some(receiver => receiver.values.length < 2 || !receiver.values.every(value => Number.isInteger(value) && value >= 0))
    || receivers.some(receiver => !filled(receiver) && pieces.filter(piece => equal(piece.values, receiver.values)).length !== 1)) return null;
  const selected = measured.find(item => item.component_ref === context.station_profile_unique_marked_profile_ref);
  const rawMarker = context.station_profile_marker_bbox, grip = context.station_profile_inner_singleton_count;
  if (!selected || !Array.isArray(rawMarker) || (grip !== 0 && grip !== 1)) return null;
  const focus = equal(pieces[0]!.box, horizontalBox(selected.bbox)) ? 0 : 1;
  return { bands: [{ profile: pieces[0]!, receiver: receivers[0]! }, { profile: pieces[1]!, receiver: receivers[1]! }],
    focus, held: grip === 1, marker: horizontalBox(rawMarker) };
}

export function createSicVerifyProfileTransfer(): NativeFamily<Proposal> {
  let state = empty();
  let decide: NativeProgramHandle | undefined;
  return {
    id: verifyProfileTransferId,
    async attachPrograms(registry) {
      decide = await registry.registerProgram(chooseInteraction, {}, await interactionModule());
    },
    async propose(observation, rows, inputs, remaining, execution) {
      if (remaining < 1 || !['ACTION1', 'ACTION2', 'ACTION5'].every(ref => observation.available_action_refs.includes(ref))) return null;
      const local = state.epoch === observation.level_epoch ? state : empty(observation.level_epoch);
      if (local.stopped || local.count >= 24) return null;
      const scene = measure(observation, rows);
      if (!scene) return null;
      const { bands, focus, held } = scene;
      const target: 0 | 1 = filled(bands[0].receiver) ? 1 : 0;
      if (filled(bands[target].receiver)) return null;
      const source: 0 | 1 = equal(bands[0].profile.values, bands[target].receiver.values) ? 0 : 1;
      const direction = (band: 0 | 1) => band === 0 ? 'ACTION1' : 'ACTION2';
      const toward = (ref: string) => inputs.find(input => input.action_ref === ref) ?? null;
      const switchGrip = toward('ACTION5');
      const side = bands[target].profile.box[2] < bands[target].receiver.box[0] ? 'ACTION4'
        : bands[target].profile.box[0] > bands[target].receiver.box[2] ? 'ACTION3' : '';
      const offers: { phase: Strategy; applicable: boolean; command: NativeCommand | null }[] = [
        { phase: 'release_profile_after_fit', applicable: held && filled(bands[focus].receiver), command: switchGrip },
        { phase: 'fit_carried_profile', applicable: held && focus === target && source === target && !!side, command: toward(side) },
        { phase: 'carry_profile_to_receiver_band', applicable: held && focus === source && source !== target, command: toward(direction(target)) },
        { phase: 'test_profile_carry', applicable: !held && focus === source, command: switchGrip },
        { phase: 'locate_compatible_profile', applicable: !held && focus !== source, command: toward(direction(source)) },
      ];
      const offer = offers.find(offer => offer.applicable && offer.command);
      if (!offer?.command) return null;
      const { phase, command } = offer;
      const attempt = JSON.stringify([bands.map(band => [band.profile.values, band.receiver.values]), focus, held, command.action_ref]);
      if (local.tried.includes(attempt)) return null;
      const proof = local.verified?.[phase];
      const reused = proof?.control === command.action_ref;
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...new Set([...local.evidence, ...(reused ? [proof.evidence] : [])]
        .filter(item => item !== ref))];
      const mode = execution?.reasoningMode ?? (phase === 'test_profile_carry' ? 'exploration' : 'solving');
      const facts = { repeatSupportedInteraction: reused, probeNeededInteraction: !reused, mode };
      const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
      const strategy = reused ? 'P02' : 'P05';
      if (decision?.result !== strategy) return null;
      const label = profileTransferStrategies[phase], parent = 'G_official_completion';
      const goal = { kind: 'match_profile_to_receiver', scope: ref.split(':revision:', 1)[0]!, subjects: ['profiles_and_open_receivers'],
        parentObjective: parent, satisfactionContract: 'observe_official_progress_after_fitting_the_profiles' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `profile-transfer:${need.id}`, actions = [command];
      return { status: 'proposed', kind: verifyProfileTransferId, actions, local, scene, strategy: phase, target, attempt, needId: need.id,
        steps: [{ action: command, expected_after: null }], binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: facts },
        sicSituationCard: { strategy, need: 'Fit each profile into the receiver with the matching contour', mode,
          situation: label, agenda: [], evidence, triggerCard: decision.receipt.workflow,
          marker: scene.marker, profile: bands[source].profile.box, receiver: bands[target].receiver.box },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'profile_transfer_bound' : 'profile_transfer_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true,
        reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      const matched = observed(proposal, measure(after, second));
      return { matched, seal_prefix: true, reason: matched ? 'profile_transfer_confirmed' : 'profile_transfer_contradicted' };
    },
    record(before, after, command, _first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const local = proposal.local;
      const confirmed = observed(proposal, measure(after, second));
      state = { ...local, count: local.count + 1, stopped: !confirmed,
        ...(confirmed ? { verified: { ...local.verified, [proposal.strategy]: { control: command.action_ref, evidence: after.observation_ref } } } : {}),
        tried: [...local.tried, proposal.attempt], evidence: [...local.evidence.slice(-4), after.observation_ref] };
      return { events: [] };
    },
    state: () => ({ ...state }),
    restore(value: NativeRecord) { state = structuredClone(value as State); },
  };
}

function observed({ strategy, scene, target }: Proposal, next: Scene | null): boolean {
  if (!next) return false;
  switch (strategy) {
    case 'locate_compatible_profile': return !next.held && next.focus !== scene.focus;
    case 'test_profile_carry': return next.held && next.focus === scene.focus;
    case 'carry_profile_to_receiver_band': return next.held && next.focus === target
      && equal(next.bands[target].profile.values, scene.bands[scene.focus].profile.values);
    case 'fit_carried_profile': return filled(next.bands[target].receiver);
    case 'release_profile_after_fit': return !next.held && next.focus === scene.focus && filled(next.bands[scene.focus].receiver);
  }
}

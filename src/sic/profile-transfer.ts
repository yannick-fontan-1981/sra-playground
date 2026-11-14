import { project } from '../logos-engine/v6-ranked-workshop-geometry.ts';
import { profiles } from '../logos-engine/v6-ranked-workshop-methods.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativeObservation, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const profileTransferId = 'sic_profile_transfer';
export const profileTransferStrategies = {
  locate_compatible_profile: 'Move focus to the profile that fits the receiver',
  test_profile_carry: 'Test picking up the focused profile',
  carry_profile_to_receiver_band: 'Carry the matching profile to the receiver row',
  fit_carried_profile: 'Test fitting the carried profile into its matching receiver',
  release_profile_after_fit: 'Release the fitted profile to select the next one',
} as const;
const graph = compileStrategyGraph({ id: 'fit_profiles_into_visible_receivers', version: 1, order: 'FALLBACK',
  priorities: ['release_profile_after_fit', 'fit_carried_profile', 'carry_profile_to_receiver_band', 'test_profile_carry', 'locate_compatible_profile'],
  strategies: {
    locate_compatible_profile: [{ fact: 'seek', expected: true, label: 'The focused profile fits a receiver in another row, while focus is free' }],
    test_profile_carry: [{ fact: 'grasp', expected: true, label: 'The focus is on the profile to carry and the visible grip is empty' }],
    carry_profile_to_receiver_band: [{ fact: 'carry', expected: true, label: 'The grip is now visibly active and the matching receiver is in another row' }],
    fit_carried_profile: [{ fact: 'fit', expected: true, label: 'The carried profile and the open receiver in this row have equal contours' }],
    release_profile_after_fit: [{ fact: 'release', expected: true, label: 'The receiver is filled and the grip still shows an active profile' }],
  },
}, ['seek', 'grasp', 'carry', 'fit', 'release']);

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
type State = { epoch: number; count: number; tried: string[]; evidence: string[]; stopped: boolean };
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

export function createSicProfileTransfer(): NativeFamily<Proposal> {
  let state = empty();
  return {
    id: profileTransferId,
    async propose(observation, rows, inputs, remaining) {
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
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...local.evidence.filter(item => item !== ref)];
      const applicable = {
        seek: !held && focus !== source,
        grasp: !held && focus === source,
        carry: held && focus === source && source !== target,
        fit: held && focus === target && source === target && !!side,
        release: held && filled(bands[focus].receiver),
      };
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active',
        facts: { seek: { value: applicable.seek, evidence }, grasp: { value: applicable.grasp, evidence },
          carry: { value: applicable.carry, evidence }, fit: { value: applicable.fit, evidence }, release: { value: applicable.release, evidence } },
        planners: { locate_compatible_profile: () => toward(direction(source)), test_profile_carry: () => switchGrip,
          carry_profile_to_receiver_band: () => toward(direction(target)), fit_carried_profile: () => toward(side),
          release_profile_after_fit: () => switchGrip } });
      if (!selected) return null;
      const strategy = selected.id, command = selected.plan, label = profileTransferStrategies[strategy], parent = 'G_official_completion';
      const attempt = JSON.stringify([bands.map(band => [band.profile.values, band.receiver.values]), focus, held, command.action_ref]);
      if (local.tried.includes(attempt)) return null;
      const goal = { kind: 'match_profile_to_receiver', scope: ref.split(':revision:', 1)[0]!, subjects: ['profiles_and_open_receivers'],
        parentObjective: parent, satisfactionContract: 'observe_official_progress_after_fitting_the_profiles' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `profile-transfer:${need.id}`, actions = [command];
      return { status: 'proposed', kind: profileTransferId, actions, local, scene, strategy, target, attempt, needId: need.id,
        steps: [{ action: command, expected_after: null }], binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Fit each profile into the receiver with the matching contour',
          mode: strategy === 'test_profile_carry' ? 'exploration' : 'solving', situation: label, agenda: entries, evidence,
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
    record(before, after, _command, _first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const local = proposal.local;
      state = { ...local, count: local.count + 1, stopped: !observed(proposal, measure(after, second)),
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

import { project } from '../logos-engine/v6-ranked-workshop-geometry.ts';
import { profiles, relations, supports } from '../logos-engine/v6-ranked-workshop-methods.ts';
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
  test_framed_profile_tool: 'Test the framed control that could prepare the required profile',
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
type Scene = { bands: [Band, Band]; focus: 0 | 1; held: boolean; marker: NativeBox; tools: { band: 0 | 1; box: NativeBox }[] };
type State = { epoch: number; count: number; tried: string[]; evidence: string[]; stopped: boolean;
  verified?: Partial<Record<Strategy, { control: string; evidence: string }>>; used?: string[]; preparing?: true };
type Transfer = { completed: number; used: string[]; evidence: string[] };
type Work = { focus: 0 | 1; held: boolean; profiles: [number[], number[]]; acquired: [boolean, boolean] };
type Preparation = { phase: Strategy; command: NativeCommand; target: 0 | 1; projected: Work; tool?: NativeBox };
type Proposal = NativeProposal & { local: State; scene: Scene; strategy: Strategy; target: 0 | 1; attempt: string; needId: string; preparation?: Preparation };
const equal = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((value, i) => value === b[i]);
const empty = (epoch = 0): State => ({ epoch, count: 0, tried: [], evidence: [], stopped: false });
const horizontalBox = ([t, l, b, r]: readonly number[]): NativeBox => [l!, t!, r!, b!];
const rowCenter = ({ box }: Part) => (box[1] + box[3]) / 2;
const filled = ({ values }: Part) => values.every(value => value === 0);
const direction = (band: 0 | 1) => band === 0 ? 'ACTION1' : 'ACTION2';
const fitFrom = ({ profile, receiver }: Band) => profile.box[2] < receiver.box[0] ? 'ACTION4'
  : profile.box[0] > receiver.box[2] ? 'ACTION3' : '';
const siteIndices = [0, 1] as const;

function measure(observation: NativeObservation, rows: NativeRows, includeTools = false): Scene | null {
  const [raw, context] = project(observation, rows, geometry);
  const measured = profiles(raw), bindings = raw.receiver_bindings;
  if (measured.length !== 2 || !Array.isArray(bindings) || bindings.length !== 2) return null;
  const inOrder = (parts: Part[]) => parts.sort((a, b) => rowCenter(a) - rowCenter(b));
  const pieces = inOrder(measured.map(item => ({ box: horizontalBox(item.bbox), values: item.profile.stem_relief_rank_height_pixels })));
  const receivers = inOrder(bindings.map(item => ({ box: horizontalBox(item.bbox), values: item.cut_measurements.signed_cut_offsets })));
  if (pieces[0]!.box[3] >= pieces[1]!.box[1] || receivers[0]!.box[3] >= receivers[1]!.box[1]
    || pieces.some((piece, i) => rowCenter(piece) < receivers[i]!.box[1] || rowCenter(piece) > receivers[i]!.box[3])
    || receivers.some(receiver => receiver.values.length < 2 || !receiver.values.every(value => Number.isInteger(value) && value >= 0))) return null;
  const selected = measured.find(item => item.component_ref === context.station_profile_unique_marked_profile_ref);
  const rawMarker = context.station_profile_marker_bbox, grip = context.station_profile_inner_singleton_count;
  if (!selected || !Array.isArray(rawMarker) || (grip !== 0 && grip !== 1)) return null;
  const focus = equal(pieces[0]!.box, horizontalBox(selected.bbox)) ? 0 : 1;
  const tools = includeTools ? supports(observation, raw).flatMap(glyph => {
    const band = siteIndices.find(i => equal(receivers[i]!.box, horizontalBox(glyph.band)));
    return band === undefined ? [] : [{ band, box: glyph.bbox as NativeBox }];
  }) : [];
  return { bands: [{ profile: pieces[0]!, receiver: receivers[0]! }, { profile: pieces[1]!, receiver: receivers[1]! }],
    focus, held: grip === 1, marker: horizontalBox(rawMarker), tools };
}

const workshopState = (scene: Scene): Work => ({ focus: scene.focus, held: scene.held,
  profiles: [scene.bands[0].profile.values, scene.bands[1].profile.values],
  acquired: [filled(scene.bands[0].receiver), filled(scene.bands[1].receiver)] });

function prepareProfile(scene: Scene, inputs: readonly NativeCommand[], prior: Transfer, remaining: number, height: number): Preparation | null {
  const unknown = inputs.filter(command => /^ACTION[1-5]$/.test(command.action_ref) && !prior.used.includes(command.action_ref));
  const toggle = inputs.find(command => command.action_ref === 'ACTION5');
  const needed = [scene.bands[0].receiver.values, scene.bands[1].receiver.values] as const;
  const queue: { current: Work; first: Preparation | null; depth: number }[] = [{ current: workshopState(scene), first: null, depth: 0 }];
  const seen = new Set([JSON.stringify(queue[0]!.current)]);
  for (const { current, first, depth } of queue) {
    if (current.acquired.every(Boolean)) return first;
    if (depth >= remaining || queue.length >= 256) continue;
    const add = (phase: Strategy, command: NativeCommand, target: 0 | 1, projected: Work, tool?: NativeBox) => {
      const id = JSON.stringify(projected);
      if (seen.has(id)) return;
      seen.add(id);
      queue.push({ current: projected, first: first ?? { phase, command, target, projected, ...(tool ? { tool } : {}) }, depth: depth + 1 });
    };
    const { focus, held, profiles, acquired } = current;
    const peer = focus === 0 ? 1 : 0;
    const move = inputs.find(command => command.action_ref === direction(peer));
    if (move) add(held ? 'carry_profile_to_receiver_band' : 'locate_compatible_profile', move, peer, {
      ...current, focus: peer, profiles: held ? [profiles[1], profiles[0]] : profiles,
    });
    if (toggle) add(held ? 'release_profile_after_fit' : 'test_profile_carry', toggle, focus, { ...current, held: !held });
    if (!held) continue;
    const fit = inputs.find(command => command.action_ref === fitFrom(scene.bands[focus]));
    if (fit && !acquired[focus] && equal(profiles[focus], needed[focus])) {
      const changed: Work['acquired'] = [...acquired]; changed[focus] = true;
      add('fit_carried_profile', fit, focus, { ...current, acquired: changed });
    }
    const tool = scene.tools.filter(item => item.band === focus);
    if (tool.length !== 1 || unknown.length !== 1) continue;
    for (const target of siteIndices) {
      if (acquired[target] || relations(profiles[focus], needed[target], height).length !== 1) continue;
      const transformed: Work['profiles'] = [...profiles]; transformed[focus] = needed[target];
      add('test_framed_profile_tool', unknown[0]!, target, { ...current, profiles: transformed }, tool[0]!.box);
    }
  }
  return null;
}

export function createSicVerifyProfileTransfer(): NativeFamily<Proposal> {
  let state = empty();
  let retained: Transfer | null = null;
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
      const acquired = retained?.completed === observation.levels_completed ? retained : null;
      const scene = measure(observation, rows, acquired !== null);
      if (!scene) return null;
      const { bands, focus, held } = scene;
      const direct = bands.every(band => filled(band.receiver)
        || bands.filter(candidate => equal(candidate.profile.values, band.receiver.values)).length === 1);
      const preparation = acquired && (local.preparing || !direct) ? prepareProfile(scene, inputs, acquired, remaining, rows.length) : null;
      if (!preparation && (local.preparing || !direct)) return null;
      const target: 0 | 1 = preparation?.target ?? (filled(bands[0].receiver) ? 1 : 0);
      if (!preparation && filled(bands[target].receiver)) return null;
      const source: 0 | 1 = preparation ? focus : equal(bands[0].profile.values, bands[target].receiver.values) ? 0 : 1;
      const toward = (ref: string) => inputs.find(input => input.action_ref === ref) ?? null;
      const switchGrip = toward('ACTION5');
      const side = fitFrom(bands[target]);
      const offers: { phase: Strategy; applicable: boolean; command: NativeCommand | null }[] = [
        { phase: 'release_profile_after_fit', applicable: held && filled(bands[focus].receiver), command: switchGrip },
        { phase: 'fit_carried_profile', applicable: held && focus === target && source === target && !!side, command: toward(side) },
        { phase: 'carry_profile_to_receiver_band', applicable: held && focus === source && source !== target, command: toward(direction(target)) },
        { phase: 'test_profile_carry', applicable: !held && focus === source, command: switchGrip },
        { phase: 'locate_compatible_profile', applicable: !held && focus !== source, command: toward(direction(source)) },
      ];
      const offer = preparation ?? offers.find(offer => offer.applicable && offer.command);
      if (!offer?.command) return null;
      const { phase, command } = offer;
      const attempt = JSON.stringify([bands.map(band => [band.profile.values, band.receiver.values]), focus, held, command.action_ref]);
      if (local.tried.includes(attempt)) return null;
      const proof = local.verified?.[phase];
      const reused = proof?.control === command.action_ref || !!preparation && !!acquired?.used.includes(command.action_ref);
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...new Set([...local.evidence, ...(proof?.control === command.action_ref ? [proof.evidence] : []),
        ...(preparation && acquired ? acquired.evidence : [])]
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
        ...(preparation ? { preparation } : {}),
        steps: [{ action: command, expected_after: null }], binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: facts },
        sicSituationCard: { strategy, need: 'Fit each profile into the receiver with the matching contour', mode,
          situation: label, agenda: [], evidence, triggerCard: decision.receipt.workflow,
          marker: scene.marker, profile: bands[source].profile.box, receiver: bands[target].receiver.box,
          ...(preparation?.tool ? { tool: preparation.tool } : {}) },
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
      if (after.levels_completed > before.levels_completed) {
        retained = { completed: after.levels_completed,
          used: [...new Set([...(retained?.used ?? []), ...(proposal.local.used ?? []), command.action_ref])],
          evidence: [...proposal.local.evidence.slice(-4), after.observation_ref] };
        return { events: [] };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const local = proposal.local;
      const confirmed = observed(proposal, measure(after, second));
      state = { ...local, count: local.count + 1, stopped: !confirmed,
        ...(proposal.preparation ? { preparing: true as const } : {}),
        ...(confirmed ? { verified: { ...local.verified, [proposal.strategy]: { control: command.action_ref, evidence: after.observation_ref } },
          used: [...new Set([...(local.used ?? []), command.action_ref])] } : {}),
        tried: [...local.tried, proposal.attempt], evidence: [...local.evidence.slice(-4), after.observation_ref] };
      return { events: [] };
    },
    state: () => ({ ...state, retained }),
    restore(value: NativeRecord) {
      const { retained: transfer, ...previous } = value;
      state = structuredClone(previous as State);
      retained = structuredClone((transfer as Transfer | undefined) ?? null);
    },
  };
}

function observed({ strategy, scene, target, preparation }: Proposal, next: Scene | null): boolean {
  if (!next) return false;
  if (preparation) return JSON.stringify(workshopState(next)) === JSON.stringify(preparation.projected);
  switch (strategy) {
    case 'locate_compatible_profile': return !next.held && next.focus !== scene.focus;
    case 'test_profile_carry': return next.held && next.focus === scene.focus;
    case 'carry_profile_to_receiver_band': return next.held && next.focus === target
      && equal(next.bands[target].profile.values, scene.bands[scene.focus].profile.values);
    case 'fit_carried_profile': return filled(next.bands[target].receiver);
    case 'release_profile_after_fit': return !next.held && next.focus === scene.focus && filled(next.bands[scene.focus].receiver);
    case 'test_framed_profile_tool': return false;
  }
}

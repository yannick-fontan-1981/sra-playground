import { project } from '../logos-engine/v6-ranked-workshop-geometry.ts';
import { profiles, relations, supports } from '../logos-engine/v6-ranked-workshop-methods.ts';
import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import { measureRankedCuts } from '../logos-engine/v5-stem-reliefs.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativeObservation, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { chooseInteraction, interactionModule } from './observed-interaction-card.ts';
import { describeRankOrder, observeHeightInversion, observeRankOrder, projectHeightInversion, projectRankOrder, resizeRankOrder } from './profile-rank-order.ts';
import type { HeightInversion, RankOrder } from './profile-rank-order.ts';
import { observedMechanicsGroup } from './strategy-agenda.ts';

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
type Part = { box: NativeBox; values: number[]; supportOnly?: true };
type Band = { profile: Part; receiver: Part };
type Shift = -1 | 1;
type Domain = { minimum: number; maximum: number };
type Proof = { control: string; evidence: string };
type OrderProof = Proof & { ranks: RankOrder; observations: string[] };
type InversionProof = Proof & { ranks: HeightInversion };
type Tool = { band: number; box: NativeBox; shift?: Shift; appearance?: string };
type Scene = { bands: Band[]; focus: number; held: boolean; marker: NativeBox; tools: Tool[]; receiverAnchor?: ReceiverBinding };
type State = { epoch: number; count: number; tried: string[]; evidence: string[]; stopped: boolean;
  verified?: Partial<Record<Strategy, Proof>>; shifts?: Partial<Record<Shift, Proof>>;
  used?: string[]; preparing?: true; domain?: Domain; orders?: Record<string, OrderProof>; complements?: Record<string, Proof>;
  inversions?: Record<string, InversionProof>;
  receiverAnchor?: ReceiverBinding };
export type ProfileTransferEvidence = { completed: number; used: string[]; evidence: string[]; toolControl?: string; shifts?: Partial<Record<Shift, Proof>>;
  orders?: Record<string, OrderProof> };
type Work = { focus: number; held: boolean; profiles: number[][]; acquired: boolean[] };
type Preparation = { phase: Strategy; command: NativeCommand; target: number; projected: Work; tool?: NativeBox; shift?: Shift;
  ordering?: { support: string; probe: boolean; transferred?: RankOrder; compareHeights?: true };
  complement?: string; inversion?: string };
type Proposal = NativeProposal & { local: State; scene: Scene; strategy: Strategy; target: number; attempt: string; needId: string; preparation?: Preparation };
const equal = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((value, i) => value === b[i]);
const empty = (epoch = 0): State => ({ epoch, count: 0, tried: [], evidence: [], stopped: false });
const horizontalBox = ([t, l, b, r]: readonly number[]): NativeBox => [l!, t!, r!, b!];
const rowCenter = ({ box }: Part) => (box[1] + box[3]) / 2;
export const receiverFilled = ({ values }: Part) => values.every(value => value === 0);
const heightMultiset = (values: readonly number[]) => [...values].sort((a, b) => a - b).join(',');
const direction = (band: number) => band === 0 ? 'ACTION1' : 'ACTION2';
const fitFrom = ({ profile, receiver }: Band) => profile.box[2] < receiver.box[0] ? 'ACTION4'
  : profile.box[0] > receiver.box[2] ? 'ACTION3' : '';
function signedSupports(rows: NativeRows, tools: Tool[]): Tool[] {
  const parts = geometricComponents(rows);
  return tools.map(tool => {
    const [l, t, r, b] = tool.box, center = (l + r) / 2, middle = (t + b) / 2;
    const glyphs = parts.flatMap<Shift>(p => {
      const [x, y, u, v] = p.bbox, w = u - x + 1, h = v - y + 1, half = (w - 1) / 2;
      if (x <= l || u >= r || y <= t || v >= b || w < 3 || w % 2 === 0 || (x + u) / 2 !== center
        || (y + v) / 2 >= middle) return [];
      if (h === 1 && p.area === w) return [-1];
      return h === w && p.area === w + h - 1 && p.mask.every(([a, d]) => a === half || d === half) ? [1] : [];
    });
    return glyphs.length === 1 ? { ...tool, shift: glyphs[0]! } : tool;
  });
}

type ReceiverBinding = {
  bbox: [number, number, number, number];
  enclosure_value: number;
  upper_value: number;
  lower_value: number;
  reference_row: number;
  reference_columns: number[];
  reference_value: number;
  cut_measurements: { signed_cut_offsets: number[]; rank_columns: number[]; rank_width_pixels: number };
  supportOnly?: true;
};

function completeReceiverBands(rows: NativeRows, bindings: ReceiverBinding[], stemRows: number[], retained?: ReceiverBinding): ReceiverBinding[] | null {
  if (bindings.length === stemRows.length) return bindings;
  const template = retained ?? bindings[0];
  if (!template || bindings.length > stemRows.length) return null;
  const referenceStem = stemRows.find(stem => stem >= template.bbox[0] && stem <= template.bbox[2]);
  if (referenceStem === undefined) return null;
  const supportPatterns: string[] = [];
  const bands: ReceiverBinding[] = [];
  for (const stem of stemRows) {
    const measured = bindings.filter(({ bbox: [top, , bottom] }) => stem >= top && stem <= bottom);
    if (measured.length > 1) return null;
    if (measured.length) { bands.push(measured[0]!); continue; }
    const [t, l, b, r] = template.bbox, delta = stem - referenceStem;
    const top = t + delta, bottom = b + delta, bbox: ReceiverBinding['bbox'] = [top, l, bottom, r];
    if (top < 0 || bottom >= rows.length) return null;
    const ink = template.enclosure_value;
    const framed = rows[top]!.slice(l, r + 1).every(pixel => pixel === ink)
      && rows[bottom]!.slice(l, r + 1).every(pixel => pixel === ink)
      && rows.slice(top + 1, bottom).every(row => row[l] === ink && row[r] === ink);
    const { rank_columns, rank_width_pixels } = template.cut_measurements;
    if (!framed) {
      if (rows[top]!.slice(l, r + 1).some(pixel => pixel === ink)
        || rows[bottom]!.slice(l, r + 1).some(pixel => pixel === ink)) return null;
      supportPatterns.push(JSON.stringify(rows.slice(top, bottom + 1).map(row => row.slice(l - 1, r + 2))));
      bands.push({ ...template, bbox, supportOnly: true,
        cut_measurements: { ...template.cut_measurements, signed_cut_offsets: rank_columns.map(() => 0) } });
      continue;
    }
    const reference_row = template.reference_row + delta;
    const cut = measureRankedCuts(rows, { rank_columns, rank_width: rank_width_pixels, reference_row,
      reference_columns: template.reference_columns, reference_value: template.reference_value,
      band_top: top, band_bottom: bottom, upper_value: template.upper_value, lower_value: template.lower_value });
    if (!cut.reference_visible || cut.uncertain_rank_indexes.length) return null;
    bands.push({ ...template, bbox, reference_row, cut_measurements: { rank_columns, rank_width_pixels, signed_cut_offsets: cut.signed_cut_offsets } });
  }
  if (supportPatterns.length === 1 || new Set(supportPatterns).size > 1) return null;
  return bands;
}

export function measureProfileTransfer(observation: NativeObservation, rows: NativeRows, includeTools = false, anchor?: ReceiverBinding): Scene | null {
  const [raw, context] = project(observation, rows, geometry);
  const measured = profiles(raw);
  if (measured.length < 2 || measured.length > 6 || !Array.isArray(raw.receiver_bindings)) return null;
  const rawBindings = raw.receiver_bindings as ReceiverBinding[];
  const bindings = completeReceiverBands(rows, rawBindings,
    measured.map(item => item.profile.stem_relief_stem_origin[0]).sort((a, b) => a - b), anchor);
  if (!bindings) return null;
  const inOrder = (parts: Part[]) => parts.sort((a, b) => rowCenter(a) - rowCenter(b));
  const pieces = inOrder(measured.map(item => ({ box: horizontalBox(item.bbox), values: item.profile.stem_relief_rank_height_pixels })));
  const receivers = inOrder(bindings.map(item => ({ box: horizontalBox(item.bbox), values: item.cut_measurements.signed_cut_offsets,
    ...(item.supportOnly ? { supportOnly: true as const } : {}) })));
  const overlapped = (parts: Part[]) => parts.some((part, i) => i > 0 && parts[i - 1]!.box[3] >= part.box[1]);
  if (overlapped(pieces) || overlapped(receivers)
    || pieces.some((piece, i) => rowCenter(piece) < receivers[i]!.box[1] || rowCenter(piece) > receivers[i]!.box[3])
    || receivers.some(receiver => receiver.values.length < 2 || !receiver.values.every(value => Number.isInteger(value) && value >= 0))) return null;
  const selected = measured.find(item => item.component_ref === context.station_profile_unique_marked_profile_ref);
  const rawMarker = context.station_profile_marker_bbox, grip = context.station_profile_inner_singleton_count;
  if (!selected || !Array.isArray(rawMarker) || (grip !== 0 && grip !== 1)) return null;
  const focus = pieces.findIndex(piece => equal(piece.box, horizontalBox(selected.bbox)));
  if (focus < 0) return null;
  const tools = includeTools ? supports(observation, { ...raw, receiver_bindings: bindings }).flatMap(glyph => {
    const band = receivers.findIndex(receiver => equal(receiver.box, horizontalBox(glyph.band)));
    return band < 0 ? [] : [{ band, box: glyph.bbox as NativeBox, appearance: glyph.appearance_sha256 as string }];
  }) : [];
  return { bands: pieces.map((profile, i) => ({ profile, receiver: receivers[i]! })),
    focus, held: grip === 1, marker: horizontalBox(rawMarker), tools: pieces.length > 2 && tools.length ? signedSupports(rows, tools) : tools,
    ...(receivers.some(receiver => receiver.supportOnly) ? { receiverAnchor: anchor ?? rawBindings[0]! } : {}) };
}

export const workshopState = (scene: Scene): Work => ({ focus: scene.focus, held: scene.held,
  profiles: scene.bands.map(band => band.profile.values),
  acquired: scene.bands.map(band => receiverFilled(band.receiver)) });

function measureDomain(scene: Scene): Domain | null {
  const values = scene.bands.flatMap(({ profile, receiver }) => [...profile.values, ...receiver.values].filter(value => value > 0));
  return values.length ? { minimum: Math.min(...values), maximum: Math.max(...values) } : null;
}

export function prepareProfile(scene: Scene, inputs: readonly NativeCommand[], prior: ProfileTransferEvidence, remaining: number, height: number,
  domain: Domain | null, orders?: State['orders'], inversions?: State['inversions']): Preparation | null {
  const commandFor = (ref: string | undefined) => inputs.find(command => command.action_ref === ref);
  const transform = commandFor(prior.toolControl);
  const unknown = domain ? [] : inputs.filter(command => /^ACTION[1-5]$/.test(command.action_ref) && !prior.used.includes(command.action_ref));
  const { bands, tools } = scene, toggle = commandFor('ACTION5');
  const needed = bands.map(({ receiver }) => receiver.values);
  const multisets = needed.map(heightMultiset);
  const canReorder = !!(domain && transform && tools.some(tool => !tool.shift));
  const complementaryTool = scene.receiverAnchor && domain && transform && tools.every(tool => !tool.shift)
    ? tools.filter(tool => tool.appearance && !prior.orders?.[tool.appearance]) : [];
  const complement = complementaryTool.length === 1 && domain ? domain.minimum + domain.maximum : null;
  const compareHeights = complementaryTool.length > 1;
  const complementProfile = (profile: number[]) => profile.map(value => complement! - value);
  function contributes(profile: number[], acquired: boolean[]) {
    const current = heightMultiset(profile), inverse = complement === null ? null : heightMultiset(complementProfile(profile));
    return multisets.some((wanted, i) => !acquired[i] && (wanted === current || wanted === inverse));
  }
  const queue: { current: Work; first: Preparation | null; depth: number }[] = [{ current: workshopState(scene), first: null, depth: 0 }];
  // Until the next fit, inactive profiles do not constrain the carried profile or its tools.
  const searchKey = (work: Work) => JSON.stringify(compareHeights && work.held
    ? [work.focus, work.profiles[work.focus], work.acquired] : work);
  const seen = new Set([searchKey(queue[0]!.current)]);
  let probe: Preparation | null = null, progress: Preparation | null = null;
  const startingReceipts = queue[0]!.current.acquired;
  const alreadyAcquired = startingReceipts.filter(Boolean).length;
  for (const { current, first, depth } of queue) {
    if (scene.receiverAnchor && first) {
      const target = current.acquired.findIndex((acquired, index) => acquired && !startingReceipts[index]);
      if (target >= 0) return { ...first, target };
    }
    if (current.acquired.every(Boolean)) return first;
    if (canReorder && !progress && first && current.acquired.filter(Boolean).length > alreadyAcquired) progress = first;
    if (depth >= remaining || queue.length >= (domain ? 8192 : 256)) continue;
    const prepare = (phase: Strategy, command: NativeCommand, target: number, projected: Work, tool?: Tool,
      ordering?: Preparation['ordering'], complementSupport?: string, inversion?: string): Preparation => first ?? { phase, command, target, projected,
      ...(tool ? { tool: tool.box } : {}), ...(tool?.shift ? { shift: tool.shift } : {}), ...(ordering ? { ordering } : {}),
      ...(complementSupport ? { complement: complementSupport } : {}), ...(inversion ? { inversion } : {}) };
    const add = (phase: Strategy, command: NativeCommand, target: number, projected: Work, tool?: Tool,
      ordering?: Preparation['ordering'], complementSupport?: string, inversion?: string) => {
      const id = searchKey(projected);
      if (seen.has(id)) return;
      seen.add(id);
      queue.push({ current: projected, first: prepare(phase, command, target, projected, tool, ordering, complementSupport, inversion), depth: depth + 1 });
    };
    const { focus, held, profiles, acquired } = current;
    for (const [next, ref] of [[focus - 1, 'ACTION1'], [focus + 1, 'ACTION2']] as const) {
      const command = next >= 0 && next < bands.length ? commandFor(ref) : null;
      if (!command) continue;
      const moved = [...profiles];
      if (held) [moved[focus], moved[next]] = [profiles[next]!, profiles[focus]!];
      add(held ? 'carry_profile_to_receiver_band' : 'locate_compatible_profile', command, next, { ...current, focus: next, profiles: moved });
    }
    if (toggle && (!compareHeights || !held || depth === 0)
      && (held || !scene.receiverAnchor || contributes(profiles[focus]!, acquired) || compareHeights)) {
      add(held ? 'release_profile_after_fit' : 'test_profile_carry', toggle, focus, { ...current, held: !held });
    }
    if (!held) continue;
    const fit = commandFor(fitFrom(bands[focus]!));
    if (fit && !acquired[focus] && equal(profiles[focus]!, needed[focus]!)) {
      const changed = [...acquired]; changed[focus] = true;
      add('fit_carried_profile', fit, focus, { ...current, acquired: changed });
    }
    const available = tools.filter(tool => tool.band === focus);
    if (available.length !== 1) continue;
    const tool = available[0]!, shift = tool.shift, profile = profiles[focus]!;
    if (canReorder && transform && !shift) {
      const support = tool.box.join(','), known = orders?.[support];
      const inversion = inversions?.[support];
      if (inversion && domain) {
        const changedProfile = projectHeightInversion(profile, inversion.ranks, domain.minimum + domain.maximum);
        if (changedProfile) {
          const target = needed.findIndex((wanted, i) => !acquired[i] && equal(wanted, changedProfile));
          const changed = [...profiles]; changed[focus] = changedProfile;
          add('test_framed_profile_tool', transform, target < 0 ? focus : target, { ...current, profiles: changed }, tool,
            undefined, undefined, support);
        } else if (!probe) {
          probe = prepare('test_framed_profile_tool', transform, focus, current, tool, { support, probe: true, compareHeights: true });
        }
        continue;
      }
      if (complement !== null && tool === complementaryTool[0]) {
        const inverted = complementProfile(profile);
        if (!contributes(inverted, acquired)) continue;
        const target = needed.findIndex((wanted, i) => !acquired[i] && equal(wanted, inverted));
        const changed = [...profiles]; changed[focus] = inverted;
        add('test_framed_profile_tool', transform, target < 0 ? focus : target, { ...current, profiles: changed }, tool, undefined, support);
        continue;
      }
      const portable = scene.receiverAnchor && tool.appearance && prior.orders?.[tool.appearance];
      const transferred = portable ? resizeRankOrder(portable.ranks, profile.length) : null;
      const compatible = transferred && (!known || transferred.every(([source], i) => known.ranks[i]?.includes(source!)));
      const ranks = compatible ? transferred : known?.ranks;
      const reordered = ranks ? projectRankOrder(profile, ranks) : null;
      if (reordered) {
        const target = needed.findIndex((wanted, i) => !acquired[i] && equal(wanted, reordered));
        const changed = [...profiles]; changed[focus] = reordered;
        add('test_framed_profile_tool', transform, target < 0 ? focus : target, { ...current, profiles: changed }, tool,
          { support, probe: false, ...(compatible ? { transferred } : {}) });
      } else if (!probe && new Set(profile).size > 1) {
        const multiset = heightMultiset(profile);
        const target = needed.findIndex((wanted, i) => !acquired[i] && multisets[i] === multiset && !equal(wanted, profile));
        const compare = compareHeights && complementaryTool.includes(tool);
        if (target >= 0 || compare) probe = prepare('test_framed_profile_tool', transform, target < 0 ? focus : target, current, tool,
          { support, probe: true, ...(compare ? { compareHeights: true } : {}) });
      }
      continue;
    }
    if (domain) {
      if (!transform || !shift) continue;
      const shifted = profile.map(value => value + shift);
      if (shifted.some(value => value < domain.minimum || value > domain.maximum)) continue;
      const target = needed.findIndex((wanted, i) => !acquired[i] && equal(wanted, shifted));
      const changed = [...profiles]; changed[focus] = shifted;
      add('test_framed_profile_tool', transform, target < 0 ? focus : target, { ...current, profiles: changed }, tool);
    } else if (unknown.length === 1) {
      for (const [target, wanted] of needed.entries()) {
        if (acquired[target] || relations(profile, wanted, height).length !== 1) continue;
        const changed = [...profiles]; changed[focus] = wanted;
        add('test_framed_profile_tool', unknown[0]!, target, { ...current, profiles: changed }, tool);
      }
    }
  }
  return progress ?? probe;
}

export function directProfileStep(scene: Scene, inputs: readonly NativeCommand[], target: number) {
  const { bands, focus, held } = scene;
  const source = equal(bands[0]!.profile.values, bands[target]!.receiver.values) ? 0 : 1;
  const toward = (ref: string) => inputs.find(input => input.action_ref === ref) ?? null;
  const switchGrip = toward('ACTION5');
  const side = fitFrom(bands[target]!);
  const offers: { phase: Strategy; applicable: boolean; command: NativeCommand | null }[] = [
    { phase: 'release_profile_after_fit', applicable: held && receiverFilled(bands[focus]!.receiver), command: switchGrip },
    { phase: 'fit_carried_profile', applicable: held && focus === target && source === target && !!side, command: toward(side) },
    { phase: 'carry_profile_to_receiver_band', applicable: held && focus === source && source !== target, command: toward(direction(target)) },
    { phase: 'test_profile_carry', applicable: !held && focus === source, command: switchGrip },
    { phase: 'locate_compatible_profile', applicable: !held && focus !== source, command: toward(direction(source)) },
  ];
  return offers.find(offer => offer.applicable && offer.command);
}

export function createSicVerifyProfileTransfer(): NativeFamily<Proposal> {
  let state = empty();
  let retained: ProfileTransferEvidence | null = null;
  let decide: NativeProgramHandle | undefined;
  return {
    id: verifyProfileTransferId,
    async attachPrograms(registry) {
      decide = await registry.registerProgram(chooseInteraction, {}, await interactionModule());
    },
    async proposeInGroup(group, observation, rows, inputs, remaining, execution) {
      if (group !== observedMechanicsGroup) return this.propose(observation, rows, inputs, remaining, execution);
      if (!retained?.toolControl || retained.completed !== observation.levels_completed) return null;
      const proposal = await this.propose(observation, rows, inputs, remaining, execution);
      return proposal && proposal.scene.bands.length > 2 ? proposal : null;
    },
    async propose(observation, rows, inputs, remaining, execution) {
      if (remaining < 1 || !['ACTION1', 'ACTION2', 'ACTION5'].every(ref => observation.available_action_refs.includes(ref))) return null;
      const previous = state.epoch === observation.level_epoch ? state : empty(observation.level_epoch);
      if (previous.stopped) return null;
      const acquired = retained?.completed === observation.levels_completed ? retained : null;
      const scene = measureProfileTransfer(observation, rows, acquired !== null, previous.receiverAnchor);
      if (!scene) return null;
      const { bands, focus, held } = scene;
      if (previous.count >= Math.max(24, bands.length * 12)) return null;
      const multipleTools = bands.length > 2;
      const domain = multipleTools ? previous.domain ?? measureDomain(scene) : null;
      const local = domain ? { ...previous, domain, ...(scene.receiverAnchor ? { receiverAnchor: scene.receiverAnchor } : {}) } : previous;
      const direct = bands.every(band => receiverFilled(band.receiver)
        || bands.filter(candidate => equal(candidate.profile.values, band.receiver.values)).length === 1);
      const needsPreparation = multipleTools || local.preparing || !direct;
      const preparation = acquired && needsPreparation && (!multipleTools || domain)
        ? prepareProfile(scene, inputs, acquired, remaining, rows.length, domain, local.orders, local.inversions) : null;
      if (!preparation && needsPreparation) return null;
      const target = preparation?.target ?? (receiverFilled(bands[0]!.receiver) ? 1 : 0);
      if (!preparation && receiverFilled(bands[target]!.receiver)) return null;
      const source = preparation ? scene.receiverAnchor && preparation.phase === 'locate_compatible_profile' ? preparation.projected.focus : focus
        : equal(bands[0]!.profile.values, bands[target]!.receiver.values) ? 0 : 1;
      const offer = preparation ?? directProfileStep(scene, inputs, target);
      if (!offer?.command) return null;
      const { phase, command } = offer;
      const attempt = JSON.stringify([bands.map(band => [band.profile.values, band.receiver.values]), focus, held, command.action_ref,
        ...(local.orders ? [Object.entries(local.orders).map(([support, proof]) => [support, proof.ranks])] : []),
        ...(local.inversions ? [Object.entries(local.inversions).map(([support, proof]) => [support, proof.ranks])] : [])]);
      if (local.tried.includes(attempt)) return null;
      const shift = preparation?.shift, ordering = preparation?.ordering, complement = preparation?.complement, inversion = preparation?.inversion;
      const orderProof = ordering ? local.orders?.[ordering.support] : undefined;
      const proof = ordering ? orderProof : complement ? local.complements?.[complement] : inversion ? local.inversions?.[inversion]
        : shift ? local.shifts?.[shift] ?? acquired?.shifts?.[shift] : local.verified?.[phase];
      const reused = ordering ? !ordering.probe && proof?.control === command.action_ref
        : proof?.control === command.action_ref || !shift && !complement && !inversion && !!preparation && !!acquired?.used.includes(command.action_ref);
      const ref = observation.observation_ref;
      const transferredProof = ordering?.transferred && preparation?.tool
        ? scene.tools.find(tool => equal(tool.box, preparation.tool!))?.appearance : undefined;
      const proofRefs = proof?.control === command.action_ref ? orderProof?.observations ?? [proof.evidence]
        : transferredProof ? acquired?.orders?.[transferredProof]?.observations ?? [] : [];
      const evidence: [string, ...string[]] = [ref, ...new Set([...local.evidence, ...proofRefs,
        ...(preparation && acquired ? acquired.evidence : [])]
        .filter(item => item !== ref))];
      const mode = execution?.reasoningMode ?? (phase === 'test_profile_carry' ? 'exploration' : 'solving');
      const facts = { repeatSupportedInteraction: reused, probeNeededInteraction: !reused, mode };
      const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
      const strategy = reused ? 'P02' : 'P05';
      if (decision?.result !== strategy) return null;
      const invertedRanks = inversion && local.inversions?.[inversion]?.ranks.flatMap((flipped, i) => flipped ? [i + 1] : []);
      const label = complement ? proof ? 'Apply the measured height complement to every tooth' : 'Test whether the tool complements every tooth height'
        : invertedRanks ? `Complement the tooth heights at positions ${invertedRanks.join(', ')}`
        : ordering?.compareHeights ? 'Check which tooth heights the tool changes or reorders'
        : ordering?.probe ? 'Test whether the tool reorders the teeth while preserving their heights'
        : ordering?.transferred ? describeRankOrder(ordering.transferred)
        : orderProof ? describeRankOrder(orderProof.ranks)
        : shift === 1 ? 'Raise each tooth by one step within the observed height range'
        : shift === -1 ? 'Lower each tooth by one step within the observed height range' : profileTransferStrategies[phase];
      const parent = 'G_official_completion';
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
          marker: scene.marker, profile: bands[source]!.profile.box, receiver: bands[target]!.receiver.box,
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
      const matched = observed(proposal, measureProfileTransfer(after, second, false, proposal.scene.receiverAnchor));
      return { matched, seal_prefix: true, reason: matched ? 'profile_transfer_confirmed' : 'profile_transfer_contradicted' };
    },
    record(before, after, command, _first, second, proposal) {
      if (after.levels_completed > before.levels_completed) {
        const toolControl = proposal.local.verified?.test_framed_profile_tool?.control ?? retained?.toolControl;
        const orders = { ...retained?.orders };
        for (const tool of proposal.scene.tools) {
          const proof = proposal.local.orders?.[tool.box.join(',')];
          if (!tool.appearance || !proof) continue;
          const earlier = orders[tool.appearance];
          const transferred = earlier && resizeRankOrder(earlier.ranks, proof.ranks.length);
          const compatible = transferred?.every(([source], i) => proof.ranks[i]?.includes(source!));
          orders[tool.appearance] = earlier && compatible && proof.ranks.some(sources => sources.length !== 1)
            ? { ...proof, ranks: earlier.ranks, observations: [...new Set([...earlier.observations, ...proof.observations])] }
            : proof;
        }
        retained = { completed: after.levels_completed,
          used: [...new Set([...(retained?.used ?? []), ...(proposal.local.used ?? []), command.action_ref])],
          evidence: [...proposal.local.evidence.slice(-4), after.observation_ref],
          ...(toolControl ? { toolControl } : {}),
          ...(Object.keys(orders).length ? { orders } : {}),
          ...(proposal.local.shifts || retained?.shifts ? { shifts: { ...retained?.shifts, ...proposal.local.shifts } } : {}) };
        return { events: [] };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const local = proposal.local;
      const next = measureProfileTransfer(after, second, false, proposal.scene.receiverAnchor), ordering = proposal.preparation?.ordering;
      const knownInversion = ordering && local.inversions?.[ordering.support];
      const probedOrder = ordering?.probe && !knownInversion ? observeOrderProbe(proposal, next) : null;
      const probedInversion = ordering?.compareHeights && !probedOrder ? observeInversionProbe(proposal, next) : null;
      const confirmed = ordering?.probe ? !!(probedOrder || probedInversion) : observed(proposal, next);
      const newOrder = probedOrder ?? (confirmed && ordering?.transferred && next
        ? observeRankOrder(proposal.scene.bands[proposal.scene.focus]!.profile.values, next.bands[next.focus]!.profile.values,
          local.orders?.[ordering.support]?.ranks) : null);
      const shift = proposal.preparation?.shift;
      const complement = proposal.preparation?.complement;
      const proof = { control: command.action_ref, evidence: after.observation_ref };
      const observations = ordering && newOrder
        ? [...new Set([...(local.orders?.[ordering.support]?.observations ?? []), before.observation_ref, after.observation_ref])] : [];
      state = { ...local, count: local.count + 1, stopped: !confirmed,
        ...(proposal.preparation ? { preparing: true as const } : {}),
        ...(newOrder && ordering ? { orders: { ...local.orders, [ordering.support]: { ...proof, ranks: newOrder, observations } } } : {}),
        ...(probedInversion && ordering ? { inversions: { ...local.inversions, [ordering.support]: { ...proof, ranks: probedInversion } } } : {}),
        ...(confirmed && complement ? { complements: { ...local.complements, [complement]: proof } } : {}),
        ...(confirmed && shift ? { shifts: { ...local.shifts, [shift]: proof } } : {}),
        ...(confirmed ? { verified: { ...local.verified, [proposal.strategy]: proof },
          used: [...new Set([...(local.used ?? []), command.action_ref])] } : {}),
        tried: [...local.tried, proposal.attempt], evidence: [...local.evidence.slice(-4), after.observation_ref] };
      return { events: [] };
    },
    state: () => ({ ...state, retained }),
    restore(value: NativeRecord) {
      const { retained: transfer, ...previous } = value;
      state = structuredClone(previous as State);
      retained = structuredClone((transfer as ProfileTransferEvidence | undefined) ?? null);
    },
  };
}

function isolatedToolChange(scene: Scene, next: Scene | null): { before: number[]; after: number[] } | null {
  if (!next || next.focus !== scene.focus || !next.held || next.bands.length !== scene.bands.length) return null;
  if (!scene.bands.every((band, i) => equal(band.receiver.values, next.bands[i]!.receiver.values)
    && (i === scene.focus || equal(band.profile.values, next.bands[i]!.profile.values)))) return null;
  return { before: scene.bands[scene.focus]!.profile.values, after: next.bands[next.focus]!.profile.values };
}

function observeInversionProbe({ local, scene, preparation }: Proposal, next: Scene | null): HeightInversion | null {
  const ordering = preparation?.ordering, domain = local.domain, change = isolatedToolChange(scene, next);
  return ordering?.compareHeights && domain && change
    ? observeHeightInversion(change.before, change.after, domain.minimum + domain.maximum, local.inversions?.[ordering.support]?.ranks)
    : null;
}

function observeOrderProbe({ local, scene, preparation }: Proposal, next: Scene | null): RankOrder | null {
  const ordering = preparation?.ordering, change = isolatedToolChange(scene, next);
  if (!ordering?.probe || !change || ordering.compareHeights && equal(change.before, change.after)) return null;
  const prior = local.orders?.[ordering.support]?.ranks;
  const result = observeRankOrder(change.before, change.after, prior);
  return result && (!prior || result.some((ranks, i) => ranks.length < prior[i]!.length)) ? result : null;
}

function observed(proposal: Proposal, next: Scene | null): boolean {
  if (!next) return false;
  const { strategy, scene, target, preparation } = proposal;
  if (preparation?.ordering?.probe) {
    const knownInversion = proposal.local.inversions?.[preparation.ordering.support];
    return !knownInversion && observeOrderProbe(proposal, next) !== null || observeInversionProbe(proposal, next) !== null;
  }
  if (preparation) return JSON.stringify(workshopState(next)) === JSON.stringify(preparation.projected);
  return matchesDirectProfileStep(scene, strategy, target, next);
}

export function matchesDirectProfileStep(scene: Scene, strategy: Strategy, target: number, next: Scene) {
  switch (strategy) {
    case 'locate_compatible_profile': return !next.held && next.focus !== scene.focus;
    case 'test_profile_carry': return next.held && next.focus === scene.focus;
    case 'carry_profile_to_receiver_band': return next.held && next.focus === target
      && equal(next.bands[target]!.profile.values, scene.bands[scene.focus]!.profile.values);
    case 'fit_carried_profile': return receiverFilled(next.bands[target]!.receiver);
    case 'release_profile_after_fit': return !next.held && next.focus === scene.focus && receiverFilled(next.bands[scene.focus]!.receiver);
    case 'test_framed_profile_tool': return false;
  }
}

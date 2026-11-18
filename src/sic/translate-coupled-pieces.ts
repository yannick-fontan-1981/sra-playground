import { geometricComponents, ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeExecution, NativeFamily, NativeObservation, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import type { ReasoningMode } from './reasoning-mode.ts';
import { sicNeedId } from './need-identity.ts';
import { observedMechanicsGroup } from './strategy-agenda.ts';
import { maximumCommittedActions, unchangedOutside } from './plan-step.ts';
import { contactBox, identifyContactRoute, identifyMaskedContactRoute, identifyRelayContactRoute, observeContactRoute, planContacts, selectionPoint,
  type ContactCalibration, type ContactRoute, type ContactRouteMove } from './rectangular-contact-route.ts';
import { calibratedPeriodicContact, choosePeriodicSample, matchesPeriodicContact, measurePeriodicContact, observePeriodicContact,
  periodicContactBox, planPeriodicContact, projectPeriodicSnapshot,
  type PeriodicContactRoute, type PeriodicContactMove } from './periodic-contact-route.ts';
import { planPeriodicRelay } from './periodic-relay-planner.ts';

export const translateCoupledPiecesId = 'sic_translate_coupled_pieces';
export const learnContactAccessId = 'sic_learn_contact_access';

const directions = [['ACTION1', 0, -1], ['ACTION2', 0, 1], ['ACTION3', -1, 0], ['ACTION4', 1, 0]] as const;

type Model = {
  pitch: number;
  color: number;
  divider: NativeBox;
  domain: NativePoint[];
  targets: NativePoint[];
};
type Position = { pieces: NativePoint[]; selected: number };
type Move = { input: string; click?: NativePoint; position: Position; contact?: number };
type ContactEffect = { input: string; offset: NativePoint; evidence: string; from: NativePoint; to: NativePoint };
type State = { epoch: number; model: Model; position: Position; refs: string[]; attempts: Record<string, number>;
  controls?: Record<string, string>; contacts?: ContactEffect[]; launch?: ContactCalibration; motionEvidence?: Record<string, string> };
type Proposal = NativeProposal & { local: State; move: Move; walk?: Move[]; needId: string; attempt: string;
  focusValues?: readonly number[] };
type RouteProposal = NativeProposal & { contactRoute: ContactRoute; contactMove: ContactRouteMove; needId: string };
type PeriodicProposal = NativeProposal & { periodicRoute: PeriodicContactRoute; periodicMoves: PeriodicContactMove[]; needId: string };
type CoupledProposal = Proposal | RouteProposal | PeriodicProposal;
const isRoute = (proposal: CoupledProposal): proposal is RouteProposal => Object.hasOwn(proposal, 'contactRoute');
const isPeriodic = (proposal: CoupledProposal): proposal is PeriodicProposal => Object.hasOwn(proposal, 'periodicRoute');

const eq = ([x, y]: NativePoint, [a, b]: NativePoint) => x === a && y === b;
const label = (p: NativePoint) => p.join(',');
const advance = ([x,y]: NativePoint, dx: number, dy: number): NativePoint => [x + dx, y + dy];
const key = (p: Position) => p.selected + '/' + p.pieces.map(label).join(';');
const size = ([l, t, r, b]: NativeBox) => [r - l + 1, b - t + 1] as const;

function measure(rows: NativeRows): { model: Model; position: Position } | null {
  const parts = geometricComponents(rows), layouts = [];
  const at = (x: number, y: number) => rows[y]?.[x];
  for (const a of parts) {
    const [pitch, height] = size(a.bbox);
    if (pitch < 3 || pitch > 7 || height !== pitch || a.area !== pitch * pitch - 1) continue;
    const rings = parts.filter(p => p.color === a.color && p.area === a.area && size(p.bbox).every(v => v === pitch));
    if (rings.length !== 2 || rings[0] !== a) continue;
    const slots = parts.filter(p => p.area === 4 * (pitch + 1) && size(p.bbox).every(v => v === pitch + 2)
      && p.mask.every(([x, y]) => x === 0 || y === 0 || x === pitch + 1 || y === pitch + 1));
    if (slots.length !== 2 || slots[0]!.color !== slots[1]!.color || slots[0]!.color === a.color) continue;
    const toPoint = ([x,y]: NativeBox): NativePoint => [x, y];
    const pieces = rings.map(p => toPoint(p.bbox));
    const targets = slots.map(p => advance(toPoint(p.bbox), 1, 1));
    const aligned = ([x,y]: NativePoint) => (x - pieces[0]![0]) % pitch === 0 && (y - pieces[0]![1]) % pitch === 0;
    if (![...pieces, ...targets].every(aligned)) continue;
    const [left, right] = targets.sort((a, b) => a[0] - b[0]);
    const dividers = parts.filter(p => {
      const [l, t, r, b] = p.bbox, [w,h] = size(p.bbox);
      return l > left![0] + pitch - 1 && r < right![0] && h >= 4 * pitch && w >= pitch
        && p.area === w * h && pieces.every(([x,y]) => (x < l || x > r) && y >= t && y + pitch - 1 <= b);
    });
    if (dividers.length !== 1) continue;
    const [x0, y0] = pieces[0]!;
    const phase: NativePoint = [x0 % pitch, y0 % pitch];
    const divider = dividers[0]!.bbox, [l, t, r, b] = divider, half = Math.floor(pitch / 2);
    const support = at(left![0] + half, left![1] + half);
    if (support === undefined || support !== at(right![0] + half, right![1] + half)) continue;
    const domain: NativePoint[] = [];
    for (let y = phase[1]; y + pitch - 1 <= b; y += pitch) {
      if (y < t) continue;
      for (let x = phase[0]; x + pitch - 1 < rows[0]!.length; x += pitch) {
        if (x + pitch - 1 >= l && x <= r) continue;
        const p: NativePoint = [x,y];
        if (at(x + half, y + half) === support || pieces.some(piece => eq(piece, p)) || targets.some(goal => eq(goal, p))) domain.push(p);
      }
    }
    if (domain.length < 2 * pitch || domain.length > 140) continue;
    layouts.push({ model: { pitch, color: a.color, divider, domain, targets }, position: { pieces, selected: -1 } });
  }
  return layouts.length === 1 ? layouts[0]! : null;
}

function choose({ model, position, attempts, contacts }: State): Move[] | null {
  const { pitch, domain, divider, targets } = model;
  const domainKeys = new Set(domain.map(label));
  type Node = { position: Position; from?: { parent: Node; move: Move } };
  const queue: Node[] = [{ position }];
  const seen = new Set([key(position)]);
  const half = Math.floor(pitch / 2);
  for (let i = 0; i < queue.length && i < 14000; i++) {
    const node = queue[i]!, p = node.position;
    if (targets.every(goal => p.pieces.some(piece => eq(piece, goal)))) {
      const path: Move[] = [];
      for (let entry = node; entry.from; entry = entry.from.parent) path.push(entry.from.move);
      return path.reverse();
    }
    const offer = (move: Move) => {
      const k = key(move.position);
      const tried = attempts[key(p) + '>' + k] ?? 0;
      if (seen.has(k) || !node.from && tried >= (move.contact === undefined ? 1 : 2)) return;
      seen.add(k);
      queue.push({ position: move.position, from: { parent: node, move } });
    };
    const m = p.selected, other = 1 - m;
    const click = (selected: number) => offer({ input: 'ACTION6', click: advance(p.pieces[selected]!, half, half), position: { ...p, selected } });
    if (m < 0) {
      for (let j = 0; j < p.pieces.length; j++) click(j);
      continue;
    }
    click(other);
    for (const [input, dx, dy] of directions) {
      const target = advance(p.pieces[m]!, dx * pitch, dy * pitch);
      if (!domainKeys.has(label(target))) continue;
      if (!eq(p.pieces[other]!, target)) {
        offer({ input, position: { ...p, pieces: p.pieces.map((piece, j) => j === m ? target : piece) } });
        continue;
      }
      if (!dx) continue;
      const next = advance(target, dx * pitch, 0), [l,,r] = divider;
      if (next[0] + pitch - 1 < l || next[0] > r) continue;
      const effect = contacts?.find(contact => contact.input === input);
      const beyond = domain.filter(([x,y]) => y === target[1] && (dx > 0 ? x > r : x + pitch - 1 < l));
      beyond.sort((a, b) => dx * (a[0] - b[0]));
      if (effect) {
        const predicted = advance(target, ...effect.offset);
        const index = beyond.findIndex(point => eq(point, predicted));
        if (index > 0) beyond.unshift(...beyond.splice(index, 1));
      }
      for (const landing of beyond) {
        offer({ input, contact: other, position: { ...p, pieces: p.pieces.map((piece, j) => j === other ? landing : piece) } });
      }
    }
  }
  return null;
}

function returned(rows: NativeRows, proposal: Pick<Proposal, 'local' | 'move'>): Position | null {
  const { local: { model, position }, move } = proposal;
  const { pitch, color, domain } = model;
  const at = (x:number,y:number) => rows[y]?.[x];
  const ring = ([x,y]: NativePoint) => {
    let count = 0;
    for (let i = 0; i < pitch; i++) {
      count += Number(at(x + i,y) === color) + Number(at(x + i,y + pitch - 1) === color);
      if (i && i < pitch - 1) count += Number(at(x,y + i) === color) + Number(at(x + pitch - 1,y + i) === color);
    }
    const present = count === 4 * (pitch - 1);
    const adjacent = (points: NativePoint[]) => points.some(other => !eq(other, [x,y])
      && other[1] === y && Math.abs(other[0] - x) === pitch);
    const deformedContact = move.contact === undefined && [position.pieces, move.position.pieces]
      .some(points => points.some(point => eq(point, [x,y])) && adjacent(points))
      && count >= 4 * (pitch - 1) - pitch;
    return present || deformedContact;
  };
  const seen = domain.filter(ring);
  if (seen.length !== position.pieces.length) return null;
  const pieces = move.position.pieces.every(p => seen.some(q => eq(p,q))) ? move.position.pieces
    : position.pieces.map((p, i) => seen.find(q => eq(p,q)) ?? seen.find(q => !position.pieces.some(previous => eq(previous,q))) ?? position.pieces[i]!);
  if (new Set(pieces.map(label)).size !== pieces.length) return null;
  if (move.click) {
    const half = Math.floor(pitch / 2);
    const [otherX, otherY] = pieces[1 - move.position.selected]!;
    if (at(...move.click) === at(otherX + half, otherY + half)) return null;
  }
  return { pieces, selected: move.position.selected };
}

function focusValues(rows: NativeRows, position: Position, pitch: number): number[] {
  const half = Math.floor(pitch / 2);
  return position.pieces.map(([x, y]) => rows[y + half]![x + half]!);
}

function leg(proposal: Proposal, index: number): Pick<Proposal, 'local' | 'move'> {
  const position = proposal.walk?.[index - 1]?.position;
  return { local: position ? { ...proposal.local, position } : proposal.local,
    move: proposal.walk?.[index] ?? proposal.move };
}

async function proposeContactRoute(id: string, observation: NativeObservation, rows: NativeRows, initial: ContactRoute,
  mode: ReasoningMode): Promise<RouteProposal | null> {
  if (initial.stopped) return null;
  const route = initial.path.length ? initial : { ...initial, path: planContacts(initial, directions) };
  const move = route.path[0];
  if (!move || !observation.available_action_refs.includes(move.input)) return null;
  const { scene, position } = route;
  const chosen = move.position.selected, at = position.pieces[chosen]!;
  const click = move.input === 'ACTION6' ? selectionPoint(scene, chosen, at) : null;
  const ref = observation.observation_ref;
  const evidence: [string, ...string[]] = [ref, ...new Set([scene.calibration.evidence, ...Object.values(route.observedControls), ...route.evidence,
    ...(route.contactRef ? [route.contactRef] : [])]
    .filter(item => item !== ref))];
  const fixed = scene.fixedCarrier !== undefined, masked = fixed || !!scene.carriers;
  const reuseContact = masked && !!route.contactRef && move.contact !== null;
  const isProbe = !!click || !reuseContact && (move.contact !== null || !route.observedControls[move.input]);
  const goalIndex = move.contact ?? chosen;
  const points = move.position.pieces.map((cell, index) => contactBox(scene, cell, index));
  const [x, y] = points[goalIndex]!;
  const offer = { input: move.input, expected: [x, y] as NativePoint, evidence };
  const choice = resolveNavigationPrimitives({ mode, evidence, probe: isProbe ? offer : null,
    access: isProbe || reuseContact ? null : offer, interaction: reuseContact ? offer : null });
  if (!choice.selected) return null;
  const situation = click ? 'Select the piece needed for the next placement or contact'
    : move.contact !== null ? scene.carriers ? 'Transfer the contacted piece while keeping the current launcher in place'
      : fixed ? 'Push the cargo toward the planned position while keeping control of the carrier'
      : 'Test the projected landing while keeping the launcher available'
      : fixed ? route.path.some(step => step.contact !== null) ? 'Approach the next contact through the free cells of the shape'
        : 'Move the controlled piece into its own opening'
        : 'Move the selected piece along the available route';
  const witness = click ? await ObservedInputDomain.makeLocusWitness(observation, rows, click, { reason: situation, evidence }) : null;
  if (click && !witness) return null;
  const parent = 'G_official_completion';
  const objective = { kind: masked ? 'place_matching_shapes_using_contact_transfers' : 'place_matching_rectangular_pieces_using_contact_transfers',
    scope: ref.split(':revision:', 1)[0]!,
    subjects: ['selectable_pieces', 'matching_openings', 'contact_transfers'], parentObjective: parent,
    satisfactionContract: 'official_progress_after_all_matching_openings_are_filled' };
  const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
  const composition = id + ':' + need.id;
  const action: NativeCommand = { action_ref: move.input, data: click ? { x: click[0], y: click[1] } : {} };
  const actions = [action];
  return {
    status: 'proposed', kind: id, contactRoute: route, contactMove: move, needId: need.id, actions,
    binding: { observation_ref: ref, level_epoch: observation.level_epoch },
    steps: [{ action, expected_after: points, ...(witness ? { point_binding: witness } : {}) }],
    sicSituationCard: { strategy: choice.selected.id, need: fixed ? 'Fit the controlled piece and pushed cargo into their openings'
      : 'Fill each opening while keeping the remaining launchers available',
      situation, evidence, agenda: choice.entries, mode, triggerCard: choice.card,
      focus: contactBox(scene, fixed ? position.pieces[chosen]! : at, chosen),
      related: move.contact === null ? null : contactBox(scene, position.pieces[goalIndex]!, goalIndex),
      projected: move.contact === null ? null : points[goalIndex]!,
      target: contactBox(scene, masked ? route.path.at(-1)!.position.pieces[goalIndex]! : scene.pieces[goalIndex]!.goal, goalIndex) },
    question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
    compositions: [{ id: composition, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
    sicLocalDecision: { strategy: choice.selected.id, objective: { id: composition, label: navigationPrimitives[choice.selected.id], parent }, need },
    bundle_template: { operation_key: 'OP18', composition_ref: composition, objective_ref: parent, purpose: situation,
      preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: composition } },
  };
}

async function proposePeriodicRoute(id: string, observation: NativeObservation, rows: NativeRows, route: PeriodicContactRoute,
  remaining: number, mode: ReasoningMode, execution?: NativeExecution): Promise<PeriodicProposal | null> {
  const timed = calibratedPeriodicContact(route);
  if (route.stopped || !matchesPeriodicContact(route, rows) || !timed && route.samples >= 12) return null;
  const keys = directions.filter(([key]) => observation.available_action_refs.includes(key));
  const path = route.carriers
    ? timed ? route.planned?.length ? route.planned
      : await planPeriodicRelay(route, keys.filter(([key]) => Object.hasOwn(route.observedControls, key)), remaining, execution) : []
    : route.payloads && !timed ? [] : planPeriodicContact(route, keys, Math.min(remaining, route.payloads ? 96 : 48));
  const first = timed ? path[0] : choosePeriodicSample(route, path, keys);
  if (!first) return null;
  const distinctStep = (move: PeriodicContactMove) => move.contact !== null || move.automatic.length > 0
    || move.payloadContact !== undefined || move.carrierContact !== undefined || move.direction[0] === 'ACTION6';
  const contact = distinctStep(first);
  const batch = [first];
  if (timed && !contact) for (const move of path.slice(1, Math.min(maximumCommittedActions, remaining))) {
    if (distinctStep(move)) break;
    batch.push(move);
  }
  const ref = observation.observation_ref;
  const evidence: [string, ...string[]] = [ref, ...new Set([...route.evidence,
    ...(route.observedControls[first.direction[0]] ? [route.observedControls[first.direction[0]]!] : [])].filter(value => value !== ref))];
  const aim = periodicContactBox(route, first.pose.actor);
  const offer = { input: first.direction[0], expected: [aim[0], aim[1]] as NativePoint, evidence };
  const choice = resolveNavigationPrimitives({ mode, evidence, probe: !timed ? offer : null,
    access: timed && !contact ? offer : null, interaction: timed && contact ? offer : null });
  if (!choice.selected) return null;
  const focusCarrier = route.carriers?.[first.carrierContact ?? first.pose.selected!];
  const target = periodicContactBox(route, focusCarrier?.goal ?? route.goal, focusCarrier?.size);
  const activeSource = first.contact ?? first.automatic[0];
  const box = (source: number, at = route.pose.sources[source]!) => periodicContactBox(route, at, route.sources[source]!.size);
  const selecting = first.direction[0] === 'ACTION6';
  const reason = !timed ? 'Approach the opening and measure when the moving fronts extend and retract'
    : selecting ? 'Transfer control to the piece needed for the next step'
      : first.carrierContact !== undefined ? 'Move the other selectable piece to its next working area'
    : first.contact !== null ? 'Clear the passage by projecting the contacted pusher across the separating band'
      : first.payloadContact !== undefined ? 'Project the shaped payload into the matching opening'
      : first.automatic.length ? 'Use the measured extension to move the controlled piece toward the opening'
        : 'Follow the route that reaches the opening between the measured extensions';
  const parent = 'G_official_completion';
  const objective = { kind: 'reach_opening_with_periodic_contacts', scope: ref.split(':revision:', 1)[0]!,
    subjects: ['controlled_piece', 'moving_fronts', 'matching_opening'], parentObjective: parent,
    satisfactionContract: 'official_progress_after_reaching_the_matching_opening' };
  const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
  const composition = id + ':' + need.id;
  const click = selecting ? periodicContactBox(route, first.pose.actor, route.carriers![first.pose.selected!]!.size) : null;
  const point: NativePoint | null = click ? [Math.floor((click[0] + click[2]) / 2), Math.floor((click[1] + click[3]) / 2)] : null;
  const witness = point ? await ObservedInputDomain.makeLocusWitness(observation, rows, point, { reason, evidence }) : null;
  if (selecting && !witness) return null;
  const data: Record<string, number> = point ? { x: point[0], y: point[1] } : {};
  const actions = batch.map(move => ({ action_ref: move.direction[0], data: { ...data } }));
  return { status: 'proposed', kind: id, periodicRoute: route.carriers && timed ? { ...route, planned: path } : route,
    periodicMoves: batch, needId: need.id, actions,
    binding: { observation_ref: ref, level_epoch: route.epoch },
    steps: actions.map((action, i) => ({ action, expected_after: timed ? batch[i]!.pose : null,
      ...(witness ? { point_binding: witness } : {}) })),
    sicSituationCard: { strategy: choice.selected.id, need: 'Reach the matching opening through periodic contact', situation: reason,
      evidence, agenda: choice.entries, mode, triggerCard: choice.card,
      focus: click ?? periodicContactBox(route, route.pose.actor, route.carriers?.[route.pose.selected!]?.size), target,
      ...(route.carriers ? { carriers: route.carriers.map((body, i) => ({
        box: periodicContactBox(route, route.pose.carriers![i]!, body.size), goal: periodicContactBox(route, body.goal, body.size),
        selected: i === route.pose.selected,
      })) } : {}),
      ...(route.payloads ? { payloads: route.payloads.map((payload, i) => {
        const size = [1 + Math.max(...payload.mask.map(([x]) => x)), 1 + Math.max(...payload.mask.map(([, y]) => y))] as const;
        return { box: periodicContactBox(route, route.pose.payloads![i]!, size), destination: periodicContactBox(route, payload.goal, size),
          placed: route.pose.payloads![i] === payload.goal };
      }) } : {}),
      ...(first.contact === null ? {} : { projected: box(first.contact, first.pose.sources[first.contact]) }),
      timedSources: route.sources.map((_, i) => ({ box: box(i), active: activeSource === i,
        phase: route.rhythms[i] ? route.pose.phases[i] : null, period: route.rhythms[i]?.period ?? null })) },
    question: { reason, hypothesis_refs: evidence }, route_refs: evidence,
    compositions: [{ id: composition, observed: false, open_question: reason, relations: ['contributes_to:' + parent] }],
    sicLocalDecision: { strategy: choice.selected.id, objective: { id: composition, label: navigationPrimitives[choice.selected.id], parent }, need },
    bundle_template: { operation_key: 'OP18', composition_ref: composition, objective_ref: parent, purpose: reason,
      preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: composition } } };
}

export function createSicTranslateCoupledPieces(id = translateCoupledPiecesId): NativeFamily<CoupledProposal> {
  const learns = id === learnContactAccessId;
  let state: State | null = null;
  let route: ContactRoute | null = null;
  let periodic: PeriodicContactRoute | null = null;
  return {
    id,
    async proposeInGroup(group, observation, rows, inputs, remaining, execution) {
      if (group !== observedMechanicsGroup) return this.propose(observation, rows, inputs, remaining, execution);
      const epoch = observation.level_epoch;
      const recurring = periodic && (periodic.epoch === epoch || periodic.epoch === epoch - 1);
      if (!recurring && (!route || (route.epoch !== epoch - 1 && (route.epoch !== epoch || route.scene.fixedCarrier === undefined && !route.scene.carriers)))) return null;
      const proposal = await this.propose(observation, rows, inputs, remaining, execution);
      return proposal && (isPeriodic(proposal) || isRoute(proposal)
        && (proposal.contactRoute.scene.fixedCarrier !== undefined || proposal.contactRoute.scene.carriers)) ? proposal : null;
    },
    async propose(observation, rows, _inputs, remaining, execution): Promise<CoupledProposal | null> {
      if (remaining < 1 || !['ACTION6', ...directions.map(([id]) => id)].every(id => observation.available_action_refs.includes(id))) return null;
      const epoch = observation.level_epoch, mode = execution?.reasoningMode ?? 'exploration';
      if (periodic?.epoch === epoch) return proposePeriodicRoute(id, observation, rows, periodic, remaining, mode, execution);
      if (route?.epoch === epoch) return proposeContactRoute(id, observation, rows, route, mode);
      const retained = route?.epoch === epoch - 1 && !route.stopped ? route : null;
      if (retained?.scene.fixedCarrier !== undefined || retained?.scene.carriers) {
        const relay = identifyRelayContactRoute(observation, rows, retained);
        if (relay) return proposeContactRoute(id, observation, rows, relay, mode);
      }
      const priorPeriodic = periodic?.epoch === epoch - 1 && !periodic.stopped ? periodic : null;
      const periodicMaterial = priorPeriodic ? [priorPeriodic.actorInk, priorPeriodic.actorMarker] as const
        : retained?.scene.carrierInk === undefined ? null : [retained.scene.carrierInk, retained.scene.selectedInk] as const;
      const acquired = priorPeriodic ?? retained;
      if (acquired && periodicMaterial) {
        const scene = measurePeriodicContact(observation, rows, priorPeriodic?.calibration ?? retained!.scene.calibration,
          ...periodicMaterial, acquired.observedControls, priorPeriodic ?? undefined);
        if (scene) return proposePeriodicRoute(id, observation, rows, scene, remaining, mode, execution);
      }
      const prior = state?.epoch === epoch ? state : null;
      const initial = prior ?? measure(rows);
      if (!initial) {
        if (retained) {
          const masked = identifyMaskedContactRoute(observation, rows, retained.scene.calibration, retained.observedControls);
          if (masked) return proposeContactRoute(id, observation, rows, {
            ...masked, evidence: [...new Set([...masked.evidence, ...retained.evidence.slice(-1)])],
          }, mode);
        }
        const previous = state?.epoch === epoch - 1 ? state : null;
        const fresh = previous?.launch && identifyContactRoute(observation, rows, previous.launch, previous.motionEvidence ?? {});
        return fresh ? proposeContactRoute(id, observation, rows, fresh, mode) : null;
      }
      const local = prior ?? { ...initial, epoch: observation.level_epoch, refs: [], attempts: {}, ...(learns ? { controls: {}, contacts: [] } : {}) };
      const path = choose(local), move = path?.[0];
      if (!move) return null;
      const ref = observation.observation_ref;
      const control = local.controls?.[move.input];
      const contact = move.contact === undefined ? undefined : local.contacts?.find(effect => effect.input === move.input);
      const supportedContact = contact && move.contact !== undefined
        && eq(advance(local.position.pieces[move.contact]!, ...contact.offset), move.position.pieces[move.contact]!);
      const evidence: [string, ...string[]] = [ref, ...new Set([...local.refs, ...(control ? [control] : []), ...(contact ? [contact.evidence] : [])].filter(v => v !== ref))];
      const offer = { input: move.input, expected: move.position.pieces[move.position.selected]!, evidence };
      const probe = learns ? !!move.click || (move.contact === undefined ? !control : !supportedContact)
        : !local.refs.length || !!move.click || move.contact !== undefined;
      const { selected, entries, card } = resolveNavigationPrimitives({ mode, evidence,
        probe: probe ? offer : null, access: probe ? null : offer, interaction: null });
      if (!selected) return null;
      const witness = move.click ? await ObservedInputDomain.makeLocusWitness(observation, rows, move.click, { reason: 'Select a piece for movement', evidence }) : null;
      if (move.click && !witness) return null;
      const parent = 'G_official_completion';
      const objective = { kind: 'place_movable_pieces_in_fitting_targets', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['movable_pieces', 'matching_target_openings', 'separating_obstacle'], parentObjective: parent, satisfactionContract: 'official_progress_after_target_coverage' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const composition = id + ':' + need.id;
      const action: NativeCommand = { action_ref: move.input, data: move.click ? { x: move.click[0], y: move.click[1] } : {} };
      const situation = move.click ? 'Select the piece needed for the next move' : move.contact !== undefined
        ? 'Test whether directed contact carries the blocked piece across the separator' : 'Move the controlled piece toward a target or contact position';
      const box = ([x,y]: NativePoint) => [x, y, x + local.model.pitch - 1, y + local.model.pitch - 1];
      const attempt = key(local.position) + '>' + key(move.position);
      const visibleFocus = focusValues(rows, local.position, local.model.pitch), walk: Move[] = [];
      if (!probe && new Set(visibleFocus).size === local.position.pieces.length) {
        for (const step of path!.slice(0, Math.min(remaining, maximumCommittedActions))) {
          if (step.click || step.contact !== undefined || !local.motionEvidence?.[step.input]) break;
          walk.push(step);
        }
      }
      const actions = walk.length > 1 ? walk.map(step => ({ action_ref: step.input, data: {} })) : [action];
      return {
        status: 'proposed', kind: id, local, move, needId: need.id, attempt,
        ...(walk.length > 1 ? { walk, focusValues: visibleFocus } : {}),
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions,
        steps: actions.map((action, index) => ({ action, expected_after: (walk[index] ?? move).position.pieces,
          ...(witness ? { point_binding: witness } : {}) })),
        sicSituationCard: { strategy: selected.id, need: 'Place the pieces in the matching openings', situation, evidence, agenda: entries, mode,
          triggerCard: card, focus: box(local.position.pieces[move.position.selected]!),
          related: box(local.position.pieces[1 - move.position.selected]!), target: box(local.model.targets.find(goal => !local.position.pieces.some(p => eq(p, goal)))!),
          ...(local.contacts?.length ? { observedContact: local.contacts.map(effect => ({ evidence: effect.evidence,
            from: box(effect.from), to: box(effect.to) })) } : {}) },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id: composition, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy: selected.id, objective: { id: composition, label: navigationPrimitives[selected.id], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: composition, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: composition } },
      };
    },
    before(proposal, index, packet, current) {
      if (index === 0) {
        const admitted = proposal.binding?.observation_ref === current.observation_ref;
        return { admitted, reason: admitted ? 'piece_move_bound' : 'piece_layout_changed' };
      }
      if (isPeriodic(proposal)) {
        const previous = proposal.periodicMoves[index - 1];
        const local = proposal.periodicRoute;
        const admitted = !!previous && local.epoch === current.level_epoch
          && matchesPeriodicContact(projectPeriodicSnapshot(local, previous), packet.frame_rows);
        return { admitted, reason: admitted ? 'positions_and_actuator_phases_confirmed' : 'timed_contact_context_changed' };
      }
      if (!isRoute(proposal) && proposal.walk) {
        const previous = leg(proposal, index - 1), position = previous.move.position;
        const observed = returned(packet.frame_rows, previous);
        const values = focusValues(packet.frame_rows, position, previous.local.model.pitch);
        const admitted = current.level_epoch === previous.local.epoch && !!observed && key(position) === key(observed)
          && values.every((value, i) => value === proposal.focusValues?.[i]);
        return { admitted, reason: admitted ? 'retained_focus_and_piece_positions_confirmed' : 'piece_layout_changed' };
      }
      return { admitted: false, reason: 'piece_layout_changed' };
    },
    after(proposal, index, before, after, first, second, frames) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      if (isPeriodic(proposal)) {
        const initial = proposal.periodicRoute;
        const local = index > 0 ? projectPeriodicSnapshot(initial, proposal.periodicMoves[index - 1]!) : initial;
        const prediction = calibratedPeriodicContact(local) ? proposal.periodicMoves[index] : undefined;
        const observed = after.level_epoch === before.level_epoch && after.state === before.state
          && observePeriodicContact(local, second, frames ?? [], after.observation_ref, prediction);
        return { matched: observed ? prediction ? true : null : false, seal_prefix: !observed || !prediction,
          reason: !observed ? 'periodic_contact_projection_contradicted'
            : prediction ? 'compare_step_contact_and_periodic_response' : 'measure_actuator_phases_and_actual_controlled_pose' };
      }
      if (isRoute(proposal)) {
        const result = observeContactRoute(second, proposal.contactRoute, proposal.contactMove, after.observation_ref);
        const matched = result?.position === proposal.contactMove.position;
        const { scene } = proposal.contactRoute;
        const reason = scene.fixedCarrier === undefined && !scene.carriers ? 'compare_carrier_and_contact_piece_poses'
          : !matched ? 'shape_footprint_prediction_contradicted'
            : scene.carriers && proposal.contactMove.input === 'ACTION6' ? 'carrier_selection_confirmed'
              : proposal.contactMove.contact === null ? 'carrier_moved_and_cargo_preserved' : 'cargo_translated_and_carrier_held_position';
        return { matched, seal_prefix: true, reason };
      }
      const step = leg(proposal, index), result = returned(second, step);
      const matched = result !== null && (key(result) === key(step.move.position) || step.move.contact !== undefined && key(result) !== key(step.local.position));
      const side = step.local.model.pitch, selected = step.local.position.selected;
      const boxes = index + 1 < proposal.actions.length ? [step.local.position.pieces[selected]!, step.move.position.pieces[selected]!]
        .map(([x, y]): NativeBox => [x, y, x + side - 1, y + side - 1]) : [];
      const stable = boxes.length > 0 && unchangedOutside(first, second, boxes);
      return { matched, seal_prefix: !matched || !stable, reason: matched ? 'piece_positions_observed' : 'piece_projection_unconfirmed' };
    },
    record(before, after, _action, first, second, proposal, index, frames) {
      if (isPeriodic(proposal)) {
        const local = index > 0 && periodic?.epoch === before.level_epoch ? periodic : proposal.periodicRoute;
        if (after.levels_completed > before.levels_completed) {
          periodic = { ...local, evidence: [...local.evidence.slice(-5), after.observation_ref] };
          return { events: [], reviewEvidence: 'The measured phase route reached the opening and advanced the level.' };
        }
        const prediction = calibratedPeriodicContact(local) ? proposal.periodicMoves[index] : undefined;
        const observed = after.level_epoch === before.level_epoch && after.state === before.state
          ? observePeriodicContact(local, second, frames, after.observation_ref, prediction) : null;
        periodic = observed ? observed.planned ? { ...observed, planned: observed.planned.slice(1) } : observed : { ...local, stopped: true };
        return { events: [] };
      }
      if (isRoute(proposal)) {
        if (after.levels_completed > before.levels_completed) {
          route = { ...proposal.contactRoute, position: proposal.contactMove.position, path: [],
            evidence: [...proposal.contactRoute.evidence.slice(-5), after.observation_ref] };
        } else if (before.level_epoch === after.level_epoch && before.state === after.state) {
          route = observeContactRoute(second, proposal.contactRoute, proposal.contactMove, after.observation_ref) ??
            { ...proposal.contactRoute, stopped: true };
        }
        return { events: [] };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const step = leg(proposal, index), local = (index > 0 && state?.epoch === before.level_epoch ? state : null) ?? step.local;
      const { move } = step, result = returned(second, { local, move });
      const attempt = index === 0 ? proposal.attempt : key(local.position) + '>' + key(move.position);
      state = { ...local, position: result ?? local.position, refs: result ? [...local.refs.slice(-4), after.observation_ref] : local.refs,
        attempts: result && key(result) === key(move.position) ? local.attempts : { ...local.attempts, [attempt]: (local.attempts[attempt] ?? 0) + 1 } };
      if (!result || move.click) return { events: [] };
      const selected = local.position.selected, peer = 1 - selected;
      if (move.contact === undefined && eq(result.pieces[peer]!, local.position.pieces[peer]!)
        && eq(result.pieces[selected]!, move.position.pieces[selected]!) && !eq(result.pieces[selected]!, local.position.pieces[selected]!)) {
        state.motionEvidence = { ...local.motionEvidence, [move.input]: after.observation_ref };
        if (learns) state.controls = { ...local.controls, [move.input]: after.observation_ref };
      }
      if (move.contact === peer) {
        const from = local.position.pieces[peer]!, to = result.pieces[peer]!;
        const [left, , right] = local.model.divider;
        const crossed = from[0] < left ? to[0] > right : to[0] < left;
        if (crossed && from[1] === to[1] && eq(result.pieces[selected]!, local.position.pieces[selected]!)) {
          const [x, y] = local.model.divider, band = first[y]?.[x], steps = Math.abs(to[0] - from[0]) / local.model.pitch;
          if (band !== undefined && Number.isInteger(steps) && steps > (local.launch?.steps ?? 0) && steps <= 12) {
            state.launch = { pitch: local.model.pitch, band, steps, evidence: after.observation_ref };
          }
        }
        if (!learns) return { events: [] };
        const contacts = local.contacts?.filter(effect => effect.input !== move.input) ?? [];
        state.contacts = crossed && from[1] === to[1] ? [...contacts,
          { input: move.input, offset: [to[0] - from[0], to[1] - from[1]], evidence: after.observation_ref, from, to }] : contacts;
      }
      return { events: [] };
    },
    state: () => ({ state, ...(route ? { route } : {}), ...(periodic ? { periodic } : {}) }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as State | null);
      route = structuredClone(value.route as ContactRoute | undefined) ?? null;
      periodic = structuredClone(value.periodic as PeriodicContactRoute | undefined) ?? null;
    },
  };
}

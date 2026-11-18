import { morphologyPairs, type MorphologyPair } from '../logos-engine/v6-morphology-measurements.ts';
import { ObservedMeter } from '../logos-engine/v6-inventory-caller-context.ts';
import type { NativeBox, NativeFamily, NativeObservation, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { maximumCommittedActions } from './plan-step.ts';
import { compileStrategyGraph, observedMechanicsGroup, resolveStrategyGraph } from './strategy-agenda.ts';
import { measureInsetContact } from './inset-contact.ts';
import { measureDirectionalMotion, type DirectionalMotion } from './observed-translation.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { chooseManagedFramedPlan, chooseManagedTransitPlan, framedResidual, observedFramedRotation, observeFramedReserve,
  pixelsAt, pointKey, reserveSteps, stripUnits, type FramedReserve, type FramedRotation, type FramedTransport, type ManagedFramedPlan } from './managed-framed-access.ts';
import { chooseCycleStep, cycleSubject, learnCycleGauge, observeCycleStep, readCycleLayout, readCycleReserve, readCycleSymbol,
  type CycleGauge, type CycleKnowledge, type CycleState, type CycleStep } from './inset-cycle-route.ts';
import { chooseCompositeCycleStep, observeCompositeCycleStep, readCompositeCycle,
  type CompositeCycleEvidence, type CompositeCycleState, type CompositeCycleStep } from './inset-composite-route.ts';
import { chooseOrientedCycleStep, hasOrientation, observeOrientedCycleStep, readOrientedCycle } from './inset-oriented-cycle.ts';
import { carriedBandInks, chooseGlyphRoute, observeGlyphRoute, readGlyphRoute,
  type GlyphRouteMemory, type GlyphRouteState, type GlyphRouteStep } from './managed-glyph-access.ts';
import type { ReasoningMode } from './reasoning-mode.ts';

export const framedContactId = 'sic_framed_contact';
export const learnPatternAccessId = 'sic_learn_pattern_access';
export const framedContactStrategies = {
  locate_rigid_control: 'Identify the piece that moves with a direction',
  test_pattern_change: 'Test a contact that might change the motif',
  reach_matching_pattern: 'Approach the matching motif',
  reach_inlaid_pattern: 'Test access to the inlaid motif',
} as const;
const graph = compileStrategyGraph({ id: 'reach_an_observed_motif', version: 2, order: 'FALLBACK',
  priorities: ['reach_matching_pattern', 'reach_inlaid_pattern', 'test_pattern_change', 'locate_rigid_control'],
  strategies: {
    reach_matching_pattern: [{ fact: 'canReachPeer', expected: true, label: 'Aligned motifs and a route over the observed surface' }],
    reach_inlaid_pattern: [{ fact: 'canReachInset', expected: true, label: 'A candidate inset fits the moved piece on the observed lattice' }],
    test_pattern_change: [{ fact: 'canReachContrast', expected: true, label: 'A distinct surface can be tested from observed floor' }],
    locate_rigid_control: [{ fact: 'controlTrial', expected: true, label: 'A direction can be tested for unit translation' }],
  },
}, ['canReachPeer', 'canReachInset', 'canReachContrast', 'controlTrial']);
const directionVectors = { ACTION1: [0, -1], ACTION2: [0, 1], ACTION3: [-1, 0], ACTION4: [1, 0] } as const;
type Direction = keyof typeof directionVectors;
type Body = { at: NativePoint; pitch: number; floor: number; colors: number[]; evidence: string };
type Inset = NonNullable<ReturnType<typeof measureInsetContact>>;
type State = { epoch: number; body: Body | null; target: NativeBox | null; surface: NativeBox | null; inset: Inset | null; beneath: number[] | null;
  trials: Direction[]; blocked: string[]; tested: string[]; crossed: string[]; count: number;
  score?: number; rotation?: FramedRotation; confirmedMoves?: Direction[]; lastPair?: MorphologyPair; reserveContradicted?: boolean;
  transports?: FramedTransport[]; reserveBand?: FramedReserve };
type Transfer = { epoch: number; rotation: FramedRotation; confirmedMoves: Direction[]; victory: string };
type WalkStep = { command: Direction; from: NativePoint; landing: NativePoint; beneath: number[];
  remainingReserve?: number; terminalContact?: true };
type Plan = { command: Direction; landing: NativePoint; target: NativePoint; contact: boolean; walk?: WalkStep[] };
type Proposal = NativeProposal & { action: Direction; plan: Plan | null; target: NativeBox | null; surface: NativeBox | null;
  inset: Inset | null; beneath?: number[]; adoptedBody?: Body; needId: string; pair: MorphologyPair | null;
  managed?: ManagedFramedPlan; rotation?: FramedRotation; cycle?: { local: CycleState; step: CycleStep };
  composite?: { local: CompositeCycleState; step: CompositeCycleStep }; glyphRoute?: { local: GlyphRouteState; step: GlyphRouteStep } };
const empty = (epoch = 0): State => ({ epoch, body: null, target: null, surface: null, inset: null, beneath: null,
  trials: [], blocked: [], tested: [], crossed: [], count: 0 });
const footprint = ([x, y]: NativePoint, pitch: number): NativeBox => [x, y, x + pitch - 1, y + pitch - 1];
const overlaps = (a: NativeBox, b: readonly number[]) => a[0] <= b[2]! && a[2] >= b[0]! && a[1] <= b[3]! && a[3] >= b[1]!;

function sameLanding(first: NativeRows, second: NativeRows, { at, pitch, floor, colors }: Body, landing: NativePoint,
  beneath: readonly number[] | null): boolean {
  const prior = pixelsAt(first, at, pitch), vacancy = pixelsAt(second, at, pitch);
  const endpoint = pixelsAt(second, landing, pitch);
  if (endpoint.length !== prior.length) return false;
  if (endpoint.every((pixel, index) => pixel === prior[index]) && vacancy.some((pixel, index) => pixel !== prior[index])) return true;
  return vacancy.every((pixel, index) => pixel === (beneath?.[index] ?? floor)) && endpoint.some(pixel => colors.includes(pixel));
}

function observedTransport(first: NativeRows, second: NativeRows, { at, pitch }: Body, ordinary: NativePoint): NativePoint | null {
  const body = pixelsAt(first, at, pitch), vacancy = pixelsAt(second, at, pitch);
  if (body.length !== pitch * pitch || body.every((pixel, index) => pixel === vacancy[index])) return null;
  const candidates: NativePoint[] = [];
  for (let y = at[1] % pitch; y + pitch <= second.length; y += pitch) {
    for (let x = at[0] % pitch; x + pitch <= second[y]!.length; x += pitch) {
      if ((x === at[0] && y === at[1]) || (x === ordinary[0] && y === ordinary[1])) continue;
      if (pixelsAt(second, [x, y], pitch).every((pixel, index) => pixel === body[index])) candidates.push([x, y]);
      if (candidates.length > 1) return null;
    }
  }
  return candidates[0] ?? null;
}

function bindTranslation({ command, translations, afterRef }: DirectionalMotion, rows: NativeRows): Body | null {
  if (!Object.hasOwn(directionVectors, command)) return null;
  const [dx, dy] = directionVectors[command as Direction];
  const moving = translations.flatMap(({ displacement: [x, y], from, area, color }) => {
    const pitch = x * dx + y * dy;
    return pitch > 1 && x === dx * pitch && y === dy * pitch ? [{ box: from, area, color, pitch }] : [];
  });
  const fits = new Map<string, Body>();
  for (const { box: a, pitch } of moving) {
    for (const { box: peer, pitch: length } of moving) {
      if (length !== pitch) continue;
      const x = Math.min(a[0], peer[0]), y = Math.min(a[1], peer[1]);
      const box = footprint([x, y], pitch);
      const enclosed = moving.filter(item => item.pitch === pitch && item.box[0] >= x && item.box[1] >= y
        && item.box[2] <= box[2] && item.box[3] <= box[3]);
      if (enclosed.reduce((sum, item) => sum + item.area, 0) !== pitch * pitch) continue;
      const exposed = new Set(pixelsAt(rows, [x, y], pitch));
      if (exposed.size !== 1) continue;
      const floor = [...exposed][0]!, colors = [...new Set(enclosed.map(item => item.color))];
      if (!colors.includes(floor)) fits.set(pointKey([x, y]), { at: [x + dx * pitch, y + dy * pitch], pitch, floor, colors, evidence: afterRef });
    }
  }
  return fits.size === 1 ? [...fits.values()][0]! : null;
}

function route(rows: NativeRows, body: Body, surface: NativeBox, directions: readonly Direction[], target: NativeBox | null, aligned: boolean,
  local: State, remaining: number, inset: boolean): Plan | null {
  const { at: start, pitch, floor } = body;
  const [left, top, right, bottom] = surface;
  const queue: { at: NativePoint; depth: number; walk: WalkStep[]; first?: { command: Direction; landing: NativePoint } }[] =
    [{ at: start, depth: 0, walk: [] }];
  const seen = new Set([pointKey(start)]);
  const candidates: { plan: Plan; distance: number; floorPixels: number; depth: number; variety: number }[] = [];
  const testedIntermediate = local.tested.some(key => key.startsWith('false:'));
  for (const current of queue) {
    if (current.depth >= remaining || queue.length > 256) break;
    for (const command of directions) {
      const [dx, dy] = directionVectors[command];
      const transport = local.transports?.find(edge => edge.action === command && pointKey(edge.from) === pointKey(current.at));
      const at: NativePoint = transport?.landing ?? [current.at[0] + dx * pitch, current.at[1] + dy * pitch], key = pointKey(at);
      if (seen.has(key) || local.blocked.includes(key) || at[0] < left || at[0] + pitch - 1 > right || at[1] < 0
        || at[1] + pitch > rows.length || ((inset || !aligned) && (at[1] < top || at[1] + pitch - 1 > bottom))) continue;
      const patch = pixelsAt(rows, at, pitch), clean = patch.filter(pixel => pixel === floor).length;
      const first = current.first ?? { command, landing: at };
      if (transport || clean === patch.length || (inset && local.crossed.includes(key) && clean * 2 > patch.length)) {
        seen.add(key);
        const walk = !transport && clean === patch.length && current.walk.length === current.depth
          ? [...current.walk, { command, from: current.at, landing: at, beneath: patch }] : current.walk;
        queue.push({ at, depth: current.depth + 1, first, walk });
        continue;
      }
      const intersectsTarget = !!target && overlaps(footprint(at, pitch), target);
      const contact = aligned && intersectsTarget;
      if (local.tested.includes(`${contact}:${key}`)) continue;
      const varied = new Set(patch).size;
      if (!contact && (intersectsTarget || varied < 2 || (inset ? testedIntermediate || varied < 3 || clean * 2 <= patch.length
        : !clean && (aligned || varied < 3)))) continue;
      const distance = aligned && target ? Math.abs(at[0] + pitch / 2 - (target[0] + target[2] + 1) / 2)
        + Math.abs(at[1] + pitch / 2 - (target[1] + target[3] + 1) / 2) : 0;
      const confirmed = local.confirmedMoves ?? [];
      const ruledContact = inset && contact && testedIntermediate && current.walk.length > 0
        && current.walk.length === current.depth && confirmed.includes(command)
        && current.walk.every(step => confirmed.includes(step.command)) && current.depth + 1 <= remaining;
      const walk: WalkStep[] = ruledContact
        ? [...current.walk, { command, from: current.at, landing: at, beneath: patch, terminalContact: true }]
        : current.walk;
      candidates.push({ plan: { ...first, target: at, contact, walk }, distance, floorPixels: clean,
        depth: current.depth + 1, variety: varied });
    }
  }
  candidates.sort((a, b) => (inset ? Number(a.plan.contact) - Number(b.plan.contact) : Number(b.plan.contact) - Number(a.plan.contact))
    || a.distance - b.distance
    || (!aligned ? b.variety - a.variety : 0) || a.depth - b.depth || b.floorPixels - a.floorPixels);
  return candidates[0]?.plan ?? null;
}

function cycleProposal(family: string, plan: { cycle: NonNullable<Proposal['cycle']> } | { composite: NonNullable<Proposal['composite']> }
  | { glyphRoute: NonNullable<Proposal['glyphRoute']> },
  observation: NativeObservation,
  mode: ReasoningMode | undefined,
  remaining: number,
  rows: NativeRows,
): Proposal | null {
  const { local, step } = 'cycle' in plan ? plan.cycle : 'composite' in plan ? plan.composite : plan.glyphRoute;
  const parent = 'G_official_completion', ref = observation.observation_ref;
  const moving = 'glyphRoute' in plan ? plan.glyphRoute.local.rotation : undefined;
  const observedCycle = moving?.period ? [moving.rule.evidence, ...moving.witnesses.slice(-2 * moving.period)] : [];
  const evidence: [string, ...string[]] = [ref, ...new Set([...local.refs, ...observedCycle].filter(value => value !== ref))];
  const facts = { input: step.action, expected: step.step, evidence };
  const inContact = pointKey(step.step) === pointKey(step.target);
  const choice = resolveNavigationPrimitives({ mode: mode ?? 'assimilation', evidence,
    probe: inContact && step.purpose !== 'exit' ? facts : null, access: !inContact ? facts : null,
    interaction: inContact && step.purpose === 'exit' ? facts : null });
  const strategy = choice.selected?.id;
  if (!strategy) return null;
  const rotationConfirmed = ('composite' in plan && hasOrientation(plan.composite.local) && !!plan.composite.local.rotation)
    || ('glyphRoute' in plan && !!plan.glyphRoute.local.rotation?.period);
  const reason = step.purpose === 'transport' ? 'Test the projected landing of the forced movement'
    : step.purpose === 'recharge' ? 'Reach the recharge before running out of moves'
    : step.purpose === 'test_rotation' ? (rotationConfirmed
      ? 'Reuse the confirmed rotation and check the preserved shape and color' : 'Test the direction of rotation and check the preserved shape and color')
    : step.purpose === 'test_color' ? 'Enter the color station and verify that it preserves the shape'
      : step.purpose === 'test_shape' ? (!('cycle' in plan) ? 'Enter the shape station and verify that it preserves the color'
        : 'Re-enter the observed station and compare the changed symbol')
        : 'Reach the matching exit while keeping the current shape';
  const goal = { kind: 'match_symbol_and_reach_exit_with_reserve', scope: ref.split(':revision:', 1)[0]!,
    subjects: [pointKey(local.layout.exit)], parentObjective: parent, satisfactionContract: 'official_progress_after_symbol_and_access' };
  const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence }, id = family + ':' + need.id;
  const target = cycleSubject(local.layout, step.target), action = { action_ref: step.action, data: {} };
  const walk = step.walk?.slice(0, remaining) ?? [];
  const actions = walk.length > 1 ? walk.map(leg => ({ action_ref: leg.action, data: {} })) : [action];
  const { point: [sx, sy], side, scale } = 'display' in local.layout ? local.layout.display : local.layout.symbol;
  const symbol: NativeBox = [sx, sy, sx + side * scale - 1, sy + side * scale - 1];
  return { status: 'proposed', kind: family, action: step.action, target, inset: null, surface: null, pair: null, plan: null,
    ...plan, needId: need.id, binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions,
    steps: actions.map((command, index) => ({ action: command, expected_after: walk[index]?.step ?? step.step,
      ...(actions.length > 1 ? { landingBefore: pixelsAt(rows, walk[index]!.step, local.layout.pitch) } : {}) })),
    sicSituationCard: { strategy, need: 'Match the symbol and reach the exit within the reserve',
      situation: `${reason}. Reserve for ${step.units} moves. Current route ${step.distance} moves.`, evidence,
      agenda: choice.entries, mode: mode ?? 'assimilation', triggerCard: choice.card,
      controlledPiece: cycleSubject(local.layout, local.at), addressedRegion: target, exit: cycleSubject(local.layout, local.layout.exit),
      motifs: [symbol, 'exitBox' in local.layout ? local.layout.exitBox : cycleSubject(local.layout, local.layout.exit)], route: 'managed_access',
      ...('entry' in step && step.effect === 'transport' ? { transportEntry: cycleSubject(local.layout, step.entry) } : {}),
      routeObligation: step.purpose === 'test_shape' ? 'shape' : step.purpose === 'test_color' ? 'color'
        : step.purpose === 'test_rotation' ? 'rotation' : step.purpose,
      ...(step.purpose === 'test_rotation' ? { rotationConfirmed } : {}),
      reserve: step.units, steps: step.distance, ...(actions.length > 1 ? { plannedSeries: walk.map(leg => leg.step) } : {}) },
    question: { reason, hypothesis_refs: evidence }, route_refs: evidence,
    compositions: [{ id, observed: false, open_question: reason, relations: [`contributes_to:${parent}`] }],
    sicLocalDecision: { strategy, objective: { id, label: reason, parent }, need },
    bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: reason,
      preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
}

function cycleLeg<T extends CycleStep | CompositeCycleStep | GlyphRouteStep>(step: T, index: number): T {
  const leg = step.walk?.[index];
  return leg ? { ...step, ...leg, units: step.units - index, ...('entry' in step ? { entry: leg.step } : {}) } : step;
}

export function createSicFramedContact(family = framedContactId): NativeFamily<Proposal> {
  const fallback = family === learnPatternAccessId;
  let state = empty();
  let transfer: Transfer | null = null;
  let meter = new ObservedMeter();
  let gauge: { epoch: number; reading: CycleGauge } | null = null;
  let cycleModel: CycleKnowledge | null = null;
  let cycle: CycleState | null = null;
  let compositeModel: CompositeCycleEvidence | null = null;
  let composite: CompositeCycleState | null = null;
  let glyphMemory: GlyphRouteMemory | null = null;
  let glyphRoute: GlyphRouteState | null = null;
  function offerGlyphRoute(observation: NativeObservation, rows: NativeRows, available: readonly string[], remaining: number,
    mode: ReasoningMode | undefined,
  ): Proposal | null {
    if (fallback || glyphMemory?.epoch !== observation.level_epoch - 1 || available.length !== 4 || remaining < 1) return null;
    const local = glyphRoute?.epoch === observation.level_epoch ? glyphRoute
      : readGlyphRoute(rows, glyphMemory, observation.level_epoch, transfer?.rotation, glyphRoute?.colorEffects);
    const step = local ? chooseGlyphRoute(rows, local, available, observation.observation_ref, remaining) : null;
    return local && step ? cycleProposal(family, { glyphRoute: { local, step } }, observation, mode, remaining, rows) : null;
  }
  function offerComposite(observation: NativeObservation, rows: NativeRows, available: readonly string[], remaining: number,
    mode: ReasoningMode | undefined,
  ): Proposal | null {
    if (fallback || compositeModel?.epoch !== observation.level_epoch - 1 || available.length !== 4 || remaining < 1) return null;
    const local = composite?.epoch === observation.level_epoch ? composite
      : readOrientedCycle(rows, compositeModel, observation.level_epoch) ?? readCompositeCycle(rows, compositeModel, observation.level_epoch);
    const step = local ? hasOrientation(local) ? chooseOrientedCycleStep(rows, local, available, remaining)
      : chooseCompositeCycleStep(rows, local, available, remaining) : null;
    return local && step ? cycleProposal(family, { composite: { local, step } }, observation, mode, remaining, rows) : null;
  }
  return {
    id: family,
    async proposeInGroup(group, observation, rows, inputs, remaining, execution) {
      if (group === observedMechanicsGroup) {
        const available = inputs.map(input => input.action_ref).filter(key => Object.hasOwn(directionVectors, key));
        return offerComposite(observation, rows, available, remaining, execution?.reasoningMode)
          ?? offerGlyphRoute(observation, rows, available, remaining, execution?.reasoningMode);
      }
      return this.propose(observation, rows, inputs, remaining, execution);
    },
    async propose(observation, rows, inputs, remaining, execution) {
      let local = state.epoch === observation.level_epoch ? state : empty(observation.level_epoch);
      const available = inputs.map(input => input.action_ref).filter((key): key is Direction => Object.hasOwn(directionVectors, key));
      const compositeProposal = offerComposite(observation, rows, available, remaining, execution?.reasoningMode);
      if (compositeProposal) return compositeProposal;
      const glyphProposal = offerGlyphRoute(observation, rows, available, remaining, execution?.reasoningMode);
      if (glyphProposal) return glyphProposal;
      if (observation.level_epoch === state.epoch + 1 && state.score !== undefined && observation.levels_completed > state.score
        && state.rotation && state.confirmedMoves?.length) {
        // Another SIC provider may have issued the winning command.
        transfer = { epoch: state.epoch, rotation: state.rotation, confirmedMoves: state.confirmedMoves, victory: observation.observation_ref };
      }
      const recalled = transfer?.epoch === observation.level_epoch - 1 && !local.reserveContradicted ? transfer : null;
      if (remaining < 1 || (local.count >= 32 && !recalled) || available.length !== 4) return null;
      if (cycleModel?.epoch === observation.level_epoch - 1) {
        const current = cycle?.epoch === observation.level_epoch ? cycle : null;
        const fresh = current ? null : readCycleLayout(rows, cycleModel);
        const learned = current ?? (fresh ? { ...fresh, epoch: observation.level_epoch, spentCharge: false,
          triedSymbols: [], refs: [cycleModel.ref], stopped: false } : null);
        const step = learned ? chooseCycleStep(rows, learned) : null;
        if (learned && step && available.includes(step.action)) {
          const proposed = cycleProposal(family, { cycle: { local: learned, step } }, observation, execution?.reasoningMode, remaining, rows);
          if (proposed) return proposed;
        }
      }
      if (recalled) meter.observe(observation.level_epoch, observation.observation_ref, rows);
      if (fallback && !local.body && !execution?.readDirectionalMotion) return null;
      const [pairs, parts] = await morphologyPairs(rows, 'eligible_components');
      const visiblePair = !local.inset && pairs.length === 1 && pairs[0]!.quarter_turns !== null ? pairs[0]! : null;
      const partlyCovered = recalled && local.body && local.lastPair?.sites.some(site => overlaps(footprint(local.body!.at, local.body!.pitch), site));
      const pair = visiblePair ?? (partlyCovered ? local.lastPair! : null);
      const inset = !pair ? local.inset ?? (!local.body ? measureInsetContact(rows, parts) : null) : null;
      if (!pair && !inset) return null;
      const motion = fallback && !local.body ? execution?.readDirectionalMotion?.() : null;
      if (fallback && !local.body) {
        if (!motion || motion.afterRef !== observation.observation_ref || motion.levelEpoch !== observation.level_epoch) return null;
        const measured = bindTranslation(motion, rows);
        if (!measured || (inset && measured.pitch !== inset.body[2] - inset.body[0] + 1)) return null;
        local = { ...local, body: measured };
      }
      const body = local.body, ref = observation.observation_ref;
      const surface = inset?.surface ?? (body ? local.surface ?? parts.filter(part => part.color === body.floor
        && overlaps([body.at[0] - 1, body.at[1] - 1, body.at[0] + body.pitch, body.at[1] + body.pitch], part.bbox))
        .sort((a, b) => b.area - a.area)[0]?.bbox ?? null : null);
      const sites = pair?.sites ?? [inset!.target];
      const peers = surface ? sites.filter(site => site[0]! >= surface[0] && site[1]! >= surface[1]
        && site[2]! <= surface[2] && site[3]! <= surface[3]) : [];
      const retained = local.target && sites.some(site => site.every((value, index) => value === local.target![index])) ? local.target : null;
      const target = inset?.target ?? retained ?? (peers.length === 1 ? peers[0] as unknown as NativeBox : null);
      const forecast = recalled && body && pair ? meter.forecast() : null;
      const rotation = local.rotation ?? recalled?.rotation;
      const directions = recalled ? Object.fromEntries(available.filter(command => recalled.confirmedMoves.includes(command))
        .map(command => [command, directionVectors[command]])) : {};
      const transit = rotation && body && pair && surface && local.reserveBand && local.transports?.length
        ? chooseManagedTransitPlan(rows, parts, pair, { body, surface, beneath: local.beneath, blocked: local.blocked,
          transports: local.transports, directions }, rotation, local.reserveBand, observation, execution?.remainingLevelActions ?? remaining)
        : null;
      const managed = transit ?? (forecast && body && pair && rotation ? chooseManagedFramedPlan(rows, parts, pair, body, local.beneath,
        rotation, forecast, directions, local.blocked, execution?.remainingLevelActions ?? remaining) : null);
      const managedWalk: WalkStep[] = [];
      if (managed && body) for (const step of managed.walk) {
        const beneath = pixelsAt(rows, step.to, body.pitch);
        if (!Object.hasOwn(directionVectors, step.command) || beneath.length !== body.pitch ** 2
          || beneath.some(pixel => pixel !== body.floor)) break;
        managedWalk.push({ command: step.command as Direction, from: step.from, landing: step.to, beneath,
          remainingReserve: step.remaining_after });
      }
      const plan: Plan | null = managed ? { command: managed.command as Direction, landing: managed.landing, target: managed.target,
        contact: managed.contact, walk: managedWalk } : body && surface
        ? route(rows, body, surface, available, target, !!inset || (pair?.quarter_turns === 0 && !!target), local, remaining, !!inset) : null;
      const trial = !body && available.find(key => !local.trials.includes(key));
      const command = inputs.find(input => input.action_ref === (plan?.command ?? trial));
      if (!command) return null;
      const action = command.action_ref as Direction;
      const transport = plan && body && local.transports?.find(edge => edge.action === action && pointKey(edge.from) === pointKey(body.at));
      const proof = [body?.evidence, motion?.beforeRef, transport ? transport.evidence : null, ...(managed ? [rotation?.evidence, recalled?.victory] : [])];
      const evidence: [string, ...string[]] = [ref, ...new Set(proof.filter((value): value is string => !!value && value !== ref))];
      const native = resolveStrategyGraph({ graph, mode: 'active', facts: {
        canReachPeer: { value: plan?.contact === true && !inset, evidence },
        canReachInset: { value: plan?.contact === true && !!inset, evidence },
        canReachContrast: { value: !!plan && !plan.contact, evidence },
        controlTrial: { value: !!trial, evidence },
      }, planners: { reach_matching_pattern: () => command, reach_inlaid_pattern: () => command,
        test_pattern_change: () => command, locate_rigid_control: () => command } });
      const mode = execution?.reasoningMode ?? 'exploration';
      const offer = { input: action, expected: plan?.landing ?? null, evidence };
      const reachesTest = !!plan && pointKey(plan.landing) === pointKey(plan.target);
      const primitive = fallback || managed ? resolveNavigationPrimitives({ mode, evidence, probe: reachesTest ? offer : null,
        access: reachesTest ? null : offer, interaction: null }) : null;
      const selected = primitive?.selected ?? native.selected;
      if (!selected || !native.selected) return null;
      const strategy = selected.id, objective = 'G_official_completion';
      const label = managed ? {
        recharge: 'Reach the candidate recharge before the measured reserve runs out',
        rotation: 'Reach the observed rotator within the measured reserve',
        exit: 'Reach the exit with the matching orientation and enough reserve',
        color: 'Test the marked contact that may match the target color',
        transport: 'Use the candidate transport and check its actual landing',
      }[managed.obligation] : framedContactStrategies[native.selected.id];
      const moves = (count: number) => `${count} ${count === 1 ? 'move' : 'moves'}`;
      const plannedRefills = managed?.recharges ? ` with ${managed.recharges} planned ${managed.recharges === 1 ? 'recharge' : 'recharges'}` : '';
      const situation = managed ? `${label}. Reserve for ${moves(managed.reserve)}. Current route ${moves(managed.steps)}${plannedRefills}.` : label;
      const goal = { kind: managed ? 'align_and_reach_with_reserve' : 'test_access_to_visible_motif',
        scope: ref.split(':revision:', 1)[0]!, subjects: sites.map(site => site.join(',')),
        parentObjective: objective, satisfactionContract: 'observe_public_contact_and_official_progress' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `framed-contact:${need.id}`;
      const walk = (!recalled || managed) && plan?.walk && plan.walk.length > 1
        ? plan.walk.slice(0, Math.min(remaining, maximumCommittedActions)) : [];
      const actions = walk.length ? walk.map(step => ({ action_ref: step.command, data: {} })) : [command];
      return { status: 'proposed', kind: family, actions, action, plan, target, surface, inset, needId: need.id, pair,
        ...(managed && rotation ? { managed, rotation } : {}),
        ...(fallback && body ? { adoptedBody: body } : {}),
        ...(body && plan && (inset || managed) ? { beneath: pixelsAt(rows, plan.landing, body.pitch) } : {}),
        steps: actions.map((action, index) => ({ action, expected_after: walk[index]?.landing ?? null,
          ...(walk[index] ? { landingBefore: walk[index]!.beneath } : {}) })),
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, mode: managed ? mode : plan?.contact ? 'solving' : 'exploration',
          need: managed ? transit ? 'Match the color and orientation and reach the exit within the reserve'
            : 'Match the orientation and reach the exit within the reserve'
            : inset ? 'Test what happens on reaching the inlaid motif' : 'Find how to reach the matching motif',
          situation, evidence, agenda: primitive?.entries ?? native.entries, motifs: sites,
          ...(walk.length ? { plannedSeries: walk.map(step => step.landing) } : {}),
          ...(managed ? { routeObligation: managed.obligation, exit: managed.targetBox } : {}),
          ...(motion ? { motionSource: motion.family, motionBefore: motion.beforeRef } : {}),
          ...(body ? { controlledPiece: footprint(body.at, body.pitch) } : {}),
          ...(body && plan ? { addressedRegion: footprint(plan.target, body.pitch) } : {}) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${objective}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent: objective }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: objective, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, packet, observation) {
      if (index > 0) {
        const step = proposal.steps?.[index];
        const pitch = proposal.cycle?.local.layout.pitch ?? proposal.composite?.local.layout.pitch
          ?? proposal.glyphRoute?.local.layout.pitch ?? proposal.adoptedBody?.pitch ?? state.body?.pitch;
        if (!step || !pitch || !Array.isArray(step.expected_after) || step.expected_after.length !== 2
          || !step.expected_after.every(Number.isSafeInteger) || !Array.isArray(step.landingBefore)
          || proposal.binding?.level_epoch !== observation.level_epoch) {
          return { admitted: false, reason: 'framed_contact_scope_changed' };
        }
        const [x, y] = step.expected_after;
        const pixels = pixelsAt(packet.frame_rows, [x, y], pitch);
        const expected = step.landingBefore;
        const admitted = pixels.length === pitch ** 2 && pixels.every((pixel, i) => pixel === expected[i]);
        return { admitted, reason: admitted ? 'declared_bfs_landing_still_available' : 'declared_bfs_landing_changed' };
      }
      const admitted = proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'framed_contact_scope_bound' : 'framed_contact_scope_changed' };
    },
    async after(proposal, index, before, after, first, second) {
      const scored = after.levels_completed > before.levels_completed;
      const complete = index + 1 >= proposal.actions.length;
      const walk = proposal.plan?.walk?.[index];
      if (!scored && walk?.terminalContact && proposal.actions.length > 1) return {
        matched: false, seal_prefix: true, reason: 'planned_contact_did_not_advance_the_level',
      };
      if (!scored && walk && proposal.actions.length > 1) {
        const body = proposal.adoptedBody ?? state.body;
        const prior = body && pixelsAt(first, walk.from, body.pitch);
        const landing = body && pixelsAt(second, walk.landing, body.pitch);
        const reserve = proposal.managed?.reserveBand;
        const matched = (!reserve || reserveSteps(second, reserve) === walk.remainingReserve)
          && !!body && !!prior && !!landing && prior.length === body.pitch ** 2
          && prior.every((pixel, i) => pixel === landing[i])
          && pixelsAt(second, walk.from, body.pitch).some((pixel, i) => pixel !== prior[i]);
        return { matched, seal_prefix: !matched, reason: matched ? 'declared_bfs_translation_confirmed' : 'declared_bfs_translation_diverged' };
      }
      if (proposal.glyphRoute && !scored) {
        const { local, step } = proposal.glyphRoute;
        const from = step.walk?.[index - 1]?.step;
        const result = observeGlyphRoute(first, second, from ? { ...local, at: from } : local, cycleLeg(step, index), after.observation_ref);
        return { matched: result?.matched ?? false, seal_prefix: complete || result?.matched !== true, reason: result?.reason ?? 'glyph_or_landing_unresolved' };
      }
      if (proposal.composite && !scored) {
        const { local, step } = proposal.composite;
        const leg = cycleLeg(step, index);
        const observed = hasOrientation(local) ? observeOrientedCycleStep(first, second, local, leg) : observeCompositeCycleStep(first, second, local, leg);
        return { matched: !!observed, seal_prefix: complete || !observed, reason: observed?.reason ?? 'glyph_or_reserve_prediction_contradicted' };
      }
      if (proposal.cycle && !scored) {
        const { local, step } = proposal.cycle;
        const observed = observeCycleStep(second, first, local, cycleLeg(step, index));
        return { matched: !!observed, seal_prefix: complete || !observed, reason: observed?.reason ?? 'cycle_or_reserve_prediction_contradicted' };
      }
      const body = fallback ? proposal.adoptedBody : state.body;
      const moved = !scored && proposal.plan && body ? sameLanding(first, second, body, proposal.plan.landing, state.beneath) : null;
      const effect = moved && proposal.managed ? await managedEffect(proposal, second) : null;
      const matched = effect ? effect.matched : moved;
      return { matched, seal_prefix: true, reason: scored ? 'official_boundary'
        : effect?.reason ?? (matched === false ? 'predicted_piece_did_not_leave' : 'observe_the_contact_or_displacement'),
        ...(scored ? { sic_need: { id: proposal.needId, status: 'satisfied' } } : {}) };
    },
    async record(before, after, _command, first, second, proposal, index, frames) {
      const walk = proposal.actions.length > 1 ? proposal.plan?.walk?.[index] : null;
      if (walk) proposal = { ...proposal, action: walk.command, beneath: walk.beneath, plan: {
        ...proposal.plan!, command: walk.command, landing: walk.landing,
      } };
      if (proposal.glyphRoute) proposal = { ...proposal, glyphRoute: {
        local: index > 0 && glyphRoute ? glyphRoute : proposal.glyphRoute.local, step: cycleLeg(proposal.glyphRoute.step, index) } };
      if (proposal.composite) proposal = { ...proposal, composite: {
        local: index > 0 && composite ? composite : proposal.composite.local, step: cycleLeg(proposal.composite.step, index) } };
      if (proposal.cycle) proposal = { ...proposal, cycle: {
        local: index > 0 && cycle ? cycle : proposal.cycle.local, step: cycleLeg(proposal.cycle.step, index) } };
      if (after.levels_completed > before.levels_completed) {
        const transitions = proposal.composite?.local.transitions;
        if (proposal.composite && transitions) {
          const { local } = proposal.composite;
          const { pitch, body, floor, gauge, fullReserve, exitRim, display, anchorInk, shape } = local.layout;
          const rotation = hasOrientation(local) && local.rotation ? { advance: local.rotation, stamp: local.layout.orientationStamp } : undefined;
          compositeModel = { epoch: before.level_epoch, ref: after.observation_ref, pitch, body, floor, gauge, fullReserve, exitRim, display,
            patternStation: pixelsAt(first, shape, pitch), observed: { anchorInk, transitions, ...(rotation ? { rotation } : {}) } };
          return { events: [], ...(hasOrientation(local) ? { reviewEvidence: 'The matched shape, color and orientation opened the exit.' } : {}) };
        }
        if (proposal.glyphRoute) {
          const { actor, pitch, floor, peerScale, reserve, bandInks, directions } = proposal.glyphRoute.local.layout;
          glyphMemory = { epoch: before.level_epoch, evidence: after.observation_ref, actor, pitch, floor, peerScale, reserve, bandInks, directions };
          return { events: [], reviewEvidence: 'The matched shape and color opened the exit.' };
        }
        const learned = proposal.cycle?.local;
        if (learned?.restoredReserve && cycleModel?.epoch === before.level_epoch - 1) {
          const { pitch, gauge, body, station, exit, symbol } = learned.layout;
          compositeModel = { epoch: before.level_epoch, ref: after.observation_ref, pitch, gauge, body, floor: cycleModel.floor,
            patternStation: pixelsAt(first, station, pitch), exitRim: first[exit[1]]![exit[0]]!,
            fullReserve: learned.restoredReserve, display: symbol };
        }
        if (proposal.inset && state.body && gauge?.epoch === before.level_epoch && gauge.reading.observations >= 2) {
          cycleModel = { epoch: before.level_epoch, gauge: gauge.reading, pitch: state.body.pitch,
            floor: state.body.floor, ref: after.observation_ref };
        }
        const rotation = state.rotation ?? proposal.rotation;
        if (rotation && state.confirmedMoves?.length) {
          if (state.body && state.reserveBand && state.reserveBand.samples >= 2 && state.transports?.length) {
            const { body, reserveBand } = state;
            const bandInks = carriedBandInks(first, body, state.transports);
            if (bandInks.length) glyphMemory = { epoch: before.level_epoch, evidence: after.observation_ref,
              actor: pixelsAt(first, body.at, body.pitch), pitch: body.pitch, floor: body.floor, peerScale: rotation.peerScale,
              reserve: reserveBand, bandInks, directions: state.confirmedMoves };
          }
          transfer = { epoch: before.level_epoch, rotation, confirmedMoves: state.confirmedMoves, victory: after.observation_ref };
          meter.observe(after.level_epoch, after.observation_ref, second);
          return { events: [], reviewEvidence: 'The exit was reached after alignment. Retain the selective rotation for the next layout.' };
        }
      }
      if (after.level_epoch !== before.level_epoch || after.state !== before.state) return { events: [] };
      if (proposal.glyphRoute) {
        const { local, step } = proposal.glyphRoute;
        const result = observeGlyphRoute(first, second, local, step, after.observation_ref);
        if (result) glyphRoute = result.state;
        return { events: [], reviewEvidence: result?.evidence };
      }
      if (proposal.composite) {
        const { local, step } = proposal.composite;
        if (hasOrientation(local)) {
          const observed = observeOrientedCycleStep(first, second, local, step);
          composite = { ...(observed?.state ?? local), stopped: !observed, refs: [...local.refs.slice(-5), after.observation_ref] };
          return { events: [], ...(observed?.evidence ? { reviewEvidence: observed.evidence } : {}) };
        }
        const observed = observeCompositeCycleStep(first, second, local, step);
        const repeated = !!observed?.symbol && !observed.matchesGoal && local.seen.includes(observed.symbol);
        const shape = local.transitions?.shape ?? {}, color = local.transitions?.color ?? {};
        const transitions = { shape: observed?.changedShape ? { ...shape, [observed.changedShape[0]]: observed.changedShape[1] } : shape,
          color: observed?.changedColor ? { ...color, [observed.changedColor[0]]: observed.changedColor[1] } : color };
        composite = { ...local, at: observed ? step.step : local.at, stopped: !observed || repeated,
          transitions,
          seen: observed?.symbol ? [...local.seen, observed.symbol] : local.seen,
          spent: observed && step.charge >= 0 ? local.spent | (1 << step.charge) : local.spent,
          refs: [...local.refs.slice(-5), after.observation_ref] };
        return { events: [] };
      }
      if (proposal.cycle) {
        const { local, step } = proposal.cycle, observed = observeCycleStep(second, first, local, step);
        const priorSymbol = observed?.symbol ? readCycleSymbol(first, local.layout) : null;
        const repeated = !!observed?.symbol && observed.symbol !== local.layout.symbol.target && local.triedSymbols.includes(observed.symbol);
        cycle = { ...local, at: observed ? step.step : local.at, stopped: !observed || repeated,
          triedSymbols: priorSymbol ? [...new Set([...local.triedSymbols, priorSymbol])] : local.triedSymbols,
          spentCharge: local.spentCharge || observed?.recovered === true, refs: [...local.refs.slice(-5), after.observation_ref],
          ...(observed?.recovered ? { restoredReserve: readCycleReserve(second, local.layout.gauge) } : {}) };
        return { events: [] };
      }
      if (proposal.inset && before.frame_hash !== after.frame_hash) {
        const pitch = proposal.inset.body[2] - proposal.inset.body[0] + 1;
        const reading = learnCycleGauge(first, second, pitch, gauge?.epoch === before.level_epoch ? gauge.reading : undefined);
        if (reading) gauge = { epoch: before.level_epoch, reading };
      }
      if (state.epoch !== before.level_epoch) state = empty(before.level_epoch);
      if (walk && transfer?.epoch === before.level_epoch - 1 && !state.reserveContradicted) {
        meter.observe(after.level_epoch, after.observation_ref, second);
      }
      state.score = before.levels_completed;
      if (fallback && !state.body && proposal.adoptedBody) state.body = proposal.adoptedBody;
      state.count++;
      state.target = proposal.target;
      state.surface = proposal.surface;
      state.inset = proposal.inset;
      if (proposal.surface && proposal.pair && (state.reserveBand || proposal.pair.palette_values[0] !== proposal.pair.palette_values[1])) {
        const reserve = observeFramedReserve(first, second, proposal.surface, state.reserveBand);
        if (reserve) state.reserveBand = reserve;
      }
      if (!state.body) {
        state.trials.push(proposal.action);
        state.body = bindTranslation(measureDirectionalMotion(first, second, { command: proposal.action, family,
          beforeRef: before.observation_ref, afterRef: after.observation_ref, levelEpoch: after.level_epoch }), second);
        if (state.body && proposal.inset && state.body.pitch !== proposal.inset.body[2] - proposal.inset.body[0] + 1) state.body = null;
        if (state.body) state.confirmedMoves = [...new Set([...(state.confirmedMoves ?? []), proposal.action])];
      } else if (proposal.plan) {
        const { plan } = proposal, { at, pitch } = state.body;
        const key = pointKey(plan.landing);
        if (key === pointKey(plan.target)) state.tested.push(`${plan.contact}:${key}`);
        const prior = pixelsAt(first, at, pitch), vacancy = pixelsAt(second, at, pitch);
        if (sameLanding(first, second, state.body, plan.landing, state.beneath)) {
          if (proposal.inset && !plan.contact && key === pointKey(plan.target)) state.crossed.push(key);
          state.body = { ...state.body, at: plan.landing, evidence: after.observation_ref };
          state.beneath = proposal.beneath ?? null;
          state.confirmedMoves = [...new Set([...(state.confirmedMoves ?? []), proposal.action])];
          if (proposal.managed) {
            if (proposal.pair) state.lastPair = proposal.pair;
            const effect = await managedEffect(proposal, second);
            if (effect && !effect.matched) state.reserveContradicted = true;
            if (effect?.matched && proposal.managed.effect) {
              const evidence = {
                recharge: 'Contact restored the visible reserve.',
                rotation: 'Contact applied the predicted rotation.',
                color: 'Contact changed the mobile glyph to the target color.',
                transport: 'The animated response reached the projected landing.',
                exit: 'Contact advanced the level.',
              };
              return { events: [], reviewEvidence: evidence[proposal.managed.effect] };
            }
          } else if (!state.rotation && proposal.pair && !plan.contact && key === pointKey(plan.target)) {
            const [next] = await morphologyPairs(second, 'eligible_components');
            const rotation = next.length === 1 && observedFramedRotation(proposal.pair, next[0]!,
              pixelsAt(first, plan.landing, pitch), after.observation_ref);
            if (rotation) state.rotation = rotation;
          }
        } else {
          const displaced = frames.length > 1 ? observedTransport(first, second, state.body, plan.landing) : null;
          if (displaced) {
            const edge = { from: at, action: proposal.action, landing: displaced, evidence: after.observation_ref };
            const previous = (state.transports ?? []).filter(item => item.action !== edge.action || pointKey(item.from) !== pointKey(at));
            state.transports = [...previous, edge];
            state.body = { ...state.body, at: displaced, evidence: edge.evidence };
            state.beneath = pixelsAt(first, displaced, pitch);
            return { events: [], reviewEvidence: 'The animated response transported the same piece to a different verified landing.' };
          }
          state.blocked.push(key);
          if (vacancy.some((pixel, index) => pixel !== prior[index])) state.body = null;
        }
      }
      return { events: [] };
    },
    state: () => ({ ...state, transfer, reserveMeter: transfer ? meter.state() : null, gauge, cycleModel, cycle, compositeModel, composite, glyphMemory, glyphRoute }),
    restore(value: NativeRecord) {
      const { transfer: savedTransfer, reserveMeter, gauge: savedGauge, cycleModel: savedModel, cycle: savedCycle,
        compositeModel: savedCompositeModel, composite: savedComposite, glyphMemory: savedGlyphMemory, glyphRoute: savedGlyphRoute,
        ...local } = structuredClone(value);
      state = local as State;
      transfer = (savedTransfer ?? null) as Transfer | null;
      gauge = (savedGauge ?? null) as typeof gauge;
      cycleModel = (savedModel ?? null) as CycleKnowledge | null;
      cycle = (savedCycle ?? null) as CycleState | null;
      compositeModel = (savedCompositeModel ?? null) as CompositeCycleEvidence | null;
      composite = (savedComposite ?? null) as CompositeCycleState | null;
      glyphMemory = (savedGlyphMemory ?? null) as GlyphRouteMemory | null;
      glyphRoute = (savedGlyphRoute ?? null) as GlyphRouteState | null;
      meter = new ObservedMeter();
      if (reserveMeter) meter.restore(reserveMeter as ReturnType<ObservedMeter['state']>);
    },
  };
}

async function managedEffect(proposal: Proposal, rows: NativeRows) {
  const planned = proposal.managed;
  if (planned?.effect === 'recharge') {
    const matched = planned.reserveBand ? reserveSteps(rows, planned.reserveBand) > planned.reserve
      : stripUnits(rows, planned.meter) > planned.meter.current_units;
    return { matched, reason: matched ? 'reserve_restored_by_contact' : 'predicted_recharge_absent' };
  }
  if (planned?.effect === 'color' && planned.mobileIndex !== undefined) {
    const [next] = await morphologyPairs(rows, 'eligible_components');
    const matched = next.length === 1 && next[0]!.palette_values[planned.mobileIndex] === planned.colorAfter;
    return { matched, reason: matched ? 'selective_color_confirmed' : 'predicted_color_absent' };
  }
  if (planned?.effect === 'transport' && planned.reserveBand) {
    const matched = reserveSteps(rows, planned.reserveBand) === planned.reserve - 1;
    return { matched, reason: matched ? 'observed_transport_landing_and_reserve' : 'transport_reserve_contradicted' };
  }
  if (planned?.effect === 'rotation' && proposal.rotation) {
    const [next] = await morphologyPairs(rows, 'eligible_components');
    const matched = next.length === 1 && framedResidual(next[0]!, proposal.rotation.peerScale) === planned.orientationAfter;
    return { matched, reason: matched ? 'selective_rotation_confirmed' : 'predicted_rotation_absent' };
  }
  if (planned?.effect === 'exit') return { matched: false, reason: 'predicted_exit_did_not_advance' };
  return null;
}

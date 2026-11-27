import { center, correspondence, find_body, intersects, moved_core, near } from '../logos-engine/v6-object-binding-geometry.ts';
import { distance, shift } from '../logos-engine/v6-object-binding-planning.ts';
import type { NativeBox, NativeCommand, NativeEntity, NativeFamily, NativeObservation, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { bindTranslationLanding, maximumCommittedActions, sameLandingPixels, type MeasuredLanding } from './plan-step.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';
import { chooseTransport, transportModule } from './transport-motion-card.ts';
import { assessDelivery, nextDeliveryStep, startRecoveredDelivery, type Crossing, type DeliveryModel,
  type DeliveryState, type DeliveryStep } from './sequential-ferry.ts';
import { measureGuardedFerry, observeGuardedFerry, planGuardedFerry, type GuardedFerry } from './guarded-ferry.ts';

export const carryToFrameId = 'sic_carry_to_frame';
export const learnCarryToFrameId = 'sic_learn_transport_from_motion';
export const carryToFrameStrategies = {
  measure_transport_control: 'Measure a command for the moving body',
  approach_matching_object: 'Move toward the object that fits the frame',
  test_transport_interaction: 'Test the interaction at the object',
  carry_toward_frame: 'Move the carried object toward its matching frame',
  test_delivery_at_frame: 'Test the same interaction when the object reaches the frame',
  move_to_next_pickup: 'Approach the next matched object on the departure side',
  verify_pickup: 'Take the object and verify its new position relative to the carrier',
  align_for_next_pickup: 'Position the carrier while preserving its hold',
  cross_with_cargo: 'Cross the previously observed gap while carrying the object',
  deposit_in_receiver: 'Place the object in its own receiver',
  return_without_cargo: 'Return for the remaining object after verifying the deposit',
} as const;
const soloStrategies = ['test_delivery_at_frame', 'test_transport_interaction', 'carry_toward_frame',
  'approach_matching_object', 'measure_transport_control'] as const;
const graph = compileStrategyGraph({ id: 'move_an_object_into_matching_frame', version: 1, order: 'FALLBACK',
  priorities: soloStrategies,
  strategies: {
    measure_transport_control: [{ fact: 'probe', expected: true, label: 'A command may reveal a displacement toward the target' }],
    approach_matching_object: [{ fact: 'approach', expected: true, label: 'A measured move brings the body closer to the object' }],
    test_transport_interaction: [{ fact: 'pickup', expected: true, label: 'The body overlaps the current object position' }],
    carry_toward_frame: [{ fact: 'carry', expected: true, label: 'The carried object has room to approach the matching frame' }],
    test_delivery_at_frame: [{ fact: 'release', expected: true, label: 'A region moving with the body now touches the matching frame' }],
  },
}, ['probe', 'approach', 'pickup', 'carry', 'release']);
type Strategy = typeof soloStrategies[number];
type Pair = { object: { bbox: NativeBox; palette_value: number; area: number }; frame: { bbox: NativeBox; interior_bbox: NativeBox } };
type State = { epoch: number; pair: Pair; actor: string | null; controls: Record<string, NativePoint>; held: NativeBox | null;
  movedTogether: boolean; interaction: string | null; tried: string[]; evidence: string[]; frame: string; stopped: boolean };
type ApproachLeg = { from: NativeBox; to: NativeBox; landing: MeasuredLanding };
type SingleProposal = NativeProposal & { local: State; actor: NativeBox | null; subject: NativeBox; strategy: Strategy;
  needId: string; attempt: string; walk?: ApproachLeg[] };
type MultiProposal = NativeProposal & { deliveries: DeliveryState; actor: NativeBox; transfer: DeliveryStep; needId: string };
type GuardedProposal = NativeProposal & { guarded: GuardedFerry; needId: string };
type Proposal = SingleProposal | MultiProposal | GuardedProposal;
const isGuarded = (proposal: Proposal): proposal is GuardedProposal => 'guarded' in proposal;
const isMulti = (proposal: Proposal): proposal is MultiProposal => 'deliveries' in proposal;
const unit: Readonly<Record<string, NativePoint>> = { ACTION1: [0, -1], ACTION2: [0, 1], ACTION3: [-1, 0], ACTION4: [1, 0] };
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const span = (box: NativeBox) => Math.max(box[2] - box[0] + 1, box[3] - box[1] + 1);
const overlaps = (a: NativeBox, b: NativeBox) => intersects(a, b);
const objectCandidates = (obs: NativeObservation, pair: Pair) => obs.entities.filter(e => e.palette_value === pair.object.palette_value
  && e.area >= Math.max(4, Math.ceil(pair.object.area / 2)) && e.bbox[0] !== e.bbox[2] && e.bbox[1] !== e.bbox[3]);

function actorMotion(proposal: SingleProposal, before: NativeObservation, after: NativeObservation) {
  if (!proposal.local.actor) return moved_core(before, after);
  const actor = find_body(after, proposal.local.actor) as NativeEntity | null;
  if (!actor || !proposal.actor) return null;
  return { signature: actor.signature, bbox: actor.bbox,
    delta: [actor.bbox[0] - proposal.actor[0], actor.bbox[1] - proposal.actor[1]] as NativePoint };
}

function returnedObject(proposal: SingleProposal, after: NativeObservation, delta: NativePoint) {
  const candidates = objectCandidates(after, proposal.local.pair), held = proposal.local.held;
  if (!held) return null;
  const projected = shift(held, delta);
  const exact = candidates.find(item => equal(item.bbox, projected));
  if (exact) return exact.bbox;
  const { frame } = proposal.local.pair;
  const touching = candidates.filter(item => overlaps(item.bbox, frame.bbox) &&
    distance(center(item.bbox), center(frame.bbox)) < distance(center(held), center(frame.bbox)));
  return touching.length === 1 && !candidates.some(item => equal(item.bbox, held)) ? touching[0]!.bbox : null;
}

function multipleProposal(family: string, observation: NativeObservation, deliveries: DeliveryState): MultiProposal | null {
  const actor = (find_body(observation, deliveries.model.actor) as NativeEntity | null)?.bbox;
  const transfer = actor && nextDeliveryStep(deliveries, actor);
  if (!actor || !transfer || !observation.available_action_refs.includes(transfer.command)) return null;
  const strategies = { approach: 'move_to_next_pickup', take: 'verify_pickup', align: 'align_for_next_pickup',
    cross: 'cross_with_cargo', release: 'deposit_in_receiver', return: 'return_without_cargo' } as const;
  const strategy = strategies[transfer.phase], label = carryToFrameStrategies[strategy], parent = 'G_official_completion';
  const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...deliveries.refs.filter(item => item !== ref)];
  const active = deliveries.cargo[deliveries.delivered]!;
  const next = deliveries.cargo[deliveries.delivered + 1];
  const reason = transfer.phase === 'align' && next && transfer.target === next.object.bbox
    ? 'Choose a crossing height that leaves the next object within reach after returning' : label;
  const goal = { kind: 'deliver_matching_objects_across_a_shared_passage', scope: ref.split(':revision:', 1)[0]!,
    subjects: deliveries.cargo.map(item => item.frame.bbox.join(',')), parentObjective: parent,
    satisfactionContract: 'confirm_each_delivery_and_official_progress' };
  const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence }, id = family + ':' + need.id;
  const action = { action_ref: transfer.command, data: {} };
  return { status: 'proposed', kind: family, deliveries, actor, transfer, needId: need.id, actions: [action],
    steps: [{ action, expected_after: transfer.expect }], binding: { observation_ref: ref, level_epoch: observation.level_epoch },
    sicSituationCard: { strategy, need: 'Deliver each object while preserving completed deliveries', situation: reason, mode: 'solving',
      evidence, agenda: [], actor, object: deliveries.held ?? active.object.bbox, frame: active.frame.bbox, target: transfer.target,
      ...(next ? { pendingObject: next.object.bbox } : {}) },
    question: { reason, hypothesis_refs: evidence }, route_refs: evidence,
    compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
    sicLocalDecision: { strategy, objective: { id, label, parent }, need },
    bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
      preconditions: {}, preserve_refs: [], evidence, actions: [action], outcome_guard: { path: ['value'], contains: id } } };
}

function guardedProposal(family: string, observation: NativeObservation, run: GuardedFerry, remaining: number): GuardedProposal | null {
  if (run.stopped || run.frame !== observation.frame_hash) return null;
  const plan = run.plan.length && run.plan.length <= remaining ? run.plan : planGuardedFerry(run, remaining);
  const leg = plan?.[0], actor = find_body(observation, run.ferry.model.actor) as NativeEntity | null;
  if (!plan || !leg || !actor || !observation.available_action_refs.includes(leg.input)) return null;
  const ref = observation.observation_ref, parent = 'G_official_completion';
  const evidence: [string, ...string[]] = [ref, ...run.refs.filter(item => item !== ref)];
  const strategies = { move: 'move_to_next_pickup', cross: 'cross_with_cargo', take: 'verify_pickup', release: 'deposit_in_receiver' } as const;
  const strategy = strategies[leg.role];
  const index = run.at.held ?? leg.expect.held;
  const cargo = index === null ? null : run.ferry.cargo[index];
  const label = leg.role === 'take' && run.at.bank === 1 ? 'Take back the passenger already on the receiving bank'
    : leg.role === 'release' && run.at.bank === 0 ? 'Set down the passenger to free the carrier for another crossing'
      : carryToFrameStrategies[strategy];
  const objective = { kind: 'deliver_passengers_with_observed_safety_constraints', scope: ref.split(':revision:', 1)[0]!,
    subjects: run.ferry.cargo.map(item => item.berths[1].join(',')), parentObjective: parent,
    satisfactionContract: 'official_progress_after_reversible_ferry_deliveries' };
  const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence }, id = family + ':' + need.id;
  const prefix: typeof plan = [];
  for (const step of plan) {
    if (prefix.length >= Math.min(remaining, maximumCommittedActions)
      || !observation.available_action_refs.includes(step.input) || prefix.length > 0 && step.role !== 'move') break;
    prefix.push(step);
    if (step.role !== 'move') break;
  }
  const actions = prefix.map(step => ({ action_ref: step.input, data: {} }));
  return { status: 'proposed', kind: family, guarded: { ...run, plan }, needId: need.id, actions,
    steps: prefix.map((step, index) => ({ action: actions[index]!, expected_after: step.expect })),
    binding: { observation_ref: ref, level_epoch: observation.level_epoch },
    sicSituationCard: { strategy, need: 'Transport the passengers while preserving safe combinations', situation: label, mode: 'solving',
      evidence, agenda: [], actor: actor.bbox, ...(cargo ? { object: run.heldBox ?? cargo.berths[run.at.bank], frame: cargo.berths[leg.expect.bank] } : {}) },
    question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
    compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
    sicLocalDecision: { strategy, objective: { id, label, parent }, need },
    bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
      preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
}

export function createSicCarryToFrame(family = carryToFrameId): NativeFamily<Proposal> {
  const learns = family === learnCarryToFrameId;
  let state: State | null = null;
  let measuredCrossing: { epoch: number; crossing: Crossing; ref: string } | null = null;
  let previousDelivery: DeliveryModel | null = null;
  let multiple: { epoch: number; deliveries: DeliveryState } | null = null;
  let guarded: GuardedFerry | null = null;
  // Guards follow only the actual public prefix. Publication remains in record,
  // once and in order when the native runtime closes the executed series.
  const guardedReturns = new WeakMap<GuardedProposal, Map<number, { ref: string; run: GuardedFerry }>>();
  const guardedAt = (proposal: GuardedProposal, index: number, observation: NativeObservation) => {
    if (index === 0) return proposal.guarded;
    const prior = guardedReturns.get(proposal)?.get(index - 1);
    return prior?.ref === observation.observation_ref ? prior.run : null;
  };
  let choose: NativeProgramHandle | undefined;
  return {
    id: family,
    async attachPrograms(registry) {
      if (learns) choose = await registry.registerProgram(chooseTransport, {}, await transportModule());
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION5')) return null;
      const prior = state?.epoch === observation.level_epoch && state.frame === observation.frame_hash ? state : null;
      if (prior?.stopped || (prior?.tried.length ?? 0) >= 36) return null;
      if (previousDelivery?.completed === observation.levels_completed) {
        const guardedRun = guarded?.epoch === observation.level_epoch ? guarded
          : !prior && multiple?.epoch !== observation.level_epoch ? measureGuardedFerry(observation, rows, previousDelivery, guarded) : null;
        if (guardedRun) {
          const proposal = guardedProposal(family, observation, guardedRun, remaining);
          if (proposal) return proposal;
        }
        const deliveries = multiple?.epoch === observation.level_epoch ? multiple.deliveries
          : startRecoveredDelivery(observation, rows, previousDelivery);
        if (deliveries) {
          const chosen = multipleProposal(family, observation, deliveries);
          if (chosen) return chosen;
        }
      }
      const receipt = learns && !prior ? execution?.readDirectionalMotion?.() : null;
      const motion = receipt?.afterRef === observation.observation_ref && receipt.levelEpoch === observation.level_epoch ? receipt : null;
      const translated = motion?.translations.length === 1 ? motion.translations[0] : null;
      const actors = translated ? observation.entities.filter(entity => equal(entity.bbox, translated.to) &&
        entity.palette_value === translated.color && entity.area === translated.area) : [];
      const acquired = actors.length === 1 ? actors[0]! : null;
      if (learns && !prior && (!motion || !translated || !acquired)) return null;
      const pairs = prior ? [] : correspondence(observation, rows, acquired?.signature) as Pair[];
      const pair = prior?.pair ?? (pairs.length === 1 ? pairs[0] : null);
      if (!pair) return null;
      const local = prior ?? { epoch: observation.level_epoch, pair, actor: acquired?.signature ?? null,
        controls: motion && translated ? { [motion.command]: translated.displacement } : {}, held: null,
        movedTogether: false, interaction: null, tried: [], evidence: motion ? [motion.beforeRef] : [], frame: observation.frame_hash, stopped: false };
      const actor = local.actor ? (find_body(observation, local.actor) as NativeEntity | null)?.bbox ?? null : null;
      if (local.actor && !actor) return null;
      const subject = local.held ?? pair.object.bbox;
      const target = local.held ? pair.frame.interior_bbox : subject;
      const current = local.held ?? actor;
      const remainingActions = observation.available_action_refs.filter(action =>
        !local.tried.includes(JSON.stringify([observation.frame_hash, action])));
      const moves = remainingActions.filter(action => unit[action]);
      const movesCloser = (point: NativePoint) => current && distance(center(shift(current, point)), center(target)) < distance(center(current), center(target));
      const learned = moves.filter(action => local.controls[action] && movesCloser(local.controls[action]!))
        .sort((a, b) => distance(center(shift(current!, local.controls[a]!)), center(target)) -
          distance(center(shift(current!, local.controls[b]!)), center(target)))[0];
      const experiment = moves.filter(action => !local.controls[action]).sort((a, b) =>
        Number(!!movesCloser(unit[b]!)) - Number(!!movesCloser(unit[a]!)))[0];
      const pickup = !!actor && !local.held && near(actor, subject) && remainingActions.includes('ACTION5');
      const release = !!local.held && local.movedTogether && near(local.held, pair.frame.bbox) &&
        !!local.interaction && remainingActions.includes(local.interaction);
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...local.evidence.filter(value => value !== ref)];
      const situation = { probe: !!experiment, approach: !!learned && !local.held, pickup,
        carry: !!learned && !!local.held, release, mode: execution?.reasoningMode ?? 'exploration' };
      const decision = learns ? await choose?.run({ situation }, { signal: execution?.signal }) : null;
      const evaluated = learns ? null : resolveStrategyGraph({ graph, mode: 'active', facts: {
        probe: { value: !!experiment, evidence }, approach: { value: !!learned && !local.held, evidence },
        pickup: { value: pickup, evidence }, carry: { value: !!learned && !!local.held, evidence }, release: { value: release, evidence },
      }, planners: { measure_transport_control: () => experiment ?? null, approach_matching_object: () => learned ?? null,
        test_transport_interaction: () => 'ACTION5', carry_toward_frame: () => learned ?? null, test_delivery_at_frame: () => local.interaction } });
      const choices = { measure_transport_control: experiment, approach_matching_object: situation.approach ? learned : undefined,
        test_transport_interaction: pickup ? 'ACTION5' : undefined, carry_toward_frame: situation.carry ? learned : undefined,
        test_delivery_at_frame: release ? local.interaction : undefined };
      const requested = decision?.result ?? evaluated?.selected?.id;
      if (typeof requested !== 'string' || !Object.hasOwn(choices, requested)) return null;
      const strategy = requested as Strategy, action = choices[strategy];
      if (!action) return null;
      const label = carryToFrameStrategies[strategy], parent = 'G_official_completion';
      const command: NativeCommand = { action_ref: action, data: {} };
      const goal = { kind: 'deliver_fitting_object', scope: ref.split(':revision:', 1)[0]!, subjects: ['matching_object', 'receiving_frame'],
        parentObjective: parent, satisfactionContract: 'observe_official_progress_or_object_retained_in_the_frame' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `carry-to-frame:${need.id}`;
      const walk: ApproachLeg[] = [];
      const delta = local.controls[action];
      if (strategy === 'approach_matching_object' && actor && delta) {
        let from = actor;
        while (!near(from, subject) && walk.length < Math.min(remaining, maximumCommittedActions)) {
          const direction = moves.filter(input => local.controls[input]).sort((a, b) =>
            distance(center(shift(from, local.controls[a]!)), center(target))
              - distance(center(shift(from, local.controls[b]!)), center(target)))[0];
          const [left, top, right, bottom] = from, [dx, dy] = delta;
          const to: NativeBox = [left + dx, top + dy, right + dx, bottom + dy];
          if (direction !== action || distance(center(to), center(subject)) >= distance(center(from), center(subject))) break;
          const landing = bindTranslationLanding(rows, actor, from, to);
          if (!landing) break;
          walk.push({ from, to, landing });
          from = to;
        }
      }
      const actions = walk.length > 1 ? walk.map(() => command) : [command];
      return { status: 'proposed', kind: family, actions, local, actor, subject, strategy, needId: need.id,
        ...(walk.length > 1 ? { walk } : {}),
        attempt: JSON.stringify([observation.frame_hash, command.action_ref]),
        steps: actions.map((action, index) => ({ action, expected_after: walk[index]?.to ?? null })),
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        ...(decision ? { sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation } } : {}),
        sicSituationCard: { strategy, need: 'Bring the object to the frame that matches it', mode: learned ? 'solving' : 'exploration',
          situation: release ? 'The object color has travelled with the controlled body and now touches the frame. Delivery awaits the return.' : label,
          agenda: evaluated?.entries ?? [], evidence, actor, object: subject, frame: pair.frame.bbox },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, packet, observation) {
      if (index > 0 && isGuarded(proposal)) {
        const run = guardedAt(proposal, index, observation);
        const actor = run && find_body(observation, run.ferry.model.actor) as NativeEntity | null;
        const admitted = !!run && run.epoch === observation.level_epoch && run.frame === observation.frame_hash
          && !!actor && equal(center(actor.bbox), run.at.actor);
        return { admitted, reason: admitted ? 'guarded_passenger_prefix_confirmed' : 'guarded_passenger_prefix_changed' };
      }
      if (index > 0 && !isMulti(proposal) && !isGuarded(proposal) && proposal.walk) {
        const { local } = proposal, leg = proposal.walk[index]!;
        const actor = local.actor && find_body(observation, local.actor) as NativeEntity | null;
        const admitted = local.epoch === observation.level_epoch && !!actor && equal(actor.bbox, leg.from)
          && objectCandidates(observation, local.pair).some(object => equal(object.bbox, proposal.subject))
          && sameLandingPixels(leg.landing, packet.frame_rows);
        return { admitted, reason: admitted ? 'approach_landing_and_object_confirmed' : 'transport_context_changed' };
      }
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'transport_context_bound' : 'transport_context_changed' };
    },
    after(proposal, index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true,
        reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      if (isGuarded(proposal)) {
        const run = guardedAt(proposal, index, before);
        const proof = run && before.level_epoch === after.level_epoch && before.state === after.state
          ? observeGuardedFerry(run, run.plan[0]!, after, second, []) : null;
        if (proof) {
          const prefix = guardedReturns.get(proposal) ?? new Map();
          prefix.set(index, { ref: after.observation_ref, run: proof.run });
          guardedReturns.set(proposal, prefix);
        }
        return { matched: !!proof, seal_prefix: !proof || index + 1 >= proposal.actions.length,
          reason: proof?.reason ?? 'check_ferry_return_for_a_contradiction' };
      }
      if (isMulti(proposal)) {
        const proof = assessDelivery(proposal.deliveries, proposal.transfer, after, first, second, proposal.actor);
        return { matched: proof !== null, seal_prefix: true, reason: proof?.reason ?? 'delivery_return_contradicted' };
      }
      const leg = proposal.walk?.[index];
      const motion = leg && actorMotion({ ...proposal, actor: leg.from }, before, after);
      const matched = leg ? !!motion && equal(motion.bbox, leg.to)
        && objectCandidates(after, proposal.local.pair).some(object => equal(object.bbox, proposal.subject)) : null;
      return { matched, seal_prefix: !matched || index + 1 >= proposal.actions.length,
        reason: matched ? 'approach_translation_confirmed' : 'observe_completed_motion_or_transport_interaction' };
    },
    record(before, after, command, first, second, proposal, index, frames) {
      if (isGuarded(proposal)) {
        const run = index === 0 ? proposal.guarded
          : guarded?.epoch === before.level_epoch && guarded.frame === before.frame_hash ? guarded : null;
        if (!run) {
          guarded = { ...proposal.guarded, stopped: true };
          return { events: [], reviewEvidence: 'The preceding passenger return was not acquired in order.' };
        }
        if (after.levels_completed > before.levels_completed) {
          previousDelivery = { ...run.ferry.model, completed: after.levels_completed,
            evidence: [...new Set([...run.refs, before.observation_ref, after.observation_ref])] };
          return { events: [] };
        }
        if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
        const proof = observeGuardedFerry(run, run.plan[0]!, after, second, frames ?? []);
        guarded = proof?.run ?? { ...run, stopped: true };
        const learned = proof?.reason === 'animated_reset_identified_an_unsafe_pair';
        return { events: [], ...(learned ? { reviewEvidence: 'The animated reset identified two passengers that cannot be left together unattended.' } : {}) };
      }
      if (isMulti(proposal)) {
        if (after.levels_completed > before.levels_completed) {
          const { model } = proposal.deliveries;
          previousDelivery = { ...model, completed: after.levels_completed,
            evidence: [...new Set([...model.evidence.slice(0, 1), ...proposal.deliveries.refs.slice(-4),
              before.observation_ref, after.observation_ref])] };
        } else if (before.level_epoch === after.level_epoch && before.state === after.state) {
          const proof = assessDelivery(proposal.deliveries, proposal.transfer, after, first, second, proposal.actor);
          multiple = { epoch: before.level_epoch, deliveries: proof?.state ?? { ...proposal.deliveries, stopped: true } };
        }
        return { events: [] };
      }
      const local = (index > 0 && state?.frame === before.frame_hash ? state : null) ?? proposal.local;
      const { strategy } = proposal;
      if (index > 0 && proposal.walk) proposal = { ...proposal, local, actor: proposal.walk[index]!.from,
        attempt: JSON.stringify([before.frame_hash, command.action_ref]) };
      if (after.levels_completed > before.levels_completed && strategy === 'test_delivery_at_frame'
        && local.actor && local.interaction && measuredCrossing?.epoch === before.level_epoch) {
        previousDelivery = { actor: local.actor, crossing: measuredCrossing.crossing, motion: local.controls, interaction: local.interaction,
          completed: after.levels_completed, evidence: [measuredCrossing.ref, before.observation_ref, after.observation_ref] };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const motion = actorMotion(proposal, before, after), delta = motion?.delta as NativePoint | undefined;
      const controls = { ...local.controls };
      let held = local.held, interaction = local.interaction, stopped = false, movedTogether = local.movedTogether;
      if (strategy === 'test_transport_interaction' && motion && delta && !delta.some(Boolean)) {
        const changed = objectCandidates(after, local.pair).filter(e => near(e.bbox, motion.bbox) && !equal(e.bbox, proposal.subject)
          && distance(center(e.bbox), center(motion.bbox)) <= 2 * span(proposal.subject));
        if (changed.length === 1) { held = changed[0]!.bbox; interaction = command.action_ref; }
      } else if (strategy === 'test_delivery_at_frame') {
        stopped = true;
      } else if (unit[command.action_ref] && motion && delta?.some(Boolean)) {
        if (local.held) {
          const next = returnedObject(proposal, after, delta);
          if (next) {
            held = next;
            movedTogether = true;
            const forward = controls[command.action_ref];
            if (proposal.actor && forward?.[0] && !delta[1] && Math.abs(delta[0]) > span(proposal.actor)) {
              const inverse = Object.entries(controls).find(([, point]) => point[0] === -forward[0] && point[1] === 0);
              if (inverse) measuredCrossing = { epoch: before.level_epoch, ref: after.observation_ref,
                crossing: { from: proposal.actor[0], to: motion.bbox[0], forward: command.action_ref, back: inverse[0] } };
            }
          } else { stopped = true; }
        }
        if (Math.abs(delta[0]) + Math.abs(delta[1]) <= span(motion.bbox)) controls[command.action_ref] = delta;
      }
      const candidates = !held ? (correspondence(after, second, motion?.signature ?? local.actor) as Pair[]).filter(p =>
        equal(p.frame.bbox, local.pair.frame.bbox) && near(p.object.bbox, local.pair.object.bbox)) : [];
      const pair = candidates.length === 1 ? candidates[0]! : local.pair;
      state = { ...local, pair, actor: motion?.signature ?? local.actor, held, movedTogether, interaction, controls, stopped,
        frame: after.frame_hash, tried: [...local.tried, proposal.attempt], evidence: [...local.evidence.slice(-4), after.observation_ref] };
      return { events: [] };
    },
    state: () => ({ state, measuredCrossing, previousDelivery, multiple, guarded }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as State | null);
      measuredCrossing = structuredClone((value.measuredCrossing as typeof measuredCrossing | undefined) ?? null);
      previousDelivery = structuredClone((value.previousDelivery as DeliveryModel | undefined) ?? null);
      multiple = structuredClone((value.multiple as typeof multiple | undefined) ?? null);
      guarded = structuredClone((value.guarded as GuardedFerry | undefined) ?? null);
    },
  };
}

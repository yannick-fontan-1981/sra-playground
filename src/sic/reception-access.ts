import { measureReceptionService, receptionServiceCarriers, receptionServicePath } from '../logos-engine/v6-reception-service-observation.ts';
import type { NativeBox, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { maximumCommittedActions } from './plan-step.ts';
import { motionIntoFootprint } from './observed-translation.ts';
import { observedPressureRecoveryGroup } from './public-input-exploration.ts';
import { chooseReceptionActivation, crossingRestoredStart, recordReceptionActivation, startReceptionActivation,
  type ReceptionActivation, type ReceptionActivationStep, type ReceptionMemory } from './reception-activation.ts';
import { chooseReceptionSequence, receptionSequenceReturn, recordReceptionSequence, startReceptionSequence,
  type ReceptionSequence, type ReceptionSequenceStep } from './reception-sequence.ts';

export const receptionAccessId = 'sic_reception_access';
export const learnReceptionAccessId = 'sic_learn_reception_access';
export const receptionAccessStrategies = navigationPrimitives;
type Scene = { pitch: number; background: number; cells: NativePoint[]; target: { anchor: NativePoint; color: number };
  support_candidates: { anchor: NativePoint }[]; counterparts: { request_bbox: NativeBox; body_bbox: NativeBox }[] };
type State = { epoch: number; count: number; scene: Scene; controls: Record<string, NativePoint>; trials: string[]; waits: number;
  last: { action: string; from: NativePoint | null } | null; evidence: string[]; stopped: boolean };
type Choice = { action: string; expected: NativePoint | null };
type Leg = { action_ref: string; from: NativePoint; to: NativePoint };
type ReceptionProposal = NativeProposal & { local: State; choice: Choice; attempt: string; from: NativePoint | null; wait: boolean; needId: string;
  route?: readonly Leg[] };
type ActivationProposal = NativeProposal & { activation: ReceptionActivation; step: ReceptionActivationStep; needId: string };
type SequenceProposal = NativeProposal & { sequence: ReceptionSequence; step: ReceptionSequenceStep; needId: string };
type Proposal = ReceptionProposal | ActivationProposal | SequenceProposal;
const isActivation = (proposal: Proposal): proposal is ActivationProposal => 'activation' in proposal;
const isSequence = (proposal: Proposal): proposal is SequenceProposal => 'sequence' in proposal;
const hints: Readonly<Record<string, NativePoint>> = { ACTION1: [0, -1], ACTION2: [0, 1], ACTION3: [-1, 0], ACTION4: [1, 0] };
const opposite: Readonly<Record<string, string>> = { ACTION1: 'ACTION2', ACTION2: 'ACTION1', ACTION3: 'ACTION4', ACTION4: 'ACTION3' };
const equal = (a: NativePoint | null, b: NativePoint | null) => a === b || !!a && !!b && a[0] === b[0] && a[1] === b[1];
const box = ([x, y]: NativePoint, pitch: number): NativeBox => [x, y, x + pitch - 1, y + pitch - 1];
const distance = ([x, y]: NativePoint, [a, b]: NativePoint) => Math.abs(x - a) + Math.abs(y - b);

function carrier(rows: NativeRows, scene: Scene): NativePoint | null {
  const bodies = receptionServiceCarriers(rows, scene);
  return bodies.length === 1 ? bodies[0]!.anchor as NativePoint : null;
}

function admitsLanding(rows: NativeRows, scene: Scene, to: NativePoint): boolean {
  if (equal(to, scene.target.anchor)) return true;
  if (!scene.cells.some(cell => equal(cell, to)) || scene.support_candidates.some(support => equal(support.anchor, to))) return false;
  const [x, y] = to;
  let floor = 0;
  for (let dy = 0; dy < scene.pitch; dy++) for (let dx = 0; dx < scene.pitch; dx++) {
    if (rows[y + dy]?.[x + dx] === scene.background) floor++;
  }
  return floor >= Math.floor(scene.pitch ** 2 / 2);
}

export function createSicReceptionAccess(family = receptionAccessId): NativeFamily<Proposal> {
  let state: State | null = null;
  let remembered: (ReceptionMemory & { epoch: number }) | null = null;
  let activation: ReceptionActivation | null = null;
  let sequence: ReceptionSequence | null = null;

  function offerSequence(local: ReceptionSequence, step: ReceptionSequenceStep, ref: string,
    mode: Parameters<typeof resolveNavigationPrimitives>[0]['mode']): SequenceProposal | null {
    const parent = 'G_official_completion';
    const evidence: [string, ...string[]] = [ref, ...local.evidence.filter(item => item !== ref)];
    const input = { input: step.input, expected: step.to, evidence };
    const { selected, entries, card } = resolveNavigationPrimitives({ mode, evidence, probe: null,
      interaction: step.hold ? input : null, access: step.hold ? null : input });
    if (!selected) return null;
    const situation = step.hold ? 'Hold the carrier at the support until a request badge changes'
      : local.receipts.length ? 'Keep the observed receipt and travel to another support'
        : 'Approach an active support for one of the outstanding requests';
    const goal = { kind: 'serve_separate_reception_requests', scope: ref.split(':revision:', 1)[0]!,
      subjects: ['visible_requests', 'carrier', 'active_supports'], parentObjective: parent,
      satisfactionContract: 'observe_each_request_and_official_completion' };
    const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
    const id = family + ':' + need.id, pitch = local.layout.pitch;
    const action = { action_ref: step.input, data: {} }, actions = [action];
    return { status: 'proposed', kind: family, sequence: local, step, needId: need.id, actions,
      binding: { observation_ref: ref, level_epoch: local.epoch }, steps: [{ action, expected_after: step.to }],
      sicSituationCard: { strategy: selected.id, need: 'Serve the remaining reception requests', mode, triggerCard: card,
        situation, agenda: entries, evidence, actor: local.visible ? box(local.at, pitch) : null,
        target: box(step.support, pitch), next: box(step.to, pitch),
        requests: local.badges.map((badge, index) => ({ box: badge.box,
          status: local.receipts.some(receipt => receipt.badge === index && receipt.confirmed) ? 'confirmed'
            : local.receipts.some(receipt => receipt.badge === index) ? 'observed' : 'pending' })) },
      question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
      compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
      sicLocalDecision: { strategy: selected.id, objective: { id, label: situation, parent }, need },
      bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
        preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
  }

  function offerActivation(observation: Parameters<NativeFamily['propose']>[0], rows: NativeRows, keys: string[],
    remaining: number, mode: Parameters<typeof resolveNavigationPrimitives>[0]['mode']): ActivationProposal | null {
    if (remembered?.epoch !== observation.level_epoch) return null;
    const local = activation?.epoch === observation.level_epoch ? activation
      : startReceptionActivation(rows, observation.level_epoch, observation.frame_hash, remembered);
    if (!local) return null;
    const step = chooseReceptionActivation(local, rows, remembered, keys, remaining);
    if (!step) return null;
    const ref = observation.observation_ref, parent = 'G_official_completion';
    const evidence: [string, ...string[]] = [ref, ...local.evidence.filter(item => item !== ref)];
    const input = { input: step.input, expected: step.to, evidence };
    const { selected, entries, card } = resolveNavigationPrimitives({ mode, evidence,
      probe: step.stage === 'contact' ? input : null, interaction: step.stage === 'hold' ? input : null,
      access: step.stage === 'approach' || step.stage === 'route' ? input : null });
    if (!selected) return null;
    const situation = {
      approach: 'Approach the isolated device while no matching support is active',
      contact: 'Test whether contact shifts the device or activates a distant support',
      route: local.failures.length ? 'Reach the activated support at a different time after the crossing failed'
        : 'Reach the support whose marking changed after contact',
      hold: 'Keep the carrier at the activated support while the moving request approaches',
    }[step.stage];
    const objective = { kind: local.target ? 'reach_activated_reception' : 'activate_reception_by_contact', scope: ref.split(':revision:', 1)[0]!,
      subjects: [local.requests ? 'visible_requests' : 'visible_request', 'contact_device', 'reception_support'], parentObjective: parent,
      satisfactionContract: 'official_progress_after_activation_and_reception' };
    const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence }, id = 'reception-activation:' + need.id;
    const command = { action_ref: step.input, data: {} }, actions = [command], pitch = local.layout.pitch;
    return { status: 'proposed', kind: family, actions, activation: local, step, needId: need.id,
      steps: [{ action: command, expected_after: step.to }], binding: { observation_ref: ref, level_epoch: observation.level_epoch },
      sicSituationCard: { strategy: selected.id, need: local.requests ? 'Activate a support for each visible request'
        : 'Make a support available for the visible request', mode,
        triggerCard: card, situation, agenda: entries, evidence, actor: local.visible ? box(local.at, pitch) : null,
        target: local.target ? box(local.target, pitch) : null, device: local.device ? box(local.device, pitch) : null,
        next: box(step.to, pitch), ...(local.requests ? { requests: local.requests.map(box => ({ box, status: 'pending' })) }
          : { request: local.layout.requests[0] }) },
      question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
      compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
      sicLocalDecision: { strategy: selected.id, objective: { id, label: situation, parent }, need },
      bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
        preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
  }

  return {
    id: family,
    async proposeInGroup(group, observation, rows, inputs, remaining, execution) {
      if (group !== observedPressureRecoveryGroup) return this.propose(observation, rows, inputs, remaining, execution);
      if (remembered?.epoch !== observation.level_epoch || !remembered.evidence.length) return null;
      const proposal = await this.propose(observation, rows, inputs, remaining, execution);
      if (!proposal) return null;
      if (isActivation(proposal) || isSequence(proposal)) {
        const local = isActivation(proposal) ? proposal.activation : proposal.sequence;
        // A contact return, including a restored start, keeps its measured
        // preparation ahead of unrelated trials only while that return is current.
        if (local.evidence.at(-1) !== observation.observation_ref) return null;
        const actors = receptionServiceCarriers(rows, local.layout);
        if (local.visible ? actors.length !== 1 || !equal(actors[0]!.anchor, local.at)
          : actors.length !== 0) return null;
        return proposal;
      }
      return proposal.from && proposal.local.evidence.length && proposal.local.controls[proposal.choice.action]
        ? proposal : null;
    },
    propose(observation, rows, _inputs, remaining, execution) {
      const keys = observation.available_action_refs.filter(action => hints[action]);
      if (remaining < 1 || keys.length < 2 || observation.available_action_refs.includes('ACTION6')) return null;
      const mode = execution?.reasoningMode ?? 'exploration';
      if (family === receptionAccessId && remembered?.epoch === observation.level_epoch
        && (activation?.epoch !== observation.level_epoch || activation.ready)) {
        const local = sequence?.epoch === observation.level_epoch ? sequence
          : startReceptionSequence(rows, observation.level_epoch, observation.frame_hash, remembered);
        if (local) {
          const step = chooseReceptionSequence(local, remembered, keys, remaining);
          return step ? offerSequence(local, step, observation.observation_ref, mode) : null;
        }
      }
      if (activation?.epoch === observation.level_epoch) return offerActivation(observation, rows, keys, remaining, mode);
      const prior = state?.epoch === observation.level_epoch ? state : null;
      if (prior?.stopped || (prior?.count ?? 0) >= 48) return null;
      const scene = measureReceptionService(rows, prior?.scene ?? null) as Scene | null;
      if (!scene || scene.counterparts.length !== 1 || scene.cells.length > 196) {
        return !prior ? offerActivation(observation, rows, keys, remaining, mode) : null;
      }
      const from = carrier(rows, scene), target = scene.target.anchor, atTarget = equal(from, target);
      // The completed reception already measured these controls. A simple
      // receiver is just as eligible to reuse them as an activation sequence,
      // provided its support interface and the unique current carrier match.
      const transferred = remembered?.epoch === observation.level_epoch && remembered.pitch === scene.pitch
        && remembered.supportInk === scene.target.color && from ? remembered : null;
      let local: State = prior ? { ...prior, scene } : { epoch: observation.level_epoch, count: 0, scene,
        controls: transferred?.controls ?? {}, trials: [], waits: 0, last: null,
        evidence: transferred?.evidence ?? [], stopped: false };
      if (family === learnReceptionAccessId && !prior) {
        const receipt = execution?.readDirectionalMotion?.();
        const current = receipt?.afterRef === observation.observation_ref && receipt.levelEpoch === observation.level_epoch && keys.includes(receipt.command);
        if (!from && !current) return null;
        if (current) {
          const displacement = from ? motionIntoFootprint(receipt, box(from, scene.pitch)) : null;
          if (displacement && !displacement.every(Boolean) && distance(displacement, [0, 0]) === scene.pitch) {
            local = { ...local, controls: { [receipt.command]: displacement }, evidence: [receipt.beforeRef, receipt.afterRef] };
          } else if (!from) local = { ...local, last: { action: receipt.command, from: null }, evidence: [receipt.beforeRef, receipt.afterRef] };
        }
      }
      const key = (action: string) => JSON.stringify([from, target, action]);
      const tested = (action: string) => local.trials.includes(key(action));
      const moves = Object.fromEntries(keys.flatMap(action => local.controls[action] && !tested(action) ? [[action, local.controls[action]]] : []));
      const path = from && !atTarget ? receptionServicePath(rows, scene, from, target, moves, remaining) : null;
      const outward = atTarget && local.waits < 8 ? Object.entries(local.controls).find(([action, delta]) =>
        keys.includes(action) && !scene.cells.some(([x, y]) => x === target[0] + delta[0] && y === target[1] + delta[1])) : null;
      const recover = !from && local.last ? opposite[local.last.action] : null;
      const experiment = recover && keys.includes(recover) && !tested(recover) ? recover : keys
        .filter(action => !tested(action) && !local.controls[action]).sort((a, b) => {
          const toward = (action: string) => {
            if (!from) return 0;
            const [x, y] = hints[action]!;
            return distance([from[0] + x * scene.pitch, from[1] + y * scene.pitch], target);
          };
          return toward(a) - toward(b);
        })[0];
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...local.evidence.filter(value => value !== ref)];
      const probe = experiment && !atTarget && (!path?.length || local.controls[experiment]) ? { input: experiment, expected: null, evidence } : null;
      const access = path?.[0] ? { input: path[0].action_ref, expected: path[0].to, evidence } : null;
      const interaction = outward ? { input: outward[0], expected: target, evidence } : null;
      const { selected, entries, card } = resolveNavigationPrimitives({ mode, evidence, probe, access, interaction });
      if (!selected) return null;
      const strategy = selected.id, choice: Choice = { action: selected.plan.input, expected: selected.plan.expected };
      const label = navigationPrimitives[strategy], parent = 'G_official_completion';
      const situation = strategy === 'P02' ? 'Test whether the carrier can receive a result while staying at the matching support'
        : strategy === 'P07' ? 'Follow observed displacements toward the matching support'
        : 'Measure a direction toward the candidate support';
      const objective = { kind: 'reach_support_for_visible_request', scope: ref.split(':revision:', 1)[0]!, subjects: ['visible_request', 'carrier', 'distinct_support'],
        parentObjective: parent, satisfactionContract: 'official_progress_after_arrival_at_the_candidate_support' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence }, id = `${family === receptionAccessId ? 'reception-access' : family}:${need.id}`;
      const command = { action_ref: choice.action, data: {} };
      const route = strategy === 'P07' ? (path as Leg[]).slice(0, Math.min(maximumCommittedActions, 48 - local.count)) : [];
      const actions = route.length > 1 ? route.map(leg => ({ action_ref: leg.action_ref, data: {} })) : [command];
      return { status: 'proposed', kind: family, actions, local, choice, attempt: key(choice.action), from,
        ...(actions.length > 1 ? { route } : {}),
        wait: strategy === 'P02', needId: need.id,
        steps: actions.map((action, index) => ({ action, expected_after: route[index]?.to ?? null })),
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Bring the carrier to the support for the visible request', mode, triggerCard: card,
          situation, agenda: entries, evidence, actor: from ? box(from, scene.pitch) : null, target: box(target, scene.pitch),
          request: scene.counterparts[0]!.request_bbox },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, packet, observation) {
      if (index > 0 && !isActivation(proposal) && !isSequence(proposal) && proposal.route) {
        const { local, route } = proposal, leg = route[index]!;
        const current = measureReceptionService(packet.frame_rows, local.scene) as Scene | null;
        const admitted = local.epoch === observation.level_epoch && !!current && current.pitch === local.scene.pitch
          && current.counterparts.length === 1 && equal(current.target.anchor, local.scene.target.anchor)
          && current.target.color === local.scene.target.color && equal(carrier(packet.frame_rows, current), leg.from)
          && admitsLanding(packet.frame_rows, current, leg.to)
          && !local.trials.includes(JSON.stringify([leg.from, current.target.anchor, leg.action_ref]));
        return { admitted, reason: admitted ? 'carrier_and_next_landing_confirmed' : 'carrier_or_support_changed' };
      }
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'current_carrier_and_support_bound' : 'carrier_or_support_changed' };
    },
    after(proposal, index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      if (isSequence(proposal)) {
        const { reset, position } = receptionSequenceReturn(proposal.sequence, proposal.step, second, after.frame_hash);
        const matched = reset ? false : position ? equal(position, proposal.step.to) : null;
        return { matched, seal_prefix: true, reason: reset ? 'crossing_restored_start'
          : matched ? 'carrier_projection_observed' : 'carrier_position_unconfirmed' };
      }
      if (isActivation(proposal)) {
        const { activation: local, step } = proposal;
        const reset = crossingRestoredStart(local, step, after.frame_hash);
        const actors = receptionServiceCarriers(second, local.layout);
        const observed = actors.find(body => equal(body.anchor, step.to)) ?? actors.find(body => body.color === local.carrierInk);
        const matched = reset ? false : observed ? equal(observed.anchor, step.to) : null;
        return { matched, seal_prefix: true, reason: reset ? 'crossing_restored_start' : matched ? 'carrier_projection_observed'
          : 'carrier_position_unconfirmed' };
      }
      const expected = proposal.route?.[index]?.to ?? proposal.choice.expected;
      const matched = expected ? equal(carrier(second, proposal.local.scene), expected) : null;
      return { matched, seal_prefix: !matched || index + 1 >= proposal.actions.length,
        reason: matched ? 'carrier_projection_observed' : 'compare_carrier_and_support_return' };
    },
    record(before, after, issued, _first, second, proposal, index) {
      if (isSequence(proposal)) {
        if (after.levels_completed > before.levels_completed && remembered) {
          remembered = { ...remembered, epoch: after.level_epoch,
            evidence: [...proposal.sequence.evidence.slice(-4), before.observation_ref, after.observation_ref] };
          return { events: [], reviewEvidence: 'The remaining reception completed the level.' };
        }
        if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
        const result = recordReceptionSequence(proposal.sequence, proposal.step, second, after.frame_hash, after.observation_ref);
        sequence = result.next;
        if (activation?.ready && after.frame_hash === proposal.sequence.inactiveEntry?.hash) {
          activation = { ...activation, ready: false, device: activation.firstDevice, at: activation.start,
            target: null, tick: 0, activation: 0, visible: true, evidence: sequence.evidence };
        }
        return { events: [], ...(result.evidence ? { reviewEvidence: result.evidence } : {}) };
      }
      if (isActivation(proposal)) {
        if (after.levels_completed > before.levels_completed && remembered && proposal.activation.target) {
          remembered = { ...remembered, epoch: after.level_epoch,
            evidence: [...proposal.activation.evidence.slice(-4), before.observation_ref, after.observation_ref] };
          return { events: [], reviewEvidence: proposal.step.stage === 'hold'
            ? 'The activated support received the requested body while the carrier held its position.'
            : 'The activated support received the requested body as the carrier reached it.' };
        }
        if (before.level_epoch !== after.level_epoch || before.state !== after.state || !remembered) return { events: [] };
        const result = recordReceptionActivation(proposal.activation, proposal.step, second, after.frame_hash, after.observation_ref, remembered);
        activation = result.next;
        if (activation.ready) {
          const next = startReceptionSequence(second, after.level_epoch, after.frame_hash, remembered);
          if (next) {
            const sameActivation = sequence?.epoch === after.level_epoch && sequence.initialHash === next.initialHash;
            sequence = { ...next, inactiveEntry: { hash: activation.initialHash, at: activation.start }, evidence: activation.evidence,
              failures: sameActivation ? sequence!.failures : [], blocked: sameActivation ? sequence!.blocked : [] };
          } else {
            activation = { ...activation, ready: false };
          }
        }
        return { events: [], ...(result.evidence ? { reviewEvidence: result.evidence } : {}) };
      }
      const local = (index > 0 && state?.epoch === before.level_epoch ? state : null) ?? proposal.local;
      const from = proposal.route?.[index]?.from ?? proposal.from;
      const expected = proposal.route?.[index]?.to ?? proposal.choice.expected;
      const motion = local.controls[issued.action_ref];
      // Reception can score on the measured arrival itself. The old carrier
      // may disappear into the completion animation, so bind that official
      // return to this known displacement and this support, not another score.
      const arrives = from && motion && equal(expected, local.scene.target.anchor)
        && equal([from[0] + motion[0], from[1] + motion[1]], local.scene.target.anchor);
      if (after.levels_completed === before.levels_completed + 1 && (equal(from, local.scene.target.anchor) || arrives)) {
        remembered = { epoch: after.level_epoch, pitch: local.scene.pitch, supportInk: local.scene.target.color,
          controls: { ...(remembered?.pitch === local.scene.pitch ? remembered.controls : {}), ...local.controls },
          evidence: [...local.evidence.slice(-4), before.observation_ref, after.observation_ref] };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { wait } = proposal, position = carrier(second, local.scene), controls = { ...local.controls };
      if (from && position) {
        const delta: NativePoint = [position[0] - from[0], position[1] - from[1]];
        if (Math.abs(delta[0]) + Math.abs(delta[1]) === local.scene.pitch && (delta[0] === 0 || delta[1] === 0)) controls[issued.action_ref] = delta;
      }
      const attempt = index === 0 ? proposal.attempt : JSON.stringify([from, local.scene.target.anchor, issued.action_ref]);
      state = { ...local, count: local.count + 1, controls, trials: equal(from, position) || !position ? [...local.trials, attempt] : local.trials, waits: local.waits + Number(wait),
        last: { action: issued.action_ref, from }, stopped: wait && !equal(position, local.scene.target.anchor),
        evidence: [...local.evidence.slice(-4), after.observation_ref] };
      return { events: [] };
    },
    state: () => ({ state, ...(remembered ? { remembered } : {}), ...(activation ? { activation } : {}), ...(sequence ? { sequence } : {}) }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as State | null);
      remembered = structuredClone((value.remembered as typeof remembered) ?? null);
      activation = structuredClone((value.activation as typeof activation) ?? null);
      sequence = structuredClone((value.sequence as typeof sequence) ?? null);
    },
  };
}

import { animatedCrossInvitation } from '../logos-engine/v6-animated-contact.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeEntity, NativeFamily, NativeObservation, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { measureAnimatedContact, type AnimatedContact } from './observed-animation.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, observedMechanicsGroup, resolveStrategyGraph } from './strategy-agenda.ts';
import { chooseRegulatedContact, learnCurveWitness, mayRegulateContact, measureRegulatedAdjustment, regulatedContactStrategies, retainRegulatedReturn,
  type CurveWitness, type RegulatedChoice } from './regulated-transient-contact.ts';

export const animationContactId = 'sic_animation_contact';
export const learnAnimationContactId = 'sic_learn_animation_contact';

export function currentRegulatedTrial(state: NativeRecord, observation: NativeObservation): string | undefined {
  const trial = (state.curve as CurveWitness | undefined)?.animatedTrial;
  return trial?.epoch === observation.level_epoch ? trial.ref : undefined;
}

export const animationContactStrategies = {
  observe_transient_motion: 'Test an input and follow what moves through the animation',
  refine_transient_path: 'Test a new point to clarify the observed path',
  test_transient_contact: 'Test a point that could bring the moving piece into contact',
  ...regulatedContactStrategies,
} as const;

const graph = compileStrategyGraph({
  id: 'use_observed_motion_to_test_contact', version: 1, order: 'FALLBACK',
  priorities: ['test_transient_contact', 'refine_transient_path', 'observe_transient_motion'],
  strategies: {
    test_transient_contact: [{ fact: 'contact', expected: true, label: 'The measured path and the stationary piece give a current contact projection' }],
    refine_transient_path: [{ fact: 'disclosure', expected: true, label: 'The observed path suggests a different input that could distinguish the remaining possibilities' }],
    observe_transient_motion: [{ fact: 'invitation', expected: true, label: 'A distinct point lies above the gap of one pair of comparable pieces, with lateral controls available' }],
  },
}, ['contact', 'disclosure', 'invitation']);

type State = AnimatedContact & { epoch: number; frameHash: string; evidence: string[]; tried: NativePoint[] };
type FirstContact = { local: State; target: NativePoint; regulated?: never };
type Proposal = NativeProposal & { needId: string } & (FirstContact | { regulated: RegulatedChoice });
const samePoint = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
function hasUniquePairBelowAim(entities: readonly NativeEntity[], [x, y]: NativePoint): boolean {
  const compact = entities.flatMap(({ bbox: [l, t, r, b], area }) => {
    const width = r - l + 1, height = b - t + 1;
    return Math.min(width, height) >= 3 && Math.max(width, height) <= 2 * Math.min(width, height)
      && area >= width * height / 2 ? [{ area, extent: Math.max(width, height), l, t, r }] : [];
  });
  const pairs = compact.flatMap((a, i) => compact.slice(i + 1).filter(b => Math.abs(a.area - b.area) <= Math.max(a.extent, b.extent)
    && y < Math.min(a.t, b.t) && (a.r < x && x < b.l || b.r < x && x < a.l)));
  return pairs.length === 1;
}

async function regulatedProposal(observation: NativeObservation, rows: NativeRows, choice: RegulatedChoice, family: string): Promise<Proposal | null> {
  const ref = observation.observation_ref, parent = 'G_official_completion';
  const label = choice.avoidedPortals && choice.shot ? 'Test an arc that reaches the target while avoiding the perpendicular portals'
    : regulatedContactStrategies[choice.strategy];
  const action = choice.action, actions = [action];
  const evidence: [string, ...string[]] = [ref, ...choice.evidence.filter(value => value !== ref)];
  const pointBinding = choice.projected && await ObservedInputDomain.makeLocusWitness(observation, rows, choice.projected, { reason: label, evidence });
  if (choice.projected && !pointBinding) return null;
  const objective = { kind: 'adapt_observed_motion_to_current_clearance', scope: ref.split(':revision:', 1)[0]!,
    subjects: ['adjustable_magnitude', 'moving_piece', 'stationary_piece'], parentObjective: parent,
    satisfactionContract: 'official_progress_after_regulated_trajectory' };
  const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
  const id = 'animation-contact:' + need.id;
  return { status: 'proposed', kind: family, regulated: choice, actions, needId: need.id,
    binding: { observation_ref: ref, level_epoch: observation.level_epoch },
    steps: [{ action, ...(pointBinding ? { point_binding: pointBinding } : {}), expected_after: null }],
    sicSituationCard: { strategy: choice.strategy, need: 'Find a trajectory that reaches the stationary piece',
      situation: label, evidence, agenda: [], mode: choice.shot && !['extend_trajectory_measurement', 'compare_nearby_trajectory'].includes(choice.strategy) ? 'solving' : 'exploration',
      source: choice.source, peer: choice.peer, meter: choice.meter, point: choice.projected ? [...choice.projected, ...choice.projected] : null,
      ...(choice.avoidedPortals ? { avoidedPortals: choice.avoidedPortals } : {}),
      ...(choice.sourceCandidate ? { sourceCandidate: true } : {}),
      ...(choice.impact ? { obstacle: choice.impact.obstacle } : {}) },
    question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
    compositions: [{ id, observed: false, open_question: label, relations: ['contributes_to:' + parent] }],
    sicLocalDecision: { strategy: choice.strategy, objective: { id, label, parent }, need },
    bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label, preconditions: {},
      preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
}

export function createSicAnimationContact(family = animationContactId, transferObservedContact = false): NativeFamily<Proposal> {
  const learns = family === learnAnimationContactId;
  let state: State | null = null;
  let curve: CurveWitness | null = null;
  return {
    id: family,
    observePublicOutcome(before, after, command, first, second, frames = []) {
      if (!learns || !transferObservedContact) return;
      if (!curve || curve.epoch === before.level_epoch && !curve.boundary) {
        curve = learnCurveWitness(before, after, command, first, second, frames, curve) ?? curve;
      }
      if (curve && after.levels_completed > before.levels_completed) {
        curve = { ...curve, epoch: after.level_epoch, boundary: after.observation_ref, attempted: [] };
      }
    },
    proposeInGroup(group, observation, rows, inputs, remaining, execution) {
      const current = !learns && mayRegulateContact(curve, observation);
      if ((group === observedMechanicsGroup) !== current) return null;
      return this.propose(observation, rows, inputs, remaining, execution);
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      if ((!learns || transferObservedContact) && curve && mayRegulateContact(curve, observation)) {
        const choice = chooseRegulatedContact(curve, observation, rows, transferObservedContact, execution?.regulatedTrialRef);
        return choice ? regulatedProposal(observation, rows, choice, family) : null;
      }
      const previous = state?.epoch === observation.level_epoch ? state : null;
      const receipt = learns && previous?.evidence.at(-1) !== observation.observation_ref ? execution?.readAnimatedContact?.() : null;
      const prior: State | null = receipt?.afterRef === observation.observation_ref && receipt.levelEpoch === observation.level_epoch
        ? { epoch: observation.level_epoch, frameHash: observation.frame_hash, evidence: [receipt.beforeRef, receipt.afterRef],
          tried: (previous?.tried ?? []).some(point => samePoint(point, receipt.point)) ? previous!.tried : [...(previous?.tried ?? []), receipt.point],
          contact: receipt.contact, disclosure: receipt.disclosure, source: receipt.source, peer: receipt.peer, frames: receipt.frames }
        : previous;
      if (learns && !prior) return null;
      if (prior && (observation.frame_hash !== prior.frameHash || prior.tried.length >= 8)) return null;
      const local = prior ?? { epoch: observation.level_epoch, frameHash: observation.frame_hash,
        evidence: [], tried: [], contact: null, disclosure: null, source: null, peer: null, frames: 0 };
      const fresh = (candidate: NativePoint | null) => candidate && !local.tried.some(point => samePoint(candidate, point)) ? candidate : null;
      const contact = fresh(local.contact), disclosure = fresh(local.disclosure);
      const canCompareLaterally = ['ACTION3', 'ACTION4'].every(input => observation.available_action_refs.includes(input));
      const offer = !prior && canCompareLaterally ? animatedCrossInvitation(observation) : null;
      const point: NativePoint | null = offer ? [offer.point.x, offer.point.y] : null;
      const invitation = point && hasUniquePairBelowAim(observation.entities, point) ? point : null;
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...local.evidence.filter(value => value !== ref)];
      const { selected, entries } = resolveStrategyGraph({
        graph, mode: 'active',
        facts: { contact: { value: !!contact, evidence }, disclosure: { value: !!disclosure, evidence }, invitation: { value: !!invitation, evidence } },
        planners: { test_transient_contact: () => contact, refine_transient_path: () => disclosure, observe_transient_motion: () => invitation },
      });
      if (!selected) return null;
      const strategy = selected.id, target = selected.plan, label = animationContactStrategies[strategy], parent = 'G_official_completion';
      const pointBinding = await ObservedInputDomain.makeLocusWitness(observation, rows, target, { reason: label, evidence });
      if (!pointBinding) return null;
      const action = { action_ref: 'ACTION6', data: { x: target[0], y: target[1] } }, actions = [action];
      const objective = { kind: 'use_observed_motion_to_test_contact', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['point_control', 'moving_piece', 'stationary_piece'], parentObjective: parent,
        satisfactionContract: 'official_progress_after_testing_projected_contact' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = 'animation-contact:' + need.id;
      return { status: 'proposed', kind: family, local, target, actions, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, steps: [{ action, point_binding: pointBinding, expected_after: null }],
        sicSituationCard: { strategy, need: 'Find whether the moving piece can reach a stationary piece', situation: label, evidence, agenda: entries,
          mode: strategy === 'test_transient_contact' ? 'solving' : 'exploration',
          point: [...target, ...target], source: local.source, peer: local.peer, measuredFrameCount: local.frames },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'current_animation_experiment_bound' : 'animation_experiment_context_changed' };
    },
    after(proposal, _index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      if (proposal.regulated) {
        if (proposal.regulated.strategy === 'extend_trajectory_measurement') {
          return { matched: null, seal_prefix: true, reason: 'remeasure_trajectory_from_ordered_frames' };
        }
        if (proposal.regulated.shot) return { matched: false, seal_prefix: true, reason: 'projected_trajectory_did_not_complete_contact' };
        const delta = measureRegulatedAdjustment(proposal.regulated, first, second);
        const matched = delta !== null && delta !== 0
          && (proposal.regulated.expectedSign === null || Math.sign(delta) === proposal.regulated.expectedSign);
        return { matched, seal_prefix: true, reason: matched ? 'magnitude_adjustment_observed' : 'magnitude_adjustment_unconfirmed' };
      }
      return { matched: null, seal_prefix: true, reason: 'inspect_ordered_return_before_next_aim' };
    },
    record(before, after, command, first, second, proposal, _index, frames) {
      if (proposal.regulated && curve) {
        curve = retainRegulatedReturn(curve, proposal.regulated, before, after, first, second, frames, transferObservedContact);
        return { events: [] };
      }
      if (!curve || transferObservedContact && !curve.boundary && curve.epoch === before.level_epoch) {
        if (!learns || transferObservedContact) curve = learnCurveWitness(before, after, command, first, second, frames, curve) ?? curve;
      }
      if (curve && after.levels_completed > before.levels_completed) {
        curve = { ...curve, epoch: after.level_epoch, boundary: after.observation_ref, attempted: [] };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      if (proposal.regulated) return { events: [] };
      const { local, target } = proposal;
      state = { ...local, ...measureAnimatedContact(first, second, frames, command), frameHash: after.frame_hash, tried: [...local.tried, target],
        evidence: [...local.evidence.slice(-4), before.observation_ref, after.observation_ref] };
      return { events: [] };
    },
    state: () => ({ state, ...(curve ? { curve } : {}) }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as State | null);
      curve = structuredClone((value.curve as CurveWitness | undefined) ?? null);
    },
  };
}

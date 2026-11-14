import { animatedCrossInvitation } from '../logos-engine/v6-animated-contact.ts';
import { symbolicDigest } from '../logos-engine/v6-hash.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import { orderedTransientComponentPathFacts } from '../logos-engine/v6-transient-measurements.ts';
import type { NativeBox, NativeEntity, NativeFamily, NativePoint, NativeProposal, NativeRecord } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const animationContactId = 'sic_animation_contact';
export const animationContactStrategies = {
  observe_transient_motion: 'Test an input and follow what moves through the animation',
  refine_transient_path: 'Test a new point to clarify the observed path',
  test_transient_contact: 'Test a point that could bring the moving piece into contact',
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

type State = { epoch: number; frameHash: string; evidence: string[]; tried: NativePoint[];
  contact: NativePoint | null; disclosure: NativePoint | null; source: NativeBox | null; peer: NativeBox | null; frames: number };
type Proposal = NativeProposal & { local: State; target: NativePoint; needId: string };
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
function measuredBox(facts: NativeRecord, prefix: string): NativeBox | null {
  const x = facts[prefix + '_center_column_twice'], y = facts[prefix + '_center_row_twice'];
  const width = facts[prefix + '_bbox_width'], height = facts[prefix + '_bbox_height'];
  if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number') return null;
  const left = (x - width + 1) / 2, top = (y - height + 1) / 2;
  return [left, top, left + width - 1, top + height - 1];
}
function measuredPoint(facts: NativeRecord, prefix: string): NativePoint | null {
  const x = facts[prefix + '_column'], y = facts[prefix + '_row'];
  return facts[prefix + '_present'] === true && typeof x === 'number' && typeof y === 'number' ? [x, y] : null;
}

export function createSicAnimationContact(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: animationContactId,
    async propose(observation, rows, _inputs, remaining) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
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
      return { status: 'proposed', kind: animationContactId, local, target, actions, needId: need.id,
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
    after(proposal, _index, before, after) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      return { matched: null, seal_prefix: true, reason: 'inspect_ordered_return_before_next_aim' };
    },
    record(before, after, command, first, second, proposal, _index, frames) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, target } = proposal;
      const intermediate = frames.length && symbolicDigest(frames.at(-1)!) === symbolicDigest(second) ? frames.slice(0, -1) : frames;
      const facts = intermediate.length ? orderedTransientComponentPathFacts(first, intermediate, second, command.action_ref, command.data) : {};
      const heights = { ...facts, unique_transient_path_source_peer_bbox_height: facts.unique_transient_path_source_morphology_peer_bbox_height,
        unique_transient_path_source_peer_bbox_width: facts.unique_transient_path_source_morphology_peer_bbox_width };
      state = { ...local, frameHash: after.frame_hash, tried: [...local.tried, target], frames: frames.length,
        evidence: [...local.evidence.slice(-4), before.observation_ref, after.observation_ref],
        contact: measuredPoint(facts, 'ballistic_contact_solution'), disclosure: measuredPoint(facts, 'ballistic_curve_disclosure'),
        source: measuredBox(facts, 'unique_transient_path_source'), peer: measuredBox(heights, 'unique_transient_path_source_peer') };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}

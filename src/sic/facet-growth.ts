import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import { facetBox, facetInside, facetProject, facetShape, type FacetProjection } from '../logos-engine/v6-facet-examples-geometry.ts';
import type { NativeFamily, NativeObservation, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const facetGrowthId = 'sic_facet_growth';
export const facetGrowthStrategies = {
  test_matching_surface: 'Test a bounded area that matches the example',
  measure_visible_extension: 'Test whether the top moves and the sides extend',
  repeat_verified_extension: 'Repeat the measured extension toward the reference',
} as const;
const graph = compileStrategyGraph({ id: 'extend_visible_form_toward_reference', version: 1, order: 'FALLBACK',
  priorities: ['repeat_verified_extension', 'measure_visible_extension', 'test_matching_surface'],
  strategies: {
    test_matching_surface: [{ fact: 'empty', expected: true, label: 'An empty area fits the example with room for the projected extension' }],
    measure_visible_extension: [{ fact: 'newTop', expected: true, label: 'The example appeared and the sides are shorter than the reference' }],
    repeat_verified_extension: [{ fact: 'repeat', expected: true, label: 'The previous click raised the top and extended the sides' }],
  },
}, ['empty', 'newTop', 'repeat']);
type State = { scope: string; count: number; stopped: boolean; rise: number | null; evidence: string[] };
type Proposal = NativeProposal & { projection: FacetProjection; local: State; needId: string };
const sameShape = (a: FacetProjection['offer']['support'], b: FacetProjection['offer']['support']) =>
  JSON.stringify(facetShape(a)) === JSON.stringify(facetShape(b));

function observedRise({ projection, local }: Proposal, before: NativeObservation, after: NativeObservation, first: NativeRows, second: NativeRows) {
  const [l, t, r, b] = projection.world;
  const outsidePreserved = first.every((row, y) => row.every((value, x) => (l < x && x < r && t < y && y < b) || second[y]?.[x] === value));
  if (!outsidePreserved || before.frame_hash === after.frame_hash) return null;
  const next = facetProject(after, second);
  if (!next || next.scope_ref !== projection.scope_ref || next.offer.kind !== 'probe_visible_cap') return null;
  const oldTop = projection.offer.support, top = next.offer.support;
  if (!sameShape(oldTop, top) || oldTop.bbox[0] !== top.bbox[0]) return null;
  if (projection.offer.kind === 'probe_congruent_empty_face') return top.bbox[1] === oldTop.bbox[1] ? 0 : null;
  const rise = oldTop.bbox[1] - top.bbox[1];
  if (rise <= 0 || (local.rise !== null && rise !== local.rise)) return null;
  for (const part of projection.example_parts.filter(part => part.palette_value !== top.palette_value)) {
    const inWorld = (observation: NativeObservation) => observation.entities.filter(entity =>
      entity.palette_value === part.palette_value && facetInside(entity.bbox, projection.world));
    const prior = inWorld(before), current = inWorld(after);
    if (!prior.length || !current.length) return null;
    const a = facetBox(prior), b = facetBox(current);
    if (a[1] - b[1] !== rise || a[0] !== b[0] || a[2] !== b[2] || a[3] !== b[3]) return null;
  }
  return rise;
}

export function createSicFacetGrowth(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: facetGrowthId,
    async propose(observation, rows, _inputs, remaining) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const projection = facetProject(observation, rows);
      if (!projection) return null;
      const local = state?.scope === projection.scope_ref ? state
        : { scope: projection.scope_ref, count: 0, stopped: false, rise: null, evidence: [] };
      if (local.stopped || local.count >= 16) return null;
      const empty = projection.offer.kind === 'probe_congruent_empty_face';
      const repeat = !empty && local.rise !== null;
      const [x, y] = projection.offer.point, command = { action_ref: 'ACTION6', data: { x, y } };
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...local.evidence.filter(value => value !== ref)];
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active', facts: {
        empty: { value: empty, evidence }, newTop: { value: !empty && !repeat, evidence }, repeat: { value: repeat, evidence },
      }, planners: { test_matching_surface: () => command, measure_visible_extension: () => command, repeat_verified_extension: () => command } });
      if (!selected) return null;
      const strategy = selected.id, label = facetGrowthStrategies[strategy], parent = 'G_official_completion';
      const goal = { kind: 'match_reference_form', scope: projection.scope_ref, subjects: ['bounded_workspace', 'visible_reference'],
        parentObjective: parent, satisfactionContract: 'official_progress_after_matching_the_visible_form' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `facet-growth:${need.id}`, actions = [command];
      const binding = await ObservedInputDomain.makeLocusWitness(observation, rows, [x, y], { reason: label, evidence });
      return { status: 'proposed', kind: facetGrowthId, actions, local, projection, needId: need.id,
        steps: [{ action: command, expected_after: null, point_binding: binding }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Match the proportions of the separate reference', mode: repeat ? 'solving' : 'exploration',
          situation: repeat ? `The previous click raised the top by ${local.rise} pixels, with both sides extending upward.` : label,
          agenda: entries, evidence, support: projection.offer.support.bbox, example: projection.example_box,
          reference: facetBox(projection.reference_parts) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'visible_face_bound' : 'visible_face_changed' };
    },
    after(proposal, _index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true,
        reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      const matched = observedRise(proposal, before, after, first, second) !== null;
      return { matched, seal_prefix: true, reason: matched ? 'face_effect_observed' : 'face_effect_unconfirmed' };
    },
    record(before, after, _command, first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const rise = observedRise(proposal, before, after, first, second), local = proposal.local;
      state = { ...local, count: local.count + 1, stopped: rise === null, rise: rise || null,
        evidence: [...local.evidence.slice(-3), after.observation_ref] };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}

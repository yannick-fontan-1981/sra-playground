import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import { facetBox, facetInside, facetProject, facetShape, type FacetProjection } from '../logos-engine/v6-facet-examples-geometry.ts';
import { acquireFacetSeed, facetCompoundPlan, type FacetCompoundCache, type FacetCompoundConfiguration,
  type FacetPortableMethod } from '../logos-engine/v6-facet-examples-compound.ts';
import type { NativeFamily, NativeObservation, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';
import { countChangesInside } from './workspace-click.ts';

export const facetGrowthId = 'sic_facet_growth';
export const learnFacetGrowthId = 'sic_learn_facet_growth';
export const facetGrowthStrategies = {
  test_matching_surface: 'Test a bounded area that matches the example',
  measure_visible_extension: 'Test whether the top moves and the sides extend',
  repeat_verified_extension: 'Repeat the measured extension toward the reference',
  extend_visible_side_toward_reference: 'Test an exposed side for the missing branch of the reference',
  repeat_verified_side_extension: 'Extend the branch from a face whose effect was verified',
} as const;
const graph = compileStrategyGraph({ id: 'extend_visible_form_toward_reference', version: 1, order: 'FALLBACK',
  priorities: ['repeat_verified_side_extension', 'extend_visible_side_toward_reference', 'repeat_verified_extension',
    'measure_visible_extension', 'test_matching_surface'],
  strategies: {
    test_matching_surface: [{ fact: 'empty', expected: true, label: 'An empty area fits the example with room for the projected extension' }],
    measure_visible_extension: [{ fact: 'newTop', expected: true, label: 'The example appeared and the sides are shorter than the reference' }],
    repeat_verified_extension: [{ fact: 'repeat', expected: true, label: 'The previous click raised the top and extended the sides' }],
    extend_visible_side_toward_reference: [{ fact: 'side', expected: true, label: 'The reference calls for a branch from a currently exposed side' }],
    repeat_verified_side_extension: [{ fact: 'knownSide', expected: true, label: 'The visible result confirmed the previous use of this side' }],
  },
}, ['empty', 'newTop', 'repeat', 'side', 'knownSide']);
type State = { scope: string; count: number; stopped: boolean; rise: number | null; evidence: string[]; ports?: number[] };
type Proposal = NativeProposal & { projection: FacetProjection; local: State; needId: string };
const compoundSearch: FacetCompoundConfiguration = {
  maximum_units: 5,
  maximum_states: 1024,
  lateral_rule: 'conditional_stencil_sharing_measured_face_edges',
  requires_observed_seed_and_vertical_effect_and_boundary: true,
  question: 'Fill the missing visible contributions of the reference while preserving the rest of the scene.',
  maximum_sample_denominator: 8,
  sample_offsets: [-0.5, 0, 0.5],
};
const layeredSearch = { maximumUnits: 8, maximumStates: 32_000 };
const sameShape = (a: FacetProjection['offer']['support'], b: FacetProjection['offer']['support']) =>
  JSON.stringify(facetShape(a)) === JSON.stringify(facetShape(b));

function observedRise({ projection, local }: Proposal, before: NativeObservation, after: NativeObservation, first: NativeRows, second: NativeRows) {
  if (before.frame_hash === after.frame_hash || !countChangesInside(first, second, projection.world)) return null;
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

function matchesCompound(projection: FacetProjection, first: NativeRows, second: NativeRows): boolean {
  const compound = projection.compound;
  if (!compound) return false;
  const [l, t, r, b] = projection.world;
  let painted = 0;
  for (let y = 0; y < first.length; y++) for (let x = 0; x < first[y]!.length; x++) {
    const value = second[y]?.[x];
    if (x <= l || x >= r || y <= t || y >= b) {
      if (value !== first[y]![x]) return false;
    } else if (value !== undefined && compound.palette.includes(value)) painted++;
  }
  return painted === compound.expected_colored_pixels.length
    && compound.expected_colored_pixels.every(([x, y, value]) => second[y]?.[x] === value);
}

export function createSicFacetGrowth(family = facetGrowthId): NativeFamily<Proposal> {
  const learns = family === learnFacetGrowthId;
  let state: State | null = null;
  let portable: FacetPortableMethod | null = null;
  const cache: FacetCompoundCache = new Map();
  return {
    id: family,
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      if (learns && !state && !execution?.readWorkspaceClick) return null;
      const reusable = portable && portable.source_epoch !== observation.level_epoch ? portable : null;
      const projection = facetCompoundPlan(observation, rows, reusable, cache, compoundSearch, true, layeredSearch) ?? facetProject(observation, rows);
      if (!projection) return null;
      const prior = state?.scope === projection.scope_ref ? state : null;
      const click = learns && !prior && projection.offer.kind === 'probe_visible_cap'
        ? execution?.readWorkspaceClick?.(projection.world) : null;
      if (learns && !prior && (!click || click.afterRef !== observation.observation_ref || click.levelEpoch !== observation.level_epoch
        || !facetInside([...click.point, ...click.point], projection.offer.support.bbox))) return null;
      const local = prior ?? { scope: projection.scope_ref, count: 0, stopped: false, rise: null,
        evidence: projection.compound && reusable?.boundary_ref ? [...reusable.evidence, reusable.boundary_ref]
          : click ? [click.beforeRef, click.afterRef] : [] };
      if (local.stopped || local.count >= 16) return null;
      const empty = projection.offer.kind === 'probe_congruent_empty_face' || projection.offer.kind === 'recall_seed_for_compound_reference';
      const port = projection.offer.support.palette_value;
      const side = !!projection.compound && !empty && port !== reusable?.cap_value;
      const knownSide = side && !!local.ports?.includes(port);
      const repeat = !empty && !side && (local.rise !== null || !!projection.compound);
      const [x, y] = projection.offer.point, command = { action_ref: 'ACTION6', data: { x, y } };
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...local.evidence.filter(value => value !== ref)];
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active', facts: {
        empty: { value: empty, evidence }, newTop: { value: !empty && !repeat && !side, evidence }, repeat: { value: repeat, evidence },
        side: { value: side && !knownSide, evidence }, knownSide: { value: knownSide, evidence },
      }, planners: { test_matching_surface: () => command, measure_visible_extension: () => command, repeat_verified_extension: () => command,
        extend_visible_side_toward_reference: () => command, repeat_verified_side_extension: () => command } });
      if (!selected) return null;
      const strategy = selected.id, compound = projection.compound, parent = 'G_official_completion';
      const destinations = compound?.solution.placements;
      const current = compound?.prefix ?? 0, destination = destinations?.[current];
      const covered = !!destination && compound?.solution.paint_order?.some((index, order, paintOrder) =>
        index < current && order < paintOrder.indexOf(current) && destinations![index]!.every((value, axis) => value === destination[axis]));
      const label = covered ? 'Add a piece in front of an earlier piece using a face that is still visible'
        : facetGrowthStrategies[strategy];
      const goal = { kind: 'match_reference_form', scope: projection.scope_ref, subjects: ['bounded_workspace', 'visible_reference'],
        parentObjective: parent, satisfactionContract: 'official_progress_after_matching_the_visible_form' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `facet-growth:${need.id}`, actions = [command];
      const binding = await ObservedInputDomain.makeLocusWitness(observation, rows, [x, y], { reason: label, evidence });
      return { status: 'proposed', kind: family, actions, local, projection, needId: need.id,
        steps: [{ action: command, expected_after: null, point_binding: binding }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Match the proportions of the separate reference', mode: repeat || knownSide ? 'solving' : 'exploration',
          situation: repeat && local.rise !== null ? `The previous click raised the top by ${local.rise} pixels, with both sides extending upward.` : label,
          agenda: entries, evidence, support: projection.offer.support.bbox, example: projection.example_box,
          reference: projection.compound?.reference.box ?? facetBox(projection.reference_parts) },
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
      const matched = proposal.projection.compound ? matchesCompound(proposal.projection, first, second)
        : observedRise(proposal, before, after, first, second) !== null;
      return { matched, seal_prefix: true, reason: matched ? 'face_effect_observed' : 'face_effect_unconfirmed' };
    },
    record(before, after, _command, first, second, proposal) {
      if (after.levels_completed > before.levels_completed && portable) portable.boundary_ref = after.observation_ref;
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, projection } = proposal;
      if (projection.compound) {
        const confirmed = matchesCompound(projection, first, second);
        const port = projection.offer.support.palette_value;
        state = { ...local, count: local.count + 1, stopped: !confirmed,
          ports: confirmed ? [...new Set([...(local.ports ?? []), port])] : local.ports ?? [],
          evidence: [...local.evidence.slice(-5), after.observation_ref] };
        return { events: [] };
      }
      const rise = observedRise(proposal, before, after, first, second);
      if (rise === 0) portable = acquireFacetSeed(before, after, first, second, projection);
      if (rise && portable?.source_epoch === before.level_epoch) {
        portable.up_shift = [0, -rise];
        portable.evidence = [...new Set([...portable.evidence, before.observation_ref, after.observation_ref])];
      }
      state = { ...local, count: local.count + 1, stopped: rise === null, rise: rise || null,
        evidence: [...local.evidence.slice(-3), after.observation_ref] };
      return { events: [] };
    },
    state: () => ({ state, portable }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as State | null);
      portable = structuredClone((value.portable as FacetPortableMethod | undefined) ?? null);
    },
  };
}

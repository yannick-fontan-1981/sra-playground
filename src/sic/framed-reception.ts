import { compareUnicode } from '../logos-engine/canonical.ts';
import { candidates, extract, transition, type FramedOffer, type FramedRecord } from '../logos-engine/v6-framed-transfer-observation.ts';
import { FramedPolicy } from '../logos-engine/v6-framed-transfer-policy.ts';
import type { NativeBox, NativeFamily, NativeProposal, NativeRecord } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const framedReceptionId = 'sic_framed_reception';
export const framedReceptionStrategies = {
  test_reception_by_analogy: 'Test whether a matching frame responds like the one already observed',
  test_matching_reception: 'Test the matching frame at its measured entry',
  prepare_uniform_reception: 'Test whether moving the receiving frame opens an entry',
  reuse_measured_offset: 'Reuse the observed offset at the two current endpoints',
  test_banded_control: 'Test whether the paired bands control a displacement',
} as const;

const priorities = ['test_reception_by_analogy', 'test_matching_reception', 'prepare_uniform_reception', 'reuse_measured_offset', 'test_banded_control'] as const;
const graph = compileStrategyGraph({
  id: 'reconcile_motion_and_frame_reception', version: 1, order: 'FALLBACK', priorities,
  strategies: {
    test_reception_by_analogy: [{ fact: 'analogy', expected: true, label: 'One current entry matches the shape of a previously observed reception' }],
    test_matching_reception: [{ fact: 'matching', expected: true, label: 'One current entry is supported by a matching frame and a measured displacement' }],
    prepare_uniform_reception: [{ fact: 'prepare', expected: true, label: 'The displacement can be tested at the frame even though its interior does not match yet' }],
    reuse_measured_offset: [{ fact: 'offset', expected: true, label: 'An observed displacement can be tested again at a uniquely bound point between the current endpoints' }],
    test_banded_control: [{ fact: 'probe', expected: true, label: 'Two aligned bands uniquely pair around a point that has yet to be tested in this view' }],
  },
}, ['analogy', 'matching', 'prepare', 'offset', 'probe']);

type State = { epoch: number; spans: FramedRecord[]; receipts: FramedRecord[]; attempts: string[];
  evidence: string[]; emptyReturns: number };
type Proposal = NativeProposal & { local: State; offer: FramedOffer; needId: string };
const byPoint = (a: FramedOffer, b: FramedOffer) =>
  a.point_x - b.point_x || a.point_y - b.point_y || compareUnicode(a.candidate_ref, b.candidate_ref);

function applicableOffers(offers: readonly FramedOffer[]) {
  const available = offers.filter(({ facts }) => facts.parallel_solid_band_mutually_unique === true && facts.candidate_execution_count === 0);
  available.sort(byPoint);
  const supported = available.filter(({ facts }) => facts.framed_reception_locus_complete === true && facts.framed_reception_locus_binding_count === 1);
  const ordinary = available.filter(({ facts }) => facts.framed_reception_analogy === false && facts.parallel_solid_band_domain_complete === true);
  const reception = supported.filter(({ facts }) => facts.framed_reception_analogy === false);
  return {
    analogy: supported.find(({ facts }) => facts.framed_reception_analogy === true),
    matching: reception.find(({ facts }) => facts.framed_reception_locus_same_mask_marker === true),
    prepare: reception.find(({ facts }) => facts.framed_reception_locus_same_mask_marker === false),
    offset: ordinary.find(({ facts }) => facts.point_span_recall_domain_complete === true && facts.point_span_locus_binding_count === 1
      && facts.point_span_current_support_exact === true && facts.point_span_locus_expected_distance > 0),
    probe: ordinary[0],
  };
}

export function createSicFramedReception(): NativeFamily<Proposal> {
  let state: State | null = null;
  let measurement: Promise<FramedPolicy> | null = null;
  const getMeasurement = () => measurement ??= FramedPolicy.create();
  return {
    id: framedReceptionId,
    async propose(observation, rows, _inputs, remaining) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const local = state?.epoch === observation.level_epoch ? state : {
        epoch: observation.level_epoch, spans: [], receipts: [], attempts: [], evidence: [], emptyReturns: 0,
      };
      if (local.attempts.length >= 24 || local.emptyReturns >= 3) return null;
      const offers = await candidates(rows, observation, await getMeasurement(), local.spans, local.receipts,
        Object.fromEntries(local.attempts.map(key => [key, { unchanged: true }])));
      const choices = applicableOffers(offers);
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...local.evidence.filter(value => value !== ref)];
      const { selected, entries } = resolveStrategyGraph({
        graph, mode: 'active',
        facts: {
          analogy: { value: !!choices.analogy, evidence }, matching: { value: !!choices.matching, evidence },
          prepare: { value: !!choices.prepare, evidence }, offset: { value: !!choices.offset, evidence },
          probe: { value: !!choices.probe, evidence },
        },
        planners: {
          test_reception_by_analogy: () => choices.analogy ?? null, test_matching_reception: () => choices.matching ?? null,
          prepare_uniform_reception: () => choices.prepare ?? null, reuse_measured_offset: () => choices.offset ?? null,
          test_banded_control: () => choices.probe ?? null,
        },
      });
      if (!selected) return null;
      const strategy = selected.id, offer = selected.plan, label = framedReceptionStrategies[strategy], parent = 'G_official_completion';
      const objective = { kind: 'reconcile_motion_and_frame_reception', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['paired_bands', 'framed_piece', 'candidate_reception'], parentObjective: parent,
        satisfactionContract: 'official_progress_after_a_measured_framed_reception' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = 'framed-reception:' + need.id;
      const { point_x: x, point_y: y } = offer, action = { action_ref: 'ACTION6', data: { x, y } }, actions = [action];
      const binding = { observation_ref: ref, level_epoch: observation.level_epoch, frame_hash: observation.frame_hash };
      const [left, top, right, bottom] = offer.bbox;
      const control: NativeBox = [left!, top!, right!, bottom!];
      const pointBinding = { ...binding, entity_ref: offer.component_ref, signature: offer.signature,
        bbox: control, point: [x, y], palette_value: offer.point_value, source: 'measured_paired_bands' };
      const sourceRef = offer.facts.framed_reception_locus_source_ref, markerRef = offer.facts.framed_reception_locus_marker_ref;
      let source: NativeBox | null = null, marker: NativeBox | null = null;
      if (typeof sourceRef === 'string' || typeof markerRef === 'string') {
        const [, components] = await extract(rows, ref);
        const componentBox = (id: unknown): NativeBox | null => {
          const box = components.find(component => component.component_id === id)?.bbox;
          return box ? [box.left, box.top, box.right, box.bottom] : null;
        };
        source = componentBox(sourceRef);
        marker = componentBox(markerRef);
      }
      return { status: 'proposed', kind: framedReceptionId, actions, local, offer, needId: need.id, binding,
        steps: [{ action, expected_after: null, point_binding: pointBinding }],
        sicSituationCard: { strategy, need: 'Find which controls move a piece into a compatible frame', situation: label, evidence, agenda: entries,
          mode: strategy === 'reuse_measured_offset' ? 'assimilation' : 'exploration',
          control, point: [x, y, x, y], source, marker },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref
        && proposal.binding.frame_hash === packet.frame_hash;
      return { admitted, reason: admitted ? 'paired_bands_and_test_point_bound' : 'paired_bands_or_test_point_changed' };
    },
    after(proposal, _index, before, after) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      return { matched: null, seal_prefix: true, reason: 'compare_framed_displacement_and_reception' };
    },
    async record(before, after, command, first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local } = proposal, measurement = await getMeasurement();
      const [motion, replacement] = await transition(first, second, before, after, command, measurement, local.spans);
      const spans = [...local.spans], receipts = [...local.receipts];
      const records: readonly [string, FramedRecord[], FramedRecord[]][] = [
        ['policy.record_observed_point_motion_span', motion.point_motion_span_rows, spans],
        ['policy.record_observed_framed_replacement', replacement.framed_replacement_rows, receipts],
      ];
      for (const [policy, rows, target] of records) for (const facts of rows) {
        const result = measurement.projectRecord({ policy, facts });
        if (result.status === 'derived' && !target.some(record => record.source_claim_ref === result.record.source_claim_ref)) target.push(result.record);
      }
      const learned = spans.length > local.spans.length || receipts.length > local.receipts.length;
      state = { ...local, spans, receipts, attempts: [...local.attempts, proposal.offer.candidate_ref],
        evidence: [...local.evidence.slice(-5), after.observation_ref], emptyReturns: learned ? 0 : local.emptyReturns + 1 };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}

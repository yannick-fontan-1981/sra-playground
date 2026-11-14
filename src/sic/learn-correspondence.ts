import { correspondences, measuredFields, periodicHypotheses, symmetryEvidence, type RegularField } from '../logos-engine/v6-field-constraints.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';
import { sicNeedId } from './need-identity.ts';
import { independentPredictionSupport, type PredictionTrial } from './independent-prediction.ts';

export const learnCorrespondenceId = 'sic_learn_correspondence';
export const learnCorrespondenceStrategies = {
  test_correspondence: 'Test a prediction at an independent cell',
  reuse_verified_correspondence: 'Use a correspondence supported by separate returns',
} as const;
const graph = compileStrategyGraph({ id: 'acquire_field_correspondence_from_returns', version: 1, order: 'FALLBACK',
  priorities: ['reuse_verified_correspondence', 'test_correspondence'],
  strategies: {
    test_correspondence: [{ fact: 'prediction', expected: true, label: 'Observed pairs support at least one testable prediction' }],
    reuse_verified_correspondence: [{ fact: 'prediction', expected: true, label: 'A predicted value remains available' },
      { fact: 'replicated', expected: true, label: 'The relation predicted two distinct cell returns' }],
  },
}, ['prediction', 'replicated']);

const transforms = ['horizontal', 'vertical', 'half_turn', 'diagonal', 'antidiagonal'] as const;
type State = { epoch: number; field: string; marker: number | null; hypotheses: string[]; samples: PredictionTrial<number>[] };
type Candidate = { point: NativePoint; source: NativePoint; observed: number; expected: number; hypotheses: string[] };
type Proposal = NativeProposal & { local: State; candidate: Candidate; box: NativeBox; field: NativeBox; needId: string };
const key = (point: NativePoint) => point.join(',');
const box = ([x, y]: NativePoint, [w, h]: NativePoint): NativeBox => [x, y, x + w - 1, y + h - 1];
const asPoint = ([x, y]: NativePoint, field: RegularField): NativePoint => [field.xs[x]!, field.ys[y]!];
const uniform = (rows: NativeRows, [l, t, r, b]: NativeBox): number | null => {
  const value = rows[t]?.[l];
  if (value === undefined) return null;
  for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) if (rows[y]?.[x] !== value) return null;
  return value;
};

function hypotheses(field: RegularField, marker: number) {
  const inferred = new Map<string, Candidate[]>();
  for (const transform of transforms) {
    let support = 0, conflict = false;
    const predictions: Candidate[] = [];
    for (const [a, b] of correspondences(field.xs.length, field.ys.length, transform)) {
      const p = asPoint(a, field), q = asPoint(b, field);
      const u = field.values.get(key(p))!, v = field.values.get(key(q))!;
      if (u === marker && v !== marker) predictions.push({ point: p, source: q, observed: u, expected: v, hypotheses: [transform] });
      else if (v === marker && u !== marker) predictions.push({ point: q, source: p, observed: v, expected: u, hypotheses: [transform] });
      else if (u !== marker && v !== marker) {
        if (u !== v) { conflict = true; break; }
        support++;
      }
    }
    if (!conflict && support >= 6 && predictions.length) inferred.set(transform, predictions);
  }
  for (let width = 1; width * 2 <= field.xs.length; width++) {
    for (let height = 1; height * 2 <= field.ys.length; height++) {
      const id = 'period:' + width + ',' + height;
      const groups = new Map<string, { known: { point: NativePoint; value: number }[]; missing: NativePoint[] }>();
      for (const [x, left] of field.xs.entries()) for (const [y, top] of field.ys.entries()) {
        const residue = (x % width) + ',' + (y % height), point: NativePoint = [left, top];
        const group = groups.get(residue) ?? { known: [], missing: [] }, value = field.values.get(key(point))!;
        if (value === marker) group.missing.push(point);
        else group.known.push({ point, value });
        groups.set(residue, group);
      }
      const ordinary = new Set<number>();
      let conflict = false;
      const predictions: Candidate[] = [];
      for (const { known, missing } of groups.values()) {
        if (known.some(cell => cell.value !== known[0]!.value)) { conflict = true; break; }
        if (known.length < 2) continue;
        ordinary.add(known[0]!.value);
        for (const point of missing) predictions.push({ point, source: known[0]!.point, observed: marker, expected: known[0]!.value, hypotheses: [id] });
      }
      if (!conflict && ordinary.size >= 2 && predictions.length) inferred.set(id, predictions);
    }
  }
  return inferred;
}

function corroboratedDisagreements(field: RegularField): Map<string, Candidate[]> {
  const symmetry = transforms.flatMap(name => {
    const model = symmetryEvidence(field, name);
    return model ? [[name, model[0]] as const] : [];
  });
  const periodic = [...periodicHypotheses(field, 2)].map(([name, table]) => [name, table] as const);
  const models = new Map<string, Candidate[]>();
  const point = (address: string): NativePoint => {
    const [x, y] = address.split(',').map(Number);
    return [x!, y!];
  };
  for (const [name, table] of [...symmetry, ...periodic]) {
    const candidates = [...table].flatMap(([address, cell]) => {
      const [expected] = cell.eq, [source] = cell.sources;
      return cell.eq.size === 1 && expected !== undefined && source !== undefined && expected !== cell.actual
        ? [{ point: point(address), source: point(source), observed: cell.actual, expected, hypotheses: [name] }] : [];
    });
    if (candidates.length) models.set(name, candidates);
  }
  return models;
}

function nominate(field: RegularField, prior: State | null, epoch: number) {
  const identity = JSON.stringify([field.xs, field.ys, field.size]);
  if (prior && prior.field !== identity) return null;
  const counts = new Map<number, number>();
  for (const value of field.values.values()) counts.set(value, (counts.get(value) ?? 0) + 1);
  const ordered = [...counts].sort((a, b) => a[1] - b[1]);
  const rare = ordered[0];
  let marker = prior ? prior.marker : ordered.length >= 3 && rare && rare[1] * 2 < ordered[1]![1] ? rare[0] : null;
  let models = marker === null ? corroboratedDisagreements(field) : hypotheses(field, marker);
  if (!prior && marker !== null && !models.size) {
    marker = null;
    models = corroboratedDisagreements(field);
  }
  const admissible = [...models.keys()].filter(name => !prior || prior.hypotheses.includes(name));
  if (!admissible.length) return null;
  const local: State = prior ?? { epoch, field: identity, marker, hypotheses: admissible, samples: [] };
  if (local.samples.length >= 24) return null;
  const byPoint = new Map<string, Candidate[]>();
  for (const name of admissible) for (const candidate of models.get(name)!) {
    const address = key(candidate.point);
    if (local.samples.some(sample => sample.address === address)) continue;
    const offers = byPoint.get(address) ?? [];
    offers.push(candidate);
    byPoint.set(address, offers);
  }
  const opportunities = [...byPoint.values()].filter(offers => offers.every(offer => offer.expected === offers[0]!.expected)
    && (local.marker !== null || offers.length === admissible.length))
    .map(offers => ({ ...offers[0]!, hypotheses: offers.flatMap(offer => offer.hypotheses) }))
    .sort((a, b) => b.hypotheses.length - a.hypotheses.length || a.point[0] - b.point[0] || a.point[1] - b.point[1]);
  return opportunities[0] ? { local, candidate: opportunities[0] } : null;
}

export function createSicLearnCorrespondence(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: learnCorrespondenceId,
    async propose(observation, rows, _inputs, remaining) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')
        || observation.available_action_refs.some(action => /^ACTION[1-5]$/.test(action))) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      const offers = measuredFields(observation).filter(field => field.values.size >= 18 && field.values.size <= 256)
        .flatMap(field => { const proposal = nominate(field, prior, observation.level_epoch); return proposal ? [{ field, ...proposal }] : []; });
      if (offers.length !== 1) return null;
      const { field, local, candidate } = offers[0]!;
      const ref = observation.observation_ref;
      const support = independentPredictionSupport(candidate.hypotheses, local.samples);
      const matches = support[0]?.matches ?? [];
      const evidence: [string, ...string[]] = [ref, ...matches.map(sample => sample.ref)];
      const { selected, entries } = resolveStrategyGraph({
        graph, mode: 'active',
        facts: { prediction: { value: true, evidence }, replicated: { value: matches.length >= 2, evidence } },
        planners: { test_correspondence: () => candidate, reuse_verified_correspondence: () => candidate },
      });
      if (!selected) return null;
      const strategy = selected.id, label = learnCorrespondenceStrategies[strategy], parent = 'G_official_completion';
      const target = box(candidate.point, field.size), source = box(candidate.source, field.size);
      const area: NativeBox = [field.xs[0]!, field.ys[0]!, field.xs.at(-1)! + field.size[0] - 1, field.ys.at(-1)! + field.size[1] - 1];
      const [x, y] = [target[0] + Math.floor(field.size[0] / 2), target[1] + Math.floor(field.size[1] / 2)];
      const witness = await ObservedInputDomain.makeLocusWitness(observation, rows, [x, y], { reason: label, evidence });
      if (!witness) return null;
      const action = { action_ref: 'ACTION6', data: { x, y } }, actions = [action];
      const objective = { kind: 'acquire_field_correspondence_from_returns', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['paired_cells'], parentObjective: parent, satisfactionContract: 'official_progress_after_independent_field_predictions' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = 'learn-correspondence:' + need.id;
      return { status: 'proposed', kind: learnCorrespondenceId, local, candidate, box: target, field: area, needId: need.id,
        actions, steps: [{ action, point_binding: witness, expected_after: { value: candidate.expected } }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Find the relationship that predicts what a marked cell should become',
          situation: label, evidence, agenda: entries, mode: matches.length >= 2 ? 'assimilation' : 'exploration',
          target, source, triggerCard: graph.id,
          predictionSupport: matches.map(sample => sample.ref),
          compatibleRelations: candidate.hypotheses.length },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref
        && uniform(packet.frame_rows, proposal.box) === proposal.candidate.observed;
      return { admitted, reason: admitted ? 'paired_cells_are_current' : 'paired_cell_changed' };
    },
    after(proposal, _index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const matched = localReturn(proposal, first, second) === proposal.candidate.expected;
      return { matched, seal_prefix: true, reason: matched ? 'observed_predicted_cell_value' : 'correspondence_prediction_refuted' };
    },
    record(before, after, _command, first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, candidate } = proposal, actual = localReturn(proposal, first, second);
      state = { ...local, hypotheses: actual === candidate.expected ? local.hypotheses : local.hypotheses.filter(name => !candidate.hypotheses.includes(name)),
        samples: [...local.samples, { address: key(candidate.point), expected: candidate.expected, actual, ref: after.observation_ref, hypotheses: candidate.hypotheses }] };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}

function localReturn(proposal: Proposal, first: NativeRows, second: NativeRows): number | null {
  const [l, t, r, b] = proposal.field, [x, y, u, v] = proposal.box;
  for (let row = t; row <= b; row++) for (let col = l; col <= r; col++) {
    if (x <= col && col <= u && y <= row && row <= v) continue;
    if (first[row]?.[col] !== second[row]?.[col]) return null;
  }
  return uniform(second, proposal.box);
}

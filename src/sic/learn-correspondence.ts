import { correspondences, measuredFields, periodicHypotheses, symmetryEvidence, type RegularField } from '../logos-engine/v6-field-constraints.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';
import { fieldConsensus, pairedReflectionConsensus } from './field-consensus.ts';
import { sicNeedId } from './need-identity.ts';
import { maximumCommittedActions } from './plan-step.ts';
import { independentPredictionSupport, type PredictionTrial } from './independent-prediction.ts';
import { observeRepeatedCells } from './observed-repeated-cells.ts';
import { chooseInteraction, interactionModule } from './observed-interaction-card.ts';

export const learnCorrespondenceId = 'sic_learn_correspondence';
export const learnRepeatedCellsId = 'sic_learn_repeated_cells';
const testPrediction = 'Test a prediction at an independent cell';
const reusePrediction = 'Use a correspondence supported by separate returns';
export const learnCorrespondenceStrategies = {
  test_correspondence: testPrediction,
  reuse_verified_correspondence: reusePrediction,
  P05: testPrediction,
  P02: reusePrediction,
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
type Site = { candidate: Candidate; box: NativeBox; source: NativeBox };
type Proposal = NativeProposal & Site & { local: State; field: NativeBox; needId: string; route?: Site[] };
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

function corroboratedDisagreements(field: RegularField, prior: State | null, fromRepeatedCells: boolean): Map<string, Candidate[]> {
  const symmetry = fromRepeatedCells ? [] : transforms.flatMap(name => {
    const model = symmetryEvidence(field, name);
    return model ? [[name, model[0]] as const] : [];
  });
  const periodic = fromRepeatedCells ? [] : [...periodicHypotheses(field, 2)].map(([name, table]) => [name, table] as const);
  const models = new Map<string, Candidate[]>();
  const point = (address: string): NativePoint => {
    const [x, y] = address.split(',').map(Number);
    return [x!, y!];
  };
  const previousConsensus = prior?.hypotheses.some(name => name.includes('-majority:')) ?? false;
  const basic = [...symmetry, ...periodic];
  const useConsensus = fromRepeatedCells || previousConsensus || !prior && basic.length === 0;
  const majority = useConsensus ? fieldConsensus(field, transforms) : [];
  const usePairedWitnesses = fromRepeatedCells && (prior
    ? prior.hypotheses.some(name => name.startsWith('reflection-pairs:')) : !majority.length);
  const consensus = usePairedWitnesses ? pairedReflectionConsensus(field, transforms) : majority;
  const minimum = Math.min(...consensus.map(fit => fit.table.size));
  const selectedConsensus = consensus.filter(fit => prior ? prior.hypotheses.includes(fit.relation) : fit.table.size === minimum);
  const options = useConsensus ? selectedConsensus.map(({ relation, table }) => [relation, table] as const) : basic;
  for (const [name, table] of options) {
    const candidates = [...table].flatMap(([address, cell]) => {
      const [expected] = cell.eq, [source] = cell.sources;
      return cell.eq.size === 1 && expected !== undefined && source !== undefined && expected !== cell.actual
        ? [{ point: point(address), source: point(source), observed: cell.actual, expected, hypotheses: [name] }] : [];
    });
    if (candidates.length) models.set(name, candidates);
  }
  return models;
}

function nominate(field: RegularField, prior: State | null, epoch: number, fromRepeatedCells: boolean) {
  const identity = JSON.stringify([field.xs, field.ys, field.size]);
  if (prior && prior.field !== identity) return null;
  const counts = new Map<number, number>();
  for (const value of field.values.values()) counts.set(value, (counts.get(value) ?? 0) + 1);
  const ordered = [...counts].sort((a, b) => a[1] - b[1]);
  const rare = ordered[0];
  let marker = prior ? prior.marker : ordered.length >= 3 && rare && rare[1] * 2 < ordered[1]![1] ? rare[0] : null;
  let models = marker === null ? corroboratedDisagreements(field, prior, fromRepeatedCells) : hypotheses(field, marker);
  if (!prior && marker !== null && !models.size) {
    marker = null;
    models = corroboratedDisagreements(field, prior, fromRepeatedCells);
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

export function createSicLearnCorrespondence(id = learnCorrespondenceId): NativeFamily<Proposal> {
  const fromRepeatedCells = id === learnRepeatedCellsId;
  let state: State | null = null;
  let decide: NativeProgramHandle | undefined;
  return {
    id,
    async attachPrograms(registry) {
      if (fromRepeatedCells) decide = await registry.registerProgram(chooseInteraction, {}, await interactionModule());
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')
        || observation.available_action_refs.some(action => /^ACTION[1-5]$/.test(action))) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      const measured = fromRepeatedCells ? observeRepeatedCells(rows) : measuredFields(observation);
      const offers = measured.filter(field => field.values.size >= 18 && field.values.size <= 256)
        .flatMap(field => {
          const proposal = nominate(field, prior, observation.level_epoch, fromRepeatedCells);
          return proposal ? [{ field, ...proposal }] : [];
        });
      if (offers.length !== 1) return null;
      const { field, local, candidate } = offers[0]!;
      const ref = observation.observation_ref;
      const support = independentPredictionSupport(candidate.hypotheses, local.samples);
      const matches = support[0]?.matches ?? [];
      const evidence: [string, ...string[]] = [ref, ...matches.map(sample => sample.ref)];
      const replicated = matches.length >= 2;
      const mode = execution?.reasoningMode ?? (replicated ? 'assimilation' : 'exploration');
      const facts = { repeatSupportedInteraction: replicated, probeNeededInteraction: !replicated, mode };
      const decision = fromRepeatedCells ? await decide?.run({ situation: facts }, { signal: execution?.signal }) : undefined;
      const legacy = fromRepeatedCells ? null : resolveStrategyGraph({
        graph, mode: 'active',
        facts: { prediction: { value: true, evidence }, replicated: { value: replicated, evidence } },
        planners: { test_correspondence: () => candidate, reuse_verified_correspondence: () => candidate },
      });
      const primitive = replicated ? 'P02' : 'P05';
      if (fromRepeatedCells && decision?.result !== primitive) return null;
      const strategy = fromRepeatedCells ? primitive : legacy?.selected?.id;
      if (!strategy) return null;
      const label = learnCorrespondenceStrategies[strategy], parent = 'G_official_completion';
      const target = box(candidate.point, field.size), source = box(candidate.source, field.size);
      const area: NativeBox = [field.xs[0]!, field.ys[0]!, field.xs.at(-1)! + field.size[0] - 1, field.ys.at(-1)! + field.size[1] - 1];
      const [x, y] = [target[0] + Math.floor(field.size[0] / 2), target[1] + Math.floor(field.size[1] / 2)];
      const witness = await ObservedInputDomain.makeLocusWitness(observation, rows, [x, y], { reason: label, evidence });
      if (!witness) return null;
      const action = { action_ref: 'ACTION6', data: { x, y } }, actions = [action];
      const steps = [{ action, point_binding: witness, expected_after: { value: candidate.expected } }];
      const sites: Site[] = [{ candidate, box: target, source }];
      if (matches.length && !fromRepeatedCells) {
        const projected = { ...field, values: new Map(field.values) };
        const used = new Set<string>();
        for (let index = 1; index < Math.min(remaining, maximumCommittedActions, 24 - local.samples.length); index++) {
          const previous = sites[index - 1]!.candidate;
          const address = key(previous.point);
          used.add(address);
          projected.values.set(address, previous.expected);
          const next = nominate(projected, local, observation.level_epoch, fromRepeatedCells)?.candidate;
          if (!next || used.has(key(next.point)) || used.has(key(next.source))
            || !matches.some(sample => sample.hypotheses.some(name => next.hypotheses.includes(name)))) break;
          const target = box(next.point, field.size), source = box(next.source, field.size);
          if (uniform(rows, target) !== next.observed || uniform(rows, source) !== next.expected) break;
          const x = target[0] + Math.floor(field.size[0] / 2), y = target[1] + Math.floor(field.size[1] / 2);
          const binding = await ObservedInputDomain.makeLocusWitness(observation, rows, [x, y], { reason: label, evidence });
          if (!binding) break;
          const action = { action_ref: 'ACTION6', data: { x, y } };
          actions.push(action);
          steps.push({ action, point_binding: binding, expected_after: { value: next.expected } });
          sites.push({ candidate: next, box: target, source });
        }
      }
      const objective = { kind: 'acquire_field_correspondence_from_returns', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['paired_cells'], parentObjective: parent, satisfactionContract: 'official_progress_after_independent_field_predictions' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const composition = 'learn-correspondence:' + need.id;
      return { status: 'proposed', kind: id, local, candidate, box: target, source, field: area, needId: need.id,
        actions, steps, ...(sites.length > 1 ? { route: sites } : {}),
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        ...(decision ? { sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: facts } } : {}),
        sicSituationCard: { strategy, need: 'Find the relationship that predicts what a marked cell should become',
          situation: label, evidence, agenda: legacy?.entries ?? [], mode: fromRepeatedCells ? mode : replicated ? 'assimilation' : 'exploration',
          target, source, triggerCard: fromRepeatedCells ? chooseInteraction : graph.id,
          predictionSupport: matches.map(sample => sample.ref),
          compatibleRelations: candidate.hypotheses.length },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id: composition, observed: false, open_question: label, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id: composition, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: composition, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: composition } } };
    },
    before(proposal, index, packet, observation) {
      const site = proposal.route?.[index] ?? proposal;
      const bound = index === 0 ? proposal.binding?.observation_ref === observation.observation_ref
        : !!proposal.route?.[index] && proposal.local.epoch === observation.level_epoch
          && uniform(packet.frame_rows, site.source) === site.candidate.expected;
      const admitted = bound && uniform(packet.frame_rows, site.box) === site.candidate.observed;
      return { admitted, reason: admitted ? 'paired_cells_are_current' : 'paired_cell_changed' };
    },
    after(proposal, index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const site = proposal.route?.[index] ?? proposal;
      const matched = localReturn(proposal.field, site.box, first, second) === site.candidate.expected;
      return { matched, seal_prefix: !matched || index + 1 === proposal.actions.length,
        reason: matched ? 'observed_predicted_cell_value' : 'correspondence_prediction_refuted' };
    },
    record(before, after, _command, first, second, proposal, index) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const local = index > 0 ? state ?? proposal.local : proposal.local;
      const site = proposal.route?.[index] ?? proposal, { candidate } = site;
      const actual = localReturn(proposal.field, site.box, first, second);
      state = { ...local, hypotheses: actual === candidate.expected ? local.hypotheses : local.hypotheses.filter(name => !candidate.hypotheses.includes(name)),
        samples: [...local.samples, { address: key(candidate.point), expected: candidate.expected, actual, ref: after.observation_ref, hypotheses: candidate.hypotheses }] };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}

function localReturn([l, t, r, b]: NativeBox, target: NativeBox, first: NativeRows, second: NativeRows): number | null {
  const [x, y, u, v] = target;
  for (let row = t; row <= b; row++) for (let col = l; col <= r; col++) {
    if (x <= col && col <= u && y <= row && row <= v) continue;
    if (first[row]?.[col] !== second[row]?.[col]) return null;
  }
  return uniform(second, target);
}

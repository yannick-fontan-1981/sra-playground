/** Native transfer of V6 common_point_contrasts.py; public geometry/evidence only. */
import { compareUnicode } from './canonical.ts';
import { v6Digest } from './v6-native-observer.ts';
import { pythonEqual, pythonTruthy } from './v6-operations.ts';
import type { NativePoint, NativeRows } from './v6-native-types.ts';

export type PointContrastRecord = Record<string, any>;
export interface PointContrastCommand { readonly action_ref: string; readonly data?: Readonly<Record<string, number>> }
export interface PointContrastObservation extends PointContrastRecord { readonly entities: readonly PointContrastRecord[] }
export interface PointExperimentState {
  records: PointContrastRecord[];
  moving_signatures: string[];
  compared_pairs: [string, string][];
  has_positive: boolean;
}
const copy = <T>(value: T): T => structuredClone(value);
const pointKey = (x: number, y: number): string => JSON.stringify([x, y]);
const pairKey = (pair: readonly string[]): string => JSON.stringify(pair);
const sortedPair = (a: string, b: string): [string, string] => compareUnicode(a, b) <= 0 ? [a, b] : [b, a];
const comparePair = (a: readonly string[], b: readonly string[]): number => compareUnicode(a[0]!, b[0]!) || compareUnicode(a[1]!, b[1]!);

/** Same mathematical set of absolute (x,y) points as Python's support(). */
export function support(entity: PointContrastRecord): NativePoint[] {
  const [left, top] = entity.position, points = new Map<string, NativePoint>();
  for (const [x, y] of entity.mask) points.set(pointKey(left + x, top + y), [left + x, top + y]);
  return [...points.values()];
}

export class SceneRelations {
  readonly observation: PointContrastObservation;
  readonly entities: Map<string, PointContrastRecord>;
  readonly regions: Map<string, NativePoint[]>;
  readonly at = new Map<string, string>();
  readonly anchors: PointContrastRecord[];
  constructor(observation: PointContrastObservation, options: { previous_moving_signatures?: readonly string[] } = {}) {
    this.observation = observation;
    this.entities = new Map(observation.entities.map(entity => [entity.id, entity]));
    this.regions = new Map([...this.entities].map(([key, entity]) => [key, support(entity)]));
    for (const [key, points] of this.regions) for (const [x, y] of points) this.at.set(pointKey(x, y), key);
    if (this.at.size !== [...this.regions.values()].reduce((count, points) => count + points.length, 0)) {
      throw new Error('Overlapping supports cannot bind a unique occurrence');
    }
    const counts = new Map<string, number>();
    for (const entity of this.entities.values()) counts.set(entity.signature, (counts.get(entity.signature) ?? 0) + 1);
    this.anchors = [...this.entities.values()].filter(entity => options.previous_moving_signatures?.includes(entity.signature) && counts.get(entity.signature) === 1);
  }

  async features(command: PointContrastCommand): Promise<PointContrastRecord | null> {
    if (command.action_ref !== 'ACTION6' || !this.observation.available_action_refs.includes('ACTION6')) return null;
    if (!command.data) throw new TypeError('An addressed action requires its public coordinates');
    const x = command.data.x!, y = command.data.y!, key = this.at.get(pointKey(x, y));
    if (key === undefined) return null;
    const entity = this.entities.get(key)!, ring = new Map<string, NativePoint>();
    for (const [px, py] of this.regions.get(key)!) for (const [nx, ny] of [[px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]]) {
      const coordinate = pointKey(nx!, ny!), other = this.at.get(coordinate);
      if (other !== undefined && other !== key) ring.set(coordinate, [nx!, ny!]);
    }
    const ringSignatures = new Map<string, number>();
    for (const point of ring.keys()) {
      const signature = this.entities.get(this.at.get(point)!)!.signature;
      ringSignatures.set(signature, (ringSignatures.get(signature) ?? 0) + 1);
    }
    const pattern = [-1, 0, 1].flatMap(dy => [-1, 0, 1].map(dx => {
      const other = this.at.get(pointKey(x + dx, y + dy)); return other === undefined ? null : this.entities.get(other)!.signature;
    }));
    const [left, top, right, bottom] = entity.bbox;
    const values: PointContrastRecord = { signature: entity.signature,
      ring: await v6Digest([...ringSignatures].sort((a, b) => compareUnicode(a[0], b[0]))), pattern: await v6Digest(pattern) };
    if (this.anchors.length) {
      Object.assign(values, { horizontal_overlap: false, vertical_overlap: false, contact: false });
      const distances: number[] = [];
      for (const anchor of this.anchors) {
        const [l, t, r, b] = anchor.bbox, points = this.regions.get(anchor.id)!;
        values.horizontal_overlap ||= Math.max(left, l) <= Math.min(right, r);
        values.vertical_overlap ||= Math.max(top, t) <= Math.min(bottom, b);
        values.contact ||= points.some(([ax, ay]) => ring.has(pointKey(ax, ay)));
        if (!points.length) throw new RangeError('Tracked occurrence has no observed support');
        distances.push(Math.min(...points.map(([ax, ay]) => Math.abs(x - ax) + Math.abs(y - ay))));
      }
      values.tracked_distance = Math.min(...distances);
    }
    return { action: command, observation_ref: this.observation.observation_ref,
      mode: [this.observation.level_epoch, this.observation.state], entity_ref: key, features: values, frame_hash: this.observation.frame_hash };
  }
}

export function testedOccurrence(binding: PointContrastRecord, changedOriginalSupport: unknown, afterRef: string): PointContrastRecord {
  return { ...binding, observed_local_change: pythonTruthy(changedOriginalSupport), after_ref: afterRef };
}

export async function contrastModels(records: readonly PointContrastRecord[]): Promise<PointContrastRecord[]> {
  const result = new Map<string, PointContrastRecord>();
  for (const observation of records) {
    if (!pythonTruthy(observation.observed_local_change)) continue;
    for (const [feature, value] of Object.entries(observation.features)) {
      const mode = observation.mode, modelId = await v6Digest([mode, feature, value]);
      if (result.has(modelId)) continue;
      const sameMode = records.filter(record => pythonEqual(record.mode, mode) && Object.hasOwn(record.features, feature));
      const negatives = sameMode.filter(record => !pythonEqual(pythonEqual(record.features[feature], value), record.observed_local_change)).map(record => record.after_ref);
      result.set(modelId, { id: modelId, feature, equals: value, mode, construction_ref: observation.after_ref, counterexamples: negatives,
        status: negatives.length ? 'refuted' : 'unrefuted_local_candidate', supporting_observation_count: sameMode.length - negatives.length });
    }
  }
  return [...result.values()];
}

export function forecast(models: readonly PointContrastRecord[], binding: PointContrastRecord): Record<string, boolean> {
  return Object.fromEntries(models.filter(model => model.status === 'unrefuted_local_candidate' && pythonEqual(binding.mode, model.mode) && Object.hasOwn(binding.features, model.feature))
    .map(model => [model.id, pythonEqual(binding.features[model.feature], model.equals)]));
}

export async function contrastOffers(records: readonly PointContrastRecord[], candidates: readonly (PointContrastRecord | null)[],
  options: { compared_pairs?: readonly (readonly [string, string])[] } = {}): Promise<PointContrastRecord[]> {
  const models = await contrastModels(records), tested = new Set<string>(), compared = new Set((options.compared_pairs ?? []).map(pairKey));
  for (const record of records) tested.add(JSON.stringify([record.mode, record.frame_hash, await v6Digest(record.action)]));
  const ranked: { balance: number; binding: PointContrastRecord; predictions: Record<string, boolean>; pairs: [string, string][] }[] = [];
  for (const candidate of candidates) {
    if (candidate === null || tested.has(JSON.stringify([candidate.mode, candidate.frame_hash, await v6Digest(candidate.action)]))) continue;
    const predictions = forecast(models, candidate), entries = Object.entries(predictions), positives = entries.filter(([, value]) => value).length;
    const negatives = entries.length - positives, pairs = new Map<string, [string, string]>();
    for (const [positive, yes] of entries) if (yes) for (const [negative, no] of entries) if (!no) {
      const pair = sortedPair(positive, negative), key = pairKey(pair); if (!compared.has(key)) pairs.set(key, pair);
    }
    if (pairs.size) ranked.push({ balance: Math.min(positives, negatives), binding: candidate, predictions, pairs: [...pairs.values()].sort(comparePair) });
  }
  const contexts = [...records, ...candidates.filter((candidate): candidate is PointContrastRecord => candidate !== null)], offers: PointContrastRecord[] = [];
  for (const { binding, predictions, pairs } of ranked.sort((a, b) => b.balance - a.balance)) {
    const rivals = models.filter(model => Object.hasOwn(predictions, model.id))
      .map(model => ({ id: model.id, feature: model.feature, equals: model.equals, source_ref: model.construction_ref }));
    const classes = new Map<string, Set<string>>();
    for (const rival of rivals) {
      const values = contexts.filter(record => pythonEqual(record.mode, binding.mode)).map(record => pythonEqual(record.features[rival.feature], rival.equals));
      // A Boolean tuple and its complement first differ at index zero.
      const partition = values[0] === true ? values.map(value => !value) : values, key = JSON.stringify(partition);
      const names = classes.get(key) ?? new Set<string>(); names.add(rival.feature); classes.set(key, names);
    }
    offers.push({ status: 'bound_experiment_candidate', binding, frozen_predictions: predictions,
      feature_partitions: [...classes.values()].map(names => [...names].sort(compareUnicode)), rivals, new_contrast_pairs: pairs,
      question: 'Which scoped feature models predict a visible change on the exact addressed support?',
      falsifier: 'compare changed support after this one input; retain failed predictions and unknown causes',
      release_authority: false, terminal_relevance: 'unknown' });
  }
  return offers;
}

export async function proposeContrast(records: readonly PointContrastRecord[], candidates: readonly (PointContrastRecord | null)[],
  options: { compared_pairs?: readonly (readonly [string, string])[] } = {}): Promise<PointContrastRecord> {
  const offers = await contrastOffers(records, candidates, options);
  return offers[0] ?? { status: 'unknown_no_bound_discriminating_input', release_authority: false };
}

export class PointExperimentMemory {
  records: PointContrastRecord[] = [];
  moving_signatures: string[] = [];
  private compared = new Map<string, [string, string]>();
  has_positive = false;
  get compared_pairs(): [string, string][] { return [...this.compared.values()].map(pair => [...pair]); }

  async offer(observation: PointContrastObservation, actions: readonly PointContrastCommand[]): Promise<PointContrastRecord | null> {
    return (await this.offers(observation, actions))[0] ?? null;
  }
  async offers(observation: PointContrastObservation, actions: readonly PointContrastCommand[]): Promise<PointContrastRecord[]> {
    if (!this.has_positive || !actions.some(action => action.action_ref === 'ACTION6')) return [];
    const active = (await contrastModels(this.records)).filter(model => model.status === 'unrefuted_local_candidate' && pythonEqual(model.mode, [observation.level_epoch, observation.state]));
    if (active.length < 2 || active.every((a, i) => active.slice(i + 1).every(b => this.compared.has(pairKey(sortedPair(a.id, b.id)))))) return [];
    const scene = new SceneRelations(observation, { previous_moving_signatures: this.moving_signatures }), bindings: (PointContrastRecord | null)[] = [];
    for (const action of actions) if (action.action_ref === 'ACTION6') bindings.push(await scene.features(action));
    return contrastOffers(this.records, bindings, { compared_pairs: this.compared_pairs });
  }
  async observe(before: PointContrastObservation, command: PointContrastCommand, after: PointContrastObservation,
    beforeRows: NativeRows, afterRows: NativeRows, selected: PointContrastRecord | null = null): Promise<PointContrastRecord | null> {
    if (!pythonEqual(before.level_epoch, after.level_epoch) || ['WIN', 'GAME_OVER'].includes(after.state)) { this.moving_signatures = []; return null; }
    if (command.action_ref !== 'ACTION6') {
      const unique = (observation: PointContrastObservation) => new Map(observation.entities.filter(entity => !pythonTruthy(entity.identity_ambiguous)).map(entity => [entity.signature, entity]));
      const pre = unique(before), post = unique(after);
      const moved = [...pre.keys()].filter(signature => post.has(signature) && !pythonEqual(pre.get(signature)!.position, post.get(signature)!.position)).sort(compareUnicode);
      if (moved.length) this.moving_signatures = moved; return null;
    }
    const scene = new SceneRelations(before, { previous_moving_signatures: this.moving_signatures }), binding = await scene.features(command);
    if (binding === null) throw new Error('Executed point lacks an exact occurrence');
    const changed = scene.regions.get(binding.entity_ref)!.some(([x, y]) => !pythonEqual(beforeRows[y]![x], afterRows[y]![x]));
    const record = testedOccurrence(binding, changed, after.observation_ref); this.records.push(record); this.has_positive ||= changed;
    let comparison: Record<string, boolean> | null = null;
    if (selected !== null) {
      if (!pythonEqual(binding, selected.binding)) throw new Error('Frozen contrast point differs from executed witness');
      comparison = Object.fromEntries(Object.entries(selected.frozen_predictions).map(([key, value]) => [key, pythonEqual(value, changed)]));
      for (const pair of selected.new_contrast_pairs as [string, string][]) this.compared.set(pairKey(pair), copy(pair));
    }
    return { record, matches_frozen_predictions: comparison, compared_pairs: pythonTruthy(selected) ? selected!.new_contrast_pairs : [] };
  }
  state(): PointExperimentState {
    return copy({ records: this.records, moving_signatures: this.moving_signatures,
      compared_pairs: this.compared_pairs.sort(comparePair), has_positive: this.has_positive });
  }
  restore(state: PointExperimentState): void {
    const value = copy(state);
    if (!Array.isArray(value.records) || !Array.isArray(value.moving_signatures) || !Array.isArray(value.compared_pairs) ||
      typeof value.has_positive !== 'boolean' || value.compared_pairs.some(pair => pair.length !== 2 || pair.some(part => typeof part !== 'string'))) {
      throw new TypeError('Invalid point-experiment memory state');
    }
    this.records = value.records; this.moving_signatures = value.moving_signatures;
    this.compared = new Map(value.compared_pairs.map(pair => [pairKey(pair), pair])); this.has_positive = value.has_positive;
  }
}

export { testedOccurrence as tested_occurrence, contrastModels as contrast_models, contrastOffers as contrast_offers, proposeContrast as propose_contrast };

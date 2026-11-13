import type { PublicObservationLike } from './linked-preparation.ts';

export interface AddressedFieldResponseEntity {
  signature: string;
  position: readonly [number, number];
  bbox: readonly [number, number, number, number];
  mask: readonly (readonly [number, number])[];
  [key: string]: unknown;
}

export interface AddressedFieldResponseModel {
  signature: string;
  offset: readonly [number, number];
  position: readonly [number, number];
  action_ref: string;
  [key: string]: unknown;
}

export interface AddressedFieldSample {
  before: string;
  after: string;
  point: readonly [number, number];
  old_position: readonly [number, number];
  new_position: readonly [number, number];
  distance_squared: number;
  moved_to_anchor: boolean;
  stationary: boolean;
}

export interface AddressedFieldResponseState {
  model: AddressedFieldResponseModel | null;
  lowerSquared: number;
  upperSquared: number | null;
  calibration: 'different_offset' | 'outside_indicator' | 'indicator_edge' | 'navigation';
  indicator: { axis_extent: number; [key: string]: unknown } | null;
  samples: AddressedFieldSample[];
  events: Array<Record<string, unknown>>;
}

export interface AddressedFieldCommand {
  action_ref: string;
  data?: Record<string, unknown>;
}

export interface ResidualCorrespondenceCandidate {
  before: AddressedFieldResponseEntity;
  after: AddressedFieldResponseEntity;
}

export interface ResidualCorrespondenceResult {
  candidates: readonly ResidualCorrespondenceCandidate[];
}

export interface AddressedFieldResponseDependencies {
  unchanged(entity: AddressedFieldResponseEntity, after: PublicObservationLike): boolean;
  residualCorrespondences(
    before: PublicObservationLike,
    after: PublicObservationLike,
    first: readonly (readonly number[])[],
    second: readonly (readonly number[])[],
  ): ResidualCorrespondenceResult;
}

export interface AddressedFieldResponseResult {
  status: 'field_unresolved' | 'occurrence_unresolved' | 'field_refuted' | 'field_response_recorded';
  events: readonly Record<string, unknown>[];
}

function samePoint(a: readonly [number, number], b: readonly [number, number]): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function sameBox(a: readonly [number, number, number, number], b: readonly [number, number, number, number]): boolean {
  return a.every((value, index) => value === b[index]);
}

function support(entity: AddressedFieldResponseEntity): Array<readonly [number, number]> {
  const [x, y] = entity.position;
  return entity.mask.map(([dx, dy]) => [x + dx, y + dy] as const);
}

function distanceSquared(point: readonly [number, number], pixels: readonly (readonly [number, number])[]): number {
  return Math.min(...pixels.map(([x, y]) => (point[0] - x) ** 2 + (point[1] - y) ** 2));
}

function body(
  observation: PublicObservationLike,
  model: AddressedFieldResponseModel,
): AddressedFieldResponseEntity | null {
  const entities = (observation.entities ?? []) as readonly AddressedFieldResponseEntity[];
  const candidates = entities.filter(entity =>
    entity.signature === model.signature && samePoint(entity.position, model.position));
  return candidates.length === 1 ? candidates[0]! : null;
}

/**
 * Exact same-epoch response/refutation slice from V6 common_addressed_field.py.
 *
 * Preconditions deliberately mirror the donor point after fit/stock handling:
 * an addressed model already exists and the call stays within the same public
 * level boundary. Model acquisition, retained stock and boundary retention are
 * separate recovery slices and are not inferred here.
 */
export function recordAddressedFieldResponse(
  state: AddressedFieldResponseState,
  before: PublicObservationLike,
  after: PublicObservationLike,
  command: AddressedFieldCommand,
  first: readonly (readonly number[])[],
  second: readonly (readonly number[])[],
  deps: AddressedFieldResponseDependencies,
  proposal?: { field_plan?: { rival_predictions?: Record<string, readonly [number, number]>; experiment?: string } } | null,
): AddressedFieldResponseResult {
  state.events = [];
  const model = state.model;
  const data = command.data ?? {};
  const keys = Object.keys(data).sort();
  if (!model || command.action_ref !== model.action_ref || keys.length !== 2 || keys[0] !== 'x' || keys[1] !== 'y') {
    return { status: 'field_unresolved', events: state.events };
  }

  const beforeEntities = (before.entities ?? []) as readonly AddressedFieldResponseEntity[];
  const priorCandidates = beforeEntities.filter(entity =>
    entity.signature === model.signature && !deps.unchanged(entity, after));
  const old = priorCandidates.length === 1 ? priorCandidates[0]! : body(before, model);
  if (!old) return { status: 'occurrence_unresolved', events: state.events };

  const afterEntities = (after.entities ?? []) as readonly AddressedFieldResponseEntity[];
  const same = afterEntities.filter(entity => entity.signature === old.signature && sameBox(entity.bbox, old.bbox));
  let next: AddressedFieldResponseEntity | null = same.length === 1 ? same[0]! : null;
  if (!next) {
    const comparison = deps.residualCorrespondences(before, after, first, second);
    const matches = comparison.candidates
      .filter(item => sameBox(item.before.bbox, old.bbox))
      .map(item => item.after);
    if (matches.length !== 1) return { status: 'occurrence_unresolved', events: state.events };
    next = matches[0]!;
  }

  const point = [Number(data.x), Number(data.y)] as const;
  const anchor = [next.position[0] + model.offset[0], next.position[1] + model.offset[1]] as const;
  const moved = !samePoint(next.position, old.position);
  const distance = distanceSquared(point, support(old));
  const aligned = samePoint(anchor, point) && moved;

  if (aligned) {
    state.lowerSquared = Math.max(state.lowerSquared, distance);
  } else if (!moved && distance > state.lowerSquared) {
    state.upperSquared = state.upperSquared === null ? distance : Math.min(state.upperSquared, distance);
  } else {
    state.events.push({
      kind: 'addressed_field_counterexample',
      before: before.observation_ref,
      after: after.observation_ref,
      point,
      actual_anchor: anchor,
      scope: 'alignment_hypothesis_refuted',
    });
    state.model = null;
    return { status: 'field_refuted', events: state.events };
  }

  const sample: AddressedFieldSample = {
    before: before.observation_ref,
    after: after.observation_ref,
    point,
    old_position: old.position,
    new_position: next.position,
    distance_squared: distance,
    moved_to_anchor: aligned,
    stationary: !moved,
  };
  state.samples.push(sample);
  state.events.push({ kind: 'addressed_field_response', ...sample });

  const rivals = proposal?.field_plan?.rival_predictions;
  if (rivals) {
    state.events.push({
      kind: 'field_rival_comparison',
      observation: after.observation_ref,
      actual_anchor: anchor,
      compatible: Object.entries(rivals).filter(([, predicted]) => samePoint(predicted, anchor)).map(([name]) => name),
      refuted_here: Object.entries(rivals).filter(([, predicted]) => !samePoint(predicted, anchor)).map(([name]) => name),
    });
  }

  model.position = next.position;
  const experiment = proposal?.field_plan?.experiment;
  if (experiment === 'different_offset') {
    state.calibration = aligned && state.indicator ? 'outside_indicator' : 'navigation';
  } else if (experiment === 'outside_indicator') {
    state.calibration = !moved ? 'indicator_edge' : 'navigation';
  } else if (experiment === 'indicator_edge') {
    state.calibration = 'navigation';
  }

  return { status: 'field_response_recorded', events: state.events };
}

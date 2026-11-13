import type { PublicObservationLike } from './linked-preparation.ts';
import type { AddressedFieldResponseEntity } from './addressed-field-response.ts';

export interface AddressedFieldFitEntity extends AddressedFieldResponseEntity {
  palette_value: number;
  mask: readonly (readonly [number, number])[];
  rectangular?: boolean;
  [key: string]: unknown;
}

export interface AddressedFieldFitCandidate {
  before: AddressedFieldFitEntity;
  after: AddressedFieldFitEntity;
  stationary_same_signature: readonly AddressedFieldFitEntity[];
  identity_status?: unknown;
}

export interface AddressedFieldFitComparison {
  candidates: readonly AddressedFieldFitCandidate[];
  unresolved: readonly unknown[];
}

export interface AddressedFieldGoal {
  shadow: AddressedFieldFitEntity;
  enclosure: AddressedFieldFitEntity;
}

export interface AddressedFieldIndicator {
  palette: number;
  axis_extent: number;
  first_box: readonly [number, number, number, number];
  transient_pixels: number;
  qualification: string;
}

export interface AddressedFieldAcquiredModel {
  signature: string;
  palette: number;
  mask: readonly (readonly [number, number])[];
  size: readonly [number, number];
  offset: readonly [number, number];
  position: readonly [number, number];
  exemplar: AddressedFieldFitEntity;
  goal: AddressedFieldGoal;
  action_ref: string;
  source_ref: string;
}

export interface AddressedFieldFitResult {
  model: AddressedFieldAcquiredModel;
  indicator: AddressedFieldIndicator | null;
  event: Record<string, unknown>;
}

export type ResidualCorrespondencesForFit = (
  before: PublicObservationLike,
  after: PublicObservationLike,
  first: readonly (readonly number[])[],
  second: readonly (readonly number[])[],
) => AddressedFieldFitComparison;

function key(x: number, y: number): string {
  return `${x},${y}`;
}

function center(box: readonly [number, number, number, number]): readonly [number, number] {
  return [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
}

function samePoint(a: readonly [number, number], b: readonly [number, number]): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function sameMask(
  a: readonly (readonly [number, number])[],
  b: readonly (readonly [number, number])[],
): boolean {
  if (a.length !== b.length) return false;
  const left = new Set(a.map(([x, y]) => key(x, y)));
  return b.every(([x, y]) => left.has(key(x, y)));
}

function contains(
  outer: readonly [number, number, number, number],
  inner: readonly [number, number, number, number],
): boolean {
  return outer[0] <= inner[0] && outer[1] <= inner[1] && outer[2] >= inner[2] && outer[3] >= inner[3];
}

function support(entity: AddressedFieldFitEntity): Array<readonly [number, number]> {
  const [x, y] = entity.position;
  return entity.mask.map(([dx, dy]) => [x + dx, y + dy] as const);
}

function neighborhood(points: Set<string>): Array<readonly [number, number]> {
  const result = new Set<string>();
  for (const item of points) {
    const [x, y] = item.split(',').map(Number) as [number, number];
    for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]] as const) {
      const candidate = key(x + dx, y + dy);
      if (!points.has(candidate)) result.add(candidate);
    }
  }
  return [...result].map(item => item.split(',').map(Number) as [number, number]);
}

/** Exact TypeScript port of common_containment.filled for finite local masks. */
export function filled(
  supportMask: readonly (readonly [number, number])[],
  width: number,
  height: number,
): Set<string> {
  const supportSet = new Set(supportMask.map(([x, y]) => key(x, y)));
  const exterior = new Set<string>([key(-1, -1)]);
  const queue: Array<readonly [number, number]> = [[-1, -1]];

  while (queue.length > 0) {
    const point = queue.shift()!;
    for (const [x, y] of neighborhood(new Set([key(point[0], point[1])]))) {
      const candidate = key(x, y);
      if (
        -1 <= x && x <= width
        && -1 <= y && y <= height
        && !exterior.has(candidate)
        && !supportSet.has(candidate)
      ) {
        exterior.add(candidate);
        queue.push([x, y]);
      }
    }
  }

  const result = new Set<string>();
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      const candidate = key(x, y);
      if (!exterior.has(candidate)) result.add(candidate);
    }
  }
  return result;
}

export function targetCandidates(
  observation: PublicObservationLike,
  mobile: AddressedFieldFitEntity,
  rows: readonly (readonly number[])[],
): AddressedFieldGoal[] {
  const entities = (observation.entities ?? []) as readonly AddressedFieldFitEntity[];
  const result: AddressedFieldGoal[] = [];

  for (const shadow of entities) {
    if (shadow.palette_value === mobile.palette_value || !sameMask(shadow.mask, mobile.mask)) continue;
    for (const enclosure of entities) {
      const [left, top, right, bottom] = enclosure.bbox;
      if (left === 0 || top === 0 || right === (rows[0]?.length ?? 0) - 1 || bottom === rows.length - 1) continue;
      if (!contains(enclosure.bbox, shadow.bbox) || !samePoint(center(enclosure.bbox), center(shadow.bbox))) continue;
      if (enclosure.bbox.every((value, index) => value === shadow.bbox[index])) continue;

      const inside = filled(enclosure.mask, right - left + 1, bottom - top + 1);
      for (const [dx, dy] of enclosure.mask) inside.delete(key(dx, dy));
      const shadowSupport = support(shadow).map(([x, y]) => key(x - left, y - top));
      if (shadowSupport.every(point => inside.has(point))) result.push({ shadow, enclosure });
    }
  }
  return result;
}

export function transientContour(
  first: readonly (readonly number[])[],
  frames: readonly (readonly (readonly number[])[])[] | null | undefined,
  point: readonly [number, number],
): AddressedFieldIndicator | null {
  if (!frames || frames.length === 0) return null;
  const changes = new Map<number, Array<readonly [number, number]>>();
  const initial = frames[0]!;
  for (let y = 0; y < initial.length; y += 1) {
    for (let x = 0; x < (initial[y]?.length ?? 0); x += 1) {
      const value = initial[y]![x]!;
      if (value !== first[y]?.[x]) {
        const list = changes.get(value) ?? [];
        list.push([x, y]);
        changes.set(value, list);
      }
    }
  }

  const candidates: AddressedFieldIndicator[] = [];
  const last = frames.at(-1)!;
  for (const [palette, pixels] of changes) {
    const xs = pixels.map(([x]) => x);
    const ys = pixels.map(([, y]) => y);
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    const top = Math.min(...ys);
    const bottom = Math.max(...ys);
    if (right - left !== bottom - top || left + right !== 2 * point[0] || top + bottom !== 2 * point[1]) continue;
    if (right - left < 2 || pixels.some(([x, y]) => last[y]?.[x] === palette)) continue;
    candidates.push({
      palette,
      axis_extent: Math.floor((right - left) / 2),
      first_box: [left, top, right, bottom],
      transient_pixels: pixels.length,
      qualification: 'transient graphic only; physical influence remains a separate hypothesis',
    });
  }

  return candidates.sort((a, b) => b.transient_pixels - a.transient_pixels)[0] ?? null;
}

export function fitAddressedField(
  before: PublicObservationLike,
  after: PublicObservationLike,
  command: { action_ref: string; data?: Record<string, unknown> },
  first: readonly (readonly number[])[],
  second: readonly (readonly number[])[],
  frames: readonly (readonly (readonly number[])[])[] | null | undefined,
  residualCorrespondences: ResidualCorrespondencesForFit,
): AddressedFieldFitResult | null {
  const point = command.data ?? {};
  const keys = Object.keys(point).sort();
  if (keys.length !== 2 || keys[0] !== 'x' || keys[1] !== 'y') return null;

  const comparison = residualCorrespondences(before, after, first, second);
  const options: Array<{
    candidate: AddressedFieldFitCandidate;
    goal: AddressedFieldGoal;
    offset: readonly [number, number];
    size: readonly [number, number];
  }> = [];

  for (const candidate of comparison.candidates) {
    const old = candidate.before;
    const next = candidate.after;
    if (!old.rectangular || candidate.stationary_same_signature.length === 0) continue;
    const goals = targetCandidates(before, old, first);
    if (goals.length !== 1) continue;

    const offset = [Number(point.x) - next.position[0], Number(point.y) - next.position[1]] as const;
    const width = next.bbox[2] - next.bbox[0] + 1;
    const height = next.bbox[3] - next.bbox[1] + 1;
    if (!(0 <= offset[0] && offset[0] < width && 0 <= offset[1] && offset[1] < height)) continue;
    options.push({ candidate, goal: goals[0]!, offset, size: [width, height] });
  }

  if (options.length !== 1) return null;
  const { candidate, goal, offset, size } = options[0]!;
  const old = candidate.before;
  const next = candidate.after;
  const model: AddressedFieldAcquiredModel = {
    signature: next.signature,
    palette: next.palette_value,
    mask: next.mask,
    size,
    offset,
    position: next.position,
    exemplar: candidate.stationary_same_signature[0]!,
    goal,
    action_ref: command.action_ref,
    source_ref: before.observation_ref,
  };
  const indicator = transientContour(first, frames, [Number(point.x), Number(point.y)]);
  const event = {
    kind: 'addressed_field_candidate',
    before: before.observation_ref,
    after: after.observation_ref,
    mobile_before: old.bbox,
    mobile_after: next.bbox,
    stationary_exemplar: model.exemplar.bbox,
    goal_shadow: goal.shadow.bbox,
    identity: candidate.identity_status,
    unresolved_residual_count: comparison.unresolved.length,
    indicator,
    goal_status: 'centered_homologue_hypothesis',
  };
  return { model, indicator, event };
}

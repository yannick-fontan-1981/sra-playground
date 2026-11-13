/**
 * Exact box-only projection of the pinned V5 discrete_relay_optics._first_hit.
 *
 * Linked Packet supplies finite hypothetical rays and visible support boxes.
 * This is neither the full optical state machine nor a game collision law.
 * Rational arithmetic stays in BigInt; JSON receipts are emitted only when
 * every numerator and denominator is an exact safe integer.
 */
type R = Record<string, any>;
type Rational = { n: bigint; d: bigint };
type Point = readonly [Rational, Rational];
type Bounds = readonly [Rational, Rational, Rational, Rational];
type Candidate = readonly [string, Rational, Rational];

export class VisibleBoxRayPrerequisite extends Error {
  constructor(cause: string) { super(cause); this.name = 'VisibleBoxRayPrerequisite'; }
}
export class VisibleBoxRayInterrupted extends Error {
  readonly cause: string;
  readonly frontier: R;
  constructor(cause: string, frontier: R) {
    super(cause); this.name = 'VisibleBoxRayInterrupted'; this.cause = cause;
    this.frontier = structuredClone(frontier);
  }
}

/** The source checks the node bound before the clock on every receiver visit. */
export class VisibleBoxRayBudget {
  readonly request: R;
  readonly started: number;
  examined = 0;
  private readonly now: () => number;
  constructor(request: R, now: () => number = () => performance.now()) {
    if (!Number.isSafeInteger(request.node_bound) || request.node_bound < 1
      || !Number.isSafeInteger(request.time_bound_ms) || request.time_bound_ms < 1) {
      throw new TypeError('Finite positive mechanical node and time bounds required');
    }
    this.request = structuredClone(request); this.now = now; this.started = now();
  }
  visit(frontier: R = {}): void {
    if (this.examined >= this.request.node_bound) throw new VisibleBoxRayInterrupted('NODE_BOUND', frontier);
    if (this.now() - this.started >= this.request.time_bound_ms) throw new VisibleBoxRayInterrupted('TIME_BOUND', frontier);
    this.examined++;
  }
  finish(): void {
    if (this.now() - this.started >= this.request.time_bound_ms) throw new VisibleBoxRayInterrupted('TIME_BOUND', {});
  }
}

const zero: Rational = { n: 0n, d: 1n };
function rational(n: bigint, d: bigint): Rational {
  if (d === 0n) throw new VisibleBoxRayPrerequisite('EXACT_RATIONAL_GEOMETRY_OR_DIRECTION_REQUIRED');
  if (d < 0n) { n = -n; d = -d; }
  let a = n < 0n ? -n : n, b = d;
  while (b !== 0n) { const remainder = a % b; a = b; b = remainder; }
  return { n: n / a, d: d / a };
}
function fraction(pair: unknown): Rational {
  if (!Array.isArray(pair) || pair.length !== 2 || !Number.isSafeInteger(pair[0])
    || !Number.isSafeInteger(pair[1]) || pair[1] <= 0) {
    throw new VisibleBoxRayPrerequisite('EXACT_RATIONAL_GEOMETRY_OR_DIRECTION_REQUIRED');
  }
  return rational(BigInt(pair[0]), BigInt(pair[1]));
}
function point(value: unknown): Point {
  if (!Array.isArray(value) || value.length !== 2) throw new VisibleBoxRayPrerequisite('EXACT_RATIONAL_GEOMETRY_OR_DIRECTION_REQUIRED');
  return [fraction(value[0]), fraction(value[1])];
}
function bounds(value: unknown): Bounds {
  if (!Array.isArray(value) || value.length !== 4) throw new VisibleBoxRayPrerequisite('EXACT_RATIONAL_GEOMETRY_OR_DIRECTION_REQUIRED');
  return [fraction(value[0]), fraction(value[1]), fraction(value[2]), fraction(value[3])];
}
function compare(a: Rational, b: Rational): number {
  const difference = a.n * b.d - b.n * a.d;
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}
const subtract = (a: Rational, b: Rational): Rational => rational(a.n * b.d - b.n * a.d, a.d * b.d);
const divide = (a: Rational, b: Rational): Rational => rational(a.n * b.d, a.d * b.n);
const minimum = (values: readonly Rational[]): Rational => values.reduce((a, b) => compare(a, b) <= 0 ? a : b);
const maximum = (values: readonly Rational[]): Rational => values.reduce((a, b) => compare(a, b) >= 0 ? a : b);
function ratio(value: Rational): [number, number] {
  const n = Number(value.n), d = Number(value.d);
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d)) {
    throw new VisibleBoxRayPrerequisite('EXACT_RATIONAL_RECEIPT_EXCEEDS_NATIVE_SAFE_INTEGER_DOMAIN');
  }
  return [n, d];
}

function receiverInterval(model: R, receiver: R, origin: Point, direction: Point): readonly [Rational, Rational] | null {
  if (receiver.shape_ref !== 'axis_aligned_closed_box' || receiver.box_bounds == null) {
    throw new VisibleBoxRayPrerequisite('SUPPORTED_ANALYTIC_RECEIVER_SHAPE_REQUIRED');
  }
  const box = bounds(receiver.box_bounds);
  if (compare(box[0], box[2]) > 0 || compare(box[1], box[3]) > 0) {
    throw new VisibleBoxRayPrerequisite('VALID_ANALYTIC_RECEIVER_BOX_REQUIRED');
  }
  const entries: Rational[] = [], exits: Rational[] = [];
  for (const axis of [0, 1] as const) {
    const coordinate = origin[axis], velocity = direction[axis], low = box[axis], high = box[axis + 2]!;
    if (velocity.n === 0n) {
      if (compare(low, coordinate) > 0 || compare(coordinate, high) > 0) return null;
      continue;
    }
    const first = divide(subtract(low, coordinate), velocity), second = divide(subtract(high, coordinate), velocity);
    entries.push(minimum([first, second])); exits.push(maximum([first, second]));
  }
  const entry = maximum(entries), exit = minimum(exits);
  if (compare(exit, entry) < 0 || compare(exit, zero) <= 0) return null;
  if (compare(entry, zero) > 0) return [entry, entry];
  if (model.source_inside_receiver_law_ref !== 'first_positive_exit') {
    throw new VisibleBoxRayPrerequisite('DECLARED_ORIGIN_INSIDE_NON_SOURCE_RECEIVER_LAW_REQUIRED');
  }
  return [exit, exit];
}

export function visibleBoxFirstHit(model: R, ray: R, budget: Pick<VisibleBoxRayBudget, 'visit'>): R {
  if (model.intersection_law_ref !== 'positive_analytic_ray_intersections_before_box_exit') {
    throw new VisibleBoxRayPrerequisite('DECLARED_FIRST_IMPACT_LAW_REQUIRED');
  }
  const directions = new Map<string, R>((model.directions as R[]).map(value => [value.direction_ref, value]));
  const selected = directions.get(ray.direction_ref);
  if (!selected) throw new VisibleBoxRayPrerequisite('CURRENT_FINITE_ABSOLUTE_DIRECTION_REQUIRED');
  const origin = point(ray.origin), direction = point(selected.vector), box = bounds(model.boundary_bounds);
  if (direction.every(value => value.n === 0n)) throw new VisibleBoxRayPrerequisite('NONZERO_FINITE_RAY_DIRECTION_REQUIRED');
  if (compare(box[0], box[2]) > 0 || compare(box[1], box[3]) > 0
    || [0, 1].some(axis => compare(box[axis]!, origin[axis]!) > 0 || compare(origin[axis]!, box[axis + 2]!) > 0)) {
    throw new VisibleBoxRayPrerequisite('SOURCE_ORIGIN_WITHIN_DECLARED_BOUNDARY_REQUIRED');
  }
  const exits: Rational[] = [];
  for (const axis of [0, 1] as const) {
    const velocity = direction[axis];
    if (velocity.n !== 0n) exits.push(divide(subtract(box[velocity.n > 0n ? axis + 2 : axis]!, origin[axis]), velocity));
  }
  const boundary = minimum(exits), candidates: Candidate[] = [];
  for (const receiver of model.receivers as R[]) {
    budget.visit({ first_hit_receiver_ref: receiver.body_ref });
    if (receiver.body_ref === ray.excluded_source_body_ref) continue;
    const interval = receiverInterval(model, receiver, origin, direction);
    if (!interval || compare(interval[0], boundary) > 0) continue;
    candidates.push([receiver.body_ref, ...interval]);
  }
  if (!candidates.length) return { first_receiver_ref: null, boundary_exit_parameter: ratio(boundary),
    numeric_uncertainty: [], complete_first_hit: true, boundary_exit: true };
  const minimumUpper = minimum(candidates.map(value => value[2]));
  const earliest = candidates.filter(value => compare(value[1], minimumUpper) <= 0);
  let unique = earliest[0]!;
  if (earliest.length > 1) {
    // Box intersections are exact. Keep the source's explicit tie authority.
    const order = model.receiver_tie_order as string[] | undefined;
    if (model.hit_tie_law_ref !== 'declared_receiver_order' || !Array.isArray(order)
      || new Set(order).size !== order.length || earliest.some(value => !order.includes(value[0]))) {
      throw new VisibleBoxRayPrerequisite('DECLARED_EXACT_IMPACT_TIE_GUARD_REQUIRED');
    }
    unique = earliest.find(value => value[0] === order.find(ref => earliest.some(candidate => candidate[0] === ref)))!;
  }
  return { first_receiver_ref: unique[0], impact_parameter_interval: [ratio(unique[1]), ratio(unique[2])],
    boundary_exit_parameter: ratio(boundary), complete_first_hit: true, numeric_uncertainty: [],
    nearer_receiver_not_skipped: true, wire_or_ray_crossing_not_a_receiver: true };
}

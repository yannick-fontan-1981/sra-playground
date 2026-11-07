/** Complete native transfer of common_orbit_constraints.py at 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e. */
import { projection, rowsDigest, v6Digest } from './v6-native-observer.ts';
import type { ObservedInputDomain } from './v6-native-observer.ts';
import type { NativeBox, NativePoint, NativePublicObservation, NativeRows } from './v6-native-types.ts';

export type OrbitRecord = Record<string, any>;
export interface OrbitCommand extends OrbitRecord { action_ref: string; data?: Record<string, number> }
export interface OrbitObservation extends OrbitRecord { entities: readonly OrbitRecord[]; level_epoch: number; levels_completed: number; observation_ref: string; frame_hash: string; state: string }
export interface OrbitField {
  positions: NativePoint[]; size: number; targets: Map<number, number>;
  controls: Map<string, { key: NativePoint; command: OrbitCommand; box: NativeBox }>;
}
const keyOf = (value: unknown): string => JSON.stringify(value);
const pointKey = (point: NativePoint): string => keyOf(point);
const comparePoint = (a: NativePoint, b: NativePoint): number => a[0] - b[0] || a[1] - b[1];
function compareNumbers(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
  return a.length - b.length;
}
const comparePoints = (a: readonly NativePoint[], b: readonly NativePoint[]): number => compareNumbers(a.flat(), b.flat());
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, i) => same(value, b[i]));
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && same((a as OrbitRecord)[key], (b as OrbitRecord)[key]));
}
const addressed = (command: OrbitCommand): boolean => command.data !== undefined && Object.keys(command.data).length > 0;
const sortedPoints = <T extends { key: NativePoint }>(values: Iterable<T>): T[] => [...values].sort((a, b) => comparePoint(a.key, b.key));
function pairs<T>(values: readonly T[]): [T, T][] {
  const result: [T, T][] = [];
  for (let i = 0; i < values.length; i++) for (let j = i + 1; j < values.length; j++) result.push([values[i]!, values[j]!]);
  return result;
}

/** Exact dihedral canonical silhouette, retaining the source point order. */
export function orbitSilhouette(entity: OrbitRecord): NativePoint[] {
  let points = [...new Map((entity.mask as NativePoint[]).map(point => [pointKey(point), point])).values()];
  const variants: NativePoint[][] = [];
  for (let rotation = 0; rotation < 4; rotation++) {
    points = points.map(([x, y]) => [y === 0 ? 0 : -y, x]);
    for (const flip of [1, -1]) {
      const q = points.map(([x, y]): NativePoint => [x === 0 ? 0 : flip * x, y]).sort(comparePoint);
      if (!q.length) throw new TypeError('An observed control silhouette must have pixels');
      const a = Math.min(...q.map(p => p[0])), b = Math.min(...q.map(p => p[1]));
      variants.push(q.map(([x, y]) => [x - a, y - b]));
    }
  }
  return variants.sort(comparePoints)[0]!;
}

/** Ordered convex boundary; the original algorithm retains collinear slots. */
export function orbitHull(points: readonly NativePoint[]): NativePoint[] {
  const p = [...points].sort(comparePoint);
  if (p.length <= 2) return p;
  const cross = (a: NativePoint, b: NativePoint, c: NativePoint) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  if (p.every(q => cross(p[0]!, p.at(-1)!, q) === 0)) return p;
  const half = (items: readonly NativePoint[]) => {
    const stack: NativePoint[] = [];
    for (const q of items) {
      while (stack.length >= 2 && cross(stack.at(-2)!, stack.at(-1)!, q) < 0) stack.pop();
      stack.push(q);
    }
    return stack.slice(0, -1);
  };
  return [...half(p), ...half([...p].reverse())];
}

/** All source rectangle, straight-line and radial-crop contour hypotheses. */
export function orbitCycles(positions: readonly NativePoint[]): number[][] {
  const axes = [0, 1].map(axis => [...new Set(positions.map(p => p[axis]!))].sort((a, b) => a - b));
  const index = new Map(positions.map((point, i) => [pointKey(point), i]));
  const results = new Map<string, number[]>();
  const retain = (points: readonly NativePoint[]) => { const ring = points.map(p => index.get(pointKey(p))!); results.set(keyOf(ring), ring); };
  for (const [a, b] of pairs(axes[0]!)) for (const [c, d] of pairs(axes[1]!)) {
    const points = positions.filter(p => a <= p[0] && p[0] <= b && c <= p[1] && p[1] <= d);
    if (points.length >= 3) retain(orbitHull(points));
  }
  for (let axis = 0; axis < 2; axis++) for (const coordinate of axes[axis]!) {
    const line = positions.filter(p => p[axis] === coordinate).sort((a, b) => a[1 - axis]! - b[1 - axis]!);
    if (line.length >= 2) retain(line);
  }
  const centers = axes.map(axis => [...new Set(axis.flatMap(a => axis.map(b => a + b)))]);
  for (const x of centers[0]!) for (const y of centers[1]!) {
    const layers = new Map<number, NativePoint[]>();
    for (const point of positions) {
      const distance = (2 * point[0] - x) ** 2 + (2 * point[1] - y) ** 2;
      if (!layers.has(distance)) layers.set(distance, []);
      layers.get(distance)!.push(point);
    }
    const inside: NativePoint[] = [];
    for (const [, layer] of [...layers].sort(([a], [b]) => a - b)) {
      inside.push(...layer);
      if (inside.length >= 3) retain(orbitHull(inside));
    }
  }
  // The reference returns a set. No authored order or ranking is discarded.
  return [...results.values()].sort(compareNumbers);
}

export function measureOrbitField(observation: OrbitObservation, inputs: readonly OrbitCommand[]): OrbitField | null {
  const squares = new Map<number, OrbitRecord[]>(), irregular = new Map<string, OrbitRecord[]>();
  const byCorner = new Map(observation.entities.filter(e => e.rectangular).map(e => [keyOf(e.bbox), e]));
  for (const entity of observation.entities) {
    const [x, y, right, bottom] = entity.bbox as NativeBox;
    if (entity.rectangular && right - x === bottom - y) {
      const width = right - x + 1; if (!squares.has(width)) squares.set(width, []); squares.get(width)!.push(entity);
    } else if (!entity.rectangular && entity.area * 2 > (right - x + 1) * (bottom - y + 1)) {
      const key = keyOf(orbitSilhouette(entity)); if (!irregular.has(key)) irregular.set(key, []); irregular.get(key)!.push(entity);
    }
  }
  const fields: OrbitField[] = [];
  for (const [width, cells] of squares) {
    if (cells.length < 3 || new Set(cells.map(e => e.palette_value)).size < 2) continue;
    const positions = cells.map(e => e.position as NativePoint).sort(comparePoint), targets = new Map<number, number>();
    for (let i = 0; i < positions.length; i++) {
      const [x, y] = positions[i]!;
      for (const markSize of squares.keys()) if (markSize < width) {
        const marks: (OrbitRecord | undefined)[] = [];
        for (const a of [x - markSize, x + width]) for (const b of [y - markSize, y + width]) marks.push(byCorner.get(keyOf([a, b, a + markSize - 1, b + markSize - 1])));
        if (marks.every(Boolean) && new Set(marks.map(e => e!.palette_value)).size === 1) targets.set(i, marks[0]!.palette_value);
      }
    }
    if (!targets.size) continue;
    const controls: OrbitField['controls'] = new Map();
    for (const group of irregular.values()) {
      if (group.length < 2 || new Set(group.map(e => keyOf(e.mask))).size < 2) continue;
      for (const entity of group) {
        const [x, y, right, bottom] = entity.bbox as NativeBox, mask = new Set((entity.mask as NativePoint[]).map(pointKey));
        for (const command of inputs) if (addressed(command)) {
          const data = command.data!;
          if (data.x === undefined || data.y === undefined) throw new TypeError('Addressed public control requires x and y');
          if (x <= data.x && data.x <= right && y <= data.y && data.y <= bottom && mask.has(pointKey([data.x - x, data.y - y]))) {
            const key: NativePoint = [data.x, data.y]; controls.set(pointKey(key), { key, command, box: entity.bbox });
          }
        }
      }
    }
    if (controls.size) fields.push({ positions, size: width, targets, controls });
  }
  return fields.length === 1 ? fields[0]! : null;
}

export function orbitValues(rows: NativeRows, positions: readonly NativePoint[], size: number): number[] {
  const result: number[] = [];
  for (const [x, y] of positions) {
    const value = rows[y]?.[x];
    if (value === undefined) throw new RangeError('Measured orbit slot outside the public viewport');
    for (let b = y; b < y + size; b++) for (let a = x; a < x + size; a++) {
      if (rows[b]?.[a] === undefined) throw new RangeError('Measured orbit slot outside the public viewport');
      if (rows[b]![a] !== value) return [];
    }
    result.push(value);
  }
  return result;
}

export function fitOrbit(before: readonly number[], after: readonly number[], contours: readonly (readonly number[])[]): number[][] {
  const changed = before.flatMap((value, i) => i < after.length && value !== after[i] ? [i] : []);
  if (!changed.length || !same([...before].sort((a, b) => a - b), [...after].sort((a, b) => a - b))) return [];
  const candidates = new Map<string, number[]>();
  for (const ring of contours) {
    if (!changed.every(index => ring.includes(index))) continue;
    for (const direction of [-1, 1]) {
      const permutation = before.map((_, i) => i);
      ring.forEach((destination, j) => { permutation[destination] = ring[((j - direction) % ring.length + ring.length) % ring.length]!; });
      if (permutation.every((source, i) => before[source] === after[i])) candidates.set(keyOf(permutation), permutation);
    }
  }
  return [...candidates.values()].sort(compareNumbers);
}

/** Backward search tracks marked positions instead of enumerating every arrangement. */
export function orbitRoute(values: readonly number[], targets: ReadonlyMap<number, number>,
  operators: ReadonlyMap<string, { key: NativePoint; permutation: readonly number[] }>, budget: number): NativePoint[] | null {
  const start = [...targets.keys()], queue: { positions: number[]; path: NativePoint[] }[] = [{ positions: start, path: [] }], seen = new Set([keyOf(start)]);
  const markedValues = [...targets.values()], sorted = sortedPoints(operators.values());
  for (let head = 0; head < queue.length; head++) {
    const { positions, path } = queue[head]!;
    if (positions.every((index, i) => values[index] === markedValues[i])) return path;
    if (path.length >= budget) continue;
    for (const { key, permutation } of sorted) {
      const predecessor = positions.map(index => permutation[index]!);
      if (!seen.has(keyOf(predecessor))) { seen.add(keyOf(predecessor)); queue.push({ positions: predecessor, path: [key, ...path] }); }
    }
  }
  return null;
}

export class OrbitConstraints {
  readonly id = 'orbit_constraints';
  readonly familyId = 'orbit_constraints';
  layout: unknown = null;
  history: OrbitRecord[] = [];
  scored: OrbitRecord[] = [];
  contours: number[][] = [];
  models = new Map<string, { key: NativePoint; permutations: number[][] }>();
  refs = new Map<string, { key: NativePoint; ref: string }>();
  tried = new Map<string, { key: NativePoint; arrangements: Map<string, number[]> }>();

  state(): OrbitRecord {
    const result: OrbitRecord = { format: 'native.orbit_constraints.v1', layout: this.layout, history: this.history, scored: this.scored };
    if (this.layout !== null) Object.assign(result, { contours: this.contours,
      models: [...this.models.values()].map(v => [v.key, v.permutations]), refs: [...this.refs.values()].map(v => [v.key, v.ref]),
      tried: [...this.tried.values()].map(v => [v.key, [...v.arrangements.values()].sort(compareNumbers)]) });
    return structuredClone(result);
  }
  restore(snapshot: OrbitRecord): void {
    const value = structuredClone(snapshot);
    if (value.format !== 'native.orbit_constraints.v1' || !Array.isArray(value.history) || !Array.isArray(value.scored)
      || value.layout !== null && (!Array.isArray(value.contours) || !Array.isArray(value.models) || !Array.isArray(value.refs) || !Array.isArray(value.tried))) throw new TypeError('Incompatible orbit-constraint memory snapshot');
    this.layout = value.layout; this.history = value.history; this.scored = value.scored;
    this.contours = value.contours ?? [];
    this.models = new Map((value.models ?? []).map(([key, permutations]: [NativePoint, number[][]]) => [pointKey(key), { key, permutations }]));
    this.refs = new Map((value.refs ?? []).map(([key, ref]: [NativePoint, string]) => [pointKey(key), { key, ref }]));
    this.tried = new Map((value.tried ?? []).map(([key, arrangements]: [NativePoint, number[][]]) => [pointKey(key), { key, arrangements: new Map(arrangements.map(a => [keyOf(a), a])) }]));
  }
  private trials(key: NativePoint): Map<string, number[]> {
    if (!this.tried.has(pointKey(key))) this.tried.set(pointKey(key), { key, arrangements: new Map() });
    return this.tried.get(pointKey(key))!.arrangements;
  }

  async propose(observation: OrbitObservation, rows: NativeRows, inputs: readonly OrbitCommand[], remaining: number): Promise<OrbitRecord | null> {
    if (!inputs.some(addressed)) return null;
    const scene = measureOrbitField(observation, inputs);
    if (scene === null) return null;
    const { positions, size, targets, controls } = scene;
    const layout = [observation.level_epoch, positions, size, [...targets], sortedPoints(controls.values()).map(value => value.key)];
    if (!same(layout, this.layout)) { this.layout = layout; this.contours = orbitCycles(positions); this.models.clear(); this.refs.clear(); this.tried.clear(); }
    const current = orbitValues(rows, positions, size);
    if (!current.length || [...targets].every(([index, value]) => current[index] === value)) return null;
    const known = new Map([...this.models].filter(([, model]) => model.permutations.length === 1).map(([key, model]) => [key, { key: model.key, permutation: model.permutations[0]! }]));
    const path = orbitRoute(current, targets, known, remaining);
    const unexplored = sortedPoints([...controls].filter(([key]) => !this.models.has(key)).map(([, value]) => value));
    let keys: NativePoint[], purpose: string;
    if (unexplored.length && (!path?.length || path.length > 1)) {
      keys = [unexplored[0]!.key]; purpose = 'Test whether an unmeasured member of a repeated nonrectangular silhouette class changes the enclosed slot field.';
    } else if (path?.length) {
      keys = path.slice(0, Math.min(16, remaining)); purpose = 'Compose locally observed permutations to match each enclosed slot to its four corner witnesses.';
    } else {
      const ambiguous = sortedPoints([...this.models.values()].filter(model => model.permutations.length > 1 && !this.trials(model.key).has(keyOf(current))));
      if (!ambiguous.length) return null;
      keys = [ambiguous[0]!.key]; purpose = 'Repeat an addressed control in a different content arrangement to distinguish remaining permutations.';
    }
    const steps: OrbitRecord[] = [], refs = [observation.observation_ref]; let arrangement: readonly number[] = current;
    for (const key of keys) {
      const control = controls.get(pointKey(key));
      if (!control) throw new TypeError('Retained orbit operator has no current public control');
      const op = known.get(pointKey(key))?.permutation, predicted = op ? op.map(index => arrangement[index]!) : null;
      steps.push({ action: control.command, key: [...key], control_box: control.box, control_digest: await rowsDigest(projection(rows, control.box)),
        before_values: [...arrangement], expected_after: predicted,
        expected_before: { level_epoch: observation.level_epoch, frame_hash: steps.length ? null : observation.frame_hash } });
      if (this.refs.has(pointKey(key))) refs.push(this.refs.get(pointKey(key))!.ref);
      if (predicted === null) break;
      arrangement = predicted;
    }
    const actions = steps.map(step => step.action), focus = `C_orbit_${(await v6Digest([refs, actions])).slice(0, 16)}`;
    const plan = { positions, size, targets: [...targets], candidate_control_count: controls.size, unique_observed_operators: known.size,
      contour_family: 'one-neighbor cyclic movement on a straight line or convex boundary', target_status: 'observable four-corner correspondence, tentative until score', why: purpose };
    const facts = { corner_correspondence_observed: true, address_on_repeated_control_shape: true, conditional_prefix_bound: true };
    return { status: 'proposed', kind: 'measured_slot_permutation', orbit_plan: plan, actions, steps, facts,
      compositions: [{ id: focus, role: 'information_question', observed: false, open_question: purpose, properties: plan, relations: ['contributes_to:G_official_completion'] }],
      question: { reason: purpose, hypothesis_refs: refs }, route_refs: refs,
      binding: { observation_ref: observation.observation_ref, level_epoch: observation.level_epoch, levels_completed: observation.levels_completed },
      bundle_template: { operation_key: 'OP18', composition_ref: focus, objective_ref: 'G_official_completion', preserve_refs: [],
        purpose, preconditions: facts, evidence: refs, actions, outcome_guard: { path: ['value'], contains: focus } } };
  }

  bind(proposal: OrbitRecord, domain: ObservedInputDomain): void {
    const frame = proposal.steps[0].expected_before.frame_hash;
    for (const step of proposal.steps) {
      const binding = domain.bindings.get(`${proposal.binding.level_epoch}:${frame}`)?.get(`${step.key[0]},${step.key[1]}`);
      if (!binding) throw new TypeError('Addressed orbit control has no current sampled witness');
      step.point_binding = { ...binding, projected_rows_digest: step.control_digest, projection_bbox: step.control_box };
    }
  }

  async before(proposal: OrbitRecord, index: number, publicPacket: NativePublicObservation, observation: OrbitObservation): Promise<{ admitted: boolean; reason: string }> {
    const step = proposal.steps[index], plan = proposal.orbit_plan, bound = proposal.binding;
    const ok = publicPacket.level === bound.level_epoch && publicPacket.levels_completed === bound.levels_completed
      && (index !== 0 || observation.observation_ref === bound.observation_ref) && publicPacket.available_action_refs.includes(step.action.action_ref)
      && same(orbitValues(publicPacket.frame_rows, plan.positions, plan.size), step.before_values)
      && await rowsDigest(projection(publicPacket.frame_rows, step.control_box)) === step.control_digest;
    return { admitted: !!ok, reason: 'compare_frozen_positions_contents_and_control' };
  }

  after(proposal: OrbitRecord, index: number, before: OrbitObservation, after: OrbitObservation, _first: NativeRows, second: NativeRows): OrbitRecord {
    if (!same([before.level_epoch, before.state, before.levels_completed], [after.level_epoch, after.state, after.levels_completed])) return { matched: null, seal_prefix: true, reason: 'official_boundary' };
    const prediction = proposal.steps[index].expected_after, plan = proposal.orbit_plan;
    const matched = prediction?.length ? same(orbitValues(second, plan.positions, plan.size), prediction) : null;
    return { matched, seal_prefix: matched !== true || index + 1 === proposal.steps.length, reason: 'compare_measured_permutation' };
  }

  record(before: OrbitObservation, after: OrbitObservation, command: OrbitCommand, _first: NativeRows, second: NativeRows, proposal: OrbitRecord, index: number): OrbitRecord {
    const step = proposal.steps[index], key = step.key as NativePoint, plan = proposal.orbit_plan, ref = after.observation_ref;
    // Object member order does not affect Python dict equality.
    if (!same(command, step.action)) {
      throw new TypeError('Orbit observation differs from released command');
    }
    if (after.levels_completed > before.levels_completed) {
      this.scored.push({ ref, marked_slots: plan.targets.length, score: after.levels_completed }); return { status: 'official_boundary', ref };
    }
    const old = step.before_values as number[], next = orbitValues(second, plan.positions, plan.size);
    let fits = next.length ? fitOrbit(old, next, this.contours) : [];
    const prior = this.models.get(pointKey(key));
    if (prior) { const allowed = new Set(prior.permutations.map(keyOf)); fits = fits.filter(permutation => allowed.has(keyOf(permutation))); }
    this.models.set(pointKey(key), { key, permutations: fits }); this.refs.set(pointKey(key), { key, ref }); this.trials(key).set(keyOf(old), old);
    const event = { ref, key: [...key], status: fits.length ? 'locally_fitted' : 'no_supported_permutation', matches: fits.length,
      changed_slots: old.filter((value, i) => i < next.length && value !== next[i]).length };
    this.history.push(event); return event;
  }
}

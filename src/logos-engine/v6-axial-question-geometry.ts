/** Pinned V6 axial_question/geometry.py and its consumed V5 _direct pivot.
 * Source: 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e.
 * Centers and pixel supports are [x,y]; positive axes are [row,column].
 * A projected quarter turn supplies no translation, force, or goal law.
 */
import { components, RecolorWorkBudget } from './v6-topological-recolor-geometry.ts';
import { symbolicDigest } from './v6-hash.ts';
import { pythonEqual as equal } from './v6-operations.ts';
import { supportCompare as compare } from './v6-support-measurements.ts';
import type { NativeRows } from './v6-native-types.ts';

export type AxialPoint = [number, number];
export type AxialBox = [number, number, number, number];
export interface AxialComponent {
  value: number;
  bbox: AxialBox;
  cells: AxialPoint[];
}
export interface AxialBodyMeasurement {
  bbox: AxialBox;
  center: AxialPoint;
  axis: AxialPoint;
  poles: AxialPoint;
  core: number;
  side: number;
  marker: number;
  size: number;
  signature: number[];
}
export interface AxialTarget {
  center: AxialPoint;
  bbox: AxialBox;
  ring_value: number;
  inside: number;
}
export interface AxialMeasurement {
  bodies: AxialBodyMeasurement[];
  target: AxialTarget;
  quantum: number;
  grid_bounds: AxialBox;
  anchors: AxialPoint[];
  selected: AxialBodyMeasurement | null;
  ambiguous_selection: boolean;
  signature: number[];
}
export interface AxialRelation {
  kind: 'between' | 'outside' | 'transverse_dependency';
  peer: AxialBodyMeasurement;
  dependency: AxialPoint[];
  target: AxialPoint;
  scope: 'qualitative_interaction_hypothesis_no_endpoint_prediction';
}
export interface AxialProjection {
  turn: -1 | 1;
  axis: number[];
  scope: 'conditional_orientation_only_no_translation_model';
}
export const digest = symbolicDigest;
const key = (point: readonly number[]): string => point.join(',');
const segmentKey = (value: number, box: readonly number[]): string => `${value}:${key(box)}`;
const modulo = (value: number, modulus: number): number => ((value % modulus) + modulus) % modulus;

/** Keep original components first, then decomposed strips in source order. */
export function barSegments(cc: readonly AxialComponent[]): AxialComponent[] {
  const original = cc.filter(c => c.cells.length >= 3 && (c.bbox[0] === c.bbox[2] || c.bbox[1] === c.bbox[3]));
  const lengths = [...new Set(original.filter(c => c.cells.length % 2 === 1).map(c => c.cells.length))].sort((a, b) => a - b);
  const out = [...original], seen = new Set(out.map(c => segmentKey(c.value, c.bbox)));
  for (const c of cc) {
    const [left, top, right, bottom] = c.bbox, cells = new Set(c.cells.map(key));
    if (left === right || top === bottom) continue;
    for (const n of lengths) {
      if (cells.size > 4 * n * n) continue;
      for (const [x, y] of [...c.cells].sort(compare)) {
        for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
          const strip: AxialPoint[] = Array.from({ length: n }, (_, k) => [x + dx * k, y + dy * k]);
          const box: AxialBox = [x, y, x + dx * (n - 1), y + dy * (n - 1)], candidate = segmentKey(c.value, box);
          if (!seen.has(candidate) && strip.every(p => cells.has(key(p)))) {
            out.push({ value: c.value, bbox: box, cells: strip }); seen.add(candidate);
          }
        }
      }
    }
  }
  return out;
}

/** Opposed visible poles, repeated square supports, and one current target. */
export function measure(rows: NativeRows): AxialMeasurement | null {
  if (!rows.length || !rows[0]?.length) return null;
  // This imported helper is the exact raster/XY component contract. Reusing it
  // does not depend on completion or admission of the Recolor family.
  const cc = components(rows) as AxialComponent[], bars = barSegments(cc), bodies: AxialBodyMeasurement[] = [];
  for (const a of bars) {
    const [x0, y0, x1, y1] = a.bbox, n = Math.max(x1 - x0, y1 - y0) + 1;
    if (n % 2 !== 1) continue;
    for (const b of bars) {
      if (a.value >= b.value) continue;
      const [u0, v0, u1, v1] = b.bbox, horizontal = y0 === y1;
      let box: AxialBox, axis: AxialPoint;
      if (horizontal) {
        if (v0 !== v1 || x0 !== u0 || x1 !== u1 || Math.abs(v0 - y0) !== n - 1) continue;
        box = [x0, Math.min(y0, v0), x1, Math.max(y1, v1)]; axis = [y0 < v0 ? -1 : 1, 0];
      } else {
        if (u0 !== u1 || y0 !== v0 || y1 !== v1 || Math.abs(u0 - x0) !== n - 1) continue;
        box = [Math.min(x0, u0), y0, Math.max(x1, u1), y1]; axis = [0, x0 < u0 ? -1 : 1];
      }
      const [left, top, right, bottom] = box, cx = Math.floor((left + right) / 2), cy = Math.floor((top + bottom) / 2);
      const inside: number[] = [], sides: number[] = [], poles = new Set([...a.cells, ...b.cells].map(key));
      for (let y = top + 1; y < bottom; y++) for (let x = left + 1; x < right; x++) {
        if (x !== cx || y !== cy) inside.push(rows[y]![x]!);
      }
      for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
        if ((x === left || x === right || y === top || y === bottom) && !poles.has(key([x, y]))) sides.push(rows[y]![x]!);
      }
      if (!inside.length || new Set(inside).size !== 1 || new Set(sides).size !== 1) continue;
      const core = inside[0]!, side = sides[0]!;
      if (core === a.value || core === b.value || side === a.value || side === b.value) continue;
      bodies.push({ bbox: box, center: [cx, cy], axis, poles: [a.value, b.value], core, side,
        marker: rows[cy]![cx]!, size: n, signature: [a.value, b.value, core, side, n] });
    }
  }
  if (bodies.length < 2 || bodies.length > 16 || new Set(bodies.map(b => key(b.center))).size !== bodies.length
    || new Set(bodies.map(b => key(b.signature))).size !== 1) return null;
  const n = bodies[0]!.size, core = bodies[0]!.core;
  const anchors = cc.filter(c => c.value === core && c.bbox[2] - c.bbox[0] + 1 === n - 2
    && c.bbox[3] - c.bbox[1] + 1 === n - 2 && c.cells.length === (n - 2) ** 2);
  const centers: AxialPoint[] = anchors.map(c => [Math.floor((c.bbox[0] + c.bbox[2]) / 2), Math.floor((c.bbox[1] + c.bbox[3]) / 2)]);
  const xs = [...new Set(centers.map(p => p[0]))].sort((a, b) => a - b), ys = [...new Set(centers.map(p => p[1]))].sort((a, b) => a - b);
  if (xs.length < 3 || ys.length < 3 || [xs, ys].some(values => values.slice(1).some((b, i) => (b - values[i]!) % n !== 0))) return null;
  const bounds: AxialBox = [xs[0]!, ys[0]!, xs.at(-1)!, ys.at(-1)!], targets: AxialTarget[] = [];
  for (const c of cc) {
    const [left, top, right, bottom] = c.bbox;
    if (right - left + 1 !== n || bottom - top + 1 !== n || c.cells.length !== 4 * n - 4) continue;
    if (!(bounds[0] <= left && left <= right && right <= bounds[2] + Math.floor(n / 2))
      || !(bounds[1] <= top && top <= bottom && bottom <= bounds[3] + Math.floor(n / 2))) continue;
    const perimeter = new Set<string>();
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
      if (x === left || x === right || y === top || y === bottom) perimeter.add(key([x, y]));
    }
    const cells = new Set(c.cells.map(key));
    if (cells.size !== perimeter.size || [...cells].some(p => !perimeter.has(p))) continue;
    const cx = Math.floor((left + right) / 2), cy = Math.floor((top + bottom) / 2), interior: number[] = [];
    for (let y = top + 1; y < bottom; y++) for (let x = left + 1; x < right; x++) {
      if (x !== cx || y !== cy) interior.push(rows[y]![x]!);
    }
    if (new Set(interior).size === 1 && rows[cy]![cx] === c.value) {
      targets.push({ center: [cx, cy], bbox: c.bbox, ring_value: c.value, inside: interior[0]! });
    }
  }
  if (targets.length !== 1) return null;
  const markers = bodies.filter(b => b.marker !== b.core);
  return { bodies, target: targets[0]!, quantum: n, grid_bounds: bounds, anchors: centers,
    selected: markers.length === 1 ? markers[0]! : null, ambiguous_selection: markers.length > 1, signature: bodies[0]!.signature };
}

export class AxialPrerequisite extends Error {
  constructor(cause: string) { super(cause); this.name = 'AxialPrerequisite'; }
}

/** Only the V5 pivot branch consumed by projected_turns is transferred here.
 * _state validates unique current bodies, poles, traversable positions and axes;
 * _direct rotates the selected body in the supplied cycle, without relaxation.
 */
export function projectedTurns(m: AxialMeasurement, body: AxialBodyMeasurement,
  cycle: readonly (readonly number[])[]): AxialProjection[] {
  const refs = new Map(m.bodies.map(b => [key(b.center), 'axial:' + digest(b.center)]));
  const bs = m.bodies.map(b => ({ body_ref: refs.get(key(b.center))!, cell: [b.center[1], b.center[0]],
    positive_axis: b.axis, positive_pole_ref: 'visible:' + b.poles[0], negative_pole_ref: 'visible:' + b.poles[1] }));
  // These are the only model/state fields consumed by V5 _state and _direct.
  const floor = new Set(bs.map(b => key(b.cell))), active = refs.get(key(body.center));
  if (!active) throw new AxialPrerequisite('SELECTED_IDENTITY_NOT_CURRENT_OCCUPANT');
  const cardinal = new Set(['-1,0', '1,0', '0,-1', '0,1']);
  const budget = new RecolorWorkBudget({ node_bound: 1_000, time_bound_ms: 1_000, domain_bound: 1_000 });
  const out: AxialProjection[] = [];
  for (const turn of [-1, 1] as const) {
    if (floor.size !== bs.length) throw new AxialPrerequisite('UNIQUE_DISJOINT_TRAVERSAL_AND_WALL_DOMAINS_REQUIRED');
    const bodies = new Map<string, (typeof bs)[number]>(), occupants = new Set<string>();
    for (const item of bs) {
      budget.visit({ body_ref: item.body_ref });
      if (bodies.has(item.body_ref) || occupants.has(key(item.cell)) || !floor.has(key(item.cell)) || !cardinal.has(key(item.positive_axis))) {
        throw new AxialPrerequisite('CURRENT_FULL_BODY_IDENTITY_POSITION_OR_AXIS_NOT_VALID');
      }
      if (!item.positive_pole_ref || !item.negative_pole_ref || item.positive_pole_ref === item.negative_pole_ref) {
        throw new AxialPrerequisite('DISTINCT_SUPPLIED_OPPOSITE_POLE_LABELS_REQUIRED');
      }
      bodies.set(item.body_ref, item); occupants.add(key(item.cell));
    }
    if (!bodies.has(active)) throw new AxialPrerequisite('SELECTED_IDENTITY_NOT_CURRENT_OCCUPANT');
    if (!cycle.length || new Set(cycle.map(key)).size !== cycle.length || cycle.some(axis => !cardinal.has(key(axis)))) {
      throw new AxialPrerequisite('SUPPORTED_ORIENTATION_CYCLE_MISSING');
    }
    const selected = bodies.get(active)!, current = cycle.findIndex(axis => equal(axis, selected.positive_axis));
    if (current < 0) throw new AxialPrerequisite('CURRENT_ORIENTATION_NOT_IN_PIVOT_DOMAIN');
    out.push({ turn, axis: [...cycle[modulo(current + turn, cycle.length)]!], scope: 'conditional_orientation_only_no_translation_model' });
  }
  return out;
}

/** Qualitative same-row/column and transverse dependencies in source order. */
export function relations(m: AxialMeasurement, actor: AxialBodyMeasurement): AxialRelation[] {
  const result: AxialRelation[] = [], [ax, ay] = actor.center, [tx, ty] = m.target.center;
  for (const peer of m.bodies) {
    if (peer === actor || equal(peer.center, actor.center)) continue;
    const [bx, by] = peer.center, row = ay === by, col = ax === bx;
    if (!row && !col) continue;
    const direction: AxialPoint = row ? [0, 1] : [1, 0];
    if (!equal(peer.axis, direction) && !equal(peer.axis, direction.map(v => -v))) continue;
    const [a, b, t] = row ? [ax, bx, tx] : [ay, by, ty], aligned = row ? ty === ay : tx === ax;
    const between = Math.min(a!, b!) < t! && t! < Math.max(a!, b!);
    const dependency = m.bodies.filter(p => !equal(p.center, actor.center) && !equal(p.center, peer.center)
      && (row ? p.center[0] === tx && Math.min(p.center[1], ay) < ty && ty < Math.max(p.center[1], ay)
        : p.center[1] === ty && Math.min(p.center[0], ax) < tx && tx < Math.max(p.center[0], ax)));
    let kind: AxialRelation['kind'];
    if (aligned) kind = between ? 'between' : 'outside';
    else if (between && dependency.length) kind = 'transverse_dependency';
    else continue;
    result.push({ kind, peer, dependency: dependency.map(p => p.center), target: m.target.center,
      scope: 'qualitative_interaction_hypothesis_no_endpoint_prediction' });
  }
  return result;
}

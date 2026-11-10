/** Public relative-layout measurements from pinned V6 relative_arrangements/geometry.py. */
import { symbolicDigest as identity } from './v6-hash.ts';
import type { NativeBox, NativeCommand, NativeObservation, NativeRecord, NativeRows } from './v6-native-types.ts';

export type RelativeArrangementPoint = [number, number];
export type RelativeArrangementTriple = [number, number, number];
export interface RelativeArrangementCellValue {
  value: number; marker: number | null; point: RelativeArrangementPoint;
}
export interface RelativeArrangementCell extends RelativeArrangementCellValue { xy: RelativeArrangementPoint }
export interface RelativeArrangementFeature { xy: RelativeArrangementPoint; value: number }
export interface RelativeArrangementPad {
  ref: string; shape: RelativeArrangementPoint; origin: RelativeArrangementPoint; pitch: number;
  cells: RelativeArrangementCell[]; selected: RelativeArrangementCell | null;
}
export interface RelativeArrangementLayout {
  board: NativeBox; size: number; shape: RelativeArrangementPoint; terrain: number[];
  objects: RelativeArrangementCell[]; legend: { box: NativeBox; features: RelativeArrangementFeature[] };
  selected: RelativeArrangementCell | null; pads: RelativeArrangementPad[];
  observation_ref: string; level_epoch: number; frame_hash: string; scope_ref: string;
}
export interface RelativeArrangementTarget {
  target: RelativeArrangementTriple[]; already_preserved: RelativeArrangementTriple[];
  remove: RelativeArrangementTriple[]; add: RelativeArrangementTriple[];
  relation: 'same_typed_relative_displacements_as_visible_model'; terminal_role: 'hypothesis_until_observed_boundary';
}
export interface RelativeArrangementControl {
  pad_ref: string; from: RelativeArrangementPoint; to: RelativeArrangementPoint; marker_value: number;
}
export interface RelativeArrangementModel extends NativeRecord {
  status: 'single_object_and_actuator_displacement'; object_value: number;
  from: RelativeArrangementPoint; to: RelativeArrangementPoint; delta: RelativeArrangementPoint;
  control: RelativeArrangementControl; action: NativeCommand; preserved_objects: RelativeArrangementTriple[];
  evidence: string[]; selection_ref?: string | null;
  scope: 'current_selected_object_and_current_actuator_only'; unresolved: string[];
}

const samePoint = (a: readonly number[], b: readonly number[]): boolean => a.length === b.length && a.every((v, i) => v === b[i]);
const pointKey = (x: number, y: number): string => `${x},${y}`;
const tripleKey = (point: RelativeArrangementTriple): string => JSON.stringify(point);
const lexical = (a: readonly number[], b: readonly number[]): number => {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
  return a.length - b.length;
};
const countValues = (values: Iterable<number>): Map<number, number> => {
  const result = new Map<number, number>();
  for (const value of values) result.set(value, (result.get(value) ?? 0) + 1);
  return result;
};
/** Counter.most_common(1) keeps the first encountered value when counts tie. */
function firstMode(counts: ReadonlyMap<number, number>): [number, number] | null {
  let result: [number, number] | null = null;
  for (const [value, count] of counts) if (result === null || count > result[1]) result = [value, count];
  return result;
}
function pixel(rows: NativeRows, x: number, y: number): number {
  // Source list indexing admits negative indices and rejects missing pixels.
  if (!Number.isInteger(x) || !Number.isInteger(y)) throw new TypeError('Arrangement pixel indices must be integers');
  const value = rows.at(y)?.at(x);
  if (value === undefined) throw new RangeError('Arrangement pixel is outside the observed raster');
  return value;
}
function objectSet(objects: readonly RelativeArrangementCell[]): Map<string, RelativeArrangementTriple> {
  const result = new Map<string, RelativeArrangementTriple>();
  for (const obj of objects) {
    const point: RelativeArrangementTriple = [obj.xy[0], obj.xy[1], obj.value];
    result.set(tripleKey(point), point);
  }
  return result;
}

export function relativeArrangementRectangles(obs: NativeObservation): NativeBox[] {
  const out: NativeBox[] = [];
  for (const entity of obs.entities) {
    const [l, t, r, b] = entity.bbox, w = r - l + 1, h = b - t + 1;
    if (Math.min(w, h) < 3 || entity.area !== 2 * w + 2 * h - 4) continue;
    const edge = new Set<string>();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (x === 0 || x === w - 1 || y === 0 || y === h - 1) edge.add(pointKey(x, y));
    }
    const mask = new Set(entity.mask.map(([x, y]) => pointKey(x, y)));
    if (mask.size === edge.size && [...mask].every(point => edge.has(point))) out.push(entity.bbox);
  }
  return out;
}

export function relativeArrangementCell(rows: NativeRows, x: number, y: number, size: number): RelativeArrangementCellValue | null {
  const values: number[] = [];
  for (let j = y; j < y + size; j++) for (let i = x; i < x + size; i++) values.push(pixel(rows, i, j));
  const mode = firstMode(countValues(values));
  if (!mode) throw new RangeError('An arrangement cell must contain measured pixels');
  const value = mode[0], center: RelativeArrangementPoint = [x + Math.floor(size / 2), y + Math.floor(size / 2)];
  const exceptions: RelativeArrangementPoint[] = [];
  for (let j = y; j < y + size; j++) for (let i = x; i < x + size; i++) if (pixel(rows, i, j) !== value) exceptions.push([i, j]);
  if (exceptions.length && (exceptions.length !== 1 || !samePoint(exceptions[0]!, center))) return null;
  return { value, marker: exceptions.length ? pixel(rows, center[0], center[1]) : null, point: center };
}

export function relativeArrangementPads(obs: NativeObservation, rows: NativeRows, board: NativeBox, size: number): RelativeArrangementPad[] {
  const [l, t, r, b] = board, tiles = new Map<string, { pos: RelativeArrangementPoint; cell: RelativeArrangementCellValue }>();
  for (const entity of obs.entities) {
    const [x, y, xx, yy] = entity.bbox;
    if (xx - x + 1 !== size || yy - y + 1 !== size || (l <= x && x <= r && t <= y && y <= b)) continue;
    const cell = relativeArrangementCell(rows, x, y, size);
    if (cell) tiles.set(pointKey(x, y), { pos: [x, y], cell });
  }
  const distances = new Set<number>();
  for (const { pos: a } of tiles.values()) for (const { pos: b } of tiles.values()) {
    if (a[1] === b[1] && Math.abs(a[0] - b[0]) > size) distances.add(Math.abs(a[0] - b[0]));
    if (a[0] === b[0] && Math.abs(a[1] - b[1]) > size) distances.add(Math.abs(a[1] - b[1]));
  }
  if (!distances.size) return [];
  const pitch = [...distances].sort((a, b) => a - b)[0]!, pending = new Set(tiles.keys()), groups: RelativeArrangementPad[] = [];
  while (pending.size) {
    const first = [...pending].map(key => tiles.get(key)!.pos).sort(lexical)[0]!;
    pending.delete(pointKey(...first));
    const todo = [first], group: RelativeArrangementPoint[] = [];
    while (todo.length) {
      const pos = todo.pop()!; group.push(pos);
      // Source removes at push and pops a stack; this order is also the cell order.
      for (const [dx, dy] of [[pitch, 0], [-pitch, 0], [0, pitch], [0, -pitch]] as RelativeArrangementPoint[]) {
        const next: RelativeArrangementPoint = [pos[0] + dx, pos[1] + dy], key = pointKey(...next);
        if (pending.has(key)) { pending.delete(key); todo.push(next); }
      }
    }
    const xs = [...new Set(group.map(p => p[0]))].sort((a, b) => a - b), ys = [...new Set(group.map(p => p[1]))].sort((a, b) => a - b);
    if (Math.min(xs.length, ys.length) < 2 || group.length !== xs.length * ys.length) continue;
    const cells = group.map(([x, y]): RelativeArrangementCell => ({ xy: [xs.indexOf(x), ys.indexOf(y)], ...tiles.get(pointKey(x, y))!.cell }));
    const markers = cells.filter(cell => cell.marker !== null);
    if (markers.length > 1) continue;
    groups.push({ ref: identity([xs, ys, size]), shape: [xs.length, ys.length], origin: [xs[0]!, ys[0]!], pitch, cells,
      selected: markers[0] ?? null });
  }
  return groups.sort((a, b) => lexical(a.origin, b.origin));
}

export function relativeArrangementProject(obs: NativeObservation, rows: NativeRows): RelativeArrangementLayout | null {
  const frames = relativeArrangementRectangles(obs), candidates: RelativeArrangementLayout[] = [];
  for (const board of frames) {
    const [l, t, r, b] = board, innerw = r - l - 1, innerh = b - t - 1;
    const sizes = countValues(obs.entities.filter(entity => {
      const [x, y, xx, yy] = entity.bbox;
      return x > l && y > t && xx < r && yy < b && xx - x === yy - y && entity.area === (xx - x + 1) ** 2;
    }).map(entity => entity.bbox[2] - entity.bbox[0] + 1));
    const mode = firstMode(sizes);
    if (mode === null) continue;
    const [size, count] = mode;
    if (size < 2 || innerw % size || innerh % size || Math.min(Math.floor(innerw / size), Math.floor(innerh / size)) < 3 || count < 6) continue;
    const width = Math.floor(innerw / size), height = Math.floor(innerh / size), cells: RelativeArrangementCell[] = [];
    let valid = true;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const value = relativeArrangementCell(rows, l + 1 + x * size, t + 1 + y * size, size);
      if (value === null) { valid = false; break; }
      cells.push({ xy: [x, y], ...value });
    }
    if (!valid) continue;
    const phase = [0, 1].map(p => firstMode(countValues(cells.filter(c => (c.xy[0] + c.xy[1]) % 2 === p).map(c => c.value)))!);
    if (phase[0]![0] === phase[1]![0] || phase.reduce((sum, [, n]) => sum + n, 0) * 2 <= cells.length) continue;
    const terrain = new Set(phase.map(([value]) => value));
    for (const box of frames) {
      if (samePoint(box, board)) continue;
      const [a, bb, cc, d] = box;
      if (!(cc < l || a > r || d < t || bb > b)) continue;
      const features: RelativeArrangementFeature[] = [];
      for (let y = bb + 1; y < d; y++) for (let x = a + 1; x < cc; x++) {
        const value = pixel(rows, x, y);
        if (!terrain.has(value)) features.push({ xy: [x - a - 1, y - bb - 1], value });
      }
      if (features.length < 2) continue;
      const values = new Set(features.map(feature => feature.value)), objects = cells.filter(cell => values.has(cell.value));
      const objectCounts = countValues(objects.map(obj => obj.value)), featureCounts = countValues(features.map(feature => feature.value));
      if (objectCounts.size !== featureCounts.size || [...objectCounts].some(([value, count]) => featureCounts.get(value) !== count)) continue;
      const selected = objects.filter(obj => obj.marker !== null), controls = relativeArrangementPads(obs, rows, board, size);
      if (selected.length > 1 || !controls.length) continue;
      candidates.push({ board, size, shape: [width, height], terrain: [...terrain].sort((a, b) => a - b), objects,
        legend: { box, features }, selected: selected[0] ?? null, pads: controls,
        observation_ref: obs.observation_ref, level_epoch: obs.level_epoch, frame_hash: obs.frame_hash,
        scope_ref: identity([obs.level_epoch, board, size, box, features]) });
    }
  }
  return candidates.length === 1 ? candidates[0]! : null;
}

export function translatedRelativeArrangementTargets(layout: RelativeArrangementLayout): RelativeArrangementTarget[] {
  const features = layout.legend.features, objects = layout.objects, [w, h] = layout.shape, seen = new Set<string>();
  const out: RelativeArrangementTarget[] = [];
  for (const obj of objects) for (const feature of features) {
    if (obj.value !== feature.value) continue;
    const dx = obj.xy[0] - feature.xy[0], dy = obj.xy[1] - feature.xy[1];
    const target = features.map((part): RelativeArrangementTriple => [part.xy[0] + dx, part.xy[1] + dy, part.value]).sort(lexical);
    const key = JSON.stringify(target);
    if (target.some(([x, y]) => !(0 <= x && x < w && 0 <= y && y < h)) || seen.has(key)) continue;
    seen.add(key);
    const current = objectSet(objects), wanted = new Map(target.map(point => [tripleKey(point), point]));
    out.push({ target, already_preserved: [...current].filter(([key]) => wanted.has(key)).map(([, point]) => point).sort(lexical),
      remove: [...current].filter(([key]) => !wanted.has(key)).map(([, point]) => point).sort(lexical),
      add: [...wanted].filter(([key]) => !current.has(key)).map(([, point]) => point).sort(lexical),
      relation: 'same_typed_relative_displacements_as_visible_model', terminal_role: 'hypothesis_until_observed_boundary' });
  }
  return out;
}

export function relativeArrangementEffect(before: RelativeArrangementLayout | null, after: RelativeArrangementLayout | null,
  command: NativeCommand): NativeRecord {
  if (!before || !after || before.scope_ref !== after.scope_ref) return { status: 'scope_unbound' };
  const bs = before.selected, as = after.selected, evidence = [before.observation_ref, after.observation_ref];
  if (!bs && as) return { status: 'selection_observed', object: as, evidence };
  const old = objectSet(before.objects), next = objectSet(after.objects);
  const removed = [...old].filter(([key]) => !next.has(key)).map(([, point]) => point);
  const added = [...next].filter(([key]) => !old.has(key)).map(([, point]) => point);
  if (!removed.length && !added.length) {
    if (as && (!bs || !samePoint(as.xy, bs.xy))) return { status: 'selection_observed', object: as, evidence };
    return { status: 'no_arrangement_change' };
  }
  if (removed.length !== 1 || added.length !== 1) return { status: 'ambiguous_multi_object_change' };
  const source = removed[0]!, target = added[0]!;
  if (source[2] !== target[2] || !bs || !as || !samePoint(bs.xy, source.slice(0, 2)) || !samePoint(as.xy, target.slice(0, 2))) return { status: 'selected_identity_unbound' };
  const changes: RelativeArrangementControl[] = [];
  for (const oldpad of before.pads) {
    const newpad = after.pads.find(pad => pad.ref === oldpad.ref);
    if (!newpad || !oldpad.selected || !newpad.selected) continue;
    const aa = oldpad.selected, bb = newpad.selected;
    if (!samePoint(aa.xy, bb.xy)) changes.push({ pad_ref: oldpad.ref, from: aa.xy, to: bb.xy, marker_value: aa.value });
  }
  if (changes.length !== 1) return { status: 'actuator_change_ambiguous' };
  return { status: 'single_object_and_actuator_displacement', object_value: source[2], from: source.slice(0, 2), to: target.slice(0, 2),
    delta: [target[0] - source[0], target[1] - source[1]], control: changes[0]!, action: command,
    preserved_objects: [...old].filter(([key]) => next.has(key)).map(([, point]) => point).sort(lexical), evidence,
    scope: 'current_selected_object_and_current_actuator_only', unresolved: ['gain_after_new_selection', 'opposite_axis', 'edge_wrapping', 'actuator_saturation'] };
}

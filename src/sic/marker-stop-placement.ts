import { constellationFocus, measureConstellationLayout, type ConstellationMaterialRegion } from '../logos-engine/v6-constellation-cover.ts';
import { measureMarkerMaterialRegions } from './marker-material-route.ts';
import { pointKey, type Point } from '../logos-engine/v6-point-set.ts';
import type { NativeBox, NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';

type Segment = readonly [start: number, axis: number, end: number];
type Shape = { kind: 'frame'; box: NativeBox } | { kind: 'cross'; horizontal: Segment; vertical: Segment };
type Piece = { color: number; shape: Shape; markers: Point[]; targetColor?: number };
export type StopScene = { pieces: Piece[]; active: number };
export type StopLayout = { stop: NativeBox; stopColor: number; cursorColor: number; markerPixels: string[];
  width: number; height: number; materials?: readonly ConstellationMaterialRegion[] };
export type StopStep = { action: string; expected: StopScene; effect: string | null };

const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const inside = ([x, y]: Point, [l, t, r, b]: NativeBox) => l <= x && x <= r && t <= y && y <= b;
const edges = ([l, t, r, b]: NativeBox, [x, y]: Point) => (x === l || x === r || y === t || y === b) && inside([x, y], [l, t, r, b]);
const overlaps = (a: NativeBox, b: NativeBox) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
const shiftBox = ([l, t, r, b]: NativeBox, [dx, dy]: Point): NativeBox => [l + dx, t + dy, r + dx, b + dy];
const among = (value: number, first: number, last: number) => first <= value && value <= last;

export function stopShapeBox(shape: Shape): NativeBox {
  if (shape.kind === 'frame') return shape.box;
  return [shape.horizontal[0], shape.vertical[0], shape.horizontal[2], shape.vertical[2]];
}

function areaOf(shape: Shape, [x, y]: Point) {
  return shape.kind === 'frame' ? edges(shape.box, [x, y])
    : y === shape.horizontal[1] && among(x, shape.horizontal[0], shape.horizontal[2])
      || x === shape.vertical[1] && among(y, shape.vertical[0], shape.vertical[2]);
}

function focusOf(shape: Shape): Point {
  const [l, t, r, b] = stopShapeBox(shape);
  return [Math.round((l + r) / 2), Math.round((t + b) / 2)];
}

function framePixels(box: NativeBox) {
  const [l, t, r, b] = box, pixels: Point[] = [];
  for (let x = l; x <= r; x++) pixels.push([x, t], [x, b]);
  for (let y = t + 1; y < b; y++) pixels.push([l, y], [r, y]);
  return pixels;
}

function readShape(pixels: Point[], cursor: Point): Shape | null {
  const xs = pixels.map(([x]) => x), ys = pixels.map(([, y]) => y);
  const box: NativeBox = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  if (pixels.length < 5 || box[0] === box[2] || box[1] === box[3]) return null;
  const frame = { kind: 'frame', box } as const;
  if (pixels.every(point => areaOf(frame, point)) && pixels.length === framePixels(box).length) return frame;
  const [l, t, r, b] = box;
  const horizontal = ys.filter(y => ys.filter(at => at === y).length >= r - l);
  const vertical = xs.filter(x => xs.filter(at => at === x).length >= b - t);
  const y = [...new Set(horizontal)], x = [...new Set(vertical)];
  if (x.length !== 1 || y.length !== 1) return null;
  const cross = { kind: 'cross', horizontal: [l, y[0]!, r], vertical: [t, x[0]!, b] } as const;
  const missingFocus = areaOf(cross, cursor) && !pixels.some(point => equal(point, cursor));
  return pixels.every(point => areaOf(cross, point)) && pixels.length + Number(missingFocus) === r - l + b - t + 1 ? cross : null;
}

export function measureStopScene(observation: NativeObservation, rows: NativeRows, stride: number) {
  const counts = new Map<number, number>();
  for (const row of rows) for (const ink of row) counts.set(ink, (counts.get(ink) ?? 0) + 1);
  const background = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  // A hollow piece can enclose a much larger background component with a hole.
  const model = measureConstellationLayout({ ...observation, entities: observation.entities.filter(e => e.palette_value !== background) }, rows);
  if (!model || model.targets.size < 1 || model.targets.size > 4) return null;
  const cursor = observation.entities.find(e => e.area === 1 && e.palette_value === model.focus_color)?.position as Point | undefined;
  if (!cursor) return null;
  const otherInks = new Set([model.background, model.focus_color, ...model.targets.keys(),
    ...[...model.marker_rows.values()].flatMap(markers => markers.map(marker => marker.ring_value))]);
  const stops = observation.entities.filter(e => !otherInks.has(e.palette_value) && e.bbox[2] - e.bbox[0] >= stride
    && e.bbox[3] - e.bbox[1] >= stride && !e.bbox.includes(0)
    && e.bbox[2] < rows[0]!.length - 1 && e.bbox[3] < rows.length - 1
    && framePixels(e.bbox).every(([x, y]) => rows[y]?.[x] === e.palette_value));
  if (stops.length !== 1) return null;
  const pieces: Piece[] = [];
  let needsChange = false;
  for (const [color, targets] of model.targets) {
    const pixels: Point[] = [];
    rows.forEach((row, y) => row.forEach((ink, x) => {
      if (ink === color && !model.excluded.has([x, y])) pixels.push([x, y]);
    }));
    const shape = readShape(pixels, cursor);
    if (!shape) return null;
    const markers = [...targets];
    const [gx, gy] = markers[0]!;
    needsChange ||= !pixels.some(([x, y]) => (gx - x) % stride === 0 && (gy - y) % stride === 0
      && markers.every(([a, b]) => areaOf(shape, [a + x - gx, b + y - gy])));
    pieces.push({ color, shape, markers });
  }
  const active = pieces.flatMap((piece, i) => equal(focusOf(piece.shape), cursor) ? [i] : []);
  if (!needsChange || active.length !== 1) return null;
  const stop = stops[0]!;
  const layout: StopLayout = { stop: stop.bbox, stopColor: stop.palette_value, cursorColor: model.focus_color,
    markerPixels: [...model.excluded].map(pointKey), width: model.width,
    height: model.height - Number([...model.boundary_overlay].some(([, y]) => y === model.height - 1)) };
  return { layout, scene: { pieces, active: active[0]! } };
}

function fitOccludedStopShape(pixels: readonly Point[], stride: number, hidden: ReadonlySet<string>): Shape | null {
  if (pixels.length < 5) return null;
  const xs = pixels.map(([x]) => x), ys = pixels.map(([, y]) => y);
  const box: NativeBox = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const [l, t, r, b] = box;
  const validFrame = l < r && t < b && (r - l) % stride === 0 && (b - t) % stride === 0;
  if (validFrame && pixels.every(point => edges(box, point))) return { kind: 'frame', box };

  const dominant = (values: readonly number[]) => {
    const counts = new Map<number, number>();
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    const ranked = [...counts].sort((a, b) => b[1] - a[1]);
    return ranked[0] && ranked[0][1] >= 3 && ranked[0][1] > (ranked[1]?.[1] ?? 0) ? ranked[0][0] : null;
  };
  const x = dominant(xs), y = dominant(ys);
  if (x === null || y === null || pixels.some(([u, v]) => u !== x && v !== y)) return null;
  const span = (points: readonly number[], onAxis: (n: number) => Point): [number, number] | null => {
    const low = Math.min(...points), high = Math.max(...points);
    if (points.length < 3 || low >= high) return null;
    const needed = (stride - (high - low) % stride) % stride;
    if (!needed) return [low, high];
    const before = Array.from({ length: needed }, (_, i) => low - i - 1).every(v => hidden.has(pointKey(onAxis(v))));
    const after = Array.from({ length: needed }, (_, i) => high + i + 1).every(v => hidden.has(pointKey(onAxis(v))));
    return before === after ? null : before ? [low - needed, high] : [low, high + needed];
  };
  const horizontal = span(pixels.filter(([, v]) => v === y).map(([u]) => u), u => [u, y]);
  const vertical = span(pixels.filter(([u]) => u === x).map(([, v]) => v), v => [x, v]);
  return horizontal && vertical && among(x, ...horizontal) && among(y, ...vertical)
    ? { kind: 'cross', horizontal: [horizontal[0], y, horizontal[1]], vertical: [vertical[0], x, vertical[1]] } : null;
}

export function measureMaterialStopScene(observation: NativeObservation, rows: NativeRows, stride: number) {
  const materials = measureMarkerMaterialRegions(observation, rows).sort((a, b) => a.box[1] - b.box[1] || a.box[0] - b.box[0]);
  if (materials.length < 2) return null;
  const model = measureConstellationLayout(observation, rows, materials);
  if (!model || model.targets.size < 2 || model.targets.size > 4) return null;
  if ([...model.targets.keys()].some(color => !materials.some(region => region.color === color))) return null;
  const focus = constellationFocus(rows, model);
  if (!focus) return null;
  const ignored = model.excluded.union(model.boundary_overlay);
  const stops = observation.entities.filter(e => e.palette_value !== model.background && e.palette_value !== model.focus_color
    && e.bbox[2] - e.bbox[0] >= stride && e.bbox[3] - e.bbox[1] >= stride && !e.bbox.includes(0)
    && e.bbox[2] < model.width - 1 && e.bbox[3] < model.height - 1
    && framePixels(e.bbox).every(([x, y]) => !ignored.has([x, y]) && rows[y]?.[x] === e.palette_value));
  if (stops.length !== 1) return null;
  const stop = stops[0]!, groups = new Map<number, Point[]>();
  const markerPixels = [...ignored].map(pointKey), hidden = new Set(markerPixels);
  for (let y = 0; y < model.height; y++) for (let x = 0; x < model.width; x++) {
    const color = rows[y]![x]!;
    if (color === model.background || color === model.focus_color || color === stop.palette_value || hidden.has(pointKey([x, y]))) continue;
    const points = groups.get(color) ?? [];
    points.push([x, y]);
    groups.set(color, points);
  }
  if (groups.size !== model.targets.size) return null;
  const pieces: Piece[] = [];
  for (const [color, pixels] of groups) {
    const shape = fitOccludedStopShape(pixels, stride, hidden);
    if (!shape) return null;
    pieces.push({ color, shape, markers: [] });
  }
  const active = pieces.flatMap((piece, index) => equal(focusOf(piece.shape), focus) ? [index] : []);
  if (active.length !== 1) return null;
  const scene: StopScene = { pieces, active: active[0]! };
  const layout: StopLayout = { stop: stop.bbox, stopColor: stop.palette_value, cursorColor: model.focus_color, markerPixels,
    width: model.width, height: model.height, materials };
  if (!stopSceneMatches(rows, layout, scene)) return null;
  const targets = [...model.targets].map(([color, points]) => ({ color, markers: [...points] }));
  return { layout, scene, targets };
}

function shapeCouldCover(shape: Shape, markers: readonly Point[]) {
  const span = (values: readonly number[]) => Math.max(...values) - Math.min(...values);
  const xs = markers.map(([x]) => x), ys = markers.map(([, y]) => y);
  if (shape.kind === 'frame') {
    const [l, t, r, b] = shape.box;
    return span(xs) + span(ys) <= r - l + b - t;
  }
  if (span(xs) === 0) return span(ys) <= shape.vertical[2] - shape.vertical[0];
  if (span(ys) === 0) return span(xs) <= shape.horizontal[2] - shape.horizontal[0];
  return [...new Set(xs)].some(x => [...new Set(ys)].some(y =>
    markers.every(([u, v]) => u === x || v === y)
    && span(markers.filter(([, v]) => v === y).map(([u]) => u).concat(x)) <= shape.horizontal[2] - shape.horizontal[0]
    && span(markers.filter(([u]) => u === x).map(([, v]) => v).concat(y)) <= shape.vertical[2] - shape.vertical[0]));
}

type StopTarget = { color: number; markers: Point[] };
export function assignStopTargets(layout: StopLayout, scene: StopScene, targets: readonly StopTarget[],
  vectors: readonly [string, Point][]) {
  const choices = scene.pieces.map(piece => targets.filter(target => shapeCouldCover(piece.shape, target.markers)));
  const paths = new Map<string, StopStep[] | null>();
  const assignments: StopTarget[][] = [];
  const assign = (selected: StopTarget[]): void => {
    if (selected.length === scene.pieces.length) {
      assignments.push(selected);
      return;
    }
    for (const target of choices[selected.length]!) if (!selected.includes(target)) assign([...selected, target]);
  };
  assign([]);
  let result: { targets: StopTarget[]; paths: StopStep[][]; cost: number } | null = null;
  for (const selected of assignments) {
    const assigned = scene.pieces.map((piece, index) => ({ ...piece,
      targetColor: selected[index]!.color, markers: selected[index]!.markers }));
    const routes: StopStep[][] = [];
    let cost = 0;
    for (const [active, target] of selected.entries()) {
      const key = active + ':' + target.color;
      if (!paths.has(key)) paths.set(key, planStopPlacement(layout, { pieces: assigned, active }, vectors, []));
      const path = paths.get(key);
      if (!path) break;
      routes.push(path);
      cost += path.length;
    }
    if (routes.length === assigned.length && (!result || cost < result.cost)) {
      result = { targets: selected, paths: routes, cost };
    }
  }
  if (!result) return null;
  const pieces = scene.pieces.map((piece, index) => ({ ...piece, targetColor: result.targets[index]!.color,
    markers: result.targets[index]!.markers }));
  const route = result.paths[scene.active]!.map(step => ({ ...step,
    expected: { ...scene, pieces: pieces.map((piece, index) => index === scene.active
      ? { ...piece, color: step.expected.pieces[index]!.color, shape: step.expected.pieces[index]!.shape } : piece) } }));
  return { scene: { ...scene, pieces }, route };
}

export function stopSceneMatches(rows: NativeRows, layout: StopLayout, scene: StopScene) {
  const colors = new Set(scene.pieces.map(piece => piece.color)), cursor = focusOf(scene.pieces[scene.active]!.shape);
  const focusInk = rows[cursor[1]]?.[cursor[0]];
  const covered = scene.pieces.some((piece, i) => i !== scene.active && piece.color === focusInk && areaOf(piece.shape, cursor));
  if (focusInk !== layout.cursorColor && !covered) return false;
  if (!framePixels(layout.stop).every(([x, y]) => rows[y]?.[x] === layout.stopColor)) return false;
  const ignored = new Set(layout.markerPixels);
  ignored.add(pointKey(cursor));
  for (let y = 0; y < layout.height; y++) for (let x = 0; x < layout.width; x++) {
    const ink = rows[y]?.[x];
    if (ignored.has(pointKey([x, y]))) continue;
    const expected = scene.pieces.filter(piece => areaOf(piece.shape, [x, y]));
    if (expected.length ? expected.every(piece => piece.color !== ink)
      : colors.has(ink!) || ink === layout.cursorColor) return false;
  }
  return true;
}

const inPlay = ([l, t, r, b]: NativeBox, layout: StopLayout) => l >= 0 && t >= 0 && r < layout.width && b < layout.height;
export const coversStopMarkers = (piece: Piece) => (piece.targetColor === undefined || piece.color === piece.targetColor)
  && piece.markers.every(point => areaOf(piece.shape, point));

function moveShape(shape: Shape, vector: Point, layout: StopLayout): Shape {
  const [dx, dy] = vector, stride = Math.abs(dx) + Math.abs(dy);
  if (shape.kind === 'cross') {
    const [l, y, r] = shape.horizontal, [t, x, b] = shape.vertical;
    const nextH = shiftBox([l, y, r, y], vector), nextV = shiftBox([x, t, x, b], vector);
    if (!layout.materials && (!inPlay(nextH, layout) || !inPlay(nextV, layout))) return shape;
    const centerInPlay = ([a, b, c, d]: NativeBox) => a + c >= 0 && a + c < 2 * layout.width && b + d >= 0 && b + d < 2 * layout.height;
    const horizontal = (!layout.materials || centerInPlay(nextH)) && !overlaps(nextH, layout.stop)
      ? [l + dx, y + dy, r + dx] as const : shape.horizontal;
    const vertical = (!layout.materials || centerInPlay(nextV)) && !overlaps(nextV, layout.stop)
      ? [t + dy, x + dx, b + dy] as const : shape.vertical;
    return among(vertical[1], horizontal[0], horizontal[2]) && among(horizontal[1], vertical[0], vertical[2])
      ? { kind: 'cross', horizontal, vertical } : shape;
  }
  const shifted = shiftBox(shape.box, vector);
  if (!inPlay(shifted, layout)) return shape;
  if (!overlaps(shifted, layout.stop)) return { kind: 'frame', box: shifted };
  const [l, t, r, b] = shape.box;
  const expand = (start: number, end: number) => {
    const span = (end - start) / stride, anchor = start + Math.ceil(span / 2) * stride;
    const low = anchor - Math.ceil((span + 1) / 2) * stride;
    return [low, low + (span + 1) * stride] as const;
  };
  const [a, z] = dx ? expand(t, b) : expand(l, r);
  const box: NativeBox = dx ? [l + Math.max(dx, 0), a, r + Math.min(dx, 0), z]
    : [a, t + Math.max(dy, 0), z, b + Math.min(dy, 0)];
  return box[2] - box[0] >= stride && box[3] - box[1] >= stride && inPlay(box, layout) && !overlaps(box, layout.stop)
    ? { kind: 'frame', box } : shape;
}

function touchesMaterial(shape: Shape, box: NativeBox) {
  if (shape.kind === 'cross') {
    const [l, y, r] = shape.horizontal, [t, x, b] = shape.vertical;
    return overlaps([l, y, r, y], box) || overlaps([x, t, x, b], box);
  }
  const [l, t, r, b] = shape.box;
  return overlaps([l, t, r, t], box) || overlaps([l, b, r, b], box)
    || overlaps([l, t, l, b], box) || overlaps([r, t, r, b], box);
}

const shapeKey = (shape: Shape) => shape.kind === 'frame' ? shape.box.join(',') : [...shape.horizontal, ...shape.vertical].join(',');
const stopMoveKey = (active: number, shape: Shape, action: string, color?: number) =>
  [active, shapeKey(shape), action, ...(color === undefined ? [] : [color])].join(':');
export const stopEdgeKey = (scene: StopScene, action: string) => {
  const piece = scene.pieces[scene.active]!;
  return stopMoveKey(scene.active, piece.shape, action, piece.targetColor === undefined ? undefined : piece.color);
};
function shapeEffect(before: Shape, after: Shape, vector: Point) {
  if (equal(shiftBox(stopShapeBox(before), vector), stopShapeBox(after))
    && (before.kind !== 'cross' || after.kind === 'cross' && before.horizontal[1] + vector[1] === after.horizontal[1]
      && before.vertical[1] + vector[0] === after.vertical[1])) return null;
  return before.kind + ':' + (vector[0] ? 'horizontal' : 'vertical');
}

export function planStopPlacement(layout: StopLayout, scene: StopScene, vectors: readonly [string, Point][],
  rejected: readonly string[]): StopStep[] | null {
  const piece = scene.pieces[scene.active]!, denied = new Set(rejected);
  const queue: { shape: Shape; color: number; previous: number; action: string; vector: Point }[] = [
    { shape: piece.shape, color: piece.color, previous: -1, action: '', vector: [0, 0] },
  ];
  const keyOf = (shape: Shape, color: number) => layout.materials ? color + ':' + shapeKey(shape) : shapeKey(shape);
  const seen = new Set([keyOf(piece.shape, piece.color)]);
  const limit = layout.materials ? 90_000 : 60_000;
  for (let i = 0; i < queue.length && i < limit; i++) {
    const current = queue[i]!;
    if (coversStopMarkers({ ...piece, shape: current.shape, color: current.color })) {
      const route: StopStep[] = [];
      for (let node = current; node.previous >= 0; node = queue[node.previous]!) {
        const pieces = scene.pieces.map((other, index) => index === scene.active ? { ...piece, shape: node.shape, color: node.color } : other);
        const former = queue[node.previous]!;
        const effect = node.color === former.color ? shapeEffect(former.shape, node.shape, node.vector) : 'material:' + node.color;
        route.push({ action: node.action, expected: { ...scene, pieces }, effect });
      }
      return route.reverse();
    }
    for (const [action, vector] of vectors) {
      if (denied.has(stopMoveKey(scene.active, current.shape, action, piece.targetColor === undefined ? undefined : current.color))) continue;
      const shape = moveShape(current.shape, vector, layout);
      let color = current.color;
      for (const region of layout.materials ?? []) {
        if (region.color !== current.color && touchesMaterial(shape, region.box)) color = region.color;
      }
      const key = keyOf(shape, color);
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ shape, color, previous: i, action, vector });
    }
  }
  return null;
}

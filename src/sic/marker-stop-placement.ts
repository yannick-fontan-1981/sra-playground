import { measureConstellationLayout } from '../logos-engine/v6-constellation-cover.ts';
import { pointKey, type Point } from '../logos-engine/v6-point-set.ts';
import type { NativeBox, NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';

type Segment = readonly [start: number, axis: number, end: number];
type Shape = { kind: 'frame'; box: NativeBox } | { kind: 'cross'; horizontal: Segment; vertical: Segment };
type Piece = { color: number; shape: Shape; markers: Point[] };
export type StopScene = { pieces: Piece[]; active: number };
export type StopLayout = { stop: NativeBox; stopColor: number; cursorColor: number; markerPixels: string[];
  width: number; height: number };
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
export const coversStopMarkers = (piece: Piece) => piece.markers.every(point => areaOf(piece.shape, point));

function moveShape(shape: Shape, vector: Point, layout: StopLayout): Shape {
  const [dx, dy] = vector, stride = Math.abs(dx) + Math.abs(dy);
  if (shape.kind === 'cross') {
    const [l, y, r] = shape.horizontal, [t, x, b] = shape.vertical;
    const nextH = shiftBox([l, y, r, y], vector), nextV = shiftBox([x, t, x, b], vector);
    if (!inPlay(nextH, layout) || !inPlay(nextV, layout)) return shape;
    const horizontal = !overlaps(nextH, layout.stop) ? [l + dx, y + dy, r + dx] as const : shape.horizontal;
    const vertical = !overlaps(nextV, layout.stop) ? [t + dy, x + dx, b + dy] as const : shape.vertical;
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

const shapeKey = (shape: Shape) => shape.kind === 'frame' ? shape.box.join(',') : [...shape.horizontal, ...shape.vertical].join(',');
export const stopEdgeKey = (scene: StopScene, action: string) => [scene.active, shapeKey(scene.pieces[scene.active]!.shape), action].join(':');
function shapeEffect(before: Shape, after: Shape, vector: Point) {
  if (equal(shiftBox(stopShapeBox(before), vector), stopShapeBox(after))
    && (before.kind !== 'cross' || after.kind === 'cross' && before.horizontal[1] + vector[1] === after.horizontal[1]
      && before.vertical[1] + vector[0] === after.vertical[1])) return null;
  return before.kind + ':' + (vector[0] ? 'horizontal' : 'vertical');
}

export function planStopPlacement(layout: StopLayout, scene: StopScene, vectors: readonly [string, Point][],
  rejected: readonly string[]): StopStep[] | null {
  const piece = scene.pieces[scene.active]!, denied = new Set(rejected);
  const queue: { shape: Shape; previous: number; action: string; vector: Point }[] = [
    { shape: piece.shape, previous: -1, action: '', vector: [0, 0] },
  ];
  const seen = new Set([shapeKey(piece.shape)]);
  for (let i = 0; i < queue.length && i < 60_000; i++) {
    const current = queue[i]!;
    if (coversStopMarkers({ ...piece, shape: current.shape })) {
      const route: StopStep[] = [];
      for (let node = current; node.previous >= 0; node = queue[node.previous]!) {
        const pieces = scene.pieces.map((other, index) => index === scene.active ? { ...piece, shape: node.shape } : other);
        const effect = shapeEffect(queue[node.previous]!.shape, node.shape, node.vector);
        route.push({ action: node.action, expected: { ...scene, pieces }, effect });
      }
      return route.reverse();
    }
    for (const [action, vector] of vectors) {
      if (denied.has([scene.active, shapeKey(current.shape), action].join(':'))) continue;
      const shape = moveShape(current.shape, vector, layout), key = shapeKey(shape);
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ shape, previous: i, action, vector });
    }
  }
  return null;
}

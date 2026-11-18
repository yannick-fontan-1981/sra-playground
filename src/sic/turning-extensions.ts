import type { NativeBox, NativeEntity, NativeExecution, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import { extensionButtonMask, targetPatterns, type ExtensionWitness } from './extension-clearance.ts';

type Part = Pick<NativeEntity, 'palette_value' | 'bbox' | 'area' | 'rectangular'>;
type Button = { box: NativeBox; at: NativePoint };
type Segment = { ink: number; pivot: NativePoint; direction: NativePoint; length: number;
  buttons: Record<ExtensionOperation, Button> };
export type TurningLayout = {
  segments: Segment[]; quantum: number; width: number; field: NativeBox; obstacles: string[];
  floor: number; capInk: number; markerInk: number; marker: NativePoint; target: NativePoint; marks: NativePoint[];
};
export type ExtensionOperation = 'extend' | 'retract' | 'turn';
export type TurnSign = 1 | -1;
export type TurningPose = { added: number; turns: number }[];
export type TurningMove = { body: number; operation: ExtensionOperation };
type Position = { box: NativeBox; cap: NativeBox; pivot: NativePoint; turns: number };
type Projection = { parts: Position[]; marker: NativePoint };

const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const center = ([l, t, r, b]: NativeBox): NativePoint => [(l + r) / 2, (t + b) / 2];
const contains = (a: NativeBox, b: NativeBox) => a[0] <= b[0] && a[1] <= b[1] && a[2] >= b[2] && a[3] >= b[3];
const overlap = (a: NativeBox, b: NativeBox) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
const dot = ([x, y]: NativePoint): NativeBox => [x, y, x, y];
const equal = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
const add = ([x, y]: NativePoint, [u, v]: NativePoint, s = 1): NativePoint => [x + s * u, y + s * v];
const quarterTurn = ([x, y]: NativePoint, turns: number): NativePoint => {
  switch (turns & 3) {
    case 1: return [y, -x];
    case 2: return [-x, -y];
    case 3: return [-y, x];
    default: return [x, y];
  }
};
const bound = (a: NativePoint, b: NativePoint): NativeBox =>
  [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
const joined = (a: NativeBox, b: NativeBox): NativeBox =>
  [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
const distance = (a: NativePoint, b: NativePoint) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
const poseKey = (pose: TurningPose) => pose.map(({ added, turns }) => added + ':' + turns).join(',');
export const turningEdge = (pose: TurningPose, { body, operation }: TurningMove) => poseKey(pose) + '/' + body + '/' + operation;

export function readTurningLayout(rows: NativeRows, parts: readonly Part[], witness: ExtensionWitness): TurningLayout | null {
  const { quantum } = witness, pixels = rows[0]!.length;
  if (quantum < 3 || quantum > 7 || !(quantum % 2) || pixels > 96 || rows.length > 96) return null;
  const buttons = parts.filter(part => part.area >= 4 && width(part.bbox) === quantum && height(part.bbox) === quantum)
    .map(part => ({ part, mask: extensionButtonMask(rows, part.bbox, part.palette_value) }));
  const lengths = buttons.filter(button => button.mask === witness.extend || button.mask === witness.retract);
  const inks = [...new Set(lengths.map(button => button.part.palette_value))];
  if (inks.length < 2 || inks.length > 5 || lengths.length !== inks.length * 2) return null;
  const controls = inks.flatMap(ink => {
    const extend = lengths.find(button => button.part.palette_value === ink && button.mask === witness.extend)?.part;
    const retract = lengths.find(button => button.part.palette_value === ink && button.mask === witness.retract)?.part;
    if (!extend || !retract || extend.bbox[1] !== retract.bbox[1]) return [];
    const [x1, y] = center(extend.bbox), [x2] = center(retract.bbox);
    const turn = buttons.filter(({ part, mask }) => part.palette_value === ink && mask !== witness.extend && mask !== witness.retract
      && center(part.bbox)[0] === (x1 + x2) / 2 && center(part.bbox)[1] < y);
    if (turn.length !== 1) return [];
    const framed = parts.filter(part => !part.rectangular && contains(part.bbox, turn[0]!.part.bbox)
      && part.bbox[3] < extend.bbox[1] && width(part.bbox) >= quantum + 2 && width(part.bbox) <= quantum * 3
      && height(part.bbox) >= quantum + 2 && height(part.bbox) <= quantum * 3);
    const outline = framed.filter(part => !framed.some(other => other !== part && contains(other.bbox, part.bbox)));
    if (outline.length !== 1) return [];
    const button = (part: Part) => ({ box: part.bbox, at: center(part.bbox) });
    return [{ ink, y: outline[0]!.bbox[1], mask: turn[0]!.mask,
      buttons: { extend: button(extend), retract: button(retract), turn: button(turn[0]!.part) } }];
  });
  if (controls.length !== inks.length || controls.some(control => control.y !== controls[0]!.y || control.mask !== controls[0]!.mask)) return null;
  const field: NativeBox = [0, 0, pixels - 1, controls[0]!.y - 1];
  const fieldParts = parts.filter(part => contains(field, part.bbox));
  const caps = fieldParts.filter(part => part.rectangular && part.area === quantum
    && (width(part.bbox) === 1 || height(part.bbox) === 1) && !inks.includes(part.palette_value));
  const { targets, dots } = targetPatterns(fieldParts);
  if (targets.length !== 1) return null;
  const { at: target, marks, ink: markerInk } = targets[0]!;
  const markers = dots.filter(part => part.ink === markerInk && !marks.some(mark => equal(mark, part.at)));
  if (markers.length !== 1) return null;
  const { at: marker } = markers[0]!;
  const bodies = controls.flatMap(control => {
    const bodies = fieldParts.filter(part => part.palette_value === control.ink && part.area >= quantum);
    if (bodies.length !== 1) return [];
    const { bbox: box } = bodies[0]!;
    const possible = caps.flatMap<{ cap: Part; direction: NativePoint }>(cap => {
      const [l, t] = cap.bbox;
      if (width(cap.bbox) === 1 && height(box) === quantum && box[1] === t) {
        if (l + 1 === box[0]) return [{ cap, direction: [1, 0] as const }];
        if (l - 1 === box[2]) return [{ cap, direction: [-1, 0] as const }];
      }
      if (height(cap.bbox) === 1 && width(box) === quantum && box[0] === l) {
        if (t + 1 === box[1]) return [{ cap, direction: [0, 1] as const }];
        if (t - 1 === box[3]) return [{ cap, direction: [0, -1] as const }];
      }
      return [];
    });
    if (possible.length !== 1) return [];
    const { cap, direction } = possible[0]!;
    const pivot = add(center(cap.bbox), direction), length = direction[0] ? width(box) : height(box);
    return [{ ink: control.ink, buttons: control.buttons, box, cap, direction, pivot, length }];
  });
  if (bodies.length !== inks.length || bodies.some(body => body.cap.palette_value !== bodies[0]!.cap.palette_value)) return null;
  const parents = bodies.map(({ box, cap }, index) => bodies.flatMap((parent, i) => {
    const [dx, dy] = parent.direction, [l, t, r, b] = parent.box, own = joined(box, cap.bbox);
    const touches: NativeBox = dx ? [dx > 0 ? r + 1 : l - 1, t, dx > 0 ? r + 1 : l - 1, b]
      : [l, dy > 0 ? b + 1 : t - 1, r, dy > 0 ? b + 1 : t - 1];
    return i !== index && overlap(own, touches) ? [i] : [];
  }));
  if (parents.some(parent => parent.length > 1)) return null;
  const roots = bodies.map((_, i) => i).filter(i => parents[i]!.length === 0);
  if (roots.length !== 1) return null;
  const order = roots.slice();
  for (let i = 1; i < bodies.length; i++) {
    const children = bodies.map((_, j) => j).filter(j => parents[j]![0] === order[i - 1] && !order.includes(j));
    if (children.length !== 1) return null;
    order.push(children[0]!);
  }
  if (!contains(bodies[order.at(-1)!]!.box, dot(marker))) return null;
  const counts = new Map<number, number>();
  for (const row of rows.slice(0, field[3] + 1)) for (const ink of row) counts.set(ink, (counts.get(ink) ?? 0) + 1);
  const floor = [...counts].find(([, count]) => count * 2 > pixels * (field[3] + 1))?.[0];
  if (floor === undefined || floor === markerInk || floor === bodies[0]!.cap.palette_value || inks.includes(floor)) return null;
  const obstacles = rows.slice(0, field[3] + 1).map((row, y) => row.map((ink, x) => ink === floor
    || marks.some(mark => equal(mark, [x, y])) || bodies.some(body => contains(joined(body.box, body.cap.bbox), dot([x, y])))
    ? '.' : '#').join(''));
  const layout = { segments: order.map(i => {
    const { ink, pivot, direction, length, buttons } = bodies[i]!;
    return { ink, pivot, direction, length, buttons };
  }), quantum, width: pixels, field, obstacles, floor, capInk: bodies[0]!.cap.palette_value, markerInk, marker, target, marks };
  return turningObserved(rows, layout, initialTurningPose(layout)) ? layout : null;
}

export function initialTurningPose(layout: TurningLayout): TurningPose {
  return layout.segments.map(() => ({ added: 0, turns: 0 }));
}

export function moveTurningPose(pose: TurningPose, move: TurningMove, direction: TurnSign): TurningPose {
  return pose.map((old, i) => i !== move.body ? old : move.operation === 'turn' ? { ...old, turns: (old.turns + direction) & 3 }
    : { ...old, added: old.added + (move.operation === 'extend' ? 1 : -1) });
}

export function projectTurningPose(layout: TurningLayout, pose: TurningPose): Projection {
  const parts: Position[] = [], half = (layout.quantum - 1) / 2;
  let marker = layout.marker;
  for (const [i, { pivot: base, direction, length }] of layout.segments.entries()) {
    const previous = layout.segments[i - 1], parent = parts[i - 1], local = pose[i]!;
    const turns = (local.turns + (parent?.turns ?? 0)) & 3, along = quarterTurn(direction, turns);
    const pivot = previous && parent ? add(parent.pivot, quarterTurn(add(add(base, previous.pivot, -1),
      previous.direction, pose[i - 1]!.added * layout.quantum), parent.turns)) : base;
    const normal: NativePoint = [along[1] * half, along[0] * half], delta = local.added * layout.quantum;
    const far = add(pivot, along, length + delta - 1), back = add(pivot, along, -1);
    parts.push({ box: bound(add(pivot, normal, -1), add(far, normal)), cap: bound(add(back, normal, -1), add(back, normal)), pivot, turns });
    if (i === layout.segments.length - 1) marker = add(add(pivot, quarterTurn(add(layout.marker, base, -1), turns)), along, delta);
  }
  return { parts, marker };
}

export function turningObserved(rows: NativeRows, layout: TurningLayout, pose: TurningPose): boolean {
  const { parts, marker } = projectTurningPose(layout, pose);
  if (!contains(parts.at(-1)!.box, dot(marker))) return false;
  const map = new Int8Array(layout.width * (layout.field[3] + 1)).fill(-1);
  const index = (x: number, y: number) => y * layout.width + x;
  const paint = ([l, t, r, b]: NativeBox, ink: number) => {
    for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) map[index(x, y)] = ink;
  };
  for (const [i, { box, cap }] of parts.entries()) {
    if (!contains(layout.field, box) || !contains(layout.field, cap)) return false;
    paint(box, layout.segments[i]!.ink);
    paint(cap, layout.capInk);
  }
  const markerIndex = index(...marker), marks = new Set(layout.marks.map(point => index(...point)));
  for (let y = 0; y <= layout.field[3]; y++) for (let x = 0; x < layout.width; x++) {
    const at = index(x, y), ink = rows[y]?.[x], color = map[at]!;
    if (ink === undefined) return false;
    if (at === markerIndex) {
      if (ink !== layout.markerInk) return false;
    } else if (color >= 0) {
      if (ink !== color && !(marks.has(at) && ink === layout.markerInk)) return false;
    } else if (marks.has(at) ? ink !== layout.markerInk : layout.obstacles[y]?.[x] === '#'
      ? ink === layout.floor || ink === layout.capInk || layout.segments.some(part => part.ink === ink) : ink !== layout.floor) return false;
  }
  return true;
}

type SearchNode = { pose: TurningPose; previous: SearchNode | null; move: TurningMove | null; depth: number };

export async function chooseTurningRoute(layout: TurningLayout, start: TurningPose, direction: TurnSign, rejected: readonly string[],
  remaining: number, execution?: NativeExecution): Promise<TurningMove[]> {
  const stride = layout.width + 1, sum = new Int16Array(stride * (layout.field[3] + 2));
  for (const [y, row] of layout.obstacles.entries()) for (let x = 0; x < row.length; x++) {
    const at = (y + 1) * stride + x + 1;
    sum[at] = Number(row[x] === '#') + sum[at - 1]! + sum[at - stride]! - sum[at - stride - 1]!;
  }
  const clear = ([l, t, r, b]: NativeBox) =>
    sum[(b + 1) * stride + r + 1]! + sum[t * stride + l]! === sum[t * stride + r + 1]! + sum[(b + 1) * stride + l]!;
  const blocked = new Set(rejected), frontier: SearchNode[][] = [], explored = new Map([[poseKey(start), 0]]);
  const operations: ExtensionOperation[] = ['extend', 'retract', 'turn'];
  const moves = layout.segments.flatMap((_, body) => operations.map(operation => ({ body, operation })));
  let best = 0, lastYield = execution?.now?.() ?? performance.now();
  const push = (node: SearchNode, marker: NativePoint) => {
    const score = node.depth + Math.ceil(distance(marker, layout.target) / layout.quantum);
    (frontier[score] ??= []).push(node);
    best = Math.min(best, score);
  };
  push({ pose: start, previous: null, move: null, depth: 0 }, projectTurningPose(layout, start).marker);
  for (let expanded = 0; expanded < 65_000; expanded++) {
    const now = execution?.now?.() ?? performance.now();
    if (execution?.signal?.aborted || execution?.deadlineMs !== undefined && now >= execution.deadlineMs) return [];
    if (execution && now - lastYield >= 10) {
      await execution.yieldControl();
      lastYield = execution.now?.() ?? performance.now();
    }
    while (best < frontier.length && !frontier[best]?.length) best++;
    const node = frontier[best]?.pop();
    if (!node) return [];
    if (node.depth >= remaining || node.depth > explored.get(poseKey(node.pose))!) continue;
    for (const move of moves) {
      if (blocked.has(turningEdge(node.pose, move))) continue;
      const next = moveTurningPose(node.pose, move, direction), key = poseKey(next), depth = node.depth + 1;
      if ((explored.get(key) ?? Infinity) <= depth || layout.segments[move.body]!.length + next[move.body]!.added * layout.quantum < 1) continue;
      const { parts, marker } = projectTurningPose(layout, next);
      if (!contains(parts.at(-1)!.box, dot(marker))) continue;
      const boxes = parts.map(({ box, cap }) => joined(box, cap));
      if (!boxes.every((box, i) => contains(layout.field, box) && clear(box)
        && boxes.slice(0, i).every(other => !overlap(box, other)))) continue;
      if (equal(marker, layout.target)) {
        const route = [move];
        for (let parent: SearchNode | null = node; parent?.move; parent = parent.previous) route.push(parent.move);
        return route.reverse();
      }
      explored.set(key, depth);
      push({ pose: next, previous: node, move, depth }, marker);
    }
  }
  return [];
}

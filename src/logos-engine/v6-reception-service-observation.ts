/**
 * Mechanical transfer of reception_service_projection.py from pinned V6 source
 * 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e. Lattice, concave supports, request
 * counterparts and carrier corners are measured from the current public raster.
 * A palette value or command label is never assigned a fixed physical role.
 */
import { compareUnicode } from './canonical.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { geometricComponents } from './v6-native-observer.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
type Point = [number, number];
type Part = ReturnType<typeof geometricComponents>[number];
type Border = [number, number, number, number, number[]];
const pointOrder = (a: readonly number[], b: readonly number[]): number => a[0]! - b[0]! || a[1]! - b[1]!;
const samePoint = (a: readonly number[], b: readonly number[]): boolean => a[0] === b[0] && a[1] === b[1];
const pointKey = (point: readonly number[]): string => point.join(',');
const manhattan = (a: readonly number[], b: readonly number[]): number => Math.abs(a[0]! - b[0]!) + Math.abs(a[1]! - b[1]!);

/** Top, bottom, left and right inclusive edges, in the source order. */
export function receptionServiceSides(rows: NativeRows, box: readonly number[], color: number): boolean[] {
  const [left, top, right, bottom] = box, result = [true, true, true, true];
  for (let x = left!; x <= right!; x++) {
    if (rows[top!]![x] !== color) result[0] = false;
    if (rows[bottom!]![x] !== color) result[1] = false;
  }
  for (let y = top!; y <= bottom!; y++) {
    if (rows[y]![left!] !== color) result[2] = false;
    if (rows[y]![right!] !== color) result[3] = false;
  }
  return result;
}

/** Python tuple max compares count, color, width, pitch, then every box value. */
function borderOrder(a: Border, b: Border): number {
  for (let i = 0; i < 4; i++) {
    const delta = (a[i] as number) - (b[i] as number);
    if (delta) return delta;
  }
  for (let i = 0; i < 4; i++) {
    const delta = a[4][i]! - b[4][i]!;
    if (delta) return delta;
  }
  return 0;
}

export function measureReceptionService(rows: NativeRows, retained: R | null = null): R | null {
  const parts = geometricComponents(rows), groups = new Map<string, { color: number; width: number; items: Part[] }>();
  for (const part of parts) {
    const [left, top, right, bottom] = part.bbox, width = right - left + 1;
    if (width !== bottom - top + 1 || width <= 1 || width >= 5 || part.area !== width * width) continue;
    const key = JSON.stringify([part.color, width]);
    let group = groups.get(key);
    if (!group) { group = { color: part.color, width, items: [] }; groups.set(key, group); }
    group.items.push(part);
  }
  let selected: Border | null = null;
  for (const { color, width, items } of groups.values()) {
    if (items.length < 16) continue;
    const rowsets = new Map<number, Set<number>>();
    for (const part of items) {
      const y = part.bbox[1], row = rowsets.get(y) ?? new Set<number>();
      row.add(part.bbox[0]); rowsets.set(y, row);
    }
    for (const [top, topset] of rowsets) {
      const columns = [...topset].sort((a, b) => a - b), gaps = new Set<number>();
      for (let i = 1; i < columns.length; i++) gaps.add(columns[i]! - columns[i - 1]!);
      if (gaps.size !== 1 || columns.length < 6) continue;
      const pitch = [...gaps][0]!, left = columns[0]!, right = columns.at(-1)! + width - 1;
      for (const [lowerY, lower] of rowsets) {
        if (lowerY - top < 5 * pitch || lower.size !== topset.size || [...lower].some(x => !topset.has(x))) continue;
        const bottom = lowerY + width - 1;
        const outer = items.filter(part => top <= part.bbox[1] && part.bbox[1] <= lowerY
          && (part.bbox[0] === left || part.bbox[2] === right || part.bbox[1] === top || part.bbox[1] === lowerY));
        if (outer.length <= 20) continue;
        const candidate: Border = [outer.length, color, width, pitch, [left, top, right, bottom]];
        if (!selected || borderOrder(candidate, selected) > 0) selected = candidate;
      }
    }
  }
  if (!selected) return null;
  const [, , width, pitch, box] = selected, [left, top, right, bottom] = box;
  if (pitch !== width + 2 || (right! - left! + 1 - width) % pitch || (bottom! - top! + 1 - width) % pitch) return null;
  const cells: Point[] = [];
  for (let y = top! + pitch - 1; y < bottom! - pitch + 2; y += pitch) {
    for (let x = left! + pitch - 1; x < right! - pitch + 2; x += pitch) cells.push([x, y]);
  }
  if (!cells.length) return null;
  const counts = new Map<number, number>();
  // Counter.most_common ties preserve encounter order: cells, then rows/columns.
  for (const [xx, yy] of cells) for (let y = yy; y < yy + pitch; y++) for (let x = xx; x < xx + pitch; x++) {
    const value = rows[y]![x]!; counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let background: number | undefined, maximum = -1;
  for (const [color, count] of counts) if (count > maximum) { background = color; maximum = count; }
  const supports: R[] = [];
  for (const part of parts) {
    const [a, z, x, y] = part.bbox, flags = receptionServiceSides(rows, part.bbox, part.color);
    if (!(left! < a && a <= x && x < right! && top! < z && z <= y && y < bottom!
      && Math.max(x - a + 1, y - z + 1) === pitch && Math.min(x - a + 1, y - z + 1) === pitch - 1
      && flags.filter(Boolean).length === 3)) continue;
    let anchor = cells[0]!;
    for (const cell of cells) if (manhattan(cell, [a, z]) < manhattan(anchor, [a, z])) anchor = cell;
    supports.push({ bbox: part.bbox, anchor, color: part.color, mask: [...part.normalized].sort(pointOrder) });
  }
  const colors = new Map<number, number>();
  for (const support of supports) colors.set(support.color, (colors.get(support.color) ?? 0) + 1);
  const targets = supports.length >= 4 ? supports.filter(support => colors.get(support.color) === 1) : [];
  let target: R | null = targets.length === 1 ? targets[0]! : null;
  if (!target && retained) {
    const old = retained.target, [a, z] = old.bbox;
    const corners = new Set([[0, 0], [pitch - 1, 0], [0, pitch - 1], [pitch - 1, pitch - 1]]
      .map(([dx, dy]) => pointKey([old.anchor[0] + dx!, old.anchor[1] + dy!])));
    if (old.mask.every(([dx, dy]: number[]) => corners.has(pointKey([a + dx!, z + dy!])) || rows[z + dy!]![a + dx!] === old.color)) target = old;
  }
  if (!target) return null;
  const hud = parts.filter(part => part.bbox[1] > bottom! && 3 <= part.area && part.area <= pitch * pitch && !part.rectangular);
  const world = parts.filter(part => top! < part.bbox[1] && part.bbox[1] <= part.bbox[3] && part.bbox[3] < bottom!
    && left! < part.bbox[0] && part.bbox[0] <= part.bbox[2] && part.bbox[2] < right!);
  const counterparts: R[] = [];
  for (const request of hud) {
    const requestMask = [...request.normalized].sort(pointOrder), serialized = JSON.stringify(requestMask);
    for (const body of world) if (JSON.stringify([...body.normalized].sort(pointOrder)) === serialized) {
      counterparts.push({ request_shape: identity(requestMask), request_bbox: request.bbox, body_bbox: body.bbox });
    }
  }
  if (!counterparts.length && !retained) return null;
  return structuredClone({ box, pitch, cells, background, target, support_candidates: supports,
    counterparts: counterparts.length ? counterparts : retained!.counterparts,
    layout: identity([box, pitch, target.bbox, target.color, target.mask]) });
}

export function receptionServiceCarriers(rows: NativeRows, scene: R): R[] {
  const size = scene.pitch, result: R[] = [];
  for (const [x, y] of scene.cells as number[][]) {
    const color = rows[y!]![x!];
    if (color === scene.background || rows[y!]![x! + size - 1] !== color
      || rows[y! + size - 1]![x!] !== color || rows[y! + size - 1]![x! + size - 1] !== color) continue;
    let distinctEdges = true;
    for (let i = 1; i < size - 1; i++) {
      if (rows[y!]![x! + i] === color || rows[y! + size - 1]![x! + i] === color
        || rows[y! + i]![x!] === color || rows[y! + i]![x! + size - 1] === color) { distinctEdges = false; break; }
    }
    if (distinctEdges) result.push({ anchor: [x, y], color });
  }
  return result;
}

export function receptionServicePath(rows: NativeRows, scene: R, start: readonly number[], target: readonly number[],
  moves: Record<string, readonly number[]>, remaining: number): R[] | null {
  const size = scene.pitch, free = new Set<string>();
  for (const point of scene.cells as Point[]) {
    let count = 0;
    for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) {
      if (rows[point[1] + dy]![point[0] + dx] === scene.background) count++;
    }
    if (count >= Math.floor(size * size / 2)) free.add(pointKey(point));
  }
  for (const support of scene.support_candidates as R[]) if (!samePoint(support.anchor, target)) free.delete(pointKey(support.anchor));
  free.add(pointKey(start)); free.add(pointKey(target));
  const initial: Point = [start[0]!, start[1]!];
  const parents = new Map<string, { point: Point; action: string } | null>([[pointKey(initial), null]]), queue = [initial];
  let best = initial;
  const pathTo = (destination: Point): R[] | null => {
    const steps: R[] = [];
    let point = destination, parent = parents.get(pointKey(point));
    while (parent) {
      steps.push({ action_ref: parent.action, from: [...parent.point], to: [...point] });
      point = parent.point; parent = parents.get(pointKey(point));
    }
    steps.reverse(); return steps.length <= remaining ? steps : null;
  };
  const orderedMoves = Object.entries(moves).sort(([a], [b]) => compareUnicode(a, b));
  for (let head = 0; head < queue.length; head++) {
    const point = queue[head]!;
    if (manhattan(point, target) < manhattan(best, target)) best = point;
    if (samePoint(point, target)) return pathTo(point);
    for (const [action, delta] of orderedMoves) {
      const next: Point = [point[0] + delta[0]!, point[1] + delta[1]!], key = pointKey(next);
      if (free.has(key) && !parents.has(key)) { parents.set(key, { point, action }); queue.push(next); }
    }
  }
  return !samePoint(best, initial) ? pathTo(best) : null;
}

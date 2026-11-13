/**
 * Own measured layer of relational_chamber_projection.py, pinned V6 source
 * 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e. Chamber/miniature geometry is a
 * structural prior. Palette values are measured roles, never fixed semantics.
 */
import { geometricComponents, v6Canonical } from './v6-native-observer.ts';
import { symbolicDigest as identity, sha256Bytes } from './v6-hash.ts';
import { programPythonFloat } from './v6-program-identity.ts';
import { compareUnicode } from './canonical.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
type Box = readonly [number, number, number, number];
type Point = [number, number];
const center = (box: Box): Point => [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
const inside = (a: Box, b: Box): boolean => b[0] < a[0] && a[0] <= a[2] && a[2] < b[2]
  && b[1] < a[1] && a[1] <= a[3] && a[3] < b[3];
const pair = (a: number, b: number): string => [a, b].sort((x, y) => x - y).join(':');
const hashText = (text: string): string => sha256Bytes(new TextEncoder().encode(text));
const floatPoint = (value: readonly number[] | null): string => value === null ? 'null' : `[${value.map(programPythonFloat).join(',')}]`;

/** Source /2 centers and their differences stay Python floats, even when integral.
 * Only these typed geometry fields use float spelling; the common digest is unchanged.
 */
function sceneCanonical(scene: R): string {
  return `{${Object.keys(scene).sort(compareUnicode).map(key => {
    let value: string;
    if (key === 'quantum') value = programPythonFloat(scene[key]);
    else if (key === 'rooms') value = `[${scene.rooms.map((room: R) => `{${Object.keys(room).sort(compareUnicode).map(field =>
      `${v6Canonical(field)}:${['center', 'body', 'target'].includes(field) ? floatPoint(room[field]) : v6Canonical(room[field])}`).join(',')}}`).join(',')}]`;
    else value = v6Canonical(scene[key]);
    return `${v6Canonical(key)}:${value}`;
  }).join(',')}}`;
}

export function relationalChamberPlanIdentity(plan: R): string {
  if (plan === null || typeof plan !== 'object' || Array.isArray(plan)) return identity(plan);
  return hashText(`{${Object.keys(plan).sort(compareUnicode).map(key => `${v6Canonical(key)}:${key === 'scene'
    ? sceneCanonical(plan.scene) : v6Canonical(plan[key])}`).join(',')}}`);
}
function perimeter(rows: NativeRows, box: Box, color: number): boolean {
  const [left, top, right, bottom] = box;
  for (let x = left; x <= right; x++) if (rows[top]![x] !== color || rows[bottom]![x] !== color) return false;
  for (let y = top; y <= bottom; y++) if (rows[y]![left] !== color || rows[y]![right] !== color) return false;
  return true;
}

export function measureRelationalChamber(rows: NativeRows): R | null {
  const parts = geometricComponents(rows), counts = new Map<number, number>();
  for (const row of rows) for (const value of row) counts.set(value, (counts.get(value) ?? 0) + 1);
  const background = [...counts].sort((a, b) => b[1] - a[1])[0]![0];
  const frames = parts.filter(part => part.color !== background
    && Math.min(part.bbox[2] - part.bbox[0], part.bbox[3] - part.bbox[1]) >= 14
    && perimeter(rows, part.bbox, part.color));
  const grids: [typeof parts[number], number[], number[]][] = [];
  for (const frame of frames) {
    const [left, top, right, bottom] = frame.bbox, color = frame.color, xs: number[] = [], ys: number[] = [];
    for (let x = left; x <= right; x++) {
      let full = true;
      for (let y = top; y <= bottom; y++) if (rows[y]![x] !== color) { full = false; break; }
      if (full) xs.push(x);
    }
    for (let y = top; y <= bottom; y++) {
      let full = true;
      for (let x = left; x <= right; x++) if (rows[y]![x] !== color) { full = false; break; }
      if (full) ys.push(y);
    }
    if (xs.length < 3 || ys.length < 3) continue;
    const dx = new Set(xs.slice(1).map((x, i) => x - xs[i]!)), dy = new Set(ys.slice(1).map((y, i) => y - ys[i]!));
    const pitch = [...dx][0]!;
    if (dx.size === 1 && dy.size === 1 && dy.has(pitch) && pitch >= 6) grids.push([frame, xs, ys]);
  }
  if (grids.length !== 1) return null;
  const [frame, xs, ys] = grids[0]!, main = frame.bbox;
  const solids = parts.filter(part => inside(part.bbox, main) && part.color !== background && part.color !== frame.color
    && part.bbox[2] - part.bbox[0] === part.bbox[3] - part.bbox[1]
    && part.area === (part.bbox[2] - part.bbox[0] + 1) ** 2 && part.area >= 4);
  if (!solids.length) return null;
  const unit = Math.min(...solids.map(part => part.bbox[2] - part.bbox[0] + 1));
  if (unit % 2 !== 1) return null;
  const rooms: R[] = [], offsets: number[] = [];
  for (let y = 0; y < ys.length - 1; y++) for (let x = 0; x < xs.length - 1; x++) {
    const box: Box = [xs[x]!, ys[y]!, xs[x + 1]!, ys[y + 1]!], mid = center(box);
    const goals = parts.filter(part => inside(part.bbox, box) && part.bbox[2] - part.bbox[0] + 1 === unit + 2
      && part.bbox[3] - part.bbox[1] + 1 === unit + 2 && part.color !== background && part.color !== frame.color
      && perimeter(rows, part.bbox, part.color));
    if (goals.length > 1) return null;
    const target = goals.length ? center(goals[0]!.bbox) : null;
    let body = solids.filter(part => inside(part.bbox, box) && part.bbox[2] - part.bbox[0] + 1 === unit), overlay = false;
    if (!body.length && goals.length === 1 && goals[0]!.area === (unit + 2) ** 2) { body = goals; overlay = true; }
    if (body.length !== 1) return null;
    const position = center(body[0]!.bbox);
    for (const axis of [0, 1]) if (position[axis] !== mid[axis]) offsets.push(Math.abs(position[axis]! - mid[axis]!));
    if (target) for (const axis of [0, 1]) if (target[axis] !== mid[axis]) offsets.push(Math.abs(target[axis]! - mid[axis]!));
    rooms.push({ id: `room:${x}:${y}`, cell: [x, y], box, center: mid, body: position, color: body[0]!.color,
      target, overlap_hypothesis: overlay });
  }
  if (!offsets.length || new Set(offsets).size !== 1) return null;
  const quantum = offsets[0]!, controls: R[] = [], panels: Box[] = [];
  for (const localFrame of frames) {
    if (localFrame === frame) continue;
    const [left, top, right, bottom] = localFrame.bbox, mx = Math.floor((left + right) / 2), my = Math.floor((top + bottom) / 2);
    if ((right - left) % 2 || (bottom - top) % 2 || right - left !== bottom - top) continue;
    const boxes: Box[] = [[left, top, mx, my], [mx, top, right, my], [left, my, mx, bottom], [mx, my, right, bottom]];
    const small: typeof parts = [];
    for (const box of boxes) {
      const candidates = parts.filter(part => inside(part.bbox, box) && part.color !== background && part.color !== localFrame.color
        && part.bbox[2] - part.bbox[0] === part.bbox[3] - part.bbox[1] && part.area === (part.bbox[2] - part.bbox[0] + 1) ** 2
        && 1 < part.bbox[2] - part.bbox[0] + 1 && part.bbox[2] - part.bbox[0] + 1 < unit);
      if (candidates.length !== 1) break;
      small.push(candidates[0]!);
    }
    if (small.length !== 4) continue;
    const vertical = (start: number, end: number): Point[] => Array.from({ length: Math.max(0, end - start) }, (_, i) => [mx, start + i]);
    const horizontal = (start: number, end: number): Point[] => Array.from({ length: Math.max(0, end - start) }, (_, i) => [start + i, my]);
    const lines: [Point[], number, number][] = [[vertical(top + 1, my), 0, 1], [vertical(my + 1, bottom), 2, 3],
      [horizontal(left + 1, mx), 0, 2], [horizontal(mx + 1, right), 1, 3]];
    const panel: R[] = [];
    for (const [coordinates, a, z] of lines) {
      let runs: [number, Point[]][] = [], run: Point[] = [], last: number | null = null;
      for (const point of coordinates) {
        const value = rows[point[1]]![point[0]]!;
        if (value === background || value === localFrame.color) { if (run.length) { runs.push([last!, run]); run = []; } }
        else if (value === last) run.push(point);
        else { if (run.length) runs.push([last!, run]); run = [point]; }
        last = value;
      }
      if (run.length) runs.push([last!, run]);
      runs = runs.filter(([, points]) => points.length >= 2);
      if (runs.length !== 1) break;
      const [value, points] = runs[0]!, colors = [small[a]!.color, small[z]!.color].sort((x, y) => x - y);
      panel.push({ id: 'relation:' + pair(colors[0]!, colors[1]!), pair: colors, value: String(value),
        point: points[Math.floor(points.length / 2)], support: points });
    }
    if (panel.length === 4) { controls.push(...panel); panels.push(localFrame.bbox); }
  }
  if (!controls.length || new Set(controls.map(control => control.id)).size !== controls.length) return null;
  controls.sort((a, b) => a.point[1] - b.point[1] || a.point[0] - b.point[0]);
  const byPair = new Map(controls.map(control => [pair(control.pair[0], control.pair[1]), control.id]));
  const byCell = new Map(rooms.map(room => [JSON.stringify(room.cell), room])), axes: R[] = [];
  for (const room of rooms) for (const axis of [0, 1]) {
    const neighbors: [number, string][] = [];
    for (const sign of [-1, 1]) {
      const cell = [...room.cell]; cell[axis] += sign;
      const neighbor = byCell.get(JSON.stringify(cell));
      if (neighbor) { const ref = byPair.get(pair(room.color, neighbor.color)); if (ref === undefined) return null; neighbors.push([sign, ref]); }
    }
    if (!neighbors.length) continue;
    const direction = neighbors.length === 1 ? neighbors[0]![0] : 1;
    const context = neighbors.length === 1 ? 'single_toward' : 'ordered_opposite';
    const value = (room.body[axis] - room.center[axis]) / quantum * direction;
    const target = room.target ? (room.target[axis] - room.center[axis]) / quantum * direction : null;
    if (![-1, 0, 1].includes(value) || target !== null && ![-1, 0, 1].includes(target)) return null;
    axes.push({ id: room.id + ':' + axis, room: room.id, axis, context, inputs: neighbors.map(([, ref]) => ref),
      value: String(value), target: target === null ? null : String(target), direction });
  }
  if (!axes.some(axis => axis.target !== null)) return null;
  const roomLayout = `[${rooms.map(room => `[${v6Canonical(room.cell)},${v6Canonical(room.color)},${floatPoint(room.target)}]`).join(',')}]`;
  const layout = hashText(`[${v6Canonical(main)},${roomLayout},${v6Canonical(controls.map(control => [control.id, control.point]))},${programPythonFloat(quantum)}]`);
  const scene = { main, pitch: xs[1]! - xs[0]!, unit, quantum, rooms, controls, axes, panels, layout };
  return structuredClone(scene);
}

export function relationalChamberProjection(scene: R): R {
  return { settings: scene.controls.map((control: R) => [control.id, control.value]), axes: scene.axes.map((axis: R) => [axis.id, axis.value]) };
}

/** Append this source layer's measured points; preserve inherited first-key order. */
export function relationalChamberInputCandidates(rows: NativeRows, available: readonly string[], inherited: readonly R[] = []): R[] {
  const values = [...inherited], scene = measureRelationalChamber(rows);
  if (scene && available.includes('ACTION6')) for (const control of scene.controls) values.push({ action_ref: 'ACTION6', data: { x: control.point[0], y: control.point[1] } });
  return [...new Map(values.map(value => [identity(value), value])).values()];
}

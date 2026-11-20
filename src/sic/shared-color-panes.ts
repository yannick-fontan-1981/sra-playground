import type { NativeBox, NativeCommand, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

type Pane = { points: NativePoint[]; box: NativeBox; measured: boolean };
type Action = { kind: 'select' | 'reveal' | 'place'; index: number; command: NativeCommand };
export type SharedColorPanes = {
  layer: number; palette: number[]; wanted: NativePoint[]; canvas: NativeBox; area: NativeBox; frame: NativeBox; pitch: number;
  panes: Pane[]; active: number | null; marker: NativePoint | null; markerInk?: number; plan?: Action[];
};

const directions = [['ACTION1', 0, -1], ['ACTION2', 0, 1], ['ACTION3', -1, 0], ['ACTION4', 1, 0]] as const;
const corners = ([l, t, r, b]: NativeBox): NativePoint[] => [[l, t], [r, b]];
const key = ([x, y]: NativePoint) => x + ',' + y;
const same = ([x, y]: NativePoint, [a, b]: NativePoint) => x === a && y === b;
const inside = ([l, t, r, b]: NativeBox, [x, y]: NativePoint) => l <= x && x <= r && t <= y && y <= b;
const at = (rows: NativeRows, [x, y]: NativePoint) => rows[y]?.[x];
const extent = (points: NativePoint[]): NativeBox => [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])),
  Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))];
const shiftBox = ([l, t, r, b]: NativeBox, x: number, y: number): NativeBox => [l + x, t + y, r + x, b + y];
const intersects = (a: NativeBox, b: NativeBox, gap = 0) => a[0] <= b[2] + gap && a[2] + gap >= b[0]
  && a[1] <= b[3] + gap && a[3] + gap >= b[1];
const rim = ([l, t, r, b]: NativeBox, [x, y]: NativePoint) => (y === t || y === b) && x >= l && x <= r
  || (x === l || x === r) && y >= t && y <= b;
const protectedPixel = (state: Pick<SharedColorPanes, 'area' | 'frame'>, p: NativePoint, marker: NativePoint | null) =>
  !inside(state.area, p) || rim(state.frame, p) || !!marker && same(marker, p);

function visible(state: Pick<SharedColorPanes, 'palette' | 'area' | 'frame'>, rows: NativeRows, marker: NativePoint | null) {
  const points = new Map<string, NativePoint>();
  for (let y = state.area[1]; y <= state.area[3]; y++) for (let x = state.area[0]; x <= state.area[2]; x++) {
    const p: NativePoint = [x, y], ink = at(rows, p);
    if (ink !== undefined && state.palette.includes(ink) && !protectedPixel(state, p, marker)) points.set(key(p), p);
  }
  return points;
}

function components(state: Pick<SharedColorPanes, 'palette' | 'area' | 'frame'>, rows: NativeRows, marker: NativePoint | null): Pane[] {
  const open = visible(state, rows, marker), groups: Pane[] = [];
  while (open.size) {
    const points = [open.values().next().value!];
    open.delete(key(points[0]!));
    for (const [x, y] of points) for (const [, dx, dy] of directions) {
      const directPoint: NativePoint = [x + dx, y + dy];
      const neighbor = key(protectedPixel(state, directPoint, marker) ? [x + 2 * dx, y + 2 * dy] : directPoint);
      const next = open.get(neighbor);
      if (next) { points.push(next); open.delete(neighbor); }
    }
    groups.push({ points, box: extent(points), measured: false });
  }
  return groups;
}

function observableBox(state: Pick<SharedColorPanes, 'area' | 'frame'>, box: NativeBox) {
  const [l, t, r, b] = state.area, [x, y, u, v] = box;
  if (l >= x || t >= y || r <= u || b <= v) return false;
  const [a, c, d, e] = state.frame;
  const edges: NativeBox[] = [[a, c, d, c], [a, e, d, e], [a, c, a, e], [d, c, d, e]];
  return !edges.some(edge => intersects(box, edge));
}

export function measureSharedColorPanes(rows: NativeRows, layer: number, palette: number[], canvas: NativeBox,
  reference: NativeBox, pitch: number, marker: NativePoint | null): SharedColorPanes | null {
  const area: NativeBox = [0, 0, rows[0]!.length - 1, reference[1] - 2];
  const [l, t, r, b] = canvas, frame: NativeBox = [l - 1, t - 1, r + 1, b + 1];
  const geometry = { palette, area, frame };
  const panes = components(geometry, rows, marker);
  if (panes.length !== 2 || panes.some(pane => pane.points.length < pitch ** 2)
    || intersects(panes[0]!.box, panes[1]!.box, 1)) return null;
  const wanted: NativePoint[] = [];
  for (let y = reference[1]; y <= reference[3]; y++) for (let x = reference[0]; x <= reference[2]; x++) {
    if (palette.includes(rows[y]![x]!)) wanted.push([x + l - reference[0], y + t - reference[1]]);
  }
  if (!wanted.length) return null;
  const measured = panes.map(pane => ({ ...pane, measured: observableBox(geometry, pane.box) && (!marker || !inside(pane.box, marker)) }));
  return { ...geometry, layer, wanted, canvas, pitch, panes: measured, active: null, marker };
}

function move(points: NativePoint[], box: NativeBox, input: string, pitch: number): NativePoint[] {
  if (input === 'ACTION5') return points.map(([x, y]) => [box[0] + box[3] - y, box[1] + x - box[0]]);
  const [, dx, dy] = directions.find(([id]) => id === input)!;
  return points.map(([x, y]) => [x + dx * pitch, y + dy * pitch]);
}

function expose(state: SharedColorPanes, index: number) {
  const box = state.panes[index]!.box, other = state.panes[1 - index]!.box;
  const queue = [{ box, input: '', depth: 0 }], seen = new Set([box.join(',')]);
  for (const item of queue) {
    if (item.input && observableBox(state, item.box)) return item.input;
    if (item.depth === 5) continue;
    for (const [input, x, y] of directions) {
      const next = shiftBox(item.box, x * state.pitch, y * state.pitch), id = next.join(',');
      if (seen.has(id) || intersects(next, other, 1) || !corners(next).every(p => inside(state.area, p))) continue;
      seen.add(id);
      queue.push({ box: next, input: item.input || input, depth: item.depth + 1 });
    }
  }
  return null;
}

function fit(state: SharedColorPanes): Action[] | null {
  const target = new Map(state.wanted.map((p, i) => [key(p), 1n << BigInt(i)]));
  const all = (1n << BigInt(target.size)) - 1n;
  const options = state.panes.map(pane => {
    const cheapest = new Map<bigint, string[]>();
    let points = pane.points;
    for (let rotation = 0; rotation < 4; rotation++) {
      const box = extent(points);
      for (let row = -10; row <= 10; row++) for (let col = -10; col <= 10; col++) {
        const dx = col * state.pitch, dy = row * state.pitch;
        if (!corners(shiftBox(box, dx, dy)).every(p => inside(state.area, p))) continue;
        let coverage = 0n, valid = true;
        for (const [x, y] of points) if (inside(state.canvas, [x + dx, y + dy])) {
          const mark = target.get(key([x + dx, y + dy]));
          if (mark === undefined) { valid = false; break; }
          coverage |= mark;
        }
        const length = Math.abs(row) + Math.abs(col) + rotation;
        if (!valid || (cheapest.get(coverage)?.length ?? Infinity) <= length) continue;
        cheapest.set(coverage, [...Array<string>(Math.abs(row)).fill(row < 0 ? 'ACTION1' : 'ACTION2'),
          ...Array<string>(Math.abs(col)).fill(col < 0 ? 'ACTION3' : 'ACTION4'), ...Array<string>(rotation).fill('ACTION5')]);
      }
      points = move(points, box, 'ACTION5', state.pitch);
    }
    return cheapest;
  });
  const first = state.active ?? 0, second = 1 - first;
  let best: Action[] | null = null, cost = Infinity;
  for (const [a, one] of options[first]!) for (const [b, two] of options[second]!) {
    const length = one.length + two.length + Number(two.length > 0) + Number(state.active === null && one.length > 0);
    if ((a | b) !== all || !length || length >= cost) continue;
    const commands = [[first, one], [second, two]] as const;
    best = commands.flatMap(([index, word]) => word.map(action_ref => ({ kind: 'place', index, command: { action_ref, data: {} } })));
    cost = length;
  }
  return best;
}

export function chooseSharedColorMove(state: SharedColorPanes, rows: NativeRows): { state: SharedColorPanes; step: Action } | null {
  const index = state.panes.findIndex(pane => !pane.measured);
  const input = index >= 0 && index === state.active ? expose(state, index) : null;
  const plan = index < 0 ? state.plan ?? fit(state) : null;
  const target = index >= 0 ? index : plan?.[0]?.index;
  if (target === undefined) return null;
  const local = plan ? { ...state, plan } : state;
  if (target !== state.active) {
    const pane = state.panes[target]!, other = new Set(state.panes[1 - target]!.points.map(key));
    const point = pane.points.find(p => at(rows, p) === state.layer && !other.has(key(p)));
    return point ? { state: local, step: { kind: 'select', index: target,
      command: { action_ref: 'ACTION6', data: { x: point[0], y: point[1] } } } } : null;
  }
  const step = index >= 0 ? input && { kind: 'reveal' as const, index, command: { action_ref: input, data: {} } } : plan?.[0];
  return step ? { state: local, step } : null;
}

function unionMatches(state: SharedColorPanes, rows: NativeRows, panes: Pane[], marker: NativePoint | null) {
  const marks = new Set(panes.flatMap(pane => pane.points).filter(p => !protectedPixel(state, p, marker)).map(key));
  const seen = visible(state, rows, marker);
  return marks.size === seen.size && [...marks].every(id => seen.has(id));
}

export function observeSharedColorMove(state: SharedColorPanes, step: Action, first: NativeRows, after: NativeRows): SharedColorPanes | null {
  const { index, kind, command } = step, panel = state.panes[index]!, other = state.panes[1 - index]!;
  if (kind === 'select') {
    const changed: NativePoint[] = [];
    for (let y = state.area[1]; y <= state.area[3]; y++) for (let x = state.area[0]; x <= state.area[2]; x++) {
      const point: NativePoint = [x, y];
      if ((!state.marker || !same(state.marker, point)) && first[y]![x] !== after[y]![x]) changed.push(point);
    }
    if (changed.length !== 1 || !inside(panel.box, changed[0]!)) return null;
    const marker = changed[0]!, markerInk = at(after, marker);
    return markerInk === undefined ? null : { ...state, marker, markerInk, active: index };
  }
  if (!state.marker || state.markerInk === undefined) return null;
  const projected = move(panel.points, panel.box, command.action_ref, state.pitch);
  const predictedMark = move([state.marker], panel.box, command.action_ref, state.pitch)[0]!;
  const positions = command.action_ref === 'ACTION5'
    ? [predictedMark, ...directions.map(([, dx, dy]): NativePoint => [predictedMark[0] + dx, predictedMark[1] + dy])] : [predictedMark];
  const panes = state.panes.slice();
  for (const marker of positions) {
    if (at(after, marker) !== state.markerInk) continue;
    if (kind === 'place') {
      panes[index] = { ...panel, points: projected, box: extent(projected) };
      if (unionMatches(state, after, panes, marker)) return { ...state, panes, marker, plan: state.plan!.slice(1) };
      continue;
    }
    const current = components(state, after, marker);
    const sameVisible = (known: NativePoint[], measured: Pane) => {
      const set = new Set(measured.points.map(key));
      return known.filter(p => !protectedPixel(state, p, marker)).every(p => set.has(key(p)));
    };
    const moving = current.find(pane => sameVisible(projected, pane));
    const stationary = current.find(pane => sameVisible(other.points, pane));
    if (current.length !== 2 || !moving || !stationary || stationary === moving) continue;
    const fill = (measured: Pane, known: NativePoint[]) => {
      const points = [...new Map([...measured.points, ...known.filter(p => protectedPixel(state, p, marker))].map(p => [key(p), p])).values()];
      const box = extent(measured.points);
      return { points, box, measured: observableBox(state, box) };
    };
    panes[index] = fill(moving, projected);
    panes[1 - index] = fill(stationary, other.points);
    return { ...state, panes, marker };
  }
  return null;
}

import { fieldChangeGroups } from '../logos-engine/v6-field-service-observation.ts';
import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

export const contactDirections = [['ACTION1', 0, -1], ['ACTION2', 0, 1], ['ACTION3', -1, 0], ['ACTION4', 1, 0]] as const;
export type ContactDirection = typeof contactDirections[number];
export type ContactStep = { direction: ContactDirection; at: NativePoint };
type Room = { box: NativeBox; floor: NativePoint[]; controls: NativePoint[] };
type Grid = { side: number; start: NativePoint; goal: NativePoint };
type Phase = 'release_home' | 'survey' | 'release_survey' | 'open_access' | 'traverse';
type Capacity = { box: NativeBox; occupied: number; free: number };
export type RoomRoute = {
  grid: Grid; rooms: Room[]; phase: Phase; control: NativePoint;
  tried: NativePoint[]; capacity: Capacity | null; passage: NativePoint | null; stopped: boolean;
};
export type RoomStep = ContactStep & { target: NativePoint; contact: boolean };

export const tileBox = ([x, y]: NativePoint, side: number): NativeBox => [x, y, x + side - 1, y + side - 1];
export const shiftTile = ([x, y]: NativePoint, [, dx, dy]: ContactDirection, side: number): NativePoint => [x + dx * side, y + dy * side];
const key = (point: NativePoint) => point.join(',');
const same = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
const inBox = ([x, y]: NativePoint, [l, t, r, b]: NativeBox) => x >= l && x <= r && y >= t && y <= b;
const crop = (rows: NativeRows, [l, t, r, b]: NativeBox) => rows.slice(t, b + 1).map(row => row.slice(l, r + 1));
const uniform = (values: readonly number[], value = values[0]) => values.length > 0 && values.every(pixel => pixel === value);
const tileValues = (rows: NativeRows, point: NativePoint, side: number) => crop(rows, tileBox(point, side));

function gridTiles(rows: NativeRows, grid: Grid): NativePoint[] {
  const { side, start } = grid, points: NativePoint[] = [];
  for (let y = start[1] % side; y + side <= rows.length - side; y += side) {
    for (let x = start[0] % side; x + side <= rows[0]!.length; x += side) points.push([x, y]);
  }
  return points;
}

function controlShape(tile: number[][]): boolean {
  if (new Set(tile.flat()).size < 4) return false;
  const columns = tile[0]!.map((_, x) => tile.map(row => row[x]!));
  return [tile, columns].some(bands =>
    uniform(bands[0]!) && uniform(bands[1]!, bands[0]![0]) ||
    uniform(bands.at(-1)!) && uniform(bands.at(-2)!, bands.at(-1)![0]));
}

function readRooms(rows: NativeRows, grid: Grid, at: NativePoint): Room[] {
  const { side, goal } = grid, tiles = gridTiles(rows, grid);
  return geometricComponents(rows).flatMap(part => {
    const [l, t, r, b] = part.bbox, w = r - l + 1, h = b - t + 1;
    if (w < side * 3 || h < side * 3 || w % side || h % side || l % side !== grid.start[0] % side
      || t % side !== grid.start[1] % side || part.area * 4 <= w * h || part.area * 5 >= w * h * 4 ||
      ![[l, t], [r, t], [l, b], [r, b]].every(([x, y]) => rows[y!]?.[x!] === part.color)) return [];
    const contents = tiles.filter(tile => inBox(tile, part.bbox)).map(point => {
      const matrix = tileValues(rows, point, side);
      return { point, matrix, color: uniform(matrix.flat()) ? matrix[0]![0]! : null };
    });
    const counts = new Map<number, number>();
    for (const { color } of contents) if (color !== null && color !== part.color) counts.set(color, (counts.get(color) ?? 0) + 1);
    const order = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (!order[0] || order[0][1] <= (order[1]?.[1] ?? 0)) return [];
    const floor = contents.filter(item => item.color === order[0]![0]).map(item => item.point);
    for (const point of [at, goal]) if (inBox(point, part.bbox) && !floor.some(tile => same(tile, point))) floor.push(point);
    return [{ box: part.bbox, floor, controls: contents.filter(item => item.color === null && controlShape(item.matrix)).map(item => item.point) }];
  });
}

export function startRoomRoute(rows: NativeRows, grid: Grid): RoomRoute | null {
  const rooms = readRooms(rows, grid, grid.start);
  const home = rooms.length === 1 ? rooms[0] : undefined;
  if (!home || !inBox(grid.start, home.box) || inBox(grid.goal, home.box) || home.controls.length < 3) return null;
  const close = home.controls.filter(point => contactDirections.some(direction => same(shiftTile(grid.start, direction, grid.side), point)));
  return close.length === 1 ? { grid, rooms, phase: 'release_home', control: close[0]!, tried: [],
    capacity: null, passage: null, stopped: false } : null;
}

function findPassage(rows: NativeRows, route: RoomRoute, away: Room): NativePoint | null {
  const home = route.rooms.find(room => inBox(route.grid.start, room.box));
  if (!home) return null;
  const { side } = route.grid;
  const local = new Set(home.floor.map(key)), remote = new Set(away.floor.map(key));
  const candidates = gridTiles(rows, route.grid).filter(tile => {
    if (inBox(tile, home.box) || inBox(tile, away.box)) return false;
    const neighbors = contactDirections.map(direction => key(shiftTile(tile, direction, side)));
    const paired = neighbors.some((neighbor, i) => local.has(neighbor) && remote.has(neighbors[i ^ 1]!));
    const paint = tileValues(rows, tile, side);
    return paired && !uniform(paint.flat()) && (paint.every(row => uniform(row))
      || paint[0]!.every((_, x) => uniform(paint.map(row => row[x]!))));
  });
  return candidates.length === 1 ? candidates[0]! : null;
}

export function nextRoomStep(route: RoomRoute, from: NativePoint): RoomStep | null {
  if (route.stopped) return null;
  const { grid, phase, rooms, tried, passage } = route;
  const traversing = phase === 'traverse';
  const home = rooms.find(room => inBox(grid.start, room.box));
  if (!home) return null;
  const targets = traversing ? [grid.goal] : phase === 'survey' || phase === 'open_access'
    ? home.controls.filter(control => !tried.some(point => same(point, control))) : [route.control];
  const floor = new Set(rooms.flatMap(room => room.floor).map(key));
  if (traversing && passage) floor.add(key(passage));
  const queue: { at: NativePoint; first: ContactStep | null }[] = [{ at: from, first: null }];
  const seen = new Set([key(from)]);
  for (const item of queue) {
    if (traversing && item.first && same(item.at, grid.goal)) return { ...item.first, target: grid.goal, contact: same(item.first.at, grid.goal) };
    const steps = contactDirections.map(direction => ({ direction, at: shiftTile(item.at, direction, grid.side) }));
    for (const step of steps) {
      if (!traversing && targets.some(target => same(target, step.at))) {
        return { ...(item.first ?? step), target: step.at, contact: !item.first };
      }
    }
    for (const step of steps) {
      const next = key(step.at);
      if (!floor.has(next) || seen.has(next)) continue;
      seen.add(next);
      queue.push({ at: step.at, first: item.first ?? step });
    }
  }
  return null;
}

function capacityReturn(before: NativeRows, after: NativeRows, side: number): Capacity | null {
  const marks = fieldChangeGroups(before, after).filter(group => group.bbox[1] >= before.length - side && group.area < side * side / 2);
  if (marks.length !== 1) return null;
  const { bbox: box, palette_pair: [occupied, free] } = marks[0]!;
  return { box, occupied, free };
}

export function assessRoomStep(route: RoomRoute, step: RoomStep, before: NativeRows, rows: NativeRows,
  from: NativePoint, landed: NativePoint, result: 'landing' | 'contact' | 'blocked' | 'redirected' | 'changed',
): { route: RoomRoute; reason: string } | null {
  if (!step.contact || route.phase === 'traverse') {
    return result === 'landing' || result === 'contact'
      ? { route, reason: result === 'contact' ? 'piece_joined_frame_in_remembered_room' : 'confirmed_step_on_remembered_floor' } : null;
  }
  if (!same(from, landed)) return null;
  const { phase, grid, capacity, passage } = route;
  const rooms = readRooms(rows, grid, from);
  if (phase === 'release_home') {
    const meter = capacityReturn(before, rows, grid.side);
    return !rooms.length && meter ? { route: { ...route, phase: 'survey', capacity: meter, tried: [step.target] },
      reason: 'capacity_returned_and_home_map_retained' } : null;
  }
  if (!capacity) return null;
  const mark = crop(rows, capacity.box).flat();
  if (phase === 'survey') {
    const room = rooms.find(candidate => inBox(grid.goal, candidate.box));
    const access = room && findPassage(rows, route, room);
    return room && access && uniform(mark, capacity.occupied)
      ? { route: { ...route, rooms: [...route.rooms, room], phase: 'release_survey', control: step.target,
        tried: [...route.tried, step.target], passage: access }, reason: 'distant_room_exposed_and_capacity_used' } : null;
  }
  if (!uniform(mark, capacity.free) || rooms.length) return null;
  if (phase === 'release_survey') {
    return { route: { ...route, phase: 'open_access' }, reason: 'capacity_recovered_with_distant_floor_retained' };
  }
  return passage && uniform(tileValues(rows, passage, grid.side).flat())
    ? { route: { ...route, phase: 'traverse' }, reason: 'remote_barrier_removed_without_spending_capacity' } : null;
}

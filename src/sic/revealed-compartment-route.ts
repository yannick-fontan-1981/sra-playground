import { fieldChangeGroups } from '../logos-engine/v6-field-service-observation.ts';
import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

export const contactDirections = [['ACTION1', 0, -1], ['ACTION2', 0, 1], ['ACTION3', -1, 0], ['ACTION4', 1, 0]] as const;
export type ContactDirection = typeof contactDirections[number];
export type ContactStep = { direction: ContactDirection; at: NativePoint };
type Room = { box: NativeBox; ink: number; floor: NativePoint[]; controls: NativePoint[] };
type Grid = { side: number; start: NativePoint; goal: NativePoint };
type Phase = 'release_home' | 'survey' | 'release_survey' | 'open_access' | 'traverse';
type Capacity = { box: NativeBox; occupied: number; free: number };
type Control = { point: NativePoint; identity: [number, number, number]; active: boolean };
type ResourceMeter = { bar: NativeBox; capacity: NativeBox; ink: number; pips: NativePoint[]; freeInk: number };
type RoomResources = { meter: ResourceMeter; reserve: number; free: number; controls: Control[];
  refills: NativePoint[]; opened: NativePoint[] };
export type RoomIntent = 'refill' | 'release' | 'survey' | 'open' | 'exit';
export type RoomRoute = {
  grid: Grid; rooms: Room[]; phase: Phase; control: NativePoint;
  tried: NativePoint[]; capacity: Capacity | null; passage: NativePoint | null; stopped: boolean;
  resources?: RoomResources;
};
export type RoomStep = ContactStep & { target: NativePoint; contact: boolean; intent?: RoomIntent };

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
    return [{ box: part.bbox, ink: part.color, floor, controls: contents.filter(item => item.color === null && controlShape(item.matrix)).map(item => item.point) }];
  });
}

function readControl(point: NativePoint, matrix: number[][], side: number): Control | null {
  if (!controlShape(matrix)) return null;
  const columns = matrix[0]!.map((_, x) => matrix.map(row => row[x]!));
  const matches: Control[] = [];
  for (const bands of [matrix, [...matrix].reverse(), columns, [...columns].reverse()]) {
    const baseDepth = Math.ceil(side / 4), ink = bands[0]![0]!;
    const profile = bands[baseDepth]!;
    if (!bands.slice(0, baseDepth).every(line => uniform(line, ink))
      || !bands.slice(baseDepth).every(line => line.every((color, i) => color === profile[i]))) continue;
    const slots = Array.from({ length: 5 }, (_, i) => profile[Math.ceil(i * side / 5)]!);
    const active = slots[0] === slots[1] && slots[3] !== slots[4];
    const inactive = slots[3] === slots[4] && slots[0] !== slots[1];
    if (active === inactive) continue;
    const start = active ? 2 : 0;
    const identity: [number, number, number] = [slots[start]!, slots[start + 1]!, slots[start + 2]!];
    if (identity[0] !== identity[1] && identity[1] !== identity[2]) matches.push({ point, identity, active });
  }
  return matches.length === 1 ? matches[0]! : null;
}

const isLight = ({ identity: [first, , last] }: Control) => first === last;
const readControls = (rows: NativeRows, grid: Grid) => gridTiles(rows, grid).flatMap(point => {
  const control = readControl(point, tileValues(rows, point, grid.side), grid.side);
  return control ? [control] : [];
});
const inkAt = (rows: NativeRows, [x, y]: NativePoint) => rows[y]?.[x];

function readRefills(rows: NativeRows, grid: Grid, ink: number): NativePoint[] {
  return gridTiles(rows, grid).filter(point => {
    const matrix = tileValues(rows, point, grid.side);
    if (!matrix.slice(1, -1).every(line => uniform(line.slice(1, -1), ink))) return false;
    const [first, last] = [matrix[0]!, matrix.at(-1)!];
    const rim = [...first, ...last, ...matrix.slice(1, -1).flatMap(line => [line[0]!, line.at(-1)!])];
    return rim[0] !== ink && uniform(rim);
  });
}

function readResources(rows: NativeRows, grid: Grid, meter: ResourceMeter, opened: NativePoint[] = []): RoomResources {
  const row = crop(rows, meter.bar)[0]!;
  const edge = row.findIndex(ink => ink !== meter.ink);
  return { meter, reserve: edge < 0 ? row.length : edge, free: meter.pips.filter(p => inkAt(rows, p) === meter.freeInk).length,
    controls: readControls(rows, grid), refills: readRefills(rows, grid, meter.ink), opened };
}

function measureResources(rows: NativeRows, grid: Grid): RoomResources | null {
  if (grid.side < 5) return null;
  const controls = readControls(rows, grid);
  const lights = controls.filter(isLight);
  if (new Set(lights.map(control => control.identity[0])).size < 3 || controls.length - lights.length < 2) return null;
  const freeInks = new Set(lights.map(control => control.identity[1]));
  if (freeInks.size !== 1) return null;
  const freeInk = lights[0]!.identity[1];
  const hud = geometricComponents(rows).filter(p => p.rectangular && p.bbox[1] >= rows.length - grid.side);
  for (const fill of hud) {
    const [left, top, right, bottom] = fill.bbox, height = bottom - top + 1;
    if (right - left + 1 <= height || readRefills(rows, grid, fill.color).length < 2) continue;
    const track = hud.find(p => p.bbox[0] === right + 1 && p.bbox[1] === top && p.bbox[3] === bottom
      && p.bbox[2] - p.bbox[0] + 1 > height);
    if (!track) continue;
    const pips = hud.filter(p => p.bbox[0] > track.bbox[2] && p.bbox[1] === top && p.bbox[3] === bottom
      && p.bbox[2] - p.bbox[0] + 1 === height - 1).map(p => [p.bbox[0], top] as NativePoint);
    if (pips.length < 2 || !pips.some(p => inkAt(rows, p) === freeInk)) continue;
    return readResources(rows, grid, { bar: [left, top, track.bbox[2], bottom],
      capacity: [pips[0]![0], top, pips.at(-1)![0] + height - 2, bottom], ink: fill.color, pips, freeInk });
  }
  return null;
}

export function startRoomRoute(rows: NativeRows, grid: Grid): RoomRoute | null {
  const rooms = readRooms(rows, grid, grid.start);
  const home = rooms.length === 1 ? rooms[0] : undefined;
  if (!home || !inBox(grid.start, home.box) || inBox(grid.goal, home.box) || home.controls.length < 3) return null;
  const close = home.controls.filter(point => contactDirections.some(direction => same(shiftTile(grid.start, direction, grid.side), point)));
  const resources = measureResources(rows, grid);
  if (!resources && close.length !== 1) return null;
  return { grid, rooms, phase: 'release_home', control: (close[0] ?? home.controls[0])!, tried: [], capacity: null, passage: null, stopped: false,
    ...(resources ? { resources } : {}) };
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
  if (route.resources) return resourceStep(route, from, route.resources);
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

type ResourcePath = { at: NativePoint; first: ContactStep | null; distance: number };
function walkablePaths(start: NativePoint, route: RoomRoute, resources: RoomResources): ResourcePath[] {
  const floor = new Set([...route.rooms.flatMap(room => room.floor), ...resources.refills, ...resources.opened].map(key));
  const queue: ResourcePath[] = [{ at: start, first: null, distance: 0 }], seen = new Set([key(start)]);
  for (const { at, first, distance } of queue) for (const direction of contactDirections) {
    const next = shiftTile(at, direction, route.grid.side), id = key(next);
    if (!floor.has(id) || seen.has(id)) continue;
    seen.add(id);
    queue.push({ at: next, first: first ?? { direction, at: next }, distance: distance + 1 });
  }
  return queue;
}

type ResourceOffer = { path: ResourcePath; step: RoomStep; cost: number };
function resourceStep(route: RoomRoute, from: NativePoint, resources: RoomResources): RoomStep | null {
  const { side, goal } = route.grid, { free, reserve, controls, refills } = resources;
  const paths = walkablePaths(from, route, resources);
  const goalPath = paths.find(p => same(p.at, goal));
  if (goalPath?.first && goalPath.distance <= reserve) {
    return { ...goalPath.first, target: goal, contact: false, intent: 'exit' };
  }
  const mapped = new Set(route.rooms.map(room => room.ink));
  const nearest = (targets: readonly Control[], intent: RoomIntent): ResourceOffer | null => {
    for (const path of paths) for (const direction of contactDirections) {
      const point = shiftTile(path.at, direction, side);
      if (!targets.some(target => same(target.point, point))) continue;
      return { path, step: { ...(path.first ?? { direction, at: point }), target: point, contact: path.first === null, intent },
        cost: path.distance + 1 };
    }
    return null;
  };
  const pickup = paths.find(path => path.first && refills.some(point => same(point, path.at)));
  const canAfford = (offer: ResourceOffer | null): offer is ResourceOffer => {
    if (!offer || offer.cost >= reserve) return false;
    if (!pickup) return true;
    const routeToSupply = walkablePaths(offer.path.at, route, resources).find(path => refills.some(point => same(point, path.at)));
    return !routeToSupply || offer.cost + routeToSupply.distance <= reserve;
  };
  const release = nearest(controls.filter(control => isLight(control) && control.active && mapped.has(control.identity[0])), 'release');
  const survey = nearest(controls.filter(control => isLight(control) && !control.active && !mapped.has(control.identity[0])), 'survey');
  if (canAfford(release) && (!free || (free === 1 && release.cost === 1 && !!survey))) return release.step;
  if (free > 0 && canAfford(survey) && (!pickup || survey.cost < pickup.distance)) {
    return survey.step;
  }
  if (pickup?.first && pickup.distance <= reserve) return { ...pickup.first, target: pickup.at, contact: false, intent: 'refill' };
  if (free <= 0) return null;
  const gateway = nearest(controls.filter(control => !isLight(control) && !control.active
    && mapped.has(control.identity[0]) && mapped.has(control.identity[2])), 'open');
  return canAfford(gateway) ? gateway.step : null;
}

function doorBand(pixels: number[][], middle: number) {
  const line = pixels.every(row => uniform(row)) ? pixels.map(row => row[0]!)
    : pixels[0]!.every((_, x) => uniform(pixels.map(row => row[x]!))) ? pixels[0]! : [];
  const bands = line.filter((ink, i) => i === 0 || line[i - 1] !== ink);
  return bands.length === 3 && bands[1] === middle;
}

function assessResources(route: RoomRoute, step: RoomStep, before: NativeRows, rows: NativeRows,
  from: NativePoint, landed: NativePoint, result: 'landing' | 'contact' | 'blocked' | 'redirected' | 'changed',
): { route: RoomRoute; reason: string } | null {
  const prior = route.resources!, { grid } = route;
  const resources = readResources(rows, grid, prior.meter, prior.opened);
  const roomInks = new Set(resources.controls.filter(isLight).map(control => control.identity[0]));
  const fresh = readRooms(rows, grid, landed).filter(room => roomInks.has(room.ink));
  const rooms = [...route.rooms];
  for (const room of fresh) {
    const index = rooms.findIndex(old => old.ink === room.ink && old.box.every((bound, i) => room.box[i] === bound));
    if (index < 0) rooms.push(room);
    else {
      const remembered = rooms[index]!;
      const merged = new Map([...remembered.floor, ...room.floor].map(point => [key(point), point]));
      rooms[index] = { ...room, floor: [...merged.values()] };
    }
  }
  const next = { ...route, rooms, resources };
  if (!step.contact) {
    if (result !== 'landing' && result !== 'contact') return null;
    next.rooms = rooms.map(room => inBox(landed, room.box) && !room.floor.some(point => same(point, landed))
      ? { ...room, floor: [...room.floor, landed] } : room);
    const pickup = prior.refills.some(point => same(point, landed));
    return pickup
      ? resources.reserve > prior.reserve - 1 && !resources.refills.some(point => same(point, landed))
        ? { route: next, reason: 'refill_consumed_and_action_reserve_increased' } : null
      : resources.reserve === prior.reserve - 1 ? { route: next, reason: 'confirmed_step_on_remembered_floor' } : null;
  }
  if (!same(from, landed) || resources.reserve !== prior.reserve - 1) return null;
  const control = prior.controls.find(item => same(item.point, step.target));
  const after = resources.controls.find(item => same(item.point, step.target));
  if (!control || !after || control.active === after.active) return null;
  if (step.intent === 'release') return resources.free === prior.free + 1 && !after.active
    ? { route: next, reason: 'capacity_recovered_with_room_map_retained' } : null;
  if (step.intent === 'survey') return resources.free === prior.free - 1 && after.active
    && fresh.some(room => room.ink === control.identity[0]) && rooms.length > route.rooms.length
    ? { route: next, reason: 'remote_room_map_acquired_from_wall_control' } : null;
  const openings = gridTiles(rows, grid).filter(point => doorBand(tileValues(before, point, grid.side), control.identity[1])
    && uniform(tileValues(rows, point, grid.side).flat()));
  if (step.intent !== 'open' || !after.active || resources.free !== prior.free || openings.length !== 1) return null;
  const passage = openings[0]!;
  return { route: { ...next, passage, resources: { ...resources, opened: [...resources.opened, passage] } },
    reason: 'confirmed_remote_passage_opened_without_consuming_capacity' };
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
  if (route.resources) return assessResources(route, step, before, rows, from, landed, result);
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

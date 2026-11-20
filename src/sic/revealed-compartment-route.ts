import { fieldChangeGroups } from '../logos-engine/v6-field-service-observation.ts';
import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import { unchangedOutside } from './plan-step.ts';

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
type DarkTransit = { candidates: NativePoint[]; reached: NativePoint[]; refused: string[] };
export type RoomIntent = 'refill' | 'release' | 'survey' | 'open' | 'exit';
export type RoomRoute = {
  grid: Grid; rooms: Room[]; phase: Phase; control: NativePoint;
  tried: NativePoint[]; capacity: Capacity | null; passage: NativePoint | null; stopped: boolean;
  resources?: RoomResources; startedUnmapped?: true; dark?: DarkTransit;
};
export type RoomStep = ContactStep & { target: NativePoint; contact: boolean; intent?: RoomIntent; probe?: boolean };

export const tileBox = ([x, y]: NativePoint, side: number): NativeBox => [x, y, x + side - 1, y + side - 1];
export const shiftTile = ([x, y]: NativePoint, [, dx, dy]: ContactDirection, side: number): NativePoint => [x + dx * side, y + dy * side];
const key = (point: NativePoint) => point.join(',');
const same = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
const distance = (a: NativePoint, b: NativePoint) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
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

function measureResources(rows: NativeRows, grid: Grid, partial = false): RoomResources | null {
  if (grid.side < 5) return null;
  const controls = readControls(rows, grid);
  const lights = controls.filter(isLight);
  const lampRooms = new Set(lights.map(control => control.identity[0])), gates = controls.filter(control => !isLight(control));
  if (lampRooms.size < (partial ? 2 : 3) || gates.length < 2) return null;
  if (partial && !gates.some(({ identity: [first, , last] }) => !lampRooms.has(first) || !lampRooms.has(last))) return null;
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
    if (pips.length < (partial ? 1 : 2) || !pips.some(p => inkAt(rows, p) === freeInk)) continue;
    return readResources(rows, grid, { bar: [left, top, track.bbox[2], bottom],
      capacity: [pips[0]![0], top, pips.at(-1)![0] + height - 2, bottom], ink: fill.color, pips, freeInk });
  }
  return null;
}

export function startRoomRoute(rows: NativeRows, grid: Grid): RoomRoute | null {
  const rooms = readRooms(rows, grid, grid.start);
  const home = rooms.length === 1 ? rooms[0] : undefined;
  if (!home || !inBox(grid.start, home.box) || inBox(grid.goal, home.box) || home.controls.length < 3) {
    if (rooms.length) return null;
    const complete = measureResources(rows, grid);
    const resources = complete ?? measureResources(rows, grid, true);
    const nearbyLights = resources?.controls.filter(control => isLight(control) && !control.active
      && contactDirections.some(direction => same(shiftTile(grid.start, direction, grid.side), control.point)));
    if (!resources || resources.free < 1 || nearbyLights?.length !== 1) return null;
    const hidden = !complete ? geometricComponents(rows).find(part => part.area * 2 > rows.length * rows[0]!.length) : null;
    if (!complete && !hidden) return null;
    const dark = hidden ? { candidates: gridTiles(rows, grid).filter(point =>
      uniform(tileValues(rows, point, grid.side).flat(), hidden.color)), reached: [], refused: [] } : null;
    return { grid, rooms, phase: 'survey', control: nearbyLights[0]!.point, tried: [], capacity: null, passage: null,
      stopped: false, resources, startedUnmapped: true, ...(dark ? { dark } : {}) };
  }
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
  if (route.dark && route.resources) return darkResourceStep(route, from, route.resources, route.dark);
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
const edge = (a: NativePoint, b: NativePoint) => key(a) + '>' + key(b);
function walkablePaths(start: NativePoint, route: RoomRoute, resources: RoomResources, considerDark = false): ResourcePath[] {
  const { rooms, dark, grid } = route, { opened, refills, reserve } = resources;
  const floor = new Set([...rooms.flatMap(room => room.floor), ...refills, ...opened, ...(dark?.reached ?? [])].map(key));
  const refused = new Set(dark?.refused ?? []);
  const questioned = new Set([...refused].map(attempt => attempt.slice(attempt.indexOf('>') + 1)));
  const explore = !!dark && considerDark && opened.length > 0;
  const hidden = new Set(explore ? dark.candidates.filter(point => !rooms.some(room => inBox(point, room.box))).map(key) : []);
  const paths: ResourcePath[] = [{ at: start, first: null, distance: 0 }], seen = new Set([key(start)]);
  for (const path of paths) {
    if (considerDark && path.distance + 1 >= reserve) continue;
    const steps = contactDirections.map(direction => ({ direction, at: shiftTile(path.at, direction, grid.side) }));
    // Equally short routes through unexplored terrain extend away from the entry
    // instead of repeatedly approaching the same obstacle from the known side.
    if (explore) steps.sort((a, b) => distance(b.at, grid.start) - distance(a.at, grid.start));
    for (const step of steps) {
      const site = key(step.at), confirmed = floor.has(site);
      if (seen.has(site) || refused.has(edge(path.at, step.at)) || (!confirmed && (!hidden.has(site) || questioned.has(site)))) continue;
      seen.add(site);
      paths.push({ at: step.at, first: path.first ?? step, distance: path.distance + 1 });
    }
  }
  return paths;
}

type ResourceOffer = { path: ResourcePath; step: RoomStep; cost: number };

function darkResourceStep(route: RoomRoute, from: NativePoint, resources: RoomResources, dark: DarkTransit): RoomStep | null {
  const { side, goal } = route.grid, { controls, free, refills, opened, reserve } = resources;
  const rooms = route.rooms, mapped = new Set(rooms.map(room => room.ink));
  const known = new Set([...rooms.flatMap(room => room.floor), ...opened, ...dark.reached, ...refills].map(key));
  const move = (first: ContactStep, target: NativePoint, intent: RoomIntent, contact = false): RoomStep =>
    ({ ...first, target, intent, contact, ...(!contact && !known.has(key(first.at)) ? { probe: true } : {}) });
  const goalMapped = rooms.some(room => inBox(goal, room.box));
  if (goalMapped) {
    const exit = walkablePaths(from, route, resources).find(path => same(path.at, goal) && path.distance <= reserve);
    if (exit?.first) return move(exit.first, goal, 'exit');
  }
  const paths = walkablePaths(from, route, resources, true);
  const go = (targets: readonly NativePoint[], intent: RoomIntent) => {
    const path = paths.find(path => path.first && targets.some(target => same(target, path.at)));
    return path?.first ? move(path.first, path.at, intent) : null;
  };
  const approach = (targets: readonly Control[], intent: RoomIntent) => {
    for (const path of paths) for (const direction of contactDirections) {
      const at = shiftTile(path.at, direction, side);
      if (path.distance + 1 < reserve && targets.some(control => same(control.point, at))) {
        return move(path.first ?? { direction, at }, at, intent, path.first === null);
      }
    }
    return null;
  };
  const lights = controls.filter(isLight), gates = controls.filter(control => !isLight(control) && !control.active);
  if (goalMapped && gates.length === 0) {
    const exit = go([goal], 'exit');
    if (exit) return exit;
  }
  if (!free) return approach(lights.filter(light => light.active && mapped.has(light.identity[0])), 'release') ?? go(refills, 'refill');
  if (!opened.length && rooms.length) {
    const refill = go(refills, 'refill');
    if (refill) return refill;
  }
  const nearbyRefill = paths.find(path => path.first && path.distance <= 3 && refills.some(point => same(point, path.at)));
  const full = resources.meter.bar[2] - resources.meter.bar[0] + 1;
  if (nearbyRefill?.first && reserve + 2 * nearbyRefill.distance + 4 <= full) {
    return move(nearbyRefill.first, nearbyRefill.at, 'refill');
  }
  const survey = approach(lights.filter(light => !light.active && !mapped.has(light.identity[0])), 'survey');
  const gate = approach(gates.filter(({ identity: [first, , last] }) => mapped.has(first) || mapped.has(last)), 'open');
  return survey ?? gate ?? go(refills, 'refill');
}

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
  if (route.startedUnmapped) {
    // Use the first surveyed room to build a reserve before taking the next survey detour.
    if (mapped.size && !resources.opened.length && pickup?.first && pickup.distance <= reserve) {
      return { ...pickup.first, target: pickup.at, contact: false, intent: 'refill' };
    }
    // Opening a control from a known side is useful even while the room beyond is still dark.
    if (resources.opened.length && free > 0) {
      const access = nearest(controls.filter(control => !isLight(control) && !control.active
        && (mapped.has(control.identity[0]) || mapped.has(control.identity[2]))), 'open');
      if (canAfford(access)) return access.step;
    }
  }
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
  const spent = resources.reserve === prior.reserve - 1 || !!route.dark && resources.reserve === prior.reserve
    && prior.reserve === prior.meter.bar[2] - prior.meter.bar[0] + 1;
  if (!step.contact) {
    if (route.dark && step.probe && result === 'blocked' && same(from, landed) && resources.free === prior.free
      && (spent || resources.reserve === prior.reserve) && unchangedOutside(before, rows, [prior.meter.bar])) {
      return { route: { ...next, dark: { ...route.dark, refused: [...route.dark.refused, edge(from, step.at)] } },
        reason: 'dark_tile_refused_from_observed_position' };
    }
    if (result !== 'landing' && result !== 'contact') return null;
    if (route.dark && prior.free !== resources.free) return null;
    if (route.dark && !route.dark.reached.some(point => same(point, landed))) {
      next.dark = { ...route.dark, reached: [...route.dark.reached, landed] };
    }
    next.rooms = rooms.map(room => inBox(landed, room.box) && !room.floor.some(point => same(point, landed))
      ? { ...room, floor: [...room.floor, landed] } : room);
    const pickup = prior.refills.some(point => same(point, landed));
    return pickup
      ? resources.reserve > prior.reserve - 1 && !resources.refills.some(point => same(point, landed))
        ? { route: next, reason: 'refill_consumed_and_action_reserve_increased' } : null
      : spent ? { route: next, reason: step.probe ? 'dark_tile_confirmed_by_movement' : 'confirmed_step_on_remembered_floor' } : null;
  }
  if (!same(from, landed) || !spent) return null;
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

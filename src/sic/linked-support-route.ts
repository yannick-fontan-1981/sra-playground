import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

type Button = { button: NativeBox; color: number };
type Panel = { box: NativeBox; point: NativePoint; normal: NativePoint; room: number };
type Transfer = {
  buttons: Button[]; span: number; actorInk: number; actorMask: string; goal: NativeBox;
  footGap: number; floorInk: number; use: NativeBox; idle: number; cube: NativeRows;
};
export type LinkedSupports = Transfer & {
  rooms: NativeBox[]; panels: Panel[]; plates: NativeBox[]; gate: NativeBox;
  supportRoom: number; panelInk: number; wallInk: number; plateInk: number;
};
export type SupportChoice = {
  kind: 'select' | 'place' | 'walk' | 'settle' | 'take' | 'drop'; input: string;
  target: NativeBox; index: number; reason: string; point?: NativePoint; destination?: number;
};
type Return = { actor: NativeBox; room: number; selected: number; carried: boolean; cubes: NativeBox[];
  occupied: boolean[]; links: number[]; open: boolean };

const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const center = ([l, t, r, b]: NativeBox): NativePoint => [(l + r) / 2, (t + b) / 2];
const click = (box: NativeBox): NativePoint => center(box).map(Math.floor) as [number, number];
const contains = ([l, t, r, b]: NativeBox, [x, y]: NativePoint) => l <= x && x <= r && t <= y && y <= b;
const same = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((value, i) => value === b[i]);

function observe(rows: NativeRows, scene: LinkedSupports): Return | null {
  const { buttons, panelInk, actorMask, actorInk, rooms, cube, use, idle } = scene;
  const selected = buttons.map(({ button }) => rows[button[1] - 1]?.[click(button)[0]] === panelInk);
  if (selected.filter(Boolean).length !== 1) return null;
  const key = selected.indexOf(true), carried = rows[use[1]]?.[use[0]] !== idle;
  const mask = actorMask.split(';').map(token => token.split(',').map(Number) as [number, number]);
  const right = Math.max(...mask.map(([x]) => x)), bottom = Math.max(...mask.map(([, y]) => y));
  const mark = cube[Math.floor(cube.length / 2)]![Math.floor(cube[0]!.length / 2)];
  const actors: NativeBox[] = [], cubes: NativeBox[] = [];
  for (let y = use[3] + 1; y < rows.length - Math.max(bottom, cube.length); y++) {
    for (let x = 0; x < rows[y]!.length; x++) {
      if (rows[y]![x] === cube[0]![0] && cube.every((line, dy) => line.every((ink, dx) => rows[y + dy]?.[x + dx] === ink))) {
        cubes.push([x, y, x + cube[0]!.length - 1, y + cube.length - 1]);
      }
      for (const reflect of [false, true]) {
        const face = reflect ? 0 : right;
        if (rows[y]![x + face] !== buttons[key]!.color) continue;
        if (mask.every(([u, v]) => rows[y + v]?.[x + (reflect ? right - u : u)]
          === (carried && u * 2 === right && v === bottom ? mark : actorInk))) actors.push([x, y, x + right, y + bottom]);
      }
    }
  }
  if (actors.length !== 1) return null;
  const actor = actors[0]!;
  const links = buttons.map(({ color }) => scene.panels.findIndex(({ box }) => {
    let count = 0;
    for (let y = box[1]; y <= box[3]; y++) for (let x = box[0]; x <= box[2]; x++) count += Number(rows[y]?.[x] === color);
    return count >= scene.span / 2;
  }));
  const occupied = scene.plates.map(plate => cubes.some(box => contains(plate, [center(box)[0], box[3]])));
  const [l, t, r, b] = scene.gate;
  const open = rows.slice(t, b + 1).every((line, i) => line.slice(l, r + 1).every((ink, j) =>
    ink === scene.floorInk || contains([actor[0], actor[1] - 1, actor[2], actor[3] + 1], [l + j, t + i])));
  return { actor, room: rooms.findIndex(box => contains(box, center(actor))), selected: key, carried, cubes, occupied, links, open };
}

export function measureLinkedSupports(rows: NativeRows, parts: ReturnType<typeof geometricComponents>, prior: Transfer): LinkedSupports | null {
  const { floorInk, goal, span, use, cube } = prior;
  const rooms = parts.filter(p => p.color === floorInk && p.bbox[1] > use[3] && p.area >= span * span
    && width(p.bbox) > span && height(p.bbox) >= span).map(p => p.bbox);
  if (rooms.length < 2 || rooms.length > 6) return null;
  const panelInk = prior.buttons.map(({ button }) => rows[button[1] - 1]?.[click(button)[0]])
    .find(ink => ink !== undefined && parts.some(p => p.color === ink && p.area === span && p.rectangular && p.bbox[1] > use[3]));
  if (panelInk === undefined) return null;
  const panels: Panel[] = [];
  for (const part of parts.filter(p => p.color === panelInk && p.area === span && p.rectangular && p.bbox[1] > use[3])) {
    const box = part.bbox, point = click(box), [x, y] = point;
    const directions: NativePoint[] = width(box) === 1 ? [[-1, 0], [1, 0]] : [[0, -1], [0, 1]];
    const candidates = directions.flatMap(normal => {
      const inside: NativePoint = [x + normal[0], y + normal[1]];
      const room = rooms.findIndex(bounds => contains(bounds, inside));
      const lane = part.mask.filter(([u, v]) => rows[box[1] + v + normal[1]]?.[box[0] + u + normal[0]] === floorInk);
      return room >= 0 && lane.length >= span / 2 ? [{ box, point, normal, room }] : [];
    });
    if (candidates.length === 1) panels.push(candidates[0]!);
  }
  const ceiling = panels.find(panel => panel.normal[1] > 0);
  const wallInk = ceiling && rows[ceiling.point[1] - 1]?.[ceiling.point[0]];
  if (panels.length < 3 || wallInk === undefined || wallInk === floorInk || wallInk === panelInk) return null;
  const directions = rooms.flatMap((room, supportRoom) => {
    if (goal[1] > room[3] || goal[3] < room[3] || room[2] >= goal[0] && room[0] <= goal[2]) return [];
    const [left, right] = room[2] < goal[0] ? [room[2] + 1, goal[0] - 1] : [goal[2] + 1, room[0] - 1];
    if (right - left >= span || left > right) return [];
    const gate: NativeBox = [left, room[3] - prior.footGap - 1, right, room[3] - prior.footGap];
    const inks = new Set(rows.slice(gate[1], gate[3] + 1).flatMap(line => line.slice(left, right + 1)));
    const grounded = rows[room[3]]!;
    const runs: { box: NativeBox; ink: number }[] = [];
    for (let x = room[0]; x <= room[2]; x++) {
      const ink = grounded[x]!;
      if (ink === floorInk || !inks.has(ink) || ink === wallInk || ink === panelInk) continue;
      let end = x;
      while (end < room[2] && grounded[end + 1] === ink) end++;
      if (end - x + 1 >= cube[0]!.length && grounded[x - 1] === floorInk && grounded[end + 1] === floorInk) {
        runs.push({ box: [x, room[3], end, room[3]], ink });
      }
      x = end;
    }
    if (runs.length < 2 || runs.some(run => run.ink !== runs[0]!.ink)) return [];
    return [{ supportRoom, gate, plates: runs.map(run => run.box), plateInk: runs[0]!.ink }];
  });
  if (directions.length !== 1) return null;
  const scene: LinkedSupports = { ...prior, rooms, panels, panelInk, wallInk, ...directions[0]! };
  const observed = observe(rows, scene);
  return observed && !observed.carried && !observed.open && observed.room >= 0 && observed.cubes.length === scene.plates.length ? scene : null;
}

function visible(rows: NativeRows, scene: LinkedSupports, from: NativePoint, panel: Panel) {
  const [nx, ny] = panel.normal, [x, y] = panel.point;
  const dx = x + (nx ? 0 : 0.5) - from[0], dy = y + (ny ? 0 : 0.5) - from[1];
  if (dx * nx + dy * ny >= 0) return false;
  const samples = Math.ceil(Math.hypot(dx, dy) * 4);
  for (let step = 1; step < samples; step++) {
    const u = Math.floor(from[0] + dx * step / samples), v = Math.floor(from[1] + dy * step / samples);
    if (contains(panel.box, [u, v])) continue;
    const ink = rows[v]?.[u];
    if (ink === scene.wallInk || ink === scene.plateInk && !scene.plates.some(box => contains(box, [u, v]))) return false;
  }
  return true;
}

export function chooseLinkedSupport(rows: NativeRows, scene: LinkedSupports) {
  const observed = observe(rows, scene);
  if (!observed) return null;
  const { actor, room, carried, cubes, occupied, selected, links, open } = observed;
  const [x] = center(actor);
  const choiceAt = (kind: SupportChoice['kind'], input: string, target: NativeBox, reason: string,
    point?: NativePoint, index = 0, destination?: number) => ({
    actor, cubes, occupied, open,
    choice: { kind, input, target, reason, index, ...(point ? { point } : {}), ...(destination === undefined ? {} : { destination }) },
  });
  const walk = (target: NativeBox, reason: string, toward = Math.sign(center(target)[0] - x), destination?: number) =>
    toward ? choiceAt('walk', toward < 0 ? 'ACTION3' : 'ACTION4', target, reason, undefined, 0, destination) : null;
  const settle = (target: NativeBox, destination?: number) =>
    choiceAt('settle', 'ACTION2', target, 'Let the sprite finish the projected fall', undefined, 0, destination);
  if (occupied.every(Boolean) && open) return walk(scene.goal, 'Reach the exit while the loads hold all required supports');
  if (room < 0) return null;
  const bounds = scene.rooms[room]!;
  const airborne = actor[3] < bounds[3] + 1 - scene.footGap
    && !cubes.some(cube => Math.abs(center(cube)[0] - x) <= width(actor) && cube[1] - actor[3] <= scene.footGap + 1
      && cube[1] > actor[3]);
  const plates = scene.plates.filter((_, i) => !occupied[i]);
  const free = cubes.filter(cube => !scene.plates.some(plate => contains(plate, [center(cube)[0], cube[3]])));
  const closest = (boxes: NativeBox[]) => boxes.sort((a, b) => Math.abs(center(a)[0] - x) - Math.abs(center(b)[0] - x))[0];
  const load = !carried && closest(free.filter(cube => contains(bounds, center(cube))));
  if (load) {
    if (Math.hypot(center(load)[0] - x, center(load)[1] - center(actor)[1]) <= 5) {
      return choiceAt('take', 'ACTION6', load, 'Pick up the nearby free load for an uncovered support', click(scene.use));
    }
    return airborne ? settle(load) : walk(load, 'Approach the free load in this compartment');
  }
  if (carried && room === scene.supportRoom) {
    const plate = closest(plates);
    if (!plate) return null;
    if (airborne) return settle(plate);
    return contains(plate, [x, plate[1]])
      ? choiceAt('drop', 'ACTION6', plate, 'Leave the load on the uncovered plate and preserve the other supports', click(scene.use))
      : walk(plate, 'Bring the load over the nearest uncovered support');
  }
  const cargo = closest(free);
  const destination = carried ? scene.supportRoom : cargo ? scene.rooms.findIndex(box => contains(box, center(cargo))) : -1;
  if (destination < 0 || destination === room) return null;
  if (airborne) return settle(scene.rooms[destination]!);
  const routes = scene.panels.flatMap((entry, from) => {
    if (entry.room !== room || entry.normal[1] > 0 || entry.normal[0] && entry.box[3] < actor[3]) return [];
    return scene.panels.flatMap((exit, to) => {
      if (exit.room !== destination) return [];
      return [0, 1].flatMap(key => {
        const commands = [{ key, part: entry, index: from }, { key: 1 - key, part: exit, index: to }].filter(p => links[p.key] !== p.index);
        if (commands.some(p => !visible(rows, scene, center(actor), p.part))) return [];
        const changes = commands.sort((a, b) => Number(b.key === selected) - Number(a.key === selected));
        const targetX = carried ? center(plates[0]!)[0] : center(cargo!)[0];
        return [{ entry, changes, cost: 8 * changes.length + Math.abs(entry.point[0] - x) / 4
          + Math.abs(exit.point[0] - targetX) / 4 + Number(exit.normal[1] !== 0) }];
      });
    });
  }).sort((a, b) => a.cost - b.cost);
  const route = routes[0];
  if (!route) return null;
  const pending = route.changes[0];
  if (pending) {
    const { key, part, index } = pending, button = scene.buttons[key]!.button;
    return key === selected
      ? choiceAt('place', 'ACTION6', part.box, 'Place one end of the link to the compartment needed for the next support', part.point, index)
      : choiceAt('select', 'ACTION6', button, 'Select the portal slot that can change without moving the other end', click(button), key);
  }
  const { entry } = route;
  if (!entry.normal[0] && x > entry.box[0] + 1 && x < entry.box[2] - 1) return settle(entry.box, destination);
  return walk(entry.box, 'Enter the verified pair to transfer between compartments',
    entry.normal[0] ? -entry.normal[0] : Math.sign(center(entry.box)[0] - x), destination);
}

export function checkLinkedSupport(scene: LinkedSupports, choice: SupportChoice, first: NativeRows, second: NativeRows): string | null {
  const before = observe(first, scene), after = observe(second, scene);
  if (!before || !after || before.occupied.some((value, i) => value && !after.occupied[i])) return null;
  if (choice.kind === 'take') return after.carried && !before.carried && after.cubes.length + 1 === before.cubes.length
    && before.cubes.some(box => same(box, choice.target)) && !after.cubes.some(box => same(box, choice.target)) ? 'free_load_retrieved' : null;
  if (choice.kind === 'drop') {
    if (!before.carried || after.carried || after.cubes.length !== before.cubes.length + 1
      || !after.occupied[scene.plates.findIndex(box => same(box, choice.target))]) return null;
    if (after.occupied.every(Boolean)) return after.open ? 'loads_hold_exit_passage_open' : null;
    return 'load_holds_required_support';
  }
  if (before.carried !== after.carried || before.cubes.length !== after.cubes.length) return null;
  if (choice.kind === 'select') return same(before.actor, after.actor) && same(before.links, after.links)
    && after.selected === choice.index ? 'opening_control_selected' : null;
  if (choice.kind === 'place') return same(before.actor, after.actor) && after.links[after.selected] === choice.index
    && before.links[1 - before.selected] === after.links[1 - after.selected] ? 'required_opening_present' : null;
  if (!same(before.links, after.links) || same(before.actor, after.actor)) return null;
  if (before.room !== after.room && after.room === choice.destination) return 'linked_crossing_observed';
  if (before.room !== after.room && !(before.occupied.every(Boolean) && before.open)) return null;
  if (choice.kind === 'settle') return after.actor[1] !== before.actor[1] ? 'fall_progress_observed' : null;
  return 'support_route_progress_observed';
}

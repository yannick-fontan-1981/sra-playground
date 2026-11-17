import { geometricComponents, ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';

export const linkOpeningsId = 'sic_link_openings';
export const learnLinkOpeningsId = 'sic_test_visible_opening_controls';

type Part = ReturnType<typeof geometricComponents>[number];
type Endpoint = { box: NativeBox; point: NativePoint; button: NativeBox; color: number; buttonMask?: string };
type RelayLeg = { pair: [Endpoint, Endpoint]; departure: NativeBox; arrival: NativeBox; floor: number };
type LinkedLoad = { button: NativeBox; idle: number; source: NativeBox; pixels: NativeRows;
  standing: NativeBox; plate: NativeBox; gate: NativeBox; passage: number };
type PlateLink = Pick<LinkedLoad, 'button' | 'idle' | 'pixels' | 'passage'> & {
  departure: NativeBox; receiving: NativeBox; firingPlate: NativeBox; exitPlate: NativeBox;
  shutter: NativeBox; closed: NativeRows; exitGate: NativeBox; floor: number;
};
type FallLink = { departure: NativeBox; arrival: NativeBox; shelf: NativeBox; landing: NativeBox; releaseDirection: number };
type Scene = { endpoints: Endpoint[]; actorColor: number; actorMask: string; goal: NativeBox; goalColor?: number; goalMask?: string;
  footGap?: number; relay?: [RelayLeg, RelayLeg]; load?: LinkedLoad; flight?: FallLink; plateLink?: PlateLink };
type State = { epoch: number; scene: Scene; refs: string[]; selected: number | null; walkRef: string | null; crossed: boolean; rejected: string[];
  leg?: number; settleRef?: string; held?: boolean; stationed?: NativeBox; redirection?: { entry: NativeBox; release: NativeBox } };
type PriorLink = { completed: number; scene: Scene; proof: string };
type Choice = { kind: 'select' | 'place' | 'walk' | 'settle' | 'take' | 'drop'; input: string; target: NativeBox; index: number; reason: string;
  point?: NativePoint; direction?: number };
type Proposal = NativeProposal & { local: State; choice: Choice; actor: NativeBox; needId: string; attempt: string };

const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const center = ([l, t, r, b]: NativeBox): NativePoint => [Math.floor((l + r) / 2), Math.floor((t + b) / 2)];
const silhouette = (p: Part) => JSON.stringify(p.mask);
const sameBounds = (a: NativeBox, b: NativeBox) => a.every((value, i) => value === b[i]);
const contains = ([l, t, r, b]: NativeBox, [x, y]: NativePoint) => l <= x && t <= y && r >= x && b >= y;
function mirrorInvariantMask(p: Part): string {
  const w = width(p.bbox);
  const key = (reflected: boolean) => p.mask.map(([x, y]) => (reflected ? w - 1 - x : x) + ',' + y).sort().join(';');
  return [key(false), key(true)].sort()[0]!;
}

function actor(parts: Part[], scene: Scene): NativeBox | null {
  const sites = parts.filter(p => p.color === scene.actorColor && mirrorInvariantMask(p) === scene.actorMask
    && p.area >= 4 && p.area <= 12 && p.bbox[1] > scene.endpoints[0]!.button[3] + 4);
  return sites.length === 1 ? sites[0]!.bbox : null;
}

function discover(parts: Part[], rows: NativeRows): Scene | null {
  const h = rows.length, w = rows[0]!.length;
  const vertical = parts.filter(p => p.rectangular && width(p.bbox) === 1 && height(p.bbox) >= 5 && height(p.bbox) < h / 3
    && p.bbox[1] >= h / 4 && (p.bbox[0] < w / 4 || p.bbox[0] >= w * 3 / 4));
  const pairs = vertical.flatMap(left => vertical.filter(right => left.bbox[0] < w / 4 && right.bbox[0] >= w * 3 / 4
    && left.color === right.color && height(left.bbox) === height(right.bbox) && left.bbox[1] === right.bbox[1])
    .map(right => [left, right]));
  if (pairs.length !== 1) return null;
  const [left, right] = pairs[0]!, pair = [left!, right!];
  const hud = parts.filter(p => p.bbox[1] > 0 && p.bbox[3] < h / 8 && width(p.bbox) >= 5 && width(p.bbox) <= w / 4
    && height(p.bbox) >= 2 && height(p.bbox) <= 5 && p.area >= 10);
  const switches = hud.filter((p, i) => hud.slice(i + 1).some(q => q.color !== p.color && q.bbox[1] === p.bbox[1]
    && q.bbox[0] > p.bbox[2] && silhouette(q) === silhouette(p)));
  if (switches.length !== 1) return null;
  const first = switches[0]!;
  const second = hud.find(p => p.bbox[0] > first.bbox[2] && p.bbox[1] === first.bbox[1] && silhouette(p) === silhouette(first))!;
  const y = left!.bbox[1], bottom = left!.bbox[3], span = right!.bbox[0] - left!.bbox[0];
  const sprite = parts.filter(p => p.bbox[1] >= y && p.bbox[3] <= bottom && p.area >= 4 && p.area <= 12
    && width(p.bbox) >= 2 && height(p.bbox) >= 2 && p.color !== left!.color
    && !p.rectangular && p.bbox[0] > left!.bbox[0] && p.bbox[2] < right!.bbox[0]
    && !parts.some(frame => frame.bbox[1] === y && frame.bbox[3] === bottom
      && frame.bbox[0] < p.bbox[0] && frame.bbox[2] > p.bbox[2]));
  if (sprite.length !== 1) return null;
  const goals = parts.filter(p => p.bbox[1] === y && p.bbox[3] === bottom && width(p.bbox) >= 3 && width(p.bbox) <= height(p.bbox)
    && p.bbox[0] > left!.bbox[0] && p.bbox[2] < right!.bbox[0] && p.color !== left!.color);
  if (goals.length !== 1) return null;
  const goal = goals[0]!.bbox, [sx] = center(sprite[0]!.bbox), [gx] = center(goal);
  const closer = (x: number) => x - left!.bbox[0] < right!.bbox[0] - x ? 0 : 1;
  const startSide = closer(sx), endSide = closer(gx);
  if (startSide === endSide || Math.abs(gx - sx) < span / 3) return null;
  const floorY = bottom + 1;
  const floor = rows[floorY];
  if (!floor || floor[sx] !== floor[gx] || floor[Math.floor((sx + gx) / 2)] === floor[sx]) return null;
  const endpoints = pair.map((p, i) => {
    const button = i === startSide ? first : second;
    return { box: p.bbox, point: center(p.bbox), button: button.bbox, color: button.color, buttonMask: silhouette(button) };
  });
  return { endpoints, actorColor: sprite[0]!.color, actorMask: mirrorInvariantMask(sprite[0]!), goal,
    goalColor: goals[0]!.color, goalMask: silhouette(goals[0]!), footGap: floorY - sprite[0]!.bbox[3] };
}

function discoverRelay(parts: Part[], rows: NativeRows, previous: Scene): Scene | null {
  if (!previous.footGap || previous.footGap > 4 || previous.endpoints.length !== 2) return null;
  const buttons = previous.endpoints.map(endpoint => {
    const matches = parts.filter(part => part.color === endpoint.color && part.bbox[1] > 0
      && part.bbox[3] < rows.length / 8 && silhouette(part) === endpoint.buttonMask);
    return matches.length === 1 ? matches[0] : null;
  });
  if (buttons.some(button => !button)) return null;
  const controlled = actor(parts, previous);
  const goalParts = parts.filter(part => silhouette(part) === previous.goalMask && part.color === previous.goalColor);
  if (!controlled || goalParts.length !== 1) return null;
  const goal = goalParts[0]!.bbox, length = height(previous.endpoints[0]!.box);
  const bars = parts.filter(part => part.rectangular && part.bbox[1] > previous.endpoints[0]!.button[3] + 4
    && Math.min(width(part.bbox), height(part.bbox)) === 1 && part.area === length);
  const layouts: Scene[] = [];
  const start = center(controlled);
  for (const wall of bars) {
    if (width(wall.bbox) !== 1 || start[1] < wall.bbox[1] || start[1] > wall.bbox[3]) continue;
    const horizontal = bars.filter(part => part.color === wall.color && height(part.bbox) === 1);
    if (horizontal.length !== 3) continue;
    const getRoom = (point: NativePoint) => {
      const value = rows[point[1]]?.[point[0]];
      const candidates = parts.filter(part => part.color === value && width(part.bbox) >= length
        && height(part.bbox) >= length && contains(part.bbox, point));
      return candidates.length === 1 ? candidates[0]!.bbox : null;
    };
    const [wallX, wallY] = center(wall.bbox);
    const departure = getRoom([wallX + Math.sign(start[0] - wallX), wallY]);
    if (!departure || !contains(departure, start)) continue;
    for (const ceiling of horizontal) {
      const [x, y, r] = ceiling.bbox;
      const floor = horizontal.find(part => part.bbox[0] === x && part.bbox[2] === r && part.bbox[1] > y + length);
      const terminal = horizontal.find(part => part !== ceiling && part !== floor);
      if (!floor || !terminal || terminal.bbox[1] !== y) continue;
      const relayRoom = getRoom([center(ceiling.bbox)[0], y + 1]), finalRoom = getRoom([center(terminal.bbox)[0], y + 1]);
      if (!relayRoom || !finalRoom || relayRoom[1] !== y + 1 || relayRoom[3] !== floor.bbox[1] - 1
        || !contains(finalRoom, center(goal)) || contains(relayRoom, center(goal)) || contains(departure, center(goal))) continue;
      const bind = (part: Part, i: number): Endpoint => ({
        box: part.bbox, point: [part.bbox[0] + Math.floor(width(part.bbox) / 2), part.bbox[1] + Math.floor(height(part.bbox) / 2)],
        button: buttons[i]!.bbox, color: buttons[i]!.color,
      });
      const entrance = bind(wall, 0), relayExit = bind(ceiling, 1);
      layouts.push({ ...previous, goal, endpoints: [entrance, relayExit], relay: [
        { pair: [entrance, relayExit], departure, arrival: relayRoom, floor: floor.bbox[1] },
        { pair: [bind(floor, 0), bind(terminal, 1)], departure: relayRoom, arrival: finalRoom, floor: goal[3] + 1 },
      ] });
    }
  }
  return layouts.length === 1 ? layouts[0]! : null;
}

function discoverFallLink(parts: Part[], rows: NativeRows, previous: Scene): Scene | null {
  const controlled = actor(parts, previous);
  const gap = previous.footGap;
  const goals = parts.filter(part => part.color === previous.goalColor && silhouette(part) === previous.goalMask);
  if (!controlled || !gap || goals.length !== 1 || previous.endpoints.length !== 2) return null;
  const goal = goals[0]!.bbox, [x, y] = center(controlled), [gx] = center(goal);
  const near = rows[y]?.[controlled[0] - 1];
  const span = height(previous.endpoints[0]!.box);
  const air = parts.filter(part => part.color === near && part.area > span * span);
  const departure = air.find(part => contains(part.bbox, [x, y]));
  const arrival = air.find(part => contains(part.bbox, center(goal)));
  if (!departure || !arrival || departure === arrival) return null;
  const buttons = previous.endpoints.map(endpoint => parts.filter(part => part.color === endpoint.color
    && part.bbox[1] > 0 && part.bbox[3] < rows.length / 8 && silhouette(part) === endpoint.buttonMask));
  if (buttons.some(matches => matches.length !== 1)) return null;
  const bars = parts.filter(part => part.rectangular && part.bbox[1] > controlled[1]
    && Math.min(width(part.bbox), height(part.bbox)) === 1 && part.color !== near);
  const supports = bars.filter(part => height(part.bbox) === 1 && width(part.bbox) >= width(controlled));
  const shelves = supports.filter(part => part.bbox[1] === controlled[3] + gap && contains(part.bbox, [x, part.bbox[1]]));
  if (shelves.length !== 1) return null;
  const shelf = shelves[0]!;
  const landings = supports.filter(part => part.color === shelf.color && part.bbox[1] === goal[3] + 1
    && contains(part.bbox, [gx, part.bbox[1]]));
  if (landings.length !== 1) return null;
  const landing = landings[0]!.bbox;
  const entrances = supports.filter(part => part.color !== shelf.color && part.bbox[1] > shelf.bbox[1] + span
    && width(part.bbox) <= span && contains(departure.bbox, [center(part.bbox)[0], part.bbox[1] - 1]));
  const layouts: Scene[] = [];
  const bind = (part: Part, i: number): Endpoint => ({ box: part.bbox, point: center(part.bbox),
    button: buttons[i]![0]!.bbox, color: buttons[i]![0]!.color, buttonMask: previous.endpoints[i]!.buttonMask });
  for (const entrance of entrances) {
    const [px, py] = center(entrance.bbox);
    if ((px >= shelf.bbox[0] && px <= shelf.bbox[2]) || py !== departure.bbox[3] + 1) continue;
    for (const exit of bars) {
      if (width(exit.bbox) !== 1 || height(exit.bbox) !== span || exit.color !== entrance.color) continue;
      const [ex, ey] = center(exit.bbox), direction = Math.sign(gx - ex);
      if (!direction || ey >= landing[1] || !contains(arrival.bbox, [ex + direction, ey])
        || contains(arrival.bbox, [ex - direction, ey])) continue;
      layouts.push({ ...previous, goal, endpoints: [bind(entrance, 0), bind(exit, 1)],
        flight: { departure: departure.bbox, arrival: arrival.bbox, shelf: shelf.bbox, landing, releaseDirection: direction } });
    }
  }
  return layouts.length === 1 ? layouts[0]! : null;
}

function matchesPixels(rows: NativeRows, [l, t]: NativePoint, pixels: NativeRows): boolean {
  return pixels.every((row, y) => row.every((ink, x) => ink === rows[t + y]?.[l + x]));
}

function loadAt(parts: Part[], rows: NativeRows, load: Pick<LinkedLoad, 'button' | 'pixels'>): NativeBox[] {
  const size = load.pixels.length * load.pixels[0]!.length;
  return parts.filter(p => p.area === size - 1 && p.bbox[1] > load.button[3]
    && width(p.bbox) === load.pixels[0]!.length && height(p.bbox) === load.pixels.length
    && matchesPixels(rows, [p.bbox[0], p.bbox[1]], load.pixels)).map(p => p.bbox);
}

function region(rows: NativeRows, [left, top, right, bottom]: NativeBox): NativeRows {
  return rows.slice(top, bottom + 1).map(row => row.slice(left, right + 1));
}

function discoverPlateLink(parts: Part[], rows: NativeRows, previous: Scene): Scene | null {
  const standing = actor(parts, previous), gap = previous.footGap;
  if (!standing || !gap || previous.endpoints.length !== 2) return null;
  const goals = parts.filter(part => part.color === previous.goalColor && silhouette(part) === previous.goalMask);
  if (goals.length !== 1) return null;
  const goal = goals[0]!.bbox, [startX] = center(standing), [targetX] = center(goal);
  const passage = rows[standing[1]]?.[standing[0] - 1];
  if (passage === undefined || standing[3] + gap !== goal[3] + 1) return null;
  const span = Math.max(...previous.endpoints.map(endpoint => Math.max(width(endpoint.box), height(endpoint.box))));
  const rooms = parts.filter(part => part.color === passage && part.area > span * span
    && part.bbox[1] > previous.endpoints[0]!.button[3] + 4);
  const departure = rooms.find(part => contains(part.bbox, center(standing)))?.bbox;
  const exitRoom = rooms.find(part => contains(part.bbox, center(goal)))?.bbox;
  const direction = Math.sign(targetX - startX);
  if (!departure || !exitRoom || !direction) return null;
  const between = (x: number, a: number, b: number) => (x - a) * direction > 0 && (b - x) * direction > 0;
  const middle = rooms.filter(part => part.bbox !== departure && part.bbox !== exitRoom
    && between(center(part.bbox)[0], startX, targetX));
  if (middle.length !== 1) return null;
  const receiving = middle[0]!.bbox, floor = standing[3] + gap;
  const plates = parts.filter(part => part.rectangular && height(part.bbox) === 1 && part.bbox[1] === floor - 1
    && part.area >= width(standing) && between(center(part.bbox)[0], startX, targetX));
  const firing = plates.filter(part => contains(departure, center(part.bbox)));
  const final = plates.filter(part => contains(receiving, center(part.bbox)) && part.color === firing[0]?.color);
  if (firing.length !== 1 || final.length !== 1) return null;
  const gateBetween = (a: NativeBox, b: NativeBox): NativeBox => {
    const [left, right] = a[0] < b[0] ? [a[2] + 1, b[0] - 1] : [b[2] + 1, a[0] - 1];
    return [left, standing[1] - height(standing), right, standing[3]];
  };
  const shutter = gateBetween(departure, receiving), exitGate = gateBetween(receiving, exitRoom);
  if ([shutter, exitGate].some(box => width(box) < 1 || width(box) >= span || gateClear(rows, box, passage))) return null;
  const buttons = previous.endpoints.map(endpoint => parts.filter(part => part.color === endpoint.color
    && part.bbox[1] > 0 && part.bbox[3] < rows.length / 8 && silhouette(part) === endpoint.buttonMask));
  if (buttons.some(matches => matches.length !== 1)) return null;
  const releases = parts.filter(part => part.rectangular && width(part.bbox) === 1 && height(part.bbox) === span
    && part.bbox[0] >= exitGate[0] && part.bbox[0] <= exitGate[2] && part.bbox[3] < floor - height(standing)
    && contains(receiving, [part.bbox[0] - direction, center(part.bbox)[1]]));
  const pairs: [NativeBox, NativeBox][] = [];
  for (const release of releases) {
    const scan = rows[floor]!;
    for (let x = departure[0]; x + span - 1 <= departure[2]; x++) {
      const end = x + span - 1;
      if (scan[x - 1] === release.color || scan[end + 1] === release.color
        || !scan.slice(x, end + 1).every(ink => ink === release.color)) continue;
      pairs.push([[x, floor, end, floor], release.bbox]);
    }
  }
  if (pairs.length !== 1) return null;
  const handles = parts.filter(part => part.bbox[1] > 0 && part.bbox[3] < rows.length / 8
    && part.area === 2 * (width(part.bbox) + height(part.bbox) - 2) && !part.rectangular);
  const loads = parts.flatMap(part => {
    const [x, y] = center(part.bbox), w = width(part.bbox), h = height(part.bbox);
    if (w < 3 || h < 3 || w > span || h > span || part.area !== w * h - 1 || !contains(departure, [x, y])
      || Math.abs(x - startX) > span || part.bbox[3] !== floor - 1) return [];
    const pixels = region(rows, part.bbox);
    return handles.filter(handle => {
      const [cx, cy] = center(handle.bbox);
      return width(handle.bbox) >= w + 2 && height(handle.bbox) >= h + 2
        && matchesPixels(rows, [cx - Math.floor(w / 2), cy - Math.floor(h / 2)], pixels);
    }).map(handle => ({ button: handle.bbox, idle: handle.color, pixels }));
  });
  if (loads.length !== 1) return null;
  const endpoints = pairs[0]!.map((box, index) => {
    const button = buttons[index]![0]!;
    return { box, point: center(box), button: button.bbox, color: button.color, buttonMask: silhouette(button) };
  });
  return { ...previous, goal, endpoints, plateLink: { ...loads[0]!, passage, departure, receiving,
    firingPlate: firing[0]!.bbox, exitPlate: final[0]!.bbox, shutter, closed: region(rows, shutter), exitGate, floor } };
}

function loadedActor(parts: Part[], rows: NativeRows, scene: Scene): NativeBox | null {
  const plain = actor(parts, scene);
  if (plain) return plain;
  const load = scene.plateLink!, pixels = load.pixels, badge = pixels[Math.floor(pixels.length / 2)]![Math.floor(pixels[0]!.length / 2)];
  const body = scene.actorMask.split(';').map(token => token.split(',').map(Number));
  const maxX = Math.max(...body.map(point => point[0]!)), maxY = Math.max(...body.map(point => point[1]!));
  if (badge === undefined || badge === scene.actorColor || body.length < 4) return null;
  const poses: NativeBox[] = [];
  for (const mark of parts.filter(part => part.color === badge && part.area === 1 && part.bbox[1] > load.button[3] + 4)) {
    for (const reflected of [false, true]) {
      const mask = body.map(([x, y]) => [reflected ? maxX - x! : x!, y!]);
      for (const [x, y] of mask) {
        const left = mark.bbox[0] - x!, top = mark.bbox[1] - y!;
        if (!mask.every(([dx, dy]) => rows[top + dy!]?.[left + dx!] === (dx === x && dy === y ? badge : scene.actorColor))) continue;
        const box: NativeBox = [left, top, left + maxX, top + maxY];
        const occupied = new Set(mask.map(point => point.join(',')));
        if (region(rows, box).every((row, dy) => row.every((ink, dx) => ink !== scene.actorColor || occupied.has(dx + ',' + dy)))
          && !poses.some(item => sameBounds(item, box))) poses.push(box);
      }
    }
  }
  return poses.length === 1 ? poses[0]! : null;
}

function shutterChanged(rows: NativeRows, link: PlateLink) {
  return !matchesPixels(rows, [link.shutter[0], link.shutter[1]], link.closed);
}

function visibleExitPassage(rows: NativeRows, link: PlateLink, [l, t, r, b]: NativeBox) {
  const [left, top, right, bottom] = link.exitGate;
  let visible = 0;
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
    if (x >= l && x <= r && y >= t - 1 && y <= b + 1) continue;
    if (rows[y]?.[x] !== link.passage) return false;
    visible++;
  }
  return visible > 0;
}

function plateLinkChoice(local: State, rows: NativeRows, controlled: NativeBox, partList: Part[]): Choice | null {
  const { scene, crossed, held, stationed, selected } = local, link = scene.plateLink!;
  const [x] = center(controlled);
  const walk = (target: NativeBox, reason: string): Choice | null => {
    const direction = Math.sign(center(target)[0] - x);
    return direction ? { kind: 'walk', input: direction < 0 ? 'ACTION3' : 'ACTION4', direction, target, index: 0, reason } : null;
  };
  if (stationed) return visibleExitPassage(rows, link, controlled)
    ? walk(scene.goal, 'Keep the cube on the exit plate while crossing the open passage') : null;
  if (!crossed && !contains(link.departure, center(controlled))) return null;
  if (!held) {
    const cargo = loadAt(partList, rows, link);
    return cargo.length === 1 && Math.abs(center(cargo[0]!)[0] - x) <= Math.max(width(controlled), width(cargo[0]!)) + 2
      ? { kind: 'take', input: 'ACTION6', point: center(link.button), target: cargo[0]!, index: 0,
        reason: 'Pick up the nearby cube and keep it available for the exit plate' } : null;
  }
  if (crossed) {
    if (controlled[3] + scene.footGap! < link.floor) return {
      kind: 'settle', input: 'ACTION2', index: 1, target: link.exitPlate, reason: 'Let the redirected sprite land while keeping the cube',
    };
    if (!gateClear(rows, link.exitGate, link.passage) || !contains(link.exitPlate, [x, link.floor - 1])) {
      return walk(link.exitPlate, 'Carry the cube to the plate that opens the exit passage');
    }
    return { kind: 'drop', input: 'ACTION6', point: center(link.button), index: 1, target: link.exitPlate,
      reason: 'Leave the cube on the exit plate so it can replace the sprite as a weight' };
  }
  const pending = scene.endpoints.findIndex(endpoint => !placed(rows, endpoint));
  if (pending < 0) return walk(scene.endpoints[0]!.box, 'Leave the firing plate and use the retained portal pair');
  if (!shutterChanged(rows, link) || !contains(link.firingPlate, [x, link.floor - 1])) {
    return walk(link.firingPlate, 'Press the firing plate with the sprite to uncover the shot');
  }
  const endpoint = scene.endpoints[pending]!;
  return selected === pending ? { kind: 'place', input: 'ACTION6', point: endpoint.point, target: endpoint.box, index: pending,
    reason: 'Place the opening while the firing plate holds the shutter open' }
    : { kind: 'select', input: 'ACTION6', point: center(endpoint.button), target: endpoint.button, index: pending,
      reason: 'Select the control for the other end of the link' };
}

function plateLinkReturn(proposal: Proposal, before: NativeRows, after: NativeRows): { reason: string; stationed?: NativeBox } | null {
  const { local, choice, actor: first } = proposal, { scene } = local, link = scene.plateLink!, parts = geometricComponents(after);
  const cargo = loadAt(parts, after, link);
  const idle = after[link.button[1]]?.[link.button[0]] === link.idle;
  const second = idle ? actor(parts, scene) : loadedActor(parts, after, scene);
  if (!second) return null;
  if (choice.kind === 'take') return !idle && !cargo.length && sameBounds(first, second) ? { reason: 'cube_pickup_observed' } : null;
  if (choice.kind === 'drop') {
    const [cube] = cargo;
    return idle && cargo.length === 1 && cube && gateClear(after, link.exitGate, link.passage)
      && contains(link.exitPlate, [center(cube)[0], cube[3]]) && first[3] - second[3] === height(cube)
      ? { reason: 'cube_holds_exit_plate', stationed: cube } : null;
  }
  if (choice.kind === 'select' || choice.kind === 'place') {
    const reason = !idle && sameBounds(first, second) && shutterChanged(after, link) && checked(proposal, before, after);
    return reason ? { reason } : null;
  }
  if (local.stationed) return cargo.some(box => sameBounds(box, local.stationed!)) && visibleExitPassage(after, link, second)
    && Math.sign(center(second)[0] - center(first)[0]) === choice.direction ? { reason: 'cube_stays_on_exit_plate' } : null;
  if (idle) return null;
  const paired = scene.endpoints.every(endpoint => placed(after, endpoint));
  if (!paired && scene.endpoints.every(endpoint => placed(before, endpoint))) return null;
  if (!local.crossed && paired && contains(link.receiving, center(second))) return { reason: 'linked_crossing_observed' };
  if (choice.kind === 'settle') return paired && second[3] > first[3] ? { reason: 'carried_cube_landing_observed' } : null;
  if (Math.sign(center(second)[0] - center(first)[0]) !== choice.direction) return null;
  if (shutterChanged(before, link) && !shutterChanged(after, link) && paired) return { reason: 'portal_pair_survives_shutter_closure' };
  return { reason: 'approach_displacement_observed' };
}

function discoverLoad(parts: Part[], rows: NativeRows, previous: Scene): Scene | null {
  const standing = actor(parts, previous), gap = previous.footGap;
  const goals = parts.filter(p => p.color === previous.goalColor && silhouette(p) === previous.goalMask);
  if (!standing || !gap || goals.length !== 1) return null;
  const goal = goals[0]!, [sx] = center(standing), [gx] = center(goal.bbox);
  const plane = standing[3] + gap - 1;
  if (goal.bbox[3] !== plane || sx === gx) return null;
  let plateLeft = standing[0], plateRight = standing[2];
  while (rows[plane]?.[plateLeft - 1] === goal.color) plateLeft--;
  while (rows[plane]?.[plateRight + 1] === goal.color) plateRight++;
  if (plateLeft === standing[0] || plateRight === standing[2]) return null;
  const plate: NativeBox = [plateLeft, plane, plateRight, plane];
  const between = (x: number) => x > Math.min(sx, gx) && x < Math.max(sx, gx);
  const passage = rows[standing[1]]?.[standing[0] - 1];
  if (passage === undefined || passage === goal.color) return null;
  const length = height(previous.endpoints[0]!.box);
  const beacons = parts.filter(p => p.area === 1 && p.color === goal.color && between(p.bbox[0])
    && !contains(plate, center(p.bbox)));
  const gates = beacons.flatMap<NativeBox>(top => beacons.filter(bottom => bottom.bbox[1] === plane
    && top.bbox[1] <= standing[1] - gap && plane - top.bbox[1] <= length * 2
    && Math.abs(top.bbox[0] - bottom.bbox[0]) < length / 2)
    .map(bottom => [Math.min(top.bbox[0], bottom.bbox[0]), top.bbox[1] + 1, Math.max(top.bbox[0], bottom.bbox[0]), standing[1] - gap]));
  const open = gates.filter(box => gateClear(rows, box, passage));
  if (open.length !== 1) return null;
  const buttons = previous.endpoints.map(endpoint => parts.filter(part => part.color === endpoint.color && part.bbox[1] > 0
    && part.bbox[3] < rows.length / 8 && silhouette(part) === endpoint.buttonMask));
  if (buttons.some(matches => matches.length !== 1)) return null;
  const controls = parts.filter(p => p.bbox[1] > 0 && p.bbox[3] < rows.length / 8
    && p.area === 2 * (width(p.bbox) + height(p.bbox) - 2) && !p.rectangular);
  const bars = parts.filter(p => p.rectangular && p.area === length && p.bbox[1] >= rows.length / 8
    && Math.min(width(p.bbox), height(p.bbox)) === 1);
  const layouts: Scene[] = [];
  const room = (box: NativeBox) => parts.find(p => p.color === passage && p.area > length * length
    && contains(p.bbox, center(box)));
  const homeRoom = room(standing);
  if (!homeRoom) return null;
  for (const source of parts) {
    const w = width(source.bbox), h = height(source.bbox);
    if (w < 3 || h < 3 || w > length || h > length || source.area !== w * h - 1) continue;
    const [l, t, r, b] = source.bbox;
    const sourceRoom = room(source.bbox);
    if (!sourceRoom || sourceRoom === homeRoom || sourceRoom.bbox[0] <= homeRoom.bbox[2] && homeRoom.bbox[0] <= sourceRoom.bbox[2]) continue;
    const pixels = rows.slice(t, b + 1).map(row => row.slice(l, r + 1));
    const matched = controls.filter(control => {
      const [x, y] = center(control.bbox);
      return width(control.bbox) >= w + 2 && height(control.bbox) >= h + 2
        && matchesPixels(rows, [x - Math.floor(w / 2), y - Math.floor(h / 2)], pixels);
    });
    if (matched.length !== 1) continue;
    const floor = bars.filter(p => height(p.bbox) === 1 && p.bbox[1] === b + 1 && p.bbox[0] <= l && p.bbox[2] >= r);
    if (floor.length !== 1) continue;
    const home = bars.filter(p => width(p.bbox) === 1 && p.color === floor[0]!.color && p.bbox[3] === plane
      && Math.abs(p.bbox[0] - sx) < length * 2
      && contains(homeRoom.bbox, [p.bbox[0] + Math.sign(sx - p.bbox[0]), center(p.bbox)[1]]));
    if (home.length !== 1) continue;
    const endpoints = [home[0]!, floor[0]!].map((p, i) => {
      const button = buttons[i]![0]!;
      return { box: p.bbox, point: [p.bbox[0] + Math.floor(width(p.bbox) / 2), p.bbox[1] + Math.floor(height(p.bbox) / 2)] as NativePoint,
        button: button.bbox, color: button.color, buttonMask: silhouette(button) };
    });
    layouts.push({ ...previous, endpoints, goal: goal.bbox, load: {
      button: matched[0]!.bbox, idle: matched[0]!.color, source: source.bbox, pixels, standing, plate, gate: open[0]!, passage,
    } });
  }
  return layouts.length === 1 ? layouts[0]! : null;
}

function gateClear(rows: NativeRows, [l, t, r, b]: NativeBox, passage: number): boolean {
  return rows.slice(t, b + 1).every(row => row.slice(l, r + 1).every(ink => ink === passage));
}

function loadChoice(local: State, rows: NativeRows, controlled: NativeBox, partList: Part[]): Choice | null {
  const { scene, stationed, held } = local, load = scene.load!;
  if (!gateClear(rows, load.gate, load.passage)) return null;
  if (stationed) {
    const direction = Math.sign(center(scene.goal)[0] - center(controlled)[0]);
    return direction ? { kind: 'walk', input: direction < 0 ? 'ACTION3' : 'ACTION4', target: scene.goal,
      index: 0, direction, reason: 'Leave the load on the support and verify that the exit remains accessible' } : null;
  }
  if (held) return { kind: 'drop', input: 'ACTION6', point: center(load.button), target: load.plate, index: 0,
    reason: 'Place the carried load on the support currently occupied by the moving sprite' };
  if (!sameBounds(controlled, load.standing)) return null;
  const missing = scene.endpoints.findIndex(endpoint => !placed(rows, endpoint));
  if (missing >= 0) {
    const endpoint = scene.endpoints[missing]!;
    return local.selected === missing
      ? { kind: 'place', input: 'ACTION6', point: endpoint.point, target: endpoint.box, index: missing,
        reason: missing ? 'Test whether linking the surface below the load brings it to the moving sprite'
          : 'Place an opening near the occupied support to receive the load' }
      : { kind: 'select', input: 'ACTION6', point: center(endpoint.button), target: endpoint.button, index: missing,
        reason: 'Select the control for the next opening' };
  }
  const nearby = loadAt(partList, rows, load).filter(box => !sameBounds(box, load.source)
    && Math.abs(center(box)[0] - center(controlled)[0]) <= width(controlled) + width(box)
    && Math.abs(box[3] - controlled[3]) <= scene.footGap!);
  return nearby.length === 1 ? { kind: 'take', input: 'ACTION6', point: center(load.button), target: nearby[0]!, index: 0,
    reason: 'Test the matching interaction control now that the load has arrived within reach' } : null;
}

function loadReturn(proposal: Proposal, before: NativeRows, after: NativeRows): { reason: string; stationed?: NativeBox } | null {
  const { local, choice, actor: first } = proposal, { scene } = local, load = scene.load!;
  const parts = geometricComponents(after), second = actor(parts, scene);
  const cargo = loadAt(parts, after, load);
  const buttonIdle = after[load.button[1]]?.[load.button[0]] === load.idle;
  if (!gateClear(after, load.gate, load.passage)) return null;
  if (choice.kind === 'take') {
    const anchored = matchesPixels(after, [first[0], first[1] - 1], [before[first[1] - 1]!.slice(first[0], first[2] + 1)]);
    return anchored && !buttonIdle && !cargo.length ? { reason: 'load_acquired_at_current_support' } : null;
  }
  if (!second) return null;
  if (choice.kind === 'drop') {
    const [box] = cargo;
    return cargo.length === 1 && box && contains(load.plate, [center(box)[0], box[3]])
      && center(box)[0] === center(second)[0] && first[3] - second[3] === height(box) && buttonIdle
      ? { reason: 'load_replaced_sprite_on_support', stationed: box } : null;
  }
  if (choice.kind === 'walk') {
    return local.stationed && cargo.some(box => sameBounds(box, local.stationed!))
      && Math.sign(center(second)[0] - center(first)[0]) === choice.direction
      ? { reason: 'load_holds_passage_open_as_sprite_leaves' } : null;
  }
  if (!sameBounds(first, second)) return null;
  const endpoint = scene.endpoints[choice.index]!, peer = scene.endpoints[1 - choice.index]!;
  if (choice.kind === 'select') return endpointKey(after, endpoint) && !endpointKey(after, peer)
    ? { reason: 'control_selection_observed' } : null;
  if (choice.kind !== 'place' || placed(before, endpoint) || !placed(after, endpoint)) return null;
  if (!placed(before, peer)) return { reason: 'opening_symbol_observed' };
  const remaining = cargo.filter(box => !sameBounds(box, load.source)
    && Math.abs(center(box)[0] - center(first)[0]) <= width(first) + width(box));
  return cargo.length === 1 && remaining.length === 1
    ? { reason: 'linked_opening_moved_load_without_moving_sprite' } : null;
}

function placed(rows: NativeRows, endpoint: Endpoint): boolean {
  const [x, top, right, bottom] = endpoint.box;
  let count = 0;
  for (let y = top; y <= bottom; y++) for (let u = x; u <= right; u++) count += Number(rows[y]?.[u] === endpoint.color);
  return count >= width(endpoint.box) * height(endpoint.box) / 2;
}

function endpointKey(rows: NativeRows, endpoint: Endpoint): boolean {
  const [x, y] = center(endpoint.button);
  return rows[endpoint.button[1] - 1]?.[x] !== rows[y]?.[Math.min(rows[0]!.length - 1, endpoint.button[2] + 2)];
}

function choose(local: State, rows: NativeRows, controlled: NativeBox): Choice | null {
  const { scene, selected } = local;
  const ready = scene.endpoints.map(endpoint => placed(rows, endpoint));
  const [x] = center(controlled);
  const pending = scene.endpoints.map((_, i) => i).filter(i => !ready[i])
    .sort((a, b) => Math.abs(scene.endpoints[a]!.point[0] - x) - Math.abs(scene.endpoints[b]!.point[0] - x))[0];
  if (pending !== undefined) {
    const endpoint = scene.endpoints[pending]!;
    if (selected !== pending) return { kind: 'select', input: 'ACTION6', point: center(endpoint.button),
      target: endpoint.button, index: pending, reason: 'Select the control symbol for the unlinked opening' };
    return { kind: 'place', input: 'ACTION6', point: endpoint.point, target: endpoint.box, index: pending,
      reason: 'Test placing this symbol on the visible opening' };
  }
  const [gx] = center(scene.goal);
  const [left, right] = scene.endpoints;
  const near = Math.abs(left!.point[0] - x) < Math.abs(right!.point[0] - x) ? 0 : 1;
  const goalSide = Math.abs(left!.point[0] - gx) < Math.abs(right!.point[0] - gx) ? 0 : 1;
  const target = near === goalSide ? scene.goal : scene.endpoints[near]!.box;
  const direction = Math.sign(center(target)[0] - x);
  if (!direction) return null;
  return { kind: 'walk', input: direction < 0 ? 'ACTION3' : 'ACTION4', direction, target, index: near,
    reason: near === goalSide ? 'Approach the exit from the linked side' : 'Test passage through the linked opening' };
}

function relayChoice(local: State, rows: NativeRows, controlled: NativeBox): Choice | null {
  const { scene } = local, relay = scene.relay!, leg = local.leg ?? 0;
  const traveled = leg ? relay[leg - 1] : null, next = relay[leg];
  if (traveled && controlled[3] + scene.footGap! < traveled.floor) {
    const [l, , r] = traveled.arrival;
    return { kind: 'settle', input: 'ACTION2', index: 0, target: [l, traveled.floor - 1, r, traveled.floor - 1],
      reason: 'Observe where the sprite lands after emerging from the linked opening' };
  }
  if (next) {
    if (!contains(next.departure, center(controlled))) return null;
    const pending = next.pair.findIndex(endpoint => !placed(rows, endpoint));
    if (pending >= 0) {
      const endpoint = next.pair[pending]!;
      if (local.selected !== pending) return { kind: 'select', input: 'ACTION6', point: center(endpoint.button),
        target: endpoint.button, index: pending, reason: 'Select the control used for the next linked opening' };
      return { kind: 'place', input: 'ACTION6', point: endpoint.point, target: endpoint.box, index: pending,
        reason: leg ? 'Test a replacement link from the newly accessible platform' : 'Link the departure side to the platform above the next opening' };
    }
  }
  const target = next?.pair[0].box ?? scene.goal;
  const direction = Math.sign(center(target)[0] - center(controlled)[0]);
  if (!direction) return null;
  return { kind: 'walk', input: direction < 0 ? 'ACTION3' : 'ACTION4', target, direction, index: 0,
    reason: next ? 'Approach the entrance of the current link and verify the transfer' : 'Approach the exit after landing' };
}

function relayReturn({ local, choice, actor: first }: Proposal, before: NativeRows, after: NativeRows): string | null {
  const { scene } = local, leg = local.leg ?? 0, relay = scene.relay!, next = relay[leg];
  const second = actor(geometricComponents(after), scene);
  if (!second) return null;
  if ((choice.kind === 'select' || choice.kind === 'place') && next) {
    const selected = next.pair[choice.index]!, peer = next.pair[1 - choice.index]!;
    if (!sameBounds(first, second)) return null;
    if (choice.kind === 'select') return endpointKey(after, selected) && !endpointKey(after, peer)
      ? 'control_selection_observed' : null;
    return !placed(before, selected) && placed(after, selected) && placed(before, peer) === placed(after, peer)
      ? 'opening_symbol_observed' : null;
  }
  if (choice.kind === 'settle') {
    const last = relay[leg - 1];
    return last && contains(last.arrival, center(second)) && second[3] > first[3] && second[3] + scene.footGap! <= last.floor
      ? 'fall_toward_supported_pose_observed' : null;
  }
  if (choice.kind !== 'walk') return null;
  if (next && contains(next.departure, center(first)) && contains(next.arrival, center(second))) return 'linked_crossing_observed';
  const context = next?.departure ?? relay[1].arrival;
  return contains(context, center(second)) && Math.sign(center(second)[0] - center(first)[0]) === choice.direction
    ? 'approach_displacement_observed' : null;
}

function fallChoice(local: State, rows: NativeRows, controlled: NativeBox): Choice | null {
  const { scene, crossed, selected } = local;
  const { departure, arrival, shelf, landing } = scene.flight!;
  const [entrance] = scene.endpoints;
  const pose = center(controlled);
  const walk = (target: NativeBox, reason: string): Choice | null => {
    const direction = Math.sign(center(target)[0] - pose[0]);
    return direction ? { kind: 'walk', input: direction < 0 ? 'ACTION3' : 'ACTION4', target, direction, index: 0, reason } : null;
  };
  if (crossed) {
    if (!contains(arrival, pose)) return null;
    if (controlled[3] + scene.footGap! < landing[1]) {
      return { kind: 'settle', input: 'ACTION2', index: 1, target: landing,
        reason: 'Let the redirected movement finish and verify support on the landing platform' };
    }
    return supportedOnLanding(scene, controlled) ? walk(scene.goal, 'Approach the exit from the observed supported pose') : null;
  }
  if (!contains(departure, pose)) return null;
  const offShelf = entrance!.point[0] > shelf[2] ? controlled[0] > shelf[2] : controlled[2] < shelf[0];
  if (!offShelf) return walk(entrance!.box, 'Move beyond the edge of the support to expose the opening below');
  const pending = scene.endpoints.findIndex(endpoint => !placed(rows, endpoint));
  if (pending >= 0) {
    const endpoint = scene.endpoints[pending]!;
    if (selected !== pending) return { kind: 'select', input: 'ACTION6', point: center(endpoint.button),
      target: endpoint.button, index: pending, reason: 'Select the control for the second end of the link' };
    return { kind: 'place', input: 'ACTION6', point: endpoint.point, target: endpoint.box, index: pending,
      reason: pending ? 'Place the release opening facing the landing compartment' : 'Test placement on the opening below the falling sprite' };
  }
  if (pose[0] < entrance!.box[0] || pose[0] > entrance!.box[2]) {
    return walk(entrance!.box, 'Align the falling sprite with the entrance');
  }
  return { kind: 'settle', input: 'ACTION2', index: 0, target: entrance!.box,
    reason: 'Advance the fall with both openings placed and check for emergence in the other compartment' };
}

function supportedOnLanding(scene: Scene, pose: NativeBox) {
  const [left, top, right] = scene.flight!.landing;
  return pose[3] + scene.footGap! === top && pose[0] <= right && pose[2] >= left;
}

function fallReturn(proposal: Proposal, before: NativeRows, after: NativeRows): string | null {
  const { local, choice, actor: first } = proposal;
  const { scene, crossed } = local;
  const { arrival, departure } = scene.flight!;
  const second = actor(geometricComponents(after), scene);
  if (!second) return null;
  if (choice.kind === 'select' || choice.kind === 'place') {
    return sameBounds(first, second) ? checked(proposal, before, after) : null;
  }
  if (!crossed && choice.kind === 'settle' && contains(arrival, center(second)) && scene.endpoints.every(endpoint => placed(after, endpoint))) {
    return 'linked_crossing_observed';
  }
  if (!contains(crossed ? arrival : departure, center(second))) return null;
  if (choice.kind === 'walk' && Math.sign(center(second)[0] - center(first)[0]) === choice.direction) {
    return 'approach_displacement_observed';
  }
  if (choice.kind !== 'settle' || second[3] <= first[3]) return null;
  if (!crossed) return 'fall_toward_link_observed';
  return supportedOnLanding(scene, second) ? 'landing_support_observed' : 'flight_toward_support_observed';
}

function measuredRedirection(proposal: Proposal, frames: readonly NativeRows[]) {
  const { scene } = proposal.local;
  const { arrival, departure, releaseDirection } = scene.flight!;
  const [entrance, exit] = scene.endpoints;
  const positions = [proposal.actor, ...frames.map(rows => actor(geometricComponents(rows), scene)).filter(pose => pose !== null)];
  const release = positions.findIndex(pose => contains(arrival, center(pose)));
  if (release < 1) return null;
  const entryPose = positions[release - 1]!, releasePose = positions[release]!;
  if (!contains(departure, center(entryPose)) || entrance!.point[1] - entryPose[3] > width(entryPose) + scene.footGap!
    || Math.abs(exit!.point[0] - center(releasePose)[0]) > width(releasePose) + 1) return null;
  const departed = positions.slice(release + 1).some(pose => {
    const dx = center(pose)[0] - center(releasePose)[0], dy = center(pose)[1] - center(releasePose)[1];
    return Math.sign(dx) === releaseDirection && Math.abs(dx) > Math.abs(dy);
  });
  return departed ? { entry: entryPose, release: releasePose } : null;
}

function checked({ local, choice, actor: first }: Proposal, before: NativeRows, after: NativeRows): string | null {
  const endpoint = local.scene.endpoints[choice.index]!;
  if (choice.kind === 'select') {
    const other = local.scene.endpoints[1 - choice.index]!;
    if (endpointKey(after, endpoint) && !endpointKey(after, other)) return 'control_selection_observed';
    return null;
  }
  if (choice.kind === 'place') return !placed(before, endpoint) && placed(after, endpoint) ? 'opening_symbol_observed' : null;
  const second = actor(geometricComponents(after), local.scene);
  if (!second) return null;
  const [x0] = center(first), [x1] = center(second), dx = x1 - x0;
  const other = local.scene.endpoints[1 - choice.index]!;
  const separation = Math.abs(endpoint.point[0] - other.point[0]);
  if (Math.abs(dx) > separation / 2 && Math.abs(x1 - other.point[0]) < separation / 4) return 'linked_crossing_observed';
  return Math.sign(dx) === choice.direction ? 'approach_displacement_observed' : null;
}

export function createSicLinkOpenings(family = linkOpeningsId): NativeFamily<Proposal> {
  const learns = family === learnLinkOpeningsId;
  let state: State | null = null;
  let retained: PriorLink | null = null;
  let decide: NativeProgramHandle | undefined;
  return {
    id: family,
    async attachPrograms(registry) {
      if (learns) decide = await registry.registerProgram(chooseLanding, {}, await landingModule());
    },
    async propose(observation, rows, _inputs, remaining, execution): Promise<Proposal | null> {
      if (remaining < 1 || !['ACTION3', 'ACTION4', 'ACTION6'].every(id => observation.available_action_refs.includes(id))) return null;
      const parts = geometricComponents(rows);
      const prior = state?.epoch === observation.level_epoch ? state : null;
      const transfer = retained?.completed === observation.levels_completed ? retained : null;
      const scene = prior?.scene ?? discover(parts, rows)
        ?? (transfer ? discoverRelay(parts, rows, transfer.scene) ?? discoverLoad(parts, rows, transfer.scene)
          ?? discoverFallLink(parts, rows, transfer.scene) ?? discoverPlateLink(parts, rows, transfer.scene) : null);
      if (!scene) return null;
      const setup = scene.endpoints.map(endpoint => endpointKey(rows, endpoint));
      const selectedIndex = setup.filter(Boolean).length === 1 ? setup.indexOf(true) : null;
      const local: State = prior ?? { epoch: observation.level_epoch, scene, selected: selectedIndex,
        refs: (scene.relay || scene.load || scene.flight || scene.plateLink) && transfer ? [transfer.proof] : [], walkRef: null, crossed: false, rejected: [] };
      const controlled = local.held ? scene.plateLink ? loadedActor(parts, rows, scene) : scene.load!.standing : actor(parts, scene);
      if (!controlled) return null;
      const choice = scene.plateLink ? plateLinkChoice(local, rows, controlled, parts)
        : scene.load ? loadChoice(local, rows, controlled, parts)
        : scene.relay ? relayChoice(local, rows, controlled) : scene.flight ? fallChoice(local, rows, controlled) : choose(local, rows, controlled);
      if (!choice || !observation.available_action_refs.includes(choice.input)) return null;
      const attempt = JSON.stringify([choice.kind, choice.index, choice.input, controlled, local.selected, ...(scene.relay ? [local.leg ?? 0] : [])]);
      if (local.rejected.includes(attempt)) return null;
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...local.refs.filter(v => v !== ref)];
      const mode = execution?.reasoningMode ?? 'exploration';
      const offer = { input: choice.input, expected: center(choice.target), evidence };
      const reuse = choice.kind === 'walk' && local.walkRef !== null;
      const crossing = reuse && choice.target !== scene.goal && (scene.relay ? (local.leg ?? 0) < scene.relay.length : !local.crossed);
      const routeSupported = choice.kind === 'walk' && !!local.stationed || reuse && !crossing || choice.kind === 'settle' && !!local.settleRef;
      const facts = { eligibleProbe: !routeSupported, routeSupported, knownInteraction: false, mode };
      const decision = learns ? await decide?.run({ situation: facts }, { signal: execution?.signal }) : null;
      const navigation = learns ? null : resolveNavigationPrimitives({ mode, evidence,
        probe: routeSupported ? null : offer, access: routeSupported ? offer : null, interaction: null });
      const strategy = decision?.result ?? navigation?.selected?.id;
      if (strategy !== (routeSupported ? 'P07' : 'P05')) return null;
      const witness = choice.point ? await ObservedInputDomain.makeLocusWitness(observation, rows, choice.point, { reason: choice.reason, evidence }) : null;
      if (choice.point && !witness) return null;
      const parent = 'G_official_completion';
      const objective = { kind: scene.plateLink ? 'place_a_link_and_delegate_exit_support' : scene.load ? 'delegate_support_to_transferred_load'
        : scene.relay ? 'replace_links_along_the_route_to_exit' : scene.flight ? 'redirect_fall_into_exit_compartment'
          : 'link_opposite_openings_to_reach_exit', scope: ref.split(':revision:', 1)[0]!,
        subjects: scene.load || scene.plateLink ? ['visible_openings', 'actor', 'load', 'support', 'passage', 'exit']
          : ['visible_openings', 'control_symbols', 'actor', 'exit'],
        parentObjective: parent, satisfactionContract: 'official_progress_after_crossing' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = linkOpeningsId + ':' + need.id;
      const action: NativeCommand = { action_ref: choice.input, data: choice.point ? { x: choice.point[0], y: choice.point[1] } : {} };
      return {
        status: 'proposed', kind: family, local, choice, actor: controlled, needId: need.id, attempt,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions: [action],
        steps: [{ action, expected_after: choice.target, ...(witness ? { point_binding: witness } : {}) }],
        ...(decision ? { sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation: facts } } : {}),
        sicSituationCard: { strategy, need: scene.plateLink ? 'Prepare the link and keep a weight for the exit plate'
          : scene.load ? 'Keep the passage open after leaving the occupied support'
          : scene.relay ? 'Link each reachable compartment on the way to the exit'
          : scene.flight ? 'Reach the exit platform by linking the fall to the wall opening'
          : 'Link the two openings and reach the exit', situation: choice.reason, evidence,
          agenda: navigation?.entries ?? [], mode, triggerCard: navigation?.card ?? decision?.receipt.workflow,
          actor: controlled, target: choice.target, exit: scene.goal,
          ...(scene.load ? { load: loadAt(parts, rows, scene.load)[0] ?? null, loadControl: scene.load.button,
            support: scene.load.plate, passage: scene.load.gate } : {}),
          ...(scene.plateLink ? { load: loadAt(parts, rows, scene.plateLink)[0] ?? null, loadControl: scene.plateLink.button,
            support: local.crossed ? scene.plateLink.exitPlate : scene.plateLink.firingPlate,
            passage: local.crossed ? scene.plateLink.exitGate : scene.plateLink.shutter } : {}),
          ...(scene.flight ? { support: local.crossed ? scene.flight.landing : scene.flight.shelf,
            ...(local.redirection ? { redirection: local.redirection } : {}) } : {}),
          openings: (scene.relay?.flatMap(leg => leg.pair) ?? scene.endpoints).map(endpoint => endpoint.box) },
        question: { reason: choice.reason, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: choice.reason, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label: navigationPrimitives[strategy], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: choice.reason,
          preconditions: {}, preserve_refs: [], evidence, actions: [action], outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, _packet, current) {
      const admitted = index === 0 && proposal.binding?.observation_ref === current.observation_ref;
      return { admitted, reason: admitted ? 'opening_action_bound' : 'opening_layout_changed' };
    },
    after(proposal, _index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const reason = proposal.local.scene.plateLink ? plateLinkReturn(proposal, first, second)?.reason
        : proposal.local.scene.load ? loadReturn(proposal, first, second)?.reason
        : proposal.local.scene.relay ? relayReturn(proposal, first, second)
        : proposal.local.scene.flight ? fallReturn(proposal, first, second) : checked(proposal, first, second);
      return { matched: !!reason, seal_prefix: true, reason: reason ?? 'opening_effect_not_confirmed' };
    },
    record(before, after, _action, first, second, proposal, _index, frames) {
      const { local, choice } = proposal;
      if (after.levels_completed > before.levels_completed) {
        if (retained && (local.scene.relay && local.crossed || local.scene.load && local.stationed
          || local.scene.flight && local.crossed || local.scene.plateLink && local.stationed)) retained = {
          ...retained, completed: after.levels_completed, proof: after.observation_ref,
        };
        if (!local.scene.relay && !local.scene.load && !local.scene.flight && !local.scene.plateLink && local.crossed && local.walkRef) retained = {
          completed: after.levels_completed, scene: local.scene, proof: after.observation_ref,
        };
        return { events: [] };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const loadEffect = local.scene.plateLink ? plateLinkReturn(proposal, first, second)
        : local.scene.load ? loadReturn(proposal, first, second) : null;
      const reason = local.scene.load || local.scene.plateLink ? loadEffect?.reason
        : local.scene.relay ? relayReturn(proposal, first, second)
        : local.scene.flight ? fallReturn(proposal, first, second) : checked(proposal, first, second);
      const redirection = local.scene.flight && local.settleRef && reason === 'linked_crossing_observed'
        ? measuredRedirection(proposal, frames) : null;
      state = { ...local,
        selected: reason && choice.kind === 'select' ? choice.index : local.selected,
        walkRef: reason && choice.kind === 'walk' ? after.observation_ref : local.walkRef,
        crossed: local.crossed || reason === 'linked_crossing_observed',
        ...(local.scene.relay && reason === 'linked_crossing_observed' ? { leg: (local.leg ?? 0) + 1 } : {}),
        ...(choice.kind === 'settle' && reason ? { settleRef: after.observation_ref } : {}),
        ...(redirection ? { redirection } : {}),
        ...(choice.kind === 'take' && loadEffect ? { held: true } : {}),
        ...(loadEffect?.stationed ? { held: false, stationed: loadEffect.stationed } : {}),
        refs: reason ? [...local.refs.slice(-4), after.observation_ref] : local.refs,
        rejected: reason ? local.rejected : [...local.rejected, proposal.attempt] };
      return { events: [], ...(reason === 'portal_pair_survives_shutter_closure' ? {
        reviewEvidence: 'Both openings remain visible after the firing shutter closes.',
      } : reason === 'cube_holds_exit_plate' ? {
        reviewEvidence: 'The cube replaced the moving sprite on the plate and the exit passage stayed open.',
      } : redirection ? {
        reviewEvidence: 'The intermediate frames show vertical descent into one opening and horizontal movement away from the other.',
      } : {}) };
    },
    state: () => ({ state, retained }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as State | null);
      retained = structuredClone((value.retained as PriorLink | undefined) ?? null);
    },
  };
}

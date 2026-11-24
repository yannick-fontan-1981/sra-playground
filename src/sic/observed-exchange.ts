import type { NativeCommand, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import { readTravelGrid, type ObservedTravel } from './observed-travel-frontier.ts';
import { maximumCommittedActions } from './plan-step.ts';

type Cells = ReturnType<typeof readTravelGrid>['cells'];
type Move = { input: string; delta: NativePoint };
type Gate = { cell: string; mark: string; ink: number; opensWhenCovered: boolean; rest?: number[] };
type Layout = { marks: Record<string, number[]>; gates: Gate[]; exit?: string; wall: string };
type Pose = { actor: string; pieces: string[]; threats?: string[]; bridges?: string[] };
type Prediction = { command: string; pose: Pose };
type Exchange = { ref: string; from: string; to: string; turns: string[] };
type Reflection = { pixels: number[]; incoming: NativePoint; outgoing: NativePoint; ref: string };
type BridgeEffect = { delta: NativePoint; water: string; support: string };
type PressureOpening = { colors: number[]; closed: number[]; open: number[]; covered: number[]; ref: string; bridge?: BridgeEffect };
export type ObservedExchange = {
  body: string; layout: Layout; refs: string[]; supports: string[];
  turns: Record<string, NativePoint>; rejected: string[]; last: Exchange;
  transmission?: Record<string, string>;
  reflections?: Reflection[];
  openings?: PressureOpening[];
  lastTransport?: { ref: string; gate: string; control: string; support: string };
};
export type ExchangePlan = { command: NativeCommand; goal: 'test_transport' | 'reach_exit' | 'hold_control';
  subjects: string[]; focus: string; partner?: string; prediction: Prediction; evidence: string[]; series?: ExchangeSeries };
type ExchangeSeries = { start: Pose; steps: Prediction[]; grid: ObservedTravel['grid']; layout: Layout; body: string;
  terrain: Record<string, string> };
export type ExchangeTransfer = Pick<ObservedTravel, 'grid' | 'moves'> & {
  body: string; wall: string; actorInkCount: number; exitStamp: string; exchangeRef: string; scoreRef: string;
  transmission?: Record<string, string>;
  reflections?: Reflection[];
  openings?: PressureOpening[];
};
export type ExchangeThreat = { stamp: string; evidence: readonly [string, string] };
type Door = { shut: string; open: string; controls: string[]; bridge?: BridgeEffect };
type BoundField = { floor: string[]; marks: Record<string, string>; doors: Record<string, Door>;
  exit: string; fixed: Record<string, string>; threat?: ExchangeThreat; transmission?: string[];
  reflectors?: Record<string, Record<string, NativePoint>>; coveredMarks?: Record<string, number[]>; mechanismRefs?: string[];
  bridges?: Record<string, string> };
export type BoundExchange = { field: BoundField; pose: Pose };
type ExchangeStep = { action: NativeCommand; after: Pose };
export type BoundExchangePlan = BoundExchange & { roles: ExchangeTransfer; steps: ExchangeStep[]; pressureTarget?: string; bridgeTarget?: string };

const point = (cell: string) => cell.split(',').map(Number) as [number, number];
const step = (cell: string, [dx, dy]: NativePoint) => {
  const [x, y] = point(cell);
  return `${x + dx},${y + dy}`;
};
const tileId = (pixels: readonly number[] | undefined) => pixels?.join(',') ?? '';
const isUniform = (pixels: readonly number[]) => pixels.every(ink => ink === pixels[0]);
const poseKey = ({ actor, pieces, threats, bridges }: Pose) =>
  `${actor}|${[...pieces].sort().join(';')}${threats ? `|${[...threats].sort().join(';')}` : ''}${bridges ? `|support:${[...bridges].sort().join(';')}` : ''}`;
const trialKey = (pose: Pose, input: string, supports: readonly string[]) => `${poseKey(pose)}|${input}|${supports.join(';')}`;
const turnKey = (tile: readonly number[], incoming: NativePoint) => `${tileId(tile)}|${incoming.join(',')}`;
const directions = (travel: ObservedTravel) => Object.entries(travel.moves).map(([input, move]) => ({ input, delta: move.delta }));
const corners = [0, 2, 6, 8];
const orientations = [1, -1].flatMap(a => [1, -1].flatMap(b => [false, true].map(transpose =>
  ([x, y]: NativePoint): NativePoint => transpose ? [a * y, b * x] : [a * x, b * y])));
function orientedTile(pixels: readonly number[], transform: (point: NativePoint) => NativePoint): number[] {
  const result: number[] = [];
  pixels.forEach((ink, index) => {
    const [x, y] = transform([index % 3 - 1, Math.floor(index / 3) - 1]);
    result[(y + 1) * 3 + x + 1] = ink;
  });
  return result;
}

function markProfile(pixels: number[], pitch: number, floor: number) {
  if (pitch % 2 !== 1) return;
  const mid = Math.floor(pitch / 2), center = mid * pitch + mid, arm = pixels[mid]!;
  if (arm === floor || pixels[center] === floor) return;
  return pixels.every((ink, i) => i === center || ink === (i % pitch === mid || Math.floor(i / pitch) === mid ? arm : floor))
    ? [arm, pixels[center]!] : undefined;
}

function measureLayout(cells: Cells, actor: string, pitch: number, floor: number): Layout {
  const marks: Record<string, number[]> = {}, gates: Gate[] = [], exits: string[] = [];
  const materials = new Map<string, number>();
  const center = Math.floor(pitch * pitch / 2), corners = [0, pitch - 1, pitch * (pitch - 1), pitch * pitch - 1];
  for (const [cell, pixels] of cells) {
    if (cell === actor) continue;
    if (isUniform(pixels) && pixels[0] !== floor) {
      const id = tileId(pixels);
      materials.set(id, (materials.get(id) ?? 0) + 1);
    }
    const profile = markProfile(pixels, pitch, floor);
    if (profile) marks[cell] = profile;
  }
  const wall = [...materials].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  for (const [cell, pixels] of cells) {
    const rim = pixels[0]!;
    if (rim === floor || isUniform(pixels) || !corners.every(i => pixels[i] === rim)) continue;
    const compatible = Object.entries(marks).filter(([, [arm, accent]]) => rim === arm && (accent === arm || pixels.includes(accent!)));
    if (compatible.length === 1) {
      gates.push({ cell, mark: compatible[0]![0], ink: rim, opensWhenCovered: pixels[center] !== floor, rest: pixels });
    } else if (pixels[center] === floor && Object.values(marks).every(([arm]) => arm !== rim)) exits.push(cell);
  }
  return { marks, gates, wall, ...(exits.length === 1 ? { exit: exits[0]! } : {}) };
}

function getPose(layout: Layout, body: string, actor: string, cells: Cells): Pose {
  const shape = body.split(',').map(Number), center = Math.floor(shape.length / 2);
  return { actor, pieces: [...cells].flatMap(([cell, pixels]) => {
    if (cell === actor) return [];
    if (tileId(pixels) === body) return [cell];
    const overlay = layout.marks[cell];
    return overlay && pixels[center] === shape[center] &&
      pixels.filter((ink, i) => ink === shape[i]).length * 2 > pixels.length &&
      pixels.every((ink, i) => ink === shape[i] || overlay.includes(ink)) ? [cell] : [];
  }) };
}

// The animation can witness intermediate segments when the endpoints are not collinear.
// Extract only an unambiguous path through changed strips between cell centers.
function visibleTrace(from: string, to: string, moves: readonly Move[], pitch: number, before: NativeRows, animation?: NativeRows) {
  if (!animation) return;
  const mid = Math.floor(pitch / 2);
  const queue: { cell: string; route: { cell: string; delta: NativePoint }[]; ink?: number }[] = [{ cell: from, route: [] }];
  const seen = new Set([from]);
  for (const { cell, route, ink } of queue) {
    if (cell === to) return route;
    const [x, y] = point(cell);
    for (const { delta } of moves) {
      const next = step(cell, delta);
      if (seen.has(next)) continue;
      const [nx, ny] = point(next);
      const strip = Array.from({ length: pitch - 1 }, (_, i) => i + 1)
        .filter(offset => (cell !== from || offset > mid) && (next !== to || pitch - offset > mid))
        .map(offset => {
          const xx = x + mid + Math.sign(nx - x) * offset, yy = y + mid + Math.sign(ny - y) * offset;
          return animation[yy]?.[xx] !== before[yy]?.[xx] ? animation[yy]?.[xx] : undefined;
        });
      const shade = ink ?? strip[0];
      if (!strip.length || shade === undefined || !strip.every(value => value === shade)) continue;
      seen.add(next); queue.push({ cell: next, route: [...route, { cell: next, delta }], ink: shade });
    }
  }
}

export function observeExchange(local: ObservedExchange | undefined, old: ObservedTravel | undefined, travel: ObservedTravel | undefined,
  before: NativeRows, after: NativeRows, command: NativeCommand, ref: string, frames?: readonly NativeRows[],
  expected?: Prediction): ObservedExchange | undefined {
  if (!old?.actor || !travel?.actor || old.grid.ink !== travel.grid.ink) return local;
  const delta = old.moves[command.action_ref]?.delta;
  if (!local && (!delta || (frames?.length ?? 0) < 2 || travel.actor === old.actor)) return local;
  const { grid } = old, first = readTravelGrid(before, grid).cells, second = readTravelGrid(after, grid).cells;
  const landing = first.get(travel.actor), replacement = second.get(old.actor);
  const body = local?.body ?? tileId(landing);
  const layout = local?.layout ?? measureLayout(first, old.actor, grid.pitch, grid.floor);
  const start = getPose(layout, body, old.actor, first), returned = getPose(layout, body, travel.actor, second);
  const deltaTo = (a: string, b: string) => {
    const [x, y] = point(a), [u, v] = point(b);
    return [Math.sign(u - x), Math.sign(v - y)].join(',');
  };
  const swapped = !!landing && !isUniform(landing) && !!replacement && start.pieces.includes(travel.actor)
    && returned.pieces.includes(old.actor) && start.pieces.length === returned.pieces.length
    && start.pieces.every(piece => piece === travel.actor || returned.pieces.includes(piece));
  let result = local;
  if (swapped && delta) {
    const ray = visibleTrace(old.actor, travel.actor, directions(old), grid.pitch, before, frames?.[0]);
    const direct = deltaTo(old.actor, travel.actor) === deltaTo(old.actor, step(old.actor, delta));
    if (direct || ray?.length && ray[0]!.delta.every((value, i) => value === delta[i])) {
      const turns = { ...local?.turns }, transmission = { ...local?.transmission }, measured: string[] = [];
      const reflections = [...(local?.reflections ?? [])];
      for (let i = 0; ray && i + 1 < ray.length; i++) {
        const { cell, delta: incoming } = ray[i]!, outgoing = ray[i + 1]!.delta, pixels = first.get(cell);
        if (pixels && incoming.some((value, j) => value !== outgoing[j])) {
          const key = turnKey(pixels, incoming);
          if (grid.pitch === 3 && !reflections.some(sample => turnKey(sample.pixels, sample.incoming) === key
            && sample.outgoing.every((value, axis) => value === outgoing[axis]))) reflections.push({ pixels, incoming, outgoing, ref });
          turns[key] = outgoing;
          measured.push(cell);
        } else if (pixels && isUniform(pixels) && pixels[0] !== grid.floor) {
          const stamp = tileId(pixels);
          if (stamp !== layout.wall && stamp === tileId(second.get(cell))) transmission[stamp] ??= ref;
        }
      }
      result = { ...local, body, layout, turns, supports: local?.supports ?? [], rejected: local?.rejected ?? [],
        refs: [...(local?.refs ?? []).slice(-7), ref], last: { ref, from: old.actor, to: travel.actor, turns: measured },
        ...(Object.keys(transmission).length ? { transmission } : {}),
        ...(reflections.length ? { reflections: reflections.slice(-12) } : {}) };
    }
  }
  if (!result) return;
  for (const gate of result.layout.gates) {
    if (grid.pitch !== 3 || !gate.opensWhenCovered || held(start, gate.mark) || !held(returned, gate.mark)
      || held(start, gate.cell) || held(returned, gate.cell)) continue;
    const closed = first.get(gate.cell), open = second.get(gate.cell), covered = second.get(gate.mark);
    const colors: number[] | undefined = result.layout.marks[gate.mark];
    if (closed && open && covered && colors && closed[4] !== grid.floor && open[4] === grid.floor
      && closed[0] === colors[0] && open[0] === colors[0]
      && corners.every(index => colors.includes(covered[index]!))
      && !result.openings?.some(sample => tileId(sample.closed) === tileId(closed))) {
      result = { ...result, openings: [...(result.openings ?? []), { colors, closed, open, covered: corners.map(i => covered[i]!), ref }].slice(-8) };
    }
  }
  const transport = witnessedSupport(result, old, start, returned, first, second);
  if (transport) {
    const { gate, control, support, bridge } = transport;
    const open = result.layout.gates.find(item => item.cell === gate)?.rest, closed = second.get(gate);
    const colors: number[] | undefined = result.layout.marks[control], covered = second.get(control);
    const sample = grid.pitch === 3 && open && closed && colors && covered && open[4] === grid.floor && closed[4] !== grid.floor
      && corners.every(index => colors.includes(covered[index]!))
      ? { colors, closed, open, covered: corners.map(i => covered[i]!), ref, bridge } : undefined;
    return { ...result, supports: [...new Set([...result.supports, support])],
      ...(sample ? { openings: [...(result.openings ?? []), sample].slice(-8) } : {}),
      lastTransport: { gate, control, support, ref }, refs: [...result.refs.slice(-7), ref] };
  }
  if (expected && expected.command === command.action_ref && poseKey(expected.pose) !== poseKey(returned)) {
    const key = trialKey(start, command.action_ref, result.supports);
    result = { ...result, rejected: [...new Set([...result.rejected.slice(-127), key])] };
  }
  return result;
}

function witnessedSupport(local: ObservedExchange, travel: ObservedTravel, before: Pose, after: Pose, first: Cells, second: Cells) {
  if (before.pieces.length !== after.pieces.length + 1) return;
  for (const gate of local.layout.gates) {
    if (gate.opensWhenCovered || !before.pieces.includes(gate.cell) || after.pieces.includes(gate.cell)
      || before.actor === gate.mark || after.actor !== gate.mark) continue;
    const pitch = travel.grid.pitch;
    for (const delta of [[pitch, 0], [-pitch, 0], [0, pitch], [0, -pitch]] as NativePoint[]) {
      const cell = step(gate.cell, delta), prior = first.get(cell), current = second.get(cell);
      if (prior && current && isUniform(prior) && prior[0] !== travel.grid.floor && tileId(prior) !== local.layout.wall
        && !isUniform(current) && cell !== after.actor && !after.pieces.includes(cell)) {
        return { gate: gate.cell, control: gate.mark, support: cell, bridge: { delta, water: tileId(prior), support: tileId(current) } };
      }
    }
  }
}

export function assessExchange(local: ObservedExchange | undefined, travel: ObservedTravel | undefined,
  before: NativeRows, after: NativeRows, plan: ExchangePlan) {
  if (!local || !travel?.actor) return;
  const first = readTravelGrid(before, travel.grid).cells, second = readTravelGrid(after, travel.grid);
  if (second.pieces.length !== 1) return;
  const start = getPose(local.layout, local.body, travel.actor, first);
  const returned = getPose(local.layout, local.body, second.pieces[0]!, second.cells);
  const satisfied = plan.goal === 'test_transport' ? !!witnessedSupport(local, travel, start, returned, first, second.cells)
    : plan.goal === 'hold_control' && plan.subjects.every(cell => returned.pieces.includes(cell));
  return { matched: satisfied || poseKey(returned) === poseKey(plan.prediction.pose), satisfied };
}

export function rememberExchangeVictory(local: ObservedExchange | undefined, travel: ObservedTravel | undefined,
  rows: NativeRows, command: NativeCommand, ref: string): ExchangeTransfer | undefined {
  if (!local || !travel || travel.grid.pitch !== 3 || Object.keys(travel.moves).length !== 4) return;
  const { grid, moves } = travel, move = moves[command.action_ref];
  const { cells, pieces } = readTravelGrid(rows, grid);
  if (!move || pieces.length !== 1) return;
  const actor = pieces[0]!, destination = step(actor, move.delta);
  const exit = cells.get(destination), actorPixels = cells.get(actor);
  if (!exit || destination !== local.layout.exit || !actorPixels) return;
  const actorInkCount = actorPixels.filter(ink => ink === grid.ink).length;
  return { grid, moves, body: local.body, wall: local.layout.wall, actorInkCount,
    exitStamp: tileId(exit), exchangeRef: local.last.ref, scoreRef: ref,
    ...(local.transmission ? { transmission: local.transmission } : {}),
    ...(local.reflections ? { reflections: local.reflections } : {}),
    ...(local.openings ? { openings: local.openings } : {}) };
}

function adjacent(a: string, b: string, pitch: number): boolean {
  const [x, y] = point(a), [u, v] = point(b);
  return Math.abs(x - u) + Math.abs(y - v) === pitch;
}

/** Bind the terminal change to a witnessed exchange and a stationary neighbor
 * with the exact stamp that replaces the controlled sprite at the landing. */
export function observeExchangeThreat(roles: ExchangeTransfer, before: NativeRows, after: NativeRows,
  command: NativeCommand, evidence: ExchangeThreat['evidence']): ExchangeThreat | undefined {
  const move = roles.moves[command.action_ref];
  if (!move || !move.delta.some(Boolean)) return;
  const { grid, body } = roles, first = readTravelGrid(before, grid), last = readTravelGrid(after, grid);
  const actor = first.pieces[0];
  if (!actor || first.pieces.length !== 1 || last.pieces.length || tileId(last.cells.get(actor)) !== body) return;
  let landing = step(actor, move.delta);
  while (first.cells.get(landing)?.every(ink => ink === grid.floor)) landing = step(landing, move.delta);
  if (tileId(first.cells.get(landing)) !== body) return;
  const replaced = last.cells.get(landing);
  if (!replaced || isUniform(replaced)) return;
  const stamp = tileId(replaced);
  if ([body, roles.wall, roles.exitStamp].includes(stamp)) return;
  const neighbor = [...first.cells].some(([cell, pixels]) => adjacent(cell, landing, grid.pitch)
    && tileId(pixels) === stamp && tileId(last.cells.get(cell)) === stamp);
  if (neighbor) return { stamp, evidence };
}

function reflectionProfiles(samples: readonly Reflection[]) {
  const profiles = new Map<string, { turns: Record<string, NativePoint>; refs: Set<string>; conflicting: boolean }>();
  for (const sample of samples) for (const transform of orientations) {
    const stamp = tileId(orientedTile(sample.pixels, transform));
    const input = transform(sample.incoming).join(','), output = transform(sample.outgoing);
    const profile = profiles.get(stamp) ?? { turns: {}, refs: new Set<string>(), conflicting: false };
    if (profile.turns[input] && profile.turns[input].join(',') !== output.join(',')) profile.conflicting = true;
    profile.turns[input] = output;
    profile.refs.add(sample.ref);
    profiles.set(stamp, profile);
  }
  return profiles;
}

function bindPressureDoor(pixels: number[], marks: BoundField['marks'], roles: ExchangeTransfer, pose: Pose) {
  const openExit = roles.exitStamp.split(',').map(Number);
  const isExit = corners.every(i => pixels[i] === openExit[i]);
  const groups = new Map<string, string[]>();
  for (const [cell, stamp] of Object.entries(marks)) groups.set(stamp, [...(groups.get(stamp) ?? []), cell]);
  const matches = new Map<string, { door: Door; covered: number[]; ref: string; isExit: boolean }>();
  for (const sample of roles.openings ?? []) for (const [stamp, controls] of groups) {
    const mark = stamp.split(',').map(Number);
    const initiallyOpen = controls.every(cell => held(pose, cell)) !== !!sample.bridge;
    const bindColors = (tile: readonly number[]) => tile.map(ink => ink === sample.colors[0] ? mark[1]!
      : ink === sample.colors[1] ? mark[4]! : ink);
    for (const transform of orientations) {
      const shut = orientedTile(bindColors(sample.closed), transform);
      const opened = orientedTile(bindColors(sample.open), transform);
      if (initiallyOpen ? tileId(opened) !== tileId(pixels)
        : !pixels.every((ink, i) => ink === shut[i] || isExit && corners.includes(i))) continue;
      const open = isExit ? roles.exitStamp : tileId(opened);
      const covered = bindColors(sample.covered);
      const bridge = sample.bridge && { ...sample.bridge, delta: transform(sample.bridge.delta) };
      const door = { shut: isExit ? tileId(pixels) : tileId(shut), open, controls, ...(bridge ? { bridge } : {}) };
      matches.set(JSON.stringify([door, covered]), { door, covered, ref: sample.ref, isExit });
    }
  }
  if (matches.size === 1) return matches.values().next().value;
}

function bindExchangeField(roles: ExchangeTransfer, rows: NativeRows, threat?: ExchangeThreat): BoundExchange | undefined {
  const { grid } = roles, { cells, pieces } = readTravelGrid(rows, grid);
  if (pieces.length !== 1 || grid.pitch !== 3) return;
  const actor = pieces[0]!, floor: string[] = [], bodies: string[] = [], exits: string[] = [], threats: string[] = [];
  const marks: BoundField['marks'] = {}, doors: BoundField['doors'] = {}, fixed: BoundField['fixed'] = {};
  const transmission: string[] = [];
  const reflectors: NonNullable<BoundField['reflectors']> = {}, coveredMarks: Record<string, number[]> = {};
  const mechanismRefs = new Set<string>();
  const profiles = reflectionProfiles(roles.reflections ?? []);
  const unclassified = new Map<string, number[]>();
  const shutters = new Map<string, number>();
  for (const [cell, pixels] of cells) {
    const stamp = tileId(pixels), rim = pixels[0]!;
    if (cell === actor || stamp === roles.body || stamp === roles.exitStamp || stamp === threat?.stamp || pixels.every(ink => ink === grid.floor)) {
      floor.push(cell);
      if (stamp === roles.body) bodies.push(cell);
      if (stamp === threat?.stamp) threats.push(cell);
      if (stamp === roles.exitStamp) exits.push(cell);
    } else if (stamp === roles.wall) fixed[cell] = stamp;
    else if (isUniform(pixels) && roles.transmission?.[stamp]) {
      fixed[cell] = stamp;
      transmission.push(cell);
    } else {
      const mark = markProfile(pixels, grid.pitch, grid.floor);
      if (mark) marks[cell] = stamp;
      else if (rim !== grid.floor && pixels[4] !== rim && pixels[4] !== grid.floor
        && pixels.every((ink, index) => index === 4 || ink === rim)) shutters.set(cell, rim);
      else unclassified.set(cell, pixels);
    }
  }
  for (const [cell, pixels] of unclassified) {
    const stamp = tileId(pixels);
    const reflector = profiles.get(stamp);
    if (reflector && !reflector.conflicting && Object.keys(reflector.turns).length >= 2) {
      reflectors[cell] = reflector.turns;
      fixed[cell] = stamp;
      for (const ref of reflector.refs) mechanismRefs.add(ref);
      continue;
    }
    const opening = bindPressureDoor(pixels, marks, roles, { actor, pieces: bodies, threats });
    if (!opening) return;
    doors[cell] = opening.door;
    if (opening.isExit) exits.push(cell);
    for (const control of opening.door.controls) coveredMarks[control] = opening.covered;
    mechanismRefs.add(opening.ref);
  }
  if (!bodies.length || exits.length !== 1) return;
  const controls = Object.keys(marks);
  const inks = new Set(controls.map(cell => cells.get(cell)![4]));
  if (shutters.size && (inks.size !== 1 || [...shutters.values()].some(rim => !inks.has(rim)))) return;
  for (const [cell, rim] of shutters) {
    doors[cell] = { shut: tileId(cells.get(cell)), open: tileId(Array.from({ length: 9 }, (_, index) => corners.includes(index) ? rim : grid.floor)), controls };
  }
  if (controls.some(control => !Object.values(doors).some(door => door.controls.includes(control)))) return;
  const threatBinding = threat && threats.length && threats.every(a => threats.every(b => !adjacent(a, b, grid.pitch))) ? threat : undefined;
  if (threats.length && !threatBinding) return;
  const bridges: Record<string, string> = {};
  for (const [cell, door] of Object.entries(doors)) {
    if (!door.bridge) continue;
    const landing = step(cell, door.bridge.delta);
    if (fixed[landing] === door.bridge.water) bridges[landing] = door.bridge.support;
  }
  return { field: { floor: [...floor, ...controls, ...Object.keys(doors)], marks, doors, exit: exits[0]!, fixed,
      ...(transmission.length ? { transmission } : {}),
      ...(Object.keys(reflectors).length ? { reflectors } : {}),
      ...(Object.keys(coveredMarks).length ? { coveredMarks } : {}),
      ...(mechanismRefs.size ? { mechanismRefs: [...mechanismRefs] } : {}),
      ...(Object.keys(bridges).length ? { bridges } : {}),
      ...(threatBinding ? { threat: threatBinding } : {}) },
    pose: { actor, pieces: bodies, ...(threatBinding ? { threats } : {}) } };
}

function held(pose: Pose, cell: string) {
  return pose.actor === cell || pose.pieces.includes(cell) || !!pose.threats?.includes(cell);
}

function doorOpen(door: Door, pose: Pose) {
  return door.controls.every(mark => held(pose, mark)) !== !!door.bridge;
}

/** Reuse only the witnessed transport: one weight leaves a closing device
 * and becomes a stable foothold. Other occupied closures need fresh evidence. */
function settleExchangeDoors(field: BoundField, before: Pose, swapped: Pose, doorCells: readonly string[]): Pose | undefined {
  let settled = swapped;
  for (const cell of doorCells) {
    const door = field.doors[cell]!;
    if (!held(settled, cell) || doorOpen(door, settled)) continue;
    if (!door.bridge || !doorOpen(door, before) || !settled.pieces.includes(cell)) return;
    const landing = step(cell, door.bridge.delta);
    if (field.bridges?.[landing] !== door.bridge.support || held(settled, landing) || settled.bridges?.includes(landing)) return;
    settled = { ...settled, pieces: settled.pieces.filter(piece => piece !== cell), bridges: [...(settled.bridges ?? []), landing] };
  }
  return settled;
}

export function matchesBoundExchange(roles: ExchangeTransfer, field: BoundField, pose: Pose, rows: NativeRows): boolean {
  const { grid } = roles, { cells } = readTravelGrid(rows, grid), ground = new Set(field.floor);
  const body = roles.body.split(',').map(Number), threat = field.threat?.stamp.split(',').map(Number);
  for (const [cell, pixels] of cells) {
    const stamp = tileId(pixels), door = field.doors[cell], mark = field.marks[cell];
    const occupant = held(pose, cell);
    const support = pose.bridges?.includes(cell) ? field.bridges?.[cell] : undefined;
    if (door && (!doorOpen(door, pose) && occupant || !occupant && stamp !== (doorOpen(door, pose) ? door.open : door.shut))) return false;
    if (mark && occupant && corners.some((i, index) => pixels[i] !== (field.coveredMarks?.[cell]?.[index] ?? Number(mark.split(',')[4])))) return false;
    if (cell === pose.actor) {
      if (pixels[4] !== grid.ink || pixels.filter(ink => ink === grid.ink).length !== roles.actorInkCount) return false;
      if (door && corners.some(i => pixels[i] !== Number(door.open.split(',')[i]))) return false;
      if (support && corners.some(i => pixels[i] !== Number(support.split(',')[i]))) return false;
    } else if (pose.pieces.includes(cell)) {
      if (pixels.some((ink, i) => (!mark || !corners.includes(i)) && ink !== body[i])) return false;
    } else if (pose.threats?.includes(cell)) {
      if (pixels.some((ink, i) => (!mark || !corners.includes(i)) && ink !== threat?.[i])) return false;
    } else if (support) {
      if (stamp !== support) return false;
    } else if (!ground.has(cell)) {
      if (stamp !== field.fixed[cell]) return false;
    } else if (!door && (mark || cell === field.exit)) {
      if (stamp !== (mark ?? roles.exitStamp)) return false;
    } else if (!door && pixels.some(ink => ink !== grid.floor)) return false;
  }
  return true;
}

export function planBoundExchange(roles: ExchangeTransfer, rows: NativeRows, inputs: readonly NativeCommand[],
  remaining: number, retained?: BoundExchange, threat?: ExchangeThreat): BoundExchangePlan | undefined {
  if (remaining < 1 || inputs.length !== 4 || !inputs.every(input => roles.moves[input.action_ref])) return;
  const scene = retained ?? bindExchangeField(roles, rows, threat);
  if (!scene || !matchesBoundExchange(roles, scene.field, scene.pose, rows)) return;
  const { field, pose } = scene, ground = new Set(field.floor);
  const transmission = new Set(field.transmission);
  const doorCells = Object.keys(field.doors);
  const moves = inputs.map(action => ({ action, delta: roles.moves[action.action_ref]!.delta }));
  if (new Set(moves.map(move => move.delta.join(','))).size !== 4
    || moves.some(({ delta: [dx, dy] }) => Math.abs(dx) + Math.abs(dy) !== roles.grid.pitch || !!dx === !!dy)) return;
  type Node = { pose: Pose; depth: number; previous?: Node; action?: NativeCommand };
  const pressure = [...new Set(Object.values(field.doors).flatMap(door => door.controls.length > 1 ? door.controls : []))];
  const bridgeCount = Object.keys(field.bridges ?? {}).length;
  const capacity = pressure.length + bridgeCount;
  const placed = (value: Pose) => pressure.filter(mark => value.pieces.includes(mark) || value.threats?.includes(mark)).length
    + (value.bridges?.length ?? 0);
  const queues = Array.from({ length: capacity + 1 }, (): { nodes: Node[]; head: number } => ({ nodes: [], head: 0 }));
  queues[capacity - placed(pose)]!.nodes.push({ pose, depth: 0 });
  const seen = new Map([[poseKey(pose), 0]]);
  const searchLimit = bridgeCount ? 12_000 : 7_500;
  for (let i = 0; i < searchLimit; i++) {
    // A verified placement advances the access dependency. Keep the other
    // states available so a placement can be revised if its route is blocked.
    const queue = queues.find(value => value.head < value.nodes.length);
    if (!queue) break;
    const state = queue.nodes[queue.head++]!, { pose: current, depth } = state;
    if (seen.get(poseKey(current)) !== depth) continue;
    if (current.actor === field.exit && depth > 0) {
      const path: ExchangeStep[] = [];
      for (let node: Node | undefined = state; node?.action; node = node.previous) path.push({ action: node.action, after: node.pose });
      path.reverse();
      const required = new Set(path.flatMap(({ after }) => field.doors[after.actor]?.controls ?? []));
      let pressureTarget: string | undefined, bridgeTarget: string | undefined;
      for (const { after } of path) {
        bridgeTarget = after.bridges?.find(cell => !pose.bridges?.includes(cell));
        pressureTarget = [...after.pieces, ...after.threats ?? []].find(cell => required.has(cell) && !held(pose, cell));
        if (pressureTarget || bridgeTarget) break;
      }
      return { ...scene, steps: path.slice(0, maximumCommittedActions), roles,
        ...(pressureTarget ? { pressureTarget } : {}), ...(bridgeTarget ? { bridgeTarget } : {}) };
    }
    if (depth >= remaining) continue;
    const allowed = (cell: string) => (ground.has(cell) || current.bridges?.includes(cell))
      && (!field.doors[cell] || doorOpen(field.doors[cell], current));
    for (const { action, delta } of moves) {
      let target: string | undefined, direction = delta, loop = false;
      const ray = field.reflectors ? new Set<string>() : undefined;
      for (let beam = step(current.actor, direction); ; beam = step(beam, direction)) {
        if (ray) {
          const key = `${beam}|${direction.join(',')}`;
          if (ray.has(key) || beam === current.actor) { loop = true; break; }
          ray.add(key);
        }
        const reflector = field.reflectors?.[beam];
        if (reflector) {
          const outgoing = reflector[direction.join(',')];
          if (!outgoing) break;
          direction = outgoing;
          continue;
        }
        if (!allowed(beam) && !transmission.has(beam)) break;
        if (current.pieces.includes(beam) || current.threats?.includes(beam)) { target = beam; break; }
      }
      if (loop) continue;
      const landing = target ?? step(current.actor, delta);
      if (!allowed(landing)) continue;
      const swapThreat = target && current.threats?.includes(target);
      const threats = swapThreat ? current.threats!.map(cell => cell === target ? current.actor : cell) : current.threats;
      if (threats?.some(cell => adjacent(cell, landing, roles.grid.pitch)
        || swapThreat && cell !== current.actor && adjacent(cell, current.actor, roles.grid.pitch))) continue;
      const exchanged = { ...current, actor: landing, pieces: target && !swapThreat
        ? current.pieces.map(piece => piece === target ? current.actor : piece) : current.pieces,
        ...(threats ? { threats } : {}) };
      const next = settleExchangeDoors(field, current, exchanged, doorCells);
      if (!next) continue;
      const key = poseKey(next);
      if ((seen.get(key) ?? Infinity) <= depth + 1) continue;
      seen.set(key, depth + 1);
      queues[capacity - placed(next)]!.nodes.push({ pose: next, depth: depth + 1, previous: state, action });
    }
  }
}

function prepareExchangeSeries(local: ObservedExchange, travel: ObservedTravel, cells: Cells, start: Pose,
  path: readonly (Prediction & { certain: boolean })[], remaining: number): ExchangeSeries | undefined {
  const { grid } = travel;
  const { pitch, floor } = grid;
  const mid = Math.floor(pitch / 2);
  const special = new Set([...local.layout.gates.map(gate => gate.cell), ...local.supports, ...(local.layout.exit ? [local.layout.exit] : [])]);
  const marks = Object.keys(local.layout.marks), steps: Prediction[] = [], terrain: Record<string, string> = {};
  let previous = start;
  for (const { pose, command, certain } of path.slice(0, Math.min(remaining, maximumCommittedActions))) {
    if (!certain || marks.some(mark => held(previous, mark) !== held(pose, mark))
      || [previous.actor, pose.actor, ...previous.pieces.filter(cell => !pose.pieces.includes(cell)),
        ...pose.pieces.filter(cell => !previous.pieces.includes(cell))].some(cell => special.has(cell))) break;
    steps.push({ pose, command });
    previous = pose;
  }
  if (steps.length < 2) return;
  for (const [cell, pixels] of cells) {
    const profile = local.layout.marks[cell];
    if (!held(start, cell)) terrain[cell] = tileId(pixels);
    else if (profile) {
      const [ink, accent] = profile;
      terrain[cell] = tileId(Array.from({ length: pitch * pitch }, (_, index) => {
        const x = index % pitch, y = Math.floor(index / pitch);
        return x === mid && y === mid ? accent! : x === mid || y === mid ? ink! : floor;
      }));
    } else if (!special.has(cell)) terrain[cell] = tileId(Array<number>(pitch * pitch).fill(floor));
  }
  return { start, steps, grid, layout: local.layout, body: local.body, terrain };
}

export function matchesExchangeSeries(series: ExchangeSeries, pose: Pose, rows: NativeRows): boolean {
  const { cells, pieces } = readTravelGrid(rows, series.grid);
  if (pieces.length !== 1 || pieces[0] !== pose.actor || poseKey(getPose(series.layout, series.body, pose.actor, cells)) !== poseKey(pose)) return false;
  for (const [cell, pixels] of cells) {
    if (!held(pose, cell) && tileId(pixels) !== series.terrain[cell]) return false;
  }
  return true;
}

export function chooseExchange(local: ObservedExchange | undefined, travel: ObservedTravel | undefined, rows: NativeRows,
  remaining = maximumCommittedActions): ExchangePlan | undefined {
  if (!local || !travel?.actor) return;
  const moves = directions(travel);
  if (moves.length !== 4 || new Set(moves.map(move => move.delta.join(','))).size !== 4) return;
  const { grid } = travel, { cells } = readTravelGrid(rows, grid), { layout } = local;
  const initial = getPose(layout, local.body, travel.actor, cells);
  if (!initial.pieces.length || initial.pieces.length > 5) return;
  const gates = new Map(layout.gates.map(gate => [gate.cell, gate]));
  const ground = new Set([...travel.visited, ...initial.pieces, ...Object.keys(layout.marks), ...local.supports]);
  if (layout.exit) ground.add(layout.exit);
  const holes = new Set<string>(), potentialRedirectors = new Map<string, number[]>();
  for (const [cell, pixels] of cells) {
    if (isUniform(pixels) && pixels[0] === grid.floor) ground.add(cell);
    else if (isUniform(pixels) && tileId(pixels) !== layout.wall) holes.add(cell);
    else if (!isUniform(pixels) && !ground.has(cell) && !gates.has(cell)) potentialRedirectors.set(cell, pixels);
  }
  const rejected = new Set(local.rejected);
  const covered = (pose: Pose, mark: string) => mark === pose.actor || pose.pieces.includes(mark);
  const canEnter = (cell: string, pose: Pose) => {
    const gate = gates.get(cell);
    return gate ? covered(pose, gate.mark) === gate.opensWhenCovered : ground.has(cell);
  };
  function targets(pose: Pose, delta: NativePoint) {
    const queue = [{ at: pose.actor, delta }], seen = new Set<string>(), matches = new Set<string>();
    let certain = true;
    for (const beam of queue) {
      const at = step(beam.at, beam.delta), key = `${at}:${beam.delta.join(',')}`;
      if (seen.has(key) || at === pose.actor) continue;
      seen.add(key);
      if (pose.pieces.includes(at)) { matches.add(at); continue; }
      if (canEnter(at, pose) || holes.has(at)) { queue.push({ at, delta: beam.delta }); continue; }
      const reflector = potentialRedirectors.get(at);
      if (!reflector) continue;
      const witnessed = local!.turns[turnKey(reflector, beam.delta)];
      if (!witnessed) certain = false;
      const outgoing = witnessed ? [witnessed] : moves.filter(move => !!move.delta[0] !== !!beam.delta[0]).map(move => move.delta);
      for (const turn of outgoing) queue.push({ at, delta: turn });
    }
    return { matches, certain };
  }
  function project(pose: Pose, { input, delta }: Move): { pose: Pose; certain: boolean }[] {
    if (rejected.has(trialKey(pose, input, local!.supports))) return [];
    const { matches: hit, certain } = targets(pose, delta);
    if (hit.size) {
      return [...hit].map(target => ({ pose: { actor: target, pieces: pose.pieces.map(piece => piece === target ? pose.actor : piece) },
        certain: certain && hit.size === 1 }));
    }
    const landing = step(pose.actor, delta);
    if (!canEnter(landing, pose)) return [];
    const next = { actor: landing, pieces: pose.pieces };
    return canEnter(landing, next) ? [{ pose: next, certain }] : [];
  }
  const evidence = [...new Set([...local.refs, ...moves.map(move => travel.moves[move.input]!.ref)])];
  function path(goal: ExchangePlan['goal'], subjects: string[], check: (pose: Pose) => boolean): ExchangePlan | undefined {
    type Node = { pose: Pose; from?: Node; prediction?: Prediction & { certain: boolean } };
    const queue: Node[] = [{ pose: initial }], seen = new Set([poseKey(initial)]);
    for (let i = 0; i < queue.length && i < 7500; i++) {
      const node = queue[i]!, { pose } = node;
      if (node.prediction && check(pose)) {
        const route: (Prediction & { certain: boolean })[] = [];
        for (let current: Node | undefined = node; current?.prediction; current = current.from) route.push(current.prediction);
        route.reverse();
        const { command, pose: expected } = route[0]!;
        const series = prepareExchangeSeries(local!, travel!, cells, initial, route, remaining);
        return { command: { action_ref: command, data: {} }, goal, subjects, focus: initial.actor,
          ...(initial.pieces.includes(expected.actor) ? { partner: expected.actor } : {}), prediction: { command, pose: expected }, evidence,
          ...(series ? { series } : {}) };
      }
      for (const move of moves) for (const { pose: candidate, certain } of project(pose, move)) {
        const key = poseKey(candidate);
        if (seen.has(key)) continue;
        seen.add(key); queue.push({ pose: candidate, from: node, prediction: { command: move.input, pose: candidate, certain } });
      }
    }
  }
  for (const gate of layout.gates) {
    if (gate.opensWhenCovered || !moves.some(move => {
      const across = step(gate.cell, move.delta);
      return holes.has(across) && ground.has(step(across, move.delta));
    })) continue;
    const plan = path('test_transport', [gate.cell, gate.mark], pose => pose.pieces.includes(gate.cell) && pose.actor === gate.mark);
    if (plan) return plan;
  }
  if (layout.exit) {
    const plan = path('reach_exit', [layout.exit], pose => pose.actor === layout.exit);
    if (plan) return plan;
  }
  for (const gate of layout.gates) {
    if (!gate.opensWhenCovered || initial.pieces.includes(gate.mark)) continue;
    const plan = path('hold_control', [gate.mark], pose => pose.pieces.includes(gate.mark));
    if (plan) return plan;
  }
}

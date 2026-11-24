import type { NativeCommand, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import { readTravelGrid, type ObservedTravel } from './observed-travel-frontier.ts';
import { maximumCommittedActions } from './plan-step.ts';

type Cells = ReturnType<typeof readTravelGrid>['cells'];
type Move = { input: string; delta: NativePoint };
type Gate = { cell: string; mark: string; ink: number; opensWhenCovered: boolean };
type Layout = { marks: Record<string, number[]>; gates: Gate[]; exit?: string; wall: string };
type Pose = { actor: string; pieces: string[]; threats?: string[] };
type Prediction = { command: string; pose: Pose };
type Exchange = { ref: string; from: string; to: string; turns: string[] };
export type ObservedExchange = {
  body: string; layout: Layout; refs: string[]; supports: string[];
  turns: Record<string, NativePoint>; rejected: string[]; last: Exchange;
  lastTransport?: { ref: string; gate: string; control: string; support: string };
};
export type ExchangePlan = { command: NativeCommand; goal: 'test_transport' | 'reach_exit' | 'hold_control';
  subjects: string[]; focus: string; partner?: string; prediction: Prediction; evidence: string[]; series?: ExchangeSeries };
type ExchangeSeries = { start: Pose; steps: Prediction[]; grid: ObservedTravel['grid']; layout: Layout; body: string;
  terrain: Record<string, string> };
export type ExchangeTransfer = Pick<ObservedTravel, 'grid' | 'moves'> & {
  body: string; wall: string; actorInkCount: number; exitStamp: string; exchangeRef: string; scoreRef: string;
};
export type ExchangeThreat = { stamp: string; evidence: readonly [string, string] };
type BoundField = { floor: string[]; marks: Record<string, string>; doors: Record<string, { shut: string; open: string }>;
  exit: string; fixed: Record<string, string>; threat?: ExchangeThreat };
export type BoundExchange = { field: BoundField; pose: Pose };
type ExchangeStep = { action: NativeCommand; after: Pose };
export type BoundExchangePlan = BoundExchange & { roles: ExchangeTransfer; steps: ExchangeStep[] };

const point = (cell: string) => cell.split(',').map(Number) as [number, number];
const step = (cell: string, [dx, dy]: NativePoint) => {
  const [x, y] = point(cell);
  return `${x + dx},${y + dy}`;
};
const tileId = (pixels: readonly number[] | undefined) => pixels?.join(',') ?? '';
const isUniform = (pixels: readonly number[]) => pixels.every(ink => ink === pixels[0]);
const poseKey = ({ actor, pieces, threats }: Pose) =>
  `${actor}|${[...pieces].sort().join(';')}${threats ? `|${[...threats].sort().join(';')}` : ''}`;
const trialKey = (pose: Pose, input: string, supports: readonly string[]) => `${poseKey(pose)}|${input}|${supports.join(';')}`;
const turnKey = (tile: readonly number[], incoming: NativePoint) => `${tileId(tile)}|${incoming.join(',')}`;
const directions = (travel: ObservedTravel) => Object.entries(travel.moves).map(([input, move]) => ({ input, delta: move.delta }));
const corners = [0, 2, 6, 8];

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
      gates.push({ cell, mark: compatible[0]![0], ink: rim, opensWhenCovered: pixels[center] !== floor });
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
  if (!delta || !local && ((frames?.length ?? 0) < 2 || travel.actor === old.actor)) return local;
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
  if (swapped) {
    const ray = visibleTrace(old.actor, travel.actor, directions(old), grid.pitch, before, frames?.[0]);
    const direct = deltaTo(old.actor, travel.actor) === deltaTo(old.actor, step(old.actor, delta));
    if (direct || ray?.length && ray[0]!.delta.every((value, i) => value === delta[i])) {
      const turns = { ...local?.turns }, measured: string[] = [];
      for (let i = 0; ray && i + 1 < ray.length; i++) {
        const { cell, delta: incoming } = ray[i]!, outgoing = ray[i + 1]!.delta, pixels = first.get(cell);
        if (pixels && incoming.some((value, j) => value !== outgoing[j])) {
          turns[turnKey(pixels, incoming)] = outgoing; measured.push(cell);
        }
      }
      result = { ...local, body, layout, turns, supports: local?.supports ?? [], rejected: local?.rejected ?? [],
        refs: [...(local?.refs ?? []).slice(-7), ref], last: { ref, from: old.actor, to: travel.actor, turns: measured } };
    }
  }
  if (!result) return;
  const transport = witnessedSupport(result, old, start, returned, first, second);
  if (transport) {
    return { ...result, supports: [...new Set([...result.supports, transport.support])],
      lastTransport: { ...transport, ref }, refs: [...result.refs.slice(-7), ref] };
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
    for (const { delta } of directions(travel)) {
      const cell = step(gate.cell, delta), prior = first.get(cell), current = second.get(cell);
      if (prior && current && isUniform(prior) && prior[0] !== travel.grid.floor && tileId(prior) !== local.layout.wall
        && !isUniform(current) && cell !== after.actor && !after.pieces.includes(cell)) {
        return { gate: gate.cell, control: gate.mark, support: cell };
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
    exitStamp: tileId(exit), exchangeRef: local.last.ref, scoreRef: ref };
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

function bindExchangeField(roles: ExchangeTransfer, rows: NativeRows, threat?: ExchangeThreat): BoundExchange | undefined {
  const { grid } = roles, { cells, pieces } = readTravelGrid(rows, grid);
  if (pieces.length !== 1 || grid.pitch !== 3) return;
  const actor = pieces[0]!, floor: string[] = [], bodies: string[] = [], exits: string[] = [], threats: string[] = [];
  const marks: BoundField['marks'] = {}, doors: BoundField['doors'] = {}, fixed: BoundField['fixed'] = {};
  const shutters = new Map<string, number>();
  for (const [cell, pixels] of cells) {
    const stamp = tileId(pixels), rim = pixels[0]!;
    if (cell === actor || stamp === roles.body || stamp === roles.exitStamp || stamp === threat?.stamp || pixels.every(ink => ink === grid.floor)) {
      floor.push(cell);
      if (stamp === roles.body) bodies.push(cell);
      if (stamp === threat?.stamp) threats.push(cell);
      if (stamp === roles.exitStamp) exits.push(cell);
    } else if (stamp === roles.wall) fixed[cell] = stamp;
    else {
      const mark = markProfile(pixels, grid.pitch, grid.floor);
      if (mark && mark[0] === mark[1]) marks[cell] = stamp;
      else if (rim !== grid.floor && pixels[4] !== rim && pixels[4] !== grid.floor
        && pixels.every((ink, index) => index === 4 || ink === rim)) shutters.set(cell, rim);
      else return;
    }
  }
  if (!bodies.length || exits.length !== 1) return;
  const controls = Object.keys(marks);
  const inks = new Set(controls.map(cell => cells.get(cell)![4]));
  if (shutters.size && (inks.size !== 1 || [...shutters.values()].some(rim => !inks.has(rim)))
    || controls.length && !shutters.size) return;
  for (const [cell, rim] of shutters) {
    doors[cell] = { shut: tileId(cells.get(cell)), open: tileId(Array.from({ length: 9 }, (_, index) => corners.includes(index) ? rim : grid.floor)) };
  }
  const threatBinding = threat && threats.length && threats.every(a => threats.every(b => !adjacent(a, b, grid.pitch))) ? threat : undefined;
  if (threats.length && (!threatBinding || controls.length)) return;
  return { field: { floor: [...floor, ...controls, ...Object.keys(doors)], marks, doors, exit: exits[0]!, fixed,
      ...(threatBinding ? { threat: threatBinding } : {}) },
    pose: { actor, pieces: bodies, ...(threatBinding ? { threats } : {}) } };
}

function held(pose: Pose, cell: string) {
  return pose.actor === cell || pose.pieces.includes(cell) || !!pose.threats?.includes(cell);
}

function gatesOpen(field: BoundField, pose: Pose) {
  return Object.keys(field.marks).every(mark => held(pose, mark));
}

export function matchesBoundExchange(roles: ExchangeTransfer, field: BoundField, pose: Pose, rows: NativeRows): boolean {
  const { grid } = roles, { cells } = readTravelGrid(rows, grid), ground = new Set(field.floor);
  const open = gatesOpen(field, pose), body = roles.body.split(',').map(Number);
  for (const [cell, pixels] of cells) {
    const stamp = tileId(pixels), door = field.doors[cell], mark = field.marks[cell];
    const occupant = held(pose, cell);
    if (door && (!open && occupant || !occupant && stamp !== (open ? door.open : door.shut))) return false;
    if (mark && occupant && corners.some(i => pixels[i] !== Number(mark.split(',')[4]))) return false;
    if (cell === pose.actor) {
      if (pixels[4] !== grid.ink || pixels.filter(ink => ink === grid.ink).length !== roles.actorInkCount) return false;
      if (door && corners.some(i => pixels[i] !== Number(door.open.split(',')[i]))) return false;
    } else if (pose.pieces.includes(cell)) {
      if (pixels.some((ink, i) => (!mark || !corners.includes(i)) && ink !== body[i])) return false;
    } else if (pose.threats?.includes(cell)) {
      if (stamp !== field.threat?.stamp) return false;
    } else if (!ground.has(cell)) {
      if (stamp !== field.fixed[cell]) return false;
    } else if (mark || cell === field.exit) {
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
  const doorCells = Object.keys(field.doors);
  const moves = inputs.map(action => ({ action, delta: roles.moves[action.action_ref]!.delta }));
  if (new Set(moves.map(move => move.delta.join(','))).size !== 4
    || moves.some(({ delta: [dx, dy] }) => Math.abs(dx) + Math.abs(dy) !== roles.grid.pitch || !!dx === !!dy)) return;
  type Node = { pose: Pose; depth: number; previous?: Node; action?: NativeCommand };
  const queue: Node[] = [{ pose, depth: 0 }], seen = new Set([poseKey(pose)]);
  for (let i = 0; i < queue.length && i < 7_500; i++) {
    const state = queue[i]!, { pose: current, depth } = state;
    if (current.actor === field.exit && depth > 0) {
      const path: ExchangeStep[] = [];
      for (let node: Node | undefined = state; node?.action; node = node.previous) path.push({ action: node.action, after: node.pose });
      return { ...scene, steps: path.reverse().slice(0, maximumCommittedActions), roles };
    }
    if (depth >= remaining) continue;
    const open = gatesOpen(field, current);
    const allowed = (cell: string) => ground.has(cell) && (open || !field.doors[cell]);
    for (const { action, delta } of moves) {
      let target: string | undefined;
      for (let beam = step(current.actor, delta); allowed(beam); beam = step(beam, delta)) {
        if (current.pieces.includes(beam) || current.threats?.includes(beam)) { target = beam; break; }
      }
      const landing = target ?? step(current.actor, delta);
      if (!allowed(landing)) continue;
      const swapThreat = target && current.threats?.includes(target);
      const threats = swapThreat ? current.threats!.map(cell => cell === target ? current.actor : cell) : current.threats;
      if (threats?.some(cell => adjacent(cell, landing, roles.grid.pitch)
        || swapThreat && cell !== current.actor && adjacent(cell, current.actor, roles.grid.pitch))) continue;
      const next = { actor: landing, pieces: target && !swapThreat
        ? current.pieces.map(piece => piece === target ? current.actor : piece) : current.pieces,
        ...(threats ? { threats } : {}) };
      if (!gatesOpen(field, next) && doorCells.some(door => held(next, door))) continue;
      const key = poseKey(next);
      if (seen.has(key)) continue;
      seen.add(key); queue.push({ pose: next, depth: depth + 1, previous: state, action });
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

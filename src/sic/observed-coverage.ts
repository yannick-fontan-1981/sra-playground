import type { NativeBox, NativeCommand, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
export { sicObservedCoverageDeadlock as observedCoverageDeadlock } from '../logos-engine/v6-native-types.ts';
import { readTravelCell, readTravelGrid, type ObservedTravel } from './observed-travel-frontier.ts';
import { maximumCommittedActions, unchangedOutside } from './plan-step.ts';

type Cells = ReturnType<typeof readTravelGrid>['cells'];
type Move = { input: string; delta: NativePoint };
type Motion = 'push' | 'pull';
type Layout = { marks: string[]; markInk: number; exit: string; gate: string[] };
export type ObservedPressureLatch = { mark: string; closed: string; open: string; ref: string };
export type CoverageTransfer = { epoch: number; motion: Motion; exitPattern: string; ref: string; pressureLatch?: ObservedPressureLatch };
export type PullStep = { input: string; actor: string; arrangement: string };
export type CoverageLearning = {
  body?: string; motion?: Motion; layout?: Layout; supports: string[]; water?: string; walls: Record<string, string[]>;
  pullRoute?: { anchor: string; steps: readonly PullStep[] }; pullRefusals?: string[];
  lastPull?: { ref: string; from: string; to: string; actor: string };
  pressureLatch?: ObservedPressureLatch;
  refs: string[]; deadlock?: { ref: string; key: string; bodies: string[] }; recovered: string[];
};
export type CoveragePlan = { command: NativeCommand; motion: Motion; marks: string[]; exit: string; evidence: string[];
  covered: boolean; verifyBarrier?: true; pullRoute?: readonly PullStep[]; pushSeries?: readonly CoverageMovementStep[];
  pullSeries?: CoveragePullSeries; routeImprovement?: { previous: number; proposed: number; states: number } };

type CoveragePose = { actor: string; arrangement: string };
export type CoverageMovementStep = {
  command: NativeCommand;
  before: CoveragePose;
  after: CoveragePose;
  landing: string;
  substrate: string;
  changed: NativeBox[];
};
export type CoveragePullSeries = { steps: CoverageMovementStep[]; gates: { cell: string; pixels: string }[] };

const at = (value: string): NativePoint => value.split(',').map(Number) as [number, number];
const tag = (p: NativePoint) => p.join(',');
const next = (p: string, [dx, dy]: NativePoint, scale = 1) => {
  const [x, y] = at(p);
  return tag([x + dx * scale, y + dy * scale]);
};
const stamp = (pixels: readonly number[] | undefined) => pixels?.join(',') ?? '';
const bySignature = (cells: Cells, pattern: string) => [...cells].filter(([, pixels]) => stamp(pixels) === pattern).map(([id]) => id);
const initial = (): CoverageLearning => ({ supports: [], walls: {}, refs: [], recovered: [] });
const arrangementOf = (pieces: Iterable<string>) => [...pieces].sort().join(';');
const refusalKey = (actor: string, arrangement: string, input: string) => `${actor}|${arrangement}|${input}`;
const pullAnchor = (actor: string, arrangement: string, layout: Layout, cells: Cells) =>
  refusalKey(actor, arrangement, layout.gate.map(gate => stamp(cells.get(gate))).join(';'));

function bodiesAt(cells: Cells, pattern: string, layout?: Layout): string[] {
  const bodies = bySignature(cells, pattern);
  if (!layout) return bodies;
  const shape = pattern.split(',').map(Number), center = Math.floor(shape.length / 2);
  for (const mark of layout.marks) {
    const pixels = cells.get(mark);
    if (!pixels || bodies.includes(mark) || pixels[center] !== shape[center]) continue;
    const unchanged = pixels.filter((ink, i) => ink === shape[i]).length;
    if (unchanged * 2 > pixels.length && pixels.every((ink, i) => ink === shape[i] || ink === layout.markInk)) bodies.push(mark);
  }
  return bodies;
}

export function hasObservedCoverage(local: CoverageLearning | undefined, travel: ObservedTravel | undefined, rows: NativeRows): boolean {
  if (!local?.layout || !local.body || !travel) return false;
  const bodies = bodiesAt(readTravelGrid(rows, travel.grid).cells, local.body, local.layout);
  return local.layout.marks.every(mark => bodies.includes(mark));
}

export function rememberCoverageWin(local: CoverageLearning | undefined, travel: ObservedTravel | undefined,
  rows: NativeRows, command: NativeCommand, epoch: number, ref: string): CoverageTransfer | undefined {
  const delta = travel?.moves[command.action_ref]?.delta;
  if (!travel?.actor || !delta || !local?.layout || !local.motion || next(travel.actor, delta) !== local.layout.exit
    || !hasObservedCoverage(local, travel, rows)) return;
  const exitPattern = stamp(readTravelCell(rows, travel.grid, at(local.layout.exit)));
  return { epoch, motion: local.motion, exitPattern, ref, ...(local.pressureLatch ? { pressureLatch: local.pressureLatch } : {}) };
}

function observePressureLatch(local: CoverageLearning, travel: ObservedTravel, returned: ObservedTravel,
  before: Cells, after: Cells, ref: string): ObservedPressureLatch | undefined {
  const { body, layout } = local;
  if (local.motion !== 'pull' || !body || !layout) return;
  const occupied = (cells: Cells, actor: ObservedTravel['actor']) => {
    const bodies = bodiesAt(cells, body, layout);
    return layout.marks.every(mark => mark === actor || bodies.includes(mark));
  };
  if (occupied(before, travel.actor) || !occupied(after, returned.actor)) return;
  const mark = layout.marks.map(cell => before.get(cell))
    .find(pixels => pixels?.filter(ink => ink === layout.markInk).length === 2 * travel.grid.pitch - 1
      && pixels.every(ink => ink === layout.markInk || ink === travel.grid.floor));
  const [gate] = layout.gate;
  if (!mark || !gate || layout.gate.length !== 1) return;
  const closed = before.get(gate), open = after.get(gate);
  if (!closed || !open || stamp(closed) === stamp(open) || !open.every(ink => ink === layout.markInk || ink === travel.grid.floor)) return;
  return { mark: stamp(mark), closed: stamp(closed), open: stamp(open), ref };
}

function measureLayout(cells: Cells, pitch: number, floor: number, bodies: number, motion: Motion): Layout | undefined {
  if (pitch % 2 !== 1) return;
  const half = Math.floor(pitch / 2), middle = half * pitch + half;
  const marks = new Map<string, { ink: number; cells: string[] }>(), rings: { ink: number; cell: string; center: number }[] = [];
  const solid = new Map<number, string[]>();
  for (const [cell, pixels] of cells) {
    const center = pixels[middle]!, border = pixels[0]!;
    if (center !== floor && pixels.every((ink, i) =>
      ink === (i % pitch === half || Math.floor(i / pitch) === half ? center : floor))) {
      const signature = stamp(pixels), group = marks.get(signature) ?? { ink: center, cells: [] };
      group.cells.push(cell); marks.set(signature, group);
    }
    if (border !== floor && center !== border && pixels.every((ink, i) => {
      const r = Math.floor(i / pitch), c = i % pitch;
      return r > 0 && r < pitch - 1 && c > 0 && c < pitch - 1 || ink === border;
    })) rings.push({ ink: border, center, cell });
    if (motion === 'pull' && border !== floor && pixels.every(ink => ink === border)) {
      const group = solid.get(border) ?? [];
      group.push(cell); solid.set(border, group);
    }
  }
  const choices = [...marks.values()].filter(group => group.cells.length >= 2 && group.cells.length <= 6
    && (group.cells.length === bodies || motion === 'push' && group.cells.length + 1 === bodies)).flatMap(group => {
    const gate = rings.filter(ring => ring.ink === group.ink).map(ring => ring.cell);
    const exits = rings.filter(ring => ring.ink !== group.ink && ring.center === floor).map(ring => ring.cell);
    if (!exits.length && motion === 'pull') {
      exits.push(...[...solid.values()].filter(group => group.length === 1).flat());
    }
    return gate.length && exits.length === 1 ? [{ marks: group.cells, markInk: group.ink, exit: exits[0]!, gate }] : [];
  });
  return choices.length === 1 ? choices[0] : undefined;
}

function namedMoves(travel: ObservedTravel): Move[] {
  return Object.entries(travel.moves).map(([input, value]) => ({ input, delta: value.delta }));
}

function coversFourDirections(moves: readonly Move[]): boolean {
  return moves.length === 4 && new Set(moves.map(move => tag(move.delta))).size === 4;
}

function seenPush(body: string | undefined, layout: Layout | undefined, from: string, delta: NativePoint, first: Cells, after: Cells) {
  const target = next(from, delta);
  const initialTile = first.get(target);
  if (!initialTile || new Set(initialTile).size < 2) return;
  const candidate = body ?? stamp(initialTile);
  const original = bodiesAt(first, candidate, layout), remaining = bodiesAt(after, candidate, layout);
  if (!original.includes(target)) return;
  let end = target;
  while (original.includes(end)) end = next(end, delta);
  const stable = original.filter(cell => cell !== target);
  if (stable.some(cell => !remaining.includes(cell)) || remaining.includes(target)) return;
  if (remaining.includes(end) && remaining.length === original.length) return { candidate, original, remaining };
  const landing = first.get(end), replacement = after.get(end);
  if (remaining.length === stable.length && landing && replacement && new Set(landing).size === 1
    && new Set(replacement).size > 1 && stamp(replacement) !== candidate) {
    return { candidate, original, remaining, sunk: end, water: stamp(landing) };
  }
}

export function observedPushBody(body: string | undefined, travel: ObservedTravel, delta: NativePoint, before: NativeRows, after: NativeRows) {
  const from = travel.actor;
  if (!from) return;
  const pushed = seenPush(body, undefined, from, delta,
    readTravelGrid(before, travel.grid).cells, readTravelGrid(after, travel.grid).cells);
  if (pushed) {
    return { body: pushed.candidate, chain: pushed.original.includes(next(from, delta, 2)),
      ...(pushed.sunk ? { conversion: { site: pushed.sunk, water: pushed.water!,
        support: stamp(readTravelCell(after, travel.grid, at(pushed.sunk))) } } : {}) };
  }
}

export function observedPushGate(local: CoverageLearning | undefined, travel: ObservedTravel,
  before: NativeRows, after: NativeRows) {
  if (local?.motion !== 'push' || !local.layout || !local.body) return;
  const { layout, body } = local;
  const half = Math.floor(travel.grid.pitch / 2), center = half * travel.grid.pitch + half;
  const gates = layout.gate.map(cell => ({ closed: readTravelCell(before, travel.grid, at(cell)),
    open: readTravelCell(after, travel.grid, at(cell)) }));
  const prototype = gates[0];
  if (!prototype || prototype.open[center] !== travel.grid.floor || prototype.closed[center] === travel.grid.floor
    || !gates.every(pair => stamp(pair.closed) === stamp(prototype.closed) && stamp(pair.open) === stamp(prototype.open))) return;
  const first = readTravelGrid(before, travel.grid).cells, returned = readTravelGrid(after, travel.grid).cells;
  const covered = (cells: Cells) => new Set(bodiesAt(cells, body, layout));
  const beforeBodies = covered(first), afterBodies = covered(returned);
  if (layout.marks.every(mark => beforeBodies.has(mark)) || !layout.marks.every(mark => afterBodies.has(mark))) return;
  const mark = layout.marks.map(cell => first.get(cell)).find(pixels => pixels?.every((ink, i) =>
    ink === (i % travel.grid.pitch === half || Math.floor(i / travel.grid.pitch) === half ? layout.markInk : travel.grid.floor)));
  if (!mark) return;
  return { mark: stamp(mark), closed: stamp(prototype.closed), open: stamp(prototype.open) };
}

function seenPull(local: CoverageLearning, from: string, delta: NativePoint, first: Cells, after: Cells) {
  const tail = next(from, delta, -1);
  const tile = first.get(tail);
  if (!tile || new Set(tile).size < 2) return;
  const candidate = local.body ?? stamp(tile);
  const original = bodiesAt(first, candidate, local.layout), remaining = bodiesAt(after, candidate, local.layout);
  if (original.length < 2 || remaining.length !== original.length || !original.includes(tail) || remaining.includes(tail)
    || !remaining.includes(from) || original.some(cell => cell !== tail && !remaining.includes(cell))) return;
  return { candidate, original };
}

export function observeCoverage(previous: CoverageLearning | undefined, travel: ObservedTravel | undefined,
  returned: ObservedTravel | undefined, before: NativeRows, after: NativeRows, command: NativeCommand, ref: string,
  pullRoute?: readonly PullStep[], retainedPullPremises = true): CoverageLearning | undefined {
  if (!travel?.actor || !returned?.actor || travel.grid.ink !== returned.grid.ink) return previous;
  const displacement = returned.moves[command.action_ref]?.delta;
  if (!displacement) return previous;
  const local = previous ?? initial(), from = travel.actor, destination = next(from, displacement);
  const firstTile = readTravelCell(before, travel.grid, at(destination));
  const tailTile = readTravelCell(before, travel.grid, at(next(from, displacement, -1)));
  let changed = local;
  let returnedCells: Cells | undefined;
  if (returned.actor === destination && (new Set(firstTile).size >= 2 || new Set(tailTile).size >= 2 || local.motion === 'pull' && !local.layout)) {
    const first = readTravelGrid(before, travel.grid).cells;
    returnedCells = readTravelGrid(after, travel.grid).cells;
    const observed = local.motion !== 'pull' ? seenPush(local.body, local.layout, from, displacement, first, returnedCells) : undefined;
    if (observed) {
      const layout = local.layout ?? measureLayout(first, travel.grid.pitch, travel.grid.floor, observed.original.length, 'push');
      if (layout) changed = { ...local, body: observed.candidate, motion: 'push', layout,
        ...(observed.sunk && (!local.water || local.water === observed.water)
          ? { water: observed.water, supports: [...new Set([...local.supports, observed.sunk])] } : {}),
        refs: [...local.refs.slice(-5), ref] };
    } else if (local.motion !== 'push') {
      const pulled = seenPull(local, from, displacement, first, returnedCells);
      if (pulled) changed = { ...local, body: pulled.candidate, motion: 'pull',
        lastPull: { ref, from: next(from, displacement, -1), to: from, actor: destination }, refs: [...local.refs.slice(-5), ref] };
      if (changed.motion === 'pull' && changed.body && !changed.layout) {
        const count = pulled?.original.length ?? bodiesAt(returnedCells, changed.body).length;
        const layout = measureLayout(first, travel.grid.pitch, travel.grid.floor, count, 'pull')
          ?? measureLayout(returnedCells, travel.grid.pitch, travel.grid.floor, count, 'pull');
        if (layout) changed = { ...changed, layout };
      }
    }
    if (!changed.pressureLatch) {
      const pressureLatch = observePressureLatch(changed, travel, returned, first, returnedCells, ref);
      if (pressureLatch) changed = { ...changed, pressureLatch };
    }
  } else if (returned.actor === from && !travel.grid.signature) {
    const ink = firstTile[0], signature = stamp(firstTile);
    if (firstTile.length === travel.grid.pitch ** 2 && ink !== travel.grid.floor && firstTile.every(value => value === ink)
      && signature === stamp(readTravelCell(after, travel.grid, at(destination)))) {
      const positions = local.walls[signature] ?? [];
      if (!positions.includes(destination)) changed = { ...local, walls: { ...local.walls, [signature]: [...positions, destination] },
        refs: [...local.refs.slice(-5), ref] };
    }
  }
  if (changed.motion === 'pull' && changed.layout && changed.body && pullRoute?.length) {
    const predicted = pullRoute[0]!;
    const layout = changed.layout;
    const cells = returnedCells ?? readTravelGrid(after, travel.grid).cells;
    const arrangement = arrangementOf(bodiesAt(cells, changed.body, layout));
    if (command.action_ref === predicted.input && returned.actor === predicted.actor && predicted.arrangement === arrangement) {
      changed = { ...changed };
      if (retainedPullPremises) {
        changed.pullRoute = { anchor: pullAnchor(predicted.actor, arrangement, layout, cells), steps: pullRoute.slice(1) };
      } else delete changed.pullRoute;
    } else {
      const start = arrangementOf(bodiesAt(readTravelGrid(before, travel.grid).cells, changed.body, changed.layout));
      const refusal = refusalKey(from, start, command.action_ref);
      changed = { ...changed, pullRefusals: [...new Set([...(local.pullRefusals ?? []).slice(-63), refusal])] };
      delete changed.pullRoute;
    }
  }
  if (changed.body && changed.motion !== 'pull' && Object.values(changed.walls).some(positions => positions.length >= 2)) {
    return certifyDeadlock(changed, returned, returnedCells ?? readTravelGrid(after, travel.grid).cells, ref);
  }
  return changed === local ? previous : changed;
}

function certifyDeadlock(local: CoverageLearning, travel: ObservedTravel, cells: Cells, ref: string): CoverageLearning {
  if (!local.layout || !local.body) return local;
  const pieces = bodiesAt(cells, local.body, local.layout), { marks } = local.layout;
  if (pieces.length !== marks.length) return local;
  // The test allows every unknown support, including uncovered water and closed gates.
  // Only a uniform surface rejected at independent positions can exclude those cells.
  const walls = new Set(Object.entries(local.walls).filter(([shape, tested]) => shape !== local.water && tested.length >= 2).map(([shape]) => shape));
  const possible = new Set([...cells].filter(([, pixels]) => !walls.has(stamp(pixels))).map(([cell]) => cell));
  if (!walls.size) return local;
  const moves = namedMoves(travel);
  if (!coversFourDirections(moves)) return local;
  const starting = marks.map(mark => reversePush(mark, possible, moves));
  if (matchesAssignment(pieces, starting)) return local;
  const key = pieces.sort().join(';');
  return { ...local, deadlock: { key, ref, bodies: pieces } };
}

function reversePush(target: string, possible: ReadonlySet<string>, moves: readonly Move[]) {
  const visited = new Set([target]), queue = [target];
  for (const cell of queue) for (const { delta } of moves) {
    const from = next(cell, delta, -1), footing = next(cell, delta, -2);
    if (!possible.has(from) || !possible.has(footing) || visited.has(from)) continue;
    visited.add(from); queue.push(from);
  }
  return visited;
}

function matchesAssignment(pieces: readonly string[], sources: readonly ReadonlySet<string>[], index = 0): boolean {
  if (index === sources.length) return true;
  return pieces.some((piece, i) => sources[index]!.has(piece) && matchesAssignment(
    pieces.filter((_, j) => i !== j), sources, index + 1));
}

function measureBarrier(local: CoverageLearning, layout: Layout, cells: Cells, ground: ReadonlySet<string>,
  player: string, pieces: ReadonlySet<string>, moves: readonly Move[], floor: number) {
  if (pieces.size !== layout.marks.length) return;
  const coordinates = [...cells.keys()].map(at), xs = coordinates.map(([x]) => x), ys = coordinates.map(([, y]) => y);
  const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
  const hypotheses = new Set<string>();
  for (const [cell, pixels] of cells) {
    const [x, y] = at(cell), signature = stamp(pixels);
    if ((x === left || x === right || y === top || y === bottom)
      && pixels[0] !== floor && signature !== local.water && pixels.every(ink => ink === pixels[0])
      && (local.walls[signature]?.length ?? 0) < 2) hypotheses.add(signature);
  }
  const candidates = [...hypotheses].filter(signature => {
    const possible = new Set([...cells].filter(([, pixels]) => stamp(pixels) !== signature).map(([cell]) => cell));
    return !matchesAssignment([...pieces], layout.marks.map(mark => reversePush(mark, possible, moves)));
  });
  if (!candidates.length) return;
  const reachable = new Map<string, string | undefined>([[player, undefined]]);
  for (const [cell, first] of reachable) {
    for (const move of moves) {
      const target = next(cell, move.delta), signature = stamp(cells.get(target));
      if (candidates.includes(signature) && !local.walls[signature]?.includes(target)) return first ?? move.input;
      if (!reachable.has(target) && !pieces.has(target) && (ground.has(target) || local.supports.includes(target))) {
        reachable.set(target, first ?? move.input);
      }
    }
  }
}

type Position = { actor: string; bodies: Set<string>; supports: Set<string> };
type PushPath = { state: Position; commands: number; step?: { input: string; landing: string; previous: PushPath } };
const coverageSearchStates = 6000;
type ShorterSearch = { commands: number; states: number };

function pushPath(start: Position, layout: Layout, ground: ReadonlySet<string>, water: ReadonlySet<string>, moves: readonly Move[],
  shorter?: ShorterSearch) {
  const key = (state: Position) => JSON.stringify([state.actor, [...state.bodies].sort(), [...state.supports].sort()]);
  const root: PushPath = { state: start, commands: 0 };
  const queue: PushPath[] = [root];
  const seen = new Set([key(start)]), relaxed = new Set([...ground, ...water, ...layout.gate]);
  const reverse = layout.marks.map(mark => reversePush(mark, relaxed, moves));
  // A push expands a whole walk. Charge each traversed cell when comparing full routes.
  const byCommandCost = shorter ? new Map<number, PushPath[]>([[0, [root]]]) : undefined;
  const bestArrival = new Map<string, number>([[key(start), 0]]);
  let best: PushPath | undefined;
  let examined = 0;
  const bound = () => best?.commands ?? shorter?.commands ?? Infinity;
  for (; examined < (shorter?.states ?? coverageSearchStates);) {
    let path = queue[examined];
    if (byCommandCost) {
      if (!byCommandCost.size) break;
      const cost = Math.min(...byCommandCost.keys());
      if (cost >= bound()) break;
      const bucket = byCommandCost.get(cost)!;
      path = bucket.pop();
      if (!bucket.length) byCommandCost.delete(cost);
      if (path && bestArrival.get(key(path.state)) !== cost) { examined++; continue; }
    }
    if (!path) break;
    examined++;
    const { state } = path;
    const covered = layout.marks.every(mark => state.bodies.has(mark));
    const canStand = (cell: string) => ground.has(cell) || state.supports.has(cell) || covered && layout.gate.includes(cell);
    const reachable = new Map<string, PushPath>([[state.actor, path]]);
    for (const [cell, previous] of reachable) for (const move of moves) {
      const target = next(cell, move.delta);
      const commands = previous.commands + 1;
      if (commands < bound()
        && !reachable.has(target) && !state.bodies.has(target) && canStand(target)) {
        reachable.set(target, { state: { ...state, actor: target }, commands, step: { input: move.input, landing: target, previous } });
      }
    }
    const finish = covered ? reachable.get(layout.exit) : undefined;
    if (finish) {
      if (!byCommandCost) return { path: finish, examined };
      best = finish;
    }
    for (const piece of state.bodies) for (const move of moves) {
      const behind = next(piece, move.delta, -1);
      const previous = reachable.get(behind);
      if (!previous) continue;
      let end = next(piece, move.delta);
      while (state.bodies.has(end)) end = next(end, move.delta);
      const sink = water.has(end) && !state.supports.has(end);
      if (sink ? state.bodies.size <= layout.marks.length : !canStand(end)) continue;
      const bodies = new Set(state.bodies); bodies.delete(piece);
      const supports = new Set(state.supports);
      if (sink) supports.add(end);
      else bodies.add(end);
      if (!matchesAssignment([...bodies], reverse)) continue;
      const candidate = { actor: piece, bodies, supports };
      const signature = key(candidate);
      const commands = previous.commands + 1;
      if (byCommandCost) {
        if (commands >= Math.min(bestArrival.get(signature) ?? Infinity, bound())) continue;
        bestArrival.set(signature, commands);
        const bucket = byCommandCost.get(commands) ?? [];
        bucket.push({ state: candidate, commands, step: { input: move.input, landing: end, previous } });
        byCommandCost.set(commands, bucket);
      } else if (!seen.has(signature)) {
        seen.add(signature);
        queue.push({ state: candidate, commands, step: { input: move.input, landing: end, previous } });
      }
    }
  }
  return { path: best, examined };
}

function pushSteps(path: PushPath | undefined) {
  const steps: { input: string; landing: string; from: Position; to: Position }[] = [];
  for (let cursor = path; cursor?.step; cursor = cursor.step.previous) {
    const { input, landing, previous } = cursor.step;
    steps.push({ input, landing, from: previous.state, to: cursor.state });
  }
  return steps.reverse();
}

function bindPushSeries(route: ReturnType<typeof pushSteps>, initial: Position, cells: Cells, layout: Layout, pitch: number, remaining: number) {
  const series: CoverageMovementStep[] = [];
  const covered = (pose: Position) => layout.marks.every(mark => pose.bodies.has(mark));
  let pushDirection: string | undefined;
  for (const { input, landing, from, to } of route.slice(0, Math.min(remaining, maximumCommittedActions))) {
    // A new bridge, a gate change or a landing hidden in the initial view needs a fresh decision.
    if (from.supports.size !== to.supports.size || covered(from) !== covered(to)
      || initial.actor === landing || initial.bodies.has(landing)) break;
    const substrate = stamp(cells.get(landing));
    if (!substrate) break;
    const shifted = [...from.bodies].filter(cell => !to.bodies.has(cell))
      .concat([...to.bodies].filter(cell => !from.bodies.has(cell)));
    // Reassess the layout after completing a push before changing stance or direction.
    if (pushDirection && (!shifted.length || pushDirection !== input)) break;
    if (shifted.length) pushDirection = input;
    const changed = [from.actor, to.actor, ...shifted].map((cell): NativeBox => {
      const [x, y] = at(cell);
      return [x, y, x + pitch - 1, y + pitch - 1];
    });
    series.push({
      command: { action_ref: input, data: {} },
      before: { actor: from.actor, arrangement: arrangementOf(from.bodies) },
      after: { actor: to.actor, arrangement: arrangementOf(to.bodies) },
      landing, substrate, changed,
    });
  }
  return series.length > 1 ? series : undefined;
}

function matchesCoveragePose(local: CoverageLearning, board: ReturnType<typeof readTravelGrid>, pose: CoveragePose) {
  return !!local.body && board.pieces.length === 1 && board.pieces[0] === pose.actor
    && arrangementOf(bodiesAt(board.cells, local.body, local.layout)) === pose.arrangement;
}

export function coveragePushPremise(local: CoverageLearning, travel: ObservedTravel, rows: NativeRows, step: CoverageMovementStep) {
  const board = readTravelGrid(rows, travel.grid);
  return matchesCoveragePose(local, board, step.before) && stamp(board.cells.get(step.landing)) === step.substrate;
}

export function coveragePushReturn(local: CoverageLearning, travel: ObservedTravel, before: NativeRows, after: NativeRows, step: CoverageMovementStep) {
  return matchesCoveragePose(local, readTravelGrid(after, travel.grid), step.after) && unchangedOutside(before, after, step.changed);
}

export function bindPullSeries(route: readonly PullStep[], actor: string, bodies: Set<string>, cells: Cells, layout: Pick<Layout, 'marks' | 'gate'>,
  pitch: number, remaining: number): CoveragePullSeries | undefined {
  const initial = new Set([actor, ...bodies]);
  const gates = layout.gate.map(cell => ({ cell, pixels: stamp(cells.get(cell)) }));
  if (gates.some(gate => !gate.pixels || initial.has(gate.cell))) return;
  const gateCells = new Set(layout.gate), steps: CoverageMovementStep[] = [];
  let before = { actor, arrangement: arrangementOf(bodies) };
  const covered = (pose: CoveragePose) => layout.marks.every(mark => pose.arrangement.split(';').includes(mark));
  for (const { input, actor: landing, arrangement } of route.slice(0, Math.min(remaining, maximumCommittedActions))) {
    const after = { actor: landing, arrangement };
    const oldBodies = new Set(before.arrangement.split(';')), newBodies = new Set(arrangement.split(';'));
    const changedCells = [before.actor, landing, ...[...oldBodies].filter(cell => !newBodies.has(cell)),
      ...[...newBodies].filter(cell => !oldBodies.has(cell))];
    // A gate transition or a hidden landing needs a fresh observation before further commands.
    const substrate = stamp(cells.get(landing));
    if (!substrate || initial.has(landing) || changedCells.some(cell => gateCells.has(cell)) || covered(before) !== covered(after)) break;
    const changed = changedCells.map((cell): NativeBox => {
      const [x, y] = at(cell);
      return [x, y, x + pitch - 1, y + pitch - 1];
    });
    steps.push({ command: { action_ref: input, data: {} }, before, after, landing, substrate, changed });
    before = after;
  }
  return steps.length > 1 ? { steps, gates } : undefined;
}

export function matchesPullGates(series: CoveragePullSeries, travel: ObservedTravel, rows: NativeRows) {
  return series.gates.every(({ cell, pixels }) => stamp(readTravelCell(rows, travel.grid, at(cell))) === pixels);
}

export function coveragePullPremise(local: CoverageLearning, travel: ObservedTravel, rows: NativeRows, series: CoveragePullSeries, index: number) {
  return matchesPullGates(series, travel, rows) && coveragePushPremise(local, travel, rows, series.steps[index]!);
}

export function coveragePullReturn(local: CoverageLearning, travel: ObservedTravel, before: NativeRows, after: NativeRows,
  series: CoveragePullSeries, index: number) {
  return matchesPullGates(series, travel, after) && coveragePushReturn(local, travel, before, after, series.steps[index]!);
}

export function searchPullCoverage(actor: string, pieces: Set<string>, layout: Pick<Layout, 'marks' | 'gate' | 'exit'>,
  ground: ReadonlySet<string>, moves: readonly Move[], refusals: readonly string[], pressureBudget?: number, shorter?: ShorterSearch):
  { route?: PullStep[]; exhausted: boolean; examined: number } {
  const gates = new Set(layout.gate), open = new Set([...ground, ...gates]);
  const rejected = new Set(refusals);
  const neighbors = new Map([...open].map(cell => [cell, moves.flatMap(({ delta, input }) => {
    const target = next(cell, delta);
    return open.has(target) ? [{ target, tail: next(cell, delta, -1), input }] : [];
  })]));
  // Work backwards from each mark, allowing the gate in this relaxed lower bound.
  const distances = layout.marks.map(mark => {
    const distance = new Map([[mark, 0]]);
    for (const [cell, steps] of distance) for (const { target, tail } of neighbors.get(cell) ?? []) {
      if (open.has(tail) && !distance.has(tail) && open.has(target)) distance.set(tail, steps + 1);
    }
    return distance;
  });
  const remaining = (bodies: readonly string[], i = 0): number => {
    if (i === distances.length) return 0;
    return Math.min(...bodies.map((body, j) => {
      const steps = distances[i]!.get(body);
      return steps === undefined ? Infinity : steps + remaining(bodies.filter((_, k) => j !== k), i + 1);
    }));
  };
  type Path = PullStep & { previous: Path | undefined; distance: number };
  type PullPosition = { actor: string; pieces: Set<string>; path?: Path };
  const queue = new Map<number, PullPosition[]>(), seen = new Map<string, number>();
  const estimates = new Map<string, number>();
  const held = (pieces: Set<string>, at?: string) => layout.marks.every(mark => pieces.has(mark) || mark === at);
  const safe = (pieces: Set<string>, at: string) => held(pieces, at)
    || !gates.has(at) && !layout.gate.some(gate => pieces.has(gate));
  const pressure = pressureBudget !== undefined;
  let truncated = false;
  let best = Infinity;
  let finish: Path | undefined;
  let examined = 0;
  const bound = () => finish?.distance ?? shorter?.commands ?? Infinity;
  function route(ending: Path | undefined): PullStep[] {
    const steps: PullStep[] = [];
    for (let step = ending; step; step = step.previous) {
      steps.push({ input: step.input, actor: step.actor, arrangement: step.arrangement });
    }
    return steps.reverse();
  }
  function enqueue(state: PullPosition) {
    const arrangement = arrangementOf(state.pieces), key = `${state.actor}|${arrangement}`;
    const distance = state.path?.distance ?? 0;
    if ((seen.get(key) ?? Infinity) <= distance) return;
    seen.set(key, distance);
    let estimate = estimates.get(arrangement);
    if (estimate === undefined) { estimate = remaining([...state.pieces]); estimates.set(arrangement, estimate); }
    if (!Number.isFinite(estimate)) {
      if (!pressure) return;
      estimate = 0;
    }
    const priority = distance + (shorter ? 1 : 2) * estimate;
    if (priority >= bound()) return;
    const bucket = queue.get(priority) ?? [];
    bucket.push(state); queue.set(priority, bucket); best = Math.min(best, priority);
  }
  enqueue({ actor, pieces });
  while (queue.size && examined < (shorter?.states ?? (pressure ? 24_000 : coverageSearchStates))) {
    if (best >= bound()) break;
    examined++;
    const bucket = queue.get(best)!;
    const state = bucket.pop()!;
    if (!bucket.length) { queue.delete(best); best = Math.min(...queue.keys()); }
    const arrangement = arrangementOf(state.pieces);
    const covered = held(state.pieces);
    const walk = new Map<string, Path | undefined>([[state.actor, state.path]]);
    for (const [cell, previous] of walk) {
      if ((pressure || covered) && cell === layout.exit) {
        if (!shorter || previous === undefined) return { route: route(previous), exhausted: false, examined };
        if (previous.distance < bound()) finish = previous;
        break;
      }
      const distance = (previous?.distance ?? 0) + 1;
      if (distance >= bound()) continue;
      for (const { target, tail, input } of neighbors.get(cell) ?? []) {
        if (state.pieces.has(target) || !(pressure ? held(state.pieces, cell) : covered) && gates.has(target)
          || rejected.has(refusalKey(cell, arrangement, input))) continue;
        if (pressure && distance > pressureBudget) { truncated = true; continue; }
        if (state.pieces.has(tail)) {
          const bodies = new Set(state.pieces);
          bodies.delete(tail); bodies.add(cell);
          if (pressure ? !safe(bodies, target) : (gates.has(cell) || gates.has(target)) && !held(bodies)) continue;
          enqueue({ actor: target, pieces: bodies,
            path: { input, actor: target, arrangement: arrangementOf(bodies), previous, distance } });
        } else if (!walk.has(target) && (!pressure || safe(state.pieces, target))) {
          walk.set(target, { input, actor: target, arrangement, previous, distance });
        }
      }
    }
  }
  return finish ? { route: route(finish), exhausted: false, examined }
    : { exhausted: !queue.size && !truncated, examined };
}

export function chooseCoverage(local: CoverageLearning | undefined, travel: ObservedTravel | undefined, rows: NativeRows,
  remaining = maximumCommittedActions, preferShorter = false): CoveragePlan | undefined {
  if (!local?.layout || !local.body || !travel?.actor || local.deadlock) return;
  const { cells, pieces } = readTravelGrid(rows, travel.grid), moves = namedMoves(travel);
  if (!coversFourDirections(moves)) return;
  const layout = local.layout, motion = local.motion ?? 'push', bodies = new Set(bodiesAt(cells, local.body, layout));
  if (bodies.size < layout.marks.length || bodies.size > layout.marks.length + (local.water ? 1 : 0)) return;
  const ground = new Set([...cells].filter(([, pixels]) => pixels.every(value => value === travel.grid.floor)).map(([cell]) => cell));
  for (const cell of [travel.actor, ...bodies, ...layout.marks, layout.exit]) ground.add(cell);
  for (const cell of layout.gate) ground.delete(cell);
  const retained = local.pullRoute?.anchor === pullAnchor(travel.actor, arrangementOf(bodies), layout, cells)
    ? local.pullRoute.steps : undefined;
  const pullSearch = motion === 'pull' && !retained?.length
    ? searchPullCoverage(travel.actor, bodies, layout, ground, moves, local.pullRefusals ?? []) : undefined;
  const firstPull = retained?.length ? retained : pullSearch?.route;
  // Keep the complete baseline route unless a shorter one fits both remaining budgets.
  const pullAlternative = preferShorter && pullSearch && firstPull && firstPull.length > 1 && pullSearch.examined < coverageSearchStates
    ? searchPullCoverage(travel.actor, bodies, layout, ground, moves, local.pullRefusals ?? [], undefined,
      { commands: Math.min(firstPull.length, remaining + 1), states: coverageSearchStates - pullSearch.examined }) : undefined;
  const shorterPull = pullAlternative?.route;
  const route = shorterPull ?? firstPull;
  const start = { actor: travel.actor, bodies, supports: new Set(local.supports) };
  const water = new Set(motion === 'push' && local.water ? bySignature(cells, local.water) : []);
  const pushSearch = motion === 'push' ? pushPath(start, layout, ground, water, moves) : undefined;
  const firstPush = pushSearch?.path;
  const pushAlternative = preferShorter && pushSearch && firstPush && firstPush.commands > 1 && pushSearch.examined < coverageSearchStates
    ? pushPath(start, layout, ground, water, moves,
      { commands: Math.min(firstPush.commands, remaining + 1), states: coverageSearchStates - pushSearch.examined }) : undefined;
  const shorterPush = pushAlternative?.path;
  const pushed = pushSteps(shorterPush ?? firstPush);
  const input = route?.[0]?.input ?? pushed[0]?.input;
  const pushSeries = pieces.length === 1 && pieces[0] === start.actor
    ? bindPushSeries(pushed, start, cells, layout, travel.grid.pitch, remaining) : undefined;
  const pullSeries = route && pieces.length === 1 && pieces[0] === start.actor
    ? bindPullSeries(route, start.actor, bodies, cells, layout, travel.grid.pitch, remaining) : undefined;
  const verify = input || motion === 'pull' ? undefined : measureBarrier(local, layout, cells, ground, travel.actor, bodies, moves, travel.grid.floor);
  const routeImprovement = shorterPush && pushAlternative && firstPush && pushSearch
    ? { previous: firstPush.commands, proposed: shorterPush.commands, states: pushSearch.examined + pushAlternative.examined }
    : shorterPull && pullAlternative && firstPull && pullSearch
      ? { previous: firstPull.length, proposed: shorterPull.length, states: pullSearch.examined + pullAlternative.examined } : undefined;
  return input || verify ? { command: { action_ref: (input ?? verify)!, data: {} }, motion, marks: layout.marks, exit: layout.exit,
    evidence: [...new Set([...local.refs, ...moves.map(move => travel.moves[move.input]!.ref)])],
    covered: layout.marks.every(mark => bodies.has(mark)), ...(verify ? { verifyBarrier: true } : {}),
    ...(routeImprovement ? { routeImprovement } : {}),
    ...(route?.length ? { pullRoute: route } : {}), ...(pushSeries ? { pushSeries } : {}), ...(pullSeries ? { pullSeries } : {}) } : undefined;
}

export function retainCoverageAfterReset(local: CoverageLearning): CoverageLearning {
  const { deadlock, ...knowledge } = local;
  return { ...knowledge, supports: [], recovered: [...new Set([...local.recovered, ...(deadlock ? [deadlock.key] : [])])] };
}

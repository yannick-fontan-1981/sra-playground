import type { NativeCommand, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
export { sicObservedCoverageDeadlock as observedCoverageDeadlock } from '../logos-engine/v6-native-types.ts';
import { readTravelCell, readTravelGrid, type ObservedTravel } from './observed-travel-frontier.ts';

type Cells = ReturnType<typeof readTravelGrid>['cells'];
type Move = { input: string; delta: NativePoint };
type Layout = { marks: string[]; markInk: number; exit: string; gate: string[] };
export type CoverageLearning = {
  body?: string; layout?: Layout; supports: string[]; water?: string; walls: Record<string, string[]>;
  refs: string[]; deadlock?: { ref: string; key: string; bodies: string[] }; recovered: string[];
};
export type CoveragePlan = { command: NativeCommand; marks: string[]; exit: string; evidence: string[]; covered: boolean; verifyBarrier?: true };

const at = (value: string): NativePoint => value.split(',').map(Number) as [number, number];
const tag = (p: NativePoint) => p.join(',');
const next = (p: string, [dx, dy]: NativePoint, scale = 1) => {
  const [x, y] = at(p);
  return tag([x + dx * scale, y + dy * scale]);
};
const stamp = (pixels: readonly number[] | undefined) => pixels?.join(',') ?? '';
const bySignature = (cells: Cells, pattern: string) => [...cells].filter(([, pixels]) => stamp(pixels) === pattern).map(([id]) => id);
const initial = (): CoverageLearning => ({ supports: [], walls: {}, refs: [], recovered: [] });

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

function measureLayout(cells: Cells, pitch: number, floor: number, bodies: number): Layout | undefined {
  if (pitch % 2 !== 1) return;
  const half = Math.floor(pitch / 2), middle = half * pitch + half;
  const marks = new Map<string, { ink: number; cells: string[] }>(), rings: { ink: number; cell: string; center: number }[] = [];
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
  }
  const choices = [...marks.values()].filter(group => group.cells.length >= 2 && group.cells.length <= 6
    && (group.cells.length === bodies || group.cells.length + 1 === bodies)).flatMap(group => {
    const gate = rings.filter(ring => ring.ink === group.ink).map(ring => ring.cell);
    const exits = rings.filter(ring => ring.ink !== group.ink && ring.center === floor);
    return gate.length && exits.length === 1 ? [{ marks: group.cells, markInk: group.ink, exit: exits[0]!.cell, gate }] : [];
  });
  return choices.length === 1 ? choices[0] : undefined;
}

function namedMoves(travel: ObservedTravel): Move[] {
  return Object.entries(travel.moves).map(([input, value]) => ({ input, delta: value.delta }));
}

function coversFourDirections(moves: readonly Move[]): boolean {
  return moves.length === 4 && new Set(moves.map(move => tag(move.delta))).size === 4;
}

function seenPush(body: string | undefined, layout: Layout | undefined, from: string, move: Move, first: Cells, after: Cells) {
  const target = next(from, move.delta);
  const initialTile = first.get(target);
  if (!initialTile || new Set(initialTile).size < 2) return;
  const candidate = body ?? stamp(initialTile);
  const original = bodiesAt(first, candidate, layout), remaining = bodiesAt(after, candidate, layout);
  if (!original.includes(target)) return;
  let end = target;
  while (original.includes(end)) end = next(end, move.delta);
  const stable = original.filter(cell => cell !== target);
  if (stable.some(cell => !remaining.includes(cell)) || remaining.includes(target)) return;
  if (remaining.includes(end) && remaining.length === original.length) return { candidate, original, remaining };
  const landing = first.get(end), replacement = after.get(end);
  if (remaining.length === stable.length && landing && replacement && new Set(landing).size === 1
    && new Set(replacement).size > 1 && stamp(replacement) !== candidate) {
    return { candidate, original, remaining, sunk: end, water: stamp(landing) };
  }
}

export function observeCoverage(previous: CoverageLearning | undefined, travel: ObservedTravel | undefined,
  returned: ObservedTravel | undefined, before: NativeRows, after: NativeRows, command: NativeCommand, ref: string): CoverageLearning | undefined {
  if (!travel?.actor || !returned?.actor || travel.grid.ink !== returned.grid.ink) return previous;
  const displacement = travel.moves[command.action_ref]?.delta;
  if (!displacement) return previous;
  const local = previous ?? initial(), from = travel.actor, destination = next(from, displacement);
  const firstTile = readTravelCell(before, travel.grid, at(destination));
  let changed = local;
  let returnedCells: Cells | undefined;
  if (returned.actor === destination && new Set(firstTile).size >= 2) {
    const first = readTravelGrid(before, travel.grid).cells;
    returnedCells = readTravelGrid(after, travel.grid).cells;
    const observed = seenPush(local.body, local.layout, from, { input: command.action_ref, delta: displacement }, first, returnedCells);
    if (observed) {
      const layout = local.layout ?? measureLayout(first, travel.grid.pitch, travel.grid.floor, observed.original.length);
      if (layout) changed = { ...local, body: observed.candidate, layout,
        ...(observed.sunk && (!local.water || local.water === observed.water)
          ? { water: observed.water, supports: [...new Set([...local.supports, observed.sunk])] } : {}),
        refs: [...local.refs.slice(-5), ref] };
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
  if (changed.body && Object.values(changed.walls).some(positions => positions.length >= 2)) {
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

type Position = { actor: string; bodies: Set<string>; supports: Set<string>; first?: string };

function firstPath(start: Position, layout: Layout, ground: ReadonlySet<string>, water: ReadonlySet<string>, moves: readonly Move[]) {
  const key = (state: Position) => JSON.stringify([state.actor, [...state.bodies].sort(), [...state.supports].sort()]);
  const queue = [start], seen = new Set([key(start)]), relaxed = new Set([...ground, ...water, ...layout.gate]);
  const reverse = layout.marks.map(mark => reversePush(mark, relaxed, moves));
  for (let i = 0; i < queue.length && i < 6000; i++) {
    const state = queue[i]!;
    const covered = layout.marks.every(mark => state.bodies.has(mark));
    const canStand = (cell: string) => ground.has(cell) || state.supports.has(cell) || covered && layout.gate.includes(cell);
    const reachable = new Map<string, string | undefined>([[state.actor, state.first]]);
    for (const [cell, first] of reachable) for (const move of moves) {
      const target = next(cell, move.delta);
      if (!reachable.has(target) && !state.bodies.has(target) && canStand(target)) reachable.set(target, first ?? move.input);
    }
    if (covered && reachable.has(layout.exit)) return reachable.get(layout.exit);
    for (const piece of state.bodies) for (const move of moves) {
      const behind = next(piece, move.delta, -1);
      if (!reachable.has(behind)) continue;
      let end = next(piece, move.delta);
      while (state.bodies.has(end)) end = next(end, move.delta);
      const sink = water.has(end) && !state.supports.has(end);
      if (sink ? state.bodies.size <= layout.marks.length : !canStand(end)) continue;
      const bodies = new Set(state.bodies); bodies.delete(piece);
      const supports = new Set(state.supports);
      if (sink) supports.add(end);
      else bodies.add(end);
      if (!matchesAssignment([...bodies], reverse)) continue;
      const candidate = { actor: piece, bodies, supports, first: reachable.get(behind) ?? move.input };
      const signature = key(candidate);
      if (!seen.has(signature)) { seen.add(signature); queue.push(candidate); }
    }
  }
}

export function chooseCoverage(local: CoverageLearning | undefined, travel: ObservedTravel | undefined, rows: NativeRows): CoveragePlan | undefined {
  if (!local?.layout || !local.body || !travel?.actor || local.deadlock) return;
  const cells = readTravelGrid(rows, travel.grid).cells, moves = namedMoves(travel);
  if (!coversFourDirections(moves)) return;
  const layout = local.layout, bodies = new Set(bodiesAt(cells, local.body, layout));
  if (bodies.size < layout.marks.length || bodies.size > layout.marks.length + (local.water ? 1 : 0)) return;
  const ground = new Set([...cells].filter(([, pixels]) => pixels.every(value => value === travel.grid.floor)).map(([cell]) => cell));
  for (const cell of [travel.actor, ...bodies, ...layout.marks, layout.exit]) ground.add(cell);
  for (const cell of layout.gate) ground.delete(cell);
  const input = firstPath({ actor: travel.actor, bodies, supports: new Set(local.supports) },
    layout, ground, new Set(local.water ? bySignature(cells, local.water) : []), moves);
  const verify = input ? undefined : measureBarrier(local, layout, cells, ground, travel.actor, bodies, moves, travel.grid.floor);
  return input || verify ? { command: { action_ref: (input ?? verify)!, data: {} }, marks: layout.marks, exit: layout.exit,
    evidence: [...new Set([...local.refs, ...moves.map(move => travel.moves[move.input]!.ref)])],
    covered: layout.marks.every(mark => bodies.has(mark)), ...(verify ? { verifyBarrier: true } : {}) } : undefined;
}

export function retainCoverageAfterReset(local: CoverageLearning): CoverageLearning {
  const { deadlock, ...knowledge } = local;
  return { ...knowledge, supports: [], recovered: [...new Set([...local.recovered, ...(deadlock ? [deadlock.key] : [])])] };
}

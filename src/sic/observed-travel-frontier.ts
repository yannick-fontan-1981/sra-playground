import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeCommand, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import { observedCommandKey } from './observed-command-frontier.ts';
import { measureComponentTranslations } from './observed-translation.ts';

type Move = { delta: NativePoint; ref: string };
type Grid = { pitch: number; phase: NativePoint; ink: number; floor: number; signature?: string };
type Calibration = { grid: Grid; previous: string[]; next: string[]; destination: string; delta: NativePoint };
export type ObservedTravel = { grid: Grid; actor: string | null; supports: string[]; visited: string[];
  moves: Record<string, Move>; tested: Record<string, number>; altered: string[]; controls: string[];
  completed: string[]; switches: Record<string, string | null>; pendingSelection?: string; refs: string[]; stalled: number };
export type TravelTrial = { command: NativeCommand; target: NativePoint; evidence: string[];
  purpose: 'approach' | 'contact' | 'switch' | 'select' };

const key = ([x, y]: NativePoint) => `${x},${y}`;
const point = (value: string): NativePoint => value.split(',').map(Number) as [number, number];
const add = ([x, y]: NativePoint, [dx, dy]: NativePoint): NativePoint => [x + dx, y + dy];
const distance = ([x, y]: NativePoint, [u, v]: NativePoint) => Math.abs(x - u) + Math.abs(y - v);
const directional = (action: string) => /^ACTION[1-4]$/.test(action);

function tile(rows: NativeRows, grid: Grid, [x, y]: NativePoint) {
  return rows.slice(y, y + grid.pitch).flatMap(row => row.slice(x, x + grid.pitch));
}

function paletteSignature(pixels: readonly number[]) {
  return [...pixels].sort((a, b) => a - b).join(',');
}

function dominant(pixels: readonly number[], excluded: number) {
  const counts = new Map<number, number>();
  for (const ink of pixels) if (ink !== excluded) counts.set(ink, (counts.get(ink) ?? 0) + 1);
  return [...counts].find(([, count]) => count * 2 > pixels.length)?.[0];
}

function frameMarks(rows: NativeRows, { pitch, phase, floor }: Grid) {
  return geometricComponents(rows).filter(({ color, rectangular, bbox: [l, t, r, b], area }) => {
    if (color === floor || rectangular || r - l + 1 !== pitch || b - t + 1 !== pitch
      || l % pitch !== phase[0] || t % pitch !== phase[1] || area < 2 * pitch - 1) return false;
    return rows[t + Math.floor(pitch / 2)]?.[l + Math.floor(pitch / 2)] === floor;
  }).map(({ bbox: [x, y] }) => key([x, y]));
}

function read(rows: NativeRows, grid: Grid) {
  const cells = new Map<string, number[]>(), pieces: string[] = [];
  for (let y = grid.phase[1]; y + grid.pitch <= rows.length; y += grid.pitch) {
    for (let x = grid.phase[0]; x + grid.pitch <= rows[0]!.length; x += grid.pitch) {
      const id = key([x, y]), pixels = tile(rows, grid, [x, y]);
      cells.set(id, pixels);
      if (grid.signature ? pixels.includes(grid.ink) && paletteSignature(pixels) === grid.signature
        : pixels.filter(ink => ink === grid.ink).length >= Math.max(2, Math.floor(grid.pitch / 2))) pieces.push(id);
    }
  }
  return { cells, pieces };
}

export { read as readTravelGrid, tile as readTravelCell };

function calibrateAmongOtherChanges(before: NativeRows, after: NativeRows, lattices: Iterable<Grid>,
  changed: readonly NativePoint[]): Calibration[] {
  const translations = measureComponentTranslations(before, after, part => part.area >= 3 && part.area <= 36);
  const result: Calibration[] = [];
  for (const { from, displacement: delta } of translations) {
    if (Boolean(delta[0]) === Boolean(delta[1])) continue;
    for (const lattice of lattices) {
      const { pitch, phase: [px, py], floor } = lattice;
      if (distance([0, 0], delta) !== pitch || from.color === floor) continue;
      const [x, y, r, b] = from.bbox;
      const origin: NativePoint = [px + Math.floor((x - px) / pitch) * pitch, py + Math.floor((y - py) / pitch) * pitch];
      const landing = add(origin, delta);
      if (origin[0] < 0 || origin[1] < 0 || r >= origin[0] + pitch || b >= origin[1] + pitch
        || landing[0] < 0 || landing[1] < 0 || landing[0] + pitch > after[0]!.length || landing[1] + pitch > after.length) continue;
      const outside = ([u, v]: NativePoint, [l, t]: NativePoint) => u < l || u >= l + pitch || v < t || v >= t + pitch;
      if (!changed.some(cell => outside(cell, origin) && outside(cell, landing))) continue;
      const oldTile = tile(before, lattice, origin), newTile = tile(after, lattice, landing);
      const signature = paletteSignature(oldTile);
      if (!oldTile.includes(floor) || paletteSignature(newTile) !== signature) continue;
      const grid = { ...lattice, ink: from.color, signature };
      const previous = read(before, grid).pieces, next = read(after, grid).pieces;
      if (previous.length === 1 && previous[0] === key(origin) && next.length === 1 && next[0] === key(landing)) {
        result.push({ grid, previous, next, destination: next[0]!, delta });
      }
    }
  }
  return result;
}

function learnGrid(before: NativeRows, after: NativeRows, command: string, ref: string): ObservedTravel | undefined {
  if (before.length !== after.length || before[0]?.length !== after[0]?.length) return;
  const changed: NativePoint[] = [];
  for (const [y, row] of before.entries()) {
    for (const [x, ink] of row.entries()) if (ink !== after[y]?.[x]) changed.push([x, y]);
  }
  if (changed.length < 6) return;
  const lattices = new Map<string, Grid>();
  for (const { color, bbox: [x, y, r, b], rectangular, area } of geometricComponents(before)) {
    const pitch = r - x + 1;
    if (rectangular || pitch < 2 || pitch > 8 || b - y + 1 !== pitch || area < 2 * pitch - 1) continue;
    const floor = before[y + Math.floor(pitch / 2)]![x + Math.floor(pitch / 2)]!;
    if (floor === color) continue;
    const grid: Grid = { pitch, phase: [x % pitch, y % pitch], ink: -1, floor };
    lattices.set(JSON.stringify(grid), grid);
  }
  const candidates: Calibration[] = [];
  for (const lattice of lattices.values()) {
    const [px, py] = lattice.phase, size = lattice.pitch;
    const origins = new Set(changed.map(([x, y]) =>
      key([px + Math.floor((x - px) / size) * size, py + Math.floor((y - py) / size) * size])));
    const exits: [string, number[]][] = [], entries: [string, number[]][] = [];
    for (const id of origins) {
      const at = point(id);
      if (at[0] < 0 || at[1] < 0 || at[0] + size > before[0]!.length || at[1] + size > before.length) continue;
      const first = tile(before, lattice, at), second = tile(after, lattice, at);
      const wasFloor = first.every(ink => ink === lattice.floor), isFloor = second.every(ink => ink === lattice.floor);
      if (!wasFloor && isFloor) exits.push([id, first]);
      if (wasFloor && !isFloor) entries.push([id, second]);
    }
    if (exits.length !== 1 || entries.length !== 1) continue;
    const [from, vacated] = exits[0]!, [destination, occupied] = entries[0]!;
    const [x, y] = point(from), [u, v] = point(destination), delta: NativePoint = [u - x, v - y];
    if (Boolean(delta[0]) === Boolean(delta[1]) || distance([x, y], [u, v]) !== lattice.pitch) continue;
    // A cursor may change its silhouette as it turns. Learn from matching ink vacated and
    // acquired on two separate cells of the same measured surface.
    const hues = [...new Set(vacated)].filter(ink => ink !== lattice.floor
      && vacated.filter(color => color === ink).length >= 3
      && occupied.filter(color => color === ink).length >= 3);
    if (hues.length !== 1) continue;
    const grid = { ...lattice, ink: hues[0]! };
    const previous = read(before, grid).pieces, next = read(after, grid).pieces;
    if (!previous.length || previous.length > 4 || next.length !== previous.length
      || previous.filter(cell => !next.includes(cell)).join(';') !== from
      || next.filter(cell => !previous.includes(cell)).join(';') !== destination) continue;
    candidates.push({ grid, previous, next, destination, delta });
  }
  if (!candidates.length && lattices.size) candidates.push(...calibrateAmongOtherChanges(before, after, lattices.values(), changed));
  if (candidates.length !== 1) return;
  const { grid, previous, next, destination, delta } = candidates[0]!;
  return { grid, actor: destination, supports: [], visited: [...previous, ...next], moves: { [command]: { delta, ref } },
    tested: {}, altered: [], controls: [], completed: [], switches: {}, refs: [ref], stalled: 0 };
}

function trialKey(cells: ReadonlyMap<string, number[]>, action: string, from: string, target: NativePoint) {
  return JSON.stringify([action, from, cells.get(key(target))]);
}

export function observeTravel(previous: ObservedTravel | undefined, before: NativeRows, after: NativeRows,
  command: NativeCommand, ref: string): ObservedTravel | undefined {
  const action = command.action_ref;
  if (!previous) return directional(action) ? learnGrid(before, after, action, ref) : undefined;
  const { grid } = previous, first = read(before, grid), next = read(after, grid);
  const left = first.pieces.filter(cell => !next.pieces.includes(cell)), entered = next.pieces.filter(cell => !first.pieces.includes(cell));
  const changed = [...first.cells].filter(([cell, pixels]) => !first.pieces.includes(cell) && !next.pieces.includes(cell)
    && pixels.some((ink, i) => ink !== next.cells.get(cell)?.[i])).map(([cell]) => cell);
  if (directional(action) && !left.length && !entered.length && changed.length >= 2) {
    const other = learnGrid(before, after, action, ref);
    if (other && other.grid.ink !== grid.ink) return other;
  }
  let actor = previous.actor, pendingSelection = previous.pendingSelection;
  const moves = { ...previous.moves }, tested = { ...previous.tested }, switches = { ...previous.switches };
  const controls = action === 'ACTION5' && changed.length >= 2 ? [...new Set([...previous.controls, action])] : previous.controls;
  const altered = action === 'ACTION5' && changed.length >= 2 ? [...new Set([...previous.altered, ...changed])].sort() : previous.altered;
  const supports = new Set(previous.supports), visited = new Set(previous.visited), completed = new Set(previous.completed);
  if (left.length === 1 && entered.length === 1) {
    const from = left[0]!, to = entered[0]!, [x, y] = point(from), [u, v] = point(to);
    const delta: NativePoint = [u - x, v - y];
    actor = to;
    pendingSelection = undefined;
    visited.add(to);
    if (directional(action) && distance([x, y], [u, v]) === grid.pitch && (!delta[0] || !delta[1])) {
      if (!moves[action]) moves[action] = { delta, ref };
      if (key(moves[action]!.delta) === key(delta)) supports.add(first.cells.get(to)!.join(','));
    }
    if (frameMarks(before, grid).includes(to)) completed.add(to);
    completed.delete(from);
  } else if (directional(action) && pendingSelection && next.pieces.includes(pendingSelection)) {
    if (actor !== pendingSelection && next.pieces.length > 1) actor = pendingSelection;
    pendingSelection = undefined;
  } else if (action === 'ACTION6' && typeof command.data.x === 'number' && typeof command.data.y === 'number') {
    const { x, y } = command.data, at = first.pieces.find(cell => {
      const [l, t] = point(cell);
      return x >= l && x < l + grid.pitch && y >= t && y < t + grid.pitch;
    });
    if (at && before.some((row, yy) => row.some((ink, xx) => ink !== after[yy]?.[xx]))) {
      actor = at;
      pendingSelection = at;
    }
  }
  const origin = previous.actor;
  let freshTrial = false;
  if (action === 'ACTION5' && origin && previous.altered.includes(origin)) {
    switches[origin] = actor === origin ? null : actor;
  }
  if (origin && first.pieces.includes(origin)) {
    const expected = directional(action) && moves[action] ? add(point(origin), moves[action]!.delta) : point(origin);
    const attempt = trialKey(first.cells, observedCommandKey(command), origin, expected);
    freshTrial = !Object.hasOwn(tested, attempt);
    if (directional(action) && actor === origin && !left.length && !entered.length && !changed.includes(key(expected))) tested[attempt] = -1;
    else tested[attempt] = (tested[attempt] ?? 0) + 1;
  }
  for (const cell of completed) if (!next.pieces.includes(cell)) completed.delete(cell);
  const gained = freshTrial || visited.size > previous.visited.length || supports.size > previous.supports.length
    || completed.size > previous.completed.length || Object.keys(moves).length > Object.keys(previous.moves).length;
  return { grid, actor: actor && next.pieces.includes(actor) ? actor : next.pieces.length === 1 ? next.pieces[0]! : null,
    supports: [...supports], visited: [...visited], moves, tested, altered, controls, switches, completed: [...completed],
    ...(pendingSelection ? { pendingSelection } : {}), refs: [...previous.refs.slice(-5), ref], stalled: gained ? 0 : previous.stalled + 1 };
}

export function chooseTravelTrial(state: ObservedTravel | undefined, rows: NativeRows, inputs: readonly NativeCommand[],
  canSelect: boolean): TravelTrial | undefined {
  if (!state?.actor || state.stalled >= 12) return;
  const { grid, actor, tested, switches } = state, { cells, pieces } = read(rows, grid);
  const goals = frameMarks(rows, grid).filter(cell => !pieces.includes(cell));
  if (!pieces.includes(actor) || !goals.length || pieces.length > 4) return;
  const moves = inputs.flatMap(command => state.moves[command.action_ref] ? [{ command, ...state.moves[command.action_ref]! }] : []);
  if (!moves.length) return;
  const evidence = [...new Set([...state.refs, ...moves.map(move => move.ref)])];
  const start = point(actor);
  const unmeasured = inputs.filter(input => directional(input.action_ref) && !state.moves[input.action_ref]);
  const untriedAt = (cell: string) => unmeasured.find(input => !(trialKey(cells, input.action_ref, cell, point(cell)) in tested));
  const unmapped = untriedAt(actor);
  if (unmapped) return { command: unmapped, target: start, purpose: 'contact', evidence };
  const switchCommand = inputs.find(input => state.controls.includes(input.action_ref));
  const altered = new Set(state.altered);
  const floorCost = (cell: string): number => {
    if (goals.includes(cell)) return 0;
    const pixels = cells.get(cell);
    if (!pixels) return Infinity;
    if (state.supports.includes(pixels.join(',')) || dominant(pixels, grid.ink) === grid.floor) return 1;
    return new Set(pixels).size > 1 && (grid.signature || !pixels.includes(grid.ink))
      && (pixels.includes(grid.floor) || altered.has(cell)) ? 4 : Infinity;
  };
  type Path = { at: string; first: NativeCommand | null; cost: number };
  const visited = new Set(state.visited);
  const canTestSwitch = (cell: string) => !!switchCommand && altered.has(cell) && !(cell in switches);
  function route(origin: string) {
    const open: Path[] = [{ at: origin, first: null, cost: 0 }];
    const costs = new Map([[origin, 0]]);
    let best: { first: NativeCommand; cell: string; score: number; goal: boolean } | undefined;
    const offer = (first: NativeCommand, cell: string, cost: number, goal: boolean) => {
      const near = Math.min(...goals.map(target => distance(point(cell), point(target)))) / grid.pitch;
      const score = cost + 4 * near - (canTestSwitch(cell) ? 4 : 0);
      if (!best || goal && !best.goal || goal === best.goal && score < best.score) best = { first, cell, score, goal };
    };
    for (let i = 0; i < open.length; i++) {
      const node = open[i]!;
      if (node.cost !== costs.get(node.at)) continue;
      if (node.first && (!visited.has(node.at) || canTestSwitch(node.at) || goals.includes(node.at) || untriedAt(node.at))) {
        offer(node.first, node.at, node.cost, goals.includes(node.at));
      }
      for (const move of moves) {
        const destination = add(point(node.at), move.delta), cell = key(destination);
        if (pieces.includes(cell) && cell !== origin) continue;
        const tried = tested[trialKey(cells, move.command.action_ref, node.at, destination)] ?? 0;
        if (tried < 0) continue;
        const cost = node.cost + 1 + floorCost(cell) + Math.min(8, tried * 2);
        if (!Number.isFinite(cost)) {
          const pixels = cells.get(cell);
          // A visible feature is worth a contact trial. Transit beyond it needs a measured foothold.
          if (!tried && pixels && new Set(pixels).size > 1 && (grid.signature || !pixels.includes(grid.ink))) {
            offer(node.first ?? move.command, cell, node.cost + 6, false);
          }
          continue;
        }
        if (cost >= (costs.get(cell) ?? Infinity)) continue;
        costs.set(cell, cost);
        open.push({ at: cell, first: node.first ?? move.command, cost });
      }
      const landing = switches[node.at];
      if (switchCommand && landing && !pieces.includes(landing) && node.cost + 2 < (costs.get(landing) ?? Infinity)) {
        costs.set(landing, node.cost + 2);
        open.push({ at: landing, first: node.first ?? switchCommand, cost: node.cost + 2 });
      }
    }
    return best;
  }
  const active = state.completed.includes(actor) ? undefined : route(actor);
  if (switchCommand && !active?.goal && canTestSwitch(actor)) {
    return { command: switchCommand, target: start, purpose: 'switch', evidence };
  }
  const peer = pieces.filter(cell => cell !== actor && !state.completed.includes(cell)).map(cell => ({ cell, plan: route(cell) }))
    .filter(option => !!option.plan).sort((a, b) => a.plan!.score - b.plan!.score)[0];
  if (canSelect && peer && (!active || peer.plan!.score + 8 < active.score)) {
    const at = point(peer.cell), offset = Math.floor(grid.pitch / 2);
    const command = { action_ref: 'ACTION6', data: { x: at[0] + offset, y: at[1] + offset } };
    if (!tested[trialKey(cells, observedCommandKey(command), actor, start)]) {
      return { command, target: at, purpose: 'select', evidence };
    }
  }
  if (active) return { command: active.first, target: point(active.cell),
    purpose: active.first === switchCommand ? 'switch' : active.goal ? 'approach' : 'contact', evidence };
}

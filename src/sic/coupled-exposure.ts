import type { NativeExecution, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

export type ExposureSite = { pos: NativePoint; color: number };
export type ExposureDial = { point: NativePoint; vector: NativePoint; active: boolean };
export type ExposureScene = { origin: NativePoint; size: NativePoint; pitch: number; actor: NativePoint; bodies: ExposureSite[];
  slots: ExposureSite[]; walls: NativePoint[]; dial: ExposureDial[]; layout: string; actor_color: number };
export type ExposureColors = { linked: number; released: number; shadow: number; lit: number };
export type CouplingColors = Pick<ExposureColors, 'linked' | 'released'>;
export type ExposureBoard = { width: number; height: number; walls: number[]; goals: { cell: number; color: number }[]; colors: ExposureColors };
type Piece = { cell: number; color: number };
export type ExposureState = { actor: number; facing: number; pieces: Piece[] };

export const exposureMoves: readonly NativePoint[] = [[0, -1], [0, 1], [-1, 0], [1, 0]];
export const exposureBearings: readonly NativePoint[] = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
export const exposurePoint = (cell: number, width: number): NativePoint => [cell % width, Math.floor(cell / width)];
const at = ([x, y]: NativePoint, width: number) => y * width + x;
export const exposureBearing = ([x, y]: NativePoint) => exposureBearings.findIndex(([dx, dy]) => dx === Math.sign(x) && dy === Math.sign(y));
const stateKey = ({ actor, facing, pieces }: ExposureState) => [actor, facing, ...pieces.flatMap(piece => [piece.cell, piece.color])].join(',');

export function readExposureBoard(scene: ExposureScene, photo: Pick<ExposureColors, 'shadow' | 'lit'>,
  retained?: CouplingColors): [ExposureBoard, ExposureState] | null {
  const { size: [width, height], slots, bodies, actor, dial, walls } = scene;
  if (bodies.length < 3 || bodies.length > (retained ? 8 : 5) || slots.length !== bodies.length || dial.length !== exposureBearings.length) return null;
  const linked = retained ? [retained.linked] : [...new Set(bodies.filter(b => b.color !== photo.shadow).map(b => b.color))];
  const released = retained ? [retained.released] : [...new Set(slots.filter(slot => slot.color !== linked[0] && slot.color !== photo.shadow).map(slot => slot.color))];
  if (linked.length !== 1 || released.length !== 1 || !bodies.some(b => b.color === photo.shadow)
    || !slots.some(slot => slot.color === linked[0])) return null;
  const colors = { linked: linked[0]!, released: released[0]!, ...photo }, palette = new Set(Object.values(colors));
  if (palette.size !== 4 || [...bodies, ...slots].some(piece => !palette.has(piece.color))) return null;
  const facing = exposureBearing(dial.find(position => position.active)?.vector ?? [0, 0]);
  if (facing < 0) return null;
  const board = { width, height, walls: walls.map(p => at(p, width)), goals: slots.map(s => ({ cell: at(s.pos, width), color: s.color })), colors };
  const sorted = [...bodies].sort((a, b) => at(a.pos, width) - at(b.pos, width));
  return [board, { actor: at(actor, width), facing, pieces: sorted.map(b => ({ cell: at(b.pos, width), color: b.color })) }];
}

export function exposureMatches(board: ExposureBoard, state: ExposureState, scene: ExposureScene) {
  const { width, height, goals } = board, active = scene.dial.find(dial => dial.active);
  return scene.size[0] === width && scene.size[1] === height && at(scene.actor, width) === state.actor
    && !!active && exposureBearing(active.vector) === state.facing
    && scene.bodies.length === state.pieces.length && state.pieces.every(piece =>
      scene.bodies.some(body => at(body.pos, width) === piece.cell && body.color === piece.color))
    && scene.slots.length === goals.length && goals.every(goal => scene.slots.some(slot => at(slot.pos, width) === goal.cell && slot.color === goal.color));
}

export function readTrackedExposure(rows: NativeRows, scene: ExposureScene, board: ExposureBoard, dialInk: number): ExposureScene | null {
  const { width, height, colors } = board, { origin, pitch, actor_color } = scene, sides = pitch - 2;
  const walls = new Set(board.walls), inks = Object.values(colors), bodies: ExposureSite[] = [], actors: NativePoint[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (walls.has(y * width + x)) continue;
    const l = origin[0] + x * pitch + 1, t = origin[1] + y * pitch + 1, hues = new Map<number, number>();
    for (let dy = 0; dy < sides; dy++) for (let dx = 0; dx < sides; dx++) {
      const ink = rows[t + dy]?.[l + dx];
      if (ink === undefined) return null;
      hues.set(ink, (hues.get(ink) ?? 0) + 1);
    }
    const pos: NativePoint = [x, y], area = sides * sides;
    if ((hues.get(actor_color) ?? 0) >= area - 2) {
      actors.push(pos);
      continue;
    }
    const color = inks.find(ink => hues.get(ink) === area || hues.get(ink) === area - 1
      && scene.slots.some(slot => slot.color === ink && at(slot.pos, width) === at(pos, width)));
    if (color !== undefined) bodies.push({ pos, color });
  }
  const dial = scene.dial.map(d => ({ ...d, active: rows[d.point[1]]?.[d.point[0]] === dialInk }));
  if (actors.length !== 1 || bodies.length !== scene.bodies.length || dial.filter(d => d.active).length !== 1) return null;
  return { ...scene, actor: actors[0]!, bodies, dial };
}

export const finishedExposure = (board: ExposureBoard, state: ExposureState) =>
  board.goals.every(goal => state.pieces.some(piece => piece.cell === goal.cell && piece.color === goal.color));

export function exposureRules(board: ExposureBoard) {
  const { width, height, colors: { linked, released, shadow, lit } } = board, count = width * height;
  const walls = new Set(board.walls), grid = Array.from({ length: count }, (_, cell) => exposurePoint(cell, width));
  const neighbors = grid.map(([x, y]) => exposureMoves.map(([dx, dy]) => {
    const u = x + dx, v = y + dy, next = v * width + u;
    return u >= 0 && u < width && v >= 0 && v < height && !walls.has(next) ? next : -1;
  }));
  type Sight = { mask: number; between: number[] };
  const rays: (Sight | undefined)[] = [];
  function sight(from: number, to: number): Sight {
    const key = from * count + to, cached = rays[key];
    if (cached) return cached;
    const [x0, y0] = grid[from]!, [x1, y1] = grid[to]!, dx = x1 - x0, dy = y1 - y0;
    const ax = Math.abs(dx), ay = Math.abs(dy), sx = Math.sign(dx), sy = Math.sign(dy);
    const between: number[] = [];
    let mask = 0;
    for (const [i, [vx, vy]] of exposureBearings.entries()) {
      const product = dx * vx + dy * vy, cross = Math.abs(dx * vy - dy * vx);
      if (product > 0 && cross * 1_000_000 <= product * 414_214) mask |= 1 << i;
    }
    let x = x0, y = y0, ix = 0, iy = 0;
    const include = (cell: number) => {
      if (cell === to) return;
      if (walls.has(cell)) mask = 0;
      between.push(cell);
    };
    while (mask && (x !== x1 || y !== y1)) {
      const decision = (2 * ix + 1) * ay - (2 * iy + 1) * ax;
      if (decision < 0) { x += sx; ix++; }
      else if (decision > 0) { y += sy; iy++; }
      else {
        include(y * width + x + sx);
        include((y + sy) * width + x);
        x += sx; y += sy; ix++; iy++;
      }
      include(y * width + x);
    }
    return rays[key] = { mask, between };
  }
  const occupant = (pieces: readonly Piece[], cell: number) => pieces.findIndex(piece => piece.cell === cell);
  function translations(pieces: Piece[], direction: number, actor: number, movingActor: boolean, seeds: number[]): number {
    function expand(start: number[]) {
      const queue = [...start];
      let visited = 0;
      for (const i of queue) {
        if (visited & (1 << i)) continue;
        visited |= 1 << i;
        const next = neighbors[pieces[i]!.cell]![direction]!;
        if (next < 0 || !movingActor && next === actor) return -1;
        const peer = occupant(pieces, next);
        if (peer >= 0 && !(visited & (1 << peer))) queue.push(peer);
      }
      return visited;
    }
    let moved = expand(seeds);
    if (moved < 0) return -1;
    if (pieces.some((piece, i) => piece.color === linked && !!(moved & (1 << i)))) {
      for (const [i, piece] of pieces.entries()) {
        if (piece.color !== linked || moved & (1 << i)) continue;
        const branch = expand([i]);
        if (branch >= 0) moved |= branch;
      }
    }
    for (const [i, piece] of pieces.entries()) if (moved & (1 << i)) piece.cell = neighbors[piece.cell]![direction]!;
    return moved;
  }
  function refresh({ actor, facing, pieces }: ExposureState, shield: number) {
    for (const [i, piece] of pieces.entries()) {
      if (piece.color === released || shield & (1 << i)) continue;
      const light = sight(actor, piece.cell), exposed = !!(light.mask & (1 << facing))
        && light.between.every(cell => occupant(pieces, cell) < 0);
      if (piece.color === linked) { if (exposed) piece.color = released; }
      else piece.color = exposed ? lit : shadow;
    }
    let contacts = 0;
    for (const [i, piece] of pieces.entries()) {
      if (piece.color === released && pieces.some(peer => peer.color === released && neighbors[piece.cell]!.includes(peer.cell))) contacts |= 1 << i;
    }
    for (const [i, piece] of pieces.entries()) if (contacts & (1 << i)) piece.color = linked;
    return shield | contacts;
  }
  function project(current: ExposureState, action: number): ExposureState {
    if (action === 5 + current.facing) return current;
    const state = { actor: current.actor, facing: action >= 5 ? action - 5 : current.facing, pieces: current.pieces.map(piece => ({ ...piece })) };
    const { pieces } = state, [x, y] = grid[state.actor]!;
    if (action < 4) {
      const destination = neighbors[state.actor]![action]!;
      if (destination >= 0) {
        const contact = new Set<number>(), attached = [state.actor];
        for (const cell of attached) for (const neighbor of neighbors[cell]!) {
          const body = occupant(pieces, neighbor);
          if (body >= 0 && pieces[body]!.color === shadow && !contact.has(body)) { contact.add(body); attached.push(neighbor); }
        }
        const pushed = occupant(pieces, destination);
        if (pushed >= 0) contact.add(pushed);
        if (translations(pieces, action, state.actor, true, [...contact]) >= 0) state.actor = destination;
      }
    }
    let shield = refresh(state, 0), carried = 0;
    const candidates = pieces.flatMap((piece, i) => piece.color === lit ? [i] : []);
    const [actorX, actorY] = state.actor === current.actor ? [x, y] : grid[state.actor]!;
    for (const i of candidates) {
      const { cell, color } = pieces[i]!, [cx, cy] = grid[cell]!;
      if (color !== lit || carried & (1 << i) || (cx === actorX) === (cy === actorY)) continue;
      const away = cx === actorX ? cy < actorY ? 0 : 1 : cx < actorX ? 2 : 3;
      const moved = translations(pieces, away, state.actor, false, [i]);
      if (moved > 0) { carried |= moved; shield = refresh(state, shield); }
    }
    return state;
  }
  return { project, neighbors };
}

function receiverDistances(board: ExposureBoard, neighbors: number[][]) {
  const { linked, released } = board.colors;
  return board.goals.map(goal => {
    const requirePush = goal.color === linked || goal.color === released;
    const distance = Array<number>(neighbors.length).fill(Infinity), queue = [goal.cell];
    distance[goal.cell] = 0;
    for (const cell of queue) for (const direction of [0, 1, 2, 3]) {
      const before = neighbors[cell]![direction]!;
      if (before < 0 || Number.isFinite(distance[before]) || requirePush && neighbors[before]![direction]! < 0) continue;
      distance[before] = distance[cell]! + 1;
      queue.push(before);
    }
    return distance;
  });
}

type Entry = { score: number; depth: number; parent: Entry | null; action: number; state: ExposureState; key: string };
class ExposureQueue {
  readonly values: Entry[] = [];
  push(value: Entry) {
    const heap = this.values;
    let i = heap.length;
    heap.push(value);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heap[parent]!.score <= value.score) break;
      heap[i] = heap[parent]!; i = parent;
    }
    heap[i] = value;
  }
  pop() {
    const heap = this.values, item = heap[0]!, last = heap.pop()!;
    if (heap.length) {
      let i = 0;
      while (i * 2 + 1 < heap.length) {
        let child = i * 2 + 1;
        if (child + 1 < heap.length && heap[child + 1]!.score < heap[child]!.score) child++;
        if (heap[child]!.score >= last.score) break;
        heap[i] = heap[child]!; i = child;
      }
      heap[i] = last;
    }
    return item;
  }
}

export async function planExposure(board: ExposureBoard, start: ExposureState, actions: readonly number[], remaining: number,
  execution?: NativeExecution): Promise<number[]> {
  const { project, neighbors } = exposureRules(board), distances = receiverDistances(board, neighbors);
  const isLinked = (color: number) => color === board.colors.linked || color === board.colors.released;
  function estimates(goal: number, pieces: readonly Piece[], used: number): number {
    if (goal >= board.goals.length) return 0;
    const receiver = board.goals[goal]!;
    let best = Infinity;
    for (const [i, body] of pieces.entries()) {
      if (used & (1 << i) || isLinked(receiver.color) !== isLinked(body.color)) continue;
      const distance = distances[goal]![body.cell]!, recolor = receiver.color === body.color ? 0 : 1;
      const [x, y] = exposurePoint(body.cell, board.width), [gx, gy] = exposurePoint(receiver.cell, board.width);
      const cost = Number.isFinite(distance) ? distance : 8 + Math.abs(x - gx) + Math.abs(y - gy);
      best = Math.min(best, cost + recolor + estimates(goal + 1, pieces, used | (1 << i)));
    }
    return best;
  }
  const groupEstimates = [false, true].map(linked => {
    const receivers = board.goals.flatMap((goal, index) => isLinked(goal.color) === linked ? [index] : []);
    const cache = new Map<string, number>();
    return (pieces: readonly Piece[]) => {
      const group = pieces.filter(piece => isLinked(piece.color) === linked);
      if (group.length !== receivers.length) return Infinity;
      const identity = group.map(piece => piece.cell * 16 + piece.color).sort((a, b) => a - b).join(',');
      const known = cache.get(identity);
      if (known !== undefined) return known;
      const costs = receivers.map(receiver => group.map(body => {
        const goal = board.goals[receiver]!, distance = distances[receiver]![body.cell]!, recolor = Number(goal.color !== body.color);
        if (Number.isFinite(distance)) return distance + recolor;
        const [x, y] = exposurePoint(body.cell, board.width), [gx, gy] = exposurePoint(goal.cell, board.width);
        return 8 + Math.abs(x - gx) + Math.abs(y - gy) + recolor;
      }));
      const sizes = 1 << group.length, values = new Float64Array(sizes).fill(Infinity);
      values[0] = 0;
      for (let mask = 0; mask < sizes - 1; mask++) {
        let assigned = 0;
        for (let subset = mask; subset; subset &= subset - 1) assigned++;
        for (let i = 0; i < group.length; i++) {
          const bit = 1 << i;
          if (!(mask & bit)) values[mask | bit] = Math.min(values[mask | bit]!, values[mask]! + costs[assigned]![i]!);
        }
      }
      const value = values[sizes - 1]!;
      if (cache.size < 200_000) cache.set(identity, value);
      return value;
    };
  });
  const estimated = start.pieces.length > 6
    ? (pieces: readonly Piece[]) => groupEstimates[0]!(pieces) + groupEstimates[1]!(pieces)
    : (pieces: readonly Piece[]) => estimates(0, pieces, 0);
  const queue = new ExposureQueue(), first = stateKey(start), costs = new Map([[first, 0]]);
  queue.push({ score: 0, depth: 0, parent: null, action: -1, state: start, key: first });
  for (let work = 0; queue.values.length && work < 200_000; work++) {
    if (work % 512 === 0 && execution) {
      if (execution.signal?.aborted || execution.deadlineMs !== undefined && (execution.now ?? (() => performance.now()))() >= execution.deadlineMs) return [];
      if (work) await execution.yieldControl();
    }
    const current = queue.pop();
    if (costs.get(current.key) !== current.depth) continue;
    if (finishedExposure(board, current.state)) {
      const route: number[] = [];
      for (let item = current; item.parent; item = item.parent) route.push(item.action);
      return route.reverse();
    }
    const depth = current.depth + 1;
    if (depth > remaining || costs.size > 450_000) continue;
    for (const action of actions) {
      const state = project(current.state, action), key = stateKey(state);
      if ((costs.get(key) ?? Infinity) <= depth) continue;
      const estimate = estimated(state.pieces);
      if (!Number.isFinite(estimate)) continue;
      costs.set(key, depth);
      queue.push({ score: depth + 4 * estimate, depth, parent: current, action, state, key });
    }
  }
  return [];
}

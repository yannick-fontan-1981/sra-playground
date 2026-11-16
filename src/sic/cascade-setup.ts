import type { NativePoint } from '../logos-engine/v6-native-types.ts';

export type CascadeTile = { at: NativePoint; direction?: NativePoint; color?: number; junction?: boolean; hidden?: boolean };
export type CascadePeer = { at: NativePoint; mark: number };
export type CascadeSetup = { route: NativePoint[]; guards: NativePoint[]; gap: NativePoint; sharedJunctions?: NativePoint[] };
export type CascadePreparation = { setup: CascadeSetup; reveal: null } | { setup: null; reveal: NativePoint; route: NativePoint[] };
type Board = { pitch: number; tiles: CascadeTile[]; sources: NativePoint[]; target: NativePoint };
type Entry = { at: NativePoint; direction: NativePoint };

const key = ([x, y]: NativePoint) => `${x},${y}`;
const same = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
const offset = ([x, y]: NativePoint, [dx, dy]: NativePoint, pitch: number): NativePoint => [x + dx * pitch, y + dy * pitch];
const directions: readonly NativePoint[] = [[0, -1], [0, 1], [-1, 0], [1, 0]];

function throughChannel(board: Board, tiles: ReadonlyMap<string, CascadeTile>) {
  const candidates: { route: NativePoint[]; gap: NativePoint; hidden: NativePoint[] }[] = [];
  for (const source of board.sources) {
    let at = source, direction = tiles.get(key(source))?.direction, gap: NativePoint | null = null;
    const route = [source], hidden: NativePoint[] = [], seen = new Set([key(source)]);
    while (direction) {
      at = offset(at, direction, board.pitch);
      const id = key(at), tile = tiles.get(id);
      if (!tile || seen.has(id)) break;
      route.push(at);
      if (same(at, board.target)) {
        if (gap) candidates.push({ route, gap, hidden });
        break;
      }
      seen.add(id);
      if (tile.direction) direction = tile.direction;
      else if (tile.hidden) hidden.push(at);
      else if (!tile.junction) {
        if (gap) break;
        gap = at;
      }
    }
  }
  return candidates.length === 1 ? candidates[0]! : null;
}

function tickModel(board: Board, tiles: ReadonlyMap<string, CascadeTile>, gap: NativePoint | null, blocked: ReadonlySet<string>,
  targets: readonly NativePoint[] = [board.target]) {
  let pending: Entry[] = board.sources.flatMap(at => {
    const direction = tiles.get(key(at))?.direction;
    return direction && !blocked.has(key(at)) ? [{ at, direction }] : [];
  });
  const touched = new Set<string>(), spent = new Set<string>(), opened = new Set<string>();
  const unserved = new Set(targets.map(key));
  for (let tick = 0; pending.length && tick < board.tiles.length; tick++) {
    const batch = pending;
    pending = [];
    const arrivals = new Map<string, Entry[]>();
    for (const entry of batch) {
      const id = key(entry.at), hits = arrivals.get(id) ?? [];
      if (!hits.some(hit => same(hit.direction, entry.direction))) hits.push(entry);
      arrivals.set(id, hits);
    }
    const send = (at: NativePoint, direction: NativePoint) => {
      let next = offset(at, direction, board.pitch);
      if (gap && same(next, gap)) next = offset(next, direction, board.pitch);
      const id = key(next), tile = tiles.get(id);
      if (!blocked.has(id) && tile && (tile.direction || tile.hidden || tile.junction)) pending.push({ at: next, direction });
    };
    for (const [id, hits] of arrivals) {
      if (spent.has(id)) continue;
      touched.add(id);
      if (unserved.delete(id)) {
        if (!unserved.size) return { reached: true, touched, opened };
        spent.add(id);
        continue;
      }
      const { at } = hits[0]!, tile = tiles.get(id)!;
      if (tile.junction && !opened.has(id) && hits.length > 1) {
        opened.add(id);
        for (const direction of directions) send(at, direction);
      } else {
        if (!opened.has(id)) spent.add(id);
        for (const hit of hits) send(at, tile.direction ?? hit.direction);
      }
    }
  }
  return { reached: false, touched, opened };
}

export function planParallelCascadeSetup(board: Board, targets: readonly NativePoint[], peers: readonly CascadePeer[],
  shouldStop: () => boolean): CascadePreparation | null {
  const tiles = new Map(board.tiles.map(tile => [key(tile.at), tile]));
  const occupied = new Set(peers.map(peer => key(peer.at)));
  const blocked = new Set<string>();
  if (tickModel(board, tiles, null, blocked, targets).reached) return null;
  const candidates: CascadeSetup[] = [];
  for (const { at, direction, junction, hidden } of board.tiles) {
    if (shouldStop()) return null;
    if (direction || junction || hidden || occupied.has(key(at))) continue;
    const result = tickModel(board, tiles, at, blocked, targets);
    if (!result.reached || !result.opened.size) continue;
    const route = [...result.touched].map(id => tiles.get(id)!.at);
    if (route.some(point => tiles.get(key(point))!.hidden)) continue;
    const sharedJunctions = [...result.opened].map(id => tiles.get(id)!.at);
    candidates.push({ route, gap: at, guards: [], sharedJunctions });
    if (candidates.length > 1) return null;
  }
  return candidates[0] ? { setup: candidates[0], reveal: null } : null;
}

export function planCascadeSetup(board: Board, guards: readonly CascadePeer[], bridge: CascadePeer, shouldStop: () => boolean): CascadePreparation | null {
  const tiles = new Map(board.tiles.map(tile => [key(tile.at), tile]));
  const channel = throughChannel(board, tiles);
  if (!channel) return null;
  if (channel.hidden.length) return { setup: null, reveal: channel.hidden[0]!, route: channel.route };
  const trunk = new Set(channel.route.map(key));
  const { touched } = tickModel(board, tiles, channel.gap, new Set());
  const eligible = [...touched].filter(id => !trunk.has(id) && !same(tiles.get(id)!.at, bridge.at));
  const movable = guards.map(guard => guard.at);
  const distance = (a: NativePoint, b: NativePoint) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
  let best: CascadeSetup | null = null, cost = Infinity, attempts = 0;
  function test(blocked: NativePoint[], used: NativePoint[], from: number, movement: number) {
    if (movement >= cost || attempts >= 2000 || shouldStop()) return;
    attempts++;
    const unused = movable.filter(at => !used.includes(at));
    if (tickModel(board, tiles, channel!.gap, new Set(blocked.map(key))).reached) {
      best = { route: channel!.route, gap: channel!.gap, guards: blocked };
      cost = movement;
      return;
    }
    for (let i = from; i < eligible.length; i++) {
      const at = tiles.get(eligible[i]!)!.at;
      const occupying = movable.find(guard => same(guard, at));
      for (const guard of unused) {
        if (occupying && occupying !== guard) continue;
        test([...blocked, at], [...used, guard], i + 1, movement + distance(guard, at) + board.pitch);
      }
    }
  }
  test([], [], 0, distance(bridge.at, channel.gap));
  return best ? { setup: best, reveal: null } : null;
}

type Step = { at: NativePoint; index: number };
type Position = { peers: NativePoint[]; active: number; depth: number; first: Step | null };

export function placeCascadePeers(peers: readonly CascadePeer[], active: number, guardMark: number, prep: CascadePreparation, pitch: number,
  tiles: readonly CascadeTile[], shouldStop: () => boolean) {
  const clear = new Set(tiles.map(tile => key(tile.at)));
  const guardIndices = peers.flatMap((peer, i) => peer.mark === guardMark ? [i] : []);
  const bridgeIndex = peers.findIndex(peer => peer.mark !== guardMark);
  const route = new Set((prep.setup ? prep.setup.route : prep.route).map(key));
  const distance = (a: NativePoint, b: NativePoint) => (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])) / pitch;
  const queue = new Map<number, Position[]>(), seen = new Map<string, number>();
  const keyPosition = (position: Position) => [position.active, ...position.peers.map(key)].join(':');
  function score(position: Position) {
    const { peers: places, active } = position;
    if (!prep.setup) return places.some(at => same(at, prep.reveal)) ? 1 + distance(places[active]!, prep.reveal) : 0;
    const { guards, gap } = prep.setup;
    const demands = [...guards.map(goal => ({ goal, candidates: guardIndices })), { goal: gap, candidates: [bridgeIndex] }];
    const legs = demands.map(({ goal, candidates }) => candidates.map(index => ({
      moves: distance(places[index]!, goal),
      focus: distance(places[index]!, places[active]!),
    })).sort((a, b) => a.moves - b.moves || a.focus - b.focus)[0]!);
    const interferes = guardIndices.filter(index => route.has(key(places[index]!)));
    const travel = legs.reduce((sum, leg) => sum + leg.moves, interferes.length);
    const toFocus = [...legs.filter(leg => leg.moves).map(leg => leg.focus),
      ...interferes.map(index => distance(places[index]!, places[active]!))];
    return travel ? travel + Math.min(...toFocus) : 0;
  }
  function enqueue(position: Position) {
    const id = keyPosition(position);
    if ((seen.get(id) ?? Infinity) <= position.depth) return;
    seen.set(id, position.depth);
    const rank = position.depth + score(position) * 3, bucket = queue.get(rank);
    if (bucket) bucket.push(position);
    else queue.set(rank, [position]);
  }
  function travelToContact(position: Position) {
    const start = position.peers[position.active]!;
    const frontier: { at: NativePoint; first: Step | null; depth: number }[] = [{ at: start, first: null, depth: 0 }];
    const visited = new Set([key(start)]);
    const parking = route.has(key(start)) ? directions.map(dir => offset(start, dir, pitch)).filter(at => !route.has(key(at))) : [];
    const goalCells = prep.setup ? position.active === bridgeIndex ? [prep.setup.gap] : [...prep.setup.guards, ...parking]
      : same(start, prep.reveal) ? parking : [];
    for (const { at, first, depth } of frontier) for (const [index, direction] of directions.entries()) {
      const next = offset(at, direction, pitch), id = key(next);
      if (!clear.has(id) || visited.has(id)) continue;
      const selected = position.peers.findIndex(peer => same(peer, next));
      const step = first ?? { at: next, index };
      if (selected < 0) {
        visited.add(id);
        frontier.push({ at: next, first: step, depth: depth + 1 });
      }
      if (selected < 0 && !goalCells.some(goal => same(goal, next))) continue;
      const places = position.peers.slice();
      places[position.active] = selected < 0 ? next : at;
      enqueue({ peers: places, active: selected < 0 ? position.active : selected, depth: position.depth + depth + 1,
        first: position.first ?? step });
      // Going around a peer can leave the focused piece in a better position for the next move.
    }
  }
  enqueue({ peers: peers.map(peer => peer.at), active, depth: 0, first: null });
  for (let count = 0; queue.size && count < 800 && !shouldStop(); count++) {
    const rank = Math.min(...queue.keys()), bucket = queue.get(rank)!, current = bucket.pop()!;
    if (!bucket.length) queue.delete(rank);
    if (seen.get(keyPosition(current)) !== current.depth) continue;
    if (!score(current)) return { step: current.first };
    travelToContact(current);
  }
  return null;
}

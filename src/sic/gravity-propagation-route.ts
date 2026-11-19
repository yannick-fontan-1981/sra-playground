import { gravityAttempt, gravityNeighbors, gravityStateKey, gravityTile, solidGravityTile,
  type GravityHistory, type GravityStep, type GravityView } from './reversible-gravity.ts';

type Tile = GravityView['tiles'][number];
type Direction = GravityHistory['direction'];
type Node = { at: number; direction: Direction; spread: bigint; edited: bigint; first: GravityStep | null; score: number };

const editable = new Set<Tile>(['ceiling_open', 'ceiling_solid', 'removable', 'inverter']);
const editedTile = (tile: Tile) => tile === 'ceiling_open' ? 'ceiling_solid' : tile === 'ceiling_solid' ? 'ceiling_open' : 'air';

export function spreadGravitySupport(read: (index: number) => Tile | undefined, index: number, actor: number, width: number) {
  const changes: [number, Tile][] = [[index, 'air']];
  for (const adjacent of gravityNeighbors(index, width)) if (adjacent !== actor && read(adjacent) === 'air') {
    changes.push([adjacent, 'propagating']);
  }
  return changes;
}

/** Search for a safe landing using both the hole and the support created by each proposed click. */
export function planPropagatingGravity(view: GravityView, memory: GravityHistory, remaining: number,
  surveyDirection?: Direction): GravityStep | null {
  const { width, tiles } = view;
  const column = (at: number) => (at % width + width) % width;
  const row = (at: number) => Math.floor(at / width);
  const indexOf = (key: string) => {
    const [x, y] = key.split(',').map(Number);
    return (y! - memory.rowOrigin) * width + x!;
  };
  const terrain = new Map(Object.entries(memory.terrain).map(([key, value]) => [indexOf(key), value]));
  tiles.forEach((tile, at) => terrain.set(at, tile));
  const visible = Array.from({ length: tiles.length }, (_, at) => at);
  const bits = new Map([...terrain.keys()].map((at, index) => [at, 1n << BigInt(index)]));
  const bit = (at: number) => bits.get(at) ?? 0n;
  let initialSpread = 0n;
  for (const [at, tile] of terrain) if (tile === 'propagating') initialSpread |= bit(at);
  const staticEdits = visible.filter(at => editable.has(tiles[at]!));
  // A centered edit is more likely to remain observable after the camera scrolls.
  if (surveyDirection !== undefined) {
    const centerRow = (tiles.length / width - 1) / 2;
    staticEdits.sort((a, b) => Math.abs(row(a) - centerRow) - Math.abs(row(b) - centerRow));
  }
  const goal = view.exit ?? [...terrain].find(([, value]) => value === 'exit')?.[0] ?? null;
  let inverters = 0n;
  for (const [at, tile] of terrain) if (tile === 'inverter') inverters |= bit(at);
  function approaches(direction: Direction) {
    if (goal === null) return new Set<number>();
    const queue = [goal], reached = new Set(queue);
    for (const at of queue) {
      const predecessors = gravityNeighbors(at, width).filter(other => other !== at + direction * width);
      for (const predecessor of predecessors) {
        const tile = terrain.get(predecessor);
        if (!tile || tile === 'wall' || tile === 'danger' || reached.has(predecessor)) continue;
        reached.add(predecessor);
        queue.push(predecessor);
      }
    }
    return reached;
  }
  const entry = { [-1]: approaches(-1), [1]: approaches(1) };
  const denied = new Set(memory.denied);
  const visitedPositions = new Set(memory.seen);
  const read = (at: number, spread: bigint, edited: bigint): Tile | undefined => {
    if ((bit(at) & spread) !== 0n) return 'propagating';
    const tile = terrain.get(at);
    if (!tile || tile === 'propagating') return tile === 'propagating' ? 'air' : tile;
    return (bit(at) & edited) !== 0n ? editedTile(tile) : tile;
  };
  function settle(at: number, direction: Direction, spread: bigint, edited: bigint): number | null {
    const start = read(at, spread, edited);
    if (!start || solidGravityTile(start) || start === 'danger') return null;
    for (let traveled = 0; traveled < terrain.size; traveled++) {
      if (read(at, spread, edited) === 'exit') return at;
      const next = at + direction * width, tile = read(next, spread, edited);
      if (tile === 'danger') return null;
      if (solidGravityTile(tile)) return at;
      if (!tile) return null;
      at = next;
    }
    return null;
  }

  const seeds = visible.filter(index => tiles[index] === 'propagating'), roof = view.at + memory.direction * width;
  const seed = memory.seen.length === 1 && seeds.length === 1 ? seeds[0] : undefined;
  const chosen = seed ?? (tiles[roof] === 'propagating' ? roof : undefined);
  if (surveyDirection !== undefined && goal === null && chosen !== undefined) {
    const index = chosen, changes = spreadGravitySupport(at => read(at, initialSpread, 0n), index, view.at, width);
    let spread = initialSpread & ~bit(index);
    for (const [at, tile] of changes) if (tile === 'propagating') spread |= bit(at);
    const landing = settle(view.at, memory.direction, spread, 0n);
    const [x, y] = gravityTile(view, index);
    const step: GravityStep = { command: { action_ref: 'ACTION6', data: { x, y } }, index,
      landing: landing ?? view.at, direction: memory.direction, frontier: false, edit: 'spread', changes };
    if (changes.length > 2 && landing !== null && (seed !== undefined || landing !== view.at)
      && !denied.has(gravityAttempt(view, step, memory))) return step;
  }

  const startRow = row(view.at), heading = memory.direction;
  const scouting = surveyDirection !== undefined && goal === null;
  let mission = surveyDirection ?? heading;
  if (scouting) {
    const x = column(view.at);
    const sides = [-1, 1].filter(dx => x + dx >= 0 && x + dx < width);
    const enclosed = sides.every(dx =>
      [-2, -1, 0, 1, 2].filter(dy => terrain.get(view.at + dx + dy * width) === 'wall').length >= 3);
    const capped = [1, 2, 3].some(distance => terrain.get(view.at + distance * mission * width) === 'wall');
    const opposite = terrain.get(view.at - mission * width);
    // A capped shaft can expose new terrain in the other direction after a supported reversal.
    if (enclosed && (capped || heading !== mission) && (opposite === 'air' || opposite === 'propagating')) {
      mission = -mission as Direction;
    }
  } else mission = heading;

  function terrainDistances(starts: number[]) {
    const queue = [...starts];
    const distances = new Map(starts.map(at => [at, 0]));
    for (const at of queue) for (const adjacent of gravityNeighbors(at, width)) {
      const tile = terrain.get(adjacent);
      if (!tile || tile === 'wall' || tile === 'danger' || distances.has(adjacent)) continue;
      distances.set(adjacent, distances.get(at)! + 1);
      queue.push(adjacent);
    }
    return distances;
  }
  const reachable = scouting ? terrainDistances([view.at]) : null;
  let gapColumns: number[] = [], barrierRow: number | null = null;
  for (let distance = 1; distance <= 8; distance++) {
    const y = startRow + mission * distance;
    const cells = Array.from({ length: width }, (_, x) => terrain.get(y * width + x));
    if (!cells.includes('danger')) continue;
    gapColumns = cells.flatMap((tile, x) =>
      tile && tile !== 'danger' && tile !== 'wall' && (!reachable || reachable.has(y * width + x)) ? [x] : []);
    if (gapColumns.length) barrierRow = y;
    break;
  }
  const gapDistances = scouting && barrierRow !== null
    ? terrainDistances(gapColumns.map(x => barrierRow! * width + x)) : null;
  const gapDistance = (at: number) => gapDistances?.get(at)
    ?? (gapColumns.length ? Math.min(...gapColumns.map(x => Math.abs(x - column(at)))) : 0);
  const startGap = gapDistance(view.at);
  const goalDistance = (at: number) => goal === null ? 0 : 4 * Math.abs(row(goal) - row(at)) + 3 * Math.abs(column(goal) - column(at));
  const initialGoalDistance = goalDistance(view.at);
  const rank = (at: number, direction: Direction, depth: number) => {
    const progress = (row(at) - startRow) * mission;
    const crossed = barrierRow !== null && (row(at) - barrierRow) * mission >= 0;
    const lateral = crossed ? startGap : startGap - gapDistance(at);
    const knownDirection = direction !== heading || memory.reversedHere;
    const towardGoal = goal !== null && Math.sign(row(goal) - startRow) === direction;
    const closing = initialGoalDistance - goalDistance(at);
    const novelty = visitedPositions.has(gravityStateKey(view, memory.rowOrigin, direction, at)) ? 0 : 3;
    return (knownDirection && goal !== null ? closing * 4 : progress * 14 + lateral * (scouting ? 24 : 3) + Math.max(0, closing))
      + (towardGoal && direction !== heading ? 22 : 0) + novelty - depth;
  };

  let beam: Node[] = [{ at: view.at, direction: heading, spread: initialSpread, edited: 0n, first: null, score: 0 }];
  let best: Node | null = null;
  const signature = ({ at, direction, spread, edited }: Node) => [at, direction, spread.toString(36), edited.toString(36)].join('/');
  const seen = new Set([signature(beam[0]!)]);
  for (let depth = 1; beam.length && depth <= Math.min(remaining, 14); depth++) {
    const next: Node[] = [];
    for (const node of beam) {
      const current = (at: number) => read(at, node.spread, node.edited);
      const offer = (index: number, direction: Direction, spread: bigint, edited: bigint, edit: GravityStep['edit'],
        changes?: [number, Tile][]) => {
        const landing = settle(edit ? node.at : index, direction, spread, edited);
        if (landing === null) return null;
        // Once the last inverter is spent, even a route that imagined every
        // editable cell open must still be able to reach the exit.
        if (goal !== null && (memory.reversedHere || direction !== heading)
          && (inverters & ~edited) === 0n && !entry[direction].has(landing)) return null;
        let first = node.first;
        if (!first) {
          const [x, y] = gravityTile(view, index);
          const command: GravityStep['command'] = edit ? { action_ref: 'ACTION6', data: { x, y } }
            : { action_ref: index < view.at ? 'ACTION3' : 'ACTION4', data: {} };
          first = { command, index, landing, frontier: false, direction, edit, ...(changes ? { changes } : {}) };
          if (denied.has(gravityAttempt(view, first, memory))) return null;
        }
        const candidate = { at: landing, direction, spread, edited, first, score: rank(landing, direction, depth) };
        const key = signature(candidate);
        if (seen.has(key)) return null;
        seen.add(key);
        if (read(landing, spread, edited) === 'exit') return first;
        if (candidate.score > (best?.score ?? 0)) best = candidate;
        next.push(candidate);
        return null;
      };
      const x = column(node.at);
      for (const dx of [-1, 1]) if (x + dx >= 0 && x + dx < width) {
        const win = offer(node.at + dx, node.direction, node.spread, node.edited, null);
        if (win) return win;
      }
      for (const at of staticEdits) {
        const tile = current(at);
        if (!tile || !editable.has(tile)) continue;
        const flip = tile === 'inverter', direction = flip ? -node.direction as Direction : node.direction;
        const edit = flip ? 'invert' : tile === 'ceiling_solid' ? 'open' : tile === 'ceiling_open' ? 'solidify' : 'remove';
        const win = offer(at, direction, node.spread, node.edited ^ bit(at), edit);
        if (win) return win;
      }
      for (const at of visible) {
        if ((node.spread & bit(at)) === 0n || Math.abs(column(at) - x) > 5 || Math.abs(row(at) - row(node.at)) > 7) continue;
        const changes = spreadGravitySupport(current, at, node.at, width);
        let spread = node.spread & ~bit(at);
        for (const [created, tile] of changes) if (tile === 'propagating') spread |= bit(created);
        const win = offer(at, node.direction, spread, node.edited, 'spread', changes);
        if (win) return win;
      }
    }
    beam = next.sort((a, b) => b.score - a.score).slice(0, 144);
  }
  return (best as Node | null)?.first ?? null;
}

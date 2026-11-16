import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

type Part = ReturnType<typeof geometricComponents>[number];
type Tile = 'air' | 'wall' | 'danger' | 'removable' | 'inverter' | 'exit';
type Gravity = -1 | 1;
type Geometry = { pitch: number; phase: NativePoint; air: number; actor: number; removable: number; toggle: number };
export type GravityView = { origin: NativePoint; pitch: number; width: number; tiles: Tile[]; at: number; actor: NativeBox;
  exit: number | null; inverterInk: number | null };
export type GravityHistory = {
  direction: Gravity;
  rowOrigin: number;
  highest: number;
  lowest: number;
  seen: string[];
  denied: string[];
  inverted: boolean;
  terrain: Record<string, Tile>;
};
export type GravityStep = { command: NativeCommand; index: number; landing: number; direction: Gravity; frontier: boolean;
  edit: 'remove' | 'invert' | null; };

export function gravityTile(view: GravityView, index: number): NativePoint {
  return [view.origin[0] + index % view.width * view.pitch,
    view.origin[1] + Math.floor(index / view.width) * view.pitch];
}
export function gravityTileBox(view: GravityView, index: number): NativeBox {
  const [x, y] = gravityTile(view, index), radius = Math.floor((view.pitch - 1) / 2);
  return [x - radius, y - radius, x + radius, y + radius];
}

export function readReversibleGravity(rows: NativeRows, geometry: Geometry): GravityView | null {
  const { pitch, phase, air, actor, removable, toggle } = geometry, radius = Math.floor((pitch - 1) / 2);
  const parts = geometricComponents(rows), actors = parts.filter(part => part.color === actor
    && part.area === 6 && part.bbox[2] - part.bbox[0] === 1 && part.bbox[3] - part.bbox[1] === 3);
  if (actors.length !== 1) return null;
  const bbox = actors[0]!.bbox, actorX = [bbox[0], bbox[2]].find(x => (x - phase[0]) % pitch === 0);
  if (actorX === undefined) return null;
  const actorY = bbox[1] + radius, phaseY = actorY % pitch;
  const origin: NativePoint = [phase[0] < radius ? phase[0] + pitch : phase[0], phaseY < radius ? phaseY + pitch : phaseY];
  const width = Math.floor((rows[0]!.length - 1 - radius - origin[0]) / pitch) + 1;
  const height = Math.floor((rows.length - 2 - radius - origin[1]) / pitch) + 1;
  const at = (actorY - origin[1]) / pitch * width + (actorX - origin[0]) / pitch;
  if (!Number.isInteger(at) || at < 0 || at >= width * height) return null;
  const indexAt = (x: number, y: number) => (y - origin[1]) / pitch * width + (x - origin[0]) / pitch;
  const blocks = new Map(parts.filter(part => part.area === (pitch - 1) ** 2 - 4 &&
    part.bbox[2] - part.bbox[0] === 2 * radius && part.bbox[3] - part.bbox[1] === 2 * radius
    && (part.bbox[0] + radius - origin[0]) % pitch === 0 && (part.bbox[1] + radius - origin[1]) % pitch === 0)
    .map(part => [indexAt(part.bbox[0] + radius, part.bbox[1] + radius), part.color]));
  const unexpected = [...new Set([...blocks.values()].filter(ink => ![air, actor, removable, toggle].includes(ink)))];
  if (unexpected.length > 1) return null;
  const inverterInk = unexpected[0] ?? null;
  const exits = parts.filter(part => part.area === 5 && part.bbox[2] - part.bbox[0] === 2 && part.bbox[3] - part.bbox[1] === 2
    && ![air, actor, removable, toggle, inverterInk].includes(part.color) && part.mask.every(([x, y]) => x === 1 || y === 1))
    .map(part => indexAt(origin[0] + Math.round((part.bbox[0] + 1 - origin[0]) / pitch) * pitch,
      origin[1] + Math.round((part.bbox[1] + 1 - origin[1]) / pitch) * pitch));
  const exit = exits.length === 1 ? exits[0]! : null;
  const tiles = Array.from({ length: width * height }, (_, index): Tile => {
    if (index === exit) return 'exit';
    if (index === at) return 'air';
    const ink = blocks.get(index);
    if (ink === removable) return 'removable';
    if (ink !== undefined && ink === inverterInk) return 'inverter';
    const x = origin[0] + index % width * pitch, y = origin[1] + Math.floor(index / width) * pitch;
    const counts = new Map<number, number>();
    for (let v = y - radius; v <= y + radius; v++) for (let u = x - radius; u <= x + radius; u++) {
      const value = rows[v]![u]!;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    if (counts.size === 1 && counts.has(air)) return 'air';
    return [...counts].some(([ink, count]) => ink !== air && count >= (2 * radius + 1) ** 2 * 0.8) ? 'wall' : 'danger';
  });
  return { origin, pitch, width, tiles, at, actor: bbox, exit, inverterInk };
}

export function cameraRowShift(before: GravityView, after: GravityView, expected?: number): number | null {
  if (before.width !== after.width) return null;
  const { width } = before, rows = before.tiles.length / width, nextRows = after.tiles.length / width;
  const shifts = expected !== undefined ? [expected] : Array.from({ length: rows + nextRows - 5 }, (_, i) => 3 - nextRows + i);
  const scored = shifts.flatMap(offset => {
    let matches = 0, changes = 0, anchors = 0;
    for (let index = 0; index < before.tiles.length; index++) {
      const other = index - offset * width;
      const a = before.tiles[index], b = after.tiles[other];
      if (!a || !b || index === before.at || other === after.at || !['wall', 'danger', 'air', 'exit'].includes(a)
        || !['wall', 'danger', 'air', 'exit'].includes(b)) continue;
      if (a === b) { matches++; if (a !== 'air') anchors++; }
      else changes++;
    }
    return anchors >= 6 && changes <= matches * 0.16 ? [{ offset, rank: matches - 6 * changes }] : [];
  }).sort((a, b) => b.rank - a.rank);
  return scored.length && (expected !== undefined || scored[0]!.rank !== scored[1]?.rank) ? scored[0]!.offset : null;
}

export const gravityStateKey = (view: GravityView, rowOrigin: number, direction: Gravity, at = view.at) =>
  [at % view.width, rowOrigin + Math.floor(at / view.width), direction].join(',');
export const gravityAttempt = (view: GravityView, step: GravityStep, memory: GravityHistory) =>
  JSON.stringify([gravityStateKey(view, memory.rowOrigin, memory.direction), step.command, view.tiles[step.index]]);

export function gravityTerrain(view: GravityView, rowOrigin: number, prior: Record<string, Tile> = {}) {
  const terrain = { ...prior };
  view.tiles.forEach((tile, index) => {
    terrain[[index % view.width, rowOrigin + Math.floor(index / view.width)].join(',')] = tile;
  });
  return terrain;
}

export function gravityReturn(before: GravityView, after: GravityView, step: GravityStep, memory: GravityHistory) {
  const predicted = Math.floor(step.landing / before.width);
  const observed = Math.floor(after.at / after.width);
  const expected = step.frontier ? undefined : predicted - observed;
  const shift = cameraRowShift(before, after, expected) ?? (expected === undefined ? null : cameraRowShift(before, after));
  if (shift === null) return null;
  const landing = shift + observed, departure = Math.floor(before.at / before.width);
  const column = step.index % before.width, actorColumn = after.at % after.width;
  const sameColumn = actorColumn === (step.edit ? before.at % before.width : column);
  const reached = step.frontier ? (landing - predicted) * step.direction >= 0 : landing === predicted;
  const edited = after.tiles[step.index - shift * before.width];
  const removed = !step.edit || edited === 'air' || (edited === undefined && (landing - departure) * step.direction > 0);
  const inverted = step.edit === 'invert' && (landing - departure) * step.direction > 0;
  return { shift, landing, removed, inverted, matched: sameColumn && reached && removed
    && (step.edit !== 'invert' || inverted || memory.inverted && landing === departure) };
}

export function chooseGravityReversal(view: GravityView, memory: GravityHistory, remaining: number): GravityStep | null {
  const { width, tiles } = view;
  const edits = tiles.flatMap((tile, index) => tile === 'removable' || tile === 'inverter' ? [index] : []);
  if (edits.length > 20) return null;
  const masks = new Map(edits.map((index, bit) => [index, 1 << bit]));
  const solid = (tile: Tile | undefined) => tile === 'wall' || tile === 'removable' || tile === 'inverter';
  const read = (index: number, mask: number): Tile | undefined => mask & (masks.get(index) ?? 0) ? 'air' : tiles[index]
    ?? memory.terrain[[(index % width + width) % width, memory.rowOrigin + Math.floor(index / width)].join(',')];
  function settle(start: number, direction: Gravity, mask: number) {
    if (solid(read(start, mask)) || read(start, mask) === 'danger') return null;
    let at = start, clear = 0;
    for (;;) {
      if (read(at, mask) === 'exit') return { at, frontier: false };
      const advance = at + direction * width, next = read(advance, mask);
      if (next === 'danger') return null;
      if (!next) return clear >= 2 ? { at, frontier: true } : null;
      if (solid(next)) return { at, frontier: false };
      at = advance; clear++;
    }
  }
  type Node = { at: number; direction: Gravity; mask: number; first: GravityStep | null; depth: number; frontier: boolean };
  const queue: Node[] = [{ at: view.at, direction: memory.direction, mask: 0, first: null, depth: 0, frontier: false }];
  const visited = new Set([view.at + '/' + memory.direction + '/0']);
  let best: { step: GravityStep; value: number } | null = null;
  for (let i = 0; i < queue.length && i < 5000; i++) {
    const node = queue[i]!;
    if (read(node.at, node.mask) === 'exit' && node.first) return node.first;
    const worldRow = memory.rowOrigin + Math.floor(node.at / width), invert = node.direction !== memory.direction;
    if (node.first) {
      const extra = node.direction < 0 ? memory.highest - worldRow : worldRow - memory.lowest;
      const newCell = !memory.seen.includes(gravityStateKey(view, memory.rowOrigin, node.direction, node.at));
      const novelty = (node.frontier ? 18 : 0) + Math.max(0, extra) * 6 + (newCell ? 2 : 0);
      const value = novelty - node.depth - (invert ? 2 : 0);
      if (value > (best?.value ?? 0)) best = { value, step: node.first };
    }
    if (node.frontier || node.at < 0 || node.at >= tiles.length || node.depth >= Math.min(remaining, 9)) continue;
    const offer = (index: number, mask: number, direction: Gravity, action_ref: string, edit: GravityStep['edit']) => {
      const arrival = settle(edit ? node.at : index, direction, mask);
      if (!arrival) return;
      const command = edit ? (() => { const [x, y] = gravityTile(view, index); return { action_ref, data: { x, y } }; })()
        : { action_ref, data: {} };
      const step = { command, index, landing: arrival.at, direction, frontier: arrival.frontier, edit };
      if (!node.first && memory.denied.includes(gravityAttempt(view, step, memory))) return;
      if (!node.first && edit === 'invert' && !memory.inverted && view.exit === null && arrival.at !== node.at) {
        best = { value: Infinity, step };
      }
      const id = [arrival.at, direction, mask].join('/');
      if (visited.has(id)) return;
      visited.add(id);
      queue.push({ at: arrival.at, direction, mask, first: node.first ?? step, depth: node.depth + 1, frontier: arrival.frontier });
    };
    for (const [action, dx] of [['ACTION3', -1], ['ACTION4', 1]] as const) {
      const x = node.at % width + dx;
      if (x >= 0 && x < width) offer(node.at + dx, node.mask, node.direction, action, null);
    }
    for (const index of edits) {
      const mask = node.mask | masks.get(index)!;
      if (mask === node.mask) continue;
      const flip = tiles[index] === 'inverter';
      offer(index, mask, flip ? -node.direction as Gravity : node.direction, 'ACTION6', flip ? 'invert' : 'remove');
    }
  }
  return best?.step ?? null;
}

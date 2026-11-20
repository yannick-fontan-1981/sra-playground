import type { NativeCommand } from '../logos-engine/v6-native-types.ts';
import type { GravityHistory, GravityStep, GravityView } from './reversible-gravity.ts';

type Gravity = GravityHistory['direction'];
type Tile = GravityView['tiles'][number];
type Landing = { at: number; frontier: boolean };
type Node = Landing & { direction: Gravity; edited: bigint; spent: number; depth: number; first: GravityStep | null };

const solid = (tile: Tile | undefined) => tile === 'wall' || tile === 'removable' || tile === 'inverter' || tile === 'ceiling_solid';
const editable = (tile: Tile) => tile === 'removable' || tile === 'inverter' || tile === 'ceiling_open' || tile === 'ceiling_solid';
const changed = (tile: Tile): Tile => tile === 'ceiling_open' ? 'ceiling_solid' : tile === 'ceiling_solid' ? 'ceiling_open' : 'air';

export function canPlanSupportChain(view: GravityView): boolean {
  return view.tiles.filter(tile => editable(tile) && tile !== 'ceiling_solid').length > 20
    && view.tiles.filter(tile => tile === 'inverter').length > 1
    && view.tiles.some(tile => tile === 'ceiling_open' || tile === 'ceiling_solid');
}

export function planSupportChain(view: GravityView, memory: GravityHistory, remaining: number, heading: Gravity): GravityStep | null {
  const { width, tiles } = view;
  const column = (at: number) => (at % width + width) % width;
  const row = (at: number) => memory.rowOrigin + Math.floor(at / width);
  const pointKey = (at: number) => column(at) + ',' + row(at);
  const localIndex = (key: string) => {
    const [x, y] = key.split(',', 2).map(Number);
    return (y! - memory.rowOrigin) * width + x!;
  };
  const remembered = new Map(Object.entries(memory.terrain).map(([key, tile]) => [localIndex(key), tile]));
  const terrain = (at: number) => tiles[at] ?? remembered.get(at);
  const connected = new Set([view.at]), pending = [view.at];
  for (let cursor = 0; cursor < pending.length; cursor++) {
    const at = pending[cursor]!;
    const adjacent = [at - width, at + width];
    if (column(at) > 0) adjacent.push(at - 1);
    if (column(at) + 1 < width) adjacent.push(at + 1);
    for (const next of adjacent) {
      const tile = terrain(next);
      if (!tile || tile === 'wall' || tile === 'danger' || connected.has(next)) continue;
      connected.add(next);
      pending.push(next);
    }
  }
  const reserve = tiles.flatMap((tile, at) => tile === 'inverter' && !connected.has(at) ? [at] : []);
  reserve.sort((a, b) => Math.abs(row(a) - row(view.at)) - Math.abs(row(b) - row(view.at)) || a - b);
  const candidateEdits = tiles.flatMap((tile, at) => editable(tile) && connected.has(at) && at !== view.at ? [at] : []);
  const bitAt = new Map(candidateEdits.map((at, i) => [at, 1n << BigInt(i)]));
  const editsByColumn = Array.from({ length: width }, (_, x) => candidateEdits.filter(at => column(at) === x));
  const read = (at: number, mask: bigint): Tile | undefined => {
    const tile = terrain(at);
    return tile && ((bitAt.get(at) ?? 0n) & mask) ? changed(tile) : tile;
  };
  function land(start: number, direction: Gravity, edited: bigint): Landing | null {
    const initial = read(start, edited);
    if (!initial || solid(initial) || initial === 'danger') return null;
    let at = start, passed = 0;
    while (true) {
      if (read(at, edited) === 'exit') return { at, frontier: false };
      const next = at + direction * width, tile = read(next, edited);
      if (tile === 'danger') return null;
      if (solid(tile)) return { at, frontier: false };
      if (!tile) return passed >= 2 ? { at, frontier: true } : null;
      at = next;
      passed++;
    }
  }
  const avoid = new Set(memory.denied), visitedPositions = new Set(memory.seen.map(localIndex));
  const key = (node: Node) => [node.at, node.direction, node.edited, node.spent].join('/');
  const initial: Node = { at: view.at, direction: memory.direction, edited: 0n, spent: 0, depth: 0, frontier: false, first: null };
  const queue = [initial], visited = new Set([key(initial)]);
  let best: { step: GravityStep; score: number } | null = null;
  let advance: { step: GravityStep; score: number } | null = null;
  let frontier: { step: GravityStep; score: number } | null = null;
  const maxDepth = Math.min(remaining, 13);
  for (let cursor = 0; cursor < queue.length && cursor < 95_000; cursor++) {
    const node = queue[cursor]!;
    if (node.first) {
      if (read(node.at, node.edited) === 'exit') return node.first;
      const progress = heading < 0 ? memory.highest - row(node.at) : row(node.at) - memory.lowest;
      const seen = visitedPositions.has(node.at);
      const novelty = seen ? 0 : Math.max(0, 20 - Math.max(0, -progress) * 3);
      const score = Math.max(0, progress) * 14 + novelty - node.depth - node.spent * 2;
      if (node.frontier) {
        if (score > (frontier?.score ?? -Infinity)) frontier = { step: node.first, score };
      } else {
        if (progress > 0 && score > (advance?.score ?? 0)) advance = { step: node.first, score };
        if (score > (best?.score ?? 0)) best = { step: node.first, score };
      }
    }
    if (node.frontier || node.depth >= maxDepth) continue;
    const offer = (at: number, direction: Gravity, edited: bigint, spent: number, command: NativeCommand, edit: GravityStep['edit']) => {
      const arrival = land(edit ? node.at : at, direction, edited);
      if (!arrival) return;
      const step = { command, index: at, landing: arrival.at, direction, frontier: arrival.frontier, edit };
      if (!node.first && avoid.has(JSON.stringify([pointKey(view.at) + ',' + memory.direction, command, tiles[at]]))) return;
      const next = { ...arrival, direction, edited, spent, first: node.first ?? step, depth: node.depth + 1 };
      const signature = key(next);
      if (visited.has(signature)) return;
      visited.add(signature);
      queue.push(next);
    };
    const x = column(node.at);
    for (const [dx, action_ref] of [[-1, 'ACTION3'], [1, 'ACTION4']] as const) {
      if (x + dx >= 0 && x + dx < width) offer(node.at + dx, node.direction, node.edited, node.spent, { action_ref, data: {} }, null);
    }
    const click = (at: number): NativeCommand => ({ action_ref: 'ACTION6',
      data: { x: view.origin[0] + column(at) * view.pitch, y: view.origin[1] + Math.floor(at / width) * view.pitch } });
    const battery = reserve[node.spent];
    if (battery !== undefined) offer(battery, -node.direction as Gravity, node.edited, node.spent + 1, click(battery), 'invert');
    for (const nearby of [x, x - 1, x + 1]) for (const at of editsByColumn[nearby] ?? []) {
      if (at === node.at) continue;
      const tile = read(at, node.edited), bit = bitAt.get(at)!;
      if (tile === 'inverter') offer(at, -node.direction as Gravity, node.edited ^ bit, node.spent, click(at), 'invert');
      else if (tile === 'removable') offer(at, node.direction, node.edited ^ bit, node.spent, click(at), 'remove');
      else if (tile === 'ceiling_open') offer(at, node.direction, node.edited ^ bit, node.spent, click(at), 'solidify');
      else if (tile === 'ceiling_solid') offer(at, node.direction, node.edited ^ bit, node.spent, click(at), 'open');
    }
  }
  return advance?.step ?? frontier?.step ?? best?.step ?? null;
}

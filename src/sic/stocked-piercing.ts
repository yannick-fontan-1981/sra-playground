import { measureRootedLine } from '../logos-engine/v6-rooted-line-observation.ts';
import type { NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

type Stock = { type: number; at: number };
type Placement = { row: number; tip: number; stock: Stock[] };
type Layout = { left: number; top: number; stride: number; width: number; height: number; tracks: boolean[];
  obstacles: number[]; order: number[]; reference: string };
type Scene = { layout: Layout; placement: Placement };
type Effect = { action_ref: string; extent_delta: number; root_translation: NativePoint };
type Move = { action: string; dx: number; dy: number };
type Leg = { action: string; expected: Placement };
export type StockedPiercingScene = Scene;
export type RefusedPiercingStep = { placement: string; action: string };

function railLinks(rows: NativeRows, left: number, top: number, stride: number, height: number, rootTop: number) {
  const colors = new Map<number, number>();
  const inkAt = (y: number) => {
    const x = left + Math.floor((stride - 2) / 2);
    return rows[y]?.[x] === rows[y]?.[x + 1] ? rows[y]?.[x] : undefined;
  };
  const edges = Array.from({ length: height - 1 }, (_item, row) => {
    const first = top + row * stride + stride - 2;
    const inks = Array.from({ length: stride - 2 }, (_, i) => first + i)
      .filter(y => y < rootTop || y >= rootTop + stride).map(inkAt);
    if (!inks.length || inks[0] === undefined || inks.some(ink => ink !== inks[0])) return null;
    if (inks.length === stride - 2) colors.set(inks[0], (colors.get(inks[0]) ?? 0) + 1);
    return inks[0];
  });
  const distinct = [...colors.entries()].sort((a, b) => b[1] - a[1]);
  if (distinct.length !== 1 || distinct[0]![1] < 2) return null;
  return edges.map(ink => ink === distinct[0]![0]);
}

export function measureStockedPiercing(rows: NativeRows): Scene | null {
  const observed = measureRootedLine(rows, true);
  if (!observed) return null;
  const reference = observed.order as string[];
  const materials = [...new Set(reference)];
  const pieces = observed.pieces as { type: string; bbox: readonly number[] }[];
  if (pieces.length <= materials.length || pieces.length > 12) return null;
  const { unit, background } = observed;
  const [left, rootTop] = observed.root as NativePoint;
  const [fieldLeft, fieldTop, fieldRight, fieldBottom] = observed.field as readonly [number, number, number, number];
  const stride = unit + 2, top = rootTop - Math.floor((rootTop - fieldTop) / stride) * stride;
  const width = Math.floor((fieldRight + 1 - left) / stride), height = Math.floor((fieldBottom + 1 - top) / stride);
  if (fieldLeft !== left + stride || height < 3 || width < 3 || width * height > 144) return null;
  const tracks = railLinks(rows, left, top, stride, height, rootTop);
  if (!tracks) return null;
  const obstacles: number[] = [];
  for (let y = 0; y < height; y++) for (let x = 1; x < width; x++) {
    const x0 = left + x * stride, y0 = top + y * stride, ink = rows[y0]![x0];
    if (ink !== background && rows.slice(y0, y0 + stride).every(line => line.slice(x0, x0 + stride).every(color => color === ink))) {
      obstacles.push(y * width + x);
    }
  }
  const row = (rootTop - top) / stride, lineRows = observed.line_rows as readonly number[];
  const railTip = lineRows.map(y => rows[y]![left + stride - 1]);
  if (railTip.every(ink => ink === background)) return null;
  let tip = 0;
  for (let x = 1; x < width; x++) {
    const end = left + (x + 1) * stride - 1;
    if (obstacles.includes(row * width + x) || !lineRows.every((y, i) => rows[y]![end] === railTip[i])) break;
    tip = x;
  }
  const stock: Stock[] = [];
  for (const piece of pieces) {
    const x = (piece.bbox[0]! - left - 1) / stride, y = (piece.bbox[1]! - top - 1) / stride;
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 1 || x >= width || y < 0 || y >= height) return null;
    stock.push({ type: materials.indexOf(piece.type), at: y * width + x });
  }
  stock.sort((a, b) => a.at - b.at);
  return { layout: { left, top, stride, width, height, tracks, obstacles, order: reference.map(type => materials.indexOf(type)),
    reference: observed.layout }, placement: { row, tip, stock } };
}

export function stockedPiercingMoves(layout: Pick<Layout, 'stride'>, effects: readonly Effect[]): Move[] {
  return effects.flatMap(effect => {
    const dx = effect.extent_delta / layout.stride, dy = effect.root_translation[0] / layout.stride;
    return Math.abs(dx) + Math.abs(dy) === 1 && Number.isInteger(dx) && Number.isInteger(dy) && effect.root_translation[1] === 0
      ? [{ action: effect.action_ref, dx, dy }] : [];
  });
}

export function stockedPiercingGeometry({ layout }: Scene, state: Placement) {
  const { width, stride, left, top } = layout, unit = stride - 2, y = top + state.row * stride;
  return { layout: layout.reference, root: [left, y, left + stride - 1, y + stride - 1],
    tip: left + (state.tip + 1) * stride - 1, line_rows: [y + Math.floor((stride - 1) / 2), y + Math.floor((stride + 1) / 2)],
    pieces: state.stock.map(({ at, type }) => {
      const x0 = left + at % width * stride + 1, y0 = top + Math.floor(at / width) * stride + 1;
      return { type: String(type), id: 'material:' + type + ':' + at, bbox: [x0, y0, x0 + unit - 1, y0 + unit - 1] };
    }) };
}

export function stockedPlacementKey(p: Placement) {
  return String.fromCharCode(p.row, p.tip, ...p.stock.flatMap(s => [s.at, s.type]));
}

function stepPiercing(layout: Layout, obstacles: ReadonlySet<number>, state: Placement, { dx, dy }: Move): Placement | null {
  const { width, height } = layout, tip = state.tip + dx, row = state.row + dy;
  if (tip < 0 || tip >= width || row < 0 || row >= height || dy && !layout.tracks[Math.min(row, state.row)]) return null;
  const source = state.row * width, destination = row * width, offset = dy * width + dx;
  if (dx > 0 && obstacles.has(destination + tip)) return null;
  if (dy && layout.obstacles.some(at => at >= destination && at <= destination + tip)) return null;
  const occupied = new Map(state.stock.map(piece => [piece.at, piece]));
  const moved = new Set<number>();
  function push(at: number): boolean {
    if (moved.has(at) || !occupied.has(at)) return true;
    const next = at + offset, col = at % width + dx;
    if (col < 1 || col >= width || next < 0 || next >= width * height || obstacles.has(next) || !push(next)) return false;
    moved.add(at);
    return true;
  }
  for (let x = 1; x <= Math.max(state.tip, tip); x++) {
    if (!push(source + x) && dy) return null;
    if (dy && !push(destination + x)) return null;
  }
  const stock = moved.size ? state.stock.map(piece => moved.has(piece.at) ? { type: piece.type, at: piece.at + offset } : piece)
    .sort((a, b) => a.at - b.at) : state.stock;
  return { row, tip, stock };
}

export function predictStockedPiercing(scene: Scene, move: Move) {
  return stepPiercing(scene.layout, new Set(scene.layout.obstacles), scene.placement, move);
}

function loaded(layout: Layout, state: Placement) {
  const first = state.row * layout.width;
  return state.stock.filter(piece => piece.at > first && piece.at <= first + state.tip).map(piece => piece.type);
}

export function planStockedPiercing(scene: Scene, moves: readonly Move[], depth: number, shouldStop: () => boolean,
  refusals: readonly RefusedPiercingStep[] = []): Leg[] | null {
  const { layout } = scene, obstacles = new Set(layout.obstacles), { order, width } = layout;
  type Node = { placement: Placement; depth: number; prior?: Node; action?: string };
  const pending = new Map<number, Node[]>(), seen = new Map<string, number>();
  const refused = new Set(refusals.map(step => step.placement + '/' + step.action));
  function enqueue(node: Node) {
    const key = stockedPlacementKey(node.placement), previous = seen.get(key);
    if (previous !== undefined && previous <= node.depth) return;
    seen.set(key, node.depth);
    const threaded = loaded(layout, node.placement);
    const fault = order.findIndex((type, i) => threaded[i] !== type);
    const prefix = fault < 0 ? order.length : fault;
    const missing = order.length - prefix;
    const wanted = order[prefix];
    const nearest = wanted === undefined ? 0 : Math.min(...node.placement.stock.filter(piece => piece.type === wanted)
      .map(piece => Math.abs(Math.floor(piece.at / width) - node.placement.row) + Math.abs(piece.at % width - node.placement.tip)));
    const rank = node.depth + missing * 6 + Math.max(0, threaded.length - prefix) * 2 + nearest;
    const bucket = pending.get(rank);
    if (bucket) bucket.push(node);
    else pending.set(rank, [node]);
  }
  enqueue({ placement: scene.placement, depth: 0 });
  for (let count = 0; pending.size && count < 800_000; count++) {
    if (count % 64 === 0 && shouldStop()) return null;
    const rank = Math.min(...pending.keys()), bucket = pending.get(rank)!, node = bucket.pop()!;
    if (!bucket.length) pending.delete(rank);
    const key = stockedPlacementKey(node.placement);
    if (seen.get(key) !== node.depth) continue;
    const present = loaded(layout, node.placement);
    if (node.prior && order.every((type, i) => present[i] === type)) {
      const route: Leg[] = [];
      for (let step: Node | undefined = node; step?.prior; step = step.prior) {
        route.push({ action: step.action!, expected: step.placement });
      }
      return route.reverse();
    }
    if (node.depth >= depth) continue;
    for (const move of moves) {
      if (refused.has(key + '/' + move.action)) continue;
      const placement = stepPiercing(layout, obstacles, node.placement, move);
      if (placement) enqueue({ placement, depth: node.depth + 1, prior: node, action: move.action });
    }
  }
  return null;
}

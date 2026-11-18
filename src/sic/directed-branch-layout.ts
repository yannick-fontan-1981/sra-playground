import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import type { StackedBranchLayout } from './stacked-branch-layout.ts';

const orthogonal = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
type Piece = { at: number; offsets: NativePoint[]; ink: number; turn: boolean; emitter?: NativePoint };
type Receiver = { opening: number; incoming: number };
type Source = { at: number; direction: number };
export type DirectedBranchLayout = {
  unit: number; origin: NativePoint; width: number; height: number; background: number; focusInk: number;
  fixed: number[]; pieces: Piece[]; targets: Receiver[]; sources: Source[]; focused: number;
  capInk?: number;
};
type Layout = DirectedBranchLayout;
type RasterPart = { at: number; width: number; height: number; offsets: NativePoint[]; ink: number };
type Front = { at: number; direction: number };
type Projection = { served: Set<number>; escaped: number; trace: number[] };
const key = (point: NativePoint) => point.join(',');

const point = (layout: Pick<Layout, 'width'>, cell: number): NativePoint => [cell % layout.width, Math.floor(cell / layout.width)];
function offset(layout: Pick<Layout, 'width' | 'height'>, cell: number, [dx, dy]: NativePoint) {
  const [x, y] = point(layout, cell), nx = x + dx, ny = y + dy;
  return nx >= 0 && ny >= 0 && nx < layout.width && ny < layout.height ? ny * layout.width + nx : -1;
}

export function directedBranchBox(layout: Layout, at: number, shape: readonly NativePoint[] = [[0, 0]]): NativeBox {
  const [x, y] = point(layout, at);
  const l = layout.origin[0] + x * layout.unit, t = layout.origin[1] + y * layout.unit;
  return [l, t, l + (Math.max(...shape.map(p => p[0])) + 1) * layout.unit - 1,
    t + (Math.max(...shape.map(p => p[1])) + 1) * layout.unit - 1];
}

export function measureDirectedBranchLayout(rows: NativeRows, prior: Pick<StackedBranchLayout,
  'unit' | 'capInk' | 'background' | 'focusedInk' | 'restingInk'>): Layout | null {
  const { unit } = prior, parts = geometricComponents(rows);
  const frames = parts.filter(part => part.color === prior.background && part.bbox[0] > 0 && part.bbox[1] > 0
    && part.area > rows.length * rows[0]!.length / 2);
  if (frames.length !== 1) return null;
  const [l, t, r, b] = frames[0]!.bbox;
  const origin = [l, t] as const, width = (r - l + 1) / unit, height = (b - t + 1) / unit;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width > 24 || height > 24) return null;
  const grid = { width, height };
  const background = prior.background, sparse: RasterPart[] = [];
  for (const component of parts) {
    if (component === frames[0]) continue;
    const [left, top, right, bottom] = component.bbox;
    if (left < l || right > r || top < t || bottom > b) continue;
    const x = (left - l) / unit, y = (top - t) / unit, w = (right - left + 1) / unit, h = (bottom - top + 1) / unit;
    if (![x, y, w, h].every(Number.isInteger)) return null;
    const offsets: NativePoint[] = [];
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
      const a = left + dx * unit, c = top + dy * unit;
      let area = 0;
      for (let v = 0; v < unit; v++) for (let u = 0; u < unit; u++) area += Number(rows[c + v]![a + u] === component.color);
      if (area === unit ** 2) offsets.push([dx, dy]);
      else if (area !== 0) return null;
    }
    if (component.area !== offsets.length * unit ** 2) return null;
    sparse.push({ at: y * width + x, width: w, height: h, offsets, ink: component.color });
  }
  const single = new Map(sparse.filter(part => part.offsets.length === 1).map(part => [part.at, part]));
  const targets: Receiver[] = [], sources: Source[] = [];
  const fixtures = new Set<RasterPart>();
  for (const part of sparse) {
    const [x, y] = point(grid, part.at);
    if (part.offsets.length === 1 && part.ink === prior.capInk) {
      const side = [y === height - 1, x === 0, y === 0, x === width - 1].flatMap((edge, i) => edge ? [i] : []);
      if (side.length !== 1) continue;
      const direction = side[0]!, seed = offset(grid, part.at, orthogonal[direction]!);
      const visibleSeed = single.get(seed);
      if (!visibleSeed || visibleSeed.ink === part.ink) continue;
      sources.push({ at: seed, direction });
      fixtures.add(part);
      fixtures.add(visibleSeed);
    } else if (part.offsets.length === 5 && part.width * part.height === 6) {
      const shape = new Set(part.offsets.map(key));
      const mouth = Array.from({ length: 6 }, (_, i) => [i % part.width, Math.floor(i / part.width)] as NativePoint).find(p => !shape.has(key(p)))!;
      const incoming = orthogonal.findIndex(([dx, dy], i) => shape.has(key([mouth[0] + dx, mouth[1] + dy]))
        && [(i + 1) % 4, (i + 3) % 4].every(side => {
          const [u, v] = orthogonal[side]!;
          return shape.has(key([mouth[0] + u, mouth[1] + v]));
        }));
      if (incoming >= 0) {
        targets.push({ opening: offset(grid, part.at, mouth), incoming });
        fixtures.add(part);
      }
    }
  }
  if (!sources.length || new Set(sources.map(source => source.direction)).size !== 1 || targets.length < 3) return null;
  const main = sources[0]!.direction;
  const emitters: Piece[] = [], usedParts = new Set<RasterPart>(fixtures);
  for (const marker of sparse.filter(part => !fixtures.has(part) && part.ink === prior.capInk && part.offsets.length === 1)) {
    const [x, y] = point(grid, marker.at);
    const flanks = sparse.flatMap(left => {
      const [lx, ly] = point(grid, left.at);
      if (usedParts.has(left) || ly !== y || left.height !== 1 || lx + left.width !== x
        || ![prior.restingInk, prior.focusedInk].includes(left.ink)) return [];
      return sparse.filter(right => !usedParts.has(right) && right.at === offset(grid, marker.at, [1,0])
        && right.height === 1 && right.width === left.width && right.ink === left.ink).map(right => ({ left, right }));
    });
    if (flanks.length !== 1) return null;
    const { left, right } = flanks[0]!;
    const length = left.width + right.width + 1;
    emitters.push({ at: left.at, offsets: Array.from({ length }, (_, dx) => [dx,0]), ink: left.ink, turn: false, emitter: [left.width,0] });
    usedParts.add(left); usedParts.add(right); usedParts.add(marker);
  }
  const mixed = emitters.length > 0;
  if (mixed ? main !== 2 : sources.length < 2 || targets.filter(target => target.incoming % 2 !== main % 2).length !== 1
    || targets.filter(target => target.incoming === main).length !== targets.length - 1) return null;
  const pieces: Piece[] = [...sparse.filter(part => !usedParts.has(part)).map(part => ({ at: part.at, offsets: part.offsets, ink: part.ink,
    turn: part.width === 2 && part.height === 2 && part.offsets.length === 3 })), ...emitters];
  if (mixed) pieces.sort((a,b) => a.at - b.at);
  const focused = pieces.flatMap((piece, i) => piece.ink === prior.focusedInk ? [i] : []);
  const turns = pieces.filter(piece => piece.turn), restingTurn = turns.find(piece => piece.ink !== prior.focusedInk);
  if (focused.length !== 1 || (mixed ? turns.length < 1 || turns.length > 3 : turns.length !== 1) || pieces.length < 3 || pieces.length > 5
    || pieces.some((piece, i) => !piece.turn && (piece.offsets.length < 2 || piece.offsets.some(([x, y]) =>
      mixed ? x !== 0 && y !== 0 : (main % 2 ? x : y) !== 0)
      || i !== focused[0] && piece.ink !== prior.restingInk))) return null;
  const fixed = Array<number>(width * height).fill(background);
  for (const fixture of fixtures) for (const delta of fixture.offsets) fixed[offset(grid, fixture.at, delta)] = fixture.ink;
  if (pieces.some(piece => piece.offsets.some(delta => offset(grid, piece.at, delta) < 0))) return null;
  if (pieces[focused[0]!]!.turn && (!mixed || !restingTurn)) return null;
  const contributors = pieces.map((piece, i) => i === focused[0] ? { ...piece, ink: piece.turn ? restingTurn!.ink : prior.restingInk } : piece);
  const layout = { ...grid, unit, origin, background, focusInk: prior.focusedInk, fixed, pieces: contributors, targets, sources, focused: focused[0]!,
    ...(mixed ? { capInk: prior.capInk } : {}) };
  return verifyDirectedBranches(rows, layout, pieces.map(piece => piece.at), layout.focused) ? layout : null;
}

function occupy(layout: Layout, positions: readonly number[]) {
  const built = Int16Array.from(layout.fixed, ink => ink === layout.background ? 0 : -1);
  for (const [i, piece] of layout.pieces.entries()) {
    const at = positions[i]!;
    if (at < 0) continue;
    for (const delta of piece.offsets) {
      const cell = offset(layout, at, delta);
      if (cell < 0 || built[cell]) return null;
      built[cell] = i + 1;
    }
  }
  return built;
}

export function verifyDirectedBranches(rows: NativeRows, layout: Layout, positions: readonly number[], focused: number) {
  const occupied = occupy(layout, positions);
  if (!occupied) return false;
  const emitters = new Set(layout.pieces.flatMap((piece, i) => piece.emitter && positions[i]! >= 0
    ? [offset(layout, positions[i]!, piece.emitter)] : []));
  for (let at = 0; at < occupied.length; at++) {
    const owner = occupied[at]! - 1;
    const ink = owner < 0 ? layout.fixed[at] : emitters.has(at) ? layout.capInk
      : owner === focused ? layout.focusInk : layout.pieces[owner]!.ink;
    const [l, t, r, b] = directedBranchBox(layout, at);
    for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) if (rows[y]?.[x] !== ink) return false;
  }
  return true;
}

export function projectDirectedBranches(layout: Layout, positions: readonly number[]): Projection | null {
  const board = occupy(layout, positions);
  if (!board) return null;
  const trace = new Set<number>(), served = new Set<number>(), used = new Uint8Array(board.length);
  const mixed = layout.capInk !== undefined, paired = mixed ? new Uint8Array(board.length) : null;
  let escaped = 0;
  let fronts: Front[] = layout.sources.map(source => ({ ...source }));
  if (mixed) for (const [i, piece] of layout.pieces.entries()) {
    if (!piece.emitter || positions[i]! < 0) continue;
    const at = offset(layout, offset(layout, positions[i]!, piece.emitter), orthogonal[2]);
    if (at < 0 || board[at] || fronts.some(front => front.at === at)) continue;
    fronts.push({ at, direction: 2 }); trace.add(at);
  }
  for (const source of fronts) used[source.at] = 1;
  if (paired) for (const source of fronts) paired[source.at] = paired[source.at]! | 1 << source.direction;
  const goals = new Map(layout.targets.map(({ opening, incoming }, i) => [opening * 4 + incoming, i]));
  while (fronts.length) {
    const pending: Front[] = [];
    const advance = (at: number, direction: number, follow = false) => {
      if (at < 0 || (paired && follow && used[at] ? paired[at]! & (1 << direction) : board[at] || used[at])) return;
      const first = !used[at];
      used[at] = 1;
      if (paired) paired[at] = paired[at]! | 1 << direction;
      if (first) trace.add(at);
      pending.push({ at, direction });
    };
    for (const { at, direction } of fronts) {
      const next = offset(layout, at, orthogonal[direction]!);
      if (next < 0) { escaped++; continue; }
      const target = goals.get(at * 4 + direction);
      if (target !== undefined) { served.add(target); continue; }
      const obstacle = board[next]!;
      if (!obstacle || mixed && used[next]) { advance(next, direction, true); continue; }
      const sides = mixed ? direction % 2 ? [0,2] : [3,1] : [(direction + 1) % 4, (direction + 3) % 4];
      const exits = sides.map(side => offset(layout, at, orthogonal[side]!));
      const elbow = obstacle > 0 && layout.pieces[obstacle - 1]!.turn;
      for (const [i, exit] of exits.entries()) {
        if (exit < 0) continue;
        const turn = elbow && board[exits[1 - i]!] === obstacle && board[exit] === 0;
        advance(exit, turn ? sides[i]! : direction);
      }
    }
    fronts = pending;
  }
  return { served, escaped, trace: [...trace] };
}

export function directedBranchSelection(layout: Layout, at: number, index: number): NativePoint {
  const position = offset(layout, at, layout.pieces[index]!.offsets[0]!);
  const [l, t] = directedBranchBox(layout, position), center = Math.floor(layout.unit / 2);
  return [l + center, t + center];
}

function assemblyArea(layout: Layout): NativeBox {
  // Reserve the first approach cell at outlets and the launch lane at inlets.
  // The simulated flow still uses the entire observed board.
  const area = [0, 0, layout.width - 1, layout.height - 1];
  const keepApproachOpen = (at: number, outward: number) => {
    const [x, y] = point(layout, at);
    if (outward === 0) area[1] = Math.max(area[1]!, y + 2);
    if (outward === 1) area[2] = Math.min(area[2]!, x - 2);
    if (outward === 2) area[3] = Math.min(area[3]!, y - 2);
    if (outward === 3) area[0] = Math.max(area[0]!, x + 2);
  };
  for (const { opening, incoming } of layout.targets) keepApproachOpen(opening, incoming);
  for (const { at, direction } of layout.sources) keepApproachOpen(at, (direction + 2) % 4);
  return [area[0]!, area[1]!, area[2]!, area[3]!];
}

function insideAssembly(layout: Layout, [l, t, r, b]: NativeBox, at: number, shape: readonly NativePoint[]) {
  const [x, y] = point(layout, at);
  return shape.every(([dx, dy]) => x + dx >= l && x + dx <= r && y + dy >= t && y + dy <= b);
}

export function directedBranchWalk(layout: Layout, positions: readonly number[], piece: number, destination: number): NativePoint[] | null {
  if (positions[piece] === destination) return [];
  const board = occupy(layout, positions.map((cell, i) => i === piece ? -1 : cell));
  if (!board) return null;
  const { offsets } = layout.pieces[piece]!;
  const area = assemblyArea(layout);
  const seen = new Set([positions[piece]!]);
  const queue: { at: number; previous?: number; delta?: NativePoint }[] = [{ at: positions[piece]! }];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const at = queue[cursor]!.at;
    if (at === destination) {
      const path: NativePoint[] = [];
      for (let node = queue[cursor]!; node.previous !== undefined; node = queue[node.previous]!) path.push(node.delta!);
      return path.reverse();
    }
    for (const delta of orthogonal) {
      const next = offset(layout, at, delta);
      if (next < 0 || seen.has(next) || !insideAssembly(layout, area, next, offsets) || offsets.some(delta => {
        const cell = offset(layout, next, delta);
        return cell < 0 || board[cell];
      })) continue;
      seen.add(next);
      queue.push({ at: next, previous: cursor, delta });
    }
  }
  return null;
}

export function arrangeDirectedBranches(layout: Layout, positions: readonly number[], focused: number, destinations: readonly number[]) {
  const order = [focused, ...positions.flatMap((_, i) => i === focused ? [] : [i])];
  const arrange = (current: readonly number[]): number[] | null => {
    if (current.every((cell, i) => cell === destinations[i])) return [];
    for (const i of order) {
      if (current[i] === destinations[i] || !directedBranchWalk(layout, current, i, destinations[i]!)) continue;
      const rest = arrange(current.map((cell, part) => part === i ? destinations[i]! : cell));
      if (rest) return [i, ...rest];
    }
    return null;
  };
  return arrange(positions);
}

function elbowStarts(layout: Layout, elbow: number) {
  const sourceDirection = layout.sources[0]!.direction;
  const side = layout.targets.find(target => target.incoming % 2 !== sourceDirection % 2)!;
  const elbowShape = new Set(layout.pieces[elbow]!.offsets.map(key));
  const missing = [[0, 0], [1, 0], [0, 1], [1, 1]].find(cell => !elbowShape.has(cell.join(','))) as [number, number];
  const [ax, ay] = orthogonal[sourceDirection]!, [dx, dy] = orthogonal[side.incoming]!;
  if (!elbowShape.has(key([missing[0] + ax, missing[1] + ay])) || !elbowShape.has(key([missing[0] - dx, missing[1] - dy]))) return [];
  const target = point(layout, side.opening);
  return layout.sources.flatMap(source => {
    const beam = point(layout, source.at);
    const entry: NativePoint = sourceDirection % 2 ? [target[0], beam[1]] : [beam[0], target[1]];
    if ((target[0] - entry[0]) * dx + (target[1] - entry[1]) * dy <= 0
      || (entry[0] - beam[0]) * ax + (entry[1] - beam[1]) * ay <= 0) return [];
    return [offset(layout, entry[1] * layout.width + entry[0], [-missing[0], -missing[1]])].filter(at => at >= 0);
  });
}

function placeEmittingBranches(layout: Layout, interrupted: () => boolean): number[] | null {
  const start = layout.pieces.map(piece => piece.at), area = assemblyArea(layout);
  const base = start.map(() => -1), initial = projectDirectedBranches(layout, base);
  if (!initial) return null;
  type Candidate = { positions: number[]; projection: Projection; travel: number; score: number };
  const sourcePositions = layout.pieces.map(piece => piece.emitter
    ? layout.fixed.flatMap((_, at) => insideAssembly(layout, area, at, piece.offsets) ? [at] : []) : null);
  const candidates = (projection: Projection, i: number) => {
    const piece = layout.pieces[i]!;
    if (sourcePositions[i]) return sourcePositions[i]!;
    const offered = new Set([start[i]!]);
    for (const ray of projection.trace) for (const [dx, dy] of piece.offsets) {
      const at = offset(layout, ray, [-dx, -dy]);
      if (at >= 0 && insideAssembly(layout, area, at, piece.offsets)) offered.add(at);
    }
    return offered;
  };
  let frontier: Candidate[] = [{ positions: base, projection: initial, travel: 0, score: 0 }], examined = 0;
  for (let depth = 0; depth < start.length && frontier.length; depth++) {
    const choices: Candidate[] = [], seen = new Set<string>();
    for (const node of frontier) for (const [i, piece] of layout.pieces.entries()) {
      if (node.positions[i] !== -1) continue;
      for (const at of candidates(node.projection, i)) {
        if (++examined % 128 === 0 && interrupted()) return null;
        if (!insideAssembly(layout, area, at, piece.offsets)) continue;
        const positions = node.positions.map((cell, j) => j === i ? at : cell), id = positions.join(',');
        if (seen.has(id)) continue;
        seen.add(id);
        const projection = projectDirectedBranches(layout, positions);
        if (!projection || depth === start.length - 1 && (projection.escaped || projection.served.size !== layout.targets.length)) continue;
        const [x, y] = point(layout, at), [sx, sy] = point(layout, start[i]!);
        const travel = node.travel + Math.abs(x - sx) + Math.abs(y - sy);
        const score = (layout.targets.length - projection.served.size) * 30 + projection.escaped * 4 + travel;
        choices.push({ positions, projection, travel, score });
      }
    }
    choices.sort((a, b) => a.score - b.score || a.travel - b.travel);
    if (depth === start.length - 1) {
      return choices.find(({ positions }) => arrangeDirectedBranches(layout, start, layout.focused, positions))?.positions ?? null;
    }
    const groups = new Map<string, number>();
    frontier = [];
    for (const candidate of choices) {
      const group = candidate.positions.map(cell => cell === -1 ? '0' : '1').join('') + '/'
        + [...candidate.projection.served].sort((a,b) => a - b).join(',');
      const count = groups.get(group) ?? 0;
      if (count >= 64) continue;
      groups.set(group, count + 1);
      frontier.push(candidate);
      if (frontier.length === 640) break;
    }
  }
  return null;
}

export function placeDirectedBranches(layout: Layout, interrupted: () => boolean = () => false) {
  if (layout.capInk !== undefined) return placeEmittingBranches(layout, interrupted);
  const elbow = layout.pieces.findIndex(piece => piece.turn), start = layout.pieces.map(piece => piece.at);
  const area = assemblyArea(layout);
  const cost = (at: number, placed: number) => {
    const [x, y] = point(layout, at), [a, b] = point(layout, placed);
    return Math.abs(x - a) + Math.abs(y - b);
  };
  type Candidate = { positions: number[]; projection: Projection; cost: number; score: number };
  let frontier: Candidate[] = [];
  for (const at of elbowStarts(layout, elbow)) {
    if (!insideAssembly(layout, area, at, layout.pieces[elbow]!.offsets)) continue;
    const positions = start.map((_, i) => i === elbow ? at : -1), projection = projectDirectedBranches(layout, positions);
    if (projection) frontier.push({ positions, projection, cost: cost(at, start[elbow]!), score: 0 });
  }
  const side = layout.targets.findIndex(target => target.incoming % 2 !== layout.sources[0]!.direction % 2);
  for (let depth = 1; depth < start.length && frontier.length; depth++) {
    const alternatives: Candidate[] = [], seen = new Set<string>();
    for (const node of frontier) {
      if (interrupted()) return null;
      for (const [i, piece] of layout.pieces.entries()) {
        if (node.positions[i] !== -1) continue;
        const added = new Set([start[i]!]);
        // A useful new placement either intercepts the current projection or
        // stays parked. Reproject after every addition to include shared walls.
        for (const ray of node.projection.trace) for (const [x, y] of piece.offsets) {
          const at = offset(layout, ray, [-x, -y]);
          if (at >= 0) added.add(at);
        }
        for (const at of added) {
          if (!insideAssembly(layout, area, at, piece.offsets)) continue;
          const positions = node.positions.map((cell, j) => j === i ? at : cell), id = positions.join(',');
          if (seen.has(id)) continue;
          seen.add(id);
          const projection = projectDirectedBranches(layout, positions);
          if (!projection?.served.has(side)) continue;
          const spent = node.cost + cost(at, start[i]!);
          if (depth === start.length - 1 && (projection.escaped || projection.served.size !== layout.targets.length)) continue;
          alternatives.push({ positions, projection, cost: spent,
            score: (layout.targets.length - projection.served.size) * 25 + projection.escaped * 4 + spent });
        }
      }
    }
    alternatives.sort((a, b) => a.score - b.score || a.cost - b.cost);
    frontier = alternatives.slice(0, 96);
  }
  return frontier.find(({ positions, projection }) => !projection.escaped && projection.served.size === layout.targets.length
    && arrangeDirectedBranches(layout, start, layout.focused, positions))?.positions ?? null;
}

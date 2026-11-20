import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

type Axis = 0 | 1;
type Head = { line: number; reach: number };
type Cube = { at: number; type: number };
type Shaft = { axis: Axis; targets: number[]; select: NativePoint; links: boolean[] };
export type CrossedPiercingLayout = {
  origin: NativePoint; stride: number; width: number; height: number; floor: number; materials: number[]; obstacles: number[]; shafts: Shaft[];
  innerStockOnly?: true;
};
export type CrossedPiercingPose = { heads: Head[]; cubes: Cube[] };
type Direction = { action: string; vector: NativePoint };
type Scene = { layout: CrossedPiercingLayout; pose: CrossedPiercingPose; tints: string[]; handles: NativePoint[] };
export type CrossedPiercingStep = { action: string; active: number; pose: CrossedPiercingPose; select?: NativePoint };
export type CrossedPiercingRefusal = { placement: string; active: number; action: string };

const same = <T>(a: readonly T[], b: readonly T[]) => a.length === b.length && a.every((item, i) => item === b[i]);
const keyOfCubes = (cubes: Cube[]) => cubes.flatMap(({ type, at }) => [type, at]);
const orderCubes = (a: Cube, b: Cube) => a.type - b.type || a.at - b.at;
export const crossedPiercingKey = (pose: CrossedPiercingPose) =>
  String.fromCharCode(...pose.heads.flatMap(({ line, reach }) => [line, reach]), ...keyOfCubes(pose.cubes));

export function sameCrossedRails(first: CrossedPiercingLayout, second: CrossedPiercingLayout): boolean {
  return first.shafts.length === second.shafts.length
    && first.shafts.every(({ links }, index) => same(links, second.shafts[index]!.links));
}

export function crossedRailStepSupported(layout: CrossedPiercingLayout, pose: CrossedPiercingPose, leg?: CrossedPiercingStep): boolean {
  if (!leg || leg.select) return true;
  const from = pose.heads[leg.active]!.line, to = leg.pose.heads[leg.active]!.line;
  return from === to || layout.shafts[leg.active]!.links[Math.min(from, to)] === true;
}

export function readCrossedPiercing(rows: NativeRows, stride: number, prior?: CrossedPiercingLayout): Scene | null {
  if (stride < 4 || stride > 12 || stride % 2) return null;
  const parts = geometricComponents(rows);
  const candidates = prior ? [] : parts.filter(({ bbox: [l,t,r,b], area }) => {
    const w = r - l + 1, h = b - t + 1;
    return l >= stride && t >= stride && w >= stride * 3 && h >= stride * 3
      && w % stride === 0 && h % stride === 0 && area * 2 >= w * h;
  });
  if (!prior && candidates.length !== 1 || prior && prior.stride !== stride) return null;
  const field = candidates[0];
  const origin: NativePoint = prior?.origin ?? [field!.bbox[0] - stride, field!.bbox[1] - stride];
  const width = prior?.width ?? (field!.bbox[2] + 1 - origin[0]) / stride;
  const height = prior?.height ?? (field!.bbox[3] + 1 - origin[1]) / stride;
  const [left, top, right, bottom] = [origin[0] + stride, origin[1] + stride, origin[0] + width * stride - 1, origin[1] + height * stride - 1];
  const floor = prior?.floor ?? field!.color;
  if (width * height > 144) return null;
  const rings = parts.filter(({ bbox: [l,t,r,b], area }) => r - l + 1 === stride && b - t + 1 === stride
    && area > stride && area < stride ** 2 / 2 + 1);
  const shafts: Shaft[] = [], heads: Head[] = [], tints: string[] = [], handles: NativePoint[] = [];
  const readSquare = (x: number, y: number, margin: number) => {
    const ink = rows[y + margin]?.[x + margin], size = stride - margin * 2;
    return ink !== undefined && rows.slice(y + margin, y + stride - margin).length === size
      && rows.slice(y + margin, y + stride - margin).every(line => {
        const pixels = line.slice(x + margin, x + stride - margin);
        return pixels.length === size && pixels.every(value => value === ink);
      }) ? ink : null;
  };
  const middle = stride / 2 - 1, canvas = rows[origin[1]]?.[origin[0]];
  if (canvas === undefined || canvas === floor) return null;
  for (const axis of [0, 1] as const) {
    const bound = axis === 0 ? height : width, forward = axis === 0 ? width : height;
    const activeRings = rings.filter(({ bbox: [x,y] }) => axis === 0
      ? x === origin[0] && y >= top && y <= bottom && (y - top) % stride === 0
      : y === origin[1] && x >= left && x <= right && (x - left) % stride === 0);
    if (activeRings.length !== 1) return null;
    const { bbox: [x,y], color } = activeRings[0]!;
    const references = rings.filter(part => part.color === color && part.bbox[1] > bottom);
    if (references.length !== 1) return null;
    const [rx, ry] = references[0]!.bbox;
    const targets: number[] = prior ? [...prior.shafts[axis]!.targets] : [];
    for (let px = rx + stride; !prior && px + stride <= rows[ry]!.length; px += stride) {
      const ink = readSquare(px, ry, 1);
      if (ink === null || ink === floor || ink === canvas) break;
      targets.push(ink);
    }
    if (!targets.length || targets.length > forward - 1) return null;
    const edge = (offset: number) => axis === 0
      ? [rows[y + middle]![x + (offset + 1) * stride - 1]!, rows[y + middle + 1]![x + (offset + 1) * stride - 1]!]
      : [rows[y + (offset + 1) * stride - 1]![x + middle]!, rows[y + (offset + 1) * stride - 1]![x + middle + 1]!];
    const ink = edge(0);
    let reach = 0;
    while (reach + 1 < forward && same(edge(reach + 1), ink)) reach++;
    const line = axis === 0 ? (y - origin[1]) / stride : (x - origin[0]) / stride;
    const links = Array.from({ length: bound - 1 }, (_, i) => {
      if (i === 0) return false;
      const [sx, sy] = axis === 0 ? [origin[0] + middle, origin[1] + (i + 1) * stride - 1]
        : [origin[0] + (i + 1) * stride - 1, origin[1] + middle];
      return [rows[sy]?.[sx], rows[sy + axis]?.[sx + 1 - axis]].every(value => value !== undefined && value !== canvas);
    });
    shafts.push({ axis, targets, select: [rx + middle, ry + middle], links });
    heads.push({ line, reach }); handles.push([x,y]); tints.push(ink.join(','));
  }
  const materials = prior?.materials ?? [...new Set(shafts.flatMap(shaft => shaft.targets))];
  const cubes: Cube[] = [], obstacles: number[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const px = origin[0] + x * stride, py = origin[1] + y * stride, at = y * width + x;
    const solid = readSquare(px, py, 0);
    if (x && y && solid !== null && solid !== floor) { obstacles.push(at); continue; }
    if (!x && !y) continue;
    const inner = readSquare(px, py, 1), type = inner === null ? -1 : materials.indexOf(inner);
    if (type >= 0) cubes.push({ at, type });
  }
  if (!prior) for (const shaft of shafts) shaft.targets = shaft.targets.map(ink => materials.indexOf(ink));
  if (!cubes.length || cubes.length > 12 || shafts.some(({ targets }) =>
    targets.some(type => targets.filter(item => item === type).length > cubes.filter(cube => cube.type === type).length))) return null;
  const layout = { origin, stride, width, height, floor, materials, obstacles, shafts,
    ...(prior?.innerStockOnly ? { innerStockOnly: prior.innerStockOnly } : {}) };
  if (prior && (!same(obstacles, prior.obstacles) || shafts.some((shaft, i) => {
    const current = prior.shafts[i]!;
    return shaft.axis !== current.axis || !same(shaft.targets, current.targets) || !same(shaft.select, current.select);
  }))) return null;
  return { layout, pose: { heads, cubes: cubes.sort(orderCubes) }, tints, handles };
}

const address = (width: number, axis: Axis, line: number, reach: number) =>
  axis === 0 ? line * width + reach : reach * width + line;

function stepCrossed(layout: CrossedPiercingLayout, obstacles: ReadonlySet<number>, pose: CrossedPiercingPose, active: number,
  [dx, dy]: NativePoint): CrossedPiercingPose | null {
  const { width, height, shafts } = layout;
  const { axis, links } = shafts[active]!, head = pose.heads[active]!;
  const thrust = axis === 0 ? dx : dy, slide = axis === 0 ? dy : dx;
  const reach = head.reach + thrust, line = head.line + slide;
  const length = axis === 0 ? width : height, span = axis === 0 ? height : width;
  if (reach < 0 || reach >= length || line < 1 || line >= span || slide && !links[Math.min(line, head.line)]) return null;
  const at = (position: number, height: number) => address(width, axis, position, height);
  if (thrust > 0 && obstacles.has(at(line, reach))) return null;
  if (slide && Array.from({ length: reach + 1 }, (_, offset) => at(line, offset)).some(position => obstacles.has(position))) return null;
  const cubes = new Map(pose.cubes.map(cube => [cube.at, cube])), moved = new Set<number>();
  const other = active === 0 ? 1 : 0, otherAxis = shafts[other]!.axis, otherHead = pose.heads[other]!;
  const crossesOther = (position: number) => {
    if ((dx !== 0) === (otherAxis === 0)) return false;
    const x = position % width, y = Math.floor(position / width);
    return otherAxis === 0 ? y === otherHead.line && x <= otherHead.reach : x === otherHead.line && y <= otherHead.reach;
  };
  const offset = dx + dy * width;
  const stockEdge = layout.innerStockOnly ? 1 : 0;
  function push(position: number): boolean {
    if (moved.has(position) || !cubes.has(position)) return true;
    const x = position % width + dx, y = Math.floor(position / width) + dy, next = position + offset;
    if (x < stockEdge || x >= width || y < stockEdge || y >= height || obstacles.has(next)
      || crossesOther(position) || crossesOther(next) || !push(next)) return false;
    moved.add(position); return true;
  }
  const minimum = thrust < 0 ? 1 : 0;
  const maximum = head.reach;
  for (let span = minimum; span <= maximum; span++) {
    const source = at(head.line, span), destination = source + offset;
    if (!push(source) && slide || !push(destination) && slide) return null;
  }
  const following = pose.heads.map((value, i) => i === active ? { line, reach } : value);
  const stock = moved.size ? pose.cubes.map(cube => moved.has(cube.at) ? { ...cube, at: cube.at + offset } : cube).sort(orderCubes) : pose.cubes;
  return { heads: following, cubes: stock };
}

export function predictCrossedPiercing(layout: CrossedPiercingLayout, pose: CrossedPiercingPose, active: number, vector: NativePoint) {
  return stepCrossed(layout, new Set(layout.obstacles), pose, active, vector);
}

export function observeCrossedStockBoundary(layout: CrossedPiercingLayout, before: CrossedPiercingPose, expected: CrossedPiercingPose,
  actual: CrossedPiercingPose, active: number): CrossedPiercingLayout | null {
  if (layout.innerStockOnly || !expected.cubes.some(({ at }) => at < layout.width || at % layout.width === 0)) return null;
  const from = before.heads[active]!, plan = expected.heads[active]!;
  if (plan.line !== from.line || plan.reach !== from.reach - 1) return null;
  const constrained: CrossedPiercingLayout = { ...layout, innerStockOnly: true };
  const vector: NativePoint = layout.shafts[active]!.axis === 0 ? [-1, 0] : [0, -1];
  const forecast = predictCrossedPiercing(constrained, before, active, vector);
  return forecast && crossedPiercingKey(forecast) === crossedPiercingKey(actual) ? constrained : null;
}

export function planCrossedPiercing(layout: CrossedPiercingLayout, pose: CrossedPiercingPose, active: number,
  directions: Direction[], limit: number, shouldStop: () => boolean,
  refusals: readonly CrossedPiercingRefusal[] = []): CrossedPiercingStep[] | null {
  type Node = { pose: CrossedPiercingPose; active: number; depth: number; prior?: Node; action?: string };
  const { width, height, shafts } = layout, obstacles = new Set(layout.obstacles);
  const pending = new Map<number, Node[]>(), seen = new Map<string, number>();
  const refused = new Set(refusals.map(({ active, placement, action }) => String.fromCharCode(active) + placement + '/' + action));
  const coordinates = Array.from({ length: width * height }, (_, at) => [at % width, Math.floor(at / width)] as NativePoint);
  function assess(pose: CrossedPiercingPose) {
    let outstanding = 0, estimate = 0;
    for (const [i, { axis, targets }] of shafts.entries()) {
      const { line, reach } = pose.heads[i]!;
      const transverse = axis === 0 ? height : width, forward = axis === 0 ? width : height;
      const loaded = pose.cubes.filter(({ at }) => coordinates[at]![1 - axis] === line && coordinates[at]![axis] <= reach)
        .sort((a, b) => a.at - b.at);
      const fault = targets.findIndex((type, j) => loaded[j]?.type !== type);
      if (fault < 0) continue;
      outstanding++;
      let minimum = Infinity;
      const counts = new Map<number, number>();
      for (const type of targets) counts.set(type, (counts.get(type) ?? 0) + 1);
      for (let lane = 1; lane < transverse; lane++) {
        let span = forward - 1;
        for (let offset = 1; offset < forward; offset++) if (obstacles.has(address(width, axis, lane, offset))) { span = offset - 1; break; }
        if (span < targets.length) continue;
        let score = Math.abs(lane - line) + Math.max(0, targets.length - reach);
        for (const [type, count] of counts) {
          const distances = pose.cubes.filter(cube => cube.type === type).map(cube => {
            const point = coordinates[cube.at]!;
            return Math.abs(point[1 - axis]! - lane) + Math.max(0, point[axis]! - span);
          }).sort((a, b) => a - b);
          score += distances.slice(0, count).reduce((sum, distance) => sum + distance, 0);
        }
        minimum = Math.min(minimum, score);
      }
      estimate += (targets.length - fault) * 5 + Math.min(30, minimum);
    }
    return { outstanding, estimate };
  }
  const id = (pose: CrossedPiercingPose, active: number) => String.fromCharCode(active) + crossedPiercingKey(pose);
  function enqueue(node: Node) {
    const key = id(node.pose, node.active);
    if ((seen.get(key) ?? Infinity) <= node.depth) return;
    seen.set(key, node.depth);
    const { estimate } = assess(node.pose);
    const priority = node.depth + estimate * 3;
    const bucket = pending.get(priority);
    if (bucket) bucket.push(node);
    else pending.set(priority, [node]);
  }
  enqueue({ pose, active, depth: 0 });
  for (let expanded = 0; pending.size && expanded < 280_000 && seen.size < 400_000; expanded++) {
    if (expanded % 64 === 0 && shouldStop()) return null;
    const rank = Math.min(...pending.keys()), bucket = pending.get(rank)!, node = bucket.pop()!;
    if (!bucket.length) pending.delete(rank);
    const key = id(node.pose, node.active);
    if (seen.get(key) !== node.depth) continue;
    if (node.prior && assess(node.pose).outstanding === 0) {
      const route: CrossedPiercingStep[] = [];
      for (let current: Node | undefined = node; current?.prior; current = current.prior) {
        const select = current.action === 'ACTION6' ? shafts[current.active]!.select : null;
        route.push({ action: current.action!, active: current.active, pose: current.pose, ...(select ? { select } : {}) });
      }
      return route.reverse();
    }
    if (node.depth >= limit) continue;
    for (const { action, vector } of directions) {
      if (refused.has(key + '/' + action)) continue;
      const following = stepCrossed(layout, obstacles, node.pose, node.active, vector);
      if (following) enqueue({ pose: following, active: node.active, depth: node.depth + 1, prior: node, action });
    }
    const other = node.active === 0 ? 1 : 0;
    if (!refused.has(key + '/ACTION6')) enqueue({ pose: node.pose, active: other, depth: node.depth + 1, prior: node, action: 'ACTION6' });
  }
  return null;
}

import type { NativeBox, NativeEntity, NativeObservation, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

type RankedSquare = { at: NativePoint; box: NativeBox; rank: number; side: number };
type SpritePixel = readonly [dx: number, dy: number, ink: number];
type Mobile = { at: NativePoint; visible: number };
type World = { square: RankedSquare; mobile: Mobile };
type Receiver = { box: NativeBox; ink: number };
type Stencil = { pixels: SpritePixel[]; extent: NativeBox };
type Scene = { palette: number[]; requestedRank: number; requestedSide: number; arena: NativeBox; receivers: [Receiver, Receiver];
  stencil: Stencil; radius: { lower: number; upper: number }; ticks: number; mobileStride: number };
export type ContactCalibration = { palette: readonly number[]; radius: Scene['radius'];
  mobileEffect?: { travel: number; diversion: number; refs: readonly string[] } };
export type ContactDemand = { epoch: number; scene: Scene; world: World; attempted: string[]; refs: string[]; contacts: number; stopped?: true };
export type ContactChoice = { point: NativePoint; expected: World; intent: 'approach' | 'advance' | 'deliver';
  receivers?: readonly [Receiver, Receiver] };

const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const at = ([l, t, r, b]: NativeBox): NativePoint => [Math.ceil((l + r) / 2), Math.ceil((t + b) / 2)];
const box = ([x, y]: NativePoint, side: number): NativeBox => [x - Math.floor(side / 2), y - Math.floor(side / 2),
  x + Math.ceil(side / 2) - 1, y + Math.ceil(side / 2) - 1];
const inside = ([l, t, r, b]: NativeBox, x: number, y: number) => l <= x && x <= r && t <= y && y <= b;
const encloses = (outer: NativeBox, [l, t, r, b]: NativeBox) => inside(outer, l, t) && inside(outer, r, b);
const solidSquare = (part: NativeEntity) => part.rectangular && width(part.bbox) === height(part.bbox);
const gap = ([x, y]: NativePoint, [l, t, r, b]: NativeBox) => Math.hypot(Math.max(l - x, 0, x - r), Math.max(t - y, 0, y - b));
const distance = ([x, y]: NativePoint, [a, b]: NativePoint) => Math.hypot(x - a, y - b);
const clamp = (value: number, lower: number, upper: number) => Math.max(lower, Math.min(upper, value));
const separation = (world: World) => gap(world.mobile.at, world.square.box);
const worldKey = ({ square, mobile }: World) => [square.at.join(','), mobile.at.join(','), square.rank].join(';');
const trialKey = (world: World, point: NativePoint) => worldKey(world) + '>' + point.join(',');

export function contactMobileBox(scene: Scene, [x, y]: NativePoint): NativeBox {
  const [l, t, r, b] = scene.stencil.extent;
  return [l + x, t + y, r + x, b + y];
}

function findMobileStamp(entities: readonly NativeEntity[], arena: NativeBox, top: number) {
  const baseOf = (part: NativeEntity) => entities.find(base => base.rectangular && height(base.bbox) === 1
    && base.bbox[1] === part.bbox[3] + 1 && base.bbox[0] === part.bbox[0] && base.bbox[2] === part.bbox[2]
    && base.palette_value !== part.palette_value);
  const glyphs = entities.filter(part => !part.rectangular && part.area >= 3
    && width(part.bbox) <= 7 && height(part.bbox) <= 7);
  const requests = glyphs.flatMap(glyph => glyph.bbox[1] > top && glyph.bbox[3] < arena[1] && baseOf(glyph) ? [glyph] : []);
  if (requests.length !== 1) return null;
  const identity = JSON.stringify(requests[0]!.mask);
  const matches = glyphs.flatMap(glyph => {
    if (!encloses(arena, glyph.bbox) || JSON.stringify(glyph.mask) !== identity) return [];
    const base = baseOf(glyph);
    if (!base || !encloses(arena, base.bbox)) return [];
    const [l, t, r] = glyph.bbox, b = base.bbox[3], [cx, cy] = at([l, t, r, b]);
    const pixels = glyph.mask.map(([x, y]): SpritePixel => [l + x - cx, t + y - cy, glyph.palette_value]);
    for (const [x] of base.mask) pixels.push([l + x - cx, b - cy, base.palette_value]);
    return [{ pixels, extent: [l - cx, t - cy, r - cx, b - cy] } satisfies Stencil];
  });
  return matches.length === 1 ? matches[0]! : null;
}

export function observeContactWorld(observation: NativeObservation, rows: NativeRows, scene: Scene, expected?: NativePoint): World | null {
  const candidates = observation.entities.filter(part => solidSquare(part) && width(part.bbox) >= scene.requestedSide
    && encloses(scene.arena, part.bbox) && scene.palette.includes(part.palette_value));
  if (candidates.length !== 1) return null;
  const body = candidates[0]!;
  const square = { at: at(body.bbox), box: body.bbox, rank: scene.palette.indexOf(body.palette_value), side: width(body.bbox) };
  const [left, top, right, bottom] = scene.arena, matches: Mobile[] = [];
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
    let visible = 0, compatible = true;
    for (const [dx, dy, ink] of scene.stencil.pixels) {
      const px = x + dx, py = y + dy, actual = rows[py]?.[px];
      if (actual === ink) visible++;
      else if (!(actual === body.palette_value && inside(body.bbox, px, py))
        && !scene.receivers.some(receiver => actual === receiver.ink && inside(receiver.box, px, py))) { compatible = false; break; }
    }
    if (compatible && (visible >= 3 || expected?.[0] === x && expected?.[1] === y)) matches.push({ at: [x, y], visible });
  }
  matches.sort((a, b) => b.visible - a.visible || (expected ? distance(a.at, expected) - distance(b.at, expected) : 0));
  if (!matches.length || matches[1]?.visible === matches[0]!.visible && !expected) return null;
  return { square, mobile: matches[0]! };
}

export function measureContactDemand(observation: NativeObservation, rows: NativeRows, known: ContactCalibration): ContactDemand | null {
  const { entities } = observation, columns = rows[0]!.length, lines = rows.length, { mobileEffect, radius } = known;
  if (!mobileEffect || radius.lower < 1 || radius.upper - radius.lower > 5) return null;
  const reserves = entities.filter(part => part.area === columns && height(part.bbox) === 1 && part.bbox[1] >= lines * 0.85);
  if (reserves.length !== 1) return null;
  const header = entities.filter(part => width(part.bbox) === columns && part.bbox[1] === 0 && height(part.bbox) > 1 && height(part.bbox) <= lines / 6);
  if (header.length !== 1) return null;
  const arena: NativeBox = [1, header[0]!.bbox[3] + 1, columns - 2, reserves[0]!.bbox[1] - 1];
  const samples = entities.filter(part => solidSquare(part) && width(part.bbox) >= 2 && part.bbox[1] > 0)
    .map(part => ({ part, line: part.bbox[1], size: width(part.bbox) }));
  const strips = samples.filter(sample => sample.part.bbox[3] < arena[1]).map(({ line, size }) =>
    samples.filter(sample => sample.line === line && sample.size === size).map(({ part }) => part).sort((a, b) => a.bbox[0] - b.bbox[0]));
  const strip = strips.find(parts => parts.length > known.palette.length && parts.length <= 12
    && known.palette.every((ink, i) => parts[i]?.palette_value === ink) && new Set(parts.map(part => part.palette_value)).size === parts.length);
  if (!strip) return null;
  const palette = strip.map(part => part.palette_value), size = width(strip[0]!.bbox), top = strip[0]!.bbox[3];
  const requests = entities.filter(part => solidSquare(part) && width(part.bbox) > size
    && top < part.bbox[1] && part.bbox[3] < arena[1] && palette.includes(part.palette_value));
  if (requests.length !== 1) return null;
  const request = requests[0]!, requestedSide = width(request.bbox), requestedRank = palette.indexOf(request.palette_value);
  const receivers = entities.filter(part => !part.rectangular && width(part.bbox) === height(part.bbox) && width(part.bbox) > 2 * requestedSide
    && part.area > width(part.bbox) ** 2 / 2 && encloses(arena, part.bbox) && !palette.includes(part.palette_value))
    .map(part => ({ box: part.bbox, ink: part.palette_value }));
  const stencil = findMobileStamp(entities, arena, top);
  if (receivers.length !== 2 || !stencil) return null;
  const ticks = clamp(Math.round(mobileEffect.travel / Math.SQRT2), 1, 8);
  const scene: Scene = { palette, requestedRank, requestedSide, arena, receivers: [receivers[0]!, receivers[1]!], stencil,
    radius, ticks, mobileStride: clamp(Math.round(mobileEffect.diversion / ticks), 1, 8) };
  const world = observeContactWorld(observation, rows, scene);
  return world && world.square.rank > requestedRank ? { scene, world, epoch: observation.level_epoch, attempted: [],
    refs: [...mobileEffect.refs.slice(-3), observation.observation_ref], contacts: 0 } : null;
}

function quietPoint(scene: Scene, world: World): NativePoint | null {
  const [l, t, r, b] = scene.arena;
  const corners: NativePoint[] = [[r - 2, t + 1], [r - 2, b - 1], [l, t + 1], [l, b - 1]];
  return corners.find(point => gap(point, world.square.box) > scene.radius.upper
    && gap(point, contactMobileBox(scene, world.mobile.at)) > scene.radius.upper) ?? null;
}

function* clicks(scene: Scene, world: World): Generator<NativePoint> {
  const [left, top, right, bottom] = scene.arena, margin = scene.radius.lower, seen = new Set<string>();
  for (const footprint of [world.square.box, contactMobileBox(scene, world.mobile.at)]) {
    const [l, t, r, b] = footprint;
    for (let y = Math.max(t - margin, top); y <= Math.min(b + margin, bottom); y++) {
      for (let x = Math.max(l - margin, left); x <= Math.min(r + margin, right); x++) {
        const point: NativePoint = [x, y], key = point.join(',');
        if (seen.has(key) || gap(point, footprint) > margin) continue;
        seen.add(key);
        yield point;
      }
    }
  }
  const idle = quietPoint(scene, world);
  if (idle) yield idle;
}

function forecast(scene: Scene, world: World, point: NativePoint, goals?: readonly [Receiver, Receiver]) {
  const { lower, upper } = scene.radius, s = gap(point, world.square.box), p = gap(point, contactMobileBox(scene, world.mobile.at));
  if (s > lower && s <= upper || p > lower && p <= upper) return null;
  const [l, t, r] = scene.arena, side = world.square.side;
  const squareStride = Math.ceil((upper + Math.floor(side / 2)) / scene.ticks);
  const [dx, dy] = [point[0] - world.mobile.at[0], point[1] - world.mobile.at[1]];
  const length = Math.max(1, Math.abs(dx), Math.abs(dy));
  const impulse = p <= lower ? [dx, dy].map(delta => Math.sign(delta) * Math.round(Math.abs(delta) * scene.mobileStride / length)) : null;
  let square = world.square, mobile = world.mobile, minimum = Infinity;
  for (let tick = 0; tick < scene.ticks; tick++) {
    if (s <= lower) {
      const x = square.at[0] + clamp(point[0] - square.at[0], -squareStride, squareStride);
      const y = square.at[1] + clamp(point[1] - square.at[1], -squareStride, squareStride);
      square = { ...square, at: [x, y], box: box([x, y], side) };
    }
    const [x, y] = mobile.at, [a, b] = impulse ?? [Math.sign(square.at[0] - x), Math.sign(square.at[1] - y)];
    mobile = { ...mobile, at: [clamp(x + a!, l, r), clamp(y + b!, t, scene.arena[3])] };
    minimum = Math.min(minimum, gap(mobile.at, square.box));
    if (goals && encloses(goals[0].box, square.box) && encloses(goals[1].box, contactMobileBox(scene, mobile.at))) return { world: { square, mobile }, complete: true };
  }
  return goals && minimum < 2.5 ? null : { world: { square, mobile }, complete: false };
}

function approach(scene: Scene, world: World, attempted: ReadonlySet<string>): ContactChoice | null {
  const pause = quietPoint(scene, world);
  if (pause && (separation(world) < 3 || world.mobile.visible < 3) && !attempted.has(trialKey(world, pause))) {
    return { point: pause, intent: 'advance', expected: forecast(scene, world, pause)?.world ?? world };
  }
  let best: ContactChoice | null = null, cost = Infinity;
  for (const point of clicks(scene, world)) {
    if (attempted.has(trialKey(world, point))) continue;
    const projected = forecast(scene, world, point)?.world;
    if (!projected || worldKey(projected) === worldKey(world)) continue;
    const [x, y] = projected.square.at, [a, b] = projected.mobile.at;
    const score = Math.max(Math.abs(x - a), Math.abs(y - b)) + Math.hypot(x - a, y - b) * 0.125
      + distance(world.square.at, projected.square.at) * 0.025;
    if (score < cost) { cost = score; best = { point, expected: projected, intent: 'approach' }; }
  }
  return best;
}

function deliver(scene: Scene, world: World, attempted: ReadonlySet<string>, shouldStop: () => boolean): ContactChoice | null {
  const [first, second] = scene.receivers;
  const goals: [Receiver, Receiver] = gap(world.square.at, first.box) <= gap(world.square.at, second.box) ? [first, second] : [second, first];
  const score = (state: World) => gap(state.square.at, goals[0].box) + 0.8 * gap(state.mobile.at, goals[1].box)
    + 0.12 * distance(state.square.at, at(goals[0].box)) + 0.15 * distance(state.mobile.at, at(goals[1].box));
  type Node = { world: World; score: number; first?: ContactChoice };
  let wave: Node[] = [{ world, score: score(world) }], best: ContactChoice | null = null, cost = Infinity;
  const seen = new Set([worldKey(world)]);
  for (let depth = 0; depth < 13 && wave.length && !shouldStop(); depth++) {
    const next: Node[] = [];
    for (const node of wave) for (const point of clicks(scene, node.world)) {
      if (depth === 0 && attempted.has(trialKey(world, point))) continue;
      const projected = forecast(scene, node.world, point, goals);
      if (!projected) continue;
      const first: ContactChoice = node.first ?? { point, expected: projected.world, intent: 'deliver', receivers: goals };
      if (projected.complete) return first;
      const id = worldKey(projected.world);
      if (seen.has(id)) continue;
      seen.add(id);
      const rank = score(projected.world);
      if (rank + depth < cost) { best = first; cost = rank + depth; }
      next.push({ world: projected.world, first, score: rank });
    }
    wave = next.sort((a, b) => a.score - b.score).slice(0, 65);
  }
  return best;
}

export function chooseContactDemand(memory: ContactDemand, shouldStop: () => boolean): ContactChoice | null {
  const { scene, world } = memory, attempted = new Set(memory.attempted);
  if (memory.stopped || memory.attempted.length >= 48 || world.square.rank < scene.requestedRank) return null;
  return world.square.rank === scene.requestedRank ? deliver(scene, world, attempted, shouldStop) : approach(scene, world, attempted);
}

export function observeContactDemand(memory: ContactDemand, choice: ContactChoice, observation: NativeObservation, rows: NativeRows) {
  const world = observeContactWorld(observation, rows, memory.scene, choice.expected.mobile.at);
  if (!world) return null;
  const converted = world.square.rank === memory.world.square.rank - 1 && world.square.side < memory.world.square.side;
  const moved = worldKey(world) !== worldKey(memory.world);
  const confirmed = converted || moved && world.square.rank === memory.world.square.rank;
  const next: ContactDemand = { ...memory, world, contacts: memory.contacts + Number(converted),
    attempted: [...memory.attempted, trialKey(memory.world, choice.point)],
    refs: confirmed ? [...memory.refs.slice(-5), observation.observation_ref] : memory.refs };
  return { next, converted, confirmed };
}

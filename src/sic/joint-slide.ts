import { rectangularOpenComplements } from '../logos-engine/v6-cavity-measurements.ts';
import { supportParts } from '../logos-engine/v6-support-measurements.ts';
import type { NativeBox, NativeObservation, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import { pairedOpenings } from './paired-opening.ts';
import { slideBoundaryMatches, type SlideBoundary } from './slide-boundary.ts';

type Piece = { at: NativePoint; ink: number };
type Patrol = { at: NativePoint; direction: NativePoint; side: number; ink: number; markerInk: number };
type World = { pieces: Piece[]; patrols: Patrol[] };
type Rule = { wrap: boolean; reverseAndMove: boolean; reservePreviousMask: boolean };
type Board = { origin: NativePoint; pitch: number; width: number; height: number; floor: string[]; paint: Record<string, number>;
  colored: Piece; open?: NativePoint; knownSeams?: string[] };
type Direction = readonly [string, NativePoint];
export type JointSlide = { epoch: number; board: Board; world: World; rules: Rule[]; refs: string[]; inputs?: readonly Direction[] };
type SlideProjection = { next: World; crossedSeam: boolean; reachedSlot: boolean };
export type JointSlideStep = SlideProjection & { input: string; rule: Rule; distance: number; temporarilyVacatesSeat: boolean };
type Part = ReturnType<typeof supportParts>[number];
type Bounds = Part['bbox'];

const moves = [
  ['ACTION1', [0, -1]], ['ACTION2', [0, 1]], ['ACTION3', [-1, 0]], ['ACTION4', [1, 0]],
] as const;
const key = ([x, y]: NativePoint) => x + ',' + y;
const equal = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
const add = ([x, y]: NativePoint, [dx, dy]: NativePoint): NativePoint => [x + dx, y + dy];
const manhattan = ([x, y]: NativePoint, [a, b]: NativePoint) => Math.abs(x - a) + Math.abs(y - b);
const modulo = (value: number, size: number) => (value % size + size) % size;
const interior = (a: Bounds, b: Bounds) => a.left > b.left && a.right < b.right && a.top > b.top && a.bottom < b.bottom;
const owns = (box: Bounds, [x, y]: NativePoint) => box.left <= x && x <= box.right && box.top <= y && y <= box.bottom;

function footprint(at: NativePoint, side: number): NativePoint[] {
  const radius = Math.floor(side / 2);
  return Array.from({ length: side * side }, (_, i) => add(at, [i % side - radius, Math.floor(i / side) - radius]));
}

export function slideBox({ board: { origin, pitch } }: JointSlide, [x, y]: NativePoint): NativeBox {
  const [left, top] = [origin[0] + x * pitch, origin[1] + y * pitch];
  return [left, top, left + pitch - 1, top + pitch - 1];
}

export function readJointSlide(rows: NativeRows, observation: NativeObservation, parts: Part[]): JointSlide | null {
  if (!moves.every(([input]) => observation.available_action_refs.includes(input))
    || observation.available_action_refs.some(input => /^ACTION[56]$/.test(input))) return null;
  const frames = parts.filter(({ bbox, area }) => bbox.width >= 8 && bbox.height >= 8
    && area === 2 * (bbox.width + bbox.height) - 4
    && rows.slice(bbox.top, bbox.bottom + 1).every((row, i) => {
      const rim = row[bbox.left];
      return rim === rows[bbox.top]?.[bbox.left] && row[bbox.right] === rim
        && (i > 0 && i < bbox.height - 1 || row.slice(bbox.left, bbox.right + 1).every(ink => ink === rim));
    }));
  const candidates = frames.flatMap(({ bbox }) => {
    const enclosed = parts.filter(part => interior(part.bbox, bbox));
    const squares = enclosed.filter(({ bbox, area }) => bbox.width > 1 && bbox.width === bbox.height && area === bbox.width ** 2);
    const pitch = Math.min(...squares.map(p => p.bbox.width));
    if (!Number.isFinite(pitch)) return [];
    const width = (bbox.width - 2) / pitch, height = (bbox.height - 2) / pitch;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width * height > 768) return [];
    const origin: NativePoint = [bbox.left + 1, bbox.top + 1];
    const cell = (x: number, y: number): NativePoint => [(x - origin[0]) / pitch, (y - origin[1]) / pitch];
    const inside = (at: NativePoint) => at.every(Number.isInteger) && at[0] >= 0 && at[1] >= 0 && at[0] < width && at[1] < height;
    const positioned = squares.filter(p => p.bbox.width === pitch && inside(cell(p.bbox.left, p.bbox.top)));
    const patrolFrames = enclosed.filter(p => {
      const side = p.bbox.width / pitch;
      return side >= 3 && side <= 5 && side % 2 === 1 && p.bbox.width === p.bbox.height
        && p.area === (side * side - 1) * pitch * pitch && inside(cell(p.bbox.left, p.bbox.top))
        && positioned.filter(s => interior(s.bbox, p.bbox) || owns(p.bbox, [s.bbox.left, s.bbox.top])
          && owns(p.bbox, [s.bbox.right, s.bbox.bottom])).length === 1;
    });
    const patrol = patrolFrames[0];
    if (!patrol || patrolFrames.length !== 1) return [];
    const marker = positioned.find(p => owns(patrol.bbox, [p.bbox.left, p.bbox.top]))!;
    const side = patrol.bbox.width / pitch, offset = Math.floor(side / 2);
    const at = add(cell(patrol.bbox.left, patrol.bbox.top), [offset, offset]);
    const markerAt = cell(marker.bbox.left, marker.bbox.top);
    const direction: NativePoint = [Math.sign(markerAt[0] - at[0]), Math.sign(markerAt[1] - at[1])];
    if (equal(direction, [0, 0])) return [];
    const gaps = pairedOpenings(rows, parts).map(([x, y]) => cell(x, y)).filter(inside);
    const cavities = rectangularOpenComplements(enclosed).flatMap(([id, box]) => {
      const p = enclosed.find(c => c.component_id === id), at = cell(box.left, box.top);
      return p && p !== patrol && box.width === pitch && box.height === pitch && inside(at) ? [at] : [];
    });
    const front = gaps[0], open = cavities[0];
    if (!front || !open || gaps.length !== 1 || cavities.length !== 1 || equal(front, open)) return [];
    const small = positioned.filter(p => p !== marker).map(p => ({ at: cell(p.bbox.left, p.bbox.top), ink: p.value }));
    const pins = small.filter(p => manhattan(p.at, front) === 1);
    if (pins.length !== 1) return [];
    const pin = pins[0]!, pieces = small.filter(p => p !== pin), colors = new Set([...pieces, pin].map(p => p.ink));
    if (pieces.length !== 2 || colors.size < 2) return [];
    const tile = ([x, y]: NativePoint) => rows[origin[1] + y * pitch]?.[origin[0] + x * pitch];
    const frequency = new Map<number, number>();
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const ink = tile([x, y])!;
      frequency.set(ink, (frequency.get(ink) ?? 0) + 1);
    }
    const floorInk = [...frequency].sort((a, b) => b[1] - a[1])[0]?.[0], paint: Record<string, number> = {};
    for (const { bbox, value, area } of enclosed) {
      const [x, y] = cell(bbox.left, bbox.top), w = bbox.width / pitch, h = bbox.height / pitch;
      if (!colors.has(value) || value === floorInk || !inside([x, y]) || !Number.isInteger(w) || !Number.isInteger(h)
        || Math.min(w, h) !== 1 || Math.max(w, h) < 2 || area !== bbox.width * bbox.height) continue;
      for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) paint[key([x + dx, y + dy])] = value;
    }
    if (!Object.values(paint).includes(pin.ink)) return [];
    const floor = new Set([front, open, ...pieces.map(p => p.at), ...footprint(at, side)].map(key));
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (tile([x, y]) === floorInk || Object.hasOwn(paint, key([x, y]))) floor.add(key([x, y]));
    }
    const board: Board = { origin, pitch, width, height, floor: [...floor], paint, colored: { at: front, ink: pin.ink }, open };
    const rules = [true, false].flatMap(wrap => [true, false].flatMap(reverseAndMove =>
      [false, true].map(reservePreviousMask => ({ wrap, reverseAndMove, reservePreviousMask }))));
    return [{ epoch: observation.level_epoch, board, world: { pieces, patrols: [{ at, direction, side, ink: patrol.value, markerInk: marker.value }] }, rules,
      refs: [observation.observation_ref] }];
  });
  return candidates.length === 1 ? candidates[0]! : null;
}

export function readSingleSlide(rows: NativeRows, observation: NativeObservation, parts: Part[],
  inputs: readonly Direction[], boundaries: readonly SlideBoundary[], interiors: readonly NativeBox[]): JointSlide | null {
  if (observation.available_action_refs.some(input => /^ACTION[56]$/.test(input))) return null;
  const gaps = pairedOpenings(rows, parts);
  if (gaps.length !== 1) return null;
  const [slot] = gaps, pitch = slot![2] - slot![0] + 1;
  const candidates = interiors.flatMap(bounds => {
    const [left, top, right, bottom] = bounds, width = (right - left + 1) / pitch, height = (bottom - top + 1) / pitch;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width * height > 384) return [];
    const cell = (x: number, y: number): NativePoint => [(x - left) / pitch, (y - top) / pitch];
    const inside = ([x, y]: NativePoint) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < width && y < height;
    const front = cell(slot![0], slot![1]);
    if (!inside(front)) return [];
    const enclosed = parts.filter(p => inside(cell(p.bbox.left, p.bbox.top)) && p.bbox.right <= right && p.bbox.bottom <= bottom);
    const tiles = enclosed.filter(p => p.bbox.width === pitch && p.bbox.height === pitch && p.area === pitch ** 2);
    const markers = new Set<Part>();
    const patrols = enclosed.flatMap(p => {
      const side = p.bbox.width / pitch;
      if (side < 3 || side % 2 !== 1 || p.bbox.height !== p.bbox.width || p.area !== (side ** 2 - 1) * pitch ** 2) return [];
      const insideTiles = tiles.filter(tile => owns(p.bbox, [tile.bbox.left, tile.bbox.top]));
      if (insideTiles.length !== 1) return [];
      const marker = insideTiles[0]!, radius = Math.floor(side / 2);
      const at = add(cell(p.bbox.left, p.bbox.top), [radius, radius]), markerAt = cell(marker.bbox.left, marker.bbox.top);
      const direction: NativePoint = [Math.sign(markerAt[0] - at[0]), Math.sign(markerAt[1] - at[1])];
      if (equal(direction, [0, 0])) return [];
      markers.add(marker);
      return [{ at, direction, side, ink: p.value, markerInk: marker.value }];
    });
    const inkAt = ([x, y]: NativePoint) => rows[top + y * pitch]?.[left + x * pitch];
    const floorPart = enclosed.find(p => p.bbox.left === left && p.bbox.top === top && p.bbox.right === right && p.bbox.bottom === bottom);
    if (!floorPart) return [];
    const strips = enclosed.filter(({ bbox, area, value }) => area === bbox.width * bbox.height && value !== floorPart.value
      && Math.min(bbox.width, bbox.height) === pitch && Math.max(bbox.width, bbox.height) >= pitch * 2
      && Math.max(bbox.width, bbox.height) % pitch === 0);
    const pin = tiles.find(p => equal(cell(p.bbox.left, p.bbox.top), front));
    if (!pin || markers.has(pin) || !strips.some(strip => strip.value === pin.value)) return [];
    const actors = tiles.filter(p => p !== pin && !markers.has(p) && p.value !== floorPart.value
      && !enclosed.some(peer => peer.value === p.value && peer.area > p.area));
    if (actors.length !== 1) return [];
    const actor = actors[0]!, piece = { at: cell(actor.bbox.left, actor.bbox.top), ink: actor.value };
    const paint: Record<string, number> = {};
    for (const { value, bbox } of strips.filter(p => p.value === pin.value || p.value === actor.value)) {
      const [x, y] = cell(bbox.left, bbox.top);
      for (let dy = 0; dy < bbox.height / pitch; dy++) for (let dx = 0; dx < bbox.width / pitch; dx++) paint[key([x + dx, y + dy])] = value;
    }
    const floor = new Set([front, piece.at, ...patrols.flatMap(p => footprint(p.at, p.side))].map(key));
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (inkAt([x, y]) === floorPart.value || Object.hasOwn(paint, key([x, y]))) floor.add(key([x, y]));
    }
    const known = boundaries.filter(fact => slideBoundaryMatches(fact, bounds, pitch, pitch));
    const rules = [false, true].flatMap(wrap => [true, false].flatMap(reverseAndMove =>
      [false, true].map(reservePreviousMask => ({ wrap, reverseAndMove, reservePreviousMask }))));
    return [{ epoch: observation.level_epoch, board: { origin: [left, top] as NativePoint, pitch, width, height,
      floor: [...floor], paint, colored: { at: front, ink: pin.value }, knownSeams: known.map(fact => fact.directed_edge_pair_ref) },
      world: { pieces: [piece], patrols }, rules, inputs,
      refs: [observation.observation_ref, ...known.map(fact => fact.claim_ref)] }];
  });
  return candidates.length === 1 ? candidates[0]! : null;
}

export function chooseJointSlide(local: JointSlide, remaining: number, preferContact = true): JointSlideStep | null {
  const { board, world, rules } = local, floor = new Set(board.floor);
  const seated = (p: Piece) => equal(p.at, board.colored.at) && p.ink === board.colored.ink;
  const atGoal = (w: World) => w.pieces.some(seated) && (!board.open || w.pieces.some(p => equal(p.at, board.open!)));

  const advance = (world: World, delta: NativePoint, rule: Rule): SlideProjection | null => {
    const wrap = rule.wrap || board.knownSeams?.includes(`edge_pair:${delta[1]}:${delta[0]}`);
    const patrols = world.patrols.map(old => {
      const permits = (at: NativePoint) => footprint(at, old.side).every(cell => floor.has(key(cell)));
      const candidate = add(old.at, old.direction);
      const reverse: NativePoint = [-old.direction[0], -old.direction[1]], backward = add(old.at, reverse);
      return permits(candidate) ? { ...old, at: candidate }
        : { ...old, at: rule.reverseAndMove && permits(backward) ? backward : old.at, direction: reverse };
    });
    const mask = new Set(patrols.flatMap(p => footprint(p.at, p.side)).map(key));
    if (world.pieces.some(p => mask.has(key(p.at)))) return null;
    if (rule.reservePreviousMask) for (const old of world.patrols) for (const at of footprint(old.at, old.side)) mask.add(key(at));
    const pieces = world.pieces.slice(), seen = pieces.map(p => new Set([key(p.at)])), stopped = pieces.map(() => false);
    let reachedSlot = false, crossedSeam = false;
    for (let phase = 0; phase <= Math.max(board.width, board.height); phase++) {
      let moved = false;
      for (let i = 0; i < pieces.length; i++) {
        if (stopped[i]) continue;
        const piece = pieces[i]!, [x, y] = add(piece.at, delta);
        const at: NativePoint = wrap ? [modulo(x, board.width), modulo(y, board.height)] : [x, y];
        const cell = key(at);
        if (!floor.has(cell) || seen[i]!.has(cell) || pieces.some((other, j) => i !== j && equal(other.at, at))) {
          stopped[i] = true;
          continue;
        }
        if (mask.has(cell)) return null;
        pieces[i] = { at, ink: board.paint[cell] ?? piece.ink };
        crossedSeam ||= x !== at[0] || y !== at[1];
        reachedSlot ||= seated(pieces[i]!);
        seen[i]!.add(cell);
        moved = true;
      }
      if (!moved) break;
    }
    return { next: { pieces, patrols }, crossedSeam, reachedSlot };
  };

  for (const rule of rules) {
    const queue: { world: World; first: (SlideProjection & { input: string }) | null; distance: number }[] =
      [{ world, first: null, distance: 0 }];
    const visited = new Set([JSON.stringify(world)]);
    for (let i = 0; i < queue.length && i < (board.open ? 14_000 : 2_000); i++) {
      const node = queue[i]!;
      if (node.first && atGoal(node.world)) return { ...node.first, rule, distance: node.distance,
        temporarilyVacatesSeat: world.pieces.some(seated) && !node.first.next.pieces.some(seated) };
      if (node.distance >= Math.min(remaining, 64)) continue;
      for (const [input, delta] of local.inputs ?? moves) {
        const prediction = advance(node.world, delta, rule);
        if (!prediction) continue;
        const { next, reachedSlot } = prediction, first = node.first ?? { input, ...prediction };
        if (!board.open && preferContact && reachedSlot) return { ...first, rule, distance: node.distance + 1, temporarilyVacatesSeat: false };
        const stamp = JSON.stringify(next);
        if (visited.has(stamp)) continue;
        visited.add(stamp);
        queue.push({ world: next, first, distance: node.distance + 1 });
      }
    }
  }
  return null;
}

export function observeJointSlide(rows: NativeRows, local: JointSlide, step: JointSlideStep, observation: NativeObservation): JointSlide | null {
  const { board } = local, { patrols, pieces } = step.next;
  const solid = (at: NativePoint, ink: number) => {
    const [l, t, r, b] = slideBox(local, at);
    return rows.slice(t, b + 1).length === board.pitch
      && rows.slice(t, b + 1).every(row => row.slice(l, r + 1).length === board.pitch && row.slice(l, r + 1).every(value => value === ink));
  };
  const leftPreviousCell = ({ at, ink }: Piece) => board.paint[key(at)] === ink || (equal(at, board.colored.at) && ink === board.colored.ink)
    || pieces.some(piece => equal(piece.at, at)) || !solid(at, ink);
  if (!board.open && !local.world.pieces.every(leftPreviousCell)) return null;
  if (!pieces.every(p => solid(p.at, p.ink)) || !patrols.every(patrol => {
    const marker = add(patrol.at, patrol.direction.map(v => v * Math.floor(patrol.side / 2)) as [number, number]);
    return footprint(patrol.at, patrol.side).every(at => solid(at, equal(at, marker) ? patrol.markerInk : patrol.ink));
  })) return null;
  return { ...local, world: step.next, rules: [step.rule], refs: [...local.refs.slice(-5), observation.observation_ref] };
}

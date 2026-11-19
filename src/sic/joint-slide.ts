import { rectangularOpenComplements } from '../logos-engine/v6-cavity-measurements.ts';
import { supportParts } from '../logos-engine/v6-support-measurements.ts';
import type { NativeBox, NativeObservation, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import { pairedOpenings } from './paired-opening.ts';

type Piece = { at: NativePoint; ink: number };
type Patrol = { at: NativePoint; direction: NativePoint };
type World = { pieces: Piece[]; patrol: Patrol };
type Rule = { wrap: boolean; reverseAndMove: boolean; reservePreviousMask: boolean };
type Board = { origin: NativePoint; pitch: number; width: number; height: number; floor: string[]; paint: Record<string, number>;
  colored: Piece; open: NativePoint; markerInk: number; patrolInk: number; patrolSide: number };
export type JointSlide = { epoch: number; board: Board; world: World; rules: Rule[]; refs: string[] };
export type JointSlideStep = { input: string; next: World; rule: Rule; distance: number; temporarilyVacatesSeat: boolean };
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
    const board: Board = { origin, pitch, width, height, floor: [...floor], paint, colored: { at: front, ink: pin.ink },
      open, markerInk: marker.value, patrolInk: patrol.value, patrolSide: side };
    const rules = [true, false].flatMap(wrap => [true, false].flatMap(reverseAndMove =>
      [false, true].map(reservePreviousMask => ({ wrap, reverseAndMove, reservePreviousMask }))));
    return [{ epoch: observation.level_epoch, board, world: { pieces, patrol: { at, direction } }, rules,
      refs: [observation.observation_ref] }];
  });
  return candidates.length === 1 ? candidates[0]! : null;
}

export function chooseJointSlide(local: JointSlide, remaining: number): JointSlideStep | null {
  const { board, world, rules } = local, floor = new Set(board.floor);
  const seated = (p: Piece) => equal(p.at, board.colored.at) && p.ink === board.colored.ink;
  const atGoal = (w: World) => w.pieces.some(seated) && w.pieces.some(p => equal(p.at, board.open));

  const advance = (world: World, delta: NativePoint, rule: Rule): World | null => {
    const old = world.patrol, candidate = add(old.at, old.direction);
    const permitsPatrol = (at: NativePoint) => footprint(at, board.patrolSide).every(cell => floor.has(key(cell)));
    const reverse: NativePoint = [-old.direction[0], -old.direction[1]];
    const backward = add(old.at, reverse);
    const patrol = permitsPatrol(candidate) ? { ...old, at: candidate }
      : { at: rule.reverseAndMove && permitsPatrol(backward) ? backward : old.at, direction: reverse };
    const mask = new Set(footprint(patrol.at, board.patrolSide).map(key));
    if (world.pieces.some(p => mask.has(key(p.at)))) return null;
    if (rule.reservePreviousMask) for (const at of footprint(old.at, board.patrolSide)) mask.add(key(at));
    const pieces = world.pieces.slice(), seen = pieces.map(p => new Set([key(p.at)])), stopped = pieces.map(() => false);
    for (let phase = 0; phase <= Math.max(board.width, board.height); phase++) {
      let moved = false;
      for (let i = 0; i < pieces.length; i++) {
        if (stopped[i]) continue;
        const piece = pieces[i]!, [x, y] = add(piece.at, delta);
        const at: NativePoint = rule.wrap ? [modulo(x, board.width), modulo(y, board.height)] : [x, y];
        const cell = key(at);
        if (!floor.has(cell) || seen[i]!.has(cell) || pieces.some((other, j) => i !== j && equal(other.at, at))) {
          stopped[i] = true;
          continue;
        }
        if (mask.has(cell)) return null;
        pieces[i] = { at, ink: board.paint[cell] ?? piece.ink };
        seen[i]!.add(cell);
        moved = true;
      }
      if (!moved) break;
    }
    return { pieces, patrol };
  };

  for (const rule of rules) {
    const queue: { world: World; first: { input: string; next: World } | null; distance: number }[] =
      [{ world, first: null, distance: 0 }];
    const visited = new Set([JSON.stringify(world)]);
    for (let i = 0; i < queue.length && i < 14_000; i++) {
      const node = queue[i]!;
      if (node.first && atGoal(node.world)) return { ...node.first, rule, distance: node.distance,
        temporarilyVacatesSeat: world.pieces.some(seated) && !node.first.next.pieces.some(seated) };
      if (node.distance >= Math.min(remaining, 64)) continue;
      for (const [input, delta] of moves) {
        const next = advance(node.world, delta, rule);
        if (!next) continue;
        const stamp = JSON.stringify(next);
        if (visited.has(stamp)) continue;
        visited.add(stamp);
        queue.push({ world: next, first: node.first ?? { input, next }, distance: node.distance + 1 });
      }
    }
  }
  return null;
}

export function observeJointSlide(rows: NativeRows, local: JointSlide, step: JointSlideStep, observation: NativeObservation): JointSlide | null {
  const { board } = local, { patrol, pieces } = step.next;
  const marker = add(patrol.at, patrol.direction.map(v => v * Math.floor(board.patrolSide / 2)) as [number, number]);
  const solid = (at: NativePoint, ink: number) => {
    const [l, t, r, b] = slideBox(local, at);
    return rows.slice(t, b + 1).length === board.pitch
      && rows.slice(t, b + 1).every(row => row.slice(l, r + 1).length === board.pitch && row.slice(l, r + 1).every(value => value === ink));
  };
  if (!pieces.every(p => solid(p.at, p.ink))
    || !footprint(patrol.at, board.patrolSide).every(at => solid(at, equal(at, marker) ? board.markerInk : board.patrolInk))) return null;
  return { ...local, world: step.next, rules: [step.rule], refs: [...local.refs.slice(-5), observation.observation_ref] };
}

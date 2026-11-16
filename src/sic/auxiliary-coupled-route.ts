import type { CoupledPair, CoupledPairDelta } from '../logos-engine/v6-coupled-pair-observation.ts';
import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeRows } from '../logos-engine/v6-native-types.ts';

export const auxiliaryDirections: readonly CoupledPairDelta[] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
type Motion = { first: CoupledPairDelta; second: CoupledPairDelta };
type Field = { top: number; left: number; pitch: number; height: number; width: number; floor: boolean[];
  floorColor: number; pairColor: number; auxiliaryColor: number; controls: Motion[] };
type PairCells = readonly [number, number];
type Position = { members: PairCells; auxiliaries: number[]; selected: number | null };
type Step = { position: Position; direction?: number; click?: NativeBox; auxiliary?: number; parking?: number; stoppedMember?: number };
export type AuxiliaryRoute = { epoch: number; field: Field; position: Position; steps: Step[];
  focusPaint: { pair: number; auxiliary: number } | null; evidence: string[]; frame: string; stopped?: boolean;
  initialLeftFirst?: boolean; singleAuxiliary?: boolean };

function cellBox(field: Field, cell: number): NativeBox {
  const left = field.left + cell % field.width * field.pitch;
  const top = field.top + Math.floor(cell / field.width) * field.pitch;
  return [left, top, left + field.pitch - 1, top + field.pitch - 1];
}

function insetBox(field: Field, cell: number): NativeBox {
  const [left, top, right, bottom] = cellBox(field, cell);
  return [left + 1, top + 1, right - 1, bottom - 1];
}

function uniformInk(rows: NativeRows, [left, top, right, bottom]: NativeBox): number | undefined {
  const ink = rows[top]?.[left];
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
    if (rows[y]?.[x] !== ink) return undefined;
  }
  return ink;
}

function stepOnFloor(field: Field, cell: number, [dy, dx]: CoupledPairDelta): number {
  const x = cell % field.width + dx, y = Math.floor(cell / field.width) + dy;
  if (x < 0 || x >= field.width || y < 0 || y >= field.height) return -1;
  const destination = y * field.width + x;
  return field.floor[destination] ? destination : -1;
}

function nextPair(field: Field, [first, second]: PairCells, parked: readonly number[], motion: Motion): PairCells {
  const a = stepOnFloor(field, first, motion.first), b = stepOnFloor(field, second, motion.second);
  return [a < 0 || parked.includes(a) ? first : a, b < 0 || parked.includes(b) ? second : b];
}

function meetingPath(field: Field, start: PairCells, parked: readonly number[]): number[] | null {
  const size = field.floor.length, pack = ([a, b]: PairCells) => a * size + b;
  const initial = pack(start), queue = [initial];
  const parent = new Int32Array(size * size).fill(-2), input = new Uint8Array(size * size);
  parent[initial] = -1;
  for (const node of queue) {
    const first = Math.floor(node / size), second = node % size;
    if (first === second) {
      const path: number[] = [];
      for (let current = node; parent[current]! >= 0; current = parent[current]!) path.push(input[current]!);
      return path.reverse();
    }
    for (const [direction, motion] of field.controls.entries()) {
      const target = pack(nextPair(field, [first, second], parked, motion));
      if (parent[target] !== -2) continue;
      parent[target] = node;
      input[target] = direction;
      queue.push(target);
    }
  }
  return null;
}

type Parking = { auxiliary: number; destination: number; path: number[] };

function parkingOptions(field: Field, position: Position, auxiliary: number): Parking[] {
  const start = position.auxiliaries[auxiliary]!;
  const queue: Parking[] = [{ auxiliary, destination: start, path: [] }], seen = new Set([start]);
  const options: Parking[] = [];
  for (const current of queue) {
    if (current.destination !== start && auxiliaryDirections.filter(delta => stepOnFloor(field, current.destination, delta) >= 0).length === 1) {
      options.push(current);
      if (options.length === 5) break;
    }
    if (current.path.length >= 20) continue;
    for (const [direction, delta] of auxiliaryDirections.entries()) {
      const destination = stepOnFloor(field, current.destination, delta);
      if (destination < 0 || seen.has(destination) || position.auxiliaries.includes(destination) || position.members.includes(destination)) continue;
      seen.add(destination);
      queue.push({ auxiliary, destination, path: [...current.path, direction] });
    }
  }
  return options;
}

function planParking(field: Field, position: Position): Step[] | null {
  let budget = 3500;
  const find = (current: Position, moves: Parking[], cost: number, best: Step[] | null): Step[] | null => {
    if (budget-- <= 0 || (best && cost >= best.length)) return best;
    const route = meetingPath(field, current.members, current.auxiliaries);
    if (route && (!best || cost + route.length < best.length)) {
      let projected = position;
      const steps: Step[] = [];
      for (const { auxiliary, destination, path } of moves) {
        const click = insetBox(field, projected.auxiliaries[auxiliary]!);
        projected = { ...projected, selected: auxiliary };
        steps.push({ position: projected, click, auxiliary, parking: destination });
        for (const direction of path) {
          const places = [...projected.auxiliaries];
          places[auxiliary] = stepOnFloor(field, places[auxiliary]!, auxiliaryDirections[direction]!);
          projected = { ...projected, auxiliaries: places };
          steps.push({ position: projected, direction, auxiliary, parking: destination });
        }
      }
      if (moves.length) {
        projected = { ...projected, selected: null };
        steps.push({ position: projected, click: cellBox(field, projected.members[0]) });
      }
      for (const direction of route) {
        projected = { ...projected, members: nextPair(field, projected.members, projected.auxiliaries, field.controls[direction]!) };
        steps.push({ position: projected, direction });
      }
      best = steps;
    }
    for (const auxiliary of current.auxiliaries.keys()) {
      if (budget <= 0 || moves.some(move => move.auxiliary === auxiliary)) continue;
      for (const option of parkingOptions(field, current, auxiliary)) {
        const auxiliaries = [...current.auxiliaries];
        auxiliaries[auxiliary] = option.destination;
        best = find({ ...current, auxiliaries }, [...moves, option], cost + option.path.length + (moves.length ? 1 : 2), best);
      }
    }
    return best;
  };
  return find(position, [], 0, null);
}

function planWithMovableStop(field: Field, start: Position, remaining: number): Step[] | null {
  type Node = { position: Position; parent: number; step?: Step; depth: number };
  const signature = ({ members, auxiliaries: [block], selected }: Position) => [...members, block, selected ?? -1].join(',');
  const queue: Node[] = [{ position: start, parent: -1, depth: 0 }];
  const seen = new Set([signature(start)]);
  for (let i = 0; i < queue.length; i++) {
    const { position, depth } = queue[i]!;
    const { selected, members, auxiliaries } = position;
    if (members[0] === members[1]) {
      const path: Step[] = [];
      for (let node = queue[i]!; node.step; node = queue[node.parent]!) path.push(node.step);
      return path.reverse();
    }
    if (depth >= remaining) continue;
    const [block] = auxiliaries;
    const add = (step: Step) => {
      const key = signature(step.position);
      if (seen.has(key) || queue.length >= 30_000) return;
      seen.add(key);
      queue.push({ position: step.position, step, parent: i, depth: depth + 1 });
    };
    if (selected === null) {
      for (const [direction, motion] of field.controls.entries()) {
        const next = nextPair(field, members, auxiliaries, motion);
        if (next.every((cell, index) => cell === members[index])) continue;
        const stopped = [motion.first, motion.second].findIndex((delta, index) => stepOnFloor(field, members[index]!, delta) === block);
        add({ position: { ...position, members: next }, direction, ...(stopped >= 0 ? { stoppedMember: stopped } : {}) });
      }
      add({ position: { ...position, selected: 0 }, click: insetBox(field, block!), auxiliary: 0 });
    } else {
      for (const [direction, delta] of auxiliaryDirections.entries()) {
        const destination = stepOnFloor(field, block!, delta);
        if (destination < 0 || members.includes(destination)) continue;
        add({ position: { ...position, auxiliaries: [destination] }, direction, auxiliary: 0 });
      }
      add({ position: { ...position, selected: null }, click: cellBox(field, members[0]) });
    }
  }
  return null;
}

export function measureAuxiliaryRoute(rows: NativeRows, pair: CoupledPair, floors: readonly number[], controls: Motion[],
  epoch: number, frame: string, evidence: string[], knownAuxiliary?: number, remaining = 60): AuxiliaryRoute | null {
  const pitch = pair.size;
  if (pitch < 4 || floors.length !== 1 || floors.includes(pair.value)) return null;
  const [top, left] = [pair.boxes[0]![0] % pitch, pair.boxes[0]![1] % pitch];
  const width = Math.floor((rows[0]!.length - left) / pitch), height = Math.floor((rows.length - top) / pitch);
  if (width * height > 256 || width * height < 4) return null;
  const locate = (x: number, y: number): number => {
    const column = (x - left) / pitch, row = (y - top) / pitch;
    return Number.isInteger(column) && Number.isInteger(row) && column >= 0 && column < width && row >= 0 && row < height ? row * width + column : -1;
  };
  const groups = new Map<number, number[]>();
  const field: Field = { top, left, width, height, pitch, floor: [], floorColor: floors[0]!, pairColor: pair.value, auxiliaryColor: -1, controls };
  const members = [locate(pair.boxes[0]![1], pair.boxes[0]![0]), locate(pair.boxes[1]![1], pair.boxes[1]![0])] as const;
  if (members.includes(-1)) return null;
  for (const { bbox, area, color } of geometricComponents(rows)) {
    if (color === floors[0] || color === pair.value || area !== (pitch - 2) ** 2
      || bbox[2] - bbox[0] !== pitch - 3 || bbox[3] - bbox[1] !== pitch - 3) continue;
    const cell = locate(bbox[0] - 1, bbox[1] - 1);
    if (cell < 0 || members.includes(cell)) continue;
    const [x0, y0, x1, y1] = cellBox(field, cell);
    if ([rows[y0]?.slice(x0, x1 + 1), rows[y1]?.slice(x0, x1 + 1)].some(row => row?.some(ink => ink !== floors[0]))
      || rows.slice(y0, y1 + 1).some(row => row[x0] !== floors[0] || row[x1] !== floors[0])) continue;
    const cells = groups.get(color) ?? [];
    cells.push(cell);
    groups.set(color, cells);
  }
  const candidates = [...groups].filter(([color, cells]) => knownAuxiliary === undefined
    ? cells.length >= 2 && cells.length <= 4 : color === knownAuxiliary && cells.length === 1);
  if (candidates.length !== 1) return null;
  const [auxiliaryColor, auxiliaries] = candidates[0]!;
  field.auxiliaryColor = auxiliaryColor;
  field.floor = Array.from({ length: width * height }, (_, cell) => members.includes(cell)
    || auxiliaries.includes(cell) || uniformInk(rows, cellBox(field, cell)) === floors[0]);
  const position = { members, auxiliaries, selected: null };
  const initialLeftFirst = members[0] % width < members[1] % width;
  if (knownAuxiliary !== undefined) {
    const steps = planWithMovableStop(field, position, remaining);
    return steps?.length ? { epoch, frame, field, position, steps, focusPaint: null, evidence, initialLeftFirst, singleAuxiliary: true } : null;
  }
  const steps = planParking(field, position);
  if (!steps?.[0]?.click) return null;
  return { epoch, frame, field, position, steps, focusPaint: null, evidence, initialLeftFirst };
}

export function auxiliarySubjects({ field, position, steps }: AuxiliaryRoute) {
  const step = steps[0]!;
  const destination = step.parking ?? steps.find(candidate => candidate.position.selected === null)?.position.auxiliaries[0];
  return { members: position.members.map(cell => cellBox(field, cell)),
    nextMembers: step.position.members.map(cell => cellBox(field, cell)),
    ...(step.stoppedMember === undefined ? {} : { blocker: insetBox(field, position.auxiliaries[0]!),
      stoppedMember: cellBox(field, position.members[step.stoppedMember]!) }),
    ...(step.auxiliary === undefined ? {} : { auxiliary: insetBox(field, position.auxiliaries[step.auxiliary]!),
      nextAuxiliary: insetBox(field, step.position.auxiliaries[step.auxiliary]!),
      ...(destination === undefined ? {} : { parking: cellBox(field, destination) }) }) };
}

export function verifyAuxiliaryStep(route: AuxiliaryRoute, before: NativeRows, after: NativeRows): { focusPaint: AuxiliaryRoute['focusPaint'] } | null {
  const { field, position, steps } = route, next = steps[0]!.position;
  const memberBoxes = next.members.map(cell => cellBox(field, cell));
  const auxBoxes = next.auxiliaries.map(cell => insetBox(field, cell));
  let paint = route.focusPaint;
  if (!paint && next.selected !== null) {
    const pair = uniformInk(after, memberBoxes[0]!), auxiliary = uniformInk(after, auxBoxes[next.selected]!);
    if (pair === undefined || auxiliary === undefined || pair === field.pairColor || auxiliary === field.auxiliaryColor || pair === auxiliary) return null;
    paint = { pair, auxiliary };
  }
  if (memberBoxes.some(box => uniformInk(after, box) !== (next.selected === null ? field.pairColor : paint?.pair))
    || auxBoxes.some((box, index) => uniformInk(after, box) !== (index === next.selected ? paint?.auxiliary : field.auxiliaryColor))) return null;
  if (route.singleAuxiliary) {
    const occupied = new Set([...next.members, ...next.auxiliaries]);
    if ([...position.members, ...position.auxiliaries].some(cell => !occupied.has(cell)
      && uniformInk(after, cellBox(field, cell)) !== field.floorColor)) return null;
  }
  const affected = [...memberBoxes, ...auxBoxes, ...position.members.map(cell => cellBox(field, cell)),
    ...position.auxiliaries.map(cell => insetBox(field, cell))];
  for (let y = 1; y < before.length - 1; y++) for (let x = 1; x < before[y]!.length - 1; x++) {
    if (before[y]![x] !== after[y]?.[x] && !affected.some(([l, t, r, b]) => l <= x && x <= r && t <= y && y <= b)) return null;
  }
  return { focusPaint: paint };
}

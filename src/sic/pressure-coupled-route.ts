import { composePlan } from './effect-composer.ts';
import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { CoupledPair } from '../logos-engine/v6-coupled-pair-observation.ts';
import type { NativeBox, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

type Positions = readonly [number, number];
type Motion = readonly [NativePoint, NativePoint];
type Relation = { ink: number; plates: number[]; gates: number[] };
export type PressureField = {
  unit: number; origin: NativePoint; width: number; height: number; floor: number; paint: number;
  terrain: (number | null)[]; relations: Relation[]; gateOf: number[];
};
export type PressureState = {
  epoch: number; field: PressureField; positions: Positions; controls: Record<string, Motion>;
  evidence: string[]; tested: string[]; opened: number[]; closed: number[]; stopped: boolean;
};
export type PressureStep = { command: string; positions: Positions; changes: number[]; gateCrossings: number[] };

const equal = (first: unknown, second: unknown) => JSON.stringify(first) === JSON.stringify(second);
const point = (width: number, cell: number): NativePoint => [cell % width, Math.floor(cell / width)];
const dot = (a: NativePoint, b: NativePoint) => a[0] * b[0] + a[1] * b[1];
const isUnit = ([x, y]: NativePoint) => Math.abs(x) + Math.abs(y) === 1;

export function pressureCellBox(field: Pick<PressureField, 'width' | 'origin' | 'unit'>, cell: number): NativeBox {
  const [x, y] = point(field.width, cell);
  const l = field.origin[0] + x * field.unit, t = field.origin[1] + y * field.unit;
  return [l, t, l + field.unit - 1, t + field.unit - 1];
}

function tileInk(rows: NativeRows, [l, t, r, b]: NativeBox): number | null {
  const ink = rows[t]?.[l];
  if (ink === undefined) return null;
  for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) if (rows[y]?.[x] !== ink) return null;
  return ink;
}

export function measurePressureField(rows: NativeRows, pair: CoupledPair, floor: number): { field: PressureField; positions: Positions } | null {
  const { value: paint, size: unit, boxes } = pair;
  if (paint === floor || boxes.length !== 2) return null;
  const origin: NativePoint = [boxes[0]![1] % unit, boxes[0]![0] % unit];
  const width = Math.floor((rows[0]!.length - origin[0]) / unit), height = Math.floor((rows.length - origin[1]) / unit);
  if (width * height > 576 || width < 3 || height < 3) return null;
  const grid = { unit, origin, width, height };
  const cellAt = (x: number, y: number) => {
    const col = (x - origin[0]) / unit, row = (y - origin[1]) / unit;
    return Number.isInteger(col) && Number.isInteger(row) && col >= 0 && col < width && row >= 0 && row < height ? row * width + col : -1;
  };
  const terrain = Array.from({ length: width * height }, (_, cell) => tileInk(rows, pressureCellBox(grid, cell)));
  const positions = [...boxes].sort((a, b) => a[1] - b[1] || a[0] - b[0]).map(([t, l]) => cellAt(l, t)) as [number, number];
  if (positions.some(cell => cell < 0 || terrain[cell] !== paint)) return null;
  for (const cell of positions) terrain[cell] = floor;
  const colors = new Map<number, Relation>();
  for (const item of geometricComponents(rows)) {
    if (!item.rectangular || [floor, paint].includes(item.color)) continue;
    const [l, t, r, b] = item.bbox, w = (r - l + 1) / unit, h = (b - t + 1) / unit;
    if (!Number.isInteger(w) || !Number.isInteger(h) || Math.min(w, h) !== 1 || Math.max(w, h) > 6) continue;
    const cells = Array.from({ length: w * h }, (_, i) => cellAt(l + i % w * unit, t + Math.floor(i / w) * unit));
    if (cells.some(at => at < 0 || terrain[at] !== item.color)) continue;
    const relation = colors.get(item.color) ?? { ink: item.color, plates: [], gates: [] };
    if (cells.length === 1) relation.plates.push(cells[0]!);
    else relation.gates.push(...cells);
    colors.set(item.color, relation);
  }
  const relations = [...colors.values()].filter(item => item.plates.length && item.gates.length > 1);
  if (relations.length < 2 || relations.length > 6 || terrain.filter(ink => ink === floor).length < 12) return null;
  const gateOf = Array<number>(terrain.length).fill(-1);
  relations.forEach((item, i) => item.gates.forEach(cell => { gateOf[cell] = i; }));
  return { positions, field: { ...grid, floor, paint, terrain, gateOf, relations } };
}

export function pressureOpen(field: PressureField, positions: Positions) {
  return field.relations.map(relation => positions.some(cell => relation.plates.includes(cell)));
}

export function verifyPressureFrame(rows: NativeRows, field: PressureField, positions: Positions,
  stop?: { cell: number; ink: number; memberInk: number }) {
  const open = pressureOpen(field, positions);
  for (let cell = 0; cell < field.terrain.length; cell++) {
    const baseline = field.terrain[cell];
    if (baseline === null) continue;
    const gate = field.gateOf[cell]!;
    const expected = positions.includes(cell) ? stop?.memberInk ?? field.paint : gate >= 0 && open[gate] ? field.floor : baseline;
    const box = pressureCellBox(field, cell);
    if (stop?.cell === cell) {
      const [l, t, r, b] = box;
      if (expected !== field.floor) return false;
      for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) {
        const rim = x === l || y === t || x === r || y === b;
        if (rows[y]?.[x] !== (rim ? field.floor : stop.ink)) return false;
      }
    } else if (tileInk(rows, box) !== expected) return false;
  }
  return true;
}

export function pressureDestination(field: PressureField, from: number, [dx, dy]: NativePoint) {
  const [x, y] = point(field.width, from), next: NativePoint = [x + dx, y + dy];
  return next[0] >= 0 && next[1] >= 0 && next[0] < field.width && next[1] < field.height
    ? next[1] * field.width + next[0] : -1;
}

export function projectPressureControl(field: PressureField, positions: Positions, command: string, motion: Motion,
  stopCell?: number): PressureStep | null {
  const open = pressureOpen(field, positions);
  const canEnter = (cell: number) => cell >= 0 && (field.terrain[cell] === field.floor
    || field.relations.some(({ plates }) => plates.includes(cell)) || open[field.gateOf[cell]!] === true);
  const next = positions.map((cell, i) => {
    const to = pressureDestination(field, cell, motion[i]!);
    return to !== stopCell && canEnter(to) ? to : cell;
  }) as [number, number];
  const after = pressureOpen(field, next);
  // A projected traversal holds its gate through the entire command.
  if (next.some(cell => field.gateOf[cell]! >= 0 && !after[field.gateOf[cell]!])) return null;
  const changes = open.flatMap((value, i) => value !== after[i] ? [i] : []);
  const gateCrossings = next.flatMap((cell, i) => cell !== positions[i] && field.gateOf[cell]! >= 0 ? [field.gateOf[cell]!] : []);
  return { command, positions: next, changes, gateCrossings };
}

export function readPressureResponse(rows: NativeRows, field: PressureField, previous: Positions) {
  const actors = field.terrain.flatMap((_, cell) => tileInk(rows, pressureCellBox(field, cell)) === field.paint ? [cell] : []);
  if (actors.length !== 2) return null;
  const options = [actors, [...actors].reverse()].flatMap(pair => {
    const positions = pair as [number, number];
    const vectors = previous.map((cell, i) => {
      const [x, y] = point(field.width, cell), [u, v] = point(field.width, positions[i]!);
      return [u - x, v - y] as NativePoint;
    }) as [NativePoint, NativePoint];
    const cost = vectors.reduce((sum, vector) => sum + dot(vector, vector), 0);
    return vectors.some(vector => dot(vector, vector) > 1) || !verifyPressureFrame(rows, field, positions)
      ? [] : [{ positions, vectors, cost }];
  }).sort((a, b) => a.cost - b.cost);
  return options.length && options[0]!.cost !== options[1]?.cost ? options[0]! : null;
}

export function confirmedPressureControl(field: PressureField, before: Positions, observed: NonNullable<ReturnType<typeof readPressureResponse>>,
  command: string, controls: Readonly<Record<string, Motion>>): Motion | null {
  if (observed.vectors.every(isUnit)) return observed.vectors;
  // If one member is stopped, test the inverse of already measured joint
  // effects against both positions and the simultaneously observed gates.
  const inverse = Object.values(controls).map(vectors => [
    [-vectors[0][0], -vectors[0][1]], [-vectors[1][0], -vectors[1][1]],
  ] as Motion).filter(vectors => vectors.some((vector, i) => isUnit(observed.vectors[i]!) && equal(vector, observed.vectors[i]))
    && equal(projectPressureControl(field, before, command, vectors)?.positions, observed.positions));
  return inverse.length === 1 ? inverse[0]! : null;
}

export function planPressureRoute(state: PressureState, available: readonly string[], limit: number, interrupted: () => boolean = () => false) {
  const { field, controls } = state, span = field.terrain.length;
  const identity = ([a, b]: Positions) => a * span + b;
  const controlsByInput = available.flatMap(key => controls[key] ? [[key, controls[key]!] as const] : []);
  return composePlan<Positions, PressureStep>({
    domain: 'simultaneous-motion-and-pressure',
    initial: state.positions, key: identity, interrupted,
    goal: { relation: 'coincidence of the two roles', holds: ([first, second]) => first === second },
    budget: { commands: limit, states: span * span },
    *choices(positions) {
      for (const [command, motion] of controlsByInput) {
        const step = projectPressureControl(field, positions, command, motion);
        if (!step) continue;
        yield { action: step, after: step.positions, evidence: state.evidence,
          maintains: step.gateCrossings.map(index => ({
            relation: 'pressure maintained during the crossing',
            holds: candidate => pressureOpen(field, candidate)[index] === true,
          })) };
      }
    },
  })?.effects.map(result => result.action) ?? [];
}

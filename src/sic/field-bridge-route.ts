import type { NativeCommand, NativePoint } from '../logos-engine/v6-native-types.ts';
import { findCompositionFrontier } from './composition-frontier.ts';

type Cell = string;
export type BridgePose = { actor: Cell; bodies: Cell[]; supports: Cell[]; hazards: Cell[] };
export type BridgeChart = {
  pose: BridgePose; floor: Set<Cell>; water: Set<Cell>; marks: Cell[]; groups: Cell[][];
  held: Set<Cell>; exit: Cell; radius: number; pitch: number;
};

const directions: NativePoint[] = [[0, -1], [0, 1], [-1, 0], [1, 0]];
const coordinates = (cell: Cell) => cell.split(',').map(Number) as [number, number];
const distance = (left: Cell, right: Cell) => {
  const [x, y] = coordinates(left), [u, v] = coordinates(right);
  return Math.abs(x - u) + Math.abs(y - v);
};
const shift = (cell: Cell, [dx, dy]: NativePoint, pitch: number) => {
  const [x, y] = coordinates(cell);
  return `${x + dx * pitch},${y + dy * pitch}`;
};

export function projectBridge(chart: BridgeChart, pose: BridgePose, direction: NativePoint,
  conversions?: { weights: boolean; hazards: boolean }): BridgePose | undefined {
  const toward = (cell: Cell) => shift(cell, direction, chart.pitch), actor = toward(pose.actor);
  const ground = (cell: Cell) => chart.floor.has(cell) || pose.supports.includes(cell);
  if (!ground(actor)) return;
  const origin = coordinates(pose.actor);
  const inScope = (cell: Cell) => coordinates(cell).every((value, index) => Math.abs(value - origin[index]!) <= chart.radius);
  const resolve = (occupants: Cell[], displacing: Set<Cell>) => {
    let blocked: Cell[];
    do {
      blocked = [...displacing].filter(cell => occupants.includes(toward(cell)) && !displacing.has(toward(cell)));
      blocked.forEach(cell => displacing.delete(cell));
    } while (blocked.length);
    return displacing;
  };
  const subjects = [...pose.bodies, ...pose.hazards];
  const entersWater = (cell: Cell) => inScope(cell) && chart.water.has(toward(cell)) && !ground(toward(cell));
  if (!conversions?.weights && pose.bodies.some(entersWater)) return;
  const converts = (cell: Cell) => chart.water.has(toward(cell))
    && (pose.bodies.includes(cell) ? conversions?.weights : conversions?.hazards);
  const movers = resolve([pose.actor, ...subjects], new Set([pose.actor, ...subjects.filter(cell =>
    inScope(cell) && (ground(toward(cell)) || converts(cell)))]));
  if (!movers.has(pose.actor)) return;
  const land = (cell: Cell) => movers.has(cell) ? toward(cell) : cell;
  const shifts = resolve(pose.supports, new Set(pose.supports.filter(cell =>
    cell !== pose.actor && cell !== actor && inScope(cell) && chart.water.has(toward(cell)))));
  const supports = pose.supports.map(cell => shifts.has(cell) ? toward(cell) : cell);
  const bodies = pose.bodies.map(land);
  if (conversions) for (const cell of [...bodies]) {
    if (chart.floor.has(cell) || supports.includes(cell)) continue;
    if (!conversions.weights || !chart.water.has(cell)) return;
    supports.push(cell);
    bodies.splice(bodies.indexOf(cell), 1);
  }
  const hazards = pose.hazards.map(land).filter(cell => !conversions?.hazards || chart.floor.has(cell) || supports.includes(cell));
  if (hazards.some(cell => distance(actor, cell) <= chart.pitch)) return;
  return { actor, bodies, hazards, supports };
}

export function findBridgeRoute(chart: BridgeChart, moves: readonly { action: NativeCommand; delta: NativePoint }[],
  remaining: number, tested: readonly string[]) {
  const start = chart.pose, adjacent = (cell: Cell) => directions.map(delta => shift(cell, delta, chart.pitch));
  const region = (seed: Cell, surface: Set<Cell>) => {
    const queue = [seed], reached = new Set(queue);
    for (const cell of queue) for (const next of adjacent(cell)) if (surface.has(next) && !reached.has(next)) {
      reached.add(next); queue.push(next);
    }
    return reached;
  };
  const home = region(start.actor, chart.floor);
  const homeDistance = Math.min(...[...home].map(cell => distance(cell, chart.exit)));
  const destinations = new Set<Cell>();
  for (const support of start.supports) {
    const water = region(support, chart.water);
    const shores = [...new Set([...water].flatMap(cell => adjacent(cell).filter(next => chart.floor.has(next))))];
    if (!water.has(start.actor) && !shores.some(cell => home.has(cell))) continue;
    for (const shore of shores) {
      if (home.has(shore) || destinations.has(shore)) continue;
      const land = region(shore, chart.floor);
      if ([...land].some(cell => distance(cell, chart.exit) < homeDistance)) land.forEach(cell => destinations.add(cell));
    }
  }
  if (home.has(chart.exit)) destinations.add(chart.exit);
  const occupied = (mark: Cell, pose: BridgePose) => pose.actor === mark || pose.bodies.includes(mark) || chart.held.has(mark);
  const occupiedWeight = start.bodies.filter(cell => chart.marks.includes(cell));
  const route = (goal: (pose: BridgePose) => boolean, limit: number, preserve: boolean) => findCompositionFrontier({
    start, depth: remaining, limit,
    key: pose => [pose.actor, [...pose.bodies].sort().join(';'), [...pose.supports].sort().join(';'), [...pose.hazards].sort().join(';')].join('|'),
    successors: pose => moves.flatMap(({ action, delta }) => {
      const after = projectBridge(chart, pose, delta);
      return after && (!preserve || occupiedWeight.every(cell => after.bodies.includes(cell))) ? [{ action, after }] : [];
    }),
    isComposition: (_, pose) => goal(pose),
  });
  if (destinations.size) {
    const crossing = route(pose => destinations.has(pose.actor), 65_000, true);
    if (crossing) return { steps: crossing, key: 'cross_on_support', probe: false };
  }
  const groups = chart.groups.filter(group => group.every(cell => home.has(cell)) && !group.every(cell => occupied(cell, start)));
  const candidates = [...groups, ...chart.marks.filter(cell => home.has(cell) && !occupied(cell, start)
    && !chart.groups.some(group => group.includes(cell))).map(cell => [cell])];
  for (const group of candidates) {
    const key = 'test_bridge_control:' + group.join(';');
    if (tested.includes(key)) continue;
    const trial = route(pose => group.every(cell => occupied(cell, pose)), 36_000, false);
    if (trial) return { steps: trial, key, probe: true };
  }
}

import type { NativeCommand, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import { readTravelGrid, type ObservedTravel } from './observed-travel-frontier.ts';
import type { CoverageTransfer } from './observed-coverage.ts';
import { maximumCommittedActions } from './plan-step.ts';

type Cell = string;
type Gate = { at: Cell; rim: number; accent: number; back: number; delta: NativePoint; marks: Cell[]; closesOnContact: boolean };
type Pose = { actor: Cell; bodies: Cell[]; closed: boolean[] };
type Field = { floor: Cell[]; fixed: Record<Cell, string>; marks: Record<Cell, string>; gates: Gate[]; goal: Cell; goalPixels: string };
type Step = { action: NativeCommand; after: Pose };
export type PullKnowledge = { grid: ObservedTravel['grid']; moves: ObservedTravel['moves']; actorInkCount: number; body: string; ref: string };
export type PullCircuitBinding = { field: Field; pose: Pose };
export type PullCircuitPlan = { start: Pose; field: Field; steps: Step[]; roles: PullKnowledge; evidence: string[] };

const stamp = (pixels: readonly number[]) => pixels.join(',');
const offset = (cell: Cell, [dx, dy]: NativePoint, sign = 1) => {
  const [x, y] = cell.split(',').map(Number) as [number, number];
  return `${x + dx * sign},${y + dy * sign}`;
};

function readField(roles: PullKnowledge, route: CoverageTransfer, rows: NativeRows): PullCircuitBinding | undefined {
  const { grid } = roles;
  if (grid.pitch !== 3 || roles.actorInkCount < 2) return;
  const { cells, pieces } = readTravelGrid(rows, grid);
  if (pieces.length !== 1) return;
  const actor = pieces[0]!;
  const floor: Cell[] = [], bodies: Cell[] = [], goals: Cell[] = [];
  const fixed: Record<Cell, string> = {}, marks: Record<Cell, string> = {};
  const marked = new Map<number, Cell[]>();
  const shutters: { at: Cell; rim: number; accent: number; back: number; closed: boolean }[] = [];
  const arms = [1, 3, 5, 7];
  for (const [at, pixels] of cells) {
    const pattern = stamp(pixels), [rim] = pixels;
    if (at === actor || pattern === roles.body || pattern === route.exitPattern || pixels.every(ink => ink === grid.floor)) {
      floor.push(at);
      if (pattern === roles.body) bodies.push(at);
      if (pattern === route.exitPattern) goals.push(at);
      continue;
    }
    const corners = [0, 2, 6, 8].map(i => pixels[i]);
    if (corners.every(ink => ink === grid.floor) && pixels[1] !== grid.floor && arms.every(i => pixels[i] === pixels[1])) {
      const accent = pixels[4]!;
      marks[at] = pattern;
      marked.set(accent, [...marked.get(accent) ?? [], at]);
    } else if (rim !== undefined && rim !== grid.floor && corners.every(ink => ink === rim) && pixels[4] !== rim) {
      const accent = arms.map(i => pixels[i]!).find(ink => ink !== rim && ink !== grid.floor
        && arms.filter(i => pixels[i] === ink).length === 3);
      const back = arms.find(i => pixels[i] !== accent);
      const closed = pixels[4] !== grid.floor;
      if (accent === undefined || back === undefined || pixels[back] !== (closed ? rim : grid.floor)) return;
      shutters.push({ at, rim, accent, back, closed });
    } else {
      if (pixels.some(ink => ink !== rim)) return;
      fixed[at] = pattern;
    }
  }
  if (goals.length !== 1 || !bodies.length || !shutters.length || marked.size !== shutters.length
    || new Set(shutters.map(gate => gate.accent)).size !== shutters.length) return;
  const gates: Gate[] = [];
  for (const { at, rim, accent, back, closed } of shutters) {
    const controls = marked.get(accent);
    if (!controls?.length || controls.includes(at)) return;
    const delta: NativePoint = [(1 - back % 3) * grid.pitch, (1 - Math.floor(back / 3)) * grid.pitch];
    // Treat the exposed sensors as idle and check this hypothesis against the next visible returns.
    gates.push({ at, rim, accent, back, delta, marks: controls, closesOnContact: !closed });
  }
  return { field: { floor: [...floor, ...Object.keys(marks), ...gates.map(gate => gate.at)], fixed, marks, gates, goal: goals[0]!, goalPixels: route.exitPattern },
    pose: { actor, bodies: bodies.sort(), closed: shutters.map(gate => gate.closed) } };
}

const occupied = (pose: Pose, cell: Cell) => pose.actor === cell || pose.bodies.includes(cell);

function findRoute(field: Field, start: Pose, moves: readonly { action: NativeCommand; delta: NativePoint }[], remaining: number) {
  const floor = new Set(field.floor);
  const gateIndex = new Map(field.gates.map((gate, index) => [gate.at, index]));
  const allows = (pose: Pose, cell: Cell) => floor.has(cell) && !pose.closed[gateIndex.get(cell) ?? -1];
  const neighbors = new Map(field.floor.map(cell => [cell, moves.flatMap(({ action, delta }) => {
    const at = offset(cell, delta);
    return floor.has(at) ? [{ action, at, rear: offset(cell, delta, -1) }] : [];
  })]));
  type Node = { pose: Pose; distance: number; previous?: Node; action?: NativeCommand };
  const queue: Node[] = [{ pose: start, distance: 0 }];
  const seen = new Set([JSON.stringify(start)]);
  for (let index = 0; index < queue.length && index < 70_000; index++) {
    const current = queue[index]!, { pose, distance } = current;
    if (pose.actor === field.goal) {
      const route: Step[] = [];
      for (let node: Node | undefined = current; node?.action; node = node.previous) route.push({ action: node.action, after: node.pose });
      return route.reverse();
    }
    if (distance >= remaining) continue;
    for (const { action, at, rear } of neighbors.get(pose.actor) ?? []) {
      if (!allows(pose, at) || pose.bodies.includes(at)) continue;
      const after: Pose = { actor: at, bodies: pose.bodies.map(body => body === rear ? pose.actor : body), closed: pose.closed };
      if (!settle(field, after, cell => allows(after, cell))) continue;
      after.bodies.sort();
      const key = JSON.stringify(after);
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ pose: after, distance: distance + 1, previous: current, action });
    }
  }
}

function settle(field: Field, pose: Pose, allows: (cell: Cell) => boolean) {
  // A closure can move its occupant and thereby change which sensors are held.
  for (let wave = 0; wave <= field.gates.length; wave++) {
    const previous = pose.closed;
    const desired = field.gates.map(gate => gate.marks.every(mark => occupied(pose, mark)) === gate.closesOnContact);
    if (desired.every((closed, index) => closed === previous[index])) return true;
    pose.closed = desired;
    for (const [index, gate] of field.gates.entries()) {
      if (!desired[index] || previous[index] || !occupied(pose, gate.at)) continue;
      const shifted = new Set<Cell>();
      let cell = gate.at;
      while (occupied(pose, cell)) {
        shifted.add(cell);
        cell = offset(cell, gate.delta);
        if (!allows(cell)) return false;
      }
      if (shifted.has(pose.actor)) pose.actor = offset(pose.actor, gate.delta);
      pose.bodies = pose.bodies.map(body => shifted.has(body) ? offset(body, gate.delta) : body);
    }
  }
  return false;
}

export function matchesPullCircuit(roles: PullKnowledge, field: Field, pose: Pose, rows: NativeRows): boolean {
  const { grid } = roles, { cells } = readTravelGrid(rows, grid);
  const body = roles.body.split(',').map(Number), floor = new Set(field.floor);
  const gates = new Map(field.gates.map((gate, index) => [gate.at, { gate, closed: pose.closed[index] }]));
  for (const [cell, pixels] of cells) {
    if (!floor.has(cell)) {
      if (stamp(pixels) !== field.fixed[cell]) return false;
      continue;
    }
    const overlay = gates.get(cell), hasBody = pose.bodies.includes(cell), isOccupied = occupied(pose, cell);
    if (overlay) {
      const { gate, closed } = overlay;
      if (closed && isOccupied) return false;
      if (!hasBody && [0, 2, 6, 8].some(i => pixels[i] !== gate.rim)) return false;
      if (!isOccupied) {
        const backInk = closed ? gate.rim : grid.floor;
        if ([1, 3, 5, 7].some(i => pixels[i] !== (i === gate.back ? backInk : gate.accent))) return false;
        if ((pixels[4] === grid.floor) === closed) return false;
      }
    }
    if (cell === pose.actor) {
      if (pixels[4] !== grid.ink || pixels.filter(ink => ink === grid.ink).length !== roles.actorInkCount) return false;
    } else if (hasBody) {
      if (pixels[4] !== body[4] || pixels.filter((ink, index) => ink === body[index]).length * 2 <= body.length) return false;
    } else if (field.marks[cell]) {
      if (stamp(pixels) !== field.marks[cell]) return false;
    } else if (cell === field.goal) {
      if (stamp(pixels) !== field.goalPixels) return false;
    } else if (!overlay && pixels.some(ink => ink !== grid.floor)) return false;
  }
  return true;
}

export function planPullCircuit(roles: PullKnowledge, transfer: CoverageTransfer, rows: NativeRows, inputs: readonly NativeCommand[],
  remaining: number, binding?: PullCircuitBinding): PullCircuitPlan | undefined {
  if (transfer.motion !== 'pull' || inputs.length !== 4 || Object.keys(roles.moves).length !== inputs.length) return;
  const scene = binding ?? readField(roles, transfer, rows);
  if (!scene || !matchesPullCircuit(roles, scene.field, scene.pose, rows)) return;
  const moves = inputs.flatMap(action => roles.moves[action.action_ref] ? [{ action, delta: roles.moves[action.action_ref]!.delta }] : []);
  if (moves.length !== inputs.length) return;
  const path = findRoute(scene.field, scene.pose, moves, remaining);
  if (!path?.length) return;
  const change = path.findIndex(step => step.after.closed.some((closed, index) => closed !== scene.pose.closed[index]));
  const steps = path.slice(0, Math.min(maximumCommittedActions, change < 0 ? path.length : change + 1));
  return { start: scene.pose, field: scene.field, steps, roles, evidence: [transfer.ref, roles.ref, ...Object.values(roles.moves).map(move => move.ref)] };
}

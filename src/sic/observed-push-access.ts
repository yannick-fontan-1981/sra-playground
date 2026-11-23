import type { NativeBox, NativeCommand, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import { observedPushBody, type CoverageTransfer } from './observed-coverage.ts';
import { readTravelCell, readTravelGrid, type ObservedTravel } from './observed-travel-frontier.ts';
import { maximumCommittedActions } from './plan-step.ts';

type Cell = string;
type Move = { command: NativeCommand; delta: NativePoint };
type Pose = { actor: Cell; bodies: Cell[] };
type Step = { command: NativeCommand; after: Pose; pushed: boolean };
type GateProof = { passage: Cell; blockedBy: NativeCommand; stance: Cell };

export type PushAccessKnowledge = {
  wall?: { ink: number; ref: string };
  push?: { body: string; chain: boolean; ref: string };
  contradicted?: true;
};

export type PushAccessPlan = {
  start: Pose;
  steps: Step[];
  goal: Cell;
  template: string;
  ground: Cell[];
  evidence: string[];
  blocked?: GateProof;
};

const point = (cell: Cell) => cell.split(',').map(Number) as [number, number];
const plus = (cell: Cell, [dx, dy]: NativePoint): Cell => {
  const [x, y] = point(cell);
  return `${x + dx},${y + dy}`;
};
const stamp = (pixels: readonly number[]) => pixels.join(',');

export function pushAccessBox(cell: Cell, pitch: number): NativeBox {
  const [x, y] = point(cell);
  return [x, y, x + pitch - 1, y + pitch - 1];
}

export function observePushAccess(previous: PushAccessKnowledge | undefined, travel: ObservedTravel | undefined,
  returned: ObservedTravel | undefined, before: NativeRows, after: NativeRows, command: NativeCommand, ref: string) {
  if (!travel?.actor || !returned?.actor || travel.grid.ink !== returned.grid.ink || previous?.contradicted) return previous;
  const move = returned.moves[command.action_ref];
  if (!move) return previous;
  const target = plus(travel.actor, move.delta);
  let next = previous;
  if (!previous?.wall && travel.actor === returned.actor) {
    const pixels = readTravelCell(before, travel.grid, point(target));
    const ink = pixels[0];
    if (ink !== undefined && ink !== travel.grid.floor && pixels.every(value => value === ink)
      && stamp(readTravelCell(after, travel.grid, point(target))) === stamp(pixels)) {
      next = { ...next, wall: { ink, ref } };
    }
  }
  if ((!next?.push || !next.push.chain) && returned.actor === target) {
    const pushed = observedPushBody(next?.push?.body, travel, move.delta, before, after);
    if (pushed) next = { ...next, push: { ...pushed, ref } };
  }
  return next;
}

function readScene(knowledge: PushAccessKnowledge, travel: ObservedTravel, rows: NativeRows,
  template: string, goal?: Cell) {
  const { cells, pieces } = readTravelGrid(rows, travel.grid);
  const actor = pieces.length === 1 ? pieces[0] : undefined;
  if (!actor || !knowledge.push || !knowledge.wall) return;
  if (!goal) {
    const matches = [...cells].filter(([, pixels]) => stamp(pixels) === template);
    if (matches.length !== 1) return;
    goal = matches[0]![0];
  }
  const goalPixels = template.split(',').map(Number), bodyPixels = knowledge.push.body.split(',').map(Number);
  const floor = travel.grid.floor, ground: Cell[] = [], bodies: Cell[] = [];
  for (const [cell, pixels] of cells) {
    const signature = stamp(pixels);
    const coveredGoal = cell === goal && pixels.filter((ink, i) => ink === bodyPixels[i]).length * 2 > pixels.length
      && pixels.every((ink, i) => ink === bodyPixels[i] || (goalPixels[i] !== floor && ink === goalPixels[i]));
    if (signature === knowledge.push.body || coveredGoal) bodies.push(cell);
    else if (!(cell === actor || cell === goal && signature === template || pixels.every(value => value === floor))) {
      // Keep this model conditional on a fully classified, static floor and wall layout.
      if (pixels.every(value => value === knowledge.wall!.ink)) continue;
      return;
    }
    ground.push(cell);
  }
  if (!ground.includes(goal) || !bodies.length) return;
  return { pose: { actor, bodies: bodies.sort() }, goal, ground: ground.sort() };
}

type Graph = ReadonlyMap<Cell, readonly { command: NativeCommand; cell: Cell; delta: NativePoint }[]>;
type Walk = { previous?: Cell; command?: NativeCommand };

function reachable(graph: Graph, origin: Cell, blocked: ReadonlySet<Cell>): Map<Cell, Walk> {
  const visited = new Map<Cell, Walk>([[origin, {}]]);
  for (const [from] of visited) for (const edge of graph.get(from) ?? []) {
    if (!blocked.has(edge.cell) && !visited.has(edge.cell)) visited.set(edge.cell, { previous: from, command: edge.command });
  }
  return visited;
}

function approach(cells: ReadonlyMap<Cell, Walk>, pose: Pose, target: Cell): Step[] {
  const result: Step[] = [];
  for (let actor = target; cells.get(actor)?.previous !== undefined;) {
    const { previous, command } = cells.get(actor)!;
    result.push({ command: command!, after: { ...pose, actor }, pushed: false });
    actor = previous!;
  }
  return result.reverse();
}

function pushes(graph: Graph, positions: ReadonlyMap<Cell, Walk>, bodies: ReadonlySet<Cell>, chain: boolean) {
  const result: { stance: Cell; landing: Cell; step: Step }[] = [];
  for (const [stance] of positions) for (const edge of graph.get(stance) ?? []) {
    if (!bodies.has(edge.cell)) continue;
    let landing = plus(edge.cell, edge.delta);
    if (chain) while (bodies.has(landing)) landing = plus(landing, edge.delta);
    if (bodies.has(landing) || !graph.has(landing)) continue;
    const displaced = [...bodies].filter(cell => cell !== edge.cell).concat(landing).sort();
    result.push({ stance, landing, step: { command: edge.command, after: { actor: edge.cell, bodies: displaced }, pushed: true } });
  }
  return result;
}

function search(graph: Graph, start: Pose, goal: Cell, chain: boolean, limit: number, actionLimit: number) {
  const distance = new Map<Cell, number>([[goal, 0]]);
  for (const [cell, depth] of distance) for (const edge of graph.get(cell) ?? []) {
    if (!distance.has(edge.cell)) distance.set(edge.cell, depth + 1);
  }
  type Candidate = { pose: Pose; route: Step[] };
  const queue = new Map<number, Candidate[]>();
  function enqueue(pose: Pose, route: Step[]) {
    const estimate = distance.get(pose.actor);
    if (estimate === undefined || route.length + estimate > actionLimit) return;
    const rank = route.length + 3 * estimate;
    const bucket = queue.get(rank);
    if (bucket) bucket.push({ pose, route });
    else queue.set(rank, [{ pose, route }]);
  }
  enqueue(start, []);
  const best = new Map<string, number>();
  while (queue.size) {
    const rank = Math.min(...queue.keys()), bucket = queue.get(rank)!;
    const { pose, route } = bucket.shift()!;
    if (!bucket.length) queue.delete(rank);
    const bodies = new Set(pose.bodies);
    const positions = reachable(graph, pose.actor, bodies);
    const origin = actionLimit === Infinity ? [...positions.keys()].sort()[0] : pose.actor;
    const key = `${pose.bodies.join(';')}|${origin}`;
    if ((best.get(key) ?? Infinity) <= route.length) continue;
    if (best.size >= limit) return { exhausted: false };
    best.set(key, actionLimit === Infinity ? 0 : route.length);
    if (positions.has(goal)) {
      const complete = route.concat(approach(positions, pose, goal));
      if (complete.length <= actionLimit) return { exhausted: false, route: complete };
    }
    for (const { stance, step } of pushes(graph, positions, bodies, chain)) {
      const suffix = approach(positions, pose, stance);
      enqueue(step.after, route.concat(suffix, step));
    }
  }
  return { exhausted: true };
}

export function choosePushAccess(knowledge: PushAccessKnowledge | undefined, transfer: CoverageTransfer | undefined,
  travel: ObservedTravel | undefined, rows: NativeRows, inputs: readonly NativeCommand[], remaining: number,
  target?: Cell): PushAccessPlan | undefined {
  if (!knowledge?.push || !knowledge.wall || knowledge.contradicted || !travel || transfer?.motion !== 'push' || inputs.length !== 4) return;
  const moves = inputs.flatMap(command => {
    const measured = travel.moves[command.action_ref];
    return measured ? [{ command, delta: measured.delta }] : [];
  });
  if (moves.length !== 4 || new Set(moves.map(move => move.delta.join(','))).size !== 4) return;
  const scene = readScene(knowledge, travel, rows, transfer.exitPattern, target);
  if (!scene) return;
  const { pose, ground, goal } = scene;
  const floor = new Set(ground);
  const graph: Graph = new Map(ground.map(cell => [cell, moves.flatMap(({ command, delta }: Move) => {
    const neighbor = plus(cell, delta);
    return floor.has(neighbor) ? [{ command, cell: neighbor, delta }] : [];
  })]));
  // The far side of a narrow passage must remain attainable even if its occupancy changes.
  const bodySet = new Set(pose.bodies), positions = reachable(graph, pose.actor, bodySet);
  const route = search(graph, pose, goal, knowledge.push.chain, 3000, remaining).route;
  if (!route?.length) return;
  let blocked: GateProof | undefined;
  for (const { stance, landing, step } of pushes(graph, positions, bodySet, knowledge.push.chain)) {
    if (landing === goal || (graph.get(landing)?.length ?? 0) !== 2
      || reachable(graph, pose.actor, new Set([landing])).has(goal)) continue;
    const recovery = search(graph, step.after, goal, knowledge.push.chain, 64, Infinity);
    if (!recovery.exhausted) continue;
    blocked = { passage: landing, blockedBy: step.command, stance };
    break;
  }
  const firstPush = route.findIndex(step => step.pushed);
  let end = firstPush < 0 ? route.length : firstPush + 1;
  while (route[end]?.pushed && route[end]!.command.action_ref === route[firstPush]?.command.action_ref) end++;
  const steps = route.slice(0, Math.min(end, remaining, maximumCommittedActions));
  return { start: pose, steps, goal, template: transfer.exitPattern, ground, ...(blocked ? { blocked } : {}),
    evidence: [transfer.ref, knowledge.push.ref, knowledge.wall.ref, ...moves.map(move => travel.moves[move.command.action_ref]!.ref)] };
}

export function matchesPushAccess(knowledge: PushAccessKnowledge, travel: ObservedTravel, rows: NativeRows, plan: PushAccessPlan, expected: Pose) {
  const scene = readScene(knowledge, travel, rows, plan.template, plan.goal);
  return scene?.pose.actor === expected.actor && scene.pose.bodies.join(';') === expected.bodies.join(';')
    && scene.ground.join(';') === plan.ground.join(';');
}

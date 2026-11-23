import type { NativeBox, NativeCommand, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import { observedPushBody, observedPushGate, type CoverageLearning, type CoverageTransfer } from './observed-coverage.ts';
import { readTravelCell, readTravelGrid, rebindTravelControls, type ObservedTravel } from './observed-travel-frontier.ts';
import { maximumCommittedActions } from './plan-step.ts';

type Cell = string;
type Move = { command: NativeCommand; delta: NativePoint };
type Pose = { actor: Cell; bodies: Cell[]; supports: Cell[] };
type Step = { command: NativeCommand; after: Pose; pushed: boolean };
type GateProof = { passage: Cell; blockedBy: NativeCommand; stance: Cell };
type Field = { goal: Cell; ground: Cell[]; water: Cell[]; marks: Cell[]; gates: Cell[] };
export type PushAccessBinding = { field: Field; supports: Cell[] };

export type PushAccessKnowledge = {
  wall?: { ink: number; ref: string };
  push?: { body: string; chain: boolean; ref: string };
  conversion?: { water: string; support: string; ref: string; crossingRef?: string };
  supportSites?: Cell[];
  pressure?: { mark: string; closed: string; open: string; ref: string };
  contradicted?: true;
};

export type PushAccessMemory = {
  controls: Pick<ObservedTravel, 'grid' | 'moves'>;
  roles: PushAccessKnowledge;
};

export type PushAccessPlan = {
  start: Pose;
  steps: Step[];
  goal: Cell;
  template: string;
  field: Field;
  evidence: string[];
  plannedSupport?: Cell;
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
  returned: ObservedTravel | undefined, before: NativeRows, after: NativeRows, command: NativeCommand, ref: string,
  coverage?: CoverageLearning) {
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
  const conversion = next?.conversion;
  if (conversion && !conversion.crossingRef && returned.actor === target
    && (next?.supportSites?.includes(target) || stamp(readTravelCell(before, travel.grid, point(target))) === conversion.support)) {
    next = { ...next, conversion: { ...conversion, crossingRef: ref } };
  }
  if ((!next?.push || !next.push.chain || !next.conversion) && returned.actor === target) {
    const tile = readTravelCell(before, travel.grid, point(target));
    if (new Set(tile).size < 2) return next;
    const pushed = observedPushBody(next?.push?.body, travel, move.delta, before, after);
    if (pushed) {
      if (!next?.push || !next.push.chain && pushed.chain) next = { ...next, push: { body: pushed.body, chain: pushed.chain, ref } };
      if (pushed.conversion) {
        const { site, water, support } = pushed.conversion;
        const known = next?.conversion;
        if (!known || known.water === water && known.support === support) {
          next = { ...next, conversion: known ?? { water, support, ref },
            supportSites: [...new Set([...(next?.supportSites ?? []), site])] };
        }
      }
    }
  }
  const pressure = !next?.pressure && coverage?.layout ? observedPushGate(coverage, travel, before, after) : undefined;
  if (pressure) next = { ...next, pressure: { ...pressure, ref } };
  return next;
}

function enclosedBoundary(travel: ObservedTravel, rows: NativeRows, ref: string) {
  const { phase: [left, top], pitch, floor } = travel.grid;
  const right = left + Math.floor(((rows[0]?.length ?? 0) - left - pitch) / pitch) * pitch;
  const bottom = top + Math.floor((rows.length - top - pitch) / pitch) * pitch;
  const ink = rows[top]?.[left];
  if (ink === undefined || ink === floor || right <= left || bottom <= top) return;
  for (const [cell, pixels] of readTravelGrid(rows, travel.grid).cells) {
    const [x, y] = point(cell);
    if ((x === left || x === right || y === top || y === bottom) && pixels.some(value => value !== ink)) return;
  }
  return { ink, ref };
}

export function rememberPushAccess(knowledge: PushAccessKnowledge | undefined, travel: ObservedTravel | undefined,
  sample?: { rows: NativeRows; ref: string }): PushAccessMemory | undefined {
  if (!knowledge?.push || knowledge.contradicted || !travel || Object.keys(travel.moves).length !== 4) return;
  const wall = sample && enclosedBoundary(travel, sample.rows, sample.ref) || knowledge.wall;
  if (!wall || knowledge.conversion?.water.split(',').every(ink => Number(ink) === wall.ink)) return;
  // Store only the interface and reusable roles. Every new scene binds its own positions.
  const { annotatedMarks: _marks, ...grid } = travel.grid;
  const { supportSites: _sites, ...roles } = knowledge;
  return { controls: { grid, moves: travel.moves }, roles: { ...roles, wall } };
}

export function rebindPushAccess(memory: PushAccessMemory | undefined, rows: NativeRows, inputs: readonly string[]) {
  const travel = memory && rebindTravelControls(memory.controls, rows, inputs);
  return travel && memory ? { travel, roles: memory.roles } : undefined;
}

function readScene(knowledge: PushAccessKnowledge, travel: ObservedTravel, rows: NativeRows,
  template: string, binding?: PushAccessBinding) {
  const { cells, pieces } = readTravelGrid(rows, travel.grid);
  const actor = pieces.length === 1 ? pieces[0] : undefined;
  if (!actor || !knowledge.push || !knowledge.wall) return;
  let goal = binding?.field.goal;
  if (!goal) {
    const matches = [...cells].filter(([, pixels]) => stamp(pixels) === template);
    if (matches.length !== 1) return;
    goal = matches[0]![0];
  }
  const bodyPixels = knowledge.push.body.split(',').map(Number), floor = travel.grid.floor;
  const overlay = (pixels: readonly number[], pattern: string) => {
    const accents = new Set(pattern.split(',').map(Number).filter(ink => ink !== floor));
    const center = Math.floor(pixels.length / 2);
    return pixels[center] === bodyPixels[center] && pixels.filter((value, i) => value === bodyPixels[i]).length * 2 > pixels.length
      && pixels.every((value, i) => value === bodyPixels[i] || accents.has(value));
  };
  const ground: Cell[] = [], bodies: Cell[] = [], water: Cell[] = [], supports: Cell[] = [], marks: Cell[] = [], gates: Cell[] = [];
  const visibleGates: boolean[] = [];
  const pressure = knowledge.pressure, conversion = knowledge.conversion?.crossingRef ? knowledge.conversion : undefined;
  for (const [cell, pixels] of cells) {
    const signature = stamp(pixels);
    const body = signature === knowledge.push.body || cell === goal && overlay(pixels, template)
      || !!pressure && !!binding?.field.marks.includes(cell) && overlay(pixels, pressure.mark);
    const occupied = cell === actor || body;
    if (body) bodies.push(cell);
    if (conversion && (signature === conversion.water || signature === conversion.support
      || occupied && binding?.field.water.includes(cell))) {
      water.push(cell);
      if (signature === conversion.support || occupied && binding?.supports.includes(cell)) supports.push(cell);
    } else if (pressure && (signature === pressure.mark || occupied && binding?.field.marks.includes(cell))) {
      marks.push(cell);
    } else if (pressure && (signature === pressure.closed || signature === pressure.open || occupied && binding?.field.gates.includes(cell))) {
      gates.push(cell);
      if (!occupied) visibleGates.push(signature === pressure.open);
    } else if (!(occupied || cell === goal && signature === template || pixels.every(value => value === floor))) {
      if (pixels.every(value => value === knowledge.wall!.ink)) continue;
      return;
    }
    ground.push(cell);
  }
  const field: Field = { goal, ground: ground.sort(), water: water.sort(), marks: marks.sort(), gates: gates.sort() };
  if (!ground.includes(goal) || Boolean(marks.length) !== Boolean(gates.length)) return;
  const held = marks.every(mark => bodies.includes(mark));
  const heldIncludingActor = marks.every(mark => mark === actor || bodies.includes(mark));
  // Standing briefly on a mark may also open a gate. Routes rely only on retained weight.
  if (visibleGates.some(open => open ? !heldIncludingActor : held)) return;
  if (binding && (field.goal !== binding.field.goal
    || (['ground', 'water', 'marks', 'gates'] as const).some(role => field[role].join(';') !== binding.field[role].join(';')))) return;
  return { pose: { actor, bodies: bodies.sort(), supports: supports.sort() }, field };
}

type Graph = ReadonlyMap<Cell, readonly { command: NativeCommand; cell: Cell; delta: NativePoint }[]>;
type Walk = { previous?: Cell; command?: NativeCommand };
type Model = { graph: Graph; water: ReadonlySet<Cell>; gates: ReadonlySet<Cell>; marks: Cell[]; chain: boolean };

function occupancy(model: Model, pose: Pose) {
  const bodies = new Set(pose.bodies), supports = new Set(pose.supports);
  const gateOpen = model.marks.every(mark => bodies.has(mark));
  const enter = (cell: Cell) => (gateOpen || !model.gates.has(cell)) && (!model.water.has(cell) || supports.has(cell));
  return { bodies, supports, enter };
}

function reachable(graph: Graph, origin: Cell, blocked: ReadonlySet<Cell>, enter?: (cell: Cell) => boolean): Map<Cell, Walk> {
  const visited = new Map<Cell, Walk>([[origin, {}]]);
  for (const [from] of visited) for (const edge of graph.get(from) ?? []) {
    if (!blocked.has(edge.cell) && !visited.has(edge.cell) && (!enter || enter(edge.cell))) {
      visited.set(edge.cell, { previous: from, command: edge.command });
    }
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

function pushes(model: Model, pose: Pose, positions: ReadonlyMap<Cell, Walk>, local: ReturnType<typeof occupancy>) {
  const result: { stance: Cell; landing: Cell; step: Step }[] = [];
  for (const [stance] of positions) for (const edge of model.graph.get(stance) ?? []) {
    if (!local.bodies.has(edge.cell) || !local.enter(edge.cell)) continue;
    let landing = plus(edge.cell, edge.delta);
    if (model.chain) while (local.bodies.has(landing)) landing = plus(landing, edge.delta);
    if (local.bodies.has(landing) || !model.graph.has(landing)) continue;
    const sink = model.water.has(landing) && !local.supports.has(landing);
    if (!sink && !local.enter(landing)) continue;
    const displaced = pose.bodies.filter(cell => cell !== edge.cell);
    if (!sink) displaced.push(landing);
    if (displaced.length < model.marks.length) continue;
    const occupiedGate = model.gates.has(edge.cell) || displaced.some(cell => model.gates.has(cell));
    if (occupiedGate && !model.marks.every(mark => displaced.includes(mark))) continue;
    const supports = sink ? pose.supports.concat(landing).sort() : pose.supports;
    result.push({ stance, landing, step: { command: edge.command,
      after: { actor: edge.cell, bodies: displaced.sort(), supports }, pushed: true } });
  }
  return result;
}

function distances(graph: Graph, goal: Cell) {
  const distance = new Map<Cell, number>([[goal, 0]]);
  for (const [cell, depth] of distance) for (const edge of graph.get(cell) ?? []) {
    if (!distance.has(edge.cell)) distance.set(edge.cell, depth + 1);
  }
  return distance;
}

function search(model: Model, start: Pose, goal: Cell, limit: number, actionLimit: number) {
  const distance = distances(model.graph, goal);
  const pressure = model.marks.map(mark => ({ mark, distance: distances(model.graph, mark) }));
  type Candidate = { pose: Pose; route: Step[] };
  const queue = new Map<number, Candidate[]>();
  function enqueue(pose: Pose, route: Step[]) {
    const estimate = distance.get(pose.actor);
    if (estimate === undefined || route.length + estimate > actionLimit) return;
    const uncovered = pressure.filter(({ mark }) => !pose.bodies.includes(mark));
    const rank = route.length + (uncovered.length
      ? 15 * uncovered.length + 5 * uncovered.reduce((sum, mark) =>
          sum + Math.min(20, ...pose.bodies.map(body => mark.distance.get(body) ?? 20)), 0) - 4 * pose.supports.length
      : 3 * estimate);
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
    const local = occupancy(model, pose);
    const positions = reachable(model.graph, pose.actor, local.bodies, local.enter);
    const origin = actionLimit === Infinity || model.water.size ? [...positions.keys()].sort()[0] : pose.actor;
    const key = `${pose.bodies.join(';')}|${pose.supports.join(';')}|${origin}`;
    if ((best.get(key) ?? Infinity) <= route.length) continue;
    if (best.size >= limit) return { exhausted: false };
    best.set(key, actionLimit === Infinity ? 0 : route.length);
    if (positions.has(goal)) {
      const complete = route.concat(approach(positions, pose, goal));
      if (complete.length <= actionLimit) return { exhausted: false, route: complete };
    }
    for (const { stance, step } of pushes(model, pose, positions, local)) {
      const suffix = approach(positions, pose, stance);
      enqueue(step.after, route.concat(suffix, step));
    }
  }
  return { exhausted: true };
}

export function choosePushAccess(knowledge: PushAccessKnowledge | undefined, transfer: CoverageTransfer | undefined,
  travel: ObservedTravel | undefined, rows: NativeRows, inputs: readonly NativeCommand[], remaining: number,
  binding?: PushAccessBinding): PushAccessPlan | undefined {
  if (!knowledge?.push || !knowledge.wall || knowledge.contradicted || !travel || transfer?.motion !== 'push' || inputs.length !== 4) return;
  const moves = inputs.flatMap(command => {
    const measured = travel.moves[command.action_ref];
    return measured ? [{ command, delta: measured.delta }] : [];
  });
  if (moves.length !== 4 || new Set(moves.map(move => move.delta.join(','))).size !== 4) return;
  const scene = readScene(knowledge, travel, rows, transfer.exitPattern, binding);
  if (!scene) return;
  const { pose, field } = scene;
  const { ground, goal } = field;
  const floor = new Set(ground);
  const graph: Graph = new Map(ground.map(cell => [cell, moves.flatMap(({ command, delta }: Move) => {
    const neighbor = plus(cell, delta);
    return floor.has(neighbor) ? [{ command, cell: neighbor, delta }] : [];
  })]));
  const model: Model = { graph, water: new Set(field.water), gates: new Set(field.gates), marks: field.marks, chain: knowledge.push.chain };
  const route = search(model, pose, goal, field.water.length ? 8000 : 3000, remaining).route;
  if (!route?.length) return;
  let blocked: GateProof | undefined;
  if (!field.water.length && !field.gates.length) {
    // For a stable corridor, prove a closure by exhausting the reachable push states of its successor.
    const local = occupancy(model, pose), positions = reachable(graph, pose.actor, local.bodies);
    for (const { stance, landing, step } of pushes(model, pose, positions, local)) {
      if (landing === goal || (graph.get(landing)?.length ?? 0) !== 2
        || reachable(graph, pose.actor, new Set([landing])).has(goal)) continue;
      if (!search(model, step.after, goal, 64, Infinity).exhausted) continue;
      blocked = { passage: landing, blockedBy: step.command, stance };
      break;
    }
  }
  const firstPush = route.findIndex(step => step.pushed);
  let end = firstPush < 0 ? route.length : firstPush + 1;
  while (route[end]?.pushed && route[end]!.command.action_ref === route[firstPush]?.command.action_ref) end++;
  const steps = route.slice(0, Math.min(end, remaining, maximumCommittedActions));
  const plannedSupport = route.find(step => step.after.supports.length > pose.supports.length)
    ?.after.supports.find(cell => !pose.supports.includes(cell));
  return { start: pose, steps, goal, template: transfer.exitPattern, field, ...(blocked ? { blocked } : {}),
    ...(plannedSupport ? { plannedSupport } : {}),
    evidence: [transfer.ref, knowledge.push.ref, knowledge.wall.ref, ...moves.map(move => travel.moves[move.command.action_ref]!.ref),
      ...(field.water.length && knowledge.conversion?.crossingRef ? [knowledge.conversion.ref, knowledge.conversion.crossingRef] : []),
      ...(field.gates.length && knowledge.pressure ? [knowledge.pressure.ref] : [])] };
}

export function matchesPushAccess(knowledge: PushAccessKnowledge, travel: ObservedTravel, rows: NativeRows, plan: PushAccessPlan, expected: Pose) {
  const scene = readScene(knowledge, travel, rows, plan.template, { field: plan.field, supports: expected.supports });
  return scene?.pose.actor === expected.actor && scene.pose.bodies.join(';') === expected.bodies.join(';')
    && scene.pose.supports.join(';') === expected.supports.join(';');
}

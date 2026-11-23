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
export type PushAccessBinding = { field: Field; supports: Cell[]; continuation?: { from: Pose; steps: Step[] } };

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
  guidedRoute?: Step[];
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
  const { annotatedMarks: _marks, actorFooting: _footing, ...grid } = travel.grid;
  const { supportSites: _sites, ...roles } = knowledge;
  return { controls: { grid, moves: travel.moves }, roles: { ...roles, wall } };
}

export function rebindPushAccess(memory: PushAccessMemory | undefined, rows: NativeRows, inputs: readonly string[]) {
  if (!memory) return;
  const { roles, controls } = memory;
  const actorFooting = roles.conversion?.crossingRef ? roles.conversion.support.split(',').map(Number) : undefined;
  const grid = actorFooting ? { ...controls.grid, actorFooting } : controls.grid;
  const travel = rebindTravelControls({ ...controls, grid }, rows, inputs);
  return travel ? { travel, roles } : undefined;
}

function readScene(knowledge: PushAccessKnowledge, travel: ObservedTravel, rows: NativeRows,
  template: string, binding?: PushAccessBinding) {
  const { cells, pieces, onFooting } = readTravelGrid(rows, travel.grid);
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
    if (conversion && (signature === conversion.water || signature === conversion.support || onFooting.has(cell)
      || occupied && binding?.field.water.includes(cell))) {
      water.push(cell);
      if (signature === conversion.support || onFooting.has(cell) || occupied && binding?.supports.includes(cell)) supports.push(cell);
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

function weightedDistances(graph: Graph, goal: Cell, cost: (from: Cell, to: Cell, backward: NativePoint) => number) {
  const distance = new Map<Cell, number>([[goal, 0]]);
  const nextStep = new Map<Cell, { to: Cell; stance: Cell }>();
  const buckets: Cell[][] = [[goal]];
  for (let rank = 0; rank < buckets.length; rank++) for (const to of buckets[rank] ?? []) {
    if (distance.get(to) !== rank) continue;
    for (const { cell: from, delta } of graph.get(to) ?? []) {
      const next = rank + cost(from, to, delta);
      if (next >= (distance.get(from) ?? Infinity)) continue;
      distance.set(from, next);
      nextStep.set(from, { to, stance: plus(from, delta) });
      (buckets[next] ??= []).push(from);
    }
  }
  return { distance, nextStep };
}

function pressureAssignment(distances: ReadonlyMap<Cell, number>[], bodies: Cell[]) {
  const options = distances.map(distance => bodies.flatMap(body => {
    const cost = distance.get(body);
    return cost === undefined ? [] : [{ body, cost }];
  }).sort((a, b) => a.cost - b.cost));
  const owners = new Map<Cell, number>();
  function assign(mark: number, visited: Set<Cell>): boolean {
    for (const { body } of options[mark]!) {
      if (visited.has(body)) continue;
      visited.add(body);
      const owner = owners.get(body);
      if (owner !== undefined && !assign(owner, visited)) continue;
      owners.set(body, mark);
      return true;
    }
    return false;
  }
  const targets = options.map((_, index) => index).sort((a, b) => options[a]!.length - options[b]!.length);
  return targets.every(mark => assign(mark, new Set())) ? owners : null;
}

function supportGuidance(model: Model, goal: Cell) {
  type CostTable = ReturnType<typeof weightedDistances>;
  const tables = new Map<string, { pressure: CostTable[]; exit: CostTable; supplies: Map<Cell, CostTable> }>();
  return (pose: Pose) => {
    const key = pose.supports.join(';');
    const supports = new Set(pose.supports);
    const missing = (cell: Cell) => Number(model.water.has(cell) && !supports.has(cell));
    let table = tables.get(key);
    if (!table) {
      const pressure = model.marks.map(mark => weightedDistances(model.graph, mark, (from, to, backward) => {
        const stance = plus(from, backward);
        return model.graph.has(stance) ? 1 + 12 * (missing(stance) + missing(to)) : Infinity;
      }));
      const exit = weightedDistances(model.graph, goal, (_, to) => 1 + 12 * missing(to));
      table = { pressure, exit, supplies: new Map() };
      if (tables.size >= 256) tables.delete(tables.keys().next().value!);
      tables.set(key, table);
    }
    const uncovered = model.marks.filter(mark => !pose.bodies.includes(mark)).length;
    const assignment = pressureAssignment(table.pressure.map(path => path.distance), pose.bodies);
    if (!assignment) return Infinity;
    const demands = new Set<Cell>();
    function trace(path: CostTable, origin: Cell, pushing: boolean) {
      for (let step = path.nextStep.get(origin); step; step = path.nextStep.get(step.to)) {
        if (missing(step.to)) demands.add(step.to);
        if (pushing && missing(step.stance)) demands.add(step.stance);
      }
      return path.distance.get(origin) ?? Infinity;
    }
    const exit = trace(table.exit, pose.actor, false);
    let pressure = 0;
    for (const [body, mark] of assignment) pressure += trace(table.pressure[mark]!, body, true);
    const supplyDistances = [...demands].map(target => {
      let supply = table.supplies.get(target);
      if (!supply) {
        supply = weightedDistances(model.graph, target, (from, to, backward) => {
          const stance = plus(from, backward);
          return model.graph.has(stance) ? 1 + 12 * (missing(stance) + (to === target ? 0 : missing(to))) : Infinity;
        });
        table.supplies.set(target, supply);
      }
      return supply.distance;
    });
    const spare = pose.bodies.filter(body => !assignment.has(body));
    const delivery = pressureAssignment(supplyDistances, spare);
    const deliveryCost = delivery ? [...delivery].reduce((cost, [body, target]) => cost + supplyDistances[target]!.get(body)!, 0)
      : 80 + 20 * demands.size;
    return 4 * pressure + 8 * deliveryCost + 15 * demands.size + 10 * uncovered + (uncovered ? 1 : 4) * exit;
  };
}

function search(model: Model, start: Pose, goal: Cell, limit: number, actionLimit: number, guidance?: (pose: Pose) => number) {
  const distance = distances(model.graph, goal);
  const pressure = model.marks.map(mark => ({ mark, distance: distances(model.graph, mark) }));
  type Candidate = { pose: Pose; route: Step[] };
  const queue = new Map<number, Candidate[]>();
  const bestQueuedLength = new Map<string, number>();
  const poseKey = (pose: Pose) => `${pose.bodies.join(';')}|${pose.supports.join(';')}|${pose.actor}`;
  function enqueue(pose: Pose, route: Step[]) {
    const estimate = distance.get(pose.actor);
    if (estimate === undefined || route.length + estimate > actionLimit) return;
    const key = poseKey(pose);
    // The same exact position and arrangement reached in fewer actions has identical successors.
    if ((bestQueuedLength.get(key) ?? Infinity) <= route.length) return;
    const uncovered = pressure.filter(({ mark }) => !pose.bodies.includes(mark));
    const rank = route.length + (guidance ? guidance(pose) : uncovered.length
      ? 15 * uncovered.length + 5 * uncovered.reduce((sum, mark) =>
          sum + Math.min(20, ...pose.bodies.map(body => mark.distance.get(body) ?? 20)), 0) - 4 * pose.supports.length
      : 3 * estimate);
    if (!Number.isFinite(rank)) return;
    bestQueuedLength.set(key, route.length);
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
  const continuation = binding?.continuation;
  const resumed = continuation && continuation.steps.length <= remaining && samePose(continuation.from, pose);
  const standard = resumed ? undefined : search(model, pose, goal, field.water.length ? 8000 : 3000, remaining);
  // Spare bodies offer more combinations of footholds. Budget those combinations before probing the live board.
  const supportBudget = 8000 * Math.min(3, Math.max(1, pose.bodies.length - field.marks.length));
  const guidedRoute = resumed ? continuation.steps : standard && !standard.route && !standard.exhausted && field.water.length
    ? search(model, pose, goal, supportBudget, remaining, supportGuidance(model, goal)).route : undefined;
  const route = standard?.route ?? guidedRoute;
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
    ...(guidedRoute ? { guidedRoute } : {}),
    evidence: [transfer.ref, knowledge.push.ref, knowledge.wall.ref, ...moves.map(move => travel.moves[move.command.action_ref]!.ref),
      ...(field.water.length && knowledge.conversion?.crossingRef ? [knowledge.conversion.ref, knowledge.conversion.crossingRef] : []),
      ...(field.gates.length && knowledge.pressure ? [knowledge.pressure.ref] : [])] };
}

function samePose(actual: Pose, expected: Pose) {
  return actual.actor === expected.actor && actual.bodies.join(';') === expected.bodies.join(';')
    && actual.supports.join(';') === expected.supports.join(';');
}

/** Keep a projected suffix only from a step whose return has matched the public board. */
export function pushAccessBindingAfter(plan: PushAccessPlan, index: number): PushAccessBinding {
  const from = plan.steps[index]!.after;
  const steps = plan.guidedRoute?.slice(index + 1);
  return { field: plan.field, supports: from.supports, ...(steps?.length ? { continuation: { from, steps } } : {}) };
}

export function matchesPushAccess(knowledge: PushAccessKnowledge, travel: ObservedTravel, rows: NativeRows, plan: PushAccessPlan, expected: Pose) {
  const scene = readScene(knowledge, travel, rows, plan.template, { field: plan.field, supports: expected.supports });
  return !!scene && samePose(scene.pose, expected);
}

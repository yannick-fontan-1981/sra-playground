import type { NativeCommand, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import { readTravelGrid, type ObservedTravel } from './observed-travel-frontier.ts';
import { searchPullCoverage, type CoverageTransfer, type ObservedPressureLatch } from './observed-coverage.ts';
import { maximumCommittedActions } from './plan-step.ts';

type Cell = string;
type Gate = { at: Cell; rim: number; accent: number; back: number; delta: NativePoint; marks: Cell[]; closesOnContact: boolean };
type PressureGate = { at: Cell; marks: Cell[]; pattern: ObservedPressureLatch };
type Control = Gate | PressureGate;
type Pose = { actor: Cell; bodies: Cell[]; closed: boolean[] };
type Field = { floor: Cell[]; fixed: Record<Cell, string>; marks: Record<Cell, string>; gates: Control[]; goal: Cell; goalPixels: string };
type Step = { action: NativeCommand; after: Pose; actuated?: true };
export type PullKnowledge = { grid: ObservedTravel['grid']; moves: ObservedTravel['moves']; actorInkCount: number; body: string; ref: string;
  actuatorRef?: string };
export type PullCircuitBinding = { field: Field; pose: Pose };
type ReadScene = PullCircuitBinding & { occluded?: { at: Cell; fields: Field[] } };
export type PullCircuitPlan = { start: Pose; field: Field; steps: Step[]; roles: PullKnowledge; evidence: string[];
  revelation?: PullCircuitBinding[] };
type Move = { action: NativeCommand; delta: NativePoint };

const stamp = (pixels: readonly number[]) => pixels.join(',');
const offset = (cell: Cell, [dx, dy]: NativePoint, sign = 1) => {
  const [x, y] = cell.split(',').map(Number) as [number, number];
  return `${x + dx * sign},${y + dy * sign}`;
};

const corners = [0, 2, 6, 8], arms = [1, 3, 5, 7];
const gateDelta = (back: number, pitch: number): NativePoint =>
  [(1 - back % 3) * pitch, (1 - Math.floor(back / 3)) * pitch];

function readField(roles: PullKnowledge, route: CoverageTransfer, rows: NativeRows): ReadScene | undefined {
  const { grid } = roles;
  if (grid.pitch !== 3 || roles.actorInkCount < 2) return;
  const { cells, pieces } = readTravelGrid(rows, grid);
  if (pieces.length !== 1) return;
  const actor = pieces[0]!;
  const floor: Cell[] = [], bodies: Cell[] = [], goals: Cell[] = [];
  const fixed: Record<Cell, string> = {}, marks: Record<Cell, string> = {};
  const marked = new Map<number, Cell[]>();
  const shutters: { at: Cell; rim: number; accent: number; back: number; closed: boolean }[] = [];
  const latches: { at: Cell; closed: boolean }[] = [];
  const latch = route.pressureLatch;
  let coveredGate: { at: Cell; rim: number } | undefined;
  for (const [at, pixels] of cells) {
    const pattern = stamp(pixels), [rim] = pixels;
    if (latch && (pattern === latch.closed || pattern === latch.open)) {
      latches.push({ at, closed: pattern === latch.closed });
      continue;
    }
    if (at === actor && rim !== undefined && rim !== grid.floor && rim !== grid.ink && corners.every(i => pixels[i] === rim)) {
      coveredGate = { at, rim };
      continue;
    }
    if (at === actor || pattern === roles.body || pattern === route.exitPattern || pixels.every(ink => ink === grid.floor)) {
      floor.push(at);
      if (pattern === roles.body) bodies.push(at);
      if (pattern === route.exitPattern) goals.push(at);
      continue;
    }
    if (corners.every(i => pixels[i] === grid.floor) && pixels[1] !== grid.floor && arms.every(i => pixels[i] === pixels[1])) {
      const accent = pixels[4]!;
      marks[at] = pattern;
      marked.set(accent, [...marked.get(accent) ?? [], at]);
    } else if (rim !== undefined && rim !== grid.floor && corners.every(i => pixels[i] === rim) && pixels[4] !== rim) {
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
  if (goals.length !== 1 || !bodies.length) return;
  const gates: Control[] = [];
  if (latch && latches.length) {
    const controls = Object.keys(marks);
    if (shutters.length || coveredGate || latches.some(gate => !gate.closed) || !controls.length
      || controls.some(cell => marks[cell] !== latch.mark)) return;
    gates.push(...latches.map(({ at }) => ({ at, marks: controls, pattern: latch })));
  } else if (marked.size !== shutters.length + Number(!!coveredGate) || !marked.size
    || new Set(shutters.map(gate => gate.accent)).size !== shutters.length) return;
  for (const { at, rim, accent, back, closed } of shutters) {
    const controls = marked.get(accent);
    if (!controls?.length || controls.includes(at)) return;
    // Treat the exposed sensors as idle and check this hypothesis against the next visible returns.
    gates.push({ at, rim, accent, back, delta: gateDelta(back, grid.pitch), marks: controls, closesOnContact: !closed });
  }
  const field: Field = { floor: [...floor, ...Object.keys(marks), ...gates.map(gate => gate.at)], fixed, marks, gates,
    goal: goals[0]!, goalPixels: route.exitPattern };
  const pose = { actor, bodies: bodies.sort(), closed: [...latches.map(gate => gate.closed), ...shutters.map(gate => gate.closed)] };
  if (!coveredGate) return { field, pose };
  const { at, rim } = coveredGate;
  const unmatched = [...marked].filter(([accent]) => !shutters.some(gate => gate.accent === accent));
  if (unmatched.length !== 1) return;
  const [accent, controls] = unmatched[0]!;
  if (accent === rim || accent === grid.floor) return;
  // The actor's facing mark can share a pigment with the shutter. Only its border is exposed.
  const fields = arms.map(back => ({ ...field, floor: [...field.floor, at],
    gates: [...gates, { at, rim, accent, back, delta: gateDelta(back, grid.pitch), marks: controls, closesOnContact: true }] }));
  return { field: fields[0]!, pose: { ...pose, closed: [...pose.closed, false] }, occluded: { at, fields } };
}

const occupied = (pose: Pose, cell: Cell) => pose.actor === cell || pose.bodies.includes(cell);
const maximumRouteStates = 70_000;

function fitsExactPressureSearch({ field, pose }: PullCircuitBinding): boolean {
  const cells = field.floor.length, movable = pose.bodies.length;
  const placements = Math.min(movable, cells - movable);
  // The gates are determined by occupancy. Count only distinct crate arrangements and actor positions.
  let states = cells - movable;
  for (let i = 1; i <= placements && states <= maximumRouteStates; i++) states = states * (cells - i + 1) / i;
  return states <= maximumRouteStates;
}

function access(field: Field) {
  const floor = new Set(field.floor);
  const gateIndex = new Map(field.gates.map((gate, index) => [gate.at, index]));
  return (pose: Pose, cell: Cell) => floor.has(cell) && !pose.closed[gateIndex.get(cell) ?? -1];
}

function projectMove(field: Field, pose: Pose, action: NativeCommand, at: Cell, rear: Cell,
  allows: ReturnType<typeof access>): Step | undefined {
  if (!allows(pose, at) || pose.bodies.includes(at)) return;
  const pulled = pose.bodies.map(body => body === rear ? pose.actor : body).sort();
  const after: Pose = { actor: at, bodies: pulled, closed: pose.closed };
  if (!settle(field, after, cell => allows(after, cell))) return;
  after.bodies.sort();
  const actuated = after.actor !== at || after.bodies.some((body, index) => body !== pulled[index]);
  return { action, after, ...(actuated ? { actuated: true as const } : {}) };
}

function routePriority(field: Field, pitch: number) {
  const targets = [...new Set(field.gates.flatMap(gate => 'pattern' in gate || gate.closesOnContact ? [] : gate.marks))];
  const points = new Map(field.floor.map(cell => [cell, cell.split(',').map(Number)]));
  const distance = (a: Cell, b: Cell) => {
    const [x, y] = points.get(a)!, [u, v] = points.get(b)!;
    return (Math.abs(x! - u!) + Math.abs(y! - v!)) / pitch;
  };
  const cache = new Map<string, number>();
  function assignment(bodies: readonly Cell[], index: number): number {
    if (index === targets.length) return 0;
    return Math.min(...bodies.map((body, i) => distance(body, targets[index]!) + assignment(bodies.filter((_, j) => i !== j), index + 1)));
  }
  return ({ actor, bodies }: Pose) => {
    const key = bodies.join(';');
    let placement = cache.get(key);
    if (placement === undefined) {
      placement = targets.length <= Math.min(3, bodies.length) && bodies.length <= 8 ? assignment(bodies, 0) : 0;
      cache.set(key, placement);
    }
    return 15 * placement + 3 * distance(actor, field.goal);
  };
}

function findRoute(field: Field, start: Pose, moves: readonly Move[], remaining: number, guided = false) {
  const allows = access(field), floor = new Set(field.floor);
  const neighbors = new Map(field.floor.map(cell => [cell, moves.flatMap(({ action, delta }) => {
    const at = offset(cell, delta);
    return floor.has(at) ? [{ action, at, rear: offset(cell, delta, -1) }] : [];
  })]));
  type Node = { pose: Pose; distance: number; previous?: Node; step?: Step };
  const buckets = new Map<number, { nodes: Node[]; cursor: number }>();
  const seen = new Map<string, number>();
  const [dx, dy] = moves[0]!.delta;
  const priorityFor = guided ? routePriority(field, Math.abs(dx) + Math.abs(dy)) : () => 0;
  let best = Infinity;
  const enqueue = (node: Node) => {
    const key = JSON.stringify(node.pose);
    if ((seen.get(key) ?? Infinity) <= node.distance) return;
    seen.set(key, node.distance);
    const priority = node.distance + priorityFor(node.pose);
    const bucket = buckets.get(priority) ?? { nodes: [], cursor: 0 };
    bucket.nodes.push(node);
    buckets.set(priority, bucket);
    best = Math.min(best, priority);
  };
  enqueue({ pose: start, distance: 0 });
  for (let visits = 0; buckets.size && visits < maximumRouteStates; visits++) {
    const bucket = buckets.get(best)!;
    const current = guided ? bucket.nodes.pop()! : bucket.nodes[bucket.cursor++]!;
    if (bucket.cursor === bucket.nodes.length) {
      buckets.delete(best);
      best = Math.min(...buckets.keys());
    }
    const { pose, distance } = current;
    if (pose.actor === field.goal) {
      const route: Step[] = [];
      for (let node: Node | undefined = current; node?.step; node = node.previous) route.push(node.step);
      return route.reverse();
    }
    if (distance >= remaining) continue;
    for (const { action, at, rear } of neighbors.get(pose.actor) ?? []) {
      const step = projectMove(field, pose, action, at, rear, allows);
      if (step) enqueue({ pose: step.after, distance: distance + 1, previous: current, step });
    }
  }
}

function settle(field: Field, pose: Pose, allows: (cell: Cell) => boolean) {
  // A closure can move its occupant and thereby change which sensors are held.
  for (let wave = 0; wave <= field.gates.length; wave++) {
    const previous = pose.closed;
    const desired = field.gates.map(gate => gate.marks.every(mark => occupied(pose, mark)) === ('pattern' in gate ? false : gate.closesOnContact));
    if (desired.every((closed, index) => closed === previous[index])) return true;
    pose.closed = desired;
    for (const [index, gate] of field.gates.entries()) {
      if (!desired[index] || previous[index] || !occupied(pose, gate.at)) continue;
      if ('pattern' in gate) return false;
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
      if ('pattern' in gate) {
        if (!isOccupied && stamp(pixels) !== (closed ? gate.pattern.closed : gate.pattern.open)) return false;
        if (cell === pose.actor && [0, 2, 6, 8].some(i => pixels[i] !== Number(gate.pattern.open.split(',')[i]))) return false;
      } else if (!hasBody && [0, 2, 6, 8].some(i => pixels[i] !== gate.rim)) return false;
      else if (!isOccupied) {
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

function revealGate(scene: ReadScene, moves: readonly Move[]) {
  const { pose, occluded } = scene;
  if (!occluded) return;
  let best, value = -1;
  for (const { action, delta } of moves) {
    const at = offset(pose.actor, delta), rear = offset(pose.actor, delta, -1);
    const outcomes = occluded.fields.flatMap(field => {
      const step = projectMove(field, pose, action, at, rear, access(field));
      return step && step.after.actor === at && !occupied(step.after, occluded.at) ? [{ field, pose: step.after, step }] : [];
    });
    if (outcomes.length !== occluded.fields.length) continue;
    const gain = Number(outcomes.every(outcome => outcome.step.actuated))
      + Number(outcomes.every(outcome => outcome.pose.closed.some((closed, i) => closed !== pose.closed[i])));
    if (gain <= value) continue;
    value = gain;
    best = { steps: [outcomes[0]!.step], revelation: outcomes.map(({ field, pose }) => ({ field, pose })) };
  }
  return best;
}

export function witnessedPullCircuitReturn(plan: PullCircuitPlan, index: number, rows: NativeRows): PullCircuitBinding | undefined {
  if (!plan.revelation) {
    const pose = plan.steps[index]!.after;
    return matchesPullCircuit(plan.roles, plan.field, pose, rows) ? { field: plan.field, pose } : undefined;
  }
  const matched = plan.revelation.filter(({ field, pose }) => matchesPullCircuit(plan.roles, field, pose, rows));
  return matched.length === 1 ? matched[0] : undefined;
}

export function planPullCircuit(roles: PullKnowledge, transfer: CoverageTransfer, rows: NativeRows, inputs: readonly NativeCommand[],
  remaining: number, binding?: PullCircuitBinding): PullCircuitPlan | undefined {
  if (remaining < 1 || transfer.motion !== 'pull' || inputs.length !== 4 || Object.keys(roles.moves).length !== inputs.length) return;
  const scene: ReadScene | undefined = binding ?? readField(roles, transfer, rows);
  if (!scene || !matchesPullCircuit(roles, scene.field, scene.pose, rows)) return;
  const moves = inputs.flatMap(action => roles.moves[action.action_ref] ? [{ action, delta: roles.moves[action.action_ref]!.delta }] : []);
  if (moves.length !== inputs.length) return;
  const latch = scene.field.gates.find(gate => 'pattern' in gate);
  const evidence = [transfer.ref, roles.ref, ...Object.values(roles.moves).map(move => move.ref),
    ...(latch ? [latch.pattern.ref] : roles.actuatorRef ? [roles.actuatorRef] : [])];
  if (scene.occluded) {
    const revealed = revealGate(scene, moves);
    return revealed && { ...revealed, start: scene.pose, field: scene.field, roles, evidence };
  }
  const exact = fitsExactPressureSearch(scene);
  const path = latch && !exact
    ? pressureRoute(scene, moves, latch, remaining).steps : findRoute(scene.field, scene.pose, moves, remaining, !exact);
  if (!path?.length) return;
  const change = path.findIndex(step => step.after.closed.some((closed, index) => closed !== scene.pose.closed[index]));
  const steps = path.slice(0, Math.min(maximumCommittedActions, change < 0 ? path.length : change + 1));
  return { start: scene.pose, field: scene.field, steps, roles, evidence };
}

export function observePullCircuitBinding(roles: PullKnowledge, transfer: CoverageTransfer, rows: NativeRows,
  previous?: PullCircuitBinding): PullCircuitBinding | undefined {
  if (!previous) {
    const scene = readField(roles, transfer, rows);
    return scene && !scene.occluded && matchesPullCircuit(roles, scene.field, scene.pose, rows) ? scene : undefined;
  }
  const { field } = previous;
  const { cells } = readTravelGrid(rows, roles.grid);
  const actors: Cell[] = [], bodies: Cell[] = [];
  const body = roles.body.split(',').map(Number);
  for (const at of field.floor) {
    const pixels = cells.get(at);
    if (!pixels) return;
    if (pixels[4] === roles.grid.ink && pixels.filter(ink => ink === roles.grid.ink).length === roles.actorInkCount) actors.push(at);
    if (stamp(pixels) === roles.body || (field.marks[at] || field.goal === at)
      && pixels[4] === body[4] && pixels.filter((ink, index) => ink === body[index]).length > body.length / 2) bodies.push(at);
  }
  if (actors.length !== 1 || bodies.length !== previous.pose.bodies.length) return;
  const pose: Pose = { actor: actors[0]!, bodies: bodies.sort(), closed: [] };
  pose.closed = field.gates.map(gate => gate.marks.every(mark => occupied(pose, mark)) === ('pattern' in gate ? false : gate.closesOnContact));
  return matchesPullCircuit(roles, field, pose, rows) ? { field, pose } : undefined;
}

export function provesPullCircuitDeadlock(roles: PullKnowledge, start: Pose, current: PullCircuitBinding, refs: readonly string[]) {
  const [gate] = current.field.gates;
  if (!gate || JSON.stringify(start) === JSON.stringify(current.pose)) return false;
  const moves = refs.flatMap(action_ref => roles.moves[action_ref] ? [{ action: { action_ref, data: {} }, delta: roles.moves[action_ref]!.delta }] : []);
  if (moves.length !== 4) return false;
  const { field, pose } = current;
  if ('pattern' in gate) return pressureRoute(current, moves, gate, Infinity).exhausted
    && !!pressureRoute({ field, pose: start }, moves, gate, Infinity).steps?.length;
  const allows = access(field);
  const key = JSON.stringify(pose);
  const trapped = moves.every(({ action, delta }) => {
    const at = offset(pose.actor, delta);
    // A predicted body loss is an unresolved transition, so it cannot prove a live deadlock.
    return !allows(pose, at) || pose.bodies.includes(at)
      || JSON.stringify(projectMove(field, pose, action, at, offset(pose.actor, delta, -1), allows)?.after) === key;
  });
  return trapped && !!findRoute(field, start, moves, Infinity, !fitsExactPressureSearch(current))?.length;
}

function pressureRoute(scene: PullCircuitBinding, moves: readonly { action: NativeCommand; delta: NativePoint }[],
  latch: PressureGate, remaining: number) {
  const { field, pose } = scene;
  const search = searchPullCoverage(pose.actor, new Set(pose.bodies), { exit: field.goal, marks: latch.marks, gate: field.gates.map(gate => gate.at) },
    new Set(field.floor), moves.map(({ action, delta }) => ({ input: action.action_ref, delta })), [], remaining);
  const steps = search.route?.map(({ input, actor, arrangement }): Step => ({
    action: moves.find(move => move.action.action_ref === input)!.action,
    after: pressurePose(field, latch.marks, actor, arrangement.split(';')),
  }));
  return { steps, exhausted: search.exhausted };
}

function pressurePose(field: Field, marks: readonly Cell[], actor: Cell, bodies: Cell[]): Pose {
  const held = marks.every(mark => mark === actor || bodies.includes(mark));
  return { actor, bodies, closed: field.gates.map(() => !held) };
}

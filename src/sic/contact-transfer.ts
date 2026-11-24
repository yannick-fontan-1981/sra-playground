import type { NativeCommand, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import { bindPullSeries, matchesPullGates, type CoverageLearning, type CoverageTransfer, type CoveragePullSeries } from './observed-coverage.ts';
import { unchangedOutside } from './plan-step.ts';
import { observedTravelActor, readTravelGrid, type ObservedTravel } from './observed-travel-frontier.ts';

type Effect = { control: string; site: string; ref: string };
type TransferEffect = Effect & { landing: string };
export type ContactMemory = {
  features: Record<string, string>; blocked: Record<string, string>; effects: Effect[];
  transfers?: TransferEffect[]; tested: string[]; bodies: string[]; exit: string; ref: string;
};
export type ContactExperiment = {
  command: NativeCommand; purpose: 'revisit_exit' | 'test_surface' | 'couple_effect' | 'repeat_transport' | 'place_object';
  experiment: string; actor: string; bodies: string[]; final: boolean; evidence: string[];
  route?: readonly ContactStep[];
};
type ContactStep = { input: string; actor: string; bodies: string[] };
type Cells = ReturnType<typeof readTravelGrid>['cells'];
const stamp = (pixels: readonly number[] | undefined) => pixels?.join(',') ?? '';
const point = (cell: string) => cell.split(',').map(Number) as [number, number];
const step = (cell: string, [dx, dy]: NativePoint, sign = 1) => {
  const [x, y] = point(cell);
  return [x + sign * dx, y + sign * dy].join(',');
};
const patterned = (pixels: readonly number[]) => pixels.some(v => v !== pixels[0]);

function matchesBody(pixels: readonly number[] | undefined, shape: readonly number[]): boolean {
  if (!pixels || pixels.length !== shape.length) return false;
  const middle = Math.floor(shape.length / 2);
  return pixels[middle] === shape[middle] && pixels.filter((value, i) => value === shape[i]).length > shape.length / 2;
}

export function checkContactPrediction(plan: Pick<ContactExperiment, 'actor' | 'bodies'>, travel: ObservedTravel, coverage: CoverageLearning, rows: NativeRows) {
  if (!coverage.body || observedTravelActor(travel, rows) !== plan.actor) return false;
  const cells = readTravelGrid(rows, travel.grid).cells, shape = coverage.body.split(',').map(Number);
  return plan.bodies.every(cell => matchesBody(cells.get(cell), shape));
}

export function bindContactPullSeries(plan: ContactExperiment, travel: ObservedTravel, local: ContactMemory, coverage: CoverageLearning,
  rows: NativeRows, remaining: number) {
  if (!plan.route || !travel.actor) return;
  const board = readTravelGrid(rows, travel.grid);
  if (!matchesContactPose(board, coverage, { actor: travel.actor, arrangement: local.bodies.join(';') })) return;
  const { cells } = board;
  const bodies = new Set(local.bodies);
  // An unoccupied patterned surface can be a gate or a control whose effect is still being tested.
  const gate = new Set(coverage.layout?.gate);
  for (const [cell, pixels] of cells) if (cell !== travel.actor && !bodies.has(cell) && patterned(pixels)) gate.add(cell);
  const route = plan.route.map(({ input, actor, bodies }) => ({ input, actor, arrangement: bodies.join(';') }));
  return bindPullSeries(route, travel.actor, bodies, cells, { marks: coverage.layout?.marks ?? [], gate: [...gate] }, travel.grid.pitch, remaining);
}

export function contactExperimentAt(plan: ContactExperiment, index: number): ContactExperiment {
  const step = plan.route?.[index];
  return step ? { ...plan, command: { action_ref: step.input, data: {} }, actor: step.actor, bodies: step.bodies,
    final: index + 1 === plan.route!.length } : plan;
}

function matchesContactPose(board: ReturnType<typeof readTravelGrid>, coverage: CoverageLearning, pose: { actor: string; arrangement: string }) {
  if (!coverage.body || board.pieces.length !== 1 || board.pieces[0] !== pose.actor) return false;
  const bodies = new Set(pose.arrangement.split(';'));
  const shape = coverage.body.split(',').map(Number);
  return [...bodies].every(cell => matchesBody(board.cells.get(cell), shape))
    && [...board.cells].every(([cell, pixels]) => bodies.has(cell) || stamp(pixels) !== coverage.body);
}

export function contactPullPremise(series: CoveragePullSeries, index: number, travel: ObservedTravel, coverage: CoverageLearning, rows: NativeRows) {
  const step = series.steps[index]!;
  const board = readTravelGrid(rows, travel.grid);
  return matchesPullGates(series, travel, rows) && stamp(board.cells.get(step.landing)) === step.substrate
    && matchesContactPose(board, coverage, step.before);
}

export function contactPullReturn(series: CoveragePullSeries, index: number, travel: ObservedTravel, coverage: CoverageLearning,
  before: NativeRows, after: NativeRows) {
  const step = series.steps[index]!;
  return matchesPullGates(series, travel, after) && unchangedOutside(before, after, step.changed)
    && matchesContactPose(readTravelGrid(after, travel.grid), coverage, step.after);
}

export function observeContactExperiment(previous: ContactMemory | undefined, transfer: CoverageTransfer, coverage: CoverageLearning,
  travel: ObservedTravel, returned: ObservedTravel, before: NativeRows, after: NativeRows, command: NativeCommand, ref: string,
  plan?: ContactExperiment): ContactMemory | undefined {
  if (!travel.actor || !returned.actor || !coverage.body || transfer.motion !== 'pull' || coverage.motion !== transfer.motion || travel.grid.ink !== returned.grid.ink) return previous;
  const first = readTravelGrid(before, travel.grid).cells, last = readTravelGrid(after, returned.grid).cells;
  const exits = [...first].filter(([, pixels]) => stamp(pixels) === transfer.exitPattern);
  if (!previous && exits.length !== 1) return;
  const local: ContactMemory = previous ?? { features: {}, blocked: {}, effects: [], tested: [], bodies: [], exit: exits[0]![0], ref };
  const features = { ...local.features }, blocked = { ...local.blocked };
  const effects = [...local.effects], transfers = [...local.transfers ?? []];
  const seenBodies = [...last].filter(([, pixels]) => stamp(pixels) === coverage.body).map(([cell]) => cell);
  const shape = coverage.body.split(',').map(Number);
  // A surface may partially cover a moving piece. Only accept a predicted position when its sprite is still visible.
  for (const [cell, pixels] of last) {
    if (cell === returned.actor || seenBodies.includes(cell)) continue;
    const predicted = (plan?.bodies ?? local.bodies).includes(cell);
    if (!predicted && stamp(pixels) === stamp(first.get(cell))) continue;
    if (matchesBody(pixels, shape)) seenBodies.push(cell);
  }
  for (const [cell, pixels] of last) {
    if (cell === returned.actor || seenBodies.includes(cell)) continue;
    if (patterned(pixels)) features[cell] = stamp(pixels);
    else delete features[cell];
  }
  const delta = returned.moves[command.action_ref]?.delta;
  if (delta && travel.actor === returned.actor) {
    const dest = step(travel.actor, delta), pixels = first.get(dest);
    if (pixels && !local.bodies.includes(dest) && stamp(pixels) === stamp(last.get(dest))) blocked[dest] = stamp(pixels);
  }
  if (delta && returned.actor === step(travel.actor, delta)) {
    const tail = step(travel.actor, delta, -1);
    const source = returned.actor, entered = first.get(source);
    if (entered && patterned(entered) && stamp(entered) !== coverage.body) {
      const lost = local.bodies.filter(cell => !seenBodies.includes(cell));
      const arrived = seenBodies.filter(cell => !local.bodies.includes(cell));
      if (lost.length === 1 && arrived.length === 1 && lost[0] !== tail && arrived[0] !== travel.actor
        && effects.some(effect => effect.site === lost[0] && effect.control === source)
        && !transfers.some(effect => effect.site === lost[0] && effect.control === source && effect.landing === arrived[0])) {
        transfers.push({ control: source, site: lost[0]!, landing: arrived[0]!, ref });
      }
      for (const [site, pixels] of first) {
        if (site === travel.actor || site === source || site === tail || !patterned(pixels) || stamp(pixels) === coverage.body
          || stamp(pixels) === stamp(last.get(site)) || seenBodies.includes(site)) continue;
        if (!effects.some(effect => effect.control === source && effect.site === site)) effects.push({ control: source, site, ref });
      }
    }
  }
  const tested = plan?.final && plan.actor === returned.actor && plan.bodies.every(body => seenBodies.includes(body)) && !local.tested.includes(plan.experiment)
    ? [...local.tested, plan.experiment] : local.tested;
  return { ...local, bodies: seenBodies.sort(), features, effects, transfers, blocked, tested };
}

type Probe = {
  id: string; purpose: ContactExperiment['purpose']; stand?: string; requiredBodies?: string[]; rank: number; ref: string;
};
function satisfies(probe: Probe, actor: string, bodies: string[]) {
  return (!probe.stand || actor === probe.stand) && (probe.requiredBodies?.every(cell => bodies.includes(cell)) ?? true);
}

function probes(local: ContactMemory, cells: Cells, pitch: number): Probe[] {
  const configuration = [local.bodies.join(';'), ...local.effects.map(effect => stamp(cells.get(effect.site)))].join('|');
  const requested: Probe[] = [{ id: 'exit:' + local.exit + '|' + configuration, stand: local.exit, purpose: 'revisit_exit', rank: 0, ref: local.ref }];
  for (const transfer of local.transfers ?? []) {
    requested.push({ id: ['repeat', transfer.control, transfer.site, transfer.landing].join('|'), purpose: 'repeat_transport',
      stand: transfer.control, requiredBodies: [transfer.site, transfer.landing], rank: 1, ref: transfer.ref });
  }
  for (const effect of local.effects) {
    const [x, y] = point(effect.site);
    const near = [effect.site, ...Object.keys(local.features).filter(cell => {
      const [cx, cy] = point(cell);
      return Math.abs(cx - x) + Math.abs(cy - y) === pitch;
    })];
    for (const body of near) requested.push({ id: ['couple', effect.control, effect.site, body].join('|'),
      purpose: 'couple_effect', stand: effect.control, requiredBodies: [body], rank: 2, ref: effect.ref });
  }
  for (const cell of Object.keys(local.features)) {
    if (cell === local.exit || local.blocked[cell] === stamp(cells.get(cell))) continue;
    requested.push({ id: 'visit:' + cell, purpose: 'test_surface', stand: cell, rank: 3, ref: local.ref },
      { id: 'place:' + cell, purpose: 'place_object', requiredBodies: [cell], rank: 4, ref: local.ref });
  }
  return requested.filter(probe => !local.tested.includes(probe.id));
}

// Search only transformations acquired from screen returns. The real game supplies the
// outcome of each issued step, including refusals and changes absent from the model.
export function chooseContactExperiment(local: ContactMemory, transfer: CoverageTransfer, coverage: CoverageLearning,
  travel: ObservedTravel, rows: NativeRows): ContactExperiment | undefined {
  if (!travel.actor || !local.bodies.length || coverage.motion !== transfer.motion || !coverage.lastPull) return;
  const cells = readTravelGrid(rows, travel.grid).cells, moves = Object.entries(travel.moves);
  if (moves.length < 2) return;
  const ground = new Set([...cells].filter(([cell, pixels]) => (pixels.every(v => v === travel.grid.floor) || patterned(pixels))
    && local.blocked[cell] !== stamp(pixels)).map(([cell]) => cell));
  const goals = probes(local, cells, travel.grid.pitch).filter(probe =>
    (!probe.stand || ground.has(probe.stand)) && probe.requiredBodies?.some(cell => !ground.has(cell)) !== true
    && !satisfies(probe, travel.actor!, local.bodies));
  if (!goals.length) return;

  type Node = { actor: string; bodies: string[]; step?: ContactStep; previous?: Node };
  const queue: Node[] = [{ actor: travel.actor, bodies: local.bodies }];
  const seen = new Set([travel.actor + '|' + local.bodies.join(';')]);
  const neighbors = new Map([...ground].map(cell => [cell, moves.flatMap(([input, { delta }]) => {
    const actor = step(cell, delta);
    return ground.has(actor) ? [{ input, actor, tail: step(cell, delta, -1) }] : [];
  })]));
  let selected: { probe: Probe; node: Node } | undefined;
  const bestRank = Math.min(...goals.map(probe => probe.rank));
  // Within each experimental priority, breadth-first order favors the shortest reachable trial.
  search: for (let i = 0; i < queue.length && i < 16000; i++) {
    const node = queue[i]!;
    for (const { input, actor, tail } of neighbors.get(node.actor) ?? []) {
      if (node.bodies.includes(actor)) continue;
      const bodies = node.bodies.includes(tail) ? node.bodies.map(cell => cell === tail ? node.actor : cell).sort() : node.bodies;
      // A pull into a cul-de-sac can leave the actor behind a piece with no available departure.
      if (actor !== local.exit && !neighbors.get(actor)?.some(next => !bodies.includes(next.actor))) continue;
      const key = actor + '|' + bodies.join(';');
      if (seen.has(key)) continue;
      seen.add(key);
      const candidate = { actor, bodies, step: { input, actor, bodies }, previous: node };
      for (const probe of goals) {
        if ((!selected || probe.rank < selected.probe.rank) && satisfies(probe, actor, bodies)) {
          selected = { probe, node: candidate };
          if (probe.rank === bestRank) break search;
        }
      }
      queue.push(candidate);
    }
  }
  if (!selected) return;
  const { probe } = selected;
  const route: ContactStep[] = [];
  for (let node: Node | undefined = selected.node; node?.step; node = node.previous) route.push(node.step);
  route.reverse();
  const first = route[0]!;
  return { command: { action_ref: first.input, data: {} }, purpose: probe.purpose, experiment: probe.id,
    actor: first.actor, bodies: first.bodies, final: route.length === 1, route,
    evidence: [transfer.ref, coverage.lastPull.ref, probe.ref, travel.moves[first.input]!.ref] };
}

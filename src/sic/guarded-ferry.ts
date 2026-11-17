import { center, contains, find_body } from '../logos-engine/v6-object-binding-geometry.ts';
import type { NativeBox, NativeEntity, NativeObservation, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import { startRecoveredDelivery, type DeliveryModel } from './sequential-ferry.ts';

type Bank = 0 | 1;
type Passenger = { ink: number; area: number; shape: NativeBox; berths: readonly [NativeBox, NativeBox]; centers: readonly [NativePoint, NativePoint] };
type Arrangement = { actor: NativePoint; bank: Bank; banks: Bank[]; held: number | null };
type Hazard = readonly [number, number];
type Ferry = { model: DeliveryModel; graph: Record<string, Record<string, NativePoint>>; cargo: Passenger[]; radius: number;
  pickup: number; initial: Arrangement; firstFrame: string };
export type GuardedFerry = { epoch: number; ferry: Ferry; at: Arrangement; frame: string; hazards: Hazard[];
  radius: number; rejected: string[]; refs: string[]; heldBox?: NativeBox; plan: FerryLeg[]; stopped: boolean };
type FerryLeg = { input: string; expect: Arrangement; role: 'move' | 'take' | 'release' | 'cross' };
const key = (point: NativePoint) => point.join(',');
const same = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((v, i) => v === b[i]);
const midpoint = (box: NativeBox) => center(box) as unknown as NativePoint;
const shift = ([l, t, r, b]: NativeBox, x: number, y: number): NativeBox => [l + x, t + y, r + x, b + y];
const distance = ([x, y]: NativePoint, [u, v]: NativePoint) => Math.max(Math.abs(x - u), Math.abs(y - v));
const otherBank = (bank: Bank): Bank => bank === 0 ? 1 : 0;
const pairKey = (hazard: Hazard) => hazard.join(',');

function measureField(rows: NativeRows, [x, y]: NativePoint, bodySide: number) {
  const fits: number[] = [];
  for (let radius = bodySide; radius <= Math.min(x, y, rows[0]!.length - 1 - x, rows.length - 1 - y); radius++) {
    const lines: number[][] = [[], [], [], []];
    for (let offset = -radius + 1; offset < radius; offset++) {
      lines[0]!.push(rows[y - radius]![x + offset]!);
      lines[1]!.push(rows[y + radius]![x + offset]!);
      lines[2]!.push(rows[y + offset]![x - radius]!);
      lines[3]!.push(rows[y + offset]![x + radius]!);
    }
    const corners = [rows[y - radius]![x - radius], rows[y - radius]![x + radius], rows[y + radius]![x + radius], rows[y + radius]![x - radius]];
    if (corners.every(ink => ink === corners[0]) && lines.every(line => line.every(ink => ink === corners[0]))
      && rows[y + radius + 1]?.[x] !== corners[0] && rows[y - radius - 1]?.[x] !== corners[0]) fits.push(radius);
  }
  return fits.length === 1 ? fits[0]! : null;
}

function incomingPassenger(observation: NativeObservation, rows: NativeRows, example: NativeBox, known: number[]) {
  const [l, , r] = example, height = example[3] - example[1], candidates: { body: NativeEntity; frame: NativeBox }[] = [];
  for (let y = 0; y + height < rows.length; y++) {
    const ink = rows[y]?.[l + 1];
    if (ink === undefined || known.includes(ink)) continue;
    let rim = true;
    for (let x = l + 1; x < r && rim; x++) rim = rows[y]![x] === ink && rows[y + height]![x] === ink;
    for (let i = y + 1; i < y + height && rim; i++) rim = rows[i]![l] === ink && rows[i]![r] === ink;
    if (!rim) continue;
    const interior: NativeBox = [l + 1, y + 1, r - 1, y + height - 1];
    const bodies = observation.entities.filter(body => body.palette_value === ink && body.area >= 4 && contains(interior, body.bbox));
    if (bodies.length === 1) candidates.push({ body: bodies[0]!, frame: interior });
  }
  return candidates.length === 1 ? candidates[0]! : null;
}

function measureGraph(model: DeliveryModel, initial: NativePoint, from: number, to: number, cargo: Passenger[]) {
  const graph: Ferry['graph'] = {}, centerX = cargo[0]!.centers;
  const yBounds = cargo.flatMap(item => item.centers.map(point => point[1]));
  const top = Math.min(initial[1], ...yBounds), bottom = Math.max(initial[1], ...yBounds);
  const horizontal = Math.abs(model.motion[model.crossing.forward]![0]);
  const vertical = Math.min(...Object.values(model.motion).filter(([x, y]) => !x && !!y).map(([, y]) => Math.abs(y)));
  if (!horizontal || !Number.isFinite(vertical)) return null;
  for (let y = initial[1] + Math.ceil((top - initial[1]) / vertical) * vertical; y <= bottom; y += vertical) {
    for (const [j, crossing] of [from, to].entries()) {
      const end = centerX[j]![0], lo = Math.min(end, crossing), hi = Math.max(end, crossing);
      for (let x = crossing + Math.ceil((lo - crossing) / horizontal) * horizontal; x <= hi; x += horizontal) graph[key([x, y])] = {};
    }
  }
  for (const [origin, neighbors] of Object.entries(graph)) {
    const [x, y] = origin.split(',').map(Number) as [number, number];
    for (const [input, [dx, dy]] of Object.entries(model.motion)) {
      const point: NativePoint = x === from && input === model.crossing.forward ? [to, y]
        : x === to && input === model.crossing.back ? [from, y] : [x + dx, y + dy];
      if (graph[key(point)]) neighbors[input] = point;
    }
  }
  return graph[key(initial)] ? graph : null;
}

export function measureGuardedFerry(observation: NativeObservation, rows: NativeRows, model: DeliveryModel): GuardedFerry | null {
  const inherited = startRecoveredDelivery(observation, rows, model);
  const body = find_body(observation, model.actor) as NativeEntity | null;
  if (!inherited || !body) return null;
  const ordinary = inherited.cargo;
  const occupied = incomingPassenger(observation, rows, ordinary[0]!.frame.bbox, ordinary.map(pair => pair.object.palette_value));
  if (!occupied) return null;
  const observed = midpoint(body.bbox), span = body.bbox[2] - body.bbox[0] + 1;
  const radius = measureField(rows, observed, span);
  if (radius === null) return null;
  const centers = ordinary.map(entry => [midpoint(entry.object.bbox)[0], midpoint(entry.frame.interior_bbox)[0]] as const);
  if (centers.some(center => !same(center, centers[0]!))) return null;
  const crossing = centers[0]![1] - centers[0]![0];
  const cargo: Passenger[] = ordinary.map(({ object, frame }) => {
    const right = frame.interior_bbox, left = shift(right, -crossing, 0);
    return { ink: object.palette_value, area: object.area, shape: object.bbox, berths: [left, right], centers: [midpoint(left), midpoint(right)] };
  });
  const right = occupied.frame, left = shift(right, -crossing, 0);
  cargo.push({ ink: occupied.body.palette_value, area: occupied.body.area, shape: occupied.body.bbox,
    berths: [left, right], centers: [midpoint(left), midpoint(right)] });
  const bank: Bank = 0, banks = cargo.map((_, index): Bank => index === cargo.length - 1 ? 1 : 0);
  const initial = { actor: observed, bank, banks, held: null };
  const to = observed[0] + model.crossing.to - model.crossing.from;
  const graph = measureGraph(model, observed, observed[0], to, cargo);
  if (!graph) return null;
  const ferry = { model, graph, cargo, radius, pickup: span - 1, initial, firstFrame: observation.frame_hash };
  return { epoch: observation.level_epoch, ferry, at: initial, frame: observation.frame_hash, hazards: [], radius, rejected: [],
    refs: model.evidence, plan: [], stopped: false };
}

const positionKey = ({ actor, bank, banks, held }: Arrangement) => [key(actor), bank, banks.join(''), held].join('/');
const wins = (state: Arrangement) => state.held === null && state.bank === 1 && state.banks.every(bank => bank === 1);
const pairBank = (state: Arrangement, [a, b]: Hazard) => state.held !== a && state.held !== b && state.banks[a] === state.banks[b] ? state.banks[a]! : null;
function pairRange(state: Arrangement, ferry: Ferry, pair: Hazard, bank: Bank) {
  return Math.max(...pair.map(index => distance(state.actor, ferry.cargo[index]!.centers[bank])));
}

export function planGuardedFerry(run: GuardedFerry, remaining: number): FerryLeg[] | null {
  const { ferry, hazards, radius } = run;
  const seen = new Set([positionKey(run.at)]), rejected = new Set(run.rejected);
  type Node = { at: Arrangement; leg: FerryLeg | null; from: number; cost: number };
  const queue: Node[] = [{ at: run.at, leg: null, from: -1, cost: 0 }];
  for (let i = 0; i < queue.length && i < 30_000; i++) {
    const { at, cost } = queue[i]!;
    if (cost >= remaining) break;
    const moves: FerryLeg[] = Object.entries(ferry.graph[key(at.actor)] ?? {}).map(([input, actor]) => {
      const dx = ferry.model.motion[input]![0], crossed = Math.abs(actor[0] - at.actor[0]) > Math.abs(dx);
      return { input, role: crossed ? 'cross' : 'move', expect: { ...at, actor, bank: crossed ? otherBank(at.bank) : at.bank } };
    });
    if (at.held !== null) {
      const banks = [...at.banks];
      banks[at.held] = at.bank;
      moves.push({ input: ferry.model.interaction, role: 'release', expect: { ...at, banks, held: null } });
    } else {
      const close = ferry.cargo.flatMap((passenger, index) => {
        const [x, y] = passenger.centers[at.bank], length = Math.hypot(x - at.actor[0], y - at.actor[1]);
        return at.banks[index] === at.bank && length <= ferry.pickup ? [{ index, length }] : [];
      }).sort((a, b) => a.length - b.length);
      if (close[0] && close[0].length !== close[1]?.length)
        moves.push({ input: ferry.model.interaction, role: 'take', expect: { ...at, held: close[0].index } });
    }
    for (const leg of moves) {
      if (rejected.has(positionKey(at) + '/' + leg.input)) continue;
      if (wins(leg.expect)) {
        const plan = [leg];
        for (let current = queue[i]!; current.leg; current = queue[current.from]!) plan.push(current.leg);
        return plan.reverse();
      }
      if (hazards.some(pair => {
        const bank = pairBank(leg.expect, pair);
        return bank !== null && (bank !== leg.expect.bank || pairRange(leg.expect, ferry, pair, bank) > radius);
      })) continue;
      const id = positionKey(leg.expect);
      if (seen.has(id)) continue;
      seen.add(id);
      queue.push({ at: leg.expect, leg, from: i, cost: cost + 1 });
    }
  }
  return null;
}

const mass = (rows: NativeRows, [l, t, r, b]: NativeBox, ink: number) => {
  let count = 0;
  for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) if (rows[y]?.[x] === ink) count++;
  return count;
};

export function observeGuardedFerry(run: GuardedFerry, leg: FerryLeg, after: NativeObservation, rows: NativeRows,
  frames: readonly NativeRows[]) {
  const { ferry, at } = run, { expect, role } = leg;
  const actor = find_body(after, ferry.model.actor) as NativeEntity | null;
  if (!actor) return null;
  const observed = midpoint(actor.bbox);
  const retained = { ...run, frame: after.frame_hash, refs: [...run.refs.slice(-5), after.observation_ref] };
  if (positionKey(expect) !== positionKey(ferry.initial) && same(observed, ferry.initial.actor)
    && after.frame_hash === ferry.firstFrame && frames.length > 1) {
    const pairs: Hazard[] = [];
    for (let a = 0; a < ferry.cargo.length; a++) for (let b = a + 1; b < ferry.cargo.length; b++) {
      if (pairBank(expect, [a, b]) !== null) pairs.push([a, b]);
    }
    const learned = pairs.length === 1 ? pairs[0]! : null;
    const bank = learned ? pairBank(expect, learned) : null;
    const radius = learned && bank === expect.bank ? Math.min(run.radius, pairRange(expect, ferry, learned, bank) - 1) : run.radius;
    const hazards = learned && !run.hazards.some(pair => pairKey(pair) === pairKey(learned)) ? [...run.hazards, learned] : run.hazards;
    const { heldBox: _discarded, ...rest } = retained;
    return { run: { ...rest, at: ferry.initial, hazards, radius, plan: [],
      rejected: [...run.rejected, positionKey(at) + '/' + leg.input] }, reason: learned ? 'animated_reset_identified_an_unsafe_pair' : 'animated_reset_rejected_transition' };
  }
  if (!same(observed, expect.actor)) return null;
  let heldBox: NativeBox | undefined;
  if (expect.held !== null) {
    const passenger = ferry.cargo[expect.held]!, threshold = Math.ceil(passenger.area / 2);
    if (role === 'take') {
      const freeShape = shift(passenger.shape, passenger.centers[at.bank][0] - midpoint(passenger.shape)[0], 0);
      const candidates = after.entities.filter(p => p.palette_value === passenger.ink && p.area >= threshold
        && p.bbox[2] - p.bbox[0] <= passenger.shape[2] - passenger.shape[0] + 3 && distance(midpoint(p.bbox), observed) <= ferry.pickup + 4
        && !same(freeShape, p.bbox));
      if (candidates.length !== 1) return null;
      heldBox = candidates[0]!.bbox;
    } else if (run.heldBox) {
      const x = observed[0] - at.actor[0], y = observed[1] - at.actor[1];
      const before = midpoint(run.heldBox);
      heldBox = shift(run.heldBox, role === 'cross' ? x - 2 * (before[0] - at.actor[0]) : x, y);
      if (mass(rows, heldBox, passenger.ink) < threshold) return null;
    }
    if (!heldBox) return null;
  }
  if (!ferry.cargo.every((passenger, index) => {
    if (index === expect.held) return true;
    const bank = expect.banks[index]!, shape = shift(passenger.shape, passenger.centers[bank][0] - midpoint(passenger.shape)[0], 0);
    const [l, t, r, b] = shape;
    let hidden = 0;
    for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) {
      const point: NativeBox = [x, y, x, y];
      if (rows[y]?.[x] !== passenger.ink && (contains(actor.bbox, point) || heldBox && contains(heldBox, point))) hidden++;
    }
    return mass(rows, passenger.berths[bank], passenger.ink) + hidden >= Math.ceil(passenger.area / 2);
  })) return null;
  const { heldBox: _discarded, ...rest } = retained;
  return { run: { ...rest, at: expect, ...(heldBox ? { heldBox } : {}), plan: run.plan.slice(1) },
    reason: role === 'take' ? 'pickup_and_transport_offset_observed' : role === 'release' ? 'release_in_matching_berth_observed' : 'actor_and_cargo_positions_confirmed' };
}

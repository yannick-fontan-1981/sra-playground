import { geometricComponents, ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativeObservation, NativePoint, NativeProgramHandle, NativeProposal, NativeRows } from '../logos-engine/v6-native-types.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { sicNeedId } from './need-identity.ts';
import { selectTimedCompartment } from './timed-compartment-growth.ts';
import type { TimedCompartmentChoice } from './timed-compartment-growth.ts';

export const compartmentGrowthId = 'sic_verify_compartment_growth';

type Room = { box: NativeBox; index: number };
export type Gate = { point: NativePoint; rooms: readonly [number, number]; axis: NativePoint };
export type CompartmentLayout = { floor: number; rooms: Room[]; gates: Gate[] };
export type Inhabitant = { box: NativeBox; area: number; color: number; room: number };

function inside([x, y]: NativePoint, [l, t, r, b]: NativeBox): boolean {
  return x >= l && x <= r && y >= t && y <= b;
}

function includeOpenPartitions(layout: CompartmentLayout, rows: NativeRows, minimumSide = 8, maximumRooms = 16): CompartmentLayout {
  const { rooms, floor, gates } = layout;
  const sample = ({ point: [x, y], axis: [dx, dy] }: Gate, offset: number) => rows[y + dx * offset]?.[x + dy * offset];
  const styles = gates.flatMap(gate => {
    const wall = sample(gate, 4), shoulder = sample(gate, 3);
    return wall !== undefined && shoulder !== undefined && wall !== shoulder && wall !== floor && shoulder !== floor
      && sample(gate, -4) === wall && sample(gate, -3) === shoulder ? [{ wall, shoulder }] : [];
  });
  const apertures: Gate[] = [];
  const boxes = rooms.flatMap(({ box: [l, t, r, b] }) => {
    const partitions: { gate: Gate; boxes: NativeBox[] }[] = [];
    for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
      for (let y = t + minimumSide * dy; y <= b - minimumSide * dy; y++) for (let x = l + minimumSide * dx; x <= r - minimumSide * dx; x++) {
        const gate: Gate = { point: [x, y], axis: [dx, dy], rooms: [-1, -1] };
        if (![-2, -1, 0, 1, 2].every(offset => sample(gate, offset) === floor)) continue;
        const style = styles.find(({ wall, shoulder }) => sample(gate, -4) === wall && sample(gate, 4) === wall
          && sample(gate, -3) === shoulder && sample(gate, 3) === shoulder);
        if (!style) continue;
        const first = dx ? t - y : l - x, last = dx ? b - y : r - x;
        const strip = Array.from({ length: last - first + 1 }, (_, index) => index + first);
        if (!strip.every(offset => Math.abs(offset) <= 3 || sample(gate, offset) === style.wall)) continue;
        const next: NativeBox[] = dx ? [[l, t, x - 1, b], [x + 1, t, r, b]] : [[l, t, r, y - 1], [l, y + 1, r, b]];
        partitions.push({ gate, boxes: next });
      }
    }
    if (partitions.length !== 1) return [[l, t, r, b] as NativeBox];
    apertures.push(partitions[0]!.gate);
    return partitions[0]!.boxes;
  });
  if (!apertures.length || boxes.length > maximumRooms) return layout;
  const separated = boxes.map((box, index) => ({ box, index }));
  const connected = [...gates, ...apertures].flatMap((gate): Gate[] => {
    const [x, y] = gate.point, [dx, dy] = gate.axis;
    const left = separated.find(room => inside([x - dx, y - dy], room.box));
    const right = separated.find(room => inside([x + dx, y + dy], room.box));
    return left && right && left !== right ? [{ ...gate, rooms: [left.index, right.index] }] : [];
  });
  return connected.length === gates.length + apertures.length && gateRegion(0, connected).size === separated.length
    ? { floor, rooms: separated, gates: connected } : layout;
}

export function measureCompartments(rows: NativeRows): CompartmentLayout | null {
  const parts = geometricComponents(rows);
  const complete = (layout: CompartmentLayout, side?: number, limit?: number) => {
    const separated = includeOpenPartitions(layout, rows, side, limit);
    return completeCompartmentLattice(separated, rows, parts) ?? separated;
  };
  const rectangles = parts.filter(({ bbox: [l, t, r, b] }) =>
    l > 0 && t > 0 && r < (rows[0]?.length ?? 0) - 1 && b < rows.length - 1
    && r - l >= 7 && b - t >= 7);
  const interior = rectangles.filter(({ bbox: [l, t, r, b], area }) => area * 5 >= (r - l + 1) * (b - t + 1) * 4);
  const layouts = compartmentLayouts(rows, parts, interior);
  if (layouts.length) return layouts.length === 1 ? complete(layouts[0]!) : null;
  // Occupants can hide part of the floor. Recover a candidate only when its corners
  // are visible and the same gate markers still connect the whole layout.
  const occupied = rectangles.filter(part => {
    if (interior.includes(part)) return true;
    const { bbox: [l, t, r, b], area, color } = part;
    const corners: NativePoint[] = [[l, t], [r, t], [l, b], [r, b]];
    return corners.every(([x, y]) => rows[y]?.[x] === color)
      && area * 4 >= (r - l + 1) * (b - t + 1) * 3;
  });
  const recovered = compartmentLayouts(rows, parts, occupied);
  if (recovered.length) return recovered.length === 1 ? complete(recovered[0]!) : null;
  const clipped = parts.filter(({ bbox: [l, t, r, b], area }) =>
    l > 0 && t > 0 && r === (rows[0]?.length ?? 0) - 2 && b < rows.length - 1
    && r - l >= 4 && r - l < 7 && b - t >= 7 && area * 5 >= (r - l + 1) * (b - t + 1) * 4);
  if (!clipped.length) return null;
  const extended = compartmentLayouts(rows, parts, [...occupied, ...clipped], 32);
  return extended.length === 1 ? complete(extended[0]!, 5, 32) : null;
}

function completeCompartmentLattice(layout: CompartmentLayout, rows: NativeRows,
  parts: ReturnType<typeof geometricComponents>): CompartmentLayout | null {
  const { floor } = layout;
  const regions = parts.filter(({ color, bbox: [l, t, r, b], area }) => color === floor && l > 0 && t > 0
    && r < rows[0]!.length - 1 && b < rows.length - 1 && r - l >= 4 && b - t >= 4
    && area * 3 >= (r - l + 1) * (b - t + 1) * 2);
  const spans = (axis: 0 | 1) => {
    const groups = new Map<string, { start: number; end: number; positions: Set<number> }>();
    for (const { bbox } of regions) {
      const start = bbox[axis], end = bbox[axis + 2]!, key = start + ',' + end;
      const span = groups.get(key) ?? { start, end, positions: new Set<number>() };
      span.positions.add(bbox[1 - axis]!);
      groups.set(key, span);
    }
    return [...groups.values()].filter(span => span.positions.size >= 2).sort((a, b) => a.start - b.start);
  };
  const columns = spans(0), bands = spans(1), count = columns.length * bands.length;
  const consecutive = (values: ReturnType<typeof spans>) => values.length > 1
    && values.slice(1).every(({ start }, i) => start === values[i]!.end + 2);
  if (count <= layout.rooms.length || count > 32 || !consecutive(columns) || !consecutive(bands)) return null;
  const rooms: Room[] = bands.flatMap(({ start: t, end: b }, row) => columns.map(({ start: l, end: r }, col) =>
    ({ box: [l, t, r, b], index: row * columns.length + col })));
  if (rooms.some(({ box: [l, t, r, b] }) => {
    const visible = rows.slice(t, b + 1).flatMap(row => row.slice(l, r + 1)).filter(ink => ink === floor).length;
    return visible * 3 < (r - l + 1) * (b - t + 1) * 2;
  })) return null;
  const at = ({ point: [x, y], axis: [dx, dy] }: Gate, i: number) => rows[y + i * dx]?.[x + i * dy];
  const styles = layout.gates.flatMap(gate => {
    const mark = at(gate, 0), rim = at(gate, 1);
    return mark !== undefined && rim !== undefined && mark !== floor && rim !== floor && mark !== rim
      && [-2, -1, 2].every(i => at(gate, i) === rim) ? [{ mark, rim }] : [];
  });
  if (!styles.length) return null;
  const gates = rooms.flatMap(({ box: [l, t, r, b], index }) => {
    const col = index % columns.length, row = Math.floor(index / columns.length);
    const scan = (start: number, end: number, axis: NativePoint, next: number) =>
      Array.from({ length: end - start + 1 }, (_, i): Gate => ({
        point: axis[0] ? [r + 1, start + i] : [start + i, b + 1], axis, rooms: [index, next],
      })).filter(gate => styles.some(({ mark, rim }) => at(gate, 0) === mark && [-2, -1, 1, 2].every(i => at(gate, i) === rim))
        || layout.gates.some(prior => prior.point.every((value, i) => value === gate.point[i])
          && prior.axis.every((value, i) => value === gate.axis[i])));
    return [...(col + 1 < columns.length ? scan(t, b, [1, 0], index + 1) : []),
      ...(row + 1 < bands.length ? scan(l, r, [0, 1], index + columns.length) : [])];
  });
  if (gates.length > rooms.length * 2 || gateRegion(0, gates).size !== rooms.length) return null;
  return { floor, rooms, gates };
}

function compartmentLayouts(rows: NativeRows, parts: ReturnType<typeof geometricComponents>, interior: ReturnType<typeof geometricComponents>,
  maximumRooms = 16): CompartmentLayout[] {
  const floors = [...new Set(interior.map(part => part.color))];
  return floors.flatMap(floor => {
    const rooms = interior.filter(part => part.color === floor).map((part, index) => ({ box: part.bbox, index }));
    if (rooms.length < 3 || rooms.length > maximumRooms) return [];
    const byMarker = new Map<string, Gate[]>();
    for (const part of parts) {
      if (part.area !== 1 || part.color === floor) continue;
      const [x, y] = part.bbox;
      for (const axis of [[1, 0], [0, 1]] as const) {
        const [dx, dy] = axis;
        const left = rooms.find(room => inside([x - dx, y - dy], room.box));
        const right = rooms.find(room => inside([x + dx, y + dy], room.box));
        if (!left || !right || left === right) continue;
        const rim = rows[y - dx]?.[x + dy];
        if (rim === undefined || rim === part.color || rim === floor || rows[y + dx]?.[x - dy] !== rim
          || rows[y - 2 * dx]?.[x + 2 * dy] !== rim || rows[y + 2 * dx]?.[x - 2 * dy] !== rim) continue;
        const key = part.color + '/' + rim;
        const gates = byMarker.get(key) ?? [];
        gates.push({ point: [x, y], axis, rooms: [left.index, right.index] });
        byMarker.set(key, gates);
      }
    }
    return [...byMarker.values()].flatMap(gates => gates.length >= rooms.length - 1 && gates.length <= 2 * rooms.length
      && gateRegion(0, gates).size === rooms.length ? [{ rooms, floor, gates }] : []);
  });
}

export function gateRegion(origin: number, gates: readonly Gate[]): Set<number> {
  const seen = new Set([origin]), queue = [origin];
  for (const room of queue) for (const gate of gates) {
    if (!gate.rooms.includes(room)) continue;
    const next = gate.rooms.find(other => other !== room)!;
    if (seen.has(next)) continue;
    seen.add(next);
    queue.push(next);
  }
  return seen;
}

export function openGates(layout: CompartmentLayout, rows: NativeRows): Gate[] {
  return layout.gates.filter(gate => rows[gate.point[1]]?.[gate.point[0]] === layout.floor);
}

export function readInhabitants(layout: CompartmentLayout, rows: NativeRows): Inhabitant[] {
  return geometricComponents(rows).flatMap(({ bbox, area, color }) => {
    const [l, t, r, b] = bbox;
    if (color === layout.floor || r - l !== b - t || r - l > 6) return [];
    const room = layout.rooms.find(candidate => inside([l, t], candidate.box) && inside([r, b], candidate.box));
    if (!room || area === 1 && layout.gates.some(({ point: [x, y], axis: [dx, dy] }) =>
      Math.abs(l - x) <= dx + 3 * dy && Math.abs(t - y) <= dy + 3 * dx)) return [];
    return [{ box: bbox, area, color, room: room.index }];
  });
}

type Reusable = { food: number; starter: number; activated: number; grower: number; threshold: number; evidence: string[]; completed: number };
type Calibration = { layout: CompartmentLayout; threshold: number; feeding?: Pick<Reusable, 'food' | 'starter' | 'activated'> & { ref: string } };
type Choice = { gate: Gate; phase: 'feed' | 'grow' | 'connect'; focus: Inhabitant[]; threshold: Inhabitant };
type TurnMeter = { row: number; first: number; step: number; pending: number; spent: number; ref: string };
type Local = { epoch: number; layout: CompartmentLayout; evidence: string[]; stopped?: boolean; clockGate?: Gate; stagedGrowth?: boolean };
type Proposal = NativeProposal & { local: Local; choice: Choice | TimedCompartmentChoice; needId: string; food: number; grower: number;
  timing?: { meter: TurnMeter; turns: number } };

function learnMeter(layout: CompartmentLayout, before: NativeRows, after: NativeRows, ref: string): TurnMeter | null {
  const limit = Math.min(...layout.rooms.map(room => room.box[1]));
  for (let row = 0; row < limit; row++) {
    const line = before[row]!, next = after[row]!;
    const changes = line.flatMap((value, x) => next[x] !== value ? [x] : []);
    if (changes.length !== 1) continue;
    const at = changes[0]!, pending = line[at]!, spent = next[at]!;
    const marks = line.flatMap((value, x) => value === pending ? [x] : []);
    const step = marks.length > 1 ? marks[1]! - marks[0]! : 0;
    if (marks.length < 3 || step < 2 || !marks.every((x, i) => x === marks[0]! + i * step)) continue;
    return { row, first: marks[0]!, step, pending, spent, ref };
  }
  return null;
}

function readMeter(rows: NativeRows, meter: TurnMeter) {
  const line = rows[meter.row];
  if (!line) return null;
  let turns = 0, slots = 0, seenSpent = false;
  for (let x = meter.first; x < line.length; x += meter.step) {
    if (line[x] !== meter.pending && line[x] !== meter.spent) break;
    if (line[x] === meter.spent) seenSpent = true;
    else if (seenSpent) return null;
    else turns++;
    slots++;
  }
  return slots >= 3 ? turns : null;
}

function uniqueLargest(population: readonly Inhabitant[]): Inhabitant | undefined {
  const sorted = [...population].sort((a, b) => b.area - a.area);
  return sorted[0] && sorted[1] && sorted[0].area > sorted[1].area ? sorted[0] : undefined;
}

function learnFeeding(before: Inhabitant[], after: Inhabitant[], ref: string): Calibration['feeding'] {
  const smallest = Math.min(...before.map(sprite => sprite.area));
  const palette = [...new Set(before.filter(sprite => sprite.area === smallest).map(sprite => sprite.color))];
  const largestLoss = palette.map(color => ({ color, loss: before.filter(sprite => sprite.color === color).length
    - after.filter(sprite => sprite.color === color).length })).sort((a, b) => b.loss - a.loss);
  const food = largestLoss[0];
  const activated = [...new Set(after.filter(sprite => sprite.area === smallest && !palette.includes(sprite.color)).map(sprite => sprite.color))];
  if (!food || food.loss < 2 || food.loss <= (largestLoss[1]?.loss ?? 0) || activated.length !== 1) return undefined;
  const starter = palette.filter(color => color !== food.color);
  return starter.length === 1 ? { food: food.color, starter: starter[0]!, activated: activated[0]!, ref } : undefined;
}

export function selectCompartmentInteraction(layout: CompartmentLayout, rows: NativeRows, model: Reusable): Choice | null {
  const contents = readInhabitants(layout, rows);
  const threshold = contents.find(sprite => sprite.color === model.threshold);
  if (!threshold || contents.filter(sprite => sprite.color === model.threshold).length !== 1) return null;
  const open = openGates(layout, rows);
  const connected = gateRegion(threshold.room, open);
  const closed = layout.gates.filter(gate => !open.includes(gate));
  const growers = contents.filter(sprite => sprite.color === model.grower).sort((a, b) => b.area - a.area);
  const grower = growers[0];
  if (grower && grower.area >= threshold.area) {
    const source = gateRegion(grower.room, open);
    const gate = closed.find(candidate => candidate.rooms.some(room => source.has(room))
      && candidate.rooms.some(room => connected.has(room)));
    return gate ? { gate, phase: 'connect', focus: [grower], threshold } : null;
  }
  const food = contents.filter(sprite => sprite.color === model.food);
  const activated = contents.filter(sprite => sprite.color === model.activated);
  if (grower && growers.length >= 2) {
    const companion = growers.find(sprite => sprite !== grower && sprite.area <= grower.area
      && gateRegion(grower.room, open).has(sprite.room));
    if (!companion) return null;
    // A door outside the current interaction can release the next turn while
    // preserving the connectivity of both participants.
    const source = gateRegion(grower.room, open);
    const gate = closed.find(candidate => candidate.rooms.every(room => !source.has(room) && !connected.has(room)));
    return gate ? { gate, phase: 'grow', focus: [grower, companion], threshold } : null;
  }
  const candidates = activated.length ? activated : contents.filter(sprite => sprite.color === model.starter);
  const choices = closed.flatMap(gate => {
    if (gate.rooms.some(room => connected.has(room))) return [];
    const [a, b] = gate.rooms.map(room => gateRegion(room, open));
    if (!a || !b || a.has(gate.rooms[1])) return [];
    const pairs = [[a, b], [b, a]].map(([from, to]) => ({
      actors: candidates.filter(sprite => from!.has(sprite.room)), food: food.filter(sprite => to!.has(sprite.room)),
    }));
    return pairs.flatMap(pair => pair.actors.length && pair.food.length ? [{ gate, pair, score: pair.actors.length * pair.food.length }] : []);
  }).sort((a, b) => b.score - a.score);
  const next = choices[0];
  return next && next.score > (choices[1]?.score ?? 0)
    ? { gate: next.gate, phase: 'feed', focus: [...next.pair.actors, ...next.pair.food], threshold } : null;
}

function clickInterface(observation: NativeObservation): boolean {
  return observation.available_action_refs.includes('ACTION6')
    && !observation.available_action_refs.some(ref => /^ACTION[1-5]$/.test(ref));
}

export function assessCompartmentInteraction(proposal: Pick<Proposal, 'local' | 'choice' | 'food' | 'grower' | 'timing'>, before: NativeRows, after: NativeRows): string | null {
  const { layout } = proposal.local;
  const { choice } = proposal;
  const { gate, phase, focus } = choice;
  if ('expectedOpen' in choice) {
    const timing = proposal.timing;
    const flipped = openGates(layout, before).includes(gate) !== choice.expectedOpen
      && openGates(layout, after).includes(gate) === choice.expectedOpen;
    return flipped && timing && readMeter(after, timing.meter) === timing.turns - 1 ? 'door_changed_and_turn_spent' : null;
  }
  if (!openGates(layout, after).includes(gate)) return null;
  const previous = readInhabitants(layout, before), next = readInhabitants(layout, after);
  if (phase === 'feed') {
    const remainingFood = (population: Inhabitant[]) => population.filter(actor => actor.color === proposal.food).length;
    return remainingFood(next) < remainingFood(previous) ? 'gate_opened_and_observed_resource_consumed' : null;
  }
  if (phase === 'grow') {
    return next.some(actor => actor.color === proposal.grower && actor.area > Math.max(...focus.map(sprite => sprite.area)))
      ? 'growth_observed_after_remote_gate_opening' : null;
  }
  return null;
}

function observeCompartmentGate(calibration: Calibration, gate: Gate, before: NativeObservation, after: NativeObservation,
  first: NativeRows, second: NativeRows): { calibration: Calibration; model?: Reusable } {
  const { layout, feeding, threshold } = calibration, population = readInhabitants(layout, first);
  if (after.levels_completed > before.levels_completed) {
    const reference = population.find(sprite => sprite.color === threshold);
    if (!feeding || !reference) return { calibration };
    const open = openGates(layout, first), region = gateRegion(reference.room, [...open, gate]);
    if (gateRegion(reference.room, open).size === region.size) return { calibration };
    const candidates = population.filter(sprite => sprite.color !== threshold && sprite.area === reference.area && region.has(sprite.room));
    if (candidates.length !== 1) return { calibration };
    return { calibration, model: { food: feeding.food, starter: feeding.starter, activated: feeding.activated, grower: candidates[0]!.color,
      threshold, completed: after.levels_completed, evidence: [feeding.ref, before.observation_ref, after.observation_ref] } };
  }
  if (!feeding && openGates(layout, second).includes(gate)) {
    const observed = learnFeeding(population, readInhabitants(layout, second), after.observation_ref);
    if (observed) return { calibration: { ...calibration, feeding: observed } };
  }
  return { calibration };
}

export type CompartmentAcquisition = { epoch: number; calibration: Calibration | null; model?: Reusable };

export function acquireCompartmentReturn(prior: CompartmentAcquisition | undefined, before: NativeObservation, after: NativeObservation,
  command: NativeCommand, first: NativeRows, second: NativeRows): CompartmentAcquisition | undefined {
  if (!clickInterface(before) || command.action_ref !== 'ACTION6' || prior?.model?.completed === before.levels_completed) return prior;
  let local = prior;
  if (!local || local.epoch !== before.level_epoch) {
    const layout = measureCompartments(first), reference = layout && uniqueLargest(readInhabitants(layout, first));
    local = { epoch: before.level_epoch, calibration: layout && reference ? { layout, threshold: reference.color } : null };
  }
  if (!local.calibration) return local;
  const { layout } = local.calibration, { x, y } = command.data;
  if (x === undefined || y === undefined) return local;
  const gate = layout.gates.find(({ point: [gx, gy] }) => Math.abs(gx - x) <= 3 && Math.abs(gy - y) <= 3);
  if (!gate || openGates(layout, first).includes(gate)) return local;
  return { ...local, ...observeCompartmentGate(local.calibration, gate, before, after, first, second) };
}

export function createSicVerifyCompartmentGrowth(): NativeFamily<Proposal> {
  let calibration: Calibration | null = null;
  let measuredEpoch: number | null = null;
  let model: Reusable | null = null;
  let local: Local | null = null;
  let meter: TurnMeter | null = null;
  let choose: NativeProgramHandle | undefined;
  return {
    id: compartmentGrowthId,
    async attachPrograms(registry) { choose = await registry.registerProgram(chooseLanding, {}, await landingModule()); },
    observePublicOutcome(before, after, command, first, second) {
      if (!clickInterface(before) || command.action_ref !== 'ACTION6') return;
      if (measuredEpoch !== before.level_epoch) {
        measuredEpoch = before.level_epoch;
        const layout = measureCompartments(first);
        const threshold = layout && uniqueLargest(readInhabitants(layout, first));
        calibration = layout && threshold ? { layout, threshold: threshold.color } : null;
      }
      if (!calibration) return;
      const { layout } = calibration;
      const x = command.data.x, y = command.data.y;
      if (x === undefined || y === undefined) return;
      const gate = layout.gates.find(({ point: [gx, gy] }) => Math.abs(gx - x) <= 3 && Math.abs(gy - y) <= 3);
      if (!gate || openGates(layout, first).includes(gate)) return;
      if (!meter && before.level_epoch === after.level_epoch && openGates(layout, second).includes(gate)) {
        meter = learnMeter(layout, first, second, after.observation_ref);
      }
      const acquisition = observeCompartmentGate(calibration, gate, before, after, first, second);
      calibration = acquisition.calibration;
      if (acquisition.model) model = acquisition.model;
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !model || model.completed !== observation.levels_completed || !clickInterface(observation)) return null;
      const prior = local?.epoch === observation.level_epoch ? local : undefined;
      const layout = prior?.layout ?? measureCompartments(rows);
      if (!layout || prior?.stopped) return null;
      const turns = meter && readMeter(rows, meter);
      const timed = model.completed >= 2 && turns !== null
        ? selectTimedCompartment(layout, rows, model, Math.min(turns, remaining), prior?.clockGate, prior?.stagedGrowth) : null;
      const choice = timed ?? selectCompartmentInteraction(layout, rows, model);
      if (!choice) return null;
      const { point: [x, y] } = choice.gate;
      const ref = observation.observation_ref;
      const timeRef = timed && meter ? [meter.ref] : [];
      const evidence: [string, ...string[]] = [ref, ...new Set([...(prior?.evidence ?? []), ...model.evidence, ...timeRef].filter(value => value !== ref))];
      const mode = execution?.reasoningMode ?? 'assimilation';
      const repeat = choice.phase === 'advance_encounter' && !!prior?.clockGate;
      const routeSupported = !!prior && !repeat;
      const situation = { routeSupported, eligibleProbe: !routeSupported && !repeat, knownInteraction: repeat, mode };
      const strategy = repeat ? 'P02' : routeSupported ? 'P07' : 'P05';
      const decision = await choose?.run({ situation }, { signal: execution?.signal });
      if (decision?.result !== strategy) return null;
      const action = { action_ref: 'ACTION6', data: { x, y } };
      const target = await ObservedInputDomain.makeLocusWitness(observation, rows, [x, y], { reason: 'Repeated latch between two observed compartments', evidence });
      if (!target) return null;
      const parent = 'G_official_completion';
      const goal = { kind: 'enable_observed_autonomous_interaction', scope: ref.split(':revision:', 1)[0]!,
        subjects: choice.focus.map(sprite => sprite.box.join(',')), parentObjective: parent,
        satisfactionContract: 'growth_or_official_completion_observed' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = compartmentGrowthId + ':' + need.id;
      const reason = {
        connect: 'The grown sprite matches the size of the isolated reference. Open a route between them.',
        grow: 'Two growth candidates share a compartment. Open a remote gate and check whether the candidates change.',
        feed: 'Open access between the feeding group and the resources, keeping the larger sprite isolated.',
        feed_route: 'Open the next passage toward resources that the small sprites can reach.',
        join_candidates: 'Connect the groups so a growing sprite can reach other participants.',
        prepare_route: 'Prepare access to larger resources while allowing the growth group another turn.',
        stage_growth: 'Open the next passage to a reachable participant in the growing sprite’s approach. Check how each sprite changes.',
        advance_growth: 'Spend one turn without breaking access to the next participant. Check whether the growing sprite increases in size.',
        open_encounter: 'Connect the prepared route when the growing sprite reaches the required size.',
        advance_encounter: 'Pay for another turn through a gate that preserves access between the two sprites.',
      }[choice.phase];
      return { status: 'proposed', kind: compartmentGrowthId, local: prior ?? { epoch: observation.level_epoch, layout, evidence: [] },
        choice, needId: need.id, food: model.food, grower: model.grower, actions: [action],
        ...(timed && meter && turns !== null ? { timing: { meter, turns } } : {}),
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, steps: [{ action, point_binding: target, expected_after: null }],
        sicSituationCard: { strategy, need: 'Grow a sprite before opening access to the isolated reference', situation: reason,
          evidence, agenda: [], mode, triggerCard: chooseLanding, target: [x, y, x, y], focus: choice.focus.map(sprite => sprite.box),
          threshold: choice.threshold.box, ...(timed ? { turnsLeft: turns, gateOpens: timed.expectedOpen,
            plannedGates: timed.route.map(gate => { const [x, y] = gate.point; return [x, y, x, y]; }) } : {}) },
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation },
        question: { reason, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: reason, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label: reason, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: reason,
          preconditions: {}, preserve_refs: [], evidence, actions: [action], outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'compartment_gate_bound' : 'compartment_observation_changed' };
    },
    after(proposal, _index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const effect = assessCompartmentInteraction(proposal, first, second);
      return { matched: effect !== null, seal_prefix: true, reason: effect ?? 'compartment_interaction_unconfirmed' };
    },
    record(before, after, _action, first, second, proposal) {
      if (model?.completed === before.levels_completed && after.levels_completed > before.levels_completed) {
        model = { ...model, completed: after.levels_completed,
          evidence: [...model.evidence.slice(-4), before.observation_ref, after.observation_ref] };
      } else if (before.level_epoch === after.level_epoch) {
        const confirmed = assessCompartmentInteraction(proposal, first, second);
        const phase = proposal.choice.phase;
        const stagedGrowth = phase === 'stage_growth' || phase === 'advance_growth';
        local = { ...proposal.local, evidence: [...proposal.local.evidence, after.observation_ref].slice(-4),
          stopped: !confirmed, stagedGrowth: !!confirmed && stagedGrowth,
          ...(phase === 'advance_encounter' ? { clockGate: proposal.choice.gate } : {}) };
        if (confirmed && stagedGrowth) {
          const area = proposal.choice.focus[0]?.area ?? 0;
          const grown = readInhabitants(proposal.local.layout, second).some(sprite => sprite.color === proposal.grower && sprite.area > area);
          return { events: [], reviewEvidence: grown ? 'The return shows a larger sprite in the observed growth state'
            : 'The passage changed and the turn was spent. Growth remains unconfirmed.' };
        }
      }
      return { events: [] };
    },
    state: () => ({ calibration, measuredEpoch, model, local, meter }),
    restore(state) {
      calibration = (state.calibration as Calibration | undefined) ?? null;
      measuredEpoch = (state.measuredEpoch as number | undefined) ?? null;
      model = (state.model as Reusable | undefined) ?? null;
      local = (state.local as Local | undefined) ?? null;
      meter = (state.meter as TurnMeter | undefined) ?? null;
    },
  };
}

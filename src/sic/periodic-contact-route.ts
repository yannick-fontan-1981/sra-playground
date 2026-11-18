import type { NativeBox, NativeObservation, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import type { ContactCalibration, Direction } from './rectangular-contact-route.ts';
import { fittedOutline, maskedParts } from './rectangular-contact-route.ts';
import { createPeriodicPayloadProjection } from './periodic-payload-motion.ts';

type Axis = 0 | 1;
type Source = { size: NativePoint; axis: Axis; inks: NativePoint; unmeasuredAxis?: true };
type Rhythm = { side: Axis; period: number | null; reach: number | null };
export type PeriodicPose = { actor: number; sources: number[]; phases: number[]; payloads?: number[] };
type Payload = { mask: NativePoint[]; ink: number; goal: number };
export type PeriodicContactMove = { direction: Direction; pose: PeriodicPose; contact: number | null; automatic: number[]; payloadContact?: number };
export type PeriodicContactRoute = {
  epoch: number; step: number; origin: NativePoint; size: NativePoint; field: number[]; goal: number;
  actorInk: number; actorMarker: number; sources: Source[]; calibration: ContactCalibration;
  splits: number[]; rhythms: (Rhythm | null)[]; pose: PeriodicPose; evidence: string[]; payloads?: Payload[];
  observedControls: Readonly<Record<string, string>>; stopped: boolean; samples: number;
};

const boxSize = ([l, t, r, b]: NativeBox): NativePoint => [r - l + 1, b - t + 1];
const contains = ([l, t, r, b]: NativeBox, x: number, y: number) => x >= l && x <= r && y >= t && y <= b;
const overlaps = (a: NativeBox, b: NativeBox) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
const frequencies = (values: Iterable<number>) => {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]);
};

export function periodicContactBox(scene: Pick<PeriodicContactRoute, 'size' | 'origin' | 'step'>,
  cell: number, shape: NativePoint = [1, 1]): NativeBox {
  const x = scene.origin[0] + cell % scene.size[0] * scene.step;
  const y = scene.origin[1] + Math.floor(cell / scene.size[0]) * scene.step;
  return [x, y, x + shape[0] * scene.step - 1, y + shape[1] * scene.step - 1];
}

function boxValues(rows: NativeRows, [l, t, r, b]: NativeBox): number[] {
  return rows.slice(t, b + 1).flatMap(row => row.slice(l, r + 1));
}

export function measurePeriodicContact(observation: NativeObservation, rows: NativeRows, calibration: ContactCalibration,
  actorInk: number, actorMarker: number, observedControls: Readonly<Record<string, string>>,
  previous?: PeriodicContactRoute): PeriodicContactRoute | null {
  const { pitch: step, band } = calibration;
  const actor = observation.entities.filter(part => part.palette_value === actorInk && boxSize(part.bbox).every(n => n === step)
    && part.area === step * step - 1 && boxValues(rows, part.bbox).every(ink => ink === actorInk || ink === actorMarker));
  if (step < 2 || actor.length !== 1) return null;
  const actorBox = actor[0]!.bbox, origin = [actorBox[0] % step, actorBox[1] % step] as const;
  const size = [Math.floor((rows[0]!.length - origin[0]) / step), Math.floor((rows.length - origin[1]) / step)] as const;
  const grid = { step, origin, size };
  const cells = Array.from({ length: size[0] * size[1] }, (_, i) => periodicContactBox(grid, i));
  const floor = frequencies(cells.map(box => rows[box[1] + Math.floor(step / 2)]![box[0] + Math.floor(step / 2)]!))[0]?.[0];
  if (floor === undefined || floor === band || floor === actorInk || !cells.some(box => boxValues(rows, box).every(ink => ink === band))) return null;
  const solid = observation.entities.filter(part => ![floor, band, actorInk, actorMarker].includes(part.palette_value)
    && part.area === boxSize(part.bbox)[0] * boxSize(part.bbox)[1]);
  const matches: { at: number; box: NativeBox; source: Source; split: number }[] = [];
  for (const a of solid) for (const b of solid) {
    if (a.palette_value === b.palette_value) continue;
    for (const axis of [0, 1] as const) {
      const cross = axis === 0 ? 1 : 0;
      if (a.bbox[axis + 2]! + 1 !== b.bbox[axis] || a.bbox[cross] !== b.bbox[cross] || a.bbox[cross + 2] !== b.bbox[cross + 2]) continue;
      const box = [a.bbox[0], a.bbox[1], b.bbox[2], b.bbox[3]] as const;
      const [w, h] = boxSize(box);
      const at = cells.findIndex(cell => cell[0] === box[0] && cell[1] === box[1]);
      if (at < 0 || w % step || h % step || w < step || h < step || w * h > step * step * 16) continue;
      matches.push({ at, box, source: { size: [w / step, h / step], axis, inks: [a.palette_value, b.palette_value] }, split: boxSize(a.bbox)[axis] });
    }
  }
  const groups = new Map<string, typeof matches>();
  for (const match of matches) {
    const key = [...match.source.inks].sort((a, b) => a - b).join(',');
    const group = groups.get(key) ?? [];
    group.push(match);
    groups.set(key, group);
  }
  const repeated = [...groups.values()].filter(group => group.length >= 2 && group.length <= 4
    && group.every((item, i) => group.slice(i + 1).every(other => !overlaps(item.box, other.box))));
  const resting = previous && calibratedPeriodicContact(previous) ? solid.flatMap(part => {
    const [w, h] = boxSize(part.bbox);
    const at = cells.findIndex(box => box[0] === part.bbox[0] && box[1] === part.bbox[1]);
    const compatible = previous.sources.filter(source => source.inks.includes(part.palette_value)
      && source.size[0] * step === w && source.size[1] * step === h);
    const other = new Set(compatible.flatMap(source => source.inks.filter(ink => ink !== part.palette_value)));
    if (at < 0 || other.size !== 1) return [];
    const source: Source = { size: [w / step, h / step], axis: 1, inks: [part.palette_value, [...other][0]!], unmeasuredAxis: true };
    return [{ at, box: part.bbox, source, split: h }];
  }) : [];
  const observed = repeated.length === 1 ? repeated[0]! : repeated.length === 0 && resting.length >= 2 && resting.length <= 4 ? resting : [];
  if (!observed.length) return null;
  const sources = observed.sort((a, b) => a.at - b.at);
  const covered = (x: number, y: number) => sources.some(source => contains(source.box, x, y));
  const ring = (box: NativeBox) => {
    const [l, t, r, b] = box;
    const out: NativePoint[] = [];
    for (let x = l - 1; x <= r + 1; x++) out.push([x, t - 1], [x, b + 1]);
    for (let y = t; y <= b; y++) out.push([l - 1, y], [r + 1, y]);
    return out.filter(([x, y]) => !covered(x, y));
  };
  const goals = cells.flatMap((box, i) => {
    if (!boxValues(rows, box).every(ink => ink === floor)) return [];
    const outline = ring(box), inks = new Set(outline.map(([x, y]) => rows[y]?.[x]));
    const [ink] = inks;
    return outline.length >= 3 * step + 4 && inks.size === 1 && ink !== undefined
      && ![floor, band, actorInk, actorMarker, ...sources.flatMap(source => source.source.inks)].includes(ink) ? [{ i, outline }] : [];
  });
  if (goals.length !== 1) return null;
  const { i: goal, outline } = goals[0]!;
  const excluded = new Set(outline.map(point => point.join(',')));
  const parts = previous ? maskedParts(observation.entities, step, box => cells.some(cell => cell[0] === box[0] && cell[1] === box[1])) : [];
  const targets = parts.flatMap(target => {
    if (target.paint !== floor || target.mask.length <= 1) return [];
    const shape = fittedOutline(observation.entities, target, step);
    return shape ? [{ target, shape }] : [];
  });
  const payloads = targets.flatMap(({ target, shape }) => {
    const candidates = parts.filter(part => part.signature === target.signature && part.paint !== floor && part.paint !== band
      && part.paint !== actorInk && part.paint !== actorMarker && !sources.some(source => overlaps(source.box, part.box)));
    if (candidates.length !== 1) return [];
    for (const [x, y] of shape.mask) excluded.add([shape.bbox[0] + x, shape.bbox[1] + y].join(','));
    return [{ ...candidates[0]!, target: cells.findIndex(cell => cell[0] === target.box[0] && cell[1] === target.box[1]) }];
  });
  if (payloads.length !== targets.length
    || payloads.some((part, i) => part.target < 0 || payloads.slice(0, i).some(other => overlaps(other.box, part.box)))) return null;
  const payloadCells = new Set(payloads.flatMap(part => part.mask.map(([x, y]) => [part.box[0] + x * step, part.box[1] + y * step].join(','))));
  const field = cells.map(([l, t, r, b]) => {
    const values: number[] = [];
    for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) {
      if (!excluded.has([x, y].join(','))) values.push(covered(x, y) || contains(actorBox, x, y)
        || payloadCells.has([l, t].join(',')) ? floor : rows[y]![x]!);
    }
    return values.every(ink => ink === floor) ? 0 : values.every(ink => ink === band) ? 1 : 2;
  });
  const cell = cells.findIndex(box => box[0] === actorBox[0] && box[1] === actorBox[1]);
  return { ...grid, epoch: observation.level_epoch, field, goal, actorInk, actorMarker, calibration, observedControls,
    sources: sources.map(item => item.source), splits: sources.map(item => item.split), rhythms: sources.map(() => null),
    ...(payloads.length ? { payloads: payloads.map(item => ({ mask: item.mask, ink: item.paint, goal: item.target })) } : {}),
    pose: { actor: cell, sources: sources.map(item => item.at), phases: sources.map(() => 0),
      ...(payloads.length ? { payloads: payloads.map(item => cells.findIndex(cell => cell[0] === item.box[0] && cell[1] === item.box[1])) } : {}) },
    evidence: [calibration.evidence], stopped: false, samples: 0 };
}

function readSplit(rows: NativeRows, source: Source, box: NativeBox): number | null {
  const [l, t, r, b] = box;
  const [low, high] = source.inks;
  let length = 0, ended = false;
  for (let p = box[source.axis]; p <= box[source.axis + 2]!; p++) {
    const line = source.axis === 0 ? boxValues(rows, [p, t, p, b]) : boxValues(rows, [l, p, r, p]);
    if (!ended && line.every(ink => ink === low)) length++;
    else if (line.every(ink => ink === high)) ended = true;
    else return null;
  }
  return length;
}

function measureSourceAxis(rows: NativeRows, previous: Source, box: NativeBox, step: number) {
  const [idle, rising] = previous.inks;
  const candidates = ([0, 1] as const).flatMap(axis => ([[idle, rising], [rising, idle]] as const).flatMap(inks => {
    const source: Source = { size: previous.size, axis, inks };
    const split = readSplit(rows, source, box), extent = source.size[axis] * step;
    return split !== null && split > 0 && split < extent ? [{ source, split, before: inks[0] === idle ? extent : 0 }] : [];
  }));
  return candidates.length === 1 ? candidates[0]! : null;
}

function observedReach(frames: readonly NativeRows[], source: Source, box: NativeBox, side: Axis, step: number) {
  const ink = source.inks[side], axis = source.axis;
  const spans = frames.map(rows => {
    const sign = side === 0 ? 1 : -1;
    const front = sign > 0 ? box[axis + 2]! : box[axis];
    for (let length = 1; length <= Math.max(rows.length, rows[0]!.length); length++) {
      const p = front + sign * length;
      if (axis === 0 && (p < 0 || p >= rows[0]!.length) || axis === 1 && (p < 0 || p >= rows.length)) return length - 1;
      const span = axis === 0 ? boxValues(rows, [p, box[1], p, box[3]]) : boxValues(rows, [box[0], p, box[2], p]);
      if (!span.length || span.some(value => value !== ink)) return length - 1;
    }
    return 0;
  });
  const length = Math.max(0, ...spans);
  return length > 0 && length % step === 0 ? length / step : null;
}

const phaseAt = (source: Source, side: Axis, step: number, split: number) => side === 0 ? split : source.size[source.axis] * step - split;
export const calibratedPeriodicContact = (route: PeriodicContactRoute) => route.rhythms.every(item => item?.period && item.reach);

function actorAt(route: PeriodicContactRoute, rows: NativeRows, at: number, pose = route.pose) {
  const values = boxValues(rows, periodicContactBox(route, at));
  const visible = values.filter(ink => ink === route.actorInk).length;
  if (!visible || visible === values.length || values.some(ink => ink !== route.actorInk && ink !== route.actorMarker)) return false;
  if (visible > values.length / 2) return true;
  if (!route.payloads || !pose.payloads) return false;
  const [x, y] = periodicContactBox(route, at);
  const touches = (u: number, v: number) => route.payloads!.some(({ mask }, i) => {
    const [l, t] = periodicContactBox(route, pose.payloads![i]!);
    return mask.some(([dx, dy]) => l + dx * route.step === u && t + dy * route.step === v);
  }) || route.sources.some((source, i) => contains(periodicContactBox(route, pose.sources[i]!, source.size), u, v));
  const left = touches(x - route.step, y), right = touches(x + route.step, y);
  const above = touches(x, y - route.step), below = touches(x, y + route.step);
  const edge = route.step - 1;
  const interiorMarkers = values.filter((ink, i) => ink === route.actorMarker
    && !(left && i % route.step === 0 || right && i % route.step === edge
      || above && i < route.step || below && i >= edge * route.step));
  return interiorMarkers.length <= 1;
}

function payloadsAt(route: PeriodicContactRoute, rows: NativeRows, pose: PeriodicPose) {
  return (route.payloads ?? []).every(({ mask, ink }, i) => {
    const at = pose.payloads?.[i];
    if (at === undefined) return false;
    const [l, t] = periodicContactBox(route, at);
    return mask.every(([x, y]) => {
      const u = l + x * route.step, v = t + y * route.step;
      return boxValues(rows, [u, v, u + route.step - 1, v + route.step - 1]).every(value => value === ink);
    });
  });
}

export function matchesPeriodicContact(route: PeriodicContactRoute, rows: NativeRows) {
  return actorAt(route, rows, route.pose.actor) && payloadsAt(route, rows, route.pose) && route.sources.every((source, i) =>
    readSplit(rows, source, periodicContactBox(route, route.pose.sources[i]!, source.size)) === route.splits[i]);
}

export function projectPeriodicSnapshot(route: PeriodicContactRoute, move: PeriodicContactMove): PeriodicContactRoute {
  // The runtime records a series only when it seals. Intermediate guards bind
  // the already confirmed projection rather than a stale retained snapshot.
  const splits = route.sources.map((source, i) => phaseAt(source, route.rhythms[i]!.side, route.step, move.pose.phases[i]!));
  return { ...route, pose: move.pose, splits };
}

export function observePeriodicContact(route: PeriodicContactRoute, rows: NativeRows, frames: readonly NativeRows[],
  evidence: string, prediction?: PeriodicContactMove): PeriodicContactRoute | null {
  const sources = prediction?.pose.sources ?? route.pose.sources;
  const known = route.rhythms;
  const rhythms: (Rhythm | null)[] = [], splits: number[] = [], phases: number[] = [];
  const forms: Source[] = [];
  for (const [i, prior] of route.sources.entries()) {
    const box = periodicContactBox(route, sources[i]!, prior.size);
    const axis = prior.unmeasuredAxis ? measureSourceAxis(rows, prior, box, route.step) : null;
    if (prior.unmeasuredAxis && !axis) return null;
    const source = axis?.source ?? prior;
    const split = axis?.split ?? readSplit(rows, source, box);
    if (split === null) return null;
    forms.push(source);
    splits.push(split);
    const previous = known[i];
    const options = (previous ? [previous.side] : [0, 1] as const).flatMap(side => {
      const before = phaseAt(source, side, route.step, axis?.before ?? route.splits[i]!);
      const phase = phaseAt(source, side, route.step, split);
      if (prediction && phase !== prediction.pose.phases[i]) return [];
      const wrapped = phase === 0 && before > 0;
      if (previous?.period && phase !== (before + 1) % previous.period) return [];
      if (!previous?.period && phase !== before + 1 && !wrapped) return [];
      const reach = wrapped && !previous?.reach ? observedReach(frames, source, box, side, route.step) : previous?.reach ?? null;
      if (wrapped && !reach && !previous?.period) return [];
      return [{ rhythm: { side, period: previous?.period ?? (wrapped ? before + 1 : null), reach }, phase }];
    });
    if (options.length > 1 && previous) return null;
    rhythms.push(options.length === 1 ? options[0]!.rhythm : previous ?? null);
    phases.push(options.length === 1 ? options[0]!.phase : 0);
    if (previous && !options.length) return null;
  }
  const candidates = prediction ? [prediction.pose.actor] : Array.from({ length: route.field.length }, (_, i) => i);
  const payloads = prediction?.pose.payloads ?? route.pose.payloads;
  const actor = candidates.filter(at => actorAt(route, rows, at, { actor: at, sources, phases, ...(payloads ? { payloads } : {}) }));
  if (actor.length !== 1) return null;
  const pose = { actor: actor[0]!, sources, phases, ...(payloads ? { payloads } : {}) };
  if (!payloadsAt(route, rows, pose)) return null;
  return { ...route, sources: forms, splits, rhythms, pose, samples: route.samples + Number(!prediction),
    evidence: [...new Set([route.calibration.evidence, ...route.evidence.slice(-5), evidence])] };
}

type CellBox = readonly [left: number, top: number, right: number, bottom: number];
function contactProjector(route: PeriodicContactRoute, timed: boolean) {
  const [w, h] = route.size;
  const point = (cell: number): NativePoint => [cell % w, Math.floor(cell / w)];
  const index = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h ? y * w + x : -1;
  const shift = (at: number, [, dx, dy]: Direction) => {
    const [x, y] = point(at);
    return index(x + dx, y + dy);
  };
  const box = (cell: number, [width, height]: NativePoint): CellBox => {
    const [x, y] = point(cell);
    return [x, y, x + width - 1, y + height - 1];
  };
  const terrain = (bounds: CellBox) => {
    let band = false;
    for (let y = bounds[1]; y <= bounds[3]; y++) for (let x = bounds[0]; x <= bounds[2]; x++) {
      const value = route.field[index(x, y)];
      if (value === undefined || value === 2) return 2;
      band ||= value === 1;
    }
    return Number(band);
  };
  const footprints = route.sources.map(source => route.field.map((_, at) => box(at, source.size)));
  const terrainBySource = footprints.map(candidates => candidates.map(terrain));
  return (pose: PeriodicPose, direction: Direction): PeriodicContactMove | null => {
    const places = [...pose.sources], phases = [...pose.phases], automatic: number[] = [];
    let actor = pose.actor, contact: number | null = null;
    const next = shift(actor, direction);
    if (route.field[next] === 0) {
      const [x, y] = point(next);
      const hit = places.findIndex((at, i) => contains(footprints[i]![at]!, x, y));
      if (hit === -1) actor = next;
      else {
        const from = places[hit]!;
        let at = from, travel = 0;
        while (travel < route.calibration.steps || terrainBySource[hit]![at] === 1) {
          const target = shift(at, direction), area = footprints[hit]![target];
          if (!area || terrainBySource[hit]![target] === 2 || places.some((position, i) => i !== hit && overlaps(area, footprints[i]![position]!))) break;
          at = target;
          travel++;
        }
        if (terrainBySource[hit]![at] === 0 && at !== from) {
          contact = hit;
          places[hit] = at;
        }
      }
    }
    if (timed) for (const [i, source] of route.sources.entries()) {
      const rhythm = route.rhythms[i]!;
      phases[i] = (phases[i]! + 1) % rhythm.period!;
      if (phases[i] !== 0) continue;
      const base = footprints[i]![places[i]!]!, sign = rhythm.side === 0 ? 1 : -1;
      const push = (source.axis === 0 ? ['', sign, 0] : ['', 0, sign]) as Direction;
      const front = sign > 0 ? base[source.axis + 2]! : base[source.axis];
      for (let length = 1; length <= rhythm.reach!; length++) {
        const p = front + length * sign;
        const edge: CellBox = source.axis === 0 ? [p, base[1], p, base[3]] : [base[0], p, base[2], p];
        if (places.some((at, j) => j !== i && overlaps(edge, footprints[j]![at]!))) return null;
        const [x, y] = point(actor);
        if (!contains(edge, x, y)) continue;
        const destination = shift(actor, push);
        const [dx, dy] = point(destination);
        if (route.field[destination] !== 0 || places.some((at, j) => contains(footprints[j]![at]!, dx, dy))) return null;
        actor = destination;
        if (!automatic.includes(i)) automatic.push(i);
      }
    }
    return { direction, pose: { actor, sources: places, phases }, contact, automatic };
  };
}

export function planPeriodicContact(route: PeriodicContactRoute, directions: readonly Direction[], limit: number) {
  const timed = calibratedPeriodicContact(route);
  const project = route.payloads ? createPeriodicPayloadProjection(route, timed) : contactProjector(route, timed);
  type Node = { pose: PeriodicPose; depth: number; incoming?: PeriodicContactMove; parent?: Node };
  const key = ({ actor, sources, phases, payloads }: PeriodicPose) => [actor, ...sources, ...phases, ...(payloads ?? [])].join(',');
  const queue: Node[] = [{ pose: route.pose, depth: 0 }];
  const seen = new Set([key(route.pose)]);
  const allowed = directions.filter(([id]) => Object.hasOwn(route.observedControls, id));
  for (let i = 0; i < queue.length && i < (route.payloads ? 200_000 : 40_000); i++) {
    const node = queue[i]!;
    if (node.pose.actor === route.goal && node.parent
      && (route.payloads ?? []).every((part, i) => part.goal === node.pose.payloads?.[i])) {
      const moves: PeriodicContactMove[] = [];
      for (let next: Node | undefined = node; next?.incoming; next = next.parent) moves.push(next.incoming);
      return moves.reverse();
    }
    if (node.depth >= limit) continue;
    for (const direction of allowed) {
      const move = project(node.pose, direction);
      if (!move || seen.has(key(move.pose))) continue;
      seen.add(key(move.pose));
      queue.push({ pose: move.pose, incoming: move, parent: node, depth: node.depth + 1 });
    }
  }
  return [];
}

export function choosePeriodicSample(route: PeriodicContactRoute, path: readonly PeriodicContactMove[], directions: readonly Direction[]) {
  const first = path[0];
  if (first && first.contact === null && first.payloadContact === undefined) return first;
  const project = route.payloads ? createPeriodicPayloadProjection(route, false) : contactProjector(route, false);
  const alternatives = directions.flatMap(direction => {
    const move = project(route.pose, direction);
    return move && move.contact === null && move.payloadContact === undefined
      && Object.hasOwn(route.observedControls, direction[0]) ? [move] : [];
  });
  return alternatives.find(move => move.pose.actor === route.pose.actor) ?? alternatives[0] ?? null;
}

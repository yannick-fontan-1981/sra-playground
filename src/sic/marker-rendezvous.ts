import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import { markerDirections, readCounter, readPreparationBlocks } from './observed-marker-field.ts';

type Scene = { sites: string[]; pitch: number; actorColor: number; groundColor: number; markerColor: number; tag: number; size: number;
  fixed: NativePoint[]; counter: NativeBox[]; preparation: NativeBox[] };
type Cycle = { positions: NativePoint[]; phase: number };
export type RendezvousField = { epoch: number; scene: Scene; at: NativePoint; history: NativePoint[]; cycle: Cycle | null;
  fixedTested: string[]; evidence: string[]; movements: string[]; count: number; stopped: boolean;
  initialCounter: string[]; counter: string[]; initialPreparation: string[];
  prepared: { at: NativePoint; kind: 'fixed' | 'mobile' } | null; mobileAcquired?: true };
export type RendezvousStep = { command: NativeCommand; landing: NativePoint | null; at: NativePoint;
  target: NativePoint; kind: 'fixed' | 'mobile' | 'observe'; finish?: true; window?: true };
type Readout = { at: NativePoint; moving: NativePoint | null; counter: string[]; prepared: number };
type Return = { kind: 'moved' | 'waited' | 'tested' | 'prepared' | 'acquired' | 'contradicted'; observed: Readout | null };
const key = (point: NativePoint) => point.join(',');
const point = (value: string) => value.split(',').map(Number) as [number, number];
const same = (a: NativePoint, b: NativePoint) => key(a) === key(b);
const center = ([l, t, r, b]: NativeBox): NativePoint => [(l + r) / 2, (t + b) / 2];
const inside = ([l, t, r, b]: NativeBox, [u, v, x, y]: NativeBox) => l <= u && t <= v && r >= x && b >= y;
const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : Math.abs(a);
const measureBlocks = (boxes: NativeBox[], rows: NativeRows) => boxes.map(([l, t, r, b]) =>
  JSON.stringify(rows.slice(t, b + 1).map(row => row.slice(l, r + 1))));
const different = (a: string[], b: string[]) => a.filter((block, i) => block !== b[i]).length;

function taggedMarker(rows: NativeRows, at: NativePoint, size: number, markerColor: number, actorColor: number): number | null {
  const m = (size - 1) / 2, [x, y] = at;
  const tag = rows[y - m]?.[x - m];
  if (tag === undefined || tag === markerColor || tag === actorColor) return null;
  for (let dy = -m; dy <= m; dy++) for (let dx = -m; dx <= m; dx++) {
    if (dx === -m && dy === -m) continue;
    const value = rows[y + dy]?.[x + dx];
    if (value !== markerColor && (dx !== 0 || dy !== 0 || value !== actorColor)) return null;
  }
  return tag;
}

export function readRendezvousField(rows: NativeRows, epoch: number, evidence: string[], movements: string[]): RendezvousField | null {
  const parts = geometricComponents(rows), groups = new Map<string, typeof parts>();
  for (const part of parts) {
    const [l, t, r, b] = part.bbox, size = r - l + 1;
    if (!part.rectangular || size < 3 || size > 5 || size % 2 === 0 || b - t + 1 !== size) continue;
    const id = part.color + '/' + size, group = groups.get(id) ?? [];
    group.push(part);
    groups.set(id, group);
  }
  const candidates: RendezvousField[] = [];
  for (const group of groups.values()) {
    if (group.length < 3 || group.length > 8) continue;
    const first = group[0]!, size = first.bbox[2] - first.bbox[0] + 1;
    const fixed = group.map(part => center(part.bbox)), [ox, oy] = fixed[0]!;
    const pitch = fixed.flatMap(([x, y]) => [x - ox, y - oy]).reduce(gcd, 0);
    if (pitch <= size || pitch > 2 * size || pitch % 2 === 0) continue;
    const leastArea = (box: NativeBox) => (box[2] - box[0] + 1) * (box[3] - box[1] + 1);
    const ground = parts.filter(part => !part.rectangular && part.area >= pitch * pitch * 5
      && group.every(marker => inside(part.bbox, marker.bbox)))
      .sort((a, b) => leastArea(a.bbox) - leastArea(b.bbox))[0];
    if (!ground) continue;
    const counter = readCounter(parts, ground.bbox), preparation = readPreparationBlocks(parts, ground.bbox);
    if (!counter || !preparation || counter.length >= fixed.length + 1 || preparation.length !== 2) continue;
    const sites: NativePoint[] = [], half = (pitch - 1) / 2;
    for (let y = oy % pitch; y < rows.length; y += pitch) for (let x = ox % pitch; x < rows[0]!.length; x += pitch) {
      const l = x - half, t = y - half, r = x + half, b = y + half;
      if (inside(ground.bbox, [l, t, r, b]) && [[l, t], [r, t], [l, b], [r, b]]
        .every(([u, v]) => rows[v!]?.[u!] === ground.color)) sites.push([x, y]);
    }
    if (sites.length > 256 || fixed.some(marker => !sites.some(site => same(marker, site)))) continue;
    const actors = parts.filter(part => part.area === 1 && part.color !== first.color
      && sites.some(site => same(center(part.bbox), site)));
    if (actors.length !== 1) continue;
    const actor = actors[0]!, markerColor = first.color;
    const tagged = sites.flatMap(site => {
      const tag = taggedMarker(rows, site, size, markerColor, actor.color);
      return tag === null || tag === ground.color ? [] : [{ site, tag }];
    });
    if (tagged.length !== 1) continue;
    const { site, tag } = tagged[0]!, initialCounter = measureBlocks(counter, rows);
    const scene = { sites: sites.map(key), pitch, actorColor: actor.color, groundColor: ground.color,
      markerColor, tag, size, fixed, counter, preparation };
    candidates.push({ epoch, scene, at: center(actor.bbox), history: [site], cycle: null, fixedTested: [], evidence, movements,
      count: 0, stopped: false, initialCounter, counter: initialCounter, initialPreparation: measureBlocks(preparation, rows), prepared: null });
  }
  return candidates.length === 1 ? candidates[0]! : null;
}

function read(field: RendezvousField, rows: NativeRows): Readout | null {
  const { scene } = field, sites = scene.sites.map(point);
  const actors = sites.filter(([x, y]) => rows[y]?.[x] === scene.actorColor);
  const markers = sites.filter(site => taggedMarker(rows, site, scene.size, scene.markerColor, scene.actorColor) === scene.tag);
  if (actors.length !== 1 || markers.length > 1) return null;
  const at = actors[0]!;
  let moving = markers[0] ?? null;
  if (!moving && !scene.fixed.some(site => same(site, at))) {
    // The contact highlight can replace the tagged marker beneath the cursor.
    const radius = (scene.size - 1) / 2, [x, y] = at, surround = new Set<number>();
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      if (dx || dy) surround.add(rows[y + dy]![x + dx]!);
    }
    if (surround.size === 1 && !surround.has(scene.groundColor) && !surround.has(scene.actorColor)) moving = at;
  }
  return { at, moving, counter: measureBlocks(scene.counter, rows),
    prepared: different(field.initialPreparation, measureBlocks(scene.preparation, rows)) };
}

function findCycle(history: NativePoint[]): Cycle | null {
  for (let period = 2; period <= 12 && history.length >= 2 * period; period++) {
    const positions = history.slice(-period);
    const earlier = history.slice(-2 * period, -period);
    if (new Set(positions.map(key)).size >= 2 && positions.every((value, i) => same(value, earlier[i]!))) {
      return { positions, phase: period - 1 };
    }
  }
  return null;
}

type Travel = { command: NativeCommand; landing: NativePoint | null };
function reach(field: RendezvousField, inputs: readonly NativeCommand[], timed: boolean) {
  const cycle = timed ? field.cycle : null, period = cycle?.positions.length ?? 1;
  const sites = new Set(field.scene.sites), pitch = field.scene.pitch;
  const moves = markerDirections.flatMap(([action, x, y]) => {
    const command = inputs.find(input => input.action_ref === action);
    return command ? [{ command, x: x * pitch, y: y * pitch }] : [];
  });
  const wait = timed ? inputs.find(input => input.action_ref === 'ACTION5') : null;
  if (wait) moves.push({ command: wait, x: 0, y: 0 });
  type Node = { at: NativePoint; phase: number; depth: number; first: Travel | null };
  const queue: Node[] = [{ at: field.at, phase: cycle?.phase ?? 0, depth: 0, first: null }];
  const visited = new Set([key(field.at) + '/' + queue[0]!.phase]);
  for (const current of queue) for (const { command, x, y } of moves) {
    const landing: NativePoint = [current.at[0] + x, current.at[1] + y], phase = (current.phase + 1) % period;
    const id = key(landing) + '/' + phase;
    if (!sites.has(key(landing)) || visited.has(id)) continue;
    visited.add(id);
    queue.push({ at: landing, phase, depth: current.depth + 1, first: current.first ?? { command, landing: x || y ? landing : null } });
  }
  return queue;
}

export function nextRendezvousStep(field: RendezvousField, rows: NativeRows, inputs: readonly NativeCommand[], remaining: number): RendezvousStep | null {
  const current = read(field, rows);
  const press = inputs.find(input => input.action_ref === 'ACTION5');
  if (!press || !current || field.stopped || field.count >= 96 || !same(current.at, field.at) || different(current.counter, field.counter)) return null;
  if (field.prepared && current.prepared === 1 && same(field.at, field.prepared.at)
    && (field.prepared.kind === 'fixed' || current.moving && same(current.moving, field.at))) {
    return { command: press, at: field.at, landing: null, target: field.at, kind: field.prepared.kind, finish: true };
  }
  const fixed = new Set(field.scene.fixed.filter(site => !field.fixedTested.includes(key(site))).map(key));
  const staticRoute = reach(field, inputs, false).find(node => fixed.has(key(node.at)));
  const cycle = field.cycle;
  const mobileRoute = cycle && !field.mobileAcquired && current.moving && same(current.moving, cycle.positions[cycle.phase]!)
    ? reach(field, inputs, true).find(({ at, phase }) => same(at, cycle.positions[phase]!)
      && same(at, cycle.positions[(phase + 1) % cycle.positions.length]!)) : null;
  const mobile = mobileRoute && (!staticRoute || mobileRoute.depth < staticRoute.depth);
  const selected = mobile ? mobileRoute : staticRoute;
  if (selected && selected.depth + 2 <= remaining) return { ...(selected.first ?? { command: press, landing: null }),
    at: field.at, target: selected.at, kind: mobile ? 'mobile' : 'fixed', ...(mobile && selected.depth === 0 ? { window: true } : {}) };
  return !cycle && current.moving && remaining > 1 ? { command: press, landing: null, at: field.at, target: current.moving, kind: 'observe' } : null;
}

export function assessRendezvous(field: RendezvousField, step: RendezvousStep, rows: NativeRows): Return {
  const observed = read(field, rows);
  if (!observed || !same(observed.at, step.landing ?? step.at)
    || field.counter.some((value, i) => value !== field.initialCounter[i] && value !== observed.counter[i])) {
    return { kind: 'contradicted', observed };
  }
  const gain = different(field.initialCounter, observed.counter) - different(field.initialCounter, field.counter);
  if (step.landing) return { kind: gain === 0 && !!observed.moving ? 'moved' : 'contradicted', observed };
  if (gain === 1 && same(step.at, step.target)) return { kind: 'acquired', observed };
  if (gain !== 0 || !observed.moving) return { kind: 'contradicted', observed };
  if (observed.prepared === 1 && same(step.at, step.target)) return { kind: 'prepared', observed };
  return { kind: step.kind === 'fixed' && same(step.at, step.target) ? 'tested' : 'waited', observed };
}

export function retainRendezvous(field: RendezvousField, step: RendezvousStep, result: Return, ref: string): RendezvousField {
  const { observed, kind } = result;
  if (!observed || kind === 'contradicted') return { ...field, stopped: true };
  const history = observed.moving ? [...field.history.slice(-23), observed.moving] : field.history;
  const old = field.cycle, next = old ? (old.phase + 1) % old.positions.length : 0;
  const cycle = old && observed.moving && same(observed.moving, old.positions[next]!)
    ? { ...old, phase: next } : findCycle(history);
  return { ...field, at: observed.at, history, cycle, counter: observed.counter, count: field.count + 1,
    fixedTested: step.kind === 'fixed' && (kind === 'tested' || kind === 'acquired') ? [...field.fixedTested, key(step.target)] : field.fixedTested,
    ...(step.kind === 'mobile' && kind === 'acquired' ? { mobileAcquired: true } : {}),
    prepared: kind === 'prepared' && step.kind !== 'observe' ? { at: step.at, kind: step.kind } : null,
    movements: kind === 'moved' ? [...new Set([...field.movements, step.command.action_ref])] : field.movements,
    evidence: [...field.evidence.slice(-5), ref] };
}

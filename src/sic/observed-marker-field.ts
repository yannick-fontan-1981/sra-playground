import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

type Part = ReturnType<typeof geometricComponents>[number];
type Target = { point: NativePoint; kind: 'calibration' | 'marker' | 'mode' };
type Scene = {
  ground: NativeBox; pitch: number; sites: string[]; extent: number; actorColor: number;
  markerColor: number; calibrator: NativeBox | null; control: NativeBox; counter: NativeBox[]; preparation?: NativeBox[];
};
export type MarkerField = {
  epoch: number; scene: Scene; at: NativePoint; target: Target | null; calibration: string | null;
  modeChanges: number; tried: string[]; blocked: string[]; evidence: string[];
  initialCounter: string[]; counter: string[]; movements: string[]; count: number; stopped: boolean;
  initialPreparation?: string[];
  prepared?: { point: NativePoint; values: string[]; evidence: string } | null;
};
export type MarkerStep = { target: Target; landing: NativePoint | null; command: NativeCommand };
type Result = { kind: 'moved' | 'blocked' | 'calibrated' | 'acquired' | 'tested' | 'mode_changed' | 'contradicted'; counter: string[] }
  | { kind: 'prepared'; counter: string[]; preparation: string[] };

export const markerDirections = [['ACTION1', 0, -1], ['ACTION2', 0, 1], ['ACTION3', -1, 0], ['ACTION4', 1, 0]] as const;
const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const partPoint = ({ bbox: [x, y] }: Part): NativePoint => [x, y];
const same = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
const key = (point: NativePoint) => point.join(',');
const inside = (a: NativeBox, b: NativeBox) => a[0] <= b[0] && a[1] <= b[1] && a[2] >= b[2] && a[3] >= b[3];
const boxAt = ([x, y]: NativePoint, size: number): NativeBox => [x, y, x + size - 1, y + size - 1];
const rect = (rows: NativeRows, [x, y, r, b]: NativeBox) => rows.slice(y, b + 1).map(row => row.slice(x, r + 1));
const blockValues = (boxes: NativeBox[], rows: NativeRows) => boxes.map(box => JSON.stringify(rect(rows, box)));
const counterValues = (scene: Scene, rows: NativeRows) => blockValues(scene.counter, rows);
const sameCounter = (a: string[], b: string[]) => a.every((block, i) => block === b[i]);
const changedCounter = (base: string[], next: string[]) => next.filter((block, i) => block !== base[i]).length;
const edge = (at: NativePoint, id: string) => key(at) + ':' + id;
const attempt = (phase: number, point: NativePoint) => phase + ':' + key(point);
const square = (part: Part) => part.rectangular && width(part.bbox) === height(part.bbox);
const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : Math.abs(a);

function readCounter(parts: Part[], ground: NativeBox): NativeBox[] | null {
  const frames = parts.filter(part => part.bbox[1] > ground[3] && width(part.bbox) >= 2 * height(part.bbox)
    && part.area === 2 * (width(part.bbox) + height(part.bbox)) - 4
    && part.mask.every(([x, y]) => x === 0 || x === width(part.bbox) - 1 || y === 0 || y === height(part.bbox) - 1));
  const candidates = frames.flatMap(frame => {
    const blocks = parts.filter(part => inside(frame.bbox, part.bbox) && part.rectangular
      && width(part.bbox) > 1 && height(part.bbox) > 1).sort((a, b) => a.bbox[0] - b.bbox[0]);
    const first = blocks[0];
    if (!first) return [];
    const equal = blocks.filter(part => part.color === first.color && width(part.bbox) === width(first.bbox)
      && height(part.bbox) === height(first.bbox) && part.bbox[1] === first.bbox[1]);
    const interval = (equal[1]?.bbox[0] ?? 0) - first.bbox[0];
    return interval > width(first.bbox) && equal.length <= 8
      && equal.every((part, i) => part.bbox[0] === first.bbox[0] + i * interval)
      ? [equal.map(part => part.bbox)] : [];
  });
  return candidates.length === 1 ? candidates[0]! : null;
}

function readPreparationBlocks(parts: Part[], ground: NativeBox): NativeBox[] | null {
  const groups = new Map<string, NativeBox[]>();
  for (const { bbox, area, mask, color } of parts) {
    const size = width(bbox);
    if (bbox[1] <= ground[3] || size !== height(bbox) || size < 3 || size > 6 || area !== 4 * (size - 1)
      || !mask.every(([x, y]) => x === 0 || x === size - 1 || y === 0 || y === size - 1)) continue;
    const id = [bbox[1], size, color].join(','), group = groups.get(id) ?? [];
    group.push(bbox);
    groups.set(id, group);
  }
  const candidates = [...groups.values()].filter(group => {
    if (group.length < 2 || group.length > 8) return false;
    group.sort((a, b) => a[0] - b[0]);
    const first = group[0]!, interval = group[1]![0] - first[0];
    return interval > width(first) && group.every((box, i) => box[0] === first[0] + i * interval);
  });
  return candidates.length === 1 ? candidates[0]! : null;
}

export function readMarkerField(rows: NativeRows, epoch: number, evidence: string[], movements: string[]): MarkerField | null {
  const parts = geometricComponents(rows), groups = new Map<string, Part[]>();
  const squares = parts.filter(part => square(part) && width(part.bbox) > 1 && width(part.bbox) <= 5);
  for (const part of squares) {
    const id = [part.color, width(part.bbox)].join(':'), group = groups.get(id) ?? [];
    group.push(part);
    groups.set(id, group);
  }
  const candidates: MarkerField[] = [];
  for (const markers of groups.values()) {
    if (markers.length < 4 || markers.length > 12 || new Set(markers.map(part => part.bbox[0])).size < 3
      || new Set(markers.map(part => part.bbox[1])).size < 3) continue;
    const marker = markers[0]!, extent = width(marker.bbox), origin = partPoint(marker);
    let pitch = markers.flatMap(part => partPoint(part).map((value, i) => value - origin[i]!)).reduce(gcd, 0);
    if (pitch <= extent) continue;
    const ground = parts.filter(part => !part.rectangular && part.area >= Math.min(pitch, extent * 3) ** 2 * 5
      && markers.every(mark => inside(part.bbox, mark.bbox)))
      .sort((a, b) => width(a.bbox) * height(a.bbox) - width(b.bbox) * height(b.bbox))[0];
    if (!ground) continue;
    const preparation = readPreparationBlocks(parts, ground.bbox);
    if (preparation) {
      const possibleActors = squares.filter(part => inside(ground.bbox, part.bbox)
        && part.color !== marker.color && width(part.bbox) === extent);
      // Markers can occupy only every other cell. Include the visible cursor on that same field.
      if (possibleActors.length === 1) pitch = partPoint(possibleActors[0]!).reduce(
        (spacing, value, i) => gcd(spacing, value - origin[i]!), pitch);
    }
    if (pitch <= extent || pitch > extent * 3) continue;
    const indexed = (part: Part) => inside(ground.bbox, part.bbox)
      && partPoint(part).every((value, i) => (value - origin[i]!) % pitch === 0);
    const actors = squares.filter(part => indexed(part) && part.color !== marker.color && width(part.bbox) === extent);
    const crosses = parts.filter(part => indexed(part) && part.area === 5 && width(part.bbox) === 3 && height(part.bbox) === 3
      && part.mask.every(([x, y]) => x === 1 || y === 1));
    if (actors.length !== 1 || crosses.length > 1) continue;
    const actor = actors[0]!, calibrator = crosses[0] ?? null;
    if (!calibrator && !preparation) continue;
    const controls = parts.filter(part => indexed(part) && (!calibrator || part.color === calibrator.color) && part.rectangular
      && width(part.bbox) === extent && height(part.bbox) === extent + 1);
    const counter = readCounter(parts, ground.bbox);
    if (controls.length !== 1 || !counter || counter.length >= markers.length) continue;
    const control = controls[0]!, margin = Math.floor((pitch - extent) / 2), sites: string[] = [];
    for (let y = origin[1] % pitch; y < rows.length; y += pitch) for (let x = origin[0] % pitch; x < rows[0]!.length; x += pitch) {
      const l = x - margin, t = y - margin, r = l + pitch - 1, b = t + pitch - 1;
      if (inside(ground.bbox, [l, t, r, b]) && [[l, t], [r, t], [l, b], [r, b]]
        .every(([u, v]) => rows[v!]?.[u!] === ground.color)) sites.push(key([x, y]));
    }
    if (![...markers, actor, control, ...crosses].every(part => sites.includes(key(partPoint(part)))) || sites.length > 256) continue;
    const scene = { ground: ground.bbox, pitch, extent, sites, actorColor: actor.color, markerColor: marker.color,
      calibrator: calibrator?.bbox ?? null, control: control.bbox, counter, ...(preparation ? { preparation } : {}) };
    const initialCounter = counterValues(scene, rows);
    candidates.push({ epoch, scene, at: partPoint(actor), target: null, calibration: null, modeChanges: 0,
      tried: [], blocked: [], evidence, initialCounter, counter: initialCounter, movements, count: 0, stopped: false,
      ...(preparation ? { initialPreparation: blockValues(preparation, rows) } : {}) });
  }
  return candidates.length === 1 ? candidates[0]! : null;
}

function markerPoints(scene: Scene, rows: NativeRows): NativePoint[] {
  return geometricComponents(rows).filter(part => square(part) && part.color === scene.markerColor
    && width(part.bbox) === scene.extent && scene.sites.includes(key(partPoint(part)))).map(partPoint);
}

function locateActor(scene: Scene, rows: NativeRows, point: NativePoint): boolean {
  return rect(rows, boxAt(point, scene.extent)).every(row => row.length === scene.extent && row.every(value => value === scene.actorColor));
}

export function nextMarkerStep(state: MarkerField, rows: NativeRows, inputs: readonly NativeCommand[]): MarkerStep | null {
  const { scene, at, target: retained } = state;
  if (state.stopped || state.count >= 96 || !locateActor(scene, rows, at) || !sameCounter(counterValues(scene, rows), state.counter)) return null;
  if (state.prepared && (!same(at, state.prepared.point)
    || !sameCounter(state.prepared.values, blockValues(scene.preparation ?? [], rows)))) return null;
  const sites = new Set(scene.sites), moves = markerDirections.flatMap(([id, x, y]) => {
    const command = inputs.find(input => input.action_ref === id);
    return command ? [{ command, x: x * scene.pitch, y: y * scene.pitch }] : [];
  });
  type Node = { point: NativePoint; distance: number; first: Pick<MarkerStep, 'command' | 'landing'> | null };
  const root = { point: at, distance: 0, first: null };
  const nodes = new Map<string, Node>([[key(at), root]]), queue: Node[] = [root];
  for (const node of queue) for (const move of moves) {
    const landing: NativePoint = [node.point[0] + move.x, node.point[1] + move.y], id = key(landing);
    if (!sites.has(id) || nodes.has(id) || state.blocked.includes(edge(node.point, move.command.action_ref))) continue;
    const next = { point: landing, distance: node.distance + 1, first: node.first ?? { command: move.command, landing } };
    nodes.set(id, next);
    queue.push(next);
  }
  let target = retained && nodes.has(key(retained.point)) ? retained : null;
  if (!target && !state.calibration && scene.calibrator) target = { kind: 'calibration', point: [scene.calibrator[0], scene.calibrator[1]] };
  if (!target) {
    const marker = markerPoints(scene, rows).filter(point => nodes.has(key(point)) && !state.tried.includes(attempt(state.modeChanges, point)))
      .sort((a, b) => nodes.get(key(a))!.distance - nodes.get(key(b))!.distance || a[1] - b[1] || a[0] - b[0])[0];
    if (marker) target = { kind: 'marker', point: marker };
    else if (state.modeChanges < 3 && changedCounter(state.initialCounter, state.counter) < scene.counter.length) {
      target = { kind: 'mode', point: [scene.control[0], scene.control[1]] };
    }
  }
  if (!target) return null;
  const path = nodes.get(key(target.point));
  if (!path) return null;
  const operation = inputs.find(command => command.action_ref === 'ACTION5');
  return path.first ? { target, ...path.first } : operation ? { target, command: operation, landing: null } : null;
}

export function assessMarkerStep(state: MarkerField, step: MarkerStep, first: NativeRows, second: NativeRows): Result {
  const { scene, at, counter: previous } = state;
  const counter = counterValues(scene, second);
  if (step.landing && sameCounter(previous, counter)) {
    if (locateActor(scene, second, step.landing) && !locateActor(scene, second, at)) return { kind: 'moved', counter };
    if (locateActor(scene, second, at) && !locateActor(scene, second, step.landing)) return { kind: 'blocked', counter };
  } else if (!step.landing && locateActor(scene, second, at) && same(at, step.target.point)) {
    if (step.target.kind === 'marker') {
      const filled = previous.every((block, i) => block === state.initialCounter[i] || block === counter[i]);
      const gain = changedCounter(state.initialCounter, counter) - changedCounter(state.initialCounter, previous);
      if (filled && gain === 1) return { kind: 'acquired', counter };
      if (sameCounter(previous, counter)) {
        if (scene.preparation && state.initialPreparation) {
          const before = blockValues(scene.preparation, first), after = blockValues(scene.preparation, second);
          const stillPrepared = before.every((block, i) => block === state.initialPreparation![i] || block === after[i]);
          if (stillPrepared && changedCounter(before, after) === 1
            && changedCounter(state.initialPreparation, after) === changedCounter(state.initialPreparation, before) + 1) {
            return { kind: 'prepared', counter, preparation: after };
          }
        }
        return { kind: 'tested', counter };
      }
    } else if (sameCounter(previous, counter)) {
      const priorMarkers = markerPoints(scene, first).map(key).sort().join(';'), now = markerPoints(scene, second).map(key).sort().join(';');
      if (step.target.kind === 'mode' && priorMarkers !== now) return { kind: 'mode_changed', counter };
      if (step.target.kind === 'calibration' && priorMarkers === now && second.slice(scene.ground[3] + 1)
        .some((row, y) => row.some((value, x) => value !== first[y + scene.ground[3] + 1]?.[x]))) return { kind: 'calibrated', counter };
    }
  }
  return { kind: 'contradicted', counter };
}

export function retainMarkerStep(state: MarkerField, step: MarkerStep, result: Result, ref: string): MarkerField {
  const { kind, counter } = result;
  const traveling = kind === 'moved' || kind === 'blocked';
  return {
    ...state, counter, count: state.count + 1, stopped: kind === 'contradicted',
    evidence: [...state.evidence.slice(-5), ref],
    at: kind === 'moved' ? step.landing! : state.at, target: traveling || kind === 'prepared' ? step.target : null,
    movements: kind === 'moved' ? [...new Set([...state.movements, step.command.action_ref])] : state.movements,
    blocked: kind === 'blocked' ? [...state.blocked, edge(state.at, step.command.action_ref)] : state.blocked,
    calibration: kind === 'calibrated' ? ref : state.calibration,
    modeChanges: state.modeChanges + Number(kind === 'mode_changed'),
    tried: kind === 'tested' || kind === 'acquired' ? [...state.tried, attempt(state.modeChanges, step.target.point)] : state.tried,
    ...(state.scene.preparation ? { prepared: kind === 'prepared'
      ? { point: step.target.point, values: result.preparation, evidence: ref } : null } : {}),
  };
}

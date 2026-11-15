import type { NativeBox, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import { geometricComponents } from '../logos-engine/v6-native-observer.ts';

export const aimCommands = { ACTION1: [0, -1], ACTION2: [0, 1], ACTION3: [-1, 0], ACTION4: [1, 0] } as const;
export type AimCommand = keyof typeof aimCommands;
export type AimWitness = { epoch: number; unit: number; side: number; frontInk: number; backInk: number; refs: string[] };
export type AimPose = { box: NativeBox; heading: AimCommand };
export type RemoteRoute = { target: NativeBox; core: NativeBox; barrier: NativeBox; exit: NativeBox; field: NativeBox;
  floor: number; witness: AimWitness };
type Navigation = { pose: AimPose; action: AimCommand; distance: number };

const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const covers = (outer: NativeBox, inner: NativeBox) =>
  outer[0] <= inner[0] && outer[1] <= inner[1] && outer[2] >= inner[2] && outer[3] >= inner[3];
const square = (x: number, y: number, side: number): NativeBox => [x, y, x + side - 1, y + side - 1];
const contains = ([l, t, r, b]: NativeBox, x: number, y: number) => l <= x && x <= r && t <= y && y <= b;
const sameBox = (box: NativeBox, other: NativeBox) => box.every((value, i) => value === other[i]);
const commands = Object.keys(aimCommands) as AimCommand[];

function everyPixel(box: NativeBox, test: (x: number, y: number) => boolean): boolean {
  for (let y = box[1]; y <= box[3]; y++) for (let x = box[0]; x <= box[2]; x++) if (!test(x, y)) return false;
  return true;
}

export function aimPoseMatches(rows: NativeRows, { side, frontInk, backInk }: AimWitness, pose: AimPose): boolean {
  const [dx, dy] = aimCommands[pose.heading], axis = dx ? 0 : 1, sign = dx || dy;
  const divider = pose.box[axis] + side / 2;
  return everyPixel(pose.box, (x, y) => {
    const inFront = ((axis === 0 ? x : y) >= divider) === (sign > 0);
    return rows[y]?.[x] === (inFront ? frontInk : backInk);
  });
}

export function readAimPose(rows: NativeRows, layout: Pick<RemoteRoute, 'field' | 'witness'>): AimPose | null {
  const { side, backInk, frontInk } = layout.witness, { field } = layout;
  const poses: AimPose[] = [];
  for (let y = field[1]; y + side - 1 <= field[3]; y++) {
    for (let x = field[0]; x + side - 1 <= field[2]; x++) {
      if (rows[y]?.[x] !== frontInk && rows[y]?.[x] !== backInk) continue;
      const box = square(x, y, side);
      for (const heading of commands) if (aimPoseMatches(rows, layout.witness, { box, heading })) poses.push({ box, heading });
    }
  }
  return poses.length === 1 ? poses[0]! : null;
}

function navigable(rows: NativeRows, layout: RemoteRoute, actor: AimPose, box: NativeBox, projectedOpening: boolean) {
  return covers(layout.field, box) && everyPixel(box, (x, y) =>
    rows[y]?.[x] === layout.floor || contains(actor.box, x, y) || contains(layout.exit, x, y)
    || projectedOpening && contains(layout.barrier, x, y));
}

type Ray = { box: NativeBox; axis: 0 | 1; sign: number; first: number; last: number };
function aimRay(pose: AimPose, target: NativeBox): Ray | null {
  const [dx, dy] = aimCommands[pose.heading], axis = dx ? 0 : 1, cross = axis === 0 ? 1 : 0, sign = dx || dy;
  // Use the observed overlap between the aim line and the centre of the inset.
  const lineStart = Math.floor((pose.box[cross] + pose.box[cross + 2]!) / 2);
  const lineEnd = Math.ceil((pose.box[cross] + pose.box[cross + 2]!) / 2);
  if (lineStart !== Math.floor((target[cross] + target[cross + 2]!) / 2)
    || lineEnd !== Math.ceil((target[cross] + target[cross + 2]!) / 2)) return null;
  const first = sign > 0 ? pose.box[axis + 2]! + 1 : pose.box[axis] - 1;
  const last = sign > 0 ? target[axis] - 1 : target[axis + 2]! + 1;
  if (sign * (last - first) < 0) return null;
  const low = Math.min(first, last), high = Math.max(first, last);
  return { axis, sign, first, last, box: axis === 0 ? [low, lineStart, high, lineEnd] : [lineStart, low, lineEnd, high] };
}

export function hasAimedRay(rows: NativeRows, layout: RemoteRoute, pose: AimPose): boolean {
  const ray = aimRay(pose, layout.target);
  return ray !== null && everyPixel(ray.box, (x, y) => rows[y]?.[x] === layout.floor || contains(pose.box, x, y));
}

export function aimRoute(rows: NativeRows, layout: RemoteRoute, actor: AimPose, available: readonly string[],
  goal: 'aim' | 'exit', remaining: number, projectedOpening = false): Navigation | null {
  type Node = { pose: AimPose; distance: number; first?: Omit<Navigation, 'distance'> };
  const queue: Node[] = [{ pose: actor, distance: 0 }], visited = new Set<string>();
  for (const current of queue) {
    if (current.distance >= remaining) break;
    for (const action of commands) {
      if (!available.includes(action)) continue;
      const [dx, dy] = aimCommands[action], { unit, side } = layout.witness;
      const box = square(current.pose.box[0] + dx * unit, current.pose.box[1] + dy * unit, side);
      if (!navigable(rows, layout, actor, box, projectedOpening)) continue;
      const pose = { box, heading: action }, distance = current.distance + 1;
      const first = current.first ?? { pose, action };
      if (goal === 'aim' ? hasAimedRay(rows, layout, pose) : sameBox(pose.box, layout.exit)) return { ...first, distance };
      const signature = [box[0], box[1], goal === 'aim' ? action : ''].join(',');
      if (visited.has(signature)) continue;
      visited.add(signature);
      queue.push({ pose, distance, first });
    }
  }
  return null;
}

export function readRemoteRoute(rows: NativeRows, panel: NativeBox, cueInk: number, witness: AimWitness): RemoteRoute | null {
  if (witness.unit < 1 || witness.unit > witness.side || witness.side % 2 || witness.side < 2 || witness.side > 12) return null;
  const field: NativeBox = [0, 0, rows[0]!.length - 1, panel[1] - 1];
  const actor = readAimPose(rows, { field, witness });
  if (!actor) return null;
  const parts = geometricComponents(rows).filter(part => covers(field, part.bbox));
  const size = witness.side * witness.side;
  const exits = parts.filter(part => part.color === witness.backInk && part.rectangular && part.area === size
    && width(part.bbox) === witness.side && height(part.bbox) === witness.side && parts.some(rim =>
      rim.color === witness.frontInk && !rim.rectangular && covers(rim.bbox, part.bbox)
      && width(rim.bbox) <= witness.side + 2 && height(rim.bbox) <= witness.side + 2));
  const floors = parts.filter(part => part.color !== cueInk && part.color !== witness.frontInk && part.color !== witness.backInk
    && part.area >= 3 * size && covers(part.bbox, actor.box));
  if (exits.length !== 1 || floors.length !== 1) return null;
  const exit = exits[0]!.bbox, floor = floors[0]!.color;
  const candidates: RemoteRoute[] = [];
  for (const rim of parts.filter(part => part.color === cueInk && !part.rectangular && width(part.bbox) === witness.side
    && height(part.bbox) === witness.side)) {
    const cores = parts.filter(part => part !== rim && part.rectangular && part.color !== floor && part.area < size
      && part.bbox[0] > rim.bbox[0] && part.bbox[1] > rim.bbox[1] && part.bbox[2] < rim.bbox[2] && part.bbox[3] < rim.bbox[3]);
    if (cores.length !== 1) continue;
    for (const barrier of parts.filter(part => part !== cores[0] && part.color === cores[0]!.color && part.rectangular
      && (width(part.bbox) === witness.side || height(part.bbox) === witness.side))) {
      const layout = { field, target: rim.bbox, core: cores[0]!.bbox, barrier: barrier.bbox, exit, floor, witness };
      const opened = aimRoute(rows, layout, actor, commands, 'exit', 40, true);
      if (opened && !aimRoute(rows, layout, actor, commands, 'exit', opened.distance + 16)) candidates.push(layout);
    }
  }
  return candidates.length === 1 ? candidates[0]! : null;
}

export function remoteOpeningObserved(rows: NativeRows, layout: RemoteRoute): boolean {
  return [layout.target, layout.barrier].every(box => everyPixel(box, (x, y) => rows[y]?.[x] === layout.floor));
}

export function remoteFlightObserved(first: NativeRows, frames: readonly NativeRows[], actor: AimPose, layout: RemoteRoute): boolean {
  const ray = aimRay(actor, layout.target);
  if (!ray) return false;
  let furthest = -1, advances = 0;
  for (const frame of frames) {
    if (remoteOpeningObserved(frame, layout)) return advances >= 2 && furthest === Math.abs(ray.last - ray.first);
    let nearest = Infinity, current = -1;
    everyPixel(ray.box, (x, y) => {
      if (frame[y]?.[x] !== first[y]?.[x]) {
        const progress = ray.sign * ((ray.axis === 0 ? x : y) - ray.first);
        nearest = Math.min(nearest, progress);
        current = Math.max(current, progress);
      }
      return true;
    });
    if (current <= furthest) continue;
    if ((advances === 0 && nearest !== 0) || frame[layout.core[1]]?.[layout.core[0]] !== first[layout.core[1]]?.[layout.core[0]]) return false;
    furthest = current;
    advances++;
  }
  return false;
}

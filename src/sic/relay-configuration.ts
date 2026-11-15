import {
  changedLinkedSupports, linkedPhase, linkedSegmentFor, linkedSelectionRecipient,
  linkedTargetMarker, measureLinkedPacket, measureLinkedScene,
} from '../logos-engine/v6-linked-packet-observation.ts';
import type { NativeBox, NativeCommand, NativeObservation, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

type Body = { bbox: NativeBox; point: NativePoint; ref: string; connected_extent_bbox?: NativeBox };
type Control = Body & { radius: number };
export type RelayScene = { objects: Body[]; controls: Control[]; goal: Body; frame: NativeBox; background: number };
type Angle = { phase: string; angle: number; ref: string };
type Edge = { from: string; to: string; input: string; ref: string };
type Front = { direction: NativePoint; start_frame: number };
export type RelayCalibration = { epoch: number; angles: Angle[]; edges: Edge[]; launch: { input: string; ref: string } | null };
export type RelayWitness = {
  epoch: number; source: string; sourceAngle: number; origin: number; count: number;
  forward: string; reverse: string; launch: string; angles: Angle[]; evidence: string[];
};
export type RelayLeg = { body: Body; receiver: Body; direction: number };
export type RelayRoute = { source: Body; legs: RelayLeg[] };

const fullTurn = 2 * Math.PI;
const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
const mod = (value: number, size: number) => ((value % size) + size) % size;
const key = (values: readonly number[]) => values.join(',');
const angleOf = ([x, y]: NativePoint) => Math.atan2(y, x);
const distance = ([x, y]: NativePoint, [u, v]: NativePoint) => Math.hypot(x - u, y - v);
const patchSignature = (rows: NativeRows, [left, top, right, bottom]: NativeBox) =>
  JSON.stringify(rows.slice(top, bottom + 1).map(row => row.slice(left, right + 1)));

export function readRelayScene(rows: NativeRows): RelayScene | null {
  const scene = measureLinkedScene(rows);
  const goal = scene && linkedTargetMarker(rows, scene) as Body | null;
  return scene && goal && scene.objects.length === scene.controls.length + 2
    ? { ...scene, goal } as RelayScene : null;
}

function packetLaunch(scene: RelayScene, rows: NativeRows, frames: readonly NativeRows[], ref: string, action: string) {
  if (frames.length < 3) return null;
  const packet = measureLinkedPacket(rows, frames, ref, action);
  if (packet.status !== 'measured') return null;
  const routes = scene.objects.flatMap(body => {
    const segment = linkedSegmentFor(body, packet.segments) as Front | null;
    return segment ? [{ body, segment }] : [];
  }).sort((a, b) => a.segment.start_frame - b.segment.start_frame);
  return routes.length === 2 && routes[0]!.segment.start_frame < routes[1]!.segment.start_frame ? routes : null;
}

export function recordRelayCalibration(calibration: RelayCalibration | null, before: NativeObservation,
  after: NativeObservation, command: NativeCommand, rows: NativeRows, result: NativeRows, frames: readonly NativeRows[]) {
  const scene = readRelayScene(rows);
  if (!scene || scene.controls.length !== 1 || !before.available_action_refs.includes('ACTION5')) return null;
  const local: RelayCalibration = calibration?.epoch === before.level_epoch ? calibration
    : { epoch: before.level_epoch, angles: [], edges: [], launch: null };
  const control = scene.controls[0]!;
  const phase = linkedPhase(rows, control);
  const packet = packetLaunch(scene, rows, frames, before.observation_ref, command.action_ref);
  if (!packet) {
    if (command.action_ref === 'ACTION6' || command.action_ref === local.launch?.input || before.level_epoch !== after.level_epoch) {
      return { local, witness: null };
    }
    const opened = readRelayScene(result);
    if (opened?.controls.length !== 1 || opened.objects.some(body => !scene.objects.some(original => original.ref === body.ref))) {
      return { local, witness: null };
    }
    const next = linkedPhase(result, opened.controls[0]!);
    const edge = { from: phase, to: next, input: command.action_ref, ref: after.observation_ref };
    return { local: next === phase ? local : { ...local, edges: [...local.edges.slice(-15), edge] }, witness: null };
  }
  const outgoing = packet[1]!, initial = packet[0]!;
  if (outgoing.body.ref === scene.goal.ref || initial.body.ref === scene.goal.ref) return { local, witness: null };
  const origin = angleOf(outgoing.segment.direction), sourceAngle = angleOf(initial.segment.direction);
  const sample = { phase, angle: origin, ref: after.observation_ref };
  const launch = command.action_ref === 'ACTION6' ? local.launch : { input: command.action_ref, ref: after.observation_ref };
  const angles = [...local.angles.filter(item => item.phase !== phase).slice(-7), sample];
  const next = { ...local, angles, launch };
  if (!launch || after.levels_completed <= before.levels_completed) return { local: next, witness: null };
  const comparable = local.edges.flatMap(edge => {
    const previous = local.angles.find(item => item.phase === edge.from);
    if (edge.to !== phase || !previous) return [];
    const step = wrap(origin - previous.angle);
    const inverse = local.edges.find(other => other.input !== edge.input && (other.from === edge.to && other.to === edge.from
      || local.edges.some(reversed => reversed.input === edge.input && reversed.from === other.to && reversed.to === other.from)));
    return inverse && Math.abs(step) > 0.05 && Math.abs(step) < Math.PI / 2 ? [{ edge, inverse, step, previous }] : [];
  });
  const first = comparable[0];
  // The observed launch and relay output supplied two perpendicular bearings.
  // Fit their separation to the observed adjustment, retaining a discrete hypothesis.
  if (!first || Math.abs(Math.abs(wrap(origin - sourceAngle)) - Math.PI / 2) > 0.08) return { local: next, witness: null };
  const quarter = Math.round((Math.PI / 2) / Math.abs(first.step));
  if (quarter < 2 || quarter > 16 || Math.abs(Math.abs(first.step) - Math.PI / (2 * quarter)) > 0.06) {
    return { local: next, witness: null };
  }
  const witness: RelayWitness = { epoch: after.level_epoch, source: patchSignature(rows, initial.body.bbox), sourceAngle, origin,
    count: quarter * 4, forward: first.step > 0 ? first.edge.input : first.inverse.input,
    reverse: first.step < 0 ? first.edge.input : first.inverse.input, launch: launch.input, angles,
    evidence: [launch.ref, first.previous.ref, first.edge.ref, first.inverse.ref, after.observation_ref] };
  return { local: next, witness };
}

function hitDistance(origin: NativePoint, direction: NativePoint, box: NativeBox): number {
  let low = 0, high = Infinity;
  for (const axis of [0, 1] as const) {
    const delta = direction[axis], from = origin[axis], left = box[axis], right = box[axis + 2]!;
    if (Math.abs(delta) < 1e-8) {
      if (from < left || from > right) return Infinity;
      continue;
    }
    const a = (left - from) / delta, b = (right - from) / delta;
    low = Math.max(low, Math.min(a, b));
    high = Math.min(high, Math.max(a, b));
  }
  return low > 0 && high >= low ? low : Infinity;
}

function rayRecipient(scene: RelayScene, origin: Body, angle: number): Body | null {
  const direction: NativePoint = [Math.cos(angle), Math.sin(angle)];
  const hits = scene.objects.filter(body => body.ref !== origin.ref)
    .map(body => ({ body, gap: hitDistance(origin.point, direction, body.bbox) }))
    .filter(hit => Number.isFinite(hit.gap)).sort((a, b) => a.gap - b.gap);
  const first = hits[0];
  if (!first || first.gap === hits[1]?.gap) return null;
  const [x, y] = first.body.point, [u, v] = origin.point;
  return Math.abs((x - u) * direction[1] - (y - v) * direction[0]) <= 1 ? first.body : null;
}

export function planRelayRoute(scene: RelayScene, rows: NativeRows, witness: RelayWitness): RelayRoute | null {
  const sources = scene.objects.filter(body => patchSignature(rows, body.bbox) === witness.source);
  if (sources.length !== 1) return null;
  const source = sources[0]!, opening = rayRecipient(scene, source, witness.sourceAngle);
  if (!opening) return null;
  const reach = [{ body: opening, legs: [] as RelayLeg[] }], visited = new Set([source.ref, opening.ref]);
  const step = fullTurn / witness.count;
  for (const { body, legs } of reach) {
    if (body.ref === scene.goal.ref) return { source, legs };
    for (let direction = 0; direction < witness.count; direction++) {
      const receiver = rayRecipient(scene, body, witness.origin + direction * step);
      if (!receiver || visited.has(receiver.ref)) continue;
      visited.add(receiver.ref);
      reach.push({ body: receiver, legs: [...legs, { body, receiver, direction }] });
    }
  }
  return null;
}

export function currentRelayControl(scene: RelayScene, slot: Control): Control | null {
  const candidates = scene.controls.filter(control => distance(control.point, slot.point) <= Math.max(1, slot.radius / 2));
  return candidates.length === 1 ? candidates[0]! : null;
}

export function relaySelection(scene: RelayScene, first: NativeRows, second: NativeRows, previous: Body | null): Body | null {
  const parts = changedLinkedSupports(first, second, scene);
  return linkedSelectionRecipient(first, second, parts, previous)[0] as Body | null;
}

export function sameRelayLayout(original: RelayScene, current: RelayScene): boolean {
  const retainsCore = (body: Body, measured: Body) => {
    if (distance(body.point, measured.point) <= 1) return true;
    const [left, top, right, bottom] = measured.connected_extent_bbox ?? measured.bbox;
    const [x, y] = body.point;
    return x >= left && x <= right && y >= top && y <= bottom;
  };
  const matched = new Set<Body>();
  for (const body of original.objects) {
    const candidates = current.objects.filter(measured => retainsCore(body, measured));
    if (candidates.length !== 1 || matched.has(candidates[0]!)) return false;
    matched.add(candidates[0]!);
  }
  return current.objects.length === original.objects.length && current.controls.length === original.controls.length
    && key(current.goal.point) === key(original.goal.point)
    && original.controls.every(control => currentRelayControl(current, control));
}

export function relayPhase(rows: NativeRows, control: Control, model: RelayWitness) {
  const phase = linkedPhase(rows, control);
  const angle = model.angles.find(item => item.phase === phase)?.angle;
  return { phase, direction: angle === undefined ? null : mod(Math.round(wrap(angle - model.origin) * model.count / fullTurn), model.count) };
}

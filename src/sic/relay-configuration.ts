import {
  changedLinkedSupports, linkedPhase, linkedSegmentFor, linkedSelectionRecipient,
  linkedTargetMarker, measureLinkedPacket, measureLinkedScene,
} from '../logos-engine/v6-linked-packet-observation.ts';
import type { NativeBox, NativeCommand, NativeObservation, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import { symbolicDigest } from '../logos-engine/v6-hash.ts';

type Body = { bbox: NativeBox; point: NativePoint; ref: string; connected_extent_bbox?: NativeBox; raster?: number[][] };
type Control = Body & { radius: number };
export type RelayScene = { objects: Body[]; controls: Control[]; goal: Body; frame: NativeBox; background: number; recoveredGoal?: true };
type Angle = { phase: string; angle: number; ref: string };
type Edge = { from: string; to: string; input: string; ref: string };
type Front = { direction: NativePoint; start_frame: number };
type SourceMark = { unmarked: number[][]; ink: number; distance: number };
type GoalMark = { pixels: (number | null)[][]; center: NativePoint };
export type RelayCalibration = { epoch: number; angles: Angle[]; edges: Edge[]; launch: { input: string; ref: string } | null };
export type RelayWitness = {
  epoch: number; source: string; sourceAngle: number; origin: number; count: number;
  forward: string; reverse: string; launch: string; angles: Angle[]; evidence: string[];
  sourceMark?: SourceMark;
  goalMark?: GoalMark;
  phaseDirections?: Record<string, number | null>;
};
export type RelayLeg = { body: Body; receiver: Body; direction: number };
export type RelayRoute = { source: Body; legs: RelayLeg[]; sourceAngle?: number };

const fullTurn = 2 * Math.PI;
const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
const mod = (value: number, size: number) => ((value % size) + size) % size;
const key = (values: readonly number[]) => values.join(',');
const angleOf = ([x, y]: NativePoint) => Math.atan2(y, x);
const distance = ([x, y]: NativePoint, [u, v]: NativePoint) => Math.hypot(x - u, y - v);
const bodyPatch = (rows: NativeRows, [left, top, right, bottom]: NativeBox) =>
  rows.slice(top, bottom + 1).map(row => row.slice(left, right + 1));
const patchSignature = (rows: NativeRows, box: NativeBox) => JSON.stringify(bodyPatch(rows, box));

function sourceMark(rows: NativeRows, source: Body, bearing: number): SourceMark | null {
  const [l, t, r, b] = source.bbox, size = r - l + 1, radius = (size - 1) / 2;
  if (size !== b - t + 1 || size < 3 || !Number.isInteger(radius)
    || source.point[0] !== l + radius || source.point[1] !== t + radius) return null;
  const patch = rows.slice(t, b + 1).map(row => row.slice(l, r + 1));
  const dx = Math.round(radius * Math.cos(bearing)), dy = Math.round(radius * Math.sin(bearing));
  const ink = patch[radius + dy]![radius + dx]!;
  if (patch.flat().filter(value => value === ink).length !== 1) return null;
  const ring = Math.max(Math.abs(dx), Math.abs(dy));
  const peers = patch.flatMap((row, y) => row.filter((value, x) => value !== ink
    && Math.max(Math.abs(x - radius), Math.abs(y - radius)) === ring));
  if (!peers.length || new Set(peers).size !== 1) return null;
  patch[radius + dy]![radius + dx] = peers[0]!;
  return { unmarked: patch, ink, distance: radius };
}

function sourcesWithBearings(scene: RelayScene, rows: NativeRows, witness: RelayWitness) {
  const mark = witness.sourceMark;
  if (!mark) return scene.objects.filter(body => patchSignature(rows, body.bbox) === witness.source)
    .map(body => ({ body, angle: witness.sourceAngle }));
  const radius = mark.distance;
  return scene.objects.flatMap(body => {
    const [x, y] = body.point;
    if (x < radius || y < radius || x + radius >= rows[0]!.length || y + radius >= rows.length) return [];
    const marks: NativePoint[] = mark.unmarked.flatMap((row, v) => row.flatMap((value, u) =>
      rows[y + v - radius]![x + u - radius] === value ? [] : [[u - radius, v - radius] as NativePoint]));
    if (marks.length !== 1) return [];
    const [dx, dy] = marks[0]!;
    if (rows[y + dy]![x + dx] !== mark.ink) return [];
    return Array.from({ length: witness.count }, (_, i) => witness.origin + fullTurn * i / witness.count).flatMap(angle =>
      Math.round(radius * Math.cos(angle)) === dx && Math.round(radius * Math.sin(angle)) === dy ? [{ body, angle }] : []);
  });
}

function retainsCore(body: Body, measured: Body): boolean {
  if (distance(body.point, measured.point) <= 1) return true;
  const [left, top, right, bottom] = measured.connected_extent_bbox ?? measured.bbox;
  const [x, y] = body.point;
  return x >= left && x <= right && y >= top && y <= bottom;
}

function measureGoalMark(rows: NativeRows, { goal, background }: RelayScene): GoalMark | null {
  const patch = bodyPatch(rows, goal.bbox), [l, t] = goal.bbox;
  if (patch.length < 3 || patch.length > 11 || patch[0]!.length < 3 || patch[0]!.length > 11) return null;
  const pixels = patch.map(row => {
    const left = row.findIndex(ink => ink !== background);
    let right = row.length - 1;
    while (right >= 0 && row[right] === background) right--;
    return row.map((ink, x) => x >= left && x <= right ? ink : null);
  });
  return { pixels, center: [goal.point[0] - l, goal.point[1] - t] };
}

function recoverGoal(rows: NativeRows, frame: NativeBox, mark: GoalMark): Body | null {
  const width = mark.pixels[0]!.length, height = mark.pixels.length;
  const [l, t, r, b] = frame, [dx, dy] = mark.center, ink = mark.pixels[dy]?.[dx];
  let goal: Body | null = null;
  for (let y = t + 1; y + height - 1 < b; y++) for (let x = l + 1; x + width - 1 < r; x++) {
    if (rows[y + dy]?.[x + dx] !== ink || !mark.pixels.every((row, v) =>
      row.every((color, u) => color === null || rows[y + v]?.[x + u] === color))) continue;
    if (goal) return null;
    const bbox: NativeBox = [x, y, x + width - 1, y + height - 1];
    goal = { bbox, point: [x + dx, y + dy], ref: 'support:' + symbolicDigest(bbox) };
  }
  return goal;
}

export function readRelayScene(rows: NativeRows, retained?: RelayScene, mark?: GoalMark): RelayScene | null {
  const scene = measureLinkedScene(rows);
  const measuredGoal = scene && linkedTargetMarker(rows, scene) as Body | null;
  const goal = measuredGoal ?? (scene && mark ? recoverGoal(rows, scene.frame as NativeBox, mark) : null);
  if (!scene || !goal) return null;
  const visible = scene.objects as Body[];
  const objects = visible.map(body => ({ ...body, raster: bodyPatch(rows, body.bbox) }));
  if (!measuredGoal) {
    const candidates = objects.flatMap((body, index) => retainsCore(goal, body) ? [index] : []);
    if (candidates.length > 1) return null;
    if (candidates.length === 1) objects[candidates[0]!] = { ...goal, raster: bodyPatch(rows, goal.bbox) };
    else objects.push({ ...goal, raster: bodyPatch(rows, goal.bbox) });
  }
  const current = { ...scene, goal, objects, ...(!measuredGoal ? { recoveredGoal: true } : {}) } as RelayScene;
  if (objects.length === scene.controls.length + 2) return current;
  if (!retained || objects.length + 1 !== retained.objects.length || key(scene.frame) !== key(retained.frame)
    || key(goal.point) !== key(retained.goal.point)) return null;
  const missing = retained.objects.filter(body => !objects.some(measured => retainsCore(body, measured)));
  if (missing.length !== 1) return null;
  const body = missing[0]!, [x, y] = body.point, [l, t] = body.bbox;
  // A wire can merge with the selected relay's component. Its previously observed patch can still be verified.
  const raster = bodyPatch(rows, body.bbox);
  const onlyCenterChanged = body.raster?.every((row, v) => row.every((value, u) =>
    (l + u === x && t + v === y) ? raster[v]?.[u] !== value : raster[v]?.[u] === value));
  return onlyCenterChanged ? { ...current, objects: [...objects, { ...body, raster }] } : null;
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
  const goalMark = measureGoalMark(rows, scene);
  const witness: RelayWitness = { epoch: after.level_epoch, source: patchSignature(rows, initial.body.bbox), sourceAngle, origin,
    count: quarter * 4, forward: first.step > 0 ? first.edge.input : first.inverse.input,
    reverse: first.step < 0 ? first.edge.input : first.inverse.input, launch: launch.input, angles,
    evidence: [launch.ref, first.previous.ref, first.edge.ref, first.inverse.ref, after.observation_ref], ...(goalMark ? { goalMark } : {}) };
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
  const sources = sourcesWithBearings(scene, rows, witness);
  if (sources.length !== 1) return null;
  const { body: source, angle } = sources[0]!, opening = rayRecipient(scene, source, angle);
  if (!opening) return null;
  const reach = [{ body: opening, legs: [] as RelayLeg[] }], visited = new Set([source.ref, opening.ref]);
  const step = fullTurn / witness.count;
  for (const { body, legs } of reach) {
    if (body.ref === scene.goal.ref) return { source, legs, ...(witness.sourceMark ? { sourceAngle: angle } : {}) };
    for (let direction = 0; direction < witness.count; direction++) {
      const receiver = rayRecipient(scene, body, witness.origin + direction * step);
      if (!receiver || visited.has(receiver.ref)) continue;
      visited.add(receiver.ref);
      reach.push({ body: receiver, legs: [...legs, { body, receiver, direction }] });
    }
  }
  return null;
}

function linePixels([x, y]: NativePoint, [u, v]: NativePoint): NativePoint[] {
  const points: NativePoint[] = [];
  const dx = Math.abs(u - x), dy = -Math.abs(v - y), sx = x < u ? 1 : -1, sy = y < v ? 1 : -1;
  let error = dx + dy;
  while (x !== u || y !== v) {
    points.push([x, y]);
    const next = 2 * error;
    if (next >= dy) { error += dy; x += sx; }
    if (next <= dx) { error += dx; y += sy; }
  }
  return points;
}

export function inferRelayBindings(scene: RelayScene, source: Body, rows: NativeRows): Record<number, string> {
  const supports = [...scene.objects, ...scene.controls].map(({ bbox }) => bbox);
  const relays = scene.objects.filter(body => body.ref !== source.ref && body.ref !== scene.goal.ref);
  const [left, top, right, bottom] = scene.frame;
  const used = new Set<string>(), inks = new Set<number>(), bindings: Record<number, string> = {};
  for (const [slot, control] of scene.controls.entries()) {
    const matches = relays.flatMap(body => {
      const exposed = linePixels(body.point, control.point).filter(([x, y]) =>
        !supports.some(([l, t, r, b]) => x >= l && x <= r && y >= t && y <= b)
        && !(x >= left && x <= right && (y === top || y === bottom))
        && !(y >= top && y <= bottom && (x === left || x === right)));
      if (exposed.length < 4) return [];
      const [x, y] = exposed[0]!, ink = rows[y]?.[x];
      return ink !== undefined && ink !== scene.background && exposed.every(([u, v]) => rows[v]?.[u] === ink) ? [{ body, ink }] : [];
    });
    if (matches.length !== 1 || used.has(matches[0]!.body.ref)) return {};
    const { body, ink } = matches[0]!;
    bindings[slot] = body.ref;
    used.add(body.ref);
    inks.add(ink);
  }
  return inks.size === 1 ? bindings : {};
}

export function retainScoredRelay(witness: RelayWitness, route: RelayRoute, before: NativeObservation,
  after: NativeObservation, rows: NativeRows, frames: readonly NativeRows[],
  phaseDirections: Record<string, number | null> | undefined, scene: RelayScene): RelayWitness | null {
  const trace = measureLinkedPacket(rows, frames, before.observation_ref, witness.launch);
  if (trace.status !== 'measured') return null;
  const segment = linkedSegmentFor(route.source, trace.segments) as Front | null;
  const angle = route.sourceAngle ?? witness.sourceAngle;
  const first = route.legs[0];
  const outgoing = first && linkedSegmentFor(first.body, trace.segments) as Front | null;
  const legAngle = first && witness.origin + first.direction * fullTurn / witness.count;
  if (segment ? Math.abs(wrap(angleOf(segment.direction) - angle)) > 0.08
    : !witness.sourceMark || !outgoing || legAngle === undefined || Math.abs(wrap(angleOf(outgoing.direction) - legAngle)) > 0.08) return null;
  const mark = witness.sourceMark ?? sourceMark(rows, route.source, angle);
  const goalMark = witness.goalMark ?? measureGoalMark(rows, scene);
  return { ...witness, epoch: after.level_epoch, ...(mark ? { sourceMark: mark } : {}),
    ...(goalMark ? { goalMark } : {}),
    ...(phaseDirections ? { phaseDirections } : {}),
    evidence: [...new Set([...witness.evidence.slice(-5), before.observation_ref, after.observation_ref])] };
}

export function currentRelayControl(scene: RelayScene, slot: Control): Control | null {
  const candidates = scene.controls.filter(control => distance(control.point, slot.point) <= Math.max(1, slot.radius / 2));
  return candidates.length === 1 ? candidates[0]! : null;
}

export function relaySelection(scene: RelayScene, first: NativeRows, second: NativeRows, previous: Body | null): Body | null {
  const parts = changedLinkedSupports(first, second, scene);
  const affected = scene.recoveredGoal
    ? parts.filter(({ point: [x, y] }) => first[y]?.[x] !== second[y]?.[x]) : parts;
  return linkedSelectionRecipient(first, second, affected, previous)[0] as Body | null;
}

export function sameRelayLayout(original: RelayScene, current: RelayScene): boolean {
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

export function relayPhase(rows: NativeRows, control: Control, model: RelayWitness, learned?: Record<string, number | null>) {
  const phase = linkedPhase(rows, control);
  const angle = model.angles.find(item => item.phase === phase)?.angle;
  return { phase, direction: angle === undefined ? learned?.[phase] ?? null
    : mod(Math.round(wrap(angle - model.origin) * model.count / fullTurn), model.count) };
}

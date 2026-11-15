import { temporalPatch } from '../logos-engine/v6-linked-temporal-common.ts';
import type { NativeBox, NativeCommand, NativeObservation, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

type Body = { readonly signature: string; readonly start: NativePoint; readonly size: NativePoint; readonly floor: number; readonly quantum: number;
  readonly mask: readonly NativePoint[] };
type Node = { readonly position: NativePoint; readonly peer_support: readonly NativePoint[] };
export type RecordingScene = { readonly body: Body; readonly goal: NativePoint; readonly nodes: readonly Node[]; readonly slots: readonly NativeBox[] };
type Change = { readonly pixel: NativePoint; readonly before: number; readonly after: number };
type TimedPreparation = { readonly tick: number; readonly changes: readonly Change[]; readonly ref: string; readonly retained: boolean };
type Preparation = { readonly node: Node; readonly block: NativePoint; readonly ink: number; readonly event: TimedPreparation | null };
type Contribution = { readonly path: readonly NativePoint[]; readonly contact: NativePoint; readonly changed: readonly Change[];
  readonly evidence: readonly string[]; readonly prepared?: TimedPreparation };
type Step = { readonly input: string; readonly position: NativePoint };
export type Recording = { readonly epoch: number; readonly scene: RecordingScene; readonly vectors: Readonly<Record<string, NativePoint>>;
  readonly phase: string; readonly paths: readonly Contribution[]; readonly path: readonly NativePoint[];
  readonly node: Node | null; readonly route: readonly Step[]; readonly pending: readonly Change[]; readonly evidence: readonly string[];
  readonly stopped: boolean; readonly preparation?: Preparation };
export type RecordingChoice = { readonly recording: Recording; readonly command: NativeCommand; readonly expected: NativePoint;
  readonly intent: 'move' | 'commit'; readonly destination: NativePoint };

const same = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
const key = ([x, y]: NativePoint) => `${x},${y}`;
const inside = ([l, t, r, b]: NativeBox, [x, y]: NativePoint) => x >= l && x <= r && y >= t && y <= b;
const pixel = (rows: NativeRows, [x, y]: NativePoint) => rows[y]?.[x];
export const bodyBox = ([x, y]: NativePoint, [w, h]: NativePoint): NativeBox => [x, y, x + w - 1, y + h - 1];
const poseAt = (item: Contribution, tick: number) => item.path[Math.min(tick, item.path.length - 1)]!;
const supportAt = (paths: readonly Contribution[], tick: number) => paths.flatMap(item => [
  ...(item.prepared && tick >= item.prepared.tick ? item.prepared.changes : []),
  ...(tick >= item.path.length - 1 ? item.changed : []),
]);

export function recordingActor(observation: NativeObservation, scene: RecordingScene): NativePoint | null {
  const parts = observation.entities.filter(part => part.signature === scene.body.signature);
  return parts.length === 1 ? [parts[0]!.bbox[0], parts[0]!.bbox[1]] : null;
}

function measuredReplays(observation: NativeObservation, scene: RecordingScene): NativePoint[] {
  const { body } = scene;
  return observation.entities.flatMap(part => {
    const [x, y, r, b] = part.bbox;
    if (part.signature === body.signature || r - x + 1 !== body.size[0] || b - y + 1 !== body.size[1] ||
      part.mask.length !== body.mask.length || !part.mask.every((value, i) => same(value, body.mask[i]!))) return [];
    return [[x, y] as NativePoint];
  });
}

export function replaySprites(observation: NativeObservation, state: Recording) {
  return measuredReplays(observation, state.scene).map(position => bodyBox(position, state.scene.body.size));
}

export function openSupports(state: Recording) {
  const tick = state.path.length - 1;
  const active = state.preparation ? state.paths.flatMap(item => [
    ...(item.prepared && tick >= item.prepared.tick ? [item.prepared.changes] : []),
    ...(tick >= item.path.length - 1 ? [item.changed] : []),
  ]) : state.paths.map(item => item.changed);
  if (!state.paths.length && state.preparation?.event) active.push(state.preparation.event.changes);
  return active.flatMap(changes => {
    if (!changes.length) return [];
    const xs = changes.map(change => change.pixel[0]), ys = changes.map(change => change.pixel[1]);
    return [[Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as NativeBox];
  });
}

function preparationCandidate(scene: RecordingScene, rows: NativeRows): Preparation | null {
  const { size } = scene.body;
  const candidates = scene.nodes.flatMap(node => {
    if (node.peer_support.length !== size[0] * size[1]) return [];
    const [first] = node.peer_support;
    if (!first) return [];
    const ink = pixel(rows, first);
    if (ink === undefined || ink === scene.body.floor || !node.peer_support.every(point => pixel(rows, point) === ink)) return [];
    const block: NativePoint = [Math.min(...node.peer_support.map(point => point[0])), Math.min(...node.peer_support.map(point => point[1]))];
    return node.peer_support.every(point => inside(bodyBox(block, size), point)) ? [{ node, block, ink, event: null }] : [];
  });
  return candidates.length === 1 ? candidates[0]! : null;
}

export function beginRecording(scene: RecordingScene, epoch: number, vectors: Readonly<Record<string, NativePoint>>,
  phase: string, evidence: readonly string[], rows: NativeRows): Recording | null {
  const valid = Object.entries(vectors).filter(([input, [x, y]]) => input !== phase &&
    (x === 0 || y === 0) && Math.abs(x) + Math.abs(y) === scene.body.quantum);
  if (new Set(valid.map(([, delta]) => key(delta))).size !== 4 || !evidence.length) return null;
  const preparation = preparationCandidate(scene, rows);
  return { scene, epoch, phase, vectors: Object.fromEntries(valid), paths: [], path: [scene.body.start],
    node: null, route: [], pending: [], evidence, stopped: false, ...(preparation ? { preparation } : {}) };
}

function pathTo(rows: NativeRows, state: Recording, start: NativePoint, goal: NativePoint): Step[] | null {
  const { body, nodes } = state.scene, [w, h] = body.size, width = rows[0]!.length, height = rows.length;
  const startBox = bodyBox(start, body.size), cap = Math.max(0, ...state.paths.map(item => item.path.length - 1));
  const overlays = Array.from({ length: cap + 1 }, (_, tick) =>
    new Map(supportAt(state.paths, tick).map(change => [key(change.pixel), change.after])));
  const occupants = Array.from({ length: cap + 1 }, (_, tick) => new Set(state.paths.map(item => key(poseAt(item, tick)))));
  const directions = Object.entries(state.vectors);
  type Search = { readonly position: NativePoint; readonly tick: number; readonly from: number; readonly input: string };
  const queue: Search[] = [{ position: start, tick: 0, from: -1, input: '' }];
  const seen = new Set([key(start) + '|0']);
  for (let i = 0; i < queue.length && i < 20_000; i++) {
    const current = queue[i]!;
    const tick = Math.min(cap, current.tick + 1), overlay = overlays[tick]!;
    for (const [input, [dx, dy]] of directions) {
      const x = current.position[0] + dx, y = current.position[1] + dy;
      const position: NativePoint = [x, y], name = key(position), visit = name + '|' + tick;
      if (x < 0 || y < 0 || x + w > width || y + h > height || seen.has(visit)
        || !state.preparation && occupants[tick]!.has(name)) continue;
      let floor = true;
      for (let row = y; row < y + h && floor; row++) for (let col = x; col < x + w; col++) {
        const at: NativePoint = [col, row];
        if (!inside(startBox, at) && (overlay.get(key(at)) ?? pixel(rows, at)) !== body.floor) { floor = false; break; }
      }
      const node = nodes.some(candidate => same(candidate.position, position));
      if (!floor && !node && !same(goal, position)) continue;
      const next = { position, tick, from: i, input };
      if (same(goal, position)) {
        const path: Step[] = [];
        for (let step = next; step.from >= 0; step = queue[step.from]!) path.push({ input: step.input, position: step.position });
        return path.reverse();
      }
      const measuredContact = state.preparation && state.paths.some(item => same(item.contact, position));
      if (floor || measuredContact) {
        queue.push(next);
        seen.add(visit);
      }
    }
  }
  return null;
}

export function chooseRecording(observation: NativeObservation, rows: NativeRows, initial: Recording): RecordingChoice | null {
  if (initial.stopped) return null;
  const from = recordingActor(observation, initial.scene);
  if (!from || !same(from, initial.path.at(-1)!)) return null;
  if (initial.pending.length && initial.node) {
    if (initial.preparation && initial.paths.length === 0 && !initial.preparation.event?.retained) return null;
    return { recording: initial, command: { action_ref: initial.phase, data: {} }, expected: initial.scene.body.start,
      intent: 'commit', destination: initial.node.position };
  }
  let recording = initial;
  if (!recording.route.length) {
    const { scene, paths, preparation } = recording;
    if (recording.path.length !== 1 && !(preparation?.event && paths.length === 0 && recording.node === null)) return null;
    const exploratoryContact = preparation && !preparation.event && paths.length === 0 ? preparation.node : null;
    const remaining = paths.length < scene.slots.length - 1
      ? exploratoryContact ? [exploratoryContact] : scene.nodes.filter(node => (!preparation || !same(node.position, preparation.node.position))
        && !paths.some(item => same(item.contact, node.position))) : [];
    const contacts = remaining.flatMap(node => {
      const route = pathTo(rows, recording, from, node.position);
      return route?.length ? [{ node, route }] : [];
    }).sort((a, b) => a.route.length - b.route.length);
    const next = contacts[0];
    if (next) recording = { ...recording, ...next };
    else if (!remaining.length) {
      const route = pathTo(rows, recording, from, scene.goal);
      if (!route?.length) return null;
      recording = { ...recording, node: null, route };
    } else return null;
  }
  const step = recording.route[0]!;
  return { recording, command: { action_ref: step.input, data: {} }, expected: step.position, intent: 'move',
    destination: recording.node?.position ?? recording.scene.goal };
}

function compareReplays(observation: NativeObservation, rows: NativeRows, state: Recording, actor: NativePoint, tick: number) {
  const expected = state.paths.map(item => poseAt(item, tick)), visible = measuredReplays(observation, state.scene);
  if (!visible.every(point => expected.some(pose => same(point, pose)))) return false;
  if (!expected.every(point => same(point, actor) || visible.some(pose => same(point, pose)))) return false;
  const occupied = [actor, ...expected].map(position => bodyBox(position, state.scene.body.size));
  return supportAt(state.paths, tick).every(change => occupied.some(box => inside(box, change.pixel)) || pixel(rows, change.pixel) === change.after);
}

function observedPreparation(state: Recording, before: NativeRows, after: NativeRows, ref: string, tick: number): TimedPreparation | null {
  const preparation = state.preparation!;
  const { size, floor } = state.scene.body, { ink, block } = preparation;
  const moved = Object.values(state.vectors).flatMap(([dx, dy]) => {
    const next: NativePoint = [block[0] + dx, block[1] + dy];
    const patch = temporalPatch(after, next, size);
    return patch.length === size[1] && patch.every(row => row.length === size[0] && row.every(color => color === ink))
      && !temporalPatch(before, next, size).every(row => row.every(color => color === ink)) ? [next] : [];
  });
  const released = temporalPatch(after, block, size);
  if (moved.length !== 1 || !released.every(row => row.every(color => color === floor))) return null;
  const changes = [block, moved[0]!].flatMap(([x, y]) => {
    const values: Change[] = [];
    for (let dy = 0; dy < size[1]; dy++) for (let dx = 0; dx < size[0]; dx++) {
      const at: NativePoint = [x + dx, y + dy], observed = pixel(after, at), former = pixel(before, at);
      if (observed !== undefined && former !== undefined && observed !== former) values.push({ pixel: at, before: former, after: observed });
    }
    return values;
  });
  return { tick, changes, ref, retained: false };
}

export function observeRecording(choice: RecordingChoice, observation: NativeObservation, before: NativeRows, after: NativeRows) {
  const { recording, expected, intent } = choice, { scene } = recording;
  const actor = recordingActor(observation, scene);
  const tick = intent === 'commit' ? 0 : recording.path.length;
  if (!actor || !same(actor, expected) || !compareReplays(observation, after, recording, actor, tick)) return null;
  const ref = observation.observation_ref, evidence = [...recording.evidence.slice(-5), ref];
  if (intent === 'commit') {
    if (!recording.node || !recording.pending.length || !scene.slots.some(([l, t, r, b]) =>
      temporalPatch(after, [l, t], [r - l + 1, b - t + 1]).some((row, i) => row.some((value, j) => value !== before[t + i]?.[l + j])))) return null;
    const prepared = recording.paths.length === 0 ? recording.preparation?.event : null;
    if (recording.preparation) {
      const reset = [...supportAt(recording.paths, Infinity), ...(prepared?.changes ?? []), ...recording.pending];
      if (prepared?.retained === false || !reset.every(change => pixel(after, change.pixel) === change.before)) return null;
    }
    const evidenceRefs = [...(prepared ? [prepared.ref] : []), recording.evidence.at(-1) ?? ref, ref];
    const contribution = { path: recording.path, contact: recording.node.position, changed: recording.pending, evidence: evidenceRefs,
      ...(prepared ? { prepared } : {}) };
    return { ...recording, paths: [...recording.paths, contribution], path: [actor], node: null, pending: [], route: [], evidence };
  }
  const node = recording.node;
  const arrived = node && same(actor, node.position);
  const { preparation } = recording;
  if (preparation && recording.paths.length === 0) {
    if (arrived && same(actor, preparation.node.position) && !preparation.event) {
      const event = observedPreparation(recording, before, after, ref, tick);
      return event ? { ...recording, preparation: { ...preparation, event }, path: [...recording.path, actor], pending: [],
        node: null, route: [], evidence } : null;
    }
    if (preparation.event && !preparation.event.changes.every(change =>
      inside(bodyBox(actor, scene.body.size), change.pixel) || pixel(after, change.pixel) === change.after)) return null;
  }
  const pending = arrived ? node.peer_support.flatMap(point => {
    const first = pixel(before, point), second = pixel(after, point);
    return first === undefined || second === undefined || first === second ? [] : [{ pixel: point, before: first, after: second }];
  }) : [];
  if (arrived && !pending.length) return null;
  return { ...recording, path: [...recording.path, actor], pending, route: recording.route.slice(1), evidence,
    ...(preparation?.event && recording.paths.length === 0 && !same(actor, preparation.node.position)
      ? { preparation: { ...preparation, event: { ...preparation.event, retained: true } } } : {}) };
}

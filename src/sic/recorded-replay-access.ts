import { temporalPatch } from '../logos-engine/v6-linked-temporal-common.ts';
import type { NativeBox, NativeCommand, NativeObservation, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

type Body = { readonly signature: string; readonly start: NativePoint; readonly size: NativePoint; readonly floor: number; readonly quantum: number;
  readonly mask: readonly NativePoint[] };
type Node = { readonly position: NativePoint; readonly peer_support: readonly NativePoint[] };
export type RecordingScene = { readonly body: Body; readonly goal: NativePoint; readonly nodes: readonly Node[]; readonly slots: readonly NativeBox[] };
type Change = { readonly pixel: NativePoint; readonly before: number; readonly after: number };
type Contribution = { readonly path: readonly NativePoint[]; readonly contact: NativePoint; readonly changed: readonly Change[];
  readonly evidence: readonly [string, string] };
type Step = { readonly input: string; readonly position: NativePoint };
export type Recording = { readonly epoch: number; readonly scene: RecordingScene; readonly vectors: Readonly<Record<string, NativePoint>>;
  readonly phase: string; readonly paths: readonly Contribution[]; readonly path: readonly NativePoint[];
  readonly node: Node | null; readonly route: readonly Step[]; readonly pending: readonly Change[]; readonly evidence: readonly string[];
  readonly stopped: boolean };
export type RecordingChoice = { readonly recording: Recording; readonly command: NativeCommand; readonly expected: NativePoint;
  readonly intent: 'move' | 'commit'; readonly destination: NativePoint };

const same = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
const key = ([x, y]: NativePoint) => `${x},${y}`;
const inside = ([l, t, r, b]: NativeBox, [x, y]: NativePoint) => x >= l && x <= r && y >= t && y <= b;
const pixel = (rows: NativeRows, [x, y]: NativePoint) => rows[y]?.[x];
export const bodyBox = ([x, y]: NativePoint, [w, h]: NativePoint): NativeBox => [x, y, x + w - 1, y + h - 1];
const poseAt = (item: Contribution, tick: number) => item.path[Math.min(tick, item.path.length - 1)]!;
const supportAt = (paths: readonly Contribution[], tick: number) => paths.filter(item => tick >= item.path.length - 1).flatMap(item => item.changed);

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
  return state.paths.flatMap(item => {
    if (!item.changed.length) return [];
    const xs = item.changed.map(change => change.pixel[0]), ys = item.changed.map(change => change.pixel[1]);
    return [[Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as NativeBox];
  });
}

export function beginRecording(scene: RecordingScene, epoch: number, vectors: Readonly<Record<string, NativePoint>>,
  phase: string, evidence: readonly string[]): Recording | null {
  const valid = Object.entries(vectors).filter(([input, [x, y]]) => input !== phase &&
    (x === 0 || y === 0) && Math.abs(x) + Math.abs(y) === scene.body.quantum);
  if (new Set(valid.map(([, delta]) => key(delta))).size !== 4 || !evidence.length) return null;
  return { scene, epoch, phase, vectors: Object.fromEntries(valid), paths: [], path: [scene.body.start],
    node: null, route: [], pending: [], evidence, stopped: false };
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
      if (x < 0 || y < 0 || x + w > width || y + h > height || seen.has(visit) || occupants[tick]!.has(name)) continue;
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
      if (floor) {
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
    return { recording: initial, command: { action_ref: initial.phase, data: {} }, expected: initial.scene.body.start,
      intent: 'commit', destination: initial.node.position };
  }
  let recording = initial;
  if (!recording.route.length) {
    if (recording.path.length !== 1) return null;
    const { scene, paths } = recording;
    const remaining = paths.length < scene.slots.length - 1
      ? scene.nodes.filter(node => !paths.some(item => same(item.contact, node.position))) : [];
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

export function observeRecording(choice: RecordingChoice, observation: NativeObservation, before: NativeRows, after: NativeRows) {
  const { recording, expected, intent } = choice, { scene } = recording;
  const actor = recordingActor(observation, scene);
  const tick = intent === 'commit' ? 0 : recording.path.length;
  if (!actor || !same(actor, expected) || !compareReplays(observation, after, recording, actor, tick)) return null;
  const ref = observation.observation_ref, evidence = [...recording.evidence.slice(-5), ref];
  if (intent === 'commit') {
    if (!recording.node || !recording.pending.length || !scene.slots.some(([l, t, r, b]) =>
      temporalPatch(after, [l, t], [r - l + 1, b - t + 1]).some((row, i) => row.some((value, j) => value !== before[t + i]?.[l + j])))) return null;
    const evidenceRefs: [string, string] = [recording.evidence.at(-1) ?? ref, ref];
    const contribution = { path: recording.path, contact: recording.node.position, changed: recording.pending, evidence: evidenceRefs };
    return { ...recording, paths: [...recording.paths, contribution], path: [actor], node: null, pending: [], route: [], evidence };
  }
  const node = recording.node;
  const arrived = node && same(actor, node.position);
  const pending = arrived ? node.peer_support.flatMap(point => {
    const first = pixel(before, point), second = pixel(after, point);
    return first === undefined || second === undefined || first === second ? [] : [{ pixel: point, before: first, after: second }];
  }) : [];
  if (arrived && !pending.length) return null;
  return { ...recording, path: [...recording.path, actor], pending, route: recording.route.slice(1), evidence };
}

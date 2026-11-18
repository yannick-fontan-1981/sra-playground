import { temporalPatch } from '../logos-engine/v6-linked-temporal-common.ts';
import type { NativeBox, NativeCommand, NativeObservation, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

type Body = { readonly signature: string; readonly start: NativePoint; readonly size: NativePoint; readonly floor: number; readonly quantum: number;
  readonly mask: readonly NativePoint[] };
type Node = { readonly position: NativePoint; readonly peer_support: readonly NativePoint[] };
type TransferLink = { readonly contact: NativePoint; readonly frames: readonly [NativePoint, NativePoint]; readonly channel: NativeBox };
export type RecordingScene = { readonly body: Body; readonly goal: NativePoint; readonly nodes: readonly Node[]; readonly slots: readonly NativeBox[];
  readonly transfer?: TransferLink; readonly transfers?: readonly TransferLink[] };
type Change = { readonly pixel: NativePoint; readonly before: number; readonly after: number };
type TimedPreparation = { readonly tick: number; readonly changes: readonly Change[]; readonly ref: string; readonly retained: boolean };
type Pulse = { readonly tick: number; readonly ref: string };
type Preparation = { readonly node: Node; readonly block: NativePoint; readonly ink: number; readonly event: TimedPreparation | null };
type LaneSwitch = { readonly index: number; readonly block: NativePoint; readonly ink: number; readonly closed: boolean };
type Lane = { readonly points: readonly NativePoint[]; readonly index: number; readonly direction: 1 | -1;
  readonly switches: readonly LaneSwitch[] };
type TransferPlan = { readonly auxiliary: TransferLink; readonly hold: Node; readonly exit: TransferLink };
type Contribution = { readonly path: readonly NativePoint[]; readonly contact: NativePoint; readonly changed: readonly Change[];
  readonly evidence: readonly string[]; readonly prepared?: TimedPreparation; readonly preparations?: readonly TimedPreparation[]; readonly pulse?: Pulse };
type Step = { readonly input: string; readonly position: NativePoint; readonly entry?: NativePoint };
export type Recording = { readonly epoch: number; readonly scene: RecordingScene; readonly vectors: Readonly<Record<string, NativePoint>>;
  readonly phase: string; readonly paths: readonly Contribution[]; readonly path: readonly NativePoint[];
  readonly node: Node | null; readonly route: readonly Step[]; readonly pending: readonly Change[]; readonly evidence: readonly string[];
  readonly stopped: boolean; readonly preparation?: Preparation; readonly preparations?: readonly Preparation[];
  readonly lane?: Lane; readonly lanePreparation?: Preparation;
  readonly pendingPulse?: Pulse | null; readonly transferPlan?: TransferPlan };
export type RecordingChoice = { readonly recording: Recording; readonly command: NativeCommand; readonly expected: NativePoint;
  readonly intent: 'move' | 'commit'; readonly destination: NativePoint; readonly entry?: NativePoint };

const same = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
const key = ([x, y]: NativePoint) => `${x},${y}`;
const inside = ([l, t, r, b]: NativeBox, [x, y]: NativePoint) => x >= l && x <= r && y >= t && y <= b;
const pixel = (rows: NativeRows, [x, y]: NativePoint) => rows[y]?.[x];
export const bodyBox = ([x, y]: NativePoint, [w, h]: NativePoint): NativeBox => [x, y, x + w - 1, y + h - 1];
const poseAt = (item: Contribution, tick: number) => item.path[Math.min(tick, item.path.length - 1)]!;
const supportAt = (paths: readonly Contribution[], tick: number) => paths.flatMap(item => [
  ...(item.prepared && tick >= item.prepared.tick ? item.prepared.changes : []),
  ...(item.preparations?.flatMap(event => tick >= event.tick ? event.changes : []) ?? []),
  ...(tick >= item.path.length - 1 ? item.changed : []),
]);

export function linkedTransfers(observation: NativeObservation, body: Body & { readonly palette: number }): TransferLink[] {
  const { quantum, start, size: [w, h] } = body;
  const candidates: TransferLink[] = [];
  for (const entity of observation.entities) {
    const [left, top, right, bottom] = entity.bbox;
    if (entity.palette_value === body.floor || entity.palette_value === body.palette || entity.area <= 2 * (w + h)
      || right - left < quantum || bottom - top < quantum) continue;
    const has = (x: number, y: number) => support.has(key([x, y]));
    const support = new Set(entity.mask.map(([x, y]) => key([x + left, y + top])));
    const frames: NativePoint[] = [], contacts: NativePoint[] = [];
    const align = (from: number, anchor: number) => from + ((anchor - from) % quantum + quantum) % quantum;
    for (let y = align(top - h + 1, start[1]); y <= bottom; y += quantum) {
      for (let x = align(left - w + 1, start[0]); x <= right; x += quantum) {
        const horizontal = Array.from({ length: w + 2 }, (_, i) => x - 1 + i)
          .every(u => has(u, y - 1) && has(u, y + h));
        const vertical = Array.from({ length: h }, (_, i) => y + i)
          .every(v => has(x - 1, v) && has(x + w, v));
        const inside = Array.from({ length: w * h }, (_, i) => [x + i % w, y + Math.floor(i / w)] as const);
        if (horizontal && vertical && inside.every(([u, v]) => !has(u, v))) frames.push([x, y]);
        if (inside.some(([u, v]) => u < x + w - 1 && v < y + h - 1
          && has(u, v) && has(u + 1, v) && has(u, v + 1) && has(u + 1, v + 1))) contacts.push([x, y]);
      }
    }
    if (contacts.length !== 1 || frames.length !== 2) continue;
    const [a, b] = frames as [NativePoint, NativePoint];
    const channel: NativeBox | null = a[0] === b[0] ? [a[0], a[1] + h + 1, a[0] + w - 1, b[1] - 2]
      : a[1] === b[1] ? [a[0] + w + 1, a[1], b[0] - 2, a[1] + h - 1] : null;
    if (channel && channel[0] <= channel[2] && channel[1] <= channel[3]) candidates.push({ contact: contacts[0]!, frames: [a, b], channel });
  }
  return candidates;
}

export function transferForChoice(choice: RecordingChoice): TransferLink | undefined {
  const { recording, expected, intent, entry } = choice;
  if (intent !== 'move') return undefined;
  const { transfer, transfers = transfer ? [transfer] : [] } = recording.scene;
  return transfers.find(link => entry ? link.frames.some(frame => same(frame, entry))
    : !!recording.node && same(recording.node.position, link.contact) && same(expected, link.contact));
}

export function needsTransferPulse(choice: RecordingChoice): boolean {
  return !!transferForChoice(choice);
}

function sawPulse(transfer: TransferLink, before: NativeRows, after: NativeRows, frames: readonly NativeRows[]) {
  const [l, t, r, b] = transfer.channel;
  const stable: NativePoint[] = [];
  for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) if (before[y]?.[x] === after[y]?.[x]) stable.push([x, y]);
  return frames.filter(frame => stable.filter(([x, y]) => frame[y]?.[x] !== before[y]?.[x]).length >= 2).length >= 2;
}

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
  const auxiliary = state.lane?.points[state.lane.index];
  return measuredReplays(observation, state.scene).filter(position => !auxiliary || !same(position, auxiliary))
    .map(position => bodyBox(position, state.scene.body.size));
}

export function openSupports(state: Recording) {
  const tick = state.path.length - 1;
  const active = state.preparation ? state.paths.flatMap(item => [
    ...(item.prepared && tick >= item.prepared.tick ? [item.prepared.changes] : []),
    ...(tick >= item.path.length - 1 ? [item.changed] : []),
  ]) : state.preparations ? state.paths.flatMap(item => [
    ...(item.preparations?.flatMap(event => tick >= event.tick ? [event.changes] : []) ?? []),
    ...(tick >= item.path.length - 1 ? [item.changed] : []),
  ]) : state.paths.map(item => item.changed);
  if (!state.paths.length && state.preparation?.event) active.push(state.preparation.event.changes);
  if (!state.paths.length && state.preparations) active.push(...state.preparations.flatMap(item => item.event ? [item.event.changes] : []));
  const opened = state.lane?.switches.filter(s => !s.closed).map(s => bodyBox(s.block, state.scene.body.size)) ?? [];
  return [...opened, ...active.flatMap(changes => {
    if (!changes.length) return [];
    const xs = changes.map(change => change.pixel[0]), ys = changes.map(change => change.pixel[1]);
    return [[Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as NativeBox];
  })];
}

function preparationCandidates(scene: RecordingScene, rows: NativeRows): Preparation[] {
  const { size } = scene.body;
  return scene.nodes.flatMap(node => {
    if (node.peer_support.length !== size[0] * size[1]) return [];
    const [first] = node.peer_support;
    if (!first) return [];
    const ink = pixel(rows, first);
    if (ink === undefined || ink === scene.body.floor || !node.peer_support.every(point => pixel(rows, point) === ink)) return [];
    const block: NativePoint = [Math.min(...node.peer_support.map(point => point[0])), Math.min(...node.peer_support.map(point => point[1]))];
    return node.peer_support.every(point => inside(bodyBox(block, size), point)) ? [{ node, block, ink, event: null }] : [];
  });
}

function linearLane(start: NativePoint, available: ReadonlySet<string>, vectors: readonly NativePoint[]) {
  const points: NativePoint[] = [start], visited = new Set([key(start)]);
  for (const [i, point] of points.entries()) {
    const neighbors = vectors.map(([dx, dy]) => [point[0] + dx, point[1] + dy] as NativePoint)
      .filter(next => available.has(key(next)) && (i === 0 || !same(next, points[i - 1]!)));
    if (neighbors.length > 1 || neighbors.some(next => visited.has(key(next)))) return null;
    if (neighbors.length) { points.push(neighbors[0]!); visited.add(key(neighbors[0]!)); }
  }
  return { points, visited };
}

function measureLane(scene: RecordingScene, rows: NativeRows, observation: NativeObservation,
  preparations: readonly Preparation[], vectors: readonly NativePoint[]) {
  const peers = measuredReplays(observation, scene);
  if (peers.length !== 1) return null;
  const start = peers[0]!, { body } = scene, [w, h] = body.size;
  const available = new Set([...scene.nodes.map(node => key(node.position)), key(start), key(body.start), key(scene.goal)]);
  for (const node of scene.nodes) {
    if (node.peer_support.length >= w * h || !node.peer_support.length) continue;
    const x = Math.min(...node.peer_support.map(point => point[0])), y = Math.min(...node.peer_support.map(point => point[1]));
    if ((x - body.start[0]) % body.quantum === 0 && (y - body.start[1]) % body.quantum === 0) available.add(key([x, y]));
  }
  for (let y = body.start[1] % body.quantum; y + h <= rows.length; y += body.quantum) {
    for (let x = body.start[0] % body.quantum; x + w <= rows[0]!.length; x += body.quantum) {
      if (temporalPatch(rows, [x, y], body.size).every(row => row.every(ink => ink === body.floor))) available.add(key([x, y]));
    }
  }
  const route = linearLane(start, available, vectors);
  if (!route) return null;
  const { points, visited } = route;
  if (points.length < 3 || points.length > 32 || visited.has(key(body.start)) || visited.has(key(scene.goal))) return null;
  const switches = preparations.flatMap(({ node, block, ink }) => {
    const index = points.findIndex(point => same(point, node.position));
    return index > 0 && !visited.has(key(block)) ? [{ index, block, ink, closed: true }] : [];
  });
  const player = preparations.filter(item => !visited.has(key(item.node.position)));
  return switches.length && player.length === 1
    ? { lane: { points, index: 0, direction: 1 as const, switches }, lanePreparation: player[0]! } : null;
}

function advanceLane(lane: Lane, scene: RecordingScene, changes: readonly Change[], rows: NativeRows, visible: NativePoint): Lane {
  const { points, index, switches } = lane;
  const direction = index + lane.direction < 0 || index + lane.direction >= points.length ? -lane.direction as 1 | -1 : lane.direction;
  const next = index + direction, landing = points[next]!;
  const overlay = new Map(changes.map(change => [key(change.pixel), change.after]));
  const onContact = scene.nodes.some(node => same(node.position, landing))
    || scene.transfers?.some(link => same(link.contact, landing));
  const occupied = bodyBox(visible, scene.body.size);
  const open = onContact || temporalPatch(rows, landing, scene.body.size).every((row, dy) => row.every((ink, dx) => {
    const pixel: NativePoint = [landing[0] + dx, landing[1] + dy];
    return inside(occupied, pixel) || (overlay.get(key(pixel)) ?? ink) === scene.body.floor;
  }));
  return open ? { points, index: next, direction,
    switches: switches.map(s => s.index === next ? { ...s, closed: !s.closed } : s) } : lane;
}

function walkRegion(rows: NativeRows, body: Body, start: NativePoint, vectors: readonly NativePoint[],
  walkable: (point: NativePoint) => boolean, extraFloor: ReadonlySet<string> = new Set()) {
  const [w, h] = body.size, width = rows[0]?.length ?? 0;
  const points = [start];
  const visited = new Set([key(start)]);
  for (const [x, y] of points) {
    for (const [dx, dy] of vectors) {
      const point: NativePoint = [x + dx, y + dy];
      const [left, top] = point, id = key(point);
      if (visited.has(id) || left < 0 || top < 0 || left + w > width || top + h > rows.length) continue;
      const floor = temporalPatch(rows, point, body.size).every((row, j) => row.every((ink, i) =>
        ink === body.floor || extraFloor.has(key([left + i, top + j]))));
      if (floor || walkable(point)) {
        visited.add(id);
        points.push(point);
      }
    }
  }
  return visited;
}

function measureTransferPlan(scene: RecordingScene, rows: NativeRows, observation: NativeObservation,
  preparations: readonly Preparation[], vectors: readonly NativePoint[]) {
  const links = scene.transfers ?? [], { body, goal } = scene;
  const peers = measuredReplays(observation, scene);
  if (peers.length !== 1 || links.length < 2 || scene.slots.length !== 3) return null;
  const linkedPositions = links.flatMap(link => [link.contact, ...link.frames]).map(key);
  if (new Set(linkedPositions).size !== linkedPositions.length) return null;
  const start = peers[0]!, allowPlayer = (point: NativePoint) => same(point, body.start);
  const region = walkRegion(rows, body, body.start, vectors, allowPlayer);
  const fromGoal = walkRegion(rows, body, goal, vectors, allowPlayer);
  const exits = links.filter(link => link.frames.filter(frame => fromGoal.has(key(frame))).length === 1
    && link.frames.some(frame => region.has(key(frame))));
  // Work back from the receiver to the held contact and its own means of access.
  if (exits.length !== 1) return null;
  const exit = exits[0]!;
  const canReach = (point: NativePoint, reached: ReadonlySet<string>) =>
    reached.has(key(point)) || vectors.some(([dx, dy]) => reached.has(key([point[0] + dx, point[1] + dy])));
  if (canReach(exit.contact, region)) return null;
  const options = scene.nodes.flatMap(hold => {
    if (preparations.some(item => item.node === hold) || canReach(hold.position, region)) return [];
    const released = walkRegion(rows, body, body.start, vectors, allowPlayer, new Set(hold.peer_support.map(key)));
    if (!canReach(exit.contact, released)) return [];
    return links.filter(link => link !== exit).flatMap(auxiliary => {
      if (auxiliary.frames.filter(frame => region.has(key(frame))).length !== 1) return [];
      const far = auxiliary.frames.find(frame => !region.has(key(frame)))!;
      if (!canReach(hold.position, walkRegion(rows, body, far, vectors, allowPlayer))) return [];
      return preparations.flatMap(preparation => {
        if (!canReach(preparation.node.position, region)) return [];
        const allowed = (point: NativePoint) => same(point, auxiliary.contact) || same(point, preparation.block);
        const span = walkRegion(rows, body, start, vectors, allowed);
        if (span.size < 3 || span.size > 32 || span.has(key(body.start)) || span.has(key(goal))) return [];
        const route = linearLane(start, span, vectors);
        if (!route || !same(route.points.at(-1)!, auxiliary.contact) || !route.visited.has(key(preparation.block))) return [];
        const lane: Lane = { points: route.points, index: 0, direction: 1, switches: [] };
        return [{ lane, preparation, transferPlan: { auxiliary, hold, exit } }];
      });
    });
  });
  return options.length === 1 ? options[0]! : null;
}

export function beginRecording(scene: RecordingScene, epoch: number, vectors: Readonly<Record<string, NativePoint>>,
  phase: string, evidence: readonly string[], rows: NativeRows, observation?: NativeObservation): Recording | null {
  const valid = Object.entries(vectors).filter(([input, [x, y]]) => input !== phase &&
    (x === 0 || y === 0) && Math.abs(x) + Math.abs(y) === scene.body.quantum);
  if (new Set(valid.map(([, delta]) => key(delta))).size !== 4 || !evidence.length) return null;
  const preparations = preparationCandidates(scene, rows);
  const transferPlan = observation && scene.transfers
    ? measureTransferPlan(scene, rows, observation, preparations, valid.map(([, delta]) => delta)) : null;
  if (scene.transfers && !transferPlan) return null;
  const lane = observation && !scene.transfer && preparations.length > 1
    ? measureLane(scene, rows, observation, preparations, valid.map(([, delta]) => delta)) : null;
  return { scene, epoch, phase, vectors: Object.fromEntries(valid), paths: [], path: [scene.body.start],
    node: null, route: [], pending: [], evidence, stopped: false,
    ...(transferPlan ?? lane ?? (preparations.length > 1 ? { preparations }
      : preparations.length === 1 && !scene.transfer ? { preparation: preparations[0]! } : {})) };
}

function pathTo(rows: NativeRows, state: Recording, start: NativePoint, goal: NativePoint): Step[] | null {
  const { body, nodes, transfer } = state.scene, [w, h] = body.size, width = rows[0]!.length, height = rows.length;
  const startTick = state.lane ? state.path.length - 1 : 0;
  const cap = state.lane ? startTick + 4 * state.lane.points.length : Math.max(0, ...state.paths.map(item => item.path.length - 1));
  const startBox = bodyBox(start, body.size);
  const overlays = Array.from({ length: cap + 1 }, (_, tick) =>
    new Map(supportAt(state.paths, tick).map(change => [key(change.pixel), change.after])));
  const occupants = Array.from({ length: cap + 1 }, (_, tick) => new Set(state.paths.map(item => key(poseAt(item, tick)))));
  const lanes = new Map<number, Lane>(), laneCells = new Set(state.lane?.points.map(key));
  if (state.lane) {
    let current = state.lane;
    const visible = current.points[current.index]!;
    lanes.set(startTick, current);
    for (let tick = startTick + 1; tick <= cap; tick++) {
      current = advanceLane(current, state.scene, supportAt(state.paths, tick), rows, visible);
      lanes.set(tick, current);
    }
  }
  const pulses = new Set(state.paths.flatMap(item => item.pulse ? [item.pulse.tick] : []));
  const transferPlan = state.transferPlan;
  const timedLinks = new Map<number, TransferLink[]>();
  if (transferPlan) {
    for (const [tick, lane] of lanes) {
      const previous = lanes.get(tick - 1);
      if (previous && lane.index !== previous.index && same(lane.points[lane.index]!, transferPlan.auxiliary.contact)) {
        timedLinks.set(tick, [transferPlan.auxiliary]);
      }
    }
    const pulse = state.paths.find(item => same(item.contact, transferPlan.exit.contact))?.pulse;
    if (pulse) timedLinks.set(pulse.tick, [...(timedLinks.get(pulse.tick) ?? []), transferPlan.exit]);
  }
  const directions = Object.entries(state.vectors);
  type Search = Step & { readonly tick: number; readonly from: number };
  const queue: Search[] = [{ position: start, tick: startTick, from: -1, input: '' }];
  const seen = new Set([key(start) + '|' + startTick]);
  for (let i = 0; i < queue.length && i < 20_000; i++) {
    const current = queue[i]!;
    if (state.lane && current.tick >= cap) continue;
    const tick = Math.min(cap, current.tick + 1), overlay = overlays[tick]!;
    const activeLinks = current.tick < cap
      ? timedLinks.get(tick) ?? (transfer && pulses.has(tick) ? [transfer] : undefined) : undefined;
    for (const [input, [dx, dy]] of directions) {
      const x = current.position[0] + dx, y = current.position[1] + dy;
      const position: NativePoint = [x, y];
      const active = activeLinks?.find(link => link.frames.some(frame => same(frame, position)));
      const nextPosition = active?.frames.find(frame => !same(frame, position)) ?? position;
      const visit = key(nextPosition) + '|' + tick;
      if (x < 0 || y < 0 || x + w > width || y + h > height || seen.has(visit) || laneCells.has(key(position))
        || !state.lane && !state.preparation && !transfer && occupants[tick]!.has(key(position))) continue;
      const switchBefore = lanes.get(current.tick)?.switches.find(s => same(s.block, position));
      const switchAfter = lanes.get(tick)?.switches.find(s => same(s.block, position));
      if (switchBefore?.closed || switchAfter?.closed) continue;
      let floor = true;
      for (let row = y; row < y + h && floor && !switchBefore; row++) for (let col = x; col < x + w; col++) {
        const at: NativePoint = [col, row];
        if (!inside(startBox, at) && (overlay.get(key(at)) ?? pixel(rows, at)) !== body.floor) { floor = false; break; }
      }
      const node = nodes.some(candidate => same(candidate.position, position));
      if (!floor && !node && !same(goal, position)) continue;
      const next = { position: nextPosition, tick, from: i, input, ...(active ? { entry: position } : {}) };
      if (same(goal, nextPosition)) {
        const path: Step[] = [];
        for (let step: Search = next; step.from >= 0; step = queue[step.from]!) {
          path.push({ input: step.input, position: step.position, ...(step.entry ? { entry: step.entry } : {}) });
        }
        return path.reverse();
      }
      const measuredContact = (state.lane || state.preparation || transfer) && state.paths.some(item => same(item.contact, nextPosition));
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
  if ((initial.pending.length || initial.pendingPulse) && initial.node) {
    if (initial.preparation && initial.paths.length === 0 && !initial.preparation.event?.retained) return null;
    if (initial.preparations && initial.paths.length === 0 && initial.preparations.some(item => !item.event?.retained)) return null;
    return { recording: initial, command: { action_ref: initial.phase, data: {} }, expected: initial.scene.body.start,
      intent: 'commit', destination: initial.node.position };
  }
  let recording = initial;
  if (!recording.route.length) {
    const { scene, paths, preparation, preparations } = recording;
    if (recording.transferPlan) {
      const { transferPlan } = recording;
      const node = paths.length >= scene.slots.length - 1 ? null
        : paths.length ? { position: transferPlan.exit.contact, peer_support: [] }
          : preparation?.event ? transferPlan.hold : preparation?.node;
      if (node === undefined) return null;
      const route = pathTo(rows, recording, from, node?.position ?? scene.goal);
      if (!route?.length) return null;
      recording = { ...recording, node, route };
    } else if (recording.lane && paths.length === scene.slots.length - 1) {
      const node = recording.lanePreparation?.event ? null : recording.lanePreparation?.node ?? null;
      const route = pathTo(rows, recording, from, node?.position ?? scene.goal);
      if (!route?.length) return null;
      recording = { ...recording, node, route };
    } else {
      const buildingPreparation = !paths.length && !!preparations;
      if (recording.path.length !== 1 && (paths.length || recording.node || !preparation?.event && !buildingPreparation)) return null;
      const pulseNeeded = preparations ? paths.length > 0 && !paths.some(item => item.pulse) : !paths.length;
      const exploratoryContact = scene.transfer && pulseNeeded ? { position: scene.transfer.contact, peer_support: [] }
        : preparation && !preparation.event && paths.length === 0 ? preparation.node : null;
      const unfinished = buildingPreparation ? preparations.filter(item => !item.event).map(item => item.node) : [];
      const remaining = paths.length < scene.slots.length - 1
        ? unfinished.length ? unfinished : exploratoryContact ? [exploratoryContact] : scene.nodes.filter(node =>
          (!preparation || !same(node.position, preparation.node.position))
          && !preparations?.some(item => same(node.position, item.node.position))
          && !recording.lane?.points.some(position => same(position, node.position))
          && (!recording.lanePreparation || !same(recording.lanePreparation.node.position, node.position))
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
  }
  const step = recording.route[0]!;
  return { recording, command: { action_ref: step.input, data: {} }, expected: step.position, intent: 'move',
    destination: recording.node?.position ?? recording.scene.goal, ...(step.entry ? { entry: step.entry } : {}) };
}

function compareReplays(observation: NativeObservation, rows: NativeRows, state: Recording, actor: NativePoint, tick: number, lane?: Lane) {
  const expected = state.paths.map(item => poseAt(item, tick));
  const moving = lane?.points[lane.index], measured = measuredReplays(observation, state.scene);
  const visible = measured.filter(point => !moving || !same(point, moving));
  if (moving && !measured.some(point => same(point, moving))) return false;
  if (!visible.every(point => expected.some(pose => same(point, pose)))) return false;
  if (!expected.every(point => same(point, actor) || visible.some(pose => same(point, pose)))) return false;
  const occupied = [actor, ...expected, ...(moving ? [moving] : [])].map(position => bodyBox(position, state.scene.body.size));
  return supportAt(state.paths, tick).every(change => occupied.some(box => inside(box, change.pixel)) || pixel(rows, change.pixel) === change.after);
}

function observedPreparation(state: Recording, preparation: Preparation, before: NativeRows, after: NativeRows,
  ref: string, tick: number): TimedPreparation | null {
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

export function observeRecording(choice: RecordingChoice, observation: NativeObservation, before: NativeRows, after: NativeRows,
  frames: readonly NativeRows[] = []) {
  let { recording } = choice;
  const { expected, intent } = choice, { scene } = recording;
  const actor = recordingActor(observation, scene);
  const tick = intent === 'commit' ? 0 : recording.path.length;
  const lane = recording.lane && (intent === 'commit'
    ? { ...recording.lane, index: 0, direction: 1 as const, switches: recording.lane.switches.map(s => ({ ...s, closed: true })) }
    : advanceLane(recording.lane, scene, supportAt(recording.paths, tick), before, recording.lane.points[recording.lane.index]!));
  if (!actor || !same(actor, expected) || !compareReplays(observation, after, recording, actor, tick, lane)) return null;
  if (lane) {
    if (!lane.switches.every(s => same(s.block, actor) && !s.closed || temporalPatch(after, s.block, scene.body.size)
      .every(row => row.every(ink => ink === (s.closed ? s.ink : scene.body.floor))))) return null;
    recording = { ...recording, lane };
  }
  const ref = observation.observation_ref, evidence = [...recording.evidence.slice(-5), ref];
  if (intent === 'commit') {
    if (!recording.node || !recording.pending.length && !recording.pendingPulse || !scene.slots.some(([l, t, r, b]) =>
      temporalPatch(after, [l, t], [r - l + 1, b - t + 1]).some((row, i) => row.some((value, j) => value !== before[t + i]?.[l + j])))) return null;
    const prepared = recording.paths.length === 0 ? recording.preparation?.event : null;
    const preparations = recording.paths.length === 0 ? recording.preparations?.flatMap(item => item.event ? [item.event] : []) : undefined;
    if (recording.preparation || recording.preparations) {
      const reset = [...supportAt(recording.paths, Infinity), ...(prepared?.changes ?? []),
        ...(preparations?.flatMap(event => event.changes) ?? []), ...recording.pending];
      if (prepared?.retained === false || !reset.every(change => pixel(after, change.pixel) === change.before)) return null;
    }
    const evidenceRefs = [...(prepared ? [prepared.ref] : []), ...(recording.pendingPulse ? [recording.pendingPulse.ref] : []),
      ...(preparations?.map(event => event.ref) ?? []), recording.evidence.at(-1) ?? ref, ref];
    const contribution = { path: recording.path, contact: recording.node.position, changed: recording.pending, evidence: evidenceRefs,
      ...(prepared ? { prepared } : {}), ...(preparations?.length ? { preparations } : {}),
      ...(recording.pendingPulse ? { pulse: recording.pendingPulse } : {}) };
    const { pendingPulse: _committed, ...rest } = recording;
    return { ...rest, paths: [...recording.paths, contribution], path: [actor], node: null, pending: [], route: [], evidence };
  }
  const node = recording.node;
  const arrived = node && same(actor, node.position);
  if (arrived && recording.lanePreparation && same(actor, recording.lanePreparation.node.position)) {
    const event = observedPreparation(recording, recording.lanePreparation, before, after, ref, tick);
    return event ? { ...recording, lanePreparation: { ...recording.lanePreparation, event },
      path: [...recording.path, actor], node: null, route: [], evidence } : null;
  }
  const transfer = transferForChoice(choice);
  if (transfer) {
    if (!sawPulse(transfer, before, after, frames)) return null;
    if (!choice.entry) return { ...recording, path: [...recording.path, actor], route: recording.route.slice(1), evidence,
      pendingPulse: { tick, ref } };
    if (!recording.transferPlan) return { ...recording, path: [...recording.path, actor], route: recording.route.slice(1), evidence };
  }
  const { preparation } = recording;
  if (preparation && recording.paths.length === 0) {
    if (arrived && same(actor, preparation.node.position) && !preparation.event) {
      const event = observedPreparation(recording, preparation, before, after, ref, tick);
      return event ? { ...recording, preparation: { ...preparation, event }, path: [...recording.path, actor], pending: [],
        node: null, route: [], evidence } : null;
    }
    const moving = lane && bodyBox(lane.points[lane.index]!, scene.body.size);
    if (preparation.event && !preparation.event.changes.every(change => inside(bodyBox(actor, scene.body.size), change.pixel)
      || moving && inside(moving, change.pixel) || pixel(after, change.pixel) === change.after)) return null;
  }
  if (recording.preparations && !recording.paths.length) {
    const preparations = recording.preparations.map(item => item.event && !same(actor, item.node.position)
      ? { ...item, event: { ...item.event, retained: true } } : item);
    if (!preparations.every(item => !item.event || item.event.changes.every(change =>
      inside(bodyBox(actor, scene.body.size), change.pixel) || pixel(after, change.pixel) === change.after))) return null;
    const activated = arrived && preparations.find(item => !item.event && same(item.node.position, node.position));
    if (activated) {
      const event = observedPreparation(recording, activated, before, after, ref, tick);
      return event ? { ...recording, preparations: preparations.map(item => item === activated ? { ...item, event } : item),
        node: null, path: [...recording.path, actor], route: [], evidence } : null;
    }
    return observeContact({ ...recording, preparations }, actor, before, after, evidence);
  }
  return observeContact(recording, actor, before, after, evidence);
}

function observeContact(recording: Recording, actor: NativePoint, before: NativeRows, after: NativeRows,
  evidence: readonly string[]): Recording | null {
  const node = recording.node;
  const arrived = node && same(actor, node.position);
  const pending = arrived ? node.peer_support.flatMap(point => {
    const first = pixel(before, point), second = pixel(after, point);
    return first === undefined || second === undefined || first === second ? [] : [{ pixel: point, before: first, after: second }];
  }) : [];
  if (arrived && !pending.length) return null;
  const { preparation } = recording;
  return { ...recording, path: [...recording.path, actor], pending, route: recording.route.slice(1), evidence,
    ...(preparation?.event && recording.paths.length === 0 && !same(actor, preparation.node.position)
      ? { preparation: { ...preparation, event: { ...preparation.event, retained: true } } } : {}) };
}

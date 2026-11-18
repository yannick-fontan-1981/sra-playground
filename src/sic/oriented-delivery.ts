import { orientedCouplingInitial, orientedCouplingScene, orientedCouplingTile } from '../logos-engine/v6-oriented-coupling.ts';
import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativeObservation, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { navigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';
import { maximumCommittedActions } from './plan-step.ts';
import { observedMechanicsGroup } from './strategy-agenda.ts';
import { measureSectorNetwork, type SectorNetwork } from './sector-delivery.ts';
import { measureDeliveryPassage, type DeliveryPassage } from './delivery-passage.ts';

export const orientedDeliveryId = 'sic_oriented_delivery';
export const verifyOrientedDeliveryId = 'sic_verify_oriented_delivery';
export const learnOrientedDeliveryId = 'sic_learn_oriented_delivery';

type Geometry = { pitch: number; phase: NativePoint; core: number; background: number; rest_shell: number;
  targets: NativePoint[]; initial_boxes: NativePoint[]; insetFill?: number };
type Scene = { pose: NativePoint; face: NativePoint; face_value: number; boxes: Record<string, number> };
type Relay = { axis: 0 | 1; line: number; direction: NativePoint; cells: NativePoint[]; carrier: string; evidence: string[] };
type State = { epoch: number; geometry: Geometry; color: number; held: NativePoint | null; invitation: NativePoint | null;
  free: Record<string, NativePoint>; loaded: Record<string, NativePoint>; tried: string[]; refs: string[]; count: number;
  transports?: readonly Transport[]; sharedEvidence?: string; transportCarriers?: string[];
  relay?: Relay; sectorNetwork?: SectorNetwork; passage?: DeliveryPassage; waits?: number; stalledWaits?: number; stopped?: boolean;
  interference?: { ink: number; ref: string }; interceptionRef?: string };
type Transport = { readonly carrier: string; readonly pose: NativePoint; readonly box: NativePoint;
  readonly sources: readonly string[] };
type Move = { pose: NativePoint; face: NativePoint; cargo: NativePoint | null };
type Motion = { input: string; prediction: Move };
type Intent = 'motion' | 'attach' | 'release';
type Step = { input: string; intent: Intent; prediction: Move | null; target: NativePoint | null; waitForTransport?: true;
  intercept?: true;
  route?: Motion[] };
type WalkStep = { input: string; before: Scene; after: Scene };
type Proposal = NativeProposal & { local: State; scene: Scene; step: Step; needId: string; attempt: string; walk?: WalkStep[] };

const labels = { ACTION1: [0, -1], ACTION2: [0, 1], ACTION3: [-1, 0], ACTION4: [1, 0] } as const;
const add = ([x, y]: NativePoint, [u, v]: NativePoint): NativePoint => [x + u, y + v];
const sub = ([x, y]: NativePoint, [u, v]: NativePoint): NativePoint => [x - u, y - v];
const key = (p: NativePoint) => p.join(',');
const same = (a: NativePoint | null, b: NativePoint | null) => a === b || !!a && !!b && a[0] === b[0] && a[1] === b[1];
const compare = (a: NativePoint, b: NativePoint) => a[0] - b[0] || a[1] - b[1];
const point = (value: string): NativePoint => { const [x, y] = value.split(',').map(Number); return [x!, y!]; };
const positions = (scene: Scene) => Object.keys(scene.boxes).map(point).sort(compare);
function tileBox(g: Geometry, [x, y]: NativePoint): NativeBox {
  const l = g.phase[0] + x * g.pitch, t = g.phase[1] + y * g.pitch;
  return [l, t, l + g.pitch - 1, t + g.pitch - 1];
}

function insetReceiver(rows: NativeRows, remembered: Geometry): Geometry | null {
  const { pitch, phase: [px, py], core, rest_shell } = remembered;
  const background = rows.flat().reduce((counts, ink) => counts.set(ink, (counts.get(ink) ?? 0) + 1), new Map<number, number>());
  if ([...background].sort((a, b) => b[1] - a[1])[0]?.[0] !== remembered.background) return null;
  const boxes: NativePoint[] = [];
  const onEdge = (x: number, y: number, width: number, height: number) => x === 0 || y === 0 || x === width - 1 || y === height - 1;
  for (let y = 0; py + (y + 1) * pitch <= rows.length; y++) {
    for (let x = 0; px + (x + 1) * pitch <= rows[0]!.length; x++) {
      const tile = orientedCouplingTile(rows, remembered, [x, y])!;
      if (tile.every((row, dy) => row.every((ink, dx) => ink === (onEdge(dx, dy, pitch, pitch) ? rest_shell : core)))) boxes.push([x, y]);
    }
  }
  if (boxes.length < 2 || boxes.length > 6) return null;
  const occupied = new Set(boxes.map(key));
  const candidates = geometricComponents(rows).flatMap(({ color, bbox: [l, t, r, b] }) => {
    const width = r - l + 1, height = b - t + 1;
    if (color !== core || width % pitch || height % pitch || (l - px) % pitch || (t - py) % pitch
      || width < 2 * pitch || height < 2 * pitch || width * height > 12 * pitch * pitch) return [];
    const left = (l - px) / pitch, top = (t - py) / pitch;
    const targets: NativePoint[] = [];
    for (let y = 0; y < height / pitch; y++) for (let x = 0; x < width / pitch; x++) targets.push([left + x, top + y]);
    const covered = targets.filter(target => occupied.has(key(target)));
    if (!covered.length || covered.length === targets.length || targets.length < boxes.length) return [];
    const colors = new Set<number>();
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (occupied.has(key([left + Math.floor(x / pitch), top + Math.floor(y / pitch)]))) continue;
      const ink = rows[t + y]![l + x]!;
      if (onEdge(x, y, width, height)) {
        if (ink !== core) return [];
      } else colors.add(ink);
    }
    const fill = [...colors][0];
    return colors.size === 1 && fill !== core && fill !== remembered.background
      ? [{ ...remembered, insetFill: fill, targets, initial_boxes: boxes }] : [];
  });
  return candidates.length === 1 ? candidates[0]! : null;
}

function carrierForms(rows: NativeRows, geometry: Geometry, ink: number) {
  const { pitch } = geometry;
  return geometricComponents(rows).flatMap(({ color, area, bbox: [l, t] }) => {
    if (color !== ink || area !== pitch ** 2 && area !== (pitch - 2) ** 2) return [];
    const inset = area !== pitch ** 2, point: NativePoint = [(l - geometry.phase[0] - Number(inset)) / pitch,
      (t - geometry.phase[1] - Number(inset)) / pitch];
    if (!point.every(Number.isInteger)) return [];
    const tile = orientedCouplingTile(rows, geometry, point);
    if (!tile) return [];
    const rim = tile[0]![0]!;
    const matches = tile.every((row, y) => row.every((value, x) =>
      value === (inset && (y === 0 || x === 0 || y === pitch - 1 || x === pitch - 1) ? rim : ink)));
    return matches ? [{ point, inset }] : [];
  });
}

function carrierPositions(observation: NativeObservation, local: State): Map<string, NativePoint[]> {
  const { pitch, phase, background, core } = local.geometry;
  const found = new Map<string, NativePoint[]>();
  for (const part of observation.entities) {
    const [x, y, r, b] = part.bbox;
    if (part.area !== pitch * pitch || r - x + 1 !== pitch || b - y + 1 !== pitch ||
      [background, core, local.color].includes(part.palette_value) || (x - phase[0]) % pitch || (y - phase[1]) % pitch) continue;
    const sites = found.get(part.signature) ?? [];
    sites.push([(x - phase[0]) / pitch, (y - phase[1]) / pitch]);
    found.set(part.signature, sites);
  }
  return found;
}

function externalCarriers(observation: NativeObservation, local: State): Map<string, NativePoint> {
  return new Map([...carrierPositions(observation, local)].flatMap(([id, sites]) => sites.length === 1 ? [[id, sites[0]!] as const] : []));
}

function sectorCarriers(observation: NativeObservation, local: State): NativePoint[] {
  return [...carrierPositions(observation, local)].flatMap(([signature, sites]) => local.transportCarriers?.includes(signature) ? sites : []).sort(compare);
}

function transportReturn(before: NativeObservation, after: NativeObservation, local: State, old: Scene, next: Scene) {
  const carriers = externalCarriers(before, local), returned = externalCarriers(after, local);
  const removed = positions(old).filter(box => !Object.hasOwn(next.boxes, key(box)) && !same(box, local.held));
  const shifts: { from: NativePoint; to: NativePoint }[] = [];
  const transports: Transport[] = [];
  for (const [carrier, pose] of carriers) {
    const position = returned.get(carrier);
    if (!position) continue;
    const previous = local.transports?.find(candidate => candidate.carrier === carrier && same(candidate.pose, pose));
    const delta = sub(position, pose);
    if (same(delta, [0, 0])) {
      if (previous && Object.hasOwn(next.boxes, key(previous.box)) && old.boxes[key(previous.box)] === next.boxes[key(previous.box)]) {
        transports.push(previous);
      }
      continue;
    }
    if (Math.abs(delta[0]) + Math.abs(delta[1]) !== 1) continue;
    const pairs = removed.flatMap(from => {
      if (Math.abs(from[0] - pose[0]) + Math.abs(from[1] - pose[1]) !== 1 || shifts.some(shift => same(shift.from, from))) return [];
      const to = add(from, delta);
      if (Object.hasOwn(old.boxes, key(to)) || !Object.hasOwn(next.boxes, key(to)) || shifts.some(shift => same(shift.to, to))) return [];
      return [{ from, to }];
    });
    if (pairs.length !== 1) continue;
    const shift = pairs[0]!;
    shifts.push(shift);
    const evidence = previous && same(previous.box, shift.from) ? previous.sources.slice(-1) : [];
    transports.push({ carrier, pose: position, box: shift.to, sources: [...evidence, after.observation_ref] });
  }
  return { shifts, transports };
}

function shortest(start: Move, fixed: Set<string>, floor: Set<string>, vectors: Readonly<Record<string, NativePoint>>,
  accepts: (state: Move) => boolean, cargoFloor = floor): { step: Step | null; end: Move; length: number } | null {
  const moves = Object.entries(vectors);
  const queue: { state: Move; step: Motion | null; parent: number; length: number }[] =
    [{ state: start, step: null, parent: -1, length: 0 }];
  const visited = new Set<string>();
  for (let index = 0; index < queue.length; index++) {
    const { state, length } = queue[index]!;
    const identity = JSON.stringify([state.pose, state.face, state.cargo]);
    if (visited.has(identity)) continue;
    visited.add(identity);
    if (accepts(state)) {
      const route: Motion[] = [];
      for (let entry = queue[index]!; entry.step; entry = queue[entry.parent]!) route.push(entry.step);
      route.reverse();
      const step: Step | null = route[0] ? { ...route[0], intent: 'motion', target: null, route } : null;
      return { step, end: state, length };
    }
    if (visited.size >= 2048) return null;
    for (const [input, delta] of moves) {
      const pose = add(state.pose, delta), face = state.cargo ? state.face : delta;
      const cargo = state.cargo ? add(state.cargo, delta) : null;
      const occupiable = (q: NativePoint, surface: Set<string>) => surface.has(key(q)) && !fixed.has(key(q));
      const prediction = occupiable(pose, floor) && (!cargo || occupiable(cargo, cargoFloor)) ? { pose, face, cargo } : { ...state, face };
      if (same(prediction.pose, state.pose) && same(prediction.face, state.face)) continue;
      queue.push({ state: prediction, step: { input, prediction }, parent: index, length: length + 1 });
    }
  }
  return null;
}

function deliveryFloor(g: Geometry, scene: Scene, rows: NativeRows) {
  const floor = new Set([...positions(scene), scene.pose, ...g.targets].map(key));
  for (let y = 0; y * g.pitch + g.phase[1] + g.pitch <= rows.length; y++) {
    for (let x = 0; x * g.pitch + g.phase[0] + g.pitch <= rows[0]!.length; x++) {
      const cell: NativePoint = [x, y];
      const tile = orientedCouplingTile(rows, g, cell)!;
      const ink = tile[0]![0]!;
      if ((ink === g.background || ink === g.insetFill) && tile.every(row => row.every(value => value === ink))) floor.add(key(cell));
    }
  }
  return floor;
}

function planInterception(local: State, scene: Scene, rows: NativeRows, commands: Readonly<Record<string, NativePoint>>,
  carrier: ReturnType<typeof carrierForms>[number]): Step | null {
  const target = carrier.point;
  if (local.held) return null;
  if (same(add(scene.pose, scene.face), target)) {
    if (carrier.inset) return { input: 'ACTION5', intent: 'attach', prediction: null, target, intercept: true };
    const input = Object.keys(commands).find(input => same(commands[input]!, scene.face));
    return input ? { input, intent: 'motion', prediction: { pose: scene.pose, face: scene.face, cargo: null }, target } : null;
  }
  const fixed = new Set([...positions(scene), target].map(key));
  const route = shortest({ pose: scene.pose, face: scene.face, cargo: null }, fixed, deliveryFloor(local.geometry, scene, rows),
    commands, state => same(add(state.pose, state.face), target));
  return route?.step ? { ...route.step, target } : null;
}

function planDelivery(local: State, scene: Scene, rows: NativeRows, commands: Readonly<Record<string, NativePoint>>,
  blockers: readonly NativePoint[] = []): Step | null {
  const { geometry: g, held } = local, parts = positions(scene);
  const reserved = new Set((local.transports ?? []).filter(item => item.sources.length >= 2).map(item => key(item.box)));
  const goal = new Set(g.targets.map(key)), floor = deliveryFloor(g, scene, rows);
  const choices: { step: Step; length: number; index: number; target: NativePoint; face: NativePoint }[] = [];
  for (const [index, part] of parts.entries()) {
    if (held ? !same(held, part) : goal.has(key(part)) || reserved.has(key(part))) continue;
    const fixed = new Set([...parts.filter(other => !same(part, other)), ...blockers].map(key));
    for (const target of g.targets.filter(target => !fixed.has(key(target)))) {
      for (const face of held ? [scene.face] : Object.values(commands)) {
        let start: Move = { pose: scene.pose, face: scene.face, cargo: held };
        let length = 0, opening: Step | null = null;
        if (!held) {
          const approach = shortest(start, new Set([...fixed, key(part)]), floor, commands,
            state => same(state.pose, sub(part, face)) && same(state.face, face));
          if (!approach) continue;
          start = { ...approach.end, cargo: part };
          length = approach.length + 1;
          opening = approach.step ?? { input: 'ACTION5', intent: 'attach', prediction: null, target: part };
        }
        const path = shortest(start, fixed, floor, commands, state => same(state.cargo, target));
        if (!path) continue;
        const step = opening ?? path.step ?? { input: 'ACTION5', intent: 'release', prediction: null, target };
        choices.push({ step: { ...step, target: step.target ?? target }, length: length + path.length + 1, index, target, face });
      }
    }
  }
  choices.sort((a, b) => a.length - b.length || a.index - b.index || compare(a.target, b.target) || compare(a.face, b.face));
  return choices[0]?.step ?? null;
}

function allowDelivery(local: State, scene: Scene, rows: NativeRows, commands: Readonly<Record<string, NativePoint>>,
  reserved: readonly Transport[], alreadyTried: (step: Step) => boolean): Step | null {
  if (local.held || !reserved.length) return null;
  const { geometry } = local;
  const targets = new Set(geometry.targets.map(key));
  if (positions(scene).some(part => !targets.has(key(part)) && !reserved.some(item => same(item.box, part)))) return null;
  const roomDistance = (position: NativePoint) => Math.min(...geometry.targets.map(target =>
    Math.abs(position[0] - target[0]) + Math.abs(position[1] - target[1])));
  const choices = Object.entries(commands).flatMap(([input, delta]) => {
    const pose = add(scene.pose, delta);
    if (!orientedCouplingTile(rows, geometry, pose)?.every(row => row.every(value => value === geometry.background))) return [];
    const step: Step = { input, intent: 'motion', prediction: { pose, face: delta, cargo: null }, target: reserved[0]!.box, waitForTransport: true };
    return alreadyTried(step) ? [] : [step];
  });
  choices.sort((a, b) => roomDistance(b.prediction!.pose) - roomDistance(a.prediction!.pose));
  return choices[0] ?? null;
}

function onSendingSide(relay: Relay, site: NativePoint): boolean {
  return (site[relay.axis] - relay.line) * relay.direction[relay.axis] < 0;
}

function planPassage(local: State, scene: Scene, commands: Readonly<Record<string, NativePoint>>, peers: NativePoint[]): Step | null {
  const passage = local.passage!;
  const parts = positions(scene), held = local.held;
  const targets = new Set(local.geometry.targets.map(key));
  const reserved = new Set((local.transports ?? []).filter(item => item.sources.length >= 2).map(item => key(item.box)));
  const pending = parts.filter(part => !targets.has(key(part)));
  const work = held ? [held] : pending.filter(part => !reserved.has(key(part)));
  const current: Move = { pose: scene.pose, face: scene.face, cargo: held };
  const floor = new Set(passage.floor), source = new Set(passage.source);
  const handoff = pending.length > 1 && source.has(key(scene.pose));
  const options: { step: Step; cost: number }[] = [];
  for (const part of work) {
    if (handoff && !held && (!source.has(key(part)) || passage.staging.includes(key(part)))) continue;
    const surface = handoff ? source : floor;
    const fixed = new Set([...parts.filter(other => !same(part, other)), ...peers].map(key));
    const goals = handoff ? new Set(passage.mouths.map(key)) : targets;
    for (const face of held ? [scene.face] : Object.values(commands)) {
      const approach = held ? { end: current, length: 0, step: null }
        : shortest(current, new Set([...fixed, key(part)]), surface, commands,
          move => same(move.pose, sub(part, face)) && same(move.face, face));
      if (!approach) continue;
      const stage = shortest({ ...approach.end, cargo: part }, fixed, surface, commands,
        move => !!move.cargo && goals.has(key(move.cargo)));
      if (!stage?.end.cargo) continue;
      const step = approach.step ?? (held ? stage.step ?? { input: 'ACTION5', intent: 'release', prediction: null, target: stage.end.cargo }
        : { input: 'ACTION5', intent: 'attach', prediction: null, target: part });
      options.push({ step: { ...step, target: step.target ?? stage.end.cargo }, cost: approach.length + stage.length });
    }
  }
  options.sort((a, b) => a.cost - b.cost);
  if (options.length) return options[0]!.step;
  if (held && !handoff) {
    const fixed = new Set([...parts.filter(part => !same(part, held)), ...peers].map(key));
    const rest = shortest(current, fixed, floor, commands, parked => {
      if (!parked.cargo || targets.has(key(parked.cargo))) return false;
      const part = parked.cargo;
      for (const face of Object.values(commands)) {
        if (same(face, parked.face)) continue;
        const approach = shortest({ ...parked, cargo: null }, new Set([...fixed, key(part)]), floor, commands,
          move => same(move.pose, sub(part, face)) && same(move.face, face));
        if (approach && shortest({ ...approach.end, cargo: part }, fixed, floor, commands,
          move => !!move.cargo && targets.has(key(move.cargo)))) return true;
      }
      return false;
    });
    if (rest) return rest.step ?? { input: 'ACTION5', intent: 'release', prediction: null, target: held };
  }
  if ((local.stalledWaits ?? 0) >= 5 || !peers.length) return null;
  const front = add(scene.pose, scene.face);
  if (!held && !Object.hasOwn(scene.boxes, key(front))) {
    return { input: 'ACTION5', intent: 'motion', prediction: current, target: pending[0] ?? null, waitForTransport: true };
  }
  const occupied = new Set([...parts, ...peers].map(key));
  for (const [input, delta] of Object.entries(commands)) {
    const pose = add(scene.pose, delta), cargo = held ? add(held, delta) : null;
    if (!floor.has(key(pose)) || occupied.has(key(pose)) && !same(pose, held) ||
      cargo && (!floor.has(key(cargo)) || occupied.has(key(cargo)))) continue;
    return { input, intent: 'motion', prediction: { pose, face: held ? scene.face : delta, cargo },
      target: pending[0] ?? null, waitForTransport: true };
  }
  return null;
}

function measureRelay(rows: NativeRows, observation: NativeObservation, local: State, scene: Scene, previous: State): Relay | null {
  const g = local.geometry, carriers = externalCarriers(observation, local);
  const limits = [Math.floor((rows[0]!.length - g.phase[0]) / g.pitch), Math.floor((rows.length - g.phase[1]) / g.pitch)];
  const candidates: Relay[] = [];
  for (const axis of [0, 1] as const) {
    const sign = Math.sign(g.targets[0]![axis] - scene.pose[axis]);
    if (!sign || g.targets.some(target => Math.sign(target[axis] - scene.pose[axis]) !== sign)) continue;
    const direction: NativePoint = axis === 0 ? [sign, 0] : [0, sign];
    const crossAxis = axis === 0 ? 1 : 0;
    for (let line = scene.pose[axis] + sign; g.targets.every(target => (target[axis] - line) * sign > 0); line += sign) {
      const peers = (previous.transportCarriers ?? []).filter(id => {
        const site = carriers.get(id);
        return !!site && (site[axis] - line) * sign > 0;
      });
      if (peers.length !== 1) continue;
      const patterns = new Map<string, NativePoint[]>(), occupied: NativePoint[] = [];
      for (let offset = 0; offset < limits[crossAxis]!; offset++) {
        const site: NativePoint = axis === 0 ? [line, offset] : [offset, line];
        if (Object.hasOwn(scene.boxes, key(site))) {
          occupied.push(site);
          continue;
        }
        const tile = orientedCouplingTile(rows, g, site);
        if (!tile) continue;
        const values = new Set(tile.flat());
        if (values.size < 2 || !values.has(g.background) || values.has(g.core)) continue;
        const signature = JSON.stringify(tile), sites = patterns.get(signature) ?? [];
        sites.push(site);
        patterns.set(signature, sites);
      }
      const repeated = [...patterns.values()].filter(sites => sites.length >= 3);
      if (repeated.length !== 1 || !occupied.length) continue;
      const measured = [...repeated[0]!, ...occupied].sort((a, b) => a[crossAxis] - b[crossAxis]);
      if (measured.some((site, index) => index > 0 && site[crossAxis] !== measured[index - 1]![crossAxis] + 1)) continue;
      const cells = measured.filter(site => {
        const across = add(site, direction);
        return [...carriers.values()].some(pose => same(pose, across)) || Object.hasOwn(scene.boxes, key(across))
          || orientedCouplingTile(rows, g, across)?.every(row => row.every(value => value === g.background));
      });
      if (cells.length) candidates.push({ axis, line, direction, cells, carrier: peers[0]!,
        evidence: [previous.sharedEvidence!, observation.observation_ref] });
    }
  }
  return candidates.length === 1 ? candidates[0]! : null;
}

function planRelay(local: State, scene: Scene, rows: NativeRows, commands: Readonly<Record<string, NativePoint>>): Step | null {
  const { geometry, held, relay } = local;
  if (!relay) return null;
  const parts = positions(scene), floor = new Set([scene.pose, ...parts].filter(site => onSendingSide(relay, site)).map(key));
  for (let y = 0; y * geometry.pitch + geometry.phase[1] + geometry.pitch <= rows.length; y++) {
    for (let x = 0; x * geometry.pitch + geometry.phase[0] + geometry.pitch <= rows[0]!.length; x++) {
      const site: NativePoint = [x, y];
      if (onSendingSide(relay, site) && orientedCouplingTile(rows, geometry, site)?.every(row => row.every(p => p === geometry.background))) {
        floor.add(key(site));
      }
    }
  }
  const goals = new Set(relay.cells.map(key)), cargoFloor = new Set([...floor, ...goals]);
  const current: Move = { pose: scene.pose, face: scene.face, cargo: held };
  const choices = (held ? [held] : parts.filter(site => onSendingSide(relay, site))).flatMap(part => {
    const fixed = new Set(parts.filter(other => !same(part, other)).map(key));
    const approach = held ? { end: current, length: 0, step: null }
      : shortest(current, new Set([...fixed, key(part)]), floor, commands,
        move => same(move.pose, sub(part, relay.direction)) && same(move.face, relay.direction));
    if (!approach) return [];
    const stage = shortest({ ...approach.end, cargo: part }, fixed, floor, commands,
      move => !!move.cargo && goals.has(key(move.cargo)), cargoFloor);
    if (!stage?.end.cargo) return [];
    const step: Step = approach.step ?? (held ? stage.step ?? { input: 'ACTION5', intent: 'release', prediction: null, target: stage.end.cargo }
      : { input: 'ACTION5', intent: 'attach', prediction: null, target: part });
    return [{ step: { ...step, target: step.target ?? stage.end.cargo }, cost: approach.length + stage.length, part }];
  });
  choices.sort((a, b) => a.cost - b.cost || compare(a.part, b.part));
  if (choices.length) return choices[0]!.step;
  if (held || parts.some(site => onSendingSide(relay, site)) || (local.waits ?? 0) >= 48 || (local.stalledWaits ?? 0) >= 6) return null;
  const input = Object.entries(commands).find(([, delta]) => same(delta, relay.direction))?.[0];
  if (!input) return null;
  const ahead = add(scene.pose, relay.direction), pose = floor.has(key(ahead)) ? ahead : scene.pose;
  return { input, intent: 'motion', prediction: { pose, face: relay.direction, cargo: null },
    target: parts.find(site => !geometry.targets.some(goal => same(site, goal))) ?? null, waitForTransport: true };
}

function planSectorRelay(local: State, scene: Scene, commands: Readonly<Record<string, NativePoint>>): Step | null {
  const network = local.sectorNetwork!, floor = new Set(network.sending), parts = positions(scene);
  const held = local.held, current: Move = { pose: scene.pose, face: scene.face, cargo: held };
  const pendingPorts = network.receiving.flatMap(sector => {
    const cells = new Set([...sector.cells, ...sector.ports.map(port => key(port.cell))]);
    const loaded = parts.filter(part => !same(part, held) && cells.has(key(part))).length;
    return loaded < sector.targets.length ? sector.ports : [];
  });
  const cargoFloor = new Set([...floor, ...pendingPorts.map(port => key(port.cell))]);
  const choices = (held ? [held] : parts.filter(part => floor.has(key(part)))).flatMap(part => {
    const fixed = new Set(parts.filter(other => !same(part, other)).map(key));
    const contact = (face: NativePoint) => same(current.face, face) && same(add(current.pose, face), part);
    return (held ? [scene.face] : Object.values(commands)).flatMap(face => {
      if (!pendingPorts.some(port => same(port.face, face))) return [];
      const approach = held || contact(face) ? { end: current, length: 0, step: null }
        : shortest(current, new Set([...fixed, key(part)]), floor, commands,
          move => same(move.face, face) && same(add(move.pose, face), part));
      if (!approach) return [];
      const stage = shortest({ ...approach.end, cargo: part }, fixed, floor, commands,
        move => pendingPorts.some(port => same(port.face, face) && same(move.cargo, port.cell)), cargoFloor);
      if (!stage?.end.cargo) return [];
      const step: Step = approach.step ?? (held ? stage.step ?? { input: 'ACTION5', intent: 'release', prediction: null, target: stage.end.cargo }
        : { input: 'ACTION5', intent: 'attach', prediction: null, target: part });
      return [{ step: { ...step, target: step.target ?? stage.end.cargo }, cost: approach.length + stage.length, part }];
    });
  });
  choices.sort((a, b) => a.cost - b.cost || compare(a.part, b.part));
  if (choices.length) return choices[0]!.step;
  if (held || parts.some(part => floor.has(key(part))) || (local.waits ?? 0) >= 48 || (local.stalledWaits ?? 0) >= 6) return null;
  const blocked = Object.keys(scene.boxes);
  const delays = Object.entries(commands);
  const [input, face] = delays.find(([, face]) => !floor.has(key(add(scene.pose, face))) || blocked.includes(key(add(scene.pose, face))))
    ?? delays[0]!;
  const ahead = add(scene.pose, face), pose = floor.has(key(ahead)) && !blocked.includes(key(ahead)) ? ahead : scene.pose;
  return { input, intent: 'motion', prediction: { pose, face, cargo: null },
    target: parts.find(site => !local.geometry.targets.some(goal => same(site, goal))) ?? null, waitForTransport: true };
}

function relayMatches(proposal: Proposal, scene: Scene): boolean {
  const { local, step, scene: previous } = proposal;
  if (step.prediction) {
    const { pose, face, cargo } = step.prediction;
    return same(scene.pose, pose) && same(scene.face, face)
      && (!cargo || scene.boxes[key(cargo)] === scene.face_value
        && (same(local.held, cargo) || !local.held || !Object.hasOwn(scene.boxes, key(local.held))));
  }
  if (!same(scene.pose, previous.pose) || !same(scene.face, previous.face)) return false;
  const contact = key(add(scene.pose, scene.face)), shell = scene.boxes[contact];
  return step.intent === 'attach' ? shell === scene.face_value
    : (shell !== undefined && shell !== scene.face_value) || !Object.hasOwn(scene.boxes, contact);
}

function walkPrefix(step: Step, initial: Scene, local: State, remaining: number): WalkStep[] {
  const walk: WalkStep[] = [];
  let before = initial, cargo = local.held;
  for (const { input, prediction } of step.route?.slice(0, Math.min(remaining, maximumCommittedActions, 70 - local.count)) ?? []) {
    const known = (cargo ? local.loaded : local.free)[input];
    if (!known || !same(add(before.pose, known), prediction.pose)) break;
    const boxes = { ...before.boxes };
    if (cargo && prediction.cargo) {
      const value = boxes[key(cargo)]!;
      delete boxes[key(cargo)];
      boxes[key(prediction.cargo)] = value;
    }
    const ahead = add(prediction.pose, prediction.face);
    if (!same(ahead, prediction.cargo) && Object.hasOwn(boxes, key(ahead))) break;
    const after = { ...before, pose: prediction.pose, face: prediction.face, boxes };
    walk.push({ input, before, after });
    cargo = prediction.cargo;
    before = after;
  }
  return walk;
}

function matchesScene(actual: Scene | null, predicted: Scene): boolean {
  return !!actual && same(actual.pose, predicted.pose) && same(actual.face, predicted.face)
    && actual.face_value === predicted.face_value && Object.keys(actual.boxes).length === Object.keys(predicted.boxes).length
    && Object.entries(predicted.boxes).every(([position, value]) => actual.boxes[position] === value);
}

function confirmsInterception(proposal: Proposal, rows: NativeRows, scene: Scene | null): boolean {
  const { geometry, interference } = proposal.local, target = proposal.step.target;
  if (!interference || !target || !matchesScene(scene, proposal.scene)) return false;
  const tile = orientedCouplingTile(rows, geometry, target);
  return !!tile && tile.every(row => row.every(ink => ink === geometry.background || ink === geometry.insetFill))
    && carrierForms(rows, geometry, interference.ink).length === 0;
}

export function createSicVerifyOrientedDelivery(family = verifyOrientedDeliveryId): NativeFamily<Proposal> {
  let state: State | null = null;
  let decide: NativeProgramHandle | undefined;
  return {
    id: family,
    async attachPrograms(registry) {
      decide = await registry.registerProgram(chooseLanding, {}, await landingModule());
    },
    async proposeInGroup(group, observation, rows, inputs, remaining, execution) {
      if (group !== observedMechanicsGroup) return this.propose(observation, rows, inputs, remaining, execution);
      const epoch = observation.level_epoch;
      if (!(state?.epoch === epoch && (state.relay || state.sectorNetwork || state.passage || state.geometry.insetFill !== undefined))
        && !(state?.epoch === epoch - 1 && state.sharedEvidence)) return null;
      const proposal = await this.propose(observation, rows, inputs, remaining, execution);
      return proposal && (proposal.local.relay || proposal.local.sectorNetwork || proposal.local.passage
        || proposal.local.geometry.insetFill !== undefined) ? proposal : null;
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !Object.keys(labels).every(input => observation.available_action_refs.includes(input))
        || !observation.available_action_refs.includes('ACTION5') || observation.available_action_refs.includes('ACTION6')) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      const previous = state?.epoch === observation.level_epoch - 1 && state.sharedEvidence ? state : null;
      if (prior?.stopped || prior && !prior.passage && prior.count >= (prior.relay || prior.sectorNetwork ? 120 : 70)) return null;
      const learns = family === learnOrientedDeliveryId && !prior && !previous;
      const receipt = learns ? execution?.readPriorDirectionalScene?.(earlier => orientedCouplingInitial(earlier) as Geometry | null) : null;
      if (learns && (!receipt || receipt.afterRef !== observation.observation_ref)) return null;
      const ordinary = prior?.geometry ?? receipt?.scene ?? orientedCouplingInitial(rows) as Geometry | null;
      const dividedGeometry = !ordinary && previous ? orientedCouplingInitial(rows, true) as Geometry | null : null;
      const divided = !!dividedGeometry;
      const geometry = ordinary ?? dividedGeometry ?? (previous ? insetReceiver(rows, previous.geometry) : null);
      if (!geometry || geometry.targets.length > 12 || (!divided && !prior?.sectorNetwork && geometry.initial_boxes.length > 6)) return null;
      const inset = geometry.insetFill !== undefined;
      const possible = prior ? [prior.color] : [...new Set(rows.flat())].filter(value => ![geometry.core, geometry.background, geometry.rest_shell].includes(value));
      const scenes = possible.flatMap(color => {
        const scene = orientedCouplingScene(rows, geometry, color) as Scene | null;
        return scene ? [{ color, scene }] : [];
      });
      if (scenes.length !== 1) return null;
      const { color, scene } = scenes[0]!, ahead = add(scene.pose, scene.face);
      const priorScene = receipt && execution?.readPriorDirectionalScene?.(earlier => orientedCouplingScene(earlier, geometry, color) as Scene | null);
      const delta = priorScene ? sub(scene.pose, priorScene.scene.pose) : null;
      if (receipt && (!delta || Math.abs(delta[0]) + Math.abs(delta[1]) !== 1 || !same(scene.face, delta)
        || Object.keys(priorScene!.scene.boxes).join('|') !== Object.keys(scene.boxes).join('|'))) return null;
      const shellChanges = priorScene ? Object.keys(scene.boxes).filter(key => scene.boxes[key] !== priorScene.scene.boxes[key]) : [];
      if (receipt && shellChanges.length && (shellChanges.length !== 1 || shellChanges[0] !== key(ahead))) return null;
      const initial: State = prior ?? { epoch: observation.level_epoch, geometry, color, held: null,
        invitation: shellChanges.length ? ahead : null, free: receipt && delta ? { [receipt.command]: delta } : {}, loaded: {},
        tried: priorScene ? [JSON.stringify([priorScene.scene.pose, priorScene.scene.face, priorScene.scene.boxes, null, priorScene.command])] : [],
        refs: receipt ? [receipt.beforeRef, receipt.afterRef] : [], count: receipt ? 1 : 0 };
      const relay = prior?.relay ?? (!prior && previous && !divided && !inset ? measureRelay(rows, observation, initial, scene, previous) : null);
      const sectorNetwork = prior?.sectorNetwork ?? (divided && previous
        ? measureSectorNetwork(rows, geometry, scene.pose, positions(scene), sectorCarriers(observation, { ...initial, transportCarriers: previous.transportCarriers })) : null);
      const measurePassage = !prior && !!previous && !relay && !divided && !inset;
      const peers = prior?.passage || measurePassage
        ? sectorCarriers(observation, { ...initial, transportCarriers: previous?.transportCarriers ?? prior?.transportCarriers }) : [];
      const passage = prior?.passage ?? (measurePassage
        ? measureDeliveryPassage(rows, geometry, scene.pose, positions(scene), peers) : null);
      const handsOff = !!relay || !!sectorNetwork || !!passage;
      if (!handsOff && (divided || geometry.targets.length > 6)) return null;
      const local: State = !prior && (handsOff || inset) && previous
        ? { ...initial, ...(relay ? { relay } : {}), ...(sectorNetwork ? { sectorNetwork } : {}), ...(passage ? { passage } : {}),
          free: previous.free, loaded: previous.loaded, sharedEvidence: previous.sharedEvidence!,
          transportCarriers: [...(previous.transportCarriers ?? [])] } : initial;
      const commands: Readonly<Record<string, NativePoint>> = { ...labels, ...local.free, ...(local.held ? local.loaded : {}) };
      const reserved = (local.transports ?? []).filter(item => item.sources.length >= 2);
      const invited = same(ahead, local.invitation) && Object.hasOwn(scene.boxes, key(ahead)) && !reserved.some(item => same(item.box, ahead));
      const forms = local.interference ? carrierForms(rows, geometry, local.interference.ink) : [];
      const carrier = forms.length === 1 ? forms[0]! : null;
      const blockers = inset ? [...externalCarriers(observation, local).values(), ...(carrier ? [carrier.point] : [])] : [];
      const unique = (step: Step) => JSON.stringify([scene.pose, scene.face, scene.boxes, local.held, step.input,
        ...(passage ? [peers] : []), ...(carrier ? [carrier.point] : [])]);
      const step: Step | null = sectorNetwork ? planSectorRelay(local, scene, commands)
        : relay ? planRelay(local, scene, rows, commands)
        : passage ? planPassage(local, scene, commands, peers)
        : !local.held && invited && (!local.count || !Object.keys(local.loaded).length)
        ? { input: 'ACTION5', intent: 'attach', prediction: null, target: ahead }
        : (carrier ? planInterception(local, scene, rows, commands, carrier) : null)
          ?? planDelivery(local, scene, rows, commands, blockers)
          ?? allowDelivery(local, scene, rows, commands, reserved, step => local.tried.includes(unique(step)));
      if (!step || (!(handsOff && step.waitForTransport) && local.tried.includes(unique(step)))) return null;
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...new Set([...local.refs, local.sharedEvidence, local.interference?.ref, local.interceptionRef,
        ...(relay?.evidence ?? []), ...reserved.flatMap(item => item.sources)]
        .filter((value): value is string => !!value && value !== ref))];
      const known = step.intent === 'motion' ? (local.held ? local.loaded : local.free)[step.input] : null;
      const mode = execution?.reasoningMode ?? 'exploration';
      const knownInteraction = !step.intercept && step.intent !== 'motion' && Object.keys(local.loaded).length > 0;
      const facts = { routeSupported: !!known, knownInteraction, eligibleProbe: !known && !knownInteraction, mode };
      const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
      const strategy = known ? 'P07' : knownInteraction ? 'P02' : 'P05';
      if (decision?.result !== strategy) return null;
      const label = navigationPrimitives[strategy], parent = 'G_official_completion';
      const situation = step.intercept ? 'Test contact with the carrier that removed a part from the receiver'
        : carrier && !local.held ? 'Approach the carrier that moved a part out of the receiver'
        : sectorNetwork && step.waitForTransport ? 'Give the carriers time to finish deliveries in their sectors'
        : sectorNetwork && step.intent === 'release' ? 'Leave the part for a carrier in a sector that still has an open target'
        : sectorNetwork && local.held ? 'Take the part to a relay port serving a sector that needs a delivery'
        : step.waitForTransport ? 'Keep the receiving area free while the other carrier completes the observed delivery'
        : passage && step.intent === 'release' && step.target && passage.staging.includes(key(step.target)) ? 'Stage the part at the passage for the other carrier'
        : passage && step.intent === 'release' && step.target && !geometry.targets.some(target => same(target, step.target))
          ? 'Set down the part to change the direction of the final approach'
        : relay && step.intent === 'release' ? 'Leave the part on the shared strip for the other carrier'
          : relay && local.held ? 'Move the part to the shared strip while the player stays on its side'
        : step.intent === 'attach' ? 'Test whether the object in front attaches'
        : step.intent === 'release' ? 'Test whether the part stays in its receiving cell'
          : local.held ? 'Move while checking that the part keeps its offset' : 'Approach the next part and bring it in front of the carrier';
      const objective = { kind: 'fill_receiving_region_with_oriented_parts', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['oriented_carrier', 'part_in_front', 'receiving_region'], parentObjective: parent,
        satisfactionContract: 'official_progress_after_depositing_compatible_parts' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = 'oriented-delivery:' + need.id, action = { action_ref: step.input, data: {} };
      const prediction = known || handsOff ? step.prediction : null;
      const peer = relay ? externalCarriers(observation, local).get(relay.carrier) : null;
      const exclusive = !local.sharedEvidence || (inset && !!local.interceptionRef && !blockers.length);
      const prefix = known && !handsOff && exclusive ? walkPrefix(step, scene, local, remaining) : [];
      const walk = prefix.length > 1 ? prefix : undefined;
      const actions = walk?.map(step => ({ action_ref: step.input, data: {} })) ?? [action];
      return { status: 'proposed', kind: family, actions,
        steps: actions.map((action, index) => ({ action, expected_after: walk?.[index]?.after ?? prediction })),
        ...(walk ? { walk } : {}),
        local, scene, step, needId: need.id, attempt: unique(step),
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: facts },
        sicSituationCard: { strategy, need: 'Bring the framed parts into the receiving region', situation, evidence, agenda: [], mode,
          triggerCard: decision.receipt.workflow,
          actor: tileBox(geometry, scene.pose), cargo: local.held ? tileBox(geometry, local.held) : invited ? tileBox(geometry, ahead) : null,
          target: step.target ? tileBox(geometry, step.target) : null,
          ...(sectorNetwork ? { receivingTargets: sectorNetwork.receiving.flatMap(sector => sector.targets.map(target => tileBox(geometry, target))),
            externalCarriers: sectorCarriers(observation, local).map(site => tileBox(geometry, site)) } : {}),
          ...(passage ? { receivingTargets: geometry.targets.map(target => tileBox(geometry, target)),
            externalCarriers: peers.map(site => tileBox(geometry, site)) } : {}),
          ...(peer ? { externalCarriers: [tileBox(geometry, peer)] } : {}),
          ...(carrier ? { externalCarriers: [tileBox(geometry, carrier.point)] } : {}),
          ...(reserved.length ? { externalCarriers: reserved.map(item => tileBox(geometry, item.pose)), reservedParts: reserved.map(item => tileBox(geometry, item.box)) } : {}) },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, packet, observation) {
      const { local } = proposal, step = proposal.walk?.[index];
      const admitted = index === 0 ? proposal.binding?.observation_ref === observation.observation_ref
        : !!step && proposal.binding?.level_epoch === observation.level_epoch
          && matchesScene(orientedCouplingScene(packet.frame_rows, local.geometry, local.color) as Scene | null, step.before);
      return { admitted, reason: admitted ? 'current_oriented_carrier_bound' : 'oriented_carrier_context_changed' };
    },
    after(proposal, index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      if (proposal.step.intercept) {
        const { geometry, color } = proposal.local;
        const scene = orientedCouplingScene(second, geometry, color) as Scene | null;
        const matched = confirmsInterception(proposal, second, scene);
        return { matched, seal_prefix: true, reason: matched ? 'interfering_carrier_removed' : 'contact_effect_unconfirmed' };
      }
      const walk = proposal.walk?.[index];
      if (walk) {
        const { local } = proposal;
        const matched = before.state === after.state
          && matchesScene(orientedCouplingScene(second, local.geometry, local.color) as Scene | null, walk.after);
        return { matched, seal_prefix: !matched || index + 1 === proposal.actions.length,
          reason: matched ? 'carrier_and_parts_followed_declared_route' : 'carrier_or_parts_diverged' };
      }
      if (proposal.local.relay || proposal.local.sectorNetwork || proposal.local.passage) {
        const scene = orientedCouplingScene(second, proposal.local.geometry, proposal.local.color) as Scene | null;
        const matched = !!scene && before.state === after.state && relayMatches(proposal, scene);
        return { matched, seal_prefix: true, reason: !matched ? 'relay_carrier_prediction_contradicted'
          : proposal.step.waitForTransport ? 'observed_parallel_delivery_turn'
            : proposal.step.intent === 'release' ? 'observed_release_on_the_shared_strip' : 'observed_own_carrier_and_part' };
      }
      const predicted = proposal.steps?.[0]?.expected_after as Move | null, previous = proposal.scene;
      if (proposal.local.sharedEvidence && proposal.step.intent !== 'motion') {
        const scene = orientedCouplingScene(second, proposal.local.geometry, proposal.local.color) as Scene | null;
        const contact = key(add(previous.pose, previous.face));
        const shell = scene?.boxes[contact];
        const matched = !!scene && same(scene.pose, previous.pose) && same(scene.face, previous.face) &&
          shell !== undefined && shell !== previous.boxes[contact] && (shell === scene.face_value) === (proposal.step.intent === 'attach');
        return { matched, seal_prefix: true, reason: 'compare_shell_at_current_carrier_contact' };
      }
      const scene = predicted ? orientedCouplingScene(second, proposal.local.geometry, proposal.local.color) as Scene | null : null;
      const expected = new Set(Object.keys(previous.boxes).filter(p => !proposal.local.held || p !== key(proposal.local.held)));
      if (predicted?.cargo) expected.add(key(predicted.cargo));
      if (scene) for (const shift of transportReturn(before, after, proposal.local, previous, scene).shifts) {
        expected.delete(key(shift.from));
        expected.add(key(shift.to));
      }
      const matched = predicted ? !!scene && same(scene.pose, predicted.pose) && same(scene.face, predicted.face)
        && expected.size === Object.keys(scene.boxes).length && Object.keys(scene.boxes).every(p => expected.has(p)) : null;
      return { matched, seal_prefix: true, reason: 'compare_carrier_orientation_and_part_positions' };
    },
    record(before, after, action, _first, second, proposal, index) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const local = index > 0 ? state ?? proposal.local : proposal.local;
      const old = proposal.walk?.[index]?.before ?? proposal.scene;
      const { step } = proposal;
      const scene = orientedCouplingScene(second, local.geometry, local.color) as Scene | null;
      if (!scene) return { events: [] };
      const delta = sub(scene.pose, old.pose), moved = delta.some(Boolean);
      const changed = Object.keys(old.boxes).filter(key => Object.hasOwn(scene.boxes, key) && old.boxes[key] !== scene.boxes[key]);
      const ahead = add(scene.pose, scene.face);
      const external = transportReturn(before, after, local, old, scene);
      const next: State = { ...local, count: local.count + 1, invitation: null, refs: [...local.refs.slice(-5), after.observation_ref],
        tried: [...local.tried, index === 0 ? proposal.attempt : JSON.stringify([old.pose, old.face, old.boxes, local.held, action.action_ref])] };
      if (local.transports?.length || external.transports.length) next.transports = external.transports;
      if (local.geometry.insetFill !== undefined && !local.interference) {
        const inReceiver = (site: NativePoint) => local.geometry.targets.some(target => same(target, site));
        const removed = external.shifts.find(shift => inReceiver(shift.from) && !inReceiver(shift.to));
        const carrier = removed && external.transports.find(item => same(item.box, removed.to));
        const body = carrier && after.entities.find(part => part.signature === carrier.carrier);
        if (body) next.interference = { ink: body.palette_value, ref: after.observation_ref };
      }
      if (step.intercept && local.interference) {
        if (confirmsInterception(proposal, second, scene)) {
          delete next.interference;
          next.interceptionRef = after.observation_ref;
          state = next;
          return { events: [], reviewEvidence: 'The tested contact removed the carrier that displaced a delivered part.' };
        }
        next.stopped = true;
        state = next;
        return { events: [] };
      }
      const confirmedCarriers = external.transports.filter(item => item.sources.length >= 2);
      if (confirmedCarriers.length) {
        next.sharedEvidence ??= after.observation_ref;
        next.transportCarriers = [...new Set([...(local.transportCarriers ?? []), ...confirmedCarriers.map(item => item.carrier)])];
      }
      if (local.relay || local.sectorNetwork || local.passage) {
        const matched = relayMatches(proposal, scene);
        next.stopped = !local.passage && !matched;
        if (step.waitForTransport) {
          const peerChanged = local.relay
            ? !same(externalCarriers(before, local).get(local.relay.carrier) ?? null, externalCarriers(after, local).get(local.relay.carrier) ?? null)
            : JSON.stringify(sectorCarriers(before, local)) !== JSON.stringify(sectorCarriers(after, local));
          const changedParts = JSON.stringify(old.boxes) !== JSON.stringify(scene.boxes);
          next.waits = (local.waits ?? 0) + 1;
          next.stalledWaits = changedParts || peerChanged ? 0 : (local.stalledWaits ?? 0) + 1;
        }
        if (step.intent === 'attach' || step.intent === 'release' || local.held) {
          next.held = scene.boxes[key(ahead)] === scene.face_value ? ahead : null;
          if (next.held && moved) next.loaded = { ...local.loaded, [action.action_ref]: delta };
        } else if (moved) next.free = { ...local.free, [action.action_ref]: delta };
        state = next;
        return { events: [] };
      }
      const contactChanged = changed.includes(key(ahead));
      if (step.intent !== 'motion' && !moved && contactChanged && (next.sharedEvidence || changed.length === 1)) {
        next.held = next.sharedEvidence ? (scene.boxes[key(ahead)] === scene.face_value ? ahead : null)
          : step.intent === 'attach' ? ahead : null;
      } else if (local.held && moved) {
        const cargo = add(local.held, delta);
        const removed = Object.keys(old.boxes).filter(name => !Object.hasOwn(scene.boxes, name) && !external.shifts.some(shift => key(shift.from) === name));
        const added = Object.keys(scene.boxes).filter(name => !Object.hasOwn(old.boxes, name) && !external.shifts.some(shift => key(shift.to) === name));
        const ownShift = removed.includes(key(local.held)) && added.includes(key(cargo)) &&
          (next.sharedEvidence ? scene.boxes[key(cargo)] === scene.face_value : removed.length === 1 && added.length === 1);
        if (ownShift) {
          next.held = cargo;
          next.loaded = { ...local.loaded, [action.action_ref]: delta };
        } else next.held = null;
      } else if (moved) next.free = { ...local.free, [action.action_ref]: delta };
      if (!next.held && changed.length === 1 && changed[0] === key(ahead)) next.invitation = ahead;
      state = next;
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}

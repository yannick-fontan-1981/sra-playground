import { orientedCouplingInitial, orientedCouplingScene, orientedCouplingTile } from '../logos-engine/v6-oriented-coupling.ts';
import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeExecution, NativeFamily, NativeObservation, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
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
  targets: NativePoint[]; initial_boxes: NativePoint[]; insetFill?: number; transferPads?: NativePoint[] };
type Scene = { pose: NativePoint; face: NativePoint; face_value: number; boxes: Record<string, number> };
type Relay = { axis: 0 | 1; line: number; direction: NativePoint; cells: NativePoint[]; carrier: string; evidence: string[] };
type State = { epoch: number; geometry: Geometry; color: number; held: NativePoint | null; invitation: NativePoint | null;
  free: Record<string, NativePoint>; loaded: Record<string, NativePoint>; tried: string[]; refs: string[]; count: number;
  transports?: readonly Transport[]; sharedEvidence?: string; transportCarriers?: string[]; transportCouplings?: readonly TransportCoupling[];
  contactAppearance?: ContactAppearance; releasedContact?: { point: NativePoint; ink: number; sources: readonly string[] };
  relay?: Relay; sectorNetwork?: SectorNetwork; passage?: DeliveryPassage; waits?: number; stalledWaits?: number; stopped?: boolean;
  interference?: { ink: number; ref: string }; interceptionRef?: string; interceptedInk?: number;
  rendezvousWaits?: number; transferEvidence?: { part: NativePoint; ref: string }; parallel?: ParallelDelivery;
  sectorInterception?: ParallelDelivery };
type Transport = { readonly carrier: string; readonly pose: NativePoint; readonly box: NativePoint;
  readonly sources: readonly string[]; readonly shell?: number };
type TransportCoupling = { readonly carrier: string; readonly shell: number; readonly sources: readonly string[] };
type ContactAppearance = { readonly ink: number; readonly core: number; readonly restShell: number; readonly sources: readonly string[] };
type Move = { pose: NativePoint; face: NativePoint; cargo: NativePoint | null };
type Motion = { input: string; prediction: Move };
type ParallelDelivery = { ink: number; ref: string; track?: NativePoint; returns: Record<string, Record<string, number>>;
  probes: Record<string, string[]>; approach: Motion[]; waits: Record<string, number> };
type Intent = 'motion' | 'attach' | 'release';
type Step = { input: string; intent: Intent; prediction: Move | null; target: NativePoint | null; waitForTransport?: true;
  intercept?: true;
  route?: Motion[] };
type WalkStep = { input: string; before: Scene; after: Scene; cargoBefore: NativePoint | null; cargoAfter: NativePoint | null;
  withdrawnContact?: NativePoint };
type PeerGuard = { landings: { point: NativePoint; pixels: number[] | null }[][]; floorSamples: string[]; protectedCells: NativePoint[] };
type Proposal = NativeProposal & { local: State; scene: Scene; step: Step; needId: string; attempt: string; walk?: WalkStep[]; peerGuard?: PeerGuard;
  sectorWalk?: true };

const labels = { ACTION1: [0, -1], ACTION2: [0, 1], ACTION3: [-1, 0], ACTION4: [1, 0] } as const;
const sectorInterceptionRange = 8;
const add = ([x, y]: NativePoint, [u, v]: NativePoint): NativePoint => [x + u, y + v];
const sub = ([x, y]: NativePoint, [u, v]: NativePoint): NativePoint => [x - u, y - v];
const key = (p: NativePoint) => p.join(',');
const same = (a: NativePoint | null, b: NativePoint | null) => a === b || !!a && !!b && a[0] === b[0] && a[1] === b[1];
const distance = (a: NativePoint, b: NativePoint) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
const compare = (a: NativePoint, b: NativePoint) => a[0] - b[0] || a[1] - b[1];
const point = (value: string): NativePoint => { const [x, y] = value.split(',').map(Number); return [x!, y!]; };
const positions = (scene: Scene) => Object.keys(scene.boxes).map(point).sort(compare);
function sceneHeld(scene: Scene): NativePoint | null {
  const ahead = add(scene.pose, scene.face);
  return scene.boxes[key(ahead)] === scene.face_value ? ahead : null;
}
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

function recoverInsetFromVisibleCorridor(rows: NativeRows, measured: Geometry, previous: State): Geometry | null {
  const old = previous.geometry;
  if (old.insetFill === undefined || measured.background !== measured.rest_shell
    || measured.pitch !== old.pitch || !same(measured.phase, old.phase) || measured.core !== old.core || measured.rest_shell !== old.rest_shell) return null;
  const scene = orientedCouplingScene(rows, measured, previous.color) as Scene | null;
  if (!scene) return null;
  const hasCorridor = Object.values(labels).some(delta => {
    const tile = orientedCouplingTile(rows, measured, add(scene.pose, delta));
    return tile?.every(row => row.every(ink => ink === old.background));
  });
  if (!hasCorridor) return null;
  const x = measured.targets.map(([u]) => u), y = measured.targets.map(([, v]) => v);
  const [l, t] = tileBox(measured, [Math.min(...x), Math.min(...y)]);
  const [, , r, b] = tileBox(measured, [Math.max(...x), Math.max(...y)]);
  for (let v = t; v <= b; v++) for (let u = l; u <= r; u++) {
    const edge = u === l || u === r || v === t || v === b;
    if (rows[v]?.[u] !== (edge ? old.core : old.insetFill)) return null;
  }
  const transferPads: NativePoint[] = [];
  for (let y = 0; y * measured.pitch + measured.phase[1] + measured.pitch <= rows.length; y++) {
    for (let x = 0; x * measured.pitch + measured.phase[0] + measured.pitch <= rows[0]!.length; x++) {
      const tile = orientedCouplingTile(rows, measured, [x, y])!;
      if (tile.every(row => row.every(ink => ink === old.insetFill))) transferPads.push([x, y]);
    }
  }
  return { ...measured, background: old.background, insetFill: old.insetFill, transferPads };
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
      [background, core, local.color, local.geometry.insetFill].includes(part.palette_value) || (x - phase[0]) % pitch || (y - phase[1]) % pitch) continue;
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

function pairedCarriers(before: NativeObservation, after: NativeObservation, local: State) {
  const carriers = carrierPositions(before, local), returned = carrierPositions(after, local);
  const pairs = [...carriers].flatMap(([carrier, origins]) => {
    const destinations = returned.get(carrier);
    if (!destinations || origins.length !== destinations.length) return [];
    if (origins.length === 1) return [{ carrier, pose: origins[0]!, position: destinations[0]! }];
    if (!local.transportCarriers?.includes(carrier)) return [];
    // Identical appearances can be reconciled when both endpoints have only one possible one-step match.
    return origins.flatMap(pose => {
      const candidates = destinations.filter(position => distance(position, pose) <= 1);
      const position = candidates.length === 1 ? candidates[0] : undefined;
      return position && origins.filter(origin => distance(origin, position) <= 1).length === 1
        ? [{ carrier, pose, position }] : [];
    });
  });
  return { carriers, returned, pairs };
}

function reservedTransports(local: State): readonly Transport[] {
  return (local.transports ?? []).filter(item => item.sources.length >= 2
    || item.sources.length > 0 && !!local.sharedEvidence && local.transportCarriers?.includes(item.carrier));
}

function knownContactAppearance(local: State): ContactAppearance | null {
  const contact = local.contactAppearance;
  return contact && contact.sources.length >= 3 && contact.core === local.geometry.core && contact.restShell === local.geometry.rest_shell
    ? contact : null;
}

function peerShell(local: State, scene: Scene, box: NativePoint, carrier: string): number {
  const value = scene.boxes[key(box)]!, contact = knownContactAppearance(local);
  if (!contact || value !== contact.ink || !same(box, add(scene.pose, scene.face)) || same(box, sceneHeld(scene))) return value;
  const roles = local.transportCouplings?.filter(role => role.carrier === carrier && role.sources.length >= 2) ?? [];
  return roles.length === 1 ? roles[0]!.shell : value;
}

function uncontestedContact(box: NativePoint, local: State, ...observations: NativeObservation[]): boolean {
  return observations.every(observation => ![...carrierPositions(observation, local).values()]
    .some(poses => poses.some(pose => distance(pose, box) === 1)));
}

function recordContactAppearance(before: NativeObservation, after: NativeObservation, local: State, next: State,
  old: Scene, scene: Scene, step: Step): void {
  const released = local.releasedContact;
  delete next.releasedContact;
  if (released && released.sources.at(-1) === before.observation_ref && step.intent === 'motion' && !local.held
    && same(released.point, add(old.pose, old.face)) && !same(released.point, add(scene.pose, scene.face))
    && old.boxes[key(released.point)] === released.ink && Object.hasOwn(scene.boxes, key(released.point))
    && uncontestedContact(released.point, local, before, after)) {
    if (scene.boxes[key(released.point)] === local.geometry.rest_shell) {
      next.contactAppearance = { ink: released.ink, core: local.geometry.core, restShell: local.geometry.rest_shell,
        sources: [...released.sources, after.observation_ref] };
    } else if (local.contactAppearance?.ink === released.ink) delete next.contactAppearance;
  }
  const held = sceneHeld(old), ink = held && scene.boxes[key(held)];
  if (step.intent === 'release' && held && same(held, local.held) && !sceneHeld(scene)
    && same(old.pose, scene.pose) && same(old.face, scene.face) && typeof ink === 'number'
    && ink !== local.geometry.rest_shell && ink !== scene.face_value && uncontestedContact(held, local, before, after)) {
    next.releasedContact = { point: held, ink, sources: [before.observation_ref, after.observation_ref] };
  }
}

function transportReturn(before: NativeObservation, after: NativeObservation, local: State, old: Scene, next: Scene) {
  const { carriers, returned, pairs } = pairedCarriers(before, after, local);
  const removed = positions(old).filter(box => !Object.hasOwn(next.boxes, key(box)) && !same(box, local.held));
  const shifts: { from: NativePoint; to: NativePoint }[] = [];
  const transports: Transport[] = [];
  for (const { carrier, pose, position } of pairs) {
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
      const owners = [...carriers].flatMap(([identity, sites]) => sites.filter(site => distance(site, from) === 1
        && returned.get(identity)?.some(arrival => same(arrival, add(site, delta)))).map(site => ({ identity, site })));
      if (owners.length !== 1 || owners[0]!.identity !== carrier || !same(owners[0]!.site, pose)) return [];
      return [{ from, to }];
    });
    if (pairs.length !== 1) continue;
    const shift = pairs[0]!;
    shifts.push(shift);
    const shell = peerShell(local, next, shift.to, carrier);
    const evidence = previous && same(previous.box, shift.from) && previous.shell === shell
      && peerShell(local, old, shift.from, carrier) === shell ? previous.sources.slice(-1) : [];
    transports.push({ carrier, pose: position, box: shift.to, shell, sources: [...evidence, after.observation_ref] });
  }
  return { shifts, transports };
}

function couplingReturns(before: NativeObservation, after: NativeObservation, local: State, old: Scene, next: Scene) {
  const { carriers, returned, pairs } = pairedCarriers(before, after, local);
  const origins = [...carriers.values()].flat(), destinations = [...returned.values()].flat();
  const changes = positions(old).filter(box => !same(box, local.held) && Object.hasOwn(next.boxes, key(box))
    && old.boxes[key(box)] !== next.boxes[key(box)]);
  return changes.flatMap(box => {
    const source = old.boxes[key(box)]!, shell = next.boxes[key(box)]!;
    const attached = source === local.geometry.rest_shell;
    if (!attached && shell !== local.geometry.rest_shell) return [];
    const owners = pairs.filter(pair => same(pair.pose, pair.position) && distance(pair.pose, box) === 1);
    if (owners.length !== 1 || origins.filter(pose => distance(pose, box) === 1).length !== 1
      || destinations.filter(pose => distance(pose, box) === 1).length !== 1) return [];
    const owner = owners[0]!;
    const role = local.transportCouplings?.find(role => role.carrier === owner.carrier && role.shell === (attached ? shell : source));
    if (!role || !role.sources.length || changes.filter(other => distance(owner.pose, other) === 1).length !== 1) return [];
    const coupled = attached ? next : old;
    if (positions(coupled).filter(other => distance(owner.pose, other) === 1 && coupled.boxes[key(other)] === role.shell).length !== 1) return [];
    return [{ carrier: owner.carrier, pose: owner.position, box, shell, attached, sources: [after.observation_ref] }];
  });
}

function rebindDividedCargo(current: Geometry, rows: NativeRows, observation: NativeObservation, previous: State, execution?: NativeExecution) {
  if (!previous.transportCouplings?.length) return null;
  const receipt = execution?.readPriorDirectionalScene?.((earlier, before) => {
    const geometry = orientedCouplingInitial(earlier, true) as Geometry | null;
    if (!geometry || geometry.initial_boxes.length <= current.initial_boxes.length
      || geometry.pitch !== current.pitch || !same(geometry.phase, current.phase)
      || geometry.background !== current.background || geometry.core !== current.core || geometry.rest_shell !== current.rest_shell
      || geometry.targets.length !== current.targets.length || !geometry.targets.every((site, index) => same(site, current.targets[index]!))) return null;
    const colors = [...new Set(rows.flat())].filter(ink => ![geometry.background, geometry.core, geometry.rest_shell].includes(ink));
    const actors = colors.flatMap(color => {
      const old = orientedCouplingScene(earlier, geometry, color) as Scene | null;
      const next = orientedCouplingScene(rows, geometry, color) as Scene | null;
      return old && next ? [{ color, old, next }] : [];
    });
    if (actors.length !== 1) return null;
    const { color, old, next } = actors[0]!, movement = sub(next.pose, old.pose);
    if (!same(movement, next.face) || sceneHeld(old) || sceneHeld(next)) return null;
    const local = { ...previous, geometry, color, held: null };
    const oldGeometry = previous.geometry, insetFill = oldGeometry.insetFill;
    if (insetFill !== undefined && geometry.pitch === oldGeometry.pitch && same(geometry.phase, oldGeometry.phase)
      && geometry.core === oldGeometry.core && geometry.rest_shell === oldGeometry.rest_shell
      && geometry.background === oldGeometry.background && visibleReceiverFill(earlier, local, old) === insetFill
      && visibleReceiverFill(rows, local, next) === insetFill) {
      local.geometry = { ...geometry, insetFill };
    }
    const couplings = couplingReturns(before, observation, local, old, next);
    const shells = { ...old.boxes };
    const resting = new Set(geometry.initial_boxes.map(key));
    for (const { box, shell, attached } of couplings) {
      shells[key(box)] = shell;
      if (attached) resting.delete(key(box));
      else resting.add(key(box));
    }
    if (!Object.entries(shells).every(([site, shell]) => next.boxes[site] === shell)
      || resting.size !== current.initial_boxes.length || !current.initial_boxes.every(site => resting.has(key(site)))) return null;
    return { geometry, color, movement };
  });
  if (!receipt || receipt.levelEpoch !== observation.level_epoch || receipt.afterRef !== observation.observation_ref
    || !same(previous.free[receipt.command] ?? null, receipt.scene.movement)) return null;
  return { ...receipt.scene, refs: [receipt.beforeRef, receipt.afterRef] };
}

type RouteNode = { state: Move; step: Motion | null; parent: RouteNode | null; length: number };
const poseAndFace = (pose: NativePoint, face: NativePoint) => key(pose) + '|' + key(face);

function* routeNodes(start: Move, fixed: ReadonlySet<string>, floor: ReadonlySet<string>,
  vectors: Readonly<Record<string, NativePoint>>, cargoFloor = floor): Generator<RouteNode, void, unknown> {
  const moves = Object.entries(vectors);
  const identity = ({ pose, face, cargo }: Move) => poseAndFace(pose, face) + '|' + (cargo ? key(cargo) : '');
  const occupiable = (point: NativePoint, surface: ReadonlySet<string>) => {
    const cell = key(point);
    return surface.has(cell) && !fixed.has(cell);
  };
  const queue: RouteNode[] = [{ state: start, step: null, parent: null, length: 0 }];
  const discovered = new Set([identity(start)]);
  for (let index = 0; index < queue.length; index++) {
    const parent = queue[index]!, { state, length } = parent;
    yield parent;
    if (index + 1 >= 2048) return;
    for (const [input, delta] of moves) {
      const pose = add(state.pose, delta), face = state.cargo ? state.face : delta;
      const cargo = state.cargo ? add(state.cargo, delta) : null;
      const prediction = occupiable(pose, floor) && (!cargo || occupiable(cargo, cargoFloor)) ? { pose, face, cargo } : { ...state, face };
      const next = identity(prediction);
      if (discovered.has(next)) continue;
      discovered.add(next);
      queue.push({ state: prediction, step: { input, prediction }, parent, length: length + 1 });
    }
  }
}

function routeTo(node: RouteNode): { step: Step | null; end: Move; length: number } {
  const route: Motion[] = [];
  for (let entry: RouteNode | null = node; entry?.step; entry = entry.parent) route.push(entry.step);
  route.reverse();
  const step: Step | null = route[0] ? { ...route[0], intent: 'motion', target: null, route } : null;
  return { step, end: node.state, length: node.length };
}

function shortest(start: Move, fixed: ReadonlySet<string>, floor: ReadonlySet<string>, vectors: Readonly<Record<string, NativePoint>>,
  accepts: (state: Move) => boolean, cargoFloor = floor): ReturnType<typeof routeTo> | null {
  for (const node of routeNodes(start, fixed, floor, vectors, cargoFloor)) {
    if (accepts(node.state)) return routeTo(node);
  }
  return null;
}

function cargoApproaches(scene: Scene, obstacles: ReadonlySet<string>, floor: ReadonlySet<string>,
  commands: Readonly<Record<string, NativePoint>>) {
  // Every unloaded approach sees the same floor and treats every crate as an obstacle.
  const frontier = routeNodes({ pose: scene.pose, face: scene.face, cargo: null }, obstacles, floor, commands);
  const visited = new Map<string, RouteNode>(), paths = new Map<string, ReturnType<typeof routeTo>>();
  return (part: NativePoint, face: NativePoint): ReturnType<typeof routeTo> | null => {
    const goal = poseAndFace(sub(part, face), face);
    const path = paths.get(goal);
    if (path) return path;
    let node = visited.get(goal);
    while (!node) {
      const found = frontier.next();
      if (found.done) return null;
      const { pose, face } = found.value.state;
      const position = poseAndFace(pose, face);
      visited.set(position, found.value);
      if (position === goal) node = found.value;
    }
    const result = routeTo(node);
    paths.set(goal, result);
    return result;
  };
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
  const ahead = add(scene.pose, scene.face);
  if (same(ahead, target)) {
    if (carrier.inset) return { input: 'ACTION5', intent: 'attach', prediction: null, target, intercept: true };
    const input = Object.keys(commands).find(input => same(commands[input]!, scene.face));
    return input ? { input, intent: 'motion', prediction: { pose: scene.pose, face: scene.face, cargo: null }, target } : null;
  }
  const floor = deliveryFloor(local.geometry, scene, rows);
  const deposited = local.transferEvidence && Object.hasOwn(scene.boxes, key(local.transferEvidence.part));
  const difference = sub(ahead, target);
  if (deposited && !carrier.inset && Math.abs(difference[0]) + Math.abs(difference[1]) === 1
    && floor.has(key(ahead)) && !Object.hasOwn(scene.boxes, key(ahead)) && (local.rendezvousWaits ?? 0) < 2) {
    // Observe a settling turn and a possible approach before choosing a different position.
    return { input: 'ACTION5', intent: 'motion', prediction: { pose: scene.pose, face: scene.face, cargo: null }, target: ahead,
      waitForTransport: true };
  }
  const fixed = new Set([...positions(scene), target].map(key));
  const route = shortest({ pose: scene.pose, face: scene.face, cargo: null }, fixed, floor,
    commands, state => same(add(state.pose, state.face), target));
  return route?.step ? { ...route.step, target } : null;
}

function planDelivery(local: State, scene: Scene, rows: NativeRows, commands: Readonly<Record<string, NativePoint>>,
  blockers: readonly NativePoint[] = []): Step | null {
  const { geometry: g, held } = local, parts = positions(scene);
  const reserved = new Set(reservedTransports(local).map(item => key(item.box)));
  const goal = new Set(g.targets.map(key));
  const sending = local.sectorNetwork?.localTargets?.length ? new Set(local.sectorNetwork.sending) : null;
  const floor = sending ?? deliveryFloor(g, scene, rows);
  const approachTo = held ? null : cargoApproaches(scene, new Set([...parts, ...blockers].map(key)), floor, commands);
  const choices: { step: Step; length: number; index: number; target: NativePoint; face: NativePoint }[] = [];
  for (const [index, part] of parts.entries()) {
    if (held ? !same(held, part) : goal.has(key(part)) || reserved.has(key(part))) continue;
    if (!held && sending && (!sending.has(key(part))
      || scene.boxes[key(part)] !== g.rest_shell && !same(part, add(scene.pose, scene.face)))) continue;
    const fixed = new Set([...parts.filter(other => !same(part, other)), ...blockers].map(key));
    for (const target of g.targets.filter(target => !fixed.has(key(target)))) {
      for (const face of held ? [scene.face] : Object.values(commands)) {
        let start: Move = { pose: scene.pose, face: scene.face, cargo: held };
        let length = 0, opening: Step | null = null;
        if (approachTo) {
          const approach = approachTo(part, face);
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

function parallelReceiverGeometry(rows: NativeRows, candidate: Geometry | null, previous: State | null): Geometry | null {
  if (!candidate || previous?.interceptedInk === undefined || !previous.interceptionRef || previous.geometry.insetFill === undefined
    || candidate.pitch !== previous.geometry.pitch || candidate.core !== previous.geometry.core
    || candidate.rest_shell !== previous.geometry.rest_shell || !same(candidate.phase, previous.geometry.phase)
    || carrierForms(rows, candidate, previous.interceptedInk).length < 2) return null;
  const fill = previous.geometry.insetFill, occupied = new Set(candidate.initial_boxes.map(key));
  const empty = candidate.targets.filter(site => !occupied.has(key(site)));
  if (!empty.length || !empty.every(site => orientedCouplingTile(rows, candidate, site)?.slice(1, -1)
    .every(row => row.slice(1, -1).every(ink => ink === fill)))) return null;
  return { ...candidate, insetFill: fill };
}

function parallelInterception(local: State, scene: Scene, rows: NativeRows, forms: ReturnType<typeof carrierForms>,
  commands: Readonly<Record<string, NativePoint>>): { step: Step; parallel: ParallelDelivery } | null {
  const parallel = local.parallel!, ahead = add(scene.pose, scene.face);
  const mixed = local.sectorNetwork?.localTargets?.length;
  const floor = mixed ? new Set(local.sectorNetwork!.sending) : deliveryFloor(local.geometry, scene, rows);
  const fixed = new Set([...Object.keys(scene.boxes), ...forms.map(form => key(form.point))]);
  const start: Move = { pose: scene.pose, face: scene.face, cargo: null };
  const approach = (target: NativePoint) => shortest(start, fixed, floor, commands, pose => same(add(pose.pose, pose.face), target));
  const wait: Step = { input: 'ACTION5', intent: 'motion', prediction: start, target: ahead, waitForTransport: true };
  const contact = (target: NativePoint): Step => ({ input: 'ACTION5', intent: 'attach', prediction: null, target, intercept: true });
  const options = forms.flatMap(form => {
    if (same(form.point, ahead) && form.inset) return [{ form, length: 0, step: contact(form.point) }];
    const route = approach(form.point);
    if (route?.step) return [{ form, length: route.length, step: { ...route.step, target: form.point } }];
    const input = same(form.point, ahead) && Object.keys(commands).find(input => same(commands[input]!, scene.face));
    return input ? [{ form, length: 1, step: { input, intent: 'motion', prediction: start, target: form.point } satisfies Step }] : [];
  }).sort((a, b) => a.length - b.length);
  const prior = parallel.track;
  const form = prior ? [...forms].sort((a, b) => distance(a.point, prior) - distance(b.point, prior))[0] : options[0]?.form;
  const nearby = form && distance(scene.pose, form.point) <= (mixed ? sectorInterceptionRange : 6), returns = { ...parallel.returns };
  if (nearby && prior && distance(form.point, prior) <= 1) {
    const from = key(prior), to = key(form.point), successors = returns[from] ?? {};
    returns[from] = { ...successors, [to]: (successors[to] ?? 0) + 1 };
  }
  let forecast = form?.point;
  const predictions: { step: Step; time: number; length: number }[] = [];
  for (let time = 1; time <= 4 && forecast && nearby; time++) {
    const successors = Object.entries(returns[key(forecast)] ?? {}).sort(([, a], [, b]) => b - a);
    const first = successors[0];
    if (!first || successors.length > 1 && first[1] <= 1 || !floor.has(first[0])) break;
    forecast = point(first[0]);
    const target = approach(forecast);
    if (!target || target.length > time || !target.step && scene.boxes[key(ahead)]) continue;
    predictions.push({ step: { ...(target.step ?? wait), target: forecast }, time, length: target.length });
  }
  predictions.sort((a, b) => a.time - b.time || a.length - b.length);
  const world = JSON.stringify([scene.pose, scene.face, scene.boxes, forms]), tried = parallel.probes[world] ?? [];
  const candidate = [...forms.filter(form => same(form.point, ahead)).map(form => contact(form.point)),
    ...predictions.map(item => item.step), ...options.map(item => item.step)].find(step => !tried.includes(step.input));
  const fallback = Object.entries(commands).find(([input, delta]) => {
    const next = key(add(scene.pose, delta));
    return !tried.includes(input) && floor.has(next) && !fixed.has(next);
  });
  const step = candidate ?? (fallback ? { input: fallback[0], intent: 'motion' as const,
    prediction: { pose: add(scene.pose, fallback[1]), face: fallback[1], cargo: null }, target: null } : null);
  return step ? { step, parallel: { ...parallel, returns, ...(nearby ? { track: form.point } : {}),
    probes: { ...parallel.probes, [world]: [...tried, step.input] } } } : null;
}

function planParallelDelivery(local: State, scene: Scene, rows: NativeRows, observation: NativeObservation,
  commands: Readonly<Record<string, NativePoint>>): { step: Step; parallel: ParallelDelivery } | null {
  const parallel = local.parallel!, { geometry, held } = local, forms = carrierForms(rows, geometry, parallel.ink);
  if (forms.length) return parallelInterception(local, scene, rows, forms, commands);
  const occupied = [...carrierPositions(observation, local).values()].flat();
  const targets = new Set(geometry.targets.map(key)), unresolved = Object.keys(scene.boxes).filter(site => !targets.has(site));
  let approach = parallel.approach, step: Step | null = null;
  const ahead = add(scene.pose, scene.face), floor = deliveryFloor(geometry, scene, rows);
  const fixed = new Set([...Object.keys(scene.boxes), ...occupied.map(key)]);
  const start: Move = { pose: scene.pose, face: scene.face, cargo: held };
  if (unresolved.length === 1 && !held) {
    if (!approach.length) {
      step = planDelivery(local, scene, rows, commands, occupied);
      if (step?.intent === 'motion' && (step.route?.length ?? 0) > 1) approach = step.route!;
    }
    const upcoming = approach[0];
    if (upcoming) {
      const raw = add(scene.pose, commands[upcoming.input]!), site = key(raw);
      const retained = floor.has(site) && !fixed.has(site) ? raw : scene.pose;
      if (same(retained, upcoming.prediction.pose)) {
        step = { ...upcoming, intent: 'motion', target: null };
        approach = approach.slice(1);
      } else approach = [];
    }
  }
  step ??= planDelivery(local, scene, rows, commands, occupied);
  if (!step && unresolved.length === 1 && !held) {
    const target = point(unresolved[0]!);
    if (same(ahead, target)) step = { input: 'ACTION5', intent: 'attach', prediction: null, target };
    else {
      const route = shortest(start, fixed, floor, commands, pose => same(add(pose.pose, pose.face), target));
      if (route?.step) {
        // A retained last-part approach consumes one point per observed return.
        step = { input: route.step.input, intent: route.step.intent, prediction: route.step.prediction, target };
        approach = route.step.route?.slice(1) ?? [];
      }
    }
  }
  if (step) return { step, parallel: { ...parallel, approach } };
  const world = JSON.stringify([scene.pose, scene.face, scene.boxes, occupied]), waited = parallel.waits[world] ?? 0;
  if (waited >= 4 || scene.boxes[key(ahead)]) return null;
  return { step: { input: 'ACTION5', intent: 'motion', prediction: start, target: ahead, waitForTransport: true },
    parallel: { ...parallel, approach, waits: { ...parallel.waits, [world]: waited + 1 } } };
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
  const reserved = new Set(reservedTransports(local).map(item => key(item.box)));
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
  const portsByFace = new Map<string, Set<string>>();
  for (const port of pendingPorts) {
    const direction = key(port.face), cells = portsByFace.get(direction) ?? new Set<string>();
    cells.add(key(port.cell));
    portsByFace.set(direction, cells);
  }
  const cargoFloor = new Set([...floor, ...pendingPorts.map(port => key(port.cell))]);
  const approachTo = held ? null : cargoApproaches(scene, new Set(parts.map(key)), floor, commands);
  const choices = (held ? [held] : parts.filter(part => floor.has(key(part)))).flatMap(part => {
    const fixed = new Set(parts.filter(other => !same(part, other)).map(key));
    return (held ? [scene.face] : Object.values(commands)).flatMap(face => {
      const ports = portsByFace.get(key(face));
      if (!ports) return [];
      const approach = approachTo ? approachTo(part, face) : { end: current, length: 0, step: null };
      if (!approach) return [];
      const stage = shortest({ ...approach.end, cargo: part }, fixed, floor, commands,
        move => !!move.cargo && ports.has(key(move.cargo)), cargoFloor);
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

function routeSubjects(local: State, step: Step): NativePoint[] {
  const last = step.route?.at(-1)?.prediction;
  const subject = !local.held && last ? add(last.pose, last.face) : null;
  return [step.target, subject].filter((site): site is NativePoint => !!site);
}

function walkPrefix(step: Step, initial: Scene, local: State, remaining: number, observation: NativeObservation): WalkStep[] {
  const walk: WalkStep[] = [];
  let before = initial, cargo = local.held;
  const contact = knownContactAppearance(local), front = add(initial.pose, initial.face);
  const withdrawable = !cargo && contact && initial.boxes[key(front)] === contact.ink
    && !routeSubjects(local, step).some(site => same(site, front))
    && uncontestedContact(front, local, observation) ? front : null;
  const limit = local.passage || local.parallel ? remaining : (local.relay || local.sectorNetwork ? 120 : 70) - local.count;
  for (const { input, prediction } of step.route?.slice(0, Math.max(0, Math.min(remaining, maximumCommittedActions, limit))) ?? []) {
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
    const withdrawnContact = withdrawable && contact && boxes[key(withdrawable)] === contact.ink && !same(withdrawable, ahead)
      ? withdrawable : null;
    if (withdrawnContact) boxes[key(withdrawnContact)] = local.geometry.rest_shell;
    const after = { ...before, pose: prediction.pose, face: prediction.face, boxes };
    walk.push({ input, before, after, cargoBefore: cargo, cargoAfter: prediction.cargo,
      ...(withdrawnContact ? { withdrawnContact } : {}) });
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

function returnedContactShell(walk: WalkStep, local: State, before: NativeObservation, after: NativeObservation,
  old: Scene | null, actual: Scene | null): number | undefined {
  const box = walk.withdrawnContact;
  const contact = knownContactAppearance(local);
  if (!box || !contact || !old || !actual || sceneHeld(old) || sceneHeld(actual)
    || !same(box, add(old.pose, old.face)) || same(box, add(actual.pose, actual.face))
    || old.boxes[key(box)] !== contact.ink || !uncontestedContact(box, local, before, after)) return undefined;
  return actual.boxes[key(box)];
}

function receiverEdge(g: Geometry, [x, y]: NativePoint, dx: number, dy: number): boolean {
  const target = (u: number, v: number) => g.targets.some(site => same(site, [u, v]));
  return dx === 0 && !target(x - 1, y) || dx === g.pitch - 1 && !target(x + 1, y)
    || dy === 0 && !target(x, y - 1) || dy === g.pitch - 1 && !target(x, y + 1);
}

function visibleReceiverFill(rows: NativeRows, local: State, scene: Scene): number | undefined {
  const g = local.geometry, fills = new Set<number>();
  for (const site of g.targets) {
    if (same(site, scene.pose) || Object.hasOwn(scene.boxes, key(site))) continue;
    const tile = orientedCouplingTile(rows, g, site), inside = new Set<number>();
    let visibleEdge = false;
    if (!tile?.every((row, y) => row.every((ink, x) => {
      if (receiverEdge(g, site, x, y)) { visibleEdge = true; return ink === g.core; }
      inside.add(ink); return true;
    }))) continue;
    if (visibleEdge && inside.size === 1) fills.add([...inside][0]!);
  }
  return fills.size === 1 ? [...fills][0] : g.insetFill;
}

function knownRouteSurface(rows: NativeRows, local: State, site: NativePoint, pixels: number[], receiverFill: number | undefined): boolean {
  const g = local.geometry;
  if (pixels.length !== g.pitch ** 2) return false;
  if (g.targets.some(target => same(target, site))) return receiverFill !== undefined
    && pixels.every((ink, i) => ink === (receiverEdge(g, site, i % g.pitch, Math.floor(i / g.pitch)) ? g.core : receiverFill));
  if (pixels.every(ink => ink === g.background) || g.insetFill !== undefined && pixels.every(ink => ink === g.insetFill)) return true;
  const ports = [...(local.relay?.cells ?? []), ...(local.sectorNetwork?.receiving.flatMap(sector => sector.ports.map(port => port.cell)) ?? [])];
  if (!ports.some(port => same(port, site)) || !pixels.includes(g.background) || pixels.includes(g.core)) return false;
  // A shared strip retains its repeated visible surface; one changed port cannot redefine it.
  return ports.filter(port => orientedCouplingTile(rows, g, port)?.flat().every((ink, i) => ink === pixels[i])).length >= 2;
}

function guardPeerRoute(rows: NativeRows, local: State, scene: Scene, step: Step, walk: WalkStep[]): PeerGuard {
  const occupied = new Set([key(scene.pose), ...Object.keys(scene.boxes)]), receiverFill = visibleReceiverFill(rows, local, scene);
  const floorSamples = [...new Set([...deliveryFloor(local.geometry, scene, rows)].filter(site => !occupied.has(site))
    .flatMap(site => { const pixels = orientedCouplingTile(rows, local.geometry, point(site))!.flat();
      return knownRouteSurface(rows, local, point(site), pixels, receiverFill) ? [pixels.join(',')] : []; }))];
  const landings = walk.map(move => {
    const covered = [move.before.pose, ...(move.cargoBefore ? [move.cargoBefore] : [])];
    return [move.after.pose, ...(move.cargoAfter ? [move.cargoAfter] : [])]
      .filter(site => !covered.some(prior => same(site, prior)))
      .map(site => {
        const pixels = orientedCouplingTile(rows, local.geometry, site)?.flat() ?? [];
        return { point: site, pixels: occupied.has(key(site)) ? null : knownRouteSurface(rows, local, site, pixels, receiverFill) ? pixels : [] };
      });
  });
  return { landings, floorSamples, protectedCells: routeSubjects(local, step) };
}

function matchesOwnRoute(actual: Scene | null, predicted: Scene, cargo: NativePoint | null): actual is Scene {
  return !!actual && same(actual.pose, predicted.pose) && same(actual.face, predicted.face)
    && actual.face_value === predicted.face_value && same(sceneHeld(actual), cargo);
}

function protectedRouteCells(actual: Scene, predicted: Scene, guard: PeerGuard): boolean {
  return guard.protectedCells.every(site => actual.boxes[key(site)] === predicted.boxes[key(site)]);
}

function peerRouteReturn(proposal: Proposal, walk: WalkStep, before: NativeObservation, after: NativeObservation,
  old: Scene | null, actual: Scene | null): boolean {
  const { local, peerGuard } = proposal;
  if (!peerGuard || !matchesOwnRoute(old, walk.before, walk.cargoBefore)
    || !matchesOwnRoute(actual, walk.after, walk.cargoAfter) || !protectedRouteCells(actual, walk.after, peerGuard)) return false;
  const expected = { ...old.boxes };
  if (walk.withdrawnContact) expected[key(walk.withdrawnContact)] = local.geometry.rest_shell;
  if (walk.cargoBefore) delete expected[key(walk.cargoBefore)];
  if (walk.cargoAfter) expected[key(walk.cargoAfter)] = walk.after.boxes[key(walk.cargoAfter)]!;
  const external = transportReturn(before, after, { ...local, held: walk.cargoBefore }, old, actual);
  for (const shift of external.shifts) {
    const carrier = external.transports.find(item => same(item.box, shift.to));
    if (!carrier || !local.transportCarriers?.includes(carrier.carrier)) return false;
    if (peerShell(local, old, shift.from, carrier.carrier) !== peerShell(local, actual, shift.to, carrier.carrier)) return false;
    delete expected[key(shift.from)];
    expected[key(shift.to)] = actual.boxes[key(shift.to)]!;
  }
  for (const change of couplingReturns(before, after, { ...local, held: walk.cargoBefore }, old, actual)) {
    expected[key(change.box)] = change.shell;
  }
  return Object.keys(expected).length === Object.keys(actual.boxes).length
    && Object.entries(expected).every(([position, value]) => actual.boxes[position] === value);
}

function confirmsInterception(proposal: Proposal, rows: NativeRows, scene: Scene | null): boolean {
  const { geometry, interference } = proposal.local, target = proposal.step.target;
  if (proposal.local.sectorNetwork?.localTargets?.length) {
    // A loaded carrier leaves its crate behind while cooperating carriers can still move other crates.
    return !!interference && !!target && !!scene && same(scene.pose, proposal.scene.pose) && same(scene.face, proposal.scene.face)
      && Object.keys(scene.boxes).length === Object.keys(proposal.scene.boxes).length
      && !carrierForms(rows, geometry, interference.ink).length;
  }
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
      if (!(state?.epoch === epoch && (state.parallel || state.relay || state.sectorNetwork || state.passage || state.geometry.insetFill !== undefined))
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
      if (prior?.stopped || prior && !prior.parallel && !prior.passage && prior.count >= (prior.relay || prior.sectorNetwork ? 120 : 70)) return null;
      const learns = family === learnOrientedDeliveryId && !prior && !previous;
      const receipt = learns ? execution?.readPriorDirectionalScene?.(earlier => orientedCouplingInitial(earlier) as Geometry | null) : null;
      if (learns && (!receipt || receipt.afterRef !== observation.observation_ref)) return null;
      const ordinary = prior?.geometry ?? receipt?.scene ?? orientedCouplingInitial(rows) as Geometry | null;
      const measuredDivided = !ordinary && previous ? orientedCouplingInitial(rows, true) as Geometry | null : null;
      const rebound = measuredDivided && previous ? rebindDividedCargo(measuredDivided, rows, observation, previous, execution) : null;
      const dividedGeometry = rebound?.geometry ?? measuredDivided;
      const divided = !!dividedGeometry;
      const corridor = !prior && ordinary && previous ? recoverInsetFromVisibleCorridor(rows, ordinary, previous) : null;
      const expanded = parallelReceiverGeometry(rows, dividedGeometry, previous);
      const parallel = prior?.parallel ?? (expanded && previous?.interceptedInk !== undefined && previous.interceptionRef
        ? { ink: previous.interceptedInk, ref: previous.interceptionRef, returns: {}, probes: {}, approach: [], waits: {} } : null);
      const geometry = expanded ?? corridor ?? ordinary ?? dividedGeometry ?? (previous ? insetReceiver(rows, previous.geometry) : null);
      if (!geometry || !parallel && !divided && !prior?.sectorNetwork
        && (geometry.targets.length > 12 || geometry.initial_boxes.length > 6)) return null;
      const inset = geometry.insetFill !== undefined;
      const possible = prior ? [prior.color] : rebound ? [rebound.color]
        : [...new Set(rows.flat())].filter(value => ![geometry.core, geometry.background, geometry.rest_shell].includes(value));
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
        refs: receipt ? [receipt.beforeRef, receipt.afterRef] : rebound?.refs ?? [], count: receipt ? 1 : 0 };
      const carrierEvidence = prior?.sharedEvidence ? prior : previous;
      const relay = prior?.relay ?? (carrierEvidence && !divided && !inset && !parallel && !prior?.sectorNetwork
        ? measureRelay(rows, observation, initial, scene, carrierEvidence) : null);
      const sectorNetwork = prior?.sectorNetwork ?? (!parallel && divided && previous
        ? measureSectorNetwork(rows, geometry, scene.pose, positions(scene), sectorCarriers(observation, { ...initial, transportCarriers: previous.transportCarriers })) : null);
      const measurePassage = !!carrierEvidence && !prior?.passage && !relay && !divided && !inset && !sectorNetwork && !parallel;
      const peers = prior?.passage || measurePassage
        ? sectorCarriers(observation, { ...initial, transportCarriers: carrierEvidence?.transportCarriers ?? prior?.transportCarriers }) : [];
      const passage = relay ? null : prior?.passage ?? (measurePassage
        ? measureDeliveryPassage(rows, geometry, scene.pose, positions(scene), peers) : null);
      const handsOff = !!relay || !!sectorNetwork || !!passage;
      if (divided && !parallel && !handsOff) return null;
      const previousInk = corridor && previous?.interceptedInk;
      const predecessor = typeof previousInk === 'number' && previous?.interceptionRef
        && carrierForms(rows, geometry, previousInk).length === 1 ? { ink: previousInk, ref: previous.interceptionRef } : null;
      const sectorOpponent = sectorNetwork?.localTargets?.length && previous?.parallel
        ? { ink: previous.parallel.ink, ref: previous.parallel.ref } : null;
      const interference = predecessor ?? sectorOpponent;
      let local: State = !prior && (handsOff || inset) && previous
        ? { ...initial, ...(interference ? { interference } : {}), ...(relay ? { relay } : {}), ...(sectorNetwork ? { sectorNetwork } : {}), ...(passage ? { passage } : {}),
          ...(parallel ? { parallel } : {}),
          free: previous.free, loaded: previous.loaded, sharedEvidence: previous.sharedEvidence!,
          transportCarriers: [...(previous.transportCarriers ?? [])], transportCouplings: [...(previous.transportCouplings ?? [])],
          ...(previous.contactAppearance?.core === geometry.core && previous.contactAppearance.restShell === geometry.rest_shell
            ? { contactAppearance: previous.contactAppearance } : {}) } : initial;
      if (passage && !local.passage) local = { ...local, passage };
      if (relay && !local.relay) {
        local = { ...local, relay, waits: 0, stalledWaits: 0 };
        delete local.passage;
      }
      const commands: Readonly<Record<string, NativePoint>> = { ...labels, ...local.free, ...(local.held ? local.loaded : {}) };
      const reserved = reservedTransports(local);
      const invited = same(ahead, local.invitation) && Object.hasOwn(scene.boxes, key(ahead)) && !reserved.some(item => same(item.box, ahead));
      const forms = local.interference ? carrierForms(rows, geometry, local.interference.ink) : [];
      const carrier = forms.length === 1 ? forms[0]! : null;
      const blockers = inset ? [...externalCarriers(observation, local).values(), ...(carrier ? [carrier.point] : [])] : [];
      const unique = (step: Step) => JSON.stringify([scene.pose, scene.face, scene.boxes, local.held, step.input,
        ...(passage ? [peers] : []), ...(carrier ? [carrier.point] : []),
        ...(carrier && geometry.transferPads ? [carrier.inset] : [])]);
      const coordinated = parallel ? planParallelDelivery(local, scene, rows, observation, commands) : null;
      if (coordinated) local = { ...local, parallel: coordinated.parallel };
      const sectorStep = sectorNetwork ? planSectorRelay(local, scene, commands) : null;
      const localTargets = sectorNetwork?.localTargets;
      const timedInterception = localTargets?.length && !sectorStep && !local.held && carrier && local.interference
        && distance(carrier.point, scene.pose) <= sectorInterceptionRange
        ? parallelInterception({ ...local, parallel: local.sectorInterception ?? {
          ...local.interference, returns: {}, probes: {}, approach: [], waits: {},
        } }, scene, rows, forms, commands) : null;
      if (timedInterception) local = { ...local, sectorInterception: timedInterception.parallel };
      const step: Step | null = parallel ? coordinated?.step ?? null
        : sectorNetwork ? sectorStep ?? timedInterception?.step ?? (localTargets?.length
          ? planDelivery({ ...local, geometry: { ...geometry, targets: localTargets } }, scene, rows, commands, sectorCarriers(observation, local))
            ?? (!local.interference && (local.stalledWaits ?? 0) < 6
              ? allowDelivery(local, scene, rows, commands, reserved, candidate => local.tried.includes(unique(candidate))) : null)
          : null)
        : relay ? planRelay(local, scene, rows, commands)
        : passage ? planPassage(local, scene, commands, peers)
        : !local.held && invited && (!local.count || !Object.keys(local.loaded).length)
        ? { input: 'ACTION5', intent: 'attach', prediction: null, target: ahead }
        : (carrier ? planInterception(local, scene, rows, commands, carrier) : null)
          ?? planDelivery(local, scene, rows, commands, blockers)
          ?? allowDelivery(local, scene, rows, commands, reserved, step => local.tried.includes(unique(step)));
      if (!step || (!parallel && !((handsOff || carrier && geometry.transferPads) && step.waitForTransport) && local.tried.includes(unique(step)))) return null;
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...new Set([...local.refs, local.sharedEvidence, local.interference?.ref, local.interceptionRef, parallel?.ref,
        local.transferEvidence?.ref,
        ...(relay?.evidence ?? []), ...reserved.flatMap(item => item.sources), ...(local.transportCouplings ?? []).flatMap(role => role.sources),
        ...(local.contactAppearance?.sources ?? [])]
        .filter((value): value is string => !!value && value !== ref))];
      const known = step.intent === 'motion' ? (local.held ? local.loaded : local.free)[step.input] : null;
      const mode = execution?.reasoningMode ?? 'exploration';
      const knownInteraction = !step.intercept && step.intent !== 'motion' && Object.keys(local.loaded).length > 0;
      const facts = { routeSupported: !!known, knownInteraction, eligibleProbe: !known && !knownInteraction, mode };
      const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
      const strategy = known ? 'P07' : knownInteraction ? 'P02' : 'P05';
      if (decision?.result !== strategy) return null;
      const label = navigationPrimitives[strategy], parent = 'G_official_completion';
      const sectorSituation = localTargets?.length
        ? timedInterception?.step === step ? step.intercept ? 'Intercept the carrier and leave its crate in place'
          : 'Move into position for the carrier’s next approach'
        : step.waitForTransport ? 'Keep the route clear while the cooperating carrier finishes its delivery'
        : sectorStep ? step.intent === 'release' ? 'Set down the crate on the shared strip'
          : 'Prepare the crate for the carrier on the other side of the strip'
        : step.intent === 'release' ? 'Release the crate in the local receiver' : 'Bring the crate to a local receiver'
        : null;
      const situation = sectorSituation ?? (parallel && step.intercept ? 'Compare contact with the carrier in front while other crates keep moving'
        : parallel && step.waitForTransport ? 'Leave the approach free while the other carrier completes its movement'
        : parallel && !local.held && local.parallel?.approach.length ? 'Keep the observed approach open for the last crate'
        : step.intercept ? geometry.transferPads ? 'Test contact with the carrier at the observed frontal position'
        : 'Test contact with the carrier that removed a part from the receiver'
        : carrier && step.waitForTransport ? 'Keep the approach clear and check whether the carrier moves in front'
        : carrier && !local.held ? geometry.transferPads ? 'Approach the carrier while keeping its route open'
          : 'Approach the carrier that moved a part out of the receiver'
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
          : local.held ? 'Move while checking that the part keeps its offset' : 'Approach the next part and bring it in front of the carrier');
      const objective = { kind: 'fill_receiving_region_with_oriented_parts', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['oriented_carrier', 'part_in_front', 'receiving_region'], parentObjective: parent,
        satisfactionContract: 'official_progress_after_depositing_compatible_parts' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = 'oriented-delivery:' + need.id, action = { action_ref: step.input, data: {} };
      const prediction = known || handsOff ? step.prediction : null;
      const peer = relay ? externalCarriers(observation, local).get(relay.carrier) : null;
      const exclusive = !local.sharedEvidence || (inset && !!local.interceptionRef && !blockers.length);
      const settledParallel = !parallel || !carrierForms(rows, geometry, parallel.ink).length;
      const sending = local.sectorNetwork?.sending;
      const sectorWalk = !!local.interference && !exclusive && sending && step.route
        && (!carrier || distance(carrier.point, scene.pose) > sectorInterceptionRange)
        && step.route.every(({ prediction }) => sending.includes(key(prediction.pose)));
      const prefix = known && settledParallel && !step.intercept && !step.waitForTransport
        && (exclusive || local.sharedEvidence) && (!local.interference || exclusive || sectorWalk)
        ? walkPrefix(step, scene, local, remaining, observation) : [];
      const cooperative = !exclusive || handsOff;
      let walk = prefix.length > 1 || cooperative && prefix.length ? prefix : undefined;
      let peerGuard = walk && cooperative ? guardPeerRoute(rows, local, scene, step, walk) : undefined;
      if (peerGuard) {
        const { landings, floorSamples } = peerGuard;
        const blocked = landings.findIndex(sites => sites.some(({ pixels }) =>
          pixels ? pixels.length !== geometry.pitch ** 2 : !floorSamples.length));
        if (blocked === 0) {
          if (!sectorWalk) return null;
          walk = undefined;
          peerGuard = undefined;
        } else if (blocked > 0) {
          walk = walk!.slice(0, blocked);
          peerGuard.landings = peerGuard.landings.slice(0, blocked);
        }
      }
      const actions = walk?.map(step => ({ action_ref: step.input, data: {} })) ?? [action];
      return { status: 'proposed', kind: family, actions,
        steps: actions.map((action, index) => ({ action, expected_after: walk?.[index]?.after ?? prediction })),
        ...(walk ? { walk } : {}), ...(peerGuard ? { peerGuard } : {}),
        ...(sectorWalk && peerGuard ? { sectorWalk: true } : {}),
        local, scene, step, needId: need.id, attempt: unique(step),
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: facts },
        sicSituationCard: { strategy, need: 'Bring the framed parts into the receiving region', situation, evidence, agenda: [], mode,
          triggerCard: decision.receipt.workflow,
          actor: tileBox(geometry, scene.pose), cargo: local.held ? tileBox(geometry, local.held) : invited ? tileBox(geometry, ahead) : null,
          target: step.target ? tileBox(geometry, step.target) : null,
          ...(parallel ? { receivingTargets: geometry.targets.map(target => tileBox(geometry, target)),
            externalCarriers: [...carrierPositions(observation, local).values()].flat().map(site => tileBox(geometry, site)) } : {}),
          ...(sectorNetwork ? { receivingTargets: sectorNetwork.receiving.flatMap(sector => sector.targets.map(target => tileBox(geometry, target))),
            ...(localTargets?.length ? { localTargets: localTargets.map(target => tileBox(geometry, target)) } : {}),
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
      const settledParallel = !step || !local.parallel || !carrierForms(packet.frame_rows, local.geometry, local.parallel.ink).length;
      if (step && proposal.peerGuard) {
        const guard = proposal.peerGuard, actual = orientedCouplingScene(packet.frame_rows, local.geometry, local.color) as Scene | null;
        const admitted = proposal.binding?.level_epoch === observation.level_epoch
          && (index > 0 || proposal.binding?.observation_ref === observation.observation_ref)
          && settledParallel && matchesOwnRoute(actual, step.before, step.cargoBefore) && protectedRouteCells(actual, step.before, guard)
          && guard.landings[index]!.every(({ point, pixels }) => {
            const tile = orientedCouplingTile(packet.frame_rows, local.geometry, point)?.flat();
            return !!tile && (pixels ? pixels.length === tile.length && pixels.every((ink, i) => ink === tile[i])
              : guard.floorSamples.includes(tile.join(',')));
          });
        return { admitted, reason: admitted ? 'own_route_and_current_landings_confirmed' : 'cooperative_route_premise_changed' };
      }
      const admitted = settledParallel && (index === 0 ? proposal.binding?.observation_ref === observation.observation_ref
        : !!step && proposal.binding?.level_epoch === observation.level_epoch
          && matchesScene(orientedCouplingScene(packet.frame_rows, local.geometry, local.color) as Scene | null, step.before));
      return { admitted, reason: admitted ? 'current_oriented_carrier_bound' : 'oriented_carrier_context_changed' };
    },
    after(proposal, index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const walk = proposal.walk?.[index];
      if (walk) {
        const { local } = proposal;
        let matched = false, interceptionReached = false;
        if (before.state === after.state && (!local.parallel || !carrierForms(second, local.geometry, local.parallel.ink).length)) {
          const actual = orientedCouplingScene(second, local.geometry, local.color) as Scene | null;
          const old = walk.withdrawnContact || proposal.peerGuard
            ? orientedCouplingScene(first, local.geometry, local.color) as Scene | null : null;
          matched = (!walk.withdrawnContact || returnedContactShell(walk, local, before, after, old, actual) === local.geometry.rest_shell)
            && (proposal.peerGuard ? peerRouteReturn(proposal, walk, before, after, old, actual) : matchesScene(actual, walk.after));
          if (matched && actual && proposal.sectorWalk && local.interference) {
            const forms = carrierForms(second, local.geometry, local.interference.ink);
            interceptionReached = forms.length === 1 && distance(forms[0]!.point, actual.pose) <= sectorInterceptionRange;
          }
        }
        return { matched, seal_prefix: !matched || interceptionReached || index + 1 === proposal.actions.length,
          reason: matched ? 'carrier_and_parts_followed_declared_route' : 'carrier_or_parts_diverged' };
      }
      const parallel = proposal.local.parallel;
      if (parallel) {
        const { local, step, scene: old } = proposal, actual = orientedCouplingScene(second, local.geometry, local.color) as Scene | null;
        const held = actual && sceneHeld(actual);
        const forms = carrierForms(second, local.geometry, parallel.ink);
        const matched = !!actual && before.state === after.state && (step.intercept
          ? step.target && same(actual.pose, old.pose) && same(actual.face, old.face)
            && !forms.some(form => same(form.point, step.target))
          : step.intent === 'attach' ? same(held, step.target) : step.intent === 'release' ? !held
          : step.prediction && same(actual.pose, step.prediction.pose) && same(actual.face, step.prediction.face)
            && same(held, step.prediction.cargo));
        return { matched: !!matched, seal_prefix: true, reason: !matched ? 'parallel_delivery_replanned_from_return'
          : step.intercept ? 'frontal_carrier_contact_observed' : step.waitForTransport ? 'autonomous_delivery_turn_observed'
          : 'own_pose_and_coupling_remeasured' };
      }
      if (proposal.step.intercept) {
        const { geometry, color } = proposal.local;
        const scene = orientedCouplingScene(second, geometry, color) as Scene | null;
        const matched = confirmsInterception(proposal, second, scene);
        return { matched, seal_prefix: true, reason: matched ? 'interfering_carrier_removed' : 'contact_effect_unconfirmed' };
      }
      if (proposal.step.waitForTransport && proposal.local.geometry.transferPads && proposal.local.interference) {
        const { geometry, color } = proposal.local;
        const scene = orientedCouplingScene(second, geometry, color) as Scene | null;
        const matched = !!scene && before.state === after.state
          && same(scene.pose, proposal.scene.pose) && same(scene.face, proposal.scene.face);
        return { matched, seal_prefix: true, reason: matched ? 'observed_carrier_rendezvous_turn' : 'waiting_changed_the_player_pose' };
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
    record(before, after, action, first, second, proposal, index) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const local = index > 0 ? state ?? proposal.local : proposal.local;
      const walk = proposal.walk?.[index];
      const old = proposal.peerGuard ? orientedCouplingScene(first, local.geometry, local.color) as Scene | null
        : walk?.before ?? proposal.scene;
      if (!old) return { events: [] };
      const step = walk ? { ...proposal.step, input: walk.input,
        prediction: { pose: walk.after.pose, face: walk.after.face, cargo: walk.cargoAfter } } : proposal.step;
      const scene = orientedCouplingScene(second, local.geometry, local.color) as Scene | null;
      if (!scene) return { events: [] };
      const delta = sub(scene.pose, old.pose), moved = delta.some(Boolean);
      const changed = Object.keys(old.boxes).filter(key => Object.hasOwn(scene.boxes, key) && old.boxes[key] !== scene.boxes[key]);
      const ahead = add(scene.pose, scene.face);
      const external = transportReturn(before, after, local, old, scene);
      const attachments = couplingReturns(before, after, local, old, scene).filter(change => change.attached);
      const next: State = { ...local, count: local.count + 1, invitation: null, refs: [...local.refs.slice(-5), after.observation_ref],
        tried: [...local.tried, index === 0 ? proposal.attempt : JSON.stringify([old.pose, old.face, old.boxes, local.held, action.action_ref])] };
      recordContactAppearance(before, after, local, next, old, scene, step);
      if (walk?.withdrawnContact) {
        const shell = returnedContactShell(walk, local, before, after, old, scene);
        if (shell !== undefined && shell !== local.geometry.rest_shell) delete next.contactAppearance;
      }
      if (local.transports?.length || external.transports.length || attachments.length) next.transports = [...external.transports, ...attachments];
      const confirmedCarriers = external.transports.filter(item => item.sources.length >= 2);
      if (confirmedCarriers.length) {
        next.sharedEvidence ??= after.observation_ref;
        next.transportCarriers = [...new Set([...(local.transportCarriers ?? []), ...confirmedCarriers.map(item => item.carrier)])];
        const couplings = [...(local.transportCouplings ?? [])];
        for (const transport of confirmedCarriers) {
          if (transport.shell === undefined || transport.shell === local.geometry.rest_shell
            || couplings.some(role => role.carrier === transport.carrier && role.shell === transport.shell)) continue;
          couplings.push({ carrier: transport.carrier, shell: transport.shell, sources: [...transport.sources] });
        }
        next.transportCouplings = couplings;
      }
      if (local.parallel) {
        state = { ...next, held: sceneHeld(scene), tried: local.tried };
        return { events: [] };
      }
      if (local.geometry.transferPads && local.interference) {
        const transfer = external.transports.find(item => local.geometry.transferPads!.some(pad => same(pad, item.box)));
        if (transfer) next.transferEvidence = { part: transfer.box, ref: after.observation_ref };
        else if (local.transferEvidence && !Object.hasOwn(scene.boxes, key(local.transferEvidence.part))) delete next.transferEvidence;
        if (step.waitForTransport) next.rendezvousWaits = (local.rendezvousWaits ?? 0) + 1;
        else if (moved || !same(old.face, scene.face)) delete next.rendezvousWaits;
      }
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
          delete next.sectorInterception;
          next.interceptionRef = after.observation_ref;
          next.interceptedInk = local.interference.ink;
          delete next.transferEvidence;
          delete next.rendezvousWaits;
          state = next;
          return { events: [], reviewEvidence: 'The tested contact removed the carrier that displaced a delivered part.' };
        }
        next.stopped = true;
        state = next;
        return { events: [] };
      }
      if (local.relay || local.sectorNetwork || local.passage) {
        const matched = relayMatches({ ...proposal, scene: old, local, step }, scene);
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

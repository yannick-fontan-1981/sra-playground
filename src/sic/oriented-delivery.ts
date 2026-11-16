import { orientedCouplingInitial, orientedCouplingScene, orientedCouplingTile } from '../logos-engine/v6-oriented-coupling.ts';
import type { NativeBox, NativeFamily, NativeObservation, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { navigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';
import { observedMechanicsGroup } from './strategy-agenda.ts';
import { measureSectorNetwork, type SectorNetwork } from './sector-delivery.ts';

export const orientedDeliveryId = 'sic_oriented_delivery';
export const verifyOrientedDeliveryId = 'sic_verify_oriented_delivery';

type Geometry = { pitch: number; phase: NativePoint; core: number; background: number; rest_shell: number;
  targets: NativePoint[]; initial_boxes: NativePoint[] };
type Scene = { pose: NativePoint; face: NativePoint; face_value: number; boxes: Record<string, number> };
type Relay = { axis: 0 | 1; line: number; direction: NativePoint; cells: NativePoint[]; carrier: string; evidence: string[] };
type State = { epoch: number; geometry: Geometry; color: number; held: NativePoint | null; invitation: NativePoint | null;
  free: Record<string, NativePoint>; loaded: Record<string, NativePoint>; tried: string[]; refs: string[]; count: number;
  transports?: readonly Transport[]; sharedEvidence?: string; transportCarriers?: string[];
  relay?: Relay; sectorNetwork?: SectorNetwork; waits?: number; stalledWaits?: number; stopped?: boolean };
type Transport = { readonly carrier: string; readonly pose: NativePoint; readonly box: NativePoint;
  readonly sources: readonly string[] };
type Move = { pose: NativePoint; face: NativePoint; cargo: NativePoint | null };
type Intent = 'motion' | 'attach' | 'release';
type Step = { input: string; intent: Intent; prediction: Move | null; target: NativePoint | null; waitForTransport?: true };
type Proposal = NativeProposal & { local: State; scene: Scene; step: Step; needId: string; attempt: string };

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
  const queue = [{ state: start, step: null as Step | null, length: 0 }];
  const visited = new Set<string>();
  for (const { state, step, length } of queue) {
    const identity = JSON.stringify([state.pose, state.face, state.cargo]);
    if (visited.has(identity)) continue;
    visited.add(identity);
    if (accepts(state)) return { step, end: state, length };
    if (visited.size >= 2048) return null;
    for (const [input, delta] of moves) {
      const pose = add(state.pose, delta), face = state.cargo ? state.face : delta;
      const cargo = state.cargo ? add(state.cargo, delta) : null;
      const occupiable = (q: NativePoint, surface: Set<string>) => surface.has(key(q)) && !fixed.has(key(q));
      const prediction = occupiable(pose, floor) && (!cargo || occupiable(cargo, cargoFloor)) ? { pose, face, cargo } : { ...state, face };
      if (same(prediction.pose, state.pose) && same(prediction.face, state.face)) continue;
      queue.push({ state: prediction, step: step ?? { input, intent: 'motion', prediction, target: null }, length: length + 1 });
    }
  }
  return null;
}

function planDelivery(local: State, scene: Scene, rows: NativeRows, commands: Readonly<Record<string, NativePoint>>): Step | null {
  const { geometry: g, held } = local, parts = positions(scene);
  const reserved = new Set((local.transports ?? []).filter(item => item.sources.length >= 2).map(item => key(item.box)));
  const goal = new Set(g.targets.map(key));
  const floor = new Set([...parts, scene.pose, ...g.targets].map(key));
  for (let y = 0; y * g.pitch + g.phase[1] + g.pitch <= rows.length; y++) {
    for (let x = 0; x * g.pitch + g.phase[0] + g.pitch <= rows[0]!.length; x++) {
      const cell: NativePoint = [x, y];
      if (orientedCouplingTile(rows, g, cell)?.every(row => row.every(value => value === g.background))) floor.add(key(cell));
    }
  }
  const choices: { step: Step; length: number; index: number; target: NativePoint; face: NativePoint }[] = [];
  for (const [index, part] of parts.entries()) {
    if (held ? !same(held, part) : goal.has(key(part)) || reserved.has(key(part))) continue;
    const fixed = new Set(parts.filter(other => !same(part, other)).map(key));
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

export function createSicVerifyOrientedDelivery(): NativeFamily<Proposal> {
  let state: State | null = null;
  let decide: NativeProgramHandle | undefined;
  return {
    id: verifyOrientedDeliveryId,
    async attachPrograms(registry) {
      decide = await registry.registerProgram(chooseLanding, {}, await landingModule());
    },
    async proposeInGroup(group, observation, rows, inputs, remaining, execution) {
      if (group !== observedMechanicsGroup) return this.propose(observation, rows, inputs, remaining, execution);
      const epoch = observation.level_epoch;
      if (!(state?.epoch === epoch && (state.relay || state.sectorNetwork)) && !(state?.epoch === epoch - 1 && state.sharedEvidence)) return null;
      const proposal = await this.propose(observation, rows, inputs, remaining, execution);
      return proposal?.local.relay || proposal?.local.sectorNetwork ? proposal : null;
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !Object.keys(labels).every(input => observation.available_action_refs.includes(input))
        || !observation.available_action_refs.includes('ACTION5') || observation.available_action_refs.includes('ACTION6')) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      const previous = state?.epoch === observation.level_epoch - 1 && state.sharedEvidence ? state : null;
      if (prior?.stopped || (prior?.count ?? 0) >= (prior?.relay || prior?.sectorNetwork ? 120 : 70)) return null;
      const ordinary = prior?.geometry ?? orientedCouplingInitial(rows) as Geometry | null;
      const divided = !ordinary && !!previous;
      const geometry = ordinary ?? (divided ? orientedCouplingInitial(rows, true) as Geometry | null : null);
      if (!geometry || geometry.targets.length > 12 || (!divided && !prior?.sectorNetwork && geometry.initial_boxes.length > 6)) return null;
      const possible = prior ? [prior.color] : [...new Set(rows.flat())].filter(value => ![geometry.core, geometry.background, geometry.rest_shell].includes(value));
      const scenes = possible.flatMap(color => {
        const scene = orientedCouplingScene(rows, geometry, color) as Scene | null;
        return scene ? [{ color, scene }] : [];
      });
      if (scenes.length !== 1) return null;
      const { color, scene } = scenes[0]!, ahead = add(scene.pose, scene.face);
      const initial: State = prior ?? { epoch: observation.level_epoch, geometry, color, held: null, invitation: null,
        free: {}, loaded: {}, tried: [], refs: [], count: 0 };
      const relay = prior?.relay ?? (!prior && previous && !divided ? measureRelay(rows, observation, initial, scene, previous) : null);
      const sectorNetwork = prior?.sectorNetwork ?? (divided && previous
        ? measureSectorNetwork(rows, geometry, scene.pose, positions(scene), sectorCarriers(observation, { ...initial, transportCarriers: previous.transportCarriers })) : null);
      const handsOff = !!relay || !!sectorNetwork;
      if (!handsOff && (divided || geometry.targets.length > 6)) return null;
      const local: State = !prior && handsOff && previous
        ? { ...initial, ...(relay ? { relay } : {}), ...(sectorNetwork ? { sectorNetwork } : {}),
          free: previous.free, loaded: previous.loaded, sharedEvidence: previous.sharedEvidence!,
          transportCarriers: [...(previous.transportCarriers ?? [])] } : initial;
      const commands: Readonly<Record<string, NativePoint>> = { ...labels, ...local.free, ...(local.held ? local.loaded : {}) };
      const reserved = (local.transports ?? []).filter(item => item.sources.length >= 2);
      const invited = same(ahead, local.invitation) && Object.hasOwn(scene.boxes, key(ahead)) && !reserved.some(item => same(item.box, ahead));
      const unique = (step: Step) => JSON.stringify([scene.pose, scene.face, scene.boxes, local.held, step.input]);
      const step: Step | null = sectorNetwork ? planSectorRelay(local, scene, commands)
        : relay ? planRelay(local, scene, rows, commands)
        : !local.held && invited && (!local.count || !Object.keys(local.loaded).length)
        ? { input: 'ACTION5', intent: 'attach', prediction: null, target: ahead }
        : planDelivery(local, scene, rows, commands) ?? allowDelivery(local, scene, rows, commands, reserved, step => local.tried.includes(unique(step)));
      if (!step || (!(handsOff && step.waitForTransport) && local.tried.includes(unique(step)))) return null;
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...new Set([...local.refs, local.sharedEvidence, ...(relay?.evidence ?? []), ...reserved.flatMap(item => item.sources)]
        .filter((value): value is string => !!value && value !== ref))];
      const known = step.intent === 'motion' ? (local.held ? local.loaded : local.free)[step.input] : null;
      const mode = execution?.reasoningMode ?? 'exploration';
      const knownInteraction = step.intent !== 'motion' && Object.keys(local.loaded).length > 0;
      const facts = { routeSupported: !!known, knownInteraction, eligibleProbe: !known && !knownInteraction, mode };
      const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
      const strategy = known ? 'P07' : knownInteraction ? 'P02' : 'P05';
      if (decision?.result !== strategy) return null;
      const label = navigationPrimitives[strategy], parent = 'G_official_completion';
      const situation = sectorNetwork && step.waitForTransport ? 'Give the carriers time to finish deliveries in their sectors'
        : sectorNetwork && step.intent === 'release' ? 'Leave the part for a carrier in a sector that still has an open target'
        : sectorNetwork && local.held ? 'Take the part to a relay port serving a sector that needs a delivery'
        : step.waitForTransport ? 'Keep the receiving area free while the other carrier completes the observed delivery'
        : relay && step.intent === 'release' ? 'Leave the part on the shared strip for the other carrier'
          : relay && local.held ? 'Move the part to the shared strip while the player stays on its side'
        : step.intent === 'attach' ? 'Test whether the object in front attaches'
        : step.intent === 'release' ? 'Test whether the part stays in its receiving cell'
          : local.held ? 'Move while checking that the part keeps its offset' : 'Approach the next part and bring it in front of the carrier';
      const objective = { kind: 'fill_receiving_region_with_oriented_parts', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['oriented_carrier', 'part_in_front', 'receiving_region'], parentObjective: parent,
        satisfactionContract: 'official_progress_after_depositing_compatible_parts' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = 'oriented-delivery:' + need.id, action = { action_ref: step.input, data: {} }, actions = [action];
      const prediction = known || handsOff ? step.prediction : null;
      const peer = relay ? externalCarriers(observation, local).get(relay.carrier) : null;
      return { status: 'proposed', kind: verifyOrientedDeliveryId, actions, steps: [{ action, expected_after: prediction }],
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
          ...(peer ? { externalCarriers: [tileBox(geometry, peer)] } : {}),
          ...(reserved.length ? { externalCarriers: reserved.map(item => tileBox(geometry, item.pose)), reservedParts: reserved.map(item => tileBox(geometry, item.box)) } : {}) },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'current_oriented_carrier_bound' : 'oriented_carrier_context_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      if (proposal.local.relay || proposal.local.sectorNetwork) {
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
    record(before, after, action, _first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, scene: old, step } = proposal;
      const scene = orientedCouplingScene(second, local.geometry, local.color) as Scene | null;
      if (!scene) return { events: [] };
      const delta = sub(scene.pose, old.pose), moved = delta.some(Boolean);
      const changed = Object.keys(old.boxes).filter(key => Object.hasOwn(scene.boxes, key) && old.boxes[key] !== scene.boxes[key]);
      const ahead = add(scene.pose, scene.face);
      const external = transportReturn(before, after, local, old, scene);
      const next: State = { ...local, count: local.count + 1, invitation: null, refs: [...local.refs.slice(-5), after.observation_ref],
        tried: [...local.tried, proposal.attempt] };
      if (local.transports?.length || external.transports.length) next.transports = external.transports;
      const confirmedCarriers = external.transports.filter(item => item.sources.length >= 2);
      if (confirmedCarriers.length) {
        next.sharedEvidence ??= after.observation_ref;
        next.transportCarriers = [...new Set([...(local.transportCarriers ?? []), ...confirmedCarriers.map(item => item.carrier)])];
      }
      if (local.relay || local.sectorNetwork) {
        next.stopped = !relayMatches(proposal, scene);
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

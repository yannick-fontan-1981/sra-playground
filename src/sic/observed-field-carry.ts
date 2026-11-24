import type { NativeCommand, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import { findCompositionFrontier } from './composition-frontier.ts';
import { maximumCommittedActions } from './plan-step.ts';

type Profile = { phase: NativePoint; ink: number; floor: number; wall: number; radius: number };
type Direction = { delta: NativePoint; ref: string };
export type FieldCarryMemory = {
  profile: Profile; controls: Record<string, Direction>; tried: string[];
  body?: string; witness?: string; support?: string; supportAt?: Cell; supportRef?: string;
  mirror?: { action: string; ref: string };
  contactRef?: string;
};
type Cell = string;
type Pose = { actor: Cell; bodies: Cell[] };
type Marks = Record<Cell, number[]>;
type Scene = Pose & {
  cells: Map<Cell, number[]>; floor: Set<Cell>; marks: Marks; exit: Cell; preview: Set<Cell>; supports: Set<Cell>;
  body?: string; gates: { at: Cell; mark: Cell; opensWhenCovered: boolean }[];
  mirrors: { at: Cell; arms: NativePoint[] }[]; other: Set<Cell>;
};
type Step = { action: NativeCommand; after: Pose };
export type FieldCarryPlan = {
  memory: FieldCarryMemory; steps: Step[]; start: Pose; target: Cell; label: string;
  marks: Marks; evidence: string[]; observe: boolean; testControl?: true;
  contact?: { signature: string; at?: number };
};

const pitch = 3;
const arms: NativePoint[] = [[0, -1], [0, 1], [-1, 0], [1, 0]];
const corners = [0, 2, 6, 8];
const axes = [1, 7, 3, 5];
const point = (cell: Cell) => cell.split(',').map(Number) as [number, number];
const shift = (cell: Cell, [dx, dy]: NativePoint, scale = pitch) => {
  const [x, y] = point(cell);
  return `${x + dx * scale},${y + dy * scale}`;
};
const stamp = (pixels: readonly number[]) => pixels.join(',');
const tile = (rows: NativeRows, x: number, y: number) => rows.slice(y, y + pitch).flatMap(row => row.slice(x, x + pitch));

function perimeter([x, y]: NativePoint, radius: number) {
  const size = 2 * radius * pitch + pitch - 1, left = x - radius * pitch, top = y - radius * pitch;
  const dots = new Set<string>();
  for (let offset = 0; offset <= size; offset += 2) {
    for (const [u, v] of [[left + offset, top], [left + offset, top + size], [left, top + offset], [left + size, top + offset]]) {
      dots.add(`${u},${v}`);
    }
  }
  return dots;
}

function subject(rows: NativeRows, known?: Profile) {
  let best: { actor: Cell; votes: number; profile: Profile } | undefined, tied = false;
  for (let y = known?.phase[1] ?? 0; y + pitch <= rows.length; y += known ? pitch : 1) {
    for (let x = known?.phase[0] ?? 0; x + pitch <= rows[0]!.length; x += known ? pitch : 1) {
      const ink = rows[y + 1]![x + 1]!;
      if (known && ink !== known.ink) continue;
      const pixels = tile(rows, x, y);
      if (axes.filter(i => pixels[i] === ink).length !== 3) continue;
      const floor = known?.floor ?? pixels[0]!;
      if (!known && (floor === ink || corners.some(i => pixels[i] !== floor))) continue;
      for (const radius of known ? [known.radius] : [1, 2, 3, 4]) {
        const dots = perimeter([x, y], radius);
        let visible = 0, votes = 0;
        for (const dot of dots) {
          const [u, v] = point(dot);
          if (rows[v]?.[u] === undefined) continue;
          visible++;
          if (rows[v]?.[u] === ink) votes++;
        }
        if (votes < Math.max(10, visible * .47)) continue;
        if (best && votes <= best.votes) {
          if (votes === best.votes) tied = true;
          continue;
        }
        best = { actor: `${x},${y}`, votes, profile: known ?? {
          phase: [x % pitch, y % pitch], ink, floor, wall: rows[0]![0]!, radius,
        } };
        tied = false;
      }
    }
  }
  if (!tied) return best;
}

function picture(rows: NativeRows, memory: FieldCarryMemory, knownMarks: Marks = {}): Scene | undefined {
  const role = subject(rows, memory.profile);
  if (!role) return;
  const { actor } = role, { phase, ink, floor, wall, radius } = memory.profile;
  const overlay = perimeter(point(actor), radius), cells = new Map<Cell, number[]>(), ground = new Set<Cell>([actor]);
  const bodies: Cell[] = [], marks = { ...knownMarks }, exits: Cell[] = [], other = new Set<Cell>();
  const preview = new Set<Cell>(), supports = new Set<Cell>();
  const mirrors: Scene['mirrors'] = [], gates: Scene['gates'] = [];
  const candidates = new Map<string, Cell[]>(), rawGates = new Map<Cell, number[]>();
  for (let y = phase[1]; y + pitch <= rows.length; y += pitch) for (let x = phase[0]; x + pitch <= rows[0]!.length; x += pitch) {
    const cell = `${x},${y}`, raw = tile(rows, x, y);
    const overlaid = (i: number) => raw[i] === ink && raw[4] !== ink
      && overlay.has(`${x + i % pitch},${y + Math.floor(i / pitch)}`);
    const exposed = corners.filter(i => !overlaid(i)).map(i => raw[i]!);
    const underneath = exposed.length && exposed.every(value => value === exposed[0]) ? exposed[0]! : raw[4]!;
    const pixels = raw.map((value, i) => overlaid(i) ? underneath : value);
    cells.set(cell, pixels);
    if (cell === actor) {
      if (cell === memory.supportAt) supports.add(cell);
      continue;
    }
    const key = stamp(pixels), rim = pixels[0]!, center = pixels[4]!;
    if (memory.body && (key === memory.body || marks[cell]
      && pixels.every((value, i) => corners.includes(i) || value === Number(memory.body!.split(',')[i])))) {
      bodies.push(cell); ground.add(cell); continue;
    }
    if (marks[cell] && axes.every(i => pixels[i] === marks[cell]![i]) && pixels[4] === marks[cell]![4]) {
      ground.add(cell); continue;
    }
    if (memory.support === key) { supports.add(cell); ground.add(cell); continue; }
    if (pixels.every(value => value === center)) {
      if (center === floor) ground.add(cell);
      continue;
    }
    if (pixels.every((value, i) => i === 4 || value === rim) && rim !== floor && rim !== wall) {
      if (center === floor) { exits.push(cell); ground.add(cell); }
      else candidates.set(key, [...candidates.get(key) ?? [], cell]);
      continue;
    }
    if (corners.every(i => pixels[i] === floor) && axes.every(i => pixels[i] === pixels[1]) && pixels[1] !== floor) {
      if (center === pixels[1] && !marks[cell]) preview.add(cell);
      else marks[cell] = pixels;
      ground.add(cell); continue;
    }
    let mirror: NativePoint[] | undefined;
    for (const slash of [false, true]) {
      const diagonal = slash ? [2, 4, 6] : [0, 4, 8];
      const half = slash ? [0, 1, 3] : [1, 2, 5], peer = slash ? [5, 7, 8] : [3, 6, 7];
      if (!diagonal.every(i => pixels[i] === center) || !half.every(i => pixels[i] === pixels[half[0]!])
        || !peer.every(i => pixels[i] === pixels[peer[0]!]) || pixels[half[0]!] === pixels[peer[0]!]
        || ![pixels[half[0]!], pixels[peer[0]!]].includes(floor)) continue;
      const clear = pixels[half[0]!] === floor ? half : peer;
      mirror = arms.filter((_, i) => clear.includes(axes[i]!));
    }
    if (mirror?.length === 2) mirrors.push({ at: cell, arms: mirror });
    else if (corners.every(i => pixels[i] === rim) && rim !== floor) rawGates.set(cell, pixels);
    else other.add(cell);
  }
  const family = [...candidates].filter(([, at]) => at.length >= 2);
  const body = memory.body ?? (family.length === 1 ? family[0]![0] : undefined);
  if (!memory.body && body) for (const cell of candidates.get(body) ?? []) { bodies.push(cell); ground.add(cell); }
  for (const [pattern, at] of candidates) if (pattern !== body) for (const cell of at) other.add(cell);
  for (const [at, pixels] of rawGates) {
    const match = Object.keys(marks).filter(cell => {
      const mark = marks[cell]!;
      return axes.filter(i => pixels[i] === mark[4]).length >= 3 && pixels[0] === mark[1];
    });
    if (match.length === 1) {
      const mark = match[0]!, closed = pixels[4] !== floor;
      gates.push({ at, mark, opensWhenCovered: closed !== (actor === mark || bodies.includes(mark)) });
      ground.add(at);
    } else other.add(at);
  }
  if (exits.length !== 1) return;
  return { actor, bodies, cells, floor: ground, marks, exit: exits[0]!, gates, mirrors, other, preview, supports, ...(body ? { body } : {}) };
}

function newSupport(a: Scene, b: Scene, profile: Profile) {
  if (a.bodies.length !== b.bodies.length + 1) return;
  const candidates = [...b.other].filter(cell => {
    const before = a.cells.get(cell)!;
    return before[0] !== profile.floor && before[0] !== profile.wall && before.every(p => p === before[0])
      && arms.some(delta => a.bodies.includes(shift(cell, delta)) && !b.bodies.includes(shift(cell, delta)));
  });
  if (candidates.length === 1) return { support: stamp(b.cells.get(candidates[0]!)!), supportAt: candidates[0]! };
}

export function observeFieldCarry(memory: FieldCarryMemory | undefined, before: NativeRows, after: NativeRows,
  action: NativeCommand, ref: string, available: readonly string[], marks?: Marks): FieldCarryMemory | undefined {
  if (available.length < 4 || available.length > 5) return memory;
  const role = subject(before, memory?.profile);
  if (!role) return memory;
  const prior = memory ?? { profile: role.profile, controls: {}, tried: [] };
  const next = subject(after, prior.profile);
  if (!next) return memory;
  const a = picture(before, prior, marks);
  if (!a) return memory;
  const b = picture(after, a.body ? { ...prior, body: a.body } : prior, a.marks);
  if (!b) return memory;
  const [x, y] = point(a.actor), [u, v] = point(b.actor);
  const moved: NativePoint = [(u - x) / pitch, (v - y) / pitch];
  const direction = arms.find(([dx, dy]) => dx === moved[0] && dy === moved[1]);
  const face = axes.findIndex(i => b.cells.get(b.actor)?.[i] !== role.profile.ink);
  const turned = face >= 0 && axes[face] !== axes.find(i => a.cells.get(a.actor)?.[i] !== role.profile.ink);
  const indicated = direction ?? (a.actor === b.actor && turned ? arms[face] : undefined);
  const controls = indicated ? { ...prior.controls, [action.action_ref]: { delta: indicated, ref } } : prior.controls;
  const transported = direction && a.body && a.bodies.some(cell => !b.bodies.includes(cell) && b.bodies.includes(shift(cell, direction))
    && point(cell).every((coordinate, i) => Math.abs(coordinate - point(a.actor)[i]!) <= prior.profile.radius * pitch));
  const created = newSupport(a, b, prior.profile);
  const reflected = !direction && a.actor !== b.actor && a.preview.has(b.actor);
  return { ...prior, controls, tried: [...new Set([...prior.tried, action.action_ref])],
    ...(transported && a.body ? { body: a.body, witness: prior.witness ?? ref } : {}),
    ...(created ? { ...created, supportRef: ref } : {}),
    ...(reflected ? { mirror: { action: action.action_ref, ref } } : {}) };
}

function project(scene: Scene, pose: Pose, memory: FieldCarryMemory, direction: NativePoint): Pose | undefined {
  const open = (cell: Cell) => scene.floor.has(cell) && scene.gates.every(gate => gate.at !== cell
    || (pose.actor === gate.mark || pose.bodies.includes(gate.mark)) === gate.opensWhenCovered);
  const actor = shift(pose.actor, direction);
  if (!open(actor)) return;
  const origin = point(pose.actor);
  const inScope = (cell: Cell) => point(cell).every((coordinate, i) => Math.abs(coordinate - origin[i]!) <= memory.profile.radius * pitch);
  const unmeasuredWater = (cell: Cell) => {
    const pixels = scene.cells.get(cell);
    return !scene.floor.has(cell) && pixels && pixels[0] !== memory.profile.wall
      && pixels[0] !== memory.profile.floor && pixels.every(ink => ink === pixels[0]);
  };
  if (pose.bodies.some(cell => inScope(cell) && unmeasuredWater(shift(cell, direction)))) return;
  const moving = new Set(pose.bodies.filter(cell => inScope(cell) && open(shift(cell, direction))));
  const blocked = (cell: Cell) => pose.bodies.includes(cell) && !moving.has(cell);
  let changed = true;
  while (changed) {
    changed = false;
    for (const cell of moving) {
      const landing = shift(cell, direction);
      if (blocked(landing)) { moving.delete(cell); changed = true; }
    }
  }
  if (blocked(actor)) return;
  for (const cell of scene.supports) {
    if (cell !== pose.actor && cell !== actor && inScope(cell) && unmeasuredWater(shift(cell, direction))) return;
  }
  return { actor, bodies: pose.bodies.map(cell => moving.has(cell) ? shift(cell, direction) : cell) };
}

function mirrorLanding(scene: Scene, pose: Pose, wall: number) {
  const clear = (cell: Cell) => {
    const pixels = scene.cells.get(cell);
    return scene.floor.has(cell) || pixels && pixels[0] !== wall && pixels.every(ink => ink === pixels[0]);
  };
  for (const mirror of scene.mirrors) for (const [index, from] of mirror.arms.entries()) {
    const to = mirror.arms[1 - index]!;
    for (let distance = 1; distance <= 20; distance++) {
      const origin = shift(mirror.at, from, pitch * distance), destination = shift(mirror.at, to, pitch * distance);
      if (!clear(origin) || !clear(destination) || pose.bodies.includes(origin) || pose.bodies.includes(destination)) break;
      if (origin === pose.actor && scene.floor.has(destination)) return destination;
    }
  }
}

function exitRegion(scene: Scene) {
  const visited = new Set([scene.exit]), queue = [scene.exit];
  for (const cell of queue) for (const delta of arms) {
    const next = shift(cell, delta);
    if (scene.floor.has(next) && !visited.has(next)) { visited.add(next); queue.push(next); }
  }
  return visited;
}

function isControlReturn(plan: FieldCarryPlan, before: NativeRows, after: NativeRows, index: number) {
  const a = picture(before, plan.memory, plan.marks), b = picture(after, plan.memory, plan.marks);
  return !!a && !!b && b.actor === plan.steps[index]!.after.actor && !!newSupport(a, b, plan.memory.profile);
}

const adjacent = (a: Cell, b: Cell) => arms.some(delta => shift(a, delta) === b);

function contactingPair(peers: Cell[]) {
  for (const [index, left] of peers.entries()) {
    const right = peers.slice(index + 1).find(cell => adjacent(left, cell));
    if (right) return [left, right];
  }
}

function withContactPeers(scene: Scene, rows: NativeRows, profile: Profile, signature: string): Scene {
  const pixels = signature.split(',').map(Number);
  const overlay = perimeter(point(scene.actor), profile.radius);
  const peers = [...scene.other].filter(cell => {
    if (stamp(scene.cells.get(cell)!) === signature) return true;
    const [x, y] = point(cell);
    const visible = tile(rows, x, y);
    return visible[4] === pixels[4] && visible.every((value, index) => value === pixels[index]
      || value === profile.ink && overlay.has(`${x + index % pitch},${y + Math.floor(index / pitch)}`));
  });
  return { ...scene, bodies: [...scene.bodies, ...peers], floor: new Set([...scene.floor, ...peers]) };
}

function contactSignatures(scene: Scene, floor: number) {
  const signatures = new Set([...scene.other].flatMap(cell => {
    const pixels = scene.cells.get(cell)!;
    return pixels.includes(floor) ? [] : [stamp(pixels)];
  }));
  return signatures;
}

function planContact(scene: Scene, rows: NativeRows, memory: FieldCarryMemory,
  moves: { action: NativeCommand; delta: NativePoint }[], evidence: string[], remaining: number, rejected: readonly string[]) {
  if (moves.length < 2 || remaining < 1) return;
  let best: FieldCarryPlan | undefined, distance = remaining;
  for (const signature of contactSignatures(scene, memory.profile.floor)) {
    if (rejected.includes(signature)) continue;
    const projected = withContactPeers(scene, rows, memory.profile, signature);
    const known = scene.bodies.length, peers = projected.bodies.slice(known);
    if (peers.length < 2 || contactingPair(peers) || peers.some(cell => adjacent(scene.actor, cell))) continue;
    const start = { actor: projected.actor, bodies: projected.bodies };
    const path = findCompositionFrontier({
      start, key: pose => `${pose.actor}|${pose.bodies.join(';')}`, depth: distance, limit: 18_000,
      successors: pose => moves.flatMap(({ action, delta }) => {
        const after = project(projected, pose, memory, delta);
        if (!after || after.bodies.some((cell, index) => index >= known && adjacent(after.actor, cell))) return [];
        if (pose.bodies.some(cell => scene.marks[cell] && !after.bodies.includes(cell))) return [];
        return [{ action, after }];
      }),
      isComposition: (_, after) => !!contactingPair(after.bodies.slice(known)),
    });
    if (!path) continue;
    distance = path.length - 1;
    const steps = path.slice(0, maximumCommittedActions), last = path.at(-1)!;
    best = { memory, start, steps, target: contactingPair(last.after.bodies.slice(known))![0]!,
      label: 'Test a reachable contact between visible objects from a separate position',
      marks: scene.marks, evidence, observe: false,
      contact: { signature, ...(steps.length === path.length ? { at: steps.length - 1 } : {}) } };
  }
  return best;
}

export function planFieldCarry(memory: FieldCarryMemory | undefined, rows: NativeRows, inputs: readonly NativeCommand[],
  ref: string, remaining: number, knownMarks?: Marks, rejectedContacts: readonly string[] = [],
  contactOnly = false): FieldCarryPlan | undefined {
  const role = subject(rows, memory?.profile);
  if (!role || inputs.length < 4 || inputs.length > 5) return;
  const model = memory ?? { profile: role.profile, controls: {}, tried: [] };
  const scene = picture(rows, model, knownMarks);
  if (!scene) return;
  const start = { actor: scene.actor, bodies: scene.bodies };
  const evidence = [...new Set([ref, ...Object.values(model.controls).map(move => move.ref),
    ...[model.witness, model.supportRef, model.mirror?.ref, model.contactRef].filter((value): value is string => !!value)])];
  const moves = inputs.flatMap(action => model.controls[action.action_ref] ? [{ action, delta: model.controls[action.action_ref]!.delta }] : []);
  if (contactOnly) return planContact(scene, rows, model, moves, evidence, remaining, rejectedContacts);
  const missingWeight = scene.gates.find(gate => gate.opensWhenCovered && !start.bodies.includes(gate.mark))?.mark;
  const unset = Object.keys(scene.marks).find(mark => mark !== start.actor && !start.bodies.includes(mark) && !scene.gates.some(gate => gate.mark === mark));
  const unmapped = inputs.filter(action => !model.controls[action.action_ref]);
  const pulse = model.mirror ? inputs.find(action => action.action_ref === model.mirror!.action)
    : moves.length === 4 && unmapped.length === 1 ? unmapped[0] : undefined;
  const exitSide = pulse && scene.mirrors.length ? exitRegion(scene) : undefined;
  const usefulReflection = (pose: Pose) => {
    if (!exitSide || exitSide.has(pose.actor)) return;
    const destination = mirrorLanding(scene, pose, model.profile.wall);
    if (destination && exitSide.has(destination)) return destination;
  };
  const visibleLanding = scene.preview.size === 1 ? [...scene.preview][0] : undefined;
  if (!missingWeight && !unset && model.witness && pulse && visibleLanding && usefulReflection(start) === visibleLanding) {
    return { memory: model, steps: [{ action: pulse, after: { ...start, actor: visibleLanding } }], start, target: visibleLanding,
      label: 'Use the visible reflected landing', marks: scene.marks, evidence, observe: false };
  }
  if ((model.body || model.contactRef) && (missingWeight || unset || scene.other.size === 0)) {
    const target = missingWeight ?? unset ?? scene.exit;
    const held = start.bodies.filter(cell => !!scene.marks[cell]);
    const canCalibrateAt = (actor: Cell) => held.every(cell => point(cell).some((v, i) =>
      Math.abs(v - point(actor)[i]!) > model.profile.radius * pitch));
    const calibration = !missingWeight && moves.length < 4 && !canCalibrateAt(start.actor);
    type Node = { pose: Pose; prior?: Node; action?: NativeCommand; depth: number; touched: boolean };
    const key = (pose: Pose) => `${pose.actor}|${[...pose.bodies].sort().join(';')}`;
    const initial: Node = { pose: start, depth: 0, touched: false };
    const queue: Node[][] = [[], [initial]], heads = [0, 0], seen = new Set([key(start)]);
    for (let i = 0; i < 18_000; i++) {
      const bucket = heads[0]! < queue[0]!.length ? 0 : 1;
      const node = queue[bucket]![heads[bucket]!]!;
      if (!node) break;
      heads[bucket] = heads[bucket]! + 1;
      const reflected = !missingWeight && !unset && usefulReflection(node.pose);
      const away = calibration && canCalibrateAt(node.pose.actor);
      if (node.depth && (away || (missingWeight ? node.pose.bodies.includes(target)
        : unset ? node.pose.actor === target : node.pose.actor === target || reflected))) {
        const path: Step[] = [];
        for (let current: Node | undefined = node; current?.action; current = current.prior) path.push({ action: current.action, after: current.pose });
        return { memory: model, steps: path.reverse().slice(0, maximumCommittedActions), start,
          target: away || reflected && !missingWeight && !unset ? node.pose.actor : target,
          label: missingWeight ? 'Carry the nearby weight to the visible control'
            : away ? 'Leave the placed weight undisturbed while measuring another direction'
            : unset ? 'Reach the visible control and measure its effect' : 'Use the learned local carry to clear access to the exit',
          marks: scene.marks, evidence, observe: false,
          ...(unset && !missingWeight && !away && path.length <= maximumCommittedActions ? { testControl: true } : {}) };
      }
      if (node.depth >= remaining) continue;
      for (const { action, delta } of moves) {
        const next = project(scene, node.pose, model, delta);
        if (!next || seen.has(key(next))) continue;
        if (unset && !missingWeight && next.bodies.some((cell, index) => cell !== node.pose.bodies[index])) continue;
        if (!missingWeight && node.pose.bodies.some(cell => scene.marks[cell] && !next.bodies.includes(cell))) continue;
        const touched = node.touched || next.bodies.some((cell, index) => cell !== node.pose.bodies[index]);
        seen.add(key(next));
        queue[touched ? 0 : 1]!.push({ pose: next, prior: node, action, depth: node.depth + 1, touched });
      }
    }
  }
  const fresh = inputs.find(action => !model.tried.includes(action.action_ref));
  if (!fresh || moves.length >= 4) return;
  if (!scene.bodies.length && ![...contactSignatures(scene, model.profile.floor)].some(signature => {
    const peers = withContactPeers(scene, rows, model.profile, signature).bodies;
    return peers.length >= 2 && peers.every(cell => arms.every(delta => !adjacent(shift(scene.actor, delta), cell)));
  })) return;
  return { memory: model, steps: [{ action: fresh, after: start }], start, target: start.actor,
    label: 'Measure a directional response from the visible moving field', marks: scene.marks, evidence, observe: true };
}

function samePose(scene: Pose | undefined, expected: Pose) {
  return !!scene && scene.actor === expected.actor && scene.bodies.length === expected.bodies.length
    && scene.bodies.every(cell => expected.bodies.includes(cell));
}

export function admitFieldCarry(plan: FieldCarryPlan, index: number, rows: NativeRows): boolean {
  const visible = picture(rows, plan.memory, plan.marks);
  const scene = visible && plan.contact ? withContactPeers(visible, rows, plan.memory.profile, plan.contact.signature) : visible;
  const before = index === 0 ? plan.start : plan.steps[index - 1]!.after;
  if (!scene || !samePose(scene, before)) return false;
  if (plan.observe) return true;
  const next = plan.steps[index]!, direction = plan.memory.controls[next.action.action_ref];
  if (direction) return samePose(project(scene, before, plan.memory, direction.delta), next.after);
  return scene.preview.size === 1 && scene.preview.has(next.after.actor)
    && mirrorLanding(scene, before, plan.memory.profile.wall) === next.after.actor;
}

export function checkFieldCarryReturn(plan: FieldCarryPlan, index: number, before: NativeRows, after: NativeRows): boolean {
  if (plan.testControl && index === plan.steps.length - 1) return isControlReturn(plan, before, after, index);
  const scene = picture(after, plan.memory, plan.marks), expected = plan.steps[index]!.after;
  if (!scene || !plan.contact) return samePose(scene, expected);
  const visible = withContactPeers(scene, after, plan.memory.profile, plan.contact.signature);
  if (samePose(visible, expected)) return true;
  if (plan.contact.at !== index) return false;
  const pair = contactingPair(expected.bodies.slice(scene.bodies.length));
  return !!pair && samePose(visible, { ...expected, bodies: expected.bodies.filter(cell => !pair.includes(cell)) });
}

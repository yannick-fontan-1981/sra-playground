import type { NativeCommand, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import { findCompositionFrontier } from './composition-frontier.ts';
import { findBridgeRoute, projectBridge, type BridgeChart, type BridgePose } from './field-bridge-route.ts';
import { objectRelations } from './object-composition.ts';
import { maximumCommittedActions } from './plan-step.ts';
import { lostResourceCoverage } from './resource-reserve.ts';

type Profile = { phase: NativePoint; ink: number; floor: number; wall: number; radius: number };
type Direction = { delta: NativePoint; ref: string };
export type FieldCarryMemory = {
  profile: Profile; controls: Record<string, Direction>; tried: string[];
  body?: string; witness?: string; support?: string; supportAt?: Cell; supportRef?: string;
  mirror?: { action: string; ref: string; previewInk: number };
  contactRef?: string;
  mobile?: Record<string, string>;
  seenFloor?: Cell[];
  reflectedBodyRef?: string;
  gateReturns?: Record<Cell, Record<string, { closed: boolean; ref: string }>>;
};
type Cell = string;
type Pose = { actor: Cell; bodies: Cell[] };
type Marks = Record<Cell, number[]>;
type Gate = { at: Cell; marks: Cell[]; occupied: Cell[]; closed: boolean; opensWhenCovered: boolean;
  returns: Record<string, { closed: boolean; ref: string }>; optimistic?: true };
type Scene = Pose & {
  cells: Map<Cell, number[]>; floor: Set<Cell>; marks: Marks; exit: Cell; preview: Set<Cell>; supports: Set<Cell>;
  body?: string; gates: Gate[];
  mirrors: { at: Cell; arms: NativePoint[] }[]; other: Set<Cell>;
};
type Step = { action: NativeCommand; after: Pose | BridgePose };
export type FieldResourceLoss = { marks: Marks; dependencies: Cell[]; required: number; available: number; key: string };
export type FieldResourceConsumption = { marks: Marks; body: string; previousCount: number };
export type FieldCarryPlan = {
  memory: FieldCarryMemory; steps: Step[]; start: Pose | BridgePose; target: Cell; label: string;
  marks: Marks; evidence: string[]; observe: boolean; testControl?: true;
  composition?: { key: string; signatures: string[]; target: readonly [Cell, Cell]; at?: number; opens?: Cell[] };
  reflectiveRoute?: true;
  routeGates?: Gate[];
  gateProbe?: true;
  bridge?: { key: string; probeAt?: number };
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
  const covered = new Set<Cell>();
  const bodyPixels = memory.body?.split(',').map(Number);
  const supportRim = memory.support?.split(',')[0];
  for (let y = phase[1]; y + pitch <= rows.length; y += pitch) for (let x = phase[0]; x + pitch <= rows[0]!.length; x += pitch) {
    const cell = `${x},${y}`, raw = tile(rows, x, y);
    const overlaid = (i: number) => raw[i] === ink && raw[4] !== ink
      && overlay.has(`${x + i % pitch},${y + Math.floor(i / pitch)}`);
    const exposed = corners.filter(i => !overlaid(i)).map(i => raw[i]!);
    const underneath = exposed.length && exposed.every(value => value === exposed[0]) ? exposed[0]! : raw[4]!;
    const pixels = raw.map((value, i) => overlaid(i) ? underneath : value);
    cells.set(cell, pixels);
    if (cell === actor) {
      if (cell === memory.supportAt || supportRim !== undefined && corners.every(i => pixels[i] === Number(supportRim))) supports.add(cell);
      if (!supports.has(cell) && corners.every(index => pixels[index] === pixels[0]) && ![floor, wall, ink].includes(pixels[0]!)
        && !Object.values(marks).some(mark => mark[1] === pixels[0])) {
        marks[cell] ??= pixels.map((_, index) => corners.includes(index) ? floor : pixels[0]!);
      }
      if (marks[cell]) covered.add(cell);
      continue;
    }
    const key = stamp(pixels), rim = pixels[0]!, center = pixels[4]!;
    const accent = axes.map(i => pixels[i]!).find(color => color !== rim && color !== floor && color !== ink
      && axes.filter(i => pixels[i] === color).length === 3);
    if (accent !== undefined && corners.every(i => pixels[i] === rim) && ![wall, floor, ink].includes(rim)) {
      rawGates.set(cell, pixels);
      if (center === accent) marks[cell] = pixels.map((_, i) => corners.includes(i) ? floor : i === 4 ? accent : rim);
      continue;
    }
    const bodyCore = bodyPixels && pixels.every((value, i) => corners.includes(i) || value === bodyPixels[i]);
    if (bodyCore && !marks[cell] && corners.every(i => pixels[i] === rim) && ![bodyPixels[0], floor, wall, ink].includes(rim)) {
      marks[cell] = pixels.map((_, i) => corners.includes(i) ? floor : rim);
    }
    if (bodyCore && (key === memory.body || marks[cell])) {
      bodies.push(cell); ground.add(cell); continue;
    }
    if (marks[cell] && corners.every(index => pixels[index] === marks[cell]![1])) {
      covered.add(cell); other.add(cell); ground.add(cell); continue;
    }
    if (marks[cell] && axes.every(i => pixels[i] === marks[cell]![i]) && pixels[4] === marks[cell]![4]) {
      ground.add(cell); continue;
    }
    if (memory.support === key) { supports.add(cell); ground.add(cell); continue; }
    if (center === memory.mirror?.previewInk && rim !== center && axes.every(i => pixels[i] === center)
      && corners.every(i => pixels[i] === rim)) {
      if (rim === floor) { preview.add(cell); ground.add(cell); }
      else cells.set(cell, pixels.map(() => rim));
      continue;
    }
    if (pixels.every(value => value === center)) {
      if (center === floor || center === memory.mirror?.previewInk && memory.seenFloor?.includes(cell)) ground.add(cell);
      continue;
    }
    if (pixels.every((value, i) => i === 4 || value === rim) && rim !== floor && rim !== wall) {
      if (rim === memory.mirror?.previewInk) {
        if (center === floor || memory.seenFloor?.includes(cell)) ground.add(cell);
      } else if (center === floor) { exits.push(cell); ground.add(cell); }
      else {
        candidates.set(key, [...candidates.get(key) ?? [], cell]);
        rawGates.set(cell, pixels);
      }
      continue;
    }
    if (corners.every(i => pixels[i] === floor) && axes.every(i => pixels[i] === pixels[1]) && pixels[1] !== floor) {
      if (center === pixels[1] && !marks[cell] && (memory.mirror === undefined || center === memory.mirror.previewInk)) preview.add(cell);
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
  if (!mirrors.length) for (const cell of preview) marks[cell] = cells.get(cell)!;
  const family = [...candidates].filter(([, at]) => at.length >= 2);
  const body = memory.body ?? (family.length === 1 ? family[0]![0] : undefined);
  if (!memory.body && body) for (const cell of candidates.get(body) ?? []) { bodies.push(cell); ground.add(cell); }
  for (const [pattern, at] of candidates) if (pattern !== body) for (const cell of at) other.add(cell);
  for (const [at, pixels] of rawGates) if (marks[at] && pixels[4] !== floor && pixels[4] !== marks[at]![4]) covered.add(at);
  for (const [at, pixels] of rawGates) {
    if (bodies.includes(at)) continue;
    const rim = pixels[0]!, center = pixels[4]!;
    const barrierShape = center === floor && axes.every(i => pixels[i] === floor)
      || center !== floor && center !== rim && axes.every(i => pixels[i] === rim);
    const match = Object.keys(marks).filter(cell => {
      const mark = marks[cell]!;
      const linkedPiston = axes.filter(i => pixels[i] === mark[4]).length >= 3;
      const linkedBarrier = mark[4] === mark[1] && barrierShape;
      return rim === mark[1] && (linkedPiston || linkedBarrier);
    });
    const linkedGroup = match.length > 1 && match.every(cell => marks[cell]![4] === marks[match[0]!]![4]);
    if (match.length === 1 || linkedGroup) {
      const occupied = match.filter(mark => covered.has(mark) || bodies.includes(mark));
      const closed = center !== floor && (!marks[at] || center !== marks[at]![4]);
      gates.push({ at, marks: match.sort(), occupied, closed,
        opensWhenCovered: barrierShape && match.length > 1 || closed !== (occupied.length === match.length),
        returns: memory.gateReturns?.[at] ?? {} });
      other.delete(at);
      ground.add(at);
    } else other.add(at);
  }
  if (exits.length !== 1) return;
  return { actor, bodies, cells, floor: ground, marks, exit: exits[0]!, gates, mirrors, other, preview, supports, ...(body ? { body } : {}) };
}

function newSupport(a: Scene, b: Scene, memory: FieldCarryMemory) {
  if (a.bodies.length <= b.bodies.length) return;
  const { floor, wall } = memory.profile, known = memory.support;
  const vanished = a.bodies.filter(cell => !b.bodies.includes(cell));
  const candidates = [...b.other, ...b.supports].filter(cell => {
    const before = a.cells.get(cell)!;
    const underlying = before[4]!;
    const visibleTerrain = before.every((value, index) => index === 4 || value === underlying || value === memory.mirror?.previewInk);
    return !a.supports.has(cell) && underlying !== floor && underlying !== wall && visibleTerrain
      && (known === stamp(b.cells.get(cell)!) || arms.some(delta => vanished.includes(shift(cell, delta))));
  });
  if (candidates.length === 1 || known && candidates.length > 1 && candidates.every(cell => stamp(b.cells.get(cell)!) === known)) {
    return { support: stamp(b.cells.get(candidates[0]!)!), supportAt: candidates[0]! };
  }
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
  const mobile = { ...prior.mobile };
  if (direction) for (const signature of movableMotifs(a, prior)) {
    if (mobile[signature]) continue;
    const oldCells = motifCells(a, before, prior.profile, signature), newCells = motifCells(b, after, prior.profile, signature);
    if (oldCells.some(cell => {
      const to = shift(cell, direction);
      return !newCells.includes(cell) && !oldCells.includes(to) && newCells.includes(to)
        && point(cell).every((coordinate, i) => Math.abs(coordinate - point(a.actor)[i]!) <= prior.profile.radius * pitch);
    })) mobile[signature] = ref;
  }
  const created = newSupport(a, b, prior);
  const gateReturns = { ...prior.gateReturns };
  for (const gate of b.gates) {
    if (gate.marks.length < 2) continue;
    const key = gate.occupied.slice().sort().join(';'), returned = gateReturns[gate.at] ?? {};
    if (returned[key]?.closed !== gate.closed) gateReturns[gate.at] = { ...returned, [key]: { closed: gate.closed, ref } };
  }
  const reflected = !direction && a.actor !== b.actor && a.preview.has(b.actor);
  const reflectedBody = action.action_ref === prior.mirror?.action && a.bodies.length === b.bodies.length
    && a.bodies.some(cell => !b.bodies.includes(cell));
  const seenFloor = a.mirrors.length && a.gates.length ? [...new Set([...prior.seenFloor ?? [],
    ...[a, b].flatMap(scene => [...scene.floor].filter(cell => !scene.supports.has(cell)))])] : prior.seenFloor;
  return { ...prior, controls, tried: [...new Set([...prior.tried, action.action_ref])],
    ...(Object.keys(mobile).length ? { mobile } : {}),
    ...(transported && a.body ? { body: a.body, witness: prior.witness ?? ref } : {}),
    ...(created ? { ...created, supportRef: ref } : {}),
    ...(reflected ? { mirror: { action: action.action_ref, ref, previewInk: a.cells.get(b.actor)![4]! } } : {}),
    ...(reflectedBody && !prior.reflectedBodyRef ? { reflectedBodyRef: ref } : {}),
    ...(seenFloor ? { seenFloor } : {}),
    ...(Object.keys(gateReturns).length ? { gateReturns } : {}) };
}

const occupiedMarks = (gate: Gate, pose: Pose) => gate.marks.filter(mark => pose.actor === mark || pose.bodies.includes(mark));
const gateAllows = (gate: Gate, pose: Pose) => {
  const occupied = occupiedMarks(gate, pose);
  const witness = gate.returns[occupied.join(';')];
  if (witness) return !witness.closed;
  const covered = gate.optimistic ? occupied.length > 0 : occupied.length === gate.marks.length;
  return covered === gate.opensWhenCovered;
};
const gateOpen = (scene: Scene, pose: Pose, cell: Cell) => scene.gates.every(gate => gate.at !== cell || gateAllows(gate, pose));

function project(scene: Scene, pose: Pose, memory: FieldCarryMemory, direction: NativePoint): Pose | undefined {
  const open = (cell: Cell) => scene.floor.has(cell) && gateOpen(scene, pose, cell);
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

function projectReflection(scene: Scene, pose: Pose, wall: number): Pose | undefined {
  const clear = (cell: Cell) => {
    const pixels = scene.cells.get(cell);
    return gateOpen(scene, pose, cell) && (scene.floor.has(cell) || pixels && pixels[0] !== wall && pixels.every(v => v === pixels[0]));
  };
  const occupants = new Set([pose.actor, ...pose.bodies]), transfers = new Map<Cell, Cell>(), rayCells = new Set<Cell>();
  for (const mirror of scene.mirrors) for (const [index, from] of mirror.arms.entries()) {
    const to = mirror.arms[1 - index]!, source: Cell[] = [];
    for (let distance = 1; distance <= 20; distance++) {
      const origin = shift(mirror.at, from, distance * pitch);
      if (!clear(origin)) break;
      source.push(origin);
      if (!occupants.has(origin)) continue;
      const destination = shift(mirror.at, to, distance * pitch);
      if (!scene.floor.has(destination) || transfers.has(origin) && transfers.get(origin) !== destination) return;
      for (let step = 1; step <= distance; step++) {
        const crossed = shift(mirror.at, to, step * pitch);
        if (!clear(crossed)) return;
        rayCells.add(crossed);
      }
      source.forEach(cell => rayCells.add(cell));
      transfers.set(origin, destination);
      break;
    }
  }
  if (!transfers.size || new Set(transfers.values()).size !== transfers.size
    || [...rayCells].some(cell => occupants.has(cell) && !transfers.has(cell))) return;
  const after = { actor: transfers.get(pose.actor) ?? pose.actor, bodies: pose.bodies.map(cell => transfers.get(cell) ?? cell) };
  if ([after.actor, ...after.bodies].some(cell => !gateOpen(scene, after, cell))) return;
  return after;
}

function fieldSuccessors(scene: Scene, pose: Pose, memory: FieldCarryMemory, inputs: readonly NativeCommand[]) {
  return inputs.flatMap(action => {
    const direction = memory.controls[action.action_ref];
    const after = direction ? project(scene, pose, memory, direction.delta)
      : action.action_ref === memory.mirror?.action ? projectReflection(scene, pose, memory.profile.wall) : undefined;
    return after && [after.actor, ...after.bodies].every(cell => gateOpen(scene, after, cell)) ? [{ action, after }] : [];
  });
}

function onStableGround(scene: Scene) {
  return { ...scene, floor: new Set([...scene.floor].filter(cell => !scene.supports.has(cell))), supports: new Set<Cell>() };
}

function soloExitRoute(scene: Scene, memory: FieldCarryMemory, inputs: readonly NativeCommand[], optimisticSupports = false) {
  const stable = onStableGround(scene);
  const { floor, wall } = memory.profile;
  const water = [...scene.cells].filter(([cell, pixels]) => scene.supports.has(cell)
    || pixels[4] !== floor && pixels[4] !== wall && pixels.every(value => value === pixels[4])).map(([cell]) => cell);
  // Treat supports as available at any visible water site when ruling out a bypass. A single
  // support cannot serve two consecutive water positions in one move.
  const assumed = optimisticSupports && scene.supports.size
    ? { ...stable, floor: new Set([...stable.floor, ...water]) } : stable;
  return findCompositionFrontier<Pose, NativeCommand>({
    start: { actor: scene.actor, bodies: [] }, key: pose => pose.actor, depth: assumed.floor.size, limit: assumed.floor.size + 1,
    successors: pose => fieldSuccessors(assumed, pose, memory, inputs).filter(step =>
      !optimisticSupports || scene.supports.size !== 1 || stable.floor.has(pose.actor) || stable.floor.has(step.after.actor)),
    isComposition: (_, after) => after.actor === scene.exit,
  });
}

export function observeFieldConsumption(previous: FieldCarryMemory, before: NativeRows, marks?: Marks): FieldResourceConsumption | undefined {
  const scene = previous.body && picture(before, previous, marks);
  if (scene && scene.bodies.length) return { marks: scene.marks, previousCount: scene.bodies.length, body: previous.body! };
}

function fieldAfterConsumption(consumption: FieldResourceConsumption, current: FieldCarryMemory, rows: NativeRows,
  available: readonly string[], marks?: Marks) {
  if (consumption.body !== current.body
    || available.some(action => !current.controls[action] && action !== current.mirror?.action)) return;
  const observed = picture(rows, current, { ...consumption.marks, ...marks });
  if (!observed || consumption.previousCount <= observed.bodies.length || observed.other.size
    || observed.mirrors.length && !current.mirror) return;
  return observed;
}

export function assessFieldResourceLoss(consumption: FieldResourceConsumption, current: FieldCarryMemory,
  rows: NativeRows, available: readonly string[], marks?: Marks): FieldResourceLoss | undefined {
  const observed = fieldAfterConsumption(consumption, current, rows, available, marks);
  if (!observed) return;
  const inputs = available.map(action_ref => ({ action_ref, data: {} }));
  const reachable = (gates: Gate[]) => !!soloExitRoute({ ...observed, gates }, current, inputs, true);
  const positive = observed.gates.filter(gate => gate.opensWhenCovered);
  const independent = observed.gates.filter(gate => !gate.opensWhenCovered);
  if (!positive.length || !reachable(independent)) return;
  const groups = new Map<string, Gate[]>();
  for (const gate of positive) {
    const key = gate.marks.join(';');
    groups.set(key, [...groups.get(key) ?? [], { ...gate, optimistic: true }]);
  }
  const dependencies = [...new Set([...groups.values()].filter(gates =>
    !reachable([...independent, ...gates])).flatMap(gates => gates[0]!.marks))];
  const before = Array.from({ length: consumption.previousCount }, (_, index) => index);
  const after = before.slice(0, observed.bodies.length);
  // Separately necessary controls can share a resource in sequence. This observation proves a
  // lower bound of one assignment, even when more than one control is necessary.
  const deficit = lostResourceCoverage(dependencies.slice(0, 1), before, after, () => true);
  if (!deficit) return;
  return { marks: observed.marks, dependencies, key: JSON.stringify([...dependencies].sort()), ...deficit };
}

export function planFieldRecoveryProbe(consumption: FieldResourceConsumption, memory: FieldCarryMemory, rows: NativeRows,
  inputs: readonly NativeCommand[], ref: string, remaining: number, marks?: Marks): FieldCarryPlan | undefined {
  const scene = fieldAfterConsumption(consumption, memory, rows, inputs.map(action => action.action_ref), marks);
  if (!scene || scene.bodies.length || remaining < 1) return;
  const unknownGates = scene.gates.filter(gate => gate.opensWhenCovered && gate.marks.length > 1);
  if (!unknownGates.length) return;
  const route = soloExitRoute({ ...scene, gates: scene.gates.map(gate =>
    unknownGates.includes(gate) ? { ...gate, optimistic: true } : gate) }, memory, inputs);
  if (!route) return;
  const probe = route.findIndex(({ after }) => unknownGates.some(gate => {
    const occupied = occupiedMarks(gate, after);
    return occupied.length > 0 && !gate.returns[occupied.join(';')];
  }));
  if (probe < 0) return;
  const steps = route.slice(0, Math.min(probe + 1, maximumCommittedActions, remaining));
  const evidence = [...new Set([ref, ...Object.values(memory.controls).map(move => move.ref),
    ...(memory.mirror ? [memory.mirror.ref] : []), ...unknownGates.flatMap(gate => Object.values(gate.returns).map(result => result.ref))])];
  return { memory, start: { actor: scene.actor, bodies: [] }, steps, target: route[probe]!.after.actor, marks: scene.marks,
    label: 'Test whether the controller alone can supply the missing access condition',
    evidence, observe: false, reflectiveRoute: true, gateProbe: true };
}

export function fieldResourceRestored(memory: FieldCarryMemory, rows: NativeRows, loss: FieldResourceLoss) {
  const scene = picture(rows, memory, loss.marks);
  return !!scene && scene.bodies.length >= loss.required;
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
  return !!a && !!b && b.actor === plan.steps[index]!.after.actor && !!newSupport(a, b, plan.memory);
}

const adjacent = (a: Cell, b: Cell) => arms.some(delta => shift(a, delta) === b);

function motifCells(scene: Scene, rows: NativeRows, profile: Profile, signature: string) {
  const pixels = signature.split(',').map(Number);
  const overlay = perimeter(point(scene.actor), profile.radius);
  return [...scene.other].filter(cell => {
    if (stamp(scene.cells.get(cell)!) === signature) return true;
    const [x, y] = point(cell);
    const visible = tile(rows, x, y);
    return visible[4] === pixels[4] && visible.every((value, index) => value === pixels[index]
      || !!scene.marks[cell] && corners.includes(index)
      || value === profile.ink && overlay.has(`${x + index % pitch},${y + Math.floor(index / pitch)}`));
  });
}

function assignedMotifs(scene: Scene, rows: NativeRows, profile: Profile, signatures: string[]) {
  const matches = signatures.map(signature => motifCells(scene, rows, profile, signature));
  return matches.map((cells, index) => cells.filter(cell => stamp(scene.cells.get(cell)!) === signatures[index]
    || matches.every((peers, other) => other === index || !peers.includes(cell))));
}

function withMotifs(scene: Scene, rows: NativeRows, profile: Profile, signatures: string[]): Scene {
  const peers = assignedMotifs(scene, rows, profile, signatures).flat();
  return { ...scene, bodies: [...scene.bodies, ...peers], floor: new Set([...scene.floor, ...peers]) };
}

function movableMotifs(scene: Scene, memory: FieldCarryMemory) {
  return [...new Set([...Object.keys(memory.mobile ?? {}), ...[...scene.other].flatMap(cell => {
    const pixels = scene.cells.get(cell)!;
    return scene.marks[cell] ? [] : [stamp(pixels)];
  })])];
}

function planObjectComposition(scene: Scene, rows: NativeRows, memory: FieldCarryMemory,
  moves: { action: NativeCommand; delta: NativePoint }[], evidence: string[], remaining: number, rejected: readonly string[]) {
  if (moves.length < 2 || remaining < 1) return;
  const signatures = movableMotifs(scene, memory);
  const groups = assignedMotifs(scene, rows, memory.profile, signatures);
  const projected = withMotifs(scene, rows, memory.profile, signatures);
  const start = { actor: scene.actor, bodies: projected.bodies };
  if (!start.bodies.length || projected.bodies.slice(scene.bodies.length).some(cell => adjacent(scene.actor, cell))) return;
  const families = [...scene.bodies.map(() => memory.body ?? 'observed-body'),
    ...groups.flatMap((cells, index) => cells.map(() => signatures[index]!))];
  const fixed = [...new Set([...Object.keys(scene.marks), ...scene.supports, ...scene.mirrors.map(mirror => mirror.at),
    ...scene.gates.map(gate => gate.at)])];
  const bindings = [
    ...families.map((signature, index) => ({ id: JSON.stringify([signature, families.slice(0, index).filter(other => other === signature).length]),
      movable: true, cell: (positions: readonly Cell[]) => positions[index] })),
    ...fixed.map(cell => ({ id: cell, movable: false, cell: () => cell })),
  ];
  const relations = objectRelations(bindings, adjacent).filter(relation => !rejected.includes(relation.id) && !relation.cells(start.bodies));
  const activeMarks = new Set(scene.gates.filter(gate => gate.opensWhenCovered).flatMap(gate => gate.marks));
  const isAccess = (cells: readonly [Cell, Cell] | undefined) => !!cells && cells[0] === cells[1] && activeMarks.has(cells[0]);
  const threatens = (pose: Pose) => pose.bodies.slice(scene.bodies.length).some(cell => adjacent(pose.actor, cell));
  const lostPlacement = (before: Pose, after: Pose) => before.bodies.some(cell => scene.marks[cell] && !after.bodies.includes(cell));
  const newMobileContact = (before: Pose, after: Pose) => after.bodies.some((cell, left) =>
    after.bodies.some((right, index) => left < index && index >= scene.bodies.length && adjacent(cell, right)
      && !adjacent(before.bodies[left]!, before.bodies[index]!)));
  const newAccess = (before: Pose, after: Pose) => after.bodies.some(cell => activeMarks.has(cell) && !before.bodies.includes(cell));
  const search = (kind: 'exit' | 'access' | 'interaction') => {
    const path = findCompositionFrontier({
      start, key: pose => `${pose.actor}|${pose.bodies.join(';')}`, depth: remaining, limit: 18_000,
      successors: pose => moves.flatMap(({ action, delta }) => {
        const after = project(projected, pose, memory, delta);
        if (!after || threatens(after) || after.actor !== scene.exit && lostPlacement(pose, after)
          || kind === 'exit' && (newMobileContact(pose, after) || newAccess(pose, after))) return [];
        return [{ action, after }];
      }),
      isComposition: (_, after) => kind === 'exit' ? after.actor === scene.exit : relations.some(relation => {
        const pair = relation.cells(after.bodies);
        return kind === 'access' ? isAccess(pair) : !!pair;
      }),
    });
    if (!path) return;
    const steps = path.slice(0, maximumCommittedActions), last = path.at(-1)!;
    const relation = relations.find(relation => kind === 'access' ? isAccess(relation.cells(last.after.bodies))
      : !!relation.cells(last.after.bodies));
    const pair = relation?.cells(last.after.bodies);
    if (kind !== 'exit' && (!relation || !pair)) return;
    const opens = kind === 'access' ? scene.gates.filter(gate => gate.marks.includes(pair![0]) && gate.opensWhenCovered
      && gateAllows(gate, last.after)).map(gate => gate.at) : [];
    return { memory, start, steps, target: kind === 'exit' ? scene.exit : pair![1],
      label: kind === 'exit' ? 'Reach the exit while preserving the observed object placement'
        : kind === 'access' ? 'Compose two observed objects to test access'
          : 'Test a reachable composition of two observed objects',
      marks: scene.marks, evidence, observe: false, composition: {
        signatures, key: kind === 'exit' ? 'exit:' + scene.exit : relation!.id, target: pair ?? [scene.exit, scene.exit],
        ...(kind !== 'exit' && steps.length === path.length ? { at: steps.length - 1 } : {}),
        ...(opens.length ? { opens } : {}),
      } } satisfies FieldCarryPlan;
  };
  return (!rejected.includes('exit:' + scene.exit) ? search('exit') : undefined)
    ?? (activeMarks.size ? search('access') : undefined) ?? search('interaction');
}

function planPreservingReflection(scene: Scene, memory: FieldCarryMemory, inputs: readonly NativeCommand[], evidence: string[], remaining: number): FieldCarryPlan | undefined {
  const pulse = inputs.find(action => action.action_ref === memory.mirror?.action);
  if (!pulse || !scene.mirrors.length || !scene.gates.some(gate => gate.opensWhenCovered)
    || !scene.bodies.length && !memory.reflectedBodyRef || scene.other.size) return;
  const start = { actor: scene.actor, bodies: scene.bodies };
  const route = findCompositionFrontier({
    start, key: pose => `${pose.actor}|${[...pose.bodies].sort().join(';')}`, depth: remaining, limit: 30_000,
    successors: pose => fieldSuccessors(scene, pose, memory, inputs),
    isComposition: (_, after) => after.actor === scene.exit,
  });
  if (!route || !memory.reflectedBodyRef && !route.some((step, index) => step.action === pulse && step.after.bodies.some(cell =>
    !(index ? route[index - 1]!.after : start).bodies.includes(cell)))) return;
  const seenFloor = [...new Set([...memory.seenFloor ?? [], ...[...scene.floor].filter(cell => !scene.supports.has(cell))])];
  return { memory: { ...memory, seenFloor }, start, steps: route.slice(0, maximumCommittedActions), target: scene.exit, routeGates: scene.gates,
    label: 'Preserve the movable resource while routing through reflected positions',
    marks: scene.marks, evidence, observe: false, reflectiveRoute: true };
}

function chartForBridge(scene: Scene, rows: NativeRows, memory: FieldCarryMemory): BridgeChart {
  const { floor, wall, radius } = memory.profile;
  const hazards = [...new Set(Object.keys(memory.mobile ?? {}).flatMap(shape => motifCells(scene, rows, memory.profile, shape)))];
  return {
    pose: { actor: scene.actor, bodies: scene.bodies, supports: [...scene.supports], hazards },
    floor: new Set([...scene.floor, ...hazards].filter(cell => !scene.supports.has(cell)
      && !scene.gates.some(gate => gate.at === cell && gate.closed))),
    water: new Set([...scene.cells].filter(([cell, pixels]) => scene.supports.has(cell)
      || pixels[4] !== floor && pixels[4] !== wall && pixels.every(value => value === pixels[4])).map(([cell]) => cell)),
    marks: Object.keys(scene.marks),
    groups: [...new Map(scene.gates.map(gate => [gate.marks.join(';'), gate.marks])).values()],
    held: new Set(scene.gates.filter(gate => gate.closed && scene.marks[gate.at]).map(gate => gate.at)),
    exit: scene.exit, radius: radius * pitch, pitch,
  };
}

function planBridge(scene: Scene, rows: NativeRows, memory: FieldCarryMemory, moves: { action: NativeCommand; delta: NativePoint }[],
  evidence: string[], remaining: number, tested: readonly string[]): FieldCarryPlan | undefined {
  if (!memory.support || scene.mirrors.length || moves.length < 4) return;
  const chart = chartForBridge(scene, rows, memory);
  if (!chart.water.size || !chart.marks.length) return;
  const route = findBridgeRoute(chart, moves, remaining, tested);
  if (!route) return;
  const steps = route.steps.slice(0, maximumCommittedActions);
  return { memory, steps, start: chart.pose, target: route.steps.at(-1)!.after.actor,
    label: route.probe ? 'Test the reachable controls for a new crossing'
      : 'Move the floating support into place and cross on it',
    marks: scene.marks, evidence, observe: false, bridge: { key: route.key,
      ...(route.probe && steps.length === route.steps.length ? { probeAt: steps.length - 1 } : {}) } };
}

function sameBridgePose(actual: BridgePose | undefined, expected: Pose | BridgePose) {
  const sameSet = (a: Cell[], b: Cell[]) => a.length === b.length && a.every(cell => b.includes(cell));
  return !!actual && 'supports' in expected && samePose(actual, expected)
    && sameSet(actual.supports, expected.supports) && sameSet(actual.hazards, expected.hazards);
}

export function planFieldCarry(memory: FieldCarryMemory | undefined, rows: NativeRows, inputs: readonly NativeCommand[],
  ref: string, remaining: number, knownMarks?: Marks, testedCompositions: readonly string[] = [],
  compositionOnly = false): FieldCarryPlan | undefined {
  const role = subject(rows, memory?.profile);
  if (!role || inputs.length < 4 || inputs.length > 5) return;
  const model = memory ?? { profile: role.profile, controls: {}, tried: [] };
  const scene = picture(rows, model, knownMarks);
  if (!scene) return;
  const start = { actor: scene.actor, bodies: scene.bodies };
  const evidence = [...new Set([ref, ...Object.values(model.controls).map(move => move.ref),
    ...[model.witness, model.supportRef, model.mirror?.ref, model.contactRef, model.reflectedBodyRef].filter((value): value is string => !!value),
    ...Object.values(model.mobile ?? {})])];
  const moves = inputs.flatMap(action => model.controls[action.action_ref] ? [{ action, delta: model.controls[action.action_ref]!.delta }] : []);
  if (compositionOnly) return planObjectComposition(scene, rows, model, moves, evidence, remaining, testedCompositions);
  const bridge = planBridge(scene, rows, model, moves, evidence, remaining, testedCompositions);
  if (bridge) return bridge;
  const preserving = planPreservingReflection(scene, model, inputs, evidence, remaining);
  if (preserving) return preserving;
  const missingWeight = scene.gates.filter(gate => gate.opensWhenCovered).flatMap(gate => gate.marks).find(mark => !start.bodies.includes(mark));
  const unset = Object.keys(scene.marks).find(mark => mark !== start.actor && !start.bodies.includes(mark) && !scene.gates.some(gate => gate.marks.includes(mark)));
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
  if ((model.body || model.contactRef) && (missingWeight && start.bodies.length || unset || scene.other.size === 0)) {
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
  if (!scene.bodies.length) {
    const peers = withMotifs(scene, rows, model.profile, movableMotifs(scene, model)).bodies;
    if (peers.length + Number(Object.keys(scene.marks).length > 0) < 2
      || peers.some(cell => arms.some(delta => adjacent(shift(scene.actor, delta), cell)))) return;
  }
  return { memory: model, steps: [{ action: fresh, after: start }], start, target: start.actor,
    label: 'Measure a directional response from the visible moving field', marks: scene.marks, evidence, observe: true };
}

function samePose(scene: Pose | undefined, expected: Pose) {
  return !!scene && scene.actor === expected.actor && scene.bodies.length === expected.bodies.length
    && scene.bodies.every(cell => expected.bodies.includes(cell));
}

export function admitFieldCarry(plan: FieldCarryPlan, index: number, rows: NativeRows): boolean {
  const visible = picture(rows, plan.memory, plan.marks);
  const scene = visible && plan.composition ? withMotifs(visible, rows, plan.memory.profile, plan.composition.signatures) : visible;
  const before = index === 0 ? plan.start : plan.steps[index - 1]!.after;
  if (!scene || !samePose(scene, before)) return false;
  if (plan.observe) return true;
  const next = plan.steps[index]!, direction = plan.memory.controls[next.action.action_ref];
  if (plan.bridge) {
    const chart = chartForBridge(scene, rows, plan.memory);
    return !!direction && sameBridgePose(chart.pose, before) && sameBridgePose(projectBridge(chart, chart.pose, direction.delta), next.after);
  }
  const projectedScene = plan.gateProbe ? onStableGround(scene) : scene;
  if (direction) return samePose(project(projectedScene, before, plan.memory, direction.delta), next.after)
    && (!plan.reflectiveRoute || [next.after.actor, ...next.after.bodies].every(cell => gateOpen(scene, next.after, cell)));
  if (plan.reflectiveRoute && next.action.action_ref === plan.memory.mirror?.action) {
    return samePose(projectReflection(projectedScene, before, plan.memory.profile.wall), next.after)
      && (next.after.actor === before.actor || scene.preview.has(next.after.actor));
  }
  return scene.preview.size === 1 && scene.preview.has(next.after.actor)
    && mirrorLanding(scene, before, plan.memory.profile.wall) === next.after.actor;
}

export function checkFieldCarryReturn(plan: FieldCarryPlan, index: number, before: NativeRows, after: NativeRows): boolean {
  if (plan.testControl && index === plan.steps.length - 1) return isControlReturn(plan, before, after, index);
  const scene = picture(after, plan.memory, plan.marks), expected = plan.steps[index]!.after;
  if (plan.bridge) {
    if (!scene) return false;
    if (plan.bridge.probeAt === index) {
      const prior = picture(before, plan.memory, plan.marks);
      return !!prior && (!!newSupport(prior, scene, plan.memory) || scene.gates.some(gate => {
        const old = prior.gates.find(candidate => candidate.at === gate.at);
        return !!old && old.closed !== gate.closed;
      }));
    }
    return sameBridgePose(chartForBridge(scene, after, plan.memory).pose, expected);
  }
  if (scene && plan.routeGates?.some(gate => {
    const actual = scene.gates.find(candidate => candidate.at === gate.at);
    return actual ? actual.closed === gateAllows(gate, expected)
      : expected.actor !== gate.at && !expected.bodies.includes(gate.at);
  })) return false;
  if (!scene || !plan.composition) return samePose(scene, expected);
  const visible = withMotifs(scene, after, plan.memory.profile, plan.composition.signatures);
  if (plan.composition.at === index && plan.composition.opens?.some(cell => !scene.gates.some(gate => gate.at === cell && !gate.closed))) return false;
  if (samePose(visible, expected)) return true;
  if (plan.composition.at !== index || plan.composition.target[0] === plan.composition.target[1]) return false;
  const pair = plan.composition.target;
  return samePose(visible, { ...expected, bodies: expected.bodies.filter(cell => !pair.includes(cell)) });
}

/** Complete native transfer of common_port_assembly.py at 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e. */
import { compareUnicode } from './canonical.ts';
import { PointSet, comparePoints, pointKey, type Point } from './v6-point-set.ts';
import { projection, rowsDigest, v6Digest, type ObservedInputDomain } from './v6-native-observer.ts';
import type { NativePublicObservation, NativeRows } from './v6-native-types.ts';
export type PortRecord = Record<string, any>;
export type PortPose = readonly [rotation: number, x: number, y: number];
export interface PortBody { material: PointSet; ports: PointSet; known: boolean }
export interface PortModel extends PortRecord { background: number; marker: number; unit: number; phase: Point; bodies: PortBody[]; poses: readonly PortPose[]; width: number; height: number }
export interface PortCommand extends PortRecord { action_ref: string; data?: Record<string, number> }
export interface PortObservation extends PortRecord { entities: readonly PortRecord[]; level_epoch: number; levels_completed: number; observation_ref: string; frame_hash: string; state: string }
const keyOf = (value: unknown): string => JSON.stringify(value);
const modulo = (a: number, n: number) => (a % n + n) % n;
const addressed = (action: PortCommand): boolean => !!action.data && Object.keys(action.data).length > 0;
function same(a: any, b: any): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => same(v, b[i]));
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(k => Object.hasOwn(b, k) && same(a[k], b[k]));
}
function compare(a: any, b: any): number { if (Array.isArray(a) && Array.isArray(b)) { for (let i = 0; i < Math.min(a.length, b.length); i++) { const value = compare(a[i], b[i]); if (value) return value; } return a.length - b.length; } return typeof a === 'string' ? compareUnicode(a, b) : Number(a) - Number(b); }
export function portNeighbors([x, y]: Point): PointSet { return new PointSet([[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]); }
export function portView(material: PointSet, ports: PointSet, rotation: number): readonly [PointSet, PointSet, Map<string, Point>] {
  let points = new Map([...material].map(point => [pointKey(point), point]));
  for (let turn = 0; turn < rotation; turn++) points = new Map([...points].map(([key, [x, y]]) => [key, [-y, x] as Point]));
  const dx = Math.min(...[...points.values()].map(p => p[0])), dy = Math.min(...[...points.values()].map(p => p[1]));
  const transform = new Map([...points].map(([key, [x, y]]) => [key, [x - dx, y - dy] as Point]));
  return [new PointSet(transform.values()), new PointSet([...ports].map(point => transform.get(pointKey(point))!)), transform];
}
export function measurePortLayout(observation: PortObservation, rows: NativeRows): PortModel | null {
  const counts = new Map<number, number>(); for (const row of rows) for (const value of row) counts.set(value, (counts.get(value) ?? 0) + 1);
  const background = [...counts].sort((a, b) => b[1] - a[1])[0]![0];
  const groups = new Map<string, { color: number; unit: number; marks: PortRecord[] }>();
  for (const entity of observation.entities) { const [l, t, r, b] = entity.bbox; if (entity.rectangular && r - l === b - t && r > l) {
    const key = keyOf([entity.palette_value, r - l + 1]); if (!groups.has(key)) groups.set(key, { color: entity.palette_value, unit: r - l + 1, marks: [] }); groups.get(key)!.marks.push(entity); } }
  const candidates: PortModel[] = [];
  for (const { color, unit, marks } of groups.values()) {
    if (color === background || marks.length < 2) continue;
    const phases = new PointSet(marks.map(e => [modulo(e.bbox[0], unit), modulo(e.bbox[1], unit)] as Point)); if (phases.size !== 1) continue;
    const phase = [...phases][0]!, bodies: PortBody[] = [];
    for (const entity of observation.entities) {
      const [l, t, r, b] = entity.bbox;
      if ([color, background].includes(entity.palette_value) || entity.area < 2 * unit * unit || entity.area % (unit * unit)) continue;
      if ((l - phase[0]) % unit || (t - phase[1]) % unit || (r - l + 1) % unit || (b - t + 1) % unit) continue;
      const cells = new PointSet(entity.mask.map(([x, y]: Point) => [Math.floor(x / unit), Math.floor(y / unit)] as Point)); if (cells.size * unit * unit !== entity.area) continue;
      const origin = [Math.floor((l - phase[0]) / unit), Math.floor((t - phase[1]) / unit)];
      bodies.push({ material: new PointSet([...cells].map(([x, y]) => [origin[0]! + x, origin[1]! + y])), ports: new PointSet(), known: false });
    }
    if (bodies.length < 2) continue; let bad = false;
    for (const entity of marks) {
      const cell: Point = [Math.floor((entity.position[0] - phase[0]) / unit), Math.floor((entity.position[1] - phase[1]) / unit)];
      const owners = bodies.flatMap((body, i) => !portNeighbors(cell).disjoint(body.material) ? [i] : []);
      if (owners.length !== 1) { bad = true; break; } const body = bodies[owners[0]!]!; body.ports.add(cell); body.material.add(cell); body.known = true;
    }
    if (bad) continue; const poses: PortPose[] = [];
    for (const body of bodies) {
      const x = Math.min(...[...body.material].map(p => p[0])), y = Math.min(...[...body.material].map(p => p[1]));
      body.material = new PointSet([...body.material].map(([X, Y]) => [X - x, Y - y])); body.ports = new PointSet([...body.ports].map(([X, Y]) => [X - x, Y - y])); poses.push([0, x, y]);
    }
    candidates.push({ background, marker: color, unit, phase, bodies, poses, width: rows[0]!.length, height: rows.length });
  }
  return candidates.length === 1 ? candidates[0]! : null;
}
export function portCells(rows: NativeRows, model: PortModel): Map<string, { point: Point; value: number }> {
  const { unit: size, phase: [px, py] } = model, result = new Map<string, { point: Point; value: number }>();
  for (let y = py; y <= rows.length - size; y += size) for (let x = px; x <= rows[0]!.length - size; x += size) {
    const value = rows[y]![x]!; let uniform = true;
    for (let dy = 0; dy < size && uniform; dy++) for (let dx = 0; dx < size; dx++) if (rows[y + dy]![x + dx] !== value) { uniform = false; break; }
    if (uniform && value !== model.background) { const point: Point = [(x - px) / size, (y - py) / size]; result.set(pointKey(point), { point, value }); }
  }
  return result;
}
export function placedPorts(model: PortModel, index: number, [rotation, x, y]: PortPose): readonly [PointSet, PointSet] {
  const body = model.bodies[index]!, [material, ports] = portView(body.material, body.ports, rotation);
  return [new PointSet([...material].map(([X, Y]) => [x + X, y + Y])), new PointSet([...ports].map(([X, Y]) => [x + X, y + Y]))];
}
export function portInBounds(model: PortModel, material: PointSet): boolean {
  const [px, py] = model.phase, size = model.unit; return [...material].every(([x, y]) => 0 <= px + x * size && px + (x + 1) * size <= model.width && 1 <= py + y * size && py + (y + 1) * size <= model.height);
}
export function observedPortAgreement(raw: ReturnType<typeof portCells>, model: PortModel, poses: readonly PortPose[]): boolean {
  const material = new PointSet(), permitted = new PointSet(); poses.forEach((pose, index) => { const [full, ports] = placedPorts(model, index, pose); material.update(full); permitted.update(model.bodies[index]!.known ? ports : full); });
  const markers = new PointSet([...raw.values()].filter(row => row.value === model.marker).map(row => row.point));
  return new PointSet([...raw.values()].map(row => row.point)).equals(material) && markers.isSubset(permitted);
}
export function portAgreement(rows: NativeRows, model: PortModel, poses: readonly PortPose[]): boolean { return observedPortAgreement(portCells(rows, model), model, poses); }
export function inferPortPoses(rows: NativeRows, model: PortModel, previous: readonly PortPose[], active: number | null = null): readonly PortPose[] | null {
  const raw = portCells(rows, model), occupied = new PointSet([...raw.values()].map(row => row.point)), known: PortPose[][] = [];
  if (observedPortAgreement(raw, model, previous)) return previous;
  const indexes = active === null ? previous.map((_, i) => i) : [active];
  for (const i of indexes) {
    const others = new PointSet(); previous.forEach((pose, j) => { if (j !== i) others.update(placedPorts(model, j, pose)[0]); });
    const remainder = occupied.difference(others); if (!remainder.size) continue;
    for (let rotation = 0; rotation < 4; rotation++) {
      const [shape] = portView(model.bodies[i]!.material, model.bodies[i]!.ports, rotation);
      for (const [X, Y] of remainder) for (const [x, y] of shape) {
        const position: PortPose = [rotation, X - x, Y - y], proposal = [...previous]; proposal[i] = position;
        const full = new PointSet([...shape].map(([xx, yy]) => [position[1] + xx, position[2] + yy] as Point));
        if (others.union(full).equals(occupied) && observedPortAgreement(raw, model, proposal)) known.push(proposal);
      }
    }
  }
  if (!known.length) return null;
  const cost = (poses: readonly PortPose[]) => poses.reduce((sum, a, i) => { const b = previous[i]!; return sum + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) + Number(a[0] !== b[0]); }, 0);
  const best = Math.min(...known.map(cost)), unique = new Map(known.filter(p => cost(p) === best).map(p => [keyOf(p), p])); return unique.size === 1 ? [...unique.values()][0]! : null;
}
export function updatePorts(rows: NativeRows, model: PortModel, poses: readonly PortPose[], index: number): number {
  const raw = portCells(rows, model), body = model.bodies[index]!, [rotation, x, y] = poses[index]!;
  const transform = portView(body.material, body.ports, rotation)[2], inverse = new Map([...transform].map(([key, point]) => [pointKey(point), key.split(',').map(Number) as unknown as Point]));
  const seen = new PointSet([...placedPorts(model, index, poses[index]!)[0]].filter(point => raw.get(pointKey(point))?.value === model.marker).map(([X, Y]) => inverse.get(pointKey([X - x, Y - y]))!));
  if (seen.size && !body.known) { body.ports = seen; body.known = true; } return seen.size;
}
export function compatiblePorts(model: PortModel, index: number, pose: PortPose, already: ReadonlyMap<number, PortPose>): boolean {
  const [material, ports] = placedPorts(model, index, pose); if (!portInBounds(model, material)) return false;
  const core = material.difference(ports), counts = new Map<string, number>([...ports].map(point => [pointKey(point), 1]));
  for (const [j, otherPose] of already) { const [other, otherPorts] = placedPorts(model, j, otherPose);
    if (!core.disjoint(other) || !other.difference(otherPorts).disjoint(material)) return false;
    for (const point of otherPorts) counts.set(pointKey(point), (counts.get(pointKey(point)) ?? 0) + 1); }
  return Math.max(0, ...counts.values()) <= 2;
}
export function assemblePorts(model: PortModel, current: readonly PortPose[], active: number | null, rotationSign: number | null): readonly PortPose[] | null {
  if (model.pose_domains != null) return constrainedPortAssembly(model, current, active, rotationSign);
  let best: number | null = null, bestPose: readonly PortPose[] | null = null; const seen = new Set<string>(), count = current.length;
  const cost = (index: number, pose: PortPose) => { const old = current[index]!, turn = rotationSign ? modulo((pose[0] - old[0]) * rotationSign, 4) : Math.min(modulo(pose[0] - old[0], 4), modulo(old[0] - pose[0], 4));
    return Math.abs(pose[1] - old[1]) + Math.abs(pose[2] - old[2]) + turn + Number(!same(pose, old) && index !== active); };
  const visit = (poses: Map<number, PortPose>, expense: number): void => {
    if (best !== null && expense >= best) return; const key = keyOf([...poses].sort(([a], [b]) => a - b)); if (seen.has(key)) return; seen.add(key);
    const counts = new Map<string, { point: Point; count: number }>();
    for (const [i, pose] of poses) for (const point of placedPorts(model, i, pose)[1]) { const key = pointKey(point); if (!counts.has(key)) counts.set(key, { point, count: 0 }); counts.get(key)!.count++; }
    if (poses.size === count) { if (counts.size && [...counts.values()].every(row => row.count === 2)) { best = expense; bestPose = current.map((_, i) => poses.get(i)!); } return; }
    const free = new PointSet([...counts.values()].filter(row => row.count === 1).map(row => row.point));
    for (let i = 0; i < count; i++) { if (poses.has(i)) continue; const tried = new Set<string>();
      for (let rotation = 0; rotation < 4; rotation++) { const ports = portView(model.bodies[i]!.material, model.bodies[i]!.ports, rotation)[1];
        for (const [X, Y] of free) for (const [x, y] of ports) { const pose: PortPose = [rotation, X - x, Y - y], key = keyOf(pose); if (tried.has(key)) continue; tried.add(key);
          if (compatiblePorts(model, i, pose, poses)) { const next = new Map(poses); next.set(i, pose); visit(next, expense + cost(i, pose)); } }
      }
    }
  };
  for (let anchor = 0; anchor < count; anchor++) visit(new Map([[anchor, current[anchor]!]]), 0); return bestPose;
}
export function constrainedPortAssembly(model: PortModel, current: readonly PortPose[], _active: number | null, rotationSign: number | null): readonly PortPose[] | null {
  let domains: Map<string, PortPose>[] = model.pose_domains.map((domain: readonly PortPose[]) => new Map(domain.map(pose => [keyOf(pose), pose]))); const count = domains.length;
  const projected = new Map<string, readonly [PointSet, PointSet]>(), owners = new Map<string, { point: Point; ids: Set<number> }>();
  domains.forEach((domain, i) => { for (const [key, pose] of domain) { const projection = placedPorts(model, i, pose); projected.set(`${i}:${key}`, projection);
    for (const point of projection[1]) { const pkey = pointKey(point); if (!owners.has(pkey)) owners.set(pkey, { point, ids: new Set() }); owners.get(pkey)!.ids.add(i); } } });
  if ([...owners.values()].some(row => row.ids.size > 2)) return null;
  const interfaces = new Map<string, { a: number; b: number; shared: PointSet }>();
  for (const { point, ids } of owners.values()) if (ids.size === 2) { const [a, b] = [...ids].sort((a, b) => a - b), key = `${a},${b}`;
    if (!interfaces.has(key)) interfaces.set(key, { a: a!, b: b!, shared: new PointSet() }); interfaces.get(key)!.shared.add(point); }
  let best: readonly PortPose[] | null = null, bestCost: number | null = null, nodes = 0;
  const cost = (index: number, pose: PortPose) => rotationSign ? modulo((pose[0] - current[index]![0]) * rotationSign, 4) : Math.min(modulo(pose[0] - current[index]![0], 4), modulo(current[index]![0] - pose[0], 4));
  const visit = (ds: Map<string, PortPose>[]): void => {
    nodes++;
    for (;;) { let changed = false;
      for (let i = 0; i < ds.length; i++) { const domain = ds[i]!; let valid = new Map([...domain].filter(([key]) => [...projected.get(`${i}:${key}`)![1]].every(point => owners.get(pointKey(point))!.ids.size === 2)));
        for (const { a, b, shared } of interfaces.values()) { if (i !== a && i !== b) continue; const j = i === a ? b : a;
          valid = new Map([...valid].filter(([key, pose]) => [...ds[j]!].some(([otherKey, other]) => projected.get(`${i}:${key}`)![1].intersection(shared).equals(projected.get(`${j}:${otherKey}`)![1].intersection(shared)) && compatiblePorts(model, i, pose, new Map([[j, other]]))))); }
        if (!valid.size) return; if (valid.size !== domain.size) { ds[i] = valid; changed = true; }
      }
      if (!changed) break;
    }
    const lower = ds.reduce((sum, domain, i) => sum + Math.min(...[...domain.values()].map(pose => cost(i, pose))), 0); if (bestCost !== null && lower >= bestCost) return;
    const todo = ds.flatMap((domain, i) => domain.size > 1 ? [i] : []);
    if (todo.length) { const i = todo.sort((a, b) => ds[a]!.size - ds[b]!.size)[0]!;
      for (const pose of [...ds[i]!.values()].sort((a, b) => cost(i, a) - cost(i, b) || compare(a, b))) { const branch = ds.map(domain => new Map(domain)); branch[i] = new Map([[keyOf(pose), pose]]); visit(branch); } return; }
    const poses = ds.map(domain => [...domain.values()][0]!), counts = new Map<string, number>();
    poses.forEach((pose, i) => { for (const point of projected.get(`${i}:${keyOf(pose)}`)![1]) counts.set(pointKey(point), (counts.get(pointKey(point)) ?? 0) + 1); });
    if (!counts.size || [...counts.values()].some(value => value !== 2)) return;
    const graph = Array.from({ length: count }, () => new Set<number>());
    for (const point of counts.keys()) { const [a, b] = [...owners.get(point)!.ids]; graph[a!]!.add(b!); graph[b!]!.add(a!); }
    const reached = new Set([0]), pending = [0]; while (pending.length) for (const j of graph[pending.pop()!]!) if (!reached.has(j)) { reached.add(j); pending.push(j); }
    if (model.require_connected && reached.size !== count || model.require_acyclic && counts.size !== count - 1) return;
    best = poses; bestCost = lower;
  };
  if (domains.every(domain => domain.size)) visit(domains); model.search_nodes = nodes; return best;
}
export function portAccessPath(model: PortModel, current: readonly PortPose[], index: number, target: PortPose, motion: ReadonlyMap<string, Point>, allowOverlap = false): readonly string[] | null {
  const start = current[index]!, other = new Map(current.flatMap((pose, i) => i !== index ? [[i, pose] as const] : []));
  const reached = new Map<string, string[]>([[keyOf(start), []]]), queue = [start];
  for (let head = 0; head < queue.length; head++) { const pose = queue[head]!; if (same(pose, target)) return reached.get(keyOf(pose))!;
    for (const [key, [dx, dy]] of motion) { const next: PortPose = [pose[0], pose[1] + dx, pose[2] + dy];
      const allowed = allowOverlap ? portInBounds(model, placedPorts(model, index, next)[0]) : compatiblePorts(model, index, next, other);
      if (!reached.has(keyOf(next)) && allowed) { reached.set(keyOf(next), [...reached.get(keyOf(pose))!, key]); queue.push(next); } }
  }
  return null;
}

function modelState(model: PortModel | null): PortRecord | null { return model && { ...model, bodies: model.bodies.map(body => ({ ...body, material: body.material.state(), ports: body.ports.state() })) }; }
function restoreModel(value: PortRecord | null): PortModel | null { return value && { ...value, bodies: value.bodies.map((body: any) => ({ ...body, material: PointSet.restore(body.material), ports: PointSet.restore(body.ports) })) } as PortModel; }
export class PortAssembly {
  readonly id = 'port_assembly'; readonly familyId = 'port_assembly';
  epoch: number | null = null; motion = new Map<string, Point>(); rotationKey: string | null = null; rotationSign: number | null = null; passed: PortRecord[] = []; events: PortRecord[] = [];
  model: PortModel | null | undefined; current: readonly PortPose[] | null = null; active: number | null = null; verified = new Set<string>(); seen = new Set<string>(); refs = new Map<string, string>();
  goal: readonly PortPose[] | null = null; first: string | undefined; overlayObserved = false; overlayRefuted = false;
  state(): PortRecord {
    const value: PortRecord = { format: 'native.port_assembly.v1', epoch: this.epoch, motion: [...this.motion], rotation_key: this.rotationKey, rotation_sign: this.rotationSign, passed: this.passed, events: this.events };
    if (this.model !== undefined) Object.assign(value, { model: modelState(this.model), current: this.current, active: this.active, verified: [...this.verified].sort(compareUnicode),
      seen: [...this.seen].map(value => JSON.parse(value)).sort(compare), refs: [...this.refs], goal: this.goal, first: this.first, overlay_observed: this.overlayObserved, overlay_refuted: this.overlayRefuted }); return structuredClone(value);
  }
  restore(snapshot: PortRecord): void {
    const value = structuredClone(snapshot); if (value.format !== 'native.port_assembly.v1' || !Array.isArray(value.motion) || !Array.isArray(value.events) || !Array.isArray(value.passed)) throw new TypeError('Incompatible port-assembly state');
    this.epoch = value.epoch; this.motion = new Map(value.motion); this.rotationKey = value.rotation_key; this.rotationSign = value.rotation_sign; this.passed = value.passed; this.events = value.events;
    this.model = value.model === undefined ? undefined : restoreModel(value.model); this.current = value.current ?? null; this.active = value.active ?? null; this.verified = new Set(value.verified ?? []);
    this.seen = new Set((value.seen ?? []).map(keyOf)); this.refs = new Map(value.refs ?? []); this.goal = value.goal ?? null; this.first = value.first; this.overlayObserved = value.overlay_observed ?? false; this.overlayRefuted = value.overlay_refuted ?? false;
  }
  async propose(observation: PortObservation, rows: NativeRows, inputs: readonly PortCommand[], remaining: number): Promise<PortRecord | null> {
    const plain = inputs.filter(action => !addressed(action)).map(action => action.action_ref).sort(compareUnicode); if (plain.length < 2 || !inputs.some(addressed)) return null;
    if (this.epoch !== observation.level_epoch) {
      this.epoch = observation.level_epoch; this.model = measurePortLayout(observation, rows); this.current = this.model?.poses ?? null; this.active = null; this.verified.clear(); this.seen.clear(); this.refs.clear(); this.goal = null; this.first = observation.observation_ref; this.overlayObserved = false; this.overlayRefuted = false;
    }
    const model = this.model; if (!model) return null;
    const current = inferPortPoses(rows, model, this.current!, this.active); if (!current) return null; this.current = current;
    if (this.active !== null) updatePorts(rows, model, current, this.active);
    const unknown = plain.filter(key => !this.motion.has(key) && key !== this.rotationKey && !this.seen.has(keyOf([key, current]))); let steps: PortRecord[] = [];
    if (this.active === null || this.motion.size < 4) {
      const key = unknown[0] ?? this.motion.keys().next().value; if (key === undefined) return null;
      steps = [{ action: { action_ref: key }, mode: 'calibrate', poses: current, expected_after: null, active: this.active }];
    } else {
      const unrevealed = model.bodies.flatMap((body, i) => !body.known ? [i] : []); let target: number | null = unrevealed[0] ?? null;
      if (target === null) { this.goal = assemblePorts(model, current, this.active, this.rotationSign); if (!this.goal) return null;
        const wrong = current.flatMap((pose, i) => !same(pose, this.goal![i]) ? [i] : []); if (!wrong.length) return null; target = wrong.includes(this.active) ? this.active : wrong[0]!; }
      if (target !== this.active) {
        const [material, markers] = placedPorts(model, target, current[target]!), core = material.difference(markers), size = model.unit, [px, py] = model.phase;
        const command = inputs.find(action => addressed(action) && core.has([Math.floor((action.data!.x! - px) / size), Math.floor((action.data!.y! - py) / size)])); if (!command) return null;
        const { x, y } = command.data!, cx = Math.floor((x! - px) / size), cy = Math.floor((y! - py) / size), box = [px + cx * size, py + cy * size, px + (cx + 1) * size - 1, py + (cy + 1) * size - 1] as const;
        steps = [{ action: command, mode: 'select', poses: current, expected_after: current, active: target, box, point_digest: await rowsDigest(projection(rows, box)) }];
      } else if (!model.bodies[target]!.known) return null;
      else if (this.goal![target]![0] !== current[target]![0]) {
        const key = this.rotationKey ?? (unknown.length === 1 ? unknown[0] : null); if (!key) return null;
        steps = [{ action: { action_ref: key }, mode: 'rotate', poses: current, expected_after: null, active: target }];
      } else {
        let path = portAccessPath(model, current, target, this.goal![target]!, this.motion);
        if (path === null && !this.overlayRefuted) path = portAccessPath(model, current, target, this.goal![target]!, this.motion, true); if (!path?.length) return null;
        let poses = current;
        for (const key of path.slice(0, Math.min(remaining, 16))) { const [dx, dy] = this.motion.get(key)!, pose = poses[target]!, next = [...poses]; next[target] = [pose[0], pose[1] + dx, pose[2] + dy];
          const overlapping = !compatiblePorts(model, target, next[target]!, new Map(poses.flatMap((p, j) => j !== target ? [[j, p] as const] : [])));
          steps.push({ action: { action_ref: key }, mode: 'move', poses, expected_after: next, active: target, overlap_hypothesis: overlapping }); poses = next;
          if (!this.verified.has(key) || overlapping && !this.overlayObserved) break; }
      }
    }
    if (!steps.length) return null; steps.forEach((step, i) => { step.expected_before = { level_epoch: this.epoch, frame_hash: i === 0 ? observation.frame_hash : null }; });
    const actions = steps.map(step => step.action), refs = [...new Set([observation.observation_ref, this.first!, ...this.refs.values()])], focus = `C_ports_${(await v6Digest([refs, actions])).slice(0, 16)}`;
    const why = 'Reveal ports carried by each rigid material, then realize a joint matching with two distinct owners per port and disjoint cores.';
    const info = { materials: current.length, known_ports: model.bodies.map(body => body.ports.size), poses: current, joint_goal: this.goal,
      transit_overlap_observed: this.overlayObserved, transit_overlap_refuted: this.overlayRefuted,
      scope: 'Final matching requires disjoint cores. A blocked access may test temporary editing overlap; the first unobserved overlap seals the prefix.' };
    const facts = { repeated_marker_scale: true, owned_materials: true, joint_pairing_question: true };
    return { status: 'proposed', kind: 'rigid_port_assembly', port_plan: info, actions, steps, facts,
      compositions: [{ id: focus, role: 'information_question', observed: false, open_question: why, properties: info, relations: ['contributes_to:G_official_completion'] }],
      question: { reason: why, hypothesis_refs: refs }, route_refs: refs, binding: { observation_ref: observation.observation_ref, level_epoch: this.epoch, levels_completed: observation.levels_completed },
      bundle_template: { operation_key: 'OP18', composition_ref: focus, objective_ref: 'G_official_completion', preserve_refs: [], purpose: why, preconditions: facts, evidence: refs, actions, outcome_guard: { path: ['value'], contains: focus } } };
  }
  bind(proposal: PortRecord, domain: ObservedInputDomain): void {
    const frame = proposal.steps[0].expected_before.frame_hash;
    for (const step of proposal.steps) if (addressed(step.action)) { const { x, y } = step.action.data, old = domain.bindings.get(`${this.epoch}:${frame}`)?.get(`${x},${y}`); if (!old) throw new TypeError('Missing public point binding');
      step.point_binding = { ...old, projection_bbox: step.box, projected_rows_digest: step.point_digest }; }
  }
  before(proposal: PortRecord, index: number, publicPacket: NativePublicObservation, observation: PortObservation): PortRecord {
    const step = proposal.steps[index], bound = proposal.binding, ok = publicPacket.level === bound.level_epoch && publicPacket.levels_completed === bound.levels_completed
      && (index !== 0 || observation.observation_ref === bound.observation_ref) && publicPacket.available_action_refs.includes(step.action.action_ref) && portAgreement(publicPacket.frame_rows, this.model!, step.poses);
    return { admitted: !!ok, reason: 'compare_joint_material_occupancy_and_epoch' };
  }
  after(proposal: PortRecord, index: number, before: PortObservation, after: PortObservation, first: NativeRows, second: NativeRows): PortRecord {
    if (!same([before.level_epoch, before.state, before.levels_completed], [after.level_epoch, after.state, after.levels_completed])) return { matched: null, seal_prefix: true, reason: 'official_boundary' };
    const step = proposal.steps[index], prediction = step.expected_after; let matched: boolean | null = prediction ? portAgreement(second, this.model!, prediction) : null;
    if (step.mode === 'select' && matched) { const a = portCells(first, this.model!), b = portCells(second, this.model!);
      matched = [...placedPorts(this.model!, step.active, step.poses[step.active])[0]].some(point => a.get(pointKey(point))?.value !== b.get(pointKey(point))?.value); }
    return { matched, seal_prefix: matched !== true || index + 1 === proposal.steps.length, reason: 'compare_rigid_material_prediction' };
  }
  record(before: PortObservation, after: PortObservation, command: PortCommand, first: NativeRows, second: NativeRows, proposal: PortRecord, index: number): PortRecord {
    const step = proposal.steps[index], old = step.poses as readonly PortPose[], mode = step.mode, key = command.action_ref, ref = after.observation_ref;
    if (after.levels_completed > before.levels_completed) { this.passed.push({ score: after.levels_completed, ref }); return { status: 'official_boundary', ref }; }
    const prediction = step.expected_after as readonly PortPose[] | null;
    const next = mode === 'move' && prediction && portAgreement(second, this.model!, prediction) && !portAgreement(second, this.model!, old) ? prediction : inferPortPoses(second, this.model!, old, mode !== 'calibrate' ? step.active : null);
    const event: PortRecord = { ref, status: next ? 'pose_measured' : 'pose_ambiguous', mode };
    if (next) {
      this.current = next; const moved = old.flatMap((pose, j) => !same(pose, next[j]) ? [j] : []);
      if (mode === 'select') {
        const a = portCells(first, this.model!), b = portCells(second, this.model!), target = step.active;
        const changed = [...placedPorts(this.model!, target, next[target]!)[0]].some(point => a.get(pointKey(point))?.value !== b.get(pointKey(point))?.value);
        this.active = changed ? target : null; event.selection_confirmed = changed; if (changed) event.revealed_ports = updatePorts(second, this.model!, next, target);
      } else if (moved.length === 1) {
        const j = moved[0]!, a = old[j]!, b = next[j]!; this.active = j;
        if (a[0] === b[0]) { const vector: Point = [b[1] - a[1], b[2] - a[2]]; if ((vector[0] === 0) !== (vector[1] === 0)) { this.motion.set(key, vector); this.verified.add(key); this.refs.set(key, ref); } }
        else { this.rotationKey = key; this.rotationSign = modulo(b[0] - a[0], 4); this.refs.set(key, ref); }
      }
      if (step.overlap_hypothesis) { if (same(next, prediction) && !same(next, old)) { this.overlayObserved = true; this.refs.set('overlap', ref); } else if (same(next, old)) this.overlayRefuted = true;
        event.transit_overlap_observed = this.overlayObserved; event.transit_overlap_refuted = this.overlayRefuted; }
      if (this.active !== null) updatePorts(second, this.model!, next, this.active); event.poses = next; event.retained_ports = this.model!.bodies.map(body => body.ports.sorted());
    }
    this.seen.add(keyOf([key, old])); this.events.push(event); return event;
  }
}

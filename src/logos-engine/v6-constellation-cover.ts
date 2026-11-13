/** Complete native common_constellation_cover.py, including its V5 rigid-pose
 * measurement closure. Source 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e. */
import { compareUnicode } from './canonical.ts';
import { PointSet, pointKey, comparePoints, type Point } from './v6-point-set.ts';
import { v6Digest } from './v6-native-observer.ts';
import { measureRigidMarkerPoses, type RigidMarkerComponent } from './v6-rigid-marker-pose.ts';
import type { NativePublicObservation, NativeRows } from './v6-native-types.ts';
export type ConstellationRecord = Record<string, any>;
export interface ConstellationObservation extends ConstellationRecord { entities: readonly ConstellationRecord[]; level_epoch: number; levels_completed: number; observation_ref: string; frame_hash: string; state: string }
export interface ConstellationCommand extends ConstellationRecord { action_ref: string; data?: Record<string, number> }
export interface ConstellationBody { color: number; mask: PointSet; pose: Point }
export interface ConstellationSample { focus: Point; material: Map<number, PointSet> }
export interface ConstellationModel extends ConstellationRecord {
  targets: Map<number, PointSet>; marker_rows: Map<number, readonly ConstellationRecord[]>; background: number; excluded: PointSet; boundary_overlay: PointSet;
  marker_raster: Map<string, { point: Point; value: number }>; ring_widths: number[]; focus_color: number; focus_occlusion: PointSet; width: number; height: number;
}
export const CONSTELLATION_NEIGHBORS: readonly Point[] = [-1, 0, 1].flatMap(x => [-1, 0, 1].flatMap(y => x || y ? [[x, y] as Point] : []));
const keyOf = (value: unknown): string => JSON.stringify(value);
const addressed = (action: ConstellationCommand): boolean => !!action.data && Object.keys(action.data).length > 0;
export const constellationPlus = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1]];
export const constellationMinus = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
function same(a: any, b: any): boolean {
  if (a === b) return true; if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, i) => same(value, b[i]));
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false; return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(key => Object.hasOwn(b, key) && same(a[key], b[key]));
}
function compare(a: any, b: any): number { if (Array.isArray(a) && Array.isArray(b)) { for (let i = 0; i < Math.min(a.length, b.length); i++) { const n = compare(a[i], b[i]); if (n) return n; } return a.length - b.length; } return typeof a === 'string' ? compareUnicode(a, b) : Number(a) - Number(b); }
function gcd(a: number, b: number): number { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; }

export function measureConstellationLayout(observation: ConstellationObservation, rows: NativeRows): ConstellationModel | null {
  const rings: [number, number, number, number][] = [];
  for (const entity of observation.entities) {
    const [l, t, r, b] = entity.bbox, size = r - l + 1; if (size < 3 || size % 2 !== 1 || size !== b - t + 1 || entity.area !== size * size - 1) continue;
    const middle = Math.floor(size / 2), expected = new PointSet(); for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (x !== middle || y !== middle) expected.add([x, y]);
    if (new PointSet(entity.mask).equals(expected)) rings.push([l, t, size, entity.palette_value]);
  }
  if (rings.length < 2) return null;
  const targets = new Map<number, PointSet>(), excluded = new PointSet(), markerRows = new Map<number, ConstellationRecord[]>();
  for (const [l, t, size, color] of rings) {
    const centre: Point = [l + Math.floor(size / 2), t + Math.floor(size / 2)], value = rows[centre[1]]![centre[0]]!; if (value === color) return null;
    if (!targets.has(value)) { targets.set(value, new PointSet()); markerRows.set(value, []); } targets.get(value)!.add(centre);
    const full = new PointSet(); for (let y = t; y < t + size; y++) for (let x = l; x < l + size; x++) full.add([x, y]); excluded.update(full);
    markerRows.get(value)!.push({ centre: [centre[1], centre[0]], ring_width: size, ring_value: color });
  }
  if ([...targets.values()].some(points => points.size < 2)) return null;
  const counts = new Map<number, number>(); for (const row of rows.slice(1)) for (const value of row) counts.set(value, (counts.get(value) ?? 0) + 1);
  const background = [...counts].sort((a, b) => b[1] - a[1])[0]![0], height = rows.length, width = rows[0]!.length;
  const semantic = new Set([background, ...targets.keys(), ...rings.map(ring => ring[3])]), boundary = new PointSet();
  for (const y of [0, height - 1]) if (rows[y]!.every(value => !semantic.has(value))) boundary.update(new PointSet(Array.from({ length: width }, (_, x) => [x, y])));
  for (const x of [0, width - 1]) if (rows.every(row => !semantic.has(row[x]!))) boundary.update(new PointSet(Array.from({ length: height }, (_, y) => [x, y])));
  const hidden = excluded.union(boundary), singleton = observation.entities.filter(entity => entity.area === 1 && !hidden.has(entity.position) && !targets.has(entity.palette_value) && entity.palette_value !== background);
  if (singleton.length !== 1) return null;
  return { targets, marker_rows: markerRows, background, excluded, boundary_overlay: boundary, marker_raster: new Map([...excluded].map(point => [pointKey(point), { point, value: rows[point[1]]![point[0]]! }])),
    ring_widths: [...new Set(rings.map(ring => ring[2]))].sort((a, b) => a - b), focus_color: singleton[0]!.palette_value, focus_occlusion: new PointSet([[0, 0]]), width, height };
}
export function constellationFocusLoci(rows: NativeRows, model: ConstellationModel): Point[] {
  const points: Point[] = []; rows.forEach((row, y) => row.forEach((value, x) => { if (value === model.focus_color && !model.boundary_overlay.has([x, y]) && model.marker_raster.get(pointKey([x, y]))?.value !== model.focus_color) points.push([x, y]); })); return points;
}
export function constellationFocus(rows: NativeRows, model: ConstellationModel): Point | null { const points = constellationFocusLoci(rows, model); return points.length === 1 ? points[0]! : null; }
export function constellationBodyPixels(body: ConstellationBody, pose: Point): PointSet { return new PointSet([...body.mask].map(point => constellationPlus(point, pose))); }
export function constellationCursorAt(rows: NativeRows, model: ConstellationModel, expected: Point, bodies: readonly ConstellationBody[] = [], poses: readonly Point[] = [], active: number | null = null): boolean {
  const points = constellationFocusLoci(rows, model); if (points.length) return same(points, [expected]);
  if (active === null || !same(expected, poses[active])) return false; const [x, y] = expected;
  return bodies.some((body, index) => index !== active && index < poses.length && constellationBodyPixels(body, poses[index]!).has(expected) && rows[y]![x] === body.color);
}
export function constellationMaterial(rows: NativeRows, model: ConstellationModel): Map<number, PointSet> {
  const result = new Map<number, PointSet>(), excluded = model.excluded.union(model.boundary_overlay);
  for (const color of model.targets.keys()) { const pixels = new PointSet(); rows.forEach((row, y) => row.forEach((value, x) => { if (value === color && !excluded.has([x, y])) pixels.add([x, y]); })); result.set(color, pixels); } return result;
}
export function* constellationComponents(points: PointSet): IterableIterator<PointSet> {
  const left = points.copy(); while (left.size) { const part = new PointSet([left.pop()]), queue = [...part];
    while (queue.length) { const point = queue.pop()!; for (const vector of CONSTELLATION_NEIGHBORS) { const next = constellationPlus(point, vector); if (left.delete(next)) { part.add(next); queue.push(next); } } } yield part; }
}
export function constellationOutside(points: PointSet, model: ConstellationModel): PointSet { return new PointSet([...points].filter(([x, y]) => !(0 <= x && x < model.width && 0 <= y && y < model.height) || model.boundary_overlay.has([x, y]))); }
export function acquireConstellation(samples: readonly ConstellationSample[], model: ConstellationModel): ConstellationBody | null {
  if (samples.length < 3) return null; const base = samples[0]!.focus, offsets = samples.slice(1).map(sample => constellationMinus(sample.focus, base));
  if (!offsets.some(a => offsets.some(b => a[0] * b[1] !== a[1] * b[0]))) return null;
  const candidates: ConstellationBody[] = [];
  for (const color of model.targets.keys()) {
    const evidence = new PointSet(); for (const sample of samples) evidence.update(new PointSet([...sample.material.get(color)!].map(point => constellationMinus(point, sample.focus))));
    let possible = evidence.union(new PointSet([[0, 0]]));
    for (const sample of samples) { const allowed = new PointSet(); for (const points of sample.material.values()) allowed.update(points);
      const field = allowed.union(model.excluded, new PointSet([...model.focus_occlusion].map(point => constellationPlus(sample.focus, point))));
      possible = new PointSet([...possible].filter(point => constellationOutside(new PointSet([constellationPlus(point, sample.focus)]), model).size || field.has(constellationPlus(point, sample.focus)))); }
    if (CONSTELLATION_NEIGHBORS.filter(point => possible.has(point)).length < 2) possible.delete([0, 0]);
    for (const part of constellationComponents(possible)) {
      if (part.size < 3) continue; const l = Math.min(...[...part].map(p => p[0])), r = Math.max(...[...part].map(p => p[0])), t = Math.min(...[...part].map(p => p[1])), b = Math.max(...[...part].map(p => p[1]));
      if (l + r === 0 && t + b === 0) candidates.push({ color, mask: part, pose: samples.at(-1)!.focus });
    }
  }
  return candidates.length === 1 ? candidates[0]! : null;
}
export function constellationWithinEnvelope(body: ConstellationBody, pose: Point, point: Point): boolean {
  const [x, y] = constellationMinus(point, pose); return Math.min(...[...body.mask].map(p => p[0])) <= x && x <= Math.max(...[...body.mask].map(p => p[0]))
    && Math.min(...[...body.mask].map(p => p[1])) <= y && y <= Math.max(...[...body.mask].map(p => p[1]));
}
export function constellationAgreement(rows: NativeRows, model: ConstellationModel, bodies: readonly ConstellationBody[], poses: readonly Point[], suppliedCursor: Point | null = null, active: number | null = null): boolean {
  const cursor = suppliedCursor ?? constellationFocus(rows, model); if (cursor === null || !constellationCursorAt(rows, model, cursor, bodies, poses, active)) return false;
  const actual = constellationMaterial(rows, model), predicted = new Map<number, PointSet>();
  bodies.forEach((body, index) => { if (index >= poses.length) return; if (!predicted.has(body.color)) predicted.set(body.color, new PointSet()); predicted.get(body.color)!.update(constellationBodyPixels(body, poses[index]!)); });
  for (const [color, points] of actual) if (!points.isSubset(predicted.get(color) ?? new PointSet())) return false;
  const occlusion = new PointSet([...model.focus_occlusion].map(point => constellationPlus(cursor, point)));
  for (const [color, points] of predicted) for (const [x, y] of points.difference(model.excluded).difference(occlusion)) {
    if (constellationOutside(new PointSet([[x, y]]), model).size) continue;
    const seen = rows[y]![x]!; if (seen !== color && !predicted.get(seen)?.has([x, y])) return false;
  }
  return true;
}
export function constellationSelectionEffect(first: NativeRows, second: NativeRows, model: ConstellationModel, old: Point, next: Point): readonly [boolean, PointSet, PointSet] {
  const a = constellationMaterial(first, model), b = constellationMaterial(second, model), removed = new PointSet(), added = new PointSet();
  for (const [color, points] of a) { removed.update(points.difference(b.get(color)!)); added.update(b.get(color)!.difference(points)); }
  const distance = (p: Point, q: Point) => Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]);
  return [!same(old, next) && [...added].every(point => distance(point, old) < distance(point, next)) && [...removed].every(point => distance(point, next) < distance(point, old)), added, removed];
}
export async function constellationMechanicalPoseOptions(observation: ConstellationObservation, rows: NativeRows, bodies: readonly ConstellationBody[], poses: readonly Point[], model: ConstellationModel, quantum: number): Promise<Map<number, PointSet | null> | null> {
  if (new Set(bodies.map(body => body.color)).size !== bodies.length) return null;
  const native: RigidMarkerComponent[] = observation.entities.map(entity => {
    const [l, t, r, b] = entity.bbox, relative = (entity.mask as Point[]).map(([x, y]) => [y, x] as Point).sort(comparePoints);
    return { bbox: { left: l, top: t, width: r - l + 1, height: b - t + 1 }, area: entity.area, pixels: relative.map(([y, x]) => [t + y, l + x]), relative_pixels: relative,
      value: entity.palette_value, touches_frame_boundary: l === 0 || t === 0 || r === model.width - 1 || b === model.height - 1 };
  });
  const contract = { maximum_pixels: model.width * model.height, maximum_groups: model.targets.size, minimum_markers: 2,
    maximum_markers: [...model.targets.values()].reduce((sum, points) => sum + points.size, 0), ring_widths: model.ring_widths, minimum_support_pixels: 3,
    maximum_support_pixels: model.width * model.height, indicator_role_ref: 'observed_control_focus', neighbour_offsets: CONSTELLATION_NEIGHBORS,
    minimum_internal_neighbours: 2, maximum_midpoint_twice_offset: 1, maximum_poses_per_group: model.width * model.height };
  const templates = bodies.slice(0, poses.length).map((body, i) => ({ partition_value: body.color, relative_support_pixels: [...body.mask].map(([x, y]) => [y, x]), indicator_position: [poses[i]![1], poses[i]![0]] }));
  const retained = [...model.marker_rows].map(([color, rings]) => ({ partition_value: color, marker_centres: [...model.targets.get(color)!].map(([x, y]) => [y, x]), marker_ring_rows: rings }));
  const measured = await measureRigidMarkerPoses({ frame: rows, components: native, quantum, contract, prior_body_rows: templates, prior_target_rows: retained });
  if (!measured.rigid_marker_pose_all_groups_admitted) return null;
  return new Map(measured.rigid_marker_pose_rows.map((row: any) => [row.partition_value, row.template_pixel_incompatibility_count ? null : new PointSet(row.pose_rows.map((pose: any) => [pose.delta_col, pose.delta_row]))]));
}
export function constellationJointGoal(bodies: readonly ConstellationBody[], poses: readonly Point[], model: ConstellationModel, quantum: number, options: ReadonlyMap<number, PointSet | null> | null = null): readonly Point[] | null {
  const ordered: [number, Point][] = [...model.targets].sort(([a], [b]) => a - b).flatMap(([color, points]) => points.sorted().map(point => [color, point] as [number, Point]));
  const full = (1n << BigInt(ordered.length)) - 1n, pools: Map<bigint, { cost: number; pose: Point }>[] = [];
  bodies.slice(0, poses.length).forEach((body, index) => {
    const pose = poses[index]!, candidates = new PointSet([...model.targets.get(body.color)!].flatMap(target => [...body.mask].map(offset => constellationMinus(target, offset)))), best = new Map<bigint, { cost: number; pose: Point }>();
    for (const candidate of candidates) {
      const [dx, dy] = constellationMinus(candidate, pose); if (dx % quantum || dy % quantum) continue; const points = constellationBodyPixels(body, candidate);
      if (!(0 <= candidate[0] && candidate[0] < model.width && 1 <= candidate[1] && candidate[1] < model.height)) continue;
      if (options?.get(body.color) != null && !constellationOutside(points, model).size && !options.get(body.color)!.has([dx, dy])) continue;
      let covered = 0n; ordered.forEach(([color, point], bit) => { if (color === body.color && points.has(point)) covered += 1n << BigInt(bit); }); if (!covered) continue;
      const cost = Math.floor((Math.abs(dx) + Math.abs(dy)) / quantum), prior = best.get(covered); if (!prior || cost < prior.cost || cost === prior.cost && comparePoints(candidate, prior.pose) < 0) best.set(covered, { cost, pose: candidate });
    }
    pools.push(best);
  });
  let states = new Map<bigint, { cost: number; path: Point[] }>([[0n, { cost: 0, path: [] }]]);
  for (const pool of pools) { const following = new Map<bigint, { cost: number; path: Point[] }>();
    for (const [previous, { cost, path }] of states) for (const [covered, item] of pool) { const union = previous | covered, next = { cost: cost + item.cost, path: [...path, item.pose] }, prior = following.get(union);
      if (!prior || next.cost < prior.cost || next.cost === prior.cost && compare(next.path, prior.path) < 0) following.set(union, next); }
    states = following;
  }
  return states.get(full)?.path ?? null;
}

function encodeModel(model: ConstellationModel | null): ConstellationRecord | null {
  return model && { ...model, targets: [...model.targets].map(([color, points]) => [color, points.state()]), marker_rows: [...model.marker_rows], excluded: model.excluded.state(), boundary_overlay: model.boundary_overlay.state(),
    marker_raster: [...model.marker_raster.values()].map(({ point, value }) => [point, value]), focus_occlusion: model.focus_occlusion.state() };
}
function decodeModel(model: ConstellationRecord | null): ConstellationModel | null {
  return model && { ...model, targets: new Map(model.targets.map(([color, points]: any) => [color, PointSet.restore(points)])), marker_rows: new Map(model.marker_rows), excluded: PointSet.restore(model.excluded), boundary_overlay: PointSet.restore(model.boundary_overlay),
    marker_raster: new Map(model.marker_raster.map(([point, value]: any) => [pointKey(point), { point, value }])), focus_occlusion: PointSet.restore(model.focus_occlusion) } as ConstellationModel;
}
export class ConstellationCover {
  readonly id = 'constellation_cover'; readonly familyId = 'constellation_cover';
  epoch: number | null = null; passed: ConstellationRecord[] = []; events: ConstellationRecord[] = [];
  model: ConstellationModel | null | undefined; motion = new Map<string, Point>(); tried = new Set<string>(); selector: string | null = null; bodies: ConstellationBody[] = []; poses: Point[] = [];
  active: number | null = null; samples: ConstellationSample[] = []; complete = false; retired = false; refs = new Map<string, string>(); boundaryObserved = new Set<number>();
  persistedBodies = 0; firstObservation: string | undefined; unownedSeen = new Set<string>();
  state(): ConstellationRecord {
    const value: ConstellationRecord = { format: 'native.constellation_cover.v1', epoch: this.epoch, passed: this.passed, events: this.events };
    if (this.model !== undefined) Object.assign(value, { model: encodeModel(this.model), motion: [...this.motion], tried: [...this.tried].map(value => JSON.parse(value)).sort(compare), selector: this.selector,
      bodies: this.bodies.map(body => ({ ...body, mask: body.mask.state() })), poses: this.poses, active: this.active,
      samples: this.samples.map(sample => ({ focus: sample.focus, material: [...sample.material].map(([color, points]) => [color, points.state()]) })), complete: this.complete, retired: this.retired,
      refs: [...this.refs], boundary_observed: [...this.boundaryObserved].sort((a, b) => a - b), persisted_bodies: this.persistedBodies, first_observation: this.firstObservation, unowned_seen: [...this.unownedSeen].sort(compareUnicode) });
    return structuredClone(value);
  }
  restore(snapshot: ConstellationRecord): void {
    const value = structuredClone(snapshot); if (value.format !== 'native.constellation_cover.v1' || !Array.isArray(value.events) || !Array.isArray(value.passed)) throw new TypeError('Incompatible constellation-cover state');
    this.epoch = value.epoch; this.passed = value.passed; this.events = value.events; this.model = value.model === undefined ? undefined : decodeModel(value.model); this.motion = new Map(value.motion ?? []);
    this.tried = new Set((value.tried ?? []).map(keyOf)); this.selector = value.selector ?? null; this.bodies = (value.bodies ?? []).map((body: any) => ({ ...body, mask: PointSet.restore(body.mask) })); this.poses = value.poses ?? []; this.active = value.active ?? null;
    this.samples = (value.samples ?? []).map((sample: any) => ({ focus: sample.focus, material: new Map(sample.material.map(([color, points]: any) => [color, PointSet.restore(points)])) }));
    this.complete = value.complete ?? false; this.retired = value.retired ?? false; this.refs = new Map(value.refs ?? []); this.boundaryObserved = new Set(value.boundary_observed ?? []); this.persistedBodies = value.persisted_bodies ?? 0;
    this.firstObservation = value.first_observation; this.unownedSeen = new Set(value.unowned_seen ?? []);
  }
  async propose(observation: ConstellationObservation, rows: NativeRows, inputs: readonly ConstellationCommand[], remaining: number): Promise<ConstellationRecord | null> {
    const plain = inputs.filter(action => !addressed(action) && action.action_ref !== 'ACTION7').map(action => action.action_ref); if (plain.length < 3) return null;
    if (this.epoch !== observation.level_epoch) {
      this.epoch = observation.level_epoch; this.model = measureConstellationLayout(observation, rows); this.motion.clear(); this.tried.clear(); this.selector = null; this.bodies = []; this.poses = []; this.active = null; this.samples = []; this.complete = false; this.retired = false; this.refs.clear(); this.boundaryObserved.clear(); this.persistedBodies = 0; this.firstObservation = observation.observation_ref; this.unownedSeen.clear();
    }
    const model = this.model; if (!model || this.retired) return null;
    let cursor = constellationFocus(rows, model); if (cursor === null && this.complete && constellationCursorAt(rows, model, this.poses[this.active!]!, this.bodies, this.poses, this.active)) cursor = this.poses[this.active!]!;
    if (cursor === null) return null; if (!this.samples.length) this.samples = [{ focus: cursor, material: constellationMaterial(rows, model) }];
    if (this.active === null) { const learned = acquireConstellation(this.samples, model); if (learned) { this.bodies.push(learned); this.poses.push(cursor); this.active = this.bodies.length - 1; } }
    let steps: ConstellationRecord[] = [];
    if (!this.complete) {
      let acquisitionProjection: Point | null = null, key: string | null = null, mode: string;
      if (this.active === null) {
        const unknown = plain.filter(key => !this.motion.has(key) && !this.tried.has(keyOf([key, cursor])) && key !== this.selector);
        if (unknown.length) key = unknown[0]!;
        else {
          const origin = this.samples[0]!.focus, offsets = this.samples.map(sample => constellationMinus(sample.focus, origin)), candidates: { score: number[]; key: string; point: Point }[] = []; let order = 0;
          for (const [candidate, vector] of this.motion) {
            const point = constellationPlus(cursor, vector), [x, y] = point, ordinal = order++; if (this.tried.has(keyOf([candidate, cursor])) || constellationOutside(new PointSet([point]), model).size) continue;
            if (this.bodies.some((body, i) => constellationBodyPixels(body, this.poses[i]!).has(point))) continue;
            const independent = offsets.some(offset => vector[0] * offset[1] !== vector[1] * offset[0]), exposed = rows[y]![x] === model.background;
            candidates.push({ score: [Number(!independent), Number(!exposed), ordinal], key: candidate, point });
          }
          candidates.sort((a, b) => compare(a.score, b.score) || compareUnicode(a.key, b.key) || comparePoints(a.point, b.point));
          if (candidates.length) { key = candidates[0]!.key; acquisitionProjection = candidates[0]!.point; }
        }
        mode = 'acquire';
      } else if (this.motion.size < 4) {
        key = plain.find(k => !this.motion.has(k) && !this.tried.has(keyOf([k, cursor])) && k !== this.selector) ?? null; mode = 'calibrate';
        if (key === null) key = [...this.motion].find(([k, v]) => ![...this.motion.values()].some(other => same(other, [-v[0], -v[1]])) && !this.tried.has(keyOf([k, cursor])))?.[0] ?? null;
      } else { key = this.selector || plain.find(k => !this.motion.has(k)) || null; mode = 'cycle'; }
      if (key === null) return null; steps = [{ action: { action_ref: key }, mode, cursor, expected_after: null }]; if (acquisitionProjection !== null) steps[0]!.acquisition_focus_projection = acquisitionProjection;
    } else {
      if (!constellationAgreement(rows, model, this.bodies, this.poses, cursor, this.active)) return null;
      const quantum = [...this.motion.values()].flat().filter(Boolean).reduce((result, v) => gcd(result, Math.abs(v)), 0);
      const options = await constellationMechanicalPoseOptions(observation, rows, this.bodies, this.poses, model, quantum), goal = constellationJointGoal(this.bodies, this.poses, model, quantum, options); if (goal === null) return null;
      const wrong = this.poses.flatMap((pose, i) => !same(pose, goal[i]) ? [i] : []); if (!wrong.length) return null;
      if (!wrong.includes(this.active!)) { if (!this.selector) return null; steps = [{ action: { action_ref: this.selector }, mode: 'cycle', cursor, poses: [...this.poses], expected_after: null }]; }
      else {
        let poses = [...this.poses]; const target = goal[this.active!]!;
        while (!same(poses[this.active!], target) && steps.length < Math.min(16, remaining)) {
          const current = poses[this.active!]!, delta = constellationMinus(target, current), options = [...this.motion].filter(([, vector]) => Math.abs(delta[0] - vector[0]) + Math.abs(delta[1] - vector[1]) < Math.abs(delta[0]) + Math.abs(delta[1]));
          if (!options.length) break; const [key, vector] = options[0]!, next = [...poses]; next[this.active!] = constellationPlus(current, vector);
          const hidden = constellationOutside(constellationBodyPixels(this.bodies[this.active!]!, next[this.active!]!), model);
          steps.push({ action: { action_ref: key }, mode: 'move', cursor: current, poses, expected_after: next, unobserved_support_pixels: hidden.size }); poses = next;
          if (hidden.size && !this.boundaryObserved.has(this.active!)) break;
        }
      }
    }
    if (!steps.length) return null;
    const refs = [observation.observation_ref, ...this.refs.values()], actions = steps.map(step => step.action), ref = `C_constellation_${(await v6Digest([refs, actions])).slice(0, 16)}`;
    steps.forEach((step, i) => { step.expected_before = { level_epoch: this.epoch, frame_hash: i === 0 ? observation.frame_hash : null }; });
    let why = 'Acquire controlled supports by registering independent displacements on the focus, then jointly cover the measured marker constellations.';
    const info: ConstellationRecord = { acquired_bodies: this.bodies.length, ownership_complete: this.complete, active: this.active, control_vectors: Object.fromEntries(this.motion), selector: this.selector,
      scope: 'Rigid support and joint marker coverage remain hypotheses; coincident palette values retain distinct controlled owners.',
      focus_visibility: constellationFocus(rows, model) !== null ? 'visible' : 'retained_under_known_owner',
      support_scope: 'Focus-interior pixels and measured boundary-band occlusions remain conditional until exposed in the observable field.', censored_boundary_pixels: model.boundary_overlay.size };
    if (steps[0]!.acquisition_focus_projection != null) { info.acquisition_focus_projection = steps[0]!.acquisition_focus_projection;
      why += ' Keep its predicted focus outside known peer supports while acquiring independent displacements; unregistered owners remain uncertain.'; }
    info.offscreen_support_scope = 'Retain the acquired full support and compare its visible projection. Hidden pixels remain unobserved. Seal the first boundary crossing per owner.';
    const facts = { repeated_framed_markers: true, bound_visible_or_peer_occluded_focus: true, ownership_question: true };
    return { status: 'proposed', kind: 'controlled_constellation_cover', constellation_plan: info, actions, steps, facts,
      compositions: [{ id: ref, role: 'information_question', observed: false, open_question: why, properties: info, relations: ['contributes_to:G_official_completion'] }],
      question: { reason: why, hypothesis_refs: refs }, route_refs: refs, binding: { observation_ref: observation.observation_ref, level_epoch: this.epoch, levels_completed: observation.levels_completed },
      bundle_template: { operation_key: 'OP18', composition_ref: ref, objective_ref: 'G_official_completion', preserve_refs: [], purpose: why, preconditions: facts, evidence: refs, actions, outcome_guard: { path: ['value'], contains: ref } } };
  }
  bind(_proposal: ConstellationRecord, _domain: unknown): void {}
  before(proposal: ConstellationRecord, index: number, publicPacket: NativePublicObservation, observation: ConstellationObservation): ConstellationRecord {
    const step = proposal.steps[index], bound = proposal.binding, poses = step.poses ?? [], owner = poses.length ? this.active : null;
    let ok = publicPacket.level === bound.level_epoch && publicPacket.levels_completed === bound.levels_completed && (index !== 0 || observation.observation_ref === bound.observation_ref)
      && publicPacket.available_action_refs.includes(step.action.action_ref) && constellationCursorAt(publicPacket.frame_rows, this.model!, step.cursor, this.bodies, poses, owner);
    if (Object.hasOwn(step, 'poses')) ok = ok && same(step.cursor, poses[this.active!]) && constellationAgreement(publicPacket.frame_rows, this.model!, this.bodies, poses, step.cursor, this.active);
    if (step.acquisition_focus_projection != null) {
      const point = step.acquisition_focus_projection as Point, vector = this.motion.get(step.action.action_ref);
      ok = ok && vector !== undefined && same(point, constellationPlus(step.cursor, vector)); ok = ok && !constellationOutside(new PointSet([point]), this.model!).size
        && !this.bodies.some((body, i) => constellationBodyPixels(body, this.poses[i]!).has(point));
    }
    return { admitted: !!ok, reason: 'bind_control_focus_and_registered_composite' };
  }
  after(proposal: ConstellationRecord, index: number, before: ConstellationObservation, after: ConstellationObservation, _first: NativeRows, second: NativeRows): ConstellationRecord {
    if (!same([before.level_epoch, before.state, before.levels_completed], [after.level_epoch, after.state, after.levels_completed])) return { matched: null, seal_prefix: true, reason: 'official_boundary' };
    const predicted = proposal.steps[index].expected_after, matched = predicted ? constellationAgreement(second, this.model!, this.bodies, predicted, predicted[this.active!], this.active) : null;
    return { matched, seal_prefix: matched !== true || index + 1 === proposal.steps.length, reason: 'compare_frozen_joint_supports' };
  }
  async record(before: ConstellationObservation, after: ConstellationObservation, command: ConstellationCommand, first: NativeRows, second: NativeRows, proposal: ConstellationRecord, index: number): Promise<ConstellationRecord> {
    const ref = after.observation_ref, step = proposal.steps[index], mode = step.mode, key = command.action_ref;
    if (after.levels_completed > before.levels_completed) { this.passed.push({ score: after.levels_completed, ref }); return { status: 'official_boundary', ref }; }
    let old = constellationFocus(first, this.model!), next = constellationFocus(second, this.model!); const event: ConstellationRecord = { status: 'observed_response', ref, mode };
    if (old === null && step.poses?.length && constellationCursorAt(first, this.model!, step.cursor, this.bodies, step.poses, this.active)) old = step.cursor;
    if (next === null && step.expected_after && constellationCursorAt(second, this.model!, step.expected_after[this.active!], this.bodies, step.expected_after, this.active)) { next = step.expected_after[this.active!]; event.focus_retained_under_known_owner = true; }
    if (old === null || next === null) { this.retired = true; event.status = 'focus_ambiguous'; }
    else if (mode !== 'move' && constellationSelectionEffect(first, second, this.model!, old, next)[0]) {
      const [, added, removed] = constellationSelectionEffect(first, second, this.model!, old, next);
      this.model!.focus_occlusion.update(new PointSet([...added].map(point => constellationMinus(point, old!))).union(new PointSet([...removed].map(point => constellationMinus(point, next!)))));
      if (this.active !== null && constellationAgreement(first, this.model!, this.bodies, this.poses, old, this.active)) {
        const revealed: ConstellationRecord[] = [], unassigned: ConstellationRecord[] = [], refuted: ConstellationRecord[] = [];
        const exposed = new PointSet([...this.model!.focus_occlusion].map(point => constellationPlus(old!, point)))
          .difference(new PointSet([...this.model!.focus_occlusion].map(point => constellationPlus(next!, point)))).difference(this.model!.excluded);
        this.bodies.forEach((body, owner) => { const pose = this.poses[owner]!;
          for (const point of constellationBodyPixels(body, pose).intersection(exposed)) { const [x, y] = point;
            if (!constellationOutside(new PointSet([point]), this.model!).size && second[y]![x] === this.model!.background) {
              const offset = constellationMinus(point, pose); body.mask.delete(offset); refuted.push({ owner, relative_pixel: offset, palette_value: body.color }); }
          }
        });
        if (refuted.length) { event.refuted_support_pixels = refuted; event.before_ref = before.observation_ref; }
        for (const point of added.sorted()) {
          const color = second[point[1]]![point[0]]!;
          if (this.bodies.some((body, i) => body.color === color && constellationBodyPixels(body, this.poses[i]!).has(point))) continue;
          const owners = this.bodies.flatMap((body, j) => body.color === color && constellationWithinEnvelope(body, this.poses[j]!, point) ? [j] : []);
          if (owners.length === 1) { const owner = owners[0]!, offset = constellationMinus(point, this.poses[owner]!); this.bodies[owner]!.mask.add(offset); revealed.push({ owner, relative_pixel: offset, palette_value: color }); }
          else unassigned.push({ pixel: point, compatible_owners: owners });
        }
        if (revealed.length) { event.revealed_support_pixels = revealed; event.before_ref = before.observation_ref; } if (unassigned.length) event.unassigned_reveals = unassigned;
      }
      this.selector = key; this.refs.set(key, ref);
      if (this.active === null) { this.samples.push({ focus: old, material: constellationMaterial(second, this.model!) }); const learned = acquireConstellation(this.samples, this.model!); if (learned) { this.bodies.push(learned); this.poses.push(old); } }
      const owner = this.poses.findIndex(pose => same(pose, next));
      if (owner >= 0) {
        this.active = owner; this.complete = constellationAgreement(second, this.model!, this.bodies, this.poses);
        if (!this.complete) {
          event.status = 'unowned_material_remains'; const question = await v6Digest([this.poses, next, Object.fromEntries([...constellationMaterial(second, this.model!)].map(([color, points]) => [String(color), points.sorted()]))]);
          if (this.unownedSeen.has(question)) { this.retired = true; event.status = 'ownership_question_repeated_without_new_evidence'; } this.unownedSeen.add(question);
        }
      } else { this.active = null; this.samples = [{ focus: next, material: constellationMaterial(second, this.model!) }]; }
      event.selection_local_occlusion_observed = true;
    } else if (mode === 'cycle') { this.retired = true; event.status = 'selection_hypothesis_refuted'; }
    else if (mode === 'move') {
      if (this.after(proposal, index, before, after, first, second).matched) { this.poses = [...step.expected_after]; if (step.unobserved_support_pixels) this.boundaryObserved.add(this.active!); }
      else { this.retired = true; event.status = 'rigid_motion_refuted'; }
    } else {
      this.tried.add(keyOf([key, old])); const vector = constellationMinus(next, old);
      if ((vector[0] === 0) !== (vector[1] === 0)) { this.motion.set(key, vector); this.refs.set(key, ref); if (this.active === null) this.samples.push({ focus: next, material: constellationMaterial(second, this.model!) }); else this.poses[this.active] = next; event.measured_vector = vector; }
      else if (!same(old, next)) { this.retired = true; event.status = 'unclassified_focus_change'; }
    }
    Object.assign(event, { acquired_bodies: this.bodies.length, ownership_complete: this.complete });
    if (this.bodies.length > this.persistedBodies) {
      event.acquired_supports = this.bodies.flatMap((body, owner) => owner >= this.persistedBodies ? [{ owner, palette_value: body.color, relative_support_pixels: body.mask.sorted(),
        support_scope: 'Focus-interior pixels and measured boundary-band occlusions remain conditional until exposed.', evidence_refs: [...new Set([this.firstObservation!, ...this.refs.values(), ref])] }] : []); this.persistedBodies = this.bodies.length;
    }
    event.owner_poses = [...this.poses]; this.events.push(event); return event;
  }
}

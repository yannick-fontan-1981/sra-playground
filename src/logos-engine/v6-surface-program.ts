/** Complete native transfer of V6 common_surface_program.py at 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e. */
import { geometricComponents, projection, rowsDigest, v6Digest } from './v6-native-observer.ts';
import type { ObservedInputDomain } from './v6-native-observer.ts';
import type { NativePoint, NativePublicObservation, NativeRows } from './v6-native-types.ts';
export type SurfaceRecord = Record<string, any>;
export interface SurfaceCommand extends SurfaceRecord { action_ref: string; data?: Record<string, number> }
export interface SurfaceObservation extends SurfaceRecord { entities: readonly SurfaceRecord[]; level_epoch: number; levels_completed: number; observation_ref: string; frame_hash: string; state: string }
export type SurfaceState = readonly [pose: number, hue: number, grid: readonly number[]];
export type SurfaceStroke = readonly [pose: number, hue: number];
export type SurfaceMeaning = number | 'write';
export type SurfaceMotion = 'bounded_axis' | 'angular_attraction';
export type SurfaceModel = readonly [labels: readonly SurfaceMeaning[], motion: SurfaceMotion];
export const SURFACE_RAYS: readonly NativePoint[] = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const keyOf = (value: unknown): string => JSON.stringify(value);
const addressed = (action: SurfaceCommand): boolean => !!action.data && Object.keys(action.data).length > 0;
const modulo = (value: number, base: number): number => (value % base + base) % base;
function same(a: any, b: any): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, i) => same(value, b[i]));
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(key => Object.hasOwn(b, key) && same(a[key], b[key]));
}
function compare(a: readonly number[], b: readonly number[]): number { for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i]! - b[i]!; return a.length - b.length; }
function roundEven(value: number): number { const low = Math.floor(value), d = value - low; return d < 0.5 ? low : d > 0.5 ? low + 1 : low % 2 === 0 ? low : low + 1; }
function* permutations<T>(values: readonly T[]): Generator<T[]> { if (!values.length) { yield []; return; } for (let i = 0; i < values.length; i++) for (const suffix of permutations([...values.slice(0, i), ...values.slice(i + 1)])) yield [values[i]!, ...suffix]; }
const sortedModels = (models: readonly SurfaceModel[]): SurfaceModel[] => [...models].sort((a, b) => keyOf(a) < keyOf(b) ? -1 : keyOf(a) > keyOf(b) ? 1 : 0);

export function surfaceCrop(rows: NativeRows, box: readonly number[]): number[][] { return projection(rows, box); }
export function surfaceInside(point: NativePoint, box: readonly number[]): boolean { return box[0]! <= point[0] && point[0] <= box[2]! && box[1]! <= point[1] && point[1] <= box[3]!; }

export function measureSurfaceLayout(observation: SurfaceObservation, rows: NativeRows, inputs: readonly SurfaceCommand[]): SurfaceRecord | null {
  const groups = new Map<string, { value: number; box: number[] }[]>();
  for (const entity of observation.entities) {
    const [left, top, right, bottom] = entity.bbox, width = right - left + 1, height = bottom - top + 1;
    if (Math.min(width, height) < 3 || entity.area !== 2 * (width + height) - 4) continue;
    const cut = surfaceCrop(rows, entity.bbox), core = cut.slice(1, -1).flatMap(row => row.slice(1, -1));
    if (!core.length || !core.every(value => value === core[0])) continue;
    if (cut.every((row, y) => row.every((value, x) => x > 0 && x < width - 1 && y > 0 && y < height - 1 || value === entity.palette_value)) && core[0] !== entity.palette_value) {
      const key = keyOf([width, height, entity.palette_value]); if (!groups.has(key)) groups.set(key, []); groups.get(key)!.push({ value: core[0]!, box: [left + 1, top + 1, right - 1, bottom - 1] });
    }
  }
  const results: SurfaceRecord[] = [];
  for (const group of groups.values()) {
    const palette = new Map(group.map(item => [item.value, item.box]));
    if (palette.size < 2 || palette.size !== group.length || new Set(group.map(item => item.box[1])).size !== 1 && new Set(group.map(item => item.box[0])).size !== 1) continue;
    const domain = Object.fromEntries(group.map(({ value, box }) => [value, inputs.find(action => addressed(action) && surfaceInside([action.data!.x!, action.data!.y!], box)) ?? null]));
    if (!Object.values(domain).every(Boolean)) continue;
    const rectangles = new Map<string, number[][]>();
    for (const component of geometricComponents(rows.map(row => row.map(value => palette.has(value) ? 1 : 0)))) {
      if (component.color !== 1 || !component.rectangular) continue;
      const [left, top, right, bottom] = component.bbox, key = keyOf([right - left + 1, bottom - top + 1]);
      if (!rectangles.has(key)) rectangles.set(key, []); rectangles.get(key)!.push([...component.bbox]);
    }
    for (const [key, boxes] of rectangles) {
      const size = JSON.parse(key) as number[], reference = boxes.filter(box => new Set(surfaceCrop(rows, box).flat()).size > 1);
      const work = boxes.filter(box => new Set(surfaceCrop(rows, box).flat()).size === 1 && ![...palette.values()].some(value => same(value, box)));
      if (reference.length === 1 && work.length === 1 && Math.min(...size) > 1) {
        const result = { ref: reference[0], work: work[0], swatches: Object.fromEntries(palette), domain, palette: [...palette.keys()] };
        if (observeSurface(rows, result)) results.push(result);
      }
    }
  }
  return results.length === 1 ? results[0]! : null;
}

export function observeSurface(rows: NativeRows, scene: SurfaceRecord): SurfaceState | null {
  const [left, top, right, bottom] = scene.work as number[], palette = new Set<number>(scene.palette);
  const panelBottom = Math.max(scene.ref[3], ...Object.values(scene.swatches).map((box: any) => box[3]));
  if (!(panelBottom < top!)) return null;
  const candidates: { x: number; y: number; hue: number }[] = [], counts = new Map<number, number>();
  for (let y = panelBottom + 1; y < rows.length - 1; y++) for (let x = 0; x < rows[y]!.length; x++) {
    const hue = rows[y]![x]!;
    if (!palette.has(hue) || y >= top! && y <= bottom! && x >= left! && x <= right!) continue;
    candidates.push({ x, y, hue }); counts.set(hue, (counts.get(hue) ?? 0) + 1);
  }
  if (!candidates.length) return null;
  const max = Math.max(...counts.values()), hues = [...counts].filter(([, count]) => count === max).map(([hue]) => hue);
  if (hues.length !== 1) return null;
  const hue = hues[0]!, chosen = candidates.filter(point => point.hue === hue);
  const dx = 2 * (chosen.reduce((sum, point) => sum + point.x, 0) / chosen.length) - left! - right!;
  const dy = 2 * (chosen.reduce((sum, point) => sum + point.y, 0) / chosen.length) - top! - bottom!;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < Math.min(right! - left! + 1, bottom! - top! + 1)) return null;
  return [modulo(roundEven(Math.atan2(dy, dx) / (Math.PI / 4)), 8), hue, surfaceCrop(rows, scene.work).flat()];
}

export function surfaceAttachment(scene: SurfaceRecord, observation: SurfaceObservation, inputs: readonly SurfaceCommand[], state: SurfaceState): readonly [bigint[], SurfaceCommand, number[]] | null {
  const [pose, hue] = state, [left, top, right, bottom] = scene.work as number[];
  const cx = (left! + right!) / 2, cy = (top! + bottom!) / 2;
  if (pose % 2 || right! - left! !== bottom! - top!) return null;
  const parts: { entity: SurfaceRecord; distance: number }[] = [];
  for (const entity of observation.entities) {
    const [x, y, u, v] = entity.bbox, ex = (x + u) / 2, ey = (y + v) / 2;
    if (entity.palette_value !== hue || y <= scene.ref[3] || surfaceInside([ex, ey], scene.work)) continue;
    if (modulo(roundEven(Math.atan2(ey - cy, ex - cx) / (Math.PI / 4)), 8) !== pose) continue;
    parts.push({ entity, distance: (ex - cx) ** 2 + (ey - cy) ** 2 });
  }
  if (parts.length !== 2) return null;
  parts.sort((a, b) => a.distance - b.distance);
  const [main, tip] = parts;
  if (!(tip!.entity.area < main!.entity.area && tip!.distance > main!.distance)) return null;
  const entity = tip!.entity, [x, y, u, v] = entity.bbox, mask = new Set((entity.mask as NativePoint[]).map(keyOf));
  const command = inputs.find(action => addressed(action) && surfaceInside([action.data!.x!, action.data!.y!], entity.bbox)
    && mask.has(keyOf([action.data!.x! - x, action.data!.y! - y])));
  if (!command) return null;
  const width = right! - left! + 1, height = bottom! - top! + 1; let cells = new Map<string, NativePoint>();
  for (const [i, j] of entity.mask as NativePoint[]) {
    const point: NativePoint = pose === 6 ? [x + i - left!, j] : pose === 2 ? [x + i - left!, height - 1 - (v - y - j)]
      : pose === 0 ? [width - 1 - (u - x - i), y + j - top!] : [i, y + j - top!];
    if (!(point[0] >= 0 && point[0] < width && point[1] >= 0 && point[1] < height)) return null;
    cells.set(keyOf(point), point);
  }
  const oriented = Array<bigint>(8).fill(0n);
  for (let k = 0; k < 4; k++) {
    oriented[(pose + 2 * k) % 8] = [...cells.values()].reduce((sum, [i, j]) => sum + (1n << BigInt(j * width + i)), 0n);
    cells = new Map([...cells.values()].map(([i, j]) => { const point: NativePoint = [width - 1 - j, i]; return [keyOf(point), point]; }));
  }
  return [oriented, command, [...entity.bbox]];
}

export function advanceSurfacePose(pose: number, aim: number, motion: SurfaceMotion): number {
  if (motion === 'bounded_axis') { const p = SURFACE_RAYS[pose]!, a = SURFACE_RAYS[aim]!, value: NativePoint = [p[0] + a[0], p[1] + a[1]]; const found = SURFACE_RAYS.findIndex(ray => same(ray, value)); return found >= 0 ? found : pose; }
  const n = modulo(aim - pose, 8); return n === 0 || n === 4 ? pose : modulo(pose + (n < 4 ? 1 : -1), 8);
}
export function makeSurfaceMasks(width: number, height: number, inclusive: boolean): bigint[] {
  return SURFACE_RAYS.map(([dx, dy]) => { let result = 0n; for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const value = dx * (2 * x + 1 - width) * height + dy * (2 * y + 1 - height) * width;
    if (value > 0 || inclusive && value === 0) result += 1n << BigInt(y * width + x);
  } return result; });
}
export function paintSurface(grid: readonly number[], mask: bigint, hue: number): number[] { return grid.map((value, i) => (mask >> BigInt(i) & 1n) !== 0n ? hue : value); }

export function surfaceProgram(current: readonly number[], target: readonly number[], pose: number, hue: number, masks: readonly bigint[]): SurfaceStroke[] | null {
  const full = (1n << BigInt(current.length)) - 1n;
  let mismatch = 0n; for (let i = 0; i < Math.min(current.length, target.length); i++) if (current[i] !== target[i]) mismatch += 1n << BigInt(i);
  const colors = new Map<number, bigint>(); target.forEach((color, i) => colors.set(color, (colors.get(color) ?? 0n) + (1n << BigInt(i))));
  const found: SurfaceStroke[][] = []; let depth: number | null = null;
  const queue: { visible: bigint; path: SurfaceStroke[] }[] = [{ visible: full, path: [] }], best = new Map<bigint, number>();
  for (let head = 0; head < queue.length; head++) {
    const { visible, path } = queue[head]!; if (depth !== null && path.length > depth) break;
    if (!(mismatch & visible)) { depth = path.length; found.push(path); continue; }
    for (let p = 0; p < masks.length; p++) {
      const region = masks[p]! & visible; if (!region) continue;
      for (const [color, colored] of colors) {
        if (region & ~colored) continue;
        const remaining = visible & ~region, n = path.length + 1; if (n > (best.get(remaining) ?? n)) continue;
        best.set(remaining, n); queue.push({ visible: remaining, path: [[p, color], ...path] });
      }
    }
  }
  const cost = (path: readonly SurfaceStroke[]) => { let location = pose, ink = hue, k = 0; for (const [p, color] of path) { k += Math.min(modulo(p - location, 8), modulo(location - p, 8)) + Number(color !== ink) + 1; location = p % 8; ink = color; } return k; };
  return found.length ? found.sort((a, b) => cost(a) - cost(b) || compare(a.flat(), b.flat()))[0]! : null;
}

export class SurfaceProgram {
  readonly id = 'surface_program'; readonly familyId = 'surface_program';
  epoch: number | null = null; prior: { keys: string[]; models: SurfaceModel[] } | null = null; passed: SurfaceRecord[] = []; events: SurfaceRecord[] = []; evidence = new Map<string, string>();
  scene: SurfaceRecord | null | undefined; verified = new Set<string>(); discarded = false; keys: string[] | undefined; models: SurfaceModel[] | undefined; masks: bigint[][] | undefined;
  target: number[] | undefined; first: string | undefined;
  state(): SurfaceRecord {
    const result: SurfaceRecord = { format: 'native.surface_program.v1/decimal-masks', epoch: this.epoch, prior: this.prior ? { ...this.prior, models: sortedModels(this.prior.models) } : null,
      passed: this.passed, events: this.events, evidence: [...this.evidence] };
    if (this.scene !== undefined) Object.assign(result, { scene: this.scene, verified: [...this.verified].sort(), discarded: this.discarded });
    if (this.keys !== undefined) result.keys = this.keys;
    if (this.models !== undefined) result.models = sortedModels(this.models);
    if (this.masks !== undefined) result.masks = this.masks.map(masks => masks.map(String));
    if (this.target !== undefined) Object.assign(result, { target: this.target, first: this.first });
    return structuredClone(result);
  }
  restore(snapshot: SurfaceRecord): void {
    const value = structuredClone(snapshot);
    if (value.format !== 'native.surface_program.v1/decimal-masks' || !Array.isArray(value.events) || !Array.isArray(value.passed) || !Array.isArray(value.evidence)
      || value.masks !== undefined && (!Array.isArray(value.masks) || value.masks.some((masks: unknown) => !Array.isArray(masks) || masks.some(mask => typeof mask !== 'string' || !/^(0|[1-9][0-9]*)$/.test(mask))))) throw new TypeError('Incompatible surface-program state');
    this.epoch = value.epoch; this.prior = value.prior; this.passed = value.passed; this.events = value.events; this.evidence = new Map(value.evidence);
    this.scene = value.scene; this.verified = new Set(value.verified ?? []); this.discarded = value.discarded ?? false; this.keys = value.keys; this.models = value.models;
    this.masks = value.masks?.map((masks: string[]) => masks.map(BigInt)); this.target = value.target; this.first = value.first;
  }
  start(observation: SurfaceObservation, rows: NativeRows, inputs: readonly SurfaceCommand[]): void {
    this.epoch = observation.level_epoch; this.scene = measureSurfaceLayout(observation, rows, inputs); this.verified.clear(); this.discarded = false;
    if (this.scene === null) return;
    this.keys = inputs.filter(action => !addressed(action)).map(action => action.action_ref).sort();
    if (this.keys.length !== 5) { this.scene = null; return; }
    const all: SurfaceModel[] = []; for (const labels of permutations<SurfaceMeaning>([0, 2, 4, 6, 'write'])) for (const motion of ['bounded_axis', 'angular_attraction'] as const) all.push([labels, motion]);
    this.models = this.prior && same(this.prior.keys, this.keys) ? structuredClone(this.prior.models) : all;
    const reference = this.scene.ref, width = reference[2] - reference[0] + 1, height = reference[3] - reference[1] + 1;
    this.masks = [false, true].map(flag => makeSurfaceMasks(width, height, flag));
    const accessory = surfaceAttachment(this.scene, observation, inputs, observeSurface(rows, this.scene)!);
    if (accessory) this.masks = this.masks.map(masks => [...masks, ...accessory[0]]);
    this.target = surfaceCrop(rows, reference).flat(); this.first = observation.observation_ref;
  }
  predict(state: SurfaceState, meaning: SurfaceMeaning, masks: readonly bigint[], motion: SurfaceMotion): SurfaceState {
    const [pose, hue, grid] = state; return meaning === 'write' ? [pose, hue, paintSurface(grid, masks[pose]!, hue)] : [advanceSurfacePose(pose, meaning, motion), hue, grid];
  }
  options(state: SurfaceState, _remaining: number, accessory: ReturnType<typeof surfaceAttachment>): readonly [SurfaceCommand, SurfaceState | null, string, SurfaceStroke[]] | null {
    const [pose, hue, grid] = state, plans: { path: SurfaceStroke[]; index: number }[] = [];
    for (let i = 0; i < this.masks!.length; i++) { const path = surfaceProgram(grid, this.target!, pose, hue, this.masks![i]!); if (path?.length) plans.push({ path, index: i }); }
    if (!plans.length) return null;
    const nominal = (path: readonly SurfaceStroke[]) => { let location = pose, ink = hue, k = 0; for (const [q, color] of path) { k += Math.min(modulo(q - location, 8), modulo(location - q, 8)) + Number(color !== ink) + 1; location = q % 8; ink = color; } return k; };
    plans.sort((a, b) => nominal(a.path) - nominal(b.path) || compare(a.path.flat(), b.path.flat()));
    const { path, index: modelIndex } = plans[0]!, [index, color] = path[0]!, want = index % 8;
    if (color !== hue) return [this.scene!.domain[color], [pose, color, grid], 'swatch', path];
    if (index >= 8 && pose === want) return accessory ? [accessory[1], [pose, hue, paintSurface(grid, this.masks![modelIndex]![index]!, hue)], 'test_attached_footprint', path] : null;
    const score: { gain: number; variants: number; key: string; index: number }[] = [];
    for (let i = 0; i < this.keys!.length; i++) {
      const predictions = this.models!.map(([labels, motion]) => this.predict(state, labels[i]!, this.masks![modelIndex]!, motion));
      const gains = predictions.map((prediction, j) => {
        const meaning = this.models![j]![0][i]!; if (pose === want) return Number(meaning === 'write');
        if (meaning === 'write') return same(prediction[2], grid) ? 0 : -1;
        const distance = (x: number) => Math.min(modulo(want - x, 8), modulo(x - want, 8)); return distance(pose) - distance(prediction[0]);
      });
      score.push({ gain: -gains.reduce((sum, value) => sum + value, 0) / gains.length, variants: -new Set(predictions.map(keyOf)).size, key: this.keys![i]!, index: i });
    }
    score.sort((a, b) => a.gain - b.gain || a.variants - b.variants || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0) || a.index - b.index);
    const selected = score[0]!, possibilities = new Map<string, SurfaceState>();
    for (const [labels, motion] of this.models!) for (const masks of this.masks!) { const prediction = this.predict(state, labels[selected.index]!, masks, motion); possibilities.set(keyOf(prediction), prediction); }
    return [{ action_ref: selected.key }, possibilities.size === 1 ? [...possibilities.values()][0]! : null, 'labelled_input', path];
  }
  async propose(observation: SurfaceObservation, rows: NativeRows, inputs: readonly SurfaceCommand[], remaining: number): Promise<SurfaceRecord | null> {
    if (this.epoch !== observation.level_epoch) this.start(observation, rows, inputs);
    if (!this.scene || this.discarded || !this.models?.length || !this.masks?.length) return null;
    const initial = observeSurface(rows, this.scene); if (!initial || same(initial[2], this.target)) return null;
    let state = initial; const steps: SurfaceRecord[] = [], branches: SurfaceStroke[][] = [], accessory = surfaceAttachment(this.scene, observation, inputs, state);
    for (let count = 0; count < Math.min(remaining, 16); count++) {
      const result = this.options(state, remaining - steps.length, same(state.slice(0, 2), initial.slice(0, 2)) ? accessory : null);
      if (result === null) break;
      const [command, prediction, mode, path] = result; branches.push(path);
      const box = mode === 'test_attached_footprint' ? accessory![2] : mode === 'swatch' ? this.scene.swatches[prediction![1]] : null;
      steps.push({ action: command, state, expected_after: prediction, mode, address_box: box, address_digest: box ? await rowsDigest(surfaceCrop(rows, box)) : null,
        expected_before: { level_epoch: this.epoch, frame_hash: steps.length ? null : observation.frame_hash } });
      if (prediction === null || same(prediction, state) || mode === 'test_attached_footprint' || !this.verified.has(command.action_ref) || same(prediction[2], this.target)) break;
      state = prediction;
    }
    if (!steps.length) return null;
    const actions = steps.map(step => step.action), refs = [observation.observation_ref, this.first!, ...new Set(this.evidence.values())];
    const focus = `C_surface_${(await v6Digest([refs, actions])).slice(0, 16)}`;
    const plan = { fixed_reference: this.scene.ref, editable_candidate: this.scene.work, current_pose: initial[0], current_hue: initial[1],
      backward_program: branches[0], label_assignments_left: this.models.length, footprint_variants: this.masks.length,
      scope: 'Measured equal-size fields, hypothetical last writes and one-step angular controls. Official boundary validates only the outcome.' };
    const facts = { homologous_fields: true, palette_bindings: true, conditional_program: true }, why = 'Bind the next input to the observed carrier and a write that preserves exposed reference cells.';
    return { status: 'proposed', kind: 'surface_rewrite_program', surface_plan: plan, actions, steps, facts,
      compositions: [{ id: focus, role: 'information_question', observed: false, open_question: why, properties: plan, relations: ['contributes_to:G_official_completion'] }],
      question: { reason: why, hypothesis_refs: refs }, route_refs: refs, binding: { observation_ref: observation.observation_ref, level_epoch: this.epoch, levels_completed: observation.levels_completed },
      bundle_template: { operation_key: 'OP18', composition_ref: focus, objective_ref: 'G_official_completion', preserve_refs: [], purpose: why, preconditions: facts, evidence: refs, actions,
        outcome_guard: { path: ['value'], contains: focus } } };
  }
  bind(proposal: SurfaceRecord, domain: ObservedInputDomain): void {
    const frame = proposal.steps[0].expected_before.frame_hash;
    for (const step of proposal.steps) if (addressed(step.action)) { const data = step.action.data, binding = domain.bindings.get(`${this.epoch}:${frame}`)?.get(`${data.x},${data.y}`);
      if (!binding) throw new TypeError('Surface input has no current sampled witness'); step.point_binding = { ...binding, projection_bbox: [...step.address_box], projected_rows_digest: step.address_digest }; }
  }
  before(proposal: SurfaceRecord, index: number, publicPacket: NativePublicObservation, observation: SurfaceObservation): SurfaceRecord {
    const step = proposal.steps[index], bound = proposal.binding;
    const ok = publicPacket.level === bound.level_epoch && publicPacket.levels_completed === bound.levels_completed && publicPacket.available_action_refs.includes(step.action.action_ref)
      && (index > 0 || bound.observation_ref === observation.observation_ref) && same(observeSurface(publicPacket.frame_rows, this.scene!), step.state)
      && same(surfaceCrop(publicPacket.frame_rows, this.scene!.ref).flat(), this.target);
    return { admitted: ok, reason: 'bind_current_template_color_pose_and_surface' };
  }
  after(proposal: SurfaceRecord, index: number, before: SurfaceObservation, after: SurfaceObservation, _first: NativeRows, second: NativeRows): SurfaceRecord {
    if (!same([before.level_epoch, before.state, before.levels_completed], [after.level_epoch, after.state, after.levels_completed])) return { matched: null, seal_prefix: true, reason: 'official_boundary' };
    const prediction = proposal.steps[index].expected_after, matched = prediction ? same(observeSurface(second, this.scene!), prediction) : null;
    return { matched, seal_prefix: matched !== true || index + 1 === proposal.steps.length, reason: 'compare_pose_hue_and_surface' };
  }
  record(before: SurfaceObservation, after: SurfaceObservation, command: SurfaceCommand, _first: NativeRows, second: NativeRows, proposal: SurfaceRecord, index: number): SurfaceRecord {
    const old = proposal.steps[index].state as SurfaceState, key = command.action_ref, ref = after.observation_ref;
    const scored = after.levels_completed > before.levels_completed, next = scored ? null : observeSurface(second, this.scene!);
    if (this.keys!.includes(key)) {
      const ix = this.keys!.indexOf(key), compatible = new Set<string>(), footprintIndices = new Set<number>();
      for (const model of this.models!) for (let k = 0; k < this.masks!.length; k++) {
        const prediction = this.predict(old, model[0][ix]!, this.masks![k]!, model[1]);
        if (scored ? same(prediction[2], this.target) : same(prediction, next)) { compatible.add(keyOf(model)); footprintIndices.add(k); }
      }
      this.models = this.models!.filter(model => compatible.has(keyOf(model))); this.masks = this.masks!.filter((_, k) => footprintIndices.has(k));
      if (this.models.length) { this.verified.add(key); this.evidence.set(key, ref); }
    } else if (same(next, proposal.steps[index].expected_after)) { this.verified.add(key); this.evidence.set(key, ref); }
    else this.discarded = true;
    const event = { ref, input: key, compatible_labels: this.models!.length, compatible_footprints: this.masks!.length, status: scored ? 'official_boundary' : 'tested_surface_effect' };
    if (scored && this.models!.length) { this.prior = { keys: this.keys!, models: this.models! }; this.passed.push({ ref, score: after.levels_completed }); }
    this.events.push(event); return event;
  }
}

/**
 * Direct native owner for common_motif_access.py, pinned V6
 * 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e.
 * The optional cooperative search bound is a native extension. Its diagnostic
 * means incomplete search, never impossibility or an acquired effect law.
 */
import { compareUnicode } from './canonical.ts';
import { symbolicDigest as digest } from './v6-hash.ts';
import { geometricComponents, projection } from './v6-native-observer.ts';
import type { ObservedInputDomain } from './v6-native-observer.ts';
import { pythonEqual as equal } from './v6-operations.ts';
import type { NativeExecution, NativePublicObservation, NativeRows } from './v6-native-types.ts';
import {
  boundedMotifPathsCooperative, checkedMotifBounds, motifBody, motifLattice, motifPaths,
  motifRoute, motifRouteFromPaths, motifRowsDigest, motifTarget, motifTupleKey,
} from './v6-motif-access-geometry.ts';
import type {
  MotifBlocked, MotifBody, MotifBodyState, MotifBox, MotifGrid, MotifMotion, MotifPath,
  MotifPoint, MotifSearchBounds, MotifSearchResult,
} from './v6-motif-access-geometry.ts';
export { MOTIF_ACCESS_NATIVE_SEARCH_BOUNDS } from './v6-motif-access-geometry.ts';

type R = Record<string, any>;
export interface NativeMotifAccessOptions {
  /** Omit for direct Python search parity; production opts into explicit bounds. */
  readonly boundedSearch?: MotifSearchBounds;
}
const hasData = (command: R): boolean => Boolean(command.data && Object.keys(command.data).length);
const bodyState = (body: MotifBody): MotifBodyState => [[...body.position], body.size];
const tupleCompare = (a: any, b: any): number => {
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) { const result = tupleCompare(a[i], b[i]); if (result) return result; }
    return a.length - b.length;
  }
  return typeof a === 'number' && typeof b === 'number' ? a - b : compareUnicode(String(a), String(b));
};
const validRecord = (value: any): value is R => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const validPoint = (value: any): value is MotifPoint => Array.isArray(value) && value.length === 2 && value.every(Number.isSafeInteger);
const validPosition = (value: any): value is MotifPoint => validPoint(value) && value.every(n => n >= 0);
const validBody = (value: any): value is MotifBodyState => Array.isArray(value) && value.length === 2
  && validPosition(value[0]) && Number.isSafeInteger(value[1]) && value[1] >= 2 && value[1] % 2 === 0;
const validBox = (value: any): value is MotifBox => Array.isArray(value) && value.length === 4
  && value.every((n: any) => Number.isSafeInteger(n) && n >= 0) && value[0] <= value[2] && value[1] <= value[3];
const validColor = (value: any): value is number => Number.isSafeInteger(value) && value >= 0 && value <= 255;
const validMask = (value: any): value is number[] => Array.isArray(value)
  && value.every((n: any, i: number) => Number.isSafeInteger(n) && n >= 0 && (i === 0 || value[i - 1] < n));
const validDigest = (value: any): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const validMotion = (value: any): value is MotifMotion => validRecord(value)
  && Object.entries(value).every(([key, vector]) => key.length > 0 && validPoint(vector) && ((vector[0] === 0) !== (vector[1] === 0)));
const validRay = (value: any): boolean => validRecord(value) && validBox(value.receiver) && validDigest(value.receiver_digest)
  && validColor(value.color) && validPoint(value.direction) && value.direction.every(n => Math.abs(n) <= 1)
  && ((value.direction[0] === 0) !== (value.direction[1] === 0))
  && Array.isArray(value.sampled_trajectory) && value.sampled_trajectory.length >= 2
  && value.sampled_trajectory.every((item: any) => Array.isArray(item) && item.length === 2
    && Number.isSafeInteger(item[0]) && item[0] >= 0 && validPoint(item[1]))
  && new Set(value.sampled_trajectory.map((item: any) => motifTupleKey(item[1]))).size >= 2
  && Array.isArray(value.linked_blockers) && value.linked_blockers.length > 0 && value.linked_blockers.every(validBox)
  && validMask(value.card) && typeof value.evidence === 'string' && typeof value.aimed === 'boolean'
  && (value.aligned_test_ref === undefined || typeof value.aligned_test_ref === 'string');
function assertJson(value: any, active = new Set<object>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || Number.isSafeInteger(value)) return;
  if (!(Array.isArray(value) || validRecord(value)) || active.has(value)) throw new TypeError('Motif state must contain acyclic integer JSON values');
  active.add(value);
  for (const item of Object.values(value)) assertJson(item, active);
  active.delete(value);
}
function validGrid(value: any): value is MotifGrid {
  if (!validRecord(value) || !Number.isSafeInteger(value.n) || value.n < 2 || value.n * value.n > 65_536
    || !Number.isSafeInteger(value.size) || value.size < 2 || !Array.isArray(value.points)
    || value.points.length !== value.n * value.n || !value.points.every(validPosition)
    || !Array.isArray(value.commands) || value.commands.length !== value.points.length
    || !Array.isArray(value.base) || value.base.length !== value.points.length || !value.base.every(validColor)
    || !Array.isArray(value.cards) || !value.cards.length) return false;
  const pitch = value.points[1]![0] - value.points[0]![0];
  if (pitch <= 0 || !value.points.every((point: MotifPoint, index: number) =>
    point[0] === value.points[0][0] + index % value.n * pitch
    && point[1] === value.points[0][1] + Math.floor(index / value.n) * pitch)) return false;
  return value.commands.every((command: any, index: number) => validRecord(command) && typeof command.action_ref === 'string'
    && validRecord(command.data) && Number.isSafeInteger(command.data.x) && Number.isSafeInteger(command.data.y)
    && value.points[index][0] <= command.data.x && command.data.x < value.points[index][0] + value.size
    && value.points[index][1] <= command.data.y && command.data.y < value.points[index][1] + value.size)
    && value.cards.every((card: any) => validRecord(card) && validBox(card.box) && validMask(card.mask)
      && card.mask.length >= 2 && card.mask.every((index: number) => index < value.points.length));
}
function checkedState(snapshot: R): R {
  const value = structuredClone(snapshot); assertJson(value);
  if (!validRecord(value) || value.format !== 'native.motif_access.v1'
    || !(value.epoch === null || Number.isSafeInteger(value.epoch)) || !validMotion(value.motion)
    || !Array.isArray(value.learned) || !value.learned.every((item: any) => Array.isArray(item) && item.length === 2
      && validMask(item[0]) && validRecord(item[1]) && typeof item[1].ref === 'string' && typeof item[1].body_change === 'boolean')
    || new Set(value.learned.map((item: any) => motifTupleKey(item[0]))).size !== value.learned.length
    || !Array.isArray(value.passed) || !value.passed.every((item: any) => validRecord(item) && typeof item.ref === 'string' && Number.isSafeInteger(item.score))
    || !Array.isArray(value.events) || !value.events.every((event: any) => validRecord(event) && typeof event.ref === 'string'
      && ['public_response', 'grid_effect_refuted'].includes(event.status) && ['walk', 'calibrate', 'toggle', 'invoke'].includes(event.mode)
      && validBody(event.before) && (event.after === null || validBody(event.after))
      && (event.grid_cleared === undefined || typeof event.grid_cleared === 'boolean')
      && (event.remote_color_contact_hypothesis === undefined || validRay(event.remote_color_contact_hypothesis)))) {
    throw new TypeError('Incompatible motif-access retained state');
  }
  if (!Object.hasOwn(value, 'grid')) {
    if (value.epoch !== null || Object.keys(value).some(key => !['format', 'epoch', 'learned', 'motion', 'passed', 'events'].includes(key))) {
      throw new TypeError('Unstarted motif context has unexpected fields');
    }
    return value;
  }
  if (value.epoch === null || !(value.grid === null || validGrid(value.grid))
    || !Array.isArray(value.tried) || !value.tried.every((item: any) => Array.isArray(item) && item.length === 2 && validMask(item[0]) && validBody(item[1]))
    || !Array.isArray(value.seen) || !value.seen.every((item: any) => Array.isArray(item) && item.length === 2 && typeof item[0] === 'string' && validBody(item[1]))
    || !Array.isArray(value.verified) || value.verified.some((key: any) => typeof key !== 'string' || key !== 'toggle' && !Object.hasOwn(value.motion, key))
    || [value.tried, value.seen, value.verified].some(items => new Set(items.map(motifTupleKey)).size !== items.length)
    || !(value.selected === null || validMask(value.selected)) || typeof value.retired !== 'boolean'
    || !validRecord(value.refs) || Object.values(value.refs).some(ref => typeof ref !== 'string')
    || !(value.ink === null || validColor(value.ink)) || !(value.ray === null || validRay(value.ray))
    || !(value.facing === null || typeof value.facing === 'string' && Object.hasOwn(value.motion, value.facing))
    || !Array.isArray(value.blocked) || !value.blocked.every((item: any) => Array.isArray(item) && item.length === 2
      && Array.isArray(item[0]) && item[0].length === 3 && validPosition(item[0][0])
      && typeof item[0][1] === 'string' && Object.hasOwn(value.motion, item[0][1])
      && Number.isSafeInteger(item[0][2]) && item[0][2] >= 2 && item[0][2] % 2 === 0 && validDigest(item[1]))
    || new Set(value.blocked.map((item: any) => motifTupleKey(item[0]))).size !== value.blocked.length
    || !(value.tracked === null || validBody(value.tracked))
    || !(value.colors === null || Array.isArray(value.colors) && value.colors.length === 2 && value.colors.every(validColor) && value.colors[0] !== value.colors[1])
    || value.ui_top !== undefined && (!Number.isSafeInteger(value.ui_top) || value.ui_top < 0)
    || value.first !== undefined && typeof value.first !== 'string') throw new TypeError('Invalid motif-access epoch context');
  if (value.grid !== null && (value.ui_top !== Math.min(...value.grid.cards.map((card: any) => card.box[1]), ...value.grid.points.map((point: any) => point[1]))
    || typeof value.first !== 'string')) throw new TypeError('Invalid motif field boundary');
  if (value.grid === null && (value.colors !== null || value.tracked !== null)) throw new TypeError('Body without a motif field');
  const currentCard = (mask: number[]) => value.grid !== null && value.grid.cards.some((card: any) => equal(card.mask, mask));
  if (value.selected !== null && !currentCard(value.selected) || value.ray !== null && !currentCard(value.ray.card)) {
    throw new TypeError('Selected motif or ray card absent from the current measured field');
  }
  return value;
}

/** Original single-event record API; the common caller owns its explicit adapter. */
export class MotifAccess {
  readonly id = 'motif_access'; readonly familyId = 'motif_access';
  private readonly boundedSearch: MotifSearchBounds | null;
  private proposalRefusal: R | null = null;
  epoch: number | null = null; learned = new Map<string, R>(); motion: MotifMotion = {}; passed: R[] = []; events: R[] = [];
  grid: MotifGrid | null | undefined; tried = new Set<string>(); seen = new Set<string>(); verified = new Set<string>();
  selected: number[] | null = null; retired = false; refs: Record<string, string> = {};
  ink: number | null = null; ray: R | null = null; facing: string | null = null; blocked: MotifBlocked = new Map();
  tracked: MotifBodyState | null = null; colors: number[] | null = null; ui_top: number | undefined; first: string | undefined;

  constructor(options: NativeMotifAccessOptions = {}) {
    this.boundedSearch = options.boundedSearch === undefined ? null : checkedMotifBounds(options.boundedSearch);
  }
  state(): R {
    const value: R = { format: 'native.motif_access.v1', epoch: this.epoch,
      learned: [...this.learned].map(([key, item]) => [JSON.parse(key), item]), motion: this.motion, passed: this.passed, events: this.events };
    if (this.grid !== undefined) Object.assign(value, {
      grid: this.grid, tried: [...this.tried].map(key => JSON.parse(key)).sort(tupleCompare),
      seen: [...this.seen].map(key => JSON.parse(key)).sort(tupleCompare), verified: [...this.verified].sort(compareUnicode),
      selected: this.selected, retired: this.retired, refs: this.refs, ink: this.ink, ray: this.ray, facing: this.facing,
      blocked: [...this.blocked].map(([key, item]) => [JSON.parse(key), item]), tracked: this.tracked, colors: this.colors,
      ...(this.ui_top === undefined ? {} : { ui_top: this.ui_top }), ...(this.first === undefined ? {} : { first: this.first }),
    });
    return structuredClone(value);
  }
  /** Validate the entire detached snapshot before replacing any owner field. */
  restore(snapshot: R): void {
    const value = checkedState(snapshot);
    this.epoch = value.epoch; this.learned = new Map(value.learned.map((item: any) => [motifTupleKey(item[0]), item[1]]));
    this.motion = value.motion; this.passed = value.passed; this.events = value.events; this.grid = value.grid;
    this.tried = new Set((value.tried ?? []).map(motifTupleKey)); this.seen = new Set((value.seen ?? []).map(motifTupleKey));
    this.verified = new Set(value.verified ?? []); this.selected = value.selected ?? null; this.retired = value.retired ?? false;
    this.refs = value.refs ?? {}; this.ink = value.ink ?? null; this.ray = value.ray ?? null; this.facing = value.facing ?? null;
    this.blocked = new Map((value.blocked ?? []).map((item: any) => [motifTupleKey(item[0]), item[1]]));
    this.tracked = value.tracked ?? null; this.colors = value.colors ?? null; this.ui_top = value.ui_top; this.first = value.first;
    this.proposalRefusal = null;
  }
  clearTransient(): void { this.proposalRefusal = null; }
  start(o: R, rows: NativeRows, inputs: readonly R[]): void {
    this.proposalRefusal = null; this.epoch = o.level_epoch; this.grid = motifLattice(o, rows, inputs);
    this.tried.clear(); this.seen.clear(); this.verified.clear(); this.selected = null; this.retired = false; this.refs = {};
    this.ink = null; this.ray = null; this.facing = null; this.blocked.clear(); this.tracked = null;
    if (this.grid) {
      this.ui_top = Math.min(...this.grid.cards.map(card => card.box[1]), ...this.grid.points.map(point => point[1]));
      const body = motifBody(rows, this.ui_top); this.colors = body ? [...body.colors] : null; this.first = o.observation_ref;
      if (body) this.tracked = bodyState(body);
    } else this.colors = null;
  }
  bits(rows: NativeRows): boolean[] {
    const grid = this.grid!;
    return grid.points.map(([x, y], index) => this.ink !== null ? rows[y]![x] === this.ink : rows[y]![x] !== grid.base[index]);
  }
  aligned(position: MotifPoint, size: number, key: string | null, receiver: MotifBox): boolean {
    if (key === null || !Object.hasOwn(this.motion, key)) return false;
    const [dx, dy] = this.motion[key]!, x = 2 * position[0] + size - 1, y = 2 * position[1] + size - 1;
    const rx = receiver[0] + receiver[2], ry = receiver[1] + receiver[3];
    return dy === 0 && y === ry && (rx - x) * dx > 0 || dx === 0 && x === rx && (ry - y) * dy > 0;
  }
  private aimFromPaths(body: MotifBody, goal: MotifBox | null, known: readonly MotifPath[]): string[] | null {
    const ray = this.ray!;
    if (!ray.aimed) {
      if (this.aligned(body.position, body.size, this.facing, ray.receiver)) { this.selected = [...ray.card]; return []; }
      let found: string[] | null = null;
      for (const item of known) if (this.aligned(item.position, body.size, item.last, ray.receiver)
        && (found === null || item.path.length < found.length)) found = item.path;
      return found === null ? null : [...found];
    }
    if (goal) {
      const distance = (point: MotifPoint) => Math.abs(2 * point[0] + body.size - 1 - goal[0] - goal[2])
        + Math.abs(2 * point[1] + body.size - 1 - goal[1] - goal[3]);
      const near = known.filter(item => distance(item.position) < distance(body.position))
        .map(item => [distance(item.position), item.path.length, item.path] as [number, number, string[]]).sort(tupleCompare);
      if (near.length) return [...near[0]![2]];
    }
    return null;
  }
  aim_path(rows: NativeRows, body: MotifBody, goal: MotifBox | null): string[] | null {
    if (!this.ray || motifRowsDigest(projection(rows, this.ray.receiver)) !== this.ray.receiver_digest) return null;
    return this.aimFromPaths(body, goal, motifPaths(rows, body, this.motion, this.ui_top!, this.blocked));
  }
  infer_ray(first: NativeRows, second: NativeRows, old: MotifBodyState, frames: readonly NativeRows[]): R | null {
    const before = geometricComponents(first).filter(part => part.bbox[3] < this.ui_top!);
    const origin: MotifPoint = [2 * old[0][0] + old[1] - 1, 2 * old[0][1] + old[1] - 1];
    const observations = new Map<string, { color: number; box: MotifBox; direction: MotifPoint; positions: [number, MotifPoint][] }>();
    for (const [index, frame] of frames.entries()) {
      const after = geometricComponents(frame).filter(part => part.bbox[3] < this.ui_top!);
      for (const part of after) {
        if (part.area <= 1 || this.colors!.includes(part.color) || part.bbox[0] > second[0]!.length * 0.9) continue;
        const stable = before.filter(item => item.color === part.color);
        if (stable.length !== 1) continue;
        const receiver = stable[0]!;
        if (!after.some(item => equal(item.bbox, receiver.bbox) && item.color === receiver.color) || equal(part.bbox, receiver.bbox)) continue;
        const box = part.bbox, center: MotifPoint = [box[0] + box[2], box[1] + box[3]];
        if (Number(center[0] !== origin[0]) + Number(center[1] !== origin[1]) !== 1) continue;
        const direction: MotifPoint = [Math.sign(center[0] - origin[0]), Math.sign(center[1] - origin[1])];
        const key = motifTupleKey([part.color, receiver.bbox, direction]);
        const observation = observations.get(key) ?? { color: part.color, box: [...receiver.bbox], direction, positions: [] };
        observation.positions.push([index, center]); observations.set(key, observation);
      }
    }
    const options: R[] = [];
    for (const { color, box, direction, positions } of observations.values()) {
      if (new Set(positions.map(([, point]) => motifTupleKey(point))).size < 2) continue;
      const pixels = projection(first, box), inner = new Set(pixels.flat()); inner.delete(color);
      const linked: MotifBox[] = [];
      for (const part of before) {
        if (!inner.has(part.color)) continue;
        const [l, t, r, b] = part.bbox;
        for (const key of this.blocked.keys()) {
          const [point, action, size] = JSON.parse(key) as [MotifPoint, string, number], [dx, dy] = this.motion[action]!;
          const x = point[0] + dx, y = point[1] + dy;
          if (Math.max(l, x) <= Math.min(r, x + size - 1) && Math.max(t, y) <= Math.min(b, y + size - 1)) linked.push([...part.bbox]);
        }
      }
      if (linked.length) options.push({ receiver: [...box], receiver_digest: motifRowsDigest(pixels), color,
        sampled_trajectory: positions, direction, linked_blockers: linked });
    }
    return options.length === 1 ? options[0]! : null;
  }
  context(rows: NativeRows, expected: MotifBodyState | null = null): MotifBodyState | null {
    const body = motifBody(rows, this.ui_top!, this.colors, expected);
    return body ? bodyState(body) : null;
  }
  currentProposalRefusal(o: R): R | null {
    const refusal = this.proposalRefusal;
    if (!refusal || ['observation_ref', 'level_epoch', 'frame_hash', 'revision', 'levels_completed'].some(key => refusal[key] !== o[key])
      || refusal.owner_state_ref !== `motif_owner:${digest(this.state())}`) return null;
    return structuredClone(refusal);
  }
  propose(o: R, rows: NativeRows, inputs: readonly R[], remaining: number, execution?: NativeExecution): R | null | Promise<R | null> {
    this.proposalRefusal = null;
    if (this.boundedSearch && execution?.signal?.aborted) return Promise.reject(new DOMException('Motif search aborted', 'AbortError'));
    if (o.level_epoch !== this.epoch) this.start(o, rows, inputs);
    if (!this.grid || !this.colors || this.retired) return null;
    const body = motifBody(rows, this.ui_top!, this.colors, this.tracked);
    if (!body) return null;
    const goal = motifTarget(rows, this.ui_top!, this.colors);
    if (this.boundedSearch) return this.proposeBounded(o, rows, inputs, remaining, body, goal, execution);
    let path = motifRoute(rows, body, goal, this.motion, this.ui_top!, this.blocked);
    if (!path?.length && this.ray) path = this.aim_path(rows, body, goal);
    return this.packageProposal(o, rows, inputs, remaining, body, goal, path);
  }
  private async proposeBounded(o: R, rows: NativeRows, inputs: readonly R[], remaining: number, body: MotifBody,
    goal: MotifBox | null, execution?: NativeExecution): Promise<R | null> {
    const ownerStateRef = `motif_owner:${digest(this.state())}`;
    const routeSearch = Boolean(goal && Object.keys(this.motion).length), rayCurrent = Boolean(this.ray
      && motifRowsDigest(projection(rows, this.ray.receiver)) === this.ray.receiver_digest);
    let result: MotifSearchResult | null = null;
    if (execution?.signal?.aborted) throw new DOMException('Motif search aborted', 'AbortError');
    if (execution?.deadlineMs !== undefined && (execution.now ?? performance.now.bind(performance))() >= execution.deadlineMs) {
      result = { status: 'resource_bound', paths: null, bound: 'deadline', bounds: this.boundedSearch,
        counters: { retainedStates: 0, frontierEntries: 0, peakFrontierEntries: 0, insertedEntries: 0,
          poppedEntries: 0, expandedStates: 0, generatedTransitions: 0 }, blockedInsertion: null };
    } else if (routeSearch || rayCurrent) {
      result = await boundedMotifPathsCooperative(rows, body, this.motion, this.ui_top!, this.blocked, this.boundedSearch!, execution);
    }
    if (ownerStateRef !== `motif_owner:${digest(this.state())}`) throw new Error('Motif memory changed during cooperative search');
    if (result?.status === 'resource_bound') {
      this.proposalRefusal = {
        schema: 'logos-engine.native.bounded-search-refusal.v1', rule: 'native.bounded_motif_search',
        provider: this.familyId, observation_ref: o.observation_ref, level_epoch: o.level_epoch, frame_hash: o.frame_hash,
        ...(o.revision === undefined ? {} : { revision: o.revision }), levels_completed: o.levels_completed,
        owner_state_ref: ownerStateRef, body: bodyState(body), goal, bounds: result.bounds, counters: result.counters,
        reached_bound: result.bound, blocked_insertion: result.blockedInsertion,
        search_phase: routeSearch ? 'goal' : rayCurrent ? 'ray' : 'proposal', searches_started: result.counters.insertedEntries ? 1 : 0,
        status: 'unknown', search_status: 'resource_bound', release_authority: false,
        scope: 'The current supported-pose search is incomplete. No impossibility, physical effect or partial continuation was established.',
      };
      return null;
    }
    let path = routeSearch ? motifRouteFromPaths(result!.paths!, body.size, goal!) : null;
    // The complete enumeration is pure and identical for route and ray. Reuse
    // its original order; an incomplete enumeration never reaches this fallback.
    if (!path?.length && rayCurrent) path = this.aimFromPaths(body, goal, result!.paths!);
    return this.packageProposal(o, rows, inputs, remaining, body, goal, path);
  }
  private packageProposal(o: R, rows: NativeRows, inputs: readonly R[], remaining: number, body: MotifBody,
    goal: MotifBox | null, path: string[] | null): R | null {
    const grid = this.grid!, actual = this.bits(rows), refs = [o.observation_ref, this.first, ...Object.values(this.refs)];
    let state = bodyState(body); const steps: R[] = [];
    if (path?.length) {
      for (const key of path.slice(0, Math.min(remaining, 16))) {
        const delta = this.motion[key]!, pred: MotifBodyState = [[state[0][0] + delta[0], state[0][1] + delta[1]], state[1]];
        steps.push({ action: { action_ref: key }, mode: 'walk', body: state, bits: actual, expected_after: pred });
        state = pred; if (!this.verified.has(key)) break;
      }
    } else {
      const unresolved = inputs.filter(action => !hasData(action) && !this.seen.has(motifTupleKey([action.action_ref, state]))
        && !Object.hasOwn(this.motion, action.action_ref)).map(action => action.action_ref as string).sort(compareUnicode);
      if (unresolved.length) steps.push({ action: { action_ref: unresolved[0] }, mode: 'calibrate', body: state, bits: actual, expected_after: null });
      else {
        const candidates = grid.cards.filter(card => !this.tried.has(motifTupleKey([card.mask, state])));
        if (this.selected === null) {
          if (!candidates.length) return null;
          candidates.sort((a, b) => Number(this.learned.has(motifTupleKey(a.mask))) - Number(this.learned.has(motifTupleKey(b.mask)))
            || a.mask.length - b.mask.length || tupleCompare(a.mask, b.mask));
          this.selected = [...candidates[0]!.mask];
        }
        const desired = actual.map((_, index) => this.selected!.includes(index)), changes = actual.map((value, index) => value !== desired[index] ? index : -1).filter(index => index >= 0);
        if (!changes.length) return null;
        let current = actual;
        for (const cell of changes.slice(0, Math.min(16, remaining))) {
          const command = grid.commands[cell]!;
          if (!inputs.some(input => equal(input, command))) return null;
          const next = current.map((bit, index) => index === cell ? !bit : bit), last = equal(next, desired);
          const [x, y] = grid.points[cell]!, size = grid.size, box: MotifBox = [x, y, x + size - 1, y + size - 1];
          steps.push({ action: command, mode: last ? 'invoke' : 'toggle', body: state, bits: current, card: this.selected,
            expected_after: last ? null : next, address_box: box, point_digest: motifRowsDigest(projection(rows, box)) });
          if (last || !this.verified.has('toggle')) break;
          current = next;
        }
      }
    }
    if (!steps.length) return null;
    steps.forEach((step, index) => { step.expected_before = { level_epoch: this.epoch, frame_hash: index === 0 ? o.frame_hash : null }; });
    const actions = steps.map(step => step.action), focus = 'C_motif_' + digest([refs, actions]).slice(0, 16);
    const why = 'Use an observed command motif to test a change in an inaccessible body or terrain, then recheck access to the homologous framed object.';
    const plan = { actor_colors: this.colors, actor: body.box, homologous_goal: goal, measured_translations: { ...this.motion },
      cards: grid.cards.map(card => card.mask), selected: this.selected, ui_lattice_size: grid.n,
      scope: 'Pattern activation, framed-goal role and rectangular-footprint access are provisional observed hypotheses.' };
    const facts = { observed_regular_input_field: true, measured_card_instances: true, composite_body_observed: true };
    return structuredClone({ status: 'proposed', kind: 'motif_to_geometric_access', motif_plan: plan, actions, steps, facts,
      compositions: [{ id: focus, role: 'information_question', observed: false, open_question: why, properties: plan, relations: ['contributes_to:G_official_completion'] }],
      question: { reason: why, hypothesis_refs: refs }, route_refs: refs,
      binding: { observation_ref: o.observation_ref, level_epoch: this.epoch, levels_completed: o.levels_completed },
      bundle_template: { operation_key: 'OP18', composition_ref: focus, objective_ref: 'G_official_completion', preserve_refs: [],
        purpose: why, preconditions: facts, evidence: refs, actions, outcome_guard: { path: ['value'], contains: focus } } });
  }
  bind(p: R, domain: ObservedInputDomain): void {
    const frame = p.steps[0].expected_before.frame_hash;
    for (const step of p.steps as R[]) if (hasData(step.action)) {
      const point = step.action.data, binding = domain.bindings.get(`${this.epoch}:${frame}`)?.get(`${point.x},${point.y}`);
      if (!binding) throw new TypeError('Motif point absent from the current observed input domain');
      step.point_binding = { ...structuredClone(binding), projection_bbox: [...step.address_box], projected_rows_digest: step.point_digest };
    }
  }
  before(p: R, index: number, publicPacket: NativePublicObservation, o: R): R {
    const step = p.steps[index], binding = p.binding;
    const ok = publicPacket.level === binding.level_epoch && publicPacket.levels_completed === binding.levels_completed
      && publicPacket.available_action_refs.includes(step.action.action_ref) && (index !== 0 || o.observation_ref === binding.observation_ref)
      && equal(this.context(publicPacket.frame_rows, step.body), step.body) && equal(this.bits(publicPacket.frame_rows), step.bits);
    return { admitted: Boolean(ok), reason: 'revalidate_actor_input_pattern_and_epoch' };
  }
  after(p: R, index: number, before: R, after: R, _first: NativeRows, second: NativeRows): R {
    if (!equal([before.level_epoch, before.state, before.levels_completed], [after.level_epoch, after.state, after.levels_completed])) {
      return { matched: null, seal_prefix: true, reason: 'official_boundary' };
    }
    const step = p.steps[index], prediction = step.expected_after;
    const matched = prediction !== null ? equal(step.mode === 'toggle' ? this.bits(second) : this.context(second, prediction), prediction) : null;
    return { matched, seal_prefix: matched !== true || index + 1 === p.steps.length, reason: 'compare_predicted_bit_or_body_effect' };
  }
  record(before: R, after: R, command: R, first: NativeRows, second: NativeRows, p: R, index: number, frames: readonly NativeRows[] = []): R {
    this.proposalRefusal = null;
    const step = p.steps[index], ref = after.observation_ref as string, mode = step.mode, old = step.body as MotifBodyState, key = command.action_ref as string;
    const next = this.context(second, mode === 'walk' ? step.expected_after : old);
    if (after.levels_completed > before.levels_completed) { this.passed.push({ ref, score: after.levels_completed }); return { status: 'official_boundary', ref }; }
    const event: R = { status: 'public_response', ref, mode, before: structuredClone(old), after: next };
    if (mode === 'walk' || mode === 'calibrate') {
      this.seen.add(motifTupleKey([key, old]));
      if (next && next[1] === old[1] && !equal(next[0], old[0])) {
        const dx = next[0][0] - old[0][0], dy = next[0][1] - old[0][1];
        if ((dx === 0) !== (dy === 0)) { this.motion[key] = [dx, dy]; this.verified.add(key); this.refs[key] = ref; }
      } else if (mode === 'walk' && Object.hasOwn(this.motion, key)) {
        const delta = this.motion[key]!, x = old[0][0] + delta[0], y = old[0][1] + delta[1];
        this.blocked.set(motifTupleKey([old[0], key, old[1]]), motifRowsDigest(projection(first, [x, y, x + old[1] - 1, y + old[1] - 1])));
      }
      if (Object.hasOwn(this.motion, key)) this.facing = key;
    } else if (mode === 'toggle') {
      const bits = step.expected_after as boolean[], setCells = this.grid!.points.filter((_, i) => bits[i]).map(([x, y]) => second[y]![x]!);
      if (setCells.length && new Set(setCells).size === 1) this.ink = setCells[0]!;
      if (equal(this.bits(second), step.expected_after)) { this.verified.add('toggle'); this.refs.toggle = ref; }
      else { this.retired = true; event.status = 'grid_effect_refuted'; }
    } else if (mode === 'invoke') {
      this.tried.add(motifTupleKey([step.card, old])); this.learned.set(motifTupleKey(step.card), { ref, body_change: !equal(next, old) });
      this.selected = null; this.verified.clear(); this.refs.invoke = ref; event.grid_cleared = !this.bits(second).some(Boolean);
      if (this.ray && this.aligned(old[0], old[1], this.facing, this.ray.receiver)) this.ray = { ...this.ray, aimed: true, aligned_test_ref: ref };
      const witness = this.infer_ray(first, second, old, frames);
      if (witness) {
        const aimed = this.aligned(old[0], old[1], this.facing, witness.receiver);
        this.ray = { ...witness, card: structuredClone(step.card), evidence: ref, aimed };
        event.remote_color_contact_hypothesis = this.ray;
      }
    }
    if (next) this.tracked = structuredClone(next);
    this.events.push(structuredClone(event)); return event;
  }
}

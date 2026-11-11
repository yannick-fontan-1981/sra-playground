/** Consumed V5 anchored transform and residual-partition calculation. This
 * proves a finite geometric partition only, never transport or game success. */
import { compareUnicode } from './canonical.ts';
import { pythonEqual } from './v6-operations.ts';
import { comparePoints, pointKey } from './v6-point-set.ts';
import type { NativeExecution, NativeRecord } from './v6-native-types.ts';
import { previewPackingNormalized } from './v6-preview-packing-geometry.ts';
import type { PreviewPackingAssignedPose as AssignedPose, PreviewPackingAssignments as Assignments,
  PreviewPackingCell as Cell, PreviewPackingMask, PreviewPackingModel, PreviewPackingScene,
  PreviewPackingTransform as Transform } from './v6-preview-packing-types.ts';

export interface PreviewPackingLimits {
  domainBound: number; depthBound: number; nodeBound: number; timeBoundMs: number; transportStates: number;
}
export const PREVIEW_PACKING_LIMITS: Readonly<PreviewPackingLimits> = Object.freeze({
  domainBound: 4096, depthBound: 32, nodeBound: 100000, timeBoundMs: 2000, transportStates: 20000,
});
/** Tests may tighten a bound. No caller can silently enlarge the source caps. */
export function previewPackingLimits(value: Partial<PreviewPackingLimits> = {}): PreviewPackingLimits {
  const result = { ...PREVIEW_PACKING_LIMITS };
  for (const name of Object.keys(value) as (keyof PreviewPackingLimits)[]) {
    const n = value[name];
    if (!(name in PREVIEW_PACKING_LIMITS) || !Number.isSafeInteger(n) || n! < 0 || n! > PREVIEW_PACKING_LIMITS[name]) throw new TypeError('Invalid or enlarged PreviewPacking bound');
    result[name] = n!;
  }
  return result;
}
export class PreviewPackingIncomplete extends Error {
  readonly cause: string; readonly examined: number; readonly work: number; readonly frontier: NativeRecord;
  constructor(cause: string, examined: number, work: number, frontier: NativeRecord = {}) {
    super('PreviewPacking calculation incomplete: ' + cause); this.name = 'PreviewPackingIncomplete';
    this.cause = cause; this.examined = examined; this.work = work; this.frontier = structuredClone(frontier);
  }
}

/** Source visits keep their exact node count. Native work checkpoints merely
 * allow cancellation/deadlines and yield every 256 units; they grant no action. */
export class PreviewPackingWork {
  examined = 0; work = 0;
  readonly limits: Readonly<PreviewPackingLimits>;
  readonly execution?: NativeExecution;
  private sourceStarted: number | null = null;
  private lastYieldWork = 0;
  constructor(execution?: NativeExecution, limits: Partial<PreviewPackingLimits> = {}) {
    this.execution = execution; this.limits = Object.freeze(previewPackingLimits(limits));
    if (execution?.deadlineMs !== undefined && !Number.isFinite(execution.deadlineMs)) throw new TypeError('Invalid PreviewPacking deadline');
    this.check();
  }
  private now(): number { return (this.execution?.now ?? (() => performance.now()))(); }
  stop(cause: string, frontier: NativeRecord = {}): never { throw new PreviewPackingIncomplete(cause, this.examined, this.work, frontier); }
  check(frontier: NativeRecord = {}): void {
    if (this.execution?.signal?.aborted) this.stop('aborted', frontier);
    if (this.execution?.deadlineMs !== undefined && this.now() >= this.execution.deadlineMs) this.stop('deadline', frontier);
  }
  beginSource(): void { this.sourceStarted = this.now(); }
  visit(frontier: NativeRecord = {}): void {
    this.check(frontier);
    if (this.examined >= this.limits.nodeBound) this.stop('NODE_BOUND', frontier);
    if (this.sourceStarted !== null && this.now() - this.sourceStarted >= this.limits.timeBoundMs) this.stop('TIME_BOUND', frontier);
    this.examined++; this.tick();
  }
  tick(): void { this.work++; if (this.work % 256 === 0) this.check(); }
  async checkpoint(force = false): Promise<void> {
    this.check();
    if (force || this.work - this.lastYieldWork >= 256) {
      this.lastYieldWork = this.work;
      if (this.execution) await this.execution.yieldControl();
      this.check();
    }
  }
}

export function previewPackingTransform(mask: PreviewPackingMask, kind: Transform): Cell[] {
  let points: Cell[];
  if (kind === 'rotate_cw') points = mask.map(([row, column]) => [column, -row]);
  else if (kind === 'rotate_ccw') points = mask.map(([row, column]) => [-column, row]);
  else if (kind === 'reflect_rows') points = mask.map(([row, column]) => [-row, column]);
  else if (kind === 'reflect_columns') points = mask.map(([row, column]) => [row, -column]);
  else throw new TypeError('SUPPORTED_ANCHORED_TRANSFORM_MISSING');
  return previewPackingNormalized(points)[0];
}
function compareMasks(a: PreviewPackingMask, b: PreviewPackingMask): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) { const c = comparePoints(a[i]!, b[i]!); if (c) return c; }
  return a.length - b.length;
}
function support(pose: AssignedPose): Set<string> {
  return new Set(pose.mask.map(([row, column]) => pointKey([pose.anchor[0] + row, pose.anchor[1] + column])));
}
const subset = (a: ReadonlySet<string>, b: ReadonlySet<string>): boolean => a.size <= b.size && [...a].every(p => b.has(p));
const clonePose = (pose: AssignedPose): AssignedPose => ({ piece_ref: pose.piece_ref, anchor: [...pose.anchor] as Cell,
  mask: pose.mask.map(p => [...p] as Cell) });
interface Piece { piece_ref: string; full_mask: Cell[]; movable: boolean }
interface Model { pieces: Piece[]; world: Cell[]; board: Cell[] }

function domains(model: Model, work: PreviewPackingWork): { world: Set<string>; board: Set<string>; pieces: Map<string, Piece> } {
  const world = new Set(model.world.map(pointKey)), board = new Set(model.board.map(pointKey));
  if (world.size !== model.world.length || board.size !== model.board.length || !subset(board, world)) work.stop('UNIQUE_BOARD_INSIDE_CURRENT_WORLD_REQUIRED');
  if (world.size > work.limits.domainBound) work.stop('WORLD_DOMAIN_BOUND');
  const pieces = new Map<string, Piece>();
  for (const piece of model.pieces) {
    work.visit({ piece_ref: piece.piece_ref });
    if (pieces.has(piece.piece_ref) || new Set(piece.full_mask.map(pointKey)).size !== piece.full_mask.length) work.stop('FULL_OCCURRENCE_IDENTITIES_AND_MASKS_NOT_VALID');
    pieces.set(piece.piece_ref, piece);
  }
  return { world, board, pieces };
}
function shapeOrbit(piece: Piece, work: PreviewPackingWork): Set<string> {
  let orbit = new Map([[JSON.stringify(previewPackingNormalized(piece.full_mask)[0]), previewPackingNormalized(piece.full_mask)[0]]]);
  for (let step = 0; step < 8; step++) {
    const expanded = new Map(orbit);
    for (const mask of [...orbit.values()].sort(compareMasks)) {
      work.visit({ orientation_piece_ref: piece.piece_ref, transform_ref: 'rotate_cw' });
      const transformed = previewPackingTransform(mask, 'rotate_cw'); expanded.set(JSON.stringify(transformed), transformed);
    }
    if (expanded.size === orbit.size) return new Set(orbit.keys());
    orbit = expanded;
  }
  return work.stop('FINITE_ORIENTATION_GROUP_NOT_CLOSED');
}
function validPose(pose: AssignedPose, world: Set<string>, pieces: Map<string, Piece>, work: PreviewPackingWork): Set<string> {
  work.visit({ pose_piece_ref: pose.piece_ref });
  const piece = pieces.get(pose.piece_ref);
  if (!piece || new Set(pose.mask.map(pointKey)).size !== pose.mask.length || !pythonEqual(pose.mask, previewPackingNormalized(pose.mask)[0])) work.stop('NORMALIZED_FULL_POSE_IDENTITY_MISSING');
  if (!pythonEqual(pose.mask, previewPackingNormalized(piece.full_mask)[0]) && !shapeOrbit(piece, work).has(JSON.stringify(pose.mask))) work.stop('CURRENT_POSE_NOT_IN_SUPPORTED_FULL_SHAPE_ORBIT');
  const cells = support(pose);
  if (!subset(cells, world)) work.stop('CURRENT_FULL_POSE_OUTSIDE_WORLD');
  return cells;
}

/** donor.assignments constructs every complete pose domain, then invokes the
 * consumed V5 _residual with no held owner, no reserve and the fixed bounds. */
export async function previewPackingAssignments(scene: PreviewPackingScene | PreviewPackingModel, execution?: NativeExecution,
  limits: Partial<PreviewPackingLimits> = {}): Promise<Assignments> {
  const work = new PreviewPackingWork(execution, limits), model: Model = {
    pieces: [], world: scene.world.map(p => [...p] as Cell), board: scene.board.map(p => [...p] as Cell),
  };
  // These are the source Pydantic domains, checked before pure V5 computation.
  if (!scene.pieces.length || scene.pieces.length > 32) work.stop('PACKING_POPULATION_MODEL_BOUND');
  if (!scene.world.length || scene.world.length > 4096 || !scene.board.length || scene.board.length > 4096) work.stop('PACKING_CELL_MODEL_BOUND');
  const board = new Set(scene.board.map(pointKey)), boardOrder = [...scene.board].sort(comparePoints);
  const poses: AssignedPose[] = [], poseDomains = new Map<string, AssignedPose[]>();
  for (const p of scene.pieces) {
    work.check({ piece_ref: p.id });
    if (!p.mask.length || p.mask.length > 128) work.stop('PACKING_MASK_MODEL_BOUND', { piece_ref: p.id });
    const mask = p.mask.map(cell => [...cell] as Cell), pose: AssignedPose = { piece_ref: p.id, anchor: [...p.anchor] as Cell, mask };
    poses.push(pose); model.pieces.push({ piece_ref: p.id, full_mask: mask, movable: p.movable });
    let candidates = [pose];
    if (p.movable) {
      const shapes = new Map([[JSON.stringify(mask), mask]]); let current = mask;
      for (let turns = 0; turns < 4; turns++) { shapes.set(JSON.stringify(current), current); current = previewPackingTransform(current, 'rotate_cw'); }
      candidates = [];
      for (const shape of [...shapes.values()].sort(compareMasks)) for (const [y, x] of boardOrder) {
        work.tick();
        if (shape.every(([a, b]) => board.has(pointKey([y + a, x + b])))) candidates.push({ piece_ref: p.id, anchor: [y, x], mask: shape });
        if (candidates.length > 4096) work.stop('PACKING_POSE_MODEL_BOUND', { piece_ref: p.id });
        if (work.work % 256 === 0) await work.checkpoint();
      }
    }
    if (!candidates.length) work.stop('PACKING_POSE_DOMAIN_EMPTY', { piece_ref: p.id });
    if (poseDomains.has(p.id)) work.stop('ONE_COMPLETE_POSE_DOMAIN_PER_OCCURRENCE_REQUIRED');
    poseDomains.set(p.id, candidates);
  }
  work.beginSource();
  const { world, board: boardSet, pieces } = domains(model, work);
  if (poseDomains.size !== pieces.size) work.stop('ONE_COMPLETE_POSE_DOMAIN_PER_OCCURRENCE_REQUIRED');
  // Source _state performs its own _domains pass before validating current poses.
  const stateDomains = domains(model, work), currentPoses = new Map<string, AssignedPose>();
  for (const pose of poses) {
    if (currentPoses.has(pose.piece_ref)) work.stop('DUPLICATE_CURRENT_OCCURRENCE');
    validPose(pose, stateDomains.world, stateDomains.pieces, work); currentPoses.set(pose.piece_ref, pose);
    await work.checkpoint();
  }
  if (currentPoses.size !== pieces.size || [...pieces.keys()].some(k => !currentPoses.has(k))) work.stop('FULL_CURRENT_POPULATION_MISSING');
  const alternatives: { pose: AssignedPose; support: Set<string> }[][] = [];
  for (const ref of [...pieces.keys()].sort(compareUnicode)) {
    const domain = poseDomains.get(ref)!;
    if (domain.length > work.limits.domainBound) work.stop('POSE_DOMAIN_BOUND', { piece_ref: ref });
    const valid: { pose: AssignedPose; support: Set<string> }[] = [];
    for (const pose of domain) {
      const cells = validPose(pose, world, pieces, work);
      if (pose.piece_ref !== ref) work.stop('POSE_DOMAIN_OCCURRENCE_MISMATCH');
      if (!pieces.get(ref)!.movable && !pythonEqual(pose, currentPoses.get(ref))) work.stop('FIXED_OCCURRENCE_POSE_NOT_CURRENT');
      if (subset(cells, boardSet)) valid.push({ pose, support: cells });
      await work.checkpoint();
    }
    alternatives.push(valid);
  }
  if (model.pieces.reduce((sum, p) => sum + p.full_mask.length, 0) !== boardSet.size) {
    work.check(); return { packing_assignments: [], area_mismatch: true, exhaustive_in_supplied_pose_domains: true };
  }
  if (alternatives.length > work.limits.depthBound) work.stop('PARTITION_RECURSION_DEPTH_BOUND');
  const assignments: Assignments['packing_assignments'] = [];
  async function enumerateResidual(index: number, occupied: Set<string>, prefix: AssignedPose[]): Promise<void> {
    work.visit({ piece_domain_index: index, remaining_cells: boardSet.size - occupied.size });
    await work.checkpoint();
    if (index === alternatives.length) {
      if (occupied.size === boardSet.size && subset(occupied, boardSet)) {
        if (assignments.length >= work.limits.domainBound) work.stop('PACKING_ASSIGNMENT_DOMAIN_BOUND');
        assignments.push({ poses: prefix.map(clonePose), strict_partition: true });
      }
      return;
    }
    for (const choice of alternatives[index]!) {
      work.tick();
      if (![...choice.support].some(cell => occupied.has(cell))) await enumerateResidual(index + 1, new Set([...occupied, ...choice.support]), [...prefix, choice.pose]);
      if (work.work % 256 === 0) await work.checkpoint();
    }
  }
  await enumerateResidual(0, new Set(), []);
  work.check();
  return { packing_assignments: assignments, area_mismatch: false, exhaustive_in_supplied_pose_domains: true,
    packing_does_not_prove_transport: true, minimum_cost_claimed: false };
}

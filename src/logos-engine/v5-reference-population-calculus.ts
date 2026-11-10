/**
 * V5 subgraph consumed by V6 ReferencePopulationAccess, pinned at
 * 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e: maximum_injective_matching and
 * neighborhood_pattern_construction._physical(kind_ref='move')/_occupancy.
 * This is not the neighborhood-color, selection-cycle or construction facade.
 * Inputs use the portable JSON integer/Ref domain, not Python coercions.
 */
import { compareUnicode } from './canonical.ts';

type R = Record<string, any>;
export type PopulationReference = string | number | readonly PopulationReference[];
export type PopulationCell = [number, number];
export interface PopulationOccurrence { occurrence_ref: string; cell: PopulationCell }
export interface PopulationPhysicalState {
  occurrences: PopulationOccurrence[];
  active_occurrence_ref: string | null;
  reserve: number | null;
  terminated: boolean;
}
export interface PopulationPhysicalModel { movement_cells: readonly (readonly number[])[]; motion_law_ref?: string | null }
export interface PopulationPhysicalInput { kind_ref: string; cell?: readonly number[] | null; delta?: readonly number[] | null }
export interface PopulationPhysicalResult {
  state: PopulationPhysicalState;
  changed_identity_ref: string | null;
  ignored_out_of_domain_point: false;
}
export interface PopulationWorkLimits {
  domain_bound?: number;
  node_bound?: number;
  time_bound_ms?: number;
  deadlineMs?: number;
  shouldStop?: () => boolean;
  now?: () => number;
}

function integer(value: unknown, minimum = -Infinity): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || Object.is(value, -0) || value < minimum) {
    throw new RangeError('Population integer is outside the native portable domain');
  }
  return value;
}
function cell(value: readonly number[]): PopulationCell {
  if (!Array.isArray(value) || value.length !== 2) throw new TypeError('Population cell requires two integers');
  return [integer(value[0]), integer(value[1])];
}
function ref(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError('Population identity requires a nonempty Ref');
  return value.trim();
}
function fields(value: unknown, allowed: readonly string[], required: readonly string[]): R {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Population contract requires an object');
  const record = value as R;
  if (Object.keys(record).some(name => !allowed.includes(name)) || required.some(name => !Object.hasOwn(record, name))) {
    throw new TypeError('Population contract has missing or unknown fields');
  }
  return record;
}
function portableReference(value: PopulationReference, ancestors = new Set<object>()): PopulationReference {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return integer(value);
  if (!Array.isArray(value) || ancestors.has(value)) throw new TypeError('Matching references require finite portable tuples');
  ancestors.add(value);
  const result = value.map(item => portableReference(item, ancestors));
  ancestors.delete(value);
  return result;
}
function compareReference(left: PopulationReference, right: PopulationReference): number {
  if (Array.isArray(left) && Array.isArray(right)) {
    for (let i = 0; i < Math.min(left.length, right.length); i++) {
      const difference = compareReference(left[i]!, right[i]!);
      if (difference) return difference;
    }
    return left.length - right.length;
  }
  if (typeof left === 'string' && typeof right === 'string') return compareUnicode(left, right);
  if (typeof left === 'number' && typeof right === 'number') return left < right ? -1 : left > right ? 1 : 0;
  throw new TypeError('Matching references must share a Python-orderable portable domain');
}

/**
 * Exact augmenting witness in supplied domain order. The visit callback occurs
 * before the visited-edge check, including repeated references, as in V5.
 * Unfilled indices describe this maximum witness, not uniquely impossible items.
 */
export function maximumInjectiveMatching<T extends PopulationReference>(domains: readonly (readonly T[])[],
  visit?: (index: number, reference: T) => void): [Array<[number, T]>, number[]] {
  const owner = new Map<string, { index: number; reference: T }>();
  const normalized = domains.map(domain => domain.map(value => portableReference(value) as T));
  const augment = (index: number, visited: Set<string>): boolean => {
    for (const reference of normalized[index]!) {
      visit?.(index, reference);
      const key = JSON.stringify(reference);
      if (visited.has(key)) continue;
      visited.add(key);
      const previous = owner.get(key);
      if (previous === undefined || augment(previous.index, visited)) {
        owner.set(key, { index, reference }); return true;
      }
    }
    return false;
  };
  for (let index = 0; index < normalized.length; index++) augment(index, new Set());
  const assigned: Array<[number, T]> = [...owner.values()]
    .sort((a, b) => compareReference(a.reference, b.reference))
    .map(({ index, reference }) => [index, structuredClone(reference)]);
  assigned.sort((a, b) => a[0] - b[0] || compareReference(a[1], b[1]));
  const filled = new Set(assigned.map(([index]) => index));
  return [assigned, normalized.map((_, index) => index).filter(index => !filled.has(index))];
}

export class PopulationPrerequisite extends Error {
  constructor(cause: string) { super(cause); this.name = 'PopulationPrerequisite'; }
}
export class PopulationWorkInterrupted extends Error {
  readonly cause: 'NODE_BOUND' | 'TIME_BOUND' | 'NATIVE_INTERRUPTION';
  readonly frontier: R;
  constructor(cause: 'NODE_BOUND' | 'TIME_BOUND' | 'NATIVE_INTERRUPTION', frontier: R = {}) {
    super(cause); this.name = 'PopulationWorkInterrupted'; this.cause = cause; this.frontier = structuredClone(frontier);
  }
}

/** Actual V5 node/time checks, with separately named optional native interruption. */
export class PopulationWorkBudget {
  readonly request: { domain_bound: number; node_bound: number; time_bound_ms: number };
  examined = 0;
  private readonly clock: () => number;
  private readonly started: number;
  private readonly limits: PopulationWorkLimits;
  constructor(limits: PopulationWorkLimits = {}) {
    this.request = { domain_bound: integer(limits.domain_bound ?? 4096, 0), node_bound: integer(limits.node_bound ?? 100000, 0),
      time_bound_ms: integer(limits.time_bound_ms ?? 2000, 0) };
    if (limits.deadlineMs !== undefined && (typeof limits.deadlineMs !== 'number' || Number.isNaN(limits.deadlineMs))) {
      throw new TypeError('Invalid native population deadline');
    }
    this.limits = { ...limits }; this.clock = limits.now ?? (() => performance.now()); this.started = this.clock();
  }
  private checkTime(frontier: R): void {
    const now = this.clock();
    if (now - this.started >= this.request.time_bound_ms) throw new PopulationWorkInterrupted('TIME_BOUND', frontier);
    if (this.limits.shouldStop?.() || (this.limits.deadlineMs !== undefined && now >= this.limits.deadlineMs)) {
      throw new PopulationWorkInterrupted('NATIVE_INTERRUPTION', frontier);
    }
  }
  visit(frontier: R = {}): void {
    if (this.examined >= this.request.node_bound) throw new PopulationWorkInterrupted('NODE_BOUND', frontier);
    this.checkTime(frontier); this.examined++;
  }
  finish(): void { this.checkTime({}); }
}

export function normalizePopulationPhysicalState(value: R): PopulationPhysicalState {
  const names = ['occurrences', 'active_occurrence_ref', 'reserve', 'terminated'];
  value = fields(value, names, names);
  if (!Array.isArray(value.occurrences) || value.occurrences.length < 1 || value.occurrences.length > 128) {
    throw new TypeError('Population state requires one to 128 current occurrences');
  }
  if (typeof value.terminated !== 'boolean') throw new TypeError('Population termination must be an explicit boolean');
  return { occurrences: value.occurrences.map((item: R) => {
    item = fields(item, ['occurrence_ref', 'cell'], ['occurrence_ref', 'cell']);
    return { occurrence_ref: ref(item.occurrence_ref), cell: cell(item.cell) };
  }),
    active_occurrence_ref: value.active_occurrence_ref == null ? null : ref(value.active_occurrence_ref),
    reserve: value.reserve == null ? null : integer(value.reserve, 0), terminated: value.terminated };
}

/**
 * Only the selected-body cardinal move branch used by ReferencePopulationAccess.
 * Every current occurrence is visited before termination/input checks, preserving
 * V5 prerequisite order. Blocked/outside moves retain the whole population.
 */
export function selectedCardinalPopulationStep(model: PopulationPhysicalModel, value: PopulationPhysicalState | R,
  primitive: PopulationPhysicalInput, limitsOrBudget: PopulationWorkLimits | PopulationWorkBudget = {}): PopulationPhysicalResult {
  const state = normalizePopulationPhysicalState(value), budget = limitsOrBudget instanceof PopulationWorkBudget
    ? limitsOrBudget : new PopulationWorkBudget(limitsOrBudget);
  fields(primitive, ['kind_ref', 'cell', 'delta'], ['kind_ref']);
  const movement = model.movement_cells.map(cell), floor = new Set(movement.map(point => JSON.stringify(point)));
  if (floor.size !== movement.length || floor.size > budget.request.domain_bound) {
    throw new PopulationPrerequisite('FINITE_MOVEMENT_DOMAIN_NOT_UNIQUE_OR_WITHIN_BOUND');
  }
  const refs = new Map<string, PopulationOccurrence>(), occupied = new Map<string, string>();
  for (const occurrence of state.occurrences) {
    budget.visit({ occurrence_ref: occurrence.occurrence_ref });
    const key = JSON.stringify(occurrence.cell);
    if (refs.has(occurrence.occurrence_ref) || occupied.has(key) || !floor.has(key)) {
      throw new PopulationPrerequisite('FULL_CURRENT_OCCUPANCY_OR_IDENTITY_NOT_VALID');
    }
    refs.set(occurrence.occurrence_ref, occurrence); occupied.set(key, occurrence.occurrence_ref);
  }
  if (state.active_occurrence_ref !== null && !refs.has(state.active_occurrence_ref)) {
    throw new PopulationPrerequisite('ACTIVE_IDENTITY_NOT_IN_CURRENT_POPULATION');
  }
  if (state.terminated) throw new PopulationPrerequisite('OFFICIAL_TERMINATION_REVOKES_PATTERN_INPUT');
  if (primitive.kind_ref !== 'move') throw new PopulationPrerequisite('PATTERN_EXTERNAL_INPUT_KIND_UNSUPPORTED');
  const delta = primitive.delta == null ? null : cell(primitive.delta);
  if (model.motion_law_ref !== 'collision_checked_cardinal_step' || delta === null || Math.abs(delta[0]) + Math.abs(delta[1]) !== 1) {
    throw new PopulationPrerequisite('SUPPORTED_CARDINAL_SINGLE_BODY_MOTION_MISSING');
  }
  if (state.active_occurrence_ref === null) throw new PopulationPrerequisite('CURRENT_ACTIVE_IDENTITY_MISSING');
  const occurrence = refs.get(state.active_occurrence_ref)!;
  const destination: PopulationCell = [integer(occurrence.cell[0] + delta[0]), integer(occurrence.cell[1] + delta[1])];
  const key = JSON.stringify(destination);
  if (!floor.has(key) || occupied.has(key)) return { state, changed_identity_ref: null, ignored_out_of_domain_point: false };
  return { state: { ...state, occurrences: state.occurrences.map(item => item.occurrence_ref === occurrence.occurrence_ref
    ? { ...item, cell: destination } : item) }, changed_identity_ref: occurrence.occurrence_ref, ignored_out_of_domain_point: false };
}

/**
 * Portable JSON contracts for the V5 piercing subgraph consumed by V6.
 * Source: 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e, capabilities/contracts.py.
 * Defaults, uniqueness and geometric constraints match the source models.
 * Native inputs are typed JSON values, not Pydantic's coercion surface; integer
 * fields and arithmetic must remain safe JavaScript integers. No game law is
 * supplied here: unknown conditional laws retain their source null defaults.
 */
export type PiercingRecord = Record<string, any>;
export type Position = [number, number];
export type RefPair = [string, string];
export interface PiercingRodState {
  rod_ref: string; root_ref: string; root_to_tip_positions: Position[];
  rod_footprint_positions: Position[] | null;
}
export interface PiercingPieceState {
  piece_ref: string; type_ref: string; occupied_positions: Position[]; support_refs: string[];
}
export interface PiercingConfiguration {
  configuration_ref: string; rods: PiercingRodState[]; pieces: PiercingPieceState[];
  obstacles: { obstacle_ref: string; occupied_positions: Position[] }[];
  domain_positions: Position[] | null; domain_boundary_is_known: boolean;
  coordinate_scope_ref: string; is_predicted_configuration: boolean;
  root_footprints: [string, Position[]][]; root_admissible_positions: [string, Position[]][];
  entry_pending_pairs: RefPair[]; entry_stopped_pairs: RefPair[]; movable_piece_refs: string[];
  possible_support_pairs: RefPair[]; hypothetical_support_pairs: RefPair[]; missing_piece_refs: string[];
  frame_ref: string | null; scope: PiercingRecord; provenance: string[];
}
export interface PiercingCommandEffect {
  effect_ref: string; action_ref: string; action_data: PiercingRecord; rod_ref: string;
  root_translation: Position; extent_delta: number; extent_cross_section_offsets: Position[] | null;
  axis_direction: Position; resource_cost: number | null; evidence_refs: string[];
  coordinate_scope_ref: string; source_profile_refs: string[];
}
export interface PiercingConditionalModel {
  model_ref: string; source_model_ref: string | null; push_enabled: boolean | null;
  entry_enabled: boolean | null; entry_requires_stop: boolean | null; entry_attaches: boolean | null;
  carry_on_root_translation: boolean | null; retain_on_retraction: boolean | null;
  withdraw_requires_reverse_stop: boolean | null; possible_support_mode: 'carried' | 'independent' | null;
  support_assignments: [string, string, 'carried' | 'independent'][];
  evidence_refs: string[]; falsifier_refs: string[];
}

export function piercingObject(value: unknown, allowed?: readonly string[]): PiercingRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Piercing contract requires an object');
  const record = value as PiercingRecord;
  if (allowed) for (const name of Object.keys(record)) if (!allowed.includes(name)) throw new TypeError('Unknown piercing contract field: ' + name);
  return record;
}
function supplied(v: PiercingRecord, field: string, fallback: any): any { return v[field] === undefined ? fallback : v[field]; }
export function piercingArray(value: unknown, minimum = 0, maximum = Infinity): any[] {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) throw new TypeError('Piercing contract array length is invalid');
  return value;
}
export function piercingRef(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new TypeError('Piercing Ref must be a nonempty string');
  return value.trim();
}
export function piercingInteger(value: unknown, minimum = -Infinity): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || Object.is(value, -0) || value < minimum) throw new RangeError('Piercing integer is outside the native portable domain');
  return value;
}
function bool(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new TypeError('Piercing boolean must be supplied as a boolean');
  return value;
}
export function piercingUnique<T>(values: T[]): T[] {
  if (new Set(values.map(value => JSON.stringify(value))).size !== values.length) throw new TypeError('Duplicate piercing contract value');
  return values;
}
function jsonValue(value: unknown, ancestors = new Set<object>()): any {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'object' || ancestors.has(value)) throw new TypeError('Piercing map must contain finite acyclic JSON values');
  ancestors.add(value);
  const result = Array.isArray(value) ? value.map(v => jsonValue(v, ancestors)) : Object.fromEntries(Object.entries(value).map(([k, v]) => [k, jsonValue(v, ancestors)]));
  ancestors.delete(value);
  return result;
}
function map(value: unknown): PiercingRecord { return jsonValue(piercingObject(value)); }
function position(value: unknown): Position {
  const pair = piercingArray(value, 2, 2);
  return [piercingInteger(pair[0]), piercingInteger(pair[1])];
}
function positions(value: unknown, minimum = 0, maximum = Infinity, unique = false): Position[] {
  const result = piercingArray(value, minimum, maximum).map(position);
  return unique ? piercingUnique(result) : result;
}
function refs(value: unknown, maximum = Infinity): string[] { return piercingArray(value, 0, maximum).map(piercingRef); }
function pairs(value: unknown, unique = false): RefPair[] {
  const result: RefPair[] = piercingArray(value).map(v => { const p = piercingArray(v, 2, 2); return [piercingRef(p[0]), piercingRef(p[1])]; });
  return unique ? piercingUnique(result) : result;
}
function footprints(value: unknown): [string, Position[]][] {
  const result: [string, Position[]][] = piercingArray(value).map(v => { const p = piercingArray(v, 2, 2); return [piercingRef(p[0]), positions(p[1])]; });
  piercingUnique(result.map(([ref]) => ref));
  return result;
}
export function normalizePiercingRod(value: unknown): PiercingRodState {
  const v = piercingObject(value, ['rod_ref', 'root_ref', 'root_to_tip_positions', 'rod_footprint_positions']);
  return { rod_ref: piercingRef(v.rod_ref), root_ref: piercingRef(v.root_ref),
    root_to_tip_positions: positions(v.root_to_tip_positions, 1, 512, true),
    rod_footprint_positions: v.rod_footprint_positions == null ? null : positions(v.rod_footprint_positions, 0, Infinity, true) };
}
export function normalizePiercingPiece(value: unknown): PiercingPieceState {
  const v = piercingObject(value, ['piece_ref', 'type_ref', 'occupied_positions', 'support_refs']);
  return { piece_ref: piercingRef(v.piece_ref), type_ref: piercingRef(v.type_ref),
    occupied_positions: positions(v.occupied_positions, 1, 256, true), support_refs: piercingUnique(refs(v.support_refs, 16)) };
}
export function normalizePiercingConfiguration(value: unknown): PiercingConfiguration {
  const v = piercingObject(value, ['configuration_ref', 'rods', 'pieces', 'obstacles', 'domain_positions', 'domain_boundary_is_known',
    'coordinate_scope_ref', 'is_predicted_configuration', 'root_footprints', 'root_admissible_positions', 'entry_pending_pairs',
    'entry_stopped_pairs', 'movable_piece_refs', 'possible_support_pairs', 'hypothetical_support_pairs', 'missing_piece_refs', 'frame_ref', 'scope', 'provenance']);
  const rods = piercingArray(v.rods).map(normalizePiercingRod), pieces = piercingArray(v.pieces).map(normalizePiercingPiece);
  piercingUnique(rods.map(r => r.rod_ref)); piercingUnique(pieces.map(p => p.piece_ref));
  return { configuration_ref: piercingRef(v.configuration_ref), rods, pieces,
    obstacles: piercingArray(supplied(v, 'obstacles', [])).map(o => { const x = piercingObject(o, ['obstacle_ref', 'occupied_positions']); return { obstacle_ref: piercingRef(x.obstacle_ref), occupied_positions: positions(x.occupied_positions, 1, 4096) }; }),
    domain_positions: v.domain_positions == null ? null : positions(v.domain_positions, 0, Infinity, true),
    domain_boundary_is_known: v.domain_boundary_is_known === undefined ? true : bool(v.domain_boundary_is_known),
    coordinate_scope_ref: piercingRef(supplied(v, 'coordinate_scope_ref', 'coordinate.world')),
    is_predicted_configuration: v.is_predicted_configuration === undefined ? false : bool(v.is_predicted_configuration),
    root_footprints: footprints(supplied(v, 'root_footprints', [])), root_admissible_positions: footprints(supplied(v, 'root_admissible_positions', [])),
    entry_pending_pairs: pairs(supplied(v, 'entry_pending_pairs', []), true), entry_stopped_pairs: pairs(supplied(v, 'entry_stopped_pairs', []), true),
    movable_piece_refs: refs(supplied(v, 'movable_piece_refs', [])), possible_support_pairs: pairs(supplied(v, 'possible_support_pairs', []), true),
    hypothetical_support_pairs: pairs(supplied(v, 'hypothetical_support_pairs', [])), missing_piece_refs: refs(supplied(v, 'missing_piece_refs', [])),
    frame_ref: v.frame_ref == null ? null : piercingRef(v.frame_ref), scope: map(supplied(v, 'scope', {})), provenance: refs(supplied(v, 'provenance', [])) };
}
export function normalizePiercingCommandEffect(value: unknown): PiercingCommandEffect {
  const v = piercingObject(value, ['effect_ref', 'action_ref', 'action_data', 'rod_ref', 'root_translation', 'extent_delta',
    'extent_cross_section_offsets', 'axis_direction', 'resource_cost', 'evidence_refs', 'coordinate_scope_ref', 'source_profile_refs']);
  const axis = position(v.axis_direction), offsets = v.extent_cross_section_offsets == null ? null : positions(v.extent_cross_section_offsets, 1, Infinity, true);
  if (Math.abs(axis[0]) + Math.abs(axis[1]) !== 1) throw new TypeError('Piercing axis must be a cardinal unit vector');
  if (offsets?.some(p => p[0] * axis[0] + p[1] * axis[1] !== 0)) throw new TypeError('Piercing extent offsets must be transverse');
  return { effect_ref: piercingRef(v.effect_ref), action_ref: piercingRef(v.action_ref), action_data: map(supplied(v, 'action_data', {})),
    rod_ref: piercingRef(v.rod_ref), root_translation: position(supplied(v, 'root_translation', [0, 0])), extent_delta: piercingInteger(supplied(v, 'extent_delta', 0)),
    extent_cross_section_offsets: offsets, axis_direction: axis, resource_cost: v.resource_cost == null ? null : piercingInteger(v.resource_cost, 0),
    evidence_refs: refs(supplied(v, 'evidence_refs', [])), coordinate_scope_ref: piercingRef(supplied(v, 'coordinate_scope_ref', 'coordinate.world')), source_profile_refs: refs(supplied(v, 'source_profile_refs', [])) };
}
function mode(value: unknown): 'carried' | 'independent' {
  if (value !== 'carried' && value !== 'independent') throw new TypeError('Unknown piercing support hypothesis mode');
  return value;
}
export function normalizePiercingConditionalModel(value: unknown): PiercingConditionalModel {
  const names = ['push_enabled', 'entry_enabled', 'entry_requires_stop', 'entry_attaches', 'carry_on_root_translation', 'retain_on_retraction', 'withdraw_requires_reverse_stop'];
  const v = piercingObject(value, ['model_ref', 'source_model_ref', ...names, 'possible_support_mode', 'support_assignments', 'evidence_refs', 'falsifier_refs']);
  const flags = Object.fromEntries(names.map(name => [name, v[name] == null ? null : bool(v[name])]));
  const assignments: [string, string, 'carried' | 'independent'][] = piercingArray(supplied(v, 'support_assignments', [])).map(a => {
    const p = piercingArray(a, 3, 3); return [piercingRef(p[0]), piercingRef(p[1]), mode(p[2])]; });
  piercingUnique(assignments.map(([r, p]) => [r, p]));
  return { model_ref: piercingRef(v.model_ref), source_model_ref: v.source_model_ref == null ? null : piercingRef(v.source_model_ref),
    ...flags, possible_support_mode: v.possible_support_mode == null ? null : mode(v.possible_support_mode),
    support_assignments: assignments, evidence_refs: refs(supplied(v, 'evidence_refs', [])), falsifier_refs: refs(supplied(v, 'falsifier_refs', [])) } as PiercingConditionalModel;
}

export interface PiercingStepInput {
  configuration: PiercingConfiguration; effect: PiercingCommandEffect; models: PiercingConditionalModel[];
  max_microsteps: number; require_finite_domain: boolean;
}
export function normalizePiercingStepInput(value: unknown): PiercingStepInput {
  const v = piercingObject(value, ['configuration', 'effect', 'models', 'max_microsteps', 'require_finite_domain', 'schema_version']);
  const models = piercingArray(v.models, 1).map(normalizePiercingConditionalModel);
  piercingUnique(models.map(m => m.model_ref));
  if (v.schema_version !== undefined) piercingRef(v.schema_version);
  return { configuration: normalizePiercingConfiguration(v.configuration), effect: normalizePiercingCommandEffect(v.effect), models,
    max_microsteps: piercingInteger(v.max_microsteps, 1), require_finite_domain: v.require_finite_domain === undefined ? true : bool(v.require_finite_domain) };
}
export interface PiercingSearchInput {
  configuration: PiercingConfiguration; effects: PiercingCommandEffect[]; models: PiercingConditionalModel[];
  goal_requested_root_ref: string; goal_requested_type_order: string[];
  max_microsteps: number; max_depth: number; max_nodes: number; max_plans: number;
}
export function normalizePiercingSearchInput(value: unknown): PiercingSearchInput {
  const v = piercingObject(value, ['configuration', 'effects', 'models', 'goal_requested_root_ref', 'goal_requested_type_order',
    'max_microsteps', 'max_depth', 'max_nodes', 'max_plans', 'staged_profiles', 'source_parent_goal_ref', 'source_parent_why_fingerprint',
    'continuation', 'work_slice_nodes', 'schema_version']);
  if (piercingArray(supplied(v, 'staged_profiles', [])).length || v.continuation != null || v.work_slice_nodes != null) {
    throw new TypeError('Native piercing implements the non-staged V6 consumer; staged search and continuations are not supported');
  }
  if (v.source_parent_goal_ref != null) piercingRef(v.source_parent_goal_ref);
  if (v.source_parent_why_fingerprint != null && typeof v.source_parent_why_fingerprint !== 'string') throw new TypeError('Invalid parent fingerprint');
  if (v.schema_version !== undefined) piercingRef(v.schema_version);
  return { configuration: normalizePiercingConfiguration(v.configuration), effects: piercingArray(v.effects).map(normalizePiercingCommandEffect),
    models: piercingArray(v.models, 1).map(normalizePiercingConditionalModel), goal_requested_root_ref: piercingRef(v.goal_requested_root_ref),
    goal_requested_type_order: refs(v.goal_requested_type_order), max_microsteps: piercingInteger(v.max_microsteps, 1),
    max_depth: piercingInteger(v.max_depth, 0), max_nodes: piercingInteger(v.max_nodes, 1), max_plans: piercingInteger(v.max_plans, 1) };
}

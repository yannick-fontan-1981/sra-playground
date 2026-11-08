/**
 * Native transfer of common_mechanisms.py, common_property_rewrites.py,
 * common_control_dependencies.py and common_preservation.py at
 * 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e.
 *
 * These modules retain the original heterogeneous, JSON-shaped evidence. They
 * learn conditional relations from public transitions and never authorize an
 * environment action. Hashes use the existing portable integer JSON contract;
 * Python float/int identity is outside that shared browser contract.
 */
import { canonical, compareUnicode, digest } from './canonical.ts';
import { v6Digest } from './v6-native-observer.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import type { NativeRows } from './v6-native-types.ts';

// A rule has different fields in each original branch (literal transition,
// translation, or property rewrite). Preserve those records without inventing
// a closed schema or dropping retained unknowns during this mechanical port.
export type TransitionRecord = Record<string, any>;
export interface TransitionAction extends TransitionRecord { action_ref: string; data?: TransitionRecord }
export interface TransitionObservation extends TransitionRecord { entities: readonly TransitionRecord[] }
type Point = readonly [number, number];
type Support = Map<string, Point>;
type Evidence = TransitionRecord;
type Pair = readonly [TransitionRecord, TransitionRecord];

export const MECHANISM_SCHEMA = 'prototype.common_mechanisms.v1';
export const PROPERTY_REWRITE_SCHEMA = 'prototype.common_property_rewrites.v1';
export const FORBIDDEN_TRANSITION_FIELDS: ReadonlySet<string> = new Set([
  'game_id', 'game_name', 'planner', 'planner_name', 'oracle', 'oracle_path', 'goal', 'goals', 'solution', 'winning_route',
]);
const MAX_ENTITIES = 512, MAX_PAIRS = 128, MAX_SUPPORT_POINTS = 65536;
/** Same source refusal; the V7 caller can distinguish it from corrupt input. */
export class NeutralEntityDomainError extends RangeError {
  readonly limit = MAX_ENTITIES;
  constructor() { super('Neutral entity measurement domain exceeded'); }
}
const copy = <T>(value: T): T => structuredClone(value);
const has = (value: TransitionRecord, key: string): boolean => Object.hasOwn(value, key);
// Python tuple/set keys equate boolean coordinates with 0/1. Public game
// coordinates are integers, but preserving this rule also keeps synthetic
// neutral measurements faithful to the original accepted scalar domain.
const pointKey = (point: Point): string => JSON.stringify(point.map(Number));
const sortedStrings = (values: Iterable<string>): string[] => [...values].sort(compareUnicode);
const comparePoint = (a: Point, b: Point): number => a[0] - b[0] || a[1] - b[1];
// Cache only immutable occurrence identities. Equal signatures at different
// positions are distinct observations; mutable external/test inputs bypass it.
const immutableMeasurements = new WeakSet<object>();
function deeplyFrozen(value: unknown, visiting = new WeakSet<object>()): boolean {
  if (value === null || typeof value !== 'object') return true;
  if (immutableMeasurements.has(value)) return true;
  if (!Object.isFrozen(value) || visiting.has(value)) return false;
  visiting.add(value);
  const result = Object.values(Object.getOwnPropertyDescriptors(value)).every(descriptor => 'value' in descriptor && deeplyFrozen(descriptor.value, visiting));
  visiting.delete(value); if (result) immutableMeasurements.add(value); return result;
}
function frozenRecord<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) frozenRecord(child); Object.freeze(value);
  }
  return value;
}
const supports = new WeakMap<object, Support | null>();
const neutralEntities = new WeakMap<object, TransitionRecord>();
const observedStates = new WeakMap<object, TransitionRecord>();
const shapes = new WeakMap<object, TransitionRecord>();
const translations = new WeakMap<Support, Map<string, Support>>();
const sweeps = new WeakMap<Support, Map<string, Support | null>>();

/** Python truth values and value equality on the measured JSON domain. */
function truth(value: any): boolean {
  if (value == null || value === false || value === 0 || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}
function same(a: any, b: any): boolean {
  if (a === b) return true;
  if ((typeof a === 'boolean' || typeof a === 'number') && (typeof b === 'boolean' || typeof b === 'number')) return Number(a) === Number(b);
  if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, i) => same(value, b[i]));
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => has(b, key) && same(a[key], b[key]));
}

export function checkNeutralTransition(before: TransitionObservation, after: TransitionObservation, action: TransitionAction): void {
  for (const value of [before, after, action]) {
    const forbidden = Object.keys(value).filter(key => FORBIDDEN_TRANSITION_FIELDS.has(key));
    if (forbidden.length) throw new TypeError(`Non-neutral input fields: ${sortedStrings(forbidden).join(', ')}`);
  }
  if (!truth(action.action_ref)) throw new TypeError('Action requires its observed public action_ref');
  for (const observation of [before, after]) {
    if (!Array.isArray(observation.entities)) throw new TypeError('Observation requires neutral entities');
    if (observation.entities.length > MAX_ENTITIES) throw new NeutralEntityDomainError();
    for (const entity of observation.entities) {
      if (Object.keys(entity).some(key => FORBIDDEN_TRANSITION_FIELDS.has(key))) throw new TypeError('Semantic role/solution fields excluded from entities');
      const position = has(entity, 'position') ? entity.position : entity.pose;
      if (!Array.isArray(position) || position.length !== 2 || position.some(value => !(typeof value === 'number' || typeof value === 'boolean') || !Number.isFinite(Number(value)))) {
        throw new TypeError('Entity requires finite measured position');
      }
      if (!has(entity, 'signature')) throw new TypeError('Entity requires a measured signature');
    }
  }
}

export function transitionObservationRef(observation: TransitionRecord): string {
  if (truth(observation.observation_ref)) return String(observation.observation_ref);
  if (!truth(observation.frame_hash) || !has(observation, 'revision')) throw new TypeError('Observation provenance absent');
  return `observation:${observation.level_epoch ?? 'unknown'}:${observation.revision}:${observation.frame_hash}`;
}
async function evidence(before: TransitionObservation, after: TransitionObservation, action: TransitionAction): Promise<Evidence> {
  const refs = [transitionObservationRef(before), transitionObservationRef(after)];
  if (refs[0] === refs[1]) throw new TypeError('Before and after must be distinct observation events');
  return { before: refs[0], after: refs[1], action: copy(action), transition_ref: await digest([refs, action]) };
}
function position(entity: TransitionRecord): Point { return (has(entity, 'position') ? entity.position : entity.pose) as Point; }
function support(entity: TransitionRecord): Support | null {
  const cacheable = deeplyFrozen(entity);
  if (cacheable && supports.has(entity)) return supports.get(entity)!;
  let points: Point[];
  if (has(entity, 'support')) points = entity.support;
  else if (has(entity, 'mask')) {
    const [x, y] = position(entity); points = entity.mask.map(([px, py]: Point) => [x + px, y + py]);
  } else { if (cacheable) supports.set(entity, null); return null; }
  const result = new Map(points.map(point => [pointKey(point), point]));
  if (result.size > MAX_SUPPORT_POINTS) throw new RangeError('Exact support measurement domain exceeded');
  if (cacheable) supports.set(entity, result);
  return result;
}
function translated(points: Support, delta: Point): Support {
  const key = pointKey(delta), cached = translations.get(points);
  if (cached?.has(key)) return cached.get(key)!;
  const result = new Map([...points.values()].map(([x, y]) => { const point: Point = [x + delta[0], y + delta[1]]; return [pointKey(point), point]; }));
  const entries = cached ?? new Map<string, Support>(); entries.set(key, result); translations.set(points, entries); return result;
}
function supportsEqual(a: Support, b: Support): boolean { return a.size === b.size && [...a.keys()].every(key => b.has(key)); }
function intersects(a: Support, b: Support): boolean { return [...a.keys()].some(key => b.has(key)); }
function swept(points: Support, delta: Point): Support | null {
  const key = pointKey(delta), cached = sweeps.get(points);
  if (cached?.has(key)) return cached.get(key)!;
  const retain = (result: Support | null) => { const entries = cached ?? new Map<string, Support | null>(); entries.set(key, result); sweeps.set(points, entries); return result; };
  const [dx, dy] = delta;
  if (!Number.isInteger(dx) || !Number.isInteger(dy)) return retain(null);
  let a = Math.abs(dx), b = Math.abs(dy);
  while (b) [a, b] = [b, a % b];
  const count = a;
  if (!count) return retain(new Map());
  if (count > 1024) return retain(null);
  const result: Support = new Map();
  for (let i = 1; i <= count; i++) for (const [key, point] of translated(points, [dx / count * i, dy / count * i])) result.set(key, point);
  return retain(result);
}
function neutralView(entity: TransitionRecord): TransitionRecord {
  const cacheable = deeplyFrozen(entity), cached = cacheable ? neutralEntities.get(entity) : undefined;
  if (cached) return cached;
  const value: TransitionRecord = { signature: copy(entity.signature), position: [...position(entity)] };
  for (const key of ['area', 'scale', 'palette_value']) if (has(entity, key)) value[key] = entity[key];
  const points = support(entity);
  if (points !== null) {
    const [x, y] = position(entity); value.mask = [...points.values()].map(([px, py]): Point => [px - x, py - y]).sort(comparePoint);
  }
  if (cacheable) { frozenRecord(value); neutralEntities.set(entity, value); }
  return value;
}
function neutralEntity(entity: TransitionRecord): TransitionRecord { return copy(neutralView(entity)); }
/** One immutable projection per actual public occurrence, reused across rule checks. */
function observedStateView(observation: TransitionObservation): TransitionRecord {
  const cacheable = deeplyFrozen(observation), cached = cacheable ? observedStates.get(observation) : undefined;
  if (cached) return cached;
  // Decorate once. Sorting used to clone and canonicalize the full pixel masks
  // again for every comparator call, and repeat this for every retained rule.
  const entities = observation.entities.map(entity => { const value = neutralView(entity); return { value, key: canonical(value) }; });
  entities.sort((a, b) => compareUnicode(a.key, b.key));
  const value = { coordinate_basis: has(observation, 'coordinate_basis') ? observation.coordinate_basis : 'unknown',
    entities: entities.map(item => item.value),
    metadata: Object.fromEntries(['level_epoch', 'state', 'levels_completed', 'available_action_refs', 'context_scope']
      .filter(key => has(observation, key)).map(key => [key, copy(observation[key])])) };
  if (cacheable) { frozenRecord(value); observedStates.set(observation, value); }
  return value;
}
function literalConditions(observation: TransitionObservation, action: TransitionAction, owned = true): TransitionRecord {
  const observed = observedStateView(observation);
  // Publicly returned rules remain independently mutable. Internal comparisons
  // borrow only the validated immutable projection, never the caller's values.
  return { observed_features: owned ? copy(observed) : observed, action: copy(action) };
}
async function matching(before: TransitionObservation, after: TransitionObservation): Promise<[Pair[], TransitionRecord[]]> {
  const left = new Map<string, TransitionRecord[]>(), right = new Map<string, TransitionRecord[]>();
  for (const [observation, map] of [[before, left], [after, right]] as const) for (const entity of observation.entities) {
    const key = canonical(entity.signature), list = map.get(key) ?? []; list.push(entity); map.set(key, list);
  }
  const matched: Pair[] = [], unresolved: TransitionRecord[] = [];
  for (const signature of sortedStrings(new Set([...left.keys(), ...right.keys()]))) {
    const a = left.get(signature) ?? [], b = right.get(signature) ?? [];
    if (a.length === 1 && b.length === 1) matched.push([a[0]!, b[0]!]);
    else unresolved.push({ signature_digest: await digest(signature), before_count: a.length, after_count: b.length,
      reason: 'identity_not_unique_or_signature_changed' });
  }
  return [matched, unresolved];
}
function model(name: string, status: string, source: Evidence, fields: TransitionRecord = {}): TransitionRecord {
  return { model: name, status, evidence_refs: [source.before, source.after], predictive_use_allowed: false, ...fields };
}

export async function assessMechanicalLibrary(before: TransitionObservation, after: TransitionObservation, action: TransitionAction,
  priorRules: readonly TransitionRecord[], source?: Evidence): Promise<TransitionRecord> {
  const observed = source ?? await evidence(before, after, action), compatible: TransitionRecord[] = [], refuted: TransitionRecord[] = [], unknown: TransitionRecord[] = [];
  if (!same(before.coordinate_basis, after.coordinate_basis) || before.coordinate_basis == null) {
    return { status: 'unknown', compatible: [], refuted: [], unknown: [model('rigid_translation', 'unknown', observed, { reason: 'coordinate_basis_not_bound' })], domain_complete: false };
  }
  const [pairs, unresolved] = await matching(before, after);
  type Motion = { a: TransitionRecord; b: TransitionRecord; delta: Point; sa: Support | null; sb: Support | null; rigid: boolean };
  const motions: Motion[] = [];
  for (const [a, b] of pairs) {
    const pa = position(a), pb = position(b), delta: Point = [pb[0] - pa[0], pb[1] - pa[1]], sa = support(a), sb = support(b);
    const exact = sa !== null && sb !== null, rigid = !exact || supportsEqual(translated(sa!, delta), sb!);
    const item = { entity_ref: a.id ?? null, signature: a.signature, delta: [...delta], exact_support_checked: exact };
    if (!rigid) refuted.push(model('rigid_translation', 'refuted', observed, { ...item, reason: 'translated_support_differs_from_observation' }));
    else if (same(delta, [0, 0])) {
      refuted.push(model('nonzero_translation', 'refuted', observed, { ...item, reason: 'observed_stationary' }));
      unknown.push(model('blocked_motion', 'unknown', observed, { ...item, reason: 'stationarity_alone_does_not_identify_control_intent_or_contact' }));
    } else compatible.push(model('rigid_translation', 'compatible', observed, { ...item,
      uncertainty: ['action_association_not_causal_proof', 'camera_or_joint_motion_not_excluded', ...exact ? [] : ['exact_shape_support_missing']] }));
    motions.push({ a, b, delta, sa, sb, rigid });
  }
  let examined = 0;
  for (const first of motions) {
    if (same(first.delta, [0, 0]) || !first.rigid) continue;
    for (const second of motions) {
      if (first.a === second.a) continue;
      if (examined >= MAX_PAIRS) break;
      examined++;
      const refs = { driver_ref: first.a.id ?? null, other_ref: second.a.id ?? null };
      if (first.sa === null || second.sa === null) {
        unknown.push(model('contact_push', 'unknown', observed, { ...refs, reason: 'exact_support_required; bounding_boxes_do_not_establish_contact' })); continue;
      }
      const sweep = swept(first.sa, first.delta);
      if (sweep === null) { unknown.push(model('contact_push', 'unknown', observed, { ...refs, reason: 'sweep_domain_not_established' })); continue; }
      const contact = intersects(sweep, second.sa) && !intersects(first.sa, second.sa);
      if (contact && same(first.delta, second.delta) && second.rigid) compatible.push(model('contact_push', 'compatible', observed, {
        ...refs, delta: [...first.delta], contact_checked: true,
        uncertainty: ['coordinated_motion_remains_an_alternative', 'driver_control_not_assigned_by_geometry'] }));
      else refuted.push(model('contact_push', 'refuted', observed, { ...refs,
        reason: !contact ? 'no_initial_swept_contact' : 'contacted_support_did_not_share_translation' }));
    }
  }
  for (const rule of priorRules) {
    if (rule.status !== 'mechanism_acquired') continue;
    const prediction = await applyEmpiricalRule(rule, before, action);
    if (prediction.status !== 'prediction' || predictionMatches(prediction, after)) continue;
    const stationary = motions.filter(motion => same(motion.delta, [0, 0])), blocked: TransitionRecord[] = [];
    for (const expected of prediction.predicted_entities) for (const first of stationary) {
      if (!same(first.a.signature, expected.entity.signature) || first.sa === null) continue;
      const intended: Point = [expected.entity.position[0] - position(first.a)[0], expected.entity.position[1] - position(first.a)[1]];
      const sweep = swept(first.sa, intended);
      if (!sweep?.size) continue;
      for (const second of stationary) {
        if (second.a === first.a || second.sa === null) continue;
        if (intersects(sweep, second.sa) && !intersects(first.sa, second.sa)) blocked.push({ subject: first.a.id ?? null,
          contact_support: second.a.id ?? null, attempted_delta: [...intended] });
      }
    }
    if (blocked.length) compatible.push(model('blocked_motion', 'compatible', observed, { contacts: blocked, refuted_rule: rule.rule_id,
      uncertainty: ['contact_correlates_with_failed_calibrated_motion', 'unobserved_control_or_mode_change_not_excluded'] }));
    else unknown.push(model('blocked_motion', 'unknown', observed, { stationary_entities: stationary.map(motion => motion.a.id ?? null),
      refuted_rule: rule.rule_id, reason: 'failed_prediction_without_established_contact_is_not_blocking_proof' }));
  }
  return { status: compatible.length ? 'compatible' : pairs.length ? 'no_compatible_candidate' : 'unknown',
    compatible, refuted, unknown, unresolved_correspondences: unresolved, domain_complete: examined < MAX_PAIRS,
    pair_candidates_examined: examined, absence_meaning: 'no compatible catalog model is not impossibility; empirical construction remains open' };
}

function shapeView(entity: TransitionRecord): TransitionRecord {
  const cacheable = deeplyFrozen(entity), cached = cacheable ? shapes.get(entity) : undefined;
  if (cached) return cached;
  const { position: _position, ...result } = neutralView(entity);
  if (cacheable) { frozenRecord(result); shapes.set(entity, result); } return result;
}
function shape(entity: TransitionRecord): TransitionRecord { return copy(shapeView(entity)); }
function literalEffect(before: TransitionObservation, after: TransitionObservation): TransitionRecord {
  const a = observedStateView(before), b = observedStateView(after), used = new Set<number>();
  const updates: TransitionRecord[] = [], removed: number[] = [];
  for (const [index, old] of (a.entities as TransitionRecord[]).entries()) {
    const matches = (b.entities as TransitionRecord[]).flatMap((entity, i) => !used.has(i) && same(entity.signature, old.signature) &&
      same(Object.fromEntries(Object.entries(entity).filter(([key]) => key !== 'position')), Object.fromEntries(Object.entries(old).filter(([key]) => key !== 'position'))) ? [i] : []);
    if (matches.length === 1) {
      const j = matches[0]!; used.add(j); const entity = b.entities[j], delta = [entity.position[0] - old.position[0], entity.position[1] - old.position[1]];
      if (!same(delta, [0, 0])) updates.push({ before_index: index, translation: delta });
    } else removed.push(index);
  }
  return { entity_translations: updates, remove_indices: removed,
    add_entities: copy((b.entities as TransitionRecord[]).filter((_, i) => !used.has(i))), metadata_after: copy(b.metadata), coordinate_basis_after: b.coordinate_basis };
}
function applyLiteralEffect(state: TransitionRecord, effect: TransitionRecord): TransitionRecord {
  const out = copy(state), removed = new Set(effect.remove_indices), moves = new Map<number, Point>(effect.entity_translations.map((update: TransitionRecord) => [update.before_index, update.translation]));
  const entities: TransitionRecord[] = [];
  for (const [index, entity] of (out.entities as TransitionRecord[]).entries()) {
    if (removed.has(index)) continue;
    const delta = moves.get(index);
    if (delta) entity.position = [entity.position[0] + delta[0], entity.position[1] + delta[1]];
    entities.push(entity);
  }
  entities.push(...copy(effect.add_entities));
  const ordered = entities.map(value => ({ value, key: canonical(value) })).sort((a, b) => compareUnicode(a.key, b.key));
  out.entities = ordered.map(item => item.value); out.metadata = copy(effect.metadata_after); out.coordinate_basis = effect.coordinate_basis_after; return out;
}
function bindVariables(conditions: TransitionRecord, observation: TransitionObservation, action: TransitionAction): TransitionRecord | null {
  if (!same(conditions.action, action) || !same(conditions.coordinate_basis, observation.coordinate_basis)) return null;
  const mode = Object.fromEntries(Object.keys(conditions.observable_mode).map(key => [key, observation[key] ?? null]));
  if (!same(mode, conditions.observable_mode)) return null;
  const bindings: TransitionRecord = {};
  for (const variable of conditions.variables) {
    const matches = observation.entities.filter(entity => same(shapeView(entity), variable.measured_shape));
    if (matches.length !== 1) return null;
    bindings[variable.name] = matches[0];
  }
  for (const relation of conditions.relations) {
    const a = support(bindings[relation.left]), b = support(bindings[relation.right]);
    if (a === null || b === null || intersects(a, b) !== relation.overlap) return null;
  }
  return bindings;
}
function positionContext(bindings: TransitionRecord): TransitionRecord {
  return Object.fromEntries(sortedStrings(Object.keys(bindings)).map(key => [key, [...position(bindings[key])]]));
}

export async function constructEmpiricalRule(before: TransitionObservation, after: TransitionObservation, action: TransitionAction): Promise<TransitionRecord> {
  checkNeutralTransition(before, after, action);
  const observed = await evidence(before, after, action), [pairs, unresolved] = await matching(before, after);
  const rigid: { a: TransitionRecord; b: TransitionRecord; delta: Point }[] = [];
  for (const [a, b] of pairs) {
    const delta: Point = [position(b)[0] - position(a)[0], position(b)[1] - position(a)[1]], sa = support(a), sb = support(b);
    if (same(shapeView(a), shapeView(b)) && (sa === null || sb === null || supportsEqual(translated(sa, delta), sb))) rigid.push({ a, b, delta });
  }
  const structural = rigid.some(pair => !same(pair.delta, [0, 0])) && rigid.length <= 32 &&
    same(before.coordinate_basis, after.coordinate_basis) && before.coordinate_basis != null;
  let conditions: TransitionRecord, effect: TransitionRecord, scope: TransitionRecord, kind: string, status: string;
  if (structural) {
    const variables = rigid.map(({ a }, index) => ({ name: `v${index}`, measured_shape: shape(a), unique: true }));
    const relations: TransitionRecord[] = [];
    for (const [i, { a }] of rigid.entries()) for (const [j, { a: c }] of rigid.slice(0, i).entries()) {
      const sa = support(a), sc = support(c);
      if (sa !== null && sc !== null) relations.push({ left: `v${i}`, right: `v${j}`, overlap: intersects(sa, sc) });
    }
    conditions = { action: copy(action), coordinate_basis: before.coordinate_basis, variables, relations,
      observable_mode: Object.fromEntries(['state', 'level_epoch', 'available_action_refs', 'context_scope'].filter(key => has(before, key)).map(key => [key, copy(before[key])])) };
    effect = { variable_translations: Object.fromEntries(rigid.map(({ delta }, index) => [`v${index}`, [...delta]])) };
    observed.position_context = Object.fromEntries(rigid.map(({ a }, index) => [`v${index}`, [...position(a)]]));
    kind = 'translation_relation'; status = 'candidate';
    scope = { kind: 'measured_shape_action_and_spatial_relation_conditions', position_generalization: 'requires_independent_changed_position_confirmation',
      mode: conditions.observable_mode, exact_support_measured: rigid.every(({ a, b }) => support(a) !== null && support(b) !== null),
      unmodeled_before_entities: before.entities.length - rigid.length, unresolved_correspondences: unresolved.length };
  } else {
    conditions = literalConditions(before, action); effect = literalEffect(before, after); kind = 'observed_transition'; status = 'empirical_transition_candidate';
    if (!same(applyLiteralEffect(observedStateView(before), effect), observedStateView(after))) throw new TypeError('Observed transition delta does not reproduce supplied evidence');
    scope = { kind: 'literal_observed_features_only', generalized_mechanism_construction: 'not_implemented_for_this_effect', predictive_acquisition: 'forbidden_for_transition_replay' };
  }
  return { rule_id: `empirical:${await digest([kind, conditions, effect])}`, rule_family: kind, status, predictive_use_allowed: false,
    conditions, effect, validation_evidence: [observed], evidence_refs: [observed.before, observed.after], counterexamples: [], independent_confirmations: 1, scope,
    uncertainty: ['one_transition_is_not_a_law', 'unmeasured_state_and_control_changes_not_excluded', 'observed_association_is_not_universal_causation'] };
}

export async function predictCandidateRule(rule: TransitionRecord, observation: TransitionObservation, action: TransitionAction): Promise<TransitionRecord> {
  if (rule.rule_family !== 'translation_relation' || rule.status === 'refuted') return { status: 'unknown', rule_id: rule.rule_id, reason: 'no_operational_nonrefuted_structural_rule' };
  const bindings = bindVariables(rule.conditions, observation, action);
  if (bindings === null) return { status: 'not_applicable', rule_id: rule.rule_id, reason: 'measured_shape_action_mode_or_relation_condition_differs' };
  const predicted: TransitionRecord[] = [];
  for (const name of sortedStrings(Object.keys(bindings))) {
    const entity = neutralEntity(bindings[name]), delta = rule.effect.variable_translations[name];
    entity.position = [entity.position[0] + delta[0], entity.position[1] + delta[1]]; predicted.push({ variable: name, entity });
  }
  return { status: 'conditional_prediction', rule_id: rule.rule_id, rule_digest: await digest(rule), observation_ref: transitionObservationRef(observation),
    predicted_entities: predicted, position_context: positionContext(bindings), conditions: copy(rule.conditions), scope: copy(rule.scope),
    predictive_use_allowed: truth(rule.predictive_use_allowed), uncertainty: copy(rule.uncertainty) };
}
function predictionMatches(prediction: TransitionRecord, after: TransitionObservation): boolean {
  const actual = after.entities.map(neutralView);
  return prediction.predicted_entities.every((item: TransitionRecord) => actual.filter(entity => same(entity, item.entity)).length === 1);
}
export async function applyEmpiricalRule(rule: TransitionRecord, observation: TransitionObservation, action: TransitionAction): Promise<TransitionRecord> {
  if (rule.status !== 'mechanism_acquired' || !truth(rule.predictive_use_allowed)) return { status: 'unknown', rule_id: rule.rule_id ?? null,
    reason: 'independent_changed_context_validation_required' };
  const prediction = await predictCandidateRule(rule, observation, action);
  if (prediction.status === 'conditional_prediction') prediction.status = 'prediction';
  return prediction;
}
export async function validateEmpiricalRule(rule: TransitionRecord, before: TransitionObservation, after: TransitionObservation, action: TransitionAction): Promise<TransitionRecord> {
  return validateRule(rule, before, after, action, false);
}
/** Internal persistent update; unchanged rule conditions/effects keep identity. */
export async function validateRetainedEmpiricalRule(rule: TransitionRecord, before: TransitionObservation, after: TransitionObservation, action: TransitionAction): Promise<TransitionRecord> {
  return retainNativeJson(await validateRule(retainNativeJson(rule), before, after, action, true));
}
async function validateRule(rule: TransitionRecord, before: TransitionObservation, after: TransitionObservation, action: TransitionAction, retained: boolean): Promise<TransitionRecord> {
  checkNeutralTransition(before, after, action);
  const updated = retained ? { ...rule } : copy(rule), observed = await evidence(before, after, action);
  const seen = new Set([...rule.validation_evidence, ...rule.counterexamples].map(item => item.transition_ref));
  if (seen.has(observed.transition_ref)) { updated.last_validation = { status: 'duplicate_evidence_not_independent' }; return updated; }
  let confirmed: boolean, changed: boolean;
  if (rule.rule_family === 'translation_relation') {
    const prediction = await predictCandidateRule(rule, before, action);
    if (prediction.status !== 'conditional_prediction') { updated.last_validation = { status: prediction.status }; return updated; }
    confirmed = predictionMatches(prediction, after); observed.position_context = prediction.position_context;
    observed.frozen_rule_digest = prediction.rule_digest; observed.prediction_digest = await digest(prediction.predicted_entities);
    changed = rule.validation_evidence.every((item: Evidence) => !same(item.position_context, prediction.position_context));
  } else {
    if (!same(rule.conditions, literalConditions(before, action, false))) { updated.last_validation = { status: 'not_applicable' }; return updated; }
    confirmed = same(applyLiteralEffect(observedStateView(before), rule.effect), observedStateView(after)); changed = false;
  }
  if (!confirmed) {
    updated.counterexamples = [...updated.counterexamples, { ...observed, observed_feature_digest: await digest(observedStateView(after)) }];
    Object.assign(updated, { status: 'refuted', predictive_use_allowed: false, last_validation: { status: 'refuted', evidence: observed.transition_ref } });
  } else {
    updated.validation_evidence = [...updated.validation_evidence, observed]; updated.independent_confirmations = updated.validation_evidence.length;
    if (rule.rule_family === 'translation_relation' && changed && rule.scope.exact_support_measured && !updated.counterexamples.length) {
      Object.assign(updated, { status: 'mechanism_acquired', predictive_use_allowed: true });
      updated.scope = { ...updated.scope, position_generalization: 'confirmed_on_independent_changed_positions_only' };
      updated.uncertainty = [...updated.uncertainty.filter((item: string) => item !== 'one_transition_is_not_a_law'), 'transfer_outside_measured_conditions_unproved'];
    } else if (rule.rule_family !== 'translation_relation') Object.assign(updated, { status: 'reproduced_transition', predictive_use_allowed: false });
    updated.last_validation = { status: 'confirmed', changed_position_context: changed, evidence: observed.transition_ref };
  }
  updated.evidence_refs = sortedStrings(new Set([...updated.evidence_refs, observed.before, observed.after])); return updated;
}
export async function assessTransition(before: TransitionObservation, after: TransitionObservation, action: TransitionAction,
  priorRules: readonly TransitionRecord[] = []): Promise<TransitionRecord> {
  return assessTransitionState(before, after, action, priorRules, false);
}
/** Native acquisition retains immutable rule subtrees while acquiring every check. */
export async function assessRetainedTransition(before: TransitionObservation, after: TransitionObservation, action: TransitionAction,
  priorRules: readonly TransitionRecord[] = []): Promise<TransitionRecord> {
  return retainNativeJson(await assessTransitionState(before, after, action, priorRules, true));
}
async function assessTransitionState(before: TransitionObservation, after: TransitionObservation, action: TransitionAction,
  priorRules: readonly TransitionRecord[], retained: boolean): Promise<TransitionRecord> {
  checkNeutralTransition(before, after, action);
  const observed = await evidence(before, after, action), library = await assessMechanicalLibrary(before, after, action, priorRules, observed);
  const updated = new Map<string, TransitionRecord>();
  for (const rule of priorRules) updated.set(rule.rule_id, await (retained ? validateRetainedEmpiricalRule : validateEmpiricalRule)(rule, before, after, action));
  const candidate = await constructEmpiricalRule(before, after, action);
  if (!updated.has(candidate.rule_id)) {
    const contradictory = priorRules.filter(rule => same(rule.conditions, candidate.conditions) && !same(rule.effect, candidate.effect));
    if (contradictory.length) {
      candidate.counterexamples = contradictory.flatMap(rule => rule.validation_evidence.map((item: Evidence) => ({ ...copy(item), reason: 'contrary_observed_effect_under_same_conditions' })));
      candidate.status = 'refuted'; candidate.predictive_use_allowed = false; candidate.uncertainty.push('additional_observable_condition_or_nondeterministic_model_required');
    }
    updated.set(candidate.rule_id, candidate);
  }
  const rules = [...updated.values()], applications = [];
  for (const rule of rules) if (rule.status === 'mechanism_acquired') applications.push(await applyEmpiricalRule(rule, before, action));
  return { schema: MECHANISM_SCHEMA, evidence_refs: [observed.before, observed.after], library, empirical_rules: rules,
    construction: { status: updated.get(candidate.rule_id)!.status, rule_id: candidate.rule_id, catalog_absence_does_not_discard_transition: true,
      generalized_induction_beyond_translation: 'not_implemented' }, predictive_applications: applications, release_authority: false,
    limitations: ['no_object_role_or_goal_assignment', 'contact_push_compatibility_not_driver_causation', 'stationarity_not_proof_of_blocking', 'reflection_toggle_and_general_context_induction_not_implemented'] };
}

function properties(entity: TransitionRecord): TransitionRecord {
  const result: TransitionRecord = {};
  const signature = entity.signature && typeof entity.signature === 'object' && !Array.isArray(entity.signature) ? entity.signature : {};
  for (const key of ['palette_value', 'area', 'scale']) {
    if (has(entity, key)) result[key] = entity[key]; else if (has(signature, key)) result[key] = signature[key];
  }
  for (const [key, value] of Object.entries(has(entity, 'properties') ? entity.properties : {})) {
    if (FORBIDDEN_TRANSITION_FIELDS.has(key)) throw new TypeError('Non-neutral property input');
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) result[key] = copy(value);
  }
  return result;
}
function propertyGeometry(entity: TransitionRecord): TransitionRecord | null {
  const points = support(entity);
  if (points === null) return null;
  const [x, y] = position(entity);
  return { relative_support: [...points.values()].map(([px, py]): Point => [px - x, py - y]).sort(comparePoint) };
}
function absoluteKey(entity: TransitionRecord): string | null {
  const points = support(entity); return points === null ? null : canonical([...points.values()].map(([x, y]): Point => [Number(x), Number(y)]).sort(comparePoint));
}
function propertyContext(observation: TransitionObservation): TransitionRecord {
  return Object.fromEntries(['level_epoch', 'state', 'available_action_refs', 'context_scope'].filter(key => has(observation, key)).map(key => [key, copy(observation[key])]));
}
function actionTemplate(action: TransitionAction): TransitionRecord | null {
  const data = action.data ?? {};
  if (typeof data !== 'object' || data === null || Array.isArray(data) || ['x', 'y'].some(key => !(typeof data[key] === 'number' || typeof data[key] === 'boolean'))) return null;
  return { action_ref: action.action_ref, other_data: Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'x' && key !== 'y').map(([key, value]) => [key, copy(value)])) };
}
function bindProperty(rule: TransitionRecord, observation: TransitionObservation, action: TransitionAction): [TransitionRecord | null, string | null] {
  const conditions = rule.conditions;
  if (!same(observation.coordinate_basis, conditions.coordinate_basis) || !same(actionTemplate(action), conditions.action_template)) return [null, 'coordinate_or_action_template_differs'];
  const point: Point = [action.data!.x, action.data!.y], matches: TransitionRecord[] = [];
  for (const entity of observation.entities) {
    const points = support(entity);
    if (points === null || !points.has(pointKey(point))) continue;
    const [x, y] = position(entity);
    if (!same([point[0] - x, point[1] - y], conditions.address.relative_point) || !same(propertyGeometry(entity), conditions.bearer_geometry)) continue;
    const measured = properties(entity);
    if (Object.entries(conditions.before_properties).some(([key, value]) => !has(measured, key) || !same(measured[key], value))) continue;
    matches.push(entity);
  }
  return matches.length === 1 ? [matches[0]!, null] : [null, 'bearer_binding_missing_or_ambiguous'];
}
function applyProperties(measured: TransitionRecord, effect: TransitionRecord): TransitionRecord {
  const result = copy(measured);
  for (const operation of effect.property_operations) {
    if (operation.operator !== 'assign_observed_value') throw new TypeError('Unknown property rewrite operator');
    result[operation.property] = copy(operation.value);
  }
  return result;
}

export async function constructPropertyRule(before: TransitionObservation, after: TransitionObservation, action: TransitionAction): Promise<TransitionRecord> {
  checkNeutralTransition(before, after, action); const observed = await evidence(before, after, action);
  if (before.coordinate_basis == null || !same(before.coordinate_basis, after.coordinate_basis)) return { status: 'unknown', reason: 'coordinate_basis_not_bound', evidence: observed, rule: null };
  const template = actionTemplate(action);
  if (template === null) return { status: 'unknown', reason: 'no_observed_point_to_bind_bearer; nonpoint_identity_induction_not_implemented', evidence: observed, rule: null };
  const point: Point = [action.data!.x, action.data!.y];
  const left = new Map<string, TransitionRecord[]>(), right = new Map<string, TransitionRecord[]>();
  for (const [observation, map] of [[before, left], [after, right]] as const) for (const entity of observation.entities) {
    const key = absoluteKey(entity); if (key === null) continue; const list = map.get(key) ?? []; list.push(entity); map.set(key, list);
  }
  const candidates: { old: TransitionRecord; next: TransitionRecord; changes: TransitionRecord }[] = []; let ambiguous = 0;
  for (const [key, entities] of left) {
    if (!(JSON.parse(key) as Point[]).some(pixel => same(pixel, point))) continue;
    const afterEntities = right.get(key) ?? [];
    if (entities.length !== 1 || afterEntities.length !== 1) { ambiguous++; continue; }
    const old = entities[0]!, next = afterEntities[0]!;
    if (!same(position(old), position(next))) continue;
    const oldValues = properties(old), newValues = properties(next), changes: TransitionRecord = {};
    for (const key of Object.keys(oldValues)) if (has(newValues, key) && !same(oldValues[key], newValues[key])) changes[key] = newValues[key];
    if (Object.keys(changes).length) candidates.push({ old, next, changes });
  }
  if (candidates.length !== 1) return { status: 'unknown', reason: 'no_unique_addressed_property_change_with_exact_persistent_support',
    candidate_count: candidates.length, ambiguous_support_count: ambiguous, evidence: observed, rule: null };
  const { old, changes } = candidates[0]!, [x, y] = position(old);
  const conditions = { coordinate_basis: before.coordinate_basis, action_template: template,
    address: { relation: 'input_point_in_exact_support', relative_point: [point[0] - x, point[1] - y] },
    bearer_geometry: propertyGeometry(old), before_properties: properties(old) };
  const effect = { property_operations: sortedStrings(Object.keys(changes)).map(key => ({ property: key, operator: 'assign_observed_value', value: copy(changes[key]) })), preserve_geometry: true, preserve_position: true };
  observed.position_context = [...position(old)]; observed.observable_context = propertyContext(before);
  const rule = { rule_id: `property:${await digest([conditions, effect])}`, rule_family: 'observable_property_rewrite', status: 'candidate', predictive_use_allowed: false,
    conditions, effect, validation_evidence: [observed], evidence_refs: [observed.before, observed.after], counterexamples: [], independent_confirmations: 1,
    validated_contexts: [], scope: { kind: 'variable_bearer_with_measured_shape_properties_and_address_relation',
      causal_status: 'unconfirmed_action_property_association', unmodeled_other_entities: before.entities.length - 1, transfer: 'unproved' },
    uncertainty: ['one_example_not_a_law', 'contextual_instructions_or_hidden_state_may_change_rewrite', 'autonomous_step_dynamics_not_excluded', 'only_addressed_bearer_properties_predicted'] };
  return { status: 'candidate_constructed', evidence: observed, rule, observed_changes: changes };
}
export async function predictPropertyRule(rule: TransitionRecord, observation: TransitionObservation, action: TransitionAction): Promise<TransitionRecord> {
  if (rule.status === 'refuted') return { status: 'unknown', rule_id: rule.rule_id, reason: 'counterexample_retained_requires_condition_refinement' };
  const [entity, reason] = bindProperty(rule, observation, action);
  if (entity === null) return { status: 'not_applicable', rule_id: rule.rule_id, reason };
  const context = propertyContext(observation), known = rule.validated_contexts.some((item: TransitionRecord) => same(item, context));
  return { status: 'conditional_prediction', rule_id: rule.rule_id, rule_digest: await digest(rule), observation_ref: transitionObservationRef(observation),
    binding: { variable: 'bearer', observed_entity_ref: entity.id ?? null, position: [...position(entity)], geometry: propertyGeometry(entity) },
    expected_properties: applyProperties(properties(entity), rule.effect), observable_context: context,
    predictive_use_allowed: truth(rule.predictive_use_allowed) && known, scope: copy(rule.scope),
    uncertainty: [...copy(rule.uncertainty), ...known ? [] : ['observable_context_not_independently_validated']], release_authority: false };
}
export async function applyPropertyRule(rule: TransitionRecord, observation: TransitionObservation, action: TransitionAction): Promise<TransitionRecord> {
  const prediction = await predictPropertyRule(rule, observation, action);
  if (truth(prediction.predictive_use_allowed) && rule.status === 'mechanism_acquired') prediction.status = 'prediction';
  else if (prediction.status === 'conditional_prediction') { prediction.status = 'unknown'; prediction.reason = 'independent_validation_in_current_observable_context_required'; }
  return prediction;
}
export async function validatePropertyRule(rule: TransitionRecord, before: TransitionObservation, after: TransitionObservation, action: TransitionAction): Promise<TransitionRecord> {
  checkNeutralTransition(before, after, action); const updated = copy(rule), observed = await evidence(before, after, action);
  const used = new Set([...rule.validation_evidence, ...rule.counterexamples].map(item => item.transition_ref));
  if (used.has(observed.transition_ref)) { updated.last_validation = { status: 'duplicate_evidence_not_independent' }; return updated; }
  const prediction = await predictPropertyRule(rule, before, action);
  if (prediction.status !== 'conditional_prediction') { updated.last_validation = { status: prediction.status, reason: prediction.reason ?? null }; return updated; }
  const [old] = bindProperty(rule, before, action), key = absoluteKey(old!);
  const matches = after.entities.filter(entity => absoluteKey(entity) === key && same(position(entity), position(old!)));
  if (matches.length !== 1) { updated.last_validation = { status: 'unknown', reason: 'after_identity_or_geometry_ambiguous; no_property_counterexample_asserted', evidence: observed }; return updated; }
  const measured = properties(matches[0]!), expected = prediction.expected_properties;
  if (Object.keys(expected).some(key => !has(measured, key))) { updated.last_validation = { status: 'unknown', reason: 'expected_properties_unmeasured_after' }; return updated; }
  Object.assign(observed, { position_context: prediction.binding.position, observable_context: prediction.observable_context,
    frozen_rule_digest: prediction.rule_digest, prediction: expected });
  const differences: TransitionRecord = {};
  for (const [key, value] of Object.entries(expected)) if (!same(measured[key], value)) differences[key] = { predicted: value, observed: measured[key] };
  updated.evidence_refs = sortedStrings(new Set([...updated.evidence_refs, observed.before, observed.after]));
  if (Object.keys(differences).length) {
    updated.counterexamples.push({ ...observed, differences });
    Object.assign(updated, { status: 'refuted', predictive_use_allowed: false, last_validation: { status: 'refuted', differences, evidence: observed.transition_ref } }); return updated;
  }
  const changed = rule.validation_evidence.some((item: Evidence) => !same(item.position_context, observed.position_context));
  updated.validation_evidence.push(observed); updated.independent_confirmations = updated.validation_evidence.length;
  const sameContext = updated.validation_evidence.filter((item: Evidence) => same(item.observable_context, observed.observable_context));
  const varied = new Set(sameContext.map((item: Evidence) => canonical(item.position_context))).size >= 2;
  if (varied && !updated.counterexamples.length) {
    Object.assign(updated, { status: 'mechanism_acquired', predictive_use_allowed: true });
    if (!updated.validated_contexts.some((item: TransitionRecord) => same(item, observed.observable_context))) updated.validated_contexts.push(observed.observable_context);
    updated.scope.causal_status = 'locally_supported_property_relation; exclusive_causation_not_proved';
    updated.uncertainty = updated.uncertainty.filter((item: string) => item !== 'one_example_not_a_law');
  }
  updated.last_validation = { status: 'confirmed', changed_position_context: changed, current_mode_independently_supported: varied, evidence: observed.transition_ref };
  updated.evidence_refs = sortedStrings(new Set([...updated.evidence_refs, observed.before, observed.after])); return updated;
}
export async function assessPropertyTransition(before: TransitionObservation, after: TransitionObservation, action: TransitionAction,
  priorRules: readonly TransitionRecord[] = []): Promise<TransitionRecord> {
  const construction = await constructPropertyRule(before, after, action), updated = new Map<string, TransitionRecord>();
  for (const rule of priorRules) updated.set(rule.rule_id, await validatePropertyRule(rule, before, after, action));
  const candidate = construction.rule;
  if (candidate !== null && !updated.has(candidate.rule_id)) {
    const conflicting = priorRules.filter(rule => same(rule.conditions, candidate.conditions) && !same(rule.effect, candidate.effect));
    if (conflicting.length) {
      candidate.counterexamples = conflicting.flatMap(rule => rule.validation_evidence.map((item: Evidence) => ({ ...copy(item), reason: 'contrary_observed_property_rewrite_with_same_declared_conditions' })));
      candidate.status = 'refuted'; candidate.predictive_use_allowed = false;
      candidate.uncertainty.push('missing_condition_requires_discovery; do_not_select_by_game_or_level_name');
    }
    updated.set(candidate.rule_id, candidate);
  }
  return { schema: PROPERTY_REWRITE_SCHEMA, evidence_refs: [transitionObservationRef(before), transitionObservationRef(after)],
    construction: Object.fromEntries(Object.entries(construction).filter(([key]) => key !== 'rule')), property_rules: [...updated.values()],
    unexplained_transition_retained: construction.status === 'unknown', release_authority: false,
    limitations: ['exact_support_identity_required', 'nonpoint_bearer_binding_not_implemented', 'only_observed_scalar_properties_rewritten', 'contextual_condition_induction_after_refutation_remains_open'] };
}

export function projectedReceivers(prediction: TransitionRecord): TransitionRecord {
  return Object.fromEntries(prediction.predicted_entities.map((item: TransitionRecord) => [item.variable, {
    signature: item.entity.signature, before: prediction.position_context[item.variable], expected_after: item.entity.position }]));
}
export class ControlDependencies {
  pending: [TransitionObservation, TransitionObservation, TransitionRecord] | null = null;
  attempted = new Set<string>();

  static questionKey(epoch: unknown, relation: unknown, features: unknown, receivers: unknown): Promise<string> {
    return v6Digest([epoch, relation, features, receivers]);
  }
  recordAttempt(key: string): void {
    if (this.attempted.has(key)) throw new TypeError('Repeated control experiment in the same declared context');
    this.attempted.add(key);
  }
  change(before: TransitionObservation, after: TransitionObservation, pointResult: TransitionRecord | null): void {
    this.pending = null; const witness = (pointResult ?? {}).record ?? {};
    if (truth(witness.observed_local_change) && witness.observation_ref === before.observation_ref && witness.after_ref === after.observation_ref &&
      same(before.level_epoch, after.level_epoch) && same(before.state, after.state)) this.pending = [before, after, witness];
  }
  async offer(observation: TransitionObservation, actions: readonly TransitionAction[], rules: readonly TransitionRecord[]): Promise<TransitionRecord | null> {
    if (this.pending === null) return null;
    const [before, after, witness] = this.pending;
    if (observation.observation_ref !== after.observation_ref || observation.frame_hash !== after.frame_hash) return null;
    const inputs = new Set(actions.filter(action => !truth(action.data)).map(action => action.action_ref)), offers: TransitionRecord[] = [];
    for (const rule of rules) {
      const command = rule.conditions?.action ?? {};
      if (rule.status !== 'mechanism_acquired' || !inputs.has(command.action_ref) || truth(command.data)) continue;
      const action = { action_ref: command.action_ref };
      const pre = await applyEmpiricalRule(rule, before, action), post = await applyEmpiricalRule(rule, observation, action);
      if (pre.status !== 'prediction' || post.status !== 'prediction') continue;
      const receivers = projectedReceivers(post);
      if (!Object.keys(receivers).length || !same(projectedReceivers(pre), receivers)) continue;
      const key = await v6Digest([observation.level_epoch, rule.rule_id, witness.features, receivers]);
      if (this.attempted.has(key)) continue;
      offers.push({ kind: 'control_after_local_change', question_key: key, rule_ref: rule.rule_id,
        binding: { observation_ref: observation.observation_ref, frame_hash: observation.frame_hash, mode: [observation.level_epoch, observation.state], action },
        expected_receivers: receivers, evidence_refs: [...new Set([before.observation_ref, after.observation_ref, ...rule.evidence_refs])],
        intervention: { before: before.observation_ref, after: after.observation_ref, action: witness.action, entity_ref: witness.entity_ref },
        question: 'Does the acquired receiver response persist after the observed local change?',
        falsifier: 'A uniquely reidentified receiver differs from its predicted screen position; a boundary or ambiguous correspondence yields unknown.',
        qualification: 'Persistence or divergence in this public context; exclusive causal role and terminal relevance remain unknown.' });
    }
    offers.sort((a, b) => compareUnicode(a.question_key, b.question_key)); return offers[0] ?? null;
  }
  evaluate(selected: TransitionRecord, before: TransitionObservation, action: TransitionAction, after: TransitionObservation): TransitionRecord {
    const binding = selected.binding;
    if (before.observation_ref !== binding.observation_ref || before.frame_hash !== binding.frame_hash || !same(action, binding.action) || this.attempted.has(selected.question_key)) {
      throw new TypeError('Stale, repeated, or mismatched control experiment');
    }
    const receipts: TransitionRecord = {};
    for (const [name, receiver] of Object.entries(selected.expected_receivers) as [string, TransitionRecord][]) {
      const hits = after.entities.filter(entity => same(entity.signature, receiver.signature)).map(entity => entity.position);
      receipts[name] = { expected: receiver.expected_after, observed: hits.length === 1 ? hits[0] : null };
    }
    const boundary = !same(after.level_epoch, before.level_epoch) || !same(after.state, before.state);
    const verdict = boundary || Object.values(receipts).some(receipt => receipt.observed === null) ? 'unknown_boundary_or_identity' :
      Object.values(receipts).every(receipt => same(receipt.expected, receipt.observed)) ? 'matched_projected_response' : 'projected_response_differs';
    this.attempted.add(selected.question_key);
    return { question_key: selected.question_key, before: before.observation_ref, after: after.observation_ref, rule_ref: selected.rule_ref,
      verdict, receivers: receipts, attempted_once: true, exclusive_cause_established: false };
  }
}

export function preservationConditionMeasure(obligation: TransitionRecord, rows: NativeRows, observation?: TransitionObservation | null): TransitionRecord {
  const predicate = obligation.entity_predicate;
  if (truth(predicate)) {
    if (observation == null || !has(observation, 'entities')) return { matched: false, visible: 0, occluded: 0, reason: 'entity_projection_required' };
    const matching = observation.entities.filter(entity => {
      const [left, top, right, bottom] = entity.bbox;
      const excluded = (predicate.exclude_boxes ?? []).some((box: number[]) => box[0]! <= left && box[1]! <= top && right <= box[2]! && bottom <= box[3]!);
      return same(entity.palette_value, predicate.palette_value) && truth(entity.rectangular) && right - left === bottom - top && !excluded;
    });
    return { matched: matching.length >= predicate.minimum_count, visible: matching.length, occluded: 0,
      minimum_count: predicate.minimum_count, scope: 'visible_typed_occurrence_count' };
  }
  const covered = new Set<string>(), pattern = obligation.occluder_mask;
  if (truth(pattern) && truth(observation)) for (const entity of observation!.entities ?? []) if (same(entity.mask, pattern)) {
    const [left, top] = entity.position;
    for (const [x, y] of pattern) covered.add(pointKey([left + x, top + y]));
  }
  const visible = obligation.pixels.filter(([x, y]: number[]) => !covered.has(pointKey([x!, y!])));
  return { matched: visible.every(([x, y, value]: number[]) => same(rows[y!]![x!], value)), visible: visible.length, occluded: obligation.pixels.length - visible.length };
}
export function authorizedPreservationRevision(proposal: TransitionRecord, obligation: TransitionRecord, observation: TransitionObservation): unknown {
  const revision = proposal.preservation_changes?.[obligation.id];
  if (!truth(revision)) return false;
  const commands: TransitionAction[] = proposal.actions, declared = revision.actions;
  const bound = declared != null ? same(declared, commands) && commands.every(command => command.action_ref === revision.action_ref) :
    commands.length === 1 && commands[0]!.action_ref === revision.action_ref;
  if (revision.observation_ref !== observation.observation_ref) return false;
  if (!truth(revision.why)) return revision.why ?? null;
  if (!truth(revision.expected_reestablishment)) return revision.expected_reestablishment ?? null;
  return (!truth(obligation.revision_inputs) || obligation.revision_inputs.includes(revision.action_ref)) && bound;
}
export function bindPreservation(proposal: TransitionRecord, obligations: readonly TransitionRecord[], observation: TransitionObservation,
  rows: NativeRows): [proposal: TransitionRecord, rejected: TransitionAction[]] {
  if (!obligations.length || proposal.status !== 'proposed') return [proposal, []];
  const rejected: TransitionAction[] = [];
  for (const obligation of obligations) {
    if (!preservationConditionMeasure(obligation, rows, observation).matched) return [{ ...proposal, status: 'acquired_preservation_condition_changed', actions: [] }, []];
    if (!truth(authorizedPreservationRevision(proposal, obligation, observation))) {
      rejected.push(...proposal.actions.filter((command: TransitionAction) => (obligation.revision_inputs ?? []).includes(command.action_ref)));
    }
  }
  if (rejected.length) return [proposal, rejected];
  const result = copy(proposal), template = result.bundle_template;
  template.preservation_evidence ??= {}; template.preserve_refs ??= [];
  for (const obligation of obligations) {
    const reference = obligation.id;
    if (!template.preserve_refs.includes(reference)) template.preserve_refs.push(reference);
    template.preservation_evidence[reference] = { observation_ref: observation.observation_ref, witness_refs: obligation.evidence,
      current_condition_measure: preservationConditionMeasure(obligation, rows, observation), declared_revision: copy(result.preservation_changes?.[reference] ?? null) };
    result.compositions.push({ id: reference, role: 'preserved_condition', observed: true,
      properties: { condition: obligation.meaning, scope: 'current_epoch' }, relations: ['contributes_to:G_official_completion'] });
  }
  result.preservation = { obligations: copy(obligations), level_epoch: observation.level_epoch, observation_ref: observation.observation_ref,
    revised_refs: obligations.filter(obligation => truth(authorizedPreservationRevision(result, obligation, observation))).map(obligation => obligation.id) };
  return [result, []];
}
export function checkPreservation(proposal: TransitionRecord, rows: NativeRows, epoch: number,
  options: { after?: boolean; boundary?: boolean; observation?: TransitionObservation | null } = {}): TransitionRecord {
  const bound = proposal.preservation;
  if (!truth(bound)) return { admitted: true, reason: 'no_acquired_preservation_obligation' };
  if (options.after && options.boundary) return { admitted: true, seal_prefix: true, reason: 'official_boundary_reconciles_preservation' };
  if (!same(epoch, bound.level_epoch)) return { admitted: false, seal_prefix: true, reason: 'preservation_epoch_changed' };
  const changed: string[] = [], unknown: string[] = [];
  for (const obligation of bound.obligations) {
    const revision = proposal.preservation_changes?.[obligation.id] ?? {};
    if (options.after && (bound.revised_refs ?? []).includes(obligation.id) && truth(has(revision, 'revise_condition') ? revision.revise_condition : true)) continue;
    const measured = preservationConditionMeasure(obligation, rows, options.observation);
    if (!measured.matched) changed.push(obligation.id);
    if (!truth(measured.visible) && truth(measured.occluded)) unknown.push(obligation.id);
  }
  return { admitted: !changed.length, seal_prefix: Boolean(changed.length || unknown.length),
    reason: changed.length ? 'acquired_condition_diverged' : 'acquired_conditions_matched', changed_refs: changed, occluded_unknown_refs: unknown };
}

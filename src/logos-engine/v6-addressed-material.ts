/** Common native owner for the source observed_addressed_material entry.
 * Source AddressedMaterial only completes observations around the field guards.
 * Checkpoints and cooperative search refusals below are named native extensions;
 * neither is an additional source acquisition or a physical-action authority. */
import { AddressedField, ADDRESSED_FIELD_SOURCE_POLICY, center, type AddressedFieldPolicy } from './v6-addressed-field.ts';
import { FieldStock } from './v6-field-stock.ts';
import { LinkedTemporalPreparation } from './v6-linked-temporal-preparation.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { AddressedWork, AddressedWorkBound, addressedClone as clone, addressedContains as contains,
  addressedEqual as equal, addressedKey as key, type AddressedRecord as R, type AddressedSearchBounds } from './v6-addressed-material-common.ts';
import type { NativeAfterResult, NativeBeforeResult, NativeCommand, NativeExecution, NativeFamily, NativeObservation,
  NativeProposal, NativePublicObservation, NativeRecord, NativeRecordResult, NativeRows } from './v6-native-types.ts';

export { ADDRESSED_FIELD_SOURCE_POLICY } from './v6-addressed-field.ts';
export { ADDRESSED_NATIVE_SEARCH_BOUNDS, AddressedWorkBound } from './v6-addressed-material-common.ts';
export interface AddressedMaterialOptions { boundedSearch?: AddressedSearchBounds }
export const ADDRESSED_MATERIAL_STATE_SCHEMA = 'logos-engine.addressed-material.v1';
const sourceFields = ['policy', 'epoch', 'model', 'samples', 'indicator', 'lower_squared', 'upper_squared', 'calibration', 'events', 'passed', 'prior', 'stock'] as const;
const validatedCheckpoints = new WeakSet<object>(), validatedEntities = new WeakSet<object>(), validatedSamples = new WeakSet<object>();

function invalid(label: string): never { throw new TypeError('Invalid addressed material ' + label); }
function object(value: any, label: string): asserts value is R { if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(label); }
function array(value: any, label: string): asserts value is any[] { if (!Array.isArray(value)) invalid(label); }
function integer(value: any, label: string, minimum = Number.MIN_SAFE_INTEGER): void { if (!Number.isSafeInteger(value) || value < minimum) invalid(label); }
function string(value: any, label: string): void { if (typeof value !== 'string') invalid(label); }
function boolean(value: any, label: string): void { if (typeof value !== 'boolean') invalid(label); }
function palette(value: any, label: string): void { integer(value, label, 0); if (value > 255) invalid(label); }
function fields(value: R, required: readonly string[], label: string, optional: readonly string[] = []): void {
  const allowed = new Set([...required, ...optional]);
  for (const name of required) if (!Object.hasOwn(value, name)) invalid(label + ' missing ' + name);
  if (Object.keys(value).some(name => !allowed.has(name))) invalid(label + ' unexpected field');
}
function point(value: any, label: string, minimum = Number.MIN_SAFE_INTEGER): void {
  array(value, label); if (value.length !== 2) invalid(label); value.forEach(n => integer(n, label, minimum));
}
function box(value: any, label: string): void {
  array(value, label); if (value.length !== 4) invalid(label); value.forEach(n => integer(n, label, 0));
  if (value[0] > value[2] || value[1] > value[3]) invalid(label + ' order');
}
function strings(value: any, label: string): void { array(value, label); value.forEach(v => string(v, label)); }
function mask(value: any, size: any, label: string, exactExtent = true): void {
  array(value, label); point(size, label + ' size', 1); if (!value.length) invalid(label + ' empty');
  const seen = new Set<string>(); let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const p of value) { point(p, label + ' point', 0); const k = key(p); if (seen.has(k) || p[0] >= size[0] || p[1] >= size[1]) invalid(label + ' support'); seen.add(k);
    left = Math.min(left, p[0]); top = Math.min(top, p[1]); right = Math.max(right, p[0]); bottom = Math.max(bottom, p[1]); }
  if (exactExtent && (left !== 0 || top !== 0 || right + 1 !== size[0] || bottom + 1 !== size[1])) invalid(label + ' extent');
}
function entity(value: any, label: string): void {
  object(value, label); if (validatedEntities.has(value)) return;
  for (const name of ['id', 'signature', 'identity_scope']) string(value[name], label + ' ' + name);
  box(value.bbox, label + ' box'); point(value.position, label + ' position', 0);
  if (!equal(value.position, value.bbox.slice(0, 2))) invalid(label + ' position and box');
  const size = [value.bbox[2] - value.bbox[0] + 1, value.bbox[3] - value.bbox[1] + 1]; mask(value.mask, size, label + ' mask');
  integer(value.area, label + ' area', 1); integer(value.scale, label + ' scale', 1); palette(value.palette_value, label + ' palette');
  boolean(value.rectangular, label + ' rectangular'); boolean(value.identity_ambiguous, label + ' identity ambiguity');
  if (value.area !== value.mask.length || value.rectangular !== (value.area === size[0]! * size[1]!)) invalid(label + ' geometry');
  validatedEntities.add(value);
}
function observation(value: any): void {
  object(value, 'current observation');
  for (const name of ['revision', 'level_epoch', 'levels_completed']) integer(value[name], 'current observation ' + name, 0);
  for (const name of ['observation_ref', 'frame_hash', 'state']) string(value[name], 'current observation ' + name);
  strings(value.available_action_refs, 'current action references'); array(value.entities, 'current entities');
  value.entities.forEach((e: any) => entity(e, 'current entity'));
}
function indicator(value: any): void {
  if (value === null) return; object(value, 'indicator'); fields(value, ['palette', 'axis_extent', 'first_box', 'transient_pixels', 'qualification'], 'indicator');
  palette(value.palette, 'indicator palette'); integer(value.axis_extent, 'indicator extent', 1); box(value.first_box, 'indicator box'); integer(value.transient_pixels, 'indicator pixel count', 1);
  const [left, top, right, bottom] = value.first_box;
  if (right - left !== 2 * value.axis_extent || bottom - top !== 2 * value.axis_extent || value.transient_pixels > (right - left + 1) * (bottom - top + 1)
    || value.qualification !== 'transient graphic only; physical influence remains a separate hypothesis') invalid('indicator measurement');
}
function model(value: any): void {
  if (value === null) return; object(value, 'field model');
  fields(value, ['signature', 'palette', 'mask', 'size', 'offset', 'position', 'exemplar', 'goal', 'action_ref', 'source_ref'], 'field model');
  string(value.signature, 'model signature'); palette(value.palette, 'model palette'); point(value.size, 'model size', 1); point(value.offset, 'model offset', 0); point(value.position, 'model position', 0);
  mask(value.mask, value.size, 'model mask'); if (value.offset[0] >= value.size[0] || value.offset[1] >= value.size[1]) invalid('model anchor offset');
  for (const name of ['action_ref', 'source_ref']) string(value[name], 'model ' + name);
  entity(value.exemplar, 'stationary exemplar'); object(value.goal, 'model goal'); fields(value.goal, ['shadow', 'enclosure'], 'model goal');
  entity(value.goal.shadow, 'goal shadow'); entity(value.goal.enclosure, 'goal enclosure');
  if (value.signature !== value.exemplar.signature || value.palette !== value.exemplar.palette_value || value.palette === value.goal.shadow.palette_value
    || !contains(value.goal.enclosure.bbox, value.goal.shadow.bbox) || !equal(center(value.goal.enclosure.bbox), center(value.goal.shadow.bbox))
    || equal(value.goal.enclosure.bbox, value.goal.shadow.bbox)) invalid('model observed bindings');
}
const sampleFields = ['before', 'after', 'point', 'old_position', 'new_position', 'distance_squared', 'moved_to_anchor', 'stationary'] as const;
function sample(value: any, event = false): void {
  object(value, 'sample'); if (!event && validatedSamples.has(value)) return;
  fields(value, event ? ['kind', ...sampleFields] : sampleFields, 'sample');
  for (const name of ['before', 'after']) string(value[name], 'sample ' + name);
  for (const name of ['point', 'old_position', 'new_position']) point(value[name], 'sample ' + name, 0);
  integer(value.distance_squared, 'sample distance', 0); boolean(value.moved_to_anchor, 'sample alignment'); boolean(value.stationary, 'sample stationary');
  if (value.moved_to_anchor === value.stationary || value.stationary !== equal(value.old_position, value.new_position)) invalid('sample movement');
  if (!event) validatedSamples.add(value);
}
function template(value: any): void {
  object(value, 'class template'); fields(value, ['size', 'offset', 'mask', 'alignment_supported'], 'class template');
  point(value.size, 'class size', 1); point(value.offset, 'class offset', 0); mask(value.mask, value.size, 'class mask'); boolean(value.alignment_supported, 'class alignment');
  if (value.offset[0] >= value.size[0] || value.offset[1] >= value.size[1]) invalid('class anchor offset');
}
function rule(value: any): void {
  object(value, 'retained rewrite'); fields(value, ['consumed_count', 'product', 'produced_count', 'confirmations', 'prior_evidence', 'evidence'], 'retained rewrite');
  if (value.consumed_count !== 2 || value.produced_count !== 1) invalid('retained rewrite counts');
  palette(value.product, 'rewrite product'); integer(value.confirmations, 'rewrite confirmations', 0); strings(value.prior_evidence, 'rewrite prior evidence'); strings(value.evidence, 'rewrite evidence');
  if (value.confirmations !== value.evidence.length) invalid('retained rewrite confirmations and evidence');
}
function prior(value: any): void {
  if (value === null) return; object(value, 'retained prior');
  fields(value, ['action_ref', 'lower_squared', 'upper_squared', 'boundary', 'request_row', 'goal_region', 'class_templates', 'qualification'], 'retained prior', ['observed_rules', 'type_order']);
  for (const name of ['action_ref', 'boundary', 'qualification']) string(value[name], 'prior ' + name);
  integer(value.lower_squared, 'prior accepted distance', 0); if (value.upper_squared !== null) integer(value.upper_squared, 'prior rejected distance', 0); integer(value.request_row, 'prior request row', 0);
  object(value.goal_region, 'prior goal region'); fields(value.goal_region, ['size', 'envelope'], 'prior goal region');
  mask(value.goal_region.envelope, value.goal_region.size, 'prior goal envelope', false);
  object(value.class_templates, 'prior templates');
  for (const [symbol, item] of Object.entries(value.class_templates)) { palette(Number(symbol), 'prior class symbol'); if (String(Number(symbol)) !== symbol) invalid('prior class key'); template(item); }
  if (Object.hasOwn(value, 'observed_rules') !== Object.hasOwn(value, 'type_order')) invalid('prior rewrite scope');
  if (Object.hasOwn(value, 'observed_rules')) {
    array(value.type_order, 'prior type order'); value.type_order.forEach((v: any) => palette(v, 'prior type')); if (new Set(value.type_order).size !== value.type_order.length) invalid('duplicate prior type');
    array(value.observed_rules, 'prior rewrite entries'); const seen = new Set<number>();
    for (const entry of value.observed_rules) { array(entry, 'prior rewrite entry'); if (entry.length !== 2) invalid('prior rewrite entry');
      palette(entry[0], 'prior rewrite symbol'); if (seen.has(entry[0])) invalid('duplicate prior rewrite'); seen.add(entry[0]); rule(entry[1]);
      if (!value.type_order.includes(entry[0]) || !value.type_order.includes(entry[1].product)) invalid('prior rewrite type order'); }
  }
}
function event(value: any): void {
  object(value, 'event');
  if (!Object.hasOwn(value, 'kind')) {
    fields(value, ['reason', 'before', 'after'], 'field refutation');
    if (!['unselected_material_changed_or_occluded', 'observed_rewrite_context_changed'].includes(value.reason)) invalid('field refutation reason');
    string(value.before, 'field refutation before'); string(value.after, 'field refutation after'); return;
  }
  string(value.kind, 'event kind');
  if (value.kind === 'addressed_field_response') { sample(value, true); return; }
  if (value.kind === 'field_rival_comparison') {
    fields(value, ['kind', 'observation', 'actual_anchor', 'compatible', 'refuted_here'], 'rival event'); string(value.observation, 'rival observation'); point(value.actual_anchor, 'rival anchor', 0);
    strings(value.compatible, 'compatible rivals'); strings(value.refuted_here, 'refuted rivals');
    if (new Set([...value.compatible, ...value.refuted_here]).size !== value.compatible.length + value.refuted_here.length) invalid('rival partition'); return;
  }
  for (const name of ['before', 'after']) string(value[name], 'event ' + name);
  if (value.kind === 'addressed_field_candidate') {
    fields(value, ['kind', 'before', 'after', 'mobile_before', 'mobile_after', 'stationary_exemplar', 'goal_shadow', 'identity', 'unresolved_residual_count', 'indicator', 'goal_status'], 'candidate event');
    for (const name of ['mobile_before', 'mobile_after', 'stationary_exemplar', 'goal_shadow']) box(value[name], 'candidate ' + name);
    string(value.identity, 'candidate identity'); integer(value.unresolved_residual_count, 'candidate unresolved count', 0); indicator(value.indicator);
    if (value.goal_status !== 'centered_homologue_hypothesis') invalid('candidate qualification'); return;
  }
  if (value.kind === 'addressed_field_counterexample') {
    fields(value, ['kind', 'before', 'after', 'point', 'actual_anchor', 'scope'], 'counterexample'); point(value.point, 'counterexample point', 0); point(value.actual_anchor, 'counterexample anchor', 0);
    if (value.scope !== 'alignment_hypothesis_refuted') invalid('counterexample scope'); return;
  }
  if (value.kind === 'recalled_rewrite_refuted') { fields(value, ['kind', 'before', 'after'], 'recalled rewrite refutation'); return; }
  if (value.kind === 'material_response_unresolved') {
    fields(value, ['kind', 'removed', 'added', 'before', 'after'], 'unresolved material event'); integer(value.removed, 'removed count', 0); integer(value.added, 'added count', 0); return;
  }
  if (value.kind === 'typed_material_relocated_to_address' || value.kind === 'observed_joint_material_rewrite') {
    fields(value, ['kind', 'before', 'after', 'parents', 'product', 'joint_origins', 'conserved_pixel_identity_claimed'], 'material event'); array(value.parents, 'material parents');
    if (value.parents.length !== (value.kind === 'typed_material_relocated_to_address' ? 1 : 2) || value.conserved_pixel_identity_claimed !== false) invalid('material parentage');
    for (const item of [...value.parents, value.product]) { object(item, 'material occurrence'); fields(item, ['palette', 'bbox'], 'material occurrence'); palette(item.palette, 'material palette'); box(item.bbox, 'material box'); }
    strings(value.joint_origins, 'material origins'); return;
  }
  invalid('unknown event kind');
}
function validateCheckpoint(value: R, policy: AddressedFieldPolicy): void {
  object(value, 'checkpoint'); fields(value, ['schema', ...sourceFields], 'checkpoint', ['current_observation']);
  if (value.schema !== ADDRESSED_MATERIAL_STATE_SCHEMA || !equal(value.policy, policy)) invalid('checkpoint schema or policy');
  if (validatedCheckpoints.has(value)) return;
  if (value.epoch !== null) integer(value.epoch, 'epoch', 0);
  model(value.model); indicator(value.indicator); integer(value.lower_squared, 'accepted distance', 0); if (value.upper_squared !== null) integer(value.upper_squared, 'rejected distance', 0);
  if (!['different_offset', 'outside_indicator', 'indicator_edge', 'navigation'].includes(value.calibration)) invalid('calibration');
  if (['outside_indicator', 'indicator_edge'].includes(value.calibration) && value.indicator === null) invalid('calibration indicator');
  array(value.samples, 'samples'); value.samples.forEach((s: any) => sample(s)); array(value.events, 'events'); value.events.forEach(event);
  array(value.passed, 'scored boundaries');
  for (const p of value.passed) { object(p, 'scored boundary'); fields(p, ['score', 'evidence'], 'scored boundary'); integer(p.score, 'scored boundary score', 0); string(p.evidence, 'scored boundary evidence'); }
  prior(value.prior);
  if (value.stock !== null) {
    object(value.stock, 'stock checkpoint');
    if (value.model !== null || value.prior === null || !equal(value.prior, value.stock.source?.prior)) invalid('field and stock ownership');
  }
  if (Object.hasOwn(value, 'current_observation')) observation(value.current_observation);
  // Stock restoration has its own closed, ordered-collection contract and is
  // validated before installation by FieldStock.fromState below.
}

export class AddressedMaterial extends AddressedField implements NativeFamily<any> {
  readonly id = 'public_addressed_material';
  declare current_observation?: R;
  readonly boundedSearch: AddressedSearchBounds | undefined;
  private refusal: R | null = null; private retained: R | null = null;
  private retainedRevision = -1; private retainedStock: FieldStock | null = null; private retainedStockRevision = -1;
  constructor(policy: AddressedFieldPolicy = ADDRESSED_FIELD_SOURCE_POLICY, options: AddressedMaterialOptions = {}) {
    super(policy); this.boundedSearch = options.boundedSearch ? Object.freeze({ ...options.boundedSearch }) : undefined;
    if (this.boundedSearch) new AddressedWork(this.boundedSearch);
  }
  static readonly fullObservation = LinkedTemporalPreparation.fullObservation;
  async propose(observation: NativeObservation | R, rows: NativeRows, inputs: readonly NativeCommand[] | readonly R[], remaining: number, execution?: NativeExecution): Promise<NativeProposal | null> {
    this.refusal = null;
    // The cold source entry has no search and no stock to create. Retain that
    // inexpensive null result before allocating a native transaction snapshot.
    if (!this.policy.enabled || remaining <= 0 || this.model === null && this.stock === null && this.prior === null) return null;
    integer(remaining, 'remaining action budget');
    const bounded = this.boundedSearch !== undefined || execution !== undefined, stockBefore = this.stock,
      stockRevision = stockBefore?.revision ?? -1, stockState = bounded ? stockBefore?.nativeState() ?? null : null, revision = this.stateRevision;
    try {
      const work = bounded ? new AddressedWork(this.boundedSearch, execution) : undefined;
      const proposal = await super.proposeSource(observation, rows, inputs, remaining, work); work?.check();
      // The common caller checks source status before consuming action fields.
      // Keep source refusal envelopes (including their absent kind) unchanged.
      return proposal as NativeProposal | null;
    } catch (error) {
      if (!(error instanceof AddressedWorkBound) || !bounded) throw error;
      // Only lazy stock creation and acquired-minimum bookkeeping can mutate
      // during a source proposal. Restore them without rerunning acquisition.
      this.stock = stockBefore && stockBefore.revision !== stockRevision ? FieldStock.fromState(stockState!) : stockBefore;
      this.stateRevision = revision;
      if (this.retainedStock === stockBefore && this.retainedStockRevision === stockRevision) {
        this.retainedStock = this.stock; this.retainedStockRevision = this.stock?.revision ?? -1;
      }
      this.refusal = { status: 'unknown', reason: 'addressed_material_search_work_bound', observation_ref: observation.observation_ref,
        level_epoch: observation.level_epoch, frame_hash: observation.frame_hash, release_authority: false, block_unrelated_probe: true,
        exhausted_bound: error.bound, frontier: { complete: false, nodes: error.nodes, work: error.work,
          maximum_nodes: this.boundedSearch?.maximumNodes ?? null, maximum_work: this.boundedSearch?.maximumWork ?? null,
          deadline_ms: execution?.deadlineMs ?? null, scope: 'An incomplete addressed-material question; no action, refutation or acquired impossibility.' } };
      return null;
    }
  }
  async proposeInSubquestion(group: string, subquestion: string, observation: NativeObservation | R, rows: NativeRows,
    inputs: readonly NativeCommand[] | readonly R[], remaining: number, execution?: NativeExecution): Promise<NativeProposal | null> {
    if (group !== 'factored_material_return' || subquestion !== 'observed_addressed_material') return null;
    const proposal = await this.propose(observation, rows, inputs, remaining, execution);
    if (proposal !== null) proposal.material_access_subquestion = subquestion;
    return proposal;
  }
  currentProposalRefusal(observation: NativeObservation | R): NativeRecord | null {
    return this.refusal && ['observation_ref', 'level_epoch', 'frame_hash'].every(name => this.refusal![name] === observation[name]) ? clone(this.refusal) : null;
  }
  async before(proposal: R, index: number, publicPacket: NativePublicObservation | R, observation: NativeObservation | R): Promise<NativeBeforeResult> {
    this.changed(); this.refusal = null; this.current_observation = retainNativeJson(await AddressedMaterial.fullObservation(observation, publicPacket.frame_rows));
    return super.before(proposal, index, publicPacket, this.current_observation);
  }
  async after(proposal: R, index: number, before: NativeObservation | R, after: NativeObservation | R, first: NativeRows, second: NativeRows): Promise<NativeAfterResult> {
    this.changed(); this.refusal = null; const priorObservation = await AddressedMaterial.fullObservation(before, first);
    this.current_observation = retainNativeJson(await AddressedMaterial.fullObservation(after, second));
    return super.after(proposal, index, priorObservation, this.current_observation, first, second);
  }
  recordSource(before: NativeObservation | R, after: NativeObservation | R, command: NativeCommand | R, first: NativeRows, second: NativeRows,
    proposal?: R, index?: number, frames?: readonly NativeRows[]): R {
    this.refusal = null;
    const revision = this.stateRevision, coldUnchanged = this.epoch === before.level_epoch && before.level_epoch === after.level_epoch
      && before.levels_completed === after.levels_completed && this.model === null && this.stock === null && this.prior === null
      && this.samples.length === 0 && this.events.length === 0 && this.indicator === null && this.lower_squared === 0
      && this.upper_squared === null && this.calibration === 'different_offset';
    const result = super.recordSource(before, after, command, first, second, proposal, index, frames);
    // Still acquire the whole source envelope for every return. Replacing an
    // empty source events list with another empty list changes no checkpoint
    // value, so a cold unresolved owner keeps its immutable snapshot identity.
    if (coldUnchanged && result.status === 'field_unresolved' && result.events.length === 0 && this.model === null) this.stateRevision = revision;
    return result;
  }
  record(before: NativeObservation | R, after: NativeObservation | R, command: NativeCommand | R, first: NativeRows, second: NativeRows,
    proposal?: R, index?: number, frames?: readonly NativeRows[]): NativeRecordResult {
    return { events: [this.recordSource(before, after, command, first, second, proposal, index, frames)] };
  }
  sourceState(): R {
    const value = super.sourceState(); if (Object.hasOwn(this, 'current_observation')) value.current_observation = clone(this.current_observation!); return value;
  }
  nativeState(): R {
    if (this.retained && this.retainedRevision === this.stateRevision && this.retainedStock === this.stock && this.retainedStockRevision === (this.stock?.revision ?? -1)) return this.retained;
    const value: R = { schema: ADDRESSED_MATERIAL_STATE_SCHEMA, policy: this.policy, epoch: this.epoch, model: this.model, samples: this.samples,
      indicator: this.indicator, lower_squared: this.lower_squared, upper_squared: this.upper_squared, calibration: this.calibration,
      events: this.events, passed: this.passed, prior: this.prior, stock: this.stock?.nativeState() ?? null };
    if (Object.hasOwn(this, 'current_observation')) value.current_observation = this.current_observation;
    const owned = retainNativeJson(value); validateCheckpoint(owned, this.policy);
    // This value contains a stock checkpoint constructed by its owner.
    // Foreign stock checkpoints are fully validated before installation.
    validatedCheckpoints.add(owned); this.retained = owned; this.retainedRevision = this.stateRevision;
    this.retainedStock = this.stock; this.retainedStockRevision = this.stock?.revision ?? -1; return owned;
  }
  state(): R { return clone(this.nativeState()); }
  restore(value: NativeRecord): void { this.restoreNative(value); }
  restoreNative(value: Readonly<NativeRecord>): void {
    if (value === this.retained && this.retainedRevision === this.stateRevision && this.retainedStock === this.stock && this.retainedStockRevision === (this.stock?.revision ?? -1)) return;
    const owned = retainNativeJson(value) as R; validateCheckpoint(owned, this.policy);
    // Build every mutable container off to the side. No owner field changes if
    // any nested geometry, collection or source/native schema is rejected.
    const stock = owned.stock === null ? null : FieldStock.fromState(owned.stock), model = owned.model === null ? null : { ...owned.model },
      samples = [...owned.samples], events = [...owned.events], passed = [...owned.passed];
    const current = Object.hasOwn(owned, 'current_observation') ? owned.current_observation : undefined;
    this.epoch = owned.epoch; this.model = model; this.samples = samples; this.indicator = owned.indicator;
    this.lower_squared = owned.lower_squared; this.upper_squared = owned.upper_squared; this.calibration = owned.calibration;
    this.events = events; this.passed = passed; this.prior = owned.prior; this.stock = stock;
    if (current !== undefined) this.current_observation = current; else delete this.current_observation;
    this.changed(); this.refusal = null; validatedCheckpoints.add(owned); this.retained = owned; this.retainedRevision = this.stateRevision;
    this.retainedStock = stock; this.retainedStockRevision = stock?.revision ?? -1;
  }
}

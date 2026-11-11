/** Closed native checkpoint extension. Source state()/restore() remain the
 * Python tracker's separate merge contract. Foreign values are owned and
 * validated deeply before installation; a shallow freeze is no certificate. */
import { retainNativeJson } from './v6-native-owned.ts';
import { BINDING_TRACKER_FIELDS } from './v6-object-binding-tracker.ts';
import { center, digest } from './v6-object-binding-geometry.ts';
import { bindingEqual as same, type BindingRecord as R } from './v6-object-binding-common.ts';

export const OBSERVED_BINDING_STATE_SCHEMA = 'logos-engine.observed-binding-state.v1';
const checkpoints = new WeakSet<object>(), frames = new WeakSet<object>(), identities = new WeakSet<object>(),
  methods = new WeakSet<object>(), receipts = new WeakSet<object>();
function invalid(label: string): never { throw new TypeError('Invalid observed binding checkpoint: ' + label); }
function object(value: any, label: string): asserts value is R {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(label);
}
function array(value: any, label: string): asserts value is any[] { if (!Array.isArray(value)) invalid(label); }
function fields(value: any, names: readonly string[], label: string, optional: readonly string[] = []): asserts value is R {
  object(value, label); const allowed = new Set([...names, ...optional]);
  if (names.some(name => !Object.hasOwn(value, name)) || Object.keys(value).some(name => !allowed.has(name))) invalid(label + ' fields');
}
function text(value: any, label: string): void { if (typeof value !== 'string' || !value) invalid(label); }
function integer(value: any, label: string, minimum = 0): void { if (!Number.isSafeInteger(value) || value < minimum) invalid(label); }
function palette(value: any, label: string): void { integer(value, label); if (value > 255) invalid(label); }
function strings(value: any, label: string, nonempty = false, distinct = false): void {
  array(value, label); value.forEach(item => text(item, label));
  if (nonempty && !value.length || distinct && new Set(value).size !== value.length) invalid(label);
}
function point(value: any, label: string, fractional = false, minimum = 0): void {
  array(value, label); if (value.length !== 2) invalid(label);
  value.forEach(number => { if (fractional) { if (!Number.isFinite(number) || !Number.isSafeInteger(number * 2) || number < minimum) invalid(label); }
    else integer(number, label, minimum); });
}
function box(value: any, label: string): void {
  array(value, label); if (value.length !== 4) invalid(label); value.forEach(number => integer(number, label));
  if (value[0] > value[2] || value[1] > value[3]) invalid(label + ' order');
}
function points(value: any, label: string, nonempty = false, fractional = false): void {
  array(value, label); value.forEach(item => point(item, label, fractional));
  if (nonempty && !value.length || new Set(value.map(item => JSON.stringify(item))).size !== value.length) invalid(label + ' duplicate/empty support');
}
function boxes(value: any, label: string): void { array(value, label); value.forEach(item => box(item, label)); }
function frame(value: any): void {
  object(value, 'frame'); if (frames.has(value)) return;
  fields(value, ['ref', 'palette_value', 'bbox', 'interior_bbox', 'center', 'corner_value', 'interior_value', 'evidence'], 'frame',
    ['current_unoccluded_perimeter', 'status']);
  text(value.ref, 'frame ref'); palette(value.palette_value, 'frame palette'); palette(value.corner_value, 'frame corner'); palette(value.interior_value, 'frame interior');
  box(value.bbox, 'frame box'); box(value.interior_bbox, 'frame interior box'); point(value.center, 'frame centre', true); text(value.evidence, 'frame evidence');
  const [l, t, r, b] = value.bbox;
  if (r - l < 4 || b - t < 4 || !same(value.interior_bbox, [l + 1, t + 1, r - 1, b - 1])
    || !same(value.center, center(value.bbox)) || value.palette_value === value.interior_value
    || value.ref !== 'empty_frame:' + digest([value.palette_value, l + 1, t, r - 1, b])) invalid('frame geometry/provenance');
  if (Object.hasOwn(value, 'status') !== Object.hasOwn(value, 'current_unoccluded_perimeter')) invalid('partial frame revalidation');
  if (Object.hasOwn(value, 'status')) {
    if (!['frame_revalidated', 'partially_occluded_frame_revalidated'].includes(value.status)) invalid('frame revalidation status');
    points(value.current_unoccluded_perimeter, 'frame perimeter', true);
    if (value.current_unoccluded_perimeter.length < r - l + b - t || value.current_unoccluded_perimeter.some(([x, y]: number[]) =>
      x! < l || x! > r || y! < t || y! > b || x !== l && x !== r && y !== t && y !== b)) invalid('frame perimeter scope');
  }
  frames.add(value);
}
function identity(value: any): void {
  object(value, 'identity'); if (identities.has(value)) return;
  fields(value, ['status', 'alternatives', 'scope'], 'identity');
  if (value.status !== 'visible_shape_compatible_under_bounded_translation' || value.scope !== 'visible_part_only_occluded_part_unknown') invalid('identity qualification');
  array(value.alternatives, 'identity alternatives'); if (!value.alternatives.length) invalid('empty identity alternatives');
  for (const alternative of value.alternatives) {
    fields(alternative, ['translation', 'matching_visible_foreground', 'matching_visible_background_count', 'unobservable_points'], 'identity alternative');
    point(alternative.translation, 'identity translation', false, Number.MIN_SAFE_INTEGER);
    points(alternative.matching_visible_foreground, 'identity foreground', true);
    if (new Set(alternative.matching_visible_foreground.map((p: number[]) => p[0])).size < 2
      || new Set(alternative.matching_visible_foreground.map((p: number[]) => p[1])).size < 2) invalid('identity foreground extent');
    integer(alternative.matching_visible_background_count, 'identity background'); integer(alternative.unobservable_points, 'identity hidden points');
  }
  identities.add(value);
}
function method(value: any): void {
  object(value, 'method'); if (methods.has(value)) return;
  const boundary = value.status === 'boundary_support_not_universal_sufficiency';
  fields(value, ['ref', 'interaction', 'source_epoch', 'scope', 'evidence', 'status', ...(boundary ? ['goal', 'pickup_evidence'] : [])], 'method');
  text(value.interaction, 'method interaction'); integer(value.source_epoch, 'method epoch'); strings(value.evidence, 'method evidence', true);
  if (value.ref !== 'binding_method:' + digest(value.evidence)) invalid('method ref');
  if (boundary) {
    if (value.scope !== 'same_appearance_frame_reception_hypothesis' || value.goal !== 'released_corresponding_object_at_visible_frame_boundary') invalid('boundary method scope');
    strings(value.pickup_evidence, 'method pickup evidence', true);
  } else if (value.status !== 'local_relation_not_universal_sufficiency' || value.scope !== 'selected_site_reception_observed_after_separation') invalid('separation method scope');
  methods.add(value);
}
function receipt(value: any): void {
  object(value, 'reception receipt'); if (receipts.has(value)) return;
  fields(value, ['status', 'frame_ref', 'object_ref', 'site_pixels_retained', 'bound_translation_counterexamples', 'evidence', 'scope'], 'reception receipt');
  if (value.status !== 'reception_confirmed_by_separation' || value.scope !== 'selected_object_and_site_only_not_universal_terminal_rule') invalid('reception receipt qualification');
  text(value.frame_ref, 'receipt frame'); text(value.object_ref, 'receipt object'); strings(value.evidence, 'receipt evidence', true, true);
  points(value.site_pixels_retained, 'receipt site support', true); points(value.bound_translation_counterexamples, 'receipt contrast', true, true);
  receipts.add(value);
}
function pending(value: any): void {
  fields(value, ['ref', 'frame', 'palette_value', 'site_pixels', 'gained_pixels', 'vacated_carried_pixels', 'object_ref', 'evidence', 'status', 'alternatives', 'preservation_regions'], 'pending reception');
  frame(value.frame); palette(value.palette_value, 'pending palette'); text(value.object_ref, 'pending object'); strings(value.evidence, 'pending evidence', true);
  if (value.ref !== 'reception_transition:' + digest(value.evidence) || value.status !== 'arrival_at_selected_site_requires_separation'
    || !same(value.alternatives, ['object_detached_at_selected_reception_site', 'object_still_bound_with_changed_relative_pose'])) invalid('pending reception qualification');
  for (const name of ['site_pixels', 'gained_pixels', 'vacated_carried_pixels']) points(value[name], 'pending ' + name, true);
  const site = new Set(value.site_pixels.map((p: number[]) => JSON.stringify(p)));
  if (value.gained_pixels.some((p: number[]) => !site.has(JSON.stringify(p)))) invalid('pending gained support');
  boxes(value.preservation_regions, 'pending preserved regions');
}
function event(value: any): void {
  object(value, 'event'); text(value.status, 'event status');
  if (value.status === 'reception_confirmed_by_separation') { receipt(value); return; }
  const common = ['status', 'evidence'];
  switch (value.status) {
    case 'reception_refuted_object_moves_with_body':
    case 'transport_identity_ambiguous':
    case 'motion_no_effect_contextual':
    case 'interaction_no_observed_identity_effect': fields(value, common, 'event'); break;
    case 'nonlocal_or_contextual_motion':
      fields(value, [...common, 'action', 'expected', 'observed'], 'motion event'); text(value.action, 'motion action');
      point(value.expected, 'expected displacement', true, Number.MIN_SAFE_INTEGER); point(value.observed, 'observed displacement', true, Number.MIN_SAFE_INTEGER); break;
    case 'object_remains_locally_bound_after_motion':
      fields(value, [...common, 'relative_pose_is_not_rigid'], 'transport event'); if (value.relative_pose_is_not_rigid !== true) invalid('transport rigidity'); break;
    case 'local_attachment_hypothesis':
      fields(value, [...common, 'alternatives', 'identity_binding'], 'attachment event'); identity(value.identity_binding);
      if (!same(value.alternatives, ['attachment', 'remote_relocation_then_independent_object'])) invalid('attachment alternatives'); break;
    case 'identity_binding_unresolved':
      fields(value, [...common, 'ambiguities', 'compatible_source_count'], 'identity event'); integer(value.compatible_source_count, 'compatible source count');
      array(value.ambiguities, 'identity ambiguities');
      for (const ambiguity of value.ambiguities) {
        fields(ambiguity, ['source_bbox', 'candidate_bboxes', 'compatible_count', 'reason'], 'identity ambiguity');
        box(ambiguity.source_bbox, 'ambiguity source'); boxes(ambiguity.candidate_bboxes, 'ambiguity candidates'); integer(ambiguity.compatible_count, 'ambiguity count');
        if (ambiguity.reason !== (ambiguity.compatible_count > 1 ? 'multiple_compatible_relocations' : 'changed_occurrences_not_visibly_compatible')) invalid('ambiguity reason');
      }
      break;
    default: invalid('unknown retained source event');
  }
  strings(value.evidence, 'event evidence', true);
}

/** This function accepts owned immutable JSON only through the owning entry
 * below; its validation caches cannot certify a mutable foreign object. */
function validateSource(value: R): void {
  fields(value, BINDING_TRACKER_FIELDS, 'source');
  if (value.epoch !== null) integer(value.epoch, 'epoch');
  if (value.core !== null) {
    fields(value.core, ['signature', 'area', 'palette_value', 'evidence', 'offsets'], 'core');
    text(value.core.signature, 'core signature'); integer(value.core.area, 'core area', 4); palette(value.core.palette_value, 'core palette');
    strings(value.core.evidence, 'core evidence', true); points(value.core.offsets, 'core offsets', true);
    if (value.epoch === null || Math.min(...value.core.offsets.map((p: number[]) => p[0])) !== 0
      || Math.min(...value.core.offsets.map((p: number[]) => p[1])) !== 0) invalid('core scope/offset origin');
  }
  object(value.moves, 'moves');
  for (const [action, move] of Object.entries(value.moves) as [string, R][]) {
    text(action, 'move action'); fields(move, ['delta', 'evidence', 'status'], 'move'); point(move.delta, 'move delta', true, Number.MIN_SAFE_INTEGER);
    strings(move.evidence, 'move evidence', true);
    if (!move.delta.some(Boolean) || move.status !== 'observed_local_displacement') invalid('move qualification');
  }
  strings(value.tried, 'tried actions', false, true); array(value.blocked, 'blocked');
  for (const item of value.blocked) { fields(item, ['action', 'pose', 'evidence'], 'blocked item'); text(item.action, 'blocked action');
    point(item.pose, 'blocked pose', true); strings(item.evidence, 'blocked evidence', true); }
  if (value.interaction !== null) {
    fields(value.interaction, ['action', 'evidence'], 'interaction'); text(value.interaction.action, 'interaction action'); strings(value.interaction.evidence, 'interaction evidence', true);
  }
  if (value.held !== null) {
    fields(value.held, ['ref', 'palette_value', 'bbox', 'original_bbox', 'frame', 'status', 'identity_binding', 'evidence'], 'held object');
    palette(value.held.palette_value, 'held palette'); box(value.held.bbox, 'held box'); box(value.held.original_bbox, 'held original box');
    frame(value.held.frame); identity(value.held.identity_binding); strings(value.held.evidence, 'held evidence', true);
    if (!['local_attachment_hypothesis', 'joint_transport_observed', 'transport_identity_ambiguous', 'reception_separation_pending'].includes(value.held.status)
      || value.held.ref !== 'bound_object:' + digest([value.epoch, value.held.palette_value, value.held.original_bbox])
      || value.held.palette_value !== value.held.frame.palette_value || value.core === null || value.interaction === null) invalid('held source binding');
  }
  array(value.methods, 'methods'); value.methods.forEach(method); array(value.goal_evidence, 'goal evidence');
  for (const goal of value.goal_evidence) { method(goal);
    if (goal.status !== 'boundary_support_not_universal_sufficiency' || !value.methods.some((known: R) => same(known, goal))) invalid('goal evidence source method'); }
  array(value.events, 'events'); if (value.events.length > 32) invalid('source event suffix'); value.events.forEach(event);
  array(value.failed, 'failed contexts'); for (const item of value.failed) {
    fields(item, ['action', 'context', 'evidence'], 'failed context'); text(item.action, 'failed action'); text(item.context, 'failed context ref');
    if (!/^[0-9a-f]{24}$/.test(item.context)) invalid('failed context digest'); strings(item.evidence, 'failed evidence', true);
  }
  if (value.correspondence_context !== null) {
    const context = value.correspondence_context;
    fields(context, ['level_epoch', 'pairs', 'frames', 'evidence', 'status'], 'correspondence context'); integer(context.level_epoch, 'context epoch');
    strings(context.pairs, 'context pairs', true, true); object(context.frames, 'context frames'); strings(context.evidence, 'context evidence', true);
    if (context.status !== 'observed_correspondence_hypothesis_not_liaison_fact' || context.level_epoch !== value.epoch
      || Object.keys(context.frames).length !== context.pairs.length || context.pairs.some((ref: string) => !Object.hasOwn(context.frames, ref))) invalid('context source scope');
    Object.values(context.frames).forEach(frame);
  }
  array(value.context_refutations, 'context refutations'); for (const item of value.context_refutations) {
    fields(item, ['pair_ref', 'frame_ref', 'reason', 'changed_corners', 'evidence', 'prior_evidence'], 'context refutation');
    text(item.pair_ref, 'refuted pair'); text(item.frame_ref, 'refuted frame'); points(item.changed_corners, 'changed corners', true);
    strings(item.evidence, 'refutation evidence', true); strings(item.prior_evidence, 'prior context evidence', true);
    if (item.reason !== 'anchored_frame_corner_contradiction') invalid('context refutation reason');
  }
  if (value.pending_reception !== null) {
    pending(value.pending_reception);
    if (value.held === null || value.interaction === null || value.held.status !== 'reception_separation_pending'
      || value.pending_reception.object_ref !== value.held.ref || value.pending_reception.frame.ref !== value.held.frame.ref
      || value.pending_reception.palette_value !== value.held.palette_value) invalid('pending reception owner');
  }
  array(value.reception_receipts, 'reception receipts'); value.reception_receipts.forEach(receipt);
  object(value.observed_frames, 'observed frames'); for (const [ref, known] of Object.entries(value.observed_frames) as [string, R][]) {
    frame(known); if (ref !== known.ref) invalid('observed frame key');
  }
}
export function ownBindingCheckpoint(value: unknown): R {
  const owned = retainNativeJson(value) as R;
  if (checkpoints.has(owned)) return owned;
  fields(owned, ['schema', 'source'], 'envelope');
  if (owned.schema !== OBSERVED_BINDING_STATE_SCHEMA) invalid('schema');
  validateSource(owned.source); checkpoints.add(owned); return owned;
}
export function makeBindingCheckpoint(source: R): R { return ownBindingCheckpoint({ schema: OBSERVED_BINDING_STATE_SCHEMA, source }); }

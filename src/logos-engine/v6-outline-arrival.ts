/** Native composition: ask one local question after an actually selected
 * access primitive reaches its previously observed body cell. This does not
 * reconstruct an occluded body or claim an unchanged V5 BFS-rule match. */
import { detectV5Components, validateRows } from './v6-native-observer.ts';
import type { V5Component } from './v6-native-observer.ts';
import type { NativeRows, NativeRecord } from './v6-native-types.ts';
import type { OutlineFields } from './v6-outline-geometry.ts';
import { isJsonObject } from './canonical.ts';
import { symbolicDigest } from './v6-hash.ts';

type R = Record<string, any>;
type Box = readonly [left: number, top: number, right: number, bottom: number];
const ACCESS_GOAL = 'goal.accompany_mobile_entity_to_compatible_hollow_perimeter';
const record = (value: unknown): value is R => isJsonObject(value);
const ref = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const refs = (value: unknown): value is string[] => Array.isArray(value) && value.length > 0 && value.every(ref);
const natural = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const bbox = (value: unknown): Box | null => Array.isArray(value) && value.length === 4 && value.every(Number.isSafeInteger)
  && value[0] <= value[2] && value[1] <= value[3] ? value as unknown as Box : null;
const fromComponent = (value: V5Component): Box => [value.bbox.left, value.bbox.top, value.bbox.right, value.bbox.bottom];
const equalBox = (left: Box, right: Box): boolean => left.every((value, index) => value === right[index]);
const fits = (box: Box, rows: NativeRows): boolean => box[0] >= 0 && box[1] >= 0 && box[2] < rows[0]!.length && box[3] < rows.length;
const exactPerimeter = (value: V5Component, width: number, height: number): boolean => value.bbox.width === width && value.bbox.height === height
  && value.area === 2 * (width + height) - 4
  && value.relative_pixels.every(([row, col]) => row === 0 || col === 0 || row === height - 1 || col === width - 1);
const solidBody = (value: V5Component, width: number, height: number): boolean => !value.touches_frame_boundary
  && value.bbox.width === width - 1 && value.bbox.height === height - 1 && value.area === (width - 1) * (height - 1);
const measured = (value: V5Component): R => ({ component_ref: value.component_id, bbox: fromComponent(value), value: value.value,
  area: value.area, pixels_sha256: symbolicDigest(value.pixels) });
const matchesMeasured = (value: unknown, component: V5Component): boolean => {
  if (!record(value)) return false;
  const box = bbox(value.bbox);
  return box !== null && equalBox(box, fromComponent(component)) && value.component_ref === component.component_id
    && value.value === component.value && value.area === component.area && value.pixels_sha256 === symbolicDigest(component.pixels);
};
const physical = (value: unknown): R | null => record(value) && ref(value.action_ref)
  && (value.data === undefined || record(value.data) && Object.values(value.data).every(Number.isFinite))
  ? { action_ref: value.action_ref, data: value.data ?? {} } : null;
const scope = (value: unknown): value is R => record(value) && ref(value.observation_ref) && natural(value.level_epoch)
  && natural(value.levels_completed) && natural(value.revision) && typeof value.frame_hash === 'string' && /^[0-9a-f]{16}$/.test(value.frame_hash);

/** Inputs reuse the current access fields, plus interface_local_action_ref.
 * The latter is only an explicitly declared candidate. This helper supplies
 * no historical-method, current-effect, exact-trial or release authority;
 * the service/caller must bind those separately before any dispatch. */
export async function measureOutlineAccessArrival(rows: NativeRows, fields: OutlineFields): Promise<NativeRecord | null> {
  validateRows(rows);
  const observation = fields.current_observation_ref, evidence = fields.current_control_evidence_refs;
  const available = fields.available_action_refs, local = fields.interface_local_action_ref;
  if (fields.current_control_reacquired !== true || !ref(observation) || !refs(evidence) || !evidence.includes(observation)
    || !natural(fields.current_level_epoch) || !natural(fields.current_revision)
    || !refs(available) || !ref(local) || !available.includes(local)) return null;
  const directions = new Map<string, readonly [number, number]>();
  if (!Array.isArray(fields.interface_action_translation_deltas) || fields.interface_action_translation_deltas.length > 64) return null;
  for (const entry of fields.interface_action_translation_deltas) {
    if (!Array.isArray(entry) || entry.length !== 3 || !ref(entry[0]) || !Number.isSafeInteger(entry[1]) || !Number.isSafeInteger(entry[2])) return null;
    const old = directions.get(entry[0]);
    if (old && (old[0] !== entry[1] || old[1] !== entry[2])) return null;
    directions.set(entry[0], [entry[1], entry[2]]);
  }
  if (directions.has(local) || local === fields.interface_point_action_ref || local === fields.level_start_checkpoint_action_ref) return null;

  const terms = fields.canonical_provisional_control_term_facts, boxes = fields.canonical_provisional_control_geometry_bboxes;
  const currentBoxes = fields.current_action_conditioned_control_outline_bboxes;
  if (!Array.isArray(terms) || terms.length !== 1 || !ref(terms[0]?.entity_ref)
    || !Array.isArray(boxes) || boxes.length !== 1 || !Array.isArray(currentBoxes) || currentBoxes.length !== 1) return null;
  const currentBox = bbox(boxes[0]), currentOutline = bbox(currentBoxes[0]);
  if (!currentBox || !currentOutline || !equalBox(currentBox, currentOutline) || !fits(currentBox, rows)) return null;
  const width = currentBox[2] - currentBox[0] + 1, height = currentBox[3] - currentBox[1] + 1;
  // The same bounded perimeter domain as the transferred V6 observer.
  if (width < 3 || height < 3 || width > 16 || height > 16) return null;

  const context = fields.previous_public_transition, previous = fields.previous_action_observed_frame;
  if (!record(context) || context.schema !== 'native.outline.public_transition.v1' || !Array.isArray(previous)) return null;
  try { validateRows(previous); } catch { return null; }
  const before = context.before, after = context.after;
  if (!scope(before) || !scope(after) || before.level_epoch !== fields.current_level_epoch || after.level_epoch !== fields.current_level_epoch
    || before.levels_completed !== after.levels_completed || before.revision + 1 !== after.revision
    || after.revision !== fields.current_revision || after.observation_ref !== observation || !evidence.includes(before.observation_ref)
    || previous.length !== rows.length || previous[0]!.length !== rows[0]!.length
    || context.before_rows_sha256 !== symbolicDigest(previous) || context.after_rows_sha256 !== symbolicDigest(rows)
    || before.frame_hash !== context.before_rows_sha256.slice(0, 16) || after.frame_hash !== context.after_rows_sha256.slice(0, 16)) return null;
  const command = physical(context.command), selected = context.selected_outline, access = selected?.access_relation;
  if (!command || !record(selected) || !record(access) || selected.guard_admitted !== true || selected.action_index !== 0
    || !ref(selected.proposal_ref) || selected.meaning_kind !== 'native_current_observed_body_access_hypothesis'
    || selected.active_goal_ref !== ACCESS_GOAL || selected.active_terminal_goal_ref !== ACCESS_GOAL
    || selected.observation_ref !== before.observation_ref || selected.level_epoch !== before.level_epoch || selected.frame_hash !== before.frame_hash
    || symbolicDigest(physical(selected.command)) !== symbolicDigest(command)
    || access.schema !== 'logos-engine.native.outline-announced-access.v1' || access.kind !== 'current_observed_body_access_question'
    || access.observation_ref !== before.observation_ref || access.current_rows_sha256 !== context.before_rows_sha256
    || !refs(access.evidence_refs) || !access.evidence_refs.includes(before.observation_ref) || access.action_ref !== command.action_ref
    || access.primitive_bound !== 1 || access.replan_after_each_primitive !== true || access.release_authority !== false
    || access.action_effect_known !== false || access.target_basis !== 'current_visible_compact_body_cell'
    || access.marker_cell_bbox !== null || access.relation?.cardinal_marker !== null
    || selected.access_relation_ref !== `outline_access:${symbolicDigest(access)}`) return null;
  const direction = directions.get(command.action_ref);
  if (!direction || (direction[0] === 0) === (direction[1] === 0)) return null;
  const oldBox = bbox(access.control_bbox), target = bbox(access.target_cell_bbox), bodyCell = bbox(access.body_cell_bbox);
  const predicted = bbox(access.expected_body_bbox), delta = access.expected_delta;
  if (!oldBox || !target || !bodyCell || !predicted || !fits(oldBox, previous)
    || !equalBox(target, currentBox) || !equalBox(bodyCell, currentBox) || !equalBox(predicted, currentBox)
    || !Array.isArray(delta) || delta.length !== 2 || !delta.every(Number.isSafeInteger)) return null;
  const dx = currentBox[0] - oldBox[0], dy = currentBox[1] - oldBox[1];
  if ((dx === 0) === (dy === 0) || dx % width || dy % height || delta[0] !== dx || delta[1] !== dy
    || Math.sign(direction[0]) !== Math.sign(dy) || Math.sign(direction[1]) !== Math.sign(dx)
    || currentBox[2] - oldBox[2] !== dx || currentBox[3] - oldBox[3] !== dy
    || access.distance_after !== 0 || access.distance_before !== Math.abs(dx) / width + Math.abs(dy) / height) return null;

  const oldAll = (await detectV5Components(previous, 4)).components, currentAll = (await detectV5Components(rows, 4)).components;
  if (oldAll.length > 512 || currentAll.length > 512) return null;
  const oldLeads = oldAll.filter(value => exactPerimeter(value, width, height) && matchesMeasured(access.relation?.controlled_outline, value));
  const leads = currentAll.filter(value => exactPerimeter(value, width, height) && equalBox(fromComponent(value), currentBox));
  if (oldLeads.length !== 1 || leads.length !== 1 || leads[0]!.component_id !== terms[0].entity_ref
    || !equalBox(fromComponent(oldLeads[0]!), oldBox) || oldLeads[0]!.value !== leads[0]!.value
    || oldAll.filter(value => value.value === oldLeads[0]!.value && exactPerimeter(value, width, height)).length !== 1
    || currentAll.filter(value => value.value === leads[0]!.value && exactPerimeter(value, width, height)).length !== 1) return null;
  const bodies = oldAll.filter(value => solidBody(value, width, height) && matchesMeasured(access.relation?.compact_body, value));
  const oldPerimeters = oldAll.filter(value => !value.touches_frame_boundary && exactPerimeter(value, width, height)
    && matchesMeasured(access.relation?.hollow_perimeter, value));
  if (bodies.length !== 1 || oldPerimeters.length !== 1) return null;
  const body = bodies[0]!, oldPerimeter = oldPerimeters[0]!;
  const actualBodyCell: Box = [body.bbox.left - 1, body.bbox.top - 1, body.bbox.right, body.bbox.bottom];
  if (body.value === leads[0]!.value || body.value !== oldPerimeter.value || !equalBox(actualBodyCell, currentBox)
    || oldAll.filter(value => value.value === body.value && solidBody(value, width, height)).length !== 1
    || oldAll.filter(value => value.value === body.value && exactPerimeter(value, width, height)).length !== 1) return null;
  const perimeters = currentAll.filter(value => !value.touches_frame_boundary && value.value === body.value && exactPerimeter(value, width, height));
  if (perimeters.length !== 1 || !equalBox(fromComponent(perimeters[0]!), fromComponent(oldPerimeter))
    || (oldPerimeter.bbox.left - currentBox[0]) % width || (oldPerimeter.bbox.top - currentBox[1]) % height) return null;

  const remainingPixels: number[][] = [], changedInset: number[][] = [], coveredByOutline: number[][] = [];
  for (const [row, col] of body.pixels) {
    if (row === currentBox[1] || row === currentBox[3] || col === currentBox[0] || col === currentBox[2]) {
      if (rows[row]![col] === leads[0]!.value) coveredByOutline.push([row, col]);
    } else if (rows[row]![col] === body.value) remainingPixels.push([row, col]);
  }
  for (let row = currentBox[1] + 1; row < currentBox[3]; row++) for (let col = currentBox[0] + 1; col < currentBox[2]; col++) {
    if (previous[row]![col] !== rows[row]![col]) changedInset.push([row, col, previous[row]![col]!, rows[row]![col]!]);
  }
  // A reached cell alone does not establish this changed-contact question.
  // Border replacement by the outline is not counted as an inset response.
  if (!remainingPixels.length || !changedInset.length) return null;
  return {
    schema: 'logos-engine.native.outline-access-arrival.v1', kind: 'current_observed_body_arrival_local_question',
    action_ref: local, observation_ref: observation, level_epoch: after.level_epoch, current_rows_sha256: context.after_rows_sha256,
    previous_observation_ref: before.observation_ref, previous_rows_sha256: context.before_rows_sha256,
    selected_access_proposal_ref: selected.proposal_ref, selected_access_relation_ref: selected.access_relation_ref,
    actual_prior_command: command, current_control_bbox: currentBox, prior_control_bbox: oldBox,
    reached_prior_body_cell_bbox: actualBodyCell, actual_control_delta_xy: [dx, dy],
    current_control: measured(leads[0]!), previous_control: measured(oldLeads[0]!),
    previous_observed_body: measured(body), previous_perimeter: measured(oldPerimeter), current_perimeter: measured(perimeters[0]!),
    current_visible_same_value_pixels_row_column: remainingPixels, current_visible_same_value_count: remainingPixels.length,
    changed_inset_pixels_row_column_before_after: changedInset, changed_inset_count: changedInset.length,
    prior_body_pixels_now_covered_by_outline_row_column: coveredByOutline,
    complete_current_body: null, body_survival_established: false, current_body_identity_established: false,
    operator_effect_basis: 'unbound_conditional_candidate',
    source_principle: { reference_commit: '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e', source_path: 'agents/yf_arc3_v5/drm/interaction.drm',
      principle_ref: 'principle.effectful_local_operator_transfers_to_new_changed_bfs_endpoint',
      related_projection_ref: 'projection.exploration.changed_bfs_endpoint_transfers_unique_effectful_nondirectional_contact',
      exact_source_projection_matched: false,
      qualification: 'The source tests a previously effectful local operator at an actually completed changed BFS endpoint. This native composition instead measures arrival of one selected access primitive at its prior observed body cell; no completed standard BFS contract or current operator effect is supplied.' },
    evidence_refs: [...new Set([...evidence, before.observation_ref, after.observation_ref])],
    primitive_bound: 1, replan_after_each_primitive: true, release_authority: false, action_effect_known: false,
    pending_service_gates: ['historical_local_method_revalidation', 'current_local_operator_inventory_consistency', 'actual_untried_current_caller_trial', 'ordinary_preservation_and_release'],
    unknown: ['body_survival', 'body_identity', 'local_operator_effect', 'binding_or_capture', 'autonomous_motion', 'terminal_rule'],
    qualification: 'The actual selected access reached its prior body cell. Some same-value inset pixels remain and others visibly changed. This supports one conditional local question, without reconstructing a hidden body or treating historical operator evidence as a current effect.',
  };
}

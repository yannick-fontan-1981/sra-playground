/**
 * Native coordination evidence, separate from the transferred material program.
 * A witness qualifies a current question. It grants no action or goal authority.
 */
import { measureTypedCarriers, typedMaterialRequests, typedChildPresent, currentTypedMarks,
  rotatedTypedMarks, typedControlMatches, typedMaterialDigest as identity } from './v6-typed-material-observation.ts';
import { typedMaterialBefore } from './v6-typed-material-access.ts';
import { geometricComponents, validateRows } from './v6-native-observer.ts';
import { sha256Bytes } from './v6-hash.ts';
import { pythonEqual as equal } from './v6-operations.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
const record = (v: unknown): v is R => v !== null && typeof v === 'object' && !Array.isArray(v);
const ref = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const point = (v: unknown): v is number[] => Array.isArray(v) && v.length === 2 && v.every(Number.isSafeInteger);
const same = (a: unknown, b: unknown): boolean => identity(a) === identity(b);
const flags = ['typed_carrier_plan', 'material_flow_plan', 'material_pose_plan'];
const lists = ['carrier_events', 'carrier_calibration', 'flow_children', 'flow_filled', 'flow_events', 'pose_initial_parts', 'pose_controls', 'pose_events'];
const contexts = ['carrier_context', 'flow_context', 'pose_context', 'pose_rule'];
const eventKinds = new Set(['typed_carrier_response', 'typed_material_flow', 'typed_pose_scope', 'typed_pose_model', 'typed_pose_response']);
const shape = (box: number[]): number[] => [box[2]! - box[0]!, box[3]! - box[1]!];
const sortedMarks = (marks: number[][]): number[][] => marks.map(p => [...p]).sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]! || a[2]! - b[2]!);
const profile = (fringe: number[][]): R => {
  const result: R = {}; for (const item of fringe) result[item[2]!] = (result[item[2]!] ?? 0) + 1; return result;
};

function references(value: unknown): string[] | null {
  if (ref(value)) return [value];
  if (!Array.isArray(value)) return null;
  const result: string[] = [];
  for (const item of value) { const child = references(item); if (!child) return null; result.push(...child); }
  return result;
}

function boxInRows(value: unknown, rows: NativeRows): value is number[] {
  return Array.isArray(value) && value.length === 4 && value.every(Number.isSafeInteger)
    && 0 <= value[0] && value[0] <= value[2] && value[2] < rows[0]!.length
    && 0 <= value[1] && value[1] <= value[3] && value[3] < rows.length;
}

function projectionDigest(rows: NativeRows, box: number[]): string {
  const [x, y, r, b] = box as [number, number, number, number], width = r - x + 1, height = b - y + 1;
  const prefix = new TextEncoder().encode(`(${height}, ${width})`), data = new Uint8Array(prefix.length + width * height); data.set(prefix);
  let index = prefix.length;
  for (let v = y; v <= b; v++) for (let u = x; u <= r; u++) data[index++] = rows[v]![u]!;
  return sha256Bytes(data);
}

/**
 * The caller supplies the actual acquired owner state. References are admitted
 * only from its retained event lists, never inferred as learned from a plan.
 * The caller must separately corroborate any restored transient packet and
 * check disjointness, current admission, WHY/ACT and the physical return.
 */
export function proposedTypedMaterialInquiryWitness(state: unknown, proposal: unknown, observation: Readonly<R>, rows: NativeRows): R | null {
  try { return witness(state, proposal, observation, rows); } catch { return null; }
}

function witness(inputState: unknown, inputProposal: unknown, observation: Readonly<R>, rows: NativeRows): R | null {
  if (!record(inputState) || !record(inputProposal) || !ref(observation.observation_ref) || !ref(observation.frame_hash)
    || !Number.isSafeInteger(observation.level_epoch) || !Number.isSafeInteger(observation.levels_completed)
    || observation.levels_completed < 0 || !Array.isArray(observation.available_action_refs) || !observation.available_action_refs.includes('ACTION6')) return null;
  const state = inputState, proposal = inputProposal;
  if (state.requested_stop_reason !== null || lists.some(name => !Array.isArray(state[name]))
    || !record(state.flow_models) || !record(state.pose_models) || contexts.some(name => state[name] !== null && !record(state[name]))) return null;
  validateRows(rows);
  if (proposal.status !== 'proposed' || !ref(proposal.proposal_id)
    || (proposal.field_subquestion !== undefined && proposal.field_subquestion !== 'typed_material_flow')
    || proposal.binding?.observation_ref !== observation.observation_ref || proposal.binding?.level_epoch !== observation.level_epoch) return null;
  const present = flags.filter(flag => record(proposal[flag]));
  if (present.length !== 1) return null;
  const flag = present[0]!, plan = proposal[flag], pose = flag === 'material_pose_plan', flow = flag === 'material_flow_plan';
  const expectedKind = pose ? 'typed_pose_dependency' : flow ? 'typed_material_flow' : 'typed_carrier_experiment';
  const prefix = pose ? 'C_typed_pose_' : flow ? 'C_material_flow_' : 'C_typed_carrier_';
  if (proposal.kind !== expectedKind || proposal.proposal_id !== prefix + identity(plan).slice(0, 20)
    || plan.epoch !== observation.level_epoch || plan.score !== observation.levels_completed
    || plan.observation_ref !== observation.observation_ref || plan.frame_digest !== identity(rows)
    || plan.frame_digest.slice(0, 16) !== observation.frame_hash
    || !Array.isArray(proposal.actions) || !proposal.actions.length || proposal.actions.length > 16
    || !Array.isArray(proposal.steps) || proposal.steps.length !== proposal.actions.length
    || !equal(proposal.bundle_template?.actions, proposal.actions) || proposal.bundle_template?.objective_ref !== 'G_official_completion'
    || proposal.bundle_template?.composition_ref !== proposal.proposal_id
    || !equal(proposal.route_refs, proposal.bundle_template?.evidence)) return null;
  if (pose ? !equal(plan.actions, proposal.actions) : proposal.actions.length !== 1 || !equal(plan.action, proposal.actions[0])) return null;
  const selected = pose ? plan.mode === 'select' ? plan.child : plan.control : plan.selected;
  if (!record(selected) || !boxInRows(selected.bbox, rows) || !point(selected.point)) return null;
  for (const [index, action] of (proposal.actions as R[]).entries()) {
    const step = proposal.steps[index], support = step?.point_support;
    if (!record(action) || action.action_ref !== 'ACTION6' || !record(action.data) || !point([action.data.x, action.data.y])
      || !equal([action.data.x, action.data.y], selected.point) || !equal(step?.action, action) || !record(support)
      || support.level_epoch !== observation.level_epoch || support.observation_ref !== observation.observation_ref
      || support.frame_hash !== observation.frame_hash || !equal(support.projection_bbox, selected.bbox)
      || !equal(support.point, selected.point) || support.palette_value !== rows[action.data.y]![action.data.x]
      || support.projected_rows_digest !== projectionDigest(rows, selected.bbox)
      || support.entity_ref !== 'measured-material-support:' + identity([selected.bbox, selected.point, selected])
      || support.signature !== identity([selected, index])
      || (step.point_binding !== undefined && !same(step.point_binding, support))) return null;
    const [x, y, r, b] = selected.bbox as [number, number, number, number];
    if (!(x <= action.data.x && action.data.x <= r && y <= action.data.y && action.data.y <= b)) return null;
    if (!pose && step.expected_after !== null) return null;
  }
  const first = proposal.steps[0].expected_before;
  if (!record(first) || !['level_epoch', 'frame_hash', 'levels_completed', 'state'].every(key => equal(first[key], observation[key]))
    || typedMaterialBefore(proposal, 0, rows, { epoch: observation.level_epoch, score: observation.levels_completed,
      observation_ref: observation.observation_ref, available: observation.available_action_refs }).admitted !== true) return null;

  const journal = [...state.carrier_events, ...state.flow_events, ...state.pose_events] as R[], used: R[] = [];
  const journalReferences = new Set<string>();
  for (const event of journal) {
    if (!record(event) || !eventKinds.has(event.kind)) return null;
    const refs = references(event.evidence); if (!refs?.length) return null;
    for (const value of refs) journalReferences.add(value);
  }
  const use = (event: R | undefined): boolean => {
    if (!event) return false;
    if (!used.some(value => same(value, event))) used.push(event);
    return true;
  };
  const find = (events: R[], predicate: (event: R) => boolean): R | undefined => [...events].reverse().find(predicate);
  const witnessedRefs = (values: unknown): boolean => {
    const refs = references(values); return refs !== null && refs.every(value => value === observation.observation_ref || journalReferences.has(value));
  };
  if (!witnessedRefs(proposal.route_refs)) return null;
  const boxes: number[][] = [selected.bbox], contextModelIds: string[] = [];
  let relation: R, acquired = true;

  function calibrationWitnesses(): boolean {
    for (const calibration of state.carrier_calibration as R[]) {
      if (!point(calibration.size) || calibration.status !== 'observed_body_extent' || !witnessedRefs(calibration.evidence)) return false;
      if (!use(find(state.carrier_events, event => record(event.selected) && Array.isArray(event.selected.marks) && event.selected.marks.length > 0
        && (event.selected.support_source ?? 'component') === 'component'
        && equal([event.selected.bbox[2] - event.selected.bbox[0] + 1, event.selected.bbox[3] - event.selected.bbox[1] + 1], calibration.size)
        && equal(event.evidence, calibration.evidence)))) return false;
    }
    return true;
  }
  function childWitness(child: R): boolean {
    if (state.flow_epoch !== observation.level_epoch || !state.flow_children.some((value: R) => same(value, child))
      || !boxInRows(child.bbox, rows) || !point(child.center) || !point(child.point) || !typedChildPresent(child, rows)) return false;
    const origin = find(state.flow_events, event => event.kind === 'typed_material_flow' && event.epoch === observation.level_epoch
      && event.boundary === false && event.effect === 'replacement_activated_into_typed_occurrences'
      && Array.isArray(event.added_children) && event.added_children.some((value: R) => value.id === child.id && value.source_ref === child.source_ref
        && equal(value.bbox, child.bbox) && equal(value.center, child.center) && equal(value.point, child.point)));
    if (!use(origin) || !origin!.evidence.includes(child.source_ref)) return false;
    const original = origin!.added_children.find((value: R) => value.id === child.id);
    if (!same(original, child) && !use(find(state.pose_events, event => event.kind === 'typed_pose_response' && event.stop_reason === null
      && record(event.child) && same(event.child, child)))) return false;
    boxes.push(child.bbox); return true;
  }
  function associationWitness(model: R): boolean {
    if (!ref(model.core_signature) || model.status !== 'conditional_material_to_request_association' || !witnessedRefs(model.evidence)
      || !witnessedRefs([model.source_ref, model.last_validation_ref])) return false;
    return use(find(state.flow_events, event => event.kind === 'typed_material_flow'
      && ['material_consumed_and_request_changed', 'official_boundary_after_request'].includes(event.effect)
      && event.stop_reason === null && record(event.model) && same(event.model, model)));
  }
  function currentTarget(target: R): boolean {
    if (!record(target) || !boxInRows(target.bbox, rows)) return false;
    const candidates = typedMaterialRequests(rows, observation, state.flow_filled.map(shape))
      .filter(value => !state.flow_filled.some((box: number[]) => equal(box, value.bbox)));
    if (!candidates.some(value => same(value, target))) return false;
    boxes.push(target.bbox); return true;
  }

  if (!flow && !pose) {
    const cfg = plan.configuration;
    if (!record(cfg) || !Number.isFinite(cfg.minimum_body_fill) || cfg.minimum_body_fill <= 0 || cfg.minimum_body_fill >= 1
      || !Number.isSafeInteger(cfg.minimum_repeated_carriers) || cfg.minimum_repeated_carriers < 2
      || !Number.isSafeInteger(cfg.minimum_distinct_internal_marks) || cfg.minimum_distinct_internal_marks < 2
      || !Number.isSafeInteger(cfg.maximum_pixels_per_mark) || cfg.maximum_pixels_per_mark < 1
      || !same(cfg.observed_body_shapes, state.carrier_calibration) || !calibrationWitnesses()) return null;
    const scene = measureTypedCarriers(rows, observation, cfg), context = state.carrier_context;
    if (!same(plan.contact_context, context)) return null;
    const expectedScene = scene ?? (context?.kind === 'produced_support'
      ? { carriers: [], source_ref: observation.observation_ref, frame_digest: identity(rows) } : null);
    if (!expectedScene || !same(plan.scene, expectedScene)) return null;
    if (context?.kind === 'produced_support') {
      if (plan.reason !== 'test_activation_of_observed_replacement' || context.epoch !== observation.level_epoch
        || context.frame_digest !== identity(rows) || !same(selected, context.selected)
        || !Array.isArray(context.removed) || context.removed.length < 2
        || !Array.isArray(selected.embedded_substructures) || selected.embedded_substructures.length !== context.removed.length
        || !geometricComponents(rows).some(part => part.id === selected.body_ref && equal(part.bbox, selected.bbox) && part.color === selected.body_palette)
        || !use(find(state.carrier_events, event => record(event.contact_context) && same(event.contact_context, context)
          && event.after_epoch === observation.level_epoch && equal(event.evidence, context.evidence)))) return null;
      for (const embedded of selected.embedded_substructures as R[]) {
        const original = context.removed.find((value: R) => value.id === embedded.source_id && value.signature === embedded.source_signature);
        if (!original || !Array.isArray(embedded.possible_anchors) || !embedded.possible_anchors.length
          || !embedded.possible_anchors.every((anchor: number[]) => point(anchor) && original.marks.every(([value, dx, dy]: number[]) => {
            const x = Math.trunc(anchor[0]! + dx!), y = Math.trunc(anchor[1]! + dy!);
            return selected.bbox[0] <= x && x <= selected.bbox[2] && selected.bbox[1] <= y && y <= selected.bbox[3] && rows[y]![x] === value;
          }))) return null;
      }
      relation = { kind: 'acquired_material_replacement_with_current_embedded_marks', source_occurrences: context.removed.map((value: R) => value.id) };
      contextModelIds.push('material-replacement-context:' + identity(context));
    } else {
      if (!scene || scene.carriers.length < 2 || !scene.carriers.some((value: R) => same(value, selected))) return null;
      const carriers = scene.carriers as R[], shared = (carriers[0]!.marks as number[][]).map(mark => mark[0]!)
        .filter(value => carriers.every(carrier => carrier.marks.some((mark: number[]) => mark[0] === value)));
      if (!shared.length || new Set(carriers.map(carrier => identity(carrier.bbox))).size !== carriers.length) return null;
      boxes.push(...carriers.map(carrier => carrier.bbox));
      relation = { kind: 'current_repeated_dense_supports_with_shared_typed_marks', carrier_refs: carriers.map(carrier => carrier.id),
        shared_mark_values: [...new Set(shared)].sort((a, b) => a - b), selection_and_production_unconfirmed: true };
      if (context) {
        if (context.kind !== 'local_marking' || plan.reason !== 'test_shared_outer_material_profile_after_local_marking'
          || context.epoch !== observation.level_epoch || context.frame_digest !== identity(rows)
          || !use(find(state.carrier_events, event => record(event.contact_context) && same(event.contact_context, context)
            && event.after_epoch === observation.level_epoch && event.measured_core_bodies_preserved === true && event.local_external_marking === true
            && equal(event.evidence, context.evidence)))) return null;
        const matches = carriers.filter(carrier => !equal(carrier.bbox, context.selected.bbox)
          && equal(profile(carrier.fringe), profile(context.selected.fringe)));
        if (matches.length !== 1 || !same(matches[0], selected)) return null;
        relation.acquired_context = 'local_external_marking_with_current_outer_profile_comparison';
        contextModelIds.push('material-selection-context:' + identity(context));
      } else {
        if (plan.reason !== 'test_current_marked_carrier') return null;
        const empty = journal.length === 0 && lists.every(name => state[name].length === 0) && contexts.every(name => state[name] === null)
          && state.flow_epoch === null && state.pose_epoch === null && Object.keys(state.flow_models).length === 0 && Object.keys(state.pose_models).length === 0;
        if (empty) acquired = false;
        else {
          if (!state.carrier_calibration.length || state.flow_children.length || state.flow_context !== null || state.pose_context !== null) return null;
          const prior = Object.values(state.flow_models).filter(record).find(model => associationWitness(model));
          if (!prior) return null;
          relation.acquired_context = 'retained_body_calibration_and_observed_material_association';
          contextModelIds.push('material-body-calibration:' + identity(state.carrier_calibration), 'material-association:' + identity(prior));
        }
      }
    }
  } else if (flow) {
    if (!record(plan.child) || !childWitness(plan.child) || !currentTarget(plan.target)
      || !['select', 'deliver'].includes(plan.mode)) return null;
    const model = state.flow_models[plan.child.core_signature] ?? null;
    if (!same(plan.source_model, model)) return null;
    if (model && !associationWitness(model)) return null;
    const matching = typedMaterialRequests(rows, observation, state.flow_filled.map(shape))
      .filter(target => !state.flow_filled.some((box: number[]) => equal(box, target.bbox))
        && (model ? equal(target.descriptor, model.descriptor) : target.descriptor.palette === plan.child.body_palette));
    if (matching.length !== 1 || !same(matching[0], plan.target)) return null;
    if (plan.mode === 'deliver') {
      if (!record(state.flow_context) || !same(state.flow_context.child, plan.child) || !same(selected, plan.target)) return null;
      const bySelection = find(state.flow_events, event => event.epoch === observation.level_epoch && event.effect === 'local_child_marking'
        && event.stop_reason === null && record(event.context) && same(event.context, state.flow_context));
      const byPose = find(state.pose_events, event => event.kind === 'typed_pose_response' && event.stop_reason === null && event.ready_for_request === true
        && same(event.child, plan.child) && equal(event.evidence, state.flow_context.evidence));
      if (!use(bySelection ?? byPose)) return null;
    } else if (state.flow_context !== null || !same(selected, plan.child)) return null;
    relation = { kind: 'acquired_descendant_with_unique_current_request', child_ref: plan.child.id,
      request_ref: plan.target.id, association_acquired: model !== null, request_response_unconfirmed: true };
    contextModelIds.push('material-descendant:' + identity(plan.child));
    if (model) contextModelIds.push('material-association:' + identity(model));
    if (state.flow_context) contextModelIds.push('material-request-context:' + identity(state.flow_context));
  } else {
    if (!record(plan.child) || !childWitness(plan.child) || !record(plan.control) || !record(plan.option)
      || !['select', 'control'].includes(plan.mode) || !state.pose_controls.some((control: R) => same(control, plan.control))
      || !typedControlMatches(plan.control, rows, observation.level_epoch) || !currentTarget(plan.option.target)) return null;
    const currentControls = state.pose_controls.filter((control: R) => typedControlMatches(control, rows, observation.level_epoch));
    if (currentControls.length !== 1 || !same(currentControls[0], plan.control)) return null;
    boxes.push(plan.control.bbox);
    const scope = find(state.pose_events, event => event.kind === 'typed_pose_scope' && event.epoch === observation.level_epoch
      && event.controls.some((control: R) => equal(control.bbox, plan.control.bbox) && equal(control.point, plan.control.point)
        && control.source_ref === plan.control.source_ref));
    if (!use(scope)) return null;
    const originalControl = scope!.controls.find((control: R) => equal(control.bbox, plan.control.bbox));
    if (!same(originalControl, plan.control) && !use(find(state.pose_events, event => event.kind === 'typed_pose_response'
      && event.stop_reason === null && record(event.control) && same(event.control, plan.control)))) return null;
    const model = state.pose_models[plan.option.model_ref];
    if (!record(model) || !same(model, plan.option.model) || model.kind !== 'typed_pose_model'
      || !use(find(state.pose_events, event => same(event, model))) || !Number.isSafeInteger(plan.option.turns)
      || plan.option.turns < 0 || plan.option.turns > 3
      || !equal(rotatedTypedMarks(plan.child.marks, plan.option.turns), plan.option.marks)
      || !equal(plan.option.marks, sortedMarks(model.marks)) || !equal(model.descriptor, plan.option.target.descriptor)) return null;
    const association = Object.fromEntries(Object.entries(model).filter(([name]) => name !== 'kind' && name !== 'marks'));
    if (!associationWitness(association) || !same(plan.rule, state.pose_rule)) return null;
    if (plan.rule !== null) {
      if (plan.rule.status !== 'conditional_observed_pose_change' || plan.rule.epoch !== observation.level_epoch
        || ![1, 2, 3].includes(plan.rule.turns) || !equal(plan.rule.control_bbox, plan.control.bbox)
        || !use(find(state.pose_events, event => event.kind === 'typed_pose_response' && event.stop_reason === null && record(event.rule) && same(event.rule, plan.rule)))) return null;
    }
    if (plan.mode === 'control') {
      if (!record(state.pose_context) || !same(state.pose_context.child, plan.child)
        || !use(find(state.pose_events, event => event.kind === 'typed_pose_response' && event.stop_reason === null
          && record(event.child) && same(event.child, plan.child) && equal(event.evidence, state.pose_context.evidence)))) return null;
    } else if (state.pose_context !== null) return null;
    const predicted = plan.mode === 'control' && plan.rule !== null;
    if (predicted) {
      if (!equal(currentTypedMarks(plan.child, rows), plan.child.marks)
        || !Array.isArray(plan.expected_before) || !Array.isArray(plan.expected_after)
        || plan.expected_before.length !== proposal.actions.length || plan.expected_after.length !== proposal.actions.length) return null;
      for (let index = 0; index < proposal.actions.length; index++) {
        if (!equal(plan.expected_before[index], rotatedTypedMarks(plan.child.marks, plan.rule.turns * index))
          || !equal(plan.expected_after[index], rotatedTypedMarks(plan.child.marks, plan.rule.turns * (index + 1)))
          || !equal(proposal.steps[index].expected_after, { typed_marks: plan.expected_after[index], outside_selected_scopes_preserved: true })) return null;
      }
    } else if (proposal.actions.length !== 1 || !equal(plan.expected_before, []) || !equal(plan.expected_after, []) || proposal.steps[0].expected_after !== null) return null;
    relation = { kind: 'acquired_role_and_request_with_current_pose_comparison', child_ref: plan.child.id, request_ref: plan.option.target.id,
      model_ref: plan.option.model_ref, current_control_source_ref: plan.control.source_ref, conditional_pose_predictions: predicted, next_effect_requires_measurement: true };
    contextModelIds.push('material-descendant:' + identity(plan.child), 'material-pose-model:' + identity(model), 'material-control-scope:' + identity(scope));
    if (plan.rule) contextModelIds.push('material-pose-rule:' + identity(plan.rule));
    if (state.pose_context) contextModelIds.push('material-pose-context:' + identity(state.pose_context));
  }
  if (acquired && (used.length === 0 || contextModelIds.length === 0)) return null;
  const usedRefs = [...new Set(used.flatMap(event => references(event.evidence) ?? []))];
  const supportBoxes = [...new Map(boxes.map(box => [identity(box), [...box]])).values()];
  return { status: acquired ? 'acquired_context_for_unknown_effect' : 'current_measured_relation_for_unknown_effect',
    source_entry: 'typed_material_flow', proposal_ref: proposal.proposal_id, observation_ref: observation.observation_ref,
    level_epoch: observation.level_epoch, frame_digest: plan.frame_digest, supportBoxes,
    evidence_refs: [...new Set([observation.observation_ref, ...usedRefs])],
    context_model_ids: contextModelIds,
    acquisition_event_refs: used.map(event => 'typed-material-event:' + identity(event)),
    acquisition_event_witnesses: used.map(event => ({ kind: event.kind, event_digest: identity(event), evidence_refs: references(event.evidence) })),
    measured_relation: relation, effect_requires_actual_return: true,
    qualification: acquired
      ? 'Current guarded material question linked to retained acquisition events. Geometry, comparisons and conditional pose predictions do not confirm the next response or an official goal.'
      : 'Current repeated marked supports and shared typed vocabulary are measured in the public raster. This material owner has no acquired event; selection, production and goal roles remain unknown.' };
}

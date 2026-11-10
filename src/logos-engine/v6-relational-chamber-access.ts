/**
 * RelationalChamberAccess's own layer from pinned V6 source
 * 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e. The common series owner dispatches
 * inherited planners and records and owns the single shared journal.
 */
import { measureRelationalChamber, relationalChamberProjection as projection, relationalChamberPlanIdentity } from './v6-relational-chamber-observation.ts';
import { networkDomain } from './v5-finite-relation-domain.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { pythonEqual as equal, pythonTruthy as truth } from './v6-operations.ts';
import { compareUnicode } from './canonical.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
type BeforeMeta = { epoch: number; score: number; observation_ref: string; available: readonly string[] };
type AfterMeta = { epoch: number; score: number; state?: string };
export interface RelationalChamberState { relation_memory: R; relation_events: R[] }
const rowKey = (values: unknown): string => JSON.stringify(values);

export function freshChamberRelations(): R { return { rows: {}, edges: {}, evidence: [], conflicts: [], failed: [], boundaries: [] }; }

export function learnChamberRelations(scene: R, memory: R, ref: string): R {
  const values = Object.fromEntries(scene.controls.map((control: R) => [control.id, control.value]));
  for (const axis of scene.axes) {
    const table = memory.rows[axis.context] ??= {}, key = rowKey(axis.inputs.map((input: string) => values[input])), old = table[key];
    if (truth(old) && old.value !== axis.value) {
      const conflict = { context: axis.context, inputs: key, old: old.value, new: axis.value, evidence: ref };
      if (!memory.conflicts.some((item: R) => equal(item, conflict))) memory.conflicts.push(conflict);
    } else if (!truth(old)) table[key] = { value: axis.value, evidence: [ref] };
    else if (!old.evidence.includes(ref)) old.evidence.push(ref);
  }
  if (!memory.evidence.includes(ref)) memory.evidence.push(ref);
  return memory;
}

export function predictChamberRelations(scene: R, memory: R, settings: R): R | null {
  const axes: [string, string][] = [];
  for (const axis of scene.axes) {
    const row = memory.rows[axis.context]?.[rowKey(axis.inputs.map((input: string) => settings[input]))];
    if (row === undefined) return null;
    axes.push([axis.id, row.value]);
  }
  return { settings: scene.controls.map((control: R) => [control.id, settings[control.id]]), axes };
}

export function inverseChamberRelations(scene: R, memory: R, cfg: R): R | null {
  const values = [...new Set<string>([...scene.controls.map((control: R) => control.value),
    ...Object.values(memory.rows).flatMap((table: any) => Object.keys(table).flatMap(key => JSON.parse(key)))])].sort(compareUnicode);
  const targets = scene.axes.filter((axis: R) => axis.target !== null);
  if (values.length !== 2 || scene.controls.length > cfg.max_variables) return null;
  const variables = scene.controls.map((control: R) => ({ variable_ref: control.id, values, source: true }));
  const components: R[] = [], contexts = new Map<string, number>();
  for (const axis of targets) {
    variables.push({ variable_ref: axis.id, values: ['-1', '0', '1'], source: false });
    const context = axis.context; contexts.set(context, axis.inputs.length);
    components.push({ component_ref: 'constraint:' + axis.id, model_scope_ref: context, signature_ref: context,
      context_ref: context, ordered_input_refs: [...axis.inputs], output_ref: axis.id });
  }
  const models = [...contexts].map(([context, arity]) => ({ model_ref: 'observed:' + context, model_scope_ref: context,
    signature_ref: context, context_ref: context, arity, rows: Object.entries(memory.rows[context] ?? {}).map(([key, row]: [string, any]) =>
      ({ inputs: JSON.parse(key), outputs: [row.value] })), table_complete: false, deterministic: true }));
  const request = { variables, components, models, domain_offset: 0, maximum_states: cfg.max_states, maximum_relation_checks: cfg.max_checks };
  const domain = networkDomain(request as any, Object.fromEntries(targets.map((axis: R) => [axis.id, axis.target])));
  const current = Object.fromEntries(scene.controls.map((control: R) => [control.id, control.value])), candidates: R[] = [];
  for (const state of domain.states) {
    const assignment = Object.fromEntries(state.assignment), changes = scene.controls.filter((control: R) => assignment[control.id] !== current[control.id]).map((control: R) => control.id);
    if (changes.length) candidates.push({ settings: Object.fromEntries(scene.controls.map((control: R) => [control.id, assignment[control.id]])),
      changes, unknown_rows: structuredClone(state.unknown_rows) });
  }
  candidates.sort((a, b) => {
    const first = a.unknown_rows.length - b.unknown_rows.length || a.changes.length - b.changes.length;
    if (first) return first;
    for (let i = 0; i < a.changes.length; i++) { const order = compareUnicode(a.changes[i], b.changes[i]); if (order) return order; }
    return 0;
  });
  return { candidates, enumerated: domain.enumerated_assignments, checks: domain.relation_checks,
    complete_finite_domain: domain.complete, bounded: domain.bounded };
}

export function relationalChamberBefore(proposal: R, index: number, rows: NativeRows, meta: BeforeMeta): R {
  const plan = proposal.chamber_relation_plan;
  if (!Object.hasOwn(proposal, 'chamber_relation_plan')) throw new TypeError('Chamber relation admission requires chamber_relation_plan');
  const scene = measureRelationalChamber(rows);
  let admitted = proposal.proposal_id === 'chamber-relations:' + relationalChamberPlanIdentity(plan) && equal(proposal.actions, plan.commands)
    && equal(plan.commands, proposal.bundle_template.actions) && equal([meta.epoch, meta.score], [plan.epoch, plan.score])
    && meta.available.includes('ACTION6') && scene !== null && scene.layout === plan.scene.layout;
  if (index === 0) admitted = admitted && identity(rows) === plan.frame_digest && meta.observation_ref === plan.observation_ref;
  else admitted = admitted && plan.predicted[index - 1] !== null && equal(projection(scene!), plan.predicted[index - 1]);
  if (admitted) {
    const edit = plan.edits[index], control = scene!.controls.find((value: R) => value.id === edit.id);
    admitted = control !== undefined && equal(control.point, edit.point) && control.value === edit.old
      && control.support.every(([x, y]: [number, number]) => String(rows[y]![x]) === control.value);
  }
  return { admitted: Boolean(admitted), reason: admitted ? 'current_relation_control_bound' : 'relation_binding_changed' };
}

export function relationalChamberAfter(proposal: R, index: number, _rows: NativeRows, later: NativeRows, meta: AfterMeta): R {
  const plan = proposal.chamber_relation_plan;
  if (!truth(plan)) throw new TypeError('Chamber relation outcome requires chamber_relation_plan');
  const scene = measureRelationalChamber(later), boundary = !equal([meta.epoch, meta.score], [plan.epoch, plan.score]);
  const expected = plan.predicted[index], matched = scene && !boundary && expected !== null
    ? scene.layout === plan.scene.layout && equal(projection(scene), expected) : null;
  return { matched, seal_prefix: boundary || matched !== true,
    reason: matched ? 'observed_relation_projection' : 'unknown_or_changed_relation_scope' };
}

export class RelationalChamberMemory {
  private relationMemory: R = freshChamberRelations();
  private relationEvents: R[] = [];
  private version = 0;
  get nativeRevision(): number { return this.version; }
  get eventCount(): number { return this.relationEvents.length; }
  currentState(): RelationalChamberState { return structuredClone({ relation_memory: this.relationMemory, relation_events: this.relationEvents }); }
  retainedDigest(ancestor: string): string { return identity([ancestor, this.relationMemory, this.relationEvents]); }
  applyEvent(event: R): void {
    if (event.kind !== 'observed_chamber_relations') throw new TypeError(`Outside chamber-relation layer: ${String(event.kind)}`);
    const owned = retainNativeJson(event);
    if (!Object.hasOwn(owned, 'memory')) throw new TypeError('Chamber relation event lacks its memory');
    this.version++; this.relationMemory = owned.memory; this.relationEvents.push(owned);
  }

  /** Null delegates to the inherited planner; source blocking refusals remain explicit. */
  propose(observation: R, rows: NativeRows, _inputs: readonly R[], limit: number, config: R): R | null {
    const cfg = config.relational_chamber_question;
    if (!truth(cfg)) return null;
    const scene = measureRelationalChamber(rows);
    if (!scene) return null;
    if (!observation.available_action_refs.includes('ACTION6')) return { status: 'unknown', reason: 'pointing_unavailable', block_unrelated_probe: true };
    const memory = learnChamberRelations(scene, structuredClone(this.relationMemory), observation.observation_ref);
    const contexts = new Set(scene.axes.map((axis: R) => axis.context));
    if (memory.conflicts.some((conflict: R) => contexts.has(conflict.context))) return { status: 'unknown', reason: 'shared_relation_rows_contradicted', block_unrelated_probe: true };
    const domain = inverseChamberRelations(scene, memory, cfg);
    if (!domain || !domain.candidates.length) return { status: 'unknown', reason: 'relation_inverse_unresolved', block_unrelated_probe: true };
    const remaining = config.remaining_level_actions ?? limit;
    const candidate = domain.candidates.find((value: R) => value.changes.length <= remaining) ?? domain.candidates[0];
    const byId = new Map<string, R>(scene.controls.map((control: R) => [control.id, control]));
    const settings = Object.fromEntries(scene.controls.map((control: R) => [control.id, control.value]));
    const actions: R[] = [], predicted: (R | null)[] = [], edits: R[] = [];
    let why = cfg.contribute, kind = 'conditional_relation_contribution';
    for (const ref of candidate.changes.slice(0, Math.min(16, limit))) {
      const control = byId.get(ref)!, old = settings[ref], value = candidate.settings[ref];
      const trial = identity([scene.layout, projection(scene), ref, value]);
      if (memory.failed.includes(trial)) continue;
      const command = { action_ref: 'ACTION6', data: { x: control.point[0], y: control.point[1] } };
      const edge = rowKey([control.support.length, old, value]), known = Object.hasOwn(memory.edges, edge);
      settings[ref] = value;
      const expected = predictChamberRelations(scene, memory, settings);
      actions.push(command); predicted.push(expected); edits.push({ id: ref, old, new: value, edge, known, trial, point: control.point });
      if (!known || expected === null) { why = cfg.experiment; kind = 'relation_experiment'; break; }
    }
    if (!actions.length) return { status: 'unknown', reason: 'relation_trials_exhausted', block_unrelated_probe: true };
    const plan = structuredClone({ scene, memory, domain: { enumerated: domain.enumerated, checks: domain.checks,
      complete_finite_domain: domain.complete_finite_domain, bounded: domain.bounded }, candidate, commands: actions,
      predicted, edits, why, kind, epoch: observation.level_epoch, score: observation.levels_completed,
      observation_ref: observation.observation_ref, frame_digest: identity(rows) });
    const ref = 'chamber-relations:' + relationalChamberPlanIdentity(plan), evidence = memory.evidence;
    return { status: 'proposed', kind: 'chamber_relations', proposal_id: ref, chamber_relation_plan: plan,
      actions, steps: actions.map(action => ({ action, expected_after: null })), facts: { current_chamber_axes_measured: true,
        relation_tables_partial: true, v5_finite_domain_kernel_used: true, target_frame_is_library_hypothesis: true, no_force_formula_supplied: true },
      compositions: [{ id: ref, observed: false, open_question: why, relations: ['contributes_to:G_official_completion'] }],
      question: { reason: why, hypothesis_refs: evidence }, route_refs: evidence,
      binding: { level_epoch: observation.level_epoch, observation_ref: observation.observation_ref },
      bundle_template: { operation_key: 'OP18', composition_ref: ref, objective_ref: 'G_official_completion', purpose: why,
        evidence, preconditions: {}, actions, outcome_guard: { path: ['value'], contains: ref } } };
  }

  /** Called after ancestor records, exactly once for an acquired chamber proposal. */
  record(before: R, command: R, after: R, rows: NativeRows, later: NativeRows, proposal: R, index: number): R[] {
    const plan = proposal.chamber_relation_plan;
    if (!truth(plan)) return [];
    const a = measureRelationalChamber(rows), b = measureRelationalChamber(later);
    let memory = structuredClone(this.relationEvents.length ? this.relationMemory : plan.memory);
    if (a) memory = learnChamberRelations(a, memory, before.observation_ref);
    const detail: R = { before: before.observation_ref, after: after.observation_ref, command };
    if (before.level_epoch !== after.level_epoch) {
      memory.boundaries.push({ before: before.observation_ref, after: after.observation_ref, score: after.levels_completed });
      detail.boundary_not_same_scope_effect = true;
    } else if (a && b && a.layout === b.layout) {
      const av = Object.fromEntries(a.controls.map((control: R) => [control.id, control.value]));
      const bv = Object.fromEntries(b.controls.map((control: R) => [control.id, control.value]));
      const changed = Object.keys(av).filter(key => av[key] !== bv[key]), edit = plan.edits[index];
      if (equal(changed, [edit.id]) && bv[edit.id] === edit.new) memory.edges[edit.edge] = {
        evidence: [before.observation_ref, after.observation_ref], status: 'observed_edit_under_current_binding' };
      else { memory.failed.push(edit.trial); detail.edit_contradiction = { changed, expected: edit.id }; }
      const expected = plan.predicted[index];
      detail.prediction_matched = expected === null ? null : equal(projection(b), expected);
      detail.changed_controls = changed;
      memory = learnChamberRelations(b, memory, after.observation_ref);
    } else detail.projection_or_layout_unknown = true;
    const event = structuredClone({ kind: 'observed_chamber_relations', memory, detail });
    this.applyEvent(event); return [event];
  }
}

export function proposeRelationalChamber(memory: RelationalChamberMemory, observation: R, rows: NativeRows, inputs: readonly R[], limit: number, config: R): R | null {
  return memory.propose(observation, rows, inputs, limit, config);
}

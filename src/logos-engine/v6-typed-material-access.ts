/** Three own source layers: marked carriers, material flow and selected-role pose. */
import { measureTypedCarriers, typedReplacementCandidate, typedMaterialDescendants, typedMaterialRequests,
  typedChildPresent, typedLocalChildMark, typedSmallParts, novelTypedControls, rotatedTypedMarks,
  currentTypedMarks, outsideTypedDigest, typedControlMatches, typedMaterialDigest as identity } from './v6-typed-material-observation.ts';
import { pythonEqual as equal, pythonTruthy as truth } from './v6-operations.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { projection, rowsDigest, type ObservedInputDomain } from './v6-native-observer.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
type BeforeMeta = { epoch: number; score: number; observation_ref: string; available: readonly string[] };
type AfterMeta = { epoch: number; score: number; state?: string };
const FLAGS = ['typed_carrier_plan', 'material_flow_plan', 'material_pose_plan'] as const;
const EVENT_KINDS = ['typed_carrier_response', 'typed_material_flow', 'typed_pose_scope', 'typed_pose_model', 'typed_pose_response'];
const compareText = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const sortMarks = (marks: readonly number[][]): number[][] => marks.map(mark => [...mark]).sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]! || a[2]! - b[2]!);
const expectedBefore = (obs: R): R => Object.fromEntries(['level_epoch', 'frame_hash', 'levels_completed', 'state'].map(key => [key, obs[key]]));
const shapeOf = (box: readonly number[]): number[] => [box[2]! - box[0]!, box[3]! - box[1]!];
const pointAction = (point: readonly number[]): R => ({ action_ref: 'ACTION6', data: { x: point[0], y: point[1] } });
const evidencePair = (before: R, after: R): string[] => [before.observation_ref, after.observation_ref];

export interface TypedMaterialState {
  carrier_events: R[]; carrier_context: R | null; carrier_calibration: R[];
  flow_epoch: number | null; flow_children: R[]; flow_context: R | null; flow_models: Record<string, R>; flow_filled: number[][]; flow_events: R[];
  pose_epoch: number | null; pose_initial_parts: R[]; pose_controls: R[]; pose_models: Record<string, R>; pose_context: R | null; pose_rule: R | null; pose_events: R[];
  requested_stop_reason: string | null;
}

function envelope(obs: R, kind: string, ref: string, flag: string, plan: R, actions: R[], steps: R[], facts: R,
  why: string, roles: unknown, question: R, evidence: string[]): R {
  return structuredClone({ status: 'proposed', kind, proposal_id: ref, [flag]: plan, actions, steps, facts,
    compositions: [{ id: ref, observed: false, open_question: why, properties: { roles }, relations: ['contributes_to:G_official_completion'] }],
    question, route_refs: evidence, binding: { level_epoch: obs.level_epoch, observation_ref: obs.observation_ref },
    bundle_template: { operation_key: 'OP18', composition_ref: ref, objective_ref: 'G_official_completion', preserve_refs: [], actions,
      purpose: why, preconditions: facts, evidence, outcome_guard: { path: ['value'], contains: ref } } });
}

export class TypedMaterialMemory {
  private carrierEvents: R[] = [];
  private carrierContext: R | null = null;
  private carrierCalibration: R[] = [];
  private flowEpoch: number | null = null;
  private flowChildren: R[] = [];
  private flowContext: R | null = null;
  private flowModels: Record<string, R> = {};
  private flowFilled: number[][] = [];
  private flowEvents: R[] = [];
  private poseEpoch: number | null = null;
  private poseInitialParts: R[] = [];
  private poseControls: R[] = [];
  private poseModels: Record<string, R> = {};
  private poseContext: R | null = null;
  private poseRule: R | null = null;
  private poseEvents: R[] = [];
  private poseCfg: R | null = null;
  private poseLimit = 1;
  private stopReason: string | null = null;
  private version = 0;

  get nativeRevision(): number { return this.version; }
  get requestedStopReason(): string | null { return this.stopReason; }
  currentState(): TypedMaterialState {
    return structuredClone({ carrier_events: this.carrierEvents, carrier_context: this.carrierContext, carrier_calibration: this.carrierCalibration,
      flow_epoch: this.flowEpoch, flow_children: this.flowChildren, flow_context: this.flowContext, flow_models: this.flowModels,
      flow_filled: this.flowFilled, flow_events: this.flowEvents, pose_epoch: this.poseEpoch, pose_initial_parts: this.poseInitialParts,
      pose_controls: this.poseControls, pose_models: this.poseModels, pose_context: this.poseContext, pose_rule: this.poseRule,
      pose_events: this.poseEvents, requested_stop_reason: this.stopReason });
  }
  /** The source excludes proposal-local configuration, prefix limit and stop diagnostics. */
  retainedCarrierDigest(ancestor: string): string { return identity([ancestor, this.carrierEvents, this.carrierContext, this.carrierCalibration]); }
  retainedFlowDigest(ancestor: string): string {
    return identity([this.retainedCarrierDigest(ancestor), this.flowEpoch, this.flowChildren, this.flowContext, this.flowModels, this.flowFilled, this.flowEvents]);
  }
  retainedDigest(ancestor: string): string {
    return identity([this.retainedFlowDigest(ancestor), this.poseEpoch, this.poseInitialParts, this.poseControls, this.poseModels, this.poseContext, this.poseRule, this.poseEvents]);
  }

  applyEvent(event: R): void {
    if (!EVENT_KINDS.includes(event.kind)) throw new TypeError(`Outside typed material layers: ${String(event.kind)}`);
    const e = retainNativeJson(event); this.version++;
    if (e.kind === 'typed_carrier_response') {
      this.carrierEvents.push(e); this.carrierContext = e.contact_context ?? null;
      const c = e.selected, [x, y, r, b] = c.bbox, size = [r - x + 1, b - y + 1];
      if (truth(c.marks) && (c.support_source ?? 'component') === 'component' && !this.carrierCalibration.some(v => equal(v.size, size))) {
        this.carrierCalibration.push(retainNativeJson({ size, evidence: e.evidence, status: 'observed_body_extent' }));
      }
      if (!this.carrierContext) this.stopReason = 'typed_carrier_effect_requires_reconciliation';
      return;
    }
    if (e.kind === 'typed_material_flow') {
      this.flowEvents.push(e);
      if (e.boundary || this.flowEpoch !== e.epoch) { this.flowChildren = []; this.flowFilled = []; this.flowContext = null; }
      this.flowEpoch = e.epoch;
      this.flowChildren = this.flowChildren.filter(c => !(e.removed_children ?? []).includes(c.id));
      this.flowChildren.push(...(e.added_children ?? [])); this.flowContext = e.context ?? null; this.flowFilled.push(...(e.filled ?? []));
      if (truth(e.model)) this.flowModels[e.model.core_signature] = e.model;
      this.carrierContext = null; this.stopReason = e.stop_reason ?? null;
      return;
    }
    if (e.kind === 'typed_pose_scope') {
      this.poseEpoch = e.epoch; this.poseInitialParts = [...e.initial_parts]; this.poseControls = [...e.controls];
      this.poseContext = null; this.poseRule = null; this.poseEvents.push(e); return;
    }
    if (e.kind === 'typed_pose_model') { this.poseModels[e.core_signature] = e; this.poseEvents.push(e); return; }
    this.poseEvents.push(e); this.poseRule = Object.hasOwn(e, 'rule') ? e.rule : this.poseRule; this.stopReason = e.stop_reason ?? null;
    if (truth(e.child)) {
      const child = e.child; this.flowChildren = this.flowChildren.map(c => c.id === child.id ? child : c);
      if (e.ready_for_request) { this.flowContext = retainNativeJson({ child, evidence: e.evidence }); this.poseContext = null; }
      else { this.poseContext = retainNativeJson({ child, evidence: e.evidence }); this.flowContext = null; }
    }
    if (truth(e.control)) this.poseControls = this.poseControls.map(control => equal(control.bbox, e.control.bbox) ? e.control : control);
  }

  setPrefixLimit(limit: number): void {
    if (this.poseLimit !== limit) { this.poseLimit = limit; this.version++; }
  }

  carrierQuestion(obs: R, rows: NativeRows, cfg: R): R | null {
    // Like TypedPoseAccess.carrier_question, this is transient proposal context.
    if (!equal(this.poseCfg, cfg)) { this.poseCfg = retainNativeJson(cfg); this.version++; }
    if (this.flowEpoch === obs.level_epoch && this.flowChildren.length) return this.flowQuestion(obs, rows, cfg);
    if (this.carrierContext) return this.baseCarrierQuestion(obs, rows, cfg);
    if (this.flowEvents.length && !this.stopReason) return this.baseCarrierQuestion(obs, rows, cfg, null, []);
    return this.baseCarrierQuestion(obs, rows, cfg);
  }

  private baseCarrierQuestion(obs: R, rows: NativeRows, inputConfig: R, context: R | null = this.carrierContext,
    previousEvents: readonly R[] = this.carrierEvents): R | null {
    const cfg: R = { ...inputConfig, observed_body_shapes: [...this.carrierCalibration] };
    let reason = 'test_current_marked_carrier', scene = measureTypedCarriers(rows, obs, cfg), selected: R;
    if (!scene) {
      if (context?.kind === 'produced_support') scene = { carriers: [], source_ref: obs.observation_ref, frame_digest: identity(rows) };
      else return null;
    }
    if (context) {
      if (context.epoch !== obs.level_epoch || context.frame_digest !== identity(rows)) return null;
      if (context.kind === 'produced_support') { selected = context.selected; reason = 'test_activation_of_observed_replacement'; }
      else {
        const reference = context.selected, profile = this.fringeProfile(reference.fringe);
        const matches = (scene.carriers as R[]).filter(c => !equal(c.bbox, reference.bbox) && equal(this.fringeProfile(c.fringe), profile));
        if (matches.length !== 1) return null;
        selected = matches[0]!; reason = 'test_shared_outer_material_profile_after_local_marking';
      }
    } else if (previousEvents.length) return null;
    else selected = [...scene.carriers as R[]].sort((a, b) => a.center[1] - b.center[1] || a.center[0] - b.center[0] || compareText(a.signature, b.signature))[0]!;
    const action = pointAction(selected.point), plan = { epoch: obs.level_epoch, score: obs.levels_completed, observation_ref: obs.observation_ref,
      frame_digest: identity(rows), scene, selected, action, question: cfg.question, configuration: cfg, contact_context: context, reason,
      expected: 'Unknown: local marking may represent selection. A shared outer pattern is a compatibility hypothesis, not a proven production law.' };
    const ref = 'C_typed_carrier_' + identity(plan).slice(0, 20), facts = { marked_carriers_observed: true, one_current_support_bound: true };
    const detail = reason === 'test_activation_of_observed_replacement'
      ? 'The new material support contains translated matches of removed typed substructures. Its activation effect is unknown.'
      : 'Shared outer material counts leave connector geometry differences explicit; this is a compatibility experiment, not a pattern equality or production law.';
    const why = cfg.question + ' Current experiment: ' + reason + '. ' + detail, evidence = [obs.observation_ref, ...(context ? context.evidence : [])];
    return envelope(obs, 'typed_carrier_experiment', ref, 'typed_carrier_plan', plan, [action], [{ action, expected_after: null }], facts,
      why, cfg.roles, { reason, hypothesis_refs: [] }, evidence);
  }

  private fringeProfile(fringe: readonly number[][]): R {
    const result: R = {};
    for (const part of fringe) result[part[2]!] = (result[part[2]!] ?? 0) + 1;
    return result;
  }

  private baseFlowQuestion(obs: R, rows: NativeRows, cfg: R): R | null {
    const available = this.flowChildren.filter(c => typedChildPresent(c, rows));
    if (!available.length) return null;
    const targets = typedMaterialRequests(rows, obs, this.flowFilled.map(shapeOf)).filter(q => !this.flowFilled.some(box => equal(q.bbox, box)));
    const matching = (child: R): R[] => {
      const prior = this.flowModels[child.core_signature];
      return targets.filter(q => prior ? equal(q.descriptor, prior.descriptor) : q.descriptor.palette === child.body_palette);
    };
    const ready = available.filter(c => matching(c).length === 1);
    if (!this.flowContext && !ready.length) return null;
    const child = this.flowContext?.child ?? ready.sort((a, b) => a.center[1] - b.center[1] || a.center[0] - b.center[0] || compareText(a.core_signature, b.core_signature))[0]!;
    if (!available.some(c => c.id === child.id)) return null;
    const model = this.flowModels[child.core_signature] ?? null, matches = matching(child);
    if (matches.length !== 1) return null;
    const target = matches[0]!, mode = this.flowContext ? 'deliver' : 'select', selected = mode === 'deliver' ? target : child;
    const reason = mode === 'deliver' ? 'test_typed_descendant_at_current_request' : 'test_selection_of_new_descendant', action = pointAction(selected.point);
    const evidence = [obs.observation_ref, child.source_ref, ...(model ? model.evidence : [])];
    const plan = { epoch: obs.level_epoch, score: obs.levels_completed, observation_ref: obs.observation_ref, frame_digest: identity(rows),
      child, target, selected, mode, action, source_model: model, reason,
      scope: 'Matching current material appearance proposes the first request; a prior accepted core-to-request association proposes later ones under fresh guards. Acceptance remains unconfirmed until the real response.' };
    const ref = 'C_material_flow_' + identity(plan).slice(0, 20), facts = { descendant_substructure_observed: true, current_request_unique_under_hypothesis: true };
    const why = cfg.flow_question + ' Experiment: ' + reason + '.';
    return envelope(obs, 'typed_material_flow', ref, 'material_flow_plan', plan, [action], [{ action, expected_after: null }], facts,
      why, cfg.flow_roles, { reason, hypothesis_refs: model ? [model.source_ref] : [] }, evidence);
  }

  matchingPoseTargets(child: R, rows: NativeRows, obs: R): R[] {
    const targets = typedMaterialRequests(rows, obs, this.flowFilled.map(shapeOf)).filter(q => !this.flowFilled.some(box => equal(q.bbox, box))), result: R[] = [];
    for (let turns = 0; turns < 4; turns++) {
      const marks = rotatedTypedMarks(child.marks, turns);
      for (const [key, model] of Object.entries(this.poseModels)) {
        if (!equal(marks, sortMarks(model.marks))) continue;
        for (const target of targets) if (equal(target.descriptor, model.descriptor)) result.push({ turns, model_ref: key, model, target, marks });
      }
    }
    return result;
  }

  flowQuestion(obs: R, rows: NativeRows, cfg: R): R | null {
    if (this.poseContext) return this.poseQuestion(obs, rows, cfg, this.poseContext.child, 'control');
    const ready = this.baseFlowQuestion(obs, rows, cfg);
    if (ready) return ready;
    const candidates = this.flowChildren.filter(c => typedChildPresent(c, rows) && this.matchingPoseTargets(c, rows, obs).length);
    if (!candidates.length) return null;
    const turns = (child: R): number => Math.min(...this.matchingPoseTargets(child, rows, obs).map(option => option.turns));
    const child = candidates.sort((a, b) => turns(a) - turns(b) || a.center[1] - b.center[1] || a.center[0] - b.center[0])[0]!;
    return this.poseQuestion(obs, rows, cfg, child, 'select');
  }

  /** Explicit native facade: the source's default question selection below is
   * unchanged. A returned selection can serve only the retained request and
   * model; a different currently matching request never replaces that parent. */
  nativeRetainedRequestQuestion(obs: R, rows: NativeRows, cfg: R, binding: R): R | null {
    if (!equal(this.poseCfg, cfg)) { this.poseCfg = retainNativeJson(cfg); this.version++; }
    const child = this.flowChildren.find(value => value.id === binding.child_ref);
    const context = this.poseContext ?? this.flowContext;
    if (this.stopReason || this.flowEpoch !== obs.level_epoch || !child
      || !typedChildPresent(child, rows)) return null;
    if (binding.phase === 'needs_selection' && !context) return this.poseQuestion(obs, rows, cfg, child, 'select', binding);
    if (context?.child.id !== child.id) return null;
    const options = this.matchingPoseTargets(child, rows, obs)
      .filter(option => option.target.id === binding.request.id && option.model_ref === binding.model_ref);
    if (!options.length) return null;
    if (options.some(option => option.turns === 0)) {
      const flow = this.baseFlowQuestion(obs, rows, cfg);
      return flow?.material_flow_plan.mode === 'deliver' && flow.material_flow_plan.child.id === child.id
        && flow.material_flow_plan.target.id === binding.request.id ? flow : null;
    }
    return this.poseQuestion(obs, rows, cfg, child, 'control', binding);
  }

  poseQuestion(obs: R, rows: NativeRows, cfg: R, child: R, mode: string, nativeParent: R | null = null): R | null {
    const controls = this.poseControls.filter(c => typedControlMatches(c, rows, obs.level_epoch));
    if (controls.length !== 1) return null;
    const options = this.matchingPoseTargets(child, rows, obs)
      .filter(option => nativeParent === null || option.target.id === nativeParent.request.id && option.model_ref === nativeParent.model_ref);
    if (!options.length) return null;
    const option = options.sort((a, b) => a.turns - b.turns || compareText(a.model_ref, b.model_ref))[0]!, control = controls[0]!;
    let count = 1, expected: number[][][] = [], before: number[][][] = []; const rule = this.poseRule;
    if (mode === 'control' && rule?.status === 'conditional_observed_pose_change') {
      const possible = [1, 2, 3].filter(n => equal(rotatedTypedMarks(child.marks, rule.turns * n), option.marks));
      if (!possible.length) return null;
      count = Math.min(Math.min(...possible), Math.max(1, this.poseLimit));
      expected = Array.from({ length: count }, (_, i) => rotatedTypedMarks(child.marks, rule.turns * (i + 1)));
      before = Array.from({ length: count }, (_, i) => rotatedTypedMarks(child.marks, rule.turns * i));
    }
    const point = mode === 'select' ? child.point : control.point, action = pointAction(point), actions = Array.from({ length: count }, () => structuredClone(action));
    const reason = mode === 'select' ? 'select_role_for_unresolved_pose' : expected.length ? 'conditional_typed_pose_path' : 'probe_new_control_with_selected_role';
    const evidence = [obs.observation_ref, child.source_ref, control.source_ref, option.model.source_ref];
    const plan = { epoch: obs.level_epoch, score: obs.levels_completed, observation_ref: obs.observation_ref, frame_digest: identity(rows), child, control, mode,
      option, rule, actions, expected_before: before, expected_after: expected, outside_digest: outsideTypedDigest(rows, child.bbox, control.bbox), reason,
      scope: 'Typed-mark rotation is a comparison hypothesis. No action effect is inferred until measured; subsequent conditional prefixes preserve the selected scope and cancel on mismatch.' };
    const ref = 'C_typed_pose_' + identity(plan).slice(0, 20), facts = { current_role_and_control_measured: true, retained_request_comparison_available: true };
    const why = cfg.pose_question + ' Current experiment: ' + reason + '.';
    const steps = actions.map((a, i) => ({ action: a, expected_after: expected.length ? { typed_marks: expected[i], outside_selected_scopes_preserved: true } : null }));
    return envelope(obs, 'typed_pose_dependency', ref, 'material_pose_plan', plan, actions, steps, facts, why, cfg.pose_roles,
      { reason, hypothesis_refs: [option.model_ref] }, evidence);
  }

  record(before: R, command: R, after: R, rows: NativeRows, later: NativeRows, proposal: R, index: number): R[] {
    // The shared owner has already applied OccurrenceRecall and its ancestors.
    const events = this.recordCarrier(before, command, after, rows, later, proposal);
    events.push(...this.recordFlow(before, after, rows, later, proposal));
    const extra: R[] = [], cfg = this.poseCfg;
    if (cfg && this.carrierCalibration.length) {
      if (this.poseEpoch === null) extra.push({ kind: 'typed_pose_scope', epoch: before.level_epoch, initial_parts: typedSmallParts(rows), controls: [], evidence: [before.observation_ref] });
      if (before.level_epoch !== after.level_epoch) {
        const [controls, parts] = novelTypedControls(this.poseInitialParts, later, after, { ...cfg, observed_body_shapes: this.carrierCalibration });
        extra.push({ kind: 'typed_pose_scope', epoch: after.level_epoch, initial_parts: parts, controls, evidence: evidencePair(before, after),
          scope: 'New-scope appearance novelty only, not an action-effect law.' });
      }
    }
    const flow = proposal.material_flow_plan;
    for (const event of events) if (event.kind === 'typed_material_flow' && truth(event.model) && truth(flow)) extra.push({ kind: 'typed_pose_model', ...event.model, marks: flow.child.marks });
    const plan = proposal.material_pose_plan;
    if (truth(plan)) {
      const child = this.flowChildren.find(c => c.id === plan.child.id) ?? plan.child;
      const e: R = { kind: 'typed_pose_response', evidence: evidencePair(before, after), stop_reason: 'typed_pose_effect_unexplained' };
      if (before.level_epoch === after.level_epoch && plan.mode === 'select' && typedLocalChildMark(child, rows, later)) Object.assign(e, { child, stop_reason: null });
      else if (before.level_epoch === after.level_epoch && plan.mode === 'control') {
        const old = currentTypedMarks(child, rows), next = currentTypedMarks(child, later);
        const turns = [1, 2, 3].filter(turn => truth(old) && truth(next) && equal(rotatedTypedMarks(old!, turn), next));
        const outside = outsideTypedDigest(rows, child.bbox, plan.control.bbox) === outsideTypedDigest(later, child.bbox, plan.control.bbox);
        const consistent = !this.poseRule || (turns.length === 1 && this.poseRule.turns === turns[0]);
        if (turns.length === 1 && outside && consistent) {
          const matches = Object.entries(this.poseModels).filter(([, model]) => equal(sortMarks(model.marks), next)).map(([key]) => key);
          const updated = { ...child, marks: next, core_signature: matches.length === 1 ? matches[0] : identity(['unbound_observed_pose', next]) }, control = { ...plan.control };
          const [x, y, r, b] = control.bbox; control.projection = later.slice(y, b + 1).map(row => row.slice(x, r + 1));
          const rule = { status: 'conditional_observed_pose_change', turns: turns[0], epoch: after.level_epoch, control_bbox: control.bbox, evidence: [...(this.poseRule?.evidence ?? []), e.evidence] };
          const ready = this.matchingPoseTargets(updated, later, after).some(option => option.turns === 0);
          Object.assign(e, { child: updated, control, rule, ready_for_request: ready, stop_reason: null });
        } else if (this.poseRule) e.rule = { ...this.poseRule, status: 'refuted', counterexample: e.evidence };
      }
      extra.push(e);
    }
    for (const event of extra) this.applyEvent(event);
    return [...events, ...extra];
  }

  private recordCarrier(before: R, command: R, after: R, rows: NativeRows, later: NativeRows, proposal: R): R[] {
    const plan = proposal.typed_carrier_plan;
    if (!truth(plan)) return [];
    const changed: number[][] = [];
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y]!.length; x++) if (rows[y]![x] !== later[y]![x]) changed.push([x, y, rows[y]![x]!, later[y]![x]!]);
    const nextScene = measureTypedCarriers(later, after, plan.configuration), [x, y, r, b] = plan.selected.bbox, margin = Math.max(r - x + 1, b - y + 1) / 2;
    const preserved = nextScene !== null && nextScene.carriers.length === plan.scene.carriers.length
      && (plan.scene.carriers as R[]).every(q => (nextScene.carriers as R[]).some(c => equal(c.bbox, q.bbox) && c.signature === q.signature && c.body_palette === q.body_palette));
    const local = changed.length > 0 && changed.every(([u, v]) => x - margin <= u! && u! <= r + margin && y - margin <= v! && v! <= b + margin && !(x <= u! && u! <= r && y <= v! && v! <= b));
    let context: R | null = null;
    if (preserved && local && before.level_epoch === after.level_epoch && !truth(plan.contact_context)) {
      context = { kind: 'local_marking', selected: plan.selected, epoch: after.level_epoch, frame_digest: identity(later),
        evidence: evidencePair(before, after), status: 'local_marking_selection_hypothesis' };
    }
    if (plan.contact_context?.kind === 'local_marking' && before.level_epoch === after.level_epoch) {
      const replacement = typedReplacementCandidate(plan.scene, later, after, plan.configuration);
      if (replacement) context = { ...replacement, kind: 'produced_support', epoch: after.level_epoch, frame_digest: identity(later) };
    }
    const event = { kind: 'typed_carrier_response', selected: plan.selected, command, changed_public_pixels: changed, before_epoch: before.level_epoch,
      after_epoch: after.level_epoch, official_progress: after.levels_completed > before.levels_completed, evidence: evidencePair(before, after),
      contact_context: context, measured_core_bodies_preserved: preserved, local_external_marking: local,
      scope: 'Local marking leaves selection hypothetical; the next shared-pattern contact is a discriminating experiment. Any other material effect remains uncharacterized.' };
    this.applyEvent(event); return [event];
  }

  private recordFlow(before: R, after: R, rows: NativeRows, later: NativeRows, proposal: R): R[] {
    const plan = proposal.typed_carrier_plan, flow = proposal.material_flow_plan;
    const boundary = after.level_epoch !== before.level_epoch || after.levels_completed > before.levels_completed;
    let event: R | null = null;
    if (plan?.contact_context?.kind === 'produced_support' && !boundary) {
      const found = typedMaterialDescendants(plan.contact_context, rows, later, after);
      if (found.length) event = { kind: 'typed_material_flow', epoch: after.level_epoch, boundary: false, added_children: found, context: null,
        effect: 'replacement_activated_into_typed_occurrences', evidence: evidencePair(before, after) };
    }
    if (truth(flow)) {
      const child = flow.child;
      event = { kind: 'typed_material_flow', epoch: after.level_epoch, boundary, context: null, effect: 'unknown', evidence: evidencePair(before, after), stop_reason: 'typed_material_response_unexplained' };
      if (flow.mode === 'select' && !boundary && typedLocalChildMark(child, rows, later)) Object.assign(event, {
        context: { child, evidence: event.evidence }, effect: 'local_child_marking', stop_reason: null });
      else if (flow.mode === 'deliver') {
        const [x, y, r, b] = flow.target.bbox; let changed = false;
        for (let v = y; v <= b; v++) for (let u = x; u <= r; u++) if (rows[v]![u] !== later[v]![u]) changed = true;
        if (boundary || (!typedChildPresent(child, later) && changed)) {
          const prior = this.flowModels[child.core_signature], same = prior && equal(prior.descriptor, flow.target.descriptor);
          const model = { core_signature: child.core_signature, descriptor: flow.target.descriptor, acquired_epoch: same ? prior.acquired_epoch : before.level_epoch,
            validated_epoch: before.level_epoch, evidence: [...(same ? prior.evidence : []), ...event.evidence], source_ref: same ? prior.source_ref : before.observation_ref,
            last_validation_ref: before.observation_ref, status: 'conditional_material_to_request_association' };
          Object.assign(event, { effect: boundary ? 'official_boundary_after_request' : 'material_consumed_and_request_changed', removed_children: [child.id],
            filled: boundary ? [] : [flow.target.bbox], model, stop_reason: null });
        }
      }
    }
    if (event) { this.applyEvent(event); return [event]; }
    return [];
  }
}

export async function commonTypedMaterialProposal(memory: TypedMaterialMemory, obs: R, rows: NativeRows, _inputs: readonly R[], remaining: number, config: R,
  nativeParent: R | null = null): Promise<R | null> {
  if (remaining < 1 || !obs.available_action_refs.includes('ACTION6')) return null;
  memory.setPrefixLimit(Math.min(16, remaining));
  const proposal = nativeParent === null ? memory.carrierQuestion(obs, rows, config)
    : memory.nativeRetainedRequestQuestion(obs, rows, config, nativeParent);
  if (!proposal) return null;
  const plan = proposal[FLAGS.find(flag => Object.hasOwn(proposal, flag))!];
  proposal.steps[0].expected_before = expectedBefore(obs);
  const selected = proposal.material_pose_plan ? plan.mode === 'select' ? plan.child : plan.control : plan.selected, box = selected.bbox;
  for (const [index, action] of (proposal.actions as R[]).entries()) {
    const { x, y } = action.data;
    if (!(box[0] <= x && x <= box[2] && box[1] <= y && y <= box[3])) throw new TypeError('Typed material point outside measured support');
    proposal.steps[index].point_support = { level_epoch: obs.level_epoch, observation_ref: obs.observation_ref, frame_hash: obs.frame_hash,
      point: [x, y], palette_value: rows[y]![x], projection_bbox: box, projected_rows_digest: await rowsDigest(projection(rows, box)),
      entity_ref: 'measured-material-support:' + identity([box, [x, y], selected]), signature: identity([selected, index]),
      scope: 'Observed carrier/request/control support plus the library full-frame or conditional typed-pose/exterior guard. No private role or game-specific coordinate.' };
  }
  return proposal;
}

export function bindTypedMaterial(proposal: R, domain: ObservedInputDomain): void {
  if (!FLAGS.some(flag => Object.hasOwn(proposal, flag))) throw new TypeError('Typed material binding requires an own plan');
  const first = proposal.steps[0].expected_before;
  if (!domain.bindings.has(`${first.level_epoch}:${first.frame_hash}`)) throw new TypeError('Typed material point needs the current observed domain');
  for (const [index, action] of (proposal.actions as R[]).entries()) {
    const support = proposal.steps[index].point_support;
    if (!equal(support.point, [action.data.x, action.data.y])) throw new TypeError('Typed material point payload changed');
    proposal.steps[index].point_binding = { ...support };
  }
}

export function typedMaterialBefore(proposal: R, index: number, rows: NativeRows, meta: BeforeMeta): R {
  const pose = proposal.material_pose_plan;
  if (truth(pose)) {
    let bound = meta.epoch === pose.epoch && meta.score === pose.score && meta.available.includes('ACTION6') && equal(proposal.actions, pose.actions);
    const point = pose.mode === 'select' ? pose.child.point : pose.control.point;
    bound = bound && (proposal.actions as R[]).every(action => equal([action.data.x, action.data.y], point));
    if (index === 0) bound = bound && meta.observation_ref === pose.observation_ref && identity(rows) === pose.frame_digest;
    else bound = bound && truth(pose.expected_before) && equal(currentTypedMarks(pose.child, rows), pose.expected_before[index])
      && outsideTypedDigest(rows, pose.child.bbox, pose.control.bbox) === pose.outside_digest && typedControlMatches(pose.control, rows, meta.epoch);
    return { admitted: Boolean(bound), reason: bound ? 'current_selected_pose_path' : 'typed_pose_context_changed' };
  }
  const flow = proposal.material_flow_plan, plan = flow ?? proposal.typed_carrier_plan;
  if (!truth(plan)) throw new TypeError('Typed material guard requires an own plan');
  const ok = index === 0 && meta.epoch === plan.epoch && meta.score === plan.score && meta.observation_ref === plan.observation_ref
    && identity(rows) === plan.frame_digest && meta.available.includes('ACTION6') && equal(proposal.actions[0], plan.action)
    && equal([plan.action.data.x, plan.action.data.y], plan.selected.point);
  return { admitted: ok, reason: flow ? ok ? 'current_descendant_request_and_point' : 'material_flow_context_changed'
    : ok ? 'current_carrier_and_exact_point' : 'carrier_context_or_payload_changed' };
}

export function typedMaterialAfter(proposal: R, index: number, _rows: NativeRows, later: NativeRows, meta: AfterMeta): R {
  const pose = proposal.material_pose_plan;
  if (truth(pose)) {
    if (meta.epoch !== pose.epoch || meta.score !== pose.score) return { matched: null, seal_prefix: true, reason: 'scope_changed', official_progress: meta.score > pose.score };
    if (!truth(pose.expected_after)) return { matched: null, seal_prefix: true, reason: 'first_pose_effect_uncharacterized', official_progress: false };
    const matched = equal(currentTypedMarks(pose.child, later), pose.expected_after[index])
      && outsideTypedDigest(later, pose.child.bbox, pose.control.bbox) === pose.outside_digest && typedControlMatches(pose.control, later, meta.epoch);
    return { matched, seal_prefix: !matched, reason: matched ? 'conditional_typed_pose_matched' : 'typed_pose_prediction_refuted', official_progress: false };
  }
  const flow = proposal.material_flow_plan, plan = flow ?? proposal.typed_carrier_plan;
  if (!truth(plan)) throw new TypeError('Typed material outcome requires an own plan');
  return { matched: null, seal_prefix: true, reason: flow ? 'material_flow_response_requires_reconciliation' : 'uncharacterized_carrier_response', official_progress: meta.score > plan.score };
}

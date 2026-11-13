/**
 * Own NestedControl -> EnvelopeFill -> FieldService -> ServiceTransfer layers
 * and common_field_service point wrapper at pinned V6 786dcf51. Ancestors are
 * acquired once by the common owner; no inherited-complete parity is implied.
 */
import { acquireFields, currentControl, fieldChangeGroups, fieldCrop, fieldDirections, fieldShape, fieldStates,
  linkedControl, pairedControls, sameFieldShape, fieldServiceDigest as identity } from './v6-field-service-observation.ts';
import { framedPatterns, type FramedPattern } from './v6-geometric-scene.ts';
import { geometricComponents, projection, rowsDigest, type ObservedInputDomain } from './v6-native-observer.ts';
import { pythonEqual as equal, pythonTruthy as truth } from './v6-operations.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
type BeforeMeta = { epoch: number; score: number; observation_ref: string; available: readonly string[] };
type AfterMeta = { epoch: number; score: number; state?: string };
export interface FieldServiceState {
  nested_events: R[]; fill_events: R[]; fill_context: R | null; service_events: R[]; service_context: R | null;
  transfer_events: R[]; transfer_model: R | null; transfer_context: R | null; requested_stop_reason: string | null;
}

const framedControl = (pattern: FramedPattern): R => ({ frame_ref: pattern.id, bbox: pattern.bbox, point: pattern.center,
  core_area: pattern.foreground_area, core_scale: pattern.scale, core_palette: pattern.color });
const pointAction = (point: readonly number[]): R => ({ action_ref: 'ACTION6', data: { x: point[0], y: point[1] } });
const changedPoints = (rows: NativeRows, later: NativeRows): number[][] => {
  const points: number[][] = [];
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[0]!.length; x++) if (rows[y]![x] !== later[y]![x]) points.push([x, y]);
  return points;
};

function questionEnvelope(observation: R, plan: R, prefix: string, kind: string, planKey: string | null,
  why: string, facts: R, roles: unknown, reason: string, hypotheses: readonly string[], evidence: readonly string[]): R {
  const ref = prefix + identity(plan).slice(0, 20), action = plan.action;
  return structuredClone({ status: 'proposed', kind, proposal_id: ref, nested_control_plan: plan,
    ...(planKey === null ? {} : { [planKey]: plan }), actions: [action], steps: [{ action, expected_after: null }], facts,
    compositions: [{ id: ref, observed: false, open_question: why, properties: { roles }, relations: ['contributes_to:G_official_completion'] }],
    question: { reason, hypothesis_refs: hypotheses }, route_refs: evidence,
    binding: { level_epoch: observation.level_epoch, observation_ref: observation.observation_ref },
    bundle_template: { operation_key: 'OP18', composition_ref: ref, objective_ref: 'G_official_completion', preserve_refs: [], actions: [action],
      purpose: why, preconditions: facts, evidence, outcome_guard: { path: ['value'], contains: ref } } });
}

export function fieldServiceBefore(proposal: R, index: number, rows: NativeRows, meta: BeforeMeta): R {
  const plan = proposal.nested_control_plan;
  if (!truth(plan)) throw new TypeError('Field-service admission requires nested_control_plan');
  const admitted = index === 0 && equal([meta.epoch, meta.score, meta.observation_ref], [plan.epoch, plan.score, plan.observation_ref])
    && identity(rows) === plan.frame_digest && meta.available.includes('ACTION6') && equal(proposal.actions[0], pointAction(plan.selected.point));
  return { admitted, reason: admitted ? 'current_nested_core_exact_point' : 'nested_context_or_payload_changed' };
}

export function fieldServiceAfter(proposal: R, _index: number, _rows: NativeRows, _later: NativeRows, meta: AfterMeta): R {
  const plan = proposal.nested_control_plan;
  if (!truth(plan)) throw new TypeError('Field-service outcome requires nested_control_plan');
  return { matched: null, seal_prefix: true, reason: 'unknown_control_response_observed', official_progress: meta.score > plan.score };
}

export class FieldServiceMemory {
  private nestedEvents: R[] = [];
  private fillEvents: R[] = [];
  private fillContext: R | null = null;
  private serviceEvents: R[] = [];
  private serviceContext: R | null = null;
  private transferEvents: R[] = [];
  private transferModel: R | null = null;
  private transferContext: R | null = null;
  private stopReason: string | null = null;
  private version = 0;

  get nativeRevision(): number { return this.version; }
  get requestedStopReason(): string | null { return this.stopReason; }
  currentState(): FieldServiceState {
    return structuredClone({ nested_events: this.nestedEvents, fill_events: this.fillEvents, fill_context: this.fillContext,
      service_events: this.serviceEvents, service_context: this.serviceContext, transfer_events: this.transferEvents,
      transfer_model: this.transferModel, transfer_context: this.transferContext, requested_stop_reason: this.stopReason });
  }
  retainedNestedDigest(ancestor: string): string { return identity([ancestor, this.nestedEvents]); }
  retainedFillDigest(ancestor: string): string { return identity([this.retainedNestedDigest(ancestor), this.fillEvents, this.fillContext]); }
  retainedServiceDigest(ancestor: string): string { return identity([this.retainedFillDigest(ancestor), this.serviceEvents, this.serviceContext]); }
  retainedDigest(ancestor: string): string { return identity([this.retainedServiceDigest(ancestor), this.transferEvents, this.transferModel, this.transferContext]); }

  applyEvent(event: R): void {
    if (!['nested_control_response', 'envelope_fill_context', 'field_service_context', 'field_service_transfer'].includes(event.kind)) {
      throw new TypeError(`Outside field-service layers: ${String(event.kind)}`);
    }
    const owned = retainNativeJson(event); this.version++;
    switch (owned.kind) {
      case 'nested_control_response':
        this.nestedEvents.push(owned);
        if (owned.disposition !== 'local_no_visible_effect') this.stopReason = 'nested_control_effect_requires_composition';
        break;
      case 'envelope_fill_context':
        this.fillEvents.push(owned); this.fillContext = owned.context; this.stopReason = owned.stop_reason; break;
      case 'field_service_context':
        this.serviceEvents.push(owned); this.serviceContext = owned.context; this.stopReason = owned.stop_reason; break;
      case 'field_service_transfer':
        this.transferEvents.push(owned); this.transferModel = owned.model; this.transferContext = owned.context; this.stopReason = owned.stop_reason; break;
    }
  }

  nestedRefusal(observation: R, rows: NativeRows): R | null {
    const current = [observation.level_epoch, observation.levels_completed, identity(rows)];
    for (let i = this.nestedEvents.length - 1; i >= 0; i--) {
      const event = this.nestedEvents[i]!;
      if (event.disposition === 'local_no_visible_effect' && equal([event.epoch, event.score, event.frame_digest], current)) return structuredClone(event);
    }
    return null;
  }

  nestedQuestion(observation: R, rows: NativeRows, config: R): R | null {
    if (config.selection_order !== 'unique_minimum_measured_enclosure_area') return null;
    const matches: R[] = [];
    for (const pattern of framedPatterns(rows, geometricComponents(rows))) {
      const [l, t, r, b] = pattern.bbox, w = r - l + 1, h = b - t + 1;
      if (w !== h || w > Math.min(rows.length, rows[0]!.length) * config.maximum_extent_fraction
        || pattern.mask.length !== 1 || pattern.foreground_area < config.minimum_core_area || pattern.foreground_area !== pattern.scale ** 2) continue;
      const [x, y] = pattern.center;
      if (rows[y]![x] !== pattern.color) continue;
      matches.push(framedControl(pattern));
    }
    if (!matches.length) return null;
    const area = (control: R) => (control.bbox[2] - control.bbox[0] + 1) ** 2, minimum = Math.min(...matches.map(area));
    const smallest = matches.filter(control => area(control) === minimum);
    if (smallest.length !== 1) return null;
    const selected = smallest[0]!, action = pointAction(selected.point);
    const plan = { epoch: observation.level_epoch, score: observation.levels_completed, observation_ref: observation.observation_ref,
      frame_digest: identity(rows), selected, alternative_enclosures: matches.filter(control => !equal(control, selected)), action,
      expected_effect: 'unknown', scope: 'Unique smallest measured compact two-value enclosure; other enclosures retain unknown roles. Action semantics and distant effects unconfirmed.' };
    return questionEnvelope(observation, plan, 'C_nested_', 'nested_control_experiment', null, config.question,
      { unique_smallest_measured_nested_compact_motif: true, point_on_current_core: true }, config.roles,
      'test_unique_nested_compact_motif', [], [observation.observation_ref]);
  }

  private proposeNested(observation: R, rows: NativeRows, maxPrefix: number, config: R, base: R | null): R | null {
    if (base?.status === 'proposed') return base;
    const cfg = config.nested_control_question;
    if (!truth(cfg) || maxPrefix < 1 || !observation.available_action_refs.includes('ACTION6')) return base;
    const proposal = this.nestedQuestion(observation, rows, cfg);
    if (proposal) {
      // Source intentionally appends this contract after the proposal ID was made.
      const plan = proposal.nested_control_plan; plan.no_visible_effect_contract = cfg.no_visible_effect_contract ?? null;
      const refusal = this.nestedRefusal(observation, rows);
      if (refusal && identity(refusal.selected) === identity(plan.selected) && equal(refusal.command, plan.action)) return base;
    }
    return proposal ?? base;
  }

  fillQuestion(observation: R, rows: NativeRows, target: R, config: R, phase: string): R | null {
    const [x, y] = target.point, [l, t, r, b] = target.bbox;
    if (!(0 <= l && l <= x && x <= r && r < rows[0]!.length && 0 <= t && t <= y && y <= b && b < rows.length)) return null;
    const current = framedPatterns(rows, geometricComponents(rows)).filter(pattern => equal(pattern.bbox, target.bbox) && equal(pattern.center, target.point));
    if (current.length !== 1) return null;
    const context = this.fillContext!, action = pointAction(target.point);
    const plan = { epoch: observation.level_epoch, score: observation.levels_completed, observation_ref: observation.observation_ref,
      frame_digest: identity(rows), selected: target, action, phase, expected_effect: 'unknown', field_state_before: fieldStates(rows, context.fields) };
    return questionEnvelope(observation, plan, 'C_fill_', 'envelope_fill_experiment', 'envelope_fill_plan',
      config.question + ' Current discriminant: ' + phase + '.', { current_framed_control_bound: true, persistent_fields_measured: true },
      config.roles, 'measure_envelope_' + phase, [], [observation.observation_ref, ...context.evidence]);
  }

  private proposeFill(observation: R, rows: NativeRows, maxPrefix: number, config: R, base: R | null): R | null {
    const cfg = config.envelope_fill_question, context = this.fillContext;
    if (truth(cfg) && truth(context) && context!.epoch === observation.level_epoch && ['repeat', 'contrast', 'repeat_contrast'].includes(context!.phase)) {
      const ctx = context!;
      let target: R | null = ctx.phase === 'repeat' ? ctx.forward : (ctx.contrast ?? null);
      if (ctx.phase === 'contrast') {
        const old = ctx.forward, w = old.bbox[2] - old.bbox[0] + 1, h = old.bbox[3] - old.bbox[1] + 1;
        const matches = framedPatterns(rows, geometricComponents(rows)).filter(pattern => {
          const [l, t, r, b] = pattern.bbox;
          return equal([r - l + 1, b - t + 1], [w, h]) && !equal(pattern.bbox, old.bbox) && pattern.mask.length > 1;
        }).map(framedControl);
        if (matches.length !== 1) return { status: 'abstained', reason: 'alternative_control_ambiguous' };
        target = matches[0]!;
      }
      if (truth(target)) return this.fillQuestion(observation, rows, target!, cfg, ctx.phase);
    }
    return this.proposeNested(observation, rows, maxPrefix, config, base);
  }

  initializeService(rows: NativeRows): R | null {
    const context = this.fillContext;
    if (!truth(context) || !truth(context!.restored_measured_fields)) return null;
    const ctx = context!, novel: R[] = ctx.fields.filter((field: R) => ctx.history.some((state: R) => truth(state[field.id].opaque_replacement)));
    if (novel.length !== 1) return null;
    const useful = novel[0]!, others: R[] = ctx.fields.filter((field: R) => field.id !== useful.id && equal(ctx.directions[field.id], ctx.directions[useful.id]));
    if (others.length !== 1) return null;
    const gate = linkedControl(others[0]!, pairedControls(rows));
    if (gate === null) return null;
    return structuredClone({ epoch: ctx.epoch, phase: 'isolate', selected_field: useful, other_field: others[0], control: gate, forward: ctx.forward,
      evidence: ctx.evidence, hypothesis: 'Isolate the correlated branch without the novel observed content replacement, then measure the previously observed input. Spatial association and usefulness are unconfirmed.', attempts: 0 });
  }

  private proposeField(observation: R, rows: NativeRows, maxPrefix: number, config: R, base: R | null): R | null {
    if (!truth(config.field_service_question)) return this.proposeFill(observation, rows, maxPrefix, config, base);
    let context = this.serviceContext;
    if (!truth(context) && truth(this.fillContext) && this.fillContext!.phase === 'service_choice_required') context = this.initializeService(rows);
    if (truth(context) && context!.epoch === observation.level_epoch && ['isolate', 'serve'].includes(context!.phase)) {
      const ctx = context!, target = ctx.phase === 'isolate' ? ctx.control : ctx.forward, action = pointAction(target.point);
      if (!observation.available_action_refs.includes('ACTION6') || maxPrefix < 1) return null;
      const plan = { epoch: observation.level_epoch, score: observation.levels_completed, observation_ref: observation.observation_ref,
        frame_digest: identity(rows), selected: target, action, phase: ctx.phase, service_context: structuredClone(ctx), expected_effect: 'unknown' };
      const cfg = config.field_service_question, evidence = [...ctx.evidence, observation.observation_ref];
      return questionEnvelope(observation, plan, 'C_service_', 'field_service_experiment', 'field_service_plan', cfg.question + ' ' + ctx.hypothesis,
        { current_public_field_and_control_bound: true, previous_field_restoration_observed: true }, cfg.roles, 'conditional_field_' + ctx.phase, evidence, evidence);
    }
    return this.proposeFill(observation, rows, maxPrefix, config, base);
  }

  bindTransfer(observation: R, rows: NativeRows, config: R): R | null {
    const model = this.transferModel;
    if (!truth(model) || !truth(model!.official_boundary_witness) || !truth(model!.receiver)) return null;
    const m = model!, parts = geometricComponents(rows), relays = parts.filter(part => sameFieldShape(part, m.relay)), targets = parts.filter(part => sameFieldShape(part, m.receiver));
    if (relays.length > 1 || !targets.length) return null;
    const controls = pairedControls(rows), relay = relays[0] ?? null, gate = relay ? linkedControl(relay, controls) : null;
    const question = this.nestedQuestion(observation, rows, config.nested_control_question);
    if (relay && gate === null || !question) return null;
    const destinations: R[] = [];
    for (const part of targets) {
      const destinationGate = linkedControl(part, controls);
      if (destinationGate === null) return null;
      destinations.push({ bbox: part.bbox, gate_point: destinationGate.point, gate_scope: destinationGate, initial_digest: identity(fieldCrop(rows, part.bbox)) });
    }
    return structuredClone({ epoch: observation.level_epoch, relay_bbox: relay?.bbox ?? null, relay_gate: gate?.point ?? null, relay_gate_scope: gate,
      unknown_intermediate: relay === null, forward: question.nested_control_plan.selected, targets: destinations, source_revalidated: false,
      evidence: [observation.observation_ref, ...m.evidence], attempted_controls: [], service_count: 0, new_field_observations: [] });
  }

  transferQuestion(observation: R, rows: NativeRows, target: R, context: R, phase: string, config: R): R {
    const action = pointAction(target.point), plan = { epoch: observation.level_epoch, score: observation.levels_completed, observation_ref: observation.observation_ref,
      frame_digest: identity(rows), selected: target, action, phase, transfer_context: structuredClone(context), expected_effect: 'unknown' };
    const cfg = config.field_service_transfer, evidence = [...context.evidence, observation.observation_ref];
    return questionEnvelope(observation, plan, 'C_transfer_', 'field_service_transfer_experiment', 'field_transfer_plan', cfg.question + ' Current experiment: ' + phase,
      { current_shapes_rebound: true, acquisition_epoch_retained: true, current_point_bound: true }, cfg.roles, phase, evidence, evidence);
  }

  /** Already evaluated inherited proposal is used only if this own chain falls through. */
  proposeService(observation: R, rows: NativeRows, _inputs: readonly R[], maxPrefix: number, config: R,
    base: R | null = { status: 'abstained', reason: 'no_recurrent_line_question' }): R | null {
    if (!truth(config.field_service_transfer)) return this.proposeField(observation, rows, maxPrefix, config, base);
    const model = this.transferModel;
    if (truth(model) && truth(model!.official_boundary_witness) && observation.level_epoch !== model!.acquisition_epoch) {
      const m = model!;
      let context = this.transferContext;
      if (!truth(context) || context!.epoch !== observation.level_epoch) context = this.bindTransfer(observation, rows, config);
      if (context === null) return { status: 'abstained', reason: 'service_transfer_current_shape_not_bound' };
      const ctx = context, controls = pairedControls(rows);
      const gate = (point: readonly number[], prior: R): R | null => currentControl(rows, prior) ?? controls.find(control => equal(control.point, point)) ?? null;
      const relayGate = truth(ctx.relay_gate) ? gate(ctx.relay_gate, ctx.relay_gate_scope) : null;
      if (truth(ctx.relay_gate) && relayGate === null) return { status: 'abstained', reason: 'service_relay_control_unknown' };
      if (relayGate && relayGate.orientation !== m.conducting_orientation) return this.transferQuestion(observation, rows, relayGate, ctx, 'revalidate_source_access', config);
      const targetStates: { target: R; gate: R; full: boolean }[] = [];
      for (const target of ctx.targets as R[]) {
        const full = !fieldCrop(rows, target.bbox).flat().includes(m.receiver.background), targetGate = gate(target.gate_point, target.gate_scope);
        if (targetGate === null) return { status: 'abstained', reason: 'service_destination_control_unknown' };
        targetStates.push({ target, gate: targetGate, full });
      }
      if (truth(ctx.unknown_intermediate)) {
        const closed = targetStates.filter(state => !state.full && state.gate.orientation !== m.conducting_orientation);
        if (closed.length) return this.transferQuestion(observation, rows, closed[0]!.gate, ctx, 'prepare_receiver_before_unknown_service', config);
        return this.transferQuestion(observation, rows, ctx.forward, ctx, 'test_unknown_service_intermediate', config);
      }
      for (const state of targetStates) {
        if (state.full && state.gate.orientation === m.conducting_orientation && targetStates.some(other => !other.full)) {
          return this.transferQuestion(observation, rows, state.gate, ctx, 'protect_changed_receiver', config);
        }
      }
      const opened = targetStates.filter(state => !state.full && state.gate.orientation === m.conducting_orientation);
      if (!opened.length) {
        const remaining = targetStates.filter(state => !state.full);
        if (!remaining.length) return { status: 'abstained', reason: 'all_receiver_appearances_changed_without_official_boundary' };
        return this.transferQuestion(observation, rows, remaining[0]!.gate, ctx, 'enable_remaining_receiver', config);
      }
      return this.transferQuestion(observation, rows, ctx.forward, ctx, 'revalidate_conditional_service', config);
    }
    return this.proposeField(observation, rows, maxPrefix, config, base);
  }

  private recordNested(before: R, command: R, after: R, rows: NativeRows, later: NativeRows, proposal: R): R[] {
    const plan = proposal.nested_control_plan;
    if (!truth(plan)) return [];
    const diff = changedPoints(rows, later), [l, t, r, b] = plan.selected.bbox;
    const inside = diff.filter(([x, y]) => l <= x! && x! <= r && t <= y! && y! <= b).length;
    const bounds = diff.length ? [Math.min(...diff.map(point => point[0]!)), Math.min(...diff.map(point => point[1]!)),
      Math.max(...diff.map(point => point[0]!)), Math.max(...diff.map(point => point[1]!))] : null;
    const event: R = { kind: 'nested_control_response', evidence: [before.observation_ref, after.observation_ref], selected: plan.selected, command,
      changed_pixels: diff.length, changed_inside_control: inside, changed_outside_control: diff.length - inside, changed_bbox: bounds,
      same_epoch: before.level_epoch === after.level_epoch, official_progress: after.levels_completed > before.levels_completed,
      interpretation: 'unknown; local and distant effects are measured separately; no law or quantity inferred' };
    const contract = plan.no_visible_effect_contract;
    if (truth(contract) && contract.disposition === 'local_no_visible_effect' && !diff.length && event.same_epoch && !event.official_progress) {
      Object.assign(event, { disposition: 'local_no_visible_effect', epoch: after.level_epoch, score: after.levels_completed, frame_digest: identity(later),
        origin_observation_ref: before.observation_ref, reply_observation_ref: after.observation_ref, contract, selection_acquired: false, impossibility_acquired: false });
    }
    this.applyEvent(event); return [event];
  }

  private recordFill(before: R, command: R, after: R, rows: NativeRows, later: NativeRows, proposal: R): R[] {
    const events = this.recordNested(before, command, after, rows, later, proposal), plan = proposal.nested_control_plan;
    if (!truth(plan) || before.level_epoch !== after.level_epoch) return events;
    const refs = [before.observation_ref, after.observation_ref];
    let context = this.fillContext, stop: string | null = null;
    if (context === null) {
      const fields = acquireFields(rows, later, refs);
      if (fields.length < 2) return events;
      const initial = Object.fromEntries(fields.map(field => [field.id, field.initial_state])), present = fieldStates(later, fields);
      context = { epoch: after.level_epoch, fields, initial, present, history: [initial, present], directions: fieldDirections(initial, present),
        forward: plan.selected, phase: 'repeat', evidence: refs };
    } else {
      const present = fieldStates(later, context.fields), delta = fieldDirections(context.present, present), phase = plan.phase;
      context = { ...context, present, evidence: [...context.evidence, ...refs] };
      if (phase === 'repeat') {
        const compatible = Object.entries(context.directions).every(([key, value]) => delta[key] === 0 || equal(delta[key], value)) && Object.values(delta).some(value => truth(value));
        context.repeatable_extent_change = compatible; context.phase = 'contrast';
      } else if (phase === 'contrast') {
        const previous: R = context.history[context.history.length - 2], opposed = Object.entries(previous).every(([key, value]) => present[key].appearance_digest === value.appearance_digest);
        context.contrast = plan.selected; context.observed_previous_field_state_restored = opposed; context.phase = opposed ? 'repeat_contrast' : 'unknown';
        if (!opposed) stop = 'alternative_control_effect_requires_composition';
      } else if (phase === 'repeat_contrast') {
        const restored = Object.entries(context.initial as R).every(([key, value]) => present[key].appearance_digest === value.appearance_digest);
        context.restored_measured_fields = restored; context.phase = restored ? 'service_choice_required' : 'unknown';
        stop = restored ? 'envelope_restoration_requires_service_choice' : 'field_restoration_unconfirmed';
      }
      context.last_directions = delta; context.history = [...context.history, present];
    }
    const event = { kind: 'envelope_fill_context', context, stop_reason: stop, evidence: refs,
      scope: 'Pixel extents and conditional response direction only. Physical volumes/capacities/thresholds and global inverse law remain unknown.' };
    this.applyEvent(event); return [...events, event];
  }

  private recordField(before: R, command: R, after: R, rows: NativeRows, later: NativeRows, proposal: R): R[] {
    const plan = proposal.field_service_plan, refs = [before.observation_ref, after.observation_ref];
    if (!truth(plan)) {
      const events = this.recordFill(before, command, after, rows, later, proposal);
      if (truth(this.fillContext) && this.fillContext!.phase === 'service_choice_required') {
        const context = this.initializeService(later);
        if (truth(context)) {
          const event = { kind: 'field_service_context', context, stop_reason: null, evidence: refs }; this.applyEvent(event); events.push(event);
        }
      }
      return events;
    }
    // Source explicitly bypasses Fill: a gate action is not another fill pulse.
    const events = this.recordNested(before, command, after, rows, later, proposal), context: R = structuredClone(plan.service_context), changed = changedPoints(rows, later);
    let stop: string | null = null;
    if (before.level_epoch !== after.level_epoch) { context.phase = 'boundary_revalidation_required'; stop = 'field_service_next_epoch_requires_revalidation'; }
    else if (!changed.length) { context.phase = 'unknown'; stop = 'field_service_no_effect'; }
    else if (plan.phase === 'isolate') {
      const [l, t, r, b] = plan.selected.bbox, local = changed.every(([x, y]) => l <= x! && x! <= r && t <= y! && y! <= b);
      context.local_control_effect = local;
      const fields = [context.selected_field, context.other_field], old = fieldStates(rows, fields), next = fieldStates(later, fields);
      const preserved = Object.keys(old).every(key => old[key].appearance_digest === next[key].appearance_digest);
      const matching = pairedControls(later).filter(control => equal(control.point, plan.selected.point));
      const orientationChanged = matching.length === 1 && matching[0]!.orientation !== plan.selected.orientation;
      context.field_contents_preserved = preserved; context.paired_control_orientation_changed = orientationChanged;
      context.nonlocal_appearance_effect_unknown = !local; context.phase = preserved && orientationChanged ? 'serve' : 'unknown';
      if (context.phase === 'unknown') stop = 'field_control_nonlocal_effect_requires_reconciliation';
      else context.isolated_field_before = next[context.other_field.id].appearance_digest;
    } else {
      context.attempts++;
      const current = fieldStates(later, this.fillContext!.fields), initial: R = this.fillContext!.initial;
      const restored = Object.entries(initial).every(([key, value]) => current[key].appearance_digest === value.appearance_digest);
      context.latest_fields = current;
      if (restored) { context.phase = 'unknown'; stop = 'field_service_returned_initial_fields'; }
      else if (current[context.other_field.id].appearance_digest !== context.isolated_field_before) { context.phase = 'unknown'; stop = 'field_isolation_hypothesis_refuted'; }
    }
    context.evidence = [...context.evidence, ...refs];
    const event = { kind: 'field_service_context', context, stop_reason: stop, changed_pixels: changed.length, evidence: refs,
      scope: 'Observed responses and conditional service experiment; no physical units, capacity, relay or terminal law.' };
    this.applyEvent(event); return [...events, event];
  }

  transferEvent(model: R | null, context: R | null, stop: string | null, refs: readonly string[]): R {
    const event = { kind: 'field_service_transfer', model, context, stop_reason: stop, evidence: refs,
      scope: 'Rebound geometric roles and conditional service observations; full-looking field and contribution to terminal remain hypotheses until current effects.' };
    this.applyEvent(event); return structuredClone(event);
  }

  /** Own suffix only; the common owner calls old ancestors once before this. */
  record(before: R, command: R, after: R, rows: NativeRows, later: NativeRows, proposal: R, _index: number): R[] {
    const plan = proposal.field_transfer_plan, refs = [before.observation_ref, after.observation_ref];
    if (truth(plan)) {
      // Transfer bypasses both Fill and FieldService, while retaining Nested.
      const events = this.recordNested(before, command, after, rows, later, proposal);
      let context: R | null = structuredClone(plan.transfer_context), stop: string | null = null;
      context!.evidence = [...context!.evidence, ...refs];
      if (before.level_epoch !== after.level_epoch) context = null;
      else if (equal(rows, later)) stop = 'transferred_service_no_effect';
      else if (['revalidate_conditional_service', 'test_unknown_service_intermediate'].includes(plan.phase)) {
        context!.service_count++; context!.source_revalidated = true;
        context!.new_field_observations.push({ evidence: refs, fields: acquireFields(rows, later, refs), changed_pixels: changedPoints(rows, later).length,
          service_dependency: 'Current input followed this change; passage, duration and release relation unconfirmed.' });
      } else {
        const point = plan.selected.point, measured = currentControl(later, plan.selected);
        const current = measured ? [measured] : pairedControls(later).filter(control => equal(control.point, point)), oldOrientation = plan.selected.orientation;
        const valid = current.length === 1 && current[0]!.orientation !== oldOrientation;
        if (!valid) stop = 'transferred_control_response_refuted';
        context!.attempted_controls.push({ point, from: oldOrientation, to: current.length ? current[0]!.orientation : null, evidence: refs });
      }
      events.push(this.transferEvent(this.transferModel, context, stop, refs)); return structuredClone(events);
    }
    const events = this.recordField(before, command, after, rows, later, proposal), service = proposal.field_service_plan;
    let model: R | null = structuredClone(this.transferModel);
    if (truth(service)) {
      const context = service.service_context;
      if (model === null) {
        const field = context.selected_field, [l, t, r, b] = field.bbox;
        model = { acquisition_epoch: before.level_epoch, relay: { extent: [r - l + 1, b - t + 1], area: (r - l + 1) * (b - t + 1), background: field.alternative_fill_palette },
          conducting_orientation: context.control.orientation, receiver: null, evidence: [] };
      }
      if (before.level_epoch === after.level_epoch && service.phase === 'serve' && model.receiver === null) {
        const excluded: number[][] = this.fillContext!.fields.map((field: R) => field.bbox), parts = geometricComponents(rows);
        for (const group of fieldChangeGroups(rows, later)) {
          if (group.palette_pair[0] !== model.relay.background) continue;
          const [l, t, r, b] = group.bbox;
          const matches = parts.filter(part => !excluded.some(box => equal(part.bbox, box)) && part.color === group.palette_pair[0]
            && part.bbox[0] <= l && l <= r && r <= part.bbox[2] && part.bbox[1] <= t && t <= b && b <= part.bbox[3]);
          // Source continues scanning; a later unique group can replace this.
          if (matches.length === 1) { model.receiver = fieldShape(matches[0]!); model.receiver_fill = group.palette_pair[1]; }
        }
      }
      if (before.level_epoch !== after.level_epoch) model.official_boundary_witness = refs;
      model.evidence = [...model.evidence, ...refs];
      events.push(this.transferEvent(model, null, truth(model.official_boundary_witness) ? null : this.stopReason, refs));
    }
    return structuredClone(events);
  }
}

export async function commonFieldServiceProposal(memory: FieldServiceMemory, observation: R, rows: NativeRows, inputs: readonly R[],
  remaining: number, config: R, base?: R | null): Promise<R | null> {
  if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
  const proposal = memory.proposeService(observation, rows, inputs, Math.min(16, remaining), config, base);
  if (!proposal || !Object.hasOwn(proposal, 'nested_control_plan')) return null;
  const plan = proposal.nested_control_plan, box = plan.selected.bbox;
  proposal.steps = structuredClone(proposal.steps);
  proposal.steps[0].expected_before = Object.fromEntries(['level_epoch', 'frame_hash', 'levels_completed', 'state'].map(key => [key, observation[key]]));
  for (const [index, action] of (proposal.actions as R[]).entries()) {
    const step = proposal.steps[index], [x, y] = plan.selected.point;
    if (!equal(action, pointAction([x, y]))) throw new TypeError('Field-service action is not its measured control point');
    if (!(box[0] <= x && x <= box[2] && box[1] <= y && y <= box[3])) throw new TypeError('Field-service point is outside its measured control');
    step.point_support = { level_epoch: observation.level_epoch, observation_ref: observation.observation_ref, frame_hash: observation.frame_hash,
      point: [x, y], palette_value: rows[y]![x], projection_bbox: box, projected_rows_digest: await rowsDigest(projection(rows, box)),
      entity_ref: 'measured-field-control:' + identity([box, plan.selected]), signature: identity([plan.selected, index]),
      scope: 'Current measured control/envelope, exact full-frame and epoch guard. Unknown response seals this one-action experiment; no capacity or terminal law supplied.' };
  }
  return proposal;
}

export function bindFieldService(proposal: R, domain: ObservedInputDomain): void {
  if (!Object.hasOwn(proposal, 'nested_control_plan')) throw new TypeError('Field-service binding requires nested_control_plan');
  const first = proposal.steps[0].expected_before;
  if (!domain.bindings.has(`${first.level_epoch}:${first.frame_hash}`)) throw new TypeError('Field-service point domain not currently observed');
  for (const [index, action] of (proposal.actions as R[]).entries()) {
    const step = proposal.steps[index], support = step.point_support;
    if (!equal(support.point, [action.data.x, action.data.y])) throw new TypeError('Field-service point payload changed');
    step.point_binding = { ...support };
  }
}

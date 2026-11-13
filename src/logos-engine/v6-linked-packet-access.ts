/** LinkedPacketAccess own evidence layer and current-point common wrapper. */
import { changedLinkedSupports, linkedPhase, linkedSelectionRecipient, linkedSegmentFor, linkedTargetMarker, measureLinkedPacket, measureLinkedScene } from './v6-linked-packet-observation.ts';
import { estimateLinkedPhase, linkedRelayRoute } from './v6-linked-packet-ray.ts';
import { linkedPacketDigest as identity, linkedCircular as circular, linkedCopySign as copySign, linkedRound as round } from './v6-linked-packet-numeric.ts';
import { pythonEqual as equal, pythonTruthy as truth } from './v6-operations.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { rowsDigest, type ObservedInputDomain } from './v6-native-observer.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
type Clock = () => number;
type BeforeMeta = { epoch: number; score: number; observation_ref: string; available: readonly string[] };
type AfterMeta = { epoch: number; score: number; state?: string };
export interface LinkedPacketState { linked_state: R | null; linked_events: R[]; linked_outputs: R; linked_input_steps: R; linked_launch: string | null }
const pointCommand = (control: R): R => ({ action_ref: 'ACTION6', data: { x: control.point[0], y: control.point[1] } });
const context = (state: R, rows: NativeRows): string => identity([(state.scene.controls as R[]).map(control => [control.ref, linkedPhase(rows, control, state.selection_masks[control.ref] ?? [])]), state.selected]);
const modulo = (value: number, divisor: number): number => ((value % divisor) + divisor) % divisor;

export function linkedPacketBefore(proposal: R, index: number, rows: NativeRows, meta: BeforeMeta): R {
  const plan = proposal.linked_packet_plan;
  if (!truth(plan)) throw new TypeError('Linked guard requires linked_packet_plan');
  let admitted = index === 0 && meta.epoch === plan.epoch && meta.score === plan.score && meta.observation_ref === plan.observation_ref
    && identity(rows) === plan.frame_digest && equal(proposal.actions, [plan.command]) && equal(proposal.bundle_template.actions, proposal.actions)
    && meta.available.includes(plan.command.action_ref);
  if (plan.command.action_ref === 'ACTION6') admitted = admitted && equal(plan.command.data, { x: plan.control.point[0], y: plan.control.point[1] });
  return { admitted, reason: admitted ? 'current_linked_experiment_bound' : 'linked_context_or_command_changed' };
}
export function linkedPacketAfter(proposal: R, _index: number, _rows: NativeRows, _later: NativeRows, meta: AfterMeta): R {
  if (!truth(proposal.linked_packet_plan)) throw new TypeError('Linked outcome requires linked_packet_plan');
  return { matched: null, seal_prefix: true, official_progress: meta.score > proposal.linked_packet_plan.score,
    reason: 'current_control_and_dated_packet_require_reconciliation' };
}

export class LinkedPacketMemory {
  private linkedState: R | null = null;
  private linkedEvents: R[] = [];
  private linkedOutputs: R = {};
  private linkedInputSteps: R = {};
  private linkedLaunch: string | null = null;
  private version = 0;
  get nativeRevision(): number { return this.version; }
  currentState(): LinkedPacketState {
    return structuredClone({ linked_state: this.linkedState, linked_events: this.linkedEvents, linked_outputs: this.linkedOutputs,
      linked_input_steps: this.linkedInputSteps, linked_launch: this.linkedLaunch });
  }
  retainedDigest(ancestor: string): string { return identity([ancestor, this.linkedState, this.linkedEvents, this.linkedOutputs, this.linkedInputSteps, this.linkedLaunch]); }
  applyEvent(event: R): void {
    if (event.kind !== 'linked_packet_evidence') throw new TypeError(`Outside linked-packet layer: ${String(event.kind)}`);
    const owned = retainNativeJson(event);
    this.linkedState = owned.state; this.linkedOutputs = owned.outputs; this.linkedInputSteps = owned.input_steps; this.linkedLaunch = owned.launch;
    this.linkedEvents.push(owned); this.version++;
  }
  private emit(state: R, detail: R, outputs: R = this.linkedOutputs, steps: R = this.linkedInputSteps, launch: string | null = this.linkedLaunch): R {
    const event = { kind: 'linked_packet_evidence', state: structuredClone(state), outputs: structuredClone(outputs), input_steps: structuredClone(steps), launch, detail };
    this.applyEvent(event); return structuredClone(event);
  }

  relayContribution(state: R, target: R, observation: R, rows: NativeRows, inputs: readonly R[], config: R, deadlineMs: number, now: Clock): R | null {
    const available = new Set(inputs.map(action => action.action_ref)), launch = this.linkedLaunch;
    if (!launch || !available.has(launch) || Object.keys(state.bindings).length !== state.scene.controls.length) return null;
    const controls = state.scene.controls as R[], selected = controls.find(control => control.ref === state.selected);
    if (!selected) return null;
    const current = context(state, rows), tried = state.trials.some((trial: R) => trial.context === current && trial.action === launch);
    if (!truth(state.received_controls) && Object.values(this.linkedInputSteps).some(value => value.status === 'candidate') && !tried) {
      return { action: { action_ref: launch }, control: selected, reason: 'revalidate_recalled_packet_input_on_current_supports', route: null,
        scope: 'Input role remains a current experiment, not inherited action authority.' };
    }
    const route = linkedRelayRoute(state, target, this.linkedOutputs, this.linkedInputSteps, observation, deadlineMs, now);
    if (!route) return null;
    for (const edge of route.route as R[]) {
      const control = controls.find(item => state.bindings[item.ref].ref === edge.source)!;
      const drawing = linkedPhase(rows, control, state.selection_masks[control.ref] ?? []), estimate = estimateLinkedPhase(drawing, this.linkedOutputs, state.edges, this.linkedInputSteps, route.grid);
      if (!estimate) {
        const missing = state.unobserved_outputs?.[control.ref + ':' + drawing];
        if (missing) {
          if (state.selected !== control.ref) return { action: pointCommand(control), control, reason: 'select_unobserved_provider_of_prepared_composition', route,
            consumer: edge, missing_front_witness: missing, scope: 'A dated packet did not expose this provider output. Overlap, inactivity and other causes remain compatible.' };
          const tested = new Set((state.edges as R[]).filter(item => item.before === drawing).map(item => item.action));
          const candidates = Object.entries(this.linkedInputSteps).filter(([action, law]) => available.has(action) && law.status === 'candidate' && !tested.has(action)).map(([action]) => action).sort();
          if (candidates.length) return { action: { action_ref: candidates[0] }, control, reason: 'contrast_unobserved_provider_with_known_local_transformation', route,
            consumer: edge, missing_front_witness: missing, scope: 'Known local drawing transformation serves a new output-observation question; no output direction is assigned to the unseen phase.' };
          return null;
        }
        if (tried) return null;
        return { action: { action_ref: launch }, control: selected, reason: 'observe_unmeasured_output_after_prepared_predecessors', route, consumer: edge,
          scope: 'Earlier hypothetical links prepared; current output remains unknown.' };
      }
      const error = circular(edge.angle - estimate.angle);
      if (Math.abs(error) <= 0.06) continue;
      if (state.selected !== control.ref) return { action: pointCommand(control), control, reason: 'select_provider_for_current_relay_contribution', route, consumer: edge, estimate };
      const choices: [number, string, number][] = [];
      for (const [action, law] of Object.entries(this.linkedInputSteps)) {
        if (!available.has(action) || law.status !== 'candidate') continue;
        const delta = copySign(route.grid.step, law.delta), count = modulo(round(error / delta), route.grid.count);
        if (count && count < config.remaining_level_actions) choices.push([count, action, delta]);
      }
      if (!choices.length) return null;
      choices.sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : a[2] - b[2]));
      const [count, action, delta] = choices[0]!;
      return { action: { action_ref: action }, control, reason: 'prepare_observed_provider_for_intermediate_receiver', route, consumer: edge, estimate,
        predicted_output_angle: circular(estimate.angle + delta), remaining_hypothetical_steps: count,
        scope: 'One experimental increment; inferred output must be confronted with a later actual packet.' };
    }
    return !tried ? { action: { action_ref: launch }, control: selected, reason: 'test_prepared_relay_composition', route, all_angles_conditionally_ready: true } : null;
  }

  /** Proposals acquire no receipt; the common owner supplies inherited fallback. */
  proposeLinked(observation: R, rows: NativeRows, inputs: readonly R[], maxPrefix: number, config: R, deadlineMs: number,
    now: Clock = () => performance.now(), base: R | null = { status: 'abstained', reason: 'no_recurrent_line_question' }): R | null {
    const cfg = config.linked_packet_question, scene = truth(cfg) ? measureLinkedScene(rows) : null;
    if (!scene || !maxPrefix || !observation.available_action_refs.includes('ACTION6')) return base;
    const target = linkedTargetMarker(rows, scene);
    if (!target) return base;
    const state: R = this.linkedState && this.linkedState.epoch === observation.level_epoch ? structuredClone(this.linkedState) : {
      epoch: observation.level_epoch, scene, bindings: {}, selected: null, input_tests: [], edges: [], trials: [], selection_masks: {}, evidence: [],
    };
    const controls = state.scene.controls as R[], unbound = controls.filter(control => !Object.hasOwn(state.bindings, control.ref));
    const contribution = unbound.length ? null : this.relayContribution(state, target, observation, rows, inputs, config, deadlineMs, now);
    if ((state.trials as R[]).some(trial => unbound.some(control => control.ref === trial.failed_binding) && trial.frame === identity(rows))) {
      return { status: 'abstained', reason: 'linked_selection_refuted_or_ambiguous_in_exact_context' };
    }
    let action: R, control: R, reason: string, purpose: string;
    if (unbound.length) { control = unbound[0]!; action = pointCommand(control); reason = 'test_visible_remote_motif_binding'; purpose = cfg.selection_question; }
    else if (contribution) { action = contribution.action; control = contribution.control; reason = contribution.reason; purpose = cfg.relay_question; }
    else if (truth(state.received_controls) && !state.received_controls.includes(state.selected)) {
      control = controls.find(item => item.ref === state.received_controls[0])!; action = pointCommand(control);
      reason = 'reselect_control_of_actually_observed_front'; purpose = cfg.selection_question;
    } else {
      const selected = controls.find(item => item.ref === state.selected);
      if (!selected) return { status: 'abstained', reason: 'linked_current_selection_unknown' };
      control = selected;
      const mask = state.selection_masks[control.ref] ?? [], drawing = linkedPhase(rows, control, mask), body = state.bindings[control.ref];
      const available = inputs.filter(item => !['ACTION6', 'ACTION7'].includes(item.action_ref)).map(item => item.action_ref);
      const unknown = available.filter(item => !state.input_tests.includes(item));
      if (unknown.length) { action = { action_ref: unknown[0] }; reason = 'identify_input_effect_on_selected_public_motif'; purpose = cfg.input_question; }
      else {
        const launch = this.linkedLaunch;
        if (!launch || !available.includes(launch)) return { status: 'abstained', reason: 'linked_packet_trigger_not_acquired' };
        const current = context(state, rows);
        if (!Object.hasOwn(this.linkedOutputs, drawing) && !(state.trials as R[]).some(trial => trial.context === current && trial.action === launch)) {
          action = { action_ref: launch }; reason = 'measure_output_for_current_drawing'; purpose = cfg.packet_question;
        } else {
          const transforms = [...new Set((state.edges as R[]).filter(edge => edge.before !== edge.after && available.includes(edge.action)).map(edge => edge.action))].sort();
          const rawKnown = this.linkedOutputs[drawing], known = rawKnown && Object.hasOwn(rawKnown, 'angle') ? rawKnown : null;
          const desired = Math.atan2(target.point[1] - body.point[1], target.point[0] - body.point[0]), choices: [number, string, string | null][] = [];
          for (const candidate of transforms) {
            const edges = (state.edges as R[]).filter(edge => edge.action === candidate && edge.before === drawing), predicted = edges.length ? edges.at(-1)!.after as string : null;
            if (predicted !== null && Object.hasOwn(this.linkedOutputs, predicted)) continue;
            if (predicted === null && (state.trials as R[]).some(trial => trial.context === current && trial.action === candidate)) continue;
            const rawDelta = this.linkedInputSteps[candidate], delta = rawDelta?.status === 'candidate' ? rawDelta : null;
            choices.push([known && delta ? Math.abs(circular(known.angle + delta.delta - desired)) : Math.PI, candidate, predicted]);
          }
          if (!choices.length) return { status: 'abstained', reason: 'linked_output_requires_new_composition_or_unbound_phase' };
          choices.sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
          action = { action_ref: choices[0]![1] }; reason = 'contrast_current_drawing_output_toward_receiver_hypothesis'; purpose = cfg.contrast_question;
        }
      }
    }
    const plan = { epoch: observation.level_epoch, score: observation.levels_completed, observation_ref: observation.observation_ref, frame_digest: identity(rows),
      scene: state.scene, state, control, target_hypothesis: target, command: structuredClone(action), reason, relay_contribution: contribution,
      scope: 'Selection and output experiments. Remote role, angular law and isolated marker as useful target are hypotheses; no creator optical codebook.' };
    const ref = 'C_linked_' + identity(plan).slice(0, 20), facts = { current_public_compact_support: true, dated_packet_question: true, terminal_role_hypothesis_only: true };
    return structuredClone({ status: 'proposed', kind: 'linked_packet_experiment', linked_packet_plan: plan, proposal_id: ref, actions: [action], steps: [{ action, expected_after: null }], facts,
      compositions: [{ id: ref, observed: false, open_question: purpose, properties: { roles: cfg.roles }, relations: ['contributes_to:G_official_completion'] }],
      question: { reason, hypothesis_refs: state.evidence.slice(-16) }, route_refs: [observation.observation_ref], binding: { level_epoch: observation.level_epoch, observation_ref: observation.observation_ref },
      bundle_template: { operation_key: 'OP18', composition_ref: ref, objective_ref: 'G_official_completion', preserve_refs: [], actions: [action], purpose, preconditions: facts,
        evidence: [observation.observation_ref, ...state.evidence.slice(-16)], outcome_guard: { path: ['value'], contains: ref } } });
  }

  /** Ancestor records run first in the single common source owner. */
  record(before: R, command: R, after: R, rows: NativeRows, later: NativeRows, proposal: R, _index: number): R[] {
    const plan = proposal.linked_packet_plan;
    if (!truth(plan)) return [];
    if (!equal(command, plan.command)) throw new TypeError('Linked receipt differs from committed input');
    const state = structuredClone(plan.state), control = plan.control;
    const detail: R = { before_ref: before.observation_ref, after_ref: after.observation_ref, command, reason: plan.reason }, contribution = plan.relay_contribution;
    if (contribution?.route && command.action_ref === this.linkedLaunch) state.pending_relay_path = {
      route: contribution.route.route, all_angles_conditionally_ready: contribution.all_angles_conditionally_ready ?? false, before_ref: before.observation_ref,
    };
    const boundary = after.level_epoch !== before.level_epoch || after.levels_completed > before.levels_completed;
    if (!boundary) {
      if (command.action_ref === 'ACTION6') {
        const affected = changedLinkedSupports(rows, later, state.scene), [x, y] = control.point, radius = control.radius, mask: number[][] = [];
        for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) if (rows[y + dy]![x + dx] !== later[y + dy]![x + dx]) mask.push([dx, dy]);
        const known = state.bindings[control.ref], previous = state.bindings[state.selected] ?? null;
        const [recipient, witness] = linkedSelectionRecipient(rows, later, affected, previous); detail.selection_witness = witness;
        if (recipient && mask.length && (!known || known.ref === recipient.ref)) {
          state.bindings[control.ref] = recipient;
          if (!Object.hasOwn(state.selection_masks, control.ref)) state.selection_masks[control.ref] = mask;
          state.selected = control.ref; detail.binding_status = 'current_cochange_with_selection_provenance';
        } else { detail.binding_status = 'unknown_or_ambiguous'; state.trials.push({ failed_binding: control.ref, frame: identity(rows) }); }
      } else {
        const mask = state.selection_masks[control.ref] ?? [], a = linkedPhase(rows, control, mask), b = linkedPhase(later, control, mask);
        state.input_tests.push(command.action_ref); state.trials.push({ context: context(state, rows), action: command.action_ref });
        if (a !== b) state.edges.push({ before: a, after: b, action: command.action_ref, evidence: after.observation_ref, epoch: before.level_epoch });
        if (contribution && Object.hasOwn(contribution, 'predicted_output_angle')) {
          state.output_predictions ??= {};
          state.output_predictions[control.ref + ':' + b] = { angle: contribution.predicted_output_angle, action_ref: command.action_ref,
            prospective_observation_ref: before.observation_ref, observed_drawing_ref: after.observation_ref, status: 'candidate_pending_dated_output' };
        }
      }
    }
    state.evidence.push(after.observation_ref); return [this.emit(state, detail)];
  }

  /** Dated response frames are independent of the canonical last return image. */
  recordPacket(before: R, command: R, after: R, rows: NativeRows, frames: readonly NativeRows[]): R[] {
    if (!this.linkedState || this.linkedState.epoch !== before.level_epoch || frames.length < 3) return [];
    const measured = measureLinkedPacket(rows, frames, before.observation_ref, command.action_ref);
    if (measured.status !== 'measured') return [];
    const state = structuredClone(this.linkedState), outputs = structuredClone(this.linkedOutputs), steps = structuredClone(this.linkedInputSteps), launch = command.action_ref;
    const received: R[] = [], receivedOrder: [number, string][] = [];
    state.received_controls = []; state.edges = (state.edges as R[]).filter(edge => edge.action !== command.action_ref);
    for (const control of state.scene.controls as R[]) {
      const body = state.bindings[control.ref];
      if (!body) continue;
      const segment = linkedSegmentFor(body, measured.segments);
      if (!segment) continue;
      receivedOrder.push([segment.start_frame, control.ref]);
      const drawing = linkedPhase(rows, control, state.selection_masks[control.ref] ?? []), angle = Math.atan2(segment.direction[1], segment.direction[0]);
      const entry: R = { angle, direction: segment.direction, evidence: before.observation_ref, epoch: before.level_epoch,
        frame_interval: [segment.start_frame, segment.end_frame], body_ref: body.ref, drawing,
        scope: 'Measured local outgoing front; reemission law and exact collision geometry unknown' };
      const previous = outputs[drawing];
      outputs[drawing] = previous && (!Object.hasOwn(previous, 'angle') || Math.abs(circular(previous.angle - angle)) > 0.1) ? { status: 'refuted', counterexamples: [previous, entry] } : entry;
      const predicted = state.output_predictions?.[control.ref + ':' + drawing];
      if (predicted) {
        const difference = Math.abs(circular(predicted.angle - angle));
        predicted.status = difference <= 0.1 ? 'matched_local_prediction' : 'refuted_local_prediction'; predicted.angular_error = difference; predicted.actual_packet_ref = before.observation_ref;
        entry.prospective_comparison = structuredClone(predicted);
        if (difference > 0.1) steps[predicted.action_ref] = { status: 'refuted', counterexamples: [steps[predicted.action_ref] ?? null, structuredClone(predicted), structuredClone(entry)] };
      }
      received.push(entry);
    }
    receivedOrder.sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
    state.received_controls = receivedOrder.map(([, ref]) => ref);
    const expected = state.pending_relay_path ?? null; delete state.pending_relay_path;
    if (expected) {
      const actual = (state.received_controls as string[]).map(ref => state.bindings[ref].ref), wanted = (expected.route as R[]).map(edge => edge.source);
      expected.actual_front_sources = actual; expected.expected_front_sources = wanted; expected.official_progress = after.levels_completed > before.levels_completed;
      expected.comparison = equal(actual, wanted) ? 'matched_observed_front_prefix' : 'unknown_or_missing_expected_front'; state.last_relay_comparison = expected;
      if (!expected.official_progress) for (const edge of expected.route as R[]) {
        if (actual.includes(edge.source)) continue;
        const control = (state.scene.controls as R[]).find(item => state.bindings[item.ref].ref === edge.source)!, drawing = linkedPhase(rows, control, state.selection_masks[control.ref] ?? []);
        state.unobserved_outputs ??= {};
        state.unobserved_outputs[control.ref + ':' + drawing] = { before_ref: before.observation_ref, after_ref: after.observation_ref, body_ref: edge.source, drawing,
          frame_count: frames.length, status: 'output_not_measured', scope: 'No assigned front in this dated packet, not proof of no effect or a direction law.' };
      }
      if (expected.all_angles_conditionally_ready && !expected.official_progress && !equal(actual, wanted)) delete state.geometric_route_cache;
    }
    for (const edge of state.edges as R[]) {
      const a = outputs[edge.before], b = outputs[edge.after];
      if (!a || !b || !Object.hasOwn(a, 'angle') || !Object.hasOwn(b, 'angle')) continue;
      const delta = circular(b.angle - a.angle), prior = steps[edge.action];
      let entry: R = { delta, evidence: [edge.evidence, a.evidence, b.evidence], status: 'candidate', scope: 'Conditional angular increment, not universal law' };
      if (prior && (prior.status === 'refuted' || Math.abs(circular(prior.delta - delta)) > 0.1)) entry = { status: 'refuted', counterexamples: [prior, entry] };
      steps[edge.action] = entry;
    }
    const detail = { before_ref: before.observation_ref, after_ref: after.observation_ref, command, packet_measurement: measured, outputs_received: received,
      relay_comparison: expected, canonical_return_equals_initial: Boolean(frames.length && equal(frames.at(-1), rows)), reset_semantics: 'unknown_beyond_observed_view' };
    return [this.emit(state, detail, outputs, steps, launch)];
  }
}

export async function commonLinkedPacketProposal(memory: LinkedPacketMemory, observation: R, rows: NativeRows, inputs: readonly R[], remaining: number,
  config: R, deadlineMs: number | null, now: Clock = () => performance.now(), base?: R | null): Promise<R | null> {
  if (remaining < 1) return null;
  if (deadlineMs === null || deadlineMs === undefined) throw new TypeError('Dated packet experiment requires current level deadline');
  const proposal = memory.proposeLinked(observation, rows, inputs, Math.min(16, remaining), { ...config, remaining_level_actions: remaining }, deadlineMs, now, base);
  if (!proposal || !Object.hasOwn(proposal, 'linked_packet_plan')) return null;
  for (const [index, action] of (proposal.actions as R[]).entries()) {
    const step = proposal.steps[index];
    step.expected_before = Object.fromEntries(['level_epoch', 'frame_hash', 'levels_completed', 'state'].map(key => [key, observation[key]]));
    if (action.action_ref !== 'ACTION6') continue;
    const control = proposal.linked_packet_plan.control, [x, y] = control.point, value = rows[y]![x];
    step.point_support = { level_epoch: observation.level_epoch, observation_ref: observation.observation_ref, frame_hash: observation.frame_hash, point: [x, y], palette_value: value,
      projection_bbox: [x, y, x, y], projected_rows_digest: await rowsDigest([[value!]]), entity_ref: control.ref, signature: identity([control, value]),
      scope: 'Current measured exterior motif center under an explicit selection question; no inherited point or terminal authority.' };
  }
  return proposal;
}

export function bindLinkedPacket(proposal: R, _domain: ObservedInputDomain): void {
  for (const [index, action] of (proposal.actions as R[]).entries()) {
    if (action.action_ref !== 'ACTION6') continue;
    const step = proposal.steps[index], support = step.point_support;
    if (!equal(support.point, [action.data.x, action.data.y])) throw new TypeError('Linked point payload changed');
    step.point_binding = { ...support };
  }
}

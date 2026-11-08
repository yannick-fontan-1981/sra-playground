/** TraceFieldAccess own evidence layer and the pinned common current-point wrapper. */
import { measureTraceField, traceFieldCenter, traceFieldRingMatches } from './v6-trace-field-observation.ts';
import { constructTraceField } from './v6-trace-field-mechanics.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { pythonEqual as equal, pythonTruthy as truth } from './v6-operations.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { rowsDigest, type ObservedInputDomain } from './v6-native-observer.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
type Clock = () => number;
type BeforeMeta = { epoch: number; score: number; observation_ref: string; available: readonly string[] };
type AfterMeta = { epoch: number; score: number; state?: string };
export interface TraceFieldState { trace_state: R | null; trace_events: R[] }

export function traceFieldCommand(geometry: R, cell: readonly number[]): R {
  const [x, y] = traceFieldCenter(geometry, cell);
  return { action_ref: 'ACTION6', data: { x, y } };
}

/** Source projection: changes outside the measured support remain unqualified. */
export function localTraceEffect(scene: R, source: readonly number[], target: readonly number[], before: NativeRows, after: NativeRows): boolean {
  const g = scene.geometry, mark = scene.head;
  if (!traceFieldRingMatches(after, g, mark, target)) return false;
  const a = traceFieldCenter(g, source), b = traceFieldCenter(g, target), half = Math.floor((g.pitch - 2) / 2);
  const bounds = [Math.min(a[0], b[0]) - half, Math.min(a[1], b[1]) - half, Math.max(a[0], b[0]) + half, Math.max(a[1], b[1]) + half];
  const [l, t, r, bottom] = g.bbox;
  for (let y = t; y <= bottom; y++) for (let x = l; x <= r; x++) {
    if (before[y]![x] !== after[y]![x] && !(bounds[0]! <= x && x <= bounds[2]! && bounds[1]! <= y && y <= bounds[3]!)) return false;
  }
  if (traceFieldRingMatches(after, g, mark, source)) return false;
  return true;
}

export function traceFieldBefore(proposal: R, index: number, rows: NativeRows, meta: BeforeMeta): R {
  const plan = proposal.trace_field_plan;
  if (!truth(plan)) throw new TypeError('Trace guard requires trace_field_plan');
  let admitted = meta.epoch === plan.epoch && meta.score === plan.score && equal(proposal.actions, plan.commands)
    && equal(proposal.bundle_template.actions, plan.commands) && 0 <= index && index < proposal.steps.length && meta.available.includes('ACTION6');
  if (admitted) {
    const step = proposal.steps[index];
    admitted = equal(proposal.actions[index], traceFieldCommand(plan.scene.geometry, step.target))
      && traceFieldRingMatches(rows, plan.scene.geometry, plan.scene.head, step.source);
  }
  if (index === 0) admitted = admitted && meta.observation_ref === plan.observation_ref && identity(rows) === plan.frame_digest;
  return { admitted: Boolean(admitted), reason: admitted ? 'trace_current_head_and_point_bound' : 'trace_binding_or_payload_changed' };
}

export function traceFieldAfter(proposal: R, index: number, rows: NativeRows, later: NativeRows, meta: AfterMeta): R {
  const plan = proposal.trace_field_plan;
  if (!truth(plan)) throw new TypeError('Trace outcome requires trace_field_plan');
  const step = proposal.steps[index], progress = meta.score > plan.score, boundary = meta.epoch !== plan.epoch;
  let matched = boundary ? null : localTraceEffect(plan.scene, step.source, step.target, rows, later);
  if (matched && plan.scene.trace_value !== null) {
    const a = traceFieldCenter(plan.scene.geometry, step.source), b = traceFieldCenter(plan.scene.geometry, step.target);
    matched = later[Math.floor((a[1] + b[1]) / 2)]![Math.floor((a[0] + b[0]) / 2)] === plan.scene.trace_value;
  }
  return { matched, seal_prefix: progress || boundary || matched !== true || !step.relation_observed, official_progress: progress,
    reason: matched ? 'trace_local_extension_projection_matched' : 'trace_effect_requires_reconciliation',
    scope: 'Ring relocation and locality inside the measured support. Changes outside this support remain unknown, not certified inert.' };
}

export class TraceFieldMemory {
  private traceState: R | null = null;
  private traceEvents: R[] = [];
  private version = 0;
  get nativeRevision(): number { return this.version; }
  currentState(): TraceFieldState { return structuredClone({ trace_state: this.traceState, trace_events: this.traceEvents }); }
  retainedDigest(ancestor: string): string { return identity([ancestor, this.traceState, this.traceEvents]); }
  applyEvent(event: R): void {
    if (event.kind !== 'observed_trace_extension') throw new TypeError(`Outside trace-field layer: ${String(event.kind)}`);
    const owned = retainNativeJson(event);
    this.version++; this.traceState = owned.state; this.traceEvents.push(owned);
  }

  /** Planning acquires nothing; the shared owner supplies the inherited fallback. */
  proposeTrace(observation: R, rows: NativeRows, _inputs: readonly R[], maxPrefix: number, config: R,
    levelDeadlineMs: number, now: Clock = () => performance.now(),
    base: R | null = { status: 'abstained', reason: 'no_recurrent_line_question' }): R | null {
    const cfg = config.trace_field_question;
    const old = this.traceState && this.traceState.epoch === observation.level_epoch ? this.traceState : null;
    const scene = truth(cfg) ? measureTraceField(rows, old ? old.geometry : null) : null;
    if (!scene || !maxPrefix || !observation.available_action_refs.includes('ACTION6')) return base;
    const state = old && old.geometry_ref === scene.geometry_ref ? old : { epoch: observation.level_epoch, geometry: scene.geometry,
      geometry_ref: scene.geometry_ref, successes: [], failures: [], evidence: [] };
    const estimate = constructTraceField(scene, observation, config.remaining_level_actions, levelDeadlineMs, now);
    if (!estimate) return { status: 'abstained', reason: 'experimental_trace_has_no_bounded_cover_in_measured_graph' };
    const suffix = (estimate.path as number[][]).slice(scene.prefix.length);
    if (!suffix.length) return { status: 'abstained', reason: 'experimental_trace_complete_official_terminal_unknown' };
    const learned = !state.failures.length && new Set((state.successes as R[]).map(event => JSON.stringify([...event.source, ...event.target]))).size >= 2;
    const actions: R[] = [], steps: R[] = [], prefix: number[][] = structuredClone(scene.prefix);
    let source: number[] = scene.head.cell;
    for (const target of suffix.slice(0, learned ? maxPrefix : 1)) {
      const command = traceFieldCommand(scene.geometry, target);
      if ((state.failures as R[]).some(event => event.frame_digest === identity(rows) && equal(event.command, command))) break;
      actions.push(command); steps.push({ action: command, source, target, prefix_before: structuredClone(prefix), relation_observed: learned, expected_after: null });
      prefix.push(target); source = target;
    }
    if (!actions.length) return { status: 'abstained', reason: 'trace_command_refuted_in_exact_context' };
    const plan = { epoch: observation.level_epoch, score: observation.levels_completed, observation_ref: observation.observation_ref,
      frame_digest: identity(rows), scene, state: structuredClone(state), commands: structuredClone(actions), estimate,
      scope: 'A simple covering trace ending at the other mark is an experimental target. Geometry, point effect and terminal role remain independently falsifiable.' };
    const ref = 'C_trace_' + identity(plan).slice(0, 20), why = cfg.question;
    const facts = { measured_cell_domain: true, simple_cover_is_declared_experimental_target: true, official_terminal_law_unknown: true };
    return structuredClone({ status: 'proposed', kind: 'trace_field_experiment', trace_field_plan: plan, proposal_id: ref, actions, steps, facts,
      compositions: [{ id: ref, observed: false, open_question: why, properties: { roles: cfg.roles }, relations: ['contributes_to:G_official_completion'] }],
      question: { reason: why, hypothesis_refs: state.evidence.slice(-16) }, route_refs: [observation.observation_ref],
      binding: { level_epoch: observation.level_epoch, observation_ref: observation.observation_ref },
      bundle_template: { operation_key: 'OP18', composition_ref: ref, objective_ref: 'G_official_completion', preserve_refs: [], actions,
        purpose: why, preconditions: facts, evidence: [observation.observation_ref, ...state.evidence.slice(-16)], outcome_guard: { path: ['value'], contains: ref } } });
  }

  /** Labeled and older acquisitions run first in the common source owner. */
  record(before: R, command: R, after: R, rows: NativeRows, later: NativeRows, proposal: R, index: number): R[] {
    const plan = proposal.trace_field_plan;
    if (!truth(plan)) return [];
    if (!equal(command, plan.commands[index])) throw new TypeError('Trace receipt differs from committed command');
    const state = structuredClone(this.traceState && this.traceState.epoch === plan.epoch ? this.traceState : plan.state), step = proposal.steps[index];
    const boundary = after.level_epoch !== before.level_epoch || after.levels_completed > before.levels_completed;
    let outcome = boundary ? 'official_boundary' : localTraceEffect(plan.scene, step.source, step.target, rows, later) ? 'local_extension_observed' : 'projection_refuted';
    if (outcome === 'local_extension_observed') {
      const projected = measureTraceField(later, state.geometry);
      if (!projected || !equal(projected.prefix, [...step.prefix_before, step.target])) outcome = 'ordered_trace_projection_refuted';
    }
    const [l, t, r, b] = plan.scene.geometry.bbox;
    let outside = 0;
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y]!.length; x++) {
      if (!(l <= x && x <= r && t <= y && y <= b)) outside += Number(rows[y]![x] !== later[y]![x]);
    }
    const evidence = { source: step.source, target: step.target, command, before_ref: before.observation_ref, after_ref: after.observation_ref,
      frame_digest: identity(rows), outcome, outside_support_changed_pixels: outside, outside_support_effect_role: 'unknown' };
    if (outcome === 'local_extension_observed') state.successes.push(evidence);
    else if (!boundary) state.failures.push(evidence);
    state.evidence.push(after.observation_ref);
    const event = { kind: 'observed_trace_extension', state, transition: evidence,
      scope: 'Current epoch only; prior geometry or point law grants no authority in a new epoch.' };
    this.applyEvent(event); return [structuredClone(event)];
  }
}

export async function commonTraceFieldProposal(memory: TraceFieldMemory, observation: R, rows: NativeRows, inputs: readonly R[],
  remaining: number, config: R, levelDeadlineMs: number | null, now: Clock = () => performance.now(), base?: R | null): Promise<R | null> {
  if (remaining < 1) return null;
  if (levelDeadlineMs === null || levelDeadlineMs === undefined) throw new TypeError('Trace experiment requires current level deadline');
  const proposal = memory.proposeTrace(observation, rows, inputs, Math.min(16, remaining), { ...config, remaining_level_actions: remaining }, levelDeadlineMs, now, base);
  if (!proposal || !Object.hasOwn(proposal, 'trace_field_plan')) return null;
  const scene = proposal.trace_field_plan.scene;
  for (const step of proposal.steps as R[]) {
    const [x, y] = traceFieldCenter(scene.geometry, step.target), value = rows[y]![x];
    step.expected_before = Object.fromEntries(['level_epoch', 'frame_hash', 'levels_completed', 'state'].map(key => [key, observation[key]]));
    step.point_support = { level_epoch: observation.level_epoch, observation_ref: observation.observation_ref, frame_hash: observation.frame_hash,
      point: [x, y], palette_value: value, projection_bbox: [x, y, x, y], projected_rows_digest: await rowsDigest([[value!]]),
      entity_ref: 'measured-cell:' + identity([scene.geometry_ref, step.target]), signature: identity([scene.geometry_ref, step.target, value]),
      scope: 'Current measured cell center. Future unvisited cells are conditionally unchanged until approached, each point revalidated at dispatch. No old-epoch coordinate authority or acquired terminal role.' };
  }
  return proposal;
}

export function bindTraceField(proposal: R, _domain: ObservedInputDomain): void {
  for (const [index, action] of (proposal.actions as R[]).entries()) {
    const step = proposal.steps[index], support = step.point_support;
    if (!equal(support.point, [action.data.x, action.data.y])) throw new TypeError('Trace point payload changed');
    step.point_binding = { ...support };
  }
}

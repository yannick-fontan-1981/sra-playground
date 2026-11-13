/**
 * RadialPortsAccess and its common point wrapper at pinned V6 786dcf51.
 * Only the source's public initial-experiment mode is connected: the common
 * policy forbids importing a prior action method from a file.
 */
import { measureRadialPorts, radialAtGeometry, radialAssemblyModel, selectedRadialOccurrence, rotateRadialPorts } from './v6-radial-port-observation.ts';
import { assemblePorts, type PortModel } from './v6-port-assembly.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { pythonEqual as equal, pythonTruthy as truth } from './v6-operations.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { projection, rowsDigest, type ObservedInputDomain } from './v6-native-observer.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
type BeforeMeta = { epoch: number; score: number; observation_ref: string; available: readonly string[] };
type AfterMeta = { epoch: number; score: number; state?: string };
export interface RadialPortState {
  port_events: R[]; port_prior: R | null; port_point_rule: R | null; port_rejected: string[];
}

export function radialPortBefore(proposal: R, index: number, rows: NativeRows, meta: BeforeMeta): R {
  const plan = proposal.radial_port_plan;
  if (!truth(plan)) throw new TypeError('Radial admission requires radial_port_plan');
  const scene = radialAtGeometry(rows, plan.scene), step = plan.steps[index];
  let admitted = Boolean(scene) && equal([meta.epoch, meta.score], [plan.epoch, plan.score]) && meta.available.includes('ACTION6')
    && equal(proposal.actions[index], step.action) && equal(scene?.cells.map((cell: R) => cell.ports), step.ports_before);
  const point = plan.scene.cells[step.cell].point;
  admitted = admitted && equal(proposal.actions[index], { action_ref: 'ACTION6', data: { x: point[0], y: point[1] } });
  if (index === 0) admitted = admitted && identity(rows) === plan.frame_digest && meta.observation_ref === plan.observation_ref;
  return { admitted, reason: admitted ? 'bound_observed_support_and_conditional_ports' : 'port_context_or_payload_changed' };
}

export function radialPortAfter(proposal: R, index: number, rows: NativeRows, later: NativeRows, meta: AfterMeta): R {
  const plan = proposal.radial_port_plan;
  if (!truth(plan)) throw new TypeError('Radial outcome requires radial_port_plan');
  if (meta.epoch !== plan.epoch || meta.score > plan.score) {
    return { matched: null, seal_prefix: true, reason: 'official_boundary_terminal_cause_not_inferred', official_progress: true };
  }
  const scene = radialAtGeometry(later, plan.scene), step = plan.steps[index];
  if (step.ports_after === null) {
    return { matched: null, seal_prefix: true, reason: 'unknown_point_effect_observed_for_acquisition', official_progress: false };
  }
  const matched = Boolean(scene) && equal(scene!.cells.map((cell: R) => cell.ports), step.ports_after);
  const [l, t, r, b] = plan.scene.cells[step.cell].bbox;
  let outside = 0;
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[0]!.length; x++) {
    if (!(l <= x && x <= r && t <= y && y <= b) && rows[y]![x] !== later[y]![x]) outside++;
  }
  return { matched, seal_prefix: !matched || !plan.point_method_revalidated || outside > 0,
    reason: matched && outside ? 'ports_matched_extra_pixels_unexplained' : matched ? 'conditional_ports_matched' : 'conditional_ports_refuted',
    outside_changed_pixels: outside, official_progress: false };
}

export class RadialPortMemory {
  private events: R[] = [];
  private prior: R | null = null;
  private pointRule: R | null = null;
  private rejected: string[] = [];
  private version = 0;
  get nativeRevision(): number { return this.version; }

  applyEvent(event: R): void {
    if (!['radial_method_recall', 'radial_port_effect'].includes(event.kind)) throw new TypeError(`Outside radial layer: ${String(event.kind)}`);
    const owned = retainNativeJson(event);
    this.version++;
    if (owned.kind === 'radial_method_recall') this.prior = owned.method;
    else {
      if (truth(owned.rule)) this.pointRule = owned.rule;
      if (truth(owned.refuted)) { this.pointRule = null; this.rejected.push(owned.context); }
    }
    this.events.push(owned);
  }

  currentState(): RadialPortState {
    return structuredClone({ port_events: this.events, port_prior: this.prior, port_point_rule: this.pointRule, port_rejected: this.rejected });
  }
  retainedDigest(ancestor: string): string { return identity([ancestor, this.events, this.prior, this.pointRule, this.rejected]); }

  /** `base` is the already evaluated inherited proposal, never a second agent. */
  proposeRadial(observation: R, rows: NativeRows, _inputs: readonly R[], maxPrefix: number, config: R,
    base: R | null = { status: 'abstained', reason: 'no_recurrent_line_question' }): R | null {
    if (base?.status === 'proposed') return base;
    const cfg = config.radial_port_composition;
    if (!truth(cfg) || maxPrefix < 1 || !observation.available_action_refs.includes('ACTION6')) return base;
    const scene = measureRadialPorts(rows);
    if (!scene) return base;
    if (this.prior === null && (cfg.use_prior_method ?? true)) throw new TypeError('Native common radial entry requires use_prior_method=false');
    if (this.prior === null && !cfg.allow_initial_experiment) return base;
    const sign = this.pointRule?.turn ?? this.prior?.turn ?? 0;
    const [model, current] = radialAssemblyModel(scene), target = assemblePorts(model as PortModel, current, null, sign);
    if (target === null) return base;
    const context = identity([observation.level_epoch, scene]);
    if (this.rejected.includes(context)) return base;
    const known = this.pointRule !== null && this.pointRule.epoch === observation.level_epoch && this.pointRule.geometry_ref === scene.geometry_ref;
    const steps: R[] = [], expected: number[][] = scene.cells.map((cell: R) => [...cell.ports]);
    const limit = known ? maxPrefix : 1;
    for (const [i, pose] of target.entries()) {
      const count = sign ? ((pose[0] * sign) % 4 + 4) % 4 : Math.min(pose[0], ((-pose[0]) % 4 + 4) % 4);
      for (let turn = 0; turn < count; turn++) {
        if (steps.length >= limit) break;
        const cell = scene.cells[i], command = { action_ref: 'ACTION6', data: { x: cell.point[0], y: cell.point[1] } };
        const before = expected.map(ports => [...ports]);
        expected[i] = rotateRadialPorts(expected[i]!, sign || 1);
        steps.push({ action: command, cell: i, ports_before: before, ports_after: sign ? expected.map(ports => [...ports]) : null,
          candidate_turns: sign ? [sign] : [0, 1, 2, 3], expected_after: null,
          prediction_status: known ? 'conditional_point_method' : sign ? 'unconfirmed_point_binding_to_recalled_rotation' : 'unknown_point_effect_rotation_candidates_only' });
      }
      if (steps.length >= limit) break;
    }
    if (!steps.length) return base;
    const priorEvidence: R[] = this.prior?.evidence ?? [];
    const plan = { epoch: observation.level_epoch, score: observation.levels_completed, observation_ref: observation.observation_ref,
      frame_digest: identity(rows), scene, steps, context, sign, point_method_revalidated: known,
      search_nodes: model.search_nodes, prior_evidence: priorEvidence,
      goal_status: 'closed_connected_acyclic_composition_hypothesis_official_terminal_unknown' };
    const ref = 'C_ports_' + identity(plan).slice(0, 20), actions = steps.map(step => step.action), why = cfg.question;
    const facts = { measured_repeated_radial_supports: true, finite_pose_domains: true, unresolved_point_method_or_current_conditional_method: true };
    const evidence = [observation.observation_ref, ...priorEvidence.map(item => item.after_ref)];
    return structuredClone({ status: 'proposed', kind: 'radial_port_composition', proposal_id: ref, radial_port_plan: plan, actions, steps, facts,
      compositions: [{ id: ref, observed: false, open_question: why, properties: { roles: cfg.roles }, relations: ['contributes_to:G_official_completion'] }],
      question: { reason: known ? 'conditional_port_assembly' : sign ? 'test_point_binding_of_recalled_rotation' : 'initial_radial_interface_experiment',
        hypothesis_refs: this.prior ? [identity(this.prior)] : [] }, route_refs: evidence,
      binding: { level_epoch: observation.level_epoch, observation_ref: observation.observation_ref },
      bundle_template: { operation_key: 'OP18', composition_ref: ref, objective_ref: 'G_official_completion', preserve_refs: [], actions,
        purpose: why, preconditions: facts, evidence, outcome_guard: { path: ['value'], contains: ref } } });
  }

  /** Own record suffix; inherited acquisition remains with the common journal owner. */
  record(before: R, command: R, after: R, _rows: NativeRows, later: NativeRows, proposal: R, index: number): R[] {
    const plan = proposal.radial_port_plan;
    if (!truth(plan) || after.level_epoch !== before.level_epoch) return [];
    const scene = radialAtGeometry(later, plan.scene), step = plan.steps[index], i = step.cell;
    const selected = scene ? selectedRadialOccurrence(later, scene) : null;
    const unchanged = Boolean(scene) && (scene!.cells as R[]).every((cell, j) => j === i || equal(cell.ports, step.ports_before[j]));
    const turns = unchanged ? [1, 2, 3].filter(turn => equal(rotateRadialPorts(step.ports_before[i], turn), scene!.cells[i].ports)) : [];
    const matched = step.ports_after !== null ? Boolean(scene) && equal(scene!.cells.map((cell: R) => cell.ports), step.ports_after) : null;
    const rule = turns.length === 1 && selected && selected.index === i ? {
      action_ref: command.action_ref, turn: turns[0], geometry_ref: plan.scene.geometry_ref, epoch: after.level_epoch,
      status: 'conditional_observed_point_method', evidence: [before.observation_ref, after.observation_ref],
    } : null;
    const event = { kind: 'radial_port_effect', rule, refuted: matched === false || (matched === null && rule === null), context: plan.context,
      evidence: [before.observation_ref, after.observation_ref], ports_prediction_matched: matched,
      selection_observed: selected !== null, goal_terminal_status: 'unknown' };
    this.applyEvent(event); return [structuredClone(event)];
  }
}

/** Unchanged common wrapper's current-point support, separate from a port prediction. */
export async function commonRadialPortProposal(memory: RadialPortMemory, observation: R, rows: NativeRows, inputs: readonly R[],
  remaining: number, config: R, base?: R | null): Promise<R | null> {
  if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
  if (config.use_prior_method !== false) throw new TypeError('Common radial policy forbids imported action methods');
  const proposal = memory.proposeRadial(observation, rows, inputs, Math.min(16, remaining), { radial_port_composition: config }, base);
  if (!proposal || !Object.hasOwn(proposal, 'radial_port_plan')) return null;
  const plan = proposal.radial_port_plan;
  proposal.steps = structuredClone(proposal.steps);
  proposal.steps[0].expected_before = Object.fromEntries(['level_epoch', 'frame_hash', 'levels_completed', 'state'].map(key => [key, observation[key]]));
  for (const [index, action] of (proposal.actions as R[]).entries()) {
    const step = proposal.steps[index], cell = plan.scene.cells[step.cell], [x, y] = cell.point;
    if (!equal(action, { action_ref: 'ACTION6', data: { x, y } })) throw new TypeError('Radial action is not its measured cell point');
    const box = [x, y, x, y];
    step.point_support = { level_epoch: observation.level_epoch, observation_ref: observation.observation_ref,
      frame_hash: observation.frame_hash, point: [x, y], palette_value: rows[y]![x], projection_bbox: box,
      projected_rows_digest: await rowsDigest(projection(rows, box)),
      entity_ref: 'measured-radial-support:' + identity([plan.scene.geometry_ref, cell.grid]), signature: identity([cell, index]),
      scope: 'Measured current center pixel plus library full-frame initial guard and per-step fixed-support/port geometry guard. Unexpected distant changes seal the prefix.' };
  }
  return proposal;
}

export function bindRadialPort(proposal: R, domain: ObservedInputDomain): void {
  const first = proposal.steps[0].expected_before;
  if (!domain.bindings.has(`${first.level_epoch}:${first.frame_hash}`)) throw new TypeError('Radial point domain not currently observed');
  for (const [index, action] of (proposal.actions as R[]).entries()) {
    const step = proposal.steps[index], support = step.point_support;
    if (!equal(support.point, [action.data.x, action.data.y])) throw new TypeError('Radial point payload changed');
    step.point_binding = { ...support };
  }
}

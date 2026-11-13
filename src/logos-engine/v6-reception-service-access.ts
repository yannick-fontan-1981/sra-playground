/** ReceptionServiceAccess's own layer from pinned original V6.
 * SharedSeries owns inherited dispatch/acquisition and the authoritative journal.
 * The source aliases its reception_events with ExposedReception; this native own
 * layer deliberately keeps the two owners distinct, as documented by integration.
 */
import { measureReceptionService, receptionServiceCarriers, receptionServicePath } from './v6-reception-service-observation.ts';
import { ReceptionResidualEvidence } from './v6-reception-residual-evidence.ts';
import { normalizeReceptionWaitBudget } from './v5-reception-wait-contracts.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { compareUnicode } from './canonical.ts';
import { pythonEqual as equal, pythonTruthy as truth } from './v6-operations.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
type BeforeMeta = { epoch: number; score: number; observation_ref: string; available: readonly string[] };
type AfterMeta = { epoch: number; score: number; state?: string };
export interface ReceptionServiceState { reception_memory: R; reception_events: R[] }
export interface ReceptionServiceOptions {
  /** Native current-scope acquisition: commit the guarded tentative epoch reset. */
  currentEpochAcquisition?: boolean;
}
export const freshReceptionServiceMemory = (): R => ({ epoch: null, scene: null, controls: {}, trials: {}, evidence: [],
  wait_spent: 0, refuted: [], residual_events: [] });

export function receptionServiceBefore(proposal: R, index: number, rows: NativeRows, meta: BeforeMeta): R {
  const plan = proposal.reception_service_plan;
  if (!truth(plan)) throw new TypeError('Reception service admission requires reception_service_plan');
  const scene = measureReceptionService(rows, plan.scene), actors = scene ? receptionServiceCarriers(rows, scene) : [], step = plan.steps[index];
  let admitted = scene !== null && scene.layout === plan.scene.layout && equal([meta.epoch, meta.score], [plan.epoch, plan.score])
    && equal(proposal.actions, plan.commands) && equal(plan.commands, proposal.bundle_template.actions)
    && proposal.proposal_id === 'reception-service:' + identity(plan) && meta.available.includes(step.action_ref);
  if (index === 0) admitted = admitted && identity(rows) === plan.frame_digest && meta.observation_ref === plan.observation_ref;
  else admitted = admitted && actors.length === 1 && equal(actors[0]!.anchor, step.from);
  return { admitted: Boolean(admitted), reason: admitted ? 'current_reception_binding' : 'reception_context_changed' };
}

export function receptionServiceAfter(proposal: R, index: number, _rows: NativeRows, later: NativeRows, meta: AfterMeta): R {
  const plan = proposal.reception_service_plan;
  if (!truth(plan)) throw new TypeError('Reception service outcome requires reception_service_plan');
  const scene = measureReceptionService(later, plan.scene), actors = scene ? receptionServiceCarriers(later, scene) : [];
  const boundary = !equal([meta.epoch, meta.score], [plan.epoch, plan.score]), expected = plan.steps[index].to;
  const matched = boundary || expected === null || actors.length !== 1 ? null : equal(actors[0]!.anchor, expected);
  return { matched, seal_prefix: boundary || matched !== true,
    reason: matched ? 'reception_control_projection' : 'reception_boundary_unknown_or_divergence' };
}

export class ReceptionServiceMemory {
  private receptionMemory: R = freshReceptionServiceMemory();
  private receptionEvents: R[] = [];
  private version = 0;
  private readonly currentEpochAcquisition: boolean;
  constructor(options: ReceptionServiceOptions = {}) { this.currentEpochAcquisition = options.currentEpochAcquisition === true; }
  get nativeRevision(): number { return this.version; }
  get eventCount(): number { return this.receptionEvents.length; }
  currentState(): ReceptionServiceState { return structuredClone({ reception_memory: this.receptionMemory, reception_events: this.receptionEvents }); }
  retainedDigest(ancestor: string): string { return identity([ancestor, this.receptionMemory, this.receptionEvents]); }
  applyEvent(event: R): void {
    if (event.kind !== 'observed_reception_service') throw new TypeError(`Outside reception-service layer: ${String(event.kind)}`);
    const owned = retainNativeJson(event);
    if (!Object.hasOwn(owned, 'memory')) throw new TypeError('Reception service event lacks its memory');
    this.version++; this.receptionMemory = owned.memory; this.receptionEvents.push(owned);
  }

  /** Null delegates to RootedLine; explicit source refusals remain blocking. */
  propose(observation: R, rows: NativeRows, inputs: readonly R[], limit: number, config: R): R | null {
    const cfg = config.reception_service_question;
    if (!truth(cfg)) return null;
    const memory = structuredClone(this.receptionMemory), scene = measureReceptionService(rows, memory.scene);
    if (scene === null) return null;
    const now: () => number = config.native_reception_now ?? (() => performance.now());
    if (now() >= (config.level_deadline ?? Infinity)) {
      return { status: 'unknown', reason: 'reception_level_deadline', block_unrelated_probe: true };
    }
    if (memory.epoch !== observation.level_epoch) {
      Object.assign(memory, { epoch: observation.level_epoch, scene, controls: {}, trials: {}, wait_spent: 0, refuted: [] });
      // Native current-scope ownership also renews the stationary permission:
      // matching coordinates in a new epoch cannot authorize a wait batch.
      if (this.currentEpochAcquisition) delete memory.stationary;
    }
    if (truth(memory.refuted)) return { status: 'unknown', reason: 'reception_control_projection_refuted', block_unrelated_probe: true };
    const actors = receptionServiceCarriers(rows, scene), actor = actors.length === 1 ? actors[0]! : null;
    const allowed = new Set(inputs.filter(action => !truth(action.data)).map(action => action.action_ref as string));
    const moves = Object.fromEntries(Object.entries(memory.controls as R).filter(([name]) => allowed.has(name)).map(([name, value]) => [name, value.delta]));
    const target = [...scene.target.anchor];
    let steps: R[] = [], kind = 'control_probe', why = cfg.control;
    const remaining = config.remaining_level_actions ?? limit;
    if (actor && !equal(actor.anchor, target) && Object.keys(moves).length) {
      steps = receptionServicePath(rows, scene, actor.anchor, target, moves, remaining) ?? [];
      if (steps.length) { kind = 'access'; why = cfg.access + ' ' + cfg.preserve_other_contacts; steps = steps.slice(0, Math.min(limit, 16)); }
    }
    if (actor && equal(actor.anchor, target)) {
      const outward = Object.entries(moves).filter(([, delta]) => !scene.cells.some((cell: number[]) =>
        equal([target[0] + delta[0], target[1] + delta[1]], cell))).map(([name]) => name).sort(compareUnicode);
      if (outward.length) {
        const command = outward[0]!, confirmed = equal(memory.stationary?.[command] ?? null, target);
        let count = confirmed ? Math.min(limit, 16, remaining, cfg.wait_batch) : 1;
        const declaredMaximum = Object.hasOwn(config, 'level_action_cap') ? config.level_action_cap : remaining + memory.wait_spent;
        if (config.native_reception_wait_budget === true && (!Number.isSafeInteger(declaredMaximum) || declaredMaximum < 0)) {
          throw new RangeError('Native reception total action budget must be a nonnegative safe integer');
        }
        const ledger = normalizeReceptionWaitBudget({ parent_goal_ref: 'G_official_completion', parent_contribution_ref: 'reception_support_experiment',
          consumer_request_ref: 'shape:' + scene.counterparts[0].request_shape, level_scope_ref: String(observation.level_epoch),
          restore_epoch: 0, observed_clock: observation.revision,
          maximum_total_wait_primitives: config.native_reception_wait_budget === true ? Math.min(128, declaredMaximum) : declaredMaximum,
          spent_wait_primitives: memory.wait_spent, ledger_claim_ref: 'observed_wait:' + memory.wait_spent });
        if (config.native_reception_wait_budget === true && ledger.spent_wait_primitives >= ledger.maximum_total_wait_primitives) {
          return { status: 'unknown', reason: 'reception_wait_budget_exhausted', block_unrelated_probe: true };
        }
        count = Math.min(count, ledger.maximum_total_wait_primitives - ledger.spent_wait_primitives);
        steps = Array.from({ length: Math.max(0, count) }, () => ({ action_ref: command, from: [...target], to: [...target], stationary_confirmed: confirmed }));
        kind = 'reception_observation'; why = cfg.wait;
      }
    }
    if (!steps.length) {
      const probes: string[] = cfg.probe_order.filter((name: string) => allowed.has(name) && !Object.hasOwn(memory.controls, name));
      if (!probes.length) return { status: 'unknown', reason: 'reception_access_or_control_unknown', block_unrelated_probe: true };
      const command = [...probes].sort((a, b) => (memory.trials[a] ?? 0) - (memory.trials[b] ?? 0) || cfg.probe_order.indexOf(a) - cfg.probe_order.indexOf(b))[0]!;
      steps = [{ action_ref: command, from: actor ? actor.anchor : null, to: null }];
    }
    const actions = steps.map(step => ({ action_ref: step.action_ref }));
    const plan = structuredClone({ scene, memory, actor, steps, commands: actions, kind, why, epoch: observation.level_epoch,
      score: observation.levels_completed, observation_ref: observation.observation_ref, frame_digest: identity(rows), source_rule: cfg.source_rule });
    const ref = 'reception-service:' + identity(plan), evidence = [observation.observation_ref, ...memory.evidence.slice(-16)];
    const composition = { id: ref, observed: false, open_question: why, relations: ['contributes_to:G_official_completion'],
      properties: { target, request: scene.counterparts,
        hypothesis: 'distinct concave support plus request counterpart suggests a reception experiment, not a terminal law' } };
    return { status: 'proposed', kind: 'reception_service', proposal_id: ref, reception_service_plan: plan, actions,
      steps: actions.map(action => ({ action, expected_after: null })),
      facts: { current_reception_supposition: true, control_effects_are_conditional: true, hidden_route_and_arrival_phase_unknown: true },
      compositions: [composition], question: { reason: why, hypothesis_refs: evidence }, route_refs: evidence,
      binding: { level_epoch: observation.level_epoch, observation_ref: observation.observation_ref },
      bundle_template: { operation_key: 'OP18', composition_ref: ref, objective_ref: 'G_official_completion', purpose: why,
        evidence, preconditions: {}, actions, outcome_guard: { path: ['value'], contains: ref } } };
  }

  /** Own selected acquisition follows inherited record. The original record
   * chooses acquired memory once any own event exists, even if propose carried
   * a tentative epoch reset. The default preserves that source behavior. The
   * common owner's explicit native option commits only a current bound reset;
   * subsequent returns use newly acquired memory and do not replay the reset. */
  record(before: R, command: R, after: R, rows: NativeRows, later: NativeRows, proposal: R, index: number): R[] {
    const plan = proposal.reception_service_plan;
    if (!truth(plan)) return [];
    const currentReset = this.currentEpochAcquisition && this.receptionMemory.epoch !== before.level_epoch;
    if (currentReset && plan.memory.epoch !== before.level_epoch) throw new TypeError('Reception epoch acquisition requires current bound proposal memory');
    const memory = structuredClone(currentReset || !this.receptionEvents.length ? plan.memory : this.receptionMemory);
    if (currentReset) delete memory.stationary;
    const scene = measureReceptionService(rows, plan.scene), nextScene = measureReceptionService(later, scene);
    const first = scene ? receptionServiceCarriers(rows, scene) : [], second = nextScene ? receptionServiceCarriers(later, nextScene) : [];
    const boundary = before.level_epoch !== after.level_epoch, key = command.action_ref;
    const detail: R = { before: before.observation_ref, after: after.observation_ref, command, kind: plan.kind, boundary, matched: null };
    const residual = new ReceptionResidualEvidence();
    for (const event of memory.residual_events) residual.applyEvent(event);
    memory.residual_events.push(...residual.record(before, command, after, rows, later, proposal, index));
    if (!boundary) {
      memory.trials[key] = (memory.trials[key] ?? 0) + 1;
      if (first.length === 1 && second.length === 1) {
        const delta = [second[0]!.anchor[0] - first[0]!.anchor[0], second[0]!.anchor[1] - first[0]!.anchor[1]];
        detail.carrier_delta = delta;
        if (plan.kind === 'control_probe' && delta.filter(value => value !== 0).length === 1 && Math.max(...delta.map(Math.abs)) === scene!.pitch) {
          memory.controls[key] = { delta, evidence: [before.observation_ref, after.observation_ref], status: 'provisional_observed_control' };
        }
        const expected = plan.steps[index].to; detail.matched = expected === null ? null : equal(second[0]!.anchor, expected);
        if (expected !== null && detail.matched === false) memory.refuted.push(detail);
        if (plan.kind === 'reception_observation' && equal(delta, [0, 0])) { memory.stationary ??= {}; memory.stationary[key] = second[0]!.anchor; }
      }
      if (plan.kind === 'reception_observation') memory.wait_spent++;
      if (nextScene) memory.scene = nextScene;
    }
    memory.evidence = [...new Set([...memory.evidence, before.observation_ref, after.observation_ref])];
    const event = structuredClone({ kind: 'observed_reception_service', memory, detail }); this.applyEvent(event); return [event];
  }
}

export function proposeReceptionService(memory: ReceptionServiceMemory, observation: R, rows: NativeRows, inputs: readonly R[], limit: number, config: R): R | null {
  return memory.propose(observation, rows, inputs, limit, config);
}

/**
 * RootedLineAccess's own V6 layer from pinned source
 * 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e. The shared series owner dispatches
 * inherited layers, records them first and retains the single common journal.
 */
import { measureRootedLine, physicalRootedLine, projectedRootedLine } from './v6-rooted-line-observation.ts';
import { rootedLineEffect, planRootedLine } from './v6-rooted-line-mechanics.ts';
import { planCellPush, witnessedCellPush } from './v6-rooted-line-revision.ts';
import { resolveRootedRecovery } from './v6-rooted-line-recovery-operations.ts';
import { admitContactRecoveryNeed, contactRecoveryGraph, contactRecoveryOrder, contactSituation, defaultRecoveryPack,
  evaluateContactStrategy, rootedRecoveryStrategy, type ContactRecoveryNeed } from '../sic/active-recovery.ts';
import { recoveryRevision } from '../sic/recovery-pack.ts';
import { runStrategyAgenda } from '../sic/strategy-agenda.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { pythonEqual as equal, pythonTruthy as truth } from './v6-operations.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import type { NativeRows } from './v6-native-types.ts';
import type { PiercingNativeBudget } from './v5-piercing-plan.ts';

type R = Record<string, any>;
type BeforeMeta = { epoch: number; score: number; observation_ref: string; available: readonly string[] };
type AfterMeta = { epoch: number; score: number; state?: string };
export interface RootedLineState { line_memory: R; line_events: R[] }
export const freshRootedLineMemory = (): R => ({ controls: {}, tried: [], evidence: [], current: null, epoch: null, refuted: [] });

export function rootedLineBefore(proposal: R, index: number, rows: NativeRows, meta: BeforeMeta): R {
  const plan = proposal.rooted_line_plan;
  if (!truth(plan)) throw new TypeError('Rooted line admission requires rooted_line_plan');
  const scene = measureRootedLine(rows);
  let admitted = scene !== null && scene.layout === plan.scene.layout && equal([meta.epoch, meta.score], [plan.epoch, plan.score])
    && equal(proposal.actions, plan.commands) && equal(plan.commands, proposal.bundle_template.actions)
    && proposal.proposal_id === 'rooted-line:' + identity(plan) && meta.available.includes(plan.commands[index].action_ref);
  if (index === 0) admitted = admitted && identity(rows) === plan.frame_digest && meta.observation_ref === plan.observation_ref;
  else admitted = admitted && plan.predictions[index - 1] !== null && equal(physicalRootedLine(scene!), plan.predictions[index - 1]);
  return { admitted: Boolean(admitted), reason: admitted ? 'current_rooted_reference_and_projection' : 'rooted_line_context_changed' };
}

export function rootedLineAfter(proposal: R, index: number, _rows: NativeRows, later: NativeRows, meta: AfterMeta): R {
  const plan = proposal.rooted_line_plan;
  if (!truth(plan)) throw new TypeError('Rooted line outcome requires rooted_line_plan');
  const scene = measureRootedLine(later), boundary = !equal([meta.epoch, meta.score], [plan.epoch, plan.score]), expected = plan.predictions[index];
  const matched = boundary || expected === null || scene === null ? null : equal(physicalRootedLine(scene), expected);
  const need = plan.search?.sic_decision?.needId;
  const status = need ? recoveryStatus(meta.score > plan.score, boundary, matched) : null;
  return { matched, seal_prefix: boundary || matched !== true, reason: matched ? 'rooted_line_projection' : 'rooted_line_unknown_or_refuted',
    ...(need ? { sic_need: { id: need, status } } : {}) };
}

function recoveryStatus(advanced: boolean, boundary: boolean, matched: boolean | null): ContactRecoveryNeed['status'] {
  return advanced ? 'satisfied' : boundary ? 'expired' : matched === true ? 'assigned' : matched === false ? 'refuted' : 'expired';
}

export class RootedLineMemory {
  private lineMemory: R = freshRootedLineMemory();
  private lineEvents: R[] = [];
  private version = 0;
  get nativeRevision(): number { return this.version; }
  get eventCount(): number { return this.lineEvents.length; }
  currentState(): RootedLineState { return structuredClone({ line_memory: this.lineMemory, line_events: this.lineEvents }); }
  retainedDigest(ancestor: string): string { return identity([ancestor, this.lineMemory, this.lineEvents]); }

  applyEvent(event: R): void {
    if (event.kind !== 'observed_rooted_line') throw new TypeError(`Outside rooted-line layer: ${String(event.kind)}`);
    const owned = retainNativeJson(event);
    if (!Object.hasOwn(owned, 'memory')) throw new TypeError('Rooted line event lacks its memory');
    this.version++; this.lineMemory = owned.memory; this.lineEvents.push(owned);
  }

  /** Null delegates to PanelService and its ancestors. Blocking source refusals do not. */
  propose(observation: R, rows: NativeRows, _inputs: readonly R[], limit: number, config: R): R | null {
    const cfg = config.rooted_line_question;
    if (!truth(cfg)) return null;
    const scene = measureRootedLine(rows);
    if (!scene) return null;
    const budget: PiercingNativeBudget = { ...(config.native_rooted_line_work_budget ?? {}),
      ...(typeof config.native_rooted_now === 'function' ? { now: config.native_rooted_now } : {}) };
    if (typeof config.level_deadline === 'number') {
      budget.deadlineMs = Math.min(budget.deadlineMs ?? Infinity, config.level_deadline);
    }
    if ((budget.now ?? (() => performance.now()))() >= (config.level_deadline ?? Infinity)) {
      return { status: 'unknown', reason: 'rooted_line_level_deadline', block_unrelated_probe: true };
    }
    const memory = structuredClone(this.lineMemory);
    if (memory.epoch !== observation.level_epoch) { memory.current = null; memory.tried = []; memory.epoch = observation.level_epoch; }
    const refutations = memory.refuted.filter((item: R) => item.epoch === observation.level_epoch);
    const revision = resolveRootedRecovery(config.sic_recovery ?? defaultRecoveryPack, refutations, scene.layout, observation.observation_ref,
      memory.sic_recovery_need);
    if (revision.status === 'unresolved') {
      return { status: 'unknown', reason: 'conditional_contact_model_refuted', block_unrelated_probe: true };
    }
    const available = new Set<string>(observation.available_action_refs);
    const unmeasured = cfg.probe_order.filter((action: string) => available.has(action)
      && !Object.hasOwn(memory.controls, action) && !memory.tried.includes(action));
    let actions: R[] = [], predictions: (R | null)[] = [], configurations: (R | null)[] = [], search: R | null = null;
    let why: string, kind: string;
    if (revision.status === 'selected' || revision.status === 'shadow') {
      const effects = Object.fromEntries(Object.entries<R>(memory.controls).filter(([action]) => available.has(action)));
      const bounds = revision.configuration;
      const maxDepth = Math.min(bounds.maxDepth, cfg.max_depth, config.remaining_level_actions ?? cfg.max_depth);
      const maxNodes = Math.min(bounds.maxNodes, cfg.max_nodes);
      let visited = 0;
      const timedOut = () => !!budget.shouldStop?.() || (budget.now ?? (() => performance.now()))() >= (budget.deadlineMs ?? Infinity);
      const vertical = new Set(Object.entries(effects).filter(([, effect]) =>
        Math.abs(effect.root_translation[0]) === scene.unit + 2 && effect.root_translation[1] === 0 && effect.extent_delta === 0)
        .map(([action]) => action));
      const controlEvidence = [...vertical].flatMap(action => Array.isArray(effects[action]?.evidence_refs)
        ? effects[action]!.evidence_refs.filter((item: unknown): item is string => typeof item === 'string') : []);
      const situation = contactSituation(revision, observation.observation_ref, controlEvidence);
      const reposition = 'reposition_root_before_contact';
      const agenda = runStrategyAgenda((bounds.strategyOrder ?? contactRecoveryOrder).map(id => ({
        ...evaluateContactStrategy(id, situation), plan: () => limit >= 1
          ? planCellPush(scene, effects, maxDepth, maxNodes - visited, timedOut, {
            allowFirst: id === reposition ? command => vertical.has(command) : undefined,
            visit: () => { visited++; },
          })
          : null,
      })), bounds.mode);
      const receipt = { needId: revision.needId, configuration: bounds, packDigest: recoveryRevision(bounds).digest,
        situation, graph: { id: contactRecoveryGraph.id, version: contactRecoveryGraph.version, order: contactRecoveryGraph.order },
        agenda: agenda.entries, visited };
      if (!agenda.selected) return { status: 'unknown', reason: revision.status === 'shadow' ? 'sic_recovery_shadow' : 'rooted_cell_access_unresolved',
        block_unrelated_probe: true, release_authority: false, recovery_operations: revision.operations,
        recovery_evidence: revision.evidence, sic_decision: receipt };
      const { id: strategy, plan } = agenda.selected;
      actions = [{ action_ref: plan.command }];
      predictions = [plan.prediction];
      configurations = [null];
      search = { operation: 'OP26', predicted_goal_distance: plan.predictedGoalDistance, model: 'conditional_cell_push_after_counterexample',
        recovery_operations: [...revision.operations, { key: 'OP26', finding: `Find a conditional access of ${plan.predictedGoalDistance} moves and check its first command.` }],
        recovery_evidence: revision.evidence,
        sic_decision: { ...receipt, strategy,
          objective: { ...rootedRecoveryStrategy.objective, parent: 'G_official_completion' } } };
      why = strategy === reposition
        ? 'Begin the access with a measured root translation. Verify the root, tip and every piece after this step.'
        : 'Find an ordered access from the measured return using the witnessed whole-cell push. Verify the root, tip and every piece after this step.';
      kind = 'cell_push_revision';
    } else if (unmeasured.length) {
      actions = [{ action_ref: unmeasured[0] }]; predictions = [null]; configurations = [null]; why = cfg.control; kind = 'calibrate';
    } else if (Object.keys(memory.controls).length < cfg.probe_order.filter((action: string) => available.has(action)).length) {
      return { status: 'unknown', reason: 'rooted_control_effect_unresolved', block_unrelated_probe: true };
    } else {
      const bounds = { ...cfg, max_depth: Math.min(cfg.max_depth, config.remaining_level_actions ?? cfg.max_depth) };
      const [, result] = planRootedLine(scene, observation, memory.controls, bounds, memory.current, budget);
      search = { nodes: result.expanded_node_count, truncated: result.truncated, missing: [...result.missing_premise_refs],
        bounds: [...result.exhausted_bound_refs], plans: result.plans.length, conditional_model: cfg.conditional_model,
        kernel: 'V5.piercing_plan.search_piercing_plans' };
      const candidates = result.plans.filter((candidate: R) => candidate.effects.length);
      if (!candidates.length) return { status: 'unknown', reason: 'rooted_contact_plan_unresolved', search, block_unrelated_probe: true };
      let chosen = candidates[0];
      for (const candidate of candidates) if (candidate.effects.length < chosen.effects.length) chosen = candidate;
      const count = Math.min(limit, 16, chosen.effects.length);
      actions = chosen.effects.slice(0, count).map((effect: R) => ({ action_ref: effect.action_ref }));
      predictions = chosen.steps.slice(0, count).map((step: R) => projectedRootedLine(step.configuration));
      configurations = chosen.steps.slice(0, count).map((step: R) => structuredClone(step.configuration));
      why = cfg.compose; kind = 'conditional_composition';
    }
    const plan = structuredClone({ scene, memory, commands: actions, predictions, configurations, search, why, kind,
      epoch: observation.level_epoch, score: observation.levels_completed, observation_ref: observation.observation_ref, frame_digest: identity(rows) });
    const ref = 'rooted-line:' + identity(plan), evidence = [...new Set([...memory.evidence, observation.observation_ref])];
    return { status: 'proposed', kind: 'rooted_line', proposal_id: ref, rooted_line_plan: plan, actions,
      steps: actions.map(action => ({ action, expected_after: null })), facts: { homologous_root_reference_measured: true,
        target_order_is_library_hypothesis: true, conditional_contact_model_not_universal_law: true },
      compositions: [{ id: ref, observed: false, open_question: why, relations: ['contributes_to:G_official_completion'] }],
      question: { reason: why, hypothesis_refs: evidence }, route_refs: evidence,
      binding: { level_epoch: observation.level_epoch, observation_ref: observation.observation_ref },
      bundle_template: { operation_key: 'OP18', composition_ref: ref, objective_ref: 'G_official_completion', purpose: why,
        evidence, preconditions: {}, actions, outcome_guard: { path: ['value'], contains: ref } } };
  }

  /** Shared caller records ancestors first, then this own event exactly once. */
  record(before: R, command: R, after: R, rows: NativeRows, later: NativeRows, proposal: R, index: number): R[] {
    const plan = proposal.rooted_line_plan;
    if (!truth(plan)) return [];
    const memory = structuredClone(this.lineEvents.length ? this.lineMemory : plan.memory);
    const first = measureRootedLine(rows), second = measureRootedLine(later), boundary = before.level_epoch !== after.level_epoch;
    const detail: R = { before: before.observation_ref, after: after.observation_ref, command, boundary, kind: plan.kind, matched: null };
    if (memory.epoch !== before.level_epoch) { memory.epoch = before.level_epoch; memory.current = null; memory.tried = []; }
    if (!boundary && first && second) {
      if (plan.kind === 'calibrate') {
        const effect = rootedLineEffect(command.action_ref, first, second, [before.observation_ref, after.observation_ref]);
        memory.tried.push(command.action_ref);
        if (effect !== null) { memory.controls[command.action_ref] = structuredClone(effect);
          detail.observed_effect = { root_translation: [...effect.root_translation], extent_delta: effect.extent_delta }; }
      } else {
        const matched = equal(physicalRootedLine(second), plan.predictions[index]); detail.matched = matched;
        if (matched) memory.current = plan.configurations[index];
        else {
          memory.current = null;
          const counterexample: R = { epoch: before.level_epoch, before: before.observation_ref,
            after: after.observation_ref, command, expected: plan.predictions[index], observed: physicalRootedLine(second) };
          if (plan.kind === 'conditional_composition'
              && witnessedCellPush(first, second, plan.predictions[index], memory.controls[command.action_ref])) {
            counterexample.cell_push_witness = true;
            counterexample.layout = first.layout;
            const need = admitContactRecoveryNeed({
              before: counterexample.before, after: counterexample.after, layout: first.layout, cell_push_witness: true,
            }, first.layout);
            if (need) memory.sic_recovery_need = need;
          }
          memory.refuted.push(counterexample);
        }
      }
    }
    if (boundary) { memory.current = null; memory.epoch = after.level_epoch; memory.tried = []; }
    const need = memory.sic_recovery_need as ContactRecoveryNeed | undefined;
    if (need && (need.status === 'admitted' || need.status === 'assigned')) {
      const bound = plan.search?.sic_decision?.needId === need.id;
      if (bound) {
        const advanced = Number.isSafeInteger(before.levels_completed) && Number.isSafeInteger(after.levels_completed)
          && after.levels_completed > before.levels_completed;
        const status = recoveryStatus(advanced, boundary, detail.matched);
        memory.sic_recovery_need = { ...need, status, outcomeRef: after.observation_ref };
      } else if (boundary) {
        memory.sic_recovery_need = { ...need, status: 'expired', outcomeRef: after.observation_ref };
      }
    }
    memory.evidence = [...new Set([...memory.evidence, before.observation_ref, after.observation_ref])];
    const event = structuredClone({ kind: 'observed_rooted_line', memory, detail }); this.applyEvent(event); return [event];
  }
}

export function proposeRootedLine(memory: RootedLineMemory, observation: R, rows: NativeRows, inputs: readonly R[], limit: number, config: R): R | null {
  return memory.propose(observation, rows, inputs, limit, config);
}

/** Direct native goal_access_adapter.py; a plan remains distinct from WHY/ACT authority. */
import { GoalAccessMemory, Snapshot, checkAccessBefore, checkAccessAfter, compositionIdentity } from './v6-composition-memory.ts';
import { pythonTruthy as truth } from './v6-operations.ts';
import type { CompositionCommand, CompositionObservation, CompositionRecord, CompositionModel } from './v6-composition-memory.ts';
import type { NativeRows, NativeBox } from './v6-native-types.ts';

type R = CompositionRecord;
export class GoalAccessAdapter {
  readonly memory: GoalAccessMemory;
  constructor(memory: GoalAccessMemory = new GoalAccessMemory()) { this.memory = memory; }
  async propose(observation: CompositionObservation, rows: NativeRows, available: readonly CompositionCommand[], maxPrefix: number): Promise<R> {
    if (!this.memory.models.length) return { status: 'abstained', reason: 'no_scoring_boundary_model_observed_in_session' };
    const route = await this.memory.propose(observation, rows, available, Math.min(16, maxPrefix));
    if (route.status !== 'proposed') return { status: 'abstained', reason: route.status ?? 'no_bound_access' };
    if (route.release_authority !== false || route.observation_ref !== observation.observation_ref || route.epoch !== observation.level_epoch || route.score !== observation.levels_completed) throw new TypeError('Goal access plan has a stale public binding or claims physical authority');
    const prefix = route.prefix;
    if (!(prefix.length >= 1 && prefix.length <= Math.min(16, maxPrefix))) throw new RangeError('Goal access prefix exceeds the committed cap');
    const allowed = new Set(['conditional_translation', 'conditional_observed_access', 'unknown_then_observe']), commands: R[] = [], steps: R[] = [];
    for (const [index, step] of prefix.entries()) {
      const command = { action_ref: step.action_ref };
      if (!available.some(row => row.action_ref === command.action_ref && !truth(row.data))) throw new TypeError('Prepared goal access refers to an unavailable input');
      if (!allowed.has(step.effect) || (index < prefix.length - 1 && step.effect !== 'conditional_translation')) throw new TypeError('An unmeasured or nonlocal effect must seal the prepared prefix');
      const expected = step.effect === 'unknown_then_observe' ? null : { kind: 'local_geometry', effect: step.effect, role: route.role, from: [...step.from], to: [...step.to] };
      commands.push(command); steps.push({ action: command, expected_after: expected, qualification: 'conditional public geometric prediction' });
    }
    const unresolved = prefix[prefix.length - 1].effect === 'unknown_then_observe' || truth(route.test_tentative_control), operation = unresolved ? 'OP18' : 'OP28';
    const planRef = await compositionIdentity(route), composition = `C_goal_access_${planRef.slice(0, 20)}`;
    const purpose = unresolved ? 'Observe the official score and local public response at the proposed contact after the measured approach.' : 'Access the proposed contact through measured local surfaces, comparing the public role support after each command.';
    const evidence = [observation.observation_ref, route.source_boundary, `empirical_model:${route.source_model_ref}`, `committed_access:${planRef}`];
    const comp: R = { id: composition, observed: false, role: 'hypothesized_scoring_or_enabling_composition', things: [route.role],
      properties: { proposed_site: route.site, kind: route.kind, source_model: route.source_model_ref, terminal_site: route.terminal_site, terminal_appearance: route.terminal_appearance,
        possible_effect_families: route.possible_effect_families, causal_terminal_role: 'unknown', falsifiers: route.falsifiers }, relations: ['contributes_to:G_official_completion'] };
    if (unresolved) comp.open_question = purpose;
    const facts = { official_goal_open: true, model_bound_to_current_public_input: true };
    return { status: 'proposed', kind: 'public_goal_access', proposal_id: `goal_access:${planRef}`, goal_access_plan: route, actions: commands, steps, facts, compositions: [comp],
      question: { reason: 'conditional_access_to_scoring_or_enabling_hypothesis', hypothesis_refs: [route.source_model_ref], falsifiers: route.falsifiers, authority_transferred: false }, route_refs: evidence,
      binding: { observation_ref: observation.observation_ref, level_epoch: observation.level_epoch, levels_completed: observation.levels_completed },
      bundle_template: { operation_key: operation, composition_ref: composition, objective_ref: 'G_official_completion', preserve_refs: [], purpose, actions: commands, preconditions: facts, evidence,
        outcome_guard: { path: ['value'], contains: unresolved ? composition : 'B0' } } };
  }
  before(proposal: R, index: number, rows: NativeRows, options: { epoch: number; score: number; available: readonly string[]; observation_ref: string }): { admitted: boolean; reason: string } {
    return checkAccessBefore(proposal.goal_access_plan, index, rows, { ...options, observation_ref: index === 0 ? options.observation_ref : null });
  }
  after(proposal: R, index: number, beforeRows: NativeRows, afterRows: NativeRows, options: { epoch: number; score: number; state: string }): { matched: boolean | null; seal_prefix: boolean; reason: string } {
    return checkAccessAfter(proposal.goal_access_plan, index, beforeRows, afterRows, options);
  }
  record(before: CompositionObservation, beforeRows: NativeRows, command: CompositionCommand, after: CompositionObservation, afterRows: NativeRows, options: { proposal: R; index: number }): Promise<R[]> {
    const selected = options.proposal.goal_access_plan, effect = options.proposal.effect_plan;
    return this.memory.record(before, beforeRows, command, after, afterRows, { plan: selected, action_index: truth(selected) ? options.index : null, scoring_contact: truth(effect) ? [effect, options.index] : null });
  }
  /** Preserve both reusable knowledge and the current episode across native V7 checkpoints. */
  state(): R {
    return structuredClone(this.nativeState());
  }
  /** Native persistence shares only immutable Snapshot rasters and role boxes. */
  nativeState(): R {
    return { ...structuredClone(this.memory.retainedState()),
      episode: this.memory.episode.map(([before, command, after]) => [{ ...before }, command, { ...after }]),
      last: this.memory.last === null ? null : { ...this.memory.last } };
  }
  restore(state: R): void {
    const input = structuredClone(state);
    const snapshot = (value: R) => new Snapshot(value.rows, value.roles as Record<string, NativeBox>, value.epoch, value.score, value.ref, value.frame_hash);
    const episode = (input.episode ?? []).map(([before, command, after]: [R, string, R]) => [snapshot(before), command, snapshot(after)] as const);
    const last = input.last == null ? null : snapshot(input.last);
    this.memory.models = input.models as CompositionModel[]; this.memory.transfers = input.transfers;
    this.memory.tried.clear(); for (const key of input.tried) this.memory.tried.add(key);
    this.memory.refuted.clear(); for (const key of input.refuted) this.memory.refuted.add(key);
    this.memory.effectPoints.clear(); for (const point of input.effect_points) this.memory.effectPoints.set(`${point[0]},${point[1]}`, point);
    for (const key of Object.keys(this.memory.occurrences)) delete this.memory.occurrences[key]; Object.assign(this.memory.occurrences, input.occurrences);
    this.memory.unresolvedReturns = input.unresolved_returns; this.memory.episode = episode; this.memory.last = last;
  }
}

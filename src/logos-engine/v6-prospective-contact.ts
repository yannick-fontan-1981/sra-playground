/** The actual V6 caller's GoalAccessAdapter alias: full prospective contact closure. */
import { GoalAccessAdapter } from './v6-goal-access.ts';
import { GoalAccessMemory } from './v6-composition-memory.ts';
import { PassageOptions } from './v6-passage-options.ts';
import { factoredProposal } from './v6-factored-return.ts';
import type { CompositionRecord as R, CompositionObservation, CompositionCommand } from './v6-composition-memory.ts';
import type { NativeRows } from './v6-native-types.ts';
import type { AccessBeforeMetadata, AccessAfterMetadata, AccessBeforeResult, AccessAfterResult } from './v6-effect-access.ts';

const PRE_SCORE_EVENTS = new Set(['pre_score_effect_contact', 'pre_score_displacement_refuted', 'factored_rewrite_sample', 'factored_rewrite_scored',
  'scored_rewrite_test', 'measured_lattice_steps', 'scored_passage_observation', 'passage_option_result']);
const hasPreScorePlan = (proposal: R): boolean => ['effect_plan', 'factor_plan', 'rewrite_plan', 'passage_plan'].some(key => Object.hasOwn(proposal, key));

export class ContactMemory extends GoalAccessMemory {
  readonly pre_score = new PassageOptions();
  override async applyEvent(event: R): Promise<void> {
    if (PRE_SCORE_EVENTS.has(event.kind)) this.pre_score.applyEvent(event); else await super.applyEvent(event);
  }
  override retainedState(): R { return { ...super.retainedState(), pre_score_digest: this.pre_score.retainedDigest() }; }
}

export class ProspectiveContactAdapter extends GoalAccessAdapter {
  declare readonly memory: ContactMemory;
  constructor() { super(new ContactMemory()); }

  async proposeEffect(observation: CompositionObservation, rows: NativeRows, inputs: readonly CompositionCommand[], remaining: number, config: R): Promise<R> {
    if (this.memory.models.length) return { status: 'abstained', reason: 'terminal_hypothesis_retained' };
    return this.memory.pre_score.propose(this.memory.episode, observation, rows, inputs, Math.min(16, remaining), config);
  }
  proposeFactored(observation: CompositionObservation, inputs: readonly CompositionCommand[], remaining: number): R | null {
    return this.memory.models.length ? null : factoredProposal(this.memory.episode, observation, inputs, Math.min(16, remaining));
  }
  async proposeScoredRewrite(observation: CompositionObservation, rows: NativeRows, inputs: readonly CompositionCommand[], remaining: number, config: R): Promise<R | null> {
    if (this.memory.pre_score.model === null) return null;
    const proposal = await this.memory.pre_score.propose(this.memory.episode, observation, rows, inputs, Math.min(16, remaining), config);
    return proposal.kind === 'public_scored_rewrite' ? proposal : null;
  }
  async proposePassageOptions(observation: CompositionObservation, rows: NativeRows, inputs: readonly CompositionCommand[], remaining: number, config: R): Promise<R | null> {
    if (this.memory.pre_score.scores.length < 2) return null;
    const proposal = await this.memory.pre_score.propose(this.memory.episode, observation, rows, inputs, Math.min(16, remaining), config);
    return proposal.kind === 'public_passage_options' ? proposal : null;
  }
  override before(proposal: R, index: number, rows: NativeRows, metadata: AccessBeforeMetadata): AccessBeforeResult {
    return hasPreScorePlan(proposal) ? this.memory.pre_score.before(proposal, index, rows, metadata) : super.before(proposal, index, rows, metadata);
  }
  override after(proposal: R, index: number, beforeRows: NativeRows, afterRows: NativeRows, metadata: AccessAfterMetadata): AccessAfterResult {
    return hasPreScorePlan(proposal) ? this.memory.pre_score.after(proposal, index, beforeRows, afterRows, metadata) : super.after(proposal, index, beforeRows, afterRows, metadata);
  }
  override async record(before: CompositionObservation, beforeRows: NativeRows, command: CompositionCommand, after: CompositionObservation,
    afterRows: NativeRows, options: { proposal: R; index: number }): Promise<R[]> {
    const events = await super.record(before, beforeRows, command, after, afterRows, options);
    return [...events, ...await this.memory.pre_score.record(before, command, after, beforeRows, afterRows, options.proposal, options.index)];
  }
  override state(): R { return structuredClone({ ...super.state(), pre_score: this.memory.pre_score.state() }); }
  override restore(state: R): void {
    const staged = new PassageOptions(); staged.restore(state.pre_score);
    if (staged.retainedDigest() !== state.pre_score_digest) throw new TypeError('Prospective contact memory digest does not match its nested evidence');
    super.restore(state); this.memory.pre_score.restore(staged.state());
  }
}

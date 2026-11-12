import type { PublicObservationLike } from './linked-preparation.ts';

export interface ObjectBindingFocus {
  target_ref: string;
  binding?: { frame?: unknown };
}

export interface ObjectBindingAttention {
  compositionFor(owner: string, observation: PublicObservationLike): ObjectBindingFocus | null;
  returnComposition(
    owner: string,
    targetRef: string,
    outcome: 'refuted' | 'achieved' | 'boundary',
    evidence: readonly string[],
    observation: PublicObservationLike,
  ): void;
  retainComposition(
    owner: string,
    targetRef: string,
    question: string,
    evidence: readonly string[],
    observation: PublicObservationLike,
    options: { binding: { frame: unknown } },
  ): void;
}

export interface BindingRefutation {
  frame_ref?: string;
  evidence: readonly string[];
}

export interface BindingTrackerLike {
  readonly contextRefutations: readonly BindingRefutation[];
  admitContext(observation: PublicObservationLike, rows: readonly (readonly number[])[]): boolean;
  frameContradiction(frame: unknown, observation: PublicObservationLike, rows: readonly (readonly number[])[]): unknown;
  record(
    before: PublicObservationLike,
    after: PublicObservationLike,
    command: unknown,
    first: readonly (readonly number[])[],
    second: readonly (readonly number[])[],
    proposal?: ObjectBindingProposal | null,
    index?: number,
  ): ObjectBindingEvent | null;
  state(): unknown;
  restore(state: unknown): void;
}

export interface ObjectBindingEvent {
  status?: string;
  frame_ref?: string;
  evidence?: readonly string[];
  [key: string]: unknown;
}

export interface ObjectBindingOffer {
  target: {
    frame: { ref: string; [key: string]: unknown };
    [key: string]: unknown;
  };
  evidence: readonly string[];
  [key: string]: unknown;
}

export interface ObjectBindingProposal {
  binding_plan?: {
    offer: ObjectBindingOffer;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface ObjectBindingContinuityConfig {
  question: string;
  continuity?: {
    retain_selected_frame_until_effect_or_refutation?: boolean;
  };
}

/**
 * Continuity/persistence slice of the V6 ObservedBinding family.
 *
 * This port deliberately excludes geometry, offer ranking and action planning.
 * It preserves the donor's parent-composition lifecycle: reject a stale frame,
 * retain a selected frame while evidence is pending, return achieved on a
 * confirmed reception separation, and close as boundary on official progress.
 */
export class ObservedObjectBindingContinuity {
  readonly owner = 'object_frame_binding';
  private readonly tracker: BindingTrackerLike;
  private readonly attention: ObjectBindingAttention;
  private readonly config: ObjectBindingContinuityConfig;

  constructor(
    tracker: BindingTrackerLike,
    attention: ObjectBindingAttention,
    config: ObjectBindingContinuityConfig,
  ) {
    this.tracker = tracker;
    this.attention = attention;
    this.config = config;
  }

  reconcileBeforeProposal(
    observation: PublicObservationLike,
    rows: readonly (readonly number[])[],
  ): boolean {
    const focus = this.attention.compositionFor(this.owner, observation);
    const admitted = this.tracker.admitContext(observation, rows);
    if (!focus) return admitted;

    const frame = focus.binding?.frame;
    const measured = frame === undefined ? null : this.tracker.frameContradiction(frame, observation, rows);
    const contradictions = this.tracker.contextRefutations
      .filter(event => event.frame_ref === focus.target_ref)
      .map(event => ({ evidence: [...event.evidence] }));

    if (measured) contradictions.push({ evidence: [observation.observation_ref] });
    if (contradictions.length > 0) {
      this.attention.returnComposition(
        this.owner,
        focus.target_ref,
        'refuted',
        [observation.observation_ref, ...contradictions.flatMap(event => event.evidence)],
        observation,
      );
    }
    return admitted;
  }

  record(
    before: PublicObservationLike,
    after: PublicObservationLike,
    command: unknown,
    first: readonly (readonly number[])[],
    second: readonly (readonly number[])[],
    proposal: ObjectBindingProposal | null = null,
    index = 0,
  ): ObjectBindingEvent | null {
    const event = this.tracker.record(before, after, command, first, second, proposal, index);
    const focus = this.attention.compositionFor(this.owner, before);

    if (event?.status === 'reception_confirmed_by_separation' && event.frame_ref && event.evidence) {
      this.attention.returnComposition(this.owner, event.frame_ref, 'achieved', event.evidence, after);
      return event;
    }

    if (before.level_epoch !== after.level_epoch || after.levels_completed > before.levels_completed) {
      if (focus) {
        this.attention.returnComposition(
          this.owner,
          focus.target_ref,
          'boundary',
          [before.observation_ref, after.observation_ref],
          after,
        );
      }
      return event;
    }

    if (
      proposal?.binding_plan
      && this.config.continuity?.retain_selected_frame_until_effect_or_refutation
    ) {
      const plan = proposal.binding_plan.offer;
      const targetRef = plan.target.frame.ref;
      this.attention.retainComposition(
        this.owner,
        targetRef,
        this.config.question,
        [...new Set([...plan.evidence, before.observation_ref, after.observation_ref])],
        after,
        { binding: { frame: structuredClone(plan.target.frame) } },
      );
    }
    return event;
  }

  state(): unknown {
    return this.tracker.state();
  }

  restore(state: unknown): void {
    this.tracker.restore(state);
  }
}

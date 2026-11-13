export interface PublicObservationLike {
  observation_ref: string;
  revision: number;
  level_epoch: number;
  levels_completed: number;
  state: string;
  frame_hash: string;
  available_action_refs: readonly string[];
  entities?: unknown;
  [key: string]: unknown;
}

export interface PublicFrameLike {
  frame_rows: readonly (readonly number[])[];
  level: number;
  levels_completed: number;
  state: string;
  frame_hash: string;
  available_action_refs: readonly string[];
}

export interface LinkedContactLike {
  propose(
    phase: PhaseRelationsLike,
    observation: PublicObservationLike,
    rows: readonly (readonly number[])[],
    inputs: readonly unknown[],
    remaining: number,
  ): Record<string, unknown> | null;
}

export interface PhaseRelationsLike {
  readonly states: unknown;
  readonly linked_contact: LinkedContactLike;
  before(
    proposal: Record<string, unknown>,
    index: number,
    publicFrame: PublicFrameLike,
    observation: PublicObservationLike,
  ): unknown;
  after(
    proposal: Record<string, unknown>,
    index: number,
    before: PublicObservationLike,
    after: PublicObservationLike,
    first: readonly (readonly number[])[],
    second: readonly (readonly number[])[],
  ): unknown;
  record(
    before: PublicObservationLike,
    after: PublicObservationLike,
    command: unknown,
    first: readonly (readonly number[])[],
    second: readonly (readonly number[])[],
  ): readonly unknown[];
  preservation_obligations(
    observation: PublicObservationLike,
    rows: readonly (readonly number[])[],
  ): unknown;
}

export interface ProposalDomainLike {
  bind_proposal(proposal: Record<string, unknown>): void;
}

export type ObservationMeasurer = (
  publicFrame: PublicFrameLike,
  revision: number,
  scope: string,
) => readonly [PublicObservationLike, ...unknown[]];

/**
 * Faithful TypeScript transport adapter for V6 common_linked_preparation.py.
 *
 * This class intentionally owns no temporal inference. PhaseRelations remains
 * the authority for proposal generation, prefix guards, reconciliation and
 * preservation obligations. The adapter only completes public observations,
 * delegates lifecycle calls, records emitted evidence, and remembers official
 * boundaries crossed.
 */
export class LinkedPreparation {
  readonly events: unknown[] = [];
  readonly passed: Array<{ score: number; observation_ref: string }> = [];
  currentObservation: PublicObservationLike | null = null;
  readonly phase: PhaseRelationsLike;
  private readonly measureObservation: ObservationMeasurer;

  constructor(phase: PhaseRelationsLike, measureObservation: ObservationMeasurer) {
    this.phase = phase;
    this.measureObservation = measureObservation;
  }

  fullObservation(
    observation: PublicObservationLike,
    rows: readonly (readonly number[])[],
  ): PublicObservationLike {
    if ('entities' in observation && observation.entities !== undefined) return observation;

    const publicFrame: PublicFrameLike = {
      frame_rows: rows,
      level: observation.level_epoch,
      levels_completed: observation.levels_completed,
      state: observation.state,
      frame_hash: observation.frame_hash,
      available_action_refs: observation.available_action_refs,
    };
    const scope = observation.observation_ref.split(':epoch:')[0] ?? observation.observation_ref;
    return this.measureObservation(publicFrame, observation.revision, scope)[0];
  }

  propose(
    observation: PublicObservationLike,
    rows: readonly (readonly number[])[],
    inputs: readonly unknown[],
    remaining: number,
  ): Record<string, unknown> | null {
    if (!this.phase.states) return null;
    const proposal = this.phase.linked_contact.propose(this.phase, observation, rows, inputs, remaining);
    if (proposal) proposal.linked_preparation_plan = true;
    return proposal;
  }

  bind(proposal: Record<string, unknown>, domain: ProposalDomainLike): void {
    domain.bind_proposal(proposal);
  }

  before(
    proposal: Record<string, unknown>,
    index: number,
    publicFrame: PublicFrameLike,
    observation: PublicObservationLike,
  ): unknown {
    this.currentObservation = this.fullObservation(observation, publicFrame.frame_rows);
    return this.phase.before(proposal, index, publicFrame, this.currentObservation);
  }

  after(
    proposal: Record<string, unknown>,
    index: number,
    before: PublicObservationLike,
    after: PublicObservationLike,
    first: readonly (readonly number[])[],
    second: readonly (readonly number[])[],
  ): unknown {
    const prior = this.fullObservation(before, first);
    this.currentObservation = this.fullObservation(after, second);
    return this.phase.after(proposal, index, prior, this.currentObservation, first, second);
  }

  record(
    before: PublicObservationLike,
    after: PublicObservationLike,
    command: unknown,
    first: readonly (readonly number[])[],
    second: readonly (readonly number[])[],
    _proposal?: Record<string, unknown> | null,
    _index?: number | null,
  ): readonly unknown[] {
    const events = this.phase.record(before, after, command, first, second);
    this.events.push(...events);
    if (after.levels_completed > before.levels_completed) {
      this.passed.push({ score: after.levels_completed, observation_ref: after.observation_ref });
    }
    return events;
  }

  preservationObligations(
    observation: PublicObservationLike,
    rows: readonly (readonly number[])[],
  ): unknown {
    return this.phase.preservation_obligations(observation, rows);
  }
}

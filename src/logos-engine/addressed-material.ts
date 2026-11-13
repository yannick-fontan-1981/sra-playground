import type {
  PublicFrameLike,
  PublicObservationLike,
} from './linked-preparation.ts';

export interface AddressedFieldLike {
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
}

export type FullObservation = (
  observation: PublicObservationLike,
  rows: readonly (readonly number[])[],
) => PublicObservationLike;

/**
 * Neutral observation-completion wrapper for the addressed field/material model.
 *
 * Ported from V6 common_addressed_material.py. AddressedField remains the owner
 * of field learning and proposal semantics; this adapter only guarantees that
 * before/after lifecycle calls receive complete public observations.
 */
export class AddressedMaterial {
  currentObservation: PublicObservationLike | null = null;
  private readonly field: AddressedFieldLike;
  private readonly fullObservation: FullObservation;

  constructor(field: AddressedFieldLike, fullObservation: FullObservation) {
    this.field = field;
    this.fullObservation = fullObservation;
  }

  before(
    proposal: Record<string, unknown>,
    index: number,
    publicFrame: PublicFrameLike,
    observation: PublicObservationLike,
  ): unknown {
    this.currentObservation = this.fullObservation(observation, publicFrame.frame_rows);
    return this.field.before(proposal, index, publicFrame, this.currentObservation);
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
    return this.field.after(proposal, index, prior, this.currentObservation, first, second);
  }
}

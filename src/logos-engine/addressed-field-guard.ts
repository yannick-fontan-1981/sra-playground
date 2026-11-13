import type {
  PublicFrameLike,
  PublicObservationLike,
} from './linked-preparation.ts';

export interface AddressedFieldEntity {
  position: readonly [number, number];
  mask: readonly (readonly [number, number])[];
  palette_value: number;
  bbox: readonly [number, number, number, number];
  [key: string]: unknown;
}

export interface AddressedFieldModel {
  palette: number;
  mask: readonly (readonly [number, number])[];
  exemplar: AddressedFieldEntity;
  goal: { shadow: AddressedFieldEntity };
  [key: string]: unknown;
}

export interface AddressedFieldStep {
  action: { action_ref: string; [key: string]: unknown };
  from: readonly [number, number];
  to: readonly [number, number] | null;
  [key: string]: unknown;
}

export interface AddressedFieldGuardProposal {
  field_plan: {
    model: AddressedFieldModel;
    [key: string]: unknown;
  };
  steps: readonly AddressedFieldStep[];
  binding: {
    observation_ref: string;
    level_epoch: number;
    levels_completed: number;
  };
  [key: string]: unknown;
}

export interface AddressedFieldGuardResult {
  admitted?: boolean;
  matched?: boolean | null;
  seal_prefix?: boolean;
  reason: string;
}

/**
 * Exact non-stock before/after guard slice from V6 common_addressed_field.py.
 *
 * The donor's stock path, fit/record calibration, proposal generation and
 * retained-field reconstruction are intentionally outside this class until
 * their dependencies are recovered and qualified.
 */
export class AddressedFieldGuard {
  static footprintMatches(
    rows: readonly (readonly number[])[],
    model: AddressedFieldModel,
    position: readonly [number, number],
  ): boolean {
    const [x, y] = position;
    return model.mask.every(([dx, dy]) =>
      0 <= y + dy
      && y + dy < rows.length
      && 0 <= x + dx
      && x + dx < (rows[0]?.length ?? 0)
      && rows[y + dy]?.[x + dx] === model.palette
    );
  }

  before(
    proposal: AddressedFieldGuardProposal,
    index: number,
    publicFrame: PublicFrameLike,
    observation: PublicObservationLike,
  ): AddressedFieldGuardResult {
    const plan = proposal.field_plan;
    const model = plan.model;
    const step = proposal.steps[index];
    if (!step) return { admitted: false, reason: 'field_receiver_or_reference_changed' };

    const bound = proposal.binding;
    const known = [model.exemplar, model.goal.shadow].flatMap(entity =>
      entity.mask.map(([dx, dy]) => [
        entity.position[0] + dx,
        entity.position[1] + dy,
        entity.palette_value,
      ] as const)
    );

    const ok = (
      publicFrame.level === bound.level_epoch
      && publicFrame.levels_completed === bound.levels_completed
      && (index > 0 || observation.observation_ref === bound.observation_ref)
      && publicFrame.available_action_refs.includes(step.action.action_ref)
      && AddressedFieldGuard.footprintMatches(publicFrame.frame_rows, model, step.from)
      && known.every(([x, y, value]) => publicFrame.frame_rows[y]?.[x] === value)
    );

    return {
      admitted: Boolean(ok),
      reason: ok ? 'measured_receiver_reference_and_address_bound' : 'field_receiver_or_reference_changed',
    };
  }

  after(
    proposal: AddressedFieldGuardProposal,
    index: number,
    before: PublicObservationLike,
    after: PublicObservationLike,
    _first: readonly (readonly number[])[],
    second: readonly (readonly number[])[],
  ): AddressedFieldGuardResult {
    if (
      before.level_epoch !== after.level_epoch
      || before.levels_completed !== after.levels_completed
      || before.state !== after.state
    ) {
      return { matched: null, seal_prefix: true, reason: 'official_boundary' };
    }

    const step = proposal.steps[index];
    if (!step) {
      return {
        matched: false,
        seal_prefix: true,
        reason: 'compare_stable_receiver_with_frozen_field_prediction',
      };
    }
    const target = step.to;
    const matched = target === null
      ? null
      : AddressedFieldGuard.footprintMatches(second, proposal.field_plan.model, target);

    return {
      matched,
      seal_prefix: matched !== true || index + 1 === proposal.steps.length,
      reason: 'compare_stable_receiver_with_frozen_field_prediction',
    };
  }
}

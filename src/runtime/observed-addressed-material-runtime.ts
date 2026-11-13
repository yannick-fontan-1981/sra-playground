import type { PublicFrameLike, PublicObservationLike } from '../logos-engine/linked-preparation.ts';
import type { FieldStockDependencies, FieldStockProposal, FieldStockProposalResult } from '../logos-engine/field-stock.ts';
import {
  fitAddressedField,
  type ResidualCorrespondencesForFit,
} from '../logos-engine/addressed-field-fit.ts';
import {
  recordAddressedFieldResponse,
  type AddressedFieldResponseDependencies,
  type AddressedFieldResponseModel,
  type AddressedFieldResponseResult,
  type AddressedFieldResponseState,
} from '../logos-engine/addressed-field-response.ts';
import {
  createAddressedFieldRetentionState,
  crossAddressedFieldBoundary,
  ensureFieldStock,
  type AddressedFieldRetentionState,
} from '../logos-engine/addressed-field-retention.ts';

export type AddressedKnowledgeStatus =
  | 'empty'
  | 'active_local_model'
  | 'retained_pending_revalidation'
  | 'revalidated_stock'
  | 'retained_not_applicable'
  | 'refuted';

export interface AddressedReturnLearningDependencies {
  unchanged: AddressedFieldResponseDependencies['unchanged'];
  residualCorrespondences: ResidualCorrespondencesForFit;
}

export type AddressedReturnLearningStatus =
  | 'unaddressed_return'
  | 'official_boundary'
  | 'retained_or_stock_owned'
  | 'field_fit_unresolved'
  | 'field_model_incomplete'
  | 'field_model_acquired'
  | AddressedFieldResponseResult['status'];

export interface AddressedReturnLearningResult {
  status: AddressedReturnLearningStatus;
  events: readonly Record<string, unknown>[];
  responseStatus?: AddressedFieldResponseResult['status'];
  sampleCount: number;
}

function numericPair(value: unknown): value is readonly [number, number] {
  return Array.isArray(value)
    && value.length === 2
    && value.every(item => typeof item === 'number' && Number.isFinite(item));
}

function responseModel(value: unknown): value is AddressedFieldResponseModel {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const model = value as Record<string, unknown>;
  return typeof model.signature === 'string'
    && model.signature.length > 0
    && typeof model.action_ref === 'string'
    && model.action_ref.length > 0
    && numericPair(model.offset)
    && numericPair(model.position);
}

function isAddressedCommand(command: { action_ref: string; data?: Record<string, unknown> }): boolean {
  if (command.action_ref !== 'ACTION6') return false;
  const data = command.data ?? {};
  const keys = Object.keys(data).sort();
  if (keys.length !== 2 || keys[0] !== 'x' || keys[1] !== 'y') return false;
  return [data.x, data.y].every(value =>
    typeof value === 'number'
    && Number.isInteger(value)
    && value >= 0
    && value < 64);
}

function sameOfficialScope(before: PublicObservationLike, after: PublicObservationLike): boolean {
  return before.level_epoch === after.level_epoch
    && before.levels_completed === after.levels_completed
    && before.state === after.state;
}

/**
 * Runtime owner for the retained addressed-field slice.
 *
 * Retention alone never grants action authority. Stock guards and response
 * reconciliation are available only after current-scene revalidation succeeds.
 */
export class ObservedAddressedMaterialRuntime {
  readonly field: AddressedFieldRetentionState = createAddressedFieldRetentionState();

  boundary(before: PublicObservationLike, after: PublicObservationLike): ReturnType<typeof crossAddressedFieldBoundary> {
    return crossAddressedFieldBoundary(this.field, before, after);
  }

  /**
   * Observe one already-authorized public ACTION6 return.
   *
   * This method never proposes an action. It may acquire a local addressed model
   * only from one unique residual movement with a stationary same-signature
   * exemplar and one unique centered target hypothesis. Later correlated returns
   * calibrate or refute that model. A retained prior or active stock always keeps
   * ownership and is never overwritten by this learning path.
   */
  observeAddressedReturn(
    before: PublicObservationLike,
    after: PublicObservationLike,
    command: { action_ref: string; data?: Record<string, unknown> },
    first: readonly (readonly number[])[],
    second: readonly (readonly number[])[],
    frames: readonly (readonly (readonly number[])[])[] | null | undefined,
    dependencies: AddressedReturnLearningDependencies,
  ): AddressedReturnLearningResult {
    if (!isAddressedCommand(command)) {
      return {
        status: 'unaddressed_return',
        events: [],
        sampleCount: this.field.samples.length,
      };
    }
    if (!sameOfficialScope(before, after)) {
      return {
        status: 'official_boundary',
        events: [],
        sampleCount: this.field.samples.length,
      };
    }
    if (this.field.stock || this.field.prior) {
      return {
        status: 'retained_or_stock_owned',
        events: [],
        sampleCount: this.field.samples.length,
      };
    }

    if (this.field.model) {
      if (!responseModel(this.field.model)) {
        return {
          status: 'field_model_incomplete',
          events: [],
          sampleCount: this.field.samples.length,
        };
      }
      const result = recordAddressedFieldResponse(
        this.field as unknown as AddressedFieldResponseState,
        before,
        after,
        command,
        first,
        second,
        dependencies,
      );
      return {
        status: result.status,
        events: structuredClone(result.events),
        responseStatus: result.status,
        sampleCount: this.field.samples.length,
      };
    }

    const fit = fitAddressedField(
      before,
      after,
      command,
      first,
      second,
      frames,
      dependencies.residualCorrespondences,
    );
    if (!fit) {
      return {
        status: 'field_fit_unresolved',
        events: [],
        sampleCount: this.field.samples.length,
      };
    }

    this.field.epoch = before.level_epoch;
    this.field.model = { ...structuredClone(fit.model) };
    this.field.indicator = fit.indicator
      ? { ...structuredClone(fit.indicator) }
      : null;
    const response = recordAddressedFieldResponse(
      this.field as unknown as AddressedFieldResponseState,
      before,
      after,
      command,
      first,
      second,
      dependencies,
    );
    const events = [
      structuredClone(fit.event),
      ...structuredClone(response.events),
    ];
    this.field.events = events;

    return {
      status: response.status === 'field_refuted'
        ? 'field_refuted'
        : 'field_model_acquired',
      events: structuredClone(events),
      responseStatus: response.status,
      sampleCount: this.field.samples.length,
    };
  }

  revalidate(observation: PublicObservationLike, rows: readonly (readonly number[])[]): AddressedKnowledgeStatus {
    if (this.field.stock?.invalid) return 'refuted';
    if (this.field.model) return 'active_local_model';
    if (!this.field.prior) return 'empty';
    const stock = ensureFieldStock(this.field, observation, rows);
    return stock ? 'revalidated_stock' : 'retained_not_applicable';
  }

  proposeStock(
    observation: PublicObservationLike,
    rows: readonly (readonly number[])[],
    remaining: number,
    deps: FieldStockDependencies,
  ): FieldStockProposalResult | null {
    if (!this.field.stock || this.field.stock.invalid) return null;
    return this.field.stock.propose(observation, rows, remaining, deps);
  }

  beforeStock(
    proposal: FieldStockProposal,
    index: number,
    publicFrame: PublicFrameLike,
    observation: PublicObservationLike,
  ): { admitted: boolean; reason: string } {
    if (!this.field.stock || this.field.stock.invalid) {
      return { admitted: false, reason: 'retained_stock_not_revalidated' };
    }
    return this.field.stock.before(proposal, index, publicFrame, observation);
  }

  afterStock(
    proposal: FieldStockProposal,
    index: number,
    before: PublicObservationLike,
    after: PublicObservationLike,
    first: readonly (readonly number[])[],
    second: readonly (readonly number[])[],
  ): { matched: boolean | null; seal_prefix: boolean; reason: string } {
    if (!this.field.stock || this.field.stock.invalid) {
      return { matched: null, seal_prefix: true, reason: 'retained_stock_not_revalidated' };
    }
    return this.field.stock.after(proposal, index, before, after, first, second);
  }

  recordStock(
    before: PublicObservationLike,
    after: PublicObservationLike,
    command: { action_ref: string; data?: Record<string, unknown> },
    first: readonly (readonly number[])[],
    second: readonly (readonly number[])[],
    proposal?: FieldStockProposal | null,
    index?: number | null,
  ) {
    if (!this.field.stock || this.field.stock.invalid) {
      return {
        status: 'retained_stock_not_revalidated' as const,
        events: [] as readonly Record<string, unknown>[],
      };
    }
    return this.field.stock.record(before, after, command, first, second, proposal, index);
  }

  status(): AddressedKnowledgeStatus {
    if (this.field.stock?.invalid) return 'refuted';
    if (this.field.stock) return 'revalidated_stock';
    if (this.field.model) return 'active_local_model';
    if (this.field.prior) return 'retained_pending_revalidation';
    return 'empty';
  }

  mayUseRetainedKnowledge(): boolean {
    return this.status() === 'revalidated_stock';
  }
}
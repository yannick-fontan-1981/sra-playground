import type { PublicFrameLike, PublicObservationLike } from '../logos-engine/linked-preparation.ts';
import type { FieldStockProposal } from '../logos-engine/field-stock.ts';
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

  revalidate(observation: PublicObservationLike, rows: readonly (readonly number[])[]): AddressedKnowledgeStatus {
    if (this.field.stock?.invalid) return 'refuted';
    if (this.field.model) return 'active_local_model';
    if (!this.field.prior) return 'empty';
    const stock = ensureFieldStock(this.field, observation, rows);
    return stock ? 'revalidated_stock' : 'retained_not_applicable';
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

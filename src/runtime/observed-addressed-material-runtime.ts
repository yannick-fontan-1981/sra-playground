import type { PublicObservationLike } from '../logos-engine/linked-preparation.ts';
import { createAddressedFieldRetentionState, crossAddressedFieldBoundary, ensureFieldStock, type AddressedFieldRetentionState } from '../logos-engine/addressed-field-retention.ts';
export type AddressedKnowledgeStatus='empty'|'active_local_model'|'retained_pending_revalidation'|'revalidated_stock'|'retained_not_applicable'|'refuted';
export class ObservedAddressedMaterialRuntime {
  readonly field: AddressedFieldRetentionState=createAddressedFieldRetentionState();
  boundary(before:PublicObservationLike,after:PublicObservationLike){ return crossAddressedFieldBoundary(this.field,before,after); }
  revalidate(observation:PublicObservationLike,rows:readonly (readonly number[])[]):AddressedKnowledgeStatus {
    if(this.field.stock?.invalid) return 'refuted';
    if(this.field.model) return 'active_local_model';
    if(!this.field.prior) return 'empty';
    return ensureFieldStock(this.field,observation,rows)?'revalidated_stock':'retained_not_applicable';
  }
  status():AddressedKnowledgeStatus {
    if(this.field.stock?.invalid) return 'refuted';
    if(this.field.stock) return 'revalidated_stock';
    if(this.field.model) return 'active_local_model';
    if(this.field.prior) return 'retained_pending_revalidation';
    return 'empty';
  }
  mayUseRetainedKnowledge():boolean { return this.status()==='revalidated_stock'; }
}

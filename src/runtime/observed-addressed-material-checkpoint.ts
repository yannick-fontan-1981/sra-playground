import {
  restoreAddressedFieldRetention,
  snapshotAddressedFieldRetention,
} from '../logos-engine/field-stock-snapshot.ts';
import type { CommonCampaignCheckpointParticipant } from '../logos-engine/v6-common-campaign-checkpoint.ts';
import { ObservedAddressedMaterialRuntime } from './observed-addressed-material-runtime.ts';

export const OBSERVED_ADDRESSED_MATERIAL_CHECKPOINT_ID =
  'observed_addressed_material_runtime_v1';

/** Exact state participant for the addressed-material runtime. */
export class ObservedAddressedMaterialCheckpointParticipant
implements CommonCampaignCheckpointParticipant {
  readonly checkpointId = OBSERVED_ADDRESSED_MATERIAL_CHECKPOINT_ID;

  constructor(readonly runtime: ObservedAddressedMaterialRuntime) {}

  snapshot(): unknown {
    return snapshotAddressedFieldRetention(this.runtime.field);
  }

  restore(snapshot: unknown): void {
    restoreAddressedFieldRetention(this.runtime.field, snapshot);
  }
}

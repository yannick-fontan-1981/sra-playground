import { CommonCampaignOwner } from '../logos-engine/v6-common-campaign-owner.ts';
import { FieldStockCallerOwnerAdapter } from '../logos-engine/v6-field-stock-caller-adapter.ts';
import {
  createPublicSmlpAddressedJointChannels,
  publicUniqueSmlpAddressedJointContext,
} from '../logos-engine/v6-public-addressed-joint-channels.ts';
import {
  JOINT_CHANNEL_OWNER_ID,
  JointChannelOwner,
} from '../logos-engine/v6-joint-channel-owner.ts';
import {
  PUBLIC_SINGLE_ACTION_CALLER_OWNER_ID,
  PublicSingleActionCallerOwnerAdapter,
} from '../logos-engine/v6-public-single-action-caller-adapter.ts';
import {
  PUBLIC_UNIQUE_STCK_ACTION6_CALLER_OWNER_ID,
  PublicUniqueStckAction6CallerOwnerAdapter,
} from '../logos-engine/v6-public-unique-stck-action6-caller-adapter.ts';
import { ObservedAddressedMaterialRuntime } from './observed-addressed-material-runtime.ts';
import {
  BrowserCommonCampaignHost,
  BrowserFieldStockCampaignTransport,
  type FieldStockAndPublicSingleActionBrowserCampaignHostOptions,
} from './v6-browser-common-campaign-host.ts';

export interface ProductBrowserCampaignHostOptions
  extends FieldStockAndPublicSingleActionBrowserCampaignHostOptions {}

/**
 * Active product campaign composition.
 *
 * Four owners are peers:
 *
 * - retained FieldStock OP18;
 * - the canonical two-channel SMLP ACTION6 owner, with a stricter unique-target
 *   context in the browser product;
 * - one strict unique-card STCK ACTION6 owner;
 * - the simple public OP28 fallback.
 *
 * CommonCampaignOwner preserves ambiguity whenever more than one independent
 * owner proposes an action. No owner receives an implicit priority.
 */
export function createFieldStockPublicAction6AndPublicSingleActionBrowserCampaignHost(
  options: ProductBrowserCampaignHostOptions = {},
): BrowserCommonCampaignHost {
  const runtime = options.fieldStockRuntime ?? new ObservedAddressedMaterialRuntime();
  const fieldOwner = new FieldStockCallerOwnerAdapter(runtime);
  const smlpJointOwner = new JointChannelOwner(createPublicSmlpAddressedJointChannels());
  const stckAction6Owner = new PublicUniqueStckAction6CallerOwnerAdapter();
  const publicSimpleOwner = new PublicSingleActionCallerOwnerAdapter();
  const fieldTransport = new BrowserFieldStockCampaignTransport({
    runtime,
    dependencies: options.fieldStockDependencies,
    remaining: options.fieldStockRemaining,
  });

  const campaign = new CommonCampaignOwner(
    [fieldOwner, smlpJointOwner, stckAction6Owner, publicSimpleOwner],
    options.campaign,
  );

  return new BrowserCommonCampaignHost({
    campaign,
    eventRef: options.eventRef,
    ownerTransports: [
      fieldTransport,
      {
        ownerId: JOINT_CHANNEL_OWNER_ID,
        context: input => input.gameObservation.gameCode === 'SMLP'
          ? {
              observation: input.agentObservation,
              contextByChannel: publicUniqueSmlpAddressedJointContext(input.agentObservation),
            }
          : undefined,
        returnPayload: input => ({ observation: input.afterAgentObservation }),
      },
      {
        ownerId: PUBLIC_UNIQUE_STCK_ACTION6_CALLER_OWNER_ID,
        context: input => ({
          gameCode: input.gameObservation.gameCode,
          observation: input.agentObservation,
        }),
        returnPayload: input => ({ observation: input.afterAgentObservation }),
      },
      {
        ownerId: PUBLIC_SINGLE_ACTION_CALLER_OWNER_ID,
        context: input => ({ observation: input.agentObservation }),
        returnPayload: input => ({ observation: input.afterAgentObservation }),
      },
    ],
  });
}

/**
 * Compatibility name retained for the controller and existing product tests.
 * The implementation now includes canonical SMLP joint channels and strict
 * STCK ACTION6 ownership in addition to FieldStock and the simple fallback.
 */
export const createFieldStockAndPublicSingleActionBrowserCampaignHost =
  createFieldStockPublicAction6AndPublicSingleActionBrowserCampaignHost;

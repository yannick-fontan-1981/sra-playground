import { CommonCampaignOwner } from '../logos-engine/v6-common-campaign-owner.ts';
import { FieldStockCallerOwnerAdapter } from '../logos-engine/v6-field-stock-caller-adapter.ts';
import {
  PUBLIC_SINGLE_ACTION_CALLER_OWNER_ID,
  PublicSingleActionCallerOwnerAdapter,
} from '../logos-engine/v6-public-single-action-caller-adapter.ts';
import {
  PUBLIC_UNIQUE_ACTION6_CALLER_OWNER_ID,
  PublicUniqueAction6CallerOwnerAdapter,
} from '../logos-engine/v6-public-unique-action6-caller-adapter.ts';
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
 * The three owners are peers: retained FieldStock OP18, strict unique-target
 * ACTION6 OP28 and the simple public OP28 fallback. CommonCampaignOwner keeps
 * multiple simultaneous proposals ambiguous instead of ranking them.
 */
export function createFieldStockPublicAction6AndPublicSingleActionBrowserCampaignHost(
  options: ProductBrowserCampaignHostOptions = {},
): BrowserCommonCampaignHost {
  const runtime = options.fieldStockRuntime ?? new ObservedAddressedMaterialRuntime();
  const fieldOwner = new FieldStockCallerOwnerAdapter(runtime);
  const publicAction6Owner = new PublicUniqueAction6CallerOwnerAdapter();
  const publicSimpleOwner = new PublicSingleActionCallerOwnerAdapter();
  const fieldTransport = new BrowserFieldStockCampaignTransport({
    runtime,
    dependencies: options.fieldStockDependencies,
    remaining: options.fieldStockRemaining,
  });

  const campaign = new CommonCampaignOwner(
    [fieldOwner, publicAction6Owner, publicSimpleOwner],
    options.campaign,
  );

  return new BrowserCommonCampaignHost({
    campaign,
    eventRef: options.eventRef,
    ownerTransports: [
      fieldTransport,
      {
        ownerId: PUBLIC_UNIQUE_ACTION6_CALLER_OWNER_ID,
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
 * The implementation now also includes the strict public unique ACTION6 owner.
 */
export const createFieldStockAndPublicSingleActionBrowserCampaignHost =
  createFieldStockPublicAction6AndPublicSingleActionBrowserCampaignHost;

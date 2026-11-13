import {
  CommonCampaignOwner,
} from '../src/logos-engine/v6-common-campaign-owner.ts';
import {
  JOINT_CHANNEL_OWNER_ID,
  JointChannelOwner,
} from '../src/logos-engine/v6-joint-channel-owner.ts';
import {
  PUBLIC_ACTION_AVAILABILITY_CHANNEL_ID,
  PUBLIC_VISIBLE_TARGET_CHANNEL_ID,
  createPublicSmlpAddressedJointChannels,
  publicSmlpAddressedJointContext,
} from '../src/logos-engine/v6-public-addressed-joint-channels.ts';
import {
  PUBLIC_STCK_ACTION_AVAILABILITY_CHANNEL_ID,
  PUBLIC_STCK_VISIBLE_TARGET_CHANNEL_ID,
  createPublicStckAddressedJointChannels,
  publicStckAddressedJointContext,
} from '../src/logos-engine/v6-public-stck-joint-channels.ts';

function gameContract(game) {
  if (game === 'STCK') {
    return {
      channels: createPublicStckAddressedJointChannels,
      context: publicStckAddressedJointContext,
      channelIds: [
        PUBLIC_STCK_ACTION_AVAILABILITY_CHANNEL_ID,
        PUBLIC_STCK_VISIBLE_TARGET_CHANNEL_ID,
      ],
    };
  }
  if (game === 'SMLP') {
    return {
      channels: createPublicSmlpAddressedJointChannels,
      context: publicSmlpAddressedJointContext,
      channelIds: [
        PUBLIC_ACTION_AVAILABILITY_CHANNEL_ID,
        PUBLIC_VISIBLE_TARGET_CHANNEL_ID,
      ],
    };
  }
  throw new RangeError(`unsupported Lot 9C4 joint-channel game ${String(game)}`);
}

function sameAction(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function acquisitionChannels(receipt) {
  if (!receipt?.routed || receipt.duplicate) {
    throw new Error('Lot 9C4 selected return was not routed exactly once');
  }
  if (!receipt.result || !Array.isArray(receipt.result.channels)) {
    throw new Error('Lot 9C4 selected return has no joint-channel receipt');
  }
  return receipt.result.channels.map(item => item.channelId);
}

/**
 * Create the exact bounded seam measured by Lot 9C4 variant B.
 *
 * The campaign contains one owner only: the already-qualified JointChannelOwner
 * for the requested game. It therefore measures neither FieldStock nor an
 * unrelated fallback owner. Every decision still crosses the neutral common
 * caller, native OP28 release authority and selected-return routing.
 */
export function createOfficialJointChannelSession({
  game,
  sessionId,
  stats,
}) {
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    throw new TypeError('Lot 9C4 sessionId must be non-empty');
  }
  const contract = gameContract(game);
  const owner = new JointChannelOwner(contract.channels());
  const campaign = new CommonCampaignOwner([owner]);
  if (campaign.ownerIds.length !== 1 || campaign.ownerIds[0] !== JOINT_CHANNEL_OWNER_ID) {
    throw new Error('Lot 9C4 benchmark campaign contains an unexpected owner');
  }
  let pendingNeedId;

  return {
    prepare(observation, expectedAction) {
      if (observation.sessionId !== sessionId) {
        throw new Error('Lot 9C4 observation belongs to another session');
      }
      const contextByChannel = contract.context(observation);
      const result = campaign.prepare(observation, {
        [JOINT_CHANNEL_OWNER_ID]: {
          observation,
          contextByChannel,
        },
      });
      if (result.status !== 'action') {
        throw new Error(`Lot 9C4 ${game} joint decision returned ${result.status}`);
      }
      if (result.ownerId !== JOINT_CHANNEL_OWNER_ID) {
        throw new Error('Lot 9C4 decision did not originate from the joint owner');
      }
      if (!sameAction(result.action, expectedAction)) {
        throw new Error(`Lot 9C4 ${game} joint decision differs from the public corpus`);
      }
      pendingNeedId = result.needId;
      if (stats) stats.decisions += 1;
      return result;
    },

    acquire(observation) {
      if (!pendingNeedId) throw new Error('Lot 9C4 return has no pending joint decision');
      if (observation.sessionId !== sessionId) {
        throw new Error('Lot 9C4 return belongs to another session');
      }
      const receipt = campaign.acquire({
        sessionId,
        needId: pendingNeedId,
        eventRef: `lot9c4-return:${sessionId}:${observation.sequence}`,
        payload: { observation },
      });
      const channels = acquisitionChannels(receipt);
      if (JSON.stringify(channels) !== JSON.stringify(contract.channelIds)) {
        throw new Error(`Lot 9C4 ${game} return reached the wrong channels`);
      }
      pendingNeedId = undefined;
      if (stats) stats.acquisitions += 1;
      return { receipt, channels };
    },

    get pending() {
      return pendingNeedId !== undefined;
    },

    get channelIds() {
      return [...contract.channelIds];
    },
  };
}

export function createOfficialJointChannelStats() {
  return {
    STCK: {
      decisions: 0,
      acquisitions: 0,
      targetCycles: 0,
      excludedPreludeActions: 0,
      completedProtocolSessions: 0,
    },
    SMLP: {
      decisions: 0,
      acquisitions: 0,
      targetCycles: 0,
      excludedPreludeActions: 0,
      completedProtocolSessions: 0,
    },
  };
}

export const LOT9C4_JOINT_HOOK_CONTRACT = Object.freeze({
  ownerId: JOINT_CHANNEL_OWNER_ID,
  games: Object.freeze(['STCK', 'SMLP']),
  measuredOwners: Object.freeze([JOINT_CHANNEL_OWNER_ID]),
  decisionPath:
    'public candidate contexts -> JointChannelOwner -> CommonCampaignOwner -> native OP28 release -> exact public corpus action',
  returnPath:
    'returned public observation -> matching pending need -> both contributing channels',
  fieldStockMeasured: false,
  fallbackOwnerMeasured: false,
  modifiesCorpusAction: false,
});

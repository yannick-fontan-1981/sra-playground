import { V6CommonCampaignDecisionPort } from '../src/runtime/v6-common-campaign-decision-port.ts';
import {
  PUBLIC_ACTION_AVAILABILITY_CHANNEL_ID,
  PUBLIC_VISIBLE_TARGET_CHANNEL_ID,
  createPublicSmlpAddressedJointChannels,
  createPublicStckAddressedJointChannels,
  producePublicSmlpGateCandidate,
  producePublicStckTargetCandidate,
  publicSmlpAddressedJointContext,
  publicStckAddressedJointContext,
} from '../src/logos-engine/v6-public-addressed-joint-channels.ts';
import { JOINT_CHANNEL_OWNER_ID } from '../src/logos-engine/v6-joint-channel-owner.ts';

const NEVER_ABORTED = new AbortController().signal;
const MAX_ACTIVE_SESSIONS = 64;

function frameToPixels(frame) {
  if (!Array.isArray(frame) || frame.length !== 64) {
    throw new RangeError('joint-channel benchmark observation frame must be 64x64');
  }
  const pixels = new Uint8Array(64 * 64);
  let offset = 0;
  for (const row of frame) {
    if (!Array.isArray(row) || row.length !== 64) {
      throw new RangeError('joint-channel benchmark observation frame must be 64x64');
    }
    for (const value of row) {
      if (!Number.isInteger(value) || value < 0 || value > 15) {
        throw new RangeError('joint-channel benchmark observation contains invalid palette index');
      }
      pixels[offset++] = value;
    }
  }
  return pixels;
}

function benchmarkSessionRef(descriptor) {
  if (!descriptor || typeof descriptor !== 'object') {
    throw new TypeError('joint-channel benchmark descriptor is required');
  }
  if (!Number.isInteger(descriptor.invocationIndex) || descriptor.invocationIndex < 0) {
    throw new RangeError('joint-channel invocationIndex must be a non-negative integer');
  }
  if (descriptor.game !== 'STCK' && descriptor.game !== 'SMLP') {
    throw new RangeError(`unsupported joint-channel benchmark game ${String(descriptor.game)}`);
  }
  return `native-joint:${descriptor.variant}:${descriptor.game}:${descriptor.invocationIndex}`;
}

function toAgentObservation(observation, descriptor, sequence) {
  if (!observation || typeof observation !== 'object') {
    throw new TypeError('joint-channel benchmark public observation must be an object');
  }
  if (observation.state !== 'NOT_FINISHED' && observation.state !== 'WIN') {
    throw new Error(`unsupported public state ${String(observation.state)}`);
  }
  if (!Array.isArray(observation.availableActionIds)) {
    throw new TypeError('joint-channel observation must expose availableActionIds');
  }
  if (!Number.isInteger(observation.level) || observation.level < 1) {
    throw new RangeError('joint-channel observation level must be positive');
  }
  if (!Number.isInteger(observation.levelsCompleted) || observation.levelsCompleted < 0) {
    throw new RangeError('joint-channel levelsCompleted must be non-negative');
  }
  return {
    protocolVersion: 1,
    sessionId: benchmarkSessionRef(descriptor),
    sequence,
    image: {
      width: 64,
      height: 64,
      pixelFormat: 'palette-index-u8',
      pixels: frameToPixels(observation.frame),
    },
    availableActionIds: [...observation.availableActionIds],
    state: observation.state,
    level: observation.level,
    levelsCompleted: observation.levelsCompleted,
  };
}

function expectedAgentAction(action) {
  if (!action || action.id !== 6) {
    throw new Error('joint-channel benchmark requires an ACTION6 corpus action');
  }
  if (![action.x, action.y].every(value => Number.isInteger(value) && value >= 0 && value < 64)) {
    throw new RangeError('joint-channel benchmark ACTION6 requires x/y in [0,63]');
  }
  return { id: 6, data: { x: action.x, y: action.y } };
}

function sameAction(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function gameContract(game) {
  if (game === 'STCK') {
    return {
      channels: createPublicStckAddressedJointChannels,
      context: publicStckAddressedJointContext,
      candidate: producePublicStckTargetCandidate,
    };
  }
  if (game === 'SMLP') {
    return {
      channels: createPublicSmlpAddressedJointChannels,
      context: publicSmlpAddressedJointContext,
      candidate: producePublicSmlpGateCandidate,
    };
  }
  throw new RangeError(`unsupported joint-channel benchmark game ${String(game)}`);
}

function acquisitionChannelIds(receipt) {
  if (!receipt?.routed || receipt.duplicate || !receipt.result || !Array.isArray(receipt.result.channels)) {
    throw new Error('joint-channel benchmark return was not routed to concrete channels');
  }
  return receipt.result.channels.map(item => item.channelId);
}

/**
 * Real Lot 9C candidate hook used only by benchmark variant B.
 *
 * Each corpus action is independently reconstructed from the public observation
 * by the actual V6 common campaign, the bounded JointChannelOwner and OP28. The
 * hook does not alter the corpus action. It verifies equality, then routes the
 * returned public observation through the same pending need before the next
 * decision. Variant A omits this hook entirely.
 */
export function createJointChannelCandidateHook({ game } = {}) {
  const contract = gameContract(game);
  const sessions = new Map();
  const stats = {
    actionsSeen: 0,
    decisions: 0,
    acquisitions: 0,
    completedSessions: 0,
    stackCardTargets: 0,
    shopButtonTargets: 0,
    smlpGateTargets: 0,
  };

  function stateFor(descriptor, create = false) {
    const key = benchmarkSessionRef(descriptor);
    let state = sessions.get(key);
    if (!state && create) {
      if (sessions.size >= MAX_ACTIVE_SESSIONS) {
        throw new RangeError(`joint-channel active session count exceeds ${MAX_ACTIVE_SESSIONS}`);
      }
      const port = new V6CommonCampaignDecisionPort({
        jointChannels: contract.channels(),
        jointContextByChannel(current) {
          return contract.context(current.agent);
        },
      });
      port.initialize(key, 0);
      state = { key, port, lastIndex: -1 };
      sessions.set(key, state);
    }
    return state;
  }

  return {
    id: 'joint_channels',
    hookInputMode: 'readonly',
    stats,
    get activeSessions() {
      return sessions.size;
    },
    beforeAction({ index, action, observation, descriptor }) {
      stats.actionsSeen += 1;
      const state = stateFor(descriptor, index === 0);
      if (!state) throw new Error('joint-channel benchmark session was not initialized at action zero');
      if (index !== state.lastIndex + 1) {
        throw new Error('joint-channel benchmark action index is not monotonic');
      }

      const current = toAgentObservation(observation, descriptor, index);
      const candidate = contract.candidate(current);
      if (!candidate) {
        throw new Error(`joint-channel ${descriptor.game} producer found no public target at action ${index}`);
      }
      if (candidate.producerId === 'public_stck_stack_shop_target_v1') {
        if (candidate.targetKind === 'stack_card_remove') stats.stackCardTargets += 1;
        else stats.shopButtonTargets += 1;
      } else {
        stats.smlpGateTargets += 1;
      }

      const decision = state.port.decide(current, Number.MAX_SAFE_INTEGER, NEVER_ABORTED);
      const expected = expectedAgentAction(action);
      if (!sameAction(decision, expected)) {
        throw new Error(`joint-channel decision differs from corpus at ${descriptor.game}/${index}`);
      }
      if (state.port.lastPrepare?.status !== 'action'
          || state.port.lastPrepare.ownerId !== JOINT_CHANNEL_OWNER_ID) {
        throw new Error('joint-channel benchmark decision did not originate from the joint owner');
      }
      stats.decisions += 1;
      state.lastIndex = index;
      return {
        status: 'joint-action-verified',
        targetRef: candidate.targetRef,
        action: decision,
      };
    },
    afterAction({ index, observation, descriptor }) {
      const state = stateFor(descriptor);
      if (!state || state.lastIndex !== index) {
        throw new Error('joint-channel benchmark return has no matching decision');
      }
      const returned = toAgentObservation(observation, descriptor, index + 1);
      state.port.observe(returned);
      const channels = acquisitionChannelIds(state.port.lastAcquisition);
      if (JSON.stringify(channels) !== JSON.stringify([
        PUBLIC_ACTION_AVAILABILITY_CHANNEL_ID,
        PUBLIC_VISIBLE_TARGET_CHANNEL_ID,
      ])) {
        throw new Error('joint-channel benchmark return reached the wrong contributors');
      }
      stats.acquisitions += 1;
      if (index + 1 === descriptor.actions) {
        sessions.delete(state.key);
        stats.completedSessions += 1;
      }
      return { status: 'joint-return-acquired', channels };
    },
  };
}

export const JOINT_CHANNEL_BENCHMARK_HOOK_CONTRACT = Object.freeze({
  id: 'joint_channels',
  inputMode: 'readonly',
  games: Object.freeze(['STCK', 'SMLP']),
  channels: Object.freeze([
    PUBLIC_ACTION_AVAILABILITY_CHANNEL_ID,
    PUBLIC_VISIBLE_TARGET_CHANNEL_ID,
  ]),
  decisionPath:
    'public observation -> two game-specific channel contexts -> JointChannelOwner -> CommonCampaignOwner -> OP28 -> exact corpus action',
  returnPath:
    'returned public observation -> pending need acquisition -> both contributing channels',
  modifiesCorpusAction: false,
});

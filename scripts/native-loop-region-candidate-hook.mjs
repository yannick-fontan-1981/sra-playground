import { RegionInterventionOwner } from '../src/logos-engine/v6-region-intervention-owner.ts';
import {
  bindRegionMethod,
  regionPublicEffectEvidence,
} from '../src/logos-engine/v6-region-public-evidence.ts';

function frameToPixels(frame, cache) {
  if (!Array.isArray(frame) || frame.length !== 64) {
    throw new RangeError('Region benchmark observation frame must be 64x64');
  }
  const cached = cache?.get(frame);
  if (cached) return cached;

  const pixels = new Uint8Array(64 * 64);
  let offset = 0;
  for (const row of frame) {
    if (!Array.isArray(row) || row.length !== 64) {
      throw new RangeError('Region benchmark observation frame must be 64x64');
    }
    for (const value of row) {
      if (!Number.isInteger(value) || value < 0 || value > 15) {
        throw new RangeError('Region benchmark observation contains invalid palette index');
      }
      pixels[offset++] = value;
    }
  }
  cache?.set(frame, pixels);
  return pixels;
}

function toAgentObservation(observation, sessionId, sequence, frameCache) {
  if (!observation || typeof observation !== 'object') {
    throw new TypeError('Region benchmark public observation must be an object');
  }
  if (observation.state !== 'NOT_FINISHED' && observation.state !== 'WIN') {
    throw new Error(`Region benchmark does not map unsupported state ${String(observation.state)}`);
  }
  if (!Number.isInteger(observation.level) || observation.level < 1) {
    throw new RangeError('Region benchmark observation level must be a positive integer');
  }
  if (!Number.isInteger(observation.levelsCompleted) || observation.levelsCompleted < 0) {
    throw new RangeError('Region benchmark levelsCompleted must be a non-negative integer');
  }
  if (!Array.isArray(observation.availableActionIds)) {
    throw new TypeError('Region benchmark observation must expose availableActionIds');
  }
  return {
    protocolVersion: 1,
    sessionId,
    sequence,
    image: {
      width: 64,
      height: 64,
      pixelFormat: 'palette-index-u8',
      pixels: frameToPixels(observation.frame, frameCache),
    },
    availableActionIds: [...observation.availableActionIds],
    state: observation.state,
    level: observation.level,
    levelsCompleted: observation.levelsCompleted,
  };
}

function benchmarkSessionRef(descriptor) {
  if (!descriptor || typeof descriptor !== 'object') {
    throw new TypeError('Region benchmark descriptor is required');
  }
  if (!Number.isInteger(descriptor.invocationIndex) || descriptor.invocationIndex < 0) {
    throw new RangeError('Region benchmark invocationIndex must be a non-negative integer');
  }
  return `native-cost:${descriptor.variant}:${descriptor.game}:${descriptor.invocationIndex}`;
}

function identityMethodInput(index, descriptor) {
  return {
    index,
    descriptor: {
      invocationIndex: descriptor.invocationIndex,
      variant: descriptor.variant,
      game: descriptor.game,
    },
  };
}

/**
 * Bind the real reconstructed Region evidence path to a benchmark candidate hook.
 *
 * methodRefFor is deliberately external: Region must not invent reusable-method
 * identity from pixel similarity. If it returns undefined, ACTION6 evidence is
 * observed but not admitted into Region state.
 *
 * `methodRefInput: 'identity'` is reserved for producers whose identity depends
 * only on action/session coordinates. It avoids cloning two complete public
 * frames and the complete delta merely to return that external identity.
 */
export function createRegionInterventionCandidateHook({
  methodRefFor,
  methodRefInput = 'full',
  cacheFrames = false,
  owner = new RegionInterventionOwner(),
} = {}) {
  if (methodRefFor !== undefined && typeof methodRefFor !== 'function') {
    throw new TypeError('methodRefFor must be a function when provided');
  }
  if (methodRefInput !== 'full' && methodRefInput !== 'identity') {
    throw new TypeError("methodRefInput must be 'full' or 'identity'");
  }
  if (typeof cacheFrames !== 'boolean') {
    throw new TypeError('cacheFrames must be a boolean');
  }
  if (!(owner instanceof RegionInterventionOwner)) {
    throw new TypeError('owner must be a RegionInterventionOwner');
  }

  const frameCache = cacheFrames ? new WeakMap() : undefined;
  const stats = {
    actionsSeen: 0,
    action6Seen: 0,
    usefulAction6Evidence: 0,
    boundEvidence: 0,
    acquisitions: 0,
  };

  return {
    id: 'region_intervention',
    owner,
    stats,
    beforeAction({ action }) {
      stats.actionsSeen += 1;
      if (action?.id === 6) stats.action6Seen += 1;
    },
    async afterAction({ index, action, beforeObservation, observation, descriptor }) {
      if (action?.id !== 6) return { status: 'not-applicable' };

      const sessionId = benchmarkSessionRef(descriptor);
      const before = toAgentObservation(beforeObservation, sessionId, index, frameCache);
      const after = toAgentObservation(observation, sessionId, index + 1, frameCache);
      const normalizedAction = {
        id: 6,
        data: {
          x: action.x,
          y: action.y,
        },
      };
      const evidence = regionPublicEffectEvidence(normalizedAction, before, after);
      if (!evidence || !evidence.useful) return { status: 'no-useful-effect' };
      stats.usefulAction6Evidence += 1;

      const methodRef = methodRefFor
        ? await methodRefFor(methodRefInput === 'identity'
            ? identityMethodInput(index, descriptor)
            : {
                index,
                action: structuredClone(action),
                beforeObservation: structuredClone(beforeObservation),
                observation: structuredClone(observation),
                descriptor: structuredClone(descriptor),
                evidence: structuredClone(evidence),
              })
        : undefined;

      if (methodRef === undefined) return { status: 'unbound-method' };
      if (typeof methodRef !== 'string' || methodRef.length === 0) {
        throw new TypeError('methodRefFor must return a non-empty string or undefined');
      }

      const bound = bindRegionMethod(evidence, methodRef);
      if (!bound) return { status: 'no-bindable-evidence' };
      stats.boundEvidence += 1;
      const receipt = owner.acquire({
        eventRef: `${sessionId}:action:${index + 1}`,
        source: 'passive',
        observation: bound,
      });
      if (receipt.acquired) stats.acquisitions += 1;
      return { status: receipt.status ?? 'duplicate', receipt };
    },
  };
}

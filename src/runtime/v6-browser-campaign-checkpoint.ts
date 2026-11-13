import type { AgentObservation } from './contracts.ts';
import type { GameObservation } from './browser-games.ts';
import { toAgentObservationFromGame } from './v6-browser-agent-observation.ts';
import { digestPublicValue } from './v6-public-observation-measurement.ts';
import type {
  CampaignPrepareResult,
} from '../logos-engine/v6-common-campaign-owner.ts';
import type {
  CommonCampaignCheckpointV1,
} from '../logos-engine/v6-common-campaign-checkpoint.ts';

export type BrowserCheckpointActionPreparation = Extract<
  CampaignPrepareResult,
  { status: 'action' }
>;

export interface BrowserCampaignDispatchedReturnCheckpointV1 {
  version: 1;
  stage: 'dispatched';
  preparation: BrowserCheckpointActionPreparation;
  beforeGameObservation: GameObservation;
  beforeAgentObservation: AgentObservation;
}

export interface BrowserCampaignSessionCheckpointV1 {
  version: 1;
  sessionId: string;
  gameCode: string;
  nextSequence: number;
  observationIdentity: string;
  gameObservation: GameObservation;
  agentObservation: AgentObservation;
  pendingReturn: BrowserCampaignDispatchedReturnCheckpointV1 | null;
}

export interface BrowserCommonCampaignHostCheckpointV1 {
  version: 1;
  common: CommonCampaignCheckpointV1;
  session: BrowserCampaignSessionCheckpointV1 | null;
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function nonEmpty(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
}

function nonNegativeInteger(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative integer`);
  }
}

export function cloneBrowserGameObservation(observation: GameObservation): GameObservation {
  return structuredClone(observation);
}

export function cloneBrowserAgentObservation(observation: AgentObservation): AgentObservation {
  return {
    ...observation,
    image: {
      ...observation.image,
      pixels: Uint8Array.from(observation.image.pixels),
    },
    availableActionIds: [...observation.availableActionIds],
  };
}

export function browserGameObservationIdentity(observation: GameObservation): string {
  return `browser-game-observation:${digestPublicValue(observation)}`;
}

export function sameBrowserGameObservation(
  left: GameObservation,
  right: GameObservation,
): boolean {
  return browserGameObservationIdentity(left) === browserGameObservationIdentity(right);
}

function validateAgentBinding(
  gameObservation: GameObservation,
  agentObservation: AgentObservation,
  sessionId: string,
): void {
  const expected = toAgentObservationFromGame(
    gameObservation,
    sessionId,
    agentObservation.sequence,
  );
  if (digestPublicValue(expected) !== digestPublicValue(agentObservation)) {
    throw new Error('browser campaign checkpoint agent observation does not match its game observation');
  }
}

function parsePendingReturn(
  value: unknown,
  session: {
    sessionId: string;
    gameObservation: GameObservation;
    agentObservation: AgentObservation;
  },
): BrowserCampaignDispatchedReturnCheckpointV1 | null {
  if (value === null) return null;
  const pending = object(value, 'browser campaign pending return');
  if (pending.version !== 1 || pending.stage !== 'dispatched') {
    throw new TypeError('unsupported browser campaign pending return checkpoint');
  }
  const preparation = object(
    pending.preparation,
    'browser campaign pending preparation',
  ) as unknown as BrowserCheckpointActionPreparation;
  if (
    preparation.status !== 'action'
    || typeof preparation.needId !== 'string'
    || preparation.needId.length === 0
    || typeof preparation.ownerId !== 'string'
    || preparation.ownerId.length === 0
    || typeof preparation.proposalRef !== 'string'
    || preparation.proposalRef.length === 0
  ) {
    throw new TypeError('browser campaign pending preparation must be an action');
  }

  const beforeGameObservation = structuredClone(
    object(pending.beforeGameObservation, 'browser campaign pending game observation'),
  ) as unknown as GameObservation;
  const beforeAgentObservation = cloneBrowserAgentObservation(
    object(pending.beforeAgentObservation, 'browser campaign pending agent observation')
      as unknown as AgentObservation,
  );
  if (!sameBrowserGameObservation(beforeGameObservation, session.gameObservation)) {
    throw new Error('browser campaign pending return is bound to another game observation');
  }
  if (digestPublicValue(beforeAgentObservation) !== digestPublicValue(session.agentObservation)) {
    throw new Error('browser campaign pending return is bound to another agent observation');
  }
  if (beforeAgentObservation.sessionId !== session.sessionId) {
    throw new Error('browser campaign pending return belongs to another session');
  }

  return {
    version: 1,
    stage: 'dispatched',
    preparation: structuredClone(preparation),
    beforeGameObservation,
    beforeAgentObservation,
  };
}

export function parseBrowserCommonCampaignHostCheckpoint(
  value: unknown,
): BrowserCommonCampaignHostCheckpointV1 {
  const checkpoint = object(value, 'browser campaign host checkpoint');
  if (checkpoint.version !== 1) {
    throw new TypeError('unsupported browser campaign host checkpoint version');
  }
  const common = structuredClone(
    object(checkpoint.common, 'browser campaign common checkpoint'),
  ) as unknown as CommonCampaignCheckpointV1;
  if (checkpoint.session === null) {
    return { version: 1, common, session: null };
  }

  const rawSession = object(checkpoint.session, 'browser campaign session checkpoint');
  if (rawSession.version !== 1) {
    throw new TypeError('unsupported browser campaign session checkpoint version');
  }
  nonEmpty(rawSession.sessionId, 'browser campaign checkpoint sessionId');
  nonEmpty(rawSession.gameCode, 'browser campaign checkpoint gameCode');
  nonEmpty(rawSession.observationIdentity, 'browser campaign checkpoint observation identity');
  nonNegativeInteger(rawSession.nextSequence, 'browser campaign checkpoint nextSequence');

  const gameObservation = structuredClone(
    object(rawSession.gameObservation, 'browser campaign checkpoint game observation'),
  ) as unknown as GameObservation;
  const agentObservation = cloneBrowserAgentObservation(
    object(rawSession.agentObservation, 'browser campaign checkpoint agent observation')
      as unknown as AgentObservation,
  );
  if (gameObservation.gameCode !== rawSession.gameCode) {
    throw new Error('browser campaign checkpoint game code changed');
  }
  if (agentObservation.sessionId !== rawSession.sessionId) {
    throw new Error('browser campaign checkpoint agent session changed');
  }
  if (rawSession.nextSequence !== agentObservation.sequence + 1) {
    throw new Error('browser campaign checkpoint sequence is not contiguous');
  }
  if (browserGameObservationIdentity(gameObservation) !== rawSession.observationIdentity) {
    throw new Error('browser campaign checkpoint observation identity changed');
  }
  validateAgentBinding(gameObservation, agentObservation, rawSession.sessionId);

  const session = {
    version: 1 as const,
    sessionId: rawSession.sessionId,
    gameCode: rawSession.gameCode,
    nextSequence: rawSession.nextSequence,
    observationIdentity: rawSession.observationIdentity,
    gameObservation,
    agentObservation,
    pendingReturn: null,
  };
  session.pendingReturn = parsePendingReturn(rawSession.pendingReturn, session);

  const pending = common.campaign?.pending ?? [];
  const matching = pending.filter(item => item.sessionId === session.sessionId);
  if (session.pendingReturn) {
    if (matching.length !== 1) {
      throw new Error('browser campaign dispatched return requires one pending campaign need');
    }
    const need = matching[0]!;
    if (
      need.needId !== session.pendingReturn.preparation.needId
      || need.selected.ownerId !== session.pendingReturn.preparation.ownerId
      || need.selected.proposalRef !== session.pendingReturn.preparation.proposalRef
    ) {
      throw new Error('browser campaign pending need identity changed');
    }
  } else if (matching.length !== 0) {
    throw new Error('browser campaign checkpoint has a pending need without dispatch metadata');
  }

  return { version: 1, common, session };
}

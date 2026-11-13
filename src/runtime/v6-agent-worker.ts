import { V6CommonCampaignDecisionPort } from './v6-common-campaign-decision-port.ts';
import {
  PROTOCOL_VERSION,
  type AgentObservation,
  type AgentWorkerRequest,
  type AgentWorkerResponse,
} from './contracts.ts';
import { AgentWorkerCore, type AgentDecisionPort } from './v6-agent-worker-core.ts';

export const AGENT_WORKER_IMPLEMENTATION_REVISION = 'reconstruction-common-campaign-op18-op28';

export interface AgentWorkerScope {
  addEventListener(type: 'message', callback: (event: MessageEvent<unknown>) => void): void;
  postMessage(message: AgentWorkerResponse): void;
}

export class PendingPerceptionDecisionPort implements AgentDecisionPort {
  decide(): undefined {
    return undefined;
  }
}

function isObservation(value: unknown): value is AgentObservation {
  if (!value || typeof value !== 'object') return false;
  const observation = value as Record<string, unknown>;
  if (observation.protocolVersion !== PROTOCOL_VERSION) return false;
  if (typeof observation.sessionId !== 'string' || observation.sessionId.length === 0) return false;
  if (typeof observation.sequence !== 'number' || !Number.isInteger(observation.sequence) || observation.sequence < 0) return false;
  if (observation.state !== 'NOT_FINISHED' && observation.state !== 'WIN') return false;
  if (typeof observation.level !== 'number' || !Number.isInteger(observation.level)) return false;
  if (typeof observation.levelsCompleted !== 'number' || !Number.isInteger(observation.levelsCompleted)) return false;
  if (!Array.isArray(observation.availableActionIds)) return false;
  if (!observation.availableActionIds.every(id => typeof id === 'number' && Number.isInteger(id) && id >= 0 && id <= 7)) return false;

  if (!observation.image || typeof observation.image !== 'object') return false;
  const image = observation.image as Record<string, unknown>;
  if (image.width !== 64 || image.height !== 64 || image.pixelFormat !== 'palette-index-u8') return false;
  if (!(image.pixels instanceof Uint8Array) || image.pixels.length !== 64 * 64) return false;
  return true;
}

export function isAgentWorkerRequest(value: unknown): value is AgentWorkerRequest {
  if (!value || typeof value !== 'object') return false;
  const request = value as Record<string, unknown>;
  if (request.type === 'initialize') {
    return request.protocolVersion === PROTOCOL_VERSION
      && typeof request.sessionId === 'string'
      && request.sessionId.length > 0
      && typeof request.seed === 'number'
      && Number.isInteger(request.seed);
  }
  if (request.type === 'cancel') {
    return typeof request.sessionId === 'string' && request.sessionId.length > 0;
  }
  if (request.type === 'observe') {
    return isObservation(request.observation)
      && typeof request.budgetMs === 'number'
      && Number.isFinite(request.budgetMs);
  }
  return false;
}

function sessionIdFrom(value: unknown): string {
  if (!value || typeof value !== 'object') return 'unknown';
  const request = value as Record<string, unknown>;
  if (typeof request.sessionId === 'string' && request.sessionId) return request.sessionId;
  if (request.observation && typeof request.observation === 'object') {
    const observation = request.observation as Record<string, unknown>;
    if (typeof observation.sessionId === 'string' && observation.sessionId) return observation.sessionId;
  }
  return 'unknown';
}

export function installAgentWorker(
  scope: AgentWorkerScope,
  core: AgentWorkerCore = new AgentWorkerCore(
    new V6CommonCampaignDecisionPort(),
    { implementationRevision: AGENT_WORKER_IMPLEMENTATION_REVISION },
  ),
): void {
  scope.addEventListener('message', event => {
    const request = event.data;
    if (!isAgentWorkerRequest(request)) {
      scope.postMessage({
        type: 'error',
        sessionId: sessionIdFrom(request),
        message: 'Invalid agent worker request.',
      });
      return;
    }

    void core.handle(request)
      .then(response => scope.postMessage(response))
      .catch(error => scope.postMessage({
        type: 'error',
        sessionId: sessionIdFrom(request),
        message: error instanceof Error ? error.message : 'Agent worker failed.',
      }));
  });
}

const possibleWorkerScope = globalThis as unknown as AgentWorkerScope & { importScripts?: unknown };
if (typeof possibleWorkerScope.importScripts === 'function') {
  installAgentWorker(possibleWorkerScope);
}

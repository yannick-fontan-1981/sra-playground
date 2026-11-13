import type { AgentAction, AgentObservation, AgentWorkerResponse } from '../../src/runtime/contracts.ts';
import type { AgentWorkerCore } from '../../src/runtime/v6-agent-worker-core.ts';

export interface LiveCampaignGamePort {
  initialObservation(): AgentObservation | Promise<AgentObservation>;
  action(action: AgentAction): AgentObservation | Promise<AgentObservation>;
}

export interface LiveCampaignOptions {
  sessionId: string;
  seed: number;
  budgetMs: number;
  maxSteps: number;
}

export interface LiveCampaignStep {
  sequence: number;
  response: AgentWorkerResponse;
  action?: AgentAction;
}

export interface LiveCampaignResult {
  status: 'complete' | 'stopped' | 'max_steps' | 'error';
  reason?: string;
  actionsExecuted: number;
  finalObservation: AgentObservation;
  steps: LiveCampaignStep[];
}

function validateOptions(options: LiveCampaignOptions): void {
  if (!options.sessionId) throw new TypeError('sessionId must be non-empty');
  if (!Number.isInteger(options.seed)) throw new RangeError('seed must be an integer');
  if (!Number.isFinite(options.budgetMs) || options.budgetMs <= 0) throw new RangeError('budgetMs must be positive');
  if (!Number.isInteger(options.maxSteps) || options.maxSteps < 1 || options.maxSteps > 4096) {
    throw new RangeError('maxSteps must be an integer in [1, 4096]');
  }
}

function validateObservationIdentity(observation: AgentObservation, options: LiveCampaignOptions): void {
  if (observation.sessionId !== options.sessionId) {
    throw new Error('campaign observation session does not match requested session');
  }
}

export async function runLiveGameCampaign(
  game: LiveCampaignGamePort,
  worker: AgentWorkerCore,
  options: LiveCampaignOptions,
): Promise<LiveCampaignResult> {
  validateOptions(options);
  const ready = await worker.handle({
    type: 'initialize',
    protocolVersion: 1,
    sessionId: options.sessionId,
    seed: options.seed,
  });
  if (ready.type !== 'ready') {
    throw new Error(ready.type === 'error' ? ready.message : 'worker did not initialize');
  }

  let observation = await game.initialObservation();
  validateObservationIdentity(observation, options);
  const steps: LiveCampaignStep[] = [];
  let actionsExecuted = 0;

  while (actionsExecuted < options.maxSteps) {
    const response = await worker.handle({
      type: 'observe',
      observation,
      budgetMs: options.budgetMs,
    });
    const step: LiveCampaignStep = { sequence: observation.sequence, response };
    steps.push(step);

    if (response.type === 'action') {
      step.action = structuredClone(response.action);
      const previousSequence = observation.sequence;
      observation = await game.action(response.action);
      validateObservationIdentity(observation, options);
      if (observation.sequence <= previousSequence) {
        throw new Error('campaign game observation sequence did not advance');
      }
      actionsExecuted += 1;
      continue;
    }

    if (response.type === 'stopped') {
      return {
        status: response.reason === 'complete' ? 'complete' : 'stopped',
        reason: response.reason,
        actionsExecuted,
        finalObservation: observation,
        steps,
      };
    }

    return {
      status: 'error',
      reason: response.message,
      actionsExecuted,
      finalObservation: observation,
      steps,
    };
  }

  return {
    status: 'max_steps',
    reason: 'maximum campaign steps reached',
    actionsExecuted,
    finalObservation: observation,
    steps,
  };
}

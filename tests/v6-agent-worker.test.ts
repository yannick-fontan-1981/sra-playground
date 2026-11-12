import assert from 'node:assert/strict';
import test from 'node:test';
import { PROTOCOL_VERSION, type AgentObservation, type AgentWorkerResponse } from '../src/runtime/contracts.ts';
import { installAgentWorker, isAgentWorkerRequest } from '../src/runtime/v6-agent-worker.ts';

function observation(overrides: Partial<AgentObservation> = {}): AgentObservation {
  return {
    protocolVersion: PROTOCOL_VERSION,
    sessionId: 'session-1',
    sequence: 0,
    image: { width: 64, height: 64, pixelFormat: 'palette-index-u8', pixels: new Uint8Array(64 * 64) },
    availableActionIds: [1, 6],
    state: 'NOT_FINISHED',
    level: 1,
    levelsCompleted: 0,
    ...overrides,
  };
}

class FakeScope {
  listener: ((event: MessageEvent<unknown>) => void) | undefined;
  messages: AgentWorkerResponse[] = [];
  addEventListener(_type: 'message', callback: (event: MessageEvent<unknown>) => void) { this.listener = callback; }
  postMessage(message: AgentWorkerResponse) { this.messages.push(message); }
  emit(data: unknown) { this.listener?.({ data } as MessageEvent<unknown>); }
}

async function flush() {
  await new Promise(resolve => setTimeout(resolve, 0));
}

test('runtime request validation accepts exact public protocol shapes', () => {
  assert.equal(isAgentWorkerRequest({ type: 'initialize', protocolVersion: 1, sessionId: 's', seed: 1 }), true);
  assert.equal(isAgentWorkerRequest({ type: 'cancel', sessionId: 's' }), true);
  assert.equal(isAgentWorkerRequest({ type: 'observe', observation: observation(), budgetMs: 20 }), true);
});

test('runtime request validation rejects malformed observation pixels', () => {
  const invalid = observation();
  invalid.image = { ...invalid.image, pixels: new Uint8Array(3) };
  assert.equal(isAgentWorkerRequest({ type: 'observe', observation: invalid, budgetMs: 20 }), false);
});

test('invalid worker request yields explicit error response', () => {
  const scope = new FakeScope();
  installAgentWorker(scope);
  scope.emit({ type: 'observe', budgetMs: 1 });
  assert.deepEqual(scope.messages, [{
    type: 'error',
    sessionId: 'unknown',
    message: 'Invalid agent worker request.',
  }]);
});

test('default worker announces pending-perception revision and takes no invented action', async () => {
  const scope = new FakeScope();
  installAgentWorker(scope);
  scope.emit({ type: 'initialize', protocolVersion: 1, sessionId: 'session-1', seed: 4 });
  await flush();
  assert.deepEqual(scope.messages[0], {
    type: 'ready',
    sessionId: 'session-1',
    implementationRevision: 'reconstruction-pending-perception',
  });

  scope.emit({ type: 'observe', observation: observation(), budgetMs: 20 });
  await flush();
  assert.deepEqual(scope.messages[1], {
    type: 'stopped',
    sessionId: 'session-1',
    reason: 'budget',
  });
});

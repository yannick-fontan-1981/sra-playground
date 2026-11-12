import assert from 'node:assert/strict';
import test from 'node:test';
import { PROTOCOL_VERSION, type AgentAction, type AgentObservation } from '../src/runtime/contracts.ts';
import { AgentWorkerCore, type AgentDecisionPort } from '../src/runtime/v6-agent-worker-core.ts';

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

class Port implements AgentDecisionPort {
  initialized: Array<[string, number]> = [];
  cancelled: string[] = [];
  decision: AgentAction | undefined = { id: 1 };
  async initialize(sessionId: string, seed: number) { this.initialized.push([sessionId, seed]); }
  decide(): AgentAction | undefined { return this.decision; }
  cancel(sessionId: string) { this.cancelled.push(sessionId); }
}

test('initialize establishes session and reports implementation revision', async () => {
  const port = new Port();
  const core = new AgentWorkerCore(port, { implementationRevision: 'test-rev' });
  assert.deepEqual(await core.handle({ type: 'initialize', protocolVersion: 1, sessionId: 'session-1', seed: 7 }), {
    type: 'ready', sessionId: 'session-1', implementationRevision: 'test-rev',
  });
  assert.deepEqual(port.initialized, [['session-1', 7]]);
});

test('observation before initialize is rejected', async () => {
  const core = new AgentWorkerCore(new Port(), { implementationRevision: 'test-rev' });
  const result = await core.handle({ type: 'observe', observation: observation(), budgetMs: 10 });
  assert.equal(result.type, 'error');
});

test('valid decision returns an available action with matching sequence', async () => {
  const core = new AgentWorkerCore(new Port(), { implementationRevision: 'test-rev' });
  await core.handle({ type: 'initialize', protocolVersion: 1, sessionId: 'session-1', seed: 1 });
  assert.deepEqual(await core.handle({ type: 'observe', observation: observation({ sequence: 3 }), budgetMs: 50 }), {
    type: 'action', sessionId: 'session-1', sequence: 3, action: { id: 1 },
  });
});

test('sequence must increase monotonically', async () => {
  const core = new AgentWorkerCore(new Port(), { implementationRevision: 'test-rev' });
  await core.handle({ type: 'initialize', protocolVersion: 1, sessionId: 'session-1', seed: 1 });
  await core.handle({ type: 'observe', observation: observation({ sequence: 4 }), budgetMs: 50 });
  const repeated = await core.handle({ type: 'observe', observation: observation({ sequence: 4 }), budgetMs: 50 });
  assert.equal(repeated.type, 'error');
});

test('WIN observation stops complete without asking decision port', async () => {
  const port = new Port();
  let calls = 0;
  port.decide = () => { calls += 1; return { id: 1 }; };
  const core = new AgentWorkerCore(port, { implementationRevision: 'test-rev' });
  await core.handle({ type: 'initialize', protocolVersion: 1, sessionId: 'session-1', seed: 1 });
  assert.deepEqual(await core.handle({ type: 'observe', observation: observation({ state: 'WIN' }), budgetMs: 50 }), {
    type: 'stopped', sessionId: 'session-1', reason: 'complete',
  });
  assert.equal(calls, 0);
});

test('non-positive budget stops without decision', async () => {
  const core = new AgentWorkerCore(new Port(), { implementationRevision: 'test-rev' });
  await core.handle({ type: 'initialize', protocolVersion: 1, sessionId: 'session-1', seed: 1 });
  assert.deepEqual(await core.handle({ type: 'observe', observation: observation(), budgetMs: 0 }), {
    type: 'stopped', sessionId: 'session-1', reason: 'budget',
  });
});

test('invalid or unavailable decisions are rejected', async () => {
  const invalid = new Port();
  invalid.decision = { id: 7 };
  const core = new AgentWorkerCore(invalid, { implementationRevision: 'test-rev' });
  await core.handle({ type: 'initialize', protocolVersion: 1, sessionId: 'session-1', seed: 1 });
  const unavailable = await core.handle({ type: 'observe', observation: observation(), budgetMs: 50 });
  assert.equal(unavailable.type, 'error');
  assert.match(unavailable.type === 'error' ? unavailable.message : '', /unavailable/);
});

test('timer budget aborts a pending decision', async () => {
  const port: AgentDecisionPort = {
    decide: (_observation, _budget, signal) => new Promise(resolve => signal.addEventListener('abort', () => resolve(undefined))),
  };
  const core = new AgentWorkerCore(port, {
    implementationRevision: 'test-rev',
    setTimer: callback => { queueMicrotask(callback); return 1 as unknown as ReturnType<typeof setTimeout>; },
    clearTimer: () => {},
  });
  await core.handle({ type: 'initialize', protocolVersion: 1, sessionId: 'session-1', seed: 1 });
  assert.deepEqual(await core.handle({ type: 'observe', observation: observation(), budgetMs: 5 }), {
    type: 'stopped', sessionId: 'session-1', reason: 'budget',
  });
});

test('cancel aborts an in-flight decision and is reported to port', async () => {
  const cancelled: string[] = [];
  const port: AgentDecisionPort = {
    decide: (_observation, _budget, signal) => new Promise(resolve => signal.addEventListener('abort', () => resolve(undefined))),
    cancel: sessionId => cancelled.push(sessionId),
  };
  const core = new AgentWorkerCore(port, { implementationRevision: 'test-rev' });
  await core.handle({ type: 'initialize', protocolVersion: 1, sessionId: 'session-1', seed: 1 });
  const pending = core.handle({ type: 'observe', observation: observation(), budgetMs: 10000 });
  await Promise.resolve();
  assert.deepEqual(await core.handle({ type: 'cancel', sessionId: 'session-1' }), {
    type: 'stopped', sessionId: 'session-1', reason: 'cancelled',
  });
  assert.deepEqual(await pending, { type: 'stopped', sessionId: 'session-1', reason: 'cancelled' });
  assert.deepEqual(cancelled, ['session-1']);
});

test('new initialize replaces cancelled session cleanly', async () => {
  const core = new AgentWorkerCore(new Port(), { implementationRevision: 'test-rev' });
  await core.handle({ type: 'initialize', protocolVersion: 1, sessionId: 'session-1', seed: 1 });
  await core.handle({ type: 'cancel', sessionId: 'session-1' });
  assert.equal((await core.handle({ type: 'initialize', protocolVersion: 1, sessionId: 'session-2', seed: 2 })).type, 'ready');
  assert.equal((await core.handle({ type: 'observe', observation: observation({ sessionId: 'session-2' }), budgetMs: 50 })).type, 'action');
});

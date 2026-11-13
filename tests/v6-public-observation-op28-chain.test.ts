import assert from 'node:assert/strict';
import test from 'node:test';
import type { GameObservation } from '../src/runtime/browser-games.ts';
import { AgentWorkerCore } from '../src/runtime/v6-agent-worker-core.ts';
import { BrowserAgentObservationStream } from '../src/runtime/v6-browser-agent-observation.ts';
import { PublicSingleActionLogosDecisionPort } from '../src/logos-engine/v6-public-single-action-port.ts';
import { OperationTraceSink } from '../src/logos-engine/v6-operation-trace.ts';

function gameObservation(): GameObservation {
  const frame = Array.from({ length: 64 }, () => Array(64).fill(3));
  frame[10]![10] = 9;
  return {
    gameCode: 'REAL',
    frame,
    frames: [],
    state: 'NOT_FINISHED',
    availableActionIds: [3],
    canUndo: false,
    canSelectLevel: false,
    level: 1,
    levelCount: 1,
    levelsCompleted: 0,
    defaultFps: 5,
  };
}

test('public GameObservation reaches OP28 guard and becomes a worker action', async () => {
  const trace = new OperationTraceSink();
  const stream = new BrowserAgentObservationStream({
    sessionId: 'runtime-session',
    gameCode: 'REAL',
  });
  const worker = new AgentWorkerCore(
    new PublicSingleActionLogosDecisionPort({ trace }),
    { implementationRevision: 'public-single-action-op28-test' },
  );

  const ready = await worker.handle({
    type: 'initialize',
    protocolVersion: 1,
    sessionId: 'runtime-session',
    seed: 0,
  });
  assert.equal(ready.type, 'ready');

  const response = await worker.handle({
    type: 'observe',
    observation: stream.next(gameObservation()),
    budgetMs: 50,
  });
  assert.deepEqual(response, {
    type: 'action',
    sessionId: 'runtime-session',
    sequence: 0,
    action: { id: 3 },
  });
  assert.deepEqual(
    trace.snapshot().events.map(event => event.kind),
    ['need', 'operation', 'consumption'],
  );
});

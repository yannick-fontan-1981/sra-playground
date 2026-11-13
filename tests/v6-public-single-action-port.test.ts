import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PROTOCOL_VERSION,
  type AgentObservation,
} from '../src/runtime/contracts.ts';
import { OperationTraceSink } from '../src/logos-engine/v6-operation-trace.ts';
import {
  preparePublicSingleActionDecision,
  PublicSingleActionLogosDecisionPort,
} from '../src/logos-engine/v6-public-single-action-port.ts';

function observation(
  actions: AgentObservation['availableActionIds'],
  sequence = 0,
  state: AgentObservation['state'] = 'NOT_FINISHED',
): AgentObservation {
  return {
    protocolVersion: PROTOCOL_VERSION,
    sessionId: 'single-action-session',
    sequence,
    image: {
      width: 64,
      height: 64,
      pixelFormat: 'palette-index-u8',
      pixels: new Uint8Array(4096),
    },
    availableActionIds: actions,
    state,
    level: 2,
    levelsCompleted: 1,
  };
}

test('sole public simple action produces OP28 need, call, guard consumption and action', () => {
  const trace = new OperationTraceSink();
  const port = new PublicSingleActionLogosDecisionPort({ trace });
  const action = port.decide(
    observation([2]),
    50,
    new AbortController().signal,
  );
  assert.deepEqual(action, { id: 2 });
  const events = trace.snapshot().events;
  assert.deepEqual(
    events.map(event => event.kind),
    ['need', 'operation', 'consumption'],
  );
  assert.equal(events[1]?.kind === 'operation' && events[1].op, 'OP28');
  assert.equal(
    events[2]?.kind === 'consumption' && events[2].effectKind,
    'guard',
  );
  assert.equal(new Set(events.map(event => event.needId)).size, 1);
});

test('multiple public actions do not build a bundle or call an OP', () => {
  const trace = new OperationTraceSink();
  const port = new PublicSingleActionLogosDecisionPort({ trace });
  assert.equal(
    port.decide(observation([1, 2]), 50, new AbortController().signal),
    undefined,
  );
  assert.deepEqual(trace.snapshot().events, []);
});

test('sole ACTION6 remains unknown without coordinates and does not call an OP', () => {
  const trace = new OperationTraceSink();
  const port = new PublicSingleActionLogosDecisionPort({ trace });
  assert.equal(
    port.decide(observation([6]), 50, new AbortController().signal),
    undefined,
  );
  assert.deepEqual(trace.snapshot().events, []);
});

test('terminal or aborted observations do not produce a decision', () => {
  const port = new PublicSingleActionLogosDecisionPort();
  assert.equal(
    port.decide(observation([1], 0, 'WIN'), 50, new AbortController().signal),
    undefined,
  );
  const controller = new AbortController();
  controller.abort();
  assert.equal(port.decide(observation([1]), 50, controller.signal), undefined);
});

test('changed observation revision produces a new bounded bundle identity', () => {
  const first = preparePublicSingleActionDecision(observation([4], 3))!;
  const second = preparePublicSingleActionDecision(observation([4], 4))!;
  assert.notEqual(first.bundle.id, second.bundle.id);
  assert.equal(first.bundle.observation_revision, 3);
  assert.equal(second.bundle.observation_revision, 4);
});

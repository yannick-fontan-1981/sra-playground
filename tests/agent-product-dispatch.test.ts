import assert from 'node:assert/strict';
import test from 'node:test';
import {
  actionArguments,
  canDispatchAction,
  dispatchProductAction,
  ready,
  type DispatchPorts,
  type ProductObservation,
  type ProductReadinessState,
} from '../src/agent-product-dispatch.ts';

const observation = (overrides: Partial<ProductObservation> = {}): ProductObservation => ({
  gameCode: 'CASC',
  state: 'NOT_FINISHED',
  availableActionIds: [1, 2, 3, 4, 5, 6],
  ...overrides,
});

const state = (overrides: Partial<ProductReadinessState> = {}): ProductReadinessState => ({
  observation: observation(),
  selectedGameCode: 'CASC',
  busy: false,
  loading: false,
  failed: false,
  ...overrides,
});

test('ready requires a matching observation and an idle healthy product state', () => {
  assert.equal(ready(state()), true);
  assert.equal(ready(state({ observation: null })), false);
  assert.equal(ready(state({ selectedGameCode: 'KLOT' })), false);
  assert.equal(ready(state({ busy: true })), false);
  assert.equal(ready(state({ loading: true })), false);
  assert.equal(ready(state({ failed: true })), false);
});

test('terminal and unavailable actions are rejected before dispatch', () => {
  assert.equal(canDispatchAction(state(), 4), true);
  assert.equal(canDispatchAction(state(), 7), false);
  assert.equal(canDispatchAction(state({ observation: observation({ state: 'WIN' }) }), 4), false);
  assert.equal(canDispatchAction(state({ observation: observation({ state: 'GAME_OVER' }) }), 4), false);
});

test('ACTION6 preserves x/y while simple actions dispatch without coordinate data', () => {
  assert.deepEqual(actionArguments(6, { x: 17, y: 23 }), [6, { x: 17, y: 23 }]);
  assert.deepEqual(actionArguments(4, { x: 17, y: 23 }), [4, undefined]);
});

test('dispatch timing stops before presentation begins', async () => {
  let now = 10;
  const events: string[] = [];
  let measured = -1;
  const ports: DispatchPorts = {
    action: async (action, data) => {
      events.push(`action:${action}:${JSON.stringify(data)}`);
      now = 37;
      return observation();
    },
    present: async () => {
      events.push('present:start');
      now = 1037;
      events.push('present:end');
    },
    now: () => now,
    generation: () => 9,
    setBusy: value => events.push(`busy:${value}`),
    onDispatchMeasured: elapsed => { measured = elapsed; events.push(`measured:${elapsed}`); },
  };

  const result = await dispatchProductAction(state(), 4, undefined, ports);
  assert.equal(result.elapsedMs, 27);
  assert.equal(measured, 27);
  assert.deepEqual(events, ['busy:true', 'action:4:undefined', 'measured:27', 'present:start', 'present:end', 'busy:false']);
});

test('successful dispatch presents the resolved observation before releasing busy state', async () => {
  const events: string[] = [];
  const next = observation({ state: 'LEVEL_COMPLETE' });
  const ports: DispatchPorts = {
    action: async () => { events.push('action'); return next; },
    present: async (value, generation) => {
      events.push(`present:${value.state}:${generation}`);
    },
    now: (() => { let value = 0; return () => value++; })(),
    generation: () => 4,
    setBusy: value => events.push(`busy:${value}`),
  };

  const result = await dispatchProductAction(state(), 1, undefined, ports);
  assert.deepEqual(result, { accepted: true, stale: false, elapsedMs: 1 });
  assert.deepEqual(events, ['busy:true', 'action', 'present:LEVEL_COMPLETE:4', 'busy:false']);
});

test('a return from an obsolete selection generation is rejected and never presented', async () => {
  const events: string[] = [];
  let generation = 11;
  let now = 100;
  const ports: DispatchPorts = {
    action: async () => {
      events.push('action');
      now = 108;
      generation = 12;
      return observation();
    },
    present: async () => { events.push('present'); },
    now: () => now,
    generation: () => generation,
    setBusy: value => events.push(`busy:${value}`),
  };

  const result = await dispatchProductAction(state(), 2, undefined, ports);
  assert.deepEqual(result, { accepted: false, stale: true, elapsedMs: 8 });
  assert.deepEqual(events, ['busy:true', 'action', 'busy:false']);
});

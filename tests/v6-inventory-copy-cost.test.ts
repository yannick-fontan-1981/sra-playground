import assert from 'node:assert/strict';
import test from 'node:test';
import { ObservedMeter } from '../src/logos-engine/v6-inventory-caller-context.ts';
import { ObservedInventory } from '../src/logos-engine/v6-observed-inventory.ts';
import { CellProjection } from '../src/logos-engine/v6-inventory-project.ts';

type R = Record<string, any>;
const key = JSON.stringify(['x', 1, 2, 'lo', 3]);

test('meter source snapshots preserve all cloneable primitive values exactly', () => {
  for (const value of [null, undefined, true, false, 0, -0, 1.25, NaN, Infinity, -Infinity, 17n, '', 'measured', '\ud800']) {
    const meter = new ObservedMeter();
    meter.recent = [['synthetic:measurement', new Map([[key, value as any]])]];
    const snapshot = meter.state();
    assert.ok(Object.is(snapshot.recent[0][1][0][1], value));
    assert.notEqual(snapshot.recent, meter.recent);
  }
});

test('meter source snapshots still reject uncloneable callable and symbolic values', () => {
  for (const value of [Symbol('synthetic:measurement'), () => 1]) {
    const meter = new ObservedMeter();
    meter.recent = [['synthetic:measurement', new Map([[key, value as any]])]];
    assert.throws(() => meter.state(), { name: 'DataCloneError' });
  }
});

test('meter source snapshots keep nested owners detached in both directions', () => {
  const meter = new ObservedMeter(), retained = { evidence: [{ value: 1 }] };
  meter.recent = [['synthetic:measurement', new Map([[key, retained as any]])]];
  meter.recent_steps = [0]; meter.previous_rows = [[1, 2], [3, 4]];
  const first = meter.state(), second = meter.state();
  assert.notEqual(first.recent[0][1][0][1], retained);
  assert.notEqual(first.recent[0][1][0][1], second.recent[0][1][0][1]);
  first.recent[0][1][0][1].evidence[0].value = 10;
  first.previous_rows[0][0] = 10;
  assert.equal(retained.evidence[0].value, 1); assert.equal(meter.previous_rows[0]![0], 1);
  retained.evidence[0].value = 20; meter.previous_rows[0]![0] = 20;
  assert.equal(second.recent[0][1][0][1].evidence[0].value, 1);
  assert.equal(second.previous_rows[0][0], 1);
});

test('meter restoration detaches composite entries and preserves scalar and row-order semantics', () => {
  const meter = new ObservedMeter(), input = meter.state();
  input.recent = [['synthetic:measurement', [
    [['x', 1, 2, 'lo', 3], -0],
    [['x', 1, 2, 'hi', 5], { evidence: [1, 2] }],
  ]]];
  input.recent_steps = [0]; input.previous_rows = [[1, 2]];
  meter.restore(input);
  const restored = meter.state();
  const rows = restored.recent[0][1] as any[];
  assert.ok(Object.is(rows.find(([k]) => k[3] === 'lo')[1], -0));
  assert.deepEqual(rows.map(([k]) => k[3]), ['hi', 'lo']);
  input.recent[0][1][1][1].evidence[0] = 99; input.previous_rows[0][0] = 99;
  assert.deepEqual(meter.state(), restored);
  (meter.recent[0]![1].get(JSON.stringify(['x', 1, 2, 'hi', 5])) as any).evidence[0] = 5;
  assert.equal(rows.find(([k]) => k[3] === 'hi')[1].evidence[0], 1);
});

test('custom tracker validation still receives its own mutable input copy', async context => {
  const family = await ObservedInventory.create(), source = family.state();
  source.tracker.controls = { ACTION1: { delta: [1, 0], evidence: [] } };
  family.restore(source);
  const original = CellProjection.prototype.restore;
  const restore = context.mock.method(CellProjection.prototype, 'restore', function (this: CellProjection, value: R): void {
    assert.equal(Object.isFrozen(value), false);
    assert.equal(Object.isFrozen(value.controls), false);
    value.controls.ACTION1.delta[0] = 99;
    original.call(this, value);
  });
  const checkpoint = family.nativeState();
  assert.equal(restore.mock.callCount(), 1);
  assert.equal(checkpoint.source_state.tracker.controls.ACTION1.delta[0], 1);
  assert.equal(family.tracker.controls.ACTION1.delta[0], 1);
  assert.equal(source.tracker.controls.ACTION1.delta[0], 1);
});

test('an accessor-selected restorer keeps a mutable copy even if it resets the prototype during lookup', async () => {
  const family = await ObservedInventory.create(), source = family.state();
  source.tracker.controls = { ACTION1: { delta: [1, 0], evidence: [] } };
  family.restore(source);
  const descriptor = Object.getOwnPropertyDescriptor(CellProjection.prototype, 'restore')!;
  const original = CellProjection.prototype.restore;
  let calls = 0;
  Object.defineProperty(CellProjection.prototype, 'restore', {
    configurable: true,
    get() {
      Object.defineProperty(CellProjection.prototype, 'restore', descriptor);
      return function (this: CellProjection, value: R): void {
        calls++;
        assert.equal(Object.isFrozen(value), false);
        value.controls.ACTION1.delta[0] = 99;
        original.call(this, value);
      };
    },
  });
  try {
    const checkpoint = family.nativeState();
    assert.equal(calls, 1);
    assert.equal(checkpoint.source_state.tracker.controls.ACTION1.delta[0], 1);
    assert.equal(family.tracker.controls.ACTION1.delta[0], 1);
  } finally {
    Object.defineProperty(CellProjection.prototype, 'restore', descriptor);
  }
});

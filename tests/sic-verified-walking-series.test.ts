import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bindWalkingSeries,
  walkingPremise,
  walkingReturn,
  type WalkingStep,
} from '../src/sic/verified-walking-series.ts';
import { decidePlanContinuation } from '../src/sic/plan-step.ts';

const row = Array.from({ length: 24 }, () => 0);
const path: WalkingStep[] = row
  .slice(0, -1)
  .map((_, x) => ({
    from: [x, 0, x, 0],
    to: [x + 1, 0, x + 1, 0],
    command: { action_ref: 'ACTION4', data: {} },
  }));
test('commits at most sixteen primitive actions or the remaining budget, with visible one-step premises', () => {
  assert.equal(bindWalkingSeries(path, [row], 999)?.length, 16);
  assert.equal(bindWalkingSeries(path, [row], 3)?.length, 3);
  assert.equal(bindWalkingSeries(path, [row], 1), undefined);
  const jump: WalkingStep = { ...path[2]!, to: [9, 0, 9, 0] };
  assert.equal(bindWalkingSeries([path[0]!, path[1]!, jump], [row], 16)?.length, 2);
  const click: WalkingStep = { ...path[2]!, command: { action_ref: 'ACTION6', data: { x: 3, y: 0 } } };
  assert.equal(bindWalkingSeries([path[0]!, path[1]!, click], [row], 16)?.length, 2);
});
test('guards stop on a changed destination, unexpected public effect, lost actor, boundary or exhausted budget', () => {
  const series = bindWalkingSeries(path, [row], 16)!,
    step = series[0]!;
  const old = [row.map((_, i) => (i === 0 ? 9 : 0))],
    moved = [row.map((_, i) => (i === 1 ? 9 : 0))];
  assert.equal(walkingPremise(step, old), true);
  assert.equal(walkingReturn(step, old, moved, true), true);
  assert.equal(walkingReturn(step, old, moved, false), false);
  const changed = moved.map((r) => r.slice());
  changed[0]![8] = 7;
  const matched = walkingReturn(step, old, changed, true);
  assert.equal(matched, false);
  const base = {
    boundary: false,
    matched: true,
    sealRequested: false,
    hasNextStep: true,
    budgetReason: null,
  };
  assert.equal(decidePlanContinuation({ ...base, matched }).continue, false);
  assert.equal(decidePlanContinuation({ ...base, boundary: true }).continue, false);
  assert.equal(decidePlanContinuation({ ...base, budgetReason: 'cap' }).continue, false);
  assert.equal(walkingPremise(series[7]!, changed), false);
  assert.equal(decidePlanContinuation({ ...base, hasNextStep: false }).continue, false);
});

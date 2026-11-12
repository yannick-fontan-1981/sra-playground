import assert from 'node:assert/strict';
import test from 'node:test';
import { runSyntheticOperationSession } from './helpers/op01-op31-synthetic-session.ts';

test('C7 diagnostic trace OFF/ON preserves the same semantic session result', () => {
  const off = runSyntheticOperationSession({ cycles: 8, trace: false, cache: false });
  const on = runSyntheticOperationSession({ cycles: 8, trace: 'full', cache: false });
  assert.deepEqual(
    { ...off, traceEvents: 0 },
    { ...on, traceEvents: 0 },
  );
  assert.ok(on.traceEvents > 0);
});

test('C7 diagnostic cache does not alter semantic session results', () => {
  const off = runSyntheticOperationSession({ cycles: 8, trace: false, cache: false });
  const cached = runSyntheticOperationSession({ cycles: 8, trace: false, cache: true });
  assert.deepEqual(
    { ...off, cacheSize: 0 },
    { ...cached, cacheSize: 0 },
  );
  assert.ok(cached.cacheSize > 0);
});

test('C7 diagnostic session exercises release and all three post-analysis operations', () => {
  const result = runSyntheticOperationSession({ cycles: 5, trace: 'full', cache: true });
  assert.equal(result.released, 5);
  assert.equal(result.op29, 5);
  assert.equal(result.op30, 5);
  assert.equal(result.op31, 5);
  assert.deepEqual(result.knowledgeKeys, ['knowledge:B:color']);
});


test('C7 counters-only trace preserves semantics without retaining detailed events', () => {
  const result = runSyntheticOperationSession({ cycles: 5, trace: 'counters', cache: false });
  assert.equal(result.released, 5);
  assert.equal(result.traceEvents, 0);
});

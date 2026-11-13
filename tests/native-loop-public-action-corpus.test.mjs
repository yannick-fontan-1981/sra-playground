import assert from 'node:assert/strict';
import test from 'node:test';
import {
  NATIVE_PUBLIC_ACTION_CORPUS_V1,
  selectNativePublicCostAction,
} from '../scripts/native-loop-public-action-corpus.mjs';

test('candidate corpus selects ACTION5 for STCK/SMLP-like public states', () => {
  assert.deepEqual(selectNativePublicCostAction({ availableActionIds: [5, 6, 7] }), { id: 5 });
  assert.deepEqual(selectNativePublicCostAction({ availableActionIds: [7, 6, 5] }), { id: 5 });
});

test('candidate corpus uses a public directional action when ACTION5 is unavailable', () => {
  assert.deepEqual(selectNativePublicCostAction({ availableActionIds: [4, 2, 6, 7] }), { id: 2 });
});

test('candidate corpus uses ACTION7 only as public fallback', () => {
  assert.deepEqual(selectNativePublicCostAction({ availableActionIds: [7] }), { id: 7 });
});

test('candidate corpus never invents ACTION6 coordinates', () => {
  assert.equal(selectNativePublicCostAction({ availableActionIds: [6] }), undefined);
  assert.deepEqual(NATIVE_PUBLIC_ACTION_CORPUS_V1.excludedAutomaticActions, [6]);
});

test('candidate corpus validates the public action boundary', () => {
  assert.throws(() => selectNativePublicCostAction({}), /availableActionIds/);
  assert.throws(() => selectNativePublicCostAction({ availableActionIds: [8] }), /1\.\.7/);
});

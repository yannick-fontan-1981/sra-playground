import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LOT9C3_CANDIDATE_SOURCE_COMPONENTS,
  LOT9C3_COMMON_SOURCE_COMPONENTS,
  computeNativeJointChannelSourceRefs,
} from '../scripts/native-loop-joint-channel-source-refs.mjs';

test('Lot 9C3 source refs bind A and B to one common checkout with an explicit candidate delta', () => {
  const refs = computeNativeJointChannelSourceRefs();
  assert.equal(refs.version, 1);
  assert.equal(refs.contract, 'lot9c-joint-channel-source-identity-v1');
  assert.match(refs.commonRoot, /^[0-9a-f]{64}$/);
  assert.match(refs.candidateRoot, /^[0-9a-f]{64}$/);
  assert.equal(refs.reference.sourceRef, `lot9c-joint-v1:A:${refs.commonRoot}`);
  assert.equal(
    refs.candidate.sourceRef,
    `lot9c-joint-v1:B:${refs.commonRoot}:${refs.candidateRoot}`,
  );
  assert.notEqual(refs.reference.sourceRef, refs.candidate.sourceRef);
  assert.equal(refs.invariants.sameCheckout, true);
  assert.equal(refs.invariants.sameWorkerPyodideTransport, true);
  assert.equal(refs.invariants.sameCorpus, 'native-joint-channel-action6-corpus-v1');
});

test('Lot 9C3 source identity includes the official transport and every activated joint component', () => {
  assert.ok(LOT9C3_COMMON_SOURCE_COMPONENTS.includes('public/python/custom-games.zip'));
  assert.ok(LOT9C3_COMMON_SOURCE_COMPONENTS.includes('src/runtime/game-worker.ts'));
  assert.ok(LOT9C3_COMMON_SOURCE_COMPONENTS.includes('scripts/measure-native-loop-costs.mjs'));
  assert.ok(LOT9C3_CANDIDATE_SOURCE_COMPONENTS.includes('scripts/native-loop-joint-channel-candidate-hook.mjs'));
  assert.ok(LOT9C3_CANDIDATE_SOURCE_COMPONENTS.includes('src/logos-engine/v6-joint-channel-owner.ts'));
  assert.ok(LOT9C3_CANDIDATE_SOURCE_COMPONENTS.includes('src/runtime/v6-common-campaign-decision-port.ts'));

  const refs = computeNativeJointChannelSourceRefs();
  assert.deepEqual(
    refs.components.common.map(item => item.path),
    [...LOT9C3_COMMON_SOURCE_COMPONENTS],
  );
  assert.deepEqual(
    refs.components.candidate.map(item => item.path),
    [...LOT9C3_CANDIDATE_SOURCE_COMPONENTS],
  );
  assert.ok(refs.components.common.every(item => item.bytes > 0 && /^[0-9a-f]{64}$/.test(item.sha256)));
  assert.ok(refs.components.candidate.every(item => item.bytes > 0 && /^[0-9a-f]{64}$/.test(item.sha256)));
});

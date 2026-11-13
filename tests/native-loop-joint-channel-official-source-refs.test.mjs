import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LOT9C4_CANDIDATE_SOURCE_COMPONENTS,
  LOT9C4_COMMON_SOURCE_COMPONENTS,
  computeLot9c4SourceRefs,
} from '../scripts/native-loop-joint-channel-official-source-refs.mjs';

test('Lot 9C4 source refs bind strict A and B to one checkout and explicit joint delta', () => {
  const refs = computeLot9c4SourceRefs();
  assert.equal(refs.version, 1);
  assert.equal(refs.contract, 'lot9c4-strict-joint-source-identity-v1');
  assert.match(refs.commonRoot, /^[0-9a-f]{64}$/);
  assert.match(refs.candidateRoot, /^[0-9a-f]{64}$/);
  assert.equal(refs.reference.sourceRef, `lot9c4-strict-joint:A:${refs.commonRoot}`);
  assert.equal(
    refs.candidate.sourceRef,
    `lot9c4-strict-joint:B:${refs.commonRoot}:${refs.candidateRoot}`,
  );
  assert.notEqual(refs.reference.sourceRef, refs.candidate.sourceRef);
  assert.equal(refs.invariants.sameCheckout, true);
  assert.equal(refs.invariants.sameWorkerPyodideTransport, true);
  assert.equal(refs.invariants.sameCorpus, 'lot9c4-strict-public-joint-corpus-v1');
  assert.match(refs.invariants.sameStckPrelude, /excluded from both A and B timing/);
});

test('Lot 9C4 source identity covers transport, strict public policies and joint authority', () => {
  assert.ok(LOT9C4_COMMON_SOURCE_COMPONENTS.includes('public/python/custom-games.zip'));
  assert.ok(LOT9C4_COMMON_SOURCE_COMPONENTS.includes('src/runtime/game-worker.ts'));
  assert.ok(LOT9C4_COMMON_SOURCE_COMPONENTS.includes('src/logos-engine/v6-public-stck-joint-channels.ts'));
  assert.ok(LOT9C4_COMMON_SOURCE_COMPONENTS.includes('src/logos-engine/v6-public-addressed-joint-channels.ts'));
  assert.ok(LOT9C4_CANDIDATE_SOURCE_COMPONENTS.includes('scripts/native-loop-joint-channel-official-hook.mjs'));
  assert.ok(LOT9C4_CANDIDATE_SOURCE_COMPONENTS.includes('src/logos-engine/v6-joint-channel-owner.ts'));
  assert.ok(LOT9C4_CANDIDATE_SOURCE_COMPONENTS.includes('src/logos-engine/v6-native-authority.ts'));

  const refs = computeLot9c4SourceRefs();
  assert.deepEqual(
    refs.components.common.map(item => item.path),
    [...LOT9C4_COMMON_SOURCE_COMPONENTS],
  );
  assert.deepEqual(
    refs.components.candidate.map(item => item.path),
    [...LOT9C4_CANDIDATE_SOURCE_COMPONENTS],
  );
  assert.ok(refs.components.common.every(item => item.bytes > 0 && /^[0-9a-f]{64}$/.test(item.sha256)));
  assert.ok(refs.components.candidate.every(item => item.bytes > 0 && /^[0-9a-f]{64}$/.test(item.sha256)));
});

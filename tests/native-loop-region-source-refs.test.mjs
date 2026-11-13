import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildNativeRegionSourceRefs,
  computeNativeRegionSourceRefs,
  NATIVE_REGION_CANDIDATE_COMPONENTS,
  NATIVE_REGION_COMMON_COMPONENTS,
  NATIVE_REGION_EXECUTION_CONTRACT,
} from '../scripts/native-loop-region-source-refs.mjs';

function fakeRead(values) {
  return async path => {
    if (!Object.hasOwn(values, path)) throw new Error(`missing fake component ${path}`);
    return Buffer.from(values[path]);
  };
}

test('source component sets are sorted, unique and disjoint', () => {
  assert.deepEqual(NATIVE_REGION_COMMON_COMPONENTS, [...NATIVE_REGION_COMMON_COMPONENTS].sort());
  assert.deepEqual(NATIVE_REGION_CANDIDATE_COMPONENTS, [...NATIVE_REGION_CANDIDATE_COMPONENTS].sort());
  assert.equal(new Set(NATIVE_REGION_COMMON_COMPONENTS).size, NATIVE_REGION_COMMON_COMPONENTS.length);
  assert.equal(new Set(NATIVE_REGION_CANDIDATE_COMPONENTS).size, NATIVE_REGION_CANDIDATE_COMPONENTS.length);
  assert.deepEqual(
    NATIVE_REGION_COMMON_COMPONENTS.filter(path => NATIVE_REGION_CANDIDATE_COMPONENTS.includes(path)),
    [],
  );
});

test('common source changes alter both refs while candidate-only changes alter only B', async () => {
  const commonPaths = ['common-a', 'common-b'];
  const candidatePaths = ['candidate-a'];
  const first = await computeNativeRegionSourceRefs({
    commonPaths,
    candidatePaths,
    read: fakeRead({ 'common-a': 'one', 'common-b': 'two', 'candidate-a': 'three' }),
    commitSha: 'commit-1',
  });
  const candidateChanged = await computeNativeRegionSourceRefs({
    commonPaths,
    candidatePaths,
    read: fakeRead({ 'common-a': 'one', 'common-b': 'two', 'candidate-a': 'changed' }),
    commitSha: 'commit-2',
  });
  const commonChanged = await computeNativeRegionSourceRefs({
    commonPaths,
    candidatePaths,
    read: fakeRead({ 'common-a': 'changed', 'common-b': 'two', 'candidate-a': 'three' }),
    commitSha: 'commit-3',
  });

  assert.equal(first.reference.sourceRef, candidateChanged.reference.sourceRef);
  assert.notEqual(first.candidate.sourceRef, candidateChanged.candidate.sourceRef);
  assert.notEqual(first.reference.sourceRef, commonChanged.reference.sourceRef);
  assert.notEqual(first.candidate.sourceRef, commonChanged.candidate.sourceRef);
});

test('source refs pin the shared execution contract and the sole A/B mode difference', () => {
  const report = buildNativeRegionSourceRefs({
    commonComponents: [{ path: 'common', bytes: 1, sha256: 'a'.repeat(64) }],
    candidateComponents: [{ path: 'candidate', bytes: 1, sha256: 'b'.repeat(64) }],
    commitSha: 'commit',
  });
  assert.equal(report.reference.profile.execution, NATIVE_REGION_EXECUTION_CONTRACT);
  assert.equal(report.candidate.profile.execution, NATIVE_REGION_EXECUTION_CONTRACT);
  assert.equal(report.reference.profile.regionHook, 'disabled');
  assert.equal(report.candidate.profile.regionHook, 'enabled');
  assert.equal(report.reference.profile.commonRoot, report.candidate.profile.commonRoot);
  assert.ok(!Object.hasOwn(report.reference.profile, 'candidateRoot'));
  assert.equal(report.candidate.profile.candidateRoot, report.candidateRoot);
  assert.match(report.reference.sourceRef, /^lot9b-region-v1:A:[0-9a-f]{64}$/);
  assert.match(report.candidate.sourceRef, /^lot9b-region-v1:B:[0-9a-f]{64}$/);
});

test('runtime component contract includes transport, corpus, protocol and Region implementation', () => {
  for (const required of [
    'public/python/custom-games.zip',
    'public/python/game_bridge.py',
    'scripts/measure-native-loop-costs.mjs',
    'scripts/native-loop-region-action6-corpus.mjs',
    'scripts/native-loop-session-adapter.mjs',
    'src/runtime/browser-games.ts',
    'src/runtime/game-worker.ts',
  ]) {
    assert.ok(NATIVE_REGION_COMMON_COMPONENTS.includes(required), required);
  }
  for (const required of [
    'scripts/native-loop-region-candidate-hook.mjs',
    'src/logos-engine/v6-public-observation-delta.ts',
    'src/logos-engine/v6-region-intervention.ts',
    'src/logos-engine/v6-region-intervention-owner.ts',
    'src/logos-engine/v6-region-public-evidence.ts',
  ]) {
    assert.ok(NATIVE_REGION_CANDIDATE_COMPONENTS.includes(required), required);
  }
});

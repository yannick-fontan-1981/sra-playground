import assert from 'node:assert/strict';
import test from 'node:test';
import {
  freezeTemporalMemoryReuse,
  validateTemporalMemoryReuse,
  type TemporalMemoryIntent,
  type TemporalMemoryProof,
} from '../src/logos-engine/v6-temporal-memory-contract.ts';

function proofs(): Record<string, TemporalMemoryProof> {
  return {
    'claim:old': {
      ref: 'claim:old', digest: 'digest-old', disposition: 'active', polarity: 'positive',
      epistemicStatus: 'supported', activeContradictions: [], defeatedBy: [],
    },
    'claim:current': {
      ref: 'claim:current', digest: 'digest-current', disposition: 'active', polarity: 'positive',
      epistemicStatus: 'established', activeContradictions: [], defeatedBy: [],
      memoryRevalidationObservationRef: 'obs-7',
    },
  };
}

function contractAndIntent() {
  const p = proofs();
  const contract = freezeTemporalMemoryReuse({
    memoryReuseRequired: true,
    memoryReuseContractRef: 'memory:temporal',
    recalledClaimRefs: ['claim:old'],
    currentSupportClaimRefs: ['claim:current'],
  }, p, 'obs-7');
  assert.ok(contract);
  const intent: TemporalMemoryIntent = {
    frameId: 'obs-7',
    memoryReuseRequired: true,
    canonicalPremiseClaimRefs: ['claim:old', 'claim:current'],
    premiseClaimRefs: ['claim:old', 'claim:current'],
    memoryReuseContract: contract,
  };
  return { p, contract, intent };
}

test('memory reuse is absent when Source does not require it', () => {
  assert.equal(freezeTemporalMemoryReuse({
    memoryReuseRequired: false,
    recalledClaimRefs: [],
    currentSupportClaimRefs: [],
  }, {}, 'obs-1'), null);
});

test('required memory reuse needs bounded recalled and current proof sets', () => {
  assert.throws(() => freezeTemporalMemoryReuse({
    memoryReuseRequired: true,
    recalledClaimRefs: [],
    currentSupportClaimRefs: ['claim:current'],
  }, proofs(), 'obs-7'), /recalledClaimRefs must contain between 1 and 32 refs/);
});

test('freezing refuses a declared proof that is absent', () => {
  assert.throws(() => freezeTemporalMemoryReuse({
    memoryReuseRequired: true,
    recalledClaimRefs: ['claim:missing'],
    currentSupportClaimRefs: ['claim:current'],
  }, proofs(), 'obs-7'), /declared memory proof is absent/);
});

test('current observation binding is mandatory at validation', () => {
  const { p, intent } = contractAndIntent();
  assert.throws(() => validateTemporalMemoryReuse(intent, p, 'obs-8'), /current observation/);
});

test('every memory proof must remain in both frozen premise domains', () => {
  const { p, intent } = contractAndIntent();
  const bad = { ...intent, premiseClaimRefs: ['claim:current'] };
  assert.throws(() => validateTemporalMemoryReuse(bad, p, 'obs-7'), /frozen action why/);
});

test('digest change or inactive evidence invalidates reuse', () => {
  const { p, intent } = contractAndIntent();
  p['claim:old'] = { ...p['claim:old']!, digest: 'changed' };
  assert.throws(() => validateTemporalMemoryReuse(intent, p, 'obs-7'), /changed or inactive/);
});

test('current support must itself be bound to the current observation', () => {
  const { p, intent } = contractAndIntent();
  p['claim:current'] = { ...p['claim:current']!, memoryRevalidationObservationRef: 'obs-6' };
  assert.throws(() => validateTemporalMemoryReuse(intent, p, 'obs-7'), /no current observation binding/);
});

test('unchanged active recalled and current proofs validate successfully', () => {
  const { p, intent } = contractAndIntent();
  assert.doesNotThrow(() => validateTemporalMemoryReuse(intent, p, 'obs-7'));
});

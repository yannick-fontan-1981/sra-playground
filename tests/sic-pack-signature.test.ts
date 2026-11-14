import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultRecoveryPack } from '../src/sic/active-recovery.ts';
import { recoverySignerFingerprint, signRecoveryPack, verifySignedRecoveryPack } from '../src/sic/pack-signature.ts';
import { recoveryRevision } from '../src/sic/recovery-pack.ts';

test('a signed SIC pack verifies against the expected signer and exact revision', async () => {
  const settings = recoveryRevision({ ...defaultRecoveryPack, openingCuriosity: 'active', familyAgenda: 'active' });
  const keys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const pack = await signRecoveryPack(settings, keys);
  const fingerprint = recoverySignerFingerprint(pack);
  assert.deepEqual(await verifySignedRecoveryPack(JSON.parse(JSON.stringify(pack)), fingerprint.toUpperCase()), pack);
  assert.equal(pack.revision.digest, settings.digest);
  await assert.rejects(verifySignedRecoveryPack(pack, '0'.repeat(64)), /does not match the trusted fingerprint/);
  await assert.rejects(verifySignedRecoveryPack(pack, ''), /trusted signer/);
  await assert.rejects(verifySignedRecoveryPack({ ...pack, algorithm: 'other' }, fingerprint), /Unsupported/);
  await assert.rejects(verifySignedRecoveryPack({ ...pack, signature: '00'.repeat(64) }, fingerprint), /signature does not match/);
  await assert.rejects(verifySignedRecoveryPack({ ...pack, revision: recoveryRevision(defaultRecoveryPack) }, fingerprint), /signature does not match/);
  await assert.rejects(verifySignedRecoveryPack({
    ...pack, revision: { ...pack.revision, configuration: defaultRecoveryPack },
  }, fingerprint), /schema version disagree/);
  const otherKeys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const other = await signRecoveryPack(settings, otherKeys);
  await assert.rejects(verifySignedRecoveryPack(other, fingerprint), /does not match the trusted fingerprint/);
});

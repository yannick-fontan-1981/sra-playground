import { symbolicDigest } from '../logos-engine/v6-hash.ts';
import { compileRecoveryPack, type RecoveryPack } from './active-recovery.ts';

const packId = 'sic.contact-recovery';
const combinedPackId = 'sic.native-strategies';

export function recoveryRevision(configuration: RecoveryPack) {
  const checked = compileRecoveryPack(configuration);
  const manifest = checked.frontier
    ? { id: combinedPackId, schemaVersion: 2, configuration: checked }
    : { id: packId, schemaVersion: 1, configuration: checked };
  return Object.freeze({ ...manifest, digest: symbolicDigest(manifest) });
}

export type RecoveryRevision = ReturnType<typeof recoveryRevision>;

export function readRecoveryRevision(input: unknown): RecoveryRevision {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).sort().join(',') !== 'configuration,digest,id,schemaVersion') {
    throw new TypeError('Expected a SIC pack with a manifest and digest.');
  }
  const envelope = input as Record<string, unknown>;
  if (!((envelope.id === packId && envelope.schemaVersion === 1) || (envelope.id === combinedPackId && envelope.schemaVersion === 2))) {
    throw new TypeError('Unsupported SIC pack or schema version.');
  }
  if (!Object.hasOwn(envelope, 'configuration') || envelope.configuration === undefined) {
    throw new TypeError('The pack must carry a configuration.');
  }
  const checked = recoveryRevision(compileRecoveryPack(envelope.configuration));
  if (checked.id !== envelope.id || checked.schemaVersion !== envelope.schemaVersion) {
    throw new TypeError('Pack capabilities and schema version disagree.');
  }
  if (checked.digest !== envelope.digest) throw new TypeError('The pack contents do not match its digest.');
  return checked;
}

export function nextRecoveryRevision(current: RecoveryRevision, previous: RecoveryRevision | null, candidate: RecoveryRevision) {
  return current.digest === candidate.digest ? { current, previous } : { current: candidate, previous: current };
}

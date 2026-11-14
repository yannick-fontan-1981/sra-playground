import { symbolicDigest } from '../logos-engine/v6-hash.ts';
import { compileRecoveryPack, type RecoveryPack } from './active-recovery.ts';

const packId = 'sic.contact-recovery';
const combinedPackId = 'sic.native-strategies';

export function recoveryRevision(configuration: RecoveryPack) {
  const checked = compileRecoveryPack(configuration);
  const manifest = checked.solver === 'sic' ? { id: combinedPackId, schemaVersion: 8, configuration: checked }
    : checked.reasoningMode ? { id: combinedPackId, schemaVersion: 7, configuration: checked }
    : checked.informationPreference ? { id: combinedPackId, schemaVersion: 6, configuration: checked }
    : checked.openingCuriosity ? { id: combinedPackId, schemaVersion: 5, configuration: checked }
    : checked.familyAgenda ? { id: combinedPackId, schemaVersion: 4, configuration: checked } : checked.frontier
    ? { id: combinedPackId, schemaVersion: checked.frontier.localRule ? 3 : 2, configuration: checked }
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
  if (!((envelope.id === packId && envelope.schemaVersion === 1)
    || (envelope.id === combinedPackId && [2, 3, 4, 5, 6, 7, 8].includes(envelope.schemaVersion as number)))) {
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

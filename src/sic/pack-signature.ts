import { sha256Bytes } from '../logos-engine/v6-hash.ts';
import { readRecoveryRevision, type RecoveryRevision } from './recovery-pack.ts';

const algorithm = 'ECDSA-P256-SHA256';
const keyAlgorithm = { name: 'ECDSA', namedCurve: 'P-256' };
const signatureAlgorithm = { name: 'ECDSA', hash: 'SHA-256' };

export interface SignedRecoveryPack {
  readonly version: 1;
  readonly algorithm: typeof algorithm;
  readonly revision: RecoveryRevision;
  readonly publicKey: string;
  readonly signature: string;
}

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

function bytes(value: string) {
  return Uint8Array.from(value.match(/../g) ?? [], byte => Number.parseInt(byte, 16));
}

function payload(revision: RecoveryRevision) {
  return new TextEncoder().encode(`SIC recovery pack signature v1\n${revision.digest}`);
}

export function recoverySignerFingerprint(pack: Pick<SignedRecoveryPack, 'publicKey'>) {
  return sha256Bytes(bytes(pack.publicKey));
}

/** The caller owns the signing key and its distribution. Only the public key is exported. */
export async function signRecoveryPack(revision: RecoveryRevision, keys: CryptoKeyPair): Promise<SignedRecoveryPack> {
  const checked = readRecoveryRevision(revision);
  const publicKey = await crypto.subtle.exportKey('spki', keys.publicKey);
  const signature = await crypto.subtle.sign(signatureAlgorithm, keys.privateKey, payload(checked));
  const signed = Object.freeze({ version: 1, algorithm, revision: checked, publicKey: hex(publicKey), signature: hex(signature) } as const);
  await verifySignedRecoveryPack(signed, recoverySignerFingerprint(signed));
  return signed;
}

/** A fingerprint from outside the pack pins the key allowed to sign it. */
export async function verifySignedRecoveryPack(input: unknown, trustedFingerprint: string) {
  const fingerprint = trustedFingerprint.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(fingerprint)) throw new TypeError('Enter the trusted signer’s 64-character SHA-256 fingerprint.');
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).sort().join(',') !== 'algorithm,publicKey,revision,signature,version') {
    throw new TypeError('Expected a signed SIC pack.');
  }
  const envelope = input as Record<string, unknown>;
  if (envelope.version !== 1 || envelope.algorithm !== algorithm) throw new TypeError('Unsupported SIC pack signature version or algorithm.');
  const { publicKey, signature } = envelope;
  if (typeof publicKey !== 'string' || !/^[0-9a-f]{182}$/.test(publicKey)
    || typeof signature !== 'string' || !/^[0-9a-f]{128}$/.test(signature)) {
    throw new TypeError('Invalid SIC pack public key or signature encoding.');
  }
  const publicBytes = bytes(publicKey);
  if (sha256Bytes(publicBytes) !== fingerprint) throw new TypeError('The SIC pack signer does not match the trusted fingerprint.');
  const revision = readRecoveryRevision(envelope.revision);
  const key = await crypto.subtle.importKey('spki', publicBytes, keyAlgorithm, false, ['verify']);
  if (!await crypto.subtle.verify(signatureAlgorithm, key, bytes(signature), payload(revision))) {
    throw new TypeError('The SIC pack signature does not match its contents.');
  }
  return Object.freeze({ version: 1, algorithm, revision, publicKey, signature } as const);
}

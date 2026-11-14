import { createPrivateKey, createPublicKey, webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { recoverySignerFingerprint, signRecoveryPack } from '../src/sic/pack-signature.ts';
import { readRecoveryRevision } from '../src/sic/recovery-pack.ts';

const [packPath, keyPath, ...extra] = process.argv.slice(2);
if (!packPath || !keyPath || extra.length) {
  process.stderr.write('Usage: node scripts/sign-sic-pack.mjs <saved-pack.json> <p256-private-key.pem>\n');
  process.exitCode = 1;
} else {
  try {
    const revision = readRecoveryRevision(JSON.parse(await readFile(packPath, 'utf8')));
    const privateKey = createPrivateKey(await readFile(keyPath));
    const publicKey = createPublicKey(privateKey);
    const keyAlgorithm = { name: 'ECDSA', namedCurve: 'P-256' };
    const keys = {
      privateKey: await webcrypto.subtle.importKey('pkcs8', privateKey.export({ format: 'der', type: 'pkcs8' }),
        keyAlgorithm, false, ['sign']),
      publicKey: await webcrypto.subtle.importKey('spki', publicKey.export({ format: 'der', type: 'spki' }),
        keyAlgorithm, true, ['verify']),
    };
    const signed = await signRecoveryPack(revision, keys);
    process.stdout.write(JSON.stringify(signed, null, 2) + '\n');
    process.stderr.write(`Signer SHA-256: ${recoverySignerFingerprint(signed)}\n`);
  } catch (error) {
    process.stderr.write(`Could not sign the SIC pack. ${error.message}\n`);
    process.exitCode = 1;
  }
}

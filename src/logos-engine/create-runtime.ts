import { V7Runtime } from './v7-runtime.ts';
import { V7_SOURCE_COMMIT } from './bundle.ts';
import type { V7Bundle } from './bundle.ts';

/**
 * A reproducible fingerprint of loaded declarations/IR and implementation version.
 * This is not the Python runtime digest or a hash of the TypeScript build binary.
 * Encoding is UTF-8 JSON.stringify, with fields in the order below.
 */
export async function createV7Runtime(bundle: V7Bundle): Promise<V7Runtime> {
  const manifest = {
    implementation: 'logos-engine.typescript.v7/0.2.0',
    sourceEncoding: 'json-stringify-v1',
    referenceCommit: V7_SOURCE_COMMIT,
    knowledge: bundle.knowledge,
    programs: bundle.programs,
  };
  const bytes = new TextEncoder().encode(JSON.stringify(manifest));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const sourceDigest = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  const hashes = bundle.provenance.workflowHashes as { generators?: unknown; activation?: unknown; experiment?: unknown } | undefined;
  const workflowHashes = typeof hashes?.generators === 'string' && typeof hashes.activation === 'string'
    ? { generators: hashes.generators, activation: hashes.activation, ...(typeof hashes.experiment === 'string' ? { experiment: hashes.experiment } : {}) }
    : undefined;
  return new V7Runtime({
    logos: bundle.knowledge.logos,
    drm: bundle.knowledge.drm,
    generators: bundle.programs.generators,
    activation: bundle.programs.activation,
    experiment: bundle.programs.experiment,
    sourceDigest,
    workflowHashes,
  });
}

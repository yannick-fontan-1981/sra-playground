import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const LOT9C3_COMMON_SOURCE_COMPONENTS = Object.freeze([
  '.github/workflows/lot9c3-official-joint-channels-abba.yml',
  'benchmarks/native-joint-channel-official.html',
  'package-lock.json',
  'public/python/custom-games.zip',
  'public/python/game_bridge.py',
  'scripts/measure-native-loop-costs.mjs',
  'scripts/native-loop-browser-worker-dispatch.mjs',
  'scripts/native-loop-game-bridge-session.mjs',
  'scripts/native-loop-joint-channel-action6-corpus.mjs',
  'scripts/native-loop-joint-channel-benchmark-runners.mjs',
  'scripts/native-loop-joint-channel-source-refs.mjs',
  'scripts/native-loop-public-corpus-runner.mjs',
  'scripts/native-loop-region-public-action6-probe.mjs',
  'scripts/native-loop-session-adapter.mjs',
  'scripts/run-native-joint-channel-official-benchmark.mjs',
  'src/benchmarks/native-joint-channel-official-benchmark.ts',
  'src/runtime/browser-games.ts',
  'src/runtime/game-worker.ts',
]);

export const LOT9C3_CANDIDATE_SOURCE_COMPONENTS = Object.freeze([
  'scripts/native-loop-joint-channel-candidate-hook.mjs',
  'src/logos-engine/v6-common-campaign-owner.ts',
  'src/logos-engine/v6-composition-engine.ts',
  'src/logos-engine/v6-joint-channel-action.ts',
  'src/logos-engine/v6-joint-channel-owner.ts',
  'src/logos-engine/v6-native-authority.ts',
  'src/logos-engine/v6-neutral-common-caller.ts',
  'src/logos-engine/v6-operation-cache.ts',
  'src/logos-engine/v6-operation-trace.ts',
  'src/logos-engine/v6-operations.ts',
  'src/logos-engine/v6-public-addressed-joint-channels.ts',
  'src/runtime/contracts.ts',
  'src/runtime/observed-addressed-material-runtime.ts',
  'src/runtime/v6-common-campaign-decision-port.ts',
  'src/runtime/v6-public-observation-measurement.ts',
]);

function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

function component(path) {
  const bytes = readFileSync(path);
  return {
    path,
    bytes: bytes.byteLength,
    sha256: sha256(bytes),
  };
}

function rootHash(components) {
  return sha256(components
    .map(item => `${item.path}\u0000${item.bytes}\u0000${item.sha256}`)
    .join('\n'));
}

export function computeNativeJointChannelSourceRefs() {
  const commonComponents = LOT9C3_COMMON_SOURCE_COMPONENTS.map(component);
  const candidateComponents = LOT9C3_CANDIDATE_SOURCE_COMPONENTS.map(component);
  const commonRoot = rootHash(commonComponents);
  const candidateRoot = rootHash(candidateComponents);
  return {
    version: 1,
    contract: 'lot9c-joint-channel-source-identity-v1',
    commonRoot,
    candidateRoot,
    reference: {
      sourceRef: `lot9c-joint-v1:A:${commonRoot}`,
      profile: {
        variant: 'A',
        jointChannels: 'disabled',
        commonRoot,
      },
    },
    candidate: {
      sourceRef: `lot9c-joint-v1:B:${commonRoot}:${candidateRoot}`,
      profile: {
        variant: 'B',
        jointChannels: 'enabled',
        commonRoot,
        candidateRoot,
      },
    },
    components: {
      common: commonComponents,
      candidate: candidateComponents,
    },
    invariants: {
      sameCheckout: true,
      sameWorkerPyodideTransport: true,
      sameGameArchive: 'public/python/custom-games.zip',
      sameCorpus: 'native-joint-channel-action6-corpus-v1',
      sameSeed: 0,
      sameStartLevel: 1,
      onlyMeasuredSemanticDifference:
        'B executes joint-channel public producers, exact compatibility, OP28 release and return acquisition; A omits that hook',
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = computeNativeJointChannelSourceRefs();
  const output = process.argv[2];
  if (output) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }
}

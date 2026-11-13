import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

export const LOT9C4_COMMON_SOURCE_COMPONENTS = Object.freeze([
  '.github/workflows/lot9c4-official-joint-channels-abba.yml',
  'benchmarks/native-joint-channel-official.html',
  'package-lock.json',
  'public/python/custom-games.zip',
  'public/python/game_bridge.py',
  'scripts/measure-native-loop-costs.mjs',
  'scripts/native-loop-browser-worker-dispatch.mjs',
  'scripts/native-loop-game-bridge-session.mjs',
  'scripts/native-loop-joint-channel-official-runners.mjs',
  'scripts/native-loop-joint-channel-official-source-refs.mjs',
  'scripts/native-loop-region-public-action6-probe.mjs',
  'scripts/native-loop-session-adapter.mjs',
  'scripts/run-native-joint-channel-official-benchmark.mjs',
  'src/benchmarks/native-joint-channel-official-benchmark.ts',
  'src/logos-engine/v6-public-addressed-joint-channels.ts',
  'src/logos-engine/v6-public-stck-joint-channels.ts',
  'src/logos-engine/v6-public-unique-stck-action6-port.ts',
  'src/runtime/browser-games.ts',
  'src/runtime/contracts.ts',
  'src/runtime/game-worker.ts',
]);

export const LOT9C4_CANDIDATE_SOURCE_COMPONENTS = Object.freeze([
  'scripts/native-loop-joint-channel-official-hook.mjs',
  'src/logos-engine/v6-common-campaign-owner.ts',
  'src/logos-engine/v6-composition-engine.ts',
  'src/logos-engine/v6-joint-channel-action.ts',
  'src/logos-engine/v6-joint-channel-owner.ts',
  'src/logos-engine/v6-native-authority.ts',
  'src/logos-engine/v6-neutral-common-caller.ts',
  'src/logos-engine/v6-operation-cache.ts',
  'src/logos-engine/v6-operation-trace.ts',
  'src/logos-engine/v6-operations.ts',
]);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
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

export function computeLot9c4SourceRefs() {
  const commonComponents = LOT9C4_COMMON_SOURCE_COMPONENTS.map(component);
  const candidateComponents = LOT9C4_CANDIDATE_SOURCE_COMPONENTS.map(component);
  const commonRoot = rootHash(commonComponents);
  const candidateRoot = rootHash(candidateComponents);
  return {
    version: 1,
    contract: 'lot9c4-strict-joint-source-identity-v1',
    commonRoot,
    candidateRoot,
    reference: {
      sourceRef: `lot9c4-strict-joint:A:${commonRoot}`,
      profile: {
        variant: 'A',
        publicTargetPolicy: 'enabled',
        jointChannels: 'disabled',
        commonRoot,
      },
    },
    candidate: {
      sourceRef: `lot9c4-strict-joint:B:${commonRoot}:${candidateRoot}`,
      profile: {
        variant: 'B',
        publicTargetPolicy: 'enabled',
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
      sameCorpus: 'lot9c4-strict-public-joint-corpus-v1',
      sameSeed: 0,
      sameStartLevel: 1,
      sameStckPrelude:
        'three public ACTION6(4,52) setup actions per strict target, excluded from both A and B timing',
      onlyMeasuredSemanticDifference:
        'B executes JointChannelOwner, CommonCampaignOwner, native OP28 release and selected return acquisition by both channels; A omits that seam',
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = computeLot9c4SourceRefs();
  const output = process.argv[2];
  if (output) writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
  else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

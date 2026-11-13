import {
  REGION_PUBLIC_ACTION6_PROBE_V1,
  selectRegionPublicAction6Probe,
} from './native-loop-region-public-action6-probe.mjs';

export const NATIVE_JOINT_CHANNEL_ACTION6_CORPUS_V1 = Object.freeze({
  id: 'native-joint-channel-action6-corpus-v1',
  games: Object.freeze(['STCK', 'SMLP']),
  seed: 0,
  startLevel: 1,
  publicProbeRef: REGION_PUBLIC_ACTION6_PROBE_V1.id,
  rule:
    'select the same public ACTION6 target for A and B from the current 64x64 frame; B must reconstruct that exact action through two causal joint channels',
});

export function selectNativeJointChannelAction6CostAction({ game, observation }) {
  if (!NATIVE_JOINT_CHANNEL_ACTION6_CORPUS_V1.games.includes(game)) {
    throw new RangeError(`unsupported native joint-channel corpus game ${String(game)}`);
  }
  return selectRegionPublicAction6Probe(game, observation);
}

import {
  REGION_PUBLIC_ACTION6_PROBE_V1,
  selectRegionPublicAction6Probe,
} from './native-loop-region-public-action6-probe.mjs';

export const NATIVE_REGION_ACTION6_CORPUS_V1 = Object.freeze({
  id: 'native-region-action6-corpus-v1',
  games: Object.freeze(['STCK', 'SMLP']),
  seed: 0,
  startLevel: 1,
  probeRef: REGION_PUBLIC_ACTION6_PROBE_V1.id,
  rule: 'select one ACTION6 coordinate from the current public 64x64 frame; never use hidden game state or a prepared trajectory',
});

export function selectNativeRegionAction6CostAction({ game, observation }) {
  if (!NATIVE_REGION_ACTION6_CORPUS_V1.games.includes(game)) {
    throw new RangeError(`unsupported native Region corpus game ${String(game)}`);
  }
  return selectRegionPublicAction6Probe(game, observation);
}

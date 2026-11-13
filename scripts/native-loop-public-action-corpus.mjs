export const NATIVE_PUBLIC_ACTION_CORPUS_V1 = Object.freeze({
  id: 'native-public-action-corpus-v1',
  games: Object.freeze(['STCK', 'SMLP']),
  seed: 0,
  startLevel: 1,
  preferredActionOrder: Object.freeze([5, 1, 2, 3, 4, 7]),
  excludedAutomaticActions: Object.freeze([6]),
  rule: 'choose ACTION5 when publicly available; otherwise first public directional action; use ACTION7 only as public fallback; never synthesize ACTION6 coordinates',
});

function normalizeAvailable(observation) {
  if (!observation || typeof observation !== 'object') {
    throw new TypeError('public observation must be an object');
  }
  const ids = observation.availableActionIds;
  if (!Array.isArray(ids)) {
    throw new TypeError('public observation must expose availableActionIds');
  }
  const unique = [...new Set(ids)];
  if (unique.some(id => !Number.isInteger(id) || id < 1 || id > 7)) {
    throw new RangeError('availableActionIds must contain only integer action IDs 1..7');
  }
  return unique;
}

/**
 * Public-only deterministic action selector for a newly requalified cost corpus.
 *
 * It deliberately never invents ACTION6 coordinates. The policy is not the
 * historical STCK/SMLP corpus and must not be used as official evidence until
 * a native runner executes and records it against the durable game assets.
 */
export function selectNativePublicCostAction(observation) {
  const available = normalizeAvailable(observation);
  for (const id of NATIVE_PUBLIC_ACTION_CORPUS_V1.preferredActionOrder) {
    if (available.includes(id)) return { id };
  }
  return undefined;
}

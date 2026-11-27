import { assessHypothesisPartition } from './discriminating-experiment.ts';
import { supportCompare } from '../logos-engine/v6-support-measurements.ts';

export interface SubsetClick {
  readonly action_ref: 'ACTION6';
  readonly data: { readonly x: number; readonly y: number };
}
export interface SubsetQueryOffer {
  readonly kind: 'scope' | 'member';
  readonly tested: number[];
  readonly command: SubsetClick;
  readonly controlShape: unknown;
  readonly global: number;
  readonly local: number;
  readonly remaining: number;
}

/** Conditional on one fixed member. Both groups refer to the current domain. */
export function subsetQuerySplit(global: number, population: number) {
  const local = population - global;
  const partition = assessHypothesisPartition([global, local]);
  if (!partition) throw new RangeError('An empty domain cannot supply a query');
  return { global, local, remaining: partition.remaining };
}

/** Minimise the largest surviving group. The native tie order prefers a scope,
 * then the lexicographically first list of members, then source order. */
export function selectSubsetQuery(offers: readonly SubsetQueryOffer[]): SubsetQueryOffer | undefined {
  let best: SubsetQueryOffer | undefined;
  const priority = (offer: SubsetQueryOffer) => [offer.remaining, offer.kind === 'scope' ? 0 : 1, offer.tested];
  for (const offer of offers) {
    if (!best || supportCompare(priority(offer), priority(best)) < 0) best = offer;
  }
  return best;
}

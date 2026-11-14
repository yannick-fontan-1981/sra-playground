import { sicNeedId } from './need-identity.ts';

export const informationStrategies = {
  point_contrast: 'Compare competing explanations for a clicked feature',
  coupled_displays: 'Measure which displays respond together',
  motion_contrast: 'Test competing predictions for a movement',
} as const;

export type InformationStrategy = keyof typeof informationStrategies;

export function isInformationStrategy(source: unknown): source is InformationStrategy {
  return typeof source === 'string' && Object.hasOwn(informationStrategies, source);
}

/** The observation producer supplies candidates in its evidence-qualified order.
 * Admission stays lazy because testing another offer may retain an attention obligation. */
export async function selectInformationStrategy<Offer, Receipt extends { readonly source?: unknown }, Plan>(
  ordered: Iterable<readonly [Offer, Receipt]>, plan: (offer: Offer, receipt: Receipt) => Promise<Plan | null>) {
  const considered: { strategy: InformationStrategy; result: 'selected' | 'no_plan' }[] = [];
  for (const [offer, receipt] of ordered) {
    const result = await plan(offer, receipt);
    if (isInformationStrategy(receipt.source)) {
      if (considered.length >= 12) considered.shift();
      considered.push({ strategy: receipt.source, result: result ? 'selected' : 'no_plan' });
    }
    if (result) return { plan: result, considered };
  }
  return { plan: null, considered };
}

export function informationNeed(observationRef: string, parentObjective: string, subjects: readonly string[], evidence: readonly string[]) {
  const identity = { kind: 'distinguish_public_hypotheses', scope: observationRef.split(':revision:', 1)[0]!,
    subjects, parentObjective, satisfactionContract: 'measure_a_return_that_separates_competing_predictions' } as const;
  return { ...identity, id: sicNeedId(identity), evidence, status: 'assigned' as const };
}

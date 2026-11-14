import { isInformationStrategy, type InformationStrategy } from './information-strategy.ts';

export interface InformationPreference {
  readonly mode: 'shadow' | 'active';
  readonly strategy: InformationStrategy;
  readonly minimumOutcomes: number;
}

export function compileInformationPreference(input: unknown): InformationPreference {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).sort().join(',') !== 'minimumOutcomes,mode,strategy') {
    throw new TypeError('The information preference requires a strategy, a mode and a minimum number of predicted outcomes.');
  }
  const { mode, strategy, minimumOutcomes } = input as Record<string, unknown>;
  if ((mode !== 'shadow' && mode !== 'active') || !isInformationStrategy(strategy)
    || typeof minimumOutcomes !== 'number' || !Number.isSafeInteger(minimumOutcomes) || minimumOutcomes < 2 || minimumOutcomes > 64) {
    throw new TypeError('Select a registered information strategy, an execution mode and 2–64 distinct predicted outcomes.');
  }
  return Object.freeze({ mode, strategy, minimumOutcomes });
}

export interface InformationOfferSummary {
  readonly strategy: InformationStrategy;
  readonly distinctOutcomes: number;
}

export function informationPriority(offer: InformationOfferSummary, preference: InformationPreference) {
  return offer.strategy === preference.strategy && offer.distinctOutcomes >= preference.minimumOutcomes ? 1 : 0;
}

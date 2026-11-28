import { compileStrategyGraph, resolveStrategyGraph, type AgendaEntry, type Applicability, type StrategyFact, type StrategyGraph } from './strategy-agenda.ts';

export const controlEffectPrimitives = {
  P01: 'Identify the current subject',
  P02: 'Revalidate the previously measured effect',
  P05: 'Test the unknown effect of an available command',
  P07: 'Find access to the command',
} as const;

type Primitive = keyof typeof controlEffectPrimitives;
type Fact = 'currentObservation' | 'objectiveDependsOnEffect' | 'subjectBound' | 'effectKnown' | 'effectNeedsRevalidation'
  | 'commandAvailable' | 'alreadyTried' | 'accessCanBeSought';
type Facts = Readonly<Partial<Record<Fact, StrategyFact>>>;

export interface ControlTrialContext {
  readonly observationRef: string;
  readonly availableActions: readonly string[];
  readonly objectiveSupported: boolean;
  readonly subjectBound: boolean;
  readonly effectKnown: boolean;
  readonly triedInContext: boolean;
  readonly evidence: readonly string[];
}

export const controlEffectNeed = 'establish_control_effect_for_current_objective';

interface ControlTrialVerdict {
  readonly selected: boolean;
  readonly applicability?: Applicability;
  readonly reason?: string;
  readonly evidence?: readonly string[];
}

export interface ControlTrialOffer {
  readonly action: string;
  readonly offeredAt: string;
  readonly context: ControlTrialContext;
}

interface RankedControlTrial {
  readonly action: string;
  readonly cost: 1;
  readonly applicability: Applicability;
  readonly reason: string;
  readonly evidence: readonly string[];
  readonly result: 'selected' | 'lower_priority' | 'skipped';
}

export interface ControlTrialComparison {
  readonly need: typeof controlEffectNeed;
  readonly mode: 'shadow' | 'active';
  readonly family: string;
  readonly observationRef: string;
  readonly action: string;
  readonly cost: 1;
  readonly remaining: number;
  readonly reference: ControlTrialVerdict;
  readonly shadow: Required<ControlTrialVerdict>;
  readonly firstDifference: keyof ControlTrialVerdict | null;
  readonly offers?: readonly RankedControlTrial[];
}

export type ControlTrialObserver = (comparison: ControlTrialComparison) => void;

export interface ActiveControlTrialAgenda {
  readonly mode: 'active';
  readonly actionBudget: 0 | 1;
}

export interface ControlTrialEvaluation {
  readonly active: boolean;
  readonly observe?: ControlTrialObserver;
  readonly family: string;
  readonly remaining: number;
}

export function controlTrialEvaluation(family: string, remaining: number, options?: {
  readonly observeControlTrialShadow?: ControlTrialObserver;
  readonly controlTrialAgenda?: ActiveControlTrialAgenda;
}): ControlTrialEvaluation | undefined {
  const agenda = options?.controlTrialAgenda?.mode === 'active' ? options.controlTrialAgenda : undefined;
  const observe = options?.observeControlTrialShadow;
  if (!agenda && !observe) return undefined;
  return { active: Boolean(agenda), observe, family, remaining: agenda ? Math.min(agenda.actionBudget, remaining) : remaining };
}

export const controlEffectNextGraph = compileStrategyGraph({
  id: 'next-primitive-for-control-effect',
  version: 1,
  order: 'FALLBACK',
  priorities: ['P01', 'P02', 'P07', 'P05'],
  strategies: {
    P01: [{ fact: 'currentObservation', expected: true, label: 'The current observation is established' },
      { fact: 'objectiveDependsOnEffect', expected: true, label: 'The objective depends on a control effect' },
      { fact: 'subjectBound', expected: false, label: 'The subject still needs to be identified' }],
    P02: [{ fact: 'currentObservation', expected: true, label: 'The current observation is established' },
      { fact: 'objectiveDependsOnEffect', expected: true, label: 'The objective depends on a control effect' },
      { fact: 'subjectBound', expected: true, label: 'The subject is identified' },
      { fact: 'effectKnown', expected: false, label: 'The effect still needs to be established in the current situation' },
      { fact: 'effectNeedsRevalidation', expected: true, label: 'A prior effect can be checked again in this situation' }],
    P07: [{ fact: 'currentObservation', expected: true, label: 'The current observation is established' },
      { fact: 'objectiveDependsOnEffect', expected: true, label: 'The objective depends on a control effect' },
      { fact: 'subjectBound', expected: true, label: 'The subject is identified' },
      { fact: 'effectKnown', expected: false, label: 'The effect has yet to be measured in this situation' },
      { fact: 'commandAvailable', expected: false, label: 'The command cannot be used here' },
      { fact: 'accessCanBeSought', expected: true, label: 'There is evidence to search for access' }],
    P05: [{ fact: 'currentObservation', expected: true, label: 'The proposed test refers to the current observation' },
      { fact: 'objectiveDependsOnEffect', expected: true, label: 'An objective supported by evidence depends on this control' },
      { fact: 'subjectBound', expected: true, label: 'The subject of the test is identified' },
      { fact: 'effectKnown', expected: false, label: 'The effect has yet to be measured in this situation' },
      { fact: 'commandAvailable', expected: true, label: 'The command is available in the current situation' },
      { fact: 'alreadyTried', expected: false, label: 'The command has yet to be tried in this situation' }],
  },
} satisfies StrategyGraph<Primitive, Fact>, ['currentObservation', 'objectiveDependsOnEffect', 'subjectBound',
  'effectKnown', 'effectNeedsRevalidation', 'commandAvailable', 'alreadyTried', 'accessCanBeSought']);

/** Choose a single available proposal. Callers supply a fresh situation for the next decision. */
export function chooseControlEffectPrimitive<Plan>(facts: Facts, offers: Partial<Record<Primitive, () => Plan | null>>) {
  return resolveStrategyGraph({
    graph: controlEffectNextGraph, facts, mode: 'active',
    planners: { P01: offers.P01 ?? unavailable, P02: offers.P02 ?? unavailable,
      P05: offers.P05 ?? unavailable, P07: offers.P07 ?? unavailable },
  });
}

function unavailable(): null { return null; }

function controlTrialFacts(action: string, offeredAt: unknown, context: ControlTrialContext): Facts {
  const current = offeredAt === context.observationRef && context.evidence.includes(context.observationRef);
  const evidence: [string, ...string[]] = [context.observationRef, ...context.evidence.filter(ref => ref !== context.observationRef)];
  const fact = (value: boolean): StrategyFact => current ? { value, evidence } : { value: 'unknown' };
  return {
    currentObservation: fact(true), objectiveDependsOnEffect: fact(context.objectiveSupported), subjectBound: fact(context.subjectBound),
    commandAvailable: fact(context.availableActions.includes(action)), effectKnown: fact(context.effectKnown),
    alreadyTried: fact(context.triedInContext),
  };
}

/** Qualify the family's prepared offer. The caller owns the subject, trial history and execution. */
export function qualifyControlTrial<Offer>(offer: Offer, action: string, offeredAt: unknown, context: ControlTrialContext) {
  const assessment = chooseControlEffectPrimitive(controlTrialFacts(action, offeredAt, context), { P05: () => offer });
  return assessment.entries.find(entry => entry.id === 'P05')!;
}

function rankControlTrial(facts: Facts, remaining: number): Required<ControlTrialVerdict> {
  // Only P05 has an actual prepared offer at this boundary. The other primitives have no planners here.
  const assessment = resolveStrategyGraph({
    graph: controlEffectNextGraph, facts, mode: 'shadow', priorities: ['P05'],
    planners: { P01: unavailable, P02: unavailable, P05: unavailable, P07: unavailable },
  }).entries[0]!;
  const affordable = remaining >= 1;
  return { selected: assessment.result === 'shadow' && affordable, applicability: assessment.applicability,
    reason: assessment.result === 'shadow' && !affordable ? 'One action is required for the control trial.' : assessment.reason,
    evidence: assessment.evidence ?? [] };
}

function observeControlTrial(offer: Pick<ControlTrialOffer, 'action' | 'context'>, reference: ControlTrialVerdict | AgendaEntry,
  shadow: Required<ControlTrialVerdict>, target: ControlTrialEvaluation, offers?: readonly RankedControlTrial[]): void {
  if (!target.observe) return;
  try {
    const active = 'result' in reference
      ? { selected: reference.result === 'selected', applicability: reference.applicability,
        reason: reference.reason, evidence: [...reference.evidence ?? []] }
      : { ...reference, ...(reference.evidence ? { evidence: [...reference.evidence] } : {}) };
    const fields = ['selected', 'applicability', 'reason', 'evidence'] as const;
    const firstDifference = fields.find(field => active[field] !== undefined
      && JSON.stringify(active[field]) !== JSON.stringify(shadow[field])) ?? null;
    target.observe({ need: controlEffectNeed, mode: target.active ? 'active' : 'shadow', family: target.family,
      observationRef: offer.context.observationRef, action: offer.action, cost: 1, remaining: target.remaining,
      reference: active, shadow, firstDifference, ...(offers ? { offers } : {}) });
  } catch {
    // A diagnostic consumer cannot interrupt a native decision.
  }
}

/** The supplier passes only prepared offers, ordered by its historical priority at equal cost. */
export function selectControlTrialOffer<Offer extends ControlTrialOffer>(offers: readonly Offer[],
  target: ControlTrialEvaluation): Offer | undefined {
  const ranked = offers.map(offer => ({ offer,
    verdict: rankControlTrial(controlTrialFacts(offer.action, offer.offeredAt, offer.context), target.remaining) }));
  const first = ranked[0];
  if (!first) return undefined;
  const chosen = ranked.find(candidate => candidate.verdict.selected);
  if (target.observe) {
    const offer = first.offer, reference = qualifyControlTrial(offer, offer.action, offer.offeredAt, offer.context);
    observeControlTrial(offer, reference, { ...first.verdict, selected: chosen === first }, target,
      ranked.map(candidate => ({ action: candidate.offer.action, cost: 1, applicability: candidate.verdict.applicability,
        reason: candidate.verdict.reason, evidence: candidate.verdict.evidence,
        result: candidate === chosen ? 'selected' : candidate.verdict.selected ? 'lower_priority' : 'skipped' })));
  }
  return target.active ? chosen?.offer : first.offer;
}

/** Compare the actual local decision with a plan-free selection on the same prepared offer. */
export function compareControlTrial(action: string, offeredAt: unknown, context: ControlTrialContext,
  reference: ControlTrialVerdict | AgendaEntry, target: ControlTrialEvaluation): boolean {
  let selected = false;
  try {
    const shadow = rankControlTrial(controlTrialFacts(action, offeredAt, context), target.remaining);
    selected = shadow.selected;
    observeControlTrial({ action, context }, reference, shadow, target);
  } catch {
    // A diagnostic consumer cannot interrupt a native decision.
  }
  return selected;
}

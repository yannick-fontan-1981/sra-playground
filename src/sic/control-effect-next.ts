import { compileStrategyGraph, resolveStrategyGraph, type StrategyFact, type StrategyGraph } from './strategy-agenda.ts';

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

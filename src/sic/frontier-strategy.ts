import { evaluateStrategyGuards, runStrategyAgenda, type StrategyFact, type StrategyGuard } from './strategy-agenda.ts';

export const frontierStrategies = {
  test_local_input: 'Test an untried input on the current board',
  reach_open_input: 'Reach a known board with an untried input',
} as const;

type FrontierStrategy = keyof typeof frontierStrategies;
const guards = {
  test_local_input: [{ fact: 'openInputHere', expected: true, label: 'An admitted input remains untried on this board' }],
  reach_open_input: [{ fact: 'openInputHere', expected: false, label: 'The admitted inputs on this board have all been tried' }],
} satisfies Record<FrontierStrategy, readonly [StrategyGuard<'openInputHere'>]>;

export function selectFrontierStrategy<T>(firstQuestion: T | undefined, observationRef: string) {
  const facts: Record<'openInputHere', StrategyFact> = {
    openInputHere: { value: firstQuestion !== undefined, evidence: [observationRef] },
  };
  return runStrategyAgenda<FrontierStrategy, { question: T | null }>([
    { id: 'test_local_input', ...evaluateStrategyGuards(facts, guards.test_local_input), evidence: [observationRef],
      plan: () => firstQuestion === undefined ? null : { question: firstQuestion } },
    { id: 'reach_open_input', ...evaluateStrategyGuards(facts, guards.reach_open_input), evidence: [observationRef],
      plan: () => ({ question: null }) },
  ] as const, 'active');
}

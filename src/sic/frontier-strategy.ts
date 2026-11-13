import { compileStrategyGraph, resolveStrategyGraph, type StrategyFact } from './strategy-agenda.ts';
import { sicNeedId } from './need-identity.ts';

export const frontierStrategies = {
  test_local_input: 'Test an untried input on the current board',
  reach_open_input: 'Reach a known board with an untried input',
} as const;

export type FrontierStrategy = keyof typeof frontierStrategies;
export function isFrontierStrategy(value: unknown): value is FrontierStrategy {
  return typeof value === 'string' && Object.hasOwn(frontierStrategies, value);
}
export function frontierInformationNeed(scope: string, subject: string, parentObjective: string, evidence: readonly string[]) {
  const identity = { kind: 'observe_untried_input_effect', scope, subjects: [subject], parentObjective,
    satisfactionContract: 'acquire_the_selected_input_return' } as const;
  return { ...identity, id: sicNeedId(identity), evidence, status: 'assigned' } as const;
}
const graph = compileStrategyGraph<FrontierStrategy, 'openInputHere'>({
  id: 'frontier-information', version: 1, order: 'FALLBACK', priorities: ['test_local_input', 'reach_open_input'],
  strategies: {
    test_local_input: [{ fact: 'openInputHere', expected: true, label: 'An admitted input remains untried on this board' }],
    reach_open_input: [{ fact: 'openInputHere', expected: false, label: 'The admitted inputs on this board have all been tried' }],
  },
}, ['openInputHere']);

export function selectFrontierStrategy<T>(firstQuestion: T | undefined, observationRef: string) {
  const facts: Record<'openInputHere', StrategyFact> = {
    openInputHere: { value: firstQuestion !== undefined, evidence: [observationRef] },
  };
  return resolveStrategyGraph<FrontierStrategy, 'openInputHere', { question: T | null }>({
    graph, facts, mode: 'active',
    planners: {
      test_local_input: () => firstQuestion === undefined ? null : { question: firstQuestion },
      reach_open_input: () => ({ question: null }),
    },
  });
}

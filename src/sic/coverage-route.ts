import type { NativePoint } from '../logos-engine/v6-native-types.ts';
import { composePlan } from './effect-composer.ts';

type CoverageEdge<T> = { point: NativePoint; visits: number; step: T; uses?: number; phase?: number };
type Coverage = { point: NativePoint; visits: number; spent: number; phase: number; first: boolean };

/** A position reached with different visits or available supports is a different planning state. */
export function searchCoverageRoute<T>(start: NativePoint, goal: NativePoint, acquired: number, required: number,
  edges: (position: NativePoint, first: boolean, spent: number, phase: number) => Iterable<CoverageEdge<T>>,
  limit = 8192, startPhase = 0,
): T[] | null {
  const atGoal = (point: NativePoint) => point[0] === goal[0] && point[1] === goal[1];
  const result = composePlan<Coverage, T>({
    domain: 'visit-coverage', initial: { point: start, visits: acquired, spent: 0, phase: startPhase, first: true },
    key: state => [state.point.join(','), state.visits, state.spent, state.phase, state.first && atGoal(start)].join('/'),
    goal: { relation: 'reach exit after all required visits', holds: state => !state.first && atGoal(state.point) },
    budget: { commands: limit, states: limit + 1 },
    *choices(before) {
      for (const { point, visits, step, uses = 0, phase = before.phase } of edges(before.point, before.first, before.spent, before.phase)) {
        yield { action: step, after: { point, visits: before.visits | visits, spent: before.spent | uses, phase, first: false },
          requires: [{ relation: 'support not yet consumed', holds: state => !(state.spent & uses) }],
          maintains: [{ relation: 'retain confirmed visits', holds: state => (state.visits & before.visits) === before.visits }],
          ensures: [{ relation: 'exit requires complete coverage', holds: state => !atGoal(state.point) || state.visits === required }] };
      }
    },
  });
  return result?.effects.map(effect => effect.action) ?? null;
}

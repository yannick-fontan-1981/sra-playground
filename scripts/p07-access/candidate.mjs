import { planConditionalAccess } from '../../src/sic/access-policy.ts';
import { beliefKey, enabledActions, initialState, isGoal, normalizeBelief, observe, observationKey, publicBelief, publicProblem, stepState } from './runtime.mjs';

/** Candidate receives the same declarative public model and hypotheses as the frozen composer. */
export function planAccess(spec, { parent = false, initialBelief } = {}) {
  spec = publicProblem(spec);
  const initial = normalizeBelief(initialBelief ? publicBelief(spec, initialBelief) : spec.initial.map((_, world) => initialState(spec, world)));
  const groups = new Map();
  for (const state of initial) {
    const key = observationKey(observe(spec, state));
    const group = groups.get(key) ?? [];
    group.push(state);
    groups.set(key, group);
  }
  if (groups.size === 1) return solve(spec, initial, parent);
  let explored = 0, discovered = 0, worstCommands = 0;
  const initialBranches = {};
  for (const [key, states] of groups) {
    const budget = { ...spec.budget, states: spec.budget.states - discovered };
    const result = solve({ ...spec, budget }, states, parent);
    explored += result.explored;
    discovered += result.discovered;
    if (result.status !== 'solved') return { policy: null, explored, discovered, worstCommands: null, status: result.status };
    initialBranches[key] = result.policy;
    worstCommands = Math.max(worstCommands, result.worstCommands);
  }
  return { policy: { initialBranches }, explored, discovered, worstCommands, status: 'solved', algorithm: 'conditional-access' };
}

function solve(spec, initial, parent) {
  const result = planConditionalAccess({
    initial,
    key: beliefKey,
    goal: states => states.every(state => isGoal(spec, state)),
    choices: function* (states) {
      for (const action of enabledActions(spec, states)) {
        const groups = new Map();
        let safe = true;
        for (const state of states) {
          const result = stepState(spec, state, action.id, { parent });
          if (!result.valid) { safe = false; break; }
          const observation = observationKey(result.observation);
          const group = groups.get(observation) ?? [];
          group.push(result.state);
          groups.set(observation, group);
        }
        if (!safe) continue;
        yield { action: action.id, outcomes: [...groups].map(([observation, states]) => ({ observation, state: normalizeBelief(states) })) };
      }
    },
    budget: spec.budget,
  });
  return { ...result, algorithm: 'conditional-access', initialObservation: observationKey(observe(spec, initial[0])) };
}

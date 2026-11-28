import { exits } from './terrain.mjs';
import { stateKey, transitions } from './models.mjs';

export function controlOrder(rules, prior) {
  return prior && rules.controls.includes(prior.control)
    ? [prior.control, ...rules.controls.filter(action => action !== prior.control)]
    : rules.controls;
}

export function fixedWorkflow(rules, prior) {
  const controls = controlOrder(rules, prior);
  let nextTrial = 0, waiting = 0;
  return {
    decide({ observed }) {
      if (observed.target === null && rules.visibility === 'start' && observed.position === 0) {
        return { action: 'inspect', need: 'identify_destination' };
      }
      if (observed.open) {
        if (observed.position < rules.approach) return { action: 'advance', need: 'reach_gate' };
        if (observed.target !== null) return { action: observed.target, need: 'take_identified_exit' };
        if (rules.visibility === 'gate') return { action: 'inspect', need: 'identify_destination' };
        return { reason: 'destination_indistinguishable', missing: 'observation_identifying_the_goal_exit' };
      }
      if (waiting > 0) {
        waiting--;
        return { action: 'wait', need: 'wait_for_controller_effect' };
      }
      const action = controls[nextTrial++];
      if (action === undefined) return { reason: 'controller_trials_exhausted' };
      waiting = 2;
      return { action, need: 'test_controller' };
    },
    expanded: () => 0,
  };
}

export function onlineComposition(rules, prior) {
  const controls = controlOrder(rules, prior);
  const memo = new Map();
  const partialMemo = new Map();
  const exhausted = Symbol('search_budget_exhausted');
  let expanded = 0;

  function countExpansion() {
    if (expanded >= rules.searchBudget) throw exhausted;
    expanded++;
  }

  function* choices(observed, models, state) {
    const actions = [];
    if (observed.open && observed.position === rules.approach && observed.target) actions.push(observed.target);
    if (observed.target === null && (rules.visibility === 'start' && observed.position === 0
      || rules.visibility === 'gate' && observed.open && observed.position === rules.approach)) actions.push('inspect');
    if (!observed.open) actions.push(...controls);
    if (observed.position < rules.approach) actions.push('advance');
    actions.push('wait');
    const candidates = new Set();

    for (const action of actions) {
      const outcomes = [...transitions(rules, observed, models, action).values()];
      const next = outcomes.map(branch => stateKey(branch.observed, branch.models));
      const signature = JSON.stringify(next);
      if (next.includes(state) || candidates.has(signature)) continue;
      candidates.add(signature);
      yield { action, outcomes };
    }
  }

  function solve(observed, models, depth) {
    if (observed.outcome === 'win') return true;
    if (depth < rules.approach - observed.position + 1 || observed.outcome === 'loss') return false;
    const state = stateKey(observed, models);
    const key = depth + ':' + state;
    if (memo.has(key)) return memo.get(key);
    countExpansion();
    for (const { action, outcomes } of choices(observed, models, state)) {
      if (outcomes.every(branch => solve(branch.observed, branch.models, depth - 1))) {
        memo.set(key, action);
        return action;
      }
    }
    memo.set(key, false);
    return false;
  }

  function solvePartial(observed, models, depth) {
    if (observed.outcome === 'win') return { coverage: models.length };
    if (depth < rules.approach - observed.position + 1 || observed.outcome === 'loss') return { coverage: 0 };
    const state = stateKey(observed, models);
    const key = depth + ':' + state;
    if (partialMemo.has(key)) return partialMemo.get(key);
    countExpansion();
    let best = { coverage: 0 };
    for (const { action, outcomes } of choices(observed, models, state)) {
      const coverage = outcomes.reduce((total, branch) => total + solvePartial(branch.observed, branch.models, depth - 1).coverage, 0);
      if (coverage > best.coverage) best = { action, coverage };
      if (coverage === models.length) break;
    }
    partialMemo.set(key, best);
    return best;
  }

  function describe(action, horizon, coverage, hypotheses) {
    const need = controls.includes(action) ? 'establish_opening_control'
      : exits.includes(action) ? 'transfer_through_open_gate'
        : action === 'inspect' ? 'identify_destination'
          : action === 'advance' ? 'approach_while_preserving_opening' : 'await_opening_while_preserving_position';
    return { action, need, horizon, supportedHypotheses: coverage, hypotheses };
  }

  return {
    decide({ observed, models, remaining }) {
      if (rules.visibility === 'never' && observed.target === null) {
        return { reason: 'destination_indistinguishable', missing: 'observation_identifying_the_goal_exit' };
      }
      let partial;
      try {
        for (let depth = rules.approach - observed.position + 1; depth <= remaining; depth++) {
          const action = solve(observed, models, depth);
          if (typeof action === 'string') return describe(action, depth, models.length, models.length);
        }
        for (let depth = rules.approach - observed.position + 1; depth <= remaining; depth++) {
          const { action, coverage } = solvePartial(observed, models, depth);
          if (action && (!partial || coverage > partial.supportedHypotheses)) {
            partial = describe(action, depth, coverage, models.length);
          }
        }
      } catch (error) {
        if (error !== exhausted) throw error;
        return partial ?? { reason: 'search_budget_exhausted' };
      }
      return partial ?? { reason: 'no_justified_plan_within_move_budget' };
    },
    expanded: () => expanded,
  };
}

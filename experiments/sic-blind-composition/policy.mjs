import assert from 'node:assert/strict';
import { createInterface } from 'node:readline';
import { composePlan } from '../../src/sic/effect-composer.ts';
import { knownRole, publicModel, signalKey, validate } from './domain.mjs';

const terminal = { action: null };

function linearPlan(model, belief, ordered, remaining, counter) {
  if (!counter.left()) return undefined;
  return composePlan({
    initial: belief, key: model.key,
    goal: { relation: 'official_survival_and_win', holds: states => {
      counter.visit();
      return model.won(states);
    } },
    budget: { commands: remaining, states: counter.left() },
    choices: states => ordered.flatMap(action => {
      const after = model.advance(states, action);
      return model.lost(after) ? [] : [{ action, after }];
    }),
  })?.effects.map(effect => effect.action);
}

function contingentPlan(model, belief, ordered, remaining, counter) {
  const memo = new Map();
  function search(states, depth) {
    if (model.won(states)) return terminal;
    if (model.lost(states) || model.distance(states) > depth) return undefined;
    const key = JSON.stringify([depth, states]);
    if (memo.has(key)) return memo.get(key);
    if (!counter.left()) return undefined;
    counter.visit();

    if (states.length === 1) {
      const path = linearPlan(model, states, ordered, depth, counter);
      if (!path) return undefined;
      const steps = path.map(action => {
        states = model.advance(states, action);
        return [action, model.partition(states).keys().next().value];
      });
      const plan = steps.reduceRight((next, [action, outcome]) =>
        ({ action, branches: new Map([[outcome, next]]) }), terminal);
      memo.set(key, plan);
      return plan;
    }

    for (const action of ordered) {
      const after = model.advance(states, action);
      if (model.lost(after) || model.distance(after) > depth - 1) continue;
      const branches = model.partition(after);
      for (const [outcome, candidates] of branches) {
        const continuation = search(candidates, depth - 1);
        if (!continuation) break;
        branches.set(outcome, continuation);
      }
      if ([...branches.values()].some(Array.isArray)) continue;
      const plan = { action, branches };
      memo.set(key, plan);
      return plan;
    }
    if (counter.left()) memo.set(key, undefined);
  }

  for (let depth = model.distance(belief); depth <= remaining && counter.left(); depth++) {
    const plan = search(belief, depth);
    if (plan) return plan;
  }
}

function publicProbe(model, belief, ordered, remaining, counter) {
  let best;
  for (const action of ordered) {
    if (!counter.left()) break;
    counter.visit();
    const after = model.advance(belief, action);
    if (model.lost(after) || model.distance(after) > remaining - 1) continue;
    const branches = [...model.partition(after).values()];
    if (branches.length < 2) continue;
    const largest = Math.max(...branches.map(branch => branch.length));
    if (!best || largest < best.largest) best = { action, largest };
  }
  return best?.action;
}

export function createPolicy(domain, mode, prior) {
  assert.ok(['fixed', 'active'].includes(mode));
  validate(domain);
  const model = publicModel(domain);
  let belief = model.initial;
  let visits = 0, turns = 0, pending, fixed = [], active;
  const counter = { left: () => domain.budget.states - visits, visit: () => {
    assert.ok(visits < domain.budget.states);
    visits++;
  } };
  const known = new Map();
  const roles = [...new Set(domain.worlds.flatMap(world => Object.keys(world.roles ?? {})))];
  const eligiblePrior = domain.scope && prior?.scope === domain.scope
    && domain.actions.includes(prior.action) && domain.worlds.some(world =>
      Object.hasOwn(world.roles ?? {}, prior.role) && world.roles[prior.role] === prior.action) ? prior.action : undefined;

  function orderedActions() {
    if (eligiblePrior && (knownRole(domain, belief, prior.role) ?? eligiblePrior) === eligiblePrior) {
      return [eligiblePrior, ...domain.actions.filter(command => command !== eligiblePrior)];
    }
    return domain.actions;
  }

  function decide() {
    assert.equal(pending, undefined);
    const remaining = domain.budget.commands - turns;
    if (!remaining) return { stop: 'command_budget', states: visits };
    if (model.distance(belief) > remaining) return { stop: 'unreachable_in_compatible_world', states: visits };
    const ordered = orderedActions();
    let action, route;
    if (mode === 'fixed') {
      if (!fixed.length) fixed = linearPlan(model, belief, ordered, remaining, counter) ?? [];
      action = fixed.shift();
      route = 'common_prefix';
    } else {
      active ??= contingentPlan(model, belief, ordered, remaining, counter);
      action = active?.action;
      route = 'conditional_plan';
    }
    if (action === undefined) {
      action = publicProbe(model, belief, ordered, remaining, counter);
      route = 'public_probe';
    }
    if (action === undefined) return { stop: counter.left() ? 'observation_needed' : 'search_budget', states: visits };
    pending = action;
    return { action, route, states: visits, hypotheses: belief.length };
  }

  function record(returned) {
    assert.ok(pending !== undefined);
    const key = signalKey(returned);
    const candidates = model.partition(model.advance(belief, pending)).get(key);
    assert.ok(candidates, 'The public return did not match any public hypothesis');
    turns++;
    for (const role of roles) {
      if (known.has(role) || knownRole(domain, belief, role) !== undefined) continue;
      const action = knownRole(domain, candidates, role);
      if (action !== undefined && domain.scope) known.set(role, { scope: domain.scope, role, action, turn: turns });
    }
    belief = candidates;
    active = active?.branches.get(key);
    pending = undefined;
    return { known: Object.fromEntries(known), hypotheses: belief.length };
  }
  return { decide, record };
}

if (process.argv[2] === 'worker') {
  const lines = createInterface({ input: process.stdin });
  let policy;
  for await (const line of lines) {
    const request = JSON.parse(line);
    let answer;
    switch (request.type) {
      case 'start':
        assert.equal(policy, undefined);
        policy = createPolicy(request.domain, request.mode, request.prior);
        answer = policy.decide();
        break;
      case 'return': {
        const acquisition = policy.record(request.signal);
        answer = { acquisition, decision: request.signal.outcome ? null : policy.decide() };
        break;
      }
      default:
        throw new Error('Unexpected worker request');
    }
    process.stdout.write(JSON.stringify(answer) + '\n');
  }
}

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { composePlan } from '../../src/sic/effect-composer.ts';
import { enabledActions, initialState, isGoal, observationKey, observe, predicate, publicProblem,
  stateKey, stepState } from './runtime.mjs';

export const frozenSource = Object.freeze({
  revision: '20433007224accc36e3d7976696d9ee7a783a227',
  path: 'src/sic/effect-composer.ts',
  gitBlob: 'f54a624abaaa89e4d5363f41869017f4e7f99b35',
  scope: 'Frozen common composePlan, with a shared declarative conformant-access adapter; not a full native SIC run.',
});

// Fail closed if an experiment silently compares against a changed historical module.
const source = readFileSync(new URL('../../src/sic/effect-composer.ts', import.meta.url));
const blob = createHash('sha1').update(`blob ${source.length}\0`).update(source).digest('hex');
if (blob !== frozenSource.gitBlob) throw new Error(`Frozen composePlan changed: ${blob}`);

function unique(states) {
  const byKey = new Map(states.map(state => [stateKey(state), state]));
  return [...byKey.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, state]) => state);
}

const beliefKey = belief => belief.map(stateKey).sort().join('\n');

/**
 * The historical composer returns one sequence per already observable initial
 * situation. All initially indistinguishable hypotheses must admit that same
 * sequence. This adapter never sees which hidden hypothesis will be executed.
 * Later observation branches only serialize the same fixed command sequence.
 */
export function planFrozen(spec, { parent = false } = {}) {
  spec = publicProblem(spec);
  const groups = new Map();
  for (const state of unique(spec.initial.map((_, world) => initialState(spec, world)))) {
    const key = observationKey(observe(spec, state));
    const group = groups.get(key) ?? [];
    group.push(state);
    groups.set(key, group);
  }
  let examined = 0;
  function sequencePolicy(commands, belief, index) {
    if (index === commands.length) return null;
    const action = commands[index];
    const branches = new Map();
    for (const state of belief) {
      const next = stepState(spec, state, action, { parent });
      const key = observationKey(next.observation);
      const group = branches.get(key) ?? [];
      group.push(next.state);
      branches.set(key, group);
    }
    return {
      action,
      branches: Object.fromEntries([...branches.entries()].sort(([a], [b]) => a.localeCompare(b))
        .map(([key, states]) => [key, sequencePolicy(commands, unique(states), index + 1)])),
    };
  }

  const initialBranches = {}, commandsByObservation = {};
  let worstCommands = 0;
  for (const [observation, initial] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const remainingStates = Math.max(0, spec.budget.states - examined);
    const plan = composePlan({
      initial,
      key: beliefKey,
      goal: {
        relation: 'Access has been executed in every compatible initial hypothesis',
        holds: belief => {
          examined++;
          return belief.every(state => isGoal(spec, state)
            && (!parent || predicate(spec.parentInvariant, state.values)));
        },
      },
      *choices(belief) {
        for (const action of enabledActions(spec, belief)) {
          const results = belief.map(state => stepState(spec, state, action.id, { parent }));
          if (results.some(result => !result.valid)) continue;
          const after = unique(results.map(result => result.state));
          if (beliefKey(after) === beliefKey(belief)) continue;
          yield {
            action: action.id,
            after,
            evidence: [...new Set(results.flatMap(result => result.events ?? [])
              .filter(event => event.dependency).map(event => event.dependency))],
          };
        }
      },
      budget: { ...spec.budget, states: remainingStates },
    });
    if (!plan) return {
      policy: null,
      explored: examined,
      worstCommands: null,
      status: examined >= spec.budget.states ? 'state-budget-exhausted' : 'no-conformant-plan',
    };
    const commands = plan.effects.map(effect => effect.action);
    initialBranches[observation] = sequencePolicy(commands, initial, 0);
    commandsByObservation[observation] = commands;
    worstCommands = Math.max(worstCommands, commands.length);
  }

  return {
    policy: groups.size === 1 ? Object.values(initialBranches)[0] : { initialBranches },
    explored: examined,
    worstCommands,
    status: 'solved',
    ...(groups.size === 1 ? { commands: Object.values(commandsByObservation)[0] } : { commandsByObservation }),
  };
}

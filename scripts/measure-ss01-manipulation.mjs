// Independent test oracle. The planner and the shipped site never import this module.
import assert from 'node:assert/strict';
import { compileLevel, initialState, stepWorld } from '../src/games/sinking-star/core.ts';
import { SS01_LEVELS } from '../src/games/sinking-star/levels.ts';

const moved = (a, b) => a.x !== b.x || a.y !== b.y;
export function measureManipulation(level, tickets) {
  const world = compileLevel(SS01_LEVELS[level - 1]);
  let state = initialState(world), resets = tickets[0]?.resets;
  const steps = [], runs = [];
  for (const [i, ticket] of tickets.entries()) {
    if (ticket.resets !== resets) {
      state = initialState(world);
      resets = ticket.resets;
    }
    const id = Number(ticket.action.slice(6)), next = stepWorld(world, state, id, ticket.data);
    const step = { at: i + 1, revision: ticket.decisionRevision, resets, kind: 'other' };
    if (id <= 4 && moved(state.hero, next.hero)) {
      step.kind = 'walk';
      for (const [kind, key] of [['crate', 'rocks'], ['mirror', 'mirrors']]) {
        if (state[key].length !== next[key].length) { step.kind = 'conversion'; break; }
        const part = state[key].findIndex((p, j) => moved(p, next[key][j]));
        if (part >= 0) { Object.assign(step, { kind, part }); break; }
      }
    } else if (id === 5 && moved(state.hero, next.hero)) step.kind = 'transfer';
    const previous = steps.at(-1);
    if (step.kind === 'crate' || step.kind === 'mirror') {
      if (previous?.revision === step.revision && previous.resets === resets && previous.kind === step.kind && previous.part === step.part)
        runs.at(-1).last = step.at;
      else runs.push({ kind: step.kind, first: step.at, last: step.at });
    }
    if (step.kind === 'transfer' && previous?.kind === 'walk' && previous.resets === resets) {
      let start = i - 1;
      while (start > 0 && steps[start-1].kind === 'walk' && steps[start-1].resets === resets && steps[start-1].revision === previous.revision) start--;
      runs.push({ kind: 'position', first: start + 1, last: i, activation: i + 1 });
    }
    steps.push(step);
    state = next;
  }
  assert.equal(state.complete, true, 'Executed SS01 L' + level + ' tickets do not reproduce the official goal');
  return runs.filter(r => r.last > r.first);
}

export function requireManipulation(runs, required, level) {
  for (const kind of required)
    assert.ok(runs.some(run => run.kind === kind), 'SS01 L' + level + ' lost consecutive ' + kind + ' actions');
}

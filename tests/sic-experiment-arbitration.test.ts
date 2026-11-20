import test from 'node:test';
import assert from 'node:assert/strict';
import { hasExperimentOpportunity, recordReturn, mayPursueWitnessedEffect } from '../src/sic/experiment-arbitration.ts';
import { initialMemory } from '../src/sic/preparation-experiments.ts';
import { planningGroupsWithExperiments } from '../src/sic/experiment-selection-groups.ts';
import { standalonePlanningGroups } from '../src/sic/standalone-families.ts';
import { publicInputExplorationId } from '../src/sic/public-input-exploration.ts';
import { compositionFamily } from '../src/sic/test-observed-compositions.ts';
import { preparedEffectsId } from '../src/sic/test-prepared-effects.ts';

test('return history expires and fresh progress immediately restores precedence', () => {
  const memory = initialMemory(1);
  const history = memory.returnHistory = { repeatedChanges: 0, recent: [] };
  memory.turns = 6;
  for (let i = 0; i < 3; i++) recordReturn(history, true, true);
  assert.equal(hasExperimentOpportunity(memory), true);
  memory.frontier.lastScene = memory.turns;
  assert.equal(hasExperimentOpportunity(memory), false);
  memory.turns++;
  for (let i = 0; i < 8; i++) recordReturn(history, false, false);
  assert.equal(hasExperimentOpportunity(memory), false);
  memory.recurrences = 6;
  recordReturn(history, false, true);
  assert.equal(hasExperimentOpportunity(memory), false);
  recordReturn(history, false, true);
  assert.equal(hasExperimentOpportunity(memory), true);
});

test('a verified terminal memory yields to another strategy which just opened a new state', () => {
  const memory = initialMemory(2);
  memory.previewLearning = { bindings: {}, terminal: [{ actor: 'subject', marker: 'goal', offset: [0,0], pitch: [1,1], before: 'a', after: 'b', at: [1,1], from: [0,1], destination: [1,1], q: 'ACTION1', support: 1, peers: 0 }], lastActor: {}, seen: {}, rejected: {}, last: null, motion: {} };
  assert.equal(mayPursueWitnessedEffect(memory), true);
  memory.turns = memory.frontier.lastScene = 1;
  assert.equal(mayPursueWitnessedEffect(memory), false);
  memory.lastTrial = memory.turns;
  assert.equal(mayPursueWitnessedEffect(memory), true);
});

test('all original fallback entries retain their order and experiments share their observation memory', () => {
  const groups = planningGroupsWithExperiments(standalonePlanningGroups);
  assert.equal(groups.length, 16);
  for (const original of standalonePlanningGroups) {
    const group = groups.find(candidate => candidate.id === original.id)!;
    assert.deepEqual(group.families.filter(id => id !== preparedEffectsId && id !== compositionFamily), original.families);
    if (group.entryPoints) assert.equal(group.families.length, group.entryPoints.length);
  }
  const explore = groups.find(group => group.id === 'explore_available_inputs')!;
  assert.ok(explore.families.indexOf(preparedEffectsId) < explore.families.indexOf(publicInputExplorationId));
  assert.ok(explore.families.lastIndexOf(preparedEffectsId) > explore.families.indexOf(publicInputExplorationId));
});

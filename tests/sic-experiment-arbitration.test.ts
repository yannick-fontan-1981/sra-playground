import test from 'node:test';
import assert from 'node:assert/strict';
import { hasExperimentOpportunity, recordReturn, mayPursueWitnessedEffect } from '../src/sic/experiment-arbitration.ts';
import { initialMemory } from '../src/sic/preparation-experiments.ts';
import { planningGroupsWithExperiments } from '../src/sic/experiment-selection-groups.ts';
import { standalonePlanningGroups } from '../src/sic/standalone-families.ts';
import { publicInputExplorationId } from '../src/sic/public-input-exploration.ts';
import { compositionFamily } from '../src/sic/test-observed-compositions.ts';
import { preparedEffectsId } from '../src/sic/test-prepared-effects.ts';
import { assessSilentInput, finishSilentTest, proposeSilentInput, startSilentTest } from '../src/sic/silent-input-experiment.ts';

test('a reproducible arrangement can test a command that has never done anything in either control',()=>{
  const m=initialMemory(1);
  const available=['ACTION2','ACTION4','ACTION6'];
  m.scenes=['one','two','three'].map(name=>name+'|'+available.join(','));
  const add=(s:number,t:number,cmd:string,ref:number)=>{
    m.edges.push({s,t,cmd,ref,stable:true,anchors:{},effect:{key:s===t?'still':'edit:measured',moves:[]}});
  };
  add(0,1,'ACTION2',1);
  add(1,0,'ACTION4',2);
  add(0,0,'ACTION6:8,9',3);
  add(2,2,'ACTION6:8,9',4);
  m.delayed.history=[0,1,2,3,0,1];
  const propose=(minimum=2,budget=2)=>proposeSilentInput(m,0,available,budget,minimum,false);
  assert.equal(propose(3),null);
  assert.equal(propose(2,1),null);
  const setup=propose()!;
  assert.equal(setup.a,'ACTION2');
  assert.equal(setup.b,'ACTION6:8,9');
  assert.equal(setup.silentInput?.inactiveOrigins,2);
  assert.equal(assessSilentInput(m,setup,0,1,setup.a,'edit'),'preparation_verified_test_the_silent_input');
  assert.equal(proposeSilentInput(m,0,available,1,2,true),null);
  assert.equal(proposeSilentInput(m,1,['ACTION2'],1,2,true),null);
  const probe=proposeSilentInput(m,1,available,1,2,true)!;
  assert.equal(probe.phase,'probe');
  assert.equal(assessSilentInput(m,probe,1,2,probe.b,'edit'),'previously_silent_input_changed_the_arrangement');
  assert.equal(assessSilentInput(m,probe,1,1,probe.b,'still'),'input_remained_silent_after_preparation');
  delete m.pendingSilentInput;
  add(1,2,probe.b,7);
  assert.equal(propose(),null);

  const normal=planningGroupsWithExperiments(standalonePlanningGroups,true);
  const configured=planningGroupsWithExperiments(standalonePlanningGroups,true,true);
  assert.ok(!normal.some(group=>group.entryPoints?.includes(startSilentTest)));
  assert.equal(configured[0]!.entryPoints![1],finishSilentTest);
  assert.ok(configured.find(g=>g.id==='explore_available_inputs')!.entryPoints!.includes(startSilentTest));
});

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

test('a pack can place a grounded coverage forecast ahead of independent projected inputs',()=>{
  const base=planningGroupsWithExperiments(standalonePlanningGroups);
  const candidate=planningGroupsWithExperiments(standalonePlanningGroups,true);
  assert.equal(candidate[0]!.entryPoints![0],'test_or_continue_a_grounded_coverage_plan');
  assert.deepEqual(candidate[0]!.families.slice(1),base[0]!.families);
  assert.deepEqual(candidate.slice(1),base.slice(1));
});

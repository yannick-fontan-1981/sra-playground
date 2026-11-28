import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createNativeV6Runtime, NATIVE_V6_REFERENCE_COMMIT } from '../src/logos-engine/v6-native-runtime.ts';
import { defaultRecoveryPack } from '../src/sic/active-recovery.ts';
import { recoveryRevision, readRecoveryRevision } from '../src/sic/recovery-pack.ts';
import { hasExperimentOpportunity, isUnwitnessedDirectionalPreparation,
  recordReturn, mayPursueWitnessedEffect, recurrentExperimentGroup, transferredPreviewGroup } from '../src/sic/experiment-arbitration.ts';
import { initialMemory } from '../src/sic/preparation-experiments.ts';
import { planningGroupsWithExperiments } from '../src/sic/experiment-selection-groups.ts';
import { standalonePlanningGroups } from '../src/sic/standalone-families.ts';
import { publicInputExplorationId } from '../src/sic/public-input-exploration.ts';
import { compositionFamily, composeAtReturnGroup, cycleGroup } from '../src/sic/test-observed-compositions.ts';
import { preparedEffectsId } from '../src/sic/test-prepared-effects.ts';
import { continueMarkedField, learnMarkedLatticeId, verifyMarkedLatticeId } from '../src/sic/marked-lattice.ts';
import { catalogueComparisonId, continueCatalogueViewsGroup } from '../src/sic/catalogue-comparison.ts';
import { continuePanelChainGroup, verifyPanelConfigurationId } from '../src/sic/panel-matching.ts';
import { continueCrossingRowsGroup, learnCrossingRowsId, verifyCrossingRowsId } from '../src/sic/crossing-rows.ts';

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
    assert.deepEqual(group.families.filter((id, index) => id !== preparedEffectsId && id !== compositionFamily
      && ![continueMarkedField, continueCatalogueViewsGroup, continuePanelChainGroup, continueCrossingRowsGroup].includes(group.entryPoints?.[index] ?? '')), original.families);
    if (group.entryPoints) assert.equal(group.families.length, group.entryPoints.length);
  }
  const markerGroup = groups.find(group => group.entryPoints?.includes(continueMarkedField))!;
  const continuations = markerGroup.families.filter((_id, index) => markerGroup.entryPoints?.[index] === continueMarkedField);
  assert.deepEqual(continuations, [verifyMarkedLatticeId, learnMarkedLatticeId]);
  assert.ok(markerGroup.entryPoints!.lastIndexOf(continueMarkedField) < markerGroup.families.indexOf(preparedEffectsId));
  assert.equal(markerGroup.families[markerGroup.entryPoints!.indexOf(continueCatalogueViewsGroup)], catalogueComparisonId);
  assert.ok(markerGroup.entryPoints!.indexOf(continueCatalogueViewsGroup) < markerGroup.families.indexOf(preparedEffectsId));
  assert.equal(markerGroup.families[markerGroup.entryPoints!.indexOf(continuePanelChainGroup)], verifyPanelConfigurationId);
  assert.ok(markerGroup.entryPoints!.indexOf(continuePanelChainGroup) < markerGroup.families.indexOf(preparedEffectsId));
  assert.deepEqual(markerGroup.families.filter((_id, index) => markerGroup.entryPoints?.[index] === continueCrossingRowsGroup),
    [verifyCrossingRowsId, learnCrossingRowsId]);
  assert.ok(markerGroup.entryPoints!.lastIndexOf(continueCrossingRowsGroup) < markerGroup.families.indexOf(preparedEffectsId));
  const explore = groups.find(group => group.id === 'explore_available_inputs')!;
  assert.ok(explore.families.indexOf(preparedEffectsId) < explore.families.indexOf(publicInputExplorationId));
  assert.ok(explore.families.lastIndexOf(preparedEffectsId) > explore.families.indexOf(publicInputExplorationId));
});

test('a translated directional preparation waits for the public frontier until supported by local progress', () => {
  const preparation = { stage: 'prepare' as const, origin: 'current-placement', training: 'previous-placement',
    revised: false, a: 'ACTION4', b: 'ACTION1', c: 'ACTION3' };
  assert.equal(isUnwitnessedDirectionalPreparation(preparation), true);
  assert.equal(isUnwitnessedDirectionalPreparation({ ...preparation, training: preparation.origin }), false);
  assert.equal(isUnwitnessedDirectionalPreparation({ ...preparation, revised: true }), false);
  assert.equal(isUnwitnessedDirectionalPreparation({ ...preparation, stage: 'test' }), false);
  assert.equal(isUnwitnessedDirectionalPreparation({ ...preparation, b: 'ACTION6:8,3' }), false);
});

test('a pack can place a grounded coverage forecast ahead of independent projected inputs',()=>{
  const base=planningGroupsWithExperiments(standalonePlanningGroups);
  const candidate=planningGroupsWithExperiments(standalonePlanningGroups,true);
  assert.equal(candidate[0]!.entryPoints![0],'test_or_continue_a_grounded_coverage_plan');
  assert.deepEqual(candidate[0]!.families.slice(1),base[0]!.families);
  assert.deepEqual(candidate.slice(1),base.slice(1));
});

test('a witnessed composition is offered before a new control contrast at the same frontier', () => {
  const plans = (prioritize: boolean) => planningGroupsWithExperiments(standalonePlanningGroups, false, false, prioritize);
  const original = plans(false);
  const candidate = plans(true);
  const frontier = original.findIndex(group => group.id === 'explore_available_inputs');
  assert.ok(frontier >= 0);
  const before = original[frontier]!;
  const after = candidate[frontier]!;
  const index = before.entryPoints!.indexOf(recurrentExperimentGroup);
  assert.deepEqual(before.entryPoints!.slice(index, index + 3), [recurrentExperimentGroup, composeAtReturnGroup, cycleGroup]);
  assert.deepEqual(after.entryPoints!.slice(index, index + 3), [composeAtReturnGroup, cycleGroup, recurrentExperimentGroup]);
  assert.deepEqual(after.families.slice(index, index + 3), [compositionFamily, compositionFamily, preparedEffectsId]);
  assert.deepEqual(candidate.filter((_, i) => i !== frontier), original.filter((_, i) => i !== frontier));
});

test('both planning modes dispatch the same experimental capabilities and accept the same preferences', async () => {
  const root = new URL(`../reference/v6/${NATIVE_V6_REFERENCE_COMMIT}/source/agents/yf_arc3_v6/`, import.meta.url);
  const load = async (path: string) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
  const declarations = { common: await load('laya_proto/common_frontier_policy.drm.json'), strategy: await load('morphology_policy/strategy.drm') };
  const preference = { strategy: 'prefer_a_verified_coverage_experiment', mode: 'active', minimumOutcomes: 2 } as const;
  async function coverage(solver: 'sic' | 'sic-fallback') {
    const pack = recoveryRevision({ ...defaultRecoveryPack, solver, informationPreference: preference });
    const recovery = readRecoveryRevision(JSON.parse(JSON.stringify(pack))).configuration;
    assert.deepEqual(recovery.informationPreference, preference);
    const result = (await createNativeV6Runtime(declarations, { recovery })).snapshot().coverage;
    assert.ok(result && Array.isArray(result.registeredFamilies));
    return { registeredFamilies: result.registeredFamilies, sourceGroups: result.sourceGroups };
  }
  const full = await coverage('sic');
  const fallback = await coverage('sic-fallback');
  assert.deepEqual(full.registeredFamilies, fallback.registeredFamilies);
  for (const id of [preparedEffectsId, compositionFamily]) assert.ok(full.registeredFamilies.includes(id));
  const byId = (groups: typeof full.sourceGroups) => Object.fromEntries(groups.map(group => [group.id, group]));
  assert.deepEqual(byId(full.sourceGroups), byId(fallback.sourceGroups));
  const exploration = byId(full.sourceGroups).explore_available_inputs!;
  assert.equal(exploration.families[0], preparedEffectsId);
  assert.equal(exploration.entryPoints?.[0], transferredPreviewGroup);
  for (const id of ['coordinate_visible_motion', 'interpret_examples_and_collections',
    'construct_executable_program', 'follow_symbol_diagram', 'place_incoming_groups']) {
    assert.ok(full.sourceGroups.findIndex(group => group.id === id)
      < full.sourceGroups.findIndex(group => group.id === exploration.id), id);
  }
  const projected = fallback.sourceGroups[0]!;
  assert.equal(projected.entryPoints?.[0], 'test_or_continue_a_grounded_coverage_plan');
  assert.ok(full.sourceGroups.findIndex(group => group.id === projected.id) > 0);
});

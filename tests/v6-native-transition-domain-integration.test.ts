import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { NativeCompositionAuthority } from '../src/logos-engine/v6-native-authority.ts';
import { NativeCallerCoordinator } from '../src/logos-engine/v6-native-caller.ts';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';
import { measureNativeObservation, ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';
import type { NativeAuthorityTransition } from '../src/logos-engine/v6-native-authority.ts';
import type { NativeCommand, NativeObservation, NativeProposal, NativePublicObservation } from '../src/logos-engine/v6-native-types.ts';

type R = Record<string, any>;
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const common = JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', source), 'utf8'));
const strategy = JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', source), 'utf8'));
const witness = JSON.parse(gunzipSync(await readFile(new URL(
  '../docs/migration/native-campaigns-v35/dico-domain-public-witness.json.gz', import.meta.url))).toString('utf8')) as {
  before: NativePublicObservation; after: NativePublicObservation; command: NativeCommand;
  neutralBefore: NativeObservation; neutralAfter: NativeObservation;
};
const transitionOracle = JSON.parse(await readFile(new URL('./fixtures/v6-transition-reference.json', import.meta.url), 'utf8'));
const originalRule = (name: string): R => structuredClone(transitionOracle.cases.find((row: R) => row.name === name).expected);
const EPISODE = 'common-observation-frontier';
const execution = { yieldControl: async () => {} };

/**
 * The original fixture's OP18 information-question contract, explicitly bound
 * to one already witnessed public command. This is a release/acquisition test,
 * not a generated DICO strategy, a supplied solution or a full-agent campaign.
 * Its unknown expectation cannot confirm any mechanism or game objective.
 */
function publicTransitionContract(observation: NativeObservation): NativeProposal {
  const ref = `C_public_transition_domain_contract_${observation.revision}`;
  const purpose = 'Observe the response to this public input; its effect and terminal contribution remain unknown.';
  const actions = [structuredClone(witness.command)];
  const facts = { current_input_publicly_available: observation.available_action_refs.includes(witness.command.action_ref) };
  return {
    status: 'proposed', kind: 'public_transition_acquisition_contract', actions,
    steps: [{ action: actions[0], expected_after: null, seal_after: true }], facts,
    binding: { observation_ref: observation.observation_ref, level_epoch: observation.level_epoch,
      levels_completed: observation.levels_completed, frame_hash: observation.frame_hash },
    compositions: [{ id: ref, observed: false, role: 'information_question', open_question: purpose,
      properties: { causal_terminal_role: 'unknown' }, relations: ['contributes_to:G_official_completion'] }],
    question: { reason: purpose, hypothesis_refs: [observation.observation_ref] }, route_refs: [observation.observation_ref],
    bundle_template: { operation_key: 'OP18', composition_ref: ref, objective_ref: 'G_official_completion',
      preserve_refs: [], purpose, preconditions: facts, evidence: [observation.observation_ref], actions,
      outcome_guard: { path: ['value'], contains: ref } },
  };
}

test('the real authority retains the complete over-domain DICO transition without validating rules and can release again', async () => {
  const { before: first, after: second, neutralBefore: before, neutralAfter: after, command } = structuredClone(witness);
  assert.deepEqual(await measureNativeObservation(first, before.revision, 'domain-witness'), before);
  assert.deepEqual(await measureNativeObservation(second, after.revision, 'domain-witness'), after);
  assert.deepEqual([before.entities.length, after.entities.length], [530, 531]);
  assert.equal(second.frame_packet.length, 10, 'All ten real public animation frames are part of the witness');
  assert.deepEqual([before.level_epoch, after.level_epoch, before.levels_completed, after.levels_completed], [5, 5, 4, 4]);

  const store = new NativeKnowledgeStore('domain-integration-contract', 'domain-witness');
  const authority = new NativeCompositionAuthority(common, 6);
  await authority.initialize(store, before); authority.restore();
  const caller = new NativeCallerCoordinator(authority.memory, { targetLevels: 6,
    domain: new ObservedInputDomain(common.input_domain.max_point_occurrences), strategy: strategy.declarations[0].configuration });
  await caller.initialize(before);

  // Nonempty, unchanged rules from the original public-measurement oracle make
  // loss/refutation/revalidation detectable. They are prior hypotheses from
  // unrelated evidence, never asserted to have been learned from this scene.
  const rules = [originalRule('translation_candidate')];
  const properties = [originalRule('property_at_new_position_acquires')];
  authority.memory.put(EPISODE, 'empirical_registry', rules, 'original-public-measurement-oracle', 1);
  authority.memory.put(EPISODE, 'property_rules', properties, 'original-public-measurement-oracle', 1);
  const checkpoint = async () => {
    await store.commit([...caller.checkpointWrites(), ...authority.checkpointWrites()],
      { workflow: 'test.native-transition-domain', step: 'checkpoint', statement: 'retain_public_acquisition' });
    authority.didCheckpoint();
  };
  await checkpoint();
  const factId = (key: string): string => (store.stateValue('reasoning:memory') as R).facts.find(
    (id: string) => (store.stateValue(id) as R).key === key);
  const registryIds = ['empirical_registry', 'property_rules'].map(factId);
  const registryNodes = registryIds.map(id => store.node(id));
  const registryValues = registryIds.map(id => structuredClone(store.stateValue(id)));
  const frontierBefore = caller.frontier.snapshot();

  const proposal = publicTransitionContract(before);
  assert.equal((await authority.bind(proposal, before)).admitted, true);
  assert.equal(await authority.release(proposal, before,
    { admitted: before.available_action_refs.includes(command.action_ref), reason: 'witnessed_public_input_contract' }, execution), true);
  assert.equal(authority.snapshot().decision.decision.status, 'action_set_released');
  assert.deepEqual(authority.snapshot().decision.decision.model_calls, []);
  const prediction = store.stateValue(`reasoning:prediction:${before.revision}`) as R;
  assert.deepEqual(prediction.prior_rules, rules);
  assert.deepEqual(prediction.prior_property_rules, properties);

  const transition: NativeAuthorityTransition = { before, after, first, second, command, index: 0,
    outcome: { matched: null, seal_prefix: true, reason: 'unknown_effect_contract_no_solver_prediction' } };
  const reconciliation = await authority.acquire(proposal, before.revision, [transition], null, execution, {
    beforeAssessment: observed => caller.beforeAssessment(observed, proposal),
    recordAssessment: (observed, assessment) => caller.recordAssessment(observed, assessment),
    boundaryWitness: observed => caller.boundaryWitness(observed, proposal, before.revision),
  });
  await checkpoint();
  const transitionId = `reasoning:transition:${before.revision}`;
  const retainedNode = store.node(transitionId), retained = store.stateValue(transitionId) as R;
  assert.equal(retainedNode.status, 'observed');
  assert.deepEqual(retainedNode.evidence, [before.observation_ref, after.observation_ref]);
  assert.deepEqual(retained.command, command);
  assert.equal(retained.assessment.status, 'unknown');
  assert.equal(retained.assessment.reason, 'neutral_entity_measurement_domain_exceeded');
  assert.equal(retained.assessment.domain.source_limit, 512);
  assert.deepEqual([retained.assessment.domain.before_entities, retained.assessment.domain.after_entities], [530, 531]);
  assert.equal(retained.assessment.registry_update, 'none');
  assert.equal(retained.assessment.release_authority, false);
  assert.equal(retained.assessment.addressed_assessment.status, 'unknown');
  assert.equal(retained.assessment.addressed_assessment.registry_update, 'none');
  assert.deepEqual(retained.assessment.predictive_applications, []);
  assert.equal(Object.hasOwn(retained.assessment, 'empirical_rules'), false);
  assert.equal(Object.hasOwn(retained.assessment, 'property_rules'), false);
  assert.deepEqual(retained.unassessed_public_transition, {
    before: { measurement: witness.neutralBefore, packet: witness.before },
    after: { measurement: witness.neutralAfter, packet: witness.after },
  }, 'No entity, raster, public protocol field or intermediate animation is removed');
  assert.equal(retained.prospective_prediction_node, `reasoning:prediction:${before.revision}`);
  assert.deepEqual(retained.prospective_prediction_checks.map((check: R) => ({
    rule_id: check.rule_id, status: check.status, validation_performed: check.validation_performed, release_authority: check.release_authority,
  })), [{ rule_id: rules[0]!.rule_id, status: 'unknown', validation_performed: false, release_authority: false }]);
  assert.equal(retained.frontier_acquisition.status, 'observed_transition_retained');
  assert.equal(retained.frontier_acquisition.official_progress, false);
  assert.deepEqual(retained.frontier_acquisition.library_summary, { library_status: 'unknown',
    compatible_models: [], refuted_models: [], unknown_models: [], construction_status: 'unknown' });
  assert.equal(retained.caller_acquisition.selected_result, null, 'No family solver or fabricated learning result was injected');

  const frontier = store.stateValue('caller:frontier') as R;
  assert.equal(frontier.knowledge_revision, frontierBefore.knowledge_revision);
  assert.deepEqual(frontier.rules, frontierBefore.rules);
  assert.equal(Object.keys(frontier.edges).length, 1, 'The unknown mechanism does not discard the real observed edge');
  assert.deepEqual(Object.values(frontier.nodes).map((node: any) => node.measurement_summary.entity_count).sort((a, b) => a - b), [530, 531]);
  assert.equal(reconciliation.executed_prefix_count, 1);
  assert.deepEqual(reconciliation.transition_refs, [{ node: transitionId, before: before.observation_ref, after: after.observation_ref }]);
  assert.deepEqual(reconciliation.boundary_refs, []);
  assert.equal(reconciliation.step_expectations[0].status, 'unknown');
  const analysisState = authority.memory.get(EPISODE, 'state').value;
  assert.deepEqual(analysisState.expected_properties, {});
  assert.deepEqual(analysisState.observed_properties, { official_levels_completed: 4 });
  assert.equal(analysisState.objective_assessments[0].satisfied, false);
  assert.deepEqual(authority.snapshot().analysis.map((row: R) => row.operation), ['OP29', 'OP30', 'OP31']);

  // Resume through the same restored V7 authority and real WHY/ACT programs.
  // This only checks another admission; it executes no further game action.
  authority.restore(); caller.restoreFrom(store);
  const next = publicTransitionContract(after);
  assert.equal((await authority.bind(next, after)).admitted, true);
  assert.equal(await authority.release(next, after,
    { admitted: after.available_action_refs.includes(command.action_ref), reason: 'fresh_public_input_contract' }, execution), true);
  assert.deepEqual(authority.snapshot().decision.decision.model_calls, []);
  assert.equal(store.node(transitionId), retainedNode, 'A later release keeps the retained unknown witness');
  for (const [index, id] of registryIds.entries()) {
    assert.equal(store.node(id), registryNodes[index], 'Neither registry is replaced or revision-bumped by an unperformed assessment');
    assert.deepEqual(store.stateValue(id), registryValues[index]);
  }
});

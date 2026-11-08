import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { SharedSeriesConstraint, createNativeSharedSeriesFamily } from '../src/logos-engine/v6-shared-series.ts';
import { OccurrenceRecallConstraint } from '../src/logos-engine/v6-occurrence-recall.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';
type R = Record<string, any>;
const oracle = JSON.parse(await readFile(new URL('./fixtures/v6-occurrence-reference.json', import.meta.url), 'utf8'));
const anchorOracle = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-coupled-pair-epoch-anchor-reference.json.gz', import.meta.url))).toString());

test('shared series acquires the before-epoch anchor before the unchanged public animation event', () => {
  const family = new SharedSeriesConstraint(oracle.policy), before = oracle.scenes['program:before'], after = oracle.scenes['program:after'];
  const source = oracle.scenarios.find((row: R) => row.id === 'inherited_public_animation_observation')
    .steps.find((row: R) => row.operation.kind === 'record');
  const acquire = () => family.record(before.observation, after.observation, source.operation.command, before.rows, after.rows, {}, 0, after.public.frame_packet);
  const first = acquire();
  assert.deepEqual(first, anchorOracle.journals.find((row: R) => row.id === 'public_packet_anchor_before_program_alignment').steps[0].expected.result,
    'The entire envelope matches the unchanged full ObservedCompositionConstraint');
  assert.deepEqual(first.events.map((event: R) => event.kind), ['coupled_pair_epoch_anchor', 'public_program_phase_alignment']);
  assert.deepEqual(first.events.slice(1), source.expected.result.events);
  assert.equal(first.events[0].epoch, before.observation.level_epoch);
  assert.equal(first.events[0].observation_ref, before.observation.observation_ref);
  assert.deepEqual(acquire(), source.expected.result, 'The same epoch adds packet evidence without acquiring another anchor');
  const state = family.state(), rebuilt = new SharedSeriesConstraint(oracle.policy);
  rebuilt.restore(state);
  assert.deepEqual(rebuilt.state(), state);
  assert.equal(state.events.filter((event: R) => event.kind === 'coupled_pair_epoch_anchor').length, 1);
  assert.equal(state.events.filter((event: R) => event.kind === 'public_program_phase_alignment').length, 2);
});

test('the authoritative V7 shared journal restores recall and anchors together without duplicate acquisition', async () => {
  let family = createNativeSharedSeriesFamily(oracle.policy);
  const before = oracle.scenes['memo:0'], after = oracle.scenes['memo:1'], domain = new ObservedInputDomain(256);
  const proposal = await family.propose(before.observation, before.rows, domain.candidates(before.observation), 600);
  assert.ok(proposal); await family.bind!(proposal, domain);
  assert.equal((await family.before(proposal, 0, before.public, before.observation)).admitted, true);
  const result = await family.record(before.observation, after.observation, proposal.actions[0]!, before.rows, after.rows, proposal, 0, after.public.frame_packet);
  assert.deepEqual((result.events as R[]).map(event => event.kind), ['occurrence_recall_transition', 'coupled_pair_epoch_anchor']);
  const expectedProposal = await family.propose(after.observation, after.rows, domain.candidates(after.observation), 599);
  const store = new NativeKnowledgeStore('shared-series-closure-v1', 'shared-series-restore');
  await store.commit([{ id: 'family_state:public_occurrence_recall', kind: 'family_state', family: family.id, value: family.state() }],
    { workflow: 'v6.composition_strategy.choose', step: 'observed_occurrence_recall', statement: 'acquire' });
  family = createNativeSharedSeriesFamily(oracle.policy);
  family.restore(store.stateValue('family_state:public_occurrence_recall') as R);
  assert.deepEqual(await family.propose(after.observation, after.rows, domain.candidates(after.observation), 599), expectedProposal);
  const passive = await family.record(after.observation, after.observation, { action_ref: 'ACTION6', data: { x: 0, y: 0 } }, after.rows, after.rows, {} as any, 0, []);
  assert.deepEqual(passive.events, [], 'Restoring the authoritative anchor prevents reacquisition for the same epoch');
  assert.deepEqual(family.state(), store.stateValue('family_state:public_occurrence_recall'));
});

test('a rejected shared-series restore preserves both working memories and the complete journal', async () => {
  const family = new SharedSeriesConstraint(oracle.policy), before = oracle.scenes['memo:0'], after = oracle.scenes['memo:1'];
  const proposal = await family.propose(before.observation, before.rows, [], 600);
  assert.ok(proposal);
  family.record(before.observation, after.observation, proposal.actions[0], before.rows, after.rows, proposal, 0, after.public.frame_packet);
  const retained = family.state();
  for (const corrupt of [
    (state: R) => { state.events.find((event: R) => event.kind === 'coupled_pair_epoch_anchor').frame_digest = 'changed'; },
    (state: R) => { state.events.find((event: R) => event.kind === 'occurrence_recall_transition').chosen = 'changed'; },
    (state: R) => { state.events.push({ kind: 'coupled_pair_evidence', state: {} }); },
    (state: R) => { state.events.pop(); },
    (state: R) => { state.digest = 'changed'; },
  ]) {
    const state = structuredClone(retained); corrupt(state);
    assert.throws(() => family.restore(state));
    assert.deepEqual(family.state(), retained);
  }
  const read = family.state(); read.events[0].chosen = 'mutated external copy';
  assert.deepEqual(family.state(), retained);
  const legacy = new OccurrenceRecallConstraint(oracle.policy);
  assert.throws(() => family.restore(legacy.state()), /Shared series memory changed/,
    'A v32 recall-only digest cannot be mistaken for the new shared acquisition closure');
  assert.deepEqual(family.state(), retained);
});

test('restoring an earlier authoritative epoch state permits exact reacquisition of the later anchor', async () => {
  const family = new SharedSeriesConstraint(oracle.policy);
  const steps = anchorOracle.journals.find((row: R) => row.id === 'anchors_use_before_epoch_and_survive_boundaries_and_returns').steps;
  const acquire = (step: R) => {
    const before = anchorOracle.scenes[step.operation.before], after = anchorOracle.scenes[step.operation.after];
    const result = family.record(before.observation, after.observation, step.operation.command, before.rows, after.rows, {}, 0, after.public.frame_packet);
    assert.deepEqual(result, step.expected.result); return result;
  };
  acquire(steps[0]);
  const store = new NativeKnowledgeStore('shared-series-rollback-v1', 'epoch-rollback');
  await store.commit([{ id: 'family_state:public_occurrence_recall', kind: 'family_state', family: family.id, value: family.state() }],
    { workflow: 'v6.composition_strategy.choose', step: 'observed_occurrence_recall', statement: 'acquire' });
  const second = acquire(steps[1]), laterState = family.state();
  assert.deepEqual(laterState.events.map((event: R) => event.epoch), [1, 2]);
  family.restore(store.stateValue('family_state:public_occurrence_recall') as R);
  assert.deepEqual(family.state().events.map((event: R) => event.epoch), [1]);
  assert.deepEqual(acquire(steps[1]), second, 'No previously-seen-epoch cache survives restoration from the actual node');
  assert.deepEqual(family.state(), laterState, 'Reacquisition reproduces both the complete journal and its retained digest');
});

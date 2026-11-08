import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { OccurrenceRecallAccess, OccurrenceRecallConstraint, createNativeOccurrenceRecallFamily } from '../src/logos-engine/v6-occurrence-recall.ts';
import { measureOccurrenceScene, occurrenceCandidates, occurrenceContextScope } from '../src/logos-engine/v6-occurrence-scene.ts';
import { occurrenceCollectionScene, alignOccurrenceProgramPacket } from '../src/logos-engine/v6-occurrence-program-observer.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';

const fixture = JSON.parse(await readFile(new URL('./fixtures/v6-occurrence-reference.json', import.meta.url), 'utf8'));
const root = new URL('../', import.meta.url);
const fresh = () => new OccurrenceRecallConstraint(fixture.policy);

test('occurrence oracle retains unchanged source provenance and the real MEMO family trajectory and its L4 refusal', async () => {
  assert.equal(fixture.provenance.commit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  for (const [path, hash] of Object.entries(fixture.provenance.sources)) {
    const bytes = await readFile(new URL(`reference/v6/${fixture.provenance.commit}/source/${path}`, root));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), hash, path);
  }
  assert.equal(fixture.realGame.code, 'MEMO');
  assert.equal(fixture.realGame.state, 'NOT_FINISHED');
  assert.equal(fixture.realGame.levelsCompleted, 3);
  assert.ok(fixture.realGame.levelsCompleted >= 3);
  assert.ok(fixture.realGame.actions.length > 0);
  assert.ok(fixture.realGame.actions.every((action: any) => action.eventKinds.includes('occurrence_recall_transition')));
});

for (const comparison of fixture.cases) test(`Python ↔ TypeScript occurrence: ${comparison.id}`, () => {
  const args = comparison.arguments, current = args.scene && typeof args.scene === 'string' ? fixture.scenes[args.scene] : null;
  let actual: unknown;
  if (comparison.operation === 'measure') actual = measureOccurrenceScene(current.rows, current.observation, args.calibration ?? null);
  else if (comparison.operation === 'candidates') actual = occurrenceCandidates(args.scene, args.context, args.seen, args.relation, args.comparison);
  else if (comparison.operation === 'context_scope') actual = occurrenceContextScope(args.context);
  else if (comparison.operation === 'before') actual = fresh().before(args.proposal, args.index, current.public, current.observation);
  else if (comparison.operation === 'collection_scene') actual = occurrenceCollectionScene(current.rows);
  else if (comparison.operation === 'align_packet') {
    const before = fixture.scenes[args.before], after = fixture.scenes[args.after];
    actual = alignOccurrenceProgramPacket(before.rows, after.public.frame_packet, { members: args.members, controls: args.controls,
      observation_ref: before.observation.observation_ref, epoch: before.observation.level_epoch,
      command_ref: 'ACTION5', after_observation_ref: after.observation.observation_ref });
  } else throw new Error(`Unknown comparison: ${comparison.operation}`);
  assert.deepEqual(actual, comparison.expected);
});

for (const scenario of fixture.scenarios) test(`Python ↔ TypeScript occurrence journal: ${scenario.id}`, async () => {
  let family = fresh(), proposal: any = null, domain = new ObservedInputDomain(256);
  for (const [ordinal, entry] of scenario.steps.entries()) {
    const operation = entry.operation; let actual: unknown = null;
    if (operation.kind === 'propose') {
      const view = fixture.scenes[operation.scene]; domain = new ObservedInputDomain(256);
      proposal = await family.propose(view.observation, view.rows, domain.candidates(view.observation), operation.remaining ?? 600); actual = proposal;
    } else if (operation.kind === 'bind') { family.bind(proposal, domain); actual = proposal; }
    else if (operation.kind === 'before') {
      const view = fixture.scenes[operation.scene]; actual = family.before(proposal, operation.index ?? 0, view.public, view.observation);
    } else if (operation.kind === 'after' || operation.kind === 'record') {
      const before = fixture.scenes[operation.before], after = fixture.scenes[operation.after], index = operation.index ?? 0;
      actual = operation.kind === 'after'
        ? family.after(proposal, index, before.observation, after.observation, before.rows, after.rows)
        : family.record(before.observation, after.observation, operation.command ?? proposal.actions[index], before.rows, after.rows,
          proposal, index, after.public.frame_packet);
    } else if (operation.kind === 'proposal') { proposal = structuredClone(operation.proposal); actual = proposal; }
    else if (operation.kind === 'restore') family.restore(operation.state);
    else if (operation.kind === 'apply_event') { family.memory.applyEvent(operation.event); family.events.push(operation.event); }
    else throw new Error(`Unexpected journal operation: ${operation.kind}`);

    assert.deepEqual(actual, entry.expected.result, `${ordinal} ${operation.kind}: result`);
    const state = family.state();
    assert.equal(state.digest, entry.expected.digest, `${ordinal} ${operation.kind}: complete source memory digest`);
    assert.equal(state.events.length, entry.expected.eventCount, `${ordinal} ${operation.kind}: event count`);
    // Reconstruction after every operation proves the retained source memory,
    // not the previous JS object's working caches, controls the next question.
    family = fresh(); family.restore(state); assert.deepEqual(family.state(), state);
  }
  assert.deepEqual(family.state(), scenario.finalState, 'All source events and the complete retained digest match');
});

test('native occurrence adapter persists the exact first acquired event in the real V7 graph', async () => {
  const create = () => createNativeOccurrenceRecallFamily(fixture.policy);
  let family = create();
  const store = new NativeKnowledgeStore('unchanged-v6-occurrence-oracle', 'native-occurrence-integration');
  const current = fixture.scenes['memo:0'], next = fixture.scenes['memo:1'], domain = new ObservedInputDomain(256);
  const proposal = await family.propose(current.observation, current.rows, domain.candidates(current.observation), 600);
  assert.ok(proposal); assert.equal(family.id, 'public_occurrence_recall');
  assert.equal(proposal.field_subquestion, 'observed_occurrence_recall');
  await family.bind!(proposal, domain);
  assert.equal((await family.before(proposal, 0, current.public, current.observation)).admitted, true);
  const event = await family.record(current.observation, next.observation, proposal.actions[0]!, current.rows, next.rows,
    proposal, 0, next.public.frame_packet);
  const expected = fixture.scenarios.find((scenario: any) => scenario.id === 'real_MEMO_three_levels_and_L4_refusal').steps.find((entry: any) => entry.operation.kind === 'record').expected;
  assert.deepEqual(event, expected.result);
  await store.commit([
    { id: 'family_state:public_occurrence_recall', kind: 'family_state', family: family.id, value: family.state() },
    { id: 'occurrence:acquired:1', kind: 'prefix_evidence', family: family.id, value: event,
      relations: [{ relation: 'updates', target: 'family_state:public_occurrence_recall' }] },
  ], { workflow: 'v6.composition_strategy.choose', step: 'observed_occurrence_recall', statement: 'acquire' });
  family = create(); family.restore(store.stateValue('family_state:public_occurrence_recall') as any);
  assert.equal(family.state().digest, expected.digest);
  assert.deepEqual(store.stateValue('occurrence:acquired:1'), event);
  const input = family.state(); input.events[0].chosen = 'external-corruption';
  assert.equal(family.state().digest, expected.digest, 'Public state reads do not mutate memory');
  assert.throws(() => family.restore(input), /memory changed/);
  assert.equal(family.state().digest, expected.digest, 'A rejected restore preserves the prior authoritative memory');
});

test('occurrence guards retain point-domain binding, zero-budget refusal, and absent ACTION6 refusal', async () => {
  const current = fixture.scenes['memo:0'], family = fresh(), empty = new ObservedInputDomain(256);
  const proposal = await family.propose(current.observation, current.rows, [], 600);
  assert.ok(proposal);
  assert.throws(() => family.bind(proposal, empty), /domain/);
  empty.candidates(current.observation);
  proposal.actions[0].data.x++;
  assert.throws(() => family.bind(proposal, empty), /point payload/);
  assert.equal(await fresh().propose(current.observation, current.rows, [], 0), null);
  assert.equal(await fresh().propose({ ...current.observation, available_action_refs: ['ACTION1'] }, current.rows, [], 600), null);
  assert.throws(() => new OccurrenceRecallAccess().applyEvent({ kind: 'invented_event' }), /Unexpected repeated-line event/);
});

/** Independent contract review of the explicitly named native adaptations.
 * The source oracle remains unchanged; these tests do not claim full-caller
 * Python equality or a successful game trajectory.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { ReceptionServiceMemory, receptionServiceBefore, receptionServiceAfter } from '../src/logos-engine/v6-reception-service-access.ts';
import { normalizeReceptionWaitBudget } from '../src/logos-engine/v5-reception-wait-contracts.ts';

type R = Record<string, any>;
const fixture: R = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v6-reception-service-reference.json.gz', import.meta.url))).toString());
const copy = <T>(value: T): T => structuredClone(value);
const sourceCase = (id: string): R => {
  const value = fixture.cases.find((item: R) => item.id === id);
  assert.ok(value, `Missing source oracle ${id}`); return value;
};
function native(seed: R[] = []): ReceptionServiceMemory {
  const memory = new ReceptionServiceMemory({ currentEpochAcquisition: true });
  for (const event of seed) memory.applyEvent(copy(event));
  return memory;
}

test('independent source receipts retain the actual originals and all identified discrepancies', () => {
  assert.equal(fixture.originalFilesVerifiedBefore, 1786);
  assert.equal(fixture.originalFilesVerifiedAfter, 1786);
  for (const [name, expected] of Object.entries(fixture.sourceFiles)) {
    const bytes = readFileSync(new URL(`../reference/v6/${fixture.sourceCommit}/source/${name}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, name);
  }
  const alias = fixture.sourceAliasCases[0];
  assert.deepEqual(alias.sharedJournalKinds, ['observed_exposed_reception', 'observed_reception_service']);
  assert.equal(alias.expected[0].memory.epoch, null, 'the actual inherited source alias is not normalized away');
  const stale = sourceCase('record:source_new_epoch_record_keeps_old_memory');
  assert.notEqual(stale.expected[0].memory.epoch, stale.arguments.before.level_epoch);
  assert.equal(stale.expected[0].memory.wait_spent, 7);
  assert.ok(stale.expected[0].memory.refuted.length);
  const exhausted = sourceCase('propose:source_wait_exhaustion_unrelated_probe').expected;
  assert.equal(exhausted.reception_service_plan.kind, 'reception_observation');
  assert.equal(exhausted.reception_service_plan.steps[0].to, null, 'the exhausted source still creates a probe mislabeled as waiting');
  assert.equal(fixture.sourceExceptions.find((item: R) => item.id === 'propose:source_600_action_ledger_rejected').expectedError.type, 'ValidationError');
});

for (const item of fixture.ledgerCases as R[]) test('independent original wait ledger ' + item.id, () => {
  if (item.expectedError) assert.throws(() => normalizeReceptionWaitBudget(copy(item.arguments)));
  else assert.deepEqual(normalizeReceptionWaitBudget(copy(item.arguments)), item.expected);
});

test('native journal separation changes only the documented inherited alias boundary', () => {
  const source = fixture.sourceAliasCases[0], a = copy(source.arguments), memory = native();
  const [acquired] = memory.record(a.before, a.command, a.after, a.rows, a.later, a.proposal, a.index);
  assert.equal(acquired.memory.epoch, a.before.level_epoch);
  assert.deepEqual(acquired.memory.controls, source.expected[0].memory.controls);
  assert.deepEqual(acquired.memory.residual_events, source.expected[0].memory.residual_events);
  assert.deepEqual(acquired.memory.evidence, source.expected[0].memory.evidence);
  assert.deepEqual(memory.currentState().reception_events.map((e: R) => e.kind), ['observed_reception_service']);
  assert.throws(() => memory.applyEvent(copy(source.seedEvents[0])), /Outside reception-service/);
  assert.equal(memory.eventCount, 1, 'another owner cannot silently acquire an event here');
});

test('native cumulative ceiling consumes exactly 128 actual waits across four restores', () => {
  const source = sourceCase('propose:first_stationary_witness'), a = copy(source.arguments);
  let memory = native(source.seedEvents), observation = copy(a.observation), count = 0, prefixes = 0, restores = 0;
  const initialEvents = memory.eventCount;
  const config = { ...a.config, level_action_cap: 600, native_reception_wait_budget: true };
  while (count < 128) {
    const proposal = memory.propose(observation, a.rows, a.inputs, 16, { ...config, remaining_level_actions: 600 - count })!;
    assert.equal(proposal.status, 'proposed');
    assert.equal(proposal.reception_service_plan.kind, 'reception_observation');
    assert.ok(proposal.actions.length >= 1 && proposal.actions.length <= 8);
    assert.ok(proposal.actions.length <= 128 - count);
    if (count === 0) assert.equal(proposal.actions.length, 1, 'stationary permission must first be observed');
    prefixes++;
    for (let index = 0; index < proposal.actions.length; index++) {
      assert.equal(receptionServiceBefore(proposal, index, a.rows, {
        epoch: observation.level_epoch, score: observation.levels_completed,
        observation_ref: observation.observation_ref, available: a.inputs.map((input: R) => input.action_ref),
      }).admitted, true);
      const after = { ...observation, revision: observation.revision + 1, observation_ref: `independent:actual-wait-return:${count + 1}` };
      assert.deepEqual(receptionServiceAfter(proposal, index, a.rows, a.rows, {
        epoch: after.level_epoch, score: after.levels_completed,
      }), { matched: true, seal_prefix: false, reason: 'reception_control_projection' });
      const events = memory.record(observation, proposal.actions[index], after, a.rows, a.rows, proposal, index);
      count++;
      assert.equal(events.length, 1); assert.equal(events[0].memory.wait_spent, count);
      assert.equal(memory.eventCount, initialEvents + count);
      observation = after;
      if ([1, 17, 64, 127].includes(count)) {
        const snapshot = memory.currentState(), digest = memory.retainedDigest('independent:ancestor');
        memory = native(snapshot.reception_events);
        assert.deepEqual(memory.currentState(), snapshot); assert.equal(memory.retainedDigest('independent:ancestor'), digest);
        restores++;
      }
    }
  }
  assert.equal(count, 128); assert.equal(restores, 4); assert.ok(prefixes > 1);
  const snapshot = memory.currentState(), revision = memory.nativeRevision;
  for (let retry = 0; retry < 3; retry++) assert.deepEqual(memory.propose(observation, a.rows, a.inputs, 16,
    { ...config, remaining_level_actions: 600 - count }), {
    status: 'unknown', reason: 'reception_wait_budget_exhausted', block_unrelated_probe: true,
  });
  assert.deepEqual(memory.currentState(), snapshot); assert.equal(memory.nativeRevision, revision);
  assert.equal(600 - count, 472, 'the reception ceiling remains distinct from the whole-level action budget');
});

test('native zero and one wait capacities block without changing the whole-level budget', () => {
  const source = sourceCase('propose:first_stationary_witness'), a = copy(source.arguments);
  for (const cap of [0, 1]) {
    const memory = native(source.seedEvents), config = { ...a.config, remaining_level_actions: 600,
      level_action_cap: cap, native_reception_wait_budget: true };
    const first = memory.propose(a.observation, a.rows, a.inputs, 16, config)!;
    if (cap === 0) {
      assert.equal(first.reason, 'reception_wait_budget_exhausted');
      assert.equal(memory.currentState().reception_memory.wait_spent, 0);
    } else {
      assert.equal(first.actions.length, 1);
      const after = { ...a.observation, revision: a.observation.revision + 1, observation_ref: 'independent:capacity-one-return' };
      memory.record(a.observation, first.actions[0], after, a.rows, a.rows, first, 0);
      assert.equal(memory.propose(after, a.rows, a.inputs, 16, config)!.reason, 'reception_wait_budget_exhausted');
      assert.equal(memory.currentState().reception_memory.wait_spent, 1);
    }
  }
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ViewFrontier } from '../src/logos-engine/v6-view-frontier.ts';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/v6-view-reference.json', import.meta.url), 'utf8'));
const cycle = fixture.scenarios.find((row: { id: string }) => row.id === 'known_entry_and_obstruction_cycle').steps;
const approach = cycle.find((row: { save?: string }) => row.save === 'approach').expected;
const firstStop = cycle.findIndex((row: Record<string, any>) => row.expected?.blockage_question?.stationary_trials === 1);
const { x7: atWall, x8: moved, clear } = fixture.scenes;
const move = { action_ref: 'ACTION1' }, click = { action_ref: 'ACTION6', data: { x: 8, y: 5 } };

async function atFirstStop(withPriorPassage = true) {
  const view = new ViewFrontier();
  const prior = structuredClone(cycle[firstStop - 1].state);
  if (!withPriorPassage) { prior.footprints = []; prior.pass_refs = []; }
  view.restore(prior);
  const record = await view.record(atWall.observation, atWall.observation, move, atWall.rows, atWall.rows, approach, 4);
  return { view, record };
}

test('a second stationary return spends the single repeat and requires a new, unique support experiment', async () => {
  const { view, record } = await atFirstStop();
  const propose = (inputs: (typeof move | typeof click)[]) =>
    view.propose(atWall.observation, atWall.rows, inputs, [], 16, 'active');
  const confirm = await propose([move, click]);
  assert.equal(confirm?.sic_view_decision.strategy, 'confirm_access_obstruction');
  assert.deepEqual(confirm!.actions, [move]);
  const key = record.blockage_question.key;
  assert.deepEqual(record.blockage_question, { key, stationary_trials: 1 });
  const outcome = await view.record(atWall.observation, atWall.observation, move, atWall.rows, atWall.rows, confirm!, 0);
  assert.deepEqual(outcome.blockage_question, { key, stationary_trials: 2 });
  assert.equal(outcome.sic_view_return.objective, confirm!.sic_view_decision.objective.id);
  assert.equal(await propose([move]), null);
  assert.equal(await propose([move, click, click]), null);
  const intervention = await propose([move, click]);
  assert.equal(intervention?.sic_view_decision.strategy, 'test_change_of_witnessed_obstruction');
  assert.deepEqual(intervention!.actions, [click]);
  await view.record(atWall.observation, clear.observation, click, atWall.rows, clear.rows, intervention!, 0);
  const reopened = await view.propose(clear.observation, clear.rows, [move], [], 16, 'active');
  assert.equal(reopened?.sic_view_decision.strategy, 'test_reopened_access');
  assert.deepEqual(reopened!.actions, [move]);
  assert.ok(view.tested.has(key));
});

test('the same authorized repeat and zero new pixels clear the obstruction if the mover actually moved', async () => {
  const { view } = await atFirstStop();
  const confirm = await view.propose(atWall.observation, atWall.rows, [move], [], 16, 'active');
  assert.deepEqual(confirm?.actions, [move]);
  const record = await view.record(atWall.observation, moved.observation, move, atWall.rows, moved.rows, confirm!, 0);
  assert.deepEqual([record.new_viewport_pixels, record.registration.offset, record.blockage_question], [0, [0, 0], null]);
  assert.equal(view.hasObservedViewQuestion(), false);
  assert.equal(await view.propose(moved.observation, moved.rows, [move], [], 16, 'active'), null);
});

test('stationary frames and repeated commands alone never establish an obstruction trial', async () => {
  const { view, record } = await atFirstStop(false);
  assert.equal(record.blockage_question, null);
  const repeated = await view.record(atWall.observation, atWall.observation, move, atWall.rows, atWall.rows, approach, 4);
  assert.equal(repeated.blockage_question, null);
  assert.equal(await view.propose(atWall.observation, atWall.rows, [move], [], 16, 'active'), null);
});

test('a withdrawn command fails the guard and a changed mover, carrier, origin or used key revokes a bound trial', async () => {
  const { view } = await atFirstStop();
  const saved = view.state();
  const confirm = await view.propose(atWall.observation, atWall.rows, [move], [], 16, 'active');
  const packet = { level: atWall.observation.level_epoch, levels_completed: atWall.observation.levels_completed, available_action_refs: ['ACTION6'] };
  assert.equal(view.before(confirm!, 0, packet as any, atWall.observation).admitted, false);
  for (const cause of ['mover', 'carrier', 'origin', 'consumed']) {
    view.restore(saved);
    const observation = structuredClone(atWall.observation);
    if (cause === 'mover') observation.entities = moved.observation.entities;
    if (cause === 'carrier') observation.entities = observation.entities.filter((e: { signature: string }) => e.signature !== saved.block.signature);
    if (cause === 'origin') view.origin = [1, 0];
    if (cause === 'consumed') view.tested.add(saved.block.key);
    assert.equal(await view.propose(observation, atWall.rows, [move], [], 16, 'active'), null, cause);
    assert.equal(view.block, null, cause);
  }
});
